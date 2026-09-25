use crate::models::center::Center;
use crate::models::id_card::IdCard;
use crate::models::user::{Claims, User, UserRole};
use axum::http::header;
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use base64::{Engine as _, engine::general_purpose};
use chrono::Utc;
use futures_util::stream::StreamExt;
use mongodb::{
    Database,
    bson::{doc, oid::ObjectId},
};
use qrcode::QrCode;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
pub struct ApplyIdCardRequest {
    pub student_ids: Vec<String>,
    pub template_id: String,
}

#[derive(Debug, Serialize)]
pub struct IdCardResponse {
    pub success: bool,
    pub message: String,
}

fn get_image_data_uri(path_or_url: &str) -> String {
    if path_or_url.is_empty() {
        return "https://via.placeholder.com/150".to_string();
    }

    if path_or_url.starts_with("data:") {
        return path_or_url.to_string();
    }

    // Skip local disk checks for remote URLs immediately
    if path_or_url.starts_with("http") {
        return path_or_url.to_string();
    }

    let mut normalized_path = path_or_url.to_string();
    if !normalized_path.starts_with('/') {
        normalized_path = format!("/{}", normalized_path);
    }

    // Try multiple possible locations for the file on disk
    let project_root = "/var/www/html/scre";
    let possible_paths = vec![
        // Absolute path
        PathBuf::from(normalized_path.clone()),
        // If relative to backend/uploads
        PathBuf::from(project_root)
            .join("backend")
            .join(normalized_path.trim_start_matches('/')),
        // If relative to backend/ (for cases where UPLOAD_DIR is just "uploads")
        PathBuf::from(project_root)
            .join("backend")
            .join("uploads")
            .join(normalized_path.trim_start_matches("/uploads/")),
        // If relative to public/
        PathBuf::from(project_root)
            .join("public")
            .join(normalized_path.trim_start_matches('/')),
        // If relative to root/uploads
        PathBuf::from(project_root).join(normalized_path.trim_start_matches('/')),
    ];

    for local_path in possible_paths {
        if local_path.exists() && local_path.is_file() {
            if let Ok(bytes) = std::fs::read(&local_path) {
                let extension = local_path
                    .extension()
                    .and_then(|s| s.to_str())
                    .unwrap_or("png")
                    .to_lowercase();
                let mime = match extension.as_str() {
                    "jpg" | "jpeg" => "image/jpeg",
                    "png" => "image/png",
                    "webp" => "image/webp",
                    "svg" => "image/svg+xml",
                    _ => "image/png",
                };
                return format!(
                    "data:{};base64,{}",
                    mime,
                    general_purpose::STANDARD.encode(bytes)
                );
            }
        }
    }

    // Special check for common upload path if not found above
    if normalized_path.starts_with("/uploads/") {
        let stripped = normalized_path.trim_start_matches("/uploads/");
        let alt_path = PathBuf::from(project_root)
            .join("backend")
            .join("uploads")
            .join(stripped);
        if alt_path.exists() && alt_path.is_file() {
            if let Ok(bytes) = std::fs::read(&alt_path) {
                let extension = alt_path
                    .extension()
                    .and_then(|s| s.to_str())
                    .unwrap_or("png")
                    .to_lowercase();
                let mime = match extension.as_str() {
                    "jpg" | "jpeg" => "image/jpeg",
                    "png" => "image/png",
                    "webp" => "image/webp",
                    "svg" => "image/svg+xml",
                    _ => "image/png",
                };
                return format!(
                    "data:{};base64,{}",
                    mime,
                    general_purpose::STANDARD.encode(bytes)
                );
            }
        }
    }

    // Fallback for remote URLs or if file not found
    if path_or_url.starts_with("http") {
        path_or_url.to_string()
    } else {
        // If it's a relative path and we couldn't find it, it's likely to fail in the PDF
        // return a placeholder instead of a broken relative path
        "https://via.placeholder.com/150".to_string()
    }
}

pub async fn apply_id_cards(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<ApplyIdCardRequest>,
) -> (StatusCode, Json<IdCardResponse>) {
    if claims.role != UserRole::Center {
        return (
            StatusCode::FORBIDDEN,
            Json(IdCardResponse {
                success: false,
                message: "Only centers can apply for ID cards".to_string(),
            }),
        );
    }

    let collection = db.collection::<IdCard>("id_cards");
    let student_coll = db.collection::<crate::models::erp_student::ErpStudent>("students");
    let center_user_id = ObjectId::parse_str(&claims.sub).unwrap();

    // Find center_id from centers collection
    let centers_coll = db.collection::<Center>("centers");
    let center_id = if let Ok(Some(center)) = centers_coll
        .find_one(doc! { "user_id": center_user_id }, None)
        .await
    {
        center.id.unwrap_or(center_user_id)
    } else {
        center_user_id
    };

    let template_oid = match ObjectId::parse_str(&payload.template_id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(IdCardResponse {
                    success: false,
                    message: "Invalid Template ID".to_string(),
                }),
            );
        }
    };

    let mut count = 0;
    for sid in payload.student_ids {
        if let Ok(student_oid) = ObjectId::parse_str(&sid) {
            if let Ok(Some(student)) = student_coll
                .find_one(doc! { "_id": student_oid }, None)
                .await
            {
                let id_card = IdCard {
                    id: None,
                    student_id: student_oid,
                    center_id,
                    enrollment_number: student.registration_number.clone(),
                    student_name: student.student_name.clone(),
                    father_name: student.father_name.clone(),
                    course_name: student.course.clone().unwrap_or_default(),
                    photo_url: student.photo.clone(),
                    validity_date: None,
                    issued_on: Utc::now(),
                    status: "pending_approval".to_string(),
                    pdf_url: None,
                    template_id: Some(template_oid),
                };
                let _ = collection.insert_one(id_card, None).await;
                count += 1;
            }
        }
    }

    (
        StatusCode::CREATED,
        Json(IdCardResponse {
            success: true,
            message: format!("Applied for {} ID cards", count),
        }),
    )
}

pub async fn list_id_cards(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<IdCard>>) {
    let collection = db.collection::<IdCard>("id_cards");
    let mut filter = doc! {};

    match claims.role {
        UserRole::Center => {
            let center_user_id = ObjectId::parse_str(&claims.sub).unwrap();
            let centers_coll = db.collection::<Center>("centers");
            if let Ok(Some(center)) = centers_coll
                .find_one(doc! { "user_id": center_user_id }, None)
                .await
            {
                filter.insert("center_id", center.id.unwrap_or(center_user_id));
            } else {
                filter.insert("center_id", center_user_id);
            }
        }
        UserRole::Admin | UserRole::SuperAdmin => {}
        _ => return (StatusCode::OK, Json(Vec::new())),
    }

    let mut cursor = collection.find(filter, None).await.unwrap();
    let mut cards = Vec::new();
    while let Some(Ok(card)) = cursor.next().await {
        cards.push(card);
    }
    (StatusCode::OK, Json(cards))
}

pub async fn approve_id_card(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<IdCardResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(IdCardResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(IdCardResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let collection = db.collection::<IdCard>("id_cards");
    match collection
        .update_one(
            doc! { "_id": oid },
            doc! { "$set": { "status": "approved" } },
            None,
        )
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(IdCardResponse {
                success: true,
                message: "ID Card approved".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(IdCardResponse {
                success: false,
                message: "Failed to approve".to_string(),
            }),
        ),
    }
}

pub async fn generate_student_id_card(
    State(db): State<Database>,
    claims: Claims,
    Path(student_id): Path<String>,
) -> impl IntoResponse {
    // Step 1: Validate student ID
    let s_oid = match ObjectId::parse_str(&student_id) {
        Ok(oid) => oid,
        Err(_) => {
            return (StatusCode::BAD_REQUEST, "Invalid student ID".to_string()).into_response();
        }
    };

    // Step 2: Fetch student data
    let user_coll = db.collection::<User>("users");
    let student = match user_coll.find_one(doc! { "_id": s_oid }, None).await {
        Ok(Some(u)) => u,
        _ => {
            return (StatusCode::NOT_FOUND, "Student not found".to_string()).into_response();
        }
    };

    // Step 3: Access control
    if claims.role == UserRole::Center {
        let center_user_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => {
                return (StatusCode::BAD_REQUEST, "Invalid center ID".to_string()).into_response();
            }
        };

        if student.parent_id != Some(center_user_id) {
            return (StatusCode::FORBIDDEN, "Unauthorized".to_string()).into_response();
        }
    } else if claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
        && claims.sub != student_id
    {
        return (StatusCode::FORBIDDEN, "Unauthorized".to_string()).into_response();
    }

    // Step 4: Fetch center data
    let center_coll = db.collection::<Center>("centers");
    let center = if let Some(parent_id) = student.parent_id {
        center_coll
            .find_one(doc! { "user_id": parent_id }, None)
            .await
            .ok()
            .flatten()
    } else {
        None
    };

    // Step 5: Prepare variables
    let logo_url = get_image_data_uri("/images/logo.jpeg");
    let iso_url = get_image_data_uri("/images/iso.webp");

    let enrollment_no = student
        .enrollment_number
        .as_ref()
        .filter(|e| !e.trim().is_empty())
        .cloned()
        .unwrap_or("---".to_string());

    let asc_name = center
        .as_ref()
        .map(|c| c.name.clone())
        .unwrap_or("---".to_string());

    let course_name = student
        .course
        .as_ref()
        .filter(|c| !c.trim().is_empty())
        .cloned()
        .unwrap_or("---".to_string());

    let student_name = student
        .full_name
        .as_ref()
        .filter(|n| !n.trim().is_empty())
        .cloned()
        .unwrap_or("---".to_string());

    let father_name = student
        .father_name
        .as_ref()
        .filter(|n| !n.trim().is_empty())
        .cloned()
        .unwrap_or("---".to_string());

    let mother_name = student
        .mother_name
        .as_ref()
        .filter(|n| !n.trim().is_empty())
        .cloned()
        .unwrap_or("---".to_string());

    let address = student
        .address
        .as_ref()
        .filter(|a| !a.trim().is_empty())
        .cloned()
        .unwrap_or("---".to_string());

    let mobile = student
        .phone
        .as_ref()
        .filter(|m| !m.trim().is_empty())
        .cloned()
        .unwrap_or("---".to_string());

    let email = student
        .email
        .as_ref()
        .filter(|e| !e.trim().is_empty())
        .cloned()
        .unwrap_or("---".to_string());

    let issued_date = student
        .session_start_date
        .as_ref()
        .filter(|d| !d.trim().is_empty())
        .cloned()
        .unwrap_or("---".to_string());

    let valid_till = student
        .session_end_date
        .as_ref()
        .filter(|d| !d.trim().is_empty())
        .cloned()
        .unwrap_or("---".to_string());

    let photo_url = student
        .photo_url
        .as_ref()
        .filter(|u| !u.trim().is_empty())
        .map(|u| get_image_data_uri(u))
        .unwrap_or("https://via.placeholder.com/150x200?text=Photo".to_string());

    let signature_url = student
        .signature_url
        .as_ref()
        .filter(|u| !u.trim().is_empty())
        .map(|u| get_image_data_uri(u))
        .unwrap_or("https://via.placeholder.com/150x50?text=Signature".to_string());

    // Step 6: Generate QR code
    let qr_data = format!(
        "ID:{}\nNAME:{}\nENROLLMENT:{}\nCOURSE:{}",
        student
            .id
            .map(|oid| oid.to_hex())
            .unwrap_or("---".to_string()),
        student_name,
        enrollment_no,
        course_name
    );
    let code = QrCode::new(qr_data.as_bytes()).unwrap();
    let size = code.width();
    let mut svg = String::from(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100\" height=\"100\" viewBox=\"0 0 ",
    );
    svg.push_str(&size.to_string());
    svg.push_str(" ");
    svg.push_str(&size.to_string());
    svg.push_str(
        "\" shape-rendering=\"crispEdges\"><rect width=\"100%\" height=\"100%\" fill=\"#ffffff\"/>",
    );
    for y in 0..size {
        for x in 0..size {
            if code[(x, y)] != qrcode::types::Color::Light {
                svg.push_str("<rect x=\"");
                svg.push_str(&x.to_string());
                svg.push_str("\" y=\"");
                svg.push_str(&y.to_string());
                svg.push_str("\" width=\"1\" height=\"1\" fill=\"#000000\"/>");
            }
        }
    }
    svg.push_str("</svg>");
    let qr_data_uri = format!(
        "data:image/svg+xml;base64,{}",
        general_purpose::STANDARD.encode(svg)
    );

    // Step 7: Build HTML template matching reference design
    let html = format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SCRE Student ID Card</title>
   <style>
    * {{
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }}  

    @page {{
        size: 85.6mm 54mm;
        margin: 0;
    }}

    body {{
        width: 85.6mm;
        height: 54mm;
        font-family: Arial, sans-serif;
        overflow: hidden;
        background: #fff;
    }}

    .id-card {{
        width: 100%;
        height: 100%;
        position: relative;
        border: 2px solid #0d47a1;
        overflow: hidden;
        background: #fff;
                }}

    .content {{
        position: relative;
        width: 100%;
        height: 100%;
        z-index: 2;
        display: flex;
        flex-direction: column;
    }}

    /* ===== HEADER ===== */
    .header {{
        width: 100%;
        display: grid;
        grid-template-columns: 20% 60% 20%;
        align-items: center;
        padding: 2px 4px;
        border-bottom: 2px solid #0d47a1;
    }}

    .logo-left {{
        display: flex;
        align-items: center;
        gap: 3px;
    }}

    .logo-img {{
        width: 18px;
        height: 18px;
        object-fit: contain;
    }}

    .logo-text {{
        font-size: 6pt;
        font-weight: 800;
        color: #d32f2f;
        line-height: 1;
    }}

    .header-center {{
        text-align: center;
        line-height: 1.2;
    }}

    .header-center h1 {{
        font-size: 7pt;
        font-weight: 900;
        color: #0d47a1;
    }}

    .header-center p {{
        font-size: 4.5pt;
        color: #333;
    }}

    .logo-right {{
        display: flex;
        justify-content: flex-end;
    }}

    .iso-img {{
        width: 22px;
        height: 22px;
        object-fit: contain;
    }}

    /* ===== TITLE BAR ===== */
    .title-bar {{
        display: flex;
        align-items: center;
        background: linear-gradient(90deg, #0d47a1, #1976d2);
        color: white;
        padding: 2px 5px;
        margin-top: 2px;
    }}

    .title-icon {{
        width: 14px;
        height: 14px;
        border: 1px solid #fff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 6pt;
        margin-right: 4px;
    }}

    .title-text {{
        font-size: 7pt;
        font-weight: 800;
    }}

    .title-decoration {{
        margin-left: auto;
        display: flex;
        gap: 2px;
        }}

    .decoration-line {{
        width: 10px;
        height: 2px;
        background: #fff;
        transform: skewX(-30deg);
    }}
       /* ===== MAIN BODY ===== */
.main {{
    flex: 1;
    display: grid;
    grid-template-columns: 68% 32%;
    gap: 4px;
    padding: 3px 4px;
    position: relative;
    }}

/* ===== WATERMARK ===== */
.watermark {{
    position: absolute;
    top: 45%;
    left: 35%;
    transform: translate(-50%, -50%);
    font-size: 10pt;
    font-weight: 900;
    color: rgba(13, 71, 161, 0.06);
    text-align: center;
    z-index: 1;
    line-height: 1.2;
    }}

/* ===== LEFT SECTION (INFO BOX) ===== */
.left-section {{
    position: relative;
    z-index: 2;
    background: #fff;
    border: 1px solid #e0e0e0;
    padding: 4px;
    border-radius: 3px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    }}

/* Each row */
.info-row {{
    display: grid;
    grid-template-columns: 42% 58%;
    font-size: 5.5pt;
    align-items: center;
    }}

.info-label {{
    font-weight: 700;
    color: #0d47a1;
    }}

.info-value {{
    color: #111;
    font-weight: 500;
    word-break: break-word;
    }}

/* ===== RIGHT SECTION ===== */
.right-section {{
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    }}

/* PHOTO */
.photo-box {{
    width: 55px;
    height: 65px;
    border: 1.5px solid #0d47a1;
    overflow: hidden;
    background: #fff;
    }}

.photo-box img {{
    width: 100%;
    height: 100%;
    object-fit: cover;
    }}

/* SIGNATURE */
.signature-box {{
    width: 55px;
    text-align: center;
    }}

.signature-box img {{
    width: 50px;
    height: 18px;
    object-fit: contain;
    }}

.signature-label {{
    font-size: 4pt;
    font-weight: 700;
    color: #0d47a1;
    margin-top: 1px;
    }}

/* QR + DATES */
.qr-wrapper {{
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    }}

.qr-box {{
    width: 32px;
    height: 32px;
    border: 1px solid #ccc;
    }}

.qr-box img {{
    width: 100%;
    height: 100%;
    }}

.dates {{
    font-size: 4pt;
    text-align: center;
    line-height: 1.2;
    }}

.date-row span {{
    font-weight: 700;
    color: #0d47a1;
    }}
       /* ===== BOTTOM SECTION ===== */
.bottom-section {{
    display: grid;
    grid-template-columns: 65% 35%;
    gap: 4px;
    padding: 3px 4px;
    border-top: 1px solid #ddd;
    }}

/* ===== INSTRUCTIONS BOX ===== */
.instructions {{
    border: 1px solid #e0e0e0;
    padding: 3px;
    background: #f9fbff;
    border-radius: 3px;
    }}

.instructions h3 {{
    font-size: 5pt;
    font-weight: 800;
    color: #0d47a1;
    margin-bottom: 2px;
    }}

.instructions ol {{
    font-size: 4pt;
    padding-left: 10px;
    color: #333;
    line-height: 1.2;
    }}

/* ===== SIGNATURE AREA ===== */
.signatures {{
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
    }}

/* SINGLE SIGN BLOCK */
.signature-block {{
    text-align: center;
    width: 100%;
    }}

/* STAMP */
.stamp-box {{
    width: 30px;
    height: 30px;
    border: 1px dashed #0d47a1;
    border-radius: 50%;
    margin: 0 auto 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3pt;
    color: #0d47a1;
    text-align: center;
    }}

/* SIGN LINE */
.sign-line {{
    width: 45px;
    border-top: 1px solid #333;
    margin: 2px auto;
    }}

/* LABELS */
.sign-label {{
    font-size: 4pt;
    font-weight: 700;
    color: #0d47a1;
    }}

.sign-sub {{
    font-size: 3pt;
    color: #666;
    }}

/* ===== FOOTER ===== */
.footer {{
    width: 100%;
    position: absolute;
    bottom: 0;
    left: 0;
    background: #0d47a1;
    color: white;
    font-size: 4pt;
    display: flex;
    justify-content: center;
    gap: 8px;
    padding: 2px;
    }}

.footer-item {{
    display: flex;
    align-items: center;
    gap: 2px;
    }}

    /* ===== FINAL PRINT FIXES ===== */

/* Prevent any overflow cutting in PDF */
.id-card {{
    overflow: hidden !important;
    page-break-inside: avoid;
    }}

/* Ensure content never exceeds card boundary */
.content {{
    overflow: hidden;
    }}

/* Fix spacing consistency */
.left-section, .right-section, .instructions {{
    min-height: 0;
    }}

/* QR + Date alignment fix */
.qr-wrapper {{
    margin-top: 2px;
    }}

/* Prevent text overflow */
.info-value {{
    overflow-wrap: anywhere;
    word-break: break-word;
    }}

/* Ensure stamp/signature never shift */
.signature-block {{
    page-break-inside: avoid;
    }}

/* FOOTER SAFE AREA FIX */
.footer {{
    position: absolute;
    bottom: 0;
    height: 8px;
    line-height: 8px;
    }}

/* IMPORTANT: PDF rendering stability */
@media print {{
    body {{
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }}

    .id-card {{
        transform: scale(1);
    }}
    </style>
</head>
<body>
    <div class="id-card">
        <div class="watermark">
            SIR CHHOTU RAM<br>
            EDUCATION PVT. LTD.
        </div>
        <div class="content">
            <div class="header">
                <div class="logo-left">
                    <img src="{logo_url}" class="logo-img" alt="SCRE Logo" />
                    // <div class="logo-text">
                    //     SIR<br>CHHOTU<br>RAM<br>EDUCATION
                    // </div>
                </div>
                <div class="header-center">
                    <h1>SIR CHHOTU RAM EDUCATION PVT. LTD.</h1>
                    <p>AN ISO 9001:2015 CERTIFIED ORGANIZATION</p>
                    <p>Ministry of Corporate Affairs</p>
                    <p>Ministry of Micro, Small and Medium Enterprises, Govt. of India</p>
                </div>
                <div class="logo-right">
                    <img src="{iso_url}" class="iso-img" alt="ISO Logo" />
                </div>
            </div>

            <div class="title-bar">
                <div class="title-icon">🎓</div>
                <div class="title-text">SCRE - STUDENT IDENTITY CARD</div>
                <div class="title-decoration">
                    <div class="decoration-line"></div>
                    <div class="decoration-line"></div>
                    <div class="decoration-line"></div>
                </div>
            </div>

            <div class="main">
                <div class="left-section">
                    <div class="info-row">
                        <span class="info-label">Enrolment No:</span>
                        <span class="info-value">{enrollment_no}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">ASC Name:</span>
                        <span class="info-value">{asc_name}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Course:</span>
                        <span class="info-value">{course_name}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Name:</span>
                        <span class="info-value">{student_name}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Father's Name:</span>
                        <span class="info-value">{father_name}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Address:</span>
                        <span class="info-value">{address}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Mother's Name:</span>
                        <span class="info-value">{mother_name}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Mobile:</span>
                        <span class="info-value">{mobile}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Email:</span>
                        <span class="info-value">{email}</span>
                    </div>
                </div>
                <div class="right-section">
                    <div class="photo-box">
                        <img src="{photo_url}" alt="Student Photo" />
                    </div>
                    <div class="signature-box">
                        <img src="{signature_url}" alt="Student Signature" />
                        <div class="signature-label">STUDENT SIGNATURE</div>
                    </div>
                    <div class="qr-wrapper">
                        <div class="qr-box">
                            <img src="{qr_data_uri}" alt="QR Code" />
                        </div>
                        <div class="dates">
                            <div class="date-row">
                                <span>📅 Valid till:</span> {valid_till}
                            </div>
                            <div class="date-row">
                                <span>📅 Issued:</span> {issued_date}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="bottom-section">
                <div class="instructions">
                    <h3>INSTRUCTIONS</h3>
                    <ol>
                        <li>This ID Card is the property of Sir Chhotu Ram Education Pvt. Ltd.</li>
                        <li>This card is non-transferable and must be carried at all times.</li>
                        <li>Student must produce this card on demand at the Study Center, Examination Center or any other authorized place.</li>
                        <li>Loss or damage of this card must be reported immediately.</li>
                    </ol>
                </div>
                <div class="signatures">
                    <div class="signature-block">
                        <div class="stamp-box">
                            APPROVED<br>
                            {center_code}
                        </div>
                        <div class="sign-line"></div>
                        <div class="sign-label">AUTHORIZED STUDY CENTER</div>
                        <div class="sign-sub">CENTER SIGNATURE</div>
                    </div>
                    <div class="signature-block">
                        <div class="stamp-box">
                            SIR CHHOTU RAM<br>
                            EDUCATION LIMITED
                        </div>
                        <div class="sign-line"></div>
                        <div class="sign-label">DIRECTOR SIGNATURE</div>
                        <div class="sign-sub">STUDENT REGISTRATION DIVISION</div>
                    </div>
                </div>
            </div>

            <div class="footer">
                <div class="footer-item">🌐 www.screducation.in</div>
                <div class="footer-item">✉️ info@screducation.in</div>
                <div class="footer-item">📞 1800-123-1555</div>
            </div>
        </div>
    </div>
</body>
</html>"#,
        logo_url = logo_url,
        iso_url = iso_url,
        enrollment_no = enrollment_no,
        asc_name = asc_name,
        course_name = course_name,
        student_name = student_name,
        father_name = father_name,
        mother_name = mother_name,
        address = address,
        mobile = mobile,
        email = email,
        issued_date = issued_date,
        valid_till = valid_till,
        photo_url = photo_url,
        signature_url = signature_url,
        qr_data_uri = qr_data_uri,
        center_code = center
            .as_ref()
            .map(|c| c.code.to_uppercase())
            .unwrap_or("CENTER".to_string())
    );

    // Step 8: Generate PDF and return it
    let temp_dir = std::env::temp_dir();
    let timestamp = Utc::now().timestamp();
    let name_slug = student
        .full_name
        .as_ref()
        .map(|n| n.replace(" ", "_"))
        .unwrap_or_else(|| "student".to_string());
    let pdf_filename = format!("id-card-{}-{}.pdf", name_slug, timestamp);
    let pdf_path = temp_dir.join(&pdf_filename);

    // Try multiple possible chromium/edge paths
    let chromium_paths = [
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "msedge.exe",
        "chrome.exe",
        "msedge",
        "chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/snap/bin/chromium",
        "google-chrome-stable",
    ];

    let mut pdf_generated = false;
    let mut last_error = String::new();

    // Write HTML to temp file first
    let html_path = temp_dir.join(format!("id-card-{}-{}.html", name_slug, timestamp));
    if let Err(e) = std::fs::write(&html_path, &html) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to write HTML: {}", e),
        )
            .into_response();
    }

    let file_url = format!("file://{}", html_path.display());

    for path in chromium_paths {
        println!("Attempting ID card PDF generation with {}", path);

        let output = std::process::Command::new(path)
            .args([
                "--headless=new",
                "--disable-gpu",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-extensions",
                "--allow-file-access-from-files",
                &format!("--print-to-pdf={}", pdf_path.display()),
                &file_url,
            ])
            .output();

        match output {
            Ok(out) if out.status.success() => {
                if pdf_path.exists() {
                    pdf_generated = true;
                    println!("Successfully generated ID card PDF with {}", path);
                    break;
                } else {
                    last_error = format!(
                        "Chromium at {} reported success but PDF not found at {}",
                        path,
                        pdf_path.display()
                    );
                    eprintln!("{}", last_error);
                }
            }
            Ok(out) => {
                let err = String::from_utf8_lossy(&out.stderr);
                let stdout = String::from_utf8_lossy(&out.stdout);
                last_error = format!(
                    "Chromium at {} failed. Stderr: {}. Stdout: {}",
                    path, err, stdout
                );
                eprintln!("{}", last_error);
            }
            Err(e) => {
                last_error = format!("Failed to run chromium at {}: {}", path, e);
                eprintln!("{}", last_error);
            }
        }
    }

    if pdf_generated {
        if let Ok(pdf_bytes) = std::fs::read(&pdf_path) {
            let _ = std::fs::remove_file(&html_path);
            let _ = std::fs::remove_file(&pdf_path);
            (
                StatusCode::OK,
                [
                    (header::CONTENT_TYPE, "application/pdf"),
                    (
                        header::CONTENT_DISPOSITION,
                        &format!("attachment; filename=\"{}\"", pdf_filename),
                    ),
                ],
                pdf_bytes,
            )
                .into_response()
        } else {
            (
                StatusCode::OK,
                [
                    (header::CONTENT_TYPE, "text/html; charset=utf-8"),
                    (
                        header::CONTENT_DISPOSITION,
                        "inline; filename=\"id-card.html\"",
                    ),
                ],
                html.into_bytes(),
            )
                .into_response()
        }
    } else {
        // Fallback to returning printable HTML directly so browser can view and print/save PDF
        (
            StatusCode::OK,
            [
                (header::CONTENT_TYPE, "text/html; charset=utf-8"),
                (
                    header::CONTENT_DISPOSITION,
                    "inline; filename=\"id-card.html\"",
                ),
            ],
            html.into_bytes(),
        )
            .into_response()
    }
}
