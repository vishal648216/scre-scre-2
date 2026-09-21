use crate::models::qb::{Question, QuestionBank};
use crate::models::user::{Claims, UserRole};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use futures_util::StreamExt;
use mongodb::{
    Database,
    bson::{DateTime, doc, oid::ObjectId},
    options::FindOptions,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct QbMsg {
    pub success: bool,
    pub message: String,
}

fn admin_ok(role: &UserRole) -> bool {
    matches!(role, UserRole::Admin | UserRole::SuperAdmin)
}

// --- Bank Handlers ---

pub async fn list_banks(
    State(db): State<Database>,
    _claims: Claims,
) -> (StatusCode, Json<Vec<serde_json::Value>>) {
    let coll = db.collection::<mongodb::bson::Document>("qb_banks");
    let find_opts = FindOptions::builder()
        .sort(doc! { "created_at": -1 })
        .build();
    let mut cur = match coll.find(None, find_opts).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };
    let mut v = Vec::new();
    while let Some(res) = cur.next().await {
        if let Ok(mut doc) = res {
            // Get the bank's _id
            if let Some(bank_oid) = doc.get_object_id("_id").ok() {
                // Count the number of questions for this bank
                let q_coll = db.collection::<mongodb::bson::Document>("qb_questions");
                let count = match q_coll
                    .count_documents(doc! { "bank_id": bank_oid }, None)
                    .await
                {
                    Ok(c) => c as i64,
                    Err(_) => 0,
                };
                doc.insert("question_count", count);
            }

            let mut json_val = serde_json::to_value(&doc).unwrap();
            // Critical: Force ID to string
            if let Some(obj) = json_val.as_object_mut() {
                // Process _id
                if let Some(id_val) = obj.get("_id") {
                    if let Some(oid_str) = id_val.get("$oid").and_then(|v| v.as_str()) {
                        obj.insert(
                            "_id".to_string(),
                            serde_json::Value::String(oid_str.to_string()),
                        );
                    } else if let Some(oid_str) = id_val.as_str() {
                        obj.insert(
                            "_id".to_string(),
                            serde_json::Value::String(oid_str.to_string()),
                        );
                    }
                }
                // Process category_id, course_id, subject_id
                for field in &["category_id", "course_id", "subject_id"] {
                    if let Some(val) = obj.get(*field) {
                        if let Some(oid_str) = val.get("$oid").and_then(|v| v.as_str()) {
                            obj.insert(
                                field.to_string(),
                                serde_json::Value::String(oid_str.to_string()),
                            );
                        } else if let Some(oid_str) = val.as_str() {
                            obj.insert(
                                field.to_string(),
                                serde_json::Value::String(oid_str.to_string()),
                            );
                        }
                    }
                }
            }
            v.push(json_val);
        }
    }
    (StatusCode::OK, Json(v))
}

#[derive(Debug, Deserialize)]
pub struct CreateBankPayload {
    pub name: String,
    pub target_question_count: Option<i32>,
    pub category_id: Option<String>,
    pub course_id: Option<String>,
    pub subject_id: Option<String>,
}

pub async fn create_bank(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateBankPayload>,
) -> (StatusCode, Json<QbMsg>) {
    if !admin_ok(&claims.role) {
        return (
            StatusCode::FORBIDDEN,
            Json(QbMsg {
                success: false,
                message: "Unauthorized".into(),
            }),
        );
    }
    let coll = db.collection::<mongodb::bson::Document>("qb_banks");
    let mut new_bank = doc! {
        "name": payload.name,
        "target_question_count": payload.target_question_count,
        "created_at": DateTime::now(),
    };
    if let Some(cat_id) = payload.category_id {
        if let Ok(oid) = ObjectId::parse_str(&cat_id) {
            new_bank.insert("category_id", oid);
        }
    }
    if let Some(course_id) = payload.course_id {
        if let Ok(oid) = ObjectId::parse_str(&course_id) {
            new_bank.insert("course_id", oid);
        }
    }
    if let Some(sub_id) = payload.subject_id {
        if let Ok(oid) = ObjectId::parse_str(&sub_id) {
            new_bank.insert("subject_id", oid);
        }
    }
    match coll.insert_one(new_bank, None).await {
        Ok(_) => (
            StatusCode::CREATED,
            Json(QbMsg {
                success: true,
                message: "Bank created".into(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(QbMsg {
                success: false,
                message: "Failed to create bank".into(),
            }),
        ),
    }
}

#[derive(Debug, Deserialize)]
pub struct UpdateBankPayload {
    pub name: Option<String>,
    pub target_question_count: Option<i32>,
    pub category_id: Option<String>,
    pub course_id: Option<String>,
    pub subject_id: Option<String>,
}

pub async fn update_bank(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<UpdateBankPayload>,
) -> (StatusCode, Json<QbMsg>) {
    if !admin_ok(&claims.role) {
        return (
            StatusCode::FORBIDDEN,
            Json(QbMsg {
                success: false,
                message: "Unauthorized".into(),
            }),
        );
    }
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(QbMsg {
                    success: false,
                    message: "Invalid ID".into(),
                }),
            );
        }
    };
    let coll = db.collection::<mongodb::bson::Document>("qb_banks");
    let mut update_doc = doc! {};
    if let Some(name) = payload.name {
        update_doc.insert("name", name);
    }
    if let Some(tqc) = payload.target_question_count {
        update_doc.insert("target_question_count", tqc);
    }
    if let Some(cat_id) = payload.category_id {
        if let Ok(oid) = ObjectId::parse_str(&cat_id) {
            update_doc.insert("category_id", oid);
        }
    } else {
        update_doc.insert("category_id", mongodb::bson::Bson::Null);
    }
    if let Some(course_id) = payload.course_id {
        if let Ok(oid) = ObjectId::parse_str(&course_id) {
            update_doc.insert("course_id", oid);
        }
    } else {
        update_doc.insert("course_id", mongodb::bson::Bson::Null);
    }
    if let Some(sub_id) = payload.subject_id {
        if let Ok(oid) = ObjectId::parse_str(&sub_id) {
            update_doc.insert("subject_id", oid);
        }
    } else {
        update_doc.insert("subject_id", mongodb::bson::Bson::Null);
    }
    match coll
        .update_one(doc! { "_id": oid }, doc! { "$set": update_doc }, None)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(QbMsg {
                success: true,
                message: "Bank updated".into(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(QbMsg {
                success: false,
                message: "Failed to update bank".into(),
            }),
        ),
    }
}

pub async fn delete_bank(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<QbMsg>) {
    if !admin_ok(&claims.role) {
        return (
            StatusCode::FORBIDDEN,
            Json(QbMsg {
                success: false,
                message: "Unauthorized".into(),
            }),
        );
    }
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(QbMsg {
                    success: false,
                    message: "Invalid ID".into(),
                }),
            );
        }
    };

    let bank_coll = db.collection::<mongodb::bson::Document>("qb_banks");
    match bank_coll.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => {
            let q_coll = db.collection::<mongodb::bson::Document>("qb_questions");
            let _ = q_coll.delete_many(doc! { "bank_id": oid }, None).await;
            (
                StatusCode::OK,
                Json(QbMsg {
                    success: true,
                    message: "Bank deleted".into(),
                }),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(QbMsg {
                success: false,
                message: "Failed to delete bank".into(),
            }),
        ),
    }
}

// --- Question Handlers ---

pub async fn list_bank_questions(
    State(db): State<Database>,
    _claims: Claims,
    Path(bank_id): Path<String>,
) -> (StatusCode, Json<Vec<serde_json::Value>>) {
    let bid = match ObjectId::parse_str(&bank_id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(vec![])),
    };
    let coll = db.collection::<mongodb::bson::Document>("qb_questions");
    let find_opts = FindOptions::builder()
        .sort(doc! { "created_at": 1 })
        .build();
    let mut cur = match coll.find(doc! { "bank_id": bid }, find_opts).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };
    let mut v = Vec::new();
    while let Some(res) = cur.next().await {
        if let Ok(doc) = res {
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
            v.push(json_val);
        }
    }
    (StatusCode::OK, Json(v))
}

pub async fn get_question(
    State(db): State<Database>,
    _claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "message": "Invalid ID" })),
            );
        }
    };
    let coll = db.collection::<mongodb::bson::Document>("qb_questions");
    match coll.find_one(doc! { "_id": oid }, None).await {
        Ok(Some(doc)) => {
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
            (StatusCode::OK, Json(json_val))
        }
        _ => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "message": "Not found" })),
        ),
    }
}

pub async fn create_question(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<serde_json::Value>,
) -> (StatusCode, Json<QbMsg>) {
    if !admin_ok(&claims.role) {
        return (
            StatusCode::FORBIDDEN,
            Json(QbMsg {
                success: false,
                message: "Unauthorized".into(),
            }),
        );
    }

    let mut doc = match mongodb::bson::to_document(&payload) {
        Ok(d) => d,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(QbMsg {
                    success: false,
                    message: "Invalid data".into(),
                }),
            );
        }
    };

    if let Some(bid_str) = doc.get_str("bank_id").ok() {
        if let Ok(bid) = ObjectId::parse_str(bid_str) {
            doc.insert("bank_id", bid);
        } else {
            return (
                StatusCode::BAD_REQUEST,
                Json(QbMsg {
                    success: false,
                    message: "Invalid bank_id format".into(),
                }),
            );
        }
    } else {
        return (
            StatusCode::BAD_REQUEST,
            Json(QbMsg {
                success: false,
                message: "Missing bank_id".into(),
            }),
        );
    }

    doc.remove("_id");
    doc.insert("created_at", DateTime::now());

    let coll = db.collection::<mongodb::bson::Document>("qb_questions");
    match coll.insert_one(doc, None).await {
        Ok(_) => (
            StatusCode::CREATED,
            Json(QbMsg {
                success: true,
                message: "Question created".into(),
            }),
        ),
        Err(e) => {
            eprintln!("Question create error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(QbMsg {
                    success: false,
                    message: "Failed to create question".into(),
                }),
            )
        }
    }
}

pub async fn update_question(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<serde_json::Value>,
) -> (StatusCode, Json<QbMsg>) {
    if !admin_ok(&claims.role) {
        return (
            StatusCode::FORBIDDEN,
            Json(QbMsg {
                success: false,
                message: "Unauthorized".into(),
            }),
        );
    }
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(QbMsg {
                    success: false,
                    message: "Invalid ID".into(),
                }),
            );
        }
    };

    let mut doc = match mongodb::bson::to_document(&payload) {
        Ok(d) => d,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(QbMsg {
                    success: false,
                    message: "Invalid data".into(),
                }),
            );
        }
    };

    if let Some(bid_str) = doc.get_str("bank_id").ok() {
        if let Ok(bid) = ObjectId::parse_str(bid_str) {
            doc.insert("bank_id", bid);
        }
    }

    doc.remove("_id");
    let coll = db.collection::<mongodb::bson::Document>("qb_questions");
    match coll
        .update_one(doc! { "_id": oid }, doc! { "$set": doc }, None)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(QbMsg {
                success: true,
                message: "Question updated".into(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(QbMsg {
                success: false,
                message: "Failed".into(),
            }),
        ),
    }
}

pub async fn delete_question(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<QbMsg>) {
    if !admin_ok(&claims.role) {
        return (
            StatusCode::FORBIDDEN,
            Json(QbMsg {
                success: false,
                message: "Unauthorized".into(),
            }),
        );
    }
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(QbMsg {
                    success: false,
                    message: "Invalid ID".into(),
                }),
            );
        }
    };
    let coll = db.collection::<mongodb::bson::Document>("qb_questions");
    match coll.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => (
            StatusCode::OK,
            Json(QbMsg {
                success: true,
                message: "Question deleted".into(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(QbMsg {
                success: false,
                message: "Failed".into(),
            }),
        ),
    }
}
