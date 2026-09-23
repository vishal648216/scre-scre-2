use axum::{
    extract::{State, Path},
    http::StatusCode,
    Json,
};
use mongodb::{Database, bson::{doc, oid::ObjectId}};
use serde::Serialize;
use chrono::Utc;
use crate::models::user::{User, UserRole, Claims};
use crate::models::certificate::Certificate;
use crate::models::center_assets::CenterAssets;

#[derive(Debug, Serialize)]
pub struct ApproveResponse {
    pub success: bool,
    pub message: String,
}

fn gen_cert_no() -> String {
    let ts = Utc::now().timestamp();
    format!("SCR-{}", ts)
}

pub async fn approve_student(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<ApproveResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(ApproveResponse { success: false, message: "Unauthorized".to_string() }));
    }
    let users = db.collection::<User>("users");
    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(ApproveResponse { success: false, message: "Invalid ID".to_string() })),
    };
    let user = match users.find_one(doc! { "_id": &oid, "role": "student" }, None).await {
        Ok(Some(u)) => u,
        _ => return (StatusCode::NOT_FOUND, Json(ApproveResponse { success: false, message: "Student not found".to_string() })),
    };
    let _ = users.update_one(doc! { "_id": &oid }, doc! { "$set": { "approval_status": "approved" } }, None).await;

    let center_id = user.parent_id.unwrap_or(ObjectId::parse_str(&claims.sub).unwrap());
    let assets_coll = db.collection::<CenterAssets>("center_assets");
    let assets: Option<CenterAssets> = assets_coll.find_one(doc! { "center_id": &center_id }, None).await.ok().flatten();

    let certs = db.collection::<Certificate>("certificates");
    let cert = Certificate {
        id: None,
        student_id: oid,
        center_id,
        course: user.course.clone().unwrap_or_else(|| "".to_string()),
        course_id: None,
        certificate_no: gen_cert_no(),
        center_name: assets.as_ref().and_then(|a| a.center_name.clone()),
        center_signature_url: None,
        center_stamp_url: None,
        admin_signature_url: None,
        admin_stamp_url: None,
        signature_url: None,
        stamp_url: None,
        background_url: assets.as_ref().and_then(|a| a.background_url.clone()),
        issued_on: Utc::now(),
        status: Some("draft".to_string()),
        template_id: None,
        verification_url: None,
        pdf_url: None,
        file_path: None,
        scheduled_at: None,
        certificate_type: crate::models::certificate::CertificateType::Certificate,
        attempt_number: Some(1),
    };
    let _ = certs.insert_one(cert, None).await;

    (StatusCode::OK, Json(ApproveResponse { success: true, message: "Student approved and certificate issued".to_string() }))
}

pub async fn reject_student(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<ApproveResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(ApproveResponse { success: false, message: "Unauthorized".to_string() }));
    }
    let users = db.collection::<User>("users");
    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(ApproveResponse { success: false, message: "Invalid ID".to_string() })),
    };
    let _ = users.update_one(doc! { "_id": &oid, "role": "student" }, doc! { "$set": { "approval_status": "rejected" } }, None).await;
    (StatusCode::OK, Json(ApproveResponse { success: true, message: "Student rejected".to_string() }))
}

pub async fn toggle_student_active(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<ApproveResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin && claims.role != UserRole::Center {
        return (StatusCode::FORBIDDEN, Json(ApproveResponse { success: false, message: "Unauthorized".to_string() }));
    }
    let users = db.collection::<User>("users");
    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(ApproveResponse { success: false, message: "Invalid ID".to_string() })),
    };

    let user = match users.find_one(doc! { "_id": &oid, "role": "student" }, None).await {
        Ok(Some(u)) => u,
        _ => return (StatusCode::NOT_FOUND, Json(ApproveResponse { success: false, message: "Student not found".to_string() })),
    };

    // Centers can only toggle their own students
    if claims.role == UserRole::Center {
        let center_id = ObjectId::parse_str(&claims.sub).unwrap();
        if user.parent_id != Some(center_id) {
            return (StatusCode::FORBIDDEN, Json(ApproveResponse { success: false, message: "Access denied".to_string() }));
        }
    }

    let new_status = !user.active;
    let _ = users.update_one(doc! { "_id": &oid }, doc! { "$set": { "active": new_status } }, None).await;

    (StatusCode::OK, Json(ApproveResponse { 
        success: true, 
        message: if new_status { "Student activated".to_string() } else { "Student deactivated".to_string() }
    }))
}
