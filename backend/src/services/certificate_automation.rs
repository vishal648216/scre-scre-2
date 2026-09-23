use crate::models::academic::Session;
use crate::models::center::Center;
use crate::models::certificate::Certificate;
use crate::models::certificate_auto_generation::CertificateEligibility;
use crate::models::system_settings::SystemSettings;
use crate::models::course::Course;
use crate::models::exam_workflow::CourseExamAttempt;
use crate::models::subject::Subject;
use crate::models::template::{Template, TemplateField};
use crate::services::marks_calculation::{ResultTableRow, render_result_table_html};
use crate::services::pdf_generator::PdfGenerator;
use chrono::{Duration, Utc};
use futures_util::StreamExt;
use mongodb::{
    Database,
    bson::{Document, doc, oid::ObjectId},
};
use std::env;
use std::path::PathBuf;

async fn load_settings(db: &Database) -> SystemSettings {
    db.collection::<SystemSettings>("system_settings")
        .find_one(None, None)
        .await
        .ok()
        .flatten()
        .unwrap_or_default()
}

fn esc_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn load_asset_base64(path: &str) -> String {
    let path = path.trim();
    if path.is_empty() {
        return String::new();
    }
    if path.starts_with("data:") {
        return path.to_string();
    }

    // Try multiple possible locations for the asset
    let possible_paths = [
        format!(
            "/var/www/html/scre/public{}",
            if path.starts_with('/') { "" } else { "/" }
        ),
        format!(
            "/var/www/html/scre/backend/uploads{}",
            if path.starts_with('/') { "" } else { "/" }
        ),
        format!(
            "/var/www/html/scre/backend{}",
            if path.starts_with('/') { "" } else { "/" }
        ),
    ];

    for base in possible_paths {
        let full_path = PathBuf::from(format!("{}{}", base, path));
        if full_path.exists() {
            if let Ok(data) = std::fs::read(&full_path) {
                let mime = match full_path.extension().and_then(|e| e.to_str()) {
                    Some("png") => "image/png",
                    Some("jpg") | Some("jpeg") => "image/jpeg",
                    Some("webp") => "image/webp",
                    Some("svg") => "image/svg+xml",
                    _ => "image/png",
                };
                use base64::{Engine as _, engine::general_purpose};
                let b64 = general_purpose::STANDARD.encode(data);
                return format!("data:{};base64,{}", mime, b64);
            }
        }
    }

    path.to_string()
}

fn qr_to_base64(data: &str) -> String {
    use base64::{Engine as _, engine::general_purpose};
    use qrcode::{QrCode, render::svg};
    if let Ok(code) = QrCode::new(data) {
        let svg = code
            .render::<svg::Color<'_>>()
            .min_dimensions(256, 256)
            .dark_color(svg::Color("#000000"))
            .light_color(svg::Color("#FFFFFF"))
            .build();
        let b64 = general_purpose::STANDARD.encode(svg.as_bytes());
        return format!("data:image/svg+xml;base64,{}", b64);
    }
    String::new()
}

async fn generate_enrollment_number(db: &Database, creator_id: &ObjectId) -> String {
    let counters = db.collection::<mongodb::bson::Document>("counters");
    let filter = doc! { "_id": "enrollment" };
    let update = doc! { "$inc": { "seq": 1 } };
    let options = mongodb::options::FindOneAndUpdateOptions::builder()
        .upsert(true)
        .return_document(mongodb::options::ReturnDocument::After)
        .build();
    match counters.find_one_and_update(filter, update, options).await {
        Ok(Some(doc)) => {
            let seq = if let Ok(seq) = doc.get_i64("seq") {
                seq
            } else if let Ok(seq) = doc.get_i32("seq") {
                seq as i64
            } else {
                1
            };
            format!("SCRE{:06}", seq)
        }
        _ => "SCRE000001".to_string(),
    }
}

async fn generate_serial_number(student_id: &ObjectId) -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let num: u32 = rng.gen_range(10000..99999);
    format!("SC-{:05}", num)
}

pub async fn process_student_certificate(db: &Database, student_id: ObjectId) {
    let users_coll = db.collection::<Document>("users");
    let certs_coll = db.collection::<Certificate>("certificates");
    let centers_coll = db.collection::<Center>("centers");
    let courses_coll = db.collection::<Course>("courses");
    let templates_coll = db.collection::<Template>("templates");
    let template_fields_coll = db.collection::<TemplateField>("template_fields");
    let course_exam_attempts_coll = db.collection::<CourseExamAttempt>("course_exam_attempts");
    let subjects_coll = db.collection::<Subject>("subjects");
    let results_coll = db.collection::<Document>("results");
    let base_url = env::var("BASE_URL").unwrap_or_else(|_| "https://screduc.com".to_string());
    let upload_dir = env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string());

    println!(
        "Starting process_student_certificate for student: {}",
        student_id
    );

    let user_doc = match users_coll.find_one(doc! { "_id": student_id }, None).await {
        Ok(Some(u)) => u,
        Ok(None) => {
            println!("Student not found: {}", student_id);
            return;
        }
        Err(e) => {
            println!("Error fetching student: {}", e);
            return;
        }
    };

    let sid = user_doc.get_object_id("_id").unwrap();
    let username = user_doc.get_str("username").unwrap_or("unknown");
    println!("Processing student: {}, ID: {}", username, sid);

    let course_id = match user_doc.get_object_id("course_id") {
        Ok(cid) => cid,
        Err(_) => {
            if let Some(course_str) = user_doc.get_str("course").ok() {
                if let Ok(oid) = ObjectId::parse_str(course_str) {
                    oid
                } else {
                    println!("Skipping: Course string not valid ObjectId: {}", course_str);
                    return;
                }
            } else {
                println!("Skipping: No course_id or course string");
                return;
            }
        }
    };
    println!("  Course ID: {}", course_id);

    println!("  Getting center doc...");
    let (center_doc, _center_id) = if let Ok(parent_id) = user_doc.get_object_id("parent_id") {
        match centers_coll
            .find_one(doc! { "user_id": parent_id }, None)
            .await
        {
            Ok(Some(c)) => {
                let cid = c.id.unwrap_or_else(|| ObjectId::new());
                (Some(c), cid)
            }
            _ => (None, ObjectId::new()),
        }
    } else {
        (None, ObjectId::new())
    };

    println!("  Getting course details...");
    let mut course_name = user_doc.get_str("course").unwrap_or("").to_string();
    let mut course_duration: Option<String> = None;
    if let Ok(Some(c)) = courses_coll.find_one(doc! { "_id": course_id }, None).await {
        course_name = c.course_name.clone();
        course_duration = Some(format!("{} Months", c.duration_months));
    }

    // Get session details
    let session_name = if let Ok(session_id) = user_doc.get_object_id("session_id") {
        let sessions_coll = db.collection::<Session>("sessions");
        if let Ok(Some(session)) = sessions_coll
            .find_one(doc! { "_id": session_id }, None)
            .await
        {
            session.session_name.clone()
        } else {
            "".to_string()
        }
    } else {
        "".to_string()
    };

    let gender = user_doc
        .get_str("gender")
        .ok()
        .map(|s| s.to_string())
        .unwrap_or_else(|| "".to_string());
    let exam_mode = user_doc
        .get_str("exam_mode")
        .ok()
        .map(|s| s.to_string())
        .unwrap_or_else(|| "".to_string());
    let admission_mode = user_doc
        .get_str("admission_mode")
        .ok()
        .map(|s| s.to_string())
        .unwrap_or_else(|| "".to_string());
    let center_address = center_doc
        .as_ref()
        .map(|c| c.address.clone())
        .unwrap_or_else(|| "".to_string());

    let enrollment_number_opt = user_doc
        .get_str("enrollment_number")
        .ok()
        .map(|s| s.to_string());
    println!("  Getting enrollment number...");
    let enrollment_no = if enrollment_number_opt.is_none()
        || enrollment_number_opt
            .as_ref()
            .map(|s| s.trim().is_empty())
            .unwrap_or(true)
    {
        let creator_id = user_doc.get_object_id("parent_id").ok().unwrap_or(sid);
        let new_enrollment = generate_enrollment_number(db, &creator_id).await;
        let _ = users_coll
            .update_one(
                doc! { "_id": &sid },
                doc! { "$set": { "enrollment_number": &new_enrollment } },
                None,
            )
            .await;
        new_enrollment
    } else {
        enrollment_number_opt.unwrap()
    };

    let serial = generate_serial_number(&sid).await;
    let verification_url = format!("{}/certificate/{}", base_url.trim_end_matches('/'), serial);
    let issue_date_val = chrono::Utc::now().naive_utc().date().to_string();
    let issue_naive = chrono::NaiveDate::parse_from_str(&issue_date_val, "%Y-%m-%d")
        .unwrap_or_else(|_| chrono::Utc::now().naive_utc().date());
    let issue_dt = chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(
        issue_naive.and_hms_opt(0, 0, 0).unwrap(),
        chrono::Utc,
    );

    let student_name = user_doc
        .get_str("full_name")
        .ok()
        .map(|s| s.to_string())
        .unwrap_or_else(|| username.to_string());
    let father_name = user_doc
        .get_str("father_name")
        .ok()
        .map(|s| s.to_string())
        .unwrap_or_else(|| "NOT FOUND".to_string());
    let mother_name = user_doc
        .get_str("mother_name")
        .ok()
        .map(|s| s.to_string())
        .unwrap_or_else(|| "NOT FOUND".to_string());
    let dob = user_doc
        .get_str("dob")
        .ok()
        .map(|s| s.to_string())
        .unwrap_or_else(|| "NOT FOUND".to_string());
    let session_from = user_doc
        .get_str("session_start_date")
        .ok()
        .map(|s| s.to_string())
        .unwrap_or_else(|| "Jan 2025".to_string());
    let session_to = user_doc
        .get_str("session_end_date")
        .ok()
        .map(|s| s.to_string())
        .unwrap_or_else(|| "Jan 2026".to_string());
    let center_code = center_doc
        .as_ref()
        .map(|c| c.code.clone())
        .unwrap_or_else(|| "N/A".to_string());
    let asc_name = center_doc
        .as_ref()
        .map(|c| c.name.clone())
        .unwrap_or_else(|| "NOT FOUND".to_string());

    let national_id = user_doc
        .get_str("national_id")
        .ok()
        .map(|s| s.to_string())
        .unwrap_or_else(|| "N/A".to_string());

    // Get result data
    let result_doc = results_coll
        .find_one(doc! { "student_id": sid }, None)
        .await
        .ok()
        .flatten();

    let exam_date = result_doc
        .as_ref()
        .and_then(|d| d.get_str("exam_date").ok())
        .unwrap_or("N/A")
        .to_string();
    let result_date = result_doc
        .as_ref()
        .and_then(|d| d.get_str("result_date").ok())
        .unwrap_or("N/A")
        .to_string();
    let overall_status = result_doc
        .as_ref()
        .and_then(|d| d.get_str("status").ok())
        .unwrap_or("N/A")
        .to_string();
    let result_percentage = if let Some(result) = &result_doc {
        if let (Ok(obtained), Ok(total)) = (
            result.get_i32("obtained_marks"),
            result.get_i32("total_marks"),
        ) {
            if total > 0 {
                format!("{:.1}%", (obtained as f64 / total as f64) * 100.0)
            } else {
                "N/A".to_string()
            }
        } else if let Ok(percentage) = result.get_f64("percentage") {
            format!("{:.1}%", percentage)
        } else {
            "N/A".to_string()
        }
    } else {
        "N/A".to_string()
    };

    let latest_attempt = course_exam_attempts_coll
        .find_one(
            doc! {
                "student_id": sid,
                "course_id": course_id,
                "marks_submitted": true
            },
            mongodb::options::FindOneOptions::builder()
                .sort(doc! { "updated_at": -1, "attempt_number": -1 })
                .build(),
        )
        .await
        .ok()
        .flatten();

    let certificate_result_rows: Vec<ResultTableRow> = if let Some(attempt) = latest_attempt {
        let mut rows = Vec::new();
        for subject_mark in attempt.subject_marks {
            let subject_name = subjects_coll
                .find_one(doc! { "_id": subject_mark.subject_id }, None)
                .await
                .ok()
                .flatten()
                .map(|subject| subject.subject_name)
                .unwrap_or_else(|| "Unknown Subject".to_string());

            let status = if subject_mark.subject_passed {
                "PASS".to_string()
            } else {
                "FAIL".to_string()
            };

            rows.push(ResultTableRow {
                subject: subject_name,
                max_marks: subject_mark.total,
                obtained: subject_mark.obtained,
                status,
                theory_total: subject_mark.components.exam_total,
                theory_obtained: subject_mark.components.exam_obtained,
                practical_total: subject_mark.components.practical_total,
                practical_obtained: subject_mark.components.practical_obtained,
                assignment_total: subject_mark.components.assignment_total,
                assignment_obtained: subject_mark.components.assignment_obtained,
            });
        }
        rows
    } else {
        Vec::new()
    };
    let marks_table_html = render_result_table_html(&certificate_result_rows);

    println!("  Getting template...");
    // Step 1: Try default design for this course
    println!("  Step 1: Searching for default certificate template with course_id: {}", course_id);
    let template = match templates_coll
        .find_one(doc! { "template_type": "certificate", "course_id": course_id, "default_design": true }, None)
        .await
    {
        Ok(Some(t)) => {
            println!("  Step 1 success: found default template {:?}", t.id);
            Some(t)
        }
        Ok(None) => {
            println!("  Step 1 failed: no default design for course. Step 2: trying any certificate template for course_id: {}", course_id);
            // Step 2: Try any template for course
            match templates_coll
                .find_one(doc! { "template_type": "certificate", "course_id": course_id }, None)
                .await
            {
                Ok(Some(t)) => {
                    println!("  Step 2 success: found course-specific template {:?}", t.id);
                    Some(t)
                }
                Ok(None) => {
                    println!("  Step 2 failed: no course-specific templates. Step 3: trying any certificate template overall (no course_id filter)");
                    // Step 3: Try any template of type certificate, regardless of course_id
                    match templates_coll
                        .find_one(doc! { "template_type": "certificate" }, None)
                        .await
                    {
                        Ok(Some(t)) => {
                            println!("  Step 3 success: found global template {:?}", t.id);
                            Some(t)
                        }
                        Ok(None) => {
                            println!("  Step 3 failed: no templates found at all, using hardcoded HTML");
                            None
                        }
                        Err(e) => {
                            println!("  Step 3 error: {:?}", e);
                            None
                        }
                    }
                }
                Err(e) => {
                    println!("  Step 2 error: {:?}", e);
                    None
                }
            }
        }
        Err(e) => {
            println!("  Step 1 error: {:?}", e);
            None
        }
    };

    let template_fields = if let Some(t) = &template {
        match template_fields_coll
            .find(doc! { "template_id": t.id }, None)
            .await
        {
            Ok(mut cursor) => {
                let mut fields = Vec::new();
                while let Some(field) = cursor.next().await {
                    if let Ok(f) = field {
                        fields.push(f);
                    }
                }
                fields
            }
            _ => Vec::new(),
        }
    } else {
        Vec::new()
    };

    // Load center's signature and stamp
    let center_sign_url = center_doc
        .as_ref()
        .and_then(|c| c.key_documents.as_ref())
        .and_then(|k| k.owner_signature_url.as_ref());
    let center_stamp_url = center_doc
        .as_ref()
        .and_then(|c| c.key_documents.as_ref())
        .and_then(|k| k.center_stamp_url.as_ref());
    let center_sign_b64 = center_sign_url
        .map(|url| load_asset_base64(url))
        .unwrap_or_else(|| String::new());
    let center_stamp_b64 = center_stamp_url
        .map(|url| load_asset_base64(url))
        .unwrap_or_else(|| String::new());

    // Generate QR code with student info
    let qr_text = format!(
        "STUDENT NAME: {}\nFATHER NAME: {}\nDATE OF BIRTH: {}\nENROLLMENT NUMBER: {}\nSERIAL NUMBER: {}\nREGISTRATION NUMBER: {}\nCOURSE: {}",
        student_name, father_name, dob, enrollment_no, serial, username, course_name
    );
    let qr_b64 = qr_to_base64(&qr_text);

    // Get background image
    let background_url = if let Some(t) = &template {
        if let Some(bg) = &t.background_image {
            load_asset_base64(bg)
        } else {
            load_asset_base64("/var/www/html/scre/background.jpeg")
        }
    } else {
        load_asset_base64("/var/www/html/scre/background.jpeg")
    };

    let logo_url = load_asset_base64("/images/logo.jpeg");
    let iso_url = load_asset_base64("/images/iso.webp");

    let html = if let (Some(t), fields) = (&template, &template_fields) {
        // Build HTML using template and fields
        let mut field_html = String::new();
        for field in fields {
            let x = field.x_position;
            let y = field.y_position;
            let w = field.width;
            let h = field.height;
            let font_size = field.font_size;
            let font_family = &field.font_family;
            let color = &field.color;
            let text_align = &field.text_align;

            let content = match field.field_name.as_str() {
                "student_name" => esc_html(&student_name),
                "student_father" => esc_html(&father_name),
                "student_mother" => esc_html(&mother_name),
                "student_gender" => esc_html(&gender),
                "student_enrollment" => esc_html(&enrollment_no),
                "student_registration" => esc_html(&username),
                "course_name" => esc_html(&course_name),
                "duration" => esc_html(
                    &course_duration
                        .as_ref()
                        .map(|s| s.clone())
                        .unwrap_or_else(|| "1 Year".to_string()),
                ),
                "session" => esc_html(&session_name),
                "admission_mode" => esc_html(&admission_mode),
                "exam_mode" => esc_html(&exam_mode),
                "certificate_id" => esc_html(&serial),
                "issue_date" => esc_html(&issue_date_val),
                "center_name" => esc_html(&asc_name),
                "center_address" => esc_html(&center_address),
                "grade" => "F".to_string(),
                "qr_code" => format!(
                    r#"<img src="{}" style="width: 100%; height: 100%; object-fit: fill;" />"#,
                    qr_b64
                ),
                "center_sign" => {
                    if !center_sign_b64.is_empty() {
                        format!(
                            r#"<img src="{}" style="width: 100%; height: 100%; object-fit: fill;" />"#,
                            center_sign_b64
                        )
                    } else {
                        String::new()
                    }
                }
                "center_stamp" => {
                    if !center_stamp_b64.is_empty() {
                        format!(
                            r#"<img src="{}" style="width: 100%; height: 100%; object-fit: fill;" />"#,
                            center_stamp_b64
                        )
                    } else {
                        String::new()
                    }
                }
                "center_code" => esc_html(&center_code),
                "national_id" => esc_html(&national_id),
                "exam_date" => esc_html(&exam_date),
                "result_date" => esc_html(&result_date),
                "result_percentage" => esc_html(&result_percentage),
                "overall_status" => esc_html(&overall_status),
                "marks_table" | "result_table" => marks_table_html.clone(),
                _ => String::new(),
            };

            field_html.push_str(&format!(
                r#"<div style="position: absolute; left: {}%; top: {}%; width: {}%; height: {}%; font-size: {}px; font-family: {}; color: {}; text-align: {};" class="certificate-field">{}</div>"#,
                x, y, w, h, font_size, font_family, color, text_align, content
            ));
        }

        let page_size = match t.page_size {
            crate::models::template::PageSize::A4 => "A4",
            crate::models::template::PageSize::A3 => "A3",
            crate::models::template::PageSize::Letter => "Letter",
        };
        let orientation = match t.orientation {
            crate::models::template::PageOrientation::Portrait => "portrait",
            crate::models::template::PageOrientation::Landscape => "landscape",
        };

        format!(
            r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @page {{ size: {} {}; margin: 0; }}
        body {{ margin: 0; padding: 0; }}
        .certificate-page {{
            width: 100%;
            height: 100vh;
            background: url('{}') no-repeat center center;
            background-size: 100% 100%;
            position: relative;
            box-sizing: border-box;
        }}
    </style>
</head>
<body>
    <div class="certificate-page">
        {}
    </div>
</body>
</html>"#,
            page_size, orientation, background_url, field_html
        )
    } else {
        // Fallback to original hardcoded template
        format!(
            r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @page {{ size: A4 portrait; margin: 0; }}
        body {{
            margin: 0; padding: 0;
            font-family: 'Times New Roman', Times, serif;
            color: #333;
        }}
        .certificate-page {{
            width: 210mm; height: 297mm;
            background: url('{}') no-repeat center; background-size: contain;
            position: relative; box-sizing: border-box; padding: 25mm 20mm 15mm 20mm;
        }}
        .top-meta {{
            display: flex; justify-content: space-between;
            font-weight: bold; font-size: 13px; margin-bottom: 10px;
            padding: 0 10px;
        }}
        .branding {{ text-align: center; margin-top: 20px; position: relative; padding: 0 85px; }}
        .branding .logo-left {{ position: absolute; left: 15px; top: 0; height: 55px; }}
        .branding .logo-right {{ position: absolute; right: 15px; top: 0; height: 55px; }}
        .branding h1 {{
            font-size: 20px; margin: 8px 0; color: #000;
            font-weight: 900; text-transform: uppercase;
            word-wrap: break-word;
        }}
        .branding p {{ margin: 2px 0; font-size: 10px; font-weight: bold; }}
        .gov-text {{
            text-decoration: underline; font-weight: 900;
            font-size: 16px; margin-top: 15px !important;
        }}

        .certificate-title {{
            border-bottom: 4px double #000;
            display: inline-block;
            font-size: 28px; font-weight: 900;
            margin: 20px 0;
        }}

        /* Main Content Alignment */
        .content-area {{ text-align: left; margin-top: 20px; line-height: 2.2; }}
        .line-wrapper {{ display: flex; align-items: baseline; font-size: 18px; }}
        .label {{ font-weight: bold; white-space: nowrap; margin-right: 5px; }}
        .dotted-line {{
            flex-grow: 1; border-bottom: 2px dotted #000;
            text-align: center; font-weight: bold; font-family: sans-serif;
            padding-top: 5px; min-height: 25px;
        }}

        .bottom-grid {{
            margin-top: 25px; display: flex; justify-content: space-between; align-items: flex-end;
        }}
        .qr-section {{ text-align: center; }}
        .qr-code {{ width: 100px; height: 100px; }}
        .sig-section {{ text-align: center; width: 200px; }}
        .sig-line {{ border-top: 2px solid #000; margin-top: -10px; font-weight: bold; }}

        .footer-note {{
            position: absolute; bottom: 30mm; left: 0; right: 0;
            text-align: center; font-size: 11px; padding: 0 20mm;
        }}
    </style>
</head>
<body>
    <div class="certificate-page">
        <div class="top-meta">
            <span></span>
            <span>Serial No: {}</span>
            <span>Enrollment No: {}</span>
        </div>

        <div class="branding">
            <img src="{}" class="logo-left" />
            <img src="{}" class="logo-right" />
            <h1>SIR CHHOTU RAM EDUCATION PVT LTD</h1>
            <p>(AN ISO 9001-2015 CERTIFIED ORGANIZATION)</p>
            <p style="text-decoration: underline;">Registered Under The Company Act 2013 By The Ministry of Corporate Affairs,</p>
            <p>Ministry of Micro, Small & Medium Enterprises</p>
            <p class="gov-text">GOVERNMENT OF INDIA</p>
            <div class="certificate-title">CERTIFICATE/DIPLOMA</div>
        </div>

        <div class="content-area">
            <div class="line-wrapper">
                <span class="label">Certify that Mr./Miss/Mrs.</span>
                <span class="dotted-line">{}</span>
            </div>
            <div class="line-wrapper">
                <span class="label">Son of/Daughter of Sh.</span>
                <span class="dotted-line">{}</span>
            </div>
            <div class="line-wrapper">
                <span class="label">Registration No.</span>
                <span class="dotted-line">{}</span>
            </div>
            <div class="line-wrapper">
                <span class="label">Session</span>
                <span class="dotted-line" style="flex-grow: 0; width: 30%;">{}</span>
                <span class="label" style="margin-left: 10px;">to</span>
                <span class="dotted-line">{}</span>
            </div>
            <div class="line-wrapper">
                <span class="label">Date of Birth</span>
                <span class="dotted-line">{}</span>
            </div>
            <div class="line-wrapper">
                <span class="label">In the course</span>
                <span class="dotted-line">{}</span>
            </div>
            <div class="line-wrapper">
                <span class="label">Appeared from our ASC*</span>
                <span class="dotted-line">{} ({})</span>
            </div>
            <div class="line-wrapper">
                <span class="label">Duration of</span>
                <span class="dotted-line" style="flex-grow: 0; width: 20%;">{}</span>
                <span class="label" style="margin-left: 5px;">has successfully used by</span>
            </div>
            <div class="line-wrapper">
                <span class="label">his/her final Examination held in</span>
                <span class="dotted-line">{}</span>
            </div>
            <div class="line-wrapper">
                <span class="label">Obtained marks</span>
                <span class="dotted-line" style="flex-grow: 0; width: 30%;">{}</span>
                <span class="label" style="margin-left: 10px;">Out of</span>
                <span class="dotted-line">{}</span>
            </div>
            <div class="line-wrapper">
                <span class="label">with Grade</span>
                <span class="dotted-line" style="flex-grow: 0; width: 15%;">{}</span>
                <span class="label" style="margin-left: 5px;">and hereby awarded CERTIFICATE/DIPLOMA.</span>
            </div>
            <div class="line-wrapper" style="margin-top: 10px;">
                <span class="label">Date of Issue</span>
                <span class="dotted-line" style="flex-grow: 0; width: 40%;">{}</span>
            </div>
        </div>

        <div class="bottom-grid">
            <div class="qr-section">
                <img src="{}" class="qr-code" />
            </div>
            <div class="sig-section">
                <br/><br/>
                <div class="sig-line">Authorize Signature</div>
            </div>
        </div>

        <div class="footer-note">
            <p>This Certificate/Diploma is issued by SIR CHHOTU RAM EDUCATION PRIVATE LIMITED</p>
            <p>Result may be verified on <span style="color: brown;">www.screduc.com</span></p>
            <p>Grade A 80% &amp; Above, Grade B 60-79, Grade C 40-59, Grade Below 40%</p>
        </div>
    </div>
</body>
</html>"#,
            background_url,
            serial.clone(),
            enrollment_no.clone(),
            logo_url,
            iso_url,
            esc_html(&student_name),
            esc_html(&father_name),
            esc_html(&username),
            esc_html(&session_from),
            esc_html(&session_to),
            esc_html(&dob),
            esc_html(&course_name),
            esc_html(&asc_name),
            esc_html(&center_code),
            esc_html(&course_duration.unwrap_or_else(|| "1 Year".to_string())),
            esc_html(&session_to),
            "0",
            "0",
            "F",
            esc_html(&issue_date_val),
            qr_b64
        )
    };

    println!("  Creating new Certificate record...");
    let new_cert = Certificate {
        id: None,
        student_id: sid,
        center_id: _center_id,
        course: course_name.clone(),
        course_id: Some(course_id),
        certificate_no: serial.clone(),
        center_name: center_doc.as_ref().map(|c| c.name.clone()),
        center_signature_url: center_sign_url.map(|s| s.to_string()),
        center_stamp_url: center_stamp_url.map(|s| s.to_string()),
        admin_signature_url: None,
        admin_stamp_url: None,
        signature_url: None,
        stamp_url: None,
        background_url: template.as_ref().and_then(|t| t.background_image.clone()),
        issued_on: issue_dt,
        status: Some("approved".to_string()),
        scheduled_at: None,
        template_id: template.as_ref().and_then(|t| t.id),
        verification_url: Some(verification_url.clone()),
        pdf_url: None,
        file_path: None,
        certificate_type: crate::models::certificate::CertificateType::Certificate,
        attempt_number: Some(1),
    };

    println!("  Inserting Certificate into DB...");
    let inserted_id = match certs_coll.insert_one(new_cert, None).await {
        Ok(res) => match res.inserted_id {
            mongodb::bson::Bson::ObjectId(oid) => {
                println!("  Certificate inserted with ID: {}", oid);
                oid
            }
            _ => return,
        },
        Err(e) => {
            eprintln!("Failed to insert certificate: {}", e);
            return;
        }
    };

    let certs_raw_coll = db.collection::<Document>("certificates");
    if let Err(e) = certs_raw_coll
        .update_one(
            doc! { "_id": inserted_id },
            doc! { "$set": { "html": html.clone() } },
            None,
        )
        .await
    {
        eprintln!("Failed to persist certificate HTML for {}: {}", serial, e);
    }

    let file_name = format!("{}.pdf", serial);
    let rel_path = format!("certificates/{}", file_name);
    let full_path = PathBuf::from(&upload_dir).join(&rel_path);

    println!("  PDF file path: {:?}", full_path);

    let db_clone = db.clone();
    let cert_row_id = inserted_id;
    let file_path_for_db = rel_path.clone();
    let full_path_for_gen = full_path.clone();
    let html_for_gen = html.clone();
    let certificate_no = serial.clone();

    tokio::spawn(async move {
        println!("  Spawning PDF generation task for {}", certificate_no);
        let gen_res = tokio::task::spawn_blocking(move || {
            println!("    Starting PDF generation...");
            let res = PdfGenerator::html_to_pdf(&html_for_gen, full_path_for_gen)
                .map_err(|e| e.to_string());
            println!("    PDF generation result: {:?}", res);
            res
        })
        .await;

        match gen_res {
            Ok(Ok(())) => {
                let certs_coll = db_clone.collection::<Certificate>("certificates");
                match certs_coll
                    .update_one(
                        doc! { "_id": cert_row_id },
                        doc! { "$set": { "file_path": file_path_for_db } },
                        None,
                    )
                    .await
                {
                    Ok(_) => {}
                    Err(e) => eprintln!("certificate file_path update failed: {}", e),
                }
            }
            Ok(Err(e)) => {
                eprintln!(
                    "Failed to generate certificate PDF for {}: {}",
                    certificate_no, e
                );
            }
            Err(e) => {
                eprintln!("PDF generation task join error: {}", e);
            }
        }
    });
}

pub async fn process_pending_certificates(db: &Database) {
    println!("Starting process_pending_certificates...");
    let settings = load_settings(db).await;
    let delay_days = settings.auto_certificate_generation_days;
    let now = Utc::now();
    
    let elig_coll = db.collection::<CertificateEligibility>("certificate_eligibility");
    let certs_coll = db.collection::<Certificate>("certificates");
    
    let filter = doc! {
        "eligibility_type": "certificate",
        "processed": false,
        "eligible_at": { "$lte": mongodb::bson::DateTime::from_chrono(now - Duration::days(delay_days as i64)) }
    };
    
    let mut cursor = match elig_coll.find(filter, None).await {
        Ok(c) => c,
        Err(e) => {
            println!("Error finding pending certificate eligibilities: {}", e);
            return;
        }
    };

    while let Some(res) = cursor.next().await {
        let elig = match res {
            Ok(e) => e,
            Err(e) => {
                println!("Error processing certificate eligibility: {}", e);
                continue;
            }
        };
        
        // Check if certificate already exists for student/course
        let existing_cert = certs_coll
            .find_one(
                doc! {
                    "student_id": elig.student_id, 
                    "course_id": elig.course_id, 
                    "certificate_type": "certificate"
                },
                None,
            )
            .await
            .ok()
            .flatten();
        if existing_cert.is_some() {
            // Mark as processed if already exists
            let _ = elig_coll
                .update_one(
                    doc! { "_id": elig.id },
                    doc! { "$set": { 
                        "processed": true, 
                        "processed_at": mongodb::bson::DateTime::now(),
                        "updated_at": mongodb::bson::DateTime::now()
                    } },
                    None,
                )
                .await;
            continue;
        }
        
        // Process the student certificate
        process_student_certificate(db, elig.student_id).await;
        
        // Mark eligibility as processed
        let _ = elig_coll
            .update_one(
                doc! { "_id": elig.id },
                doc! { "$set": { 
                    "processed": true, 
                    "processed_at": mongodb::bson::DateTime::now(),
                    "updated_at": mongodb::bson::DateTime::now()
                } },
                None,
            )
            .await;
    }
}
