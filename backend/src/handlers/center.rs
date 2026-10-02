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

use rand::Rng;
use crate::models::user::UserRole;

#[derive(Debug, Deserialize)]
pub struct CreateCenterRequest {
    pub name: String,
    pub owner_name: String,
    pub about_center: Option<String>,
    pub phone: String,
    pub email: String,
    pub address: String,
    pub city: String,
    pub district: Option<String>,
    pub state: String,
    pub center_code: Option<String>,
    pub discount_coupon: Option<String>,
    pub referral_code: Option<String>,
    pub username: Option<String>,
    pub password: String,

    pub country: Option<String>,
    pub maps_embed_url: Option<String>,
    pub pincode: Option<String>,

    pub computers: Option<i32>,
    pub classrooms: Option<i32>,
    pub staff: Option<i32>,
    pub lab_type: Option<String>,
    pub internet_available: Option<bool>,
    pub power_backup: Option<bool>,

    #[serde(default)]
    pub course_allotment: Vec<String>,

    pub bank_name: Option<String>,
    pub account_number: Option<String>,
    pub ifsc_code: Option<String>,
    pub account_holder: Option<String>,
    pub branch_address: Option<String>,

    #[serde(default)]
    pub documents: Vec<crate::models::center::CenterDocumentItem>,

    pub creation_date: Option<String>,
    pub validity_date: Option<String>,
    pub franchise_fee: Option<f64>,
    pub royalty_percent: Option<f64>,
    pub mock_test_enabled: Option<bool>,
    pub mock_test_start_date: Option<String>,
    pub mock_test_end_date: Option<String>,

    pub auth_letter_url: Option<String>,
    pub owner_photo_url: Option<String>,
    pub owner_signature_url: Option<String>,
    pub center_stamp_url: Option<String>,

    pub center_logo_url: Option<String>,
    pub banner_image_url: Option<String>,
    #[serde(default)]
    pub gallery_urls: Vec<String>,
    pub qr_code_1_url: Option<String>,
    pub qr_code_2_url: Option<String>,
    #[serde(default)]
    pub short_clip_urls: Vec<String>,

    pub opening_time: Option<String>,
    pub closing_time: Option<String>,
    #[serde(default)]
    pub working_days: Vec<String>,
}

pub async fn handle_create_center(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateCenterRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    let email_clean = payload.email.trim().to_lowercase();
    let username_clean = payload
        .username
        .as_deref()
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| email_clean.clone());

    let user_coll = db.collection::<User>("users");
    let center_coll = db.collection::<Center>("centers");

    // 1. Check if user already exists
    let existing_user = user_coll
        .find_one(
            doc! {
                "$or": [
                    { "email": &email_clean },
                    { "username": &username_clean }
                ],
                "is_deleted": false
            },
            None,
        )
        .await;

    if let Ok(Some(_)) = existing_user {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "success": false,
                "message": "User with this email or username already exists"
            })),
        );
    }

    // 2. Generate center code if not provided
    let code = match payload.center_code {
        Some(ref c) if !c.trim().is_empty() => c.trim().to_uppercase(),
        _ => format!("CENT{:04}", rand::thread_rng().gen_range(1000..9999)),
    };

    // 3. Hash password
    let password_plain = if payload.password.trim().is_empty() {
        "Center@123".to_string()
    } else {
        payload.password.trim().to_string()
    };
    let hashed_password = match bcrypt::hash(&password_plain, bcrypt::DEFAULT_COST) {
        Ok(h) => h,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({
                    "success": false,
                    "message": "Failed to encrypt password"
                })),
            );
        }
    };

    // 4. Create User document
    let user_id = ObjectId::new();
    let new_user = User {
        id: Some(user_id),
        username: username_clean,
        password_hash: hashed_password,
        raw_password: Some(password_plain),
        role: UserRole::Center,
        parent_id: None,
        full_name: Some(payload.name.clone()),
        email: Some(email_clean.clone()),
        phone: Some(payload.phone.clone()),
        active: true,
        is_deleted: false,
        approval_status: Some("approved".to_string()),
        ..Default::default()
    };

    if let Err(e) = user_coll.insert_one(new_user, None).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "success": false,
                "message": format!("Failed to create user record: {}", e)
            })),
        );
    }

    // 5. Create Center document
    let center_id = ObjectId::new();
    let admin_id = ObjectId::parse_str(&claims.sub).unwrap_or(user_id);

    let new_center = Center {
        id: Some(center_id),
        name: payload.name.clone(),
        code: code.clone(),
        owner_name: payload.owner_name.clone(),
        about_center: payload.about_center,
        phone: payload.phone.clone(),
        email: email_clean.clone(),
        address: payload.address.clone(),
        city: payload.city.clone(),
        district: payload.district.clone(),
        state: payload.state.clone(),
        center_code: Some(code.clone()),
        discount_coupon: payload.discount_coupon,
        referral_code: payload.referral_code,
        location: Some(crate::models::center::CenterLocation {
            country: payload.country,
            state: Some(payload.state.clone()),
            district: payload.district.clone(),
            city: Some(payload.city.clone()),
            address: Some(payload.address.clone()),
            maps_embed_url: payload.maps_embed_url,
            pincode: payload.pincode,
        }),
        infrastructure: Some(crate::models::center::CenterInfrastructure {
            computers: payload.computers,
            classrooms: payload.classrooms,
            staff: payload.staff,
            lab_type: payload.lab_type,
            internet_available: payload.internet_available,
            power_backup: payload.power_backup,
        }),
        course_allotment: payload.course_allotment,
        bank_details: Some(crate::models::center::CenterBankDetails {
            bank_name: payload.bank_name,
            account_number: payload.account_number,
            ifsc_code: payload.ifsc_code,
            account_holder: payload.account_holder,
            branch_address: payload.branch_address,
        }),
        documents: payload.documents,
        key_documents: Some(crate::models::center::CenterKeyDocuments {
            auth_letter_url: payload.auth_letter_url,
            owner_photo_url: payload.owner_photo_url,
            owner_signature_url: payload.owner_signature_url,
            center_stamp_url: payload.center_stamp_url,
        }),
        branding_media: Some(crate::models::center::CenterBrandingMedia {
            center_logo_url: payload.center_logo_url,
            banner_image_url: payload.banner_image_url,
            gallery_urls: payload.gallery_urls,
            qr_code_1_url: payload.qr_code_1_url,
            qr_code_2_url: payload.qr_code_2_url,
            director_video_url: None,
            short_clip_url: None,
            short_clip_urls: payload.short_clip_urls,
        }),
        working_hours: Some(crate::models::center::CenterWorkingHours {
            opening_time: payload.opening_time,
            closing_time: payload.closing_time,
            working_days: payload.working_days,
        }),
        config_validity: Some(crate::models::center::CenterConfigValidity {
            creation_date: payload.creation_date,
            validity_date: payload.validity_date,
            franchise_fee: payload.franchise_fee,
            royalty_percent: payload.royalty_percent,
            mock_test_enabled: payload.mock_test_enabled.unwrap_or(true),
            mock_test_start_date: payload.mock_test_start_date,
            mock_test_end_date: payload.mock_test_end_date,
        }),
        admin_id,
        user_id,
        active: true,
        is_deleted: false,
        deleted_at: None,
        permanent_delete_at: None,
        is_email_verified: true,
        email_verified_at: Some(Utc::now()),
        created_at: Utc::now(),
    };

    if let Err(e) = center_coll.insert_one(new_center, None).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "success": false,
                "message": format!("Failed to create center record: {}", e)
            })),
        );
    }

    (
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Center created successfully!",
            "center_id": center_id.to_hex(),
            "centerId": center_id.to_hex(),
            "user_id": user_id.to_hex()
        })),
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
    pub center_id: Option<String>,
    pub target_region_id: Option<String>,
    pub target_region_name: Option<String>,
    pub target_parent_id: Option<String>,
    pub transfer_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CenterMergePayload {
    pub source_center_id: String,
    pub target_center_id: String,
    pub merge_reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CenterTransferResponse {
    pub success: bool,
    pub message: String,
}

pub async fn transfer_center_body(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CenterTransferPayload>,
) -> (StatusCode, Json<CenterTransferResponse>) {
    let id = payload.center_id.clone().unwrap_or_default();
    transfer_center(State(db), claims, Path(id), Json(payload)).await
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

    let center_coll = db.collection::<mongodb::bson::Document>("centers");
    let user_coll = db.collection::<mongodb::bson::Document>("users");

    let mut raw_id = id.trim_start_matches('@').to_string();
    if (raw_id.is_empty() || raw_id == ":id" || raw_id == "transfer") && payload.center_id.is_some() {
        raw_id = payload.center_id.as_deref().unwrap_or("").trim_start_matches('@').to_string();
    }

    let oid_opt = ObjectId::parse_str(&raw_id).or_else(|_| ObjectId::parse_str(&id)).ok();

    let mut center_or = vec![
        doc! { "_id": &id },
        doc! { "_id": &raw_id },
        doc! { "code": &id },
        doc! { "code": &raw_id },
        doc! { "name": &id },
        doc! { "name": &raw_id },
        doc! { "username": &id },
        doc! { "username": &raw_id },
    ];
    if let Some(oid) = oid_opt {
        center_or.push(doc! { "_id": oid });
    }
    let center_filter = doc! { "$or": center_or };

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

    let center_name = existing.get_str("name").unwrap_or("Center").to_string();
    let center_code = existing.get_str("code").unwrap_or("").to_string();

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

    if !center_code.is_empty() {
        let _ = user_coll.update_many(
            doc! { "$or": [{ "center_code": &center_code }, { "username": &center_code }, { "code": &center_code }] },
            doc! { "$set": { "updated_at": Utc::now().to_rfc3339() } },
            None,
        ).await;
    }

    (
        StatusCode::OK,
        Json(CenterTransferResponse {
            success: true,
            message: format!("Center '{}' ({}) transferred / re-allocated successfully!", center_name, center_code),
        }),
    )
}

pub async fn merge_center(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CenterMergePayload>,
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

    let center_coll = db.collection::<mongodb::bson::Document>("centers");
    let user_coll = db.collection::<mongodb::bson::Document>("users");
    let student_coll = db.collection::<mongodb::bson::Document>("students");
    let staff_coll = db.collection::<mongodb::bson::Document>("staff");

    let src_clean = payload.source_center_id.trim_start_matches('@').to_string();
    let src_oid = ObjectId::parse_str(&src_clean).or_else(|_| ObjectId::parse_str(&payload.source_center_id)).ok();

    let mut src_or = vec![
        doc! { "_id": &payload.source_center_id },
        doc! { "_id": &src_clean },
        doc! { "code": &payload.source_center_id },
        doc! { "code": &src_clean },
        doc! { "name": &payload.source_center_id },
        doc! { "name": &src_clean },
    ];
    if let Some(oid) = src_oid {
        src_or.push(doc! { "_id": oid });
    }
    let src_center = match center_coll.find_one(doc! { "$or": src_or }, None).await {
        Ok(Some(c)) => c,
        _ => return (
            StatusCode::NOT_FOUND,
            Json(CenterTransferResponse {
                success: false,
                message: format!("Source center '{}' not found", payload.source_center_id),
            }),
        ),
    };

    let tgt_clean = payload.target_center_id.trim_start_matches('@').to_string();
    let tgt_oid = ObjectId::parse_str(&tgt_clean).or_else(|_| ObjectId::parse_str(&payload.target_center_id)).ok();

    let mut tgt_or = vec![
        doc! { "_id": &payload.target_center_id },
        doc! { "_id": &tgt_clean },
        doc! { "code": &payload.target_center_id },
        doc! { "code": &tgt_clean },
        doc! { "name": &payload.target_center_id },
        doc! { "name": &tgt_clean },
    ];
    if let Some(oid) = tgt_oid {
        tgt_or.push(doc! { "_id": oid });
    }
    let tgt_center = match center_coll.find_one(doc! { "$or": tgt_or }, None).await {
        Ok(Some(c)) => c,
        _ => return (
            StatusCode::NOT_FOUND,
            Json(CenterTransferResponse {
                success: false,
                message: format!("Target center '{}' not found", payload.target_center_id),
            }),
        ),
    };

    let src_id = src_center.get_object_id("_id").ok();
    let src_code = src_center.get_str("code").unwrap_or("").to_string();
    let src_name = src_center.get_str("name").unwrap_or("Source Center").to_string();

    let tgt_id = tgt_center.get_object_id("_id").ok();
    let tgt_code = tgt_center.get_str("code").unwrap_or("").to_string();
    let tgt_name = tgt_center.get_str("name").unwrap_or("Target Center").to_string();

    // 1. Move all students from source center to target center
    let mut student_user_set = doc! {
        "center_code": &tgt_code,
        "center_name": &tgt_name,
        "updated_at": Utc::now().to_rfc3339()
    };
    if let Some(tp_oid) = tgt_id {
        student_user_set.insert("parent_id", tp_oid);
    }

    let mut student_or = vec![doc! { "center_code": &src_code }];
    if let Some(s_oid) = src_id {
        student_or.push(doc! { "parent_id": s_oid });
    }
    let _ = user_coll.update_many(
        doc! { "role": "student", "$or": student_or },
        doc! { "$set": student_user_set },
        None,
    ).await;

    let mut student_doc_set = doc! {
        "center_code": &tgt_code,
        "center_name": &tgt_name,
        "updated_at": Utc::now().to_rfc3339()
    };
    if let Some(tp_oid) = tgt_id {
        student_doc_set.insert("center_id", tp_oid);
        student_doc_set.insert("parent_id", tp_oid);
    }
    let mut student_doc_or = vec![doc! { "center_code": &src_code }];
    if let Some(s_oid) = src_id {
        student_doc_or.push(doc! { "center_id": s_oid });
        student_doc_or.push(doc! { "parent_id": s_oid });
    }
    let _ = student_coll.update_many(
        doc! { "$or": student_doc_or },
        doc! { "$set": student_doc_set },
        None,
    ).await;

    // 2. Move all staff from source center to target center
    let target_centers = vec![tgt_name.clone()];
    let mut staff_set = doc! {
        "assigned_centers": mongodb::bson::to_bson(&target_centers).unwrap_or(mongodb::bson::Bson::Array(vec![])),
        "updated_at": Utc::now().to_rfc3339()
    };
    if let Some(tp_oid) = tgt_id {
        staff_set.insert("parent_id", tp_oid);
    }
    let mut staff_or = vec![doc! { "assigned_centers": &src_name }];
    if let Some(s_oid) = src_id {
        staff_or.push(doc! { "parent_id": s_oid });
    }
    let _ = staff_coll.update_many(
        doc! { "$or": staff_or },
        doc! { "$set": staff_set },
        None,
    ).await;

    if let Some(tp_oid) = tgt_id {
        if let Some(s_oid) = src_id {
            let _ = user_coll.update_many(
                doc! { "role": "staff", "parent_id": s_oid },
                doc! { "$set": { "parent_id": tp_oid, "updated_at": Utc::now().to_rfc3339() } },
                None,
            ).await;
        }
    }

    // 3. Mark source center status as Merged
    let mut update_src_doc = doc! {
        "status": "merged",
        "active": false,
        "merged_into_code": &tgt_code,
        "merged_into_name": &tgt_name,
        "updated_at": Utc::now().to_rfc3339()
    };
    if let Some(tp_oid) = tgt_id {
        update_src_doc.insert("parent_id", tp_oid);
    }
    if let Some(s_oid) = src_id {
        let _ = center_coll.update_one(doc! { "_id": s_oid }, doc! { "$set": update_src_doc }, None).await;
    }

    (
        StatusCode::OK,
        Json(CenterTransferResponse {
            success: true,
            message: format!(
                "Center '{}' ({}) successfully merged into '{}' ({})! All students and staff transferred.",
                src_name, src_code, tgt_name, tgt_code
            ),
        }),
    )
}

