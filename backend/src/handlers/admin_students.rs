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

#[derive(Debug, serde::Deserialize, Default)]
pub struct ApprovePayload {
    pub instructions: Option<String>,
    pub student_id: Option<String>,
}

pub async fn approve_student(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<ApprovePayload>,
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

    let custom_inst = payload.instructions.clone();

    let mut update_doc = doc! {
        "approval_status": "accepted",
        "status": "active",
        "active": true,
        "updated_at": Utc::now()
    };

    if let Some(inst) = custom_inst {
        if !inst.trim().is_empty() {
            update_doc.insert("admin_instructions", inst);
        }
    }

    let center_id = if let Some(pid) = user.parent_id {
        pid
    } else if claims.role == UserRole::Center {
        if let Ok(cid) = ObjectId::parse_str(&claims.sub) {
            update_doc.insert("parent_id", cid);
            cid
        } else {
            oid
        }
    } else {
        if let Some(ref pc) = user.priority_centers {
            if let Some(first_c) = pc.first() {
                if let Ok(cid) = ObjectId::parse_str(first_c) {
                    update_doc.insert("parent_id", cid);
                    cid
                } else {
                    oid
                }
            } else {
                oid
            }
        } else {
            oid
        }
    };

    let _ = users.update_one(doc! { "_id": &oid }, doc! { "$set": update_doc }, None).await;

    let certs = db.collection::<Certificate>("certificates");
    let existing_cert = certs.find_one(doc! { "student_id": oid }, None).await.ok().flatten();
    if existing_cert.is_none() {
        let assets_coll = db.collection::<CenterAssets>("center_assets");
        let assets: Option<CenterAssets> = assets_coll.find_one(doc! { "center_id": &center_id }, None).await.ok().flatten();
        let cert = Certificate {
            id: None,
            student_id: oid,
            center_id,
            course: user.course.clone().unwrap_or_else(|| "".to_string()),
            course_id: user.course_id,
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
    }

    (StatusCode::OK, Json(ApproveResponse { success: true, message: "Student approved and assigned to center successfully".to_string() }))
}

pub async fn reject_student(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<ApprovePayload>,
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

    let custom_inst = payload.instructions.clone().unwrap_or_default();
    let cur_p = user.current_priority.unwrap_or(1) as usize;
    let priorities = user.priority_centers.clone().unwrap_or_default();

    if priorities.len() > cur_p {
        let next_center_str = &priorities[cur_p];
        let next_p_num = (cur_p + 1) as i32;
        let mut update_doc = doc! {
            "current_priority": next_p_num,
            "approval_status": "pending",
            "status": "pending",
            "updated_at": Utc::now()
        };

        if let Ok(next_cid) = ObjectId::parse_str(next_center_str) {
            update_doc.insert("parent_id", next_cid);
        }

        let inst_msg = if !custom_inst.trim().is_empty() {
            format!("Rejected at Priority {} center. Shifted to Priority {}. Note: {}", cur_p, next_p_num, custom_inst)
        } else {
            format!("Rejected at Priority {} center. Shifted to Priority {} center.", cur_p, next_p_num)
        };
        update_doc.insert("admin_instructions", inst_msg);

        let _ = users.update_one(doc! { "_id": &oid }, doc! { "$set": update_doc }, None).await;

        (StatusCode::OK, Json(ApproveResponse {
            success: true,
            message: format!("Rejected by current center. Shifted request to Priority {} center.", next_p_num)
        }))
    } else {
        let mut update_doc = doc! {
            "approval_status": "rejected",
            "status": "rejected",
            "active": false,
            "updated_at": Utc::now()
        };
        if !custom_inst.trim().is_empty() {
            update_doc.insert("admin_instructions", custom_inst);
        }

        let _ = users.update_one(doc! { "_id": &oid }, doc! { "$set": update_doc }, None).await;

        (StatusCode::OK, Json(ApproveResponse { success: true, message: "Student request rejected".to_string() }))
    }
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
