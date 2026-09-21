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

use crate::models::attendance::AttendanceRecord;
use crate::models::batch::Batch;
use crate::models::batch_student::BatchStudent;
use crate::models::user::{Claims, User, UserRole};

#[derive(Debug, Deserialize)]
pub struct AssignBatchStudentRequest {
    pub student_id: String,
    pub batch_id: Option<String>, // None => unassign
}

#[derive(Debug, Deserialize)]
pub struct EditBatchStudentRequest {
    pub student_id: String,
    pub batch_id: Option<String>, // None => unassign
}

#[derive(Debug, Serialize)]
pub struct BatchStudentResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct UnassignedStudentItem {
    pub id: String,
    pub username: String,
    pub full_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub center_id: Option<String>,
    pub session_id: Option<String>,
    pub course_id: Option<String>,
}

pub async fn assign_student_to_batch(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<AssignBatchStudentRequest>,
) -> (StatusCode, Json<BatchStudentResponse>) {
    if claims.role != UserRole::Center && claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(BatchStudentResponse { success: false, message: "Unauthorized".into() }));
    }

    let student_oid = match ObjectId::parse_str(&payload.student_id) {
        Ok(v) => v,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(BatchStudentResponse { success: false, message: "Invalid student_id".into() })),
    };

    let users = db.collection::<User>("users");
    let batches = db.collection::<Batch>("batches");
    let links = db.collection::<BatchStudent>("batch_students");

    let student = match users.find_one(doc! { "_id": student_oid }, None).await {
        Ok(Some(s)) => s,
        _ => return (StatusCode::NOT_FOUND, Json(BatchStudentResponse { success: false, message: "Student not found".into() })),
    };

    if student.role != UserRole::Student {
        return (StatusCode::BAD_REQUEST, Json(BatchStudentResponse { success: false, message: "User is not a student".into() }));
    }

    if let Ok(Some(old_link)) = links.find_one(doc! { "student_id": student_oid, "status": "active" }, None).await {
        if let Some(old_id) = old_link.id {
            let _ = links.update_one(
                doc! { "_id": old_id },
                doc! { "$set": { "status": "removed", "updated_at": Utc::now() } },
                None
            ).await;
        }

        let _ = batches.update_one(
            doc! { "_id": old_link.batch_id },
            doc! { "$inc": { "current_count": -1 } },
            None
        ).await;
    }

    if payload.batch_id.is_none() {
        let _ = users.update_one(
            doc! { "_id": student_oid },
            doc! { "$set": { "batch_id": mongodb::bson::Bson::Null } },
            None
        ).await;

        return (StatusCode::OK, Json(BatchStudentResponse { success: true, message: "Student unassigned from batch".into() }));
    }

    let batch_oid = match ObjectId::parse_str(payload.batch_id.as_ref().unwrap()) {
        Ok(v) => v,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(BatchStudentResponse { success: false, message: "Invalid batch_id".into() })),
    };

    let batch = match batches.find_one(doc! { "_id": batch_oid }, None).await {
        Ok(Some(b)) => b,
        _ => return (StatusCode::NOT_FOUND, Json(BatchStudentResponse { success: false, message: "Batch not found".into() })),
    };

    if batch.current_count >= batch.max_capacity {
        return (StatusCode::BAD_REQUEST, Json(BatchStudentResponse { success: false, message: "Batch is full".into() }));
    }

    let center_id = batch.center_id;
    let now = Utc::now();

    let link = BatchStudent {
        id: None,
        batch_id: batch_oid,
        student_id: student_oid,
        center_id,
        session_id: batch.session_id,
        course_id: student.course_id,
        status: "active".into(),
        created_at: now,
        updated_at: now,
    };

    let _ = links.insert_one(link, None).await;
    let _ = batches.update_one(doc! { "_id": batch_oid }, doc! { "$inc": { "current_count": 1 } }, None).await;
    let _ = users.update_one(doc! { "_id": student_oid }, doc! { "$set": { "batch_id": batch_oid } }, None).await;

    (StatusCode::OK, Json(BatchStudentResponse { success: true, message: "Student assigned to batch successfully".into() }))
}

// NEW: edit / reassign a student's batch, cascading the change to their attendance records
pub async fn edit_student_batch(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<EditBatchStudentRequest>,
) -> (StatusCode, Json<BatchStudentResponse>) {
    if claims.role != UserRole::Center && claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(BatchStudentResponse { success: false, message: "Unauthorized".into() }));
    }

    let student_oid = match ObjectId::parse_str(&payload.student_id) {
        Ok(v) => v,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(BatchStudentResponse { success: false, message: "Invalid student_id".into() })),
    };

    let users = db.collection::<User>("users");
    let batches = db.collection::<Batch>("batches");
    let links = db.collection::<BatchStudent>("batch_students");
    let attendance = db.collection::<AttendanceRecord>("attendance");

    let student = match users.find_one(doc! { "_id": student_oid }, None).await {
        Ok(Some(s)) => s,
        _ => return (StatusCode::NOT_FOUND, Json(BatchStudentResponse { success: false, message: "Student not found".into() })),
    };

    if student.role != UserRole::Student {
        return (StatusCode::BAD_REQUEST, Json(BatchStudentResponse { success: false, message: "User is not a student".into() }));
    }

    let course_id = match student.course_id {
        Some(c) => c,
        None => return (StatusCode::BAD_REQUEST, Json(BatchStudentResponse { success: false, message: "Student has no course assigned".into() })),
    };

    // current active link, if any
    let old_link = links
        .find_one(doc! { "student_id": student_oid, "status": "active" }, None)
        .await
        .ok()
        .flatten();
    let old_batch_id = old_link.as_ref().map(|l| l.batch_id);

    // no-op guard: same batch requested again
    if let (Some(old_id), Some(new_id_str)) = (old_batch_id, payload.batch_id.as_ref()) {
        if let Ok(new_id) = ObjectId::parse_str(new_id_str) {
            if old_id == new_id {
                return (StatusCode::OK, Json(BatchStudentResponse { success: true, message: "Student already assigned to this batch".into() }));
            }
        }
    }

    // deactivate old link + decrement old batch count
    if let Some(link) = &old_link {
        if let Some(old_link_id) = link.id {
            let _ = links
                .update_one(
                    doc! { "_id": old_link_id },
                    doc! { "$set": { "status": "removed", "updated_at": Utc::now() } },
                    None,
                )
                .await;
        }
        let _ = batches
            .update_one(doc! { "_id": link.batch_id }, doc! { "$inc": { "current_count": -1 } }, None)
            .await;
    }

    // unassign case
    if payload.batch_id.is_none() {
        let _ = users
            .update_one(doc! { "_id": student_oid }, doc! { "$set": { "batch_id": mongodb::bson::Bson::Null } }, None)
            .await;

        return (StatusCode::OK, Json(BatchStudentResponse { success: true, message: "Student unassigned from batch".into() }));
    }

    let new_batch_oid = match ObjectId::parse_str(payload.batch_id.as_ref().unwrap()) {
        Ok(v) => v,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(BatchStudentResponse { success: false, message: "Invalid batch_id".into() })),
    };

    let batch = match batches.find_one(doc! { "_id": new_batch_oid }, None).await {
        Ok(Some(b)) => b,
        _ => return (StatusCode::NOT_FOUND, Json(BatchStudentResponse { success: false, message: "Batch not found".into() })),
    };

    if batch.current_count >= batch.max_capacity {
        return (StatusCode::BAD_REQUEST, Json(BatchStudentResponse { success: false, message: "Batch is full".into() }));
    }

    let now = Utc::now();
    let new_link = BatchStudent {
        id: None,
        batch_id: new_batch_oid,
        student_id: student_oid,
        center_id: batch.center_id,
        session_id: batch.session_id,
        course_id: student.course_id,
        status: "active".into(),
        created_at: now,
        updated_at: now,
    };

    let _ = links.insert_one(new_link, None).await;
    let _ = batches
        .update_one(doc! { "_id": new_batch_oid }, doc! { "$inc": { "current_count": 1 } }, None)
        .await;
    let _ = users
        .update_one(doc! { "_id": student_oid }, doc! { "$set": { "batch_id": new_batch_oid } }, None)
        .await;

    // cascade: move this student's attendance for the same course onto the new batch
    if let Some(old_id) = old_batch_id {
        let attendance_filter = doc! {
            "student_id": student_oid,
            "batch_id": old_id,
            "course_id": course_id,
        };
        let _ = attendance
            .update_many(attendance_filter, doc! { "$set": { "batch_id": new_batch_oid } }, None)
            .await;
    }

    (StatusCode::OK, Json(BatchStudentResponse { success: true, message: "Student batch updated successfully".into() }))
}

pub async fn list_batch_students(
    State(db): State<Database>,
    claims: Claims,
    Path(batch_id): Path<String>,
) -> (StatusCode, Json<Vec<BatchStudent>>) {
    if claims.role != UserRole::Center && claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(vec![]));
    }

    let batch_oid = match ObjectId::parse_str(&batch_id) {
        Ok(v) => v,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(vec![])),
    };

    let links = db.collection::<BatchStudent>("batch_students");
    let mut cursor = match links.find(doc! { "batch_id": batch_oid, "status": "active" }, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut out = Vec::new();
    while let Some(item) = cursor.next().await {
        if let Ok(v) = item {
            out.push(v);
        }
    }

    (StatusCode::OK, Json(out))
}

// NEW: students of center not assigned in any active batch
pub async fn list_unassigned_center_students(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<UnassignedStudentItem>>) {
    if claims.role != UserRole::Center && claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(vec![]));
    }

    let users = db.collection::<User>("users");
    let links = db.collection::<BatchStudent>("batch_students");

    // center scope
    let center_filter = if claims.role == UserRole::Center {
        let center_id = match ObjectId::parse_str(&claims.sub) {
            Ok(v) => v,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(vec![])),
        };
        Some(center_id)
    } else {
        None
    };

    // collect all currently assigned student ids from active links
    let mut assigned_ids: Vec<ObjectId> = Vec::new();
    let mut active_link_query = doc! { "status": "active" };
    if let Some(center_id) = center_filter {
        active_link_query.insert("center_id", center_id);
    }

    let mut link_cursor = match links.find(active_link_query, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    while let Some(item) = link_cursor.next().await {
        if let Ok(link) = item {
            assigned_ids.push(link.student_id);
        }
    }

    // build student query
    let mut student_query = doc! {
        "role": "student",
        "is_deleted": { "$ne": true }
    };

    if let Some(center_id) = center_filter {
        student_query.insert("parent_id", center_id);
    }

    if !assigned_ids.is_empty() {
        student_query.insert("_id", doc! { "$nin": assigned_ids });
    }

    // fallback safety: also include users where batch_id is null/missing
    let mut cursor = match users.find(student_query, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut out = Vec::new();
    while let Some(item) = cursor.next().await {
        if let Ok(u) = item {
            out.push(UnassignedStudentItem {
                id: u.id.map(|x| x.to_hex()).unwrap_or_default(),
                username: u.username,
                full_name: u.full_name,
                email: u.email,
                phone: u.phone,
                center_id: u.parent_id.map(|x| x.to_hex()),
                session_id: u.session_id.map(|x| x.to_hex()),
                course_id: u.course_id.map(|x| x.to_hex()),
            });
        }
    }

    (StatusCode::OK, Json(out))
}