use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use mongodb::{Database, bson::{doc, oid::ObjectId}};
use serde::{Deserialize, Serialize};
use crate::models::user::{Claims, UserRole, User};
use crate::models::staff::{Staff, StaffPermissions};
use chrono::Utc;
use futures_util::StreamExt;
use bcrypt::{hash, DEFAULT_COST};

#[derive(Debug, Deserialize)]
pub struct CreateStaffRequest {
    pub username: String,
    pub password: Option<String>,
    pub name: String,
    pub designation: String,
    pub role_type: String, // "peon", "teacher", "center_admin", "alternate_staff"
    pub phone: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct StaffResponse {
    pub success: bool,
    pub message: String,
}

pub async fn handle_create_staff(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateStaffRequest>,
) -> (StatusCode, Json<StaffResponse>) {
    // Both Admins and Centers can create staff
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin && claims.role != UserRole::Center {
        return (StatusCode::FORBIDDEN, Json(StaffResponse { success: false, message: "Forbidden".to_string() }));
    }

    let parent_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(StaffResponse { success: false, message: "Invalid ID".to_string() })),
    };

    let user_coll = db.collection::<User>("users");
    let staff_coll = db.collection::<Staff>("staff");

    // Check if username exists
    if let Ok(Some(_)) = user_coll.find_one(doc! { "username": &payload.username }, None).await {
        return (StatusCode::CONFLICT, Json(StaffResponse { success: false, message: "Username already exists".to_string() }));
    }

    // Default permissions based on role_type
    let mut permissions = StaffPermissions::default();
    match payload.role_type.as_str() {
        "teacher" => {
            permissions.can_manage_students = true;
            permissions.can_manage_attendance = true;
            permissions.can_manage_courses = true;
            permissions.can_manage_exams = true;
        },
        "center_admin" => {
            permissions.can_manage_students = true;
            permissions.can_manage_attendance = true;
            permissions.can_manage_fees = true;
            permissions.can_manage_courses = true;
            permissions.can_manage_exams = true;
            permissions.can_view_reports = true;
            permissions.can_manage_staff = true;
        },
        "peon" => {
            // No permissions, just for presence
        },
        "alternate_staff" => {
            // Custom or no permissions
        },
        _ => {}
    }

    let password_plain = payload.password.clone().unwrap_or_else(|| "staff123".to_string());
    let hashed_password = match hash(&password_plain, DEFAULT_COST) {
        Ok(h) => h,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(StaffResponse { success: false, message: "Hashing error".to_string() })),
    };

    let new_user = User {
        id: None,
        username: payload.username,
        password_hash: hashed_password,
        raw_password: Some(password_plain),
        role: UserRole::Staff,
        parent_id: Some(parent_oid),
        full_name: Some(payload.name.clone()),
        first_name: None,
        middle_name: None,
        last_name: None,
        email: payload.email.clone(),
        phone: payload.phone.clone(),
        course: None,
        father_name: None,
        mother_name: None,
        dob: None,
        gender: None,
        category: None,
        national_id_type: None,
        national_id: None,
        address: None,
        city: None,
        state: None,
        district: None,
        country: None,
        pincode: None,
        other_address: None,
        emergency_contact_name: None,
        emergency_contact_phone: None,
        emergency_contact_relation: None,
        additional_docs: None,
        enrollment_number: None,
        photo_url: None,
        signature_url: None,
        national_id_url: None,
        highest_qualification: None,
        college: None,
        admission_mode: None,
        exam_mode: None,
        session_id: None,
        session_start_date: None,
        session_end_date: None,
        approval_status: None,
        marks: None,
        active: true,
        is_deleted: false,
        deleted_at: None,
        created_at: Utc::now(),
        course_id: None,
        registration_date: None,
        roll_number: None,
        serial_number: None,
        batch_id: None,
        referral_code: None,
        referred_by_code: None,
        applied_coupon: None,
        course_category: None,
        enrolled_courses: None,
        current_unit: None,
        other_doc_url: None,
        updated_at: None,
        is_email_verified: false,
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
        sub_admin_role_id: None,
        sub_admin_role_name: None,
        sub_admin_permissions: None,
    };

    let user_result = match user_coll.insert_one(new_user, None).await {
        Ok(r) => r,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(StaffResponse { success: false, message: "Failed to create user".to_string() })),
    };

    let user_id = user_result.inserted_id.as_object_id().unwrap();

    // 2. Create Staff entry
    let parent_role_str = match claims.role {
        UserRole::Center => "center",
        _ => "admin",
    };

    let new_staff = Staff {
        id: None,
        user_id,
        parent_id: parent_oid,
        parent_role: parent_role_str.to_string(),
        name: payload.name,
        designation: payload.designation,
        role_type: payload.role_type,
        permissions,
        phone: payload.phone,
        email: payload.email,
        status: "active".to_string(),
        created_at: Utc::now(),
    };

    match staff_coll.insert_one(new_staff, None).await {
        Ok(_) => (StatusCode::CREATED, Json(StaffResponse { success: true, message: "Staff created successfully".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(StaffResponse { success: false, message: "Failed to create staff profile".to_string() })),
    }
}

pub async fn get_staff_list(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<serde_json::Value>>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin && claims.role != UserRole::Center {
        return (StatusCode::FORBIDDEN, Json(Vec::new()));
    }

    let parent_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
    };

    let staff_coll = db.collection::<Staff>("staff");
    let user_coll = db.collection::<User>("users");
    
    let mut cursor = match staff_coll.find(doc! { "parent_id": parent_oid }, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut staff_list = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(staff) = result {
            let mut val = serde_json::to_value(&staff).unwrap_or(serde_json::json!({}));
            // Add username from users collection
            if let Ok(Some(user)) = user_coll.find_one(doc! { "_id": staff.user_id }, None).await {
                if let Some(obj) = val.as_object_mut() {
                    obj.insert("username".to_string(), serde_json::json!(user.username));
                }
            }
            staff_list.push(val);
        }
    }

    (StatusCode::OK, Json(staff_list))
}

pub async fn get_staff_permissions(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Staff {
        return (StatusCode::FORBIDDEN, Json(serde_json::json!({})));
    }

    let user_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({}))),
    };

    let staff_coll = db.collection::<Staff>("staff");
    match staff_coll.find_one(doc! { "user_id": user_oid }, None).await {
        Ok(Some(staff)) => (StatusCode::OK, Json(serde_json::to_value(staff.permissions).unwrap_or(serde_json::json!({})))),
        _ => (StatusCode::NOT_FOUND, Json(serde_json::json!({}))),
    }
}
