use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use mongodb::{Database, bson::{doc, oid::ObjectId, to_bson}};
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
    pub role_type: String, // "peon", "teacher", "accountant", "counselor", "center_admin", "alternate_staff"
    pub phone: Option<String>,
    pub email: Option<String>,
    pub permissions: Option<StaffPermissions>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStaffRequest {
    pub name: Option<String>,
    pub designation: Option<String>,
    pub role_type: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub status: Option<String>, // "active", "inactive"
    pub permissions: Option<StaffPermissions>,
    pub password: Option<String>,
    pub assigned_subjects: Option<Vec<String>>,
    pub assigned_centers: Option<Vec<String>>,
    pub basic_salary: Option<f64>,
    pub allowances: Option<f64>,
    pub deductions: Option<f64>,
    pub pf_deduction: Option<f64>,
    pub overtime_hours: Option<f64>,
    pub overtime_rate: Option<f64>,
    pub unpaid_leaves: Option<f64>,
    pub salary_status: Option<String>,
    pub last_payment_date: Option<String>,
    pub bank_details: Option<serde_json::Value>,
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

    // Default permissions based on role_type or custom override
    let mut permissions = StaffPermissions::default();
    match payload.role_type.as_str() {
        "teacher" => {
            permissions.can_manage_students = true;
            permissions.can_manage_attendance = true;
            permissions.can_manage_courses = true;
            permissions.can_manage_exams = true;
        },
        "accountant" => {
            permissions.can_manage_fees = true;
            permissions.can_view_reports = true;
        },
        "counselor" => {
            permissions.can_manage_enquiries = true;
            permissions.can_manage_students = true;
        },
        "center_admin" => {
            permissions.can_manage_students = true;
            permissions.can_manage_attendance = true;
            permissions.can_manage_fees = true;
            permissions.can_manage_courses = true;
            permissions.can_manage_exams = true;
            permissions.can_view_reports = true;
            permissions.can_manage_staff = true;
            permissions.can_manage_enquiries = true;
            permissions.can_issue_certificates = true;
        },
        "peon" => {
            // No permissions, just for presence
        },
        "alternate_staff" => {
            // Custom or no permissions
        },
        _ => {}
    }

    if let Some(custom) = payload.permissions {
        permissions = custom;
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
        status: None,
        admin_instructions: None,
        priority_centers: None,
        current_priority: None,
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
        assigned_subjects: None,
        assigned_centers: None,
        basic_salary: None,
        allowances: None,
        deductions: None,
        pf_deduction: None,
        overtime_hours: None,
        overtime_rate: None,
        unpaid_leaves: None,
        salary_status: None,
        last_payment_date: None,
        bank_details: None,
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

pub async fn update_staff(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<UpdateStaffRequest>,
) -> (StatusCode, Json<StaffResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin && claims.role != UserRole::Center {
        return (StatusCode::FORBIDDEN, Json(StaffResponse { success: false, message: "Forbidden".to_string() }));
    }

    let staff_coll = db.collection::<Staff>("staff");
    let user_coll = db.collection::<User>("users");

    let filter = if let Ok(oid) = ObjectId::parse_str(&id) {
        doc! { "_id": oid }
    } else {
        doc! { "$or": [{ "name": &id }, { "role_type": &id }] }
    };

    let existing = match staff_coll.find_one(filter.clone(), None).await {
        Ok(Some(s)) => s,
        _ => return (StatusCode::NOT_FOUND, Json(StaffResponse { success: false, message: "Staff not found".to_string() })),
    };

    let target_oid = existing.id.unwrap_or_else(|| ObjectId::new());

    let mut update_doc = doc! {};
    if let Some(name) = &payload.name {
        update_doc.insert("name", name);
    }
    if let Some(desig) = &payload.designation {
        update_doc.insert("designation", desig);
    }
    if let Some(role) = &payload.role_type {
        update_doc.insert("role_type", role);
    }
    if let Some(phone) = &payload.phone {
        update_doc.insert("phone", phone);
    }
    if let Some(email) = &payload.email {
        update_doc.insert("email", email);
    }
    if let Some(status) = &payload.status {
        update_doc.insert("status", status);
    }
    if let Some(perms) = &payload.permissions {
        if let Ok(b) = to_bson(perms) {
            update_doc.insert("permissions", b);
        }
    }
    if let Some(subs) = &payload.assigned_subjects {
        if let Ok(b) = to_bson(subs) { update_doc.insert("assigned_subjects", b); }
    }
    if let Some(ctrs) = &payload.assigned_centers {
        if let Ok(b) = to_bson(ctrs) { update_doc.insert("assigned_centers", b); }
    }
    if let Some(v) = payload.basic_salary { update_doc.insert("basic_salary", v); }
    if let Some(v) = payload.allowances { update_doc.insert("allowances", v); }
    if let Some(v) = payload.deductions { update_doc.insert("deductions", v); }
    if let Some(v) = payload.pf_deduction { update_doc.insert("pf_deduction", v); }
    if let Some(v) = payload.overtime_hours { update_doc.insert("overtime_hours", v); }
    if let Some(v) = payload.overtime_rate { update_doc.insert("overtime_rate", v); }
    if let Some(v) = payload.unpaid_leaves { update_doc.insert("unpaid_leaves", v); }
    if let Some(v) = &payload.salary_status { update_doc.insert("salary_status", v); }
    if let Some(v) = &payload.last_payment_date { update_doc.insert("last_payment_date", v); }
    if let Some(v) = &payload.bank_details {
        if let Ok(b) = to_bson(v) { update_doc.insert("bank_details", b); }
    }

    if !update_doc.is_empty() {
        let _ = staff_coll.update_one(doc! { "_id": target_oid }, doc! { "$set": update_doc }, None).await;
    }

    // Also update associated User if name, phone, email, or password changed
    let mut user_update = doc! {};
    if let Some(name) = &payload.name {
        user_update.insert("full_name", name);
    }
    if let Some(phone) = &payload.phone {
        user_update.insert("phone", phone);
    }
    if let Some(email) = &payload.email {
        user_update.insert("email", email);
    }
    if let Some(pwd) = &payload.password {
        if !pwd.trim().is_empty() {
            if let Ok(h) = hash(pwd, DEFAULT_COST) {
                user_update.insert("password_hash", h);
                user_update.insert("raw_password", pwd);
            }
        }
    }
    if let Some(status) = &payload.status {
        user_update.insert("active", status == "active");
    }

    if !user_update.is_empty() {
        let _ = user_coll.update_one(doc! { "_id": existing.user_id }, doc! { "$set": user_update }, None).await;
    }

    (StatusCode::OK, Json(StaffResponse { success: true, message: "Staff updated successfully".to_string() }))
}

pub async fn delete_staff(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<StaffResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin && claims.role != UserRole::Center {
        return (StatusCode::FORBIDDEN, Json(StaffResponse { success: false, message: "Forbidden".to_string() }));
    }

    let filter = if let Ok(oid) = ObjectId::parse_str(&id) {
        doc! { "_id": oid }
    } else {
        doc! { "name": &id }
    };

    let staff_coll = db.collection::<Staff>("staff");
    let user_coll = db.collection::<User>("users");

    if let Ok(Some(staff)) = staff_coll.find_one(filter.clone(), None).await {
        let _ = staff_coll.delete_one(filter, None).await;
        let _ = user_coll.delete_one(doc! { "_id": staff.user_id }, None).await;
        (StatusCode::OK, Json(StaffResponse { success: true, message: "Staff deleted successfully".to_string() }))
    } else {
        (StatusCode::NOT_FOUND, Json(StaffResponse { success: false, message: "Staff not found".to_string() }))
    }
}

#[derive(Debug, Deserialize)]
pub struct AttendanceRecordPayload {
    pub staff_id: String,
    pub date: String,
    pub status: String,
    pub check_in: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SaveAttendanceRequest {
    pub date: String,
    pub records: Vec<AttendanceRecordPayload>,
}

#[derive(Debug, Deserialize)]
pub struct AttendanceQuery {
    pub date: Option<String>,
}

pub async fn get_staff_attendance(
    State(db): State<Database>,
    claims: Claims,
    axum::extract::Query(query): axum::extract::Query<AttendanceQuery>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin && claims.role != UserRole::Center {
        return (StatusCode::FORBIDDEN, Json(serde_json::json!({ "error": "Forbidden" })));
    }

    let date = query.date.unwrap_or_else(|| Utc::now().naive_utc().date().to_string());
    let att_coll = db.collection::<mongodb::bson::Document>("staff_attendance");

    let is_locked = match att_coll.find_one(doc! { "date": &date, "is_locked": true }, None).await {
        Ok(Some(_)) => true,
        _ => false,
    };

    let filter = doc! { "date": &date, "type": { "$ne": "lock_marker" } };
    let mut cursor = match att_coll.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "is_locked": is_locked, "records": [] }))),
    };

    let mut records = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(doc) = result {
            if let Ok(val) = serde_json::to_value(doc) {
                records.push(val);
            }
        }
    }

    (StatusCode::OK, Json(serde_json::json!({
        "date": date,
        "is_locked": is_locked,
        "records": records
    })))
}

pub async fn save_staff_attendance(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<SaveAttendanceRequest>,
) -> (StatusCode, Json<StaffResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin && claims.role != UserRole::Center {
        return (StatusCode::FORBIDDEN, Json(StaffResponse { success: false, message: "Forbidden".to_string() }));
    }

    let att_coll = db.collection::<mongodb::bson::Document>("staff_attendance");

    // Check if date is locked
    if let Ok(Some(_)) = att_coll.find_one(doc! { "date": &payload.date, "is_locked": true }, None).await {
        return (StatusCode::FORBIDDEN, Json(StaffResponse {
            success: false,
            message: format!("Attendance for date {} is locked and cannot be edited!", payload.date)
        }));
    }

    // Save records and mark as locked
    let now = Utc::now();
    for rec in payload.records {
        let rec_doc = doc! {
            "staff_id": &rec.staff_id,
            "date": &payload.date,
            "status": &rec.status,
            "check_in": rec.check_in.unwrap_or_else(|| "09:30 AM".to_string()),
            "is_locked": true,
            "created_at": now.to_rfc3339(),
        };

        let filter = doc! { "staff_id": &rec.staff_id, "date": &payload.date };
        let options = mongodb::options::ReplaceOptions::builder().upsert(true).build();
        let _ = att_coll.replace_one(filter, rec_doc, options).await;
    }

    // Save date lock marker doc
    let lock_doc = doc! {
        "date": &payload.date,
        "type": "lock_marker",
        "is_locked": true,
        "locked_by": &claims.sub,
        "locked_at": now.to_rfc3339(),
    };
    let _ = att_coll.replace_one(doc! { "date": &payload.date, "type": "lock_marker" }, lock_doc, mongodb::options::ReplaceOptions::builder().upsert(true).build()).await;

    (StatusCode::OK, Json(StaffResponse {
        success: true,
        message: format!("Attendance for {} saved & locked successfully", payload.date)
    }))
}

#[derive(Debug, Deserialize)]
pub struct CreateLeaveRequest {
    pub staff_id: String,
    pub staff_name: String,
    pub leave_type: String, // "casual", "sick", "unpaid"
    pub start_date: String,
    pub end_date: String,
    pub days: f64,
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateLeaveStatusRequest {
    pub status: String, // "approved", "rejected"
}

pub async fn get_staff_leaves(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<serde_json::Value>>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin && claims.role != UserRole::Center && claims.role != UserRole::Staff {
        return (StatusCode::FORBIDDEN, Json(Vec::new()));
    }

    let leave_coll = db.collection::<mongodb::bson::Document>("staff_leaves");
    let mut cursor = match leave_coll.find(doc! {}, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::OK, Json(Vec::new())),
    };

    let mut list = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(doc) = result {
            if let Ok(val) = serde_json::to_value(doc) {
                list.push(val);
            }
        }
    }

    (StatusCode::OK, Json(list))
}

pub async fn create_staff_leave(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateLeaveRequest>,
) -> (StatusCode, Json<StaffResponse>) {
    let leave_coll = db.collection::<mongodb::bson::Document>("staff_leaves");
    let now = Utc::now();

    let doc = doc! {
        "staff_id": &payload.staff_id,
        "staff_name": &payload.staff_name,
        "leave_type": &payload.leave_type,
        "start_date": &payload.start_date,
        "end_date": &payload.end_date,
        "days": payload.days,
        "reason": &payload.reason,
        "status": "pending",
        "applied_by": &claims.sub,
        "created_at": now.to_rfc3339(),
    };

    match leave_coll.insert_one(doc, None).await {
        Ok(_) => (StatusCode::CREATED, Json(StaffResponse { success: true, message: "Leave request submitted for approval".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(StaffResponse { success: false, message: "Failed to submit leave request".to_string() })),
    }
}

pub async fn update_staff_leave_status(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<UpdateLeaveStatusRequest>,
) -> (StatusCode, Json<StaffResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin && claims.role != UserRole::Center {
        return (StatusCode::FORBIDDEN, Json(StaffResponse { success: false, message: "Forbidden".to_string() }));
    }

    let leave_coll = db.collection::<mongodb::bson::Document>("staff_leaves");
    let filter = if let Ok(oid) = ObjectId::parse_str(&id) {
        doc! { "_id": oid }
    } else {
        doc! { "staff_id": &id }
    };

    let leave_doc = match leave_coll.find_one(filter.clone(), None).await {
        Ok(Some(d)) => d,
        _ => return (StatusCode::NOT_FOUND, Json(StaffResponse { success: false, message: "Leave request not found".to_string() })),
    };

    let status = payload.status.to_lowercase();
    let _ = leave_coll.update_one(filter.clone(), doc! { "$set": { "status": &status, "reviewed_by": &claims.sub } }, None).await;

    // If approved and unpaid leave, increment staff's unpaid_leaves count
    if status == "approved" {
        if let Ok(ltype) = leave_doc.get_str("leave_type") {
            if ltype == "unpaid" {
                let days = leave_doc.get_f64("days").unwrap_or(1.0);
                if let Ok(staff_id) = leave_doc.get_str("staff_id") {
                    let staff_coll = db.collection::<Staff>("staff");
                    let staff_filter = if let Ok(s_oid) = ObjectId::parse_str(staff_id) {
                        doc! { "_id": s_oid }
                    } else {
                        doc! { "name": staff_id }
                    };
                    let _ = staff_coll.update_one(staff_filter, doc! { "$inc": { "unpaid_leaves": days } }, None).await;
                }
            }
        }
    }

    (StatusCode::OK, Json(StaffResponse { success: true, message: format!("Leave status updated to {}", status) }))
}

#[derive(Debug, Deserialize)]
pub struct CreateOvertimeRequest {
    pub staff_id: String,
    pub staff_name: String,
    pub hours: f64,
    pub rate: f64,
    pub extra_bonus: f64,
    pub reason: String,
    pub date: Option<String>,
}

pub async fn get_staff_overtime(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<serde_json::Value>>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin && claims.role != UserRole::Center && claims.role != UserRole::Staff {
        return (StatusCode::FORBIDDEN, Json(Vec::new()));
    }

    let ot_coll = db.collection::<mongodb::bson::Document>("staff_overtime");
    let mut cursor = match ot_coll.find(doc! {}, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::OK, Json(Vec::new())),
    };

    let mut list = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(doc) = result {
            if let Ok(val) = serde_json::to_value(doc) {
                list.push(val);
            }
        }
    }

    (StatusCode::OK, Json(list))
}

pub async fn create_staff_overtime(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateOvertimeRequest>,
) -> (StatusCode, Json<StaffResponse>) {
    let ot_coll = db.collection::<mongodb::bson::Document>("staff_overtime");
    let now = Utc::now();
    let date_str = payload.date.unwrap_or_else(|| now.naive_utc().date().to_string());

    let doc = doc! {
        "staff_id": &payload.staff_id,
        "staff_name": &payload.staff_name,
        "hours": payload.hours,
        "rate": payload.rate,
        "extra_bonus": payload.extra_bonus,
        "reason": &payload.reason,
        "date": &date_str,
        "created_by": &claims.sub,
        "created_at": now.to_rfc3339(),
    };

    let _ = ot_coll.insert_one(doc, None).await;

    // Update staff OT hours and allowances
    let staff_coll = db.collection::<Staff>("staff");
    let staff_filter = if let Ok(s_oid) = ObjectId::parse_str(&payload.staff_id) {
        doc! { "_id": s_oid }
    } else {
        doc! { "name": &payload.staff_id }
    };

    let _ = staff_coll.update_one(staff_filter, doc! { 
        "$inc": { "overtime_hours": payload.hours, "allowances": payload.extra_bonus },
        "$set": { "overtime_rate": payload.rate }
    }, None).await;

    (StatusCode::CREATED, Json(StaffResponse { success: true, message: "Overtime logged and added to payroll".to_string() }))
}

#[derive(Debug, Deserialize)]
pub struct DisbursePayrollPayload {
    pub staff_id: String,
    pub staff_name: String,
    pub month_year: String,
    pub basic: f64,
    pub overtime_pay: f64,
    pub allowances: f64,
    pub deductions: f64,
    pub net_paid: f64,
    pub payment_ref: Option<String>,
}

pub async fn disburse_staff_payroll(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<DisbursePayrollPayload>,
) -> (StatusCode, Json<StaffResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin && claims.role != UserRole::Center {
        return (StatusCode::FORBIDDEN, Json(StaffResponse { success: false, message: "Forbidden".to_string() }));
    }

    let history_coll = db.collection::<mongodb::bson::Document>("staff_payroll_history");
    let now = Utc::now();
    let today_str = now.naive_utc().date().to_string();
    let ref_code = payload.payment_ref.unwrap_or_else(|| format!("REF-{}", now.timestamp_millis() % 1000000));

    let log_doc = doc! {
        "staff_id": &payload.staff_id,
        "staff_name": &payload.staff_name,
        "month_year": &payload.month_year,
        "basic": payload.basic,
        "overtime_pay": payload.overtime_pay,
        "allowances": payload.allowances,
        "deductions": payload.deductions,
        "net_paid": payload.net_paid,
        "disbursed_at": now.to_rfc3339(),
        "payment_ref": &ref_code,
        "disbursed_by": &claims.sub,
    };

    let _ = history_coll.insert_one(log_doc, None).await;

    // Update staff salary status
    let staff_coll = db.collection::<Staff>("staff");
    let staff_filter = if let Ok(s_oid) = ObjectId::parse_str(&payload.staff_id) {
        doc! { "_id": s_oid }
    } else {
        doc! { "name": &payload.staff_id }
    };

    let _ = staff_coll.update_one(staff_filter, doc! {
        "$set": { "salary_status": "paid", "last_payment_date": &today_str }
    }, None).await;

    (StatusCode::OK, Json(StaffResponse { success: true, message: format!("Payroll disbursed successfully ({})", ref_code) }))
}

pub async fn get_staff_payroll_history(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<serde_json::Value>>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin && claims.role != UserRole::Center && claims.role != UserRole::Staff {
        return (StatusCode::FORBIDDEN, Json(Vec::new()));
    }

    let history_coll = db.collection::<mongodb::bson::Document>("staff_payroll_history");
    let mut cursor = match history_coll.find(doc! {}, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::OK, Json(Vec::new())),
    };

    let mut list = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(doc) = result {
            if let Ok(val) = serde_json::to_value(doc) {
                list.push(val);
            }
        }
    }

    (StatusCode::OK, Json(list))
}

