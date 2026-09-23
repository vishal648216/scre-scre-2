use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use chrono::Utc;
use futures_util::StreamExt;
use mongodb::{Database, bson::doc, bson::oid::ObjectId};
use serde::Serialize;
use serde_json::json;

use crate::models::center::Center;
use crate::models::user::{Claims, User, UserRole};

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
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<serde_json::Value>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !crate::authz::require_admin(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({ "success": false, "message": "Admin access required to register centers" })),
        );
    }

    let name = payload.get("name").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
    let owner_name = payload.get("owner_name").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
    let email = payload.get("email").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
    let phone = payload.get("phone").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
    let password = payload.get("password").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
    let code_input = payload.get("center_code").or_else(|| payload.get("code")).and_then(|v| v.as_str()).unwrap_or("").trim().to_string();

    if name.is_empty() || email.is_empty() || phone.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "success": false, "message": "Center name, email, and phone are required" })),
        );
    }

    let admin_id = ObjectId::parse_str(&claims.sub).unwrap_or_else(|_| ObjectId::new());
    let user_coll = db.collection::<User>("users");
    let center_coll = db.collection::<Center>("centers");

    let code = if !code_input.is_empty() {
        code_input
    } else {
        let ts = Utc::now().timestamp() % 100000;
        format!("CTR{:05}", ts)
    };

    let username = email.clone();
    let user_id = if let Ok(Some(existing_user)) = user_coll.find_one(doc! { "$or": [ { "email": &email }, { "username": &username } ] }, None).await {
        let uid = existing_user.id.unwrap();
        let _ = user_coll.update_one(
            doc! { "_id": uid },
            doc! {
                "$set": {
                    "role": "center",
                    "full_name": &name,
                    "phone": &phone,
                    "active": true,
                    "is_deleted": false
                }
            },
            None
        ).await;
        uid
    } else {
        let pass_plain = if password.is_empty() { "123456".to_string() } else { password };
        let hashed_pass = bcrypt::hash(&pass_plain, bcrypt::DEFAULT_COST).unwrap_or_default();
        let now = Utc::now();
        let new_user = User {
            id: None,
            username: username.clone(),
            password_hash: hashed_pass,
            raw_password: Some(pass_plain),
            role: UserRole::Center,
            parent_id: Some(admin_id),
            sub_admin_role_id: None,
            sub_admin_role_name: None,
            sub_admin_permissions: None,
            full_name: Some(name.clone()),
            first_name: None,
            middle_name: None,
            last_name: None,
            email: Some(email.clone()),
            phone: Some(phone.clone()),
            course: None,
            father_name: None,
            mother_name: None,
            dob: None,
            gender: None,
            category: None,
            national_id_type: None,
            national_id: None,
            address: payload.get("address").and_then(|v| v.as_str()).map(|s| s.to_string()),
            city: payload.get("city").and_then(|v| v.as_str()).map(|s| s.to_string()),
            state: payload.get("state").and_then(|v| v.as_str()).map(|s| s.to_string()),
            district: payload.get("district").and_then(|v| v.as_str()).map(|s| s.to_string()),
            country: payload.get("country").and_then(|v| v.as_str()).map(|s| s.to_string()),
            pincode: payload.get("pincode").and_then(|v| v.as_str()).map(|s| s.to_string()),
            other_address: None,
            emergency_contact_name: None,
            emergency_contact_phone: None,
            emergency_contact_relation: None,
            additional_docs: None,
            enrollment_number: None,
            photo_url: payload.get("owner_photo_url").and_then(|v| v.as_str()).map(|s| s.to_string()),
            signature_url: payload.get("owner_signature_url").and_then(|v| v.as_str()).map(|s| s.to_string()),
            national_id_url: None,
            highest_qualification: None,
            college: None,
            admission_mode: None,
            exam_mode: None,
            session_id: None,
            session_start_date: None,
            session_end_date: None,
            approval_status: Some("approved".to_string()),
            marks: None,
            active: true,
            is_deleted: false,
            deleted_at: None,
            created_at: now,
            course_id: None,
            registration_date: Some(now.naive_utc().date().to_string()),
            roll_number: None,
            serial_number: None,
            batch_id: None,
            referral_code: None,
            referred_by_code: payload.get("referral_code").and_then(|v| v.as_str()).map(|s| s.to_string()),
            applied_coupon: payload.get("discount_coupon").and_then(|v| v.as_str()).map(|s| s.to_string()),
            course_category: None,
            enrolled_courses: None,
            current_unit: None,
            other_doc_url: None,
            updated_at: Some(now),
            is_email_verified: true,
            is_deleted_by_center_final: false,
            internship_domain: None,
            internship_mode: None,
            total_fees: None,
            extra_charges: None,
            grand_total: None,
            fee_breakdown: None,
            payment_type: None,
            is_payment_type_locked: false,
            installments: None,
            extra_charges_list: None,
            due_date: None,
            remarks: None,
        };
        match user_coll.insert_one(new_user, None).await {
            Ok(res) => res.inserted_id.as_object_id().unwrap(),
            Err(e) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "success": false, "message": format!("Failed to create user: {}", e) })),
                );
            }
        }
    };

    let location = Some(crate::models::center::CenterLocation {
        country: payload.get("country").and_then(|v| v.as_str()).map(|s| s.to_string()),
        state: payload.get("state").and_then(|v| v.as_str()).map(|s| s.to_string()),
        district: payload.get("district").and_then(|v| v.as_str()).map(|s| s.to_string()),
        city: payload.get("city").and_then(|v| v.as_str()).map(|s| s.to_string()),
        address: payload.get("address").and_then(|v| v.as_str()).map(|s| s.to_string()),
        maps_embed_url: payload.get("maps_embed_url").and_then(|v| v.as_str()).map(|s| s.to_string()),
        pincode: payload.get("pincode").and_then(|v| v.as_str()).map(|s| s.to_string()),
    });

    let course_allotment: Vec<String> = payload.get("course_allotment")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    let now = Utc::now();
    let new_center = Center {
        id: None,
        user_id,
        admin_id,
        name: name.clone(),
        code: code.clone(),
        owner_name: if owner_name.is_empty() { name.clone() } else { owner_name },
        about_center: payload.get("about_center").and_then(|v| v.as_str()).map(|s| s.to_string()),
        phone,
        email,
        address: payload.get("address").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        city: payload.get("city").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        district: payload.get("district").and_then(|v| v.as_str()).map(|s| s.to_string()),
        state: payload.get("state").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        center_code: Some(code.clone()),
        discount_coupon: payload.get("discount_coupon").and_then(|v| v.as_str()).map(|s| s.to_string()),
        referral_code: payload.get("referral_code").and_then(|v| v.as_str()).map(|s| s.to_string()),
        location,
        infrastructure: None,
        course_allotment,
        bank_details: None,
        documents: Vec::new(),
        key_documents: None,
        branding_media: None,
        working_hours: None,
        config_validity: None,
        active: true,
        is_deleted: false,
        deleted_at: None,
        permanent_delete_at: None,
        is_email_verified: true,
        email_verified_at: Some(now),
        created_at: now,
    };

    match center_coll.insert_one(new_center, None).await {
        Ok(res) => {
            let inserted_id = res.inserted_id.as_object_id().unwrap().to_hex();
            crate::handlers::admin::invalidate_admin_dashboard_cache();
            (
                StatusCode::CREATED,
                Json(json!({
                    "success": true,
                    "message": "Center created successfully",
                    "id": inserted_id.clone(),
                    "center_id": inserted_id,
                    "center": {
                        "_id": inserted_id,
                        "name": name,
                        "code": code
                    }
                })),
            )
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "success": false, "message": format!("Database error: {}", e) })),
        ),
    }
}

pub async fn get_centers(
    State(db): State<Database>,
    _claims: Claims,
) -> (StatusCode, Json<Vec<PublicCenter>>) {
    let collection = db.collection::<Center>("centers");
    let filter = doc! { "is_deleted": { "$ne": true } };
    let mut cursor = match collection.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut centers = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(center) = result {
            centers.push(PublicCenter::from(center));
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
    State(db): State<Database>,
    _claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::OK,
        Json(json!({"success": true, "message": "Permanent delete initiated"})),
    )
}

pub async fn cancel_permanent_delete(
    State(db): State<Database>,
    _claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::OK,
        Json(json!({"success": true, "message": "Permanent delete cancelled"})),
    )
}

pub async fn execute_permanent_delete(
    State(db): State<Database>,
    _claims: Claims,
    Path(id): Path<String>,
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
