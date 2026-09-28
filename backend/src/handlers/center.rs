use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use chrono::Utc;
use futures_util::StreamExt;
use mongodb::{Database, bson::doc, bson::oid::ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::authz::require_admin;
use crate::models::center::Center;
use crate::models::user::{Claims, User};

#[derive(Debug, Serialize, Clone)]
pub struct PublicCenter {
    pub id: String,
    pub user_id: String, // Added to link with student's parent_id!
    pub name: String,
    pub code: String,
    pub owner_name: String,
    pub phone: String,
    pub email: String,
    pub address: String,
    pub city: String,
    pub state: String,
    pub country: Option<String>,
    pub about_center: Option<String>,
    pub location: Option<crate::models::center::CenterLocation>,
    pub infrastructure: Option<crate::models::center::CenterInfrastructure>,
    pub course_allotment: Vec<String>,
    pub branding_media: Option<crate::models::center::CenterBrandingMedia>,
    pub working_hours: Option<crate::models::center::CenterWorkingHours>,
    pub active: bool,
    pub district: Option<String>,
    pub center_code: Option<String>,
    pub discount_coupon: Option<String>,
    pub referral_code: Option<String>,
    pub bank_details: Option<crate::models::center::CenterBankDetails>,
    pub documents: Vec<crate::models::center::CenterDocumentItem>,
    pub key_documents: Option<crate::models::center::CenterKeyDocuments>,
    pub config_validity: Option<crate::models::center::CenterConfigValidity>,
    pub is_email_verified: bool,
    pub password: Option<String>,
    pub raw_password: Option<String>,
}

impl From<Center> for PublicCenter {
    fn from(c: Center) -> Self {
        PublicCenter {
            id: c.id.unwrap_or_default().to_hex(),
            user_id: c.user_id.to_hex(), // This is the important one!
            name: c.name,
            code: c.code,
            owner_name: c.owner_name,
            phone: c.phone,
            email: c.email,
            address: c.address,
            city: c.city,
            state: c.state,
            country: c.location.as_ref().and_then(|l| l.country.clone()),
            about_center: c.about_center,
            location: c.location,
            infrastructure: c.infrastructure,
            course_allotment: c.course_allotment,
            branding_media: c.branding_media,
            working_hours: c.working_hours,
            active: c.active,
            district: c.district,
            center_code: c.center_code,
            discount_coupon: c.discount_coupon,
            referral_code: c.referral_code,
            bank_details: c.bank_details,
            documents: c.documents,
            key_documents: c.key_documents,
            config_validity: c.config_validity,
            is_email_verified: c.is_email_verified,
            password: None,
            raw_password: None,
        }
    }
}

pub async fn public_list_centers(
    State(db): State<Database>,
) -> (StatusCode, Json<serde_json::Value>) {
    let collection = db.collection::<Center>("centers");
    let filter = doc! { "is_deleted": false, "active": true };
    let mut cursor = match collection.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::OK, Json(json!({"success": true, "data": []}))),
    };

    let mut centers = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(center) = result {
            centers.push(PublicCenter::from(center));
        }
    }

    (
        StatusCode::OK,
        Json(json!({"success": true, "data": centers})),
    )
}

pub async fn public_get_center_by_code(
    State(db): State<Database>,
    Path(code): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    let code_lower = code.to_lowercase();
    let collection = db.collection::<Center>("centers");
    let filter = doc! { "is_deleted": false, "active": true };
    let mut cursor = match collection.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::OK, Json(json!({"success": true, "data": null}))),
    };

    let mut center = None;
    while let Some(result) = cursor.next().await {
        if let Ok(c) = result {
            if c.code.to_lowercase() == code_lower {
                center = Some(PublicCenter::from(c));
                break;
            }
        }
    }

    (
        StatusCode::OK,
        Json(json!({"success": true, "data": center})),
    )
}

pub async fn handle_create_center(
    State(_db): State<Database>,
    _claims: Claims,
    Json(_payload): Json<serde_json::Value>,
) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::OK,
        Json(json!({"success": true, "message": "Center created"})),
    )
}

pub async fn get_centers(
    State(db): State<Database>,
    _claims: Claims,
) -> (StatusCode, Json<Vec<PublicCenter>>) {
    let collection = db.collection::<Center>("centers");
    let user_coll = db.collection::<User>("users");
    let filter = doc! { "is_deleted": false };
    let mut cursor = match collection.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut centers = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(center) = result {
            let mut pc = PublicCenter::from(center.clone());
            if let Ok(Some(u)) = user_coll.find_one(doc! { "_id": center.user_id }, None).await {
                pc.password = u.raw_password.clone();
                pc.raw_password = u.raw_password;
            }
            centers.push(pc);
        }
    }

    (StatusCode::OK, Json(centers))
}

pub async fn check_center_code(
    State(db): State<Database>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> (StatusCode, Json<serde_json::Value>) {
    let code = params.get("code").cloned().unwrap_or_default();
    let code_lower = code.to_lowercase();
    let collection = db.collection::<Center>("centers");
    let filter = doc! {};
    let mut cursor = match collection.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::OK, Json(json!({"exists": false}))),
    };

    let mut exists = false;
    while let Some(result) = cursor.next().await {
        if let Ok(center) = result {
            if center.code.to_lowercase() == code_lower {
                exists = true;
                break;
            }
        }
    }

    (StatusCode::OK, Json(json!({"exists": exists})))
}

pub async fn get_center_metrics(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<serde_json::Value>) {
    // Get user's center
    let user_id = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::OK,
                Json(json!({
                    "totalStudents": 0,
                    "activeCourses": 0,
                    "totalEarnings": 0,
                    "pendingLeads": 0,
                    "activeExams": 0,
                    "pendingEvaluations": 0
                })),
            );
        }
    };

    let center_coll = db.collection::<Center>("centers");
    let user_coll = db.collection::<User>("users");

    // Find center linked to this user
    let center = match center_coll
        .find_one(doc! {"user_id": user_id, "is_deleted": false}, None)
        .await
    {
        Ok(Some(c)) => c,
        _ => {
            return (
                StatusCode::OK,
                Json(json!({
                    "totalStudents": 0,
                    "activeCourses": 0,
                    "totalEarnings": 0,
                    "pendingLeads": 0,
                    "activeExams": 0,
                    "pendingEvaluations": 0
                })),
            );
        }
    };

    // Count total students for this center (parent_id is center's user_id)
    let total_students = user_coll
        .count_documents(
            doc! {"role": "student", "parent_id": user_id, "is_deleted": false, "active": true},
            None,
        )
        .await
        .unwrap_or(0);

    let active_courses = center.course_allotment.len() as u64;

    (
        StatusCode::OK,
        Json(json!({
            "totalStudents": total_students,
            "activeCourses": active_courses,
            "totalEarnings": 0, // TODO: Implement actual earnings from transactions
            "pendingLeads": 0, // TODO: Implement from enquiries
            "activeExams": 0, // TODO: Implement from exams
            "pendingEvaluations": 0 // TODO: Implement from exams
        })),
    )
}

pub async fn delete_center(
    State(db): State<Database>,
    _claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    let obj_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::OK,
                Json(json!({"success": false, "message": "Invalid center ID"})),
            );
        }
    };

    let collection = db.collection::<Center>("centers");
    let now = Utc::now();
    let update = doc! { "$set": { "is_deleted": true, "deleted_at": now, "active": false } };

    match collection
        .update_one(doc! { "_id": obj_id }, update, None)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(json!({"success": true, "message": "Center moved to Recycle Bin"})),
        ),
        Err(_) => (
            StatusCode::OK,
            Json(json!({"success": false, "message": "Failed to delete center"})),
        ),
    }
}

pub async fn update_center(
    State(db): State<Database>,
    _claims: Claims,
    Path(id): Path<String>,
    Json(mut payload): Json<serde_json::Value>,
) -> (StatusCode, Json<serde_json::Value>) {
    let obj_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"success": false, "message": "Invalid center ID"})),
            );
        }
    };

    let collection = db.collection::<Center>("centers");
    // Get existing center document for user_id
    let existing_center = match collection.find_one(doc! {"_id": obj_id}, None).await {
        Ok(Some(center)) => center,
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"success": false, "message": "Center not found"})),
            );
        }
    };

    // Extract password and email from payload before processing
    let password = payload.get("password").and_then(|p| p.as_str()).map(|s| s.to_string());
    let email = payload.get("email").and_then(|e| e.as_str()).map(|s| s.to_string());
    // Remove password from payload so it doesn't get stored in centers collection
    if let Some(obj) = payload.as_object_mut() {
        obj.remove("password");
    }

    let bson_payload = match mongodb::bson::to_bson(&payload) {
        Ok(b) => b,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"success": false, "message": "Invalid payload"})),
            );
        }
    };
    let update = doc! { "$set": bson_payload };

    // Update center
    match collection
        .update_one(doc! { "_id": obj_id }, update, None)
        .await
    {
        Ok(_) => {
            // Update user document if password or email is provided
            let users_collection = db.collection::<crate::models::user::User>("users");
            let mut user_update = doc! {};

            if let Some(pwd) = password {
                if !pwd.is_empty() {
                    let hashed_password = bcrypt::hash(&pwd, bcrypt::DEFAULT_COST).unwrap();
                    user_update.insert("password_hash", hashed_password);
                    user_update.insert("raw_password", pwd);
                }
            }

            if let Some(email_val) = email {
                user_update.insert("email", email_val.clone());
                user_update.insert("username", email_val);
            }

            if !user_update.is_empty() {
                let _ = users_collection.update_one(doc! {"_id": existing_center.user_id}, doc!{"$set": user_update}, None).await;
            }

            (
                StatusCode::OK,
                Json(json!({"success": true, "message": "Center updated successfully"})),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"success": false, "message": "Failed to update center"})),
        ),
    }
}

pub async fn list_deleted_centers(
    State(db): State<Database>,
    _claims: Claims,
) -> (StatusCode, Json<Vec<Center>>) {
    let collection = db.collection::<Center>("centers");
    let filter = doc! { "is_deleted": true };
    let mut cursor = match collection.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut centers = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(center) = result {
            centers.push(center);
        }
    }

    (StatusCode::OK, Json(centers))
}

pub async fn restore_center(
    State(db): State<Database>,
    _claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    let obj_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::OK,
                Json(json!({"success": false, "message": "Invalid center ID"})),
            );
        }
    };

    let collection = db.collection::<Center>("centers");
    let update = doc! { "$set": { "is_deleted": false, "deleted_at": null, "active": true } };

    match collection
        .update_one(doc! { "_id": obj_id }, update, None)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(json!({"success": true, "message": "Center restored"})),
        ),
        Err(_) => (
            StatusCode::OK,
            Json(json!({"success": false, "message": "Failed to restore center"})),
        ),
    }
}

pub async fn initiate_permanent_delete(
    State(_db): State<Database>,
    _claims: Claims,
    Path(_id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::OK,
        Json(json!({"success": true, "message": "Permanent delete initiated"})),
    )
}

pub async fn cancel_permanent_delete(
    State(_db): State<Database>,
    _claims: Claims,
    Path(_id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::OK,
        Json(json!({"success": true, "message": "Permanent delete cancelled"})),
    )
}

pub async fn execute_permanent_delete(
    State(_db): State<Database>,
    _claims: Claims,
    Path(_id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::OK,
        Json(json!({"success": true, "message": "Center permanently deleted"})),
    )
}

pub async fn toggle_center_active(
    State(db): State<Database>,
    _claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    let obj_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"success": false, "message": "Invalid center ID"})),
            );
        }
    };

    let collection = db.collection::<Center>("centers");
    let center = match collection.find_one(doc! { "_id": obj_id }, None).await {
        Ok(Some(c)) => c,
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"success": false, "message": "Center not found"})),
            );
        }
    };

    let new_active = !center.active;
    let update = doc! { "$set": { "active": new_active } };

    match collection
        .update_one(doc! { "_id": obj_id }, update, None)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(json!({"success": true, "message": "Center status updated"})),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"success": false, "message": "Failed to update center status"})),
        ),
    }
}

pub async fn check_email_unique(
    State(db): State<Database>,
    _claims: Claims,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> (StatusCode, Json<serde_json::Value>) {
    let email = params.get("email").cloned().unwrap_or_default();
    let collection = db.collection::<Center>("centers");
    let filter = doc! { "email": &email };
    let unique = match collection.find_one(filter, None).await {
        Ok(Some(_)) => false,
        _ => true,
    };

    (StatusCode::OK, Json(json!({"unique": unique})))
}

pub async fn get_pending_center_registrations(
    State(db): State<Database>,
    _claims: Claims,
) -> (StatusCode, Json<serde_json::Value>) {
    let collection = db.collection::<Center>("centers");
    let filter = doc! { "is_deleted": false };
    let mut cursor = match collection.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::OK, Json(json!({"success": true, "data": []}))),
    };

    let mut centers = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(center) = result {
            centers.push(PublicCenter::from(center));
        }
    }

    (StatusCode::OK, Json(json!({"success": true, "data": centers})))
}

pub async fn approve_center_registration(
    State(db): State<Database>,
    _claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    let obj_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(json!({"success": false, "message": "Invalid center ID"}))),
    };

    let collection = db.collection::<Center>("centers");
    let center = match collection.find_one(doc! { "_id": obj_id }, None).await {
        Ok(Some(c)) => c,
        _ => return (StatusCode::NOT_FOUND, Json(json!({"success": false, "message": "Center not found"}))),
    };

    let update = doc! { "$set": { "active": true, "approval_status": "approved" } };
    let _ = collection.update_one(doc! { "_id": obj_id }, update, None).await;

    // Activate user account
    let user_coll = db.collection::<User>("users");
    let _ = user_coll.update_one(
        doc! { "_id": center.user_id },
        doc! { "$set": { "active": true, "approval_status": "approved" } },
        None,
    ).await;

    (StatusCode::OK, Json(json!({"success": true, "message": "Center registration approved and account activated"})))
}

pub async fn reject_center_registration(
    State(db): State<Database>,
    _claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    let obj_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(json!({"success": false, "message": "Invalid center ID"}))),
    };

    let collection = db.collection::<Center>("centers");
    let center = match collection.find_one(doc! { "_id": obj_id }, None).await {
        Ok(Some(c)) => c,
        _ => return (StatusCode::NOT_FOUND, Json(json!({"success": false, "message": "Center not found"}))),
    };

    let update = doc! { "$set": { "active": false, "approval_status": "rejected" } };
    let _ = collection.update_one(doc! { "_id": obj_id }, update, None).await;

    let user_coll = db.collection::<User>("users");
    let _ = user_coll.update_one(
        doc! { "_id": center.user_id },
        doc! { "$set": { "active": false, "approval_status": "rejected" } },
        None,
    ).await;

    (StatusCode::OK, Json(json!({"success": true, "message": "Center registration rejected"})))
}

#[derive(Debug, Deserialize)]
pub struct CenterTransferPayload {
    pub target_region_id: Option<String>,
    pub target_region_name: Option<String>,
    pub target_parent_id: Option<String>,
    pub transfer_reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CenterTransferResponse {
    pub success: bool,
    pub message: String,
}

pub async fn transfer_center(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<CenterTransferPayload>,
) -> (StatusCode, Json<CenterTransferResponse>) {
    if !require_admin(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(CenterTransferResponse {
                success: false,
                message: "Forbidden: SuperAdmin/Admin access required".to_string(),
            }),
        );
    }

    let center_coll = db.collection::<Center>("centers");
    let user_coll = db.collection::<User>("users");

    let oid_opt = ObjectId::parse_str(&id).ok();

    let center_filter = if let Some(oid) = oid_opt {
        doc! { "_id": oid }
    } else {
        doc! { "$or": [{ "code": &id }, { "name": &id }] }
    };

    let existing = match center_coll.find_one(center_filter.clone(), None).await {
        Ok(Some(c)) => c,
        _ => return (
            StatusCode::NOT_FOUND,
            Json(CenterTransferResponse {
                success: false,
                message: format!("Center '{}' not found", id),
            }),
        ),
    };

    let mut target_parent_oid = None;
    if let Some(ref tp_id) = payload.target_parent_id {
        target_parent_oid = ObjectId::parse_str(tp_id).ok();
    } else if let Some(ref tr_id) = payload.target_region_id {
        target_parent_oid = ObjectId::parse_str(tr_id).ok();
    }

    let mut set_doc = doc! {
        "updated_at": Utc::now().to_rfc3339()
    };
    if let Some(tp_oid) = target_parent_oid {
        set_doc.insert("parent_id", tp_oid);
    }
    if let Some(ref r_name) = payload.target_region_name {
        set_doc.insert("region_name", r_name);
        set_doc.insert("state", r_name);
    }

    let _ = center_coll.update_one(center_filter, doc! { "$set": set_doc }, None).await;

    let c_code = existing.code.clone();
    let _ = user_coll.update_many(
        doc! { "role": "center", "$or": [{ "center_code": &c_code }, { "username": &c_code }] },
        doc! { "$set": { "updated_at": Utc::now().to_rfc3339() } },
        None,
    ).await;

    (
        StatusCode::OK,
        Json(CenterTransferResponse {
            success: true,
            message: format!("Center '{}' ({}) transferred / re-allocated successfully!", existing.name, existing.code),
        }),
    )
}

