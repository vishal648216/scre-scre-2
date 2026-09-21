use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use mongodb::{bson::{doc, oid::ObjectId}, Database};
use serde::Deserialize;
use chrono::Utc;
use futures_util::stream::StreamExt;

use crate::models::{
    document_request::DocumentRequest,
    user::{User, UserRole, Claims},
};

#[derive(Deserialize)]
pub struct CreateRequestPayload {
    pub student_id: String,
    pub document_type: String,
    pub notes: Option<String>,
}

pub async fn create_document_request(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateRequestPayload>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Center {
        return (StatusCode::FORBIDDEN, Json(serde_json::json!({ "success": false, "message": "Only centers can create requests" })));
    }

    let center_id = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "message": "Invalid center ID" }))),
    };

    let student_id = match ObjectId::parse_str(&payload.student_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "message": "Invalid student ID" }))),
    };

    // Verify student belongs to this center
    let users_coll = db.collection::<User>("users");
    let student = match users_coll.find_one(doc! { "_id": student_id, "parent_id": center_id }, None).await {
        Ok(Some(u)) => u,
        _ => return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "success": false, "message": "Student not found in your center" }))),
    };

    let requests_coll = db.collection::<DocumentRequest>("document_requests");
    
    let new_request = DocumentRequest {
        id: None,
        student_id,
        center_id,
        document_type: payload.document_type,
        student_name: student.full_name.unwrap_or_else(|| student.username.clone()),
        course_name: student.course.unwrap_or_else(|| "N/A".to_string()),
        notes: payload.notes,
        status: "pending".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    match requests_coll.insert_one(new_request, None).await {
        Ok(_) => (StatusCode::CREATED, Json(serde_json::json!({ "success": true, "message": "Request sent successfully" }))),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "message": "Failed to send request" }))),
    }
}

pub async fn get_document_requests(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<DocumentRequest>>) {
    let requests_coll = db.collection::<DocumentRequest>("document_requests");
    let mut filter = doc! {};

    if claims.role == UserRole::Center {
        if let Ok(center_id) = ObjectId::parse_str(&claims.sub) {
            filter.insert("center_id", center_id);
        }
    } else if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(Vec::new()));
    }

    let mut cursor = match requests_coll.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut items = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(item) = result {
            items.push(item);
        }
    }

    (StatusCode::OK, Json(items))
}

#[derive(Deserialize)]
pub struct UpdateStatusPayload {
    pub status: String,
}

pub async fn update_request_status(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<UpdateStatusPayload>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(serde_json::json!({ "success": false, "message": "Unauthorized" })));
    }

    let request_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "message": "Invalid request ID" }))),
    };

    let requests_coll = db.collection::<DocumentRequest>("document_requests");
    
    let update = doc! {
        "$set": {
            "status": payload.status,
            "updated_at": Utc::now()
        }
    };

    match requests_coll.update_one(doc! { "_id": request_id }, update, None).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({ "success": true, "message": "Status updated successfully" }))),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "message": "Failed to update status" }))),
    }
}
