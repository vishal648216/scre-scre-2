
use crate::models::intern_task::InternTask;
use crate::models::user::{Claims, UserRole};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use chrono::Utc;
use mongodb::{Database, bson::{doc, oid::ObjectId}};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CreateInternTaskRequest {
    pub intern_id: String,
    pub title: String,
    pub description: String,
    pub due_date: Option<mongodb::bson::DateTime>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateInternTaskRequest {
    pub intern_id: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub due_date: Option<mongodb::bson::DateTime>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateInternTaskStatusRequest {
    pub status: String,
    pub remarks: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct InternTaskResponse {
    pub success: bool,
    pub message: String,
}

pub async fn create_intern_task(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateInternTaskRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Center && claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN, Json(serde_json::json!({"success": false, "message": "Unauthorized"}))
        );
    }

    let intern_oid = match ObjectId::parse_str(&payload.intern_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"success": false, "message": "Invalid Intern ID"}))),
    };

    let assigned_by = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"success": false, "message": "Invalid Assigned By ID"}))),
    };

    let task = InternTask {
        id: None,
        intern_id: intern_oid,
        title: payload.title,
        description: payload.description,
        status: "pending".to_string(),
        assigned_by,
        assigned_at: Utc::now(),
        due_date: payload.due_date.map(|d| d.to_chrono()),
        completed_at: None,
        remarks: None,
    };

    let collection = db.collection::<InternTask>("intern_tasks");
    match collection.insert_one(task, None).await {
        Ok(res) => (
            StatusCode::CREATED,
            Json(serde_json::json!({
                "success": true,
                "message": "Task created successfully",
                "id": res.inserted_id.as_object_id().map(|id| id.to_hex())
            }))
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"success": false, "message": "Failed to create task"}))
        )
    }
}

pub async fn get_intern_tasks(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<InternTask>>) {
    let collection = db.collection::<InternTask>("intern_tasks");
    let mut filter = doc! {};

    if claims.role == UserRole::Intern {
        let intern_oid = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(vec![])),
        };
        filter.insert("intern_id", intern_oid);
    } else if claims.role == UserRole::Center {
        // For center can see tasks for their interns - we'd need to check parent_id, but let's leave that for now
    }

    let mut cursor = match collection.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut results = vec![];
    use futures_util::stream::StreamExt;
    while let Some(result) = cursor.next().await {
        if let Ok(task) = result {
            results.push(task);
        }
    }

    (StatusCode::OK, Json(results))
}

pub async fn get_intern_tasks_for_intern(
    State(db): State<Database>,
    claims: Claims,
    Path(intern_id): Path<String>,
) -> (StatusCode, Json<Vec<InternTask>>) {
    let collection = db.collection::<InternTask>("intern_tasks");
    let intern_oid = match ObjectId::parse_str(&intern_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(vec![])),
    };

    let filter = doc! { "intern_id": intern_oid };

    let mut cursor = match collection.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut results = vec![];
    use futures_util::stream::StreamExt;
    while let Some(result) = cursor.next().await {
        if let Ok(task) = result {
            results.push(task);
        }
    }

    (StatusCode::OK, Json(results))
}

pub async fn update_intern_task(
    State(db): State<Database>,
    claims: Claims,
    Path(task_id): Path<String>,
    Json(payload): Json<UpdateInternTaskRequest>,
) -> (StatusCode, Json<InternTaskResponse>) {
    if claims.role != UserRole::Center && claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN, Json(InternTaskResponse { success: false, message: "Unauthorized".to_string() })
        );
    }

    let task_oid = match ObjectId::parse_str(&task_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(InternTaskResponse { success: false, message: "Invalid Task ID".to_string() })),
    };

    let collection = db.collection::<InternTask>("intern_tasks");

    let mut update_doc = doc! {};

    if let Some(intern_id) = payload.intern_id {
        if let Ok(intern_oid) = ObjectId::parse_str(&intern_id) {
            update_doc.insert("intern_id", intern_oid);
        }
    }

    if let Some(title) = payload.title {
        update_doc.insert("title", title);
    }

    if let Some(description) = payload.description {
        update_doc.insert("description", description);
    }

    if let Some(due_date) = payload.due_date {
        update_doc.insert("due_date", due_date.to_chrono());
    }

    if update_doc.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(InternTaskResponse { success: false, message: "No fields to update".to_string() }));
    }

    let final_update_doc = doc! { "$set": update_doc };

    match collection.update_one(doc! { "_id": task_oid }, final_update_doc, None).await {
        Ok(_) => (StatusCode::OK, Json(InternTaskResponse { success: true, message: "Task updated".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(InternTaskResponse { success: false, message: "Update failed".to_string() })),
    }
}

pub async fn delete_intern_task(
    State(db): State<Database>,
    claims: Claims,
    Path(task_id): Path<String>,
) -> (StatusCode, Json<InternTaskResponse>) {
    if claims.role != UserRole::Center && claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN, Json(InternTaskResponse { success: false, message: "Unauthorized".to_string() })
        );
    }

    let task_oid = match ObjectId::parse_str(&task_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(InternTaskResponse { success: false, message: "Invalid Task ID".to_string() })),
    };

    let collection = db.collection::<InternTask>("intern_tasks");

    match collection.delete_one(doc! { "_id": task_oid }, None).await {
        Ok(_) => (StatusCode::OK, Json(InternTaskResponse { success: true, message: "Task deleted".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(InternTaskResponse { success: false, message: "Delete failed".to_string() })),
    }
}

pub async fn update_intern_task_status(
    State(db): State<Database>,
    claims: Claims,
    Path(task_id): Path<String>,
    Json(payload): Json<UpdateInternTaskStatusRequest>,
) -> (StatusCode, Json<InternTaskResponse>) {
    let task_oid = match ObjectId::parse_str(&task_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(InternTaskResponse { success: false, message: "Invalid Task ID".to_string() })),
    };

    let collection = db.collection::<InternTask>("intern_tasks");

    let mut update_doc = doc! {
        "$set": {
            "status": &payload.status,
            "remarks": &payload.remarks
        }
    };

    if payload.status == "completed" {
        update_doc.insert("$set", doc! { "completed_at": Utc::now() });
    }

    match collection.update_one(doc! { "_id": task_oid }, update_doc, None).await {
        Ok(_) => (StatusCode::OK, Json(InternTaskResponse { success: true, message: "Task status updated".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(InternTaskResponse { success: false, message: "Update failed".to_string() })),
    }
}
