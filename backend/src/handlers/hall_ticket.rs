use crate::models::center::Center;
use crate::models::exam_engine::{ExamBlueprint, StudentPaper};
use crate::models::subject::Subject;
use crate::models::user::{Claims, User, UserRole};
use crate::services::pdf_generator::PdfGenerator;
use axum::{
    Json,
    extract::{Path as AxumPath, State},
    http::StatusCode,
};
use base64::{Engine as _, engine::general_purpose};
use chrono::{Timelike, Utc};
use futures_util::stream::StreamExt;
use mongodb::{
    Database,
    bson::{doc, oid::ObjectId},
};
use qrcode::QrCode;
use serde::Serialize;
use std::env;
use std::path::PathBuf;

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
        // If relative to backend/ (for cases where UPLOAD_DIR is just 'uploads')
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

#[derive(Debug, Serialize)]
pub struct HallTicketResponse {
    pub success: bool,
    pub message: String,
    pub pdf_url: Option<String>,
}

pub async fn generate_hall_ticket(
    State(db): State<Database>,
    claims: Claims,
    AxumPath(student_id): AxumPath<String>,
) -> (StatusCode, Json<HallTicketResponse>) {
    // 1. Fetch Student Data
    let s_oid = match ObjectId::parse_str(&student_id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(HallTicketResponse {
                    success: false,
                    message: "Invalid student ID".to_string(),
                    pdf_url: None,
                }),
            );
        }
    };

    let user_coll = db.collection::<User>("users");
    let student = match user_coll.find_one(doc! { "_id": s_oid }, None).await {
        Ok(Some(u)) => u,
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(HallTicketResponse {
                    success: false,
                    message: "Student not found".to_string(),
                    pdf_url: None,
                }),
            );
        }
    };

    // Fetch Allotted Exams first
    let paper_coll = db.collection::<StudentPaper>("student_papers");
    let mut cursor = paper_coll
        .find(doc! { "student_id": s_oid }, None)
        .await
        .unwrap();
    let mut papers = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(p) = result {
            papers.push(p);
        }
    }

    // Check if hall ticket is issued (has allotted papers)
    if papers.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(HallTicketResponse {
                success: false,
                message: "Hall ticket is not issued yet, no exams allotted".to_string(),
                pdf_url: None,
            }),
        );
    }

    // 2. Access control
    if claims.role == UserRole::Center {
        // student.parent_id is the user_id of the center user!
        let center_user_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(HallTicketResponse {
                        success: false,
                        message: "Invalid center ID".to_string(),
                        pdf_url: None,
                    }),
                );
            }
        };

        // Check if student's parent_id is center user id OR any of the student's papers have center_id == center_user_id
        let parent_id_match = student.parent_id == Some(center_user_id);
        let paper_center_match = papers.iter().any(|p| p.center_id == center_user_id);

        if !parent_id_match && !paper_center_match {
            return (
                StatusCode::FORBIDDEN,
                Json(HallTicketResponse {
                    success: false,
                    message: "This student does not belong to your center".to_string(),
                    pdf_url: None,
                }),
            );
        }
    } else if claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
        && claims.sub != student_id
    {
        return (
            StatusCode::FORBIDDEN,
            Json(HallTicketResponse {
                success: false,
                message: "Unauthorized".to_string(),
                pdf_url: None,
            }),
        );
    }

    // 3. Fetch Center Data
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

    // 4. Fetch Blueprints and Subjects for details
    let blueprint_coll = db.collection::<ExamBlueprint>("exam_blueprints");
    let subject_coll = db.collection::<Subject>("subjects");

    let mut exam_rows = Vec::new();
    for paper in &papers {
        let sub = if let Some(sid) = paper.subject_id {
            subject_coll
                .find_one(doc! { "_id": sid }, None)
                .await
                .ok()
                .flatten()
        } else {
            None
        };

        let start = paper
            .start_window
            .map(|d| d.to_chrono())
            .unwrap_or(Utc::now());
        let end = paper
            .end_window
            .map(|d| d.to_chrono())
            .unwrap_or(Utc::now());

        // Convert to IST for display
        let ist_start = start.with_timezone(&chrono_tz::Asia::Kolkata);
        let ist_end = end.with_timezone(&chrono_tz::Asia::Kolkata);

        let session = if ist_start.hour() < 12 {
            "Morning Slot"
        } else {
            "Evening Slot"
        };

        exam_rows.push(format!(
            r#"<tr>
                    <td>{}</td>
                    <td>{}</td>
                    <td>{}</td>
                    <td>THEORY</td>
                    <td>{} - {}</td>
                </tr>"#,
            ist_start.format("%d-%m-%Y"),
            session,
            sub.as_ref()
                .map(|s| s.subject_name.clone())
                .unwrap_or("EXAM".to_string()),
            ist_start.format("%I:%M %p"),
            ist_end.format("%I:%M %p")
        ));
    }

    // 5. Prepare template variables
    let course_name = student
        .course
        .as_ref()
        .filter(|c| !c.trim().is_empty())
        .cloned()
        .unwrap_or("---".to_string());

    let enrollment_no = student
        .enrollment_number
        .as_ref()
        .filter(|e| !e.trim().is_empty())
        .cloned()
        .unwrap_or("---".to_string());

    let roll_no = student
        .roll_number
        .as_ref()
        .filter(|r| !r.trim().is_empty())
        .cloned()
        .unwrap_or("---".to_string());
    let center_name = center
        .as_ref()
        .map(|c| c.name.clone())
        .unwrap_or("Main Center".to_string());
    let center_address = center
        .as_ref()
        .map(|c| {
            format!(
                "{}, {}, {}, {}",
                c.address,
                c.city,
                c.state,
                c.location
                    .as_ref()
                    .and_then(|l| l.pincode.clone())
                    .unwrap_or_default()
            )
        })
        .unwrap_or("Address Not Set".to_string());
    let center_code = center
        .as_ref()
        .map(|c| c.code.clone().to_uppercase())
        .unwrap_or("CENTER".to_string());

    let logo_url = get_image_data_uri("/images/logo.jpeg");
    let iso_url = get_image_data_uri("/images/iso.webp");

    // 6. Generate QR Code with more student information
    let qr_data = format!(
        "STUDENT_ID:{}\nNAME:{}\nENROLLMENT:{}\nROLL_NO:{}\nCOURSE:{}",
        student.id.unwrap().to_hex(),
        student.full_name.as_deref().unwrap_or("---"),
        enrollment_no,
        roll_no,
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

    // 7. Build HTML Template
    let photo_url = student
        .photo_url
        .as_ref()
        .filter(|u| !u.trim().is_empty())
        .map(|u| get_image_data_uri(u))
        .unwrap_or("https://via.placeholder.com/150".to_string());

    let signature_url = student
        .signature_url
        .as_ref()
        .filter(|u| !u.trim().is_empty())
        .map(|u| get_image_data_uri(u))
        .unwrap_or("https://via.placeholder.com/150x50?text=Signature".to_string());

    // Get Exam Mode from first paper's blueprint if available
    let mut exam_mode = "Computer Based Test (CBT)".to_string();
    if !papers.is_empty() {
        if let Some(bp) = blueprint_coll
            .find_one(doc! { "_id": papers[0].blueprint_id }, None)
            .await
            .ok()
            .flatten()
        {
            if let Some(mode) = bp.exam_mode {
                if !mode.is_empty() {
                    exam_mode = mode;
                }
            }
        }
    }

    let html = format!(
        r#"<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700&display=swap');
                body {{ font-family: 'Noto Sans Devanagari', 'Arial', sans-serif; padding: 20px; color: #333; }}
                .hindi {{ font-family: 'Noto Sans Devanagari', sans-serif; }}
                .header-container {{ display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }}
                .header-logo {{ width: 80px; height: 80px; object-fit: contain; }}
                .header-text {{ text-align: center; flex: 1; padding: 0 10px; }}
                .header-text h1 {{ margin: 0; font-size: 20px; color: #004a89; text-transform: uppercase; }}
                .header-text p {{ margin: 2px 0; font-size: 10px; font-weight: bold; }}
                .header-text .gov {{ font-size: 16px; font-weight: 900; margin-top: 5px; color: #000; }}
                .title-box {{ border: 1px solid #ccc; background: #f9f9f9; padding: 8px; text-align: center; margin-bottom: 10px; font-weight: bold; font-size: 13px; }}
                .main-table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; }}
                .main-table td {{ border: 1px solid #ccc; padding: 8px; font-size: 11px; }}
                .main-table td.label {{ background: #f5f5f5; font-weight: bold; width: 30%; }}
                .photo-signature {{ width: 140px; text-align: center; }}
                .photo-container {{ width: 100px; height: 120px; border: 2px solid #333; margin: 0 auto 5px; display: flex; align-items: center; justify-content: center; background: white; }}
                .photo-container img {{ max-width: 100%; max-height: 100%; object-fit: contain; }}
                .signature-container {{ width: 100px; height: 40px; border: 2px solid #333; margin: 0 auto 5px; display: flex; align-items: center; justify-content: center; background: white; }}
                .signature-container img {{ max-width: 100%; max-height: 100%; object-fit: contain; }}
                .photo-signature .qr-container {{ width: 80px; height: 80px; margin: 0 auto; display: block; }}
                .exam-table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
                .exam-table th, .exam-table td {{ border: 1px solid #ccc; padding: 6px; text-align: center; font-size: 10px; }}
                .exam-table th {{ background: #f5f5f5; font-weight: bold; }}
                .footer {{ margin-top: 20px; font-size: 9px; text-align: center; color: #666; }}
            </style>
        </head>
        <body>
            <div class="header-container">
                <img src="{logo_url}" class="header-logo" alt="Logo" />
                <div class="header-text">
                    <h1>SIR CHHOTU RAM EDUCATION PVT. LTD.</h1>
                    <p>An ISO 9001-2015 Certified Organization</p>
                    <p>Registered Under The Company ACT 2013 By The Ministry Of Corporate Affairs</p>
                    <p>Ministry of Micro, Small & Medium Enterprises,</p>
                    <div class="gov">Government Of India</div>
                </div>
                <img src="{iso_url}" class="header-logo" alt="ISO" />
            </div>

            <div class="title-box">हाल टिकट / प्रवेश पत्र - Hall Ticket / Admit Card / Printed on {printed_on}</div>
            <div class="title-box">सत्रांत परीक्षा (टीईई) / 2025-JUNE, Term End Examination (TEE)</div>

            <table class="main-table">
                <tr>
                    <td class="label">1. अनुक्रमांक / Enrollment Number:</td>
                    <td>{enrollment_no}</td>
                    <td rowspan="8" class="photo-signature">
                        <div class="photo-container">
                            <img src="{photo_url}" alt="Photo" />
                        </div>
                        <div class="signature-container">
                            <img src="{signature_url}" alt="Signature" />
                        </div>
                        <div class="qr-container">
                            <img src="{qr_data_uri}" alt="QR Code" style="width: 100%; height: 100%;" />
                        </div>
                    </td>
                </tr>
                <tr>
                    <td class="label">2. रोल नंबर / Roll Number:</td>
                    <td>{roll_no}</td>
                </tr>
                <tr>
                    <td class="label">3. प्रोग्राम कोड / Programme Code:</td>
                    <td>{prog_code}</td>
                </tr>
                <tr>
                    <td class="label">4. प्रोग्राम का नाम / Programme Name:</td>
                    <td>{prog_name}</td>
                </tr>
                <tr>
                    <td class="label">5. परीक्षार्थी का नाम / Name of the Student:</td>
                    <td>{student_name}</td>
                </tr>
                <tr>
                    <td class="label">6. परीक्षा केन्द्र कोड / Exam Centre Code:</td>
                    <td>{center_code} - {center_name}</td>
                </tr>
                <tr>
                    <td class="label">7. परीक्षण का तरीका / Mode of Exam:</td>
                    <td>{exam_mode}</td>
                </tr>
                <tr>
                    <td class="label">8. परीक्षा केन्द्र का पता / Exam Centre Address:</td>
                    <td>{center_code}: {center_address}</td>
                </tr>
            </table>

            <div style="background: #f5f5f5; padding: 5px; text-align: center; font-weight: bold; font-size: 11px; border: 1px solid #ccc;">परीक्षा समय सारणी / Exam Time Table</div>
            <table class="exam-table">
                <thead>
                    <tr>
                        <th>परीक्षा का दिनांक/Date of Exam</th>
                        <th>सत्र /Session</th>
                        <th>पाठ्यक्रम कोड / Course Code</th>
                        <th>Course Component</th>
                        <th>सारणी / Schedule*</th>
                    </tr>
                </thead>
                <tbody>
                    {exam_rows}
                </tbody>
            </table>

            <div class="footer">
                * Please reach the examination center at least 30 minutes before the scheduled time. Carry a valid photo ID proof along with this admit card.
            </div>
        </body>
        </html>"#,
        logo_url = logo_url,
        iso_url = iso_url,
        printed_on = Utc::now()
            .with_timezone(&chrono_tz::Asia::Kolkata)
            .format("%d-%m-%Y %I:%M %p"),
        enrollment_no = enrollment_no,
        photo_url = photo_url,
        signature_url = signature_url,
        qr_data_uri = qr_data_uri,
        roll_no = roll_no,
        prog_code = course_name.split(' ').next().unwrap_or("COURSE"),
        prog_name = course_name,
        student_name = student.full_name.as_deref().unwrap_or("---"),
        center_code = center_code,
        center_name = center_name,
        exam_mode = exam_mode,
        center_address = center_address,
        exam_rows = exam_rows.join("\n")
    );

    // 7. Save to PDF
    let upload_dir = env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string());
    let pdf_filename = format!("hall-ticket-{}.pdf", student.id.unwrap().to_hex());
    let pdf_path = PathBuf::from(&upload_dir)
        .join("hall_tickets")
        .join(&pdf_filename);

    if let Err(e) = PdfGenerator::html_to_pdf(&html, pdf_path) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(HallTicketResponse {
                success: false,
                message: format!("Failed to generate PDF: {}", e),
                pdf_url: None,
            }),
        );
    }

    (
        StatusCode::OK,
        Json(HallTicketResponse {
            success: true,
            message: "Hall ticket generated successfully".to_string(),
            pdf_url: Some(format!("/uploads/hall_tickets/{}", pdf_filename)),
        }),
    )
}
