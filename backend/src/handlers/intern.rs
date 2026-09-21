use crate::handlers::intern_attendance::InternAttendance;
use crate::models::intern_task::InternTask;
use crate::models::user::{Claims, User, UserRole};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use bcrypt::{DEFAULT_COST, hash};
use chrono::Utc;
use futures_util::StreamExt;
use mongodb::{
    Database,
    bson::{doc, oid::ObjectId},
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInternRequest {
    pub username: Option<String>,
    pub password: String,
    pub full_name: String,
    pub first_name: Option<String>,
    pub middle_name: Option<String>,
    pub last_name: Option<String>,
    pub email: String,
    pub phone: String,
    pub course: Option<String>,
    pub center_id: Option<String>,
    pub father_name: Option<String>,
    pub mother_name: Option<String>,
    pub dob: Option<String>,
    pub gender: Option<String>,
    pub category: Option<String>,
    pub national_id_type: Option<String>,
    pub national_id: Option<String>,
    pub national_id_url: Option<String>,
    pub highest_qualification: Option<String>,
    pub college: Option<String>,
    pub address: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub district: Option<String>,
    pub country: Option<String>,
    pub pincode: Option<String>,
    pub other_address: Option<String>,
    pub emergency_contact_name: Option<String>,
    pub emergency_contact_phone: Option<String>,
    pub emergency_contact_relation: Option<String>,
    pub additional_docs: Option<String>,
    pub enrollment_number: Option<String>,
    pub serial_number: Option<String>,
    pub registration_date: Option<String>,
    pub course_id: Option<String>,
    pub photo_url: Option<String>,
    pub signature_url: Option<String>,
    pub session_id: Option<String>,
    pub session_start_date: Option<String>,
    pub session_end_date: Option<String>,
    pub internship_domain: Option<String>,
    pub internship_mode: Option<String>,
    pub referral_code: Option<String>,
    pub referred_by_code: Option<String>,
    pub applied_coupon: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInternRequest {
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
    pub college: Option<String>,
    pub address: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub district: Option<String>,
    pub country: Option<String>,
    pub pincode: Option<String>,
    pub other_address: Option<String>,
    pub emergency_contact_name: Option<String>,
    pub emergency_contact_phone: Option<String>,
    pub emergency_contact_relation: Option<String>,
    pub additional_docs: Option<String>,
    pub enrollment_number: Option<String>,
    pub serial_number: Option<String>,
    pub registration_date: Option<String>,
    pub photo_url: Option<String>,
    pub signature_url: Option<String>,
    pub session_id: Option<String>,
    pub session_start_date: Option<String>,
    pub session_end_date: Option<String>,
    pub password: Option<String>,
    pub internship_domain: Option<String>,
    pub internship_mode: Option<String>,
    pub referral_code: Option<String>,
    pub referred_by_code: Option<String>,
    pub applied_coupon: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CreateInternResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct InternProgress {
    pub intern_id: String,
    pub intern_name: String,
    pub attendance_percentage: f64,
    pub total_tasks: u32,
    pub pending_tasks: u32,
    pub in_progress_tasks: u32,
    pub completed_tasks: u32,
    pub task_completion_rate: f64,
    pub overall_progress_percentage: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicIntern {
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
    pub serial_number: Option<String>,
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
    pub registration_date: Option<String>,
    pub photo_url: Option<String>,
    pub session_start_date: Option<String>,
    pub session_end_date: Option<String>,
    pub course_category: Option<String>,
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
    pub college: Option<String>,
    pub internship_domain: Option<String>,
    pub internship_mode: Option<String>,
    pub referral_code: Option<String>,
    pub referred_by_code: Option<String>,
    pub applied_coupon: Option<String>,
}

impl From<User> for PublicIntern {
    fn from(u: User) -> Self {
        PublicIntern {
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
            serial_number: u.serial_number,
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
            signature_url: u.signature_url,
            additional_docs: u.additional_docs,
            course_id: u.course_id.map(|oid| oid.to_hex()),
            registration_date: u.registration_date,
            photo_url: u.photo_url,
            session_start_date: u.session_start_date,
            session_end_date: u.session_end_date,
            course_category: u.course_category,
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
            college: u.college,
            internship_domain: u.internship_domain,
            internship_mode: u.internship_mode,
            referral_code: u.referral_code,
            referred_by_code: u.referred_by_code,
            applied_coupon: u.applied_coupon,
        }
    }
}

pub async fn handle_create_intern(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateInternRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Center
        && claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
    {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "success": false,
                "message": "Unauthorized to create interns".to_string()
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

    let username = payload.email.clone();
    if let Ok(Some(_)) = user_collection
        .find_one(doc! { "username": &username }, None)
        .await
    {
        return (
            StatusCode::CONFLICT,
            Json(serde_json::json!({
                "success": false,
                "message": "Email already exists as login ID".to_string()
            })),
        );
    }

    let hashed_password = hash(&payload.password, DEFAULT_COST).expect("password hashing failed");
    let enrollment_no = payload
        .enrollment_number
        .unwrap_or_else(|| format!("INTERN-{}", Utc::now().timestamp()));
    let serial_no = payload
        .serial_number
        .unwrap_or_else(|| format!("SR-{}", Utc::now().timestamp()));

    let new_user = User {
        id: None,
        username: username.clone(),
        password_hash: hashed_password,
        raw_password: Some(payload.password.clone()),
        role: UserRole::Intern,
        parent_id: Some(creator_id),
        full_name: Some(payload.full_name.clone()),
        first_name: payload.first_name,
        middle_name: payload.middle_name,
        last_name: payload.last_name,
        email: Some(payload.email.clone()),
        phone: Some(payload.phone.clone()),
        course: payload.course,
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
        district: payload.district,
        country: payload.country,
        pincode: payload.pincode,
        other_address: payload.other_address,
        emergency_contact_name: payload.emergency_contact_name,
        emergency_contact_phone: payload.emergency_contact_phone,
        emergency_contact_relation: payload.emergency_contact_relation,
        additional_docs: payload.additional_docs,
        enrollment_number: Some(enrollment_no.clone()),
        serial_number: Some(serial_no.clone()),
        photo_url: payload.photo_url,
        signature_url: payload.signature_url,
        national_id_url: payload.national_id_url,
        highest_qualification: payload.highest_qualification,
        college: payload.college,
        admission_mode: None,
        exam_mode: None,
        session_id: payload
            .session_id
            .and_then(|id| ObjectId::parse_str(&id).ok()),
        session_start_date: payload.session_start_date,
        session_end_date: payload.session_end_date,
        approval_status: Some("approved".to_string()),
        marks: None,
        active: true,
        is_deleted: false,
        deleted_at: None,
        created_at: Utc::now(),
        course_id: payload
            .course_id
            .and_then(|id| ObjectId::parse_str(&id).ok()),
        registration_date: payload.registration_date,
        roll_number: None,
        batch_id: None,
        referral_code: payload.referral_code,
        referred_by_code: payload.referred_by_code,
        applied_coupon: payload.applied_coupon,
        course_category: None,
        enrolled_courses: None,
        current_unit: None,
        other_doc_url: None,
        updated_at: Some(Utc::now()),
        is_email_verified: true,
        is_deleted_by_center_final: false,
        internship_domain: payload.internship_domain,
        internship_mode: payload.internship_mode,
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

    match user_collection.insert_one(new_user, None).await {
        Ok(res) => {
            let inserted_id = res.inserted_id.as_object_id().unwrap();
            (
                StatusCode::CREATED,
                Json(serde_json::json!({
                    "success": true,
                    "message": "Intern account created successfully".to_string(),
                    "id": Some(inserted_id.to_hex()),
                    "intern": {
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
                "message": format!("Database error creating intern: {}", e),
                "id": None as Option<String>
            })),
        ),
    }
}

pub async fn get_interns(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<serde_json::Value>) {
    println!("[get_interns] Called with claims role: {:?}", claims.role);
    let user_collection = db.collection::<User>("users");
    let mut filter = doc! { "role": "intern", "is_deleted": false };

    if claims.role == UserRole::Center {
        let center_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!([]))),
        };
        filter.insert("parent_id", center_id);
    }

    println!("[get_interns] Filter: {:?}", filter);

    // First, let's get raw documents without deserializing to User first
    let raw_collection = db.collection::<mongodb::bson::Document>("users");
    let mut raw_cursor = match raw_collection.find(filter.clone(), None).await {
        Ok(c) => c,
        Err(e) => {
            println!("[get_interns] Raw find database error: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!([])),
            );
        }
    };
    let mut raw_results = vec![];
    while let Some(result) = raw_cursor.next().await {
        match result {
            Ok(doc) => {
                println!("[get_interns] Raw document found: {:?}", doc);
                raw_results.push(doc);
            }
            Err(e) => {
                println!("[get_interns] Error iterating raw cursor: {:?}", e);
            }
        }
    }
    println!("[get_interns] Raw documents count: {}", raw_results.len());

    let mut cursor = match user_collection.find(filter, None).await {
        Ok(c) => c,
        Err(e) => {
            println!("[get_interns] Database error: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!([])),
            );
        }
    };

    let mut results = vec![];
    use futures_util::stream::StreamExt;
    let mut index = 0;
    while let Some(result) = cursor.next().await {
        match result {
            Ok(user) => {
                println!(
                    "[get_interns] Intern {}: _id={:?}, role={:?}, active={:?}, username={:?}, email={:?}, internship_domain={:?}, internship_mode={:?}",
                    index,
                    user.id,
                    user.role,
                    user.active,
                    user.username,
                    user.email,
                    user.internship_domain,
                    user.internship_mode
                );
                println!("[get_interns] Intern {} COMPLETE: {:?}", index, user);
                results.push(PublicIntern::from(user));
                index += 1;
            }
            Err(e) => {
                println!("[get_interns] Error iterating cursor: {:?}", e);
            }
        }
    }

    println!(
        "[get_interns] Total count of interns found: {}",
        results.len()
    );
    (StatusCode::OK, Json(serde_json::json!(results)))
}

pub async fn delete_intern(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<CreateInternResponse>) {
    if claims.role != UserRole::Center
        && claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
    {
        return (
            StatusCode::FORBIDDEN,
            Json(CreateInternResponse {
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
                Json(CreateInternResponse {
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
                    Json(CreateInternResponse {
                        success: false,
                        message: "Invalid center ID".to_string(),
                    }),
                );
            }
        };
        let intern = user_collection
            .find_one(doc! { "_id": obj_id, "parent_id": center_id }, None)
            .await;
        if let Ok(None) = intern {
            return (
                StatusCode::NOT_FOUND,
                Json(CreateInternResponse {
                    success: false,
                    message: "Intern not found".to_string(),
                }),
            );
        }
    }

    let now = Utc::now();

    match user_collection
        .update_one(
            doc! { "_id": obj_id },
            doc! { "$set": { "is_deleted": true, "deleted_at": now, "active": false, "is_deleted_by_center_final": false } },
            None,
        )
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(CreateInternResponse {
                success: true,
                message: "Intern moved to recycle bin".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CreateInternResponse {
                success: false,
                message: "Delete failed".to_string(),
            }),
        ),
    }
}

pub async fn get_intern(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    let user_collection = db.collection::<User>("users");
    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!(null))),
    };

    let mut filter = doc! { "_id": oid, "role": "intern" };
    if claims.role == UserRole::Center {
        let center_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!(null))),
        };
        filter.insert("parent_id", center_id);
    }

    let user = match user_collection.find_one(filter, None).await {
        Ok(u) => u,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!(null)),
            );
        }
    };

    (
        StatusCode::OK,
        Json(serde_json::json!(user.map(PublicIntern::from))),
    )
}

pub async fn update_intern(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<UpdateInternRequest>,
) -> (StatusCode, Json<CreateInternResponse>) {
    println!("[update_intern] Called with id={}", id);
    // 2. Print COMPLETE request body received
    println!("[update_intern] COMPLETE request body: {:?}", payload);

    if claims.role != UserRole::Center
        && claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
    {
        println!("[update_intern] Unauthorized");
        return (
            StatusCode::FORBIDDEN,
            Json(CreateInternResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let user_collection = db.collection::<User>("users");
    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(e) => {
            println!("[update_intern] Invalid ID: {:?}", e);
            return (
                StatusCode::BAD_REQUEST,
                Json(CreateInternResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    // 1. Print COMPLETE document before update
    let current_intern = user_collection.find_one(doc! { "_id": oid }, None).await;
    println!(
        "[update_intern] COMPLETE document before update: {:?}",
        current_intern
    );
    if let Ok(Some(ref intern)) = current_intern {
        println!(
            "[update_intern] Key fields before update: _id={:?}, role={:?}, active={:?}, username={:?}, email={:?}, internship_domain={:?}, internship_mode={:?}",
            intern.id,
            intern.role,
            intern.active,
            intern.username,
            intern.email,
            intern.internship_domain,
            intern.internship_mode
        );
    }

    let mut filter = doc! { "_id": oid, "role": "intern" };
    if claims.role == UserRole::Center {
        let center_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(e) => {
                println!("[update_intern] Invalid center ID: {:?}", e);
                return (
                    StatusCode::BAD_REQUEST,
                    Json(CreateInternResponse {
                        success: false,
                        message: "Invalid Center ID".to_string(),
                    }),
                );
            }
        };
        filter.insert("parent_id", center_id);
    }

    println!("[update_intern] Filter: {:?}", filter);

    let mut update_doc = doc! {};
    if let Some(v) = payload.full_name {
        update_doc.insert("full_name", v);
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
        update_doc.insert("email", v.clone());
        update_doc.insert("username", v);
    }
    if let Some(v) = payload.phone {
        update_doc.insert("phone", v);
    }
    if let Some(v) = payload.course {
        update_doc.insert("course", v);
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
    }
    if let Some(v) = payload.national_id_type {
        update_doc.insert("national_id_type", v);
    }
    if let Some(v) = payload.national_id {
        update_doc.insert("national_id", v);
    }
    if let Some(v) = payload.national_id_url {
        update_doc.insert("national_id_url", v);
    }
    if let Some(v) = payload.highest_qualification {
        update_doc.insert("highest_qualification", v);
    }
    if let Some(v) = payload.college {
        update_doc.insert("college", v);
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
    }
    if let Some(v) = payload.enrollment_number {
        update_doc.insert("enrollment_number", v);
    }
    if let Some(v) = payload.serial_number {
        update_doc.insert("serial_number", v);
    }
    if let Some(v) = payload.registration_date {
        update_doc.insert("registration_date", v);
    }
    if let Some(v) = payload.photo_url {
        update_doc.insert("photo_url", v);
    }
    if let Some(v) = payload.signature_url {
        update_doc.insert("signature_url", v);
    }
    if let Some(v) = payload.session_id {
        if let Ok(oid) = ObjectId::parse_str(&v) {
            update_doc.insert("session_id", oid);
        }
    }
    if let Some(v) = payload.session_start_date {
        update_doc.insert("session_start_date", v);
    }
    if let Some(v) = payload.session_end_date {
        update_doc.insert("session_end_date", v);
    }

    if let Some(v) = payload.internship_domain {
        update_doc.insert("internship_domain", v);
    }

    if let Some(v) = payload.internship_mode {
        update_doc.insert("internship_mode", v);
    }

    if let Some(v) = payload.referral_code {
        update_doc.insert("referral_code", v);
    }
    if let Some(v) = payload.referred_by_code {
        update_doc.insert("referred_by_code", v);
    }
    if let Some(v) = payload.applied_coupon {
        update_doc.insert("applied_coupon", v);
    }

    if let Some(password) = payload.password {
        if !password.trim().is_empty() {
            if let Ok(h) = hash(&password, DEFAULT_COST) {
                update_doc.insert("password_hash", h);
                update_doc.insert("raw_password", password);
            }
        }
    }

    update_doc.insert("updated_at", Utc::now());
    // 3. Print COMPLETE update payload sent to MongoDB
    println!(
        "[update_intern] COMPLETE update payload to MongoDB: {:?}",
        doc! { "$set": &update_doc }
    );

    let update_result = user_collection
        .update_one(filter, doc! { "$set": update_doc }, None)
        .await;

    println!("[update_intern] Update result: {:?}", update_result);

    // 4. Print COMPLETE document after update
    let updated_intern = user_collection.find_one(doc! { "_id": oid }, None).await;
    println!(
        "[update_intern] COMPLETE document after update: {:?}",
        updated_intern
    );
    // 5. Print key fields after update
    if let Ok(Some(ref intern)) = updated_intern {
        println!(
            "[update_intern] Key fields after update: _id={:?}, role={:?}, active={:?}, username={:?}, email={:?}, internship_domain={:?}, internship_mode={:?}",
            intern.id,
            intern.role,
            intern.active,
            intern.username,
            intern.email,
            intern.internship_domain,
            intern.internship_mode
        );
    }

    // Immediately after successful update, fresh database fetch by _id
    println!("[update_intern] Performing fresh database fetch by _id after update...");
    let fresh_fetch = user_collection.find_one(doc! { "_id": oid }, None).await;
    println!(
        "[update_intern] COMPLETE fresh fetched document after update: {:?}",
        fresh_fetch
    );
    if let Ok(Some(ref intern)) = fresh_fetch {
        println!(
            "[update_intern] Fresh fetch key fields: _id={:?}, role={:?}, active={:?}, is_deleted={:?}",
            intern.id, intern.role, intern.active, intern.is_deleted
        );
    }

    // Also check if it's still in get_interns filter
    let check_intern = user_collection
        .find_one(
            doc! { "_id": oid, "role": "intern", "is_deleted": false },
            None,
        )
        .await;
    println!("[update_intern] Check intern in filter: {:?}", check_intern);

    match update_result {
        Ok(_) => (
            StatusCode::OK,
            Json(CreateInternResponse {
                success: true,
                message: "Intern updated successfully".to_string(),
            }),
        ),
        Err(e) => {
            println!("[update_intern] Update failed with error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(CreateInternResponse {
                    success: false,
                    message: "Update failed".to_string(),
                }),
            )
        }
    }
}

pub async fn get_intern_progress(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<InternProgress>>) {
    let user_collection = db.collection::<User>("users");
    let task_collection = db.collection::<InternTask>("intern_tasks");
    let attendance_collection = db.collection::<InternAttendance>("intern_attendance");

    // Get all interns
    let mut filter = doc! { "role": "intern", "is_deleted": false };
    if claims.role == UserRole::Center {
        let center_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(vec![])),
        };
        filter.insert("parent_id", center_id);
    }

    let mut intern_cursor = match user_collection.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut interns = vec![];
    use futures_util::stream::StreamExt;
    while let Some(result) = intern_cursor.next().await {
        if let Ok(intern) = result {
            interns.push(intern);
        }
    }

    let mut progress_list = vec![];

    for intern in interns {
        let intern_id = intern
            .id
            .ok_or_else(|| ObjectId::parse_str("").unwrap())
            .unwrap();
        let intern_name = intern.full_name.unwrap_or("Unknown".to_string());

        // Get attendance for this intern
        let attendance_filter = doc! { "intern_id": intern_id };
        let mut attendance_cursor = match attendance_collection.find(attendance_filter, None).await
        {
            Ok(c) => c,
            Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
        };

        let mut attendance_records = vec![];
        while let Some(result) = attendance_cursor.next().await {
            if let Ok(record) = result {
                attendance_records.push(record);
            }
        }

        let attendance_percentage = if attendance_records.is_empty() {
            0.0
        } else {
            let present_days = attendance_records
                .iter()
                .filter(|r| r.status == "present")
                .count() as f64;
            (present_days / attendance_records.len() as f64) * 100.0
        };

        // Get tasks for this intern
        let task_filter = doc! { "intern_id": intern_id };
        let mut task_cursor = match task_collection.find(task_filter, None).await {
            Ok(c) => c,
            Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
        };

        let mut tasks = vec![];
        while let Some(result) = task_cursor.next().await {
            if let Ok(task) = result {
                tasks.push(task);
            }
        }

        let total_tasks = tasks.len() as u32;
        let pending_tasks = tasks.iter().filter(|t| t.status == "pending").count() as u32;
        let in_progress_tasks = tasks.iter().filter(|t| t.status == "in_progress").count() as u32;
        let completed_tasks = tasks.iter().filter(|t| t.status == "completed").count() as u32;

        let task_completion_rate = if total_tasks == 0 {
            0.0
        } else {
            (completed_tasks as f64 / total_tasks as f64) * 100.0
        };

        let overall_progress_percentage =
            (attendance_percentage * 0.5) + (task_completion_rate * 0.5);

        progress_list.push(InternProgress {
            intern_id: intern_id.to_hex(),
            intern_name,
            attendance_percentage,
            total_tasks,
            pending_tasks,
            in_progress_tasks,
            completed_tasks,
            task_completion_rate,
            overall_progress_percentage,
        });
    }

    (StatusCode::OK, Json(progress_list))
}

pub async fn get_single_intern_progress(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<Option<InternProgress>>) {
    let user_collection = db.collection::<User>("users");
    let task_collection = db.collection::<InternTask>("intern_tasks");
    let attendance_collection = db.collection::<InternAttendance>("intern_attendance");

    let intern_oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(None)),
    };

    // Get intern
    let mut filter = doc! { "_id": intern_oid, "role": "intern", "is_deleted": false };
    if claims.role == UserRole::Center {
        let center_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(None)),
        };
        filter.insert("parent_id", center_id);
    }

    let intern = match user_collection.find_one(filter, None).await {
        Ok(u) => u,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(None)),
    };

    let intern = match intern {
        Some(i) => i,
        None => return (StatusCode::NOT_FOUND, Json(None)),
    };

    let intern_name = intern.full_name.unwrap_or("Unknown".to_string());

    // Get attendance for this intern
    let attendance_filter = doc! { "intern_id": intern_oid };
    let mut attendance_cursor = match attendance_collection.find(attendance_filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(None)),
    };

    let mut attendance_records = vec![];
    while let Some(result) = attendance_cursor.next().await {
        if let Ok(record) = result {
            attendance_records.push(record);
        }
    }

    let attendance_percentage = if attendance_records.is_empty() {
        0.0
    } else {
        let present_days = attendance_records
            .iter()
            .filter(|r| r.status == "present")
            .count() as f64;
        (present_days / attendance_records.len() as f64) * 100.0
    };

    // Get tasks for this intern
    let task_filter = doc! { "intern_id": intern_oid };
    let mut task_cursor = match task_collection.find(task_filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(None)),
    };

    let mut tasks = vec![];
    while let Some(result) = task_cursor.next().await {
        if let Ok(task) = result {
            tasks.push(task);
        }
    }

    let total_tasks = tasks.len() as u32;
    let pending_tasks = tasks.iter().filter(|t| t.status == "pending").count() as u32;
    let in_progress_tasks = tasks.iter().filter(|t| t.status == "in_progress").count() as u32;
    let completed_tasks = tasks.iter().filter(|t| t.status == "completed").count() as u32;

    let task_completion_rate = if total_tasks == 0 {
        0.0
    } else {
        (completed_tasks as f64 / total_tasks as f64) * 100.0
    };

    let overall_progress_percentage = (attendance_percentage * 0.5) + (task_completion_rate * 0.5);

    let progress = InternProgress {
        intern_id: intern_oid.to_hex(),
        intern_name,
        attendance_percentage,
        total_tasks,
        pending_tasks,
        in_progress_tasks,
        completed_tasks,
        task_completion_rate,
        overall_progress_percentage,
    };

    (StatusCode::OK, Json(Some(progress)))
}

pub async fn check_intern_email_exists(
    State(db): State<Database>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> (StatusCode, Json<serde_json::Value>) {
    let email = match params.get("email") {
        Some(e) => e,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "exists": false, "error": "Email is required" })),
            );
        }
    };

    let exclude_id = params.get("excludeId");

    let user_collection = db.collection::<User>("users");
    let mut filter = doc! { "email": email, "is_deleted": false };

    if let Some(id) = exclude_id {
        if let Ok(oid) = ObjectId::parse_str(id) {
            filter.insert("_id", doc! { "$ne": oid });
        }
    }

    match user_collection.find_one(filter, None).await {
        Ok(Some(_)) => (StatusCode::OK, Json(serde_json::json!({ "exists": true }))),
        Ok(None) => (StatusCode::OK, Json(serde_json::json!({ "exists": false }))),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "exists": false, "error": "Database error" })),
        ),
    }
}

pub async fn check_intern_enrollment_exists(
    State(db): State<Database>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> (StatusCode, Json<serde_json::Value>) {
    let enrollment = match params.get("enrollmentNumber") {
        Some(e) => e,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(
                    serde_json::json!({ "exists": false, "error": "Enrollment number is required" }),
                ),
            );
        }
    };

    let exclude_id = params.get("excludeId");

    let user_collection = db.collection::<User>("users");
    let mut filter = doc! { "enrollment_number": enrollment, "is_deleted": false };

    if let Some(id) = exclude_id {
        if let Ok(oid) = ObjectId::parse_str(id) {
            filter.insert("_id", doc! { "$ne": oid });
        }
    }

    match user_collection.find_one(filter, None).await {
        Ok(Some(_)) => (StatusCode::OK, Json(serde_json::json!({ "exists": true }))),
        Ok(None) => (StatusCode::OK, Json(serde_json::json!({ "exists": false }))),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "exists": false, "error": "Database error" })),
        ),
    }
}

pub async fn check_intern_serial_exists(
    State(db): State<Database>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> (StatusCode, Json<serde_json::Value>) {
    let serial = match params.get("serialNumber") {
        Some(s) => s,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "exists": false, "error": "Serial number is required" })),
            );
        }
    };

    let exclude_id = params.get("excludeId");

    let user_collection = db.collection::<User>("users");
    let mut filter = doc! { "serial_number": serial, "is_deleted": false };

    if let Some(id) = exclude_id {
        if let Ok(oid) = ObjectId::parse_str(id) {
            filter.insert("_id", doc! { "$ne": oid });
        }
    }

    match user_collection.find_one(filter, None).await {
        Ok(Some(_)) => (StatusCode::OK, Json(serde_json::json!({ "exists": true }))),
        Ok(None) => (StatusCode::OK, Json(serde_json::json!({ "exists": false }))),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "exists": false, "error": "Database error" })),
        ),
    }
}
