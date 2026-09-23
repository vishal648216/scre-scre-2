use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use futures_util::StreamExt;
use mongodb::{
    bson::{doc, oid::ObjectId},
    Database,
};
use serde::{Deserialize, Serialize};

use crate::models::batch::Batch;
use crate::models::user::{Claims, User, UserRole};

#[derive(Debug, Deserialize)]
pub struct CreateBatchRequest {
    pub name: String,
    pub session_id: String, // changed from course_id
    pub time_slot: String,
    pub days: Vec<String>,
    pub max_capacity: i32,
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBatchRequest {
    pub name: Option<String>,
    pub session_id: Option<String>, // changed from course_id
    pub time_slot: Option<String>,
    pub days: Option<Vec<String>>,
    pub max_capacity: Option<i32>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AssignStudentRequest {
    pub student_id: String,
    pub batch_id: Option<String>, // If None, student is removed from batch
}

#[derive(Debug, Serialize)]
pub struct BatchResponse {
    pub success: bool,
    pub message: String,
}

pub async fn handle_create_batch(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateBatchRequest>,
) -> (StatusCode, Json<BatchResponse>) {
    if claims.role != UserRole::Center
        && claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
    {
        return (
            StatusCode::FORBIDDEN,
            Json(BatchResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let center_id = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(BatchResponse {
                    success: false,
                    message: "Invalid center ID".to_string(),
                }),
            )
        }
    };

    let session_id = match ObjectId::parse_str(&payload.session_id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(BatchResponse {
                    success: false,
                    message: "Invalid session ID".to_string(),
                }),
            )
        }
    };

    // Optional: ensure referenced session exists
    let sessions_coll = db.collection::<crate::models::academic::Session>("sessions");
    if sessions_coll
        .find_one(doc! { "_id": session_id }, None)
        .await
        .ok()
        .flatten()
        .is_none()
    {
        return (
            StatusCode::BAD_REQUEST,
            Json(BatchResponse {
                success: false,
                message: "Session not found".to_string(),
            }),
        );
    }

    let batch = Batch {
        id: None,
        name: payload.name,
        center_id,
        session_id: Some(session_id),
        time_slot: payload.time_slot,
        days: payload.days,
        max_capacity: payload.max_capacity,
        current_count: 0,
        status: payload.status,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    let collection = db.collection::<Batch>("batches");
    match collection.insert_one(batch, None).await {
        Ok(_) => (
            StatusCode::CREATED,
            Json(BatchResponse {
                success: true,
                message: "Batch created successfully".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(BatchResponse {
                success: false,
                message: "Failed to create batch".to_string(),
            }),
        ),
    }
}

pub async fn handle_get_batches(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<Batch>>) {
    let collection = db.collection::<Batch>("batches");

    let filter = if claims.role == UserRole::Center {
        let center_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
        };
        doc! { "center_id": center_id }
    } else if claims.role == UserRole::Admin || claims.role == UserRole::SuperAdmin {
        doc! {}
    } else if claims.role == UserRole::Student {
        // Students can see batches in their center
        let user_coll = db.collection::<User>("users");
        let student_oid = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
        };
        let user = match user_coll.find_one(doc! { "_id": student_oid }, None).await {
            Ok(Some(u)) => u,
            _ => return (StatusCode::NOT_FOUND, Json(Vec::new())),
        };
        if let Some(parent_id) = user.parent_id {
            doc! { "center_id": parent_id }
        } else {
            return (StatusCode::FORBIDDEN, Json(Vec::new()));
        }
    } else {
        return (StatusCode::FORBIDDEN, Json(Vec::new()));
    };

    let mut cursor = match collection.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut batches = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(b) = result {
            batches.push(b);
        }
    }

    (StatusCode::OK, Json(batches))
}

#[derive(Debug, Deserialize)]
pub struct PublicBatchFilter {
    pub center_id: Option<String>,
    pub course_id: Option<String>,
    pub session_id: Option<String>,
}

pub async fn public_get_batches(
    State(db): State<Database>,
    axum::extract::Query(filter): axum::extract::Query<PublicBatchFilter>,
) -> (StatusCode, Json<Vec<Batch>>) {
    let mut query = doc! { "status": "active" };

    if let Some(cid_str) = filter.center_id {
        if !cid_str.trim().is_empty() {
            if let Ok(center_oid) = ObjectId::parse_str(&cid_str) {
                query.insert("center_id", center_oid);
            }
        }
    }

    if let Some(sid_str) = filter.session_id {
        if !sid_str.trim().is_empty() {
            if let Ok(sid_oid) = ObjectId::parse_str(&sid_str) {
                query.insert("session_id", sid_oid);
            }
        }
    }

    let collection = db.collection::<Batch>("batches");
    let mut cursor = match collection.find(query, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut batches = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(b) = result {
            batches.push(b);
        }
    }

    (StatusCode::OK, Json(batches))
}

pub async fn handle_update_batch(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<UpdateBatchRequest>,
) -> (StatusCode, Json<BatchResponse>) {
    if claims.role != UserRole::Center
        && claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
    {
        return (
            StatusCode::FORBIDDEN,
            Json(BatchResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(BatchResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            )
        }
    };

    let collection = db.collection::<Batch>("batches");
    let mut update_doc = doc! { "updated_at": Utc::now() };

    if let Some(v) = payload.name {
        update_doc.insert("name", v);
    }
    if let Some(v) = payload.session_id {
        if let Ok(sid) = ObjectId::parse_str(&v) {
            // Optional: ensure session exists
            let sessions_coll = db.collection::<crate::models::academic::Session>("sessions");
            if sessions_coll
                .find_one(doc! { "_id": sid }, None)
                .await
                .ok()
                .flatten()
                .is_some()
            {
                update_doc.insert("session_id", sid);
            } else {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(BatchResponse {
                        success: false,
                        message: "Session not found".to_string(),
                    }),
                );
            }
        } else {
            return (
                StatusCode::BAD_REQUEST,
                Json(BatchResponse {
                    success: false,
                    message: "Invalid session ID".to_string(),
                }),
            );
        }
    }
    if let Some(v) = payload.time_slot {
        update_doc.insert("time_slot", v);
    }
    if let Some(v) = payload.days {
        update_doc.insert("days", v);
    }
    if let Some(v) = payload.max_capacity {
        update_doc.insert("max_capacity", v);
    }
    if let Some(v) = payload.status {
        update_doc.insert("status", v);
    }

    match collection
        .update_one(doc! { "_id": oid }, doc! { "$set": update_doc }, None)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(BatchResponse {
                success: true,
                message: "Batch updated successfully".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(BatchResponse {
                success: false,
                message: "Update failed".to_string(),
            }),
        ),
    }
}

pub async fn handle_assign_student(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<AssignStudentRequest>,
) -> (StatusCode, Json<BatchResponse>) {
    if claims.role != UserRole::Center
        && claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
    {
        return (
            StatusCode::FORBIDDEN,
            Json(BatchResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let student_oid = match ObjectId::parse_str(&payload.student_id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(BatchResponse {
                    success: false,
                    message: "Invalid student ID".to_string(),
                }),
            )
        }
    };

    let user_coll = db.collection::<User>("users");
    let batch_coll = db.collection::<Batch>("batches");

    let student = match user_coll.find_one(doc! { "_id": student_oid }, None).await {
        Ok(Some(s)) => s,
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(BatchResponse {
                    success: false,
                    message: "Student not found".to_string(),
                }),
            )
        }
    };

    if let Some(old_batch_id) = student.batch_id {
        let _ = batch_coll
            .update_one(
                doc! { "_id": old_batch_id },
                doc! { "$inc": { "current_count": -1 } },
                None,
            )
            .await;
    }

    let new_batch_id = if let Some(bid_str) = payload.batch_id {
        let bid = match ObjectId::parse_str(&bid_str) {
            Ok(oid) => oid,
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(BatchResponse {
                        success: false,
                        message: "Invalid batch ID".to_string(),
                    }),
                )
            }
        };

        let batch = match batch_coll.find_one(doc! { "_id": bid }, None).await {
            Ok(Some(b)) => b,
            _ => {
                return (
                    StatusCode::NOT_FOUND,
                    Json(BatchResponse {
                        success: false,
                        message: "Batch not found".to_string(),
                    }),
                )
            }
        };

        if batch.current_count >= batch.max_capacity {
            return (
                StatusCode::BAD_REQUEST,
                Json(BatchResponse {
                    success: false,
                    message: "Batch is full".to_string(),
                }),
            );
        }

        let _ = batch_coll
            .update_one(doc! { "_id": bid }, doc! { "$inc": { "current_count": 1 } }, None)
            .await;
        Some(bid)
    } else {
        None
    };

    match user_coll
        .update_one(
            doc! { "_id": student_oid },
            doc! { "$set": { "batch_id": new_batch_id } },
            None,
        )
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(BatchResponse {
                success: true,
                message: "Student assigned to batch successfully".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(BatchResponse {
                success: false,
                message: "Assignment failed".to_string(),
            }),
        ),
    }
}