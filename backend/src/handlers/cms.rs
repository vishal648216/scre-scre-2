use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use chrono::Utc;
use futures_util::stream::StreamExt;
use mongodb::options::FindOptions;
use mongodb::{
    Database,
    bson::{doc, oid::ObjectId},
};
use serde::Deserialize;

use crate::config::languages::get_supported_languages;
use crate::models::cms::CMSItem;
use crate::models::download_category::DownloadCategory;
use crate::models::user::{Claims, UserRole};
use crate::services::translation_service::register_and_pretranslate;

pub async fn list_download_categories(
    State(db): State<Database>,
) -> (StatusCode, Json<Vec<serde_json::Value>>) {
    let coll = db.collection::<mongodb::bson::Document>("download_categories");
    let find_opts = FindOptions::builder().sort(doc! { "order": 1 }).build();
    let mut cursor = match coll.find(None, find_opts).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };
    let mut cats = Vec::new();
    while let Some(Ok(doc)) = cursor.next().await {
        let mut json_val = serde_json::to_value(&doc).unwrap();

        if let Some(obj) = json_val.as_object_mut() {
            if let Some(id_val) = obj.get("_id") {
                if let Some(oid_str) = id_val.get("$oid").and_then(|v| v.as_str()) {
                    obj.insert(
                        "_id".to_string(),
                        serde_json::Value::String(oid_str.to_string()),
                    );
                }
            }
        }

        cats.push(json_val);
    }
    (StatusCode::OK, Json(cats))
}

pub async fn create_download_category(
    State(db): State<Database>,
    claims: Claims,
    Json(mut cat): Json<DownloadCategory>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"message": "Unauthorized"})),
        );
    }
    cat.id = None;
    cat.created_at = Some(Utc::now());
    cat.updated_at = Some(Utc::now());
    let coll = db.collection::<DownloadCategory>("download_categories");
    match coll.insert_one(cat, None).await {
        Ok(_) => (
            StatusCode::CREATED,
            Json(serde_json::json!({"success": true})),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"message": "Failed"})),
        ),
    }
}

pub async fn update_download_category(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(cat): Json<DownloadCategory>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"message": "Unauthorized"})),
        );
    }
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"message": "Invalid ID"})),
            );
        }
    };
    let coll = db.collection::<DownloadCategory>("download_categories");
    let mut update_doc = mongodb::bson::to_document(&cat).unwrap();
    update_doc.remove("_id");
    update_doc.insert("updated_at", Utc::now());
    match coll
        .update_one(doc! { "_id": oid }, doc! { "$set": update_doc }, None)
        .await
    {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"success": true}))),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"message": "Failed"})),
        ),
    }
}

pub async fn delete_download_category(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"message": "Unauthorized"})),
        );
    }
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"message": "Invalid ID"})),
            );
        }
    };
    let coll = db.collection::<DownloadCategory>("download_categories");
    match coll.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"success": true}))),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"message": "Failed"})),
        ),
    }
}

#[derive(Debug, Deserialize)]
pub struct CMSQuery {
    pub category: Option<String>,
    pub active_only: Option<bool>,
    pub lang: Option<String>,
    pub download_category_id: Option<String>,
}

pub async fn list_cms_items(
    State(db): State<Database>,
    Query(q): Query<CMSQuery>,
) -> (StatusCode, Json<Vec<serde_json::Value>>) {
    // For all categories, use cms_items
    let coll = db.collection::<mongodb::bson::Document>("cms_items");
    let mut filter = doc! {};

    if let Some(cat) = q.category {
        filter.insert("category", cat);
    }

    if let Some(dcid) = q.download_category_id {
        filter.insert("download_category_id", dcid);
    }

    if q.active_only.unwrap_or(false) {
        filter.insert("active", true);
    }

    let find_opts = FindOptions::builder()
        .sort(doc! { "order": 1, "created_at": -1 })
        .build();

    let mut cursor = match coll.find(filter, find_opts).await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("CMS list error: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new()));
        }
    };

    let lang = q.lang.unwrap_or_else(|| "en".to_string());
    let mut items = Vec::new();
    while let Some(res) = cursor.next().await {
        match res {
            Ok(doc) => {
                let mut json_val = serde_json::to_value(&doc).unwrap();

                // Translate fields if lang is not English
                if lang != "en" {
                    if let Some(obj) = json_val.as_object_mut() {
                        if let Some(title) = obj.get("title").and_then(|v| v.as_str()) {
                            if let Ok(t) = crate::services::translation_service::get_translation(
                                &db, title, &lang,
                            )
                            .await
                            {
                                obj.insert("title".to_string(), serde_json::Value::String(t));
                            }
                        }
                        if let Some(desc) = obj.get("description").and_then(|v| v.as_str()) {
                            if let Ok(t) = crate::services::translation_service::get_translation(
                                &db, desc, &lang,
                            )
                            .await
                            {
                                obj.insert("description".to_string(), serde_json::Value::String(t));
                            }
                        }
                        if let Some(content) = obj.get("content").and_then(|v| v.as_str()) {
                            if let Ok(t) = crate::services::translation_service::get_translation(
                                &db, content, &lang,
                            )
                            .await
                            {
                                obj.insert("content".to_string(), serde_json::Value::String(t));
                            }
                        }
                        if let Some(bt) = obj.get("button_text").and_then(|v| v.as_str()) {
                            if let Ok(t) = crate::services::translation_service::get_translation(
                                &db, bt, &lang,
                            )
                            .await
                            {
                                obj.insert("button_text".to_string(), serde_json::Value::String(t));
                            }
                        }
                        if let Some(tag) = obj.get("tag").and_then(|v| v.as_str()) {
                            if let Ok(t) = crate::services::translation_service::get_translation(
                                &db, tag, &lang,
                            )
                            .await
                            {
                                obj.insert("tag".to_string(), serde_json::Value::String(t));
                            }
                        }
                        if let Some(h) = obj.get("highlight").and_then(|v| v.as_str()) {
                            if let Ok(t) =
                                crate::services::translation_service::get_translation(&db, h, &lang)
                                    .await
                            {
                                obj.insert("highlight".to_string(), serde_json::Value::String(t));
                            }
                        }
                        if let Some(d) = obj.get("designation").and_then(|v| v.as_str()) {
                            if let Ok(t) =
                                crate::services::translation_service::get_translation(&db, d, &lang)
                                    .await
                            {
                                obj.insert("designation".to_string(), serde_json::Value::String(t));
                            }
                        }
                        if let Some(s) = obj.get("specialization").and_then(|v| v.as_str()) {
                            if let Ok(t) =
                                crate::services::translation_service::get_translation(&db, s, &lang)
                                    .await
                            {
                                obj.insert(
                                    "specialization".to_string(),
                                    serde_json::Value::String(t),
                                );
                            }
                        }
                        if let Some(e) = obj.get("education").and_then(|v| v.as_str()) {
                            if let Ok(t) =
                                crate::services::translation_service::get_translation(&db, e, &lang)
                                    .await
                            {
                                obj.insert("education".to_string(), serde_json::Value::String(t));
                            }
                        }
                        if let Some(vcbt) = obj.get("view_courses_button_text").and_then(|v| v.as_str()) {
                            if let Ok(t) = crate::services::translation_service::get_translation(
                                &db, vcbt, &lang,
                            )
                            .await
                            {
                                obj.insert("view_courses_button_text".to_string(), serde_json::Value::String(t));
                            }
                        }
                        if let Some(s1t) = obj.get("stat1_text").and_then(|v| v.as_str()) {
                            if let Ok(t) = crate::services::translation_service::get_translation(
                                &db, s1t, &lang,
                            )
                            .await
                            {
                                obj.insert("stat1_text".to_string(), serde_json::Value::String(t));
                            }
                        }
                        if let Some(s2t) = obj.get("stat2_text").and_then(|v| v.as_str()) {
                            if let Ok(t) = crate::services::translation_service::get_translation(
                                &db, s2t, &lang,
                            )
                            .await
                            {
                                obj.insert("stat2_text".to_string(), serde_json::Value::String(t));
                            }
                        }
                        if let Some(s3t) = obj.get("stat3_text").and_then(|v| v.as_str()) {
                            if let Ok(t) = crate::services::translation_service::get_translation(
                                &db, s3t, &lang,
                            )
                            .await
                            {
                                obj.insert("stat3_text".to_string(), serde_json::Value::String(t));
                            }
                        }
                        if let Some(s4t) = obj.get("stat4_text").and_then(|v| v.as_str()) {
                            if let Ok(t) = crate::services::translation_service::get_translation(
                                &db, s4t, &lang,
                            )
                            .await
                            {
                                obj.insert("stat4_text".to_string(), serde_json::Value::String(t));
                            }
                        }
                        if let Some(role) = obj.get("role").and_then(|v| v.as_str()) {
                            if let Ok(t) = crate::services::translation_service::get_translation(
                                &db, role, &lang,
                            )
                            .await
                            {
                                obj.insert("role".to_string(), serde_json::Value::String(t));
                            }
                        }
                        if let Some(sd) = obj.get("student_description").and_then(|v| v.as_str()) {
                            if let Ok(t) = crate::services::translation_service::get_translation(
                                &db, sd, &lang,
                            )
                            .await
                            {
                                obj.insert("student_description".to_string(), serde_json::Value::String(t));
                            }
                        }
                    }
                }

                if let Some(obj) = json_val.as_object_mut() {
                    if let Some(id_val) = obj.get("_id") {
                        if let Some(oid_str) = id_val.get("$oid").and_then(|v| v.as_str()) {
                            obj.insert(
                                "_id".to_string(),
                                serde_json::Value::String(oid_str.to_string()),
                            );
                        }
                    }
                }
                items.push(json_val);
            }
            Err(e) => eprintln!("CMS item decode error: {}", e),
        }
    }
    (StatusCode::OK, Json(items))
}

pub async fn create_cms_item(
    State(db): State<Database>,
    claims: Claims,
    Json(mut item): Json<serde_json::Value>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"message": "Unauthorized"})),
        );
    }

    let coll = db.collection::<mongodb::bson::Document>("cms_items");
    let mut doc = match mongodb::bson::to_document(&item) {
        Ok(d) => d,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"message": "Invalid data"})),
            );
        }
    };

    let title_for_translate = doc.get_str("title").unwrap_or_default().to_string();
    let description_for_translate = doc.get_str("description").unwrap_or_default().to_string();
    let content_for_translate = doc.get_str("content").unwrap_or_default().to_string();
    let designation_for_translate = doc.get_str("designation").unwrap_or_default().to_string();
    let specialization_for_translate = doc
        .get_str("specialization")
        .unwrap_or_default()
        .to_string();
    let education_for_translate = doc.get_str("education").unwrap_or_default().to_string();
    let button_text_for_translate = doc.get_str("button_text").unwrap_or_default().to_string();
    let tag_for_translate = doc.get_str("tag").unwrap_or_default().to_string();
    let highlight_for_translate = doc.get_str("highlight").unwrap_or_default().to_string();
    let view_courses_button_text_for_translate = doc.get_str("view_courses_button_text").unwrap_or_default().to_string();
    let stat1_text_for_translate = doc.get_str("stat1_text").unwrap_or_default().to_string();
    let stat2_text_for_translate = doc.get_str("stat2_text").unwrap_or_default().to_string();
    let stat3_text_for_translate = doc.get_str("stat3_text").unwrap_or_default().to_string();
    let stat4_text_for_translate = doc.get_str("stat4_text").unwrap_or_default().to_string();
    let role_for_translate = doc.get_str("role").unwrap_or_default().to_string();
    let student_description_for_translate = doc.get_str("student_description").unwrap_or_default().to_string();

    doc.remove("_id");
    doc.insert("created_at", Utc::now());
    doc.insert("updated_at", Utc::now());

    match coll.insert_one(doc, None).await {
        Ok(res) => {
            let db_clone = db.clone();
            let source_id = res
                .inserted_id
                .as_object_id()
                .map(|v| v.to_hex())
                .unwrap_or_else(|| "unknown".to_string());
            let langs: Vec<String> = get_supported_languages()
                .iter()
                .map(|l| l.to_string())
                .collect();
            tokio::spawn(async move {
                if !title_for_translate.is_empty() {
                    register_and_pretranslate(
                        &db_clone,
                        "cms.title",
                        &source_id,
                        &title_for_translate,
                        &langs,
                    )
                    .await;
                }
                if !description_for_translate.trim().is_empty() {
                    register_and_pretranslate(
                        &db_clone,
                        "cms.description",
                        &source_id,
                        &description_for_translate,
                        &langs,
                    )
                    .await;
                }
                if !content_for_translate.trim().is_empty() {
                    register_and_pretranslate(
                        &db_clone,
                        "cms.content",
                        &source_id,
                        &content_for_translate,
                        &langs,
                    )
                    .await;
                }
                if !designation_for_translate.trim().is_empty() {
                    register_and_pretranslate(
                        &db_clone,
                        "cms.designation",
                        &source_id,
                        &designation_for_translate,
                        &langs,
                    )
                    .await;
                }
                if !specialization_for_translate.trim().is_empty() {
                    register_and_pretranslate(
                        &db_clone,
                        "cms.specialization",
                        &source_id,
                        &specialization_for_translate,
                        &langs,
                    )
                    .await;
                }
                if !education_for_translate.trim().is_empty() {
                    register_and_pretranslate(
                        &db_clone,
                        "cms.education",
                        &source_id,
                        &education_for_translate,
                        &langs,
                    )
                    .await;
                }
                if !button_text_for_translate.trim().is_empty() {
                    register_and_pretranslate(
                        &db_clone,
                        "cms.button_text",
                        &source_id,
                        &button_text_for_translate,
                        &langs,
                    )
                    .await;
                }
                if !tag_for_translate.trim().is_empty() {
                    register_and_pretranslate(
                        &db_clone,
                        "cms.tag",
                        &source_id,
                        &tag_for_translate,
                        &langs,
                    )
                    .await;
                }
                if !highlight_for_translate.trim().is_empty() {
                    register_and_pretranslate(
                        &db_clone,
                        "cms.highlight",
                        &source_id,
                        &highlight_for_translate,
                        &langs,
                    )
                    .await;
                }
                if !view_courses_button_text_for_translate.trim().is_empty() {
                    register_and_pretranslate(
                        &db_clone,
                        "cms.view_courses_button_text",
                        &source_id,
                        &view_courses_button_text_for_translate,
                        &langs,
                    )
                    .await;
                }
                if !stat1_text_for_translate.trim().is_empty() {
                    register_and_pretranslate(
                        &db_clone,
                        "cms.stat1_text",
                        &source_id,
                        &stat1_text_for_translate,
                        &langs,
                    )
                    .await;
                }
                if !stat2_text_for_translate.trim().is_empty() {
                    register_and_pretranslate(
                        &db_clone,
                        "cms.stat2_text",
                        &source_id,
                        &stat2_text_for_translate,
                        &langs,
                    )
                    .await;
                }
                if !stat3_text_for_translate.trim().is_empty() {
                    register_and_pretranslate(
                        &db_clone,
                        "cms.stat3_text",
                        &source_id,
                        &stat3_text_for_translate,
                        &langs,
                    )
                    .await;
                }
                if !stat4_text_for_translate.trim().is_empty() {
                    register_and_pretranslate(
                        &db_clone,
                        "cms.stat4_text",
                        &source_id,
                        &stat4_text_for_translate,
                        &langs,
                    )
                    .await;
                }
                if !role_for_translate.trim().is_empty() {
                    register_and_pretranslate(
                        &db_clone,
                        "cms.role",
                        &source_id,
                        &role_for_translate,
                        &langs,
                    )
                    .await;
                }
                if !student_description_for_translate.trim().is_empty() {
                    register_and_pretranslate(
                        &db_clone,
                        "cms.student_description",
                        &source_id,
                        &student_description_for_translate,
                        &langs,
                    )
                    .await;
                }
            });
            (
                StatusCode::CREATED,
                Json(serde_json::json!({"success": true, "message": "Item created"})),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"message": "Create failed"})),
        ),
    }
}

pub async fn update_cms_item(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(item): Json<serde_json::Value>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"message": "Unauthorized"})),
        );
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"message": "Invalid ID"})),
            );
        }
    };

    let coll = db.collection::<mongodb::bson::Document>("cms_items");
    let mut doc = match mongodb::bson::to_document(&item) {
        Ok(d) => d,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"message": "Invalid data"})),
            );
        }
    };

    doc.remove("_id");
    doc.remove("created_at");
    doc.insert("updated_at", Utc::now());

    match coll
        .update_one(doc! { "_id": oid }, doc! { "$set": doc }, None)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!({"success": true, "message": "Item updated"})),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"message": "Update failed"})),
        ),
    }
}

pub async fn delete_cms_item(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"message": "Unauthorized"})),
        );
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"message": "Invalid ID"})),
            );
        }
    };

    let coll = db.collection::<CMSItem>("cms_items");
    match coll.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!({"success": true, "message": "Item deleted"})),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"message": "Delete failed"})),
        ),
    }
}
