use crate::handlers::coupon::consume_coupon;
use crate::models::center::Center;
use crate::models::course::Course;
use crate::models::user::{Claims, User, UserRole};
use crate::services::email_service::{send_registration_email, send_update_notification_email};
use crate::services::id_card_auto;
use crate::util::generators::{
    generate_enrollment_number, generate_referral_code, generate_roll_number,
    generate_serial_number,
};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use base64::Engine as _;
use bcrypt::{DEFAULT_COST, hash};
use chrono::{Datelike, NaiveDate, Utc};
use futures_util::StreamExt;
use mongodb::{Database, bson::doc, bson::oid::ObjectId};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateStudentRequest {
    pub username: Option<String>,
    pub password: String,
    pub full_name: String,
    pub first_name: Option<String>,
    pub middle_name: Option<String>,
    pub last_name: Option<String>,
    pub email: String,
    pub phone: String,
    pub course: String,
    pub center_id: Option<String>,
    pub priority_center_1: Option<String>,
    pub priority_center_2: Option<String>,
    pub priority_center_3: Option<String>,
    pub priority_centers: Option<Vec<String>>,
    pub mode_of_study: Option<String>,
    pub father_name: Option<String>,
    pub mother_name: Option<String>,
    pub dob: Option<String>,
    pub gender: Option<String>,
    pub category: Option<String>,
    pub national_id_type: Option<String>,
    pub national_id: Option<String>,
    pub national_id_url: Option<String>,
    pub highest_qualification: Option<String>,
    pub admission_mode: Option<String>,
    #[serde(default, rename = "exam_mode")]
    pub exam_mode: Option<String>,
    pub address: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    #[serde(default)]
    pub district: Option<String>,
    pub country: Option<String>,
    pub pincode: Option<String>,
    pub other_address: Option<String>,
    pub emergency_contact_name: Option<String>,
    pub emergency_contact_phone: Option<String>,
    pub emergency_contact_relation: Option<String>,
    pub additional_docs: Option<String>,
    pub enrollment_number: Option<String>,
    pub roll_number: Option<String>,
    pub registration_date: Option<String>,
    pub course_id: Option<String>,
    pub photo_url: Option<String>,
    pub signature_url: Option<String>,
    pub session_start_date: Option<String>,
    pub session_end_date: Option<String>,
    pub referral_code_used: Option<String>,
    pub other_doc_url: Option<String>,
    pub batch_id: Option<String>,
    pub coupon_code: Option<String>,
    pub session_id: Option<String>,
    pub course_category: Option<String>,
    pub current_unit: Option<String>,
    pub total_fees: Option<f64>,
    pub extra_charges: Option<f64>,
    pub grand_total: Option<f64>,
    pub fee_breakdown: Option<Vec<crate::models::user::FeeBreakdownItem>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStudentRequest {
    pub username: Option<String>,
    pub full_name: Option<String>,
    pub first_name: Option<String>,
    pub middle_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub course: Option<String>,
    pub father_name: Option<String>,
    pub mother_name: Option<String>,
    pub dob: Option<String>,
    pub gender: Option<String>,
    pub category: Option<String>,
    pub national_id_type: Option<String>,
    pub national_id: Option<String>,
    pub national_id_url: Option<String>,
    pub highest_qualification: Option<String>,
    pub admission_mode: Option<String>,
    #[serde(default, rename = "exam_mode")]
    pub exam_mode: Option<String>,
    pub address: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    #[serde(default)]
    pub district: Option<String>,
    pub country: Option<String>,
    pub pincode: Option<String>,
    pub other_address: Option<String>,
    pub emergency_contact_name: Option<String>,
    pub emergency_contact_phone: Option<String>,
    pub emergency_contact_relation: Option<String>,
    pub additional_docs: Option<String>,
    pub enrollment_number: Option<String>,
    pub roll_number: Option<String>,
    pub registration_date: Option<String>,
    pub course_id: Option<String>,
    pub photo_url: Option<String>,
    pub signature_url: Option<String>,
    pub session_start_date: Option<String>,
    pub session_end_date: Option<String>,
    pub batch_id: Option<String>,
    pub session_id: Option<String>,
    pub password: Option<String>,
    pub course_category: Option<String>,
    pub current_unit: Option<String>,
    pub due_date: Option<String>,
    pub remarks: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ToggleStatusRequest {
    pub active: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListStudentsQuery {
    pub search: Option<String>,
    pub category_id: Option<String>,
    pub course_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CreateStudentResponse {
    pub success: bool,
    pub message: String,
}

pub async fn update_student(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    raw_json: axum::Json<serde_json::Value>,
) -> (StatusCode, Json<CreateStudentResponse>) {
    println!(
        "update_student called! ID: {}, Role: {:?}, Raw Payload: {:?}",
        id, claims.role, raw_json
    );
    let payload: UpdateStudentRequest = match serde_json::from_value(raw_json.0) {
        Ok(p) => p,
        Err(e) => {
            println!("Deserialization error: {:?}", e);
            return (
                StatusCode::BAD_REQUEST,
                Json(CreateStudentResponse {
                    success: false,
                    message: format!("Invalid payload: {}", e),
                }),
            );
        }
    };
    println!("Deserialized payload: {:?}", payload);
    // Only Center or Admin can update students
    if claims.role != UserRole::Center
        && claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
    {
        return (
            StatusCode::FORBIDDEN,
            Json(CreateStudentResponse {
                success: false,
                message: "Forbidden".to_string(),
            }),
        );
    }

    let obj_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(CreateStudentResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let user_collection = db.collection::<User>("users");
    let mut update_doc = doc! {};
    let mut update_details = Vec::new();

    if let Some(v) = payload.username {
        update_doc.insert("username", v);
    }

    // If center, verify student belongs to them
    if claims.role == UserRole::Center {
        let center_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(CreateStudentResponse {
                        success: false,
                        message: "Invalid center ID".to_string(),
                    }),
                );
            }
        };
        let student = user_collection
            .find_one(doc! { "_id": obj_id, "parent_id": center_id }, None)
            .await;
        if let Ok(None) = student {
            return (
                StatusCode::NOT_FOUND,
                Json(CreateStudentResponse {
                    success: false,
                    message: "Student not found".to_string(),
                }),
            );
        }
    }

    if let Some(v) = payload.full_name {
        update_doc.insert("full_name", v);
        update_details.push("Full Name updated");
    }
    if let Some(v) = payload.first_name {
        update_doc.insert("first_name", v);
    }
    if let Some(v) = payload.middle_name {
        update_doc.insert("middle_name", v);
    }
    if let Some(v) = payload.last_name {
        update_doc.insert("last_name", v);
    }
    if let Some(v) = payload.email {
        update_doc.insert("email", v);
        update_details.push("Email updated");
    }
    if let Some(v) = payload.phone {
        update_doc.insert("phone", v);
        update_details.push("Phone updated");
    }
    if let Some(v) = payload.course {
        update_doc.insert("course", v);
        update_details.push("Course updated");
    }
    if let Some(v) = payload.father_name {
        update_doc.insert("father_name", v);
    }
    if let Some(v) = payload.mother_name {
        update_doc.insert("mother_name", v);
    }
    if let Some(v) = payload.dob {
        update_doc.insert("dob", v);
    }
    if let Some(v) = payload.gender {
        update_doc.insert("gender", v);
    }
    if let Some(v) = payload.category {
        update_doc.insert("category", v);
        update_details.push("Category updated");
    }
    if let Some(v) = payload.national_id_type {
        update_doc.insert("national_id_type", v);
        update_details.push("National ID Type updated");
    }
    if let Some(v) = payload.national_id {
        update_doc.insert("national_id", v);
        update_details.push("National ID updated");
    }
    if let Some(v) = payload.national_id_url {
        update_doc.insert("national_id_url", v);
    }
    if let Some(v) = payload.highest_qualification {
        update_doc.insert("highest_qualification", v);
    }
    if let Some(v) = payload.admission_mode {
        update_doc.insert("admission_mode", v);
    }
    if let Some(v) = payload.exam_mode {
        update_doc.insert("exam_mode", v);
    }
    if let Some(v) = payload.address {
        update_doc.insert("address", v);
    }
    if let Some(v) = payload.city {
        update_doc.insert("city", v);
    }
    if let Some(v) = payload.state {
        update_doc.insert("state", v);
    }
    if let Some(v) = payload.district {
        update_doc.insert("district", v);
    }
    if let Some(v) = payload.country {
        update_doc.insert("country", v);
    }
    if let Some(v) = payload.pincode {
        update_doc.insert("pincode", v);
    }
    if let Some(v) = payload.other_address {
        update_doc.insert("other_address", v);
    }
    if let Some(v) = payload.emergency_contact_name {
        update_doc.insert("emergency_contact_name", v);
    }
    if let Some(v) = payload.emergency_contact_phone {
        update_doc.insert("emergency_contact_phone", v);
    }
    if let Some(v) = payload.emergency_contact_relation {
        update_doc.insert("emergency_contact_relation", v);
    }
    if let Some(v) = payload.additional_docs {
        update_doc.insert("additional_docs", v);
        update_details.push("Documents updated");
    }
    if let Some(v) = payload.batch_id {
        if v.trim().is_empty() {
            update_doc.insert("batch_id", None as Option<ObjectId>);
        } else {
            let batch_oid = ObjectId::parse_str(&v).ok();
            update_doc.insert("batch_id", batch_oid);
        }
    }
    if let Some(v) = payload.enrollment_number {
        update_doc.insert("enrollment_number", v);
    }
    if let Some(v) = payload.roll_number {
        update_doc.insert("roll_number", v);
    }
    if let Some(v) = payload.registration_date {
        update_doc.insert("registration_date", v);
    }
    if let Some(v) = payload.course_id {
        if v.trim().is_empty() {
            update_doc.insert("course_id", None as Option<ObjectId>);
        } else if let Ok(oid) = ObjectId::parse_str(&v) {
            update_doc.insert("course_id", oid);
        }
    }
    if let Some(v) = payload.photo_url {
        update_doc.insert("photo_url", v);
        update_details.push("Photo updated");
    }
    if let Some(v) = payload.signature_url {
        update_doc.insert("signature_url", v);
        update_details.push("Signature updated");
    }
    if let Some(v) = payload.session_start_date {
        update_doc.insert("session_start_date", v);
    }
    if let Some(v) = payload.session_end_date {
        update_doc.insert("session_end_date", v);
    }
    if let Some(v) = payload.session_id {
        if v.trim().is_empty() {
            update_doc.insert("session_id", None as Option<ObjectId>);
        } else if let Ok(oid) = ObjectId::parse_str(&v) {
            update_doc.insert("session_id", oid);
        }
    }
    if let Some(v) = payload.course_category {
        update_doc.insert("course_category", v);
    }
    if let Some(v) = payload.current_unit {
        if !v.trim().is_empty() {
            update_doc.insert("current_unit", v);
        }
    }
    if let Some(v) = payload.password {
        if !v.trim().is_empty() {
            if let Ok(h) = hash(&v, DEFAULT_COST) {
                update_doc.insert("password_hash", h);
                update_doc.insert("raw_password", v);
            }
        }
    }
    if let Some(v) = payload.due_date {
        update_doc.insert("due_date", v);
    }
    if let Some(v) = payload.remarks {
        update_doc.insert("remarks", v);
    }

    // Always update the updated_at timestamp
    update_doc.insert("updated_at", Utc::now());
    println!(
        "update_student - update_doc to send to MongoDB: {:?}",
        update_doc
    );

    if update_doc.is_empty() {
        return (
            StatusCode::OK,
            Json(CreateStudentResponse {
                success: true,
                message: "No changes".to_string(),
            }),
        );
    }

    match user_collection
        .update_one(doc! { "_id": obj_id }, doc! { "$set": update_doc }, None)
        .await
    {
        Ok(_) => {
            // Send update notification email
            if !update_details.is_empty() {
                if let Ok(Some(student)) =
                    user_collection.find_one(doc! { "_id": obj_id }, None).await
                {
                    if let (Some(email), Some(name)) = (student.email, student.full_name) {
                        let details_str = update_details.join(", ");
                        let _ = send_update_notification_email(&email, &name, &details_str).await;
                    }
                }
            }
            (
                StatusCode::OK,
                Json(CreateStudentResponse {
                    success: true,
                    message: "Student updated successfully".to_string(),
                }),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CreateStudentResponse {
                success: false,
                message: "Update failed".to_string(),
            }),
        ),
    }
}

pub async fn toggle_student_status(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<ToggleStatusRequest>,
) -> (StatusCode, Json<CreateStudentResponse>) {
    if claims.role != UserRole::Center
        && claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
    {
        return (
            StatusCode::FORBIDDEN,
            Json(CreateStudentResponse {
                success: false,
                message: "Forbidden".to_string(),
            }),
        );
    }

    let obj_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(CreateStudentResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let user_collection = db.collection::<User>("users");

    if claims.role == UserRole::Center {
        let center_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(CreateStudentResponse {
                        success: false,
                        message: "Invalid center ID".to_string(),
                    }),
                );
            }
        };
        let student = user_collection
            .find_one(doc! { "_id": obj_id, "parent_id": center_id }, None)
            .await;
        if let Ok(None) = student {
            return (
                StatusCode::NOT_FOUND,
                Json(CreateStudentResponse {
                    success: false,
                    message: "Student not found".to_string(),
                }),
            );
        }
    }

    match user_collection
        .update_one(
            doc! { "_id": obj_id },
            doc! { "$set": { "active": payload.active } },
            None,
        )
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(CreateStudentResponse {
                success: true,
                message: "Status updated".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CreateStudentResponse {
                success: false,
                message: "Toggle failed".to_string(),
            }),
        ),
    }
}

pub async fn delete_student(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<CreateStudentResponse>) {
    println!("delete_student called! ID: {}, Role: {:?}", id, claims.role);

    if claims.role != UserRole::Center
        && claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
    {
        return (
            StatusCode::FORBIDDEN,
            Json(CreateStudentResponse {
                success: false,
                message: "Forbidden".to_string(),
            }),
        );
    }

    let obj_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(CreateStudentResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let user_collection = db.collection::<User>("users");

    if claims.role == UserRole::Center {
        let center_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(CreateStudentResponse {
                        success: false,
                        message: "Invalid center ID".to_string(),
                    }),
                );
            }
        };
        let student = user_collection
            .find_one(doc! { "_id": obj_id, "parent_id": center_id }, None)
            .await;
        if let Ok(None) = student {
            println!("Student not found for center!");
            return (
                StatusCode::NOT_FOUND,
                Json(CreateStudentResponse {
                    success: false,
                    message: "Student not found".to_string(),
                }),
            );
        }
    }

    let now = Utc::now();
    println!(
        "About to update student {}: set is_deleted=true, deleted_at={:?}, active=false, is_deleted_by_center_final=false",
        obj_id, now
    );

    match user_collection
        .update_one(
            doc! { "_id": obj_id },
            doc! { "$set": { "is_deleted": true, "deleted_at": now, "active": false, "is_deleted_by_center_final": false } },
            None,
        )
        .await
    {
        Ok(update_result) => {
            println!("Update result: {:?}", update_result);
            (
                StatusCode::OK,
                Json(CreateStudentResponse {
                    success: true,
                    message: "Student moved to recycle bin".to_string(),
                }),
            )
        }
        Err(e) => {
            println!("Delete failed: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(CreateStudentResponse {
                    success: false,
                    message: "Delete failed".to_string(),
                }),
            )
        }
    }
}

pub async fn list_deleted_students(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<User>>) {
    println!(
        "list_deleted_students called! Role: {:?}, Sub: {}",
        claims.role, claims.sub
    );
    let collection = db.collection::<User>("users");

    let filter = if claims.role == UserRole::SuperAdmin || claims.role == UserRole::Admin {
        println!("Admin/SuperAdmin filter: role=student, is_deleted=true");
        doc! { "role": "student", "is_deleted": true }
    } else if claims.role == UserRole::Center {
        let center_id = ObjectId::parse_str(&claims.sub).unwrap();
        println!(
            "Center filter: role=student, parent_id={}, is_deleted=true, (is_deleted_by_center_final != true OR doesn't exist)",
            center_id
        );
        doc! {
            "role": "student",
            "parent_id": center_id,
            "is_deleted": true,
            "$or": [
                { "is_deleted_by_center_final": { "$ne": true } },
                { "is_deleted_by_center_final": { "$exists": false } }
            ]
        }
    } else {
        return (StatusCode::FORBIDDEN, Json(Vec::new()));
    };

    let mut cursor = match collection.find(filter.clone(), None).await {
        Ok(c) => c,
        Err(e) => {
            println!("Error finding deleted students: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new()));
        }
    };

    let mut students = Vec::new();
    use futures_util::stream::StreamExt;
    while let Some(result) = cursor.next().await {
        if let Ok(user) = result {
            println!("Found deleted student: {:?}", user.username);
            students.push(user);
        }
    }
    println!("Total deleted students found: {}", students.len());

    (StatusCode::OK, Json(students))
}

pub async fn move_to_admin_bin(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<CreateStudentResponse>) {
    if claims.role != UserRole::Center
        && claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
    {
        return (
            StatusCode::FORBIDDEN,
            Json(CreateStudentResponse {
                success: false,
                message: "Forbidden".to_string(),
            }),
        );
    }

    let obj_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(CreateStudentResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let user_collection = db.collection::<User>("users");

    if claims.role == UserRole::Center {
        let center_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(CreateStudentResponse {
                        success: false,
                        message: "Invalid center ID".to_string(),
                    }),
                );
            }
        };
        let student = user_collection
            .find_one(doc! { "_id": obj_id, "parent_id": center_id }, None)
            .await;
        if let Ok(None) = student {
            return (
                StatusCode::NOT_FOUND,
                Json(CreateStudentResponse {
                    success: false,
                    message: "Student not found".to_string(),
                }),
            );
        }
    }

    match user_collection
        .update_one(
            doc! { "_id": obj_id },
            doc! { "$set": { "is_deleted_by_center_final": true } },
            None,
        )
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(CreateStudentResponse {
                success: true,
                message: "Student moved to Admin bin".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CreateStudentResponse {
                success: false,
                message: "Action failed".to_string(),
            }),
        ),
    }
}

pub async fn restore_student(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<CreateStudentResponse>) {
    let obj_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(CreateStudentResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let user_collection = db.collection::<User>("users");

    if claims.role == UserRole::Center {
        let center_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(CreateStudentResponse {
                        success: false,
                        message: "Invalid center ID".to_string(),
                    }),
                );
            }
        };
        let student = user_collection
            .find_one(doc! { "_id": obj_id, "parent_id": center_id }, None)
            .await;
        if let Ok(None) = student {
            return (
                StatusCode::NOT_FOUND,
                Json(CreateStudentResponse {
                    success: false,
                    message: "Student not found".to_string(),
                }),
            );
        }
    } else if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(CreateStudentResponse {
                success: false,
                message: "Forbidden".to_string(),
            }),
        );
    }

    match user_collection
        .update_one(
            doc! { "_id": obj_id },
            doc! { "$set": { "is_deleted": false, "deleted_at": null, "active": true, "is_deleted_by_center_final": null } },
            None,
        )
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(CreateStudentResponse {
                success: true,
                message: "Student restored successfully".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CreateStudentResponse {
                success: false,
                message: "Restore failed".to_string(),
            }),
        ),
    }
}

pub async fn permanent_delete_student(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<CreateStudentResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(CreateStudentResponse {
                success: false,
                message: "Forbidden".to_string(),
            }),
        );
    }

    let obj_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(CreateStudentResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let user_collection = db.collection::<User>("users");

    match user_collection
        .delete_one(
            doc! { "_id": obj_id, "role": "student", "is_deleted": true },
            None,
        )
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(CreateStudentResponse {
                success: true,
                message: "Student permanently deleted".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CreateStudentResponse {
                success: false,
                message: "Delete failed".to_string(),
            }),
        ),
    }
}

use crate::models::counter::Counter;
use crate::models::referral::{Referral, ReferralRewardType, ReferralStatus};
use mongodb::options::{FindOneAndUpdateOptions, ReturnDocument};

pub async fn generate_registration_no(db: &Database) -> String {
    let counter_collection = db.collection::<Counter>("counters");
    let options = FindOneAndUpdateOptions::builder()
        .upsert(true)
        .return_document(ReturnDocument::After)
        .build();

    let result = counter_collection
        .find_one_and_update(
            doc! { "_id": "registration_no" },
            doc! { "$inc": { "seq": 1 } },
            options,
        )
        .await;

    match result {
        Ok(Some(counter)) => format!("SCRE{:04}", counter.seq),
        _ => {
            // Fallback if counter fails
            let ts = Utc::now().timestamp() % 10000;
            format!("SCRE{:04}", ts)
        }
    }
}

pub async fn handle_create_student(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateStudentRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    // Validate and consume coupon if provided
    if let Some(ref code) = payload.coupon_code {
        if !code.trim().is_empty() {
            match consume_coupon(&db, code, "student", None).await {
                Ok(_) => {} // Coupon applied successfully
                Err(e) => {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(serde_json::json!({
                            "success": false,
                            "message": format!("Coupon error: {}", e)
                        })),
                    );
                }
            }
        }
    }

    // Only Center can create students
    if claims.role != UserRole::Center {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "success": false,
                "message": "Only center can enroll students".to_string()
            })),
        );
    }

    let user_collection = db.collection::<User>("users");

    let creator_id = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "success": false,
                    "message": "Invalid creator ID"
                })),
            );
        }
    };

    let center_coll = db.collection::<Center>("centers");
    let center = if let Ok(Some(c)) = center_coll
        .find_one(doc! { "user_id": creator_id }, None)
        .await
    {
        Some(c)
    } else {
        center_coll
            .find_one(doc! { "_id": creator_id }, None)
            .await
            .ok()
            .flatten()
    };
    let center_code = center.map(|c| c.code).unwrap_or_else(|| "UNK".to_string());

    let course_oid = payload
        .course_id
        .clone()
        .and_then(|cid| ObjectId::parse_str(&cid).ok());
    let course_coll = db.collection::<Course>("courses");
    let course = if let Some(cid) = course_oid {
        course_coll
            .find_one(doc! { "_id": cid }, None)
            .await
            .ok()
            .flatten()
    } else {
        None
    };
    let course_code = course
        .map(|c| {
            if !c.short_code.is_empty() {
                c.short_code
            } else {
                c.course_code
            }
        })
        .unwrap_or_else(|| "COURSE".to_string());

    let registration_date_str = payload
        .registration_date
        .clone()
        .unwrap_or_else(|| Utc::now().naive_utc().date().to_string());
    let registration_year = match NaiveDate::parse_from_str(&registration_date_str, "%Y-%m-%d") {
        Ok(date) => date.year(),
        Err(_) => Utc::now().year(),
    };

    let enrollment_no = match payload.enrollment_number {
        Some(v) if !v.trim().is_empty() => v,
        _ => generate_enrollment_number(&db, registration_year, &course_code).await,
    };

    // Requirement 5: Login ID should be email
    let username = payload.email.clone();

    // Check if username (email) already exists
    if let Ok(Some(_)) = user_collection
        .find_one(doc! { "username": &username }, None)
        .await
    {
        return (
            StatusCode::CONFLICT,
            Json(serde_json::json!({
                "success": false,
                "message": "Email already exists as login ID. Please use a different email."
            })),
        );
    }

    let hashed_password = hash(&payload.password, DEFAULT_COST).expect("password hashing failed");

    let roll_no = match payload.roll_number {
        Some(v) if !v.trim().is_empty() => Some(v),
        _ => generate_roll_number(&db, course_oid.as_ref()).await,
    };

    let batch_oid = payload
        .batch_id
        .clone()
        .and_then(|bid| ObjectId::parse_str(&bid).ok());

    let session_oid = payload
        .session_id
        .clone()
        .and_then(|sid| ObjectId::parse_str(&sid).ok());

    let serial_no = generate_serial_number(&db, &creator_id, &center_code).await;

    let new_user = User {
        id: None,
        username: username.clone(),
        password_hash: hashed_password,
        raw_password: Some(payload.password.clone()),
        role: UserRole::Student,
        parent_id: Some(creator_id),
        full_name: Some(payload.full_name.clone()),
        first_name: payload.first_name,
        middle_name: payload.middle_name,
        last_name: payload.last_name,
        email: Some(payload.email.clone()),
        phone: Some(payload.phone.clone()),
        course: Some(payload.course.clone()),
        father_name: payload.father_name,
        mother_name: payload.mother_name,
        dob: payload.dob,
        gender: payload.gender,
        category: payload.category,
        national_id_type: payload.national_id_type,
        national_id: payload.national_id,
        address: payload.address,
        city: payload.city,
        state: payload.state,
        district: payload.district.clone(),
        country: payload.country,
        pincode: payload.pincode,
        other_address: payload.other_address,
        emergency_contact_name: payload.emergency_contact_name,
        emergency_contact_phone: payload.emergency_contact_phone,
        emergency_contact_relation: payload.emergency_contact_relation,
        additional_docs: payload.additional_docs,
        enrollment_number: Some(enrollment_no.clone()),
        photo_url: payload.photo_url,
        signature_url: payload.signature_url,
        national_id_url: payload.national_id_url,
        highest_qualification: payload.highest_qualification,
        college: None,
        admission_mode: payload.admission_mode,
        exam_mode: payload.exam_mode.clone(),
        session_id: session_oid,
        session_start_date: payload.session_start_date,
        session_end_date: payload.session_end_date,
        approval_status: Some("approved".to_string()),
        status: Some("active".to_string()),
        admin_instructions: None,
        priority_centers: None,
        current_priority: None,
        marks: None,
        active: true,
        is_deleted: false,
        deleted_at: None,
        created_at: Utc::now(),
        course_id: course_oid,
        registration_date: payload
            .registration_date
            .or_else(|| Some(Utc::now().naive_utc().date().to_string())),
        roll_number: roll_no,
        serial_number: Some(serial_no),
        batch_id: batch_oid,
        referral_code: None,
        referred_by_code: payload.referral_code_used.clone(),
        applied_coupon: payload.coupon_code.clone(),
        course_category: payload.course_category,
        enrolled_courses: Some(vec![payload.course.clone()]),
        current_unit: payload.current_unit,
        other_doc_url: payload.other_doc_url,
        updated_at: Some(Utc::now()),
        is_email_verified: true,
        is_deleted_by_center_final: false,
        internship_domain: None,
        internship_mode: None,
        total_fees: payload.total_fees,
        extra_charges: payload.extra_charges,
        grand_total: payload.grand_total,
        fee_breakdown: payload.fee_breakdown,
        payment_type: None,
        is_payment_type_locked: false,
        installments: None,
        extra_charges_list: None,
        due_date: None,
        remarks: None,
        sub_admin_role_id: None,
        sub_admin_role_name: None,
        sub_admin_permissions: None,
    };
    println!(
        "create_student - new_user to insert into MongoDB: {:?}",
        new_user
    );
    println!(
        "create_student - location fields - city: {:?}, state: {:?}, district: {:?}, country: {:?}, pincode: {:?}, signature_url: {:?}",
        new_user.city,
        new_user.state,
        new_user.district,
        new_user.country,
        new_user.pincode,
        new_user.signature_url
    );

    match user_collection.insert_one(new_user, None).await {
        Ok(res) => {
            let inserted_id = res.inserted_id.as_object_id().unwrap();

            // Increment batch count if batch_id is provided
            if let Some(bid) = batch_oid {
                let batch_coll = db.collection::<crate::models::batch::Batch>("batches");
                let _ = batch_coll
                    .update_one(
                        doc! { "_id": bid },
                        doc! { "$inc": { "current_count": 1 } },
                        None,
                    )
                    .await;
            }

            // Generate and set referral code for new student
            let ref_code = generate_referral_code(&db, &inserted_id).await;
            let _ = user_collection
                .update_one(
                    doc! { "_id": inserted_id },
                    doc! { "$set": { "referral_code": &ref_code } },
                    None,
                )
                .await;

            // Handle referral logic if code was used
            if let Some(ref code) = payload.referral_code_used {
                if let Ok(Some(referrer)) = user_collection
                    .find_one(doc! { "referral_code": code }, None)
                    .await
                {
                    // Create referral record
                    let referral_coll = db.collection::<Referral>("referrals");
                    let new_referral = Referral {
                        id: None,
                        referrer_id: referrer.id.unwrap(),
                        referred_id: inserted_id,
                        code_used: code.clone(),
                        reward_amount: 500.0, // Default discount amount for student
                        reward_type: ReferralRewardType::Discount,
                        status: ReferralStatus::Pending,
                        level: 1,
                        depth: 0,
                        is_applied: false,
                        parent_referral_id: None,
                        created_at: Utc::now(),
                    };
                    let _ = referral_coll.insert_one(new_referral, None).await;
                }
            }

            id_card_auto::enqueue_auto_id_card_job(&db, inserted_id).await;

            // Get center name
            let center_name = if let Ok(Some(center)) = db
                .collection::<User>("users")
                .find_one(doc! { "_id": creator_id }, None)
                .await
            {
                center
                    .full_name
                    .unwrap_or_else(|| "SCRE Center".to_string())
            } else {
                "SCRE Center".to_string()
            };

            let _ = send_registration_email(
                &payload.email,
                &payload.full_name,
                &enrollment_no,
                &payload.password,
                &center_name,
            )
            .await;

            (
                StatusCode::CREATED,
                Json(serde_json::json!({
                    "success": true,
                    "message": "Student account created and approved".to_string(),
                    "id": Some(inserted_id.to_hex()),
                    "student": {
                        "id": inserted_id.to_hex(),
                        "enrollment_number": enrollment_no
                    }
                })),
            )
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "success": false,
                "message": format!("Database error creating user: {}", e),
                "id": None as Option<String>
            })),
        ),
    }
}

pub async fn public_register_student(
    State(db): State<Database>,
    Json(payload): Json<CreateStudentRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    // Basic validation
    if payload.full_name.is_empty() || payload.email.is_empty() || payload.phone.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "success": false,
                "message": "Missing required fields"
            })),
        );
    }

    let user_collection = db.collection::<User>("users");

    // Check if email already exists - if existing student, enroll in additional course under single login
    if let Ok(Some(existing_user)) = user_collection
        .find_one(doc! { "email": &payload.email }, None)
        .await
    {
        if existing_user.role == UserRole::Student {
            let new_course = payload.course.clone();
            let mut enrolled = existing_user.enrolled_courses.unwrap_or_default();
            if let Some(ref current_c) = existing_user.course {
                if !enrolled.contains(current_c) {
                    enrolled.push(current_c.clone());
                }
            }
            if !new_course.is_empty() && !enrolled.contains(&new_course) {
                enrolled.push(new_course.clone());
            }

            let _ = user_collection.update_one(
                doc! { "_id": existing_user.id },
                doc! {
                    "$set": {
                        "enrolled_courses": enrolled,
                        "updated_at": Utc::now()
                    }
                },
                None,
            ).await;

            return (
                StatusCode::OK,
                Json(serde_json::json!({
                    "success": true,
                    "message": "Enrolled in course successfully under your existing student profile!",
                    "is_existing_student": true,
                    "id": existing_user.id.map(|o| o.to_hex())
                })),
            );
        } else {
            return (
                StatusCode::CONFLICT,
                Json(serde_json::json!({
                    "success": false,
                    "message": "An account with this email already exists"
                })),
            );
        }
    }

    // Default username is email
    let username = payload.username.unwrap_or_else(|| payload.email.clone());
    let password_plain = payload.password.clone();
    let hashed_password = match hash(&password_plain, DEFAULT_COST) {
        Ok(h) => h,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "success": false,
                    "message": "Failed to hash password"
                })),
            );
        }
    };

    let mut prio_list = Vec::new();
    if let Some(ref list) = payload.priority_centers {
        for cid in list {
            let clean = cid.trim().to_string();
            if !clean.is_empty() && !prio_list.contains(&clean) {
                prio_list.push(clean);
            }
        }
    }
    if prio_list.is_empty() {
        if let Some(ref c1) = payload.priority_center_1.clone().or_else(|| payload.center_id.clone()) {
            if !c1.trim().is_empty() { prio_list.push(c1.trim().to_string()); }
        }
        if let Some(ref c2) = payload.priority_center_2 {
            if !c2.trim().is_empty() && !prio_list.contains(c2) { prio_list.push(c2.trim().to_string()); }
        }
        if let Some(ref c3) = payload.priority_center_3 {
            if !c3.trim().is_empty() && !prio_list.contains(c3) { prio_list.push(c3.trim().to_string()); }
        }
    }

    let primary_center_str = prio_list.first().cloned().or_else(|| payload.center_id.clone());
    let parent_oid = primary_center_str
        .clone()
        .and_then(|id| ObjectId::parse_str(&id).ok());
    let course_oid = payload
        .course_id
        .clone()
        .and_then(|id| ObjectId::parse_str(&id).ok());
    let batch_oid = payload
        .batch_id
        .clone()
        .and_then(|id| ObjectId::parse_str(&id).ok());
    let session_oid = payload
        .session_id
        .clone()
        .and_then(|id| ObjectId::parse_str(&id).ok());

    let center_coll = db.collection::<Center>("centers");
    let center = if let Some(pid) = parent_oid {
        if let Ok(Some(c)) = center_coll.find_one(doc! { "user_id": pid }, None).await {
            Some(c)
        } else {
            center_coll
                .find_one(doc! { "_id": pid }, None)
                .await
                .ok()
                .flatten()
        }
    } else {
        None
    };
    let center_code = center.map(|c| c.code).unwrap_or_else(|| "UNK".to_string());

    let course_coll = db.collection::<Course>("courses");
    let course = if let Some(cid) = course_oid {
        course_coll
            .find_one(doc! { "_id": cid }, None)
            .await
            .ok()
            .flatten()
    } else {
        None
    };
    let course_code = course
        .map(|c| {
            if !c.short_code.is_empty() {
                c.short_code
            } else {
                c.course_code
            }
        })
        .unwrap_or_else(|| "COURSE".to_string());

    let registration_date_str = payload
        .registration_date
        .clone()
        .unwrap_or_else(|| Utc::now().naive_utc().date().to_string());
    let registration_year = match NaiveDate::parse_from_str(&registration_date_str, "%Y-%m-%d") {
        Ok(date) => date.year(),
        Err(_) => Utc::now().year(),
    };

    let enrollment_no = match payload.enrollment_number {
        Some(v) if !v.trim().is_empty() => v,
        _ => generate_enrollment_number(&db, registration_year, &course_code).await,
    };
    let roll_no = match payload.roll_number {
        Some(v) if !v.trim().is_empty() => Some(v),
        _ => generate_roll_number(&db, course_oid.as_ref()).await,
    };

    let serial_no = if let Some(pid) = parent_oid {
        generate_serial_number(&db, &pid, &center_code).await
    } else {
        format!("{}-{}", center_code, Utc::now().timestamp_millis())
    };

    let final_admission_mode = payload.mode_of_study.clone().or(payload.admission_mode.clone());
    let final_priority_centers = if !prio_list.is_empty() {
        Some(prio_list)
    } else {
        primary_center_str.map(|cid| vec![cid])
    };

    let new_user = User {
        id: None,
        username: username.clone(),
        password_hash: hashed_password,
        raw_password: Some(password_plain.clone()),
        role: UserRole::Student,
        parent_id: parent_oid,
        full_name: Some(payload.full_name.clone()),
        first_name: payload.first_name,
        middle_name: payload.middle_name,
        last_name: payload.last_name,
        email: Some(payload.email.clone()),
        phone: Some(payload.phone.clone()),
        course: Some(payload.course.clone()),
        father_name: payload.father_name,
        mother_name: payload.mother_name,
        dob: payload.dob,
        gender: payload.gender,
        category: payload.category,
        national_id_type: payload.national_id_type,
        national_id: payload.national_id,
        address: payload.address,
        city: payload.city,
        state: payload.state,
        district: payload.district.clone(),
        country: payload.country,
        pincode: payload.pincode,
        other_address: payload.other_address,
        emergency_contact_name: payload.emergency_contact_name,
        emergency_contact_phone: payload.emergency_contact_phone,
        emergency_contact_relation: payload.emergency_contact_relation,
        additional_docs: payload.additional_docs,
        enrollment_number: Some(enrollment_no.clone()),
        photo_url: payload.photo_url,
        signature_url: payload.signature_url,
        national_id_url: payload.national_id_url,
        highest_qualification: payload.highest_qualification,
        college: None,
        admission_mode: final_admission_mode,
        exam_mode: payload.exam_mode.clone(),
        session_id: session_oid,
        session_start_date: payload.session_start_date,
        session_end_date: payload.session_end_date,
        approval_status: Some("pending".to_string()),
        status: Some("pending".to_string()),
        admin_instructions: None,
        priority_centers: final_priority_centers,
        current_priority: Some(1),
        marks: None,
        active: true,
        is_deleted: false,
        deleted_at: None,
        created_at: Utc::now(),
        course_id: course_oid,
        registration_date: payload
            .registration_date
            .or_else(|| Some(Utc::now().naive_utc().date().to_string())),
        roll_number: roll_no,
        serial_number: Some(serial_no),
        batch_id: batch_oid,
        referral_code: None,
        referred_by_code: payload.referral_code_used.clone(),
        applied_coupon: payload.coupon_code.clone(),
        course_category: payload.course_category,
        enrolled_courses: Some(vec![payload.course.clone()]),
        current_unit: payload.current_unit,
        other_doc_url: payload.other_doc_url,
        updated_at: Some(Utc::now()),
        is_email_verified: true,
        is_deleted_by_center_final: false,
        internship_domain: None,
        internship_mode: None,
        total_fees: payload.total_fees,
        extra_charges: payload.extra_charges,
        grand_total: payload.grand_total,
        fee_breakdown: payload.fee_breakdown,
        payment_type: None,
        is_payment_type_locked: false,
        installments: None,
        extra_charges_list: None,
        due_date: None,
        remarks: None,
        sub_admin_role_id: None,
        sub_admin_role_name: None,
        sub_admin_permissions: None,
    };
    println!(
        "create_student - new_user to insert into MongoDB: {:?}",
        new_user
    );
    println!(
        "create_student - location fields - city: {:?}, state: {:?}, district: {:?}, country: {:?}, pincode: {:?}, signature_url: {:?}",
        new_user.city,
        new_user.state,
        new_user.district,
        new_user.country,
        new_user.pincode,
        new_user.signature_url
    );

    match user_collection.insert_one(new_user, None).await {
        Ok(res) => {
            let inserted_id = res.inserted_id.as_object_id().unwrap();
            (
                StatusCode::CREATED,
                Json(serde_json::json!({
                    "success": true,
                    "message": "Registration successful",
                    "id": inserted_id.to_hex()
                })),
            )
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "success": false,
                "message": format!("Database error: {}", e)
            })),
        ),
    }
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PublicStudent {
    pub id: String,
    pub username: String,
    pub role: UserRole,
    pub parent_id: Option<String>,
    pub full_name: Option<String>,
    pub first_name: Option<String>,
    pub middle_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub course: Option<String>,
    pub enrollment_number: Option<String>,
    pub registration_number: Option<String>,
    pub active: bool,
    pub address: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub district: Option<String>,
    pub country: Option<String>,
    pub pincode: Option<String>,
    pub national_id_type: Option<String>,
    pub national_id: Option<String>,
    pub national_id_url: Option<String>,
    pub signature_url: Option<String>,
    pub additional_docs: Option<String>,
    pub course_id: Option<String>,
    pub roll_number: Option<String>,
    pub registration_date: Option<String>,
    pub photo_url: Option<String>,
    pub session_start_date: Option<String>,
    pub session_end_date: Option<String>,
    pub course_category: Option<String>,
    pub batch_id: Option<String>,
    pub session_id: Option<String>,
    pub father_name: Option<String>,
    pub mother_name: Option<String>,
    pub dob: Option<String>,
    pub gender: Option<String>,
    pub category: Option<String>,
    pub other_address: Option<String>,
    pub emergency_contact_name: Option<String>,
    pub emergency_contact_phone: Option<String>,
    pub emergency_contact_relation: Option<String>,
    pub highest_qualification: Option<String>,
    pub admission_mode: Option<String>,
    pub exam_mode: Option<String>,
    pub current_unit: Option<String>,
    pub total_fee: f64,
    pub paid_amount: f64,
    pub balance_due: f64,
    pub total_fees: Option<f64>,
    pub extra_charges: Option<f64>,
    pub grand_total: Option<f64>,
    pub fee_breakdown: Option<Vec<crate::models::user::FeeBreakdownItem>>,
    pub payment_type: Option<String>,
    pub is_payment_type_locked: bool,
    pub installments: Option<Vec<crate::models::user::Installment>>,
    pub extra_charges_list: Option<Vec<crate::models::user::ExtraCharge>>,
    pub due_date: Option<String>,
    pub remarks: Option<String>,
    #[serde(rename = "approval_status", alias = "approvalStatus")]
    pub approval_status: Option<String>,
    #[serde(rename = "status")]
    pub status: Option<String>,
    #[serde(rename = "admin_instructions", alias = "adminInstructions")]
    pub admin_instructions: Option<String>,
    #[serde(rename = "priority_centers", alias = "priorityCenters")]
    pub priority_centers: Option<Vec<String>>,
    #[serde(rename = "current_priority", alias = "currentPriority")]
    pub current_priority: Option<i32>,
    #[serde(rename = "center_name", alias = "centerName")]
    pub center_name: Option<String>,
    pub course_name: Option<String>,
}

impl From<User> for PublicStudent {
    fn from(u: User) -> Self {
        let signature_from_docs = u.additional_docs.as_ref().and_then(|raw| {
            serde_json::from_str::<serde_json::Value>(raw)
                .ok()
                .and_then(|v| {
                    v.get("signature_url")
                        .or_else(|| v.get("signatureUrl"))
                        .and_then(|x| x.as_str())
                        .map(|s| s.to_string())
                })
        });

        PublicStudent {
            id: u.id.unwrap_or_default().to_hex(),
            username: u.username,
            role: u.role,
            parent_id: u.parent_id.map(|oid| oid.to_hex()),
            full_name: u.full_name,
            first_name: u.first_name,
            middle_name: u.middle_name,
            last_name: u.last_name,
            email: u.email,
            phone: u.phone,
            course: u.course,
            enrollment_number: u.enrollment_number,
            registration_number: u.serial_number,
            active: u.active,
            address: u.address,
            city: u.city,
            state: u.state,
            district: u.district,
            country: u.country,
            pincode: u.pincode,
            national_id_type: u.national_id_type,
            national_id: u.national_id,
            national_id_url: u.national_id_url,
            signature_url: u.signature_url.or(signature_from_docs),
            additional_docs: u.additional_docs,
            course_id: u.course_id.map(|oid| oid.to_hex()),
            roll_number: u.roll_number,
            registration_date: u.registration_date,
            photo_url: u.photo_url,
            session_start_date: u.session_start_date,
            session_end_date: u.session_end_date,
            course_category: u.course_category,
            batch_id: u.batch_id.map(|oid| oid.to_hex()),
            session_id: u.session_id.map(|oid| oid.to_hex()),
            father_name: u.father_name,
            mother_name: u.mother_name,
            dob: u.dob,
            gender: u.gender,
            category: u.category,
            other_address: u.other_address,
            emergency_contact_name: u.emergency_contact_name,
            emergency_contact_phone: u.emergency_contact_phone,
            emergency_contact_relation: u.emergency_contact_relation,
            highest_qualification: u.highest_qualification,
            admission_mode: u.admission_mode,
            exam_mode: u.exam_mode,
            current_unit: u.current_unit,
            total_fee: 0.0,
            paid_amount: 0.0,
            balance_due: 0.0,
            total_fees: u.total_fees,
            extra_charges: u.extra_charges,
            grand_total: u.grand_total,
            fee_breakdown: u.fee_breakdown,
            payment_type: u.payment_type,
            is_payment_type_locked: u.is_payment_type_locked,
            installments: u.installments,
            extra_charges_list: u.extra_charges_list,
            due_date: u.due_date,
            remarks: u.remarks,
            approval_status: u.approval_status,
            status: u.status,
            admin_instructions: u.admin_instructions,
            priority_centers: u.priority_centers,
            current_priority: u.current_priority,
            center_name: None,
            course_name: None,
        }
    }
}

// Helper function to calculate total fee for a student (Course Fee + Admission Fee + Exam Fee)
async fn calculate_total_fee_for_student(db: &Database, student: &User) -> f64 {
    // Always calculate from course
    let course_id = match student.course_id {
        Some(id) => id,
        None => return 0.0,
    };
    let courses_coll = db.collection::<Course>("courses");
    match courses_coll.find_one(doc! { "_id": course_id }, None).await {
        Ok(Some(course)) => {
            let course_fee = course.fees.unwrap_or(0) as f64;
            let admission_fee = course.registration_fee.unwrap_or(0) as f64;
            let exam_fee = course.exam_fee_amount.unwrap_or(0) as f64;
            course_fee + admission_fee + exam_fee
        },
        _ => 0.0,
    }
}

// Helper function to calculate total paid for a student
async fn calculate_paid_amount_for_student(db: &Database, student_id: ObjectId) -> f64 {
    let coll = db.collection::<crate::models::fee::FeeRecord>("fees");
    let filter = doc! { "student_id": student_id };
    let mut total = 0.0;
    
    let mut cursor = match coll.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return total,
    };
    
    while let Some(result) = cursor.next().await {
        if let Ok(fee) = result {
            total += fee.amount;
        }
    }
    
    total
}

pub async fn list_students(
    State(db): State<Database>,
    claims: Claims,
    Query(q): Query<ListStudentsQuery>,
) -> (StatusCode, Json<serde_json::Value>) {
    let center_coll = db.collection::<Center>("centers");
    let mut center_cursor = match center_coll.find(doc! {}, None).await {
        Ok(c) => c,
        Err(_) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!([])));
        }
    };
    let mut center_name_lookup: HashMap<String, String> = HashMap::new();
    while let Some(result) = center_cursor.next().await {
        if let Ok(center) = result {
            center_name_lookup.insert(center.user_id.to_hex(), center.name);
        }
    }

    let course_coll = db.collection::<Course>("courses");
    let mut course_cursor = match course_coll.find(doc! {}, None).await {
        Ok(c) => c,
        Err(_) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!([])));
        }
    };
    let mut course_name_lookup: HashMap<String, (String, String)> = HashMap::new();
    while let Some(result) = course_cursor.next().await {
        if let Ok(course) = result {
            if let Some(cid) = course.id {
                course_name_lookup.insert(cid.to_hex(), (course.course_name, course.category_id.to_hex()));
            }
        }
    }

    let user_collection = db.collection::<User>("users");
    let mut filter = doc! { "role": "student", "is_deleted": false };

    if claims.role == UserRole::Center {
        let center_oid = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => {
                return (StatusCode::BAD_REQUEST, Json(serde_json::json!([])));
            }
        };
        filter.insert("parent_id", center_oid);
    }

    if let Some(ref cid_str) = q.course_id {
        if let Ok(course_oid) = ObjectId::parse_str(cid_str) {
            filter.insert("course_id", course_oid);
        }
    }

    if let Some(ref cat_str) = q.category_id {
        let matching_course_oids: Vec<ObjectId> = course_name_lookup
            .iter()
            .filter(|(_, (_, cat_id))| cat_id == cat_str)
            .filter_map(|(cid_hex, _)| ObjectId::parse_str(cid_hex).ok())
            .collect();

        if matching_course_oids.is_empty() {
            return (StatusCode::OK, Json(serde_json::json!([])));
        }

        let bson_array: mongodb::bson::Array = matching_course_oids
            .into_iter()
            .map(mongodb::bson::Bson::ObjectId)
            .collect();
        filter.insert("course_id", doc! { "$in": bson_array });
    }

    if let Some(ref search_str) = q.search {
        let search_lower = search_str.to_lowercase();
        let center_user_ids: Vec<ObjectId> = center_name_lookup
            .iter()
            .filter(|(_, name)| name.to_lowercase().contains(&search_lower))
            .filter_map(|(uid_hex, _)| ObjectId::parse_str(uid_hex).ok())
            .collect();

        let pattern = format!("(?i){}", regex::escape(search_str));

        let mut or_conditions = vec![
            doc! { "full_name": { "$regex": &pattern } },
            doc! { "father_name": { "$regex": &pattern } },
            doc! { "enrollment_number": { "$regex": &pattern } },
            doc! { "username": { "$regex": &pattern } },
        ];

        if !center_user_ids.is_empty() {
            let bson_center_ids: mongodb::bson::Array = center_user_ids
                .into_iter()
                .map(mongodb::bson::Bson::ObjectId)
                .collect();
            or_conditions.push(doc! { "parent_id": { "$in": bson_center_ids } });
        }

        filter.insert("$or", or_conditions);
    }

    let mut cursor = match user_collection.find(filter, None).await {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!([])),
            );
        }
    };

    let mut students = Vec::new();
    use futures_util::stream::StreamExt;
    while let Some(result) = cursor.next().await {
        match result {
            Ok(student) => {
                let student_id = student.id.unwrap();
                let total_fee = calculate_total_fee_for_student(&db, &student).await;
                let paid_amount = calculate_paid_amount_for_student(&db, student_id).await;
                let balance_due = (total_fee - paid_amount).max(0.0);

                let signature_from_docs = student.additional_docs.as_ref().and_then(|raw| {
                    serde_json::from_str::<serde_json::Value>(raw)
                        .ok()
                        .and_then(|v| {
                            v.get("signature_url")
                                .or_else(|| v.get("signatureUrl"))
                                .and_then(|x| x.as_str())
                                .map(|s| s.to_string())
                        })
                });

                let center_name = student
                    .parent_id
                    .as_ref()
                    .and_then(|pid| center_name_lookup.get(&pid.to_hex()))
                    .cloned();

                let course_name = student
                    .course_id
                    .as_ref()
                    .and_then(|cid| course_name_lookup.get(&cid.to_hex()))
                    .map(|(n, _)| n.clone());

                let public_student = PublicStudent {
                    id: student_id.to_hex(),
                    username: student.username,
                    role: student.role,
                    parent_id: student.parent_id.map(|oid| oid.to_hex()),
                    full_name: student.full_name,
                    first_name: student.first_name,
                    middle_name: student.middle_name,
                    last_name: student.last_name,
                    email: student.email,
                    phone: student.phone,
                    course: student.course,
                    enrollment_number: student.enrollment_number,
                    registration_number: student.serial_number,
                    active: student.active,
                    address: student.address,
                    city: student.city,
                    state: student.state,
                    district: student.district,
                    country: student.country,
                    pincode: student.pincode,
                    national_id_type: student.national_id_type,
                    national_id: student.national_id,
                    national_id_url: student.national_id_url,
                    signature_url: student.signature_url.or(signature_from_docs),
                    additional_docs: student.additional_docs,
                    course_id: student.course_id.map(|oid| oid.to_hex()),
                    roll_number: student.roll_number,
                    registration_date: student.registration_date,
                    photo_url: student.photo_url,
                    session_start_date: student.session_start_date,
                    session_end_date: student.session_end_date,
                    course_category: student.course_category,
                    batch_id: student.batch_id.map(|oid| oid.to_hex()),
                    session_id: student.session_id.map(|oid| oid.to_hex()),
                    father_name: student.father_name,
                    mother_name: student.mother_name,
                    dob: student.dob,
                    gender: student.gender,
                    category: student.category,
                    other_address: student.other_address,
                    emergency_contact_name: student.emergency_contact_name,
                    emergency_contact_phone: student.emergency_contact_phone,
                    emergency_contact_relation: student.emergency_contact_relation,
                    highest_qualification: student.highest_qualification,
                    admission_mode: student.admission_mode,
                    exam_mode: student.exam_mode,
                    current_unit: student.current_unit,
                    total_fee,
                    paid_amount,
                    balance_due,
                    total_fees: student.total_fees,
                    extra_charges: student.extra_charges,
                    grand_total: student.grand_total,
                    fee_breakdown: student.fee_breakdown,
                    payment_type: student.payment_type,
                    is_payment_type_locked: student.is_payment_type_locked,
                    installments: student.installments,
                    extra_charges_list: student.extra_charges_list,
                    due_date: student.due_date,
                    remarks: student.remarks,
                    approval_status: student.approval_status,
                    status: student.status,
                    admin_instructions: student.admin_instructions,
                    priority_centers: student.priority_centers,
                    current_priority: student.current_priority,
                    center_name,
                    course_name,
                };

                students.push(public_student);
            },
            Err(_) => {},
        }
    }

    (StatusCode::OK, Json(serde_json::json!(students)))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFeeStructureRequest {
    pub payment_type: Option<String>,
    pub installments: Option<Vec<crate::models::user::Installment>>,
    pub is_payment_type_locked: Option<bool>,
}

pub async fn update_student_fee_structure(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<UpdateFeeStructureRequest>,
) -> (StatusCode, Json<CreateStudentResponse>) {
    println!(
        "update_student_fee_structure called for student: {}, role: {:?}",
        id, claims.role
    );

    // Only Center or Admin can update students
    if claims.role != UserRole::Center
        && claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
    {
        return (
            StatusCode::FORBIDDEN,
            Json(CreateStudentResponse {
                success: false,
                message: "Forbidden".to_string(),
            }),
        );
    }

    let obj_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(CreateStudentResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let user_collection = db.collection::<User>("users");

    // If center, verify student belongs to them
    if claims.role == UserRole::Center {
        let center_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(CreateStudentResponse {
                        success: false,
                        message: "Invalid center ID".to_string(),
                    }),
                );
            }
        };
        let student = user_collection
            .find_one(doc! { "_id": obj_id, "parent_id": center_id }, None)
            .await;
        if let Ok(None) = student {
            return (
                StatusCode::NOT_FOUND,
                Json(CreateStudentResponse {
                    success: false,
                    message: "Student not found".to_string(),
                }),
            );
        }
    }

    let mut update_doc = doc! {};

    // Check if payment type is locked before allowing changes
    if let Some(student) = user_collection.find_one(doc! { "_id": obj_id }, None).await.ok().flatten() {
        if student.is_payment_type_locked {
            // If locked, don't allow changing payment type
            if payload.payment_type.is_some() {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(CreateStudentResponse {
                        success: false,
                        message: "Payment type is locked and cannot be changed".to_string(),
                    }),
                );
            }
        } else {
            // If not locked, allow payment type change
            if let Some(pt) = payload.payment_type {
                update_doc.insert("payment_type", pt);
            }
        }

        if let Some(new_inst) = payload.installments {
            // Validate: if there are existing installments, any that have amount_paid > 0 must still exist
            if let Some(existing_inst) = &student.installments {
                let existing_paid: Vec<_> = existing_inst
                    .iter()
                    .filter(|i| i.amount_paid > 0.0)
                    .collect();
                
                for paid_inst in existing_paid {
                    let exists = new_inst.iter().any(|i| i.installment_number == paid_inst.installment_number);
                    if !exists {
                        return (
                            StatusCode::BAD_REQUEST,
                            Json(CreateStudentResponse {
                                success: false,
                                message: format!("Cannot delete installment {} which has payments made", paid_inst.installment_number),
                            }),
                        );
                    }
                    
                    // Also check that amount_paid wasn't decreased
                    let new_i = new_inst.iter().find(|i| i.installment_number == paid_inst.installment_number).unwrap();
                    if new_i.amount_paid < paid_inst.amount_paid {
                        return (
                            StatusCode::BAD_REQUEST,
                            Json(CreateStudentResponse {
                                success: false,
                                message: format!("Cannot decrease amount paid for installment {}", paid_inst.installment_number),
                            }),
                        );
                    }
                }
            }
            
            if let Ok(bson_inst) = mongodb::bson::to_bson(&new_inst) {
                update_doc.insert("installments", bson_inst);
            }
        }

        if let Some(locked) = payload.is_payment_type_locked {
            update_doc.insert("is_payment_type_locked", locked);
        }
    }

    // Always update the updated_at timestamp
    update_doc.insert("updated_at", Utc::now());

    if update_doc.is_empty() {
        return (
            StatusCode::OK,
            Json(CreateStudentResponse {
                success: true,
                message: "No changes".to_string(),
            }),
        );
    }

    match user_collection
        .update_one(doc! { "_id": obj_id }, doc! { "$set": update_doc }, None)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(CreateStudentResponse {
                success: true,
                message: "Fee structure updated successfully".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CreateStudentResponse {
                success: false,
                message: "Update failed".to_string(),
            }),
        ),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateExtraChargesRequest {
    pub extra_charges_list: Option<Vec<crate::models::user::ExtraCharge>>,
}

pub async fn update_student_extra_charges(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<UpdateExtraChargesRequest>,
) -> (StatusCode, Json<CreateStudentResponse>) {
    println!(
        "update_student_extra_charges called for student: {}, role: {:?}",
        id, claims.role
    );

    // Only Center or Admin can update students
    if claims.role != UserRole::Center
        && claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
    {
        return (
            StatusCode::FORBIDDEN,
            Json(CreateStudentResponse {
                success: false,
                message: "Forbidden".to_string(),
            }),
        );
    }

    let obj_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(CreateStudentResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let user_collection = db.collection::<User>("users");

    // If center, verify student belongs to them
    if claims.role == UserRole::Center {
        let center_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(CreateStudentResponse {
                        success: false,
                        message: "Invalid center ID".to_string(),
                    }),
                );
            }
        };
        let student = user_collection
            .find_one(doc! { "_id": obj_id, "parent_id": center_id }, None)
            .await;
        if let Ok(None) = student {
            return (
                StatusCode::NOT_FOUND,
                Json(CreateStudentResponse {
                    success: false,
                    message: "Student not found".to_string(),
                }),
            );
        }
    }

    let mut update_doc = doc! {};

    if let Some(new_charges) = payload.extra_charges_list {
        // Validate extra charges
        if let Some(student) = user_collection.find_one(doc! { "_id": obj_id }, None).await.ok().flatten() {
            if let Some(existing_charges) = &student.extra_charges_list {
                let existing_paid: Vec<_> = existing_charges
                    .iter()
                    .filter(|c| c.paid_amount > 0.0)
                    .collect();
                
                for paid_charge in existing_paid {
                    let exists = new_charges.iter().any(|c| c.id == paid_charge.id);
                    if !exists {
                        return (
                            StatusCode::BAD_REQUEST,
                            Json(CreateStudentResponse {
                                success: false,
                                message: format!("Cannot delete extra charge {} which has payments made", paid_charge.name),
                            }),
                        );
                    }
                    
                    let new_c = new_charges.iter().find(|c| c.id == paid_charge.id).unwrap();
                    if new_c.paid_amount < paid_charge.paid_amount {
                        return (
                            StatusCode::BAD_REQUEST,
                            Json(CreateStudentResponse {
                                success: false,
                                message: format!("Cannot decrease paid amount for extra charge {}", paid_charge.name),
                            }),
                        );
                    }
                }
            }
        }
        
        if let Ok(bson_charges) = mongodb::bson::to_bson(&new_charges) {
            update_doc.insert("extra_charges_list", bson_charges);
        }
    }

    // Always update the updated_at timestamp
    update_doc.insert("updated_at", Utc::now());

    if update_doc.is_empty() {
        return (
            StatusCode::OK,
            Json(CreateStudentResponse {
                success: true,
                message: "No changes".to_string(),
            }),
        );
    }

    match user_collection
        .update_one(doc! { "_id": obj_id }, doc! { "$set": update_doc }, None)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(CreateStudentResponse {
                success: true,
                message: "Extra charges updated successfully".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CreateStudentResponse {
                success: false,
                message: "Update failed".to_string(),
            }),
        ),
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudentMetricsResponse {
    pub attendance_percentage: f64,
    pub course_progress: f64,
    pub pending_assignments: u64,
    pub current_gpa: f64,
    pub active_modules: u64,
}

pub async fn get_student_metrics(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<StudentMetricsResponse>) {
    if claims.role != UserRole::Student {
        return (
            StatusCode::FORBIDDEN,
            Json(StudentMetricsResponse {
                attendance_percentage: 0.0,
                course_progress: 0.0,
                pending_assignments: 0,
                current_gpa: 0.0,
                active_modules: 0,
            }),
        );
    }

    let student_id = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(StudentMetricsResponse {
                    attendance_percentage: 0.0,
                    course_progress: 0.0,
                    pending_assignments: 0,
                    current_gpa: 0.0,
                    active_modules: 0,
                }),
            );
        }
    };

    let attendance_collection = db.collection::<mongodb::bson::Document>("attendance");
    let exam_results_collection = db.collection::<mongodb::bson::Document>("exam_results");

    // 1. Calculate Attendance
    let total_days = attendance_collection
        .count_documents(doc! { "student_id": student_id }, None)
        .await
        .unwrap_or(0);
    let present_days = attendance_collection
        .count_documents(doc! { "student_id": student_id, "status": "present" }, None)
        .await
        .unwrap_or(0);
    let attendance_percentage = if total_days > 0 {
        (present_days as f64 / total_days as f64) * 100.0
    } else {
        0.0
    };

    // 2. Mock some values for now as they are not yet implemented in backend
    // but better than hardcoded in frontend
    let course_progress = 65.0; // Mock
    let pending_assignments = 2; // Mock
    let active_modules = 4; // Mock

    // 3. Calculate GPA/Average Marks from exam results
    let mut cursor = exam_results_collection
        .find(doc! { "student_id": student_id }, None)
        .await
        .expect("Failed to fetch results");
    let mut total_marks = 0.0;
    let mut count = 0;
    use futures_util::stream::StreamExt;
    while let Some(result) = cursor.next().await {
        if let Ok(doc) = result {
            if let Ok(marks) = doc.get_f64("obtained_marks") {
                if let Ok(total) = doc.get_f64("total_marks") {
                    total_marks += (marks / total) * 10.0; // Scale to 10
                    count += 1;
                }
            }
        }
    }
    let current_gpa = if count > 0 {
        total_marks / count as f64
    } else {
        0.0
    };

    (
        StatusCode::OK,
        Json(StudentMetricsResponse {
            attendance_percentage,
            course_progress,
            pending_assignments,
            current_gpa,
            active_modules,
        }),
    )
}

pub async fn get_student_by_id(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<Option<PublicStudent>>) {
    let obj_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(None)),
    };

    let user_collection = db.collection::<User>("users");
    let filter = if claims.role == UserRole::Center {
        let center_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(None)),
        };
        doc! { "_id": obj_id, "parent_id": center_id, "role": "student" }
    } else {
        doc! { "_id": obj_id, "role": "student" }
    };

    match user_collection.find_one(filter, None).await {
        Ok(student) => (StatusCode::OK, Json(student.map(PublicStudent::from))),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(None)),
    }
}

pub async fn generate_student_enrollment_pdf(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, "Invalid student ID").into_response(),
    };

    let user_collection = db.collection::<User>("users");
    let student = match user_collection
        .find_one(doc! { "_id": oid }, None)
        .await
    {
        Ok(Some(s)) => s,
        _ => return (StatusCode::NOT_FOUND, "Student not found").into_response(),
    };

    // Access control
    if claims.role == UserRole::Center {
        let center_id = ObjectId::parse_str(&claims.sub).unwrap();
        if student.parent_id != Some(center_id) {
            return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
        }
    } else if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
    }

    let center = if let Some(pid) = student.parent_id {
        db.collection::<Center>("centers")
            .find_one(doc! { "user_id": pid }, None)
            .await
            .ok()
            .flatten()
    } else {
        None
    };

    let html = generate_enrollment_html(&student, center.as_ref());

    let temp_dir = std::env::temp_dir();
    let timestamp = Utc::now().timestamp();
    let name_slug = student
        .full_name
        .as_ref()
        .map(|n| n.replace(" ", "_"))
        .unwrap_or_else(|| "student".to_string());
    let pdf_filename = format!("enrollment_{}_{}.pdf", name_slug, timestamp);
    let abs_pdf_path = temp_dir.join(&pdf_filename);
    let abs_html_path = temp_dir.join(format!("enrollment_{}_{}.html", name_slug, timestamp));

    if let Err(e) = std::fs::write(&abs_html_path, &html) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to write HTML: {}", e),
        )
            .into_response();
    }

    // Try multiple possible chromium/edge paths
    let chromium_paths = [
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "msedge.exe",
        "chrome.exe",
        "msedge",
        "chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/snap/bin/chromium",
        "google-chrome-stable",
    ];

    let mut pdf_generated = false;
    let mut last_error = String::new();
    let input_url = format!("file://{}", abs_html_path.display());

    for path in chromium_paths {
        println!(
            "Attempting student PDF generation with {} for URL {}",
            path, input_url
        );

        let output = std::process::Command::new(path)
            .args([
                "--headless=new",
                "--disable-gpu",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-extensions",
                "--allow-file-access-from-files",
                &format!("--print-to-pdf={}", abs_pdf_path.display()),
                &input_url,
            ])
            .output();

        match output {
            Ok(out) if out.status.success() => {
                if abs_pdf_path.exists() {
                    pdf_generated = true;
                    println!("Successfully generated student PDF with {}", path);
                    break;
                } else {
                    last_error = format!(
                        "Chromium at {} reported success but PDF file not found at {}",
                        path,
                        abs_pdf_path.display()
                    );
                    eprintln!("{}", last_error);
                }
            }
            Ok(out) => {
                let err = String::from_utf8_lossy(&out.stderr);
                let stdout = String::from_utf8_lossy(&out.stdout);
                last_error = format!(
                    "Chromium at {} failed. Stderr: {}. Stdout: {}",
                    path, err, stdout
                );
                eprintln!("{}", last_error);
            }
            Err(e) => {
                last_error = format!("Failed to run chromium at {}: {}", path, e);
                eprintln!("{}", last_error);
            }
        }
    }

    if pdf_generated {
        if let Ok(pdf_bytes) = std::fs::read(&abs_pdf_path) {
            let _ = std::fs::remove_file(abs_html_path);
            let _ = std::fs::remove_file(abs_pdf_path);
            (
                StatusCode::OK,
                [
                    (axum::http::header::CONTENT_TYPE, "application/pdf"),
                    (
                        axum::http::header::CONTENT_DISPOSITION,
                        &format!("attachment; filename=\"{}\"", pdf_filename),
                    ),
                ],
                pdf_bytes,
            )
                .into_response()
        } else {
            (
                StatusCode::OK,
                [
                    (axum::http::header::CONTENT_TYPE, "text/html; charset=utf-8"),
                    (
                        axum::http::header::CONTENT_DISPOSITION,
                        "inline; filename=\"enrollment.html\"",
                    ),
                ],
                html.into_bytes(),
            )
                .into_response()
        }
    } else {
        (
            StatusCode::OK,
            [
                (axum::http::header::CONTENT_TYPE, "text/html; charset=utf-8"),
                (
                    axum::http::header::CONTENT_DISPOSITION,
                    "inline; filename=\"enrollment.html\"",
                ),
            ],
            html.into_bytes(),
        )
            .into_response()
    }
}

fn generate_enrollment_html(student: &User, center: Option<&Center>) -> String {
    let photo_uri = student
        .photo_url
        .as_ref()
        .map(|u| get_image_data_uri(u))
        .unwrap_or_else(|| "https://via.placeholder.com/150".to_string());
    let sig_uri = student
        .signature_url
        .as_ref()
        .map(|u| get_image_data_uri(u))
        .unwrap_or_else(|| "".to_string());

    let center_name = center
        .map(|c| c.name.clone())
        .unwrap_or_else(|| "N/A".to_string());
    let center_code = center
        .map(|c| c.code.clone())
        .unwrap_or_else(|| "N/A".to_string());

    format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; padding: 40px; color: #333; }}
        .header {{ text-align: center; border-bottom: 2px solid #2e7d32; padding-bottom: 20px; margin-bottom: 30px; }}
        .logo {{ font-size: 24px; font-weight: bold; color: #2e7d32; }}
        .title {{ font-size: 20px; text-transform: uppercase; margin-top: 10px; }}
        .content {{ display: flex; flex-wrap: wrap; }}
        .section {{ width: 100%; margin-bottom: 25px; }}
        .section-title {{ background: #f4f4f4; padding: 8px 15px; font-weight: bold; text-transform: uppercase; font-size: 14px; margin-bottom: 15px; border-left: 4px solid #2e7d32; }}
        .row {{ display: flex; margin-bottom: 10px; font-size: 13px; }}
        .label {{ width: 200px; font-weight: bold; color: #666; }}
        .value {{ flex: 1; font-weight: 600; }}
        .photo-box {{ position: absolute; top: 150px; right: 40px; width: 120px; height: 150px; border: 1px solid #ccc; overflow: hidden; }}
        .photo-box img {{ width: 100%; height: 100%; object-fit: cover; }}
        .footer {{ margin-top: 50px; border-top: 1px solid #eee; padding-top: 20px; display: flex; justify-content: space-between; }}
        .signature {{ text-align: center; }}
        .signature img {{ max-width: 150px; max-height: 60px; display: block; margin: 0 auto 5px; }}
        .stamp {{ width: 100px; height: 100px; border: 2px dashed #ccc; display: flex; items-center; justify-content: center; font-size: 10px; color: #ccc; }}
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">SIR CHHOTU RAM EDUCATION (SCRE)</div>
        <div class="title">Student Enrollment Receipt</div>
    </div>

    <div class="photo-box">
        <img src="{photo_uri}" alt="Student Photo">
    </div>

    <div class="section">
        <div class="section-title">Academic Details</div>
        <div class="row"><div class="label">Enrollment No:</div><div class="value">{enrollment_no}</div></div>
        <div class="row"><div class="label">Serial No:</div><div class="value">{serial_no}</div></div>
        <div class="row"><div class="label">Course:</div><div class="value">{course}</div></div>
        <div class="row"><div class="label">Admission mode:</div><div class="value">{admission_mode}</div></div>
        <div class="row"><div class="label">Exam mode:</div><div class="value">{exam_mode}</div></div>
        <div class="row"><div class="label">Batch:</div><div class="value">{batch}</div></div>
        <div class="row"><div class="label">Center:</div><div class="value">{center_name} ({center_code})</div></div>
        <div class="row"><div class="label">Enrollment Date:</div><div class="value">{reg_date}</div></div>
    </div>

    <div class="section">
        <div class="section-title">Personal Information</div>
        <div class="row"><div class="label">Student Name:</div><div class="value">{full_name}</div></div>
        <div class="row"><div class="label">Father's Name:</div><div class="value">{father}</div></div>
        <div class="row"><div class="label">Mother's Name:</div><div class="value">{mother}</div></div>
        <div class="row"><div class="label">Date of Birth:</div><div class="value">{dob}</div></div>
        <div class="row"><div class="label">Gender:</div><div class="value">{gender}</div></div>
        <div class="row"><div class="label">Mobile No:</div><div class="value">{phone}</div></div>
        <div class="row"><div class="label">Email ID:</div><div class="value">{email}</div></div>
    </div>

    <div class="section">
        <div class="section-title">Location Details</div>
        <div class="row"><div class="label">Street Address:</div><div class="value">{address}</div></div>
        <div class="row"><div class="label">Country:</div><div class="value">{country}</div></div>
        <div class="row"><div class="label">State:</div><div class="value">{state}</div></div>
        <div class="row"><div class="label">District:</div><div class="value">{district}</div></div>
        <div class="row"><div class="label">City:</div><div class="value">{city}</div></div>
        <div class="row"><div class="label">Pincode:</div><div class="value">{pincode}</div></div>
    </div>

    <div class="footer">
        <div class="signature">
            <div class="stamp">Center Stamp</div>
            <div style="font-size: 10px; margin-top: 5px;">Authorized Center</div>
        </div>
        <div class="signature">
            {sig_html}
            <div style="font-size: 10px; border-top: 1px solid #333; width: 150px; padding-top: 5px;">Student Signature</div>
        </div>
    </div>
</body>
</html>"#,
        photo_uri = photo_uri,
        enrollment_no = student.enrollment_number.as_deref().unwrap_or("N/A"),
        serial_no = student.serial_number.as_deref().unwrap_or("N/A"),
        course = student.course.as_deref().unwrap_or("N/A"),
        admission_mode = student
            .admission_mode
            .as_deref()
            .filter(|s| !s.is_empty())
            .unwrap_or("—"),
        exam_mode = student
            .exam_mode
            .as_deref()
            .filter(|s| !s.is_empty())
            .unwrap_or("—"),
        batch = student
            .batch_id
            .as_ref()
            .map(|id| id.to_hex())
            .unwrap_or_else(|| "N/A".to_string()),
        center_name = center_name,
        center_code = center_code,
        reg_date = student.registration_date.as_deref().unwrap_or("N/A"),
        full_name = student.full_name.as_deref().unwrap_or("N/A"),
        father = student.father_name.as_deref().unwrap_or("N/A"),
        mother = student.mother_name.as_deref().unwrap_or("N/A"),
        dob = student.dob.as_deref().unwrap_or("N/A"),
        gender = student.gender.as_deref().unwrap_or("N/A"),
        phone = student.phone.as_deref().unwrap_or("N/A"),
        email = student.email.as_deref().unwrap_or("N/A"),
        address = student.address.as_deref().unwrap_or("N/A"),
        country = student.country.as_deref().unwrap_or("N/A"),
        state = student.state.as_deref().unwrap_or("N/A"),
        district = student.district.as_deref().unwrap_or("N/A"),
        city = student.city.as_deref().unwrap_or("N/A"),
        pincode = student.pincode.as_deref().unwrap_or("N/A"),
        sig_html = if !sig_uri.is_empty() {
            format!(r#"<img src="{}" alt="Signature">"#, sig_uri)
        } else {
            "".to_string()
        }
    )
}

fn generate_id_card_html(student: &User, center: Option<&Center>) -> String {
    let photo_uri = student
        .photo_url
        .as_ref()
        .map(|u| get_image_data_uri(u))
        .unwrap_or_else(|| "https://via.placeholder.com/150x200".to_string());
    let sig_uri = student
        .signature_url
        .as_ref()
        .map(|u| get_image_data_uri(u))
        .unwrap_or_else(|| "".to_string());

    let center_name = center
        .map(|c| c.name.clone())
        .unwrap_or_else(|| "N/A".to_string());
    let center_code = center
        .map(|c| c.code.clone())
        .unwrap_or_else(|| "N/A".to_string());

    // Generate QR code data (same as hall ticket)
    let qr_data = format!(
        "ID: {}\nName: {}\nEnrollment: {}\nRoll: {}\nCourse: {}",
        student
            .id
            .map(|oid| oid.to_hex())
            .unwrap_or("N/A".to_string()),
        student.full_name.as_deref().unwrap_or("N/A"),
        student.enrollment_number.as_deref().unwrap_or("N/A"),
        student.roll_number.as_deref().unwrap_or("N/A"),
        student.course.as_deref().unwrap_or("N/A")
    );
    let qr_uri = format!(
        "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data={}",
        urlencoding::encode(&qr_data)
    );

    format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <style>
        * {{ box-sizing: border-box; }}
        body {{ 
            margin: 0; padding: 0; font-family: 'Segoe UI, Arial, sans-serif; }}
        .id-card {{
            width: 85.6mm;
            height: 54mm;
            background: linear-gradient(135deg, #0c4a6e 0%, #0369a1 50%, #0284c7 100%);
            position: relative;
            overflow: hidden;
            position: relative;
        }}
        .watermark {{
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 80px;
            font-weight: bold;
            color: rgba(255,255,255,0.05);
            white-space: nowrap;
            z-index: 0;
        }}
        .id-content {{
            position: relative;
            z-index: 1;
            padding: 10px;
            height: 100%;
            display: flex;
            flex-direction: column;
        }}
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: white;
            padding: 8px 10px;
            border-radius: 8px;
            margin-bottom: 8px;
        }}
        .logo-left, .logo-right {{
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: #0c4a6e;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 10px;
        }}
        .header-text {{
            text-align: center;
            flex: 1;
            margin: 0 10px;
        }}
        .header-text h1 {{
            margin: 0;
            font-size: 14px;
            color: #0c4a6e;
            text-transform: uppercase;
        }}
        .header-text h2 {{
            margin: 2px 0 0 0;
            font-size: 10px;
            color: #666;
        }}
        .main-content {{
            display: flex;
            flex: 1;
            background: white;
            border-radius: 8px;
            padding: 8px;
            gap: 10px;
        }}
        .photo-section {{
            width: 90px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }}
        .photo-box {{
            width: 80px;
            height: 100px;
            border: 2px solid #0c4a6e;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 5px;
        }}
        .photo-box img {{
            width: 100%;
            height: 100%;
            object-fit: cover;
        }}
        .qr-box {{
            width: 60px;
            height: 60px;
            margin-top: 5px;
        }}
        .qr-box img {{
            width: 100%;
            height: 100%;
        }}
        .details-section {{
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }}
        .detail-row {{
            display: flex;
            margin-bottom: 4px;
            font-size: 9px;
        }}
        .detail-label {{
            font-weight: bold;
            color: #0c4a6e;
            width: 80px;
        }}
        .detail-value {{
            flex: 1;
            color: #333;
        }}
        .footer {{
            display: flex;
            justify-content: space-between;
            margin-top: 5px;
            padding-top: 5px;
            border-top: 1px solid #ddd;
        }}
        .signature-box {{
            text-align: center;
            font-size: 8px;
            color: #666;
        }}
        .signature-img {{
            max-width: 80px;
            max-height: 30px;
            margin-bottom: 2px;
        }}
        .instructions {{
            position: absolute;
            bottom: 5px;
            right: 5px;
            font-size: 7px;
            color: rgba(255,255,255,0.8);
        }}
    </style>
</head>
<body>
    <div class="id-card">
        <div class="watermark">SCRE</div>
        <div class="id-content">
            <div class="header">
                <div class="logo-left">SCRE</div>
                <div class="header-text">
                    <h1>SIR CHHOTU RAM EDUCATION</h1>
                    <h2>STUDENT IDENTITY CARD</h2>
                </div>
                <div class="logo-right">SCRE</div>
            </div>
            <div class="main-content">
                <div class="photo-section">
                    <div class="photo-box">
                        <img src="{photo_uri}" alt="Student Photo">
                    </div>
                    <div class="qr-box">
                        <img src="{qr_uri}" alt="QR Code">
                    </div>
                </div>
                <div class="details-section">
                    <div>
                        <div class="detail-row">
                            <span class="detail-label">Enrollment No:</span>
                            <span class="detail-value">{enrollment_no}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Center:</span>
                            <span class="detail-value">{center_name} ({center_code})</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Course:</span>
                            <span class="detail-value">{course}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Student Name:</span>
                            <span class="detail-value">{full_name}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Father's Name:</span>
                            <span class="detail-value">{father}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Address:</span>
                            <span class="detail-value">{address}</span>
                        </div>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Mobile:</span>
                        <span class="detail-value">{phone}</span>
                    </div>
                    <div class="footer">
                        <div class="signature-box">
                            {sig_html}
                            <div>Student Sign</div>
                        </div>
                        <div class="signature-box">
                            <div style="width: 80px; height: 30px; border: 1px dashed #ccc; margin-bottom: 2px;"></div>
                            <div>Authorized Sign</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="instructions">Valid till: {valid_till}</div>
        </div>
    </div>
</body>
</html>"#,
        photo_uri = photo_uri,
        qr_uri = qr_uri,
        enrollment_no = student.enrollment_number.as_deref().unwrap_or("N/A"),
        center_name = center_name,
        center_code = center_code,
        course = student.course.as_deref().unwrap_or("N/A"),
        full_name = student.full_name.as_deref().unwrap_or("N/A"),
        father = student.father_name.as_deref().unwrap_or("N/A"),
        address = student.address.as_deref().unwrap_or("N/A"),
        phone = student.phone.as_deref().unwrap_or("N/A"),
        sig_html = if !sig_uri.is_empty() {
            format!(
                r#"<img src="{}" class="signature-img" alt="Signature">"#,
                sig_uri
            )
        } else {
            "".to_string()
        },
        valid_till = student.session_end_date.as_deref().unwrap_or("N/A")
    )
}

fn get_image_data_uri(path_or_url: &str) -> String {
    if path_or_url.is_empty() {
        return "".to_string();
    }
    if path_or_url.starts_with("data:") {
        return path_or_url.to_string();
    }
    if path_or_url.starts_with("http") {
        return path_or_url.to_string();
    }

    let project_root = "/var/www/html/scre";
    let normalized = if path_or_url.starts_with('/') {
        path_or_url.to_string()
    } else {
        format!("/{}", path_or_url)
    };

    let possible_paths = vec![
        std::path::PathBuf::from(normalized.clone()),
        std::path::PathBuf::from(project_root).join(normalized.trim_start_matches('/')),
        std::path::PathBuf::from(project_root)
            .join("uploads")
            .join(normalized.trim_start_matches("/uploads/")),
    ];

    for path in possible_paths {
        if path.exists() && path.is_file() {
            if let Ok(bytes) = std::fs::read(&path) {
                let ext = path
                    .extension()
                    .and_then(|s| s.to_str())
                    .unwrap_or("png")
                    .to_lowercase();
                let mime = match ext.as_str() {
                    "jpg" | "jpeg" => "image/jpeg",
                    "png" => "image/png",
                    "webp" => "image/webp",
                    _ => "image/png",
                };
                return format!(
                    "data:{};base64,{}",
                    mime,
                    base64::engine::general_purpose::STANDARD.encode(bytes)
                );
            }
        }
    }
    path_or_url.to_string()
}

pub async fn generate_student_id_card_pdf(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, "Invalid student ID").into_response(),
    };

    let user_collection = db.collection::<User>("users");
    let student = match user_collection
        .find_one(doc! { "_id": oid }, None)
        .await
    {
        Ok(Some(s)) => s,
        _ => return (StatusCode::NOT_FOUND, "Student not found").into_response(),
    };

    // Access control
    if claims.role == UserRole::Center {
        let center_id = ObjectId::parse_str(&claims.sub).unwrap();
        if student.parent_id != Some(center_id) {
            return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
        }
    } else if claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
        && claims.role != UserRole::Student
    {
        return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
    }

    let center = if let Some(pid) = student.parent_id {
        db.collection::<Center>("centers")
            .find_one(doc! { "user_id": pid }, None)
            .await
            .ok()
            .flatten()
    } else {
        None
    };

    let html = generate_id_card_html(&student, center.as_ref());

    let temp_dir = std::env::temp_dir();
    let timestamp = Utc::now().timestamp();
    let name_slug = student
        .full_name
        .as_ref()
        .map(|n| n.replace(" ", "_"))
        .unwrap_or_else(|| "student".to_string());
    let pdf_filename = format!("id_card_{}_{}.pdf", name_slug, timestamp);
    let abs_pdf_path = temp_dir.join(&pdf_filename);
    let abs_html_path = temp_dir.join(format!("id_card_{}_{}.html", name_slug, timestamp));

    if let Err(e) = std::fs::write(&abs_html_path, &html) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to write HTML: {}", e),
        )
            .into_response();
    }

    let chromium_paths = [
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "msedge.exe",
        "chrome.exe",
        "msedge",
        "chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/snap/bin/chromium",
        "google-chrome-stable",
    ];

    let mut pdf_generated = false;
    let mut last_error = String::new();
    let input_url = format!("file://{}", abs_html_path.display());

    for path in chromium_paths {
        println!(
            "Attempting student ID card PDF generation with {} for URL {}",
            path, input_url
        );

        let output = std::process::Command::new(path)
            .args([
                "--headless=new",
                "--disable-gpu",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-extensions",
                "--allow-file-access-from-files",
                &format!("--print-to-pdf={}", abs_pdf_path.display()),
                &input_url,
            ])
            .output();

        match output {
            Ok(out) if out.status.success() => {
                if abs_pdf_path.exists() {
                    pdf_generated = true;
                    println!("Successfully generated student ID card PDF with {}", path);
                    break;
                } else {
                    last_error = format!(
                        "Chromium at {} reported success but PDF file not found at {}",
                        path,
                        abs_pdf_path.display()
                    );
                    eprintln!("{}", last_error);
                }
            }
            Ok(out) => {
                let err = String::from_utf8_lossy(&out.stderr);
                let stdout = String::from_utf8_lossy(&out.stdout);
                last_error = format!(
                    "Chromium at {} failed. Stderr: {}. Stdout: {}",
                    path, err, stdout
                );
                eprintln!("{}", last_error);
            }
            Err(e) => {
                last_error = format!("Failed to run chromium at {}: {}", path, e);
                eprintln!("{}", last_error);
            }
        }
    }

    if pdf_generated {
        if let Ok(pdf_bytes) = std::fs::read(&abs_pdf_path) {
            let _ = std::fs::remove_file(abs_html_path);
            let _ = std::fs::remove_file(abs_pdf_path);
            (
                StatusCode::OK,
                [
                    (axum::http::header::CONTENT_TYPE, "application/pdf"),
                    (
                        axum::http::header::CONTENT_DISPOSITION,
                        &format!("attachment; filename=\"{}\"", pdf_filename),
                    ),
                ],
                pdf_bytes,
            )
                .into_response()
        } else {
            (
                StatusCode::OK,
                [
                    (axum::http::header::CONTENT_TYPE, "text/html; charset=utf-8"),
                    (
                        axum::http::header::CONTENT_DISPOSITION,
                        "inline; filename=\"id-card.html\"",
                    ),
                ],
                html.into_bytes(),
            )
                .into_response()
        }
    } else {
        (
            StatusCode::OK,
            [
                (axum::http::header::CONTENT_TYPE, "text/html; charset=utf-8"),
                (
                    axum::http::header::CONTENT_DISPOSITION,
                    "inline; filename=\"id-card.html\"",
                ),
            ],
            html.into_bytes(),
        )
            .into_response()
    }
}

#[derive(Debug, serde::Deserialize)]
pub struct VerifyStudentQuery {
    pub query: String,
    pub dob: Option<String>,
}

pub async fn public_verify_student(
    State(db): State<Database>,
    axum::extract::Query(params): axum::extract::Query<VerifyStudentQuery>,
) -> (StatusCode, Json<serde_json::Value>) {
    let clean = params.query.trim().to_string();
    if clean.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "success": false,
                "message": "Please enter an Enrollment Number, Roll Number, or Username"
            })),
        );
    }

    let upper = clean.to_uppercase();
    let lower = clean.to_lowercase();

    let or_clauses = vec![
        doc! { "enrollment_number": &clean },
        doc! { "enrollment_number": &upper },
        doc! { "enrollment_number": &lower },
        doc! { "roll_number": &clean },
        doc! { "roll_number": &upper },
        doc! { "roll_number": &lower },
        doc! { "username": &clean },
        doc! { "username": &lower },
    ];

    let mut filter = doc! {
        "role": "student",
        "$or": or_clauses
    };

    if let Some(dob_str) = params.dob {
        let clean_dob = dob_str.trim();
        if !clean_dob.is_empty() {
            filter.insert("dob", clean_dob);
        }
    }

    let users_coll = db.collection::<User>("users");
    match users_coll.find_one(filter, None).await {
        Ok(Some(student)) => {
            let mut center_name = None;
            if let Some(parent_oid) = student.parent_id {
                let centers_coll = db.collection::<mongodb::bson::Document>("centers");
                if let Ok(Some(center_doc)) = centers_coll.find_one(doc! { "$or": [{ "_id": parent_oid }, { "user_id": parent_oid }] }, None).await {
                    center_name = center_doc.get_str("name").ok().map(|s| s.to_string());
                }
            }

            let full_name = student.full_name.clone().unwrap_or_else(|| {
                let f = student.first_name.clone().unwrap_or_default();
                let l = student.last_name.clone().unwrap_or_default();
                let joined = format!("{} {}", f, l).trim().to_string();
                if joined.is_empty() { student.username.clone() } else { joined }
            });

            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "success": true,
                    "student": {
                        "full_name": full_name,
                        "enrollment_number": student.enrollment_number,
                        "roll_number": student.roll_number,
                        "father_name": student.father_name,
                        "course": student.course,
                        "center_name": center_name,
                        "photo_url": student.photo_url,
                        "dob": student.dob,
                        "registration_date": student.registration_date,
                        "created_at": student.created_at,
                        "status": "Verified Active Student"
                    }
                })),
            )
        },
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "success": false,
                "message": "No student record found matching the provided credentials"
            })),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "success": false,
                "message": format!("Database error: {}", e)
            })),
        ),
    }
}
