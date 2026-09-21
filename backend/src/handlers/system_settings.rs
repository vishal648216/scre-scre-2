use axum::{extract::{State, Multipart}, http::StatusCode, Json};
use mongodb::{Database, bson::doc};
use serde::{Serialize, Deserialize};
use crate::authz::require_admin;
use crate::models::user::{UserRole, Claims};
use crate::models::system_settings::{system_settings_singleton_id, SystemSettings};
use std::env;
use chrono::{Datelike, Utc};
use chrono_tz::Asia::Kolkata;

/// Fields safe for the marketing site / unauthenticated clients (no disk quotas / internal ops).
/// JSON uses **snake_case** to match existing frontend (`students_trained`, `cursor_url`, etc.).
#[derive(Debug, Serialize, Clone)]
pub struct PublicSystemSettings {
    /// Used by authenticated messaging UI; safe to expose (boolean flag only).
    pub is_messaging_wall_enabled: bool,
    pub cursor_url: Option<String>,
    pub students_trained: i32,
    pub courses_offered: i32,
    pub placements_done: i32,
    pub years_experience: i32,
    pub popup_enabled: Option<bool>,
    pub popup_title: Option<String>,
    pub popup_subtitle: Option<String>,
    pub popup_accent_text: Option<String>,
    pub popup_image_url: Option<String>,
    pub popup_bg_color: Option<String>,
    pub popup_text_color: Option<String>,
    pub popup_button_text: Option<String>,
    pub popup_button_link: Option<String>,
    pub maintenance_mode: bool,
    pub contact_phone: String,
    pub contact_email: String,
    pub contact_address: String,
    pub contact_map_url: String,
}

impl From<SystemSettings> for PublicSystemSettings {
    fn from(s: SystemSettings) -> Self {
        PublicSystemSettings {
            is_messaging_wall_enabled: s.is_messaging_wall_enabled,
            cursor_url: s.cursor_url,
            students_trained: s.students_trained,
            courses_offered: s.courses_offered,
            placements_done: s.placements_done,
            years_experience: s.years_experience,
            popup_enabled: s.popup_enabled,
            popup_title: s.popup_title,
            popup_subtitle: s.popup_subtitle,
            popup_accent_text: s.popup_accent_text,
            popup_image_url: s.popup_image_url,
            popup_bg_color: s.popup_bg_color,
            popup_text_color: s.popup_text_color,
            popup_button_text: s.popup_button_text,
            popup_button_link: s.popup_button_link,
            maintenance_mode: s.maintenance_mode,
            contact_phone: s.contact_phone,
            contact_email: s.contact_email,
            contact_address: s.contact_address,
            contact_map_url: s.contact_map_url,
        }
    }
}

pub async fn get_public_system_settings(
    State(db): State<Database>,
) -> (StatusCode, Json<PublicSystemSettings>) {
    let collection = db.collection::<SystemSettings>("system_settings");
    let singleton_id = system_settings_singleton_id();
    let loaded = match collection.find_one(doc! { "_id": singleton_id }, None).await {
        Ok(Some(s)) => Ok(Some(s)),
        Ok(None) => collection.find_one(None, None).await,
        Err(e) => Err(e),
    };
    match loaded {
        Ok(Some(settings)) => (StatusCode::OK, Json(PublicSystemSettings::from(settings))),
        Ok(None) => (StatusCode::OK, Json(PublicSystemSettings::from(SystemSettings::default()))),
        Err(e) => {
            eprintln!("Failed to fetch public system settings: {}", e);
            (StatusCode::OK, Json(PublicSystemSettings::from(SystemSettings::default())))
        }
    }
}

pub async fn get_server_time() -> (StatusCode, Json<serde_json::Value>) {
    let now_utc = Utc::now();
    let now_ist = now_utc.with_timezone(&Kolkata);
    (
        StatusCode::OK,
        Json(serde_json::json!({
            "now": now_utc.to_rfc3339(),
            "timestamp": now_utc.timestamp_millis(),
            "ist": {
                "formatted": now_ist.format("%Y-%m-%d %I:%M:%S %p").to_string(),
                "time": now_ist.format("%I:%M:%S %p").to_string(),
                "date": now_ist.format("%Y-%m-%d").to_string(),
                "offset": "+05:30"
            }
        })),
    )
}

/// Full settings document — **admin / superadmin only**.
pub async fn get_system_settings(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<SystemSettings>) {
    if !require_admin(&claims) {
        return (StatusCode::FORBIDDEN, Json(SystemSettings::default()));
    }
    let collection = db.collection::<SystemSettings>("system_settings");
    let singleton_id = system_settings_singleton_id();
    let loaded = match collection.find_one(doc! { "_id": singleton_id }, None).await {
        Ok(Some(s)) => Ok(Some(s)),
        Ok(None) => collection.find_one(None, None).await,
        Err(e) => Err(e),
    };
    match loaded {
        Ok(Some(mut settings)) => {
            settings.razorpay_key_secret_encrypted = None;
            settings.razorpay_webhook_secret_encrypted = None;
            (StatusCode::OK, Json(settings))
        },
        Ok(None) => (StatusCode::OK, Json(SystemSettings::default())),
        Err(e) => {
            eprintln!("Failed to fetch/deserialize system settings: {}", e);
            (StatusCode::OK, Json(SystemSettings::default()))
        }
    }
}

// We need a separate payload type because we don't want to expose encrypted secrets
#[derive(Debug, Deserialize)]
pub struct UpdateSystemSettingsRequest {
    pub is_messaging_wall_enabled: bool,
    pub max_disk_space_gb: f64,
    pub storage_warning_threshold: f64,
    pub cursor_url: Option<String>,
    pub students_trained: i32,
    pub courses_offered: i32,
    pub placements_done: i32,
    pub years_experience: i32,
    pub popup_enabled: Option<bool>,
    pub popup_title: Option<String>,
    pub popup_subtitle: Option<String>,
    pub popup_accent_text: Option<String>,
    pub popup_image_url: Option<String>,
    pub popup_bg_color: Option<String>,
    pub popup_text_color: Option<String>,
    pub popup_button_text: Option<String>,
    pub popup_button_link: Option<String>,
    pub auto_id_card_enabled: bool,
    pub auto_id_card_template_id: Option<String>,
    pub auto_id_card_delay_minutes: u32,
    pub enrollment_prefix: String,
    pub roll_number_prefix: String,
    pub generate_roll_at_registration: bool,
    pub maintenance_mode: bool,
    pub contact_phone: String,
    pub contact_email: String,
    pub contact_address: String,
    pub contact_map_url: String,
    pub auto_exam_enabled: bool,
    pub auto_exam_allotment_day: Option<i32>,
    pub auto_exam_day: Option<i32>,
    pub auto_exam_time: Option<String>,
    pub auto_exam_subject_gap_minutes: i32,
    pub auto_marksheet_generation_days: i32,
    pub auto_certificate_generation_days: i32,
    // Payment gateway related
    pub payment_gateway_enabled: bool,
    pub razorpay_key_id: Option<String>,
    pub razorpay_key_secret: Option<String>, // New secret to set (if present, encrypt and save)
    pub razorpay_webhook_secret: Option<String>, // New secret to set (if present, encrypt and save)
}

#[derive(Debug, Deserialize)]
pub struct UpdateAutoExamSettingsRequest {
    pub auto_exam_enabled: bool,
    pub auto_exam_allotment_day: Option<i32>,
    pub auto_exam_day: Option<i32>,
    pub auto_exam_time: Option<String>,
    pub auto_exam_subject_gap_minutes: i32,
}

pub async fn update_auto_exam_settings(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<UpdateAutoExamSettingsRequest>,
) -> (StatusCode, Json<SystemSettings>) {
    if claims.role != UserRole::SuperAdmin && claims.role != UserRole::Admin {
        return (StatusCode::FORBIDDEN, Json(SystemSettings::default()));
    }

    let collection = db.collection::<SystemSettings>("system_settings");
    let singleton_id = system_settings_singleton_id();
    let filter = doc! { "_id": singleton_id };
    
    // Load existing settings first to preserve all other existing settings.
    // Backward-compatible: prefer singleton, else fall back to any legacy row.
    let existing_singleton = collection.find_one(filter.clone(), None).await.unwrap_or_default();
    let existing = match existing_singleton {
        Some(s) => Some(s),
        None => collection.find_one(None, None).await.unwrap_or_default(),
    };
    let was_enabled = existing.as_ref().map(|e| e.auto_exam_enabled).unwrap_or(false);
    let now_enabled = payload.auto_exam_enabled;
    let triggered_auto_cycle = now_enabled && !was_enabled;

    let mut settings = existing.unwrap_or_default();
    settings.id = Some(singleton_id);
    let now_ist = Utc::now().with_timezone(&Kolkata);
    let fallback_day = now_ist.day() as i32;
    let allotment_day = payload
        .auto_exam_allotment_day
        .or(settings.auto_exam_allotment_day)
        .or(Some(fallback_day));
    let exam_day = payload
        .auto_exam_day
        .or(payload.auto_exam_allotment_day)
        .or(settings.auto_exam_day)
        .or(allotment_day);
    let auto_exam_time = payload
        .auto_exam_time
        .or_else(|| settings.auto_exam_time.clone())
        .or(Some("09:00".to_string()));
    
    // Update only auto exam fields
    settings.auto_exam_enabled = payload.auto_exam_enabled;
    settings.auto_exam_allotment_day = allotment_day;
    settings.auto_exam_day = exam_day;
    settings.auto_exam_time = auto_exam_time;
    settings.auto_exam_subject_gap_minutes = payload.auto_exam_subject_gap_minutes.max(0);

    let options = mongodb::options::ReplaceOptions::builder().upsert(true).build();

    match collection.replace_one(filter, &settings, options).await {
        Ok(_) => {
            if triggered_auto_cycle {
                let db_clone = db.clone();
                tokio::spawn(async move {
                    eprintln!(
                        "[system_settings] auto_exam_enabled toggled ON → triggering auto exam allotment cycle"
                    );
                    crate::services::exam_auto_scheduler::run_auto_exam_allotment_cycle(&db_clone, true)
                        .await;
                });
            }
            let mut response = settings.clone();
            response.razorpay_key_secret_encrypted = None;
            response.razorpay_webhook_secret_encrypted = None;
            (StatusCode::OK, Json(response))
        }
        Err(e) => {
            eprintln!("Failed to save auto exam settings: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(SystemSettings::default()))
        }
    }
}

pub async fn update_system_settings(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<UpdateSystemSettingsRequest>,
) -> (StatusCode, Json<SystemSettings>) {
    if claims.role != UserRole::SuperAdmin && claims.role != UserRole::Admin {
        return (StatusCode::FORBIDDEN, Json(SystemSettings::default()));
    }

    let collection = db.collection::<SystemSettings>("system_settings");
    let singleton_id = system_settings_singleton_id();
    let filter = doc! { "_id": singleton_id };
    let auto_tid = payload
        .auto_id_card_template_id
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());
        
    // Load existing settings first to preserve existing encrypted secrets if not provided.
    // Backward-compatible: prefer singleton, else fall back to any legacy row.
    let existing_singleton = collection.find_one(filter.clone(), None).await.unwrap_or_default();
    let existing = match existing_singleton {
        Some(s) => Some(s),
        None => collection.find_one(None, None).await.unwrap_or_default(),
    };
    let was_enabled = existing.as_ref().map(|e| e.auto_exam_enabled).unwrap_or(false);
    let now_enabled = payload.auto_exam_enabled;
    let triggered_auto_cycle = now_enabled && !was_enabled;

    let mut settings = existing.unwrap_or_default();
    settings.id = Some(singleton_id);
    
    // Update non-secret fields
    settings.is_messaging_wall_enabled = payload.is_messaging_wall_enabled;
    settings.max_disk_space_gb = payload.max_disk_space_gb;
    settings.storage_warning_threshold = payload.storage_warning_threshold;
    settings.cursor_url = payload.cursor_url;
    settings.students_trained = payload.students_trained;
    settings.courses_offered = payload.courses_offered;
    settings.placements_done = payload.placements_done;
    settings.years_experience = payload.years_experience;
    settings.popup_enabled = payload.popup_enabled;
    settings.popup_title = payload.popup_title;
    settings.popup_subtitle = payload.popup_subtitle;
    settings.popup_accent_text = payload.popup_accent_text;
    settings.popup_image_url = payload.popup_image_url;
    settings.popup_bg_color = payload.popup_bg_color;
    settings.popup_text_color = payload.popup_text_color;
    settings.popup_button_text = payload.popup_button_text;
    settings.popup_button_link = payload.popup_button_link;
    settings.auto_id_card_enabled = payload.auto_id_card_enabled;
    settings.auto_id_card_template_id = auto_tid;
    settings.auto_id_card_delay_minutes = payload.auto_id_card_delay_minutes;
    settings.enrollment_prefix = payload.enrollment_prefix;
    settings.roll_number_prefix = payload.roll_number_prefix;
    settings.generate_roll_at_registration = payload.generate_roll_at_registration;
    settings.maintenance_mode = payload.maintenance_mode;
    settings.contact_phone = payload.contact_phone;
    settings.contact_email = payload.contact_email;
    settings.contact_address = payload.contact_address;
    settings.contact_map_url = payload.contact_map_url;
    settings.auto_exam_enabled = payload.auto_exam_enabled;
    settings.auto_exam_allotment_day = payload.auto_exam_allotment_day;
    settings.auto_exam_day = payload.auto_exam_day;
    settings.auto_exam_time = payload.auto_exam_time;
    settings.auto_exam_subject_gap_minutes = payload.auto_exam_subject_gap_minutes;
    settings.auto_marksheet_generation_days = payload.auto_marksheet_generation_days;
    settings.auto_certificate_generation_days = payload.auto_certificate_generation_days;
    settings.payment_gateway_enabled = payload.payment_gateway_enabled;
    settings.razorpay_key_id = payload.razorpay_key_id;
    
    // Update secrets only if provided
    if let Some(secret) = payload.razorpay_key_secret {
        if !secret.trim().is_empty() {
            if let Err(e) = settings.set_razorpay_key_secret(&secret) {
                eprintln!("Failed to encrypt Razorpay key secret: {}", e);
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(SystemSettings::default()));
            }
        }
    }
    if let Some(secret) = payload.razorpay_webhook_secret {
        if !secret.trim().is_empty() {
            if let Err(e) = settings.set_razorpay_webhook_secret(&secret) {
                eprintln!("Failed to encrypt Razorpay webhook secret: {}", e);
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(SystemSettings::default()));
            }
        }
    }

    let options = mongodb::options::ReplaceOptions::builder().upsert(true).build();

    match collection.replace_one(filter, &settings, options).await {
        Ok(_) => {
            if triggered_auto_cycle {
                let db_clone = db.clone();
                tokio::spawn(async move {
                    eprintln!(
                        "[system_settings] full update: auto_exam_enabled toggled ON → triggering auto exam allotment cycle"
                    );
                    crate::services::exam_auto_scheduler::run_auto_exam_allotment_cycle(&db_clone, true)
                        .await;
                });
            }
            // Don't return encrypted secrets to frontend, so create a copy without them
            let mut response = settings.clone();
            response.razorpay_key_secret_encrypted = None;
            response.razorpay_webhook_secret_encrypted = None;
            (StatusCode::OK, Json(response))
        }
        Err(e) => {
            eprintln!("Failed to save system settings: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(SystemSettings::default()))
        }
    }
}

pub async fn upload_cursor(
    State(db): State<Database>,
    claims: Claims,
    mut multipart: Multipart,
) -> (StatusCode, Json<crate::handlers::upload::UploadResponse>) {
    if claims.role != UserRole::SuperAdmin && claims.role != UserRole::Admin {
        return (
            StatusCode::FORBIDDEN,
            Json(crate::handlers::upload::UploadResponse {
                success: false,
                url: None,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let mut saved_url: Option<String> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().map(|s| s.to_string()).unwrap_or_default();
        if name != "file" {
            continue;
        }

        let file_name = field
            .file_name()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "cursor.png".to_string());

        let ext = file_name
            .rsplit('.')
            .next()
            .map(|s| format!(".{}", s))
            .unwrap_or_else(|| ".png".to_string());

        let base_dir = env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string());
        let dir_path = format!("{}/system", base_dir);
        let new_name = format!("cursor{}", ext);
        let full_path = format!("{}/{}", dir_path, new_name);

        if let Err(e) = tokio::fs::create_dir_all(&dir_path).await {
            eprintln!("Failed to create system upload dir: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(crate::handlers::upload::UploadResponse {
                    success: false,
                    url: None,
                    message: "Failed to prepare upload directory".to_string(),
                }),
            );
        }

        // Read entire field into memory (cursors are small, usually < 1MB)
        let bytes = match field.bytes().await {
            Ok(b) => b,
            Err(e) => {
                eprintln!("Failed reading cursor field bytes: {}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(crate::handlers::upload::UploadResponse {
                        success: false,
                        url: None,
                        message: "Failed to read upload data".to_string(),
                    }),
                );
            }
        };

        if bytes.is_empty() {
            return (
                StatusCode::BAD_REQUEST,
                Json(crate::handlers::upload::UploadResponse {
                    success: false,
                    url: None,
                    message: "Uploaded file is empty".to_string(),
                }),
            );
        }

        if let Err(e) = tokio::fs::write(&full_path, &bytes).await {
            eprintln!("Failed to write cursor file {}: {}", full_path, e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(crate::handlers::upload::UploadResponse {
                    success: false,
                    url: None,
                    message: "Failed to save file to disk".to_string(),
                }),
            );
        }

        saved_url = Some(format!("/uploads/system/{}?v={}", new_name, Utc::now().timestamp()));
        break; // Only process one file
    }

    if let Some(url) = saved_url {
        let collection = db.collection::<mongodb::bson::Document>("system_settings");
        let filter = doc! {};
        let update = doc! { "$set": { "cursor_url": &url } };
        let options = mongodb::options::UpdateOptions::builder().upsert(true).build();

        if let Err(e) = collection.update_one(filter, update, options).await {
            eprintln!("Failed to update cursor_url in settings: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(crate::handlers::upload::UploadResponse {
                    success: false,
                    url: None,
                    message: "Failed to update database".to_string(),
                }),
            );
        }

        return (
            StatusCode::OK,
            Json(crate::handlers::upload::UploadResponse {
                success: true,
                url: Some(url),
                message: "Cursor uploaded successfully".to_string(),
            }),
        );
    }

    (
        StatusCode::BAD_REQUEST,
        Json(crate::handlers::upload::UploadResponse {
            success: false,
            url: None,
            message: "No file uploaded".to_string(),
        }),
    )
}
