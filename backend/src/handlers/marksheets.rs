//! Legacy `/api/marksheets` routes used by Center dashboard and student certificates UI.
//! Primary exam marksheets live under `/api/exam-v2/marksheets`; this keeps older clients from 404ing.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use futures_util::{StreamExt, TryStreamExt};
use mongodb::{bson::doc, Database};

use crate::models::user::{Claims, UserRole};

/// GET /api/marksheets — list rows from the `marksheets` collection (may be empty).
pub async fn list_marksheets(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<mongodb::bson::Document>>) {
    if !matches!(
        claims.role,
        UserRole::Admin | UserRole::SuperAdmin | UserRole::Center | UserRole::Student
    ) {
        return (StatusCode::FORBIDDEN, Json(vec![]));
    }

    // Try primary certificates collection first (modern marksheet store)
    let certs_coll = db.collection::<mongodb::bson::Document>("certificates");
    let mut certs_filter = doc! {};
    if claims.role == UserRole::Center {
        if let Ok(oid) = mongodb::bson::oid::ObjectId::parse_str(&claims.sub) {
            certs_filter.insert("center_id", oid);
        }
    } else if claims.role == UserRole::Student {
        if let Ok(oid) = mongodb::bson::oid::ObjectId::parse_str(&claims.sub) {
            certs_filter.insert("student_id", oid);
        }
    }
    
    // For student/center, only show approved marksheets
    // --- REMOVED ADMIN INTERACTION: Marksheets are always "approved" by default for students to see ---
    // if claims.role == UserRole::Student || claims.role == UserRole::Center {
    //     certs_filter.insert("status", "approved");
    // }

    let mut docs = Vec::new();
    if let Ok(mut cursor) = certs_coll.find(certs_filter, None).await {
        while let Some(Ok(mut doc)) = cursor.next().await {
            doc.remove("background_url");
            docs.push(doc);
        }
    }

    // Legacy marksheets collection fallback
    let coll = db.collection::<mongodb::bson::Document>("marksheets");
    let mut filter = doc! {};
    if claims.role == UserRole::Center {
        if let Ok(oid) = mongodb::bson::oid::ObjectId::parse_str(&claims.sub) {
            filter.insert("center_id", oid);
        } else {
            return (StatusCode::BAD_REQUEST, Json(vec![]));
        }
    } else if claims.role == UserRole::Student {
        if let Ok(oid) = mongodb::bson::oid::ObjectId::parse_str(&claims.sub) {
            filter.insert("student_id", oid);
        } else {
            return (StatusCode::BAD_REQUEST, Json(vec![]));
        }
    }

    if let Ok(mut cursor) = coll.find(filter, None).await {
        while let Some(Ok(doc)) = cursor.next().await {
            docs.push(doc);
        }
    }

    (StatusCode::OK, Json(docs))
}

/// GET /api/marksheets/:id/download — stream PDF if `pdf_url` / `file_path` exists on the document.
pub async fn download_marksheet(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> Result<axum::response::Response, StatusCode> {
    use axum::body::Body;
    use axum::http::header;
    use std::path::PathBuf;
    use tokio::fs;
    use tokio::io::AsyncReadExt;

    if !matches!(
        claims.role,
        UserRole::Admin | UserRole::SuperAdmin | UserRole::Center | UserRole::Student
    ) {
        return Err(StatusCode::FORBIDDEN);
    }

    let oid = mongodb::bson::oid::ObjectId::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;
    
    // Try both collections for the document
    let coll = db.collection::<mongodb::bson::Document>("marksheets");
    let certs_coll = db.collection::<mongodb::bson::Document>("certificates");
    
    let doc = if let Ok(Some(d)) = coll.find_one(doc! { "_id": oid }, None).await {
        d
    } else if let Ok(Some(d)) = certs_coll.find_one(doc! { "_id": oid }, None).await {
        d
    } else {
        return Err(StatusCode::NOT_FOUND);
    };

    if claims.role == UserRole::Student {
        let sid =
            mongodb::bson::oid::ObjectId::parse_str(&claims.sub).map_err(|_| StatusCode::BAD_REQUEST)?;
        match doc.get_object_id("student_id") {
            Ok(doc_sid) if doc_sid == sid => {}
            _ => {
                // If it's not in marksheet, check certificates collection
                let certs_coll = db.collection::<mongodb::bson::Document>("certificates");
                let _cert_doc = certs_coll
                    .find_one(doc! { "_id": oid, "student_id": sid }, None)
                    .await
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
                    .ok_or(StatusCode::FORBIDDEN)?;
                // If we reach here, student owns it
            }
        }
    } else if claims.role == UserRole::Center {
        let cid =
            mongodb::bson::oid::ObjectId::parse_str(&claims.sub).map_err(|_| StatusCode::BAD_REQUEST)?;
        match doc.get_object_id("center_id") {
            Ok(doc_cid) if doc_cid == cid => {}
            _ => {
                // If it's not in marksheet, check certificates collection
                let certs_coll = db.collection::<mongodb::bson::Document>("certificates");
                let _cert_doc = certs_coll
                    .find_one(doc! { "_id": oid, "center_id": cid }, None)
                    .await
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
                    .ok_or(StatusCode::FORBIDDEN)?;
                // If we reach here, center owns it
            }
        }
    }

    let upload_dir = std::env::var("UPLOAD_DIR")
        .unwrap_or_else(|_| "/var/www/html/scre/backend/uploads".to_string());
    let upload_pb = PathBuf::from(&upload_dir);
    let backend_dir = PathBuf::from("/var/www/html/scre/backend");
    let public_dir = PathBuf::from("/var/www/html/scre/public");
    let public_uploads_dir = public_dir.join("uploads");

    let file_path_opt = doc.get("file_path").and_then(|b| match b {
        mongodb::bson::Bson::String(s) if !s.is_empty() => Some(s.clone()),
        _ => None,
    });
    let pdf_url_opt = doc.get("pdf_url").and_then(|b| match b {
        mongodb::bson::Bson::String(s) if !s.is_empty() => Some(s.clone()),
        _ => None,
    });
    let pdf_path_opt = doc.get("pdf_path").and_then(|b| match b {
        mongodb::bson::Bson::String(s) if !s.is_empty() => Some(s.clone()),
        _ => None,
    });
    let certificate_no = doc.get_str("certificate_no").ok();
    eprintln!("download_marksheet: id={}, cert_no={:?}, file_path={:?}, pdf_url={:?}, pdf_path={:?}",
        id, certificate_no, file_path_opt, pdf_url_opt, pdf_path_opt);

    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some(ref p) = file_path_opt {
        let pb = PathBuf::from(p);
        candidates.push(pb.clone());
        if pb.is_relative() {
            candidates.push(upload_pb.join(p));
            candidates.push(backend_dir.join(p));
            candidates.push(public_dir.join(p));
            candidates.push(public_uploads_dir.join(p));
        }
    }
    if let Some(ref p) = pdf_url_opt {
        let normalized = p.trim_start_matches('/').trim_start_matches("uploads/").to_string();
        candidates.push(upload_pb.join(&normalized));
        candidates.push(backend_dir.join(&normalized));
        candidates.push(public_dir.join(&normalized));
        candidates.push(public_uploads_dir.join(&normalized));
    }
    if let Some(ref p) = pdf_path_opt {
        let pb = PathBuf::from(p);
        candidates.push(pb.clone());
        if pb.is_relative() {
            candidates.push(upload_pb.join(p));
            candidates.push(backend_dir.join(p));
            candidates.push(public_dir.join(p));
            candidates.push(public_uploads_dir.join(p));
        }
    }
    // Also try certificate_no fallback if available (both certificates and marksheets folders)
    if let Some(ref cn) = certificate_no {
        // Certificates folder
        let cert_file = format!("certificates/{}.pdf", cn);
        candidates.push(upload_pb.join(&cert_file));
        candidates.push(backend_dir.join(&cert_file));
        candidates.push(public_dir.join(&cert_file));
        candidates.push(public_uploads_dir.join(&cert_file));
        // Marksheets folder
        let marksheet_file = format!("marksheets/{}.pdf", cn);
        candidates.push(upload_pb.join(&marksheet_file));
        candidates.push(backend_dir.join(&marksheet_file));
        candidates.push(public_dir.join(&marksheet_file));
        candidates.push(public_uploads_dir.join(&marksheet_file));
        // Root of uploads
        candidates.push(upload_pb.join(format!("{}.pdf", cn)));
        candidates.push(backend_dir.join(format!("{}.pdf", cn)));
        candidates.push(public_uploads_dir.join(format!("{}.pdf", cn)));
    }

    let mut seen = std::collections::HashSet::<PathBuf>::new();
    for path in candidates {
        if !seen.insert(path.clone()) {
            continue;
        }
        eprintln!("download_marksheet_candidate: checking path {:?}", path);
        if !path.exists() {
            eprintln!("download_marksheet_candidate: path {:?} does not exist", path);
            continue;
        }
        match fs::read(&path).await {
            Ok(data) => {
                let file_name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("Marksheet.pdf");
                let data_len = data.len();
                let header_take = std::cmp::min(16, data_len);
                let header_bytes: Vec<u8> = data.iter().take(header_take).copied().collect();
                let header_text = String::from_utf8_lossy(&header_bytes);
                eprintln!(
                    "[MARKSHEET_DOWNLOAD] serving file {:?} size={} bytes Content-Type=application/pdf Content-Length={} header_hex={} header_text={:?}",
                    path, data_len, data_len,
                    header_bytes.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
                    header_text
                );
                if !header_text.starts_with("%PDF-") {
                    eprintln!(
                        "[MARKSHEET_DOWNLOAD] FATAL: file {:?} is NOT a PDF! Header bytes: {:02X?}",
                        path, header_bytes
                    );
                }
                let res = axum::response::Response::builder()
                    .status(StatusCode::OK)
                    .header(header::CONTENT_TYPE, "application/pdf")
                    .header(header::CONTENT_LENGTH, data_len.to_string())
                    .header(
                        header::CONTENT_DISPOSITION,
                        &format!("attachment; filename=\"{}\"", file_name),
                    )
                    .body(Body::from(data))
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
                return Ok(res);
            },
            Err(e) => {
                eprintln!("Failed to read marksheet file at {:?}: {}", path, e);
            }
        }
    }

    Err(StatusCode::NOT_FOUND)
}
