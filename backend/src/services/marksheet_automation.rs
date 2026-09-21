use crate::models::academic::CourseSubject;
use crate::models::admin_assets::AdminAssets;
use crate::models::announcement::{Announcement, AnnouncementPriority, TargetType};
use crate::models::center::Center;
use crate::models::certificate::Certificate;
use crate::models::certificate_auto_generation::CertificateEligibility;
use crate::models::exam_workflow::CourseExamAttempt;
use crate::models::subject::Subject;
use crate::models::user::{User, UserRole};
use crate::models::template::{Template, TemplateField};
use crate::services::marks_calculation::{ResultTableRow, render_result_table_html};
use crate::services::pdf_generator::PdfGenerator;
use chrono::Utc;
use futures_util::StreamExt;
use mongodb::{
    Database,
    bson::{doc, oid::ObjectId},
};
use serde::{Deserialize, Serialize};
use std::env;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct MarksRow {
    pub subject: String,
    pub max_marks: f64,
    pub min_marks: f64,
    pub obtained: f64,
    pub status: String,
    pub percentage: f64,
    pub theory_total: f64,
    pub theory_obtained: f64,
    pub practical_total: f64,
    pub practical_obtained: f64,
    pub assignment_total: f64,
    pub assignment_obtained: f64,
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

pub async fn process_student_marksheet(db: &Database, eligibility: CertificateEligibility) {
    let users_coll = db.collection::<User>("users");
    let course_subjects_coll = db.collection::<CourseSubject>("course_subjects");
    let paper_v2_coll = db.collection::<mongodb::bson::Document>("exam_v2_papers");
    let certs_coll = db.collection::<Certificate>("certificates");
    let paper_v2_tpl_coll = db.collection::<mongodb::bson::Document>("exam_v2_paper_templates");
    let centers_coll = db.collection::<Center>("centers");
    let courses_coll = db.collection::<crate::models::course::Course>("courses");
    let subjects_coll = db.collection::<mongodb::bson::Document>("subjects");
    let admin_assets_coll = db.collection::<AdminAssets>("admin_assets");
    let templates_coll = db.collection::<Template>("templates");
    let template_fields_coll = db.collection::<TemplateField>("template_fields");
    let course_exam_attempts_coll = db.collection::<CourseExamAttempt>("course_exam_attempts");
    let base_url = env::var("BASE_URL").unwrap_or_else(|_| "https://screduc.com".to_string());
    let upload_dir = env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string());

    println!(
        "Starting process_student_marksheet for student: {}, attempt: {:?}",
        eligibility.student_id, eligibility.attempt_number
    );

    let user = match users_coll.find_one(doc! { "_id": eligibility.student_id }, None).await {
        Ok(Some(u)) => u,
        Ok(None) => {
            println!("Student not found: {}", eligibility.student_id);
            return;
        }
        Err(e) => {
            println!("Error fetching student: {}", e);
            return;
        }
    };

    let sid = user.id.unwrap();
    let course_id = eligibility.course_id;
    let attempt_number = eligibility.attempt_number.unwrap_or(1);
    println!("Processing student: {}, ID: {}, Course: {}, Attempt: {}", user.username, sid, course_id, attempt_number);

    println!("  Getting template...");
    // Step 1: Try default design for this course
    println!("  Step 1: Searching for default marksheet template with course_id: {}", course_id);
    let template = match templates_coll
        .find_one(doc! { "template_type": "marksheet", "course_id": course_id, "default_design": true }, None)
        .await
    {
        Ok(Some(t)) => {
            println!("  Step 1 success: found default template {:?}", t.id);
            Some(t)
        }
        Ok(None) => {
            println!("  Step 1 failed: no default design for course. Step 2: trying any marksheet template for course_id: {}", course_id);
            // Step 2: Try any template for course
            match templates_coll
                .find_one(doc! { "template_type": "marksheet", "course_id": course_id }, None)
                .await
            {
                Ok(Some(t)) => {
                    println!("  Step 2 success: found course template {:?}", t.id);
                    Some(t)
                }
                Ok(None) => {
                    println!("  Step 2 failed: no template for course. Step 3: trying any marksheet template overall.");
                    // Step 3: Try any template
                    match templates_coll
                        .find_one(doc! { "template_type": "marksheet" }, None)
                        .await
                    {
                        Ok(Some(t)) => {
                            println!("  Step 3 success: found general template {:?}", t.id);
                            Some(t)
                        }
                        Ok(None) => {
                            println!("  Step 3 failed: no marksheet templates found, using hardcoded design.");
                            None
                        }
                        Err(e) => {
                            eprintln!("  Error searching for any marksheet template: {}", e);
                            None
                        }
                    }
                }
                Err(e) => {
                    eprintln!("  Error searching for course marksheet template: {}", e);
                    None
                }
            }
        }
        Err(e) => {
            eprintln!("  Error searching for default marksheet template: {}", e);
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

    let mut subject_cursor = match course_subjects_coll
        .find(doc! { "course_id": course_id }, None)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            println!("  Error fetching course subjects: {}", e);
            return;
        }
    };
    let mut required_subjects = Vec::new();
    while let Some(Ok(cs)) = subject_cursor.next().await {
        required_subjects.push(cs.subject_id);
    }
    println!("  Required subjects count: {}", required_subjects.len());

    if required_subjects.is_empty() {
        println!("  Skipping: No required subjects");
        return;
    }

    let filter = doc! {
        "student_id": sid,
        "status": "evaluated",
        "attempt_number": attempt_number
    };
    let mut paper_cursor = match paper_v2_coll.find(filter, None).await {
        Ok(c) => c,
        Err(e) => {
            println!("  Error fetching papers: {}", e);
            return;
        }
    };
    let mut all_evaluated_papers = Vec::new();
    while let Some(Ok(paper)) = paper_cursor.next().await {
        all_evaluated_papers.push(paper);
    }
    println!("  Evaluated papers count: {}", all_evaluated_papers.len());

    // Check for old CourseExamAttempt records with marks_submitted = true
    let mut course_exam_attempts = Vec::new();
    let cea_filter = doc! {
        "student_id": sid,
        "course_id": course_id,
        "attempt_number": attempt_number,
        "marks_submitted": true
    };
    let mut cea_cursor = match course_exam_attempts_coll.find(cea_filter, None).await {
        Ok(c) => c,
        Err(e) => {
            println!("  Error fetching CourseExamAttempt: {}", e);
            return;
        }
    };
    while let Some(Ok(cea)) = cea_cursor.next().await {
        course_exam_attempts.push(cea);
    }
    println!("  Found {} CourseExamAttempt records with marks submitted", course_exam_attempts.len());

    let mut all_subjects_completed = true;
    let mut latest_update_time = Utc::now() - chrono::Duration::days(365);
    if !all_evaluated_papers.is_empty() {
        for sub_id in &required_subjects {
            let mut subject_found = false;
            for paper in &all_evaluated_papers {
                if let Ok(paper_template_id) = paper.get_object_id("paper_template_id") {
                    if let Ok(Some(tpl)) = paper_v2_tpl_coll
                        .find_one(doc! { "_id": paper_template_id }, None)
                        .await
                    {
                        if tpl.get_object_id("subject_id").ok() == Some(*sub_id) {
                            subject_found = true;
                            if let Ok(st) = paper.get_datetime("submit_time") {
                                let st_chrono = st.to_chrono();
                                if st_chrono > latest_update_time {
                                    latest_update_time = st_chrono;
                                }
                            }
                            break;
                        }
                    }
                }
            }
            if !subject_found {
                all_subjects_completed = false;
                println!(
                    "  Skipping: Subject {} not found in evaluated papers",
                    sub_id
                );
                break;
            }
        }
    } else if !course_exam_attempts.is_empty() {
        // Check CourseExamAttempt
        let cea = course_exam_attempts.first().unwrap();
        latest_update_time = cea.updated_at.into();
        // Check if we have marks for all subjects
        let mut subject_names_from_cea = Vec::new();
        for sm in &cea.subject_marks {
            if let Ok(Some(subj)) = subjects_coll.find_one(doc! { "_id": sm.subject_id }, None).await {
                if let Ok(name) = subj.get_str("subject_name") {
                    subject_names_from_cea.push(name.to_string());
                }
            }
        }
        let mut required_subject_names = Vec::new();
        for sub_id in &required_subjects {
            if let Ok(Some(subj)) = subjects_coll.find_one(doc! { "_id": sub_id }, None).await {
                if let Ok(name) = subj.get_str("subject_name") {
                    required_subject_names.push(name.to_string());
                }
            }
        }
        for req_subj in &required_subject_names {
            if !subject_names_from_cea.contains(req_subj) {
                all_subjects_completed = false;
                println!("  Skipping: Subject {} not found in CourseExamAttempt marks", req_subj);
                break;
            }
        }
    } else {
        println!("  No v2 papers or CourseExamAttempt records found, skipping.");
        return;
    }

    if !all_subjects_completed {
        return;
    }

    println!("  All subjects completed! Proceeding to generate marksheet!");

    let existing_ms = certs_coll
        .find_one(
            doc! { "student_id": sid, "course_id": course_id, "certificate_type": "marksheet", "attempt_number": attempt_number },
            None,
        )
        .await
        .ok()
        .flatten();

    if let Some(ms) = existing_ms.as_ref() {
        if ms.file_path.as_ref().map_or(false, |fp| !fp.is_empty()) {
            println!("  Marksheet already exists with file path, skipping generation.");
            return;
        }
    }

    println!("  Starting to collect marks...");
    let mut marks_rows = Vec::new();
    let mut seen_subjects = std::collections::HashSet::new();
    let mut grand_total_max = 0.0;
    let mut grand_total_obtained = 0.0;

    if !course_exam_attempts.is_empty() {
        let cea = course_exam_attempts.first().unwrap();
        for sm in &cea.subject_marks {
            let subject_name = if let Ok(Some(subj)) = subjects_coll
                .find_one(doc! { "_id": sm.subject_id }, None)
                .await
            {
                if let Ok(name) = subj.get_str("subject_name") {
                    name.to_string()
                } else {
                    "Unknown Subject".to_string()
                }
            } else {
                "Unknown Subject".to_string()
            };

            let subject_key = subject_name.clone();
            if !seen_subjects.contains(&subject_key) {
                let max = sm.total.max(0.0);
                let obtained = sm.obtained.max(0.0);
                let min = (max * 0.4).round();
                let status = if sm.subject_passed {
                    "PASS".to_string()
                } else {
                    "FAIL".to_string()
                };
                let percentage = if max > 0.0 {
                    (obtained / max * 100.0).round()
                } else {
                    0.0
                };
                marks_rows.push(MarksRow {
                    subject: subject_name,
                    obtained,
                    max_marks: max,
                    min_marks: min,
                    status,
                    percentage,
                    theory_total: sm.components.exam_total,
                    theory_obtained: sm.components.exam_obtained,
                    practical_total: sm.components.practical_total,
                    practical_obtained: sm.components.practical_obtained,
                    assignment_total: sm.components.assignment_total,
                    assignment_obtained: sm.components.assignment_obtained,
                });
                seen_subjects.insert(subject_key);
                grand_total_max += max;
                grand_total_obtained += obtained;
            }
        }
    } else if !all_evaluated_papers.is_empty() {
        let mut sorted_papers = all_evaluated_papers.clone();
        sorted_papers.sort_by(|a, b| {
            let a_attempt = a.get_i32("attempt_number").unwrap_or(0);
            let b_attempt = b.get_i32("attempt_number").unwrap_or(0);
            b_attempt.cmp(&a_attempt)
        });

        let mut paper_idx = 0;
        for p2 in sorted_papers {
            paper_idx += 1;
            if let Ok(paper_template_id) = p2.get_object_id("paper_template_id") {
                if let Ok(Some(tpl)) = paper_v2_tpl_coll
                    .find_one(doc! { "_id": paper_template_id }, None)
                    .await
                {
                    let subject_name = if let Ok(subject_id) = tpl.get_object_id("subject_id") {
                        match subjects_coll
                            .find_one(doc! { "_id": subject_id }, None)
                            .await
                        {
                            Ok(Some(subj)) => {
                                let name = subj
                                    .get_str("subject_name")
                                    .unwrap_or("Unknown Subject")
                                    .to_string();
                                name
                            }
                            Ok(None) => tpl
                                .get_str("name")
                                .ok()
                                .unwrap_or("Unknown Subject")
                                .to_string(),
                            Err(_) => tpl
                                .get_str("name")
                                .ok()
                                .unwrap_or("Unknown Subject")
                                .to_string(),
                        }
                    } else {
                        tpl.get_str("name")
                            .ok()
                            .unwrap_or("Unknown Subject")
                            .to_string()
                    };

                    let mut total_obtained_for_subject = 0.0;
                    let mut total_max_for_subject = 0.0;

                    if let Ok(section_wise) = p2.get_document("section_wise_marks") {
                        for (_sec_id, obtained_bson) in section_wise {
                            let obtained = obtained_bson.as_f64().unwrap_or(0.0);
                            if let Ok(sections_arr) = tpl.get_array("sections") {
                                if let Some(sec_doc) =
                                    sections_arr.iter().find_map(|s| s.as_document())
                                {
                                    if let (Ok(marks), Ok(count)) =
                                        (sec_doc.get_f64("marks"), sec_doc.get_i32("count"))
                                    {
                                        let sec_max = marks * count as f64;
                                        total_obtained_for_subject += obtained;
                                        total_max_for_subject += sec_max;
                                    }
                                }
                            }
                        }
                    }

                    let subject_key = subject_name.clone();
                    if !seen_subjects.contains(&subject_key) {
                        let max = total_max_for_subject.max(100.0);
                        let min = (max * 0.4).round();
                        let obtained = total_obtained_for_subject;
                        let status = if obtained >= min {
                            "PASS".to_string()
                        } else {
                            "FAIL".to_string()
                        };
                        let percentage = if max > 0.0 {
                            (obtained / max * 100.0).round()
                        } else {
                            0.0
                        };
                        marks_rows.push(MarksRow {
                            subject: subject_name,
                            obtained,
                            max_marks: max,
                            min_marks: min,
                            status,
                            percentage,
                            theory_total: max,
                            theory_obtained: obtained,
                            practical_total: 0.0,
                            practical_obtained: 0.0,
                            assignment_total: 0.0,
                            assignment_obtained: 0.0,
                        });
                        seen_subjects.insert(subject_key);
                        grand_total_max += max;
                        grand_total_obtained += obtained;
                    }
                }
            }
        }
    }
    println!(
        "  Finished collecting marks rows, total: {}",
        marks_rows.len()
    );

    println!("  Getting center doc...");
    let (center_doc, _center_id) = if let Some(parent_id) = user.parent_id {
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
    let mut course_name = user.course.clone().unwrap_or_default();
    let mut course_duration: Option<String> = None;
    let _course_id_opt: Option<ObjectId> = Some(course_id);
    if let Ok(Some(c)) = courses_coll.find_one(doc! { "_id": course_id }, None).await {
        course_name = c.course_name.clone();
        course_duration = Some(format!("{} Months", c.duration_months));
    }

    println!("  Getting enrollment number...");
    let enrollment_no = if user.enrollment_number.is_none()
        || user
            .enrollment_number
            .as_ref()
            .map(|s| s.trim().is_empty())
            .unwrap_or(true)
    {
        let _creator_id = user.parent_id.unwrap_or(sid);
        let new_enrollment = generate_enrollment_number(db, &_creator_id).await;
        let _ = users_coll
            .update_one(
                doc! { "_id": &sid },
                doc! { "$set": { "enrollment_number": &new_enrollment } },
                None,
            )
            .await;
        new_enrollment
    } else {
        user.enrollment_number.clone().unwrap()
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

    let student_name = user
        .full_name
        .clone()
        .unwrap_or_else(|| user.username.clone());
    let father_name = user
        .father_name
        .clone()
        .unwrap_or_else(|| "NOT FOUND".to_string());
    let mother_name = user
        .mother_name
        .clone()
        .unwrap_or_else(|| "NOT FOUND".to_string());
    let dob = user.dob.clone().unwrap_or_else(|| "NOT FOUND".to_string());
    let session_from = user
        .session_start_date
        .clone()
        .unwrap_or_else(|| "Jan 2025".to_string());
    let session_to = user
        .session_end_date
        .clone()
        .unwrap_or_else(|| "Jan 2026".to_string());
    let asc_code = center_doc
        .as_ref()
        .map(|c| c.code.clone())
        .unwrap_or_else(|| "SCRE2026".to_string());
    let asc_name = center_doc
        .as_ref()
        .map(|c| c.name.clone())
        .unwrap_or_else(|| "NOT FOUND".to_string());
    let center_address = center_doc
        .as_ref()
        .map(|c| c.address.clone())
        .unwrap_or_else(|| "".to_string());

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

    let national_id_display = match (&user.national_id_type, &user.national_id) {
        (Some(t), Some(n)) => format!("{}: {}", t, n),
        (None, Some(n)) => format!("National ID: {}", n),
        _ => "National ID: N/A".to_string(),
    };

    let shared_marks_rows: Vec<ResultTableRow> = marks_rows
        .iter()
        .map(|row| ResultTableRow {
            subject: row.subject.clone(),
            max_marks: row.max_marks,
            obtained: row.obtained,
            status: row.status.clone(),
            theory_total: row.theory_total,
            theory_obtained: row.theory_obtained,
            practical_total: row.practical_total,
            practical_obtained: row.practical_obtained,
            assignment_total: row.assignment_total,
            assignment_obtained: row.assignment_obtained,
        })
        .collect();
    let marks_table_html = render_result_table_html(&shared_marks_rows);
    let grand_max: f64 = marks_rows.iter().map(|row| row.max_marks).sum();
    let grand_obt: f64 = marks_rows.iter().map(|row| row.obtained).sum();

    let percentage = if grand_max > 0.0 {
        (grand_obt / grand_max * 100.0).round()
    } else {
        0.0
    };
    let grade = if percentage >= 90.0 {
        "A+"
    } else if percentage >= 80.0 {
        "A"
    } else if percentage >= 70.0 {
        "B+"
    } else if percentage >= 60.0 {
        "B"
    } else if percentage >= 50.0 {
        "C"
    } else if percentage >= 40.0 {
        "D"
    } else {
        "F"
    };
    let overall_status = if percentage >= 40.0 { "PASS" } else { "FAIL" };

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
                "student_enrollment" => esc_html(&enrollment_no),
                "student_registration" => esc_html(&user.username),
                "course_name" => esc_html(&course_name),
                "duration" => esc_html(
                    &course_duration
                        .as_ref()
                        .map(|s| s.clone())
                        .unwrap_or_else(|| "1 Year".to_string()),
                ),
                "session" => esc_html(&session_from),
                "session_from" => esc_html(&session_from),
                "session_to" => esc_html(&session_to),
                "certificate_id" => esc_html(&serial),
                "issue_date" => esc_html(&issue_date_val),
                "center_name" => esc_html(&asc_name),
                "center_address" => esc_html(&center_address),
                "center_code" => esc_html(&asc_code),
                "student_dob" => esc_html(&dob),
                "result_percentage" => format!("{:.0}%", percentage),
                "result_grade" => grade.to_string(),
                "overall_status" => esc_html(&overall_status),
                "qr_code" => {
                    let qr_text = format!(
                        "STUDENT NAME: {}\nFATHER NAME: {}\nDATE OF BIRTH: {}\nENROLLMENT NUMBER: {}\nSERIAL NUMBER: {}\nREGISTRATION NUMBER: {}\nCOURSE: {}",
                        student_name, father_name, dob, enrollment_no, serial, user.username, course_name
                    );
                    format!(
                        r#"<img src="{}" style="width: 100%; height: 100%; object-fit: fill;" />"#,
                        qr_to_base64(&qr_text)
                    )
                },
                "center_sign" => {
                    if !center_sign_b64.is_empty() {
                        format!(
                            r#"<img src="{}" style="width: 100%; height: 100%; object-fit: fill;" />"#,
                            center_sign_b64
                        )
                    } else {
                        String::new()
                    }
                },
                "center_stamp" => {
                    if !center_stamp_b64.is_empty() {
                        format!(
                            r#"<img src="{}" style="width: 100%; height: 100%; object-fit: fill;" />"#,
                            center_stamp_b64
                        )
                    } else {
                        String::new()
                    }
                },
                "student_photo" => {
                    let student_photo_b64 = user
                        .photo_url
                        .as_ref()
                        .map(|p| load_asset_base64(p))
                        .unwrap_or_else(|| load_asset_base64("/images/default-avatar.png"));
                    format!(
                        r#"<img src="{}" style="width: 100%; height: 100%; object-fit: fill;" />"#,
                        student_photo_b64
                    )
                },
                "logo" => {
                    let logo_b64 = load_asset_base64("/images/logo.jpeg");
                    format!(
                        r#"<img src="{}" style="width: 100%; height: 100%; object-fit: fill;" />"#,
                        logo_b64
                    )
                },
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
        let background_url = if let Some(bg) = &t.background_image {
            load_asset_base64(bg)
        } else {
            load_asset_base64("/var/www/html/scre/background.jpeg")
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
        let background_url = load_asset_base64("/var/www/html/scre/background.jpeg");
        let logo_url = load_asset_base64("/images/logo.jpeg");
        let iso_url = load_asset_base64("/images/iso.webp");
        let student_photo = user
            .photo_url
            .as_ref()
            .map(|p| load_asset_base64(p))
            .unwrap_or_else(|| load_asset_base64("/images/default-avatar.png"));
        let qr_text = format!(
            "STUDENT NAME: {}\nFATHER NAME: {}\nDATE OF BIRTH: {}\nENROLLMENT NUMBER: {}\nSERIAL NUMBER: {}\nREGISTRATION NUMBER: {}\nCOURSE: {}",
            student_name, father_name, dob, enrollment_no, serial, user.username, course_name
        );
        let qr_b64 = qr_to_base64(&qr_text);

        format!(
            r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @page {{ size: A4 portrait; margin: 0; }}
        body {{ margin: 0; padding: 0; font-family: "Nirmala UI", "Mangal", "Arial Unicode MS", "Arial", sans-serif; font-size: 14px; }}
        .certificate-page {{
            width: 210mm; height: 297mm;
            background: url('{}') no-repeat center; background-size: cover;
            position: relative; box-sizing: border-box; padding: 20mm;
        }}
        .header {{ display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 10px; font-size: 13px; }}
        .branding {{ text-align: center; margin-bottom: 15px; position: relative; }}
        .branding h1 {{ font-size: 24px; margin: 5px 0; color: #1e3a8a; font-weight: bold; }}
        .branding p {{ margin: 5px 0; font-size: 14px; }}
        .branding .logo-left {{ position: absolute; left: 0; top: 0; height: 80px; }}
        .branding .logo-right {{ position: absolute; right: 0; top: 0; height: 80px; }}
        
        .section-title {{ background: #1e3a8a; color: white; padding: 8px; text-align: center; font-weight: bold; margin: 12px 0; font-size: 16px; }}
        
        .info-grid {{ display: grid; grid-template-columns: 1fr 1fr 120px; gap: 12px; margin-bottom: 12px; }}
        .info-item {{ margin-bottom: 8px; }}
        .info-item label {{ font-weight: bold; display: block; font-size: 12px; color: #555; }}
        .info-item span {{ font-size: 14px; font-weight: bold; }}
        .photo-box {{ width: 110px; height: 130px; border: 2px solid #000; background: white; }}

        .marks-table {{ width: 100%; border-collapse: collapse; text-align: center; }}
        .marks-table th, .marks-table td {{ border: 2px solid black; padding: 8px; font-size: 12px; }}
        .marks-table th {{ background: #1e3a8a; color: white; font-weight: bold; }}
        .subject-cell {{ text-align: left; font-size: 11px; line-height: 1.2; word-wrap: break-word; }}

        .bottom-area {{ display: flex; justify-content: space-between; margin-top: 20px; align-items: flex-start; }}
        .summary-box {{ border: 2px solid black; width: 65%; }}
        .summary-box table {{ width: 100%; border-collapse: collapse; }}
        .summary-box td {{ padding: 8px; border: 1px solid #ccc; font-size: 13px; }}
        .qr-sig-area {{ width: 30%; text-align: center; }}
        .qr-code {{ width: 90px; height: 90px; }}
    </style>
</head>
<body>
    <div class="certificate-page">
        <div class="header">
            <span>{}</span>
            <span>Serial No: {}</span>
            <span>Enrollment No: {}</span>
        </div>
        <div class="branding">
            <img src="{}" class="logo-left" />
            <img src="{}" class="logo-right" />
            <h1>SIR CHHOTU RAM EDUCATION PVT LTD</h1>
            <p>(AN ISO 9001-2015 CERTIFIED ORGANIZATION)</p>
            <p>Government of India - Ministry of Corporate Affairs</p>
        </div>

        <div class="section-title">STUDENT DETAILS</div>
        <div class="info-grid">
            <div>
                <div class="info-item"><label>विद्यार्थी का नाम / Student Name:</label> <span>{}</span></div>
                <div class="info-item"><label>माँ का नाम / Mother's Name:</label> <span>{}</span></div>
            </div>
            <div>
                <div class="info-item"><label>पिता का नाम / Father's Name:</label> <span>{}</span></div>
                <div class="info-item"><label>जन्म तिथि / Date of Birth:</label> <span>{}</span></div>
            </div>
            <div class="photo-box"><img src="{}" style="width:100%; height:100%; object-fit: cover;" /></div>
        </div>

        <div class="section-title">COURSE DETAILS</div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="info-item"><label>कोर्स का नाम / Course Name:</label> <span>{}</span></div>
            <div class="info-item"><label>अवधি / Duration:</label> <span>{}</span></div>
            <div class="info-item"><label>सत्र / Session:</label> <span>{} - {}</span></div>
            <div class="info-item"><label>ASC कोड / ASC Code:</label> <span>{}</span></div>
        </div>

        <div class="section-title">RESULT STATEMENT</div>
        {}

        <div class="bottom-area">
            <div class="summary-box">
                <div style="background:#1e3a8a; color:white; font-weight:bold; padding:8px; text-align:center; font-size: 16px;">SUMMARY</div>
                <table>
                    <tr><td>Result Date: {}</td><td>Percentage: {:.0}%</td></tr>
                    <tr><td>Grade: {}</td><td>Overall Status: {}</td></tr>
                </table>
            </div>
            <div class="qr-sig-area">
                <img src="{}" class="qr-code" /><br/>
                <div style="border-top:2px solid black; margin-top:10px; padding-top:5px; font-weight: bold;">Authorize Signature</div>
            </div>
        </div>
    </div>
</body>
</html>"#,
            background_url,
            national_id_display.clone(),
            serial.clone(),
            enrollment_no.clone(),
            logo_url,
            iso_url,
            esc_html(&student_name),
            esc_html(&mother_name),
            esc_html(&father_name),
            esc_html(&dob),
            student_photo,
            esc_html(&course_name),
            esc_html(&course_duration.unwrap_or_else(|| "12 Months".to_string())),
            esc_html(&session_from),
            esc_html(&session_to),
            esc_html(&asc_code),
            marks_table_html,
            issue_date_val.clone(),
            percentage,
            grade,
            overall_status,
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
        admin_signature_url: admin_assets_coll
            .find_one(doc! {}, None)
            .await
            .ok()
            .flatten()
            .and_then(|a| a.signature_url.clone()),
        admin_stamp_url: admin_assets_coll
            .find_one(doc! {}, None)
            .await
            .ok()
            .flatten()
            .and_then(|a| a.stamp_url.clone()),
        signature_url: admin_assets_coll
            .find_one(doc! {}, None)
            .await
            .ok()
            .flatten()
            .and_then(|a| a.signature_url.clone()),
        stamp_url: admin_assets_coll
            .find_one(doc! {}, None)
            .await
            .ok()
            .flatten()
            .and_then(|a| a.stamp_url.clone()),
        background_url: template.as_ref().and_then(|t| t.background_image.clone()),
        issued_on: issue_dt,
        status: Some("approved".to_string()),
        scheduled_at: None,
        template_id: template.as_ref().and_then(|t| t.id),
        verification_url: Some(verification_url.clone()),
        pdf_url: None,
        file_path: None,
        certificate_type: crate::models::certificate::CertificateType::Marksheet,
        attempt_number: Some(attempt_number),
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

    // Use absolute path for upload directory to avoid CWD issues, create directories!
    let upload_dir = std::env::var("UPLOAD_DIR")
        .unwrap_or_else(|_| "/var/www/html/scre/backend/uploads".to_string());
    let upload_dir_pb = std::path::PathBuf::from(&upload_dir);
    if !upload_dir_pb.exists() {
        match std::fs::create_dir_all(&upload_dir_pb) {
            Ok(_) => println!("Created upload directory at {:?}", upload_dir_pb),
            Err(e) => eprintln!("Failed to create upload directory: {}", e),
        }
    }
    // Create marksheets directory!
    let marksheet_dir = upload_dir_pb.join("marksheets");
    if !marksheet_dir.exists() {
        match std::fs::create_dir_all(&marksheet_dir) {
            Ok(_) => println!("Created marksheets directory at {:?}", marksheet_dir),
            Err(e) => eprintln!("Failed to create marksheets directory: {}", e),
        }
    }

    let file_name = format!("{}.pdf", serial);
    let rel_path = format!("marksheets/{}", file_name);
    let full_path = upload_dir_pb.join(&rel_path);

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

pub async fn process_pending_marksheets(db: &Database) {
    println!("Starting process_pending_marksheets...");
    let elig_coll = db.collection::<CertificateEligibility>("certificate_eligibility");
    let certs_coll = db.collection::<Certificate>("certificates");

    let filter = doc! {
        "eligibility_type": "marksheet",
        "processed": false
    };

    let mut cursor = match elig_coll.find(filter, None).await {
        Ok(c) => c,
        Err(e) => {
            println!("Error finding pending marksheet eligibilities: {}", e);
            return;
        }
    };

    while let Some(res) = cursor.next().await {
        let eligibility = match res {
            Ok(e) => e,
            Err(e) => {
                println!("Error processing marksheet eligibility: {}", e);
                continue;
            }
        };

        // Check if marksheet already exists for student/course/attempt
        let existing_ms = certs_coll
            .find_one(
                doc! {
                    "student_id": eligibility.student_id,
                    "course_id": eligibility.course_id,
                    "certificate_type": "marksheet",
                    "attempt_number": eligibility.attempt_number
                },
                None,
            )
            .await
            .ok()
            .flatten();

        if existing_ms.is_some() {
            // Mark as processed if already exists
            let _ = elig_coll
                .update_one(
                    doc! { "_id": eligibility.id },
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

        // Process the student marksheet
        process_student_marksheet(db, eligibility.clone()).await;

        // Mark eligibility as processed
        let _ = elig_coll
            .update_one(
                doc! { "_id": eligibility.id },
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
