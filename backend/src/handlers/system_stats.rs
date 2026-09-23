use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use mongodb::{Database, bson::doc};
use serde::{Serialize, Deserialize};
use crate::models::user::{Claims, UserRole};
use crate::models::system_settings::SystemSettings;
use std::process::Command;
use std::path::Path;

#[derive(Debug, Serialize)]
pub struct SystemStatsResponse {
    pub total_capacity_gb: f64,
    pub used_capacity_gb: f64,
    pub database_size_gb: f64,
    pub media_assets_gb: f64,
    pub student_docs_gb: f64,
    pub course_materials_gb: f64,
    pub profile_images_gb: f64,
    pub system_logs_gb: f64,
    pub max_disk_space_gb: f64,
    pub storage_warning_threshold: f64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSystemStatsRequest {
    pub max_disk_space_gb: f64,
    pub storage_warning_threshold: f64,
}

pub async fn get_system_stats(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<serde_json::Value>) {
    // Both SuperAdmin and Admin can view system stats
    if claims.role != UserRole::SuperAdmin && claims.role != UserRole::Admin {
        return (StatusCode::FORBIDDEN, Json(serde_json::json!({"message": "Forbidden"})));
    }

    // Fetch settings
    let settings_coll = db.collection::<SystemSettings>("system_settings");
    let settings = settings_coll.find_one(None, None).await.unwrap_or(None).unwrap_or_default();

    // 1. Get Disk Usage
    let total_cap = settings.max_disk_space_gb;
    let mut used_cap = 0.0;
    if let Ok(output) = Command::new("df").arg("-BG").arg("/").output() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let lines: Vec<&str> = stdout.lines().collect();
        if lines.len() > 1 {
            let parts: Vec<&str> = lines[1].split_whitespace().collect();
            if parts.len() > 2 {
                // Actual system used space
                used_cap = parts[2].replace('G', "").parse::<f64>().unwrap_or(0.0);
            }
        }
    }

    // 2. Get MongoDB Size
    let mut db_size = 0.0;
    if let Ok(stats) = db.run_command(doc! { "dbStats": 1 }, None).await {
        if let Ok(data_size) = stats.get_f64("dataSize") {
            db_size = data_size / (1024.0 * 1024.0 * 1024.0); // Convert to GB
        } else if let Ok(data_size) = stats.get_i32("dataSize") {
            db_size = (data_size as f64) / (1024.0 * 1024.0 * 1024.0);
        } else if let Ok(data_size) = stats.get_i64("dataSize") {
            db_size = (data_size as f64) / (1024.0 * 1024.0 * 1024.0);
        }
    }

    // 3. Get Directory Sizes
    let upload_dir = std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string());
    let media_size = get_dir_size_gb(&upload_dir);
    let student_docs = get_dir_size_gb(&format!("{}/documents", upload_dir));
    let profile_images = get_dir_size_gb(&format!("{}/profiles", upload_dir));
    let course_materials = get_dir_size_gb(&format!("{}/courses", upload_dir));
    let logs_size = get_dir_size_gb("backend/backend.log").max(0.01);

    (StatusCode::OK, Json(serde_json::json!({
        "total_capacity_gb": total_cap,
        "used_capacity_gb": used_cap,
        "database_size_gb": db_size,
        "media_assets_gb": media_size,
        "student_docs_gb": student_docs,
        "course_materials_gb": course_materials,
        "profile_images_gb": profile_images,
        "system_logs_gb": logs_size,
        "max_disk_space_gb": settings.max_disk_space_gb,
        "storage_warning_threshold": settings.storage_warning_threshold,
    })))
}

pub async fn update_system_stats(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<UpdateSystemStatsRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    // Only SuperAdmin can edit system limits
    if claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(serde_json::json!({"success": false, "message": "Only SuperAdmin can edit system limits"})));
    }

    let settings_coll = db.collection::<SystemSettings>("system_settings");
    let filter = doc! {};
    let update = doc! {
        "$set": {
            "max_disk_space_gb": payload.max_disk_space_gb,
            "storage_warning_threshold": payload.storage_warning_threshold,
        }
    };

    let options = mongodb::options::UpdateOptions::builder().upsert(true).build();
    match settings_coll.update_one(filter, update, options).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"success": true, "message": "System limits updated successfully"}))),
        Err(e) => {
            eprintln!("[ERROR] Failed to update system limits: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"success": false, "message": format!("Failed to update system limits: {}", e)})))
        },
    }
}

fn get_dir_size_gb(path: &str) -> f64 {
    if !Path::new(path).exists() {
        return 0.0;
    }
    
    if let Ok(output) = Command::new("du").arg("-sk").arg(path).output() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Some(first_part) = stdout.split_whitespace().next() {
            if let Ok(kb) = first_part.parse::<f64>() {
                return kb / (1024.0 * 1024.0); // Convert KB to GB
            }
        }
    }
    0.0
}
