use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
};
use std::time::Duration;

use crate::models::email_otp::EmailOtp;
use crate::models::user::{Claims, User, UserRole};
use crate::services::email_service::send_otp_email;
use crate::services::translation_service::{IpRateLimit, check_rate_limit};
use crate::util::http::client_ip;
use bcrypt::{DEFAULT_COST, hash, verify};
use chrono::{Duration as ChronoDuration, Utc};
use jsonwebtoken::{EncodingKey, Header, encode};
use mongodb::{Database, bson::doc, bson::oid::ObjectId};
use rand::Rng;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::env;

#[derive(Debug, Deserialize)]
pub struct SendOtpRequest {
    pub email: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifyOtpRequest {
    pub email: String,
    pub otp: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub success: bool,
    pub message: String,
}

pub async fn send_email_otp(
    State(db): State<Database>,
    headers: HeaderMap,
    Json(payload): Json<SendOtpRequest>,
) -> (StatusCode, Json<AuthResponse>) {
    let ip = client_ip(&headers);
    let ip_limiter = IpRateLimit {
        limit: 8,
        window: Duration::from_secs(3600),
    };
    if !check_rate_limit(&format!("otp_ip:{ip}"), &ip_limiter) {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(AuthResponse {
                success: false,
                message: "Too many OTP requests. Please try again later.".to_string(),
            }),
        );
    }
    let email_key = payload.email.trim().to_lowercase();
    let email_limiter = IpRateLimit {
        limit: 5,
        window: Duration::from_secs(3600),
    };
    if !check_rate_limit(&format!("otp_email:{email_key}"), &email_limiter) {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(AuthResponse {
                success: false,
                message: "Too many OTP requests for this email. Please try again later."
                    .to_string(),
            }),
        );
    }

    let otp: String = rand::thread_rng().gen_range(100000..999999).to_string();

    let otp_hash = match hash(&otp, DEFAULT_COST) {
        Ok(h) => h,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AuthResponse {
                    success: false,
                    message: "Internal error".to_string(),
                }),
            );
        }
    };

    let expires_at = Utc::now() + ChronoDuration::minutes(5);

    let otp_doc = EmailOtp {
        id: None,
        email: payload.email.clone(),
        otp_hash,
        expires_at,
        verified: false,
        created_at: Utc::now(),
    };

    let collection = db.collection::<EmailOtp>("email_otps");

    // Invalidate any previous OTPs for this email
    let _ = collection
        .delete_many(doc! { "email": &payload.email }, None)
        .await;

    if let Err(_) = collection.insert_one(otp_doc, None).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(AuthResponse {
                success: false,
                message: "Failed to store OTP".to_string(),
            }),
        );
    }

    match send_otp_email(&payload.email, &otp).await {
        Ok(_) => (
            StatusCode::OK,
            Json(AuthResponse {
                success: true,
                message: "OTP sent successfully".to_string(),
            }),
        ),
        Err(e) => {
            eprintln!("Email error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AuthResponse {
                    success: false,
                    message: "Failed to send email".to_string(),
                }),
            )
        }
    }
}

pub async fn verify_email_otp(
    State(db): State<Database>,
    Json(payload): Json<VerifyOtpRequest>,
) -> (StatusCode, Json<AuthResponse>) {
    let collection = db.collection::<EmailOtp>("email_otps");

    let otp_record = match collection
        .find_one(doc! { "email": &payload.email, "verified": false }, None)
        .await
    {
        Ok(Some(r)) => r,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(AuthResponse {
                    success: false,
                    message: "No active OTP found for this email".to_string(),
                }),
            );
        }
    };

    if Utc::now() > otp_record.expires_at {
        return (
            StatusCode::BAD_REQUEST,
            Json(AuthResponse {
                success: false,
                message: "OTP has expired".to_string(),
            }),
        );
    }

    if !verify(&payload.otp, &otp_record.otp_hash).unwrap_or(false) {
        return (
            StatusCode::BAD_REQUEST,
            Json(AuthResponse {
                success: false,
                message: "Invalid OTP".to_string(),
            }),
        );
    }

    match collection
        .update_one(
            doc! { "_id": otp_record.id.unwrap() },
            doc! { "$set": { "verified": true } },
            None,
        )
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(AuthResponse {
                success: true,
                message: "OTP verified successfully".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(AuthResponse {
                success: false,
                message: "Verification failed".to_string(),
            }),
        ),
    }
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub success: bool,
    pub message: String,
    pub token: Option<String>,
    pub role: Option<UserRole>,
    pub username: Option<String>,
    pub photo_url: Option<String>,
    pub user_id: Option<String>,
    pub email: Option<String>,
    pub exam_mode: Option<String>,
    pub _id: Option<String>,
    pub full_name: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub course: Option<String>,
    pub enrollment_number: Option<String>,
    pub roll_number: Option<String>,
}

pub async fn login(
    State(db): State<Database>,
    headers: HeaderMap,
    Json(payload): Json<LoginRequest>,
) -> (StatusCode, Json<LoginResponse>) {
    println!(
        "[login] Got login request with username: {:?}",
        payload.username
    );
    let ip = client_ip(&headers);
    let login_limiter = IpRateLimit {
        limit: 40,
        window: Duration::from_secs(300),
    };
    if !check_rate_limit(&format!("login:{ip}"), &login_limiter) {
        println!("[login] Rate limited");
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(LoginResponse {
                success: false,
                message: "Too many login attempts. Please try again later.".to_string(),
                token: None,
                role: None,
                username: None,
                photo_url: None,
                user_id: None,
                email: None,
                exam_mode: None,
                _id: None,
                full_name: None,
                first_name: None,
                last_name: None,
                course: None,
                enrollment_number: None,
                roll_number: None,
            }),
        );
    }

    let raw_users = db.collection::<mongodb::bson::Document>("users");
    let raw_filter = doc! {
        "$or": [
            { "username": &payload.username },
            { "email": &payload.username }
        ],
        "is_deleted": false
    };

    println!("[login] Raw filter: {:?}", raw_filter);
    let raw_user = raw_users.find_one(raw_filter, None).await;
    println!("[login] Raw user result: {:?}", raw_user);

    let users = db.collection::<User>("users");
    let user_result = users
        .find_one(
            doc! {
                "$or": [
                    { "username": &payload.username },
                    { "email": &payload.username }
                ],
                "is_deleted": false
            },
            None,
        )
        .await;
    println!("[login] User find result: {:?}", user_result);

    let user = match user_result {
        Ok(Some(user)) => {
            println!("[login] Found user: {:?}", user);
            if !user.active {
                println!("[login] User is inactive");
                return (
                    StatusCode::UNAUTHORIZED,
                    Json(LoginResponse {
                        success: false,
                        message: "Account is inactive. Please contact administrator.".to_string(),
                        token: None,
                        role: None,
                        username: None,
                        photo_url: None,
                        user_id: None,
                        email: None,
                        exam_mode: None,
                        _id: None,
                        full_name: None,
                        first_name: None,
                        last_name: None,
                        course: None,
                        enrollment_number: None,
                        roll_number: None,
                    }),
                );
            }
            user
        }
        Ok(None) => {
            println!("[login] User not found");
            return (
                StatusCode::UNAUTHORIZED,
                Json(LoginResponse {
                    success: false,
                    message: "Invalid username or password".to_string(),
                    token: None,
                    role: None,
                    username: None,
                    photo_url: None,
                    user_id: None,
                    email: None,
                    exam_mode: None,
                    _id: None,
                    full_name: None,
                    first_name: None,
                    last_name: None,
                    course: None,
                    enrollment_number: None,
                    roll_number: None,
                }),
            );
        }
        Err(e) => {
            println!("[login] Database error: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(LoginResponse {
                    success: false,
                    message: "Internal server error".to_string(),
                    token: None,
                    role: None,
                    username: None,
                    photo_url: None,
                    user_id: None,
                    email: None,
                    exam_mode: None,
                    _id: None,
                    full_name: None,
                    first_name: None,
                    last_name: None,
                    course: None,
                    enrollment_number: None,
                    roll_number: None,
                }),
            );
        }
    };

    println!("[login] Verifying password...");
    println!("[login] Payload password: {:?}", payload.password);
    println!("[login] User password hash: {:?}", user.password_hash);
    if !verify(&payload.password, &user.password_hash).unwrap_or(false) {
        println!("[login] Password verification failed");
        return (
            StatusCode::UNAUTHORIZED,
            Json(LoginResponse {
                success: false,
                message: "Invalid username or password".to_string(),
                token: None,
                role: None,
                username: None,
                photo_url: None,
                user_id: None,
                email: None,
                exam_mode: None,
                _id: None,
                full_name: None,
                first_name: None,
                last_name: None,
                course: None,
                enrollment_number: None,
                roll_number: None,
            }),
        );
    }
    println!("[login] Password verified");

    let sub = match user.id {
        Some(oid) => oid.to_hex(),
        None => {
            println!("[login] User has no id");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(LoginResponse {
                    success: false,
                    message: "User record missing id".to_string(),
                    token: None,
                    role: None,
                    username: None,
                    photo_url: None,
                    user_id: None,
                    email: None,
                    exam_mode: None,
                    _id: None,
                    full_name: None,
                    first_name: None,
                    last_name: None,
                    course: None,
                    enrollment_number: None,
                    roll_number: None,
                }),
            );
        }
    };
    println!("[login] User sub: {}", sub);

    // Direct login without OTP for all users
    let needs_otp = false;

    if needs_otp {
        // Return success but NO token, signal UI to show OTP input
        return (
            StatusCode::OK,
            Json(LoginResponse {
                success: true,
                message: "Verification required".to_string(),
                token: None,
                role: Some(user.role.clone()),
                username: Some(user.username.clone()),
                photo_url: user.photo_url.clone(),
                user_id: Some(sub.clone()),
                email: user.email.clone(),
                exam_mode: user.exam_mode.clone(),
                _id: Some(sub.clone()),
                full_name: user.full_name.clone(),
                first_name: user.first_name.clone(),
                last_name: user.last_name.clone(),
                course: user.course.clone(),
                enrollment_number: user.enrollment_number.clone(),
                roll_number: user.roll_number.clone(),
            }),
        );
    }

    let now = Utc::now();
    // Expiration at midnight (00:00:00) of the next day
    let expiration = (now + chrono::Duration::days(1))
        .date_naive()
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_local_timezone(Utc)
        .unwrap()
        .timestamp() as usize;

    let claims = Claims {
        sub: sub.clone(),
        username: user.username.clone(),
        role: user.role.clone(),
        exp: expiration,
    };

    let jwt_secret =
        env::var("JWT_SECRET").unwrap_or_else(|_| "default_secret_key_change_me".to_string());
    let token = match encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_ref()),
    ) {
        Ok(t) => t,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(LoginResponse {
                    success: false,
                    message: "Failed to generate token".to_string(),
                    token: None,
                    role: None,
                    username: None,
                    photo_url: None,
                    user_id: None,
                    email: None,
                    exam_mode: None,
                    _id: None,
                    full_name: None,
                    first_name: None,
                    last_name: None,
                    course: None,
                    enrollment_number: None,
                    roll_number: None,
                }),
            );
        }
    };

    (
        StatusCode::OK,
        Json(LoginResponse {
            success: true,
            message: "Login successful".to_string(),
            token: Some(token),
            role: Some(user.role),
            username: Some(user.username),
            photo_url: user.photo_url,
            user_id: Some(sub.clone()),
            email: user.email,
            exam_mode: user.exam_mode,
            _id: Some(sub),
            full_name: user.full_name,
            first_name: user.first_name,
            last_name: user.last_name,
            course: user.course,
            enrollment_number: user.enrollment_number,
            roll_number: user.roll_number,
        }),
    )
}

#[derive(Debug, Deserialize)]
pub struct CreateAdminRequest {
    pub username: String,
    pub password: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub full_name: Option<String>,
    #[serde(default)]
    pub role_name: Option<String>,
    #[serde(default)]
    pub role_id: Option<String>,
    #[serde(default)]
    pub permissions: Option<serde_json::Value>,
}

pub async fn create_admin(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateAdminRequest>,
) -> (StatusCode, Json<LoginResponse>) {
    if claims.role != UserRole::SuperAdmin && claims.role != UserRole::Admin {
        return (
            StatusCode::FORBIDDEN,
            Json(LoginResponse {
                success: false,
                message: "Unauthorized: Administrative privileges required".to_string(),
                token: None,
                role: None,
                username: None,
                photo_url: None,
                user_id: None,
                email: None,
                exam_mode: None,
                _id: None,
                full_name: None,
                first_name: None,
                last_name: None,
                course: None,
                enrollment_number: None,
                roll_number: None,
            }),
        );
    }

    let collection = db.collection::<User>("users");

    // Check duplicate username
    if let Ok(Some(_)) = collection
        .find_one(doc! { "username": &payload.username }, None)
        .await
    {
        return (
            StatusCode::CONFLICT,
            Json(LoginResponse {
                success: false,
                message: "Admin username already exists".to_string(),
                token: None,
                role: None,
                username: None,
                photo_url: None,
                user_id: None,
                email: None,
                exam_mode: None,
                _id: None,
                full_name: None,
                first_name: None,
                last_name: None,
                course: None,
                enrollment_number: None,
                roll_number: None,
            }),
        );
    }

    // Validate email format and uniqueness if provided
    let clean_email = payload.email.as_ref().map(|e| e.trim().to_lowercase());
    if let Some(ref em) = clean_email {
        if !em.is_empty() {
            if !em.contains('@') || !em.contains('.') {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(LoginResponse {
                        success: false,
                        message: "Please enter a valid email address".to_string(),
                        token: None,
                        role: None,
                        username: None,
                        photo_url: None,
                        user_id: None,
                        email: None,
                        exam_mode: None,
                        _id: None,
                        full_name: None,
                        first_name: None,
                        last_name: None,
                        course: None,
                        enrollment_number: None,
                        roll_number: None,
                    }),
                );
            }
            if let Ok(Some(_)) = collection.find_one(doc! { "email": em }, None).await {
                return (
                    StatusCode::CONFLICT,
                    Json(LoginResponse {
                        success: false,
                        message: "An account with this email address already exists".to_string(),
                        token: None,
                        role: None,
                        username: None,
                        photo_url: None,
                        user_id: None,
                        email: None,
                        exam_mode: None,
                        _id: None,
                        full_name: None,
                        first_name: None,
                        last_name: None,
                        course: None,
                        enrollment_number: None,
                        roll_number: None,
                    }),
                );
            }
        }
    }

    let hashed_password = hash(&payload.password, DEFAULT_COST).expect("hashing failed");
    let role_oid = payload.role_id.as_deref().and_then(|s| ObjectId::parse_str(s).ok());
    let perms: Option<crate::models::staff::SubAdminPermissions> = payload.permissions.and_then(|p| serde_json::from_value(p).ok());

    let new_admin = User {
        id: None,
        username: payload.username,
        password_hash: hashed_password,
        raw_password: Some(payload.password),
        role: UserRole::Admin,
        parent_id: None,
        sub_admin_role_id: role_oid,
        sub_admin_role_name: payload.role_name,
        sub_admin_permissions: perms,
        full_name: payload.full_name,
        first_name: None,
        middle_name: None,
        last_name: None,
        email: clean_email,
        phone: payload.phone,
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
        approval_status: Some("approved".to_string()),
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
    };

    match collection.insert_one(new_admin, None).await {
        Ok(res) => {
            let id_str = res.inserted_id.as_object_id().map(|o| o.to_hex());
            (
                StatusCode::CREATED,
                Json(LoginResponse {
                    success: true,
                    message: "Admin created successfully".to_string(),
                    token: None,
                    role: Some(UserRole::Admin),
                    username: None,
                    photo_url: None,
                    user_id: id_str.clone(),
                    email: None,
                    exam_mode: None,
                    _id: id_str,
                    full_name: None,
                    first_name: None,
                    last_name: None,
                    course: None,
                    enrollment_number: None,
                    roll_number: None,
                }),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(LoginResponse {
                success: false,
                message: "Database error".to_string(),
                token: None,
                role: None,
                username: None,
                photo_url: None,
                user_id: None,
                email: None,
                exam_mode: None,
                _id: None,
                full_name: None,
                first_name: None,
                last_name: None,
                course: None,
                enrollment_number: None,
                roll_number: None,
            }),
        ),
    }
}

pub async fn seed_super_admin(db: &Database) {
    seed_super_admin_with_force(
        db,
        std::env::var("FORCE_RESET_SUPERADMIN").ok().as_deref() == Some("true"),
    )
    .await;
}

pub async fn get_current_user(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<serde_json::Value>) {
    let user_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "success": false,
                    "message": "Invalid user ID"
                })),
            );
        }
    };

    let users = db.collection::<User>("users");
    let user = match users.find_one(doc! { "_id": user_oid }, None).await {
        Ok(Some(u)) => u,
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({
                    "success": false,
                    "message": "User not found"
                })),
            );
        }
    };

    // Convert to JSON
    (
        StatusCode::OK,
        Json(json!({
            "success": true,
            "user": user
        })),
    )
}

pub async fn seed_super_admin_with_force(db: &Database, force: bool) {
    let collection = db.collection::<User>("users");
    let hashed_password = hash("Aditya@99918", DEFAULT_COST).expect("password hashing failed");

    match collection
        .find_one(doc! { "role": "superadmin" }, None)
        .await
    {
        Ok(Some(existing)) => {
            let desired_username = "super-admin";
            if force || existing.username != desired_username {
                if let Some(id) = existing.id {
                    let _ = collection
                        .update_one(
                            doc! { "_id": id },
                            doc! { "$set": {
                                "username": desired_username,
                                "password_hash": hashed_password,
                                "is_deleted": false,
                                "active": true,
                                "approval_status": "approved"
                            } },
                            None,
                        )
                        .await;
                }
            }
        }
        _ => {
            let super_admin = User {
                id: None,
                username: "super-admin".to_string(),
                password_hash: hashed_password,
                raw_password: Some("Aditya@99918".to_string()),
                role: UserRole::SuperAdmin,
                parent_id: None,
                sub_admin_role_id: None,
                sub_admin_role_name: None,
                sub_admin_permissions: None,
                full_name: Some("Super Admin".to_string()),
                first_name: None,
                middle_name: None,
                last_name: None,
                email: None,
                phone: None,
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
                approval_status: Some("approved".to_string()),
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
    };
            let _ = collection.insert_one(super_admin, None).await;
        }
    }
}
