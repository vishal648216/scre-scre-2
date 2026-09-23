use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use chrono::{DateTime, Utc};
use futures_util::stream::StreamExt;
use mongodb::options::FindOptions;
use mongodb::{
    Database,
    bson::{doc, oid::ObjectId},
};
use serde::{Deserialize, Serialize};

use crate::db::get_next_sequence;
use crate::models::academic::CourseSubject;
use crate::models::subject::Subject;
use crate::models::user::{Claims, UserRole};

#[derive(Debug, Deserialize)]
pub struct SubjectQuery {
    pub search: Option<String>,
    pub status: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSubjectRequest {
    pub subject_name: String,
    pub subject_code: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSubjectRequest {
    pub subject_name: Option<String>,
    pub subject_code: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SubjectListItem {
    pub id: String,
    pub subject_name: String,
    pub subject_code: String,
    pub description: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct SubjectListResponse {
    pub items: Vec<SubjectListItem>,
    pub total: u64,
    pub page: u32,
    pub limit: u32,
}

#[derive(Debug, Serialize)]
pub struct SubjectResponse {
    pub success: bool,
    pub message: String,
}

pub async fn create_subject(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateSubjectRequest>,
) -> (StatusCode, Json<SubjectResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(SubjectResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }
    let coll = db.collection::<Subject>("subjects");

    // Check if subject name already exists
    let exists = coll
        .find_one(doc! { "subject_name": &payload.subject_name }, None)
        .await
        .ok()
        .flatten();

    if exists.is_some() {
        return (
            StatusCode::CONFLICT,
            Json(SubjectResponse {
                success: false,
                message: "Subject name already exists".to_string(),
            }),
        );
    }

    let subject_code = match payload.subject_code {
        Some(code) if !code.trim().is_empty() => code,
        _ => {
            let next_seq = get_next_sequence(&db, "subject_code").await;
            format!("SUB-{:04}", next_seq)
        }
    };

    let now = Utc::now();
    let sub = Subject {
        id: None,
        subject_name: payload.subject_name,
        subject_code,
        description: payload.description,
        status: payload.status.unwrap_or_else(|| "active".to_string()),
        created_at: now,
    };
    match coll.insert_one(sub, None).await {
        Ok(_) => (
            StatusCode::CREATED,
            Json(SubjectResponse {
                success: true,
                message: "Subject created".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(SubjectResponse {
                success: false,
                message: "Create failed".to_string(),
            }),
        ),
    }
}

pub async fn list_subjects(
    State(db): State<Database>,
    _claims: Claims,
    Query(q): Query<SubjectQuery>,
) -> (StatusCode, Json<SubjectListResponse>) {
    let coll = db.collection::<Subject>("subjects");
    let mut filter = doc! {};
    if let Some(s) = q.status {
        filter.insert("status", s);
    }
    if let Some(s) = &q.search {
        if !s.trim().is_empty() {
            let regex = mongodb::bson::Regex {
                pattern: s.clone(),
                options: "i".to_string(),
            };
            filter.insert(
                "$or",
                vec![
                    doc! { "subject_name": { "$regex": regex.clone() } },
                    doc! { "subject_code": { "$regex": regex } },
                ],
            );
        }
    }
    let page = q.page.unwrap_or(1);
    let limit_u32 = q.limit.unwrap_or(20).min(100);
    let limit = limit_u32 as i64;
    let skip = ((page.saturating_sub(1)) as u64) * (limit as u64);
    let find_opts = FindOptions::builder()
        .sort(Some(doc! { "subject_name": 1 }))
        .limit(Some(limit))
        .skip(Some(skip))
        .build();
    let total = coll
        .count_documents(filter.clone(), None)
        .await
        .unwrap_or(0);
    let mut cursor = match coll.find(filter, find_opts).await {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(SubjectListResponse {
                    items: Vec::new(),
                    total: 0,
                    page,
                    limit: limit_u32,
                }),
            );
        }
    };
    let mut items = Vec::new();
    while let Some(res) = cursor.next().await {
        if let Ok(c) = res {
            if let Some(id) = c.id {
                items.push(SubjectListItem {
                    id: id.to_hex(),
                    subject_name: c.subject_name,
                    subject_code: c.subject_code,
                    description: c.description,
                    status: c.status,
                    created_at: c.created_at,
                });
            }
        }
    }
    (
        StatusCode::OK,
        Json(SubjectListResponse {
            items,
            total,
            page,
            limit: limit_u32,
        }),
    )
}

pub async fn update_subject(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<UpdateSubjectRequest>,
) -> (StatusCode, Json<SubjectResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(SubjectResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }
    let coll = db.collection::<Subject>("subjects");
    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(SubjectResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };
    let mut set = doc! {};
    if let Some(v) = payload.subject_name {
        set.insert("subject_name", v);
    }
    if let Some(v) = payload.subject_code {
        set.insert("subject_code", v);
    }
    if let Some(v) = payload.description {
        set.insert("description", v);
    }
    if let Some(v) = payload.status {
        set.insert("status", v);
    }

    if set.is_empty() {
        return (
            StatusCode::OK,
            Json(SubjectResponse {
                success: true,
                message: "Nothing to update".to_string(),
            }),
        );
    }

    match coll
        .update_one(doc! { "_id": oid }, doc! { "$set": set }, None)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(SubjectResponse {
                success: true,
                message: "Subject updated".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(SubjectResponse {
                success: false,
                message: "Update failed".to_string(),
            }),
        ),
    }
}

pub async fn delete_subject(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<SubjectResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(SubjectResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }
    let coll = db.collection::<Subject>("subjects");
    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(SubjectResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    // Check if subject is mapped to any course
    let mapping_coll = db.collection::<CourseSubject>("course_subjects");
    let is_mapped = mapping_coll
        .find_one(doc! { "subject_id": oid }, None)
        .await
        .ok()
        .flatten();
    if is_mapped.is_some() {
        return (
            StatusCode::BAD_REQUEST,
            Json(SubjectResponse {
                success: false,
                message: "Cannot delete subject mapped to courses".to_string(),
            }),
        );
    }

    match coll.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => (
            StatusCode::OK,
            Json(SubjectResponse {
                success: true,
                message: "Subject deleted".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(SubjectResponse {
                success: false,
                message: "Delete failed".to_string(),
            }),
        ),
    }
}
