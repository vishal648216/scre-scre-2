use axum::{
    Json,
    extract::{Multipart, State},
    http::StatusCode,
};
use chrono::Utc;
use mongodb::Database;
use serde::Serialize;
use tokio::io::AsyncWriteExt;

use crate::models::user::{Claims, UserRole};

#[derive(Debug, Serialize)]
pub struct UploadResponse {
    pub success: bool,
    pub url: Option<String>,
    pub message: String,
}

pub async fn upload_file(
    State(_db): State<Database>,
    claims: Claims,
    mut multipart: Multipart,
) -> (StatusCode, Json<UploadResponse>) {
    // Allow admin, center and students to upload files
    // Students can upload practical exam responses
    if claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
        && claims.role != UserRole::Center
        && claims.role != UserRole::Student
    {
        return (
            StatusCode::FORBIDDEN,
            Json(UploadResponse {
                success: false,
                url: None,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let mut saved_url: Option<String> = None;

    loop {
        let field_result = multipart.next_field().await;
        let mut field = match field_result {
            Ok(Some(f)) => f,
            Ok(None) => break,
            Err(e) => {
                eprintln!("Error reading multipart field: {}", e);
                continue;
            }
        };
        let name = field.name().map(|s| s.to_string()).unwrap_or_default();
        if name != "file" {
            continue;
        }
        let file_name = field
            .file_name()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "upload.bin".to_string());

        // Build a safe-ish filename with timestamp
        let ts = Utc::now().timestamp_millis();
        let ext = file_name
            .rsplit('.')
            .next()
            .map(|s| format!(".{}", s))
            .unwrap_or_else(|| "".to_string());

        let role_folder = match claims.role {
            UserRole::Center => "centers",
            UserRole::Admin | UserRole::SuperAdmin => "admins",
            UserRole::Student => "students",
            _ => "other",
        };

        let new_name = format!("{}_{}{}", role_folder, ts, ext);

        let base_dir = std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string());
        let dir_path = format!("{}/{}", base_dir, role_folder);

        if let Err(e) = tokio::fs::create_dir_all(&dir_path).await {
            eprintln!("Failed to create upload dir: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(UploadResponse {
                    success: false,
                    url: None,
                    message: "Failed to prepare upload directory".to_string(),
                }),
            );
        }

        let full_path = format!("{}/{}", dir_path, new_name);
        let mut file = match tokio::fs::File::create(&full_path).await {
            Ok(f) => f,
            Err(e) => {
                eprintln!("Failed to create upload file: {}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(UploadResponse {
                        success: false,
                        url: None,
                        message: "Failed to create upload file".to_string(),
                    }),
                );
            }
        };

        // Stream the file content
        let mut total_bytes = 0u64;
        while let Some(chunk) = field.chunk().await.transpose() {
            match chunk {
                Ok(data) => {
                    total_bytes += data.len() as u64;
                    if let Err(e) = file.write_all(&data).await {
                        eprintln!("Failed to write chunk to file: {}", e);
                        let _ = tokio::fs::remove_file(&full_path).await;
                        return (
                            StatusCode::INTERNAL_SERVER_ERROR,
                            Json(UploadResponse {
                                success: false,
                                url: None,
                                message: "Failed to write file".to_string(),
                            }),
                        );
                    }
                }
                Err(e) => {
                    eprintln!("Failed to read chunk: {}", e);
                    let _ = tokio::fs::remove_file(&full_path).await;
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(UploadResponse {
                            success: false,
                            url: None,
                            message: "Failed to read upload data".to_string(),
                        }),
                    );
                }
            }
        }

        if total_bytes == 0 {
            let _ = tokio::fs::remove_file(&full_path).await;
            continue;
        }

        // Public URL path that frontend can use (served by static handler)
        saved_url = Some(format!("/uploads/{}/{}", role_folder, new_name));
        break;
    }

    if let Some(url) = saved_url {
        (
            StatusCode::OK,
            Json(UploadResponse {
                success: true,
                url: Some(url),
                message: "File uploaded".to_string(),
            }),
        )
    } else {
        (
            StatusCode::BAD_REQUEST,
            Json(UploadResponse {
                success: false,
                url: None,
                message: "No file field provided".to_string(),
            }),
        )
    }
}
