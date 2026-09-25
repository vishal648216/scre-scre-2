use axum::{Json, extract::{State, Path}, http::StatusCode};
use chrono::Utc;
use mongodb::{
    Database,
    bson::{Bson, Document, doc, oid::ObjectId},
};

#[derive(Debug, Serialize)]
pub struct V2Msg {
    pub success: bool,
    pub message: String,
}
use futures_util::stream::StreamExt;
use serde::{Deserialize, Serialize};
use std::env;

use crate::models::academic::{CourseSubject, Session};
use crate::models::admin_assets::AdminAssets;
use crate::models::center::Center;
use crate::models::certificate::Certificate;
use crate::models::certificate_auto_generation::CertificateEligibility;
use crate::models::course::Course;
use crate::models::exam_engine::PaperQuestionMapping as SubjectResult;
use crate::models::exam_engine::{ExamBlueprint, StudentPaper as Marksheet};
use crate::models::exam_engine_v2::{ExamV2Exam, ExamV2Paper, ExamV2PaperTemplate};
use crate::models::subject::Subject;
use crate::models::template::{PageOrientation, PageSize, Template, TemplateField, TemplateType};
use crate::models::user::{Claims, SubjectMarks, User, UserRole};
use crate::services::marks_calculation::{ResultTableRow, render_result_table_html};
use crate::services::pdf_generator::PdfGenerator;
use crate::util::generators::generate_enrollment_number_old;
use std::path::PathBuf;

fn generate_certificate_number(student_id: &ObjectId) -> String {
    let ts = Utc::now().timestamp_millis();
    format!("CERT-{}-{}", student_id.to_hex(), ts)
}

fn esc_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Placeholder for empty optional student / template data (per product requirement).

const MISSING_FIELD: &str = "NOT FOUND";

fn or_not_found(s: String) -> String {
    if s.trim().is_empty() {
        MISSING_FIELD.to_string()
    } else {
        s
    }
}

fn opt_str_missing(o: &Option<String>) -> String {
    match o {
        None => MISSING_FIELD.to_string(),
        Some(s) => or_not_found(s.clone()),
    }
}

fn debug_env_value(key: &str) -> Option<String> {
    for session_id in ["admin-certificate-download", "certificate-blank-render"] {
        let env_path = format!("/var/www/html/scre/.dbg/{}.env", session_id);
        let Ok(content) = std::fs::read_to_string(env_path) else {
            continue;
        };
        for line in content.lines() {
            if let Some(value) = line.strip_prefix(&format!("{key}=")) {
                return Some(value.trim().to_string());
            }
        }
    }
    None
}

async fn debug_report(
    run_id: &str,
    hypothesis_id: &str,
    location: &str,
    msg: &str,
    data: serde_json::Value,
) {
    let url = debug_env_value("DEBUG_SERVER_URL")
        .unwrap_or_else(|| "http://127.0.0.1:7780/event".to_string());
    let session_id = debug_env_value("DEBUG_SESSION_ID")
        .unwrap_or_else(|| "certificate-blank-render".to_string());
    let payload = serde_json::json!({
        "sessionId": session_id,
        "runId": run_id,
        "hypothesisId": hypothesis_id,
        "location": location,
        "msg": msg,
        "data": data,
        "ts": chrono::Utc::now().timestamp_millis(),
    });
    let _ = reqwest::Client::new().post(url).json(&payload).send().await;
}

fn resolve_local_asset_path(path: &str) -> Option<PathBuf> {
    let trimmed = path.trim();
    if trimmed.is_empty() || trimmed.starts_with("data:") || trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return None;
    }

    let possible_paths = [
        format!(
            "/var/www/html/scre/public{}",
            if trimmed.starts_with('/') { "" } else { "/" }
        ),
        format!(
            "/var/www/html/scre/backend/uploads{}",
            if trimmed.starts_with('/') { "" } else { "/" }
        ),
        format!(
            "/var/www/html/scre/backend{}",
            if trimmed.starts_with('/') { "" } else { "/" }
        ),
    ];

    for base in possible_paths {
        let full_path = PathBuf::from(format!("{}{}", base, trimmed));
        if full_path.exists() {
            return Some(full_path);
        }
    }

    None
}

/// Loads a local asset (from public/ or uploads/) and returns it as a base64 data URL.
/// This ensures images render correctly in headless Chromium even with data: URLs or restricted networking.
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
    use qrcode::QrCode;

    if let Ok(code) = QrCode::new(data) {
        let image_str = code.render::<char>().quiet_zone(false).build();
        let mut svg = String::new();
        let width = code.width();
        svg.push_str(&format!("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{}\" height=\"{}\" viewBox=\"0 0 {} {}\">\n", width * 8, width * 8, width * 8, width * 8));
        svg.push_str("<rect width=\"100%\" height=\"100%\" fill=\"white\"/>\n");

        for (y, line) in image_str.lines().enumerate() {
            for (x, c) in line.chars().enumerate() {
                if c == '█' {
                    svg.push_str(&format!(
                        "<rect x=\"{}\" y=\"{}\" width=\"8\" height=\"8\" fill=\"black\"/>\n",
                        x * 8,
                        y * 8
                    ));
                }
            }
        }
        svg.push_str("</svg>");
        let b64 = general_purpose::STANDARD.encode(svg);
        return format!("data:image/svg+xml;base64,{}", b64);
    }
    String::new()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct GenerateRequest {
    pub template_id: String,
    pub student_ids: Vec<String>,
    pub issue_date: Option<String>,
    pub mode: Option<String>, // "single" (latest exam) or "consolidated" (sum of all course exams)
    pub scheduled_at: Option<String>, // ISO date-time string
    /// When true, replace an existing certificate for the same student + template (certificate templates only).
    #[serde(default)]
    pub reissue: Option<bool>,
    /// When true, ignore existing certificates and always create a new one.
    #[serde(default)]
    pub force_new: Option<bool>,
    /// Optional: filter marks/papers by a specific attempt number.
    /// When set in "single" mode, V2 papers and attempt-aware lookups prefer this match; otherwise latest wins.
    #[serde(default)]
    pub attempt_number: Option<i32>,
}

#[derive(Debug, Serialize, Clone)]
pub struct GeneratePreviewRow {
    pub certificate_id: String,
    pub student_id: String,
    pub student_name: String,
}

#[derive(Debug, Serialize)]
pub struct GenerateResponse {
    pub success: bool,
    pub message: String,
    /// HTML for preview/print (one cert per page)
    pub html: Option<String>,
    pub certificate_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview: Option<Vec<GeneratePreviewRow>>,
    /// When multiple certificates are generated: one multi-page PDF (same order as preview), under `/uploads/...`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub combined_pdf_url: Option<String>,
}

/// Per–subject/section row for marksheet `marks_table` rendering.
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CertContext {
    pub student_id: ObjectId,
    pub student_name: String,
    pub registration_number: String,
    pub enrollment_number: Option<String>,
    pub national_id: Option<String>,
    pub father_name: Option<String>,
    pub mother_name: Option<String>,
    pub dob: Option<String>,
    pub background_url: Option<String>,
    pub course: String,
    pub course_duration: Option<String>,
    pub study_center: Option<String>,
    pub institute: Option<String>,
    pub session_from: Option<String>,
    pub session_to: Option<String>,
    pub obtained_marks: Option<f64>,
    pub total_marks: Option<f64>,
    pub grade: Option<String>,
    pub result_status: Option<String>,
    pub exam_date: Option<String>,
    pub issue_date: String,
    pub roll_number: Option<String>,
    pub serial_number: Option<String>,
    pub verification_url: String,
    pub photo: Option<String>,
    pub signature: Option<String>,
    pub gender: Option<String>,
    pub category: Option<String>,
    pub national_id_type: Option<String>,
    pub address: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub pincode: Option<String>,
    pub emergency_contact_name: Option<String>,
    pub emergency_contact_phone: Option<String>,
    pub additional_docs: Option<String>,
    pub subjects: Option<Vec<SubjectResult>>,
    pub center_signature: Option<String>,
    pub center_stamp: Option<String>,
    pub admin_signature: Option<String>,
    pub admin_stamp: Option<String>,
    #[serde(skip)]
    pub marks_rows: Option<Vec<MarksRow>>,
    /// MongoDB `certificates._id` for this row — used to set `file_path` after PDF generation (avoids
    /// failed `update_one` when `course` in the filter does not match the DB document).
    #[serde(skip)]
    pub certificate_row_id: Option<ObjectId>,
    // New fields we're adding
    pub session: Option<String>,
    pub exam_mode: Option<String>,
    pub admission_mode: Option<String>,
    pub center_address: Option<String>,
    pub center_code: Option<String>,
    pub result_date: Option<String>,
    pub result_percentage: Option<String>,
    pub overall_status: Option<String>,
    /// Unique DB certificate_no for this context row — drives the single-certificate PDF filename so
    /// that per-certificate files are NOT overwritten when user.serial_number is shared across rows.
    /// The download handler explicitly probes `certificates/{certificate_no}.pdf` as a fallback, so
    /// this naming keeps stored `file_path` and the fallback path aligned (1-to-1 with the cert row).
    #[serde(skip)]
    pub certificate_no: String,
}

fn require_admin_center(claims: &Claims) -> Result<(), StatusCode> {
    if claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
        && claims.role != UserRole::Center
    {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(())
}

pub async fn generate_certificates(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<GenerateRequest>,
) -> (StatusCode, Json<GenerateResponse>) {
    if let Err(_) = require_admin_center(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(GenerateResponse {
                success: false,
                message: "Unauthorized".to_string(),
                html: None,
                certificate_ids: None,
                preview: None,
                combined_pdf_url: None,
            }),
        );
    }

    process_generate_certificates(&db, claims.role, payload).await
}

#[derive(Debug, Deserialize)]
pub struct ScheduleMarksheetRequest {
    pub student_ids: Vec<String>,
    pub template_id: String,
    pub scheduled_at: String, // ISO date-time string
}

#[derive(Debug, Deserialize, Default)]
pub struct EligibleQuery {
    pub search: Option<String>,
    #[serde(alias = "categoryId")]
    pub category_id: Option<String>,
    #[serde(alias = "courseId")]
    pub course_id: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct StudentEligibleAttempt {
    pub attempt_number: i32,
    pub marksheet_id: Option<String>,
    pub certificate_id: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct StudentEligibleRow {
    pub student_id: String,
    pub student_name: String,
    pub registration_number: String,
    pub course: String,
    pub id: String,
    pub full_name: String,
    pub father_name: Option<String>,
    pub enrollment_number: Option<String>,
    pub course_name: String,
    pub center_name: Option<String>,
    pub attempts: Vec<StudentEligibleAttempt>,
}

// pub async fn list_eligible_for_marksheet(
//     State(db): State<Database>,
//     claims: Claims,
//     axum::extract::Query(q): axum::extract::Query<EligibleQuery>,
// ) -> (StatusCode, Json<Vec<StudentEligibleRow>>) {
//     use std::collections::{BTreeMap, BTreeSet, HashMap};
//     use crate::models::certificate::CertificateType;

//     if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
//         return (StatusCode::FORBIDDEN, Json(vec![]));
//     }

//     let centers_coll = db.collection::<Center>("centers");
//     let courses_coll = db.collection::<Course>("courses");
//     let users_coll: mongodb::Collection<Document> = db.collection::<Document>("users");
//     let elig_coll = db.collection::<CertificateEligibility>("certificate_eligibility");
//     let certs_coll = db.collection::<Certificate>("certificates");
//     let course_attempts_coll = db.collection::<crate::models::exam_workflow::CourseExamAttempt>("course_exam_attempts");
//     let paper_v2_coll = db.collection::<ExamV2Paper>("exam_v2_papers");

//     let mut centers_map: HashMap<String, String> = HashMap::new();
//     {
//         let mut cursor = match centers_coll.find(doc! {}, None).await {
//             Ok(c) => c,
//             Err(_) => return (StatusCode::OK, Json(vec![])),
//         };
//         while let Some(Ok(center)) = cursor.next().await {
//             centers_map.insert(center.user_id.to_hex(), center.name.clone());
//         }
//     }

//     let mut courses_map: HashMap<String, (String, String)> = HashMap::new();
//     {
//         let mut cursor = match courses_coll.find(doc! {}, None).await {
//             Ok(c) => c,
//             Err(_) => return (StatusCode::OK, Json(vec![])),
//         };
//         while let Some(Ok(course)) = cursor.next().await {
//             if let Some(cid) = course.id {
//                 let cat_hex = course.category_id.to_hex();
//                 courses_map.insert(cid.to_hex(), (course.course_name.clone(), cat_hex));
//             }
//         }
//     }

//     let mut filter_cat = None;
//     if let Some(ref cat_hex) = q.category_id {
//         let cat_oid = match ObjectId::parse_str(cat_hex) {
//             Ok(o) => o,
//             Err(_) => return (StatusCode::OK, Json(vec![])),
//         };
//         let cat_hex_match = cat_oid.to_hex();
//         courses_map.retain(|_, (_, cat)| cat == &cat_hex_match);
//         if courses_map.is_empty() {
//             return (StatusCode::OK, Json(vec![]));
//         }
//         filter_cat = Some(cat_hex_match);
//     }

//     let mut course_oid_filter: Option<Vec<ObjectId>> = None;
//     if let Some(ref course_hex) = q.course_id {
//         let course_oid = match ObjectId::parse_str(course_hex) {
//             Ok(o) => o,
//             Err(_) => return (StatusCode::OK, Json(vec![])),
//         };
//         if !courses_map.contains_key(&course_oid.to_hex()) {
//             return (StatusCode::OK, Json(vec![]));
//         }
//         course_oid_filter = Some(vec![course_oid]);
//     }

//     // ================================================================
//     // STEP 1: Build eligible (student_id, course_id, attempt_number) set
//     // ================================================================
//     // Key: (student_id ObjectId, course_id ObjectId)
//     // Value: BTreeSet of attempt_numbers eligible for marksheet + flag for certificate
//     struct PerCourse {
//         marksheet_attempts: BTreeSet<i32>,
//         certificate_eligible: bool,
//     }
//     let mut eligibility_map: BTreeMap<(ObjectId, ObjectId), PerCourse> = BTreeMap::new();

//     fn register_marksheet_attempt(
//         eligibility_map: &mut BTreeMap<(ObjectId, ObjectId), PerCourse>,
//         sid: ObjectId,
//         cid: ObjectId,
//         n: i32,
//     ) {
//         let n = if n <= 0 { 1 } else { n };
//         eligibility_map
//             .entry((sid, cid))
//             .or_insert_with(|| PerCourse {
//                 marksheet_attempts: BTreeSet::new(),
//                 certificate_eligible: false,
//             })
//             .marksheet_attempts
//             .insert(n);
//     }
//     fn register_certificate(
//         eligibility_map: &mut BTreeMap<(ObjectId, ObjectId), PerCourse>,
//         sid: ObjectId,
//         cid: ObjectId,
//     ) {
//         eligibility_map
//             .entry((sid, cid))
//             .or_insert_with(|| PerCourse {
//                 marksheet_attempts: BTreeSet::new(),
//                 certificate_eligible: false,
//             })
//             .certificate_eligible = true;
//     }

//     // Counters for diagnostic logging
//     let mut src_a_marksheet: i64 = 0;
//     let mut src_a_certificate: i64 = 0;
//     let mut src_b_total: i64 = 0;
//     let mut src_b_pass: i64 = 0;
//     let mut src_c_v2_by_exam_id: i64 = 0;
//     let mut src_c_v2_by_tpl: i64 = 0;
//     let mut src_e_v1_total: i64 = 0;
//     let mut src_d_certs_total: i64 = 0;
//     let mut src_d_certs_ms: i64 = 0;
//     let mut src_d_certs_c: i64 = 0;

//     // ---- Source A: certificate_eligibility table (canonical auto-gen source) ----
//     {
//         let mut filter_elig = doc! {};
//         if let Some(ref coids) = course_oid_filter {
//             filter_elig.insert("course_id", doc! { "$in": coids });
//         } else if filter_cat.is_some() {
//             let valid_course_oids: Vec<ObjectId> = courses_map
//                 .keys()
//                 .filter_map(|k| ObjectId::parse_str(k).ok())
//                 .collect();
//             if !valid_course_oids.is_empty() {
//                 filter_elig.insert("course_id", doc! { "$in": valid_course_oids });
//             }
//         }
//         let proj_elig = mongodb::options::FindOptions::builder()
//             .projection(doc! {
//                 "student_id": 1,
//                 "course_id": 1,
//                 "eligibility_type": 1,
//                 "attempt_number": 1,
//             })
//             .build();
//         if let Ok(mut c) = elig_coll.find(filter_elig, proj_elig).await {
//             while let Some(Ok(e)) = c.next().await {
//                 let sid = e.student_id;
//                 let cid = e.course_id;
//                 match e.eligibility_type {
//                     CertificateType::Marksheet => {
//                         let n = e.attempt_number.unwrap_or(1);
//                         register_marksheet_attempt(&mut eligibility_map, sid, cid, n);
//                         src_a_marksheet += 1;
//                     }
//                     CertificateType::Certificate => {
//                         register_certificate(&mut eligibility_map, sid, cid);
//                         src_a_certificate += 1;
//                     }
//                 }
//             }
//         }
//     }

//     // ---- Source B: CourseExamAttempt records (marks submitted) for backward compat ----
//     {
//         let mut filter_b = doc! {
//             "$or": [
//                 { "marks_submitted": true },
//                 { "overall_result": { "$exists": true, "$nin": [null, ""] } }
//             ]
//         };
//         if let Some(ref coids) = course_oid_filter {
//             filter_b.insert("course_id", doc! { "$in": coids });
//         } else if filter_cat.is_some() {
//             let valid_course_oids: Vec<ObjectId> = courses_map
//                 .keys()
//                 .filter_map(|k| ObjectId::parse_str(k).ok())
//                 .collect();
//             if !valid_course_oids.is_empty() {
//                 filter_b.insert("course_id", doc! { "$in": valid_course_oids });
//             }
//         }
//         let proj_b = mongodb::options::FindOptions::builder()
//             .projection(doc! {
//                 "student_id": 1,
//                 "course_id": 1,
//                 "attempt_number": 1,
//                 "overall_result": 1,
//             })
//             .build();
//         if let Ok(mut c) = course_attempts_coll.find(filter_b, proj_b).await {
//             while let Some(Ok(a)) = c.next().await {
//                 let sid = a.student_id;
//                 let cid = a.course_id;
//                 let n = a.attempt_number;
//                 register_marksheet_attempt(&mut eligibility_map, sid, cid, n);
//                 src_b_total += 1;
//                 // overall_result stored lowercase in DB ("pass"/"fail"/"pending") per real data
//                 let passed = a
//                     .overall_result
//                     .as_ref()
//                     .map(|r| {
//                         let lower = r.trim().to_lowercase();
//                         lower == "pass"
//                     })
//                     .unwrap_or(false);
//                 if passed {
//                     register_certificate(&mut eligibility_map, sid, cid);
//                     src_b_pass += 1;
//                 }
//             }
//         }
//     }

//     // ---- Source C: exam_v2_papers (online exam evaluated) ----
//     {
//         let paper_v2_doc_coll: mongodb::Collection<Document> =
//             db.collection::<Document>("exam_v2_papers");
//         let exams_v2_coll = db.collection::<crate::models::exam_engine_v2::ExamV2Exam>("exam_v2_exams");
//         let paper_tpl_coll: mongodb::Collection<Document> =
//             db.collection::<Document>("exam_v2_paper_templates");
//         let course_subj_coll: mongodb::Collection<Document> =
//             db.collection::<Document>("course_subjects");

//         let mut filter_c = doc! {
//             "$or": [
//                 { "status": { "$regex": "evaluated", "$options": "i" } },
//                 { "status": { "$in": ["Evaluated", "evaluated", "EVALUATED"] } }
//             ]
//         };
//         // If explicit course filter, add a best-effort exam-level filter below (post-join)
//         let _ = course_oid_filter.as_ref();

//         let proj_c = mongodb::options::FindOptions::builder()
//             .projection(doc! {
//                 "student_id": 1,
//                 "exam_id": 1,
//                 "paper_template_id": 1,
//                 "attempt_number": 1,
//             })
//             .build();

//         // First pass: collect papers with exam_id (normal path)
//         let mut all_evaluated_papers: Vec<(ObjectId, ObjectId, i32)> = Vec::new();
//         // Fallback pass: collect papers missing exam_id, resolve via template → subject → course
//         let mut tpl_papers: Vec<(ObjectId, ObjectId, i32)> = Vec::new(); // (sid, tpl_id, attempt_number)
//         let mut exam_ids_set: BTreeSet<ObjectId> = BTreeSet::new();
//         let mut tpl_ids_set: BTreeSet<ObjectId> = BTreeSet::new();

//         if let Ok(mut c) = paper_v2_doc_coll.find(filter_c.clone(), proj_c).await {
//             while let Some(Ok(p)) = c.next().await {
//                 let sid = match p.get_object_id("student_id") {
//                     Ok(o) => o,
//                     Err(_) => continue,
//                 };
//                 let n = p.get_i32("attempt_number").unwrap_or(1);
//                 if let Ok(eid) = p.get_object_id("exam_id") {
//                     // Path 1: exam_id present on paper -> normal ExamV2Paper join
//                     exam_ids_set.insert(eid);
//                     all_evaluated_papers.push((sid, eid, n));
//                 } else if let Ok(tpl_id) = p.get_object_id("paper_template_id") {
//                     // Path 2: exam_id missing (legacy/migration data) -> resolve via template
//                     tpl_ids_set.insert(tpl_id);
//                     tpl_papers.push((sid, tpl_id, n));
//                 }
//             }
//         }

//         // Map 1: exam_id → course_id (standard path)
//         let mut exam_course_map: HashMap<ObjectId, ObjectId> = HashMap::new();
//         if !exam_ids_set.is_empty() {
//             let exam_ids: Vec<ObjectId> = exam_ids_set.iter().copied().collect();
//             let proj_exams = mongodb::options::FindOptions::builder()
//                 .projection(doc! { "_id": 1, "course_id": 1 })
//                 .build();
//             if let Ok(mut ec) = exams_v2_coll.find(doc! { "_id": { "$in": &exam_ids } }, proj_exams).await {
//                 while let Some(Ok(ex)) = ec.next().await {
//                     if let Some(eid) = ex.id {
//                         exam_course_map.insert(eid, ex.course_id);
//                     }
//                 }
//             }
//         }

//         // Map 2 (fallback): template_id → subject_id, then subject_id → course_id set, then exam_v2_exams.paper_id → course_id
//         let mut tpl_subject_map: HashMap<ObjectId, ObjectId> = HashMap::new();
//         let mut subject_courses_map: HashMap<ObjectId, Vec<ObjectId>> = HashMap::new();
//         let mut tpl_exam_course_map: HashMap<ObjectId, ObjectId> = HashMap::new();

//         if !tpl_ids_set.is_empty() {
//             let tpl_ids: Vec<ObjectId> = tpl_ids_set.iter().copied().collect();

//             // 2a. paper_template_id -> subject_id via exam_v2_paper_templates
//             let proj_tpl = mongodb::options::FindOptions::builder()
//                 .projection(doc! { "_id": 1, "subject_id": 1 })
//                 .build();
//             if let Ok(mut tc) = paper_tpl_coll.find(doc! { "_id": { "$in": &tpl_ids } }, proj_tpl).await {
//                 while let Some(Ok(t)) = tc.next().await {
//                     if let (Ok(tplid), Ok(sid)) = (t.get_object_id("_id"), t.get_object_id("subject_id")) {
//                         tpl_subject_map.insert(tplid, sid);
//                     }
//                 }
//             }

//             // 2b. Also try direct exam_v2_exams.paper_id match to paper_template_id (ExamV2Exam.paper_id === ExamV2PaperTemplate._id)
//             let proj_exams2 = mongodb::options::FindOptions::builder()
//                 .projection(doc! { "paper_id": 1, "course_id": 1 })
//                 .build();
//             let exams_v2_doc_coll: mongodb::Collection<Document> =
//                 db.collection::<Document>("exam_v2_exams");
//             if let Ok(mut ec2) = exams_v2_doc_coll.find(doc! { "paper_id": { "$in": &tpl_ids } }, proj_exams2).await {
//                 while let Some(Ok(ex)) = ec2.next().await {
//                     if let (Ok(pid), Ok(cid)) = (ex.get_object_id("paper_id"), ex.get_object_id("course_id")) {
//                         tpl_exam_course_map.insert(pid, cid);
//                     }
//                 }
//             }

//             // 2c. subject_id → all course_ids via course_subjects (second fallback, in case paper_id join returned nothing)
//             let subjects: Vec<ObjectId> = tpl_subject_map.values().copied().collect();
//             if !subjects.is_empty() {
//                 let proj_cs = mongodb::options::FindOptions::builder()
//                     .projection(doc! { "course_id": 1, "subject_id": 1 })
//                     .build();
//                 if let Ok(mut csc) = course_subj_coll.find(doc! { "subject_id": { "$in": &subjects } }, proj_cs).await {
//                     while let Some(Ok(row)) = csc.next().await {
//                         if let (Ok(cid), Ok(sid)) = (row.get_object_id("course_id"), row.get_object_id("subject_id")) {
//                             subject_courses_map.entry(sid).or_default().push(cid);
//                         }
//                     }
//                 }
//             }
//         }

//         // Apply category/course filter to exam course_ids
//         let allowed_course_from_cat: Option<Vec<ObjectId>> = if filter_cat.is_some() || course_oid_filter.is_some() {
//             let v: Vec<ObjectId> = courses_map
//                 .keys()
//                 .filter_map(|k| ObjectId::parse_str(k).ok())
//                 .collect();
//             if v.is_empty() { None } else { Some(v) }
//         } else { None };

//         // Standard path: register via exam_id → course_id
//         for (sid, eid, n) in all_evaluated_papers {
//             let Some(cid) = exam_course_map.get(&eid).copied() else {
//                 continue;
//             };
//             if let Some(ref allow) = allowed_course_from_cat {
//                 if !allow.contains(&cid) {
//                     continue;
//                 }
//             }
//             register_marksheet_attempt(&mut eligibility_map, sid, cid, n);
//             register_certificate(&mut eligibility_map, sid, cid);
//             src_c_v2_by_exam_id += 1;
//         }

//         // Fallback path: resolve paper_template_id → subject → course
//         for (sid, tpl_id, n) in tpl_papers {
//             // Prefer direct tpl_id → exam_v2_exams.paper_id → course_id (it's the authoritative binding)
//             let resolved_course: Option<ObjectId> = tpl_exam_course_map.get(&tpl_id).copied()
//                 .or_else(|| {
//                     // Fallback: template → subject → all courses that use this subject
//                     tpl_subject_map.get(&tpl_id).and_then(|subj| {
//                         subject_courses_map.get(subj).and_then(|vec| vec.first().copied())
//                     })
//                 });

//             let Some(cid) = resolved_course else { continue };
//             if let Some(ref allow) = allowed_course_from_cat {
//                 if !allow.contains(&cid) {
//                     continue;
//                 }
//             }
//             register_marksheet_attempt(&mut eligibility_map, sid, cid, n);
//             register_certificate(&mut eligibility_map, sid, cid);
//             src_c_v2_by_tpl += 1;
//         }
//     }

//     // ---- Source E: student_papers (legacy v1 offline exams, status="Evaluated") ----
//     // Covers real v1 data: status="Evaluated" (capital E), blueprint_id, student_id present.
//     // For each unique student, we need to resolve to a course_id. Strategy:
//     //   1. Try student.course_id / user.course string → courses_map
//     //   2. Try blueprint_id → exam_blueprints.course_id
//     //   3. Fallback: pick latest course_exam_attempts.course_id for this student
//     {
//         let paper_coll: mongodb::Collection<Document> =
//             db.collection::<Document>("student_papers");
//         let bp_coll: mongodb::Collection<Document> =
//             db.collection::<Document>("exam_blueprints");
//         let cea_doc_coll: mongodb::Collection<Document> =
//             db.collection::<Document>("course_exam_attempts");

//         let filter_e = doc! {
//             "$or": [
//                 { "status": "Evaluated" },
//                 { "status": "evaluated" },
//                 { "status": { "$regex": "evaluated", "$options": "i" } }
//             ]
//         };
//         let proj_e = mongodb::options::FindOptions::builder()
//             .projection(doc! {
//                 "student_id": 1,
//                 "blueprint_id": 1,
//                 "attempt_number": 1,
//                 "is_passed": 1,
//             })
//             .build();

//         // Dedup key: (student_id, attempt_number) → best-effort blueprint_id
//         let mut v1_dedup: HashMap<(ObjectId, i32), (Option<ObjectId>, Option<bool>)> = HashMap::new();
//         let mut bp_ids_set: BTreeSet<ObjectId> = BTreeSet::new();
//         if let Ok(mut pc) = paper_coll.find(filter_e, proj_e).await {
//             while let Some(Ok(p)) = pc.next().await {
//                 let sid = match p.get_object_id("student_id") {
//                     Ok(o) => o,
//                     Err(_) => continue,
//                 };
//                 let n = p.get_i32("attempt_number").unwrap_or(1);
//                 let bpid = p.get_object_id("blueprint_id").ok();
//                 let passed = p.get_bool("is_passed").ok();
//                 if let Some(bp) = bpid { bp_ids_set.insert(bp); }
//                 v1_dedup.insert((sid, n), (bpid, passed));
//             }
//         }

//         // Build blueprint_id → course_id map
//         let mut bp_course_map: HashMap<ObjectId, ObjectId> = HashMap::new();
//         if !bp_ids_set.is_empty() {
//             let ids: Vec<ObjectId> = bp_ids_set.iter().copied().collect();
//             let proj_bp = mongodb::options::FindOptions::builder()
//                 .projection(doc! { "_id": 1, "course_id": 1 })
//                 .build();
//             if let Ok(mut bc) = bp_coll.find(doc! { "_id": { "$in": &ids } }, proj_bp).await {
//                 while let Some(Ok(b)) = bc.next().await {
//                     if let (Ok(bid), Ok(cid)) = (b.get_object_id("_id"), b.get_object_id("course_id")) {
//                         bp_course_map.insert(bid, cid);
//                     }
//                 }
//             }
//         }

//         // Also preload latest cea course_id per student for fallback
//         let mut student_latest_cea_course: HashMap<ObjectId, ObjectId> = HashMap::new();
//         {
//             let all_stu_ids: Vec<ObjectId> = v1_dedup.keys().map(|k| k.0).collect();
//             if !all_stu_ids.is_empty() {
//                 let proj_cea = mongodb::options::FindOptions::builder()
//                     .projection(doc! { "student_id": 1, "course_id": 1, "attempt_number": 1 })
//                     .sort(doc! { "attempt_number": -1 })
//                     .build();
//                 if let Ok(mut cc) = cea_doc_coll.find(doc! { "student_id": { "$in": &all_stu_ids } }, proj_cea).await {
//                     while let Some(Ok(row)) = cc.next().await {
//                         if let (Ok(sid), Ok(cid)) = (row.get_object_id("student_id"), row.get_object_id("course_id")) {
//                             student_latest_cea_course.entry(sid).or_insert(cid);
//                         }
//                     }
//                 }
//             }
//         }

//         let allowed_course_from_cat_e: Option<Vec<ObjectId>> = if filter_cat.is_some() || course_oid_filter.is_some() {
//             let v: Vec<ObjectId> = courses_map
//                 .keys()
//                 .filter_map(|k| ObjectId::parse_str(k).ok())
//                 .collect();
//             if v.is_empty() { None } else { Some(v) }
//         } else { None };

//         for ((sid, n), (bpid, passed_opt)) in v1_dedup.into_iter() {
//             // Resolve course_id
//             let cid_from_bp = bpid.and_then(|b| bp_course_map.get(&b).copied());
//             let cid_from_cea = student_latest_cea_course.get(&sid).copied();
//             let Some(cid) = cid_from_bp.or(cid_from_cea) else { continue };
//             if let Some(ref allow) = allowed_course_from_cat_e {
//                 if !allow.contains(&cid) {
//                     continue;
//                 }
//             }
//             register_marksheet_attempt(&mut eligibility_map, sid, cid, n);
//             src_e_v1_total += 1;
//             // Register certificate if passed
//             if passed_opt.unwrap_or(false) {
//                 register_certificate(&mut eligibility_map, sid, cid);
//             }
//         }
//     }

//     // ---- Source D: Existing Certificate documents (already generated) ----
//     //
//     // CRITICAL: Legacy certificates have NO certificate_type field in DB, and NO attempt_number.
//     // Because Certificate struct has `#[serde(default = "default_certificate_type")] CertificateType::Certificate`,
//     // ALL 102 certs currently deserialize as `CertificateType::Certificate` (never marksheet).
//     // We must infer type from:
//     //   a) file_path prefix = "marksheets/"  → MARKSHEET
//     //   b) certificate_no prefix = "SC-"     → MARKSHEET
//     //   c) Otherwise (CERT-*, SCR-*, etc.)  → CERTIFICATE
//     {
//         let certs_doc_coll: mongodb::Collection<Document> =
//             db.collection::<Document>("certificates");

//         let mut filter_d = doc! {};
//         if let Some(ref coids) = course_oid_filter {
//             filter_d.insert("course_id", doc! { "$in": coids });
//         } else if filter_cat.is_some() {
//             let valid_course_oids: Vec<ObjectId> = courses_map
//                 .keys()
//                 .filter_map(|k| ObjectId::parse_str(k).ok())
//                 .collect();
//             if !valid_course_oids.is_empty() {
//                 filter_d.insert("course_id", doc! { "$in": valid_course_oids });
//             }
//         }
//         let proj_d = mongodb::options::FindOptions::builder()
//             .projection(doc! {
//                 "_id": 1,
//                 "student_id": 1,
//                 "course_id": 1,
//                 "certificate_type": 1,
//                 "attempt_number": 1,
//                 "certificate_no": 1,
//                 "file_path": 1,
//             })
//             .build();
//         if let Ok(mut c) = certs_doc_coll.find(filter_d, proj_d).await {
//             while let Some(Ok(cert)) = c.next().await {
//                 let sid = match cert.get_object_id("student_id") {
//                     Ok(o) => o,
//                     Err(_) => continue,
//                 };
//                 let cid = match cert.get_object_id("course_id") {
//                     Ok(o) => o,
//                     Err(_) => continue,
//                 };
//                 src_d_certs_total += 1;

//                 // Infer type: explicit field → file_path → certificate_no prefix → default=Certificate
//                 let inferred_type: CertificateType = if let Ok(ct_str) = cert.get_str("certificate_type") {
//                     match ct_str.trim().to_lowercase().as_str() {
//                         "marksheet" => CertificateType::Marksheet,
//                         "certificate" => CertificateType::Certificate,
//                         _ => CertificateType::Certificate,
//                     }
//                 } else {
//                     let from_fp = cert.get_str("file_path").ok().map(|s| s.trim().starts_with("marksheets/")).unwrap_or(false);
//                     let from_no = cert.get_str("certificate_no").ok().map(|s| s.trim().starts_with("SC-")).unwrap_or(false);
//                     if from_fp || from_no { CertificateType::Marksheet } else { CertificateType::Certificate }
//                 };

//                 let n = cert.get_i32("attempt_number").unwrap_or(1);
//                 match inferred_type {
//                     CertificateType::Marksheet => {
//                         register_marksheet_attempt(&mut eligibility_map, sid, cid, n);
//                         src_d_certs_ms += 1;
//                     }
//                     CertificateType::Certificate => {
//                         register_certificate(&mut eligibility_map, sid, cid);
//                         src_d_certs_c += 1;
//                     }
//                 }
//             }
//         }
//     }

//     // ===== DIAGNOSTIC LOGGING =====
//     println!(
//         "[list_eligible_for_marksheet] DIAG: eligibility sources counts: \
//          SourceA(ledger)[m={} c={}] | SourceB(cea)[total={} pass={}] | \
//          SourceC(v2)[by_exam_id={} by_tpl_fallback={}] | SourceE(v1 student_papers)[total={}] | \
//          SourceD(certs)[total={} inferred_ms={} inferred_c={}]",
//         src_a_marksheet, src_a_certificate,
//         src_b_total, src_b_pass,
//         src_c_v2_by_exam_id, src_c_v2_by_tpl,
//         src_e_v1_total,
//         src_d_certs_total, src_d_certs_ms, src_d_certs_c,
//     );
//     let elig_unique_students = eligibility_map.keys().map(|(s, _)| *s).collect::<BTreeSet<_>>().len();
//     let elig_unique_pairs = eligibility_map.len();
//     println!(
//         "[list_eligible_for_marksheet] DIAG: eligibility_map size pairs={} unique_students={}",
//         elig_unique_pairs, elig_unique_students
//     );

//     if eligibility_map.is_empty() {
//         return (StatusCode::OK, Json(vec![]));
//     }

//     // ================================================================
//     // STEP 2: Collect unique student IDs and load their user documents
//     // ================================================================
//     let mut student_sids: BTreeSet<ObjectId> = BTreeSet::new();
//     for ((sid, _), _) in eligibility_map.iter() {
//         student_sids.insert(*sid);
//     }
//     let student_sids_vec: Vec<ObjectId> = student_sids.iter().copied().collect();

//     let mut user_filter = doc! { "_id": { "$in": &student_sids_vec } };
//     user_filter.insert("is_deleted", doc! { "$ne": true });

//     if let Some(ref search) = q.search {
//         let re = format!("(?i){}", regex::escape(search));
//         let mut or_conditions: Vec<Document> = Vec::new();
//         or_conditions.push(doc! { "full_name": { "$regex": &re } });
//         or_conditions.push(doc! { "student_name": { "$regex": &re } });
//         or_conditions.push(doc! { "father_name": { "$regex": &re } });
//         or_conditions.push(doc! { "enrollment_number": { "$regex": &re } });
//         or_conditions.push(doc! { "registration_number": { "$regex": &re } });
//         or_conditions.push(doc! { "username": { "$regex": &re } });

//         let matching_center_oids: Vec<ObjectId> = centers_map
//             .iter()
//             .filter(|(_, name)| name.to_lowercase().contains(&search.to_lowercase()))
//             .filter_map(|(hex, _)| ObjectId::parse_str(hex).ok())
//             .collect();
//         if !matching_center_oids.is_empty() {
//             or_conditions.push(doc! { "parent_id": { "$in": matching_center_oids } });
//         }
//         if !or_conditions.is_empty() {
//             user_filter.insert("$or", or_conditions);
//         }
//     }

//     let find_opts = mongodb::options::FindOptions::builder()
//         .projection(doc! {
//             "_id": 1,
//             "full_name": 1,
//             "username": 1,
//             "student_name": 1,
//             "registration_number": 1,
//             "father_name": 1,
//             "enrollment_number": 1,
//             "course_id": 1,
//             "course": 1,
//             "parent_id": 1,
//             "role": 1,
//         })
//         .build();

//     struct UserInfo {
//         doc: Document,
//     }
//     let mut users_by_sid: HashMap<ObjectId, UserInfo> = HashMap::new();
//     {
//         let mut cursor = match users_coll.find(user_filter, find_opts).await {
//             Ok(c) => c,
//             Err(_) => return (StatusCode::OK, Json(vec![])),
//         };
//         while let Some(Ok(user_doc)) = cursor.next().await {
//             let sid_oid = match user_doc.get_object_id("_id") {
//                 Ok(oid) => oid,
//                 Err(_) => continue,
//             };
//             users_by_sid.insert(sid_oid, UserInfo { doc: user_doc });
//         }
//     }

//     if users_by_sid.is_empty() {
//         return (StatusCode::OK, Json(vec![]));
//     }

//     // ================================================================
//     // STEP 3: Batch-load existing certificate ids for student/course/attempt
//     // IMPORTANT: MUST use raw Document collection + same legacy type-inference logic
//     // as Source D, because typed Certificate struct defaults missing certificate_type
//     // to CertificateType::Certificate → would NEVER return marksheet_id for legacy data!
//     // ================================================================
//     struct CertKey {
//         marksheet_by_attempt: HashMap<i32, String>,
//         cert_any: Option<String>,
//     }
//     let mut certs_lookup: HashMap<(ObjectId, ObjectId), CertKey> = HashMap::new();
//     {
//         let mut lookup_sids: Vec<ObjectId> = Vec::new();
//         let mut lookup_cids: Vec<ObjectId> = Vec::new();
//         for ((sid, cid), _) in eligibility_map.iter() {
//             if users_by_sid.contains_key(sid) {
//                 lookup_sids.push(*sid);
//                 lookup_cids.push(*cid);
//             }
//         }
//         if !lookup_sids.is_empty() {
//             let certs_raw_coll: mongodb::Collection<Document> =
//                 db.collection::<Document>("certificates");
//             let filter_certs = doc! {
//                 "student_id": { "$in": &lookup_sids },
//                 "course_id": { "$in": &lookup_cids },
//             };
//             let proj_certs = mongodb::options::FindOptions::builder()
//                 .projection(doc! {
//                     "_id": 1,
//                     "student_id": 1,
//                     "course_id": 1,
//                     "certificate_type": 1,
//                     "attempt_number": 1,
//                     "certificate_no": 1,
//                     "file_path": 1,
//                 })
//                 .build();
//             if let Ok(mut cc) = certs_raw_coll.find(filter_certs, proj_certs).await {
//                 while let Some(Ok(raw_cert)) = cc.next().await {
//                     let cert_id_hex = match raw_cert.get_object_id("_id") {
//                         Ok(oid) => oid.to_hex(),
//                         Err(_) => continue,
//                     };
//                     let sid = match raw_cert.get_object_id("student_id") {
//                         Ok(o) => o,
//                         Err(_) => continue,
//                     };
//                     let cid = match raw_cert.get_object_id("course_id") {
//                         Ok(o) => o,
//                         Err(_) => continue,
//                     };
//                     // ==== SAME INFERENCE LOGIC AS SOURCE D ====
//                     let inferred_type: CertificateType = if let Ok(ct_str) = raw_cert.get_str("certificate_type") {
//                         match ct_str.trim().to_lowercase().as_str() {
//                             "marksheet" => CertificateType::Marksheet,
//                             "certificate" => CertificateType::Certificate,
//                             _ => CertificateType::Certificate,
//                         }
//                     } else {
//                         let from_fp = raw_cert.get_str("file_path").ok().map(|s| s.trim().starts_with("marksheets/")).unwrap_or(false);
//                         let from_no = raw_cert.get_str("certificate_no").ok().map(|s| s.trim().starts_with("SC-")).unwrap_or(false);
//                         if from_fp || from_no { CertificateType::Marksheet } else { CertificateType::Certificate }
//                     };
//                     let n = raw_cert.get_i32("attempt_number").unwrap_or(1);
//                     let n = if n <= 0 { 1 } else { n };

//                     let key = (sid, cid);
//                     let entry = certs_lookup.entry(key).or_insert_with(|| CertKey {
//                         marksheet_by_attempt: HashMap::new(),
//                         cert_any: None,
//                     });
//                     match inferred_type {
//                         CertificateType::Marksheet => {
//                             entry.marksheet_by_attempt.insert(n, cert_id_hex);
//                         }
//                         CertificateType::Certificate => {
//                             if entry.cert_any.is_none() {
//                                 entry.cert_any = Some(cert_id_hex);
//                             }
//                         }
//                     }
//                 }
//             }
//         }
//     }

//     // ================================================================
//     // STEP 4: Assemble rows
//     // ================================================================
//     fn resolve_course_name(
//         user_doc: &Document,
//         course_id_from_key: ObjectId,
//         courses_map: &HashMap<String, (String, String)>,
//     ) -> String {
//         if let Some((cn, _)) = courses_map.get(&course_id_from_key.to_hex()) {
//             return cn.clone();
//         }
//         if let Ok(oid) = user_doc.get_object_id("course_id") {
//             if let Some((cn, _)) = courses_map.get(&oid.to_hex()) {
//                 return cn.clone();
//             }
//         }
//         if let Ok(s) = user_doc.get_str("course_id") {
//             if let Some((cn, _)) = courses_map.get(s.trim()) {
//                 return cn.clone();
//             }
//         }
//         if let Ok(course_str) = user_doc.get_str("course") {
//             let t = course_str.trim();
//             if !t.is_empty() {
//                 return t.to_string();
//             }
//         }
//         String::from("Unknown Course")
//     }

//     fn is_lenient_student_role(user_doc: &Document) -> bool {
//         if let Ok(role_str) = user_doc.get_str("role") {
//             let trimmed = role_str.trim().to_lowercase();
//             if trimmed.is_empty() {
//                 return true;
//             }
//             if trimmed == "student" || trimmed.contains("student") {
//                 return true;
//             }
//             if trimmed == "admin"
//                 || trimmed == "superadmin"
//                 || trimmed == "center"
//                 || trimmed == "staff"
//                 || trimmed == "intern"
//             {
//                 return false;
//             }
//             return true;
//         }
//         if let Some(role_bson) = user_doc.get("role") {
//             if let Some(rs) = role_bson.as_str() {
//                 let trimmed = rs.trim().to_lowercase();
//                 if trimmed.is_empty() {
//                     return true;
//                 }
//                 if trimmed == "student" || trimmed.contains("student") {
//                     return true;
//                 }
//                 if trimmed == "admin"
//                     || trimmed == "superadmin"
//                     || trimmed == "center"
//                     || trimmed == "staff"
//                     || trimmed == "intern"
//                 {
//                     return false;
//                 }
//             }
//         }
//         true
//     }

//     let mut rows: Vec<StudentEligibleRow> = Vec::new();

//     // Group per-course eligibilities by student_id for a single row per student
//     let mut per_student_rows: BTreeMap<ObjectId, Vec<((ObjectId, ObjectId), &PerCourse)>> = BTreeMap::new();
//     for (key, val) in eligibility_map.iter() {
//         let (sid, _cid) = key;
//         if !users_by_sid.contains_key(sid) {
//             continue;
//         }
//         // Filter: if category/course filters are active, skip entries for courses outside the set
//         let cid_hex = key.1.to_hex();
//         if !courses_map.is_empty() && (filter_cat.is_some() || course_oid_filter.is_some()) {
//             if !courses_map.contains_key(&cid_hex) {
//                 continue;
//             }
//         }
//         per_student_rows
//             .entry(*sid)
//             .or_default()
//             .push((*key, val));
//     }

//     for (sid, entries) in per_student_rows.iter() {
//         let user_info = match users_by_sid.get(sid) {
//             Some(u) => u,
//             None => continue,
//         };
//         let user_doc = &user_info.doc;

//         if !is_lenient_student_role(user_doc) {
//             continue;
//         }

//         let sid_hex = sid.to_hex();

//         let full_name = user_doc
//             .get_str("full_name")
//             .ok()
//             .map(|s| s.to_string())
//             .unwrap_or_default();
//         let username = user_doc
//             .get_str("username")
//             .ok()
//             .map(|s| s.to_string())
//             .unwrap_or_default();
//         let student_name = user_doc
//             .get_str("student_name")
//             .ok()
//             .map(|s| s.to_string())
//             .unwrap_or_default();
//         let reg_num = user_doc
//             .get_str("registration_number")
//             .ok()
//             .map(|s| s.to_string())
//             .unwrap_or_default();
//         let enroll_num = user_doc
//             .get_str("enrollment_number")
//             .ok()
//             .map(|s| s.to_string())
//             .unwrap_or_default();

//         let display_name = if !full_name.is_empty() {
//             full_name
//         } else if !student_name.is_empty() {
//             student_name
//         } else if !username.is_empty() {
//             username.clone()
//         } else if !reg_num.is_empty() {
//             reg_num.clone()
//         } else if !enroll_num.is_empty() {
//             enroll_num.clone()
//         } else {
//             format!("Student {}", &sid_hex[..std::cmp::min(8, sid_hex.len())])
//         };

//         let reg_fallback = if !reg_num.is_empty() {
//             reg_num
//         } else if !enroll_num.is_empty() {
//             enroll_num.clone()
//         } else {
//             username.clone()
//         };

//         let father_name = user_doc.get_str("father_name").ok().map(|s| s.to_string());
//         let enrollment_number = if !enroll_num.is_empty() {
//             Some(enroll_num)
//         } else {
//             None
//         };

//         let center_name = user_doc
//             .get_object_id("parent_id")
//             .ok()
//             .and_then(|pid| centers_map.get(&pid.to_hex()).cloned())
//             .or_else(|| {
//                 user_doc
//                     .get_str("parent_id")
//                     .ok()
//                     .and_then(|pid| centers_map.get(pid).cloned())
//             });

//         for ((_sid_dup, cid), per_course) in entries {
//             let course_name = resolve_course_name(user_doc, *cid, &courses_map);

//             let (marksheet_by_attempt, cert_any) = match certs_lookup.get(&(*sid, *cid)) {
//                 Some(ck) => (ck.marksheet_by_attempt.clone(), ck.cert_any.clone()),
//                 None => (HashMap::new(), None),
//             };

//             let mut attempts: Vec<StudentEligibleAttempt> = per_course
//                 .marksheet_attempts
//                 .iter()
//                 .map(|&n| {
//                     let ms_id = marksheet_by_attempt.get(&n).cloned();
//                     let c_id = if per_course.certificate_eligible {
//                         cert_any.clone()
//                     } else {
//                         None
//                     };
//                     StudentEligibleAttempt {
//                         attempt_number: n,
//                         marksheet_id: ms_id,
//                         certificate_id: c_id,
//                     }
//                 })
//                 .collect();

//             if attempts.is_empty() && per_course.certificate_eligible {
//                 attempts.push(StudentEligibleAttempt {
//                     attempt_number: 1,
//                     marksheet_id: None,
//                     certificate_id: cert_any.clone(),
//                 });
//             }

//             if attempts.is_empty() {
//                 continue;
//             }

//             rows.push(StudentEligibleRow {
//                 student_id: sid_hex.clone(),
//                 student_name: display_name.clone(),
//                 registration_number: reg_fallback.clone(),
//                 course: course_name.clone(),
//                 id: sid_hex.clone(),
//                 full_name: display_name.clone(),
//                 father_name: father_name.clone(),
//                 enrollment_number: enrollment_number.clone(),
//                 course_name,
//                 center_name: center_name.clone(),
//                 attempts,
//             });
//         }
//     }

//     println!(
//         "[list_eligible_for_marksheet] DIAG: FINAL rows returned to frontend = {}",
//         rows.len()
//     );
//     for (i, r) in rows.iter().take(5).enumerate() {
//         let enroll_short: String = r.enrollment_number.as_ref().map(|s| s.chars().take(12).collect()).unwrap_or_default();
//         let center_short: String = r.center_name.as_ref().map(|s| s.chars().take(16).collect()).unwrap_or_default();
//         println!(
//             "    row[{}] sid={} name='{}' enroll='{:?}' reg='{}' course='{}' center='{:?}' cert_eligible_tpl={} attempts_n={}",
//             i,
//             r.student_id.chars().take(10).collect::<String>(),
//             r.full_name.chars().take(30).collect::<String>(),
//             if enroll_short.is_empty() { None } else { Some(enroll_short) },
//             r.registration_number.chars().take(12).collect::<String>(),
//             r.course_name.chars().take(24).collect::<String>(),
//             if center_short.is_empty() { None } else { Some(center_short) },
//             r.attempts.iter().any(|a| a.certificate_id.is_some() || true),
//             r.attempts.len(),
//         );
//     }

//     (StatusCode::OK, Json(rows))
// }
pub async fn list_eligible_for_marksheet(
    State(db): State<Database>,
    claims: Claims,
    axum::extract::Query(q): axum::extract::Query<EligibleQuery>,
) -> (StatusCode, Json<Vec<StudentEligibleRow>>) {
    use std::collections::{BTreeMap, BTreeSet, HashMap};
    use crate::models::certificate::CertificateType;

    // ================================================================
    // AUTHORIZATION
    // Admin / SuperAdmin -> all students
    // Center             -> only students belonging to that center
    // ================================================================

    let center_user_id: Option<ObjectId> = match claims.role {
        UserRole::Admin | UserRole::SuperAdmin => None,

        UserRole::Center => {
            match ObjectId::parse_str(&claims.sub) {
                Ok(id) => Some(id),
                Err(_) => {
                    println!(
                        "[list_eligible_for_marksheet] Invalid center claims.sub: {}",
                        claims.sub
                    );

                    return (StatusCode::UNAUTHORIZED, Json(vec![]));
                }
            }
        }

        _ => {
            println!(
                "[list_eligible_for_marksheet] Forbidden role: {:?}",
                claims.role
            );

            return (StatusCode::FORBIDDEN, Json(vec![]));
        }
    };

    println!(
        "[list_eligible_for_marksheet] role={:?}, center_user_id={:?}",
        claims.role,
        center_user_id
    );

    let centers_coll = db.collection::<Center>("centers");
    let courses_coll = db.collection::<Course>("courses");
    let users_coll: mongodb::Collection<Document> =
        db.collection::<Document>("users");
    let elig_coll =
        db.collection::<CertificateEligibility>("certificate_eligibility");
    let _certs_coll =
        db.collection::<Certificate>("certificates");
    let course_attempts_coll =
        db.collection::<crate::models::exam_workflow::CourseExamAttempt>(
            "course_exam_attempts",
        );
    let _paper_v2_coll =
        db.collection::<ExamV2Paper>("exam_v2_papers");

    // ================================================================
    // LOAD CENTERS
    // ================================================================

    let mut centers_map: HashMap<String, String> = HashMap::new();

    {
        let mut cursor = match centers_coll.find(doc! {}, None).await {
            Ok(c) => c,
            Err(e) => {
                println!(
                    "[list_eligible_for_marksheet] Failed loading centers: {:?}",
                    e
                );

                return (StatusCode::OK, Json(vec![]));
            }
        };

        while let Some(Ok(center)) = cursor.next().await {
            centers_map.insert(
                center.user_id.to_hex(),
                center.name.clone(),
            );
        }
    }

    // ================================================================
    // LOAD COURSES
    // ================================================================

    let mut courses_map: HashMap<String, (String, String)> =
        HashMap::new();

    {
        let mut cursor = match courses_coll.find(doc! {}, None).await {
            Ok(c) => c,
            Err(e) => {
                println!(
                    "[list_eligible_for_marksheet] Failed loading courses: {:?}",
                    e
                );

                return (StatusCode::OK, Json(vec![]));
            }
        };

        while let Some(Ok(course)) = cursor.next().await {
            if let Some(cid) = course.id {
                courses_map.insert(
                    cid.to_hex(),
                    (
                        course.course_name.clone(),
                        course.category_id.to_hex(),
                    ),
                );
            }
        }
    }

    // ================================================================
    // CATEGORY FILTER
    // ================================================================

    let mut filter_cat = None;

    if let Some(ref cat_hex) = q.category_id {
        let cat_oid = match ObjectId::parse_str(cat_hex) {
            Ok(o) => o,
            Err(_) => {
                return (StatusCode::OK, Json(vec![]));
            }
        };

        let cat_hex_match = cat_oid.to_hex();

        courses_map.retain(|_, (_, cat)| {
            cat == &cat_hex_match
        });

        if courses_map.is_empty() {
            return (StatusCode::OK, Json(vec![]));
        }

        filter_cat = Some(cat_hex_match);
    }

    // ================================================================
    // COURSE FILTER
    // ================================================================

    let mut course_oid_filter: Option<Vec<ObjectId>> = None;

    if let Some(ref course_hex) = q.course_id {
        let course_oid = match ObjectId::parse_str(course_hex) {
            Ok(o) => o,
            Err(_) => {
                return (StatusCode::OK, Json(vec![]));
            }
        };

        if !courses_map.contains_key(&course_oid.to_hex()) {
            return (StatusCode::OK, Json(vec![]));
        }

        course_oid_filter = Some(vec![course_oid]);
    }

    // ================================================================
    // STEP 1
    // Build eligible:
    //
    // (student_id, course_id)
    //
    // -> marksheet attempts
    // -> certificate eligible
    // ================================================================

    struct PerCourse {
        marksheet_attempts: BTreeSet<i32>,
        certificate_eligible: bool,
    }

    let mut eligibility_map:
        BTreeMap<(ObjectId, ObjectId), PerCourse> =
        BTreeMap::new();

    fn register_marksheet_attempt(
        eligibility_map: &mut BTreeMap<(ObjectId, ObjectId), PerCourse>,
        sid: ObjectId,
        cid: ObjectId,
        n: i32,
    ) {
        let n = if n <= 0 { 1 } else { n };

        eligibility_map
            .entry((sid, cid))
            .or_insert_with(|| PerCourse {
                marksheet_attempts: BTreeSet::new(),
                certificate_eligible: false,
            })
            .marksheet_attempts
            .insert(n);
    }

    fn register_certificate(
        eligibility_map: &mut BTreeMap<(ObjectId, ObjectId), PerCourse>,
        sid: ObjectId,
        cid: ObjectId,
    ) {
        eligibility_map
            .entry((sid, cid))
            .or_insert_with(|| PerCourse {
                marksheet_attempts: BTreeSet::new(),
                certificate_eligible: false,
            })
            .certificate_eligible = true;
    }

    // ================================================================
    // SOURCE A
    // certificate_eligibility
    // ================================================================

    {
        let mut filter_elig = doc! {};

        if let Some(ref coids) = course_oid_filter {
            filter_elig.insert(
                "course_id",
                doc! { "$in": coids },
            );
        } else if filter_cat.is_some() {
            let valid_course_oids: Vec<ObjectId> =
                courses_map
                    .keys()
                    .filter_map(|k| ObjectId::parse_str(k).ok())
                    .collect();

            if !valid_course_oids.is_empty() {
                filter_elig.insert(
                    "course_id",
                    doc! { "$in": valid_course_oids },
                );
            }
        }

        let proj_elig =
            mongodb::options::FindOptions::builder()
                .projection(doc! {
                    "student_id": 1,
                    "course_id": 1,
                    "eligibility_type": 1,
                    "attempt_number": 1,
                })
                .build();

        if let Ok(mut c) =
            elig_coll.find(filter_elig, proj_elig).await
        {
            while let Some(Ok(e)) = c.next().await {
                let sid = e.student_id;
                let cid = e.course_id;

                match e.eligibility_type {
                    CertificateType::Marksheet => {
                        let n = e.attempt_number.unwrap_or(1);

                        register_marksheet_attempt(
                            &mut eligibility_map,
                            sid,
                            cid,
                            n,
                        );
                    }

                    CertificateType::Certificate => {
                        register_certificate(
                            &mut eligibility_map,
                            sid,
                            cid,
                        );
                    }
                }
            }
        }
    }

    // ================================================================
    // SOURCE B
    // course_exam_attempts
    // ================================================================

    {
        let mut filter_b = doc! {
            "$or": [
                { "marks_submitted": true },
                {
                    "overall_result": {
                        "$exists": true,
                        "$nin": [null, ""]
                    }
                }
            ]
        };

        if let Some(ref coids) = course_oid_filter {
            filter_b.insert(
                "course_id",
                doc! { "$in": coids },
            );
        } else if filter_cat.is_some() {
            let valid_course_oids: Vec<ObjectId> =
                courses_map
                    .keys()
                    .filter_map(|k| ObjectId::parse_str(k).ok())
                    .collect();

            if !valid_course_oids.is_empty() {
                filter_b.insert(
                    "course_id",
                    doc! { "$in": valid_course_oids },
                );
            }
        }

        let proj_b =
            mongodb::options::FindOptions::builder()
                .projection(doc! {
                    "student_id": 1,
                    "course_id": 1,
                    "attempt_number": 1,
                    "overall_result": 1,
                })
                .build();

        if let Ok(mut c) =
            course_attempts_coll.find(filter_b, proj_b).await
        {
            while let Some(Ok(a)) = c.next().await {
                let sid = a.student_id;
                let cid = a.course_id;
                let n = a.attempt_number;

                register_marksheet_attempt(
                    &mut eligibility_map,
                    sid,
                    cid,
                    n,
                );

                let passed = a
                    .overall_result
                    .as_ref()
                    .map(|r| {
                        r.trim().eq_ignore_ascii_case("pass")
                    })
                    .unwrap_or(false);

                if passed {
                    register_certificate(
                        &mut eligibility_map,
                        sid,
                        cid,
                    );
                }
            }
        }
    }

    // ================================================================
    // SOURCE C
    // exam_v2_papers
    // ================================================================

    {
        let paper_v2_doc_coll: mongodb::Collection<Document> =
            db.collection::<Document>("exam_v2_papers");

        let exams_v2_coll =
            db.collection::<crate::models::exam_engine_v2::ExamV2Exam>(
                "exam_v2_exams",
            );

        let paper_tpl_coll: mongodb::Collection<Document> =
            db.collection::<Document>("exam_v2_paper_templates");

        let course_subj_coll: mongodb::Collection<Document> =
            db.collection::<Document>("course_subjects");

        let filter_c = doc! {
            "$or": [
                {
                    "status": {
                        "$regex": "evaluated",
                        "$options": "i"
                    }
                },
                {
                    "status": {
                        "$in": [
                            "Evaluated",
                            "evaluated",
                            "EVALUATED"
                        ]
                    }
                }
            ]
        };

        let proj_c =
            mongodb::options::FindOptions::builder()
                .projection(doc! {
                    "student_id": 1,
                    "exam_id": 1,
                    "paper_template_id": 1,
                    "attempt_number": 1,
                })
                .build();

        let mut all_evaluated_papers:
            Vec<(ObjectId, ObjectId, i32)> = Vec::new();

        let mut tpl_papers:
            Vec<(ObjectId, ObjectId, i32)> = Vec::new();

        let mut exam_ids_set: BTreeSet<ObjectId> =
            BTreeSet::new();

        let mut tpl_ids_set: BTreeSet<ObjectId> =
            BTreeSet::new();

        if let Ok(mut c) =
            paper_v2_doc_coll.find(filter_c, proj_c).await
        {
            while let Some(Ok(p)) = c.next().await {
                let sid = match p.get_object_id("student_id") {
                    Ok(o) => o,
                    Err(_) => continue,
                };

                let n =
                    p.get_i32("attempt_number")
                        .unwrap_or(1);

                if let Ok(eid) =
                    p.get_object_id("exam_id")
                {
                    exam_ids_set.insert(eid);

                    all_evaluated_papers.push((
                        sid,
                        eid,
                        n,
                    ));
                } else if let Ok(tpl_id) =
                    p.get_object_id("paper_template_id")
                {
                    tpl_ids_set.insert(tpl_id);

                    tpl_papers.push((
                        sid,
                        tpl_id,
                        n,
                    ));
                }
            }
        }

        let mut exam_course_map:
            HashMap<ObjectId, ObjectId> =
            HashMap::new();

        if !exam_ids_set.is_empty() {
            let exam_ids: Vec<ObjectId> =
                exam_ids_set.iter().copied().collect();

            let proj_exams =
                mongodb::options::FindOptions::builder()
                    .projection(doc! {
                        "_id": 1,
                        "course_id": 1
                    })
                    .build();

            if let Ok(mut ec) =
                exams_v2_coll
                    .find(
                        doc! {
                            "_id": {
                                "$in": &exam_ids
                            }
                        },
                        proj_exams,
                    )
                    .await
            {
                while let Some(Ok(ex)) = ec.next().await {
                    if let Some(eid) = ex.id {
                        exam_course_map.insert(
                            eid,
                            ex.course_id,
                        );
                    }
                }
            }
        }

        let mut tpl_subject_map:
            HashMap<ObjectId, ObjectId> =
            HashMap::new();

        let mut subject_courses_map:
            HashMap<ObjectId, Vec<ObjectId>> =
            HashMap::new();

        let mut tpl_exam_course_map:
            HashMap<ObjectId, ObjectId> =
            HashMap::new();

        if !tpl_ids_set.is_empty() {
            let tpl_ids: Vec<ObjectId> =
                tpl_ids_set.iter().copied().collect();

            let proj_tpl =
                mongodb::options::FindOptions::builder()
                    .projection(doc! {
                        "_id": 1,
                        "subject_id": 1
                    })
                    .build();

            if let Ok(mut tc) =
                paper_tpl_coll
                    .find(
                        doc! {
                            "_id": {
                                "$in": &tpl_ids
                            }
                        },
                        proj_tpl,
                    )
                    .await
            {
                while let Some(Ok(t)) = tc.next().await {
                    if let (
                        Ok(tplid),
                        Ok(sid),
                    ) = (
                        t.get_object_id("_id"),
                        t.get_object_id("subject_id"),
                    ) {
                        tpl_subject_map.insert(
                            tplid,
                            sid,
                        );
                    }
                }
            }

            let exams_v2_doc_coll:
                mongodb::Collection<Document> =
                db.collection::<Document>(
                    "exam_v2_exams",
                );

            let proj_exams2 =
                mongodb::options::FindOptions::builder()
                    .projection(doc! {
                        "paper_id": 1,
                        "course_id": 1
                    })
                    .build();

            if let Ok(mut ec2) =
                exams_v2_doc_coll
                    .find(
                        doc! {
                            "paper_id": {
                                "$in": &tpl_ids
                            }
                        },
                        proj_exams2,
                    )
                    .await
            {
                while let Some(Ok(ex)) = ec2.next().await {
                    if let (
                        Ok(pid),
                        Ok(cid),
                    ) = (
                        ex.get_object_id("paper_id"),
                        ex.get_object_id("course_id"),
                    ) {
                        tpl_exam_course_map.insert(
                            pid,
                            cid,
                        );
                    }
                }
            }

            let subjects: Vec<ObjectId> =
                tpl_subject_map
                    .values()
                    .copied()
                    .collect();

            if !subjects.is_empty() {
                let proj_cs =
                    mongodb::options::FindOptions::builder()
                        .projection(doc! {
                            "course_id": 1,
                            "subject_id": 1
                        })
                        .build();

                if let Ok(mut csc) =
                    course_subj_coll
                        .find(
                            doc! {
                                "subject_id": {
                                    "$in": &subjects
                                }
                            },
                            proj_cs,
                        )
                        .await
                {
                    while let Some(Ok(row)) = csc.next().await {
                        if let (
                            Ok(cid),
                            Ok(sid),
                        ) = (
                            row.get_object_id("course_id"),
                            row.get_object_id("subject_id"),
                        ) {
                            subject_courses_map
                                .entry(sid)
                                .or_default()
                                .push(cid);
                        }
                    }
                }
            }
        }

        let allowed_courses: Option<Vec<ObjectId>> =
            if filter_cat.is_some()
                || course_oid_filter.is_some()
            {
                let v: Vec<ObjectId> =
                    courses_map
                        .keys()
                        .filter_map(|k| {
                            ObjectId::parse_str(k).ok()
                        })
                        .collect();

                if v.is_empty() {
                    None
                } else {
                    Some(v)
                }
            } else {
                None
            };

        for (sid, eid, n) in all_evaluated_papers {
            let Some(cid) =
                exam_course_map.get(&eid).copied()
            else {
                continue;
            };

            if let Some(ref allowed) =
                allowed_courses
            {
                if !allowed.contains(&cid) {
                    continue;
                }
            }

            register_marksheet_attempt(
                &mut eligibility_map,
                sid,
                cid,
                n,
            );

            register_certificate(
                &mut eligibility_map,
                sid,
                cid,
            );
        }

        for (sid, tpl_id, n) in tpl_papers {
            let resolved_course =
                tpl_exam_course_map
                    .get(&tpl_id)
                    .copied()
                    .or_else(|| {
                        tpl_subject_map
                            .get(&tpl_id)
                            .and_then(|subj| {
                                subject_courses_map
                                    .get(subj)
                                    .and_then(|v| {
                                        v.first().copied()
                                    })
                            })
                    });

            let Some(cid) = resolved_course else {
                continue;
            };

            if let Some(ref allowed) =
                allowed_courses
            {
                if !allowed.contains(&cid) {
                    continue;
                }
            }

            register_marksheet_attempt(
                &mut eligibility_map,
                sid,
                cid,
                n,
            );

            register_certificate(
                &mut eligibility_map,
                sid,
                cid,
            );
        }
    }

    // ================================================================
    // SOURCE E
    // student_papers
    // ================================================================

    {
        let paper_coll: mongodb::Collection<Document> =
            db.collection::<Document>("student_papers");

        let bp_coll: mongodb::Collection<Document> =
            db.collection::<Document>("exam_blueprints");

        let cea_doc_coll: mongodb::Collection<Document> =
            db.collection::<Document>("course_exam_attempts");

        let filter_e = doc! {
            "$or": [
                { "status": "Evaluated" },
                { "status": "evaluated" },
                {
                    "status": {
                        "$regex": "evaluated",
                        "$options": "i"
                    }
                }
            ]
        };

        let proj_e =
            mongodb::options::FindOptions::builder()
                .projection(doc! {
                    "student_id": 1,
                    "blueprint_id": 1,
                    "attempt_number": 1,
                    "is_passed": 1,
                })
                .build();

        let mut v1_dedup:
            HashMap<
                (ObjectId, i32),
                (Option<ObjectId>, Option<bool>)
            > = HashMap::new();

        let mut bp_ids_set: BTreeSet<ObjectId> =
            BTreeSet::new();

        if let Ok(mut pc) =
            paper_coll.find(filter_e, proj_e).await
        {
            while let Some(Ok(p)) = pc.next().await {
                let sid =
                    match p.get_object_id("student_id") {
                        Ok(o) => o,
                        Err(_) => continue,
                    };

                let n =
                    p.get_i32("attempt_number")
                        .unwrap_or(1);

                let bpid =
                    p.get_object_id("blueprint_id").ok();

                let passed =
                    p.get_bool("is_passed").ok();

                if let Some(bp) = bpid {
                    bp_ids_set.insert(bp);
                }

                v1_dedup.insert(
                    (sid, n),
                    (bpid, passed),
                );
            }
        }

        let mut bp_course_map:
            HashMap<ObjectId, ObjectId> =
            HashMap::new();

        if !bp_ids_set.is_empty() {
            let ids: Vec<ObjectId> =
                bp_ids_set.iter().copied().collect();

            let proj_bp =
                mongodb::options::FindOptions::builder()
                    .projection(doc! {
                        "_id": 1,
                        "course_id": 1
                    })
                    .build();

            if let Ok(mut bc) =
                bp_coll
                    .find(
                        doc! {
                            "_id": {
                                "$in": &ids
                            }
                        },
                        proj_bp,
                    )
                    .await
            {
                while let Some(Ok(b)) = bc.next().await {
                    if let (
                        Ok(bid),
                        Ok(cid),
                    ) = (
                        b.get_object_id("_id"),
                        b.get_object_id("course_id"),
                    ) {
                        bp_course_map.insert(
                            bid,
                            cid,
                        );
                    }
                }
            }
        }

        let mut student_latest_cea_course:
            HashMap<ObjectId, ObjectId> =
            HashMap::new();

        {
            let all_stu_ids: Vec<ObjectId> =
                v1_dedup
                    .keys()
                    .map(|k| k.0)
                    .collect();

            if !all_stu_ids.is_empty() {
                let proj_cea =
                    mongodb::options::FindOptions::builder()
                        .projection(doc! {
                            "student_id": 1,
                            "course_id": 1,
                            "attempt_number": 1
                        })
                        .sort(doc! {
                            "attempt_number": -1
                        })
                        .build();

                if let Ok(mut cc) =
                    cea_doc_coll
                        .find(
                            doc! {
                                "student_id": {
                                    "$in": &all_stu_ids
                                }
                            },
                            proj_cea,
                        )
                        .await
                {
                    while let Some(Ok(row)) = cc.next().await {
                        if let (
                            Ok(sid),
                            Ok(cid),
                        ) = (
                            row.get_object_id("student_id"),
                            row.get_object_id("course_id"),
                        ) {
                            student_latest_cea_course
                                .entry(sid)
                                .or_insert(cid);
                        }
                    }
                }
            }
        }

        let allowed_courses: Option<Vec<ObjectId>> =
            if filter_cat.is_some()
                || course_oid_filter.is_some()
            {
                let v: Vec<ObjectId> =
                    courses_map
                        .keys()
                        .filter_map(|k| {
                            ObjectId::parse_str(k).ok()
                        })
                        .collect();

                if v.is_empty() {
                    None
                } else {
                    Some(v)
                }
            } else {
                None
            };

        for (
            (sid, n),
            (bpid, passed_opt),
        ) in v1_dedup.into_iter()
        {
            let cid_from_bp =
                bpid.and_then(|b| {
                    bp_course_map.get(&b).copied()
                });

            let cid_from_cea =
                student_latest_cea_course
                    .get(&sid)
                    .copied();

            let Some(cid) =
                cid_from_bp.or(cid_from_cea)
            else {
                continue;
            };

            if let Some(ref allowed) =
                allowed_courses
            {
                if !allowed.contains(&cid) {
                    continue;
                }
            }

            register_marksheet_attempt(
                &mut eligibility_map,
                sid,
                cid,
                n,
            );

            if passed_opt.unwrap_or(false) {
                register_certificate(
                    &mut eligibility_map,
                    sid,
                    cid,
                );
            }
        }
    }

    // ================================================================
    // SOURCE D
    // Existing certificates
    // ================================================================

    {
        let certs_doc_coll:
            mongodb::Collection<Document> =
            db.collection::<Document>("certificates");

        let mut filter_d = doc! {};

        if let Some(ref coids) =
            course_oid_filter
        {
            filter_d.insert(
                "course_id",
                doc! { "$in": coids },
            );
        } else if filter_cat.is_some() {
            let valid_course_oids: Vec<ObjectId> =
                courses_map
                    .keys()
                    .filter_map(|k| {
                        ObjectId::parse_str(k).ok()
                    })
                    .collect();

            if !valid_course_oids.is_empty() {
                filter_d.insert(
                    "course_id",
                    doc! {
                        "$in": valid_course_oids
                    },
                );
            }
        }

        let proj_d =
            mongodb::options::FindOptions::builder()
                .projection(doc! {
                    "_id": 1,
                    "student_id": 1,
                    "course_id": 1,
                    "certificate_type": 1,
                    "attempt_number": 1,
                    "certificate_no": 1,
                    "file_path": 1,
                })
                .build();

        if let Ok(mut c) =
            certs_doc_coll.find(filter_d, proj_d).await
        {
            while let Some(Ok(cert)) = c.next().await {
                let sid =
                    match cert.get_object_id("student_id") {
                        Ok(o) => o,
                        Err(_) => continue,
                    };

                let cid =
                    match cert.get_object_id("course_id") {
                        Ok(o) => o,
                        Err(_) => continue,
                    };

                let inferred_type =
                    if let Ok(ct_str) =
                        cert.get_str("certificate_type")
                    {
                        match ct_str
                            .trim()
                            .to_lowercase()
                            .as_str()
                        {
                            "marksheet" =>
                                CertificateType::Marksheet,

                            "certificate" =>
                                CertificateType::Certificate,

                            _ =>
                                CertificateType::Certificate,
                        }
                    } else {
                        let from_fp =
                            cert.get_str("file_path")
                                .ok()
                                .map(|s| {
                                    s.trim()
                                        .starts_with("marksheets/")
                                })
                                .unwrap_or(false);

                        let from_no =
                            cert.get_str("certificate_no")
                                .ok()
                                .map(|s| {
                                    s.trim()
                                        .starts_with("SC-")
                                })
                                .unwrap_or(false);

                        if from_fp || from_no {
                            CertificateType::Marksheet
                        } else {
                            CertificateType::Certificate
                        }
                    };

                let n =
                    cert.get_i32("attempt_number")
                        .unwrap_or(1);

                match inferred_type {
                    CertificateType::Marksheet => {
                        register_marksheet_attempt(
                            &mut eligibility_map,
                            sid,
                            cid,
                            n,
                        );
                    }

                    CertificateType::Certificate => {
                        register_certificate(
                            &mut eligibility_map,
                            sid,
                            cid,
                        );
                    }
                }
            }
        }
    }

    if eligibility_map.is_empty() {
        return (StatusCode::OK, Json(vec![]));
    }

    // ================================================================
    // STEP 2
    // Load users
    //
    // CENTER SECURITY IS APPLIED HERE
    // ================================================================

    let mut student_sids: BTreeSet<ObjectId> =
        BTreeSet::new();

    for ((sid, _), _) in eligibility_map.iter() {
        student_sids.insert(*sid);
    }

    let student_sids_vec: Vec<ObjectId> =
        student_sids.iter().copied().collect();

    let mut user_filter = doc! {
        "_id": {
            "$in": &student_sids_vec
        },
        "is_deleted": {
            "$ne": true
        }
    };

    // ================================================================
    // CENTER FILTER
    //
    // Supports both:
    //
    // parent_id: ObjectId(...)
    //
    // OR
    //
    // parent_id: "665..."
    // ================================================================

    if let Some(center_id) = center_user_id {
        user_filter.insert(
            "parent_id",
            doc! {
                "$in": [
                    center_id,
                    center_id.to_hex()
                ]
            },
        );

        println!(
            "[list_eligible_for_marksheet] Center filter applied: parent_id={}",
            center_id
        );
    }

    // ================================================================
    // SEARCH
    // ================================================================

    if let Some(ref search) = q.search {
        let escaped =
            regex::escape(search);

        let re =
            format!("(?i){}", escaped);

        let mut or_conditions:
            Vec<Document> = Vec::new();

        or_conditions.push(
            doc! {
                "full_name": {
                    "$regex": &re
                }
            },
        );

        or_conditions.push(
            doc! {
                "student_name": {
                    "$regex": &re
                }
            },
        );

        or_conditions.push(
            doc! {
                "father_name": {
                    "$regex": &re
                }
            },
        );

        or_conditions.push(
            doc! {
                "enrollment_number": {
                    "$regex": &re
                }
            },
        );

        or_conditions.push(
            doc! {
                "registration_number": {
                    "$regex": &re
                }
            },
        );

        or_conditions.push(
            doc! {
                "username": {
                    "$regex": &re
                }
            },
        );

        let search_lower =
            search.to_lowercase();

        let matching_center_oids:
            Vec<ObjectId> =
            centers_map
                .iter()
                .filter(|(_, name)| {
                    name.to_lowercase()
                        .contains(&search_lower)
                })
                .filter_map(|(hex, _)| {
                    ObjectId::parse_str(hex).ok()
                })
                .collect();

        if !matching_center_oids.is_empty() {
            or_conditions.push(
                doc! {
                    "parent_id": {
                        "$in": &matching_center_oids
                    }
                },
            );
        }

        user_filter.insert(
            "$or",
            or_conditions,
        );
    }

    // ================================================================
    // LOAD USERS
    // ================================================================

    let find_opts =
        mongodb::options::FindOptions::builder()
            .projection(doc! {
                "_id": 1,
                "full_name": 1,
                "username": 1,
                "student_name": 1,
                "registration_number": 1,
                "father_name": 1,
                "enrollment_number": 1,
                "course_id": 1,
                "course": 1,
                "parent_id": 1,
                "role": 1,
            })
            .build();

    struct UserInfo {
        doc: Document,
    }

    let mut users_by_sid:
        HashMap<ObjectId, UserInfo> =
        HashMap::new();

    {
        let mut cursor =
            match users_coll
                .find(
                    user_filter,
                    find_opts,
                )
                .await
            {
                Ok(c) => c,

                Err(e) => {
                    println!(
                        "[list_eligible_for_marksheet] User query failed: {:?}",
                        e
                    );

                    return (
                        StatusCode::OK,
                        Json(vec![])
                    );
                }
            };

        while let Some(Ok(user_doc)) =
            cursor.next().await
        {
            let sid_oid =
                match user_doc
                    .get_object_id("_id")
                {
                    Ok(oid) => oid,
                    Err(_) => continue,
                };

            users_by_sid.insert(
                sid_oid,
                UserInfo {
                    doc: user_doc
                },
            );
        }
    }

    if users_by_sid.is_empty() {
        return (StatusCode::OK, Json(vec![]));
    }

    // ================================================================
    // STEP 3
    // Existing certificates
    // ================================================================

    struct CertKey {
        marksheet_by_attempt:
            HashMap<i32, String>,
        cert_any: Option<String>,
    }

    let mut certs_lookup:
        HashMap<(ObjectId, ObjectId), CertKey> =
        HashMap::new();

    {
        let lookup_sids:
            Vec<ObjectId> =
            users_by_sid.keys().copied().collect();

        let lookup_cids:
            Vec<ObjectId> =
            eligibility_map
                .keys()
                .filter(|(sid, _)| {
                    users_by_sid.contains_key(sid)
                })
                .map(|(_, cid)| *cid)
                .collect();

        if !lookup_sids.is_empty()
            && !lookup_cids.is_empty()
        {
            let certs_raw_coll:
                mongodb::Collection<Document> =
                db.collection::<Document>(
                    "certificates"
                );

            let filter_certs = doc! {
                "student_id": {
                    "$in": &lookup_sids
                },
                "course_id": {
                    "$in": &lookup_cids
                }
            };

            let proj_certs =
                mongodb::options::FindOptions::builder()
                    .projection(doc! {
                        "_id": 1,
                        "student_id": 1,
                        "course_id": 1,
                        "certificate_type": 1,
                        "attempt_number": 1,
                        "certificate_no": 1,
                        "file_path": 1,
                    })
                    .build();

            if let Ok(mut cc) =
                certs_raw_coll
                    .find(
                        filter_certs,
                        proj_certs,
                    )
                    .await
            {
                while let Some(Ok(raw_cert)) =
                    cc.next().await
                {
                    let cert_id_hex =
                        match raw_cert
                            .get_object_id("_id")
                        {
                            Ok(oid) =>
                                oid.to_hex(),
                            Err(_) =>
                                continue,
                        };

                    let sid =
                        match raw_cert
                            .get_object_id(
                                "student_id"
                            )
                        {
                            Ok(o) => o,
                            Err(_) => continue,
                        };

                    let cid =
                        match raw_cert
                            .get_object_id(
                                "course_id"
                            )
                        {
                            Ok(o) => o,
                            Err(_) => continue,
                        };

                    let inferred_type =
                        if let Ok(ct_str) =
                            raw_cert
                                .get_str(
                                    "certificate_type"
                                )
                        {
                            match ct_str
                                .trim()
                                .to_lowercase()
                                .as_str()
                            {
                                "marksheet" =>
                                    CertificateType::Marksheet,

                                "certificate" =>
                                    CertificateType::Certificate,

                                _ =>
                                    CertificateType::Certificate,
                            }
                        } else {
                            let from_fp =
                                raw_cert
                                    .get_str(
                                        "file_path"
                                    )
                                    .ok()
                                    .map(|s| {
                                        s.trim()
                                            .starts_with(
                                                "marksheets/"
                                            )
                                    })
                                    .unwrap_or(false);

                            let from_no =
                                raw_cert
                                    .get_str(
                                        "certificate_no"
                                    )
                                    .ok()
                                    .map(|s| {
                                        s.trim()
                                            .starts_with(
                                                "SC-"
                                            )
                                    })
                                    .unwrap_or(false);

                            if from_fp || from_no {
                                CertificateType::Marksheet
                            } else {
                                CertificateType::Certificate
                            }
                        };

                    let n =
                        raw_cert
                            .get_i32(
                                "attempt_number"
                            )
                            .unwrap_or(1);

                    let n =
                        if n <= 0 { 1 } else { n };

                    let key =
                        (sid, cid);

                    let entry =
                        certs_lookup
                            .entry(key)
                            .or_insert_with(
                                || CertKey {
                                    marksheet_by_attempt:
                                        HashMap::new(),
                                    cert_any: None,
                                },
                            );

                    match inferred_type {
                        CertificateType::Marksheet => {
                            entry
                                .marksheet_by_attempt
                                .insert(
                                    n,
                                    cert_id_hex,
                                );
                        }

                        CertificateType::Certificate => {
                            if entry.cert_any.is_none() {
                                entry.cert_any =
                                    Some(
                                        cert_id_hex
                                    );
                            }
                        }
                    }
                }
            }
        }
    }

    // ================================================================
    // HELPERS
    // ================================================================

    fn resolve_course_name(
        user_doc: &Document,
        course_id_from_key: ObjectId,
        courses_map:
            &HashMap<String, (String, String)>,
    ) -> String {
        if let Some((cn, _)) =
            courses_map.get(
                &course_id_from_key.to_hex()
            )
        {
            return cn.clone();
        }

        if let Ok(oid) =
            user_doc.get_object_id("course_id")
        {
            if let Some((cn, _)) =
                courses_map.get(
                    &oid.to_hex()
                )
            {
                return cn.clone();
            }
        }

        if let Ok(s) =
            user_doc.get_str("course_id")
        {
            if let Some((cn, _)) =
                courses_map.get(s.trim())
            {
                return cn.clone();
            }
        }

        if let Ok(course_str) =
            user_doc.get_str("course")
        {
            let t =
                course_str.trim();

            if !t.is_empty() {
                return t.to_string();
            }
        }

        "Unknown Course".to_string()
    }

    fn is_lenient_student_role(
        user_doc: &Document
    ) -> bool {
        if let Ok(role_str) =
            user_doc.get_str("role")
        {
            let trimmed =
                role_str
                    .trim()
                    .to_lowercase();

            if trimmed.is_empty() {
                return true;
            }

            if trimmed == "student"
                || trimmed.contains("student")
            {
                return true;
            }

            if trimmed == "admin"
                || trimmed == "superadmin"
                || trimmed == "center"
                || trimmed == "staff"
                || trimmed == "intern"
            {
                return false;
            }

            return true;
        }

        true
    }

    // ================================================================
    // STEP 4
    // GROUP STUDENTS
    // ================================================================

    let mut per_student_rows:
        BTreeMap<
            ObjectId,
            Vec<(
                (ObjectId, ObjectId),
                &PerCourse
            )>
        > = BTreeMap::new();

    for (key, val) in
        eligibility_map.iter()
    {
        let (sid, _cid) = key;

        if !users_by_sid.contains_key(sid) {
            continue;
        }

        let cid_hex =
            key.1.to_hex();

        if !courses_map.is_empty()
            && (
                filter_cat.is_some()
                    || course_oid_filter.is_some()
            )
        {
            if !courses_map.contains_key(
                &cid_hex
            ) {
                continue;
            }
        }

        per_student_rows
            .entry(*sid)
            .or_default()
            .push((*key, val));
    }

    // ================================================================
    // FINAL ROWS
    // ================================================================

    let mut rows:
        Vec<StudentEligibleRow> =
        Vec::new();

    for (sid, entries) in
        per_student_rows.iter()
    {
        let user_info =
            match users_by_sid.get(sid)
            {
                Some(u) => u,
                None => continue,
            };

        let user_doc =
            &user_info.doc;

        if !is_lenient_student_role(
            user_doc
        ) {
            continue;
        }

        let sid_hex =
            sid.to_hex();

        let full_name =
            user_doc
                .get_str("full_name")
                .ok()
                .unwrap_or("")
                .to_string();

        let username =
            user_doc
                .get_str("username")
                .ok()
                .unwrap_or("")
                .to_string();

        let student_name =
            user_doc
                .get_str("student_name")
                .ok()
                .unwrap_or("")
                .to_string();

        let reg_num =
            user_doc
                .get_str(
                    "registration_number"
                )
                .ok()
                .unwrap_or("")
                .to_string();

        let enroll_num =
            user_doc
                .get_str(
                    "enrollment_number"
                )
                .ok()
                .unwrap_or("")
                .to_string();

        let display_name =
            if !full_name.is_empty() {
                full_name
            } else if !student_name.is_empty() {
                student_name
            } else if !username.is_empty() {
                username.clone()
            } else if !reg_num.is_empty() {
                reg_num.clone()
            } else if !enroll_num.is_empty() {
                enroll_num.clone()
            } else {
                format!(
                    "Student {}",
                    &sid_hex[
                        ..std::cmp::min(
                            8,
                            sid_hex.len()
                        )
                    ]
                )
            };

        let reg_fallback =
            if !reg_num.is_empty() {
                reg_num
            } else if !enroll_num.is_empty() {
                enroll_num.clone()
            } else {
                username.clone()
            };

        let father_name =
            user_doc
                .get_str("father_name")
                .ok()
                .map(|s| s.to_string());

        let enrollment_number =
            if !enroll_num.is_empty() {
                Some(enroll_num)
            } else {
                None
            };

        let center_name =
            user_doc
                .get_object_id("parent_id")
                .ok()
                .and_then(|pid| {
                    centers_map
                        .get(&pid.to_hex())
                        .cloned()
                })
                .or_else(|| {
                    user_doc
                        .get_str("parent_id")
                        .ok()
                        .and_then(|pid| {
                            centers_map
                                .get(pid)
                                .cloned()
                        })
                });

        for ((_sid_dup, cid), per_course)
            in entries
        {
            let course_name =
                resolve_course_name(
                    user_doc,
                    *cid,
                    &courses_map,
                );

            let (
                marksheet_by_attempt,
                cert_any,
            ) =
                match certs_lookup.get(
                    &(*sid, *cid)
                ) {
                    Some(ck) => (
                        ck.marksheet_by_attempt
                            .clone(),
                        ck.cert_any.clone(),
                    ),

                    None => (
                        HashMap::new(),
                        None,
                    ),
                };

            let mut attempts:
                Vec<StudentEligibleAttempt> =
                per_course
                    .marksheet_attempts
                    .iter()
                    .map(|&n| {
                        let ms_id =
                            marksheet_by_attempt
                                .get(&n)
                                .cloned();

                        let c_id =
                            if per_course
                                .certificate_eligible
                            {
                                cert_any.clone()
                            } else {
                                None
                            };

                        StudentEligibleAttempt {
                            attempt_number: n,
                            marksheet_id: ms_id,
                            certificate_id: c_id,
                        }
                    })
                    .collect();

            if attempts.is_empty()
                && per_course
                    .certificate_eligible
            {
                attempts.push(
                    StudentEligibleAttempt {
                        attempt_number: 1,
                        marksheet_id: None,
                        certificate_id:
                            cert_any.clone(),
                    },
                );
            }

            if attempts.is_empty() {
                continue;
            }

            rows.push(
                StudentEligibleRow {
                    student_id:
                        sid_hex.clone(),

                    student_name:
                        display_name.clone(),

                    registration_number:
                        reg_fallback.clone(),

                    course:
                        course_name.clone(),

                    id:
                        sid_hex.clone(),

                    full_name:
                        display_name.clone(),

                    father_name:
                        father_name.clone(),

                    enrollment_number:
                        enrollment_number.clone(),

                    course_name,

                    center_name:
                        center_name.clone(),

                    attempts,
                }
            );
        }
    }

    println!(
        "[list_eligible_for_marksheet] role={:?} center={:?} final_rows={}",
        claims.role,
        center_user_id,
        rows.len()
    );

    (
        StatusCode::OK,
        Json(rows)
    )
}
pub async fn approve_and_schedule_marksheets(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<ScheduleMarksheetRequest>,
) -> (StatusCode, Json<V2Msg>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(V2Msg {
                success: false,
                message: "Unauthorized".into(),
            }),
        );
    }

    let _sched_at = match chrono::DateTime::parse_from_rfc3339(&payload.scheduled_at) {
        Ok(dt) => dt.with_timezone(&chrono::Utc),
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(V2Msg {
                    success: false,
                    message: "Invalid schedule time".into(),
                }),
            );
        }
    };

    // Use existing process_generate_certificates but with mode="consolidated" and scheduled_at
    let gen_payload = GenerateRequest {
        template_id: payload.template_id.clone(),
        student_ids: payload.student_ids.clone(),
        issue_date: Some(Utc::now().naive_utc().date().to_string()),
        mode: Some("consolidated".to_string()),
        scheduled_at: Some(payload.scheduled_at.clone()),
        reissue: Some(true),
        force_new: Some(false),
        attempt_number: None,
    };

    let (status, resp) = process_generate_certificates(&db, claims.role, gen_payload).await;

    if status == StatusCode::OK && resp.0.success {
        (
            StatusCode::OK,
            Json(V2Msg {
                success: true,
                message: format!(
                    "Scheduled {} marksheets for {}",
                    resp.0
                        .certificate_ids
                        .as_ref()
                        .map(|v| v.len())
                        .unwrap_or(0),
                    payload.scheduled_at
                ),
            }),
        )
    } else {
        (
            status,
            Json(V2Msg {
                success: false,
                message: resp.0.message,
            }),
        )
    }
}

pub async fn process_generate_certificates(
    db: &Database,
    role: UserRole,
    payload: GenerateRequest,
) -> (StatusCode, Json<GenerateResponse>) {
    let template_oid = match ObjectId::parse_str(&payload.template_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(GenerateResponse {
                    success: false,
                    message: "Invalid template ID".to_string(),
                    html: None,
                    certificate_ids: None,
                    preview: None,
                    combined_pdf_url: None,
                }),
            );
        }
    };

    let templates = db.collection::<Template>("templates");
    let template = match templates
        .find_one(doc! { "_id": template_oid.clone() }, None)
        .await
    {
        Ok(Some(t)) => t,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(GenerateResponse {
                    success: false,
                    message: "Template not found".to_string(),
                    html: None,
                    certificate_ids: None,
                    preview: None,
                    combined_pdf_url: None,
                }),
            );
        }
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(GenerateResponse {
                    success: false,
                    message: "Database error".to_string(),
                    html: None,
                    certificate_ids: None,
                    preview: None,
                    combined_pdf_url: None,
                }),
            );
        }
    };

    let fields_coll = db.collection::<TemplateField>("template_fields");
    let mut cursor = fields_coll
        .find(doc! { "template_id": &template_oid }, None)
        .await
        .unwrap();
    let mut fields = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(field) = result {
            fields.push(field);
        }
    }
    // Stable paint order and layout: only these fields exist on the template; top-to-left order.
    fields.sort_by(|a, b| {
        a.y_position
            .partial_cmp(&b.y_position)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                a.x_position
                    .partial_cmp(&b.x_position)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
    });

    let placeholder_regex = regex::Regex::new(r"\{\{[^}]+\}\}").ok();
    let source_placeholder_count: usize = fields
        .iter()
        .map(|field| {
            field
                .custom_text
                .as_deref()
                .map(|text| {
                    placeholder_regex
                        .as_ref()
                        .map(|re| re.find_iter(text).count())
                        .unwrap_or(0)
                })
                .unwrap_or(0)
        })
        .sum();
    let debug_fields: Vec<serde_json::Value> = fields
        .iter()
        .map(|field| {
            serde_json::json!({
                "type": field.field_type,
                "x": field.x_position,
                "y": field.y_position,
                "width": field.width,
                "height": field.height,
                "text": field.custom_text,
                "placeholder": field.field_name,
                "font_size": field.font_size,
                "font_family": field.font_family,
                "color": field.color,
                "text_align": field.text_align,
            })
        })
        .collect();
    // #region debug-point A:template-and-fields
    debug_report(
        "pre-fix",
        "A",
        "backend/src/handlers/generate_certificates.rs:1479",
        "[DEBUG] Template and canvas fields loaded for Admin certificate generation",
        serde_json::json!({
            "template_id": template.id.map(|id| id.to_hex()).unwrap_or_else(|| template_oid.to_hex()),
            "course_id": template.course_id.map(|id| id.to_hex()),
            "template_name": template.template_name,
            "default": template.default_design,
            "template_type": template.template_type.to_str(),
            "field_count": debug_fields.len(),
            "placeholders_in_source": source_placeholder_count,
            "fields": debug_fields,
        }),
    )
    .await;
    // #endregion

    let users_coll = db.collection::<User>("users");
    let centers_coll = db.collection::<Center>("centers");
    let courses_coll = db.collection::<Course>("courses");
    let course_subjects_coll = db.collection::<CourseSubject>("course_subjects");
    let subjects_coll = db.collection::<Subject>("subjects");
    let paper_coll = db.collection::<Marksheet>("student_papers");
    let paper_v2_coll = db.collection::<ExamV2Paper>("exam_v2_papers");
    let paper_v2_tpl_coll = db.collection::<ExamV2PaperTemplate>("exam_v2_paper_templates");
    let blueprint_coll =
        db.collection::<crate::models::exam_engine::ExamBlueprint>("exam_blueprints");
    let certs_coll = db.collection::<Certificate>("certificates");
    let admin_assets_coll = db.collection::<AdminAssets>("admin_assets");

    let admin_assets = admin_assets_coll
        .find_one(doc! {}, None)
        .await
        .ok()
        .flatten();
    let base_url = env::var("BASE_URL").unwrap_or_else(|_| "https://screduc.com".to_string());
    let mut contexts: Vec<CertContext> = Vec::new();
    let mut certificate_ids: Vec<String> = Vec::new();
    let mut preview_rows: Vec<GeneratePreviewRow> = Vec::new();
    let mut skip_invalid_id = 0u32;
    let mut skip_not_student = 0u32;
    let mut skip_course_mismatch = 0u32;
    let mut skip_already_issued = 0u32;
    let mut skip_no_db_row = 0u32;

    for sid in &payload.student_ids {
        let sid_oid = match ObjectId::parse_str(sid) {
            Ok(o) => o,
            Err(_) => {
                skip_invalid_id += 1;
                continue;
            }
        };

        // Load by `_id` only — some DBs store `role` with different casing; filtering `role: "student"` in BSON
        // then missed the document and produced "Generated 0 certificate(s)" with an empty HTML body.
        let user = match users_coll.find_one(doc! { "_id": &sid_oid }, None).await {
            Ok(Some(u)) => u,
            _ => {
                skip_not_student += 1;
                continue;
            }
        };
        if user.role != UserRole::Student {
            skip_not_student += 1;
            continue;
        }

        let (center_doc, center_id) = if let Some(parent_id) = user.parent_id {
            match centers_coll
                .find_one(doc! { "user_id": &parent_id }, None)
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

        // Load session document to get session_name
        let session_name = if let Some(session_id) = user.session_id {
            let sessions_coll = db.collection::<Session>("sessions");
            if let Ok(Some(session)) = sessions_coll
                .find_one(doc! { "_id": session_id }, None)
                .await
            {
                Some(session.session_name)
            } else {
                None
            }
        } else {
            None
        };

        let center_address = center_doc.as_ref().map(|c| c.address.clone());
        let exam_mode = user.exam_mode.clone();
        let admission_mode = user.admission_mode.clone();

        let filter = doc! { "student_id": &sid_oid, "status": "Evaluated" };
        let find_opts = mongodb::options::FindOptions::builder()
            .sort(doc! { "submit_time": -1 })
            .build();
        let mut exam_cursor = paper_coll.find(filter, Some(find_opts)).await.ok().unwrap();

        let mut all_papers = Vec::new();
        while let Some(Ok(p)) = exam_cursor.next().await {
            all_papers.push(p);
        }

        // Collect all V2 papers (optionally filtered by attempt_number)
        let mut all_v2_papers = Vec::new();
        let mut filter_v2_all = doc! {
            "student_id": &sid_oid,
            "status": { "$regex": "^evaluated$", "$options": "i" }
        };
        if let Some(n) = payload.attempt_number {
            filter_v2_all.insert("attempt_number", n as i64);
        }
        let mut exam_v2_cursor = paper_v2_coll.find(filter_v2_all, None).await.ok().unwrap();
        while let Some(Ok(p2)) = exam_v2_cursor.next().await {
            all_v2_papers.push(p2);
        }
        all_v2_papers.sort_by(|a, b| b.attempt_number.cmp(&a.attempt_number));

        let mut exam_paper_v2 = None;
        let mut paper_v2_tpl = None;
        let mut exam_v2_opt = None;
        if all_papers.is_empty() && !all_v2_papers.is_empty() {
            // If no V1 papers, use the latest V2 paper for single view fallback
            if let Some(latest_v2_paper) = all_v2_papers.first() {
                if let Ok(Some(tpl)) = paper_v2_tpl_coll
                    .find_one(doc! { "_id": latest_v2_paper.paper_template_id }, None)
                    .await
                {
                    paper_v2_tpl = Some(tpl);
                    exam_paper_v2 = Some(latest_v2_paper.clone());
                    if let Ok(Some(ex)) = db
                        .collection::<ExamV2Exam>("exam_v2_exams")
                        .find_one(doc! { "_id": latest_v2_paper.exam_id }, None)
                        .await
                    {
                        exam_v2_opt = Some(ex);
                    }
                }
            }
        }

        let is_consolidated = payload.mode.as_deref() == Some("consolidated");
        let exam_paper = all_papers.first().cloned();

        let mut course_name = user.course.clone().unwrap_or_default();
        let mut course_duration: Option<String> = None;
        let mut course_id_opt: Option<ObjectId> = None;
        let mut blueprint_opt = None;

        // Resolve course_name from user.course if it's an ID or needs lookup
        if !course_name.is_empty() {
            if let Ok(oid) = ObjectId::parse_str(&course_name) {
                if let Ok(Some(c)) = courses_coll.find_one(doc! { "_id": &oid }, None).await {
                    course_name = c.course_name.clone();
                    course_duration = Some(format!("{} Months", c.duration_months));
                    course_id_opt = Some(oid);
                }
            } else {
                // Try case-insensitive name match if it's not an ID but might be a name
                let by_name_filter = doc! {
                    "course_name": { "$regex": format!("^{}$", regex::escape(&course_name)), "$options": "i" }
                };
                if let Ok(Some(c)) = courses_coll.find_one(by_name_filter, None).await {
                    course_name = c.course_name.clone();
                    course_duration = Some(format!("{} Months", c.duration_months));
                    course_id_opt = c.id;
                }
            }
        }

        if let Some(ref paper) = exam_paper {
            blueprint_opt = blueprint_coll
                .find_one(doc! { "_id": paper.blueprint_id }, None)
                .await
                .ok()
                .flatten();
            if let Some(ref bp) = blueprint_opt {
                if let Ok(Some(c)) = courses_coll
                    .find_one(doc! { "_id": &bp.course_id }, None)
                    .await
                {
                    course_name = c.course_name.clone();
                    course_duration = Some(format!("{} Months", c.duration_months));
                    course_id_opt = Some(bp.course_id);
                }
            }
        } else if let Some(ref ex) = exam_v2_opt {
            if let Ok(Some(c)) = courses_coll
                .find_one(doc! { "_id": &ex.course_id }, None)
                .await
            {
                course_name = c.course_name.clone();
                course_duration = Some(format!("{} Months", c.duration_months));
                course_id_opt = Some(ex.course_id);
            }
        }

        // Course-bound templates: for **marksheets** only, require the student's course to match.
        // Certificate / ID card templates often carry a legacy `course_id` but should still issue
        // to any valid student; skipping here caused "Generated 0 certificate(s)" in production.
        if matches!(template.template_type, TemplateType::Marksheet) {
            if let Some(template_course_id) = template.course_id {
                let mut resolved_student_course_id = course_id_opt;
                if resolved_student_course_id.is_none() {
                    if let Some(raw_course) = user.course.clone() {
                        if let Ok(oid) = ObjectId::parse_str(&raw_course) {
                            resolved_student_course_id = Some(oid);
                        } else {
                            let by_name_filter = doc! {
                                "course_name": { "$regex": format!("^{}$", regex::escape(&raw_course)), "$options": "i" }
                            };
                            if let Ok(Some(c)) = courses_coll.find_one(by_name_filter, None).await {
                                resolved_student_course_id = c.id;
                            }
                        }
                    }
                }
                if resolved_student_course_id != Some(template_course_id) {
                    skip_course_mismatch += 1;
                    continue;
                }
            }
        }

        let mut existing_cert = match template.template_type {
            TemplateType::Certificate => {
                let raw_certs_coll = db.collection::<Document>("certificates");
                let mut existing_oid = raw_certs_coll
                    .find_one(
                        doc! {
                            "student_id": &sid_oid,
                            "template_id": &template_oid,
                            "certificate_type": "certificate",
                        },
                        None,
                    )
                    .await
                    .ok()
                    .flatten()
                    .and_then(|d| d.get_object_id("_id").ok());

                if existing_oid.is_none() {
                    existing_oid = raw_certs_coll
                        .find_one(
                            doc! {
                                "student_id": &sid_oid,
                                "template_id": &template_oid,
                            },
                            None,
                        )
                        .await
                        .ok()
                        .flatten()
                        .and_then(|d| d.get_object_id("_id").ok());
                }

                if existing_oid.is_none() {
                    existing_oid = raw_certs_coll
                        .find_one(
                            doc! {
                                "student_id": &sid_oid,
                                "certificate_type": "certificate",
                            },
                            None,
                        )
                        .await
                        .ok()
                        .flatten()
                        .and_then(|d| d.get_object_id("_id").ok());
                }

                if let Some(existing_oid) = existing_oid {
                    certs_coll
                        .find_one(doc! { "_id": existing_oid }, None)
                        .await
                        .ok()
                        .flatten()
                } else {
                    None
                }
            }
            _ => certs_coll
                .find_one(
                    doc! { "student_id": &sid_oid, "course": &course_name },
                    None,
                )
                .await
                .ok()
                .flatten(),
        };

        if payload.force_new.unwrap_or(false) {
            existing_cert = None;
        }

        if matches!(template.template_type, TemplateType::Certificate)
            && existing_cert.is_some()
            && !payload.reissue.unwrap_or(false)
        {
            skip_already_issued += 1;
            continue;
        }

        if all_papers.is_empty() && exam_paper_v2.is_none() {
            if matches!(template.template_type, TemplateType::Marksheet) {
                // Strictly prohibit marksheet generation if no evaluated exam results exist
                skip_no_db_row += 1;
                continue;
            }
        }

        // 1. Ensure Enrollment Number exists
        let enrollment_no = if user.enrollment_number.is_none()
            || user
                .enrollment_number
                .as_ref()
                .map(|s| s.trim().is_empty())
                .unwrap_or(true)
        {
            let creator_id = user.parent_id.unwrap_or(sid_oid);
            let new_enrollment = generate_enrollment_number_old(&db, &creator_id).await;
            let _ = users_coll
                .update_one(
                    doc! { "_id": &sid_oid },
                    doc! { "$set": { "enrollment_number": &new_enrollment } },
                    None,
                )
                .await;
            new_enrollment
        } else {
            user.enrollment_number.clone().unwrap()
        };

        let serial = if let Some(ref cert) = existing_cert {
            cert.certificate_no.clone()
        } else {
            generate_certificate_number(&sid_oid)
        };

        let issue_date_val = payload
            .issue_date
            .clone()
            .unwrap_or_else(|| chrono::Utc::now().naive_utc().date().to_string());
        let issue_naive = chrono::NaiveDate::parse_from_str(&issue_date_val, "%Y-%m-%d")
            .unwrap_or_else(|_| chrono::Utc::now().naive_utc().date());
        let issue_dt = chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(
            issue_naive.and_hms_opt(0, 0, 0).unwrap(),
            chrono::Utc,
        );

        let status = if role == UserRole::Center {
            "pending_approval".to_string()
        } else if payload.scheduled_at.is_some() {
            "scheduled".to_string()
        } else {
            "approved".to_string()
        };

        let scheduled_at = payload.scheduled_at.as_ref().and_then(|s| {
            chrono::DateTime::parse_from_rfc3339(s)
                .ok()
                .map(|dt| dt.with_timezone(&chrono::Utc))
        });

        // Certificate row `_id` after insert/replace — drives preview IDs and reload by `_id`.
        let persisted_cert_oid: Option<ObjectId> = if let Some(mut cert) = existing_cert {
            let oid_resolved = match cert.id {
                Some(oid) => Some(oid),
                None => {
                    let raw_coll = db.collection::<Document>("certificates");
                    let filter = if matches!(template.template_type, TemplateType::Certificate) {
                        doc! { "student_id": &sid_oid, "template_id": &template_oid }
                    } else {
                        doc! { "student_id": &sid_oid, "course": &course_name }
                    };
                    raw_coll
                        .find_one(filter, None)
                        .await
                        .ok()
                        .flatten()
                        .and_then(|d| d.get_object_id("_id").ok())
                }
            };
            match oid_resolved {
                Some(oid) => {
                    let verification_url = format!(
                        "{}/verify-certificate/{}",
                        base_url.trim_end_matches('/'),
                        oid.to_hex()
                    );
                    cert.id = Some(oid);
                    cert.template_id = Some(template_oid.clone());
                    cert.issued_on = issue_dt;
                    cert.verification_url = Some(verification_url.clone());
                    cert.course_id = course_id_opt;
                    cert.status = Some(status.clone());
                    cert.scheduled_at = scheduled_at;
                    let _ = certs_coll
                        .replace_one(doc! { "_id": &oid }, cert, None)
                        .await;
                    Some(oid)
                }
                None => None,
            }
        } else {
            let new_cert = Certificate {
                id: None,
                student_id: sid_oid.clone(),
                center_id,
                course: course_name.clone(),
                course_id: course_id_opt,
                certificate_no: serial.clone(),
                center_name: center_doc.as_ref().map(|c| c.name.clone()),
                center_signature_url: None,
                center_stamp_url: None,
                admin_signature_url: admin_assets.as_ref().and_then(|a| a.signature_url.clone()),
                admin_stamp_url: admin_assets.as_ref().and_then(|a| a.stamp_url.clone()),
                signature_url: admin_assets.as_ref().and_then(|a| a.signature_url.clone()),
                stamp_url: admin_assets.as_ref().and_then(|a| a.stamp_url.clone()),
                background_url: admin_assets.as_ref().and_then(|a| a.background_url.clone()),
                issued_on: issue_dt,
                status: Some(status.clone()),
                scheduled_at,
                template_id: Some(template_oid.clone()),
                verification_url: None,
                pdf_url: None,
                file_path: None,
                certificate_type: match &template.template_type {
                    TemplateType::Certificate => crate::models::certificate::CertificateType::Certificate,
                    TemplateType::Marksheet => crate::models::certificate::CertificateType::Marksheet,
                    _ => crate::models::certificate::CertificateType::Certificate,
                },
                attempt_number: Some(1),
            };
            match certs_coll.insert_one(new_cert, None).await {
                Ok(res) => match res.inserted_id {
                    Bson::ObjectId(oid) => {
                        let verification_url = format!(
                            "{}/verify-certificate/{}",
                            base_url.trim_end_matches('/'),
                            oid.to_hex()
                        );
                        let _ = certs_coll
                            .update_one(
                                doc! { "_id": &oid },
                                doc! { "$set": { "verification_url": &verification_url } },
                                None,
                            )
                            .await;
                        Some(oid)
                    }
                    other => {
                        eprintln!(
                            "certificate insert_one: unexpected inserted_id (expected ObjectId): {:?}",
                            other
                        );
                        None
                    }
                },
                Err(e) => {
                    eprintln!(
                        "certificate insert_one failed for student {}: {}. Full error: {:?}",
                        sid_oid.to_hex(),
                        e,
                        e
                    );
                    None
                }
            }
        };

        let cert_doc = if let Some(oid) = persisted_cert_oid {
            certs_coll
                .find_one(doc! { "_id": oid }, None)
                .await
                .ok()
                .flatten()
        } else if matches!(template.template_type, TemplateType::Certificate) {
            certs_coll
                .find_one(
                    doc! { "student_id": &sid_oid, "template_id": &template_oid },
                    None,
                )
                .await
                .ok()
                .flatten()
        } else {
            certs_coll
                .find_one(
                    doc! { "student_id": &sid_oid, "course": &course_name },
                    None,
                )
                .await
                .ok()
                .flatten()
        };

        let mut preview_cert_oid =
            persisted_cert_oid.or_else(|| cert_doc.as_ref().and_then(|c| c.id));
        if preview_cert_oid.is_none() {
            let raw = db.collection::<Document>("certificates");
            let filter = if matches!(template.template_type, TemplateType::Certificate) {
                doc! { "student_id": &sid_oid, "template_id": &template_oid }
            } else {
                doc! { "student_id": &sid_oid, "course": &course_name }
            };
            if let Ok(Some(doc)) = raw.find_one(filter, None).await {
                preview_cert_oid = doc.get_object_id("_id").ok();
            } else {
                // FALLBACK: Try finding by just student_id and type=marksheet
                if let Ok(Some(doc)) = raw
                    .find_one(doc! { "student_id": &sid_oid, "type": "marksheet" }, None)
                    .await
                {
                    preview_cert_oid = doc.get_object_id("_id").ok();
                }
            }
        }

        let Some(preview_oid) = preview_cert_oid else {
            skip_no_db_row += 1;
            eprintln!(
                "generate_certificates: no certificates row for student {} after insert/find — skipping (serial={})",
                sid_oid.to_hex(),
                serial
            );
            continue;
        };
        let hex = preview_oid.to_hex();
        certificate_ids.push(hex.clone());
        preview_rows.push(GeneratePreviewRow {
            certificate_id: hex,
            student_id: sid_oid.to_hex(),
            student_name: user
                .full_name
                .clone()
                .unwrap_or_else(|| user.username.clone()),
        });

        let (
            result_status,
            exam_date_str,
            result_date,
            obtained_marks,
            total_marks,
            result_percentage,
            overall_status,
            grade,
            subjects,
            marks_rows_consolidated,
        ) = if is_consolidated {
            let mut total_obtained = 0.0;
            let mut total_max = 0.0;
            let all_subjects = Vec::new();
            let mut consolidated_marks_rows: Vec<MarksRow> = Vec::new();
            let mut seen_subjects = std::collections::HashSet::new();

            // Sort all papers by attempt count descending so we process the latest attempt first for each subject
            let mut combined_v2_papers = all_v2_papers.clone();
            combined_v2_papers.sort_by(|a, b| b.attempt_number.cmp(&a.attempt_number));

            for p2 in combined_v2_papers {
                if let Ok(Some(tpl)) = paper_v2_tpl_coll
                    .find_one(doc! { "_id": p2.paper_template_id }, None)
                    .await
                {
                    for (sec_id, obtained) in &p2.section_wise_marks {
                        // Use subject_id + name as a unique key for the subject
                        let subject_key = format!("{:?}", sec_id);
                        if seen_subjects.contains(&subject_key) {
                            continue;
                        }

                        if let Some(sec) = tpl
                            .sections
                            .iter()
                            .find(|s| &s.name == sec_id || format!("{:?}", s.marks) == *sec_id)
                        {
                            let max = sec.marks * (sec.count as f64);
                            let min = (max * 0.4).round();
                            let status = if *obtained >= min {
                                "PASS".to_string()
                            } else {
                                "FAIL".to_string()
                            };
                            let percentage = if max > 0.0 {
                                (obtained / max * 100.0).round()
                            } else {
                                0.0
                            };

                            consolidated_marks_rows.push(MarksRow {
                                subject: sec_id.clone(),
                                obtained: *obtained,
                                max_marks: max,
                                min_marks: min,
                                status,
                                percentage,
                                theory_total: max,
                                theory_obtained: *obtained,
                                practical_total: 0.0,
                                practical_obtained: 0.0,
                                assignment_total: 0.0,
                                assignment_obtained: 0.0,
                            });
                            seen_subjects.insert(subject_key);
                        }
                    }
                }
            }

            // Process legacy papers similarly
            let sorted_v1_papers = all_papers.clone();
            // Assuming v1 papers don't have attempt field, we rely on submit_time (already sorted by latest)
            for paper in sorted_v1_papers {
                if let Ok(Some(bp)) = blueprint_coll
                    .find_one(doc! { "_id": paper.blueprint_id }, None)
                    .await
                {
                    let rows = build_marks_rows(&paper, &bp);
                    for row in rows {
                        if !seen_subjects.contains(&row.subject) {
                            consolidated_marks_rows.push(row.clone());
                            seen_subjects.insert(row.subject.clone());
                        }
                    }
                }
            }

            // Calculate total_obtained and total_max from consolidated_marks_rows
            for row in &consolidated_marks_rows {
                total_obtained += row.obtained;
                total_max += row.max_marks;
            }

            let is_passed = total_obtained >= (total_max * 0.4);
            let percentage_str = if total_max > 0.0 {
                Some(format!("{:.1}%", (total_obtained / total_max) * 100.0))
            } else {
                None
            };
            (
                Some(if is_passed {
                    "PASS".to_string()
                } else {
                    "FAIL".to_string()
                }),
                Some("Consolidated".to_string()),
                Some(Utc::now().naive_utc().date().to_string()),
                Some(total_obtained),
                Some(total_max),
                percentage_str,
                Some(if is_passed {
                    "PASS".to_string()
                } else {
                    "FAIL".to_string()
                }),
                None,
                Some(all_subjects),
                Some(consolidated_marks_rows),
            )
        } else if let (Some(paper), Some(bp)) = (&exam_paper, &blueprint_opt) {
            let is_passed = paper.total_obtained_marks >= (bp.total_marks * 0.4);
            let percentage_str = if bp.total_marks > 0.0 {
                Some(format!(
                    "{:.1}%",
                    (paper.total_obtained_marks / bp.total_marks) * 100.0
                ))
            } else {
                None
            };
            (
                Some(if is_passed {
                    "PASS".to_string()
                } else {
                    "FAIL".to_string()
                }),
                paper
                    .submit_time
                    .map(|t| t.to_chrono().date_naive().to_string()),
                Some(Utc::now().naive_utc().date().to_string()),
                Some(paper.total_obtained_marks),
                Some(bp.total_marks),
                percentage_str,
                Some(if is_passed {
                    "PASS".to_string()
                } else {
                    "FAIL".to_string()
                }),
                None,
                Some(paper.questions.clone()),
                None,
            )
        } else if matches!(template.template_type, TemplateType::Marksheet) {
            // Fallback for marksheet without exam results
            (
                Some("RESULT AWAITED".to_string()),
                Some("Not Taken".to_string()),
                Some(Utc::now().naive_utc().date().to_string()),
                Some(0.0),
                Some(0.0),
                None,
                Some("RESULT AWAITED".to_string()),
                None,
                None,
                None,
            )
        } else {
            (None, None, None, None, None, None, None, None, None, None)
        };

        let marks_rows = if is_consolidated {
            marks_rows_consolidated
        } else if let (Some(paper), Some(bp)) = (&exam_paper, &blueprint_opt) {
            let r = build_marks_rows(paper, bp);
            if !r.is_empty() {
                Some(r)
            } else {
                user.marks.as_ref().map(|m| build_manual_rows(m))
            }
        } else if let (Some(p2), Some(tpl)) = (&exam_paper_v2, &paper_v2_tpl) {
            let mut rows = Vec::new();
            for (sec_id, obtained) in &p2.section_wise_marks {
                // section_id in V2 paper mapping is "s0", "s1"... or matches section_id in template
                if let Some(sec) = tpl
                    .sections
                    .iter()
                    .find(|s| &s.name == sec_id || format!("{:?}", s.marks) == *sec_id)
                {
                    let max = sec.marks * (sec.count as f64);
                    let min = (max * 0.4).round();
                    let status = if *obtained >= min {
                        "PASS".to_string()
                    } else {
                        "FAIL".to_string()
                    };
                    let percentage = if max > 0.0 {
                        (obtained / max * 100.0).round()
                    } else {
                        0.0
                    };
                    rows.push(MarksRow {
                        subject: sec_id.clone(), // Or fetch subject name
                        obtained: *obtained,
                        max_marks: max,
                        min_marks: min,
                        status,
                        percentage,
                        theory_total: max,
                        theory_obtained: *obtained,
                        practical_total: 0.0,
                        practical_obtained: 0.0,
                        assignment_total: 0.0,
                        assignment_obtained: 0.0,
                    });
                }
            }
            if !rows.is_empty() {
                Some(rows)
            } else {
                user.marks.as_ref().map(|m| build_manual_rows(m))
            }
        } else {
            // For both Certificate and Marksheet templates: try course subjects first, then user.marks
            let mut fallback_marks = Vec::new();
            if let Some(cid) = course_id_opt.or(user.course_id) {
                let mut mapping_cursor = course_subjects_coll
                    .find(doc! { "course_id": cid }, None)
                    .await
                    .ok()
                    .unwrap();
                while let Some(Ok(mapping)) = mapping_cursor.next().await {
                    if let Ok(Some(subj)) = subjects_coll
                        .find_one(doc! { "_id": mapping.subject_id }, None)
                        .await
                    {
                        fallback_marks.push(SubjectMarks {
                            subject: subj.subject_name,
                            marks: 0.0,
                            total: 100.0,
                        });
                    }
                }
            }
            if !fallback_marks.is_empty() {
                Some(build_manual_rows(&fallback_marks))
            } else {
                user.marks.as_ref().map(|m| build_manual_rows(m))
            }
        };

        let ctx = CertContext {
            student_id: sid_oid.clone(),
            student_name: user
                .full_name
                .clone()
                .unwrap_or_else(|| user.username.clone()),
            registration_number: user.username.clone(),
            enrollment_number: Some(enrollment_no.clone()),
            roll_number: user.roll_number.clone(),
            national_id: user.national_id.clone(),
            father_name: user.father_name.clone(),
            mother_name: user.mother_name.clone(),
            dob: user.dob.clone(),
            background_url: cert_doc.as_ref().and_then(|c| c.background_url.clone()).or_else(|| template.background_image.clone()),
            session_from: user
                .session_start_date
                .clone()
                .or_else(|| user.registration_date.clone()),
            session_to: user.session_end_date.clone(),
            course: course_name.clone(),
            study_center: center_doc.as_ref().map(|c| c.name.clone()),
            institute: center_doc.as_ref().map(|c| c.name.clone()),
            course_duration,
            obtained_marks,
            total_marks,
            grade,
            result_status,
            exam_date: exam_date_str,
            result_date,
            issue_date: issue_date_val.clone(),
            serial_number: user.serial_number.clone(),
            verification_url: format!(
                "{}/verify-certificate/{}",
                base_url.trim_end_matches('/'),
                preview_oid.to_hex()
            ),
            photo: user.photo_url.clone(),
            signature: user.signature_url.clone(),
            gender: user.gender.clone(),
            category: user.category.clone(),
            national_id_type: user.national_id_type.clone(),
            address: user.address.clone(),
            city: user.city.clone(),
            state: user.state.clone(),
            pincode: user.pincode.clone(),
            emergency_contact_name: user.emergency_contact_name.clone(),
            emergency_contact_phone: user.emergency_contact_phone.clone(),
            additional_docs: user.additional_docs.clone(),
            subjects,
            center_signature: center_doc
                .as_ref()
                .and_then(|c| c.key_documents.as_ref())
                .and_then(|d| d.owner_signature_url.clone()),
            center_stamp: center_doc
                .as_ref()
                .and_then(|c| c.key_documents.as_ref())
                .and_then(|d| d.center_stamp_url.clone()),
            admin_signature: template
                .admin_signature
                .clone()
                .or_else(|| admin_assets.as_ref().and_then(|a| a.signature_url.clone())),
            admin_stamp: template
                .admin_stamp
                .clone()
                .or_else(|| admin_assets.as_ref().and_then(|a| a.stamp_url.clone())),
            marks_rows,
            certificate_row_id: Some(preview_oid),
            // New fields
            session: session_name,
            exam_mode,
            admission_mode,
            center_address,
            center_code: center_doc.as_ref().map(|c| c.code.clone()),
            result_percentage,
            overall_status,
            certificate_no: serial.clone(),
        };
        contexts.push(ctx);
    }

    if contexts.is_empty() {
        let detail = format!(
            "skipped: invalid_id={skip_invalid_id}, not_student={skip_not_student}, course_mismatch_marksheet={skip_course_mismatch}, already_have_template_use_reissue={skip_already_issued}, no_db_row_after_insert={skip_no_db_row}"
        );
        return (
            StatusCode::OK,
            Json(GenerateResponse {
                success: false,
                message: format!(
                    "No certificates generated. {detail}. For marksheets, course must match the template. For certificates, use re-issue to replace an existing same-template cert."
                ),
                html: None,
                certificate_ids: Some(vec![]),
                preview: None,
                combined_pdf_url: None,
            }),
        );
    }

    let page_css = page_styles(&template);
    let mut pages_html = String::new();
    for ctx in &contexts {
        pages_html.push_str(&render_page(&template, &fields, ctx, &base_url));
    }
    let combined_html = if !pages_html.is_empty() {
        Some(format!(
            r#"<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>{}</style></head><body>{}</body></html>"#,
            page_css, pages_html
        ))
    } else {
        None
    };

    if let Some(first_ctx) = contexts.first() {
        let bg_raw = first_ctx
            .background_url
            .as_ref()
            .or(template.background_image.as_ref())
            .cloned();
        let bg_local_path = bg_raw
            .as_deref()
            .and_then(resolve_local_asset_path)
            .map(|p| p.to_string_lossy().to_string());
        let bg_size = bg_local_path
            .as_ref()
            .and_then(|p| std::fs::metadata(p).ok())
            .map(|m| m.len());
        let off_page_fields = fields
            .iter()
            .filter(|field| {
                field.x_position < 0.0
                    || field.y_position < 0.0
                    || field.x_position > 100.0
                    || field.y_position > 100.0
                    || field.width <= 0.0
                    || field.height <= 0.0
                    || field.x_position + field.width > 100.0
                    || field.y_position + field.height > 100.0
            })
            .count();
        let white_text_fields = fields
            .iter()
            .filter(|field| {
                let color = field.color.trim().to_ascii_lowercase();
                color == "#fff" || color == "#ffffff" || color == "white"
            })
            .count();
        let css_flags = serde_json::json!({
            "opacity_0": page_css.contains("opacity:0") || page_css.contains("opacity: 0"),
            "visibility_hidden": page_css.contains("visibility:hidden") || page_css.contains("visibility: hidden"),
            "display_none": page_css.contains("display:none") || page_css.contains("display: none"),
            "transform_scale_0": page_css.contains("transform:scale(0)") || page_css.contains("transform: scale(0)"),
            "overflow_hidden": page_css.contains("overflow: hidden"),
            "white_text_fields": white_text_fields,
            "off_page_fields": off_page_fields,
        });
        let first_page_html = format!(
            r#"<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>{}</style></head><body>{}</body></html>"#,
            page_css,
            render_page(&template, &fields, first_ctx, &base_url)
        );
        let unresolved_placeholders = placeholder_regex
            .as_ref()
            .map(|re| re.find_iter(&first_page_html).count())
            .unwrap_or(0);
        let placeholders_replaced = source_placeholder_count.saturating_sub(unresolved_placeholders);
        let generated_html_path = "/var/www/html/scre/generated_certificate.html";
        let _ = std::fs::write(generated_html_path, &first_page_html);
        // #region debug-point B:html-and-background
        debug_report(
            "pre-fix",
            "B",
            "backend/src/handlers/generate_certificates.rs:2370",
            "[DEBUG] Generated certificate HTML, background asset status, and CSS checks captured",
            serde_json::json!({
                "generated_html_path": generated_html_path,
                "html_length": first_page_html.len(),
                "html_blank_like": first_page_html.trim().is_empty(),
                "contains_student_name": first_page_html.contains(&first_ctx.student_name),
                "contains_course": first_page_html.contains(&first_ctx.course),
                "contains_center": first_ctx.study_center.as_ref().map(|value| first_page_html.contains(value)).unwrap_or(false),
                "background_image_path": bg_raw,
                "background_image_resolved_path": bg_local_path,
                "background_exists": bg_size.is_some(),
                "background_size_bytes": bg_size,
                "placeholders_in_source": source_placeholder_count,
                "unresolved_placeholders": unresolved_placeholders,
                "placeholders_replaced": placeholders_replaced,
                "css_flags": css_flags,
            }),
        )
        .await;
        // #endregion
    }

    let preview = if preview_rows.is_empty() {
        None
    } else {
        Some(preview_rows.clone())
    };

    let is_center = role == UserRole::Center;
    let is_scheduled = payload.scheduled_at.is_some();

    if is_center || is_scheduled {
        let sched_msg = payload
            .scheduled_at
            .as_deref()
            .unwrap_or("(unknown time)")
            .to_string();
        return (
            StatusCode::OK,
            Json(GenerateResponse {
                success: true,
                message: if is_center {
                    "Application submitted to Admin for approval".to_string()
                } else {
                    format!("Certificate scheduled for {sched_msg}")
                },
                html: if is_center {
                    None
                } else {
                    combined_html.clone()
                },
                certificate_ids: Some(certificate_ids.clone()),
                preview: preview.clone(),
                combined_pdf_url: None,
            }),
        );
    }

    // Use absolute path for upload directory to avoid CWD issues
    let upload_dir = env::var("UPLOAD_DIR")
        .unwrap_or_else(|_| "/var/www/html/scre/backend/uploads".to_string());
    let upload_dir_pb = PathBuf::from(&upload_dir);
    // Ensure upload directory exists
    if !upload_dir_pb.exists() {
        match std::fs::create_dir_all(&upload_dir_pb) {
            Ok(_) => println!("Created upload directory at {:?}", upload_dir_pb),
            Err(e) => eprintln!("Failed to create upload directory: {}", e),
        }
    }
    let certs_dir = upload_dir_pb.join("certificates");
    if !certs_dir.exists() {
        match std::fs::create_dir_all(&certs_dir) {
            Ok(_) => println!("Created certificates directory at {:?}", certs_dir),
            Err(e) => eprintln!("Failed to create certificates directory: {}", e),
        }
    }

    let mut pdf_handles = Vec::new();
    for (index, ctx) in contexts.iter().enumerate() {
        // Use the per-row unique `certificate_no` (stored exactly as DB certificate_no) for the PDF
        // filename. Previously this used `ctx.serial_number` which was set from `user.serial_number`,
        // a shared value reused for ALL certificate rows belonging to the same center/serial — so
        // every generated PDF would overwrite the same file, leaving only the last winner's file on
        // disk. The certificate download handler explicitly resolves against both the stored
        // `file_path` and `certificates/{certificate_no}.pdf`, so naming PDFs after `certificate_no`
        // keeps the two in 1-to-1 alignment and avoids the shared-file overwrite collision that
        // caused 422 PDF_MISSING responses for every non-winning row.
        let cert_no = ctx.certificate_no.trim();
        if !cert_no.is_empty() {
            let page = render_page(&template, &fields, ctx, &base_url);
            let single_page_html = format!(
                r#"<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>{}</style></head><body>{}</body></html>"#,
                page_css, page
            );
            if index == 0 {
                let _ = std::fs::write("/var/www/html/scre/generated_certificate.html", &single_page_html);
                let unresolved_placeholders = placeholder_regex
                    .as_ref()
                    .map(|re| re.find_iter(&single_page_html).count())
                    .unwrap_or(0);
                let placeholders_replaced = source_placeholder_count.saturating_sub(unresolved_placeholders);
                // #region debug-point C:pdf-input-html
                debug_report(
                    "pre-fix",
                    "C",
                    "backend/src/handlers/generate_certificates.rs:2445",
                    "[DEBUG] Exact HTML passed into PdfGenerator captured for first certificate page",
                    serde_json::json!({
                        "generated_html_path": "/var/www/html/scre/generated_certificate.html",
                        "html_length": single_page_html.len(),
                        "contains_student_name": single_page_html.contains(&ctx.student_name),
                        "contains_course": single_page_html.contains(&ctx.course),
                        "contains_center": ctx.study_center.as_ref().map(|value| single_page_html.contains(value)).unwrap_or(false),
                        "unresolved_placeholders": unresolved_placeholders,
                        "placeholders_replaced": placeholders_replaced,
                        "certificate_no": cert_no,
                    }),
                )
                .await;
                // #endregion
            }
            let file_name = format!("{}.pdf", cert_no);
            let rel_path = format!("certificates/{}", file_name);
            let full_path = upload_dir_pb.join(&rel_path);
            let file_path_for_db = rel_path.clone();

            eprintln!("generate_certificates: preparing to generate PDF for cert_no={}, full_path={:?}",
                cert_no, full_path);

            let db_clone = db.clone();
            let student_id = ctx.student_id.clone();
            let course = ctx.course.clone();
            let certificate_no = cert_no.to_string();
            let cert_row_id = ctx.certificate_row_id;
            let full_path_for_closure = full_path.clone();
            let full_path_for_log = full_path.clone();

            pdf_handles.push(tokio::spawn(async move {
                let gen_res = tokio::task::spawn_blocking(move || {
                    PdfGenerator::html_to_pdf(&single_page_html, full_path_for_closure).map_err(|e| e.to_string())
                })
                .await;

                match gen_res {
                    Ok(Ok(())) => {
                        eprintln!("generate_certificates: PDF generated successfully at {:?}", full_path_for_log);
                        let certs_coll = db_clone.collection::<Certificate>("certificates");
                        let filter = if let Some(oid) = cert_row_id {
                            doc! { "_id": oid }
                        } else {
                            doc! {
                                "student_id": &student_id,
                                "course": &course,
                                "certificate_no": &certificate_no
                            }
                        };
                        eprintln!("generate_certificates: updating DB with file_path={:?}", file_path_for_db);
                        match certs_coll
                            .update_one(
                                filter,
                                doc! { "$set": { "file_path": file_path_for_db } },
                                None,
                            )
                            .await
                        {
                            Ok(update_result) => {
                                eprintln!("generate_certificates: DB update result: matched={}, modified={}",
                                    update_result.matched_count, update_result.modified_count);
                            }
                            Err(e) => eprintln!("certificate file_path update failed for {}: {}", certificate_no, e),
                        }
                    }
                    Ok(Err(e)) => {
                        eprintln!("Failed to generate certificate PDF for {}: {}", certificate_no, e);
                    }
                    Err(e) => {
                        eprintln!("PDF generation task join error for {}: {}", certificate_no, e);
                    }
                }
            }));
        }
    }
    for h in pdf_handles {
        let _ = h.await;
    }

    // One multi-page PDF for bulk (same layout as preview): one Chromium print of the full HTML.
    let mut combined_pdf_url: Option<String> = None;
    if contexts.len() > 1 {
        if let Some(ref full_html) = combined_html {
            let ts = chrono::Utc::now().timestamp_millis();
            let rel = format!("certificates/_batch_combined_{}.pdf", ts);
            let full_path = upload_dir_pb.join(&rel);
            let html_owned = full_html.clone();
            match tokio::task::spawn_blocking(move || {
                PdfGenerator::html_to_pdf(&html_owned, full_path).map_err(|e| e.to_string())
            })
            .await
            {
                Ok(Ok(())) => {
                    combined_pdf_url = Some(format!("/uploads/{}", rel.replace('\\', "/")));
                }
                Ok(Err(e)) => eprintln!("combined batch PDF failed: {}", e),
                Err(e) => eprintln!("combined batch PDF task join: {}", e),
            }
        }
    }

    (
        StatusCode::OK,
        Json(GenerateResponse {
            success: true,
            message: format!("Generated {} certificate(s)", contexts.len()),
            html: combined_html,
            certificate_ids: Some(certificate_ids),
            preview,
            combined_pdf_url,
        }),
    )
}

fn build_marks_rows(paper: &Marksheet, bp: &ExamBlueprint) -> Vec<MarksRow> {
    bp.sections
        .iter()
        .map(|sec| {
            let obtained: f64 = paper
                .section_wise_marks
                .get(&sec.section_id)
                .copied()
                .unwrap_or_else(|| {
                    paper
                        .questions
                        .iter()
                        .filter(|q| q.section_id == sec.section_id)
                        .map(|q| q.obtained_marks)
                        .sum()
                });
            let max_marks = sec.total_section_marks;
            let min_marks = ((max_marks * 0.4) * 100.0).round() / 100.0;
            let status = if max_marks <= f64::EPSILON {
                "—".to_string()
            } else if obtained + f64::EPSILON >= min_marks {
                "PASS".to_string()
            } else {
                "FAIL".to_string()
            };
            let percentage = if max_marks > f64::EPSILON {
                ((obtained / max_marks) * 100.0 * 100.0).round() / 100.0
            } else {
                0.0
            };
            MarksRow {
                subject: sec.name.clone(),
                max_marks,
                min_marks,
                obtained,
                status,
                percentage,
                theory_total: max_marks,
                theory_obtained: obtained,
                practical_total: 0.0,
                practical_obtained: 0.0,
                assignment_total: 0.0,
                assignment_obtained: 0.0,
            }
        })
        .collect()
}

fn build_manual_rows(marks: &[SubjectMarks]) -> Vec<MarksRow> {
    marks
        .iter()
        .map(|sm| {
            let max_marks = sm.total;
            let obtained = sm.marks;
            let min_marks = ((max_marks * 0.4) * 100.0).round() / 100.0;
            let status = if max_marks <= f64::EPSILON {
                "—".to_string()
            } else if obtained + f64::EPSILON >= min_marks {
                "PASS".to_string()
            } else {
                "FAIL".to_string()
            };
            let percentage = if max_marks > f64::EPSILON {
                ((obtained / max_marks) * 100.0 * 100.0).round() / 100.0
            } else {
                0.0
            };
            MarksRow {
                subject: sm.subject.clone(),
                max_marks,
                min_marks,
                obtained,
                status,
                percentage,
                theory_total: max_marks,
                theory_obtained: obtained,
                practical_total: 0.0,
                practical_obtained: 0.0,
                assignment_total: 0.0,
                assignment_obtained: 0.0,
            }
        })
        .collect()
}

#[allow(dead_code)]
fn marks_table_column_title(key: &str) -> &'static str {
    match key {
        "subject" => "Subject / Section",
        "max_marks" => "Max marks",
        "min_marks" => "Min / Pass",
        "obtained" => "Obtained",
        "percentage" => "%",
        "status" => "Status",
        _ => "Column",
    }
}

#[allow(dead_code)]
fn marks_table_th_align(key: &str) -> &'static str {
    match key {
        "obtained" | "max_marks" | "min_marks" | "percentage" => "right",
        "status" => "center",
        _ => "left",
    }
}

#[allow(dead_code)]
fn render_marks_rows_table(field: &TemplateField, rows: &[MarksRow]) -> String {
    let default: Vec<String> = vec![
        "subject".into(),
        "max_marks".into(),
        "min_marks".into(),
        "obtained".into(),
        "percentage".into(),
        "status".into(),
    ];
    let cols: Vec<String> = field
        .table_columns
        .as_ref()
        .filter(|c| !c.is_empty())
        .cloned()
        .unwrap_or(default);

    let mut html = String::from(
        r#"<table style="width:100%;border-collapse:collapse;font-size:inherit;border:1px solid #333;">"#,
    );
    html.push_str(r#"<thead><tr style="background-color:#f2f2f2;">"#);
    for c in &cols {
        let a = marks_table_th_align(c);
        let t = esc_html(marks_table_column_title(c));
        html.push_str(&format!(
            r#"<th style="text-align:{};padding:6px 4px;border:1px solid #333;">{}</th>"#,
            a, t
        ));
    }
    html.push_str("</tr></thead><tbody>");

    for r in rows {
        html.push_str("<tr>");
        for c in &cols {
            let a = marks_table_th_align(c);
            let cell = match c.as_str() {
                "subject" => esc_html(&r.subject),
                "max_marks" => format!("{:.2}", r.max_marks),
                "min_marks" => format!("{:.2}", r.min_marks),
                "obtained" => format!("{:.2}", r.obtained),
                "percentage" => format!("{:.1}%", r.percentage),
                "status" => esc_html(&r.status),
                _ => esc_html(&r.subject),
            };
            html.push_str(&format!(
                r#"<td style="text-align:{};padding:4px;border:1px solid #333;">{}</td>"#,
                a, cell
            ));
        }
        html.push_str("</tr>");
    }

    let sum_max: f64 = rows.iter().map(|x| x.max_marks).sum();
    let sum_min: f64 = rows.iter().map(|x| x.min_marks).sum();
    let sum_obt: f64 = rows.iter().map(|x| x.obtained).sum();
    let pct = if sum_max > f64::EPSILON {
        ((sum_obt / sum_max) * 100.0 * 100.0).round() / 100.0
    } else {
        0.0
    };

    html.push_str(r#"<tr style="background-color:#f2f2f2;font-weight:bold;">"#);
    for c in &cols {
        let a = marks_table_th_align(c);
        let cell = match c.as_str() {
            "subject" => esc_html("TOTAL / OVERALL"),
            "max_marks" => format!("{:.2}", sum_max),
            "min_marks" => format!("{:.2}", sum_min),
            "obtained" => format!("{:.2}", sum_obt),
            "percentage" => format!("{:.1}%", pct),
            "status" => esc_html("—"),
            _ => String::new(),
        };
        html.push_str(&format!(
            r#"<td style="text-align:{};padding:4px;border:1px solid #333;">{}</td>"#,
            a, cell
        ));
    }
    html.push_str("</tr></tbody></table>");
    html
}

fn format_marks_table_html(field: &TemplateField, ctx: &CertContext) -> String {
    println!("format_marks_table_html called! field_name={}, field_type={}", field.field_name, field.field_type);
    if let Some(ref rows) = ctx.marks_rows {
        println!("  ctx.marks_rows is Some, {} rows", rows.len());
        if rows.is_empty() {
            return format!(
                r#"<div style="font-style: italic; color: #999; padding: 10px;">{}</div>"#,
                MISSING_FIELD
            );
        }

        let shared_rows: Vec<ResultTableRow> = rows
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
        return render_result_table_html(&shared_rows);
    }

    if let Some(ref subjects) = ctx.subjects {
        let mut table =
            r#"<table style="width:100%; border-collapse: collapse; font-size: inherit;">
                    <thead>
                        <tr style="border-bottom: 1px solid #ccc;">
                            <th style="text-align:left; padding:4px;">Section/Subject</th>
                            <th style="text-align:center; padding:4px;">Status</th>
                            <th style="text-align:right; padding:4px;">Marks</th>
                        </tr>
                    </thead>
                    <tbody>"#
                .to_string();

        let mut section_totals: std::collections::HashMap<String, (f64, String)> =
            std::collections::HashMap::new();
        for s in subjects {
            let entry = section_totals
                .entry(s.section_id.clone())
                .or_insert((0.0, s.evaluation_status.clone()));
            entry.0 += s.obtained_marks;
        }

        for (name, (marks, status)) in section_totals {
            let name_e = esc_html(&name);
            let st_e = esc_html(&status);
            table.push_str(&format!(
                r#"<tr style="border-bottom: 1px solid #eee;">
                            <td style="padding:4px;">{}</td>
                            <td style="text-align:center; padding:4px; font-size:0.8em;">{}</td>
                            <td style="text-align:right; padding:4px; font-weight:bold;">{:.1}</td>
                        </tr>"#,
                name_e, st_e, marks
            ));
        }
        table.push_str("</tbody></table>");
        return table;
    }

    MISSING_FIELD.to_string()
}

fn format_summary_box_html(ctx: &CertContext) -> String {
    let exam_date = opt_str_missing(&ctx.exam_date);
    let result_date = or_not_found(ctx.issue_date.clone());
    let issue_date = or_not_found(ctx.issue_date.clone());

    let total_obtained = ctx.obtained_marks.unwrap_or(0.0);
    let total_max = ctx.total_marks.unwrap_or(0.0);
    let percentage = if total_max > 0.0 {
        (total_obtained / total_max * 100.0).round()
    } else {
        0.0
    };

    let grade = ctx.grade.clone().unwrap_or_else(|| {
        {
            if percentage >= 90.0 {
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
            }
        }
        .to_string()
    });

    let status = ctx
        .result_status
        .clone()
        .unwrap_or_else(|| { if percentage >= 40.0 { "PASS" } else { "FAIL" } }.to_string());

    format!(
        r#"<table style="width: 100%; border-collapse: collapse; font-family: inherit; font-size: 0.8em; border: 1px solid #3b82f6;">
            <thead>
                <tr style="background-color: #3b82f6; color: white; font-weight: bold; text-transform: uppercase;">
                    <th colspan="2" style="padding: 4px; text-align: center;">Summary</th>
                </tr>
            </thead>
            <tbody>
                <tr style="border-bottom: 1px solid #3b82f6;">
                    <td style="padding: 4px; font-weight: bold; background-color: #f8fafc; width: 40%;">Exam Date</td>
                    <td style="padding: 4px; text-align: center;">{}</td>
                </tr>
                <tr style="border-bottom: 1px solid #3b82f6;">
                    <td style="padding: 4px; font-weight: bold; background-color: #f8fafc;">Result Date</td>
                    <td style="padding: 4px; text-align: center;">{}</td>
                </tr>
                <tr style="border-bottom: 1px solid #3b82f6;">
                    <td style="padding: 4px; font-weight: bold; background-color: #f8fafc;">Date of Issue</td>
                    <td style="padding: 4px; text-align: center;">{}</td>
                </tr>
                <tr style="border-bottom: 1px solid #3b82f6;">
                    <td style="padding: 4px; font-weight: bold; background-color: #f8fafc;">Percentage</td>
                    <td style="padding: 4px; text-align: center; font-weight: bold;">{:.0}%</td>
                </tr>
                <tr style="border-bottom: 1px solid #3b82f6;">
                    <td style="padding: 4px; font-weight: bold; background-color: #f8fafc;">Grade</td>
                    <td style="padding: 4px; text-align: center; font-weight: bold;">{}</td>
                </tr>
                <tr>
                    <td style="padding: 4px; font-weight: bold; background-color: #f8fafc;">Overall Status</td>
                    <td style="padding: 4px; text-align: center; font-weight: bold;">{}</td>
                </tr>
            </tbody>
        </table>"#,
        exam_date, result_date, issue_date, percentage, grade, status
    )
}

/// Make `/uploads/...` and relative paths load in headless Chrome (needs absolute URL).
fn absolutize_asset_url(base_url: &str, raw: &str) -> String {
    let t = raw.trim();
    if t.is_empty() {
        return String::new();
    }
    if t.starts_with("http://") || t.starts_with("https://") || t.starts_with("data:") {
        return t.to_string();
    }
    let base = base_url.trim_end_matches('/');
    if t.starts_with('/') {
        format!("{base}{t}")
    } else {
        format!("{base}/{t}")
    }
}

fn flex_justify_for_align(text_align: &str) -> &'static str {
    match text_align.to_lowercase().as_str() {
        "center" => "center",
        "right" => "flex-end",
        _ => "flex-start",
    }
}

/// `font-family` value safe inside a double-quoted HTML `style=""` attribute.
/// Using JSON quotes (`"Arial"`) terminates the attribute early and drops `overflow`, `display`, etc.
fn css_font_family_for_style_attr(raw: &str) -> String {
    let t = raw.trim();
    if t.is_empty() {
        return "Arial, sans-serif".to_string();
    }
    let safe = t.replace('\\', "\\\\").replace('\'', "\\'");
    if t.chars().any(char::is_whitespace) || t.contains(',') {
        format!("'{safe}', sans-serif")
    } else {
        format!("{safe}, sans-serif")
    }
}

/// Strip characters that break a double-quoted HTML `style=""` value.
fn css_color_for_style_attr(raw: &str) -> String {
    let t = raw.trim().trim_matches(|c| c == '"' || c == '\'');
    if t.is_empty() || t.contains('"') || t.contains(';') || t.contains('\n') || t.contains('\r') {
        return "#000000".to_string();
    }
    t.to_string()
}

/// Page size in mm (must match `page_styles` / template editor canvas aspect).
fn page_dimensions_mm(template: &Template) -> (f64, f64) {
    match (&template.page_size, &template.orientation) {
        (PageSize::A4, PageOrientation::Portrait) => (210.0, 297.0),
        (PageSize::A4, PageOrientation::Landscape) => (297.0, 210.0),
        (PageSize::A3, PageOrientation::Portrait) => (297.0, 420.0),
        (PageSize::A3, PageOrientation::Landscape) => (420.0, 297.0),
        (PageSize::Letter, PageOrientation::Portrait) => (215.9, 279.4),
        (PageSize::Letter, PageOrientation::Landscape) => (279.4, 215.9),
    }
}

/// Template editor (`TemplateEditorPage`) stores x/y/width/height as **0–100%** of the page, not mm.
fn pct_of_page_to_mm(pct: f64, page_dim_mm: f64) -> f64 {
    let p = if pct.is_finite() {
        pct.clamp(0.0, 100.0)
    } else {
        0.0
    };
    (p / 100.0) * page_dim_mm
}

fn field_placement_style(field: &TemplateField, template: &Template) -> String {
    let (pw, ph) = page_dimensions_mm(template);
    let left = pct_of_page_to_mm(field.x_position, pw);
    let top = pct_of_page_to_mm(field.y_position, ph);
    let width = pct_of_page_to_mm(field.width, pw).max(1.0);
    let height = pct_of_page_to_mm(field.height, ph).max(1.0);
    let align_items = match field.field_type.as_str() {
        "image" | "photo" | "qr" | "qr_code" => "center",
        // Text and tables: top-align so multi-line content fills downward (avoids stacked-looking overlap).
        _ => "flex-start",
    };

    // Log element details for debugging
    println!(
        "  Field type: {}, width: {:.3}mm, text value placeholder: {}",
        field.field_type, width, field.field_name
    );

    // For text fields: don't constrain width, no overflow hidden
    // For image/qr fields: keep the original constraints
    match field.field_type.as_str() {
        "image" | "photo" | "qr" | "qr_code" | "center_sign" | "center_stamp"
        | "center_signature" | "stamp" | "signature" | "marks_table" | "table"
        | "result_table" => {
            format!(
                "position: absolute; left: {:.3}mm; top: {:.3}mm; width: {:.3}mm; height: {:.3}mm; \
                 font-size: {:.1}pt; font-family: {}; color: {}; text-align: {}; \
                 display: flex; align-items: {}; justify-content: {}; box-sizing: border-box; \
                 padding: 0.5mm; overflow: hidden; white-space: normal; z-index: 10;",
                left,
                top,
                width,
                height,
                field.font_size,
                css_font_family_for_style_attr(&field.font_family),
                css_color_for_style_attr(&field.color),
                field.text_align,
                align_items,
                flex_justify_for_align(&field.text_align),
            )
        }
        _ => {
            // Text and other fields: no width/overflow constraints
            format!(
                "position: absolute; left: {:.3}mm; top: {:.3}mm; height: {:.3}mm; \
                 font-size: {:.1}pt; font-family: {}; color: {}; text-align: {}; \
                 display: flex; align-items: {}; justify-content: {}; box-sizing: border-box; \
                 padding: 0.5mm; white-space: nowrap; z-index: 10;",
                left,
                top,
                height,
                field.font_size,
                css_font_family_for_style_attr(&field.font_family),
                css_color_for_style_attr(&field.color),
                field.text_align,
                align_items,
                flex_justify_for_align(&field.text_align),
            )
        }
    }
}

fn render_modern_marksheet(ctx: &CertContext, base_url: &str, background_url: Option<&str>) -> String {
    println!("QR field detected (modern marksheet)");
    println!(
        "QR verification URL (modern marksheet): {}",
        ctx.verification_url
    );
    println!("Render Modern Marksheet: background_url = {:?}", background_url);
    let background_b64 = background_url
        .map(|bg| load_asset_base64(bg))
        .unwrap_or_else(|| load_asset_base64("/images/background.jpeg"));
    println!("Render Modern Marksheet: background_b64 = {:?}", if background_b64.len() > 100 { &background_b64[0..100] } else { &background_b64 });
    let logo_url = absolutize_asset_url(base_url, "/images/logo.jpeg");
    let iso_url = absolutize_asset_url(base_url, "/images/iso.webp");
    let student_photo = ctx
        .photo
        .as_ref()
        .map(|p| absolutize_asset_url(base_url, p))
        .unwrap_or_else(|| absolutize_asset_url(base_url, "/images/default-avatar.png"));
    let qr_text = format!(
        "STUDENT NAME: {}\nFATHER NAME: {}\nDATE OF BIRTH: {}\nENROLLMENT NUMBER: {}\nSERIAL NUMBER: {}\nREGISTRATION NUMBER: {}\nCOURSE: {}",
        ctx.student_name,
        ctx.father_name.clone().unwrap_or_else(|| "-".to_string()),
        ctx.dob.clone().unwrap_or_else(|| "-".to_string()),
        ctx.enrollment_number.clone().unwrap_or_else(|| "-".to_string()),
        ctx.serial_number.clone().unwrap_or_else(|| "-".to_string()),
        ctx.registration_number,
        ctx.course
    );
    let qr_b64 = qr_to_base64(&qr_text);
    println!("QR image generated (modern marksheet)");

    let marks_table_html = ctx
        .marks_rows
        .as_ref()
        .map(|rows| {
            let shared_rows: Vec<ResultTableRow> = rows
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
            render_result_table_html(&shared_rows)
        })
        .unwrap_or_else(|| render_result_table_html(&[]));

    let (grand_total_max, grand_total_obtained) = if let Some(rows) = &ctx.marks_rows {
        (
            rows.iter().map(|row| row.max_marks).sum(),
            rows.iter().map(|row| row.obtained).sum(),
        )
    } else {
        (0.0, 0.0)
    };
    let percentage = if grand_total_max > 0.0 {
        (grand_total_obtained / grand_total_max * 100.0).round()
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

    format!(
        r#"<div class="page marksheet-modern" style="background-image: url('{}');">
            <div class="marksheet-container">
            <div class="marksheet-watermark">SIR CHHOTU RAM EDUCATION PVT LTD</div>
                <!-- Header -->
                <div class="header-top">
                    <span>National ID: {}</span>
                    <span>Serial No: {}</span>
                    <span>Enrollment No: {}</span>
                </div>

                <div class="brand-section">
                    <img src="{}" class="logo" />
                    <div class="brand-text">
                        <h1>SIR CHHOTU RAM EDUCATION PVT LTD</h1>
                        <p class="iso-text">(AN ISO 9001-2015 CERTIFIED ORGANIZATION)</p>
                        <p class="reg-text">Registered Under The Company Act 2013 By The Ministry Of Corporate Affairs, Ministry of Micro, Small & Medium Enterprises</p>
                        <h2 class="govt-text">GOVERNMENT OF INDIA</h2>
                    </div>
                    <img src="{}" class="iso-logo" />
                </div>

                <!-- Student Details -->
                <div class="section-title">STUDENT DETAILS</div>
                <div class="details-grid">
                    <div class="details-col">
                        <div class="detail-item"><label>विद्यार्थी का नाम<br/>Student Name:</label> <span>{}</span></div>
                        <div class="detail-item"><label>माँ का नाम<br/>Mother's Name:</label> <span>{}</span></div>
                        <div class="detail-item"><label>पैटर्न<br/>Pattern:</label> <span>{}</span></div>
                    </div>
                    <div class="details-col">
                        <div class="detail-item"><label>पिता का नाम<br/>Father's Name:</label> <span>{}</span></div>
                        <div class="detail-item"><label>जन्म तिथि<br/>Date of Birth:</label> <span>{}</span></div>
                        <div class="detail-item"><label>लिंग<br/>Gender:</label> <span>{}</span></div>
                    </div>
                    <div class="photo-box">
                        <img src="{}" />
                    </div>
                </div>

                <!-- Course Details -->
                <div class="section-title">COURSE DETAILS</div>
                <div class="course-grid">
                    <div class="detail-item"><label>प्रवेश मोड<br/>Admission Mode:</label> <span>Regular</span></div>
                    <div class="detail-item"><label>सत्र<br/>Session:</label> <span>{} - {}</span></div>
                    <div class="detail-item"><label>कोर्स का नाम<br/>Course Name:</label> <span>{}</span></div>
                    <div class="detail-item"><label>अवधि<br/>Duration:</label> <span>{}</span></div>
                    <div class="detail-item"><label>ASC नाम<br/>ASC Name:</label> <span>{}</span></div>
                    <div class="detail-item"><label>ASC कोड<br/>ASC Code:</label> <span>{}</span></div>
                    <div class="detail-item" style="grid-column: span 2;"><label>ASC पता<br/>ASC Address:</label> <span>{}</span></div>
                </div>

                <!-- Marks Table -->
                {}

                <!-- Footer Section -->
                <div class="footer-row">
                    <div class="summary-box">
                        <div class="summary-header">SUMMARY</div>
                        <div class="summary-content">
                            <div class="summary-item"><span>Exam Date</span> <span>{}</span></div>
                            <div class="summary-item"><span>Result Date</span> <span>{}</span></div>
                            <div class="summary-item"><span>Date of Issue</span> <span>{}</span></div>
                            <div class="summary-item"><span>Percentage</span> <span>{:.0}%</span></div>
                            <div class="summary-item"><span>Grade</span> <span>{}</span></div>
                            <div class="summary-item"><span>Overall Status</span> <span>{}</span></div>
                        </div>
                    </div>
                    <div class="qr-signature-col">
                        <div class="qr-container">
                            <img src="{}" class="qr-img" />
                        </div>
                        <div class="signature-container">
                            <div class="sig-line"></div>
                            <p>Authorize Signature</p>
                        </div>
                    </div>
                </div>

                <div class="legal-disclaimer">
                    This Certificate/Diploma is issued by PACE FOUNDATION. Result may be verified on www.pacefoundation.com
                </div>
            </div>
        </div>"#,
        background_b64,
        ctx.national_id.as_deref().unwrap_or("N/A"),
        ctx.serial_number.as_deref().unwrap_or("N/A"),
        ctx.enrollment_number.as_deref().unwrap_or("N/A"),
        logo_url,
        iso_url,
        ctx.student_name.to_uppercase(),
        ctx.mother_name.as_deref().unwrap_or("N/A").to_uppercase(),
        "SEMESTER",
        ctx.father_name.as_deref().unwrap_or("N/A").to_uppercase(),
        ctx.dob.as_deref().unwrap_or("N/A"),
        ctx.gender.as_deref().unwrap_or("N/A").to_uppercase(),
        student_photo,
        ctx.session_from.as_deref().unwrap_or("N/A"),
        ctx.session_to.as_deref().unwrap_or("N/A"),
        ctx.course.to_uppercase(),
        ctx.course_duration.as_deref().unwrap_or("N/A"),
        ctx.study_center.as_deref().unwrap_or("N/A").to_uppercase(),
        ctx.roll_number.as_deref().unwrap_or("N/A"),
        ctx.address.as_deref().unwrap_or("N/A").to_uppercase(),
        marks_table_html,
        ctx.exam_date.as_deref().unwrap_or("N/A"),
        ctx.issue_date,
        ctx.issue_date,
        percentage,
        grade,
        overall_status,
        qr_b64
    )
}

pub fn page_styles(_template: &Template) -> String {
    format!(
        r#"
        @page {{ 
            size: 210mm 297mm; 
            margin: 0mm; 
            padding: 0mm; 
            page-break-after: never;
            page-break-before: never;
        }}
        html, body {{ 
            margin: 0 !important; 
            padding: 0 !important; 
            background-color: white; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
            height: 297mm !important;
            width: 210mm !important;
            max-height: 297mm !important;
            max-width: 210mm !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
        }}
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        
        .page {{ 
            width: 210mm !important; 
            height: 297mm !important; 
            max-width: 210mm !important;
            max-height: 297mm !important;
            position: relative; 
            overflow: hidden !important; 
            background-color: white; 
            margin: 0 !important; 
            padding: 0 !important; 
            display: block !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
            break-inside: avoid !important;
            break-before: avoid !important;
            break-after: avoid !important;
        }}
        
        /* Marksheet modern styles with background */
        .marksheet-modern {{
            width: 210mm !important;
            height: 297mm !important;
            max-width: 210mm !important;
            max-height: 297mm !important;
            position: relative !important;
            background-image: url('/images/background.jpeg');
            background-size: 100% 100%;
            background-repeat: no-repeat;
            background-position: center;
            overflow: hidden !important;
        }}
        
        .marksheet-watermark {{
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            font-size: 40pt;
            font-weight: 900;
            color: rgba(0, 0, 0, 0.05);
            text-transform: uppercase;
            text-align: center;
            pointer-events: none;
            z-index: 1;
            white-space: nowrap;
        }}
        
        .marksheet-container {{
            width: 100%;
            height: 100%;
            padding: 5mm 8mm;
            font-family: 'Times New Roman', Times, serif;
            color: #000;
            position: relative;
            z-index: 2;
        }}
        
        .header-top {{
            display: flex;
            justify-content: space-between;
            font-size: 9pt;
            font-weight: bold;
            margin-bottom: 3mm;
        }}
        
        .brand-section {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 3mm;
        }}
        
        .logo, .iso-logo {{
            width: 28mm;
            height: 28mm;
            object-fit: contain;
        }}
        
        .brand-text {{
            flex: 1;
            text-align: center;
            padding: 0 8mm;
        }}
        
        .brand-text h1 {{
            font-size: 14pt;
            font-weight: 900;
            text-transform: uppercase;
            margin-bottom: 1mm;
        }}
        
        .iso-text {{
            font-size: 8pt;
            font-weight: bold;
            margin-bottom: 0.5mm;
        }}
        
        .reg-text {{
            font-size: 6pt;
            font-weight: 500;
            line-height: 1.2;
            margin-bottom: 1mm;
        }}
        
        .govt-text {{
            font-size: 12pt;
            font-weight: 900;
            text-transform: uppercase;
            text-decoration: underline;
        }}
        
        .section-title {{
            background-color: #003366;
            color: white;
            text-align: center;
            padding: 2mm 0;
            font-size: 10pt;
            font-weight: 900;
            text-transform: uppercase;
            margin: 2mm 0;
        }}
        
        .details-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr 38mm;
            gap: 2mm;
        }}
        
        .details-col {{
            display: flex;
            flex-direction: column;
            gap: 1.5mm;
        }}
        
        .detail-item {{
            display: flex;
            gap: 1.5mm;
            font-size: 8.5pt;
        }}
        
        .detail-item label {{
            font-weight: bold;
            min-width: 42mm;
        }}
        
        .detail-item span {{
            font-weight: 600;
            text-transform: uppercase;
        }}
        
        .photo-box {{
            border: 2px solid #000;
            padding: 0.5mm;
            display: flex;
            align-items: center;
            justify-content: center;
        }}
        
        .photo-box img {{
            width: 100%;
            height: 100%;
            object-fit: cover;
        }}
        
        .course-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1.5mm;
        }}
        
        .marks-table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 8pt;
            margin: 2mm 0;
        }}
        
        .marks-table th, .marks-table td {{
            border: 1px solid #000;
            padding: 2mm 1mm;
            text-align: center;
            font-weight: bold;
        }}
        
        .marks-table thead tr {{
            background-color: #003366;
            color: white;
        }}
        
        .grand-total-row {{
            background-color: #003366;
            color: white;
            font-weight: 900;
            text-transform: uppercase;
        }}
        
        .footer-row {{
            display: flex;
            justify-content: space-between;
            gap: 3mm;
            margin-top: 3mm;
        }}
        
        .summary-box {{
            flex: 1;
            border: 1px solid #000;
        }}
        
        .summary-header {{
            background-color: #003366;
            color: white;
            text-align: center;
            padding: 2mm 0;
            font-size: 9pt;
            font-weight: 900;
            text-transform: uppercase;
        }}
        
        .summary-content {{
            padding: 1.5mm;
            display: flex;
            flex-direction: column;
            gap: 1.5mm;
        }}
        
        .summary-item {{
            display: flex;
            justify-content: space-between;
            font-size: 8.5pt;
            font-weight: bold;
        }}
        
        .qr-signature-col {{
            flex: 1;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }}
        
        .qr-container {{
            width: 35mm;
            height: 35mm;
        }}
        
        .qr-img {{
            width: 100%;
            height: 100%;
            object-fit: contain;
        }}
        
        .signature-container {{
            text-align: center;
        }}
        
        .sig-line {{
            border-top: 2px solid #000;
            width: 45mm;
            margin-bottom: 1.5mm;
        }}
        
        .signature-container p {{
            font-size: 8pt;
            font-weight: bold;
            text-transform: uppercase;
        }}
        
        .legal-disclaimer {{
            margin-top: 2mm;
            font-size: 6pt;
            text-align: center;
            color: #333;
        }}
        
        @media print {{
            html, body {{ background-color: white !important; }}
            .page {{ 
                width: 210mm !important; 
                height: 297mm !important; 
                margin: 0 !important; 
                padding: 0 !important;
                border: none !important;
                box-shadow: none !important;
                page-break-after: avoid !important;
                page-break-before: avoid !important;
                break-inside: avoid !important;
            }}
            .page:last-child {{ page-break-after: avoid !important; }}
        }}
        "#
    )
}

fn get_field_value(field: &TemplateField, ctx: &CertContext) -> String {
    // Debug logs
    println!("get_field_value called for field_name={}, field_type={}", field.field_name, field.field_type);
    println!("  Element: {}", field.field_name);
    println!("  Resolved value will be matched against field_name");
    println!(
        "  CertContext has: student_id={:?}, student_name={:?}, father_name={:?}, mother_name={:?}, course={:?}, course_duration={:?}, study_center={:?}, institute={:?}",
        ctx.student_id,
        ctx.student_name,
        ctx.father_name,
        ctx.mother_name,
        ctx.course,
        ctx.course_duration,
        ctx.study_center,
        ctx.institute
    );
    println!("  ctx.marks_rows.is_some() = {:?}, ctx.subjects.is_some() = {:?}", ctx.marks_rows.is_some(), ctx.subjects.is_some());

    let raw_val = match field.field_name.as_str() {
        "student_name" => or_not_found(ctx.student_name.clone()),
        "registration_number" => or_not_found(ctx.registration_number.clone()),
        "enrollment_number" | "student_enrollment" => opt_str_missing(&ctx.enrollment_number),
        "roll_number" => opt_str_missing(&ctx.roll_number),
        "national_id" => opt_str_missing(&ctx.national_id),
        "father_name" | "student_father" => opt_str_missing(&ctx.father_name),
        "mother_name" | "student_mother" => opt_str_missing(&ctx.mother_name),
        "dob" => opt_str_missing(&ctx.dob),
        "national_id_no" => opt_str_missing(&ctx.national_id),
        "pattern" => or_not_found("Semester".to_string()),
        "session" => {
            if let Some(s) = &ctx.session {
                or_not_found(s.clone())
            } else {
                format!(
                    "{} - {}",
                    opt_str_missing(&ctx.session_from),
                    opt_str_missing(&ctx.session_to)
                )
            }
        }
        "asc_code" => opt_str_missing(&ctx.roll_number),
        "asc_address" => opt_str_missing(&ctx.address),
        "admission_mode" => {
            if let Some(m) = &ctx.admission_mode {
                or_not_found(m.clone())
            } else {
                or_not_found("Regular".to_string())
            }
        }
        "exam_mode" => opt_str_missing(&ctx.exam_mode),
        "course" | "course_name" => or_not_found(ctx.course.clone()),
        "course_duration" | "duration" => opt_str_missing(&ctx.course_duration),
        "study_center" => opt_str_missing(&ctx.study_center),
        "institute" => opt_str_missing(&ctx.institute),
        "center_name" => {
            if let Some(sc) = &ctx.study_center {
                sc.clone()
            } else if let Some(inst) = &ctx.institute {
                inst.clone()
            } else {
                MISSING_FIELD.to_string()
            }
        }
        "center_address" => opt_str_missing(&ctx.center_address),
        "session_from" => opt_str_missing(&ctx.session_from),
        "session_to" => opt_str_missing(&ctx.session_to),
        "exam_date" => opt_str_missing(&ctx.exam_date),
        "result_date" => opt_str_missing(&ctx.result_date),
        "result_percentage" => opt_str_missing(&ctx.result_percentage),
        "overall_status" => opt_str_missing(&ctx.overall_status),
        "obtained_marks" => ctx
            .obtained_marks
            .map(|v| v.to_string())
            .map(or_not_found)
            .unwrap_or_else(|| MISSING_FIELD.to_string()),
        "total_marks" => ctx
            .total_marks
            .map(|v| v.to_string())
            .map(or_not_found)
            .unwrap_or_else(|| MISSING_FIELD.to_string()),
        "grade" => opt_str_missing(&ctx.grade),
        "result_status" => opt_str_missing(&ctx.result_status),
        "issue_date" => or_not_found(ctx.issue_date.clone()),
        "serial_number" | "serial_num" => ctx
            .serial_number
            .clone()
            .map(or_not_found)
            .unwrap_or_else(|| MISSING_FIELD.to_string()),
        "verification_url" => or_not_found(ctx.verification_url.clone()),
        "gender" | "student_gender" => opt_str_missing(&ctx.gender),
        "category" => opt_str_missing(&ctx.category),
        "address" => opt_str_missing(&ctx.address),
        "city" => opt_str_missing(&ctx.city),
        "state" => opt_str_missing(&ctx.state),
        "pincode" => opt_str_missing(&ctx.pincode),
        "center_code" => opt_str_missing(&ctx.center_code),
        "center_signature" | "center_sign" => opt_str_missing(&ctx.center_signature),
        "center_stamp" => opt_str_missing(&ctx.center_stamp),
        "admin_signature" | "admin_sign" => opt_str_missing(&ctx.admin_signature),
        "admin_stamp" => opt_str_missing(&ctx.admin_stamp),
        "marks_table" | "table" | "result_table" => format_marks_table_html(field, ctx),
        "summary_box" => format_summary_box_html(ctx),
        "photo" => opt_str_missing(&ctx.photo),
        "qr_code" | "qr" => "".to_string(),
        _ => or_not_found(field.custom_text.clone().unwrap_or_default()),
    };

    // Replace placeholders if this is a text field or custom_text
    if field.field_type == "text" || field.field_type == "custom_text" {
        let mut text = raw_val;
        text = text.replace("{{student_name}}", &or_not_found(ctx.student_name.clone()));
        text = text.replace(
            "{{registration_number}}",
            &or_not_found(ctx.registration_number.clone()),
        );
        text = text.replace(
            "{{enrollment_number}}",
            &opt_str_missing(&ctx.enrollment_number),
        );
        text = text.replace("{{roll_number}}", &opt_str_missing(&ctx.roll_number));
        text = text.replace("{{father_name}}", &opt_str_missing(&ctx.father_name));
        text = text.replace("{{mother_name}}", &opt_str_missing(&ctx.mother_name));
        text = text.replace("{{dob}}", &opt_str_missing(&ctx.dob));
        text = text.replace("{{course}}", &or_not_found(ctx.course.clone()));
        text = text.replace(
            "{{course_duration}}",
            &opt_str_missing(&ctx.course_duration),
        );
        text = text.replace("{{study_center}}", &opt_str_missing(&ctx.study_center));
        text = text.replace("{{institute}}", &opt_str_missing(&ctx.institute));
        text = text.replace("{{session_from}}", &opt_str_missing(&ctx.session_from));
        text = text.replace("{{session_to}}", &opt_str_missing(&ctx.session_to));
        text = text.replace("{{exam_date}}", &opt_str_missing(&ctx.exam_date));
        text = text.replace(
            "{{obtained_marks}}",
            &ctx.obtained_marks
                .map(|v| v.to_string())
                .unwrap_or_else(|| MISSING_FIELD.to_string()),
        );
        text = text.replace(
            "{{total_marks}}",
            &ctx.total_marks
                .map(|v| v.to_string())
                .unwrap_or_else(|| MISSING_FIELD.to_string()),
        );
        text = text.replace("{{grade}}", &opt_str_missing(&ctx.grade));
        text = text.replace("{{issue_date}}", &or_not_found(ctx.issue_date.clone()));
        text = text.replace(
            "{{serial_number}}",
            &ctx.serial_number
                .clone()
                .unwrap_or_else(|| MISSING_FIELD.to_string()),
        );
        text = text.replace(
            "{{verification_url}}",
            &or_not_found(ctx.verification_url.clone()),
        );
        text
    } else {
        raw_val
    }
}

pub fn render_page(
    template: &Template,
    fields: &[TemplateField],
    ctx: &CertContext,
    base_url: &str,
) -> String {
    // If it's a marksheet, use the hardcoded modern design
    if matches!(template.template_type, TemplateType::Marksheet) && fields.is_empty() {
        let bg_raw = ctx
            .background_url
            .as_ref()
            .or(template.background_image.as_ref());
        return render_modern_marksheet(ctx, base_url, bg_raw.map(|s| s.as_str()));
    }

    let (page_width, page_height) = page_dimensions_mm(template);

    // --- PREPARE BASE64 ASSETS ---
    let bg_raw = ctx
        .background_url
        .as_ref()
        .or(template.background_image.as_ref());
    println!("Render Page: bg_raw = {:?}", bg_raw);
    let bg_b64 = bg_raw.map(|s| load_asset_base64(s)).unwrap_or_default();
    println!("Render Page: bg_b64 = {:?}", if bg_b64.len() > 100 { &bg_b64[0..100] } else { &bg_b64 });

    let page_bg_style = if bg_b64.is_empty() {
        "background-color: white;".to_string()
    } else {
        format!(
            "background-image: url('{}'); background-size: 100% 100%; background-repeat: no-repeat; background-position: center center;",
            bg_b64
        )
    };

    let mut html = format!(
        r#"<div class="page" style="width: {:.1}mm; height: {:.1}mm; position: relative; overflow: hidden; {}">"#,
        page_width, page_height, page_bg_style
    );

    // Log loaded QR fields count
    let qr_fields_count = fields
        .iter()
        .filter(|f| f.field_type == "qr_code" || f.field_type == "qr")
        .count();
    println!("Loaded QR fields count: {}", qr_fields_count);

    // Render all template fields
    for field in fields {
        let placement_style = field_placement_style(field, template);
        let field_value = get_field_value(field, ctx);

        match field.field_type.as_str() {
            "photo" | "image" | "logo" | "stamp" | "signature" | "center_sign" | "center_stamp"
            | "center_signature" | "admin_sign" | "admin_stamp" => {
                // Log template element type
                println!("  Rendering template element type: {}", field.field_type);

                // Handle image fields
                let img_url = if field_value.is_empty() || field_value == MISSING_FIELD {
                    None
                } else {
                    Some(absolutize_asset_url(base_url, &field_value))
                };

                html.push_str(&format!(r#"<div style="{}">"#, placement_style));
                if let Some(url) = img_url {
                    println!("  Image URL to render: {}", url);
                    html.push_str(&format!(
                        r#"<img src="{}" style="width: 100%; height: 100%; object-fit: fill;"/>"#,
                        url
                    ));
                }
                html.push_str("</div>");
            }
            "qr_code" | "qr" => {
                println!("QR field detected");
                // Handle QR code field with student plain text
                let qr_data = format!(
                    "STUDENT NAME: {}\nFATHER NAME: {}\nDATE OF BIRTH: {}\nENROLLMENT NUMBER: {}\nSERIAL NUMBER: {}\nREGISTRATION NUMBER: {}\nCOURSE: {}",
                    ctx.student_name,
                    ctx.father_name.clone().unwrap_or_else(|| "-".to_string()),
                    ctx.dob.clone().unwrap_or_else(|| "-".to_string()),
                    ctx.enrollment_number.clone().unwrap_or_else(|| "-".to_string()),
                    ctx.serial_number.clone().unwrap_or_else(|| "-".to_string()),
                    ctx.registration_number,
                    ctx.course
                );
                println!("QR data generated");
                let qr_b64 = qr_to_base64(&qr_data);
                println!("QR image generated");
                html.push_str(&format!(r#"<div style="{}">"#, placement_style));
                html.push_str(&format!(
                    r#"<img src="{}" style="width: 100%; height: 100%; object-fit: fill;"/>"#,
                    qr_b64
                ));
                html.push_str("</div>");
                println!("QR drawn on certificate");
            }
            "marks_table" | "table" | "result_table" => {
                // Render marks table
                println!("  Rendering marks/result table! Field value length: {}, first 500 chars: {:?}", field_value.len(), &field_value[..std::cmp::min(500, field_value.len())]);
                html.push_str(&format!(r#"<div style="{}">"#, placement_style));
                html.push_str(&field_value);
                html.push_str("</div>");
            }
            "text" | "custom_text" | _ => {
                // Handle text fields and everything else
                html.push_str(&format!(r#"<div style="{}">"#, placement_style));
                html.push_str(&esc_html(&field_value));
                html.push_str("</div>");
            }
        }
    }

    html.push_str("</div>");
    html
}

#[derive(Debug, Deserialize)]
pub struct DownloadStudentDocParams {
    pub kind: Option<String>,
    pub attempt: Option<i32>,
}

pub async fn admin_download_student_document(
    State(db): State<Database>,
    claims: Claims,
    Path(student_id_str): Path<String>,
    axum::extract::Query(params): axum::extract::Query<DownloadStudentDocParams>,
) -> Result<axum::response::Response, (StatusCode, Json<V2Msg>)> {
    use axum::response::{IntoResponse, Redirect};

    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return Err((
            StatusCode::FORBIDDEN,
            Json(V2Msg {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        ));
    }

    let student_oid = match ObjectId::parse_str(&student_id_str) {
        Ok(o) => o,
        Err(_) => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(V2Msg {
                    success: false,
                    message: "Invalid student ID".to_string(),
                }),
            ));
        }
    };

    let users_coll = db.collection::<User>("users");
    let user = match users_coll
        .find_one(doc! { "_id": &student_oid }, None)
        .await
    {
        Ok(Some(u)) => u,
        _ => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(V2Msg {
                    success: false,
                    message: "Student not found".to_string(),
                }),
            ));
        }
    };

    if user.role != UserRole::Student {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(V2Msg {
                success: false,
                message: "User is not a student".to_string(),
            }),
        ));
    }

    let course_id = {
        // Priority 1: explicit course_id OID on the user record (modern path)
        if let Some(cid) = user.course_id {
            cid
        } else {
            // Priority 2: user.course (legacy string field) → look up matching course by name
            let courses_coll = db.collection::<crate::models::course::Course>("courses");
            let mut resolved: Option<ObjectId> = None;
            if let Some(ref course_name_str) = user.course {
                let cn = course_name_str.trim();
                if !cn.is_empty() {
                    // Try exact match first (case-insensitive) by iterating courses with matching prefix
                    // Avoid regex crate — use simple cursor loop + string eq ignore_ascii_case
                    let all_courses_proj = mongodb::options::FindOptions::builder()
                        .projection(doc! { "_id": 1, "course_name": 1 })
                        .build();
                    if let Ok(mut cursor) = courses_coll.find(doc! {}, all_courses_proj).await {
                        let mut fuzzy_candidate: Option<crate::models::course::Course> = None;
                        while let Some(Ok(course)) = cursor.next().await {
                            let oname = course.course_name.trim().to_ascii_lowercase();
                            let query = cn.to_ascii_lowercase();
                            if oname == query {
                                resolved = course.id;
                                break;
                            }
                            if fuzzy_candidate.is_none() && oname.contains(&query) {
                                fuzzy_candidate = Some(course);
                            }
                        }
                        if resolved.is_none() {
                            if let Some(fc) = fuzzy_candidate {
                                resolved = fc.id;
                            }
                        }
                    }
                }
            }
            // Priority 3: latest course from course_exam_attempts
            if resolved.is_none() {
                let cea_doc_coll = db.collection::<mongodb::bson::Document>("course_exam_attempts");
                let proj = mongodb::options::FindOptions::builder()
                    .projection(doc! { "course_id": 1, "attempt_number": 1, "created_at": 1 })
                    .sort(doc! { "attempt_number": -1, "created_at": -1 })
                    .limit(1)
                    .build();
                if let Ok(mut cursor) = cea_doc_coll.find(doc! { "student_id": &student_oid }, proj).await {
                    if let Some(Ok(row)) = cursor.next().await {
                        if let Ok(cid) = row.get_object_id("course_id") {
                            resolved = Some(cid);
                        }
                    }
                }
            }
            // Priority 4: latest course from certificates (already generated for this student)
            if resolved.is_none() {
                let certs_doc_coll = db.collection::<mongodb::bson::Document>("certificates");
                let proj = mongodb::options::FindOptions::builder()
                    .projection(doc! { "course_id": 1, "created_at": 1 })
                    .sort(doc! { "created_at": -1 })
                    .limit(1)
                    .build();
                if let Ok(mut cursor) = certs_doc_coll.find(doc! { "student_id": &student_oid, "course_id": { "$exists": true, "$ne": null } }, proj).await {
                    if let Some(Ok(row)) = cursor.next().await {
                        if let Ok(cid) = row.get_object_id("course_id") {
                            resolved = Some(cid);
                        }
                    }
                }
            }
            match resolved {
                Some(cid) => cid,
                None => {
                    return Err((
                        StatusCode::BAD_REQUEST,
                        Json(V2Msg {
                            success: false,
                            message: "Student has no course assigned (no course_id, no legacy course name, no course_exam_attempts, no certificates with course_id). Cannot pick default template.".to_string(),
                        }),
                    ));
                }
            }
        }
    };

    let kind = params.kind.as_deref().unwrap_or("certificate");
    // #region debug-point C:admin-handler-entry
    debug_report(
        "pre-fix",
        "C",
        "backend/src/handlers/generate_certificates.rs:4089",
        "[DEBUG] Admin Generate Certificates handler entered",
        serde_json::json!({
            "endpoint": format!("/api/admin/students/{}/documents/download", student_id_str),
            "student_id": student_id_str,
            "kind": kind,
            "attempt": params.attempt,
            "role": match claims.role {
                UserRole::Admin => "admin",
                UserRole::SuperAdmin => "superadmin",
                _ => "other",
            },
        }),
    )
    .await;
    // #endregion
    let template_type = if kind == "marksheet" {
        TemplateType::Marksheet
    } else {
        TemplateType::Certificate
    };

    // Build the set of template_type values to try, since legacy DB records store
    // mixed-case values like "Marksheet" (capital M) while TemplateType::to_str()
    // returns snake_case "marksheet". Try exact to_str() FIRST (matches app-written
    // records, current canonical source of truth), THEN try capitalized variants
    // used by legacy/template-designer direct writes.
    let try_type_strings: Vec<&'static str> = match template_type {
        TemplateType::Marksheet => vec!["marksheet", "Marksheet", "MARKSHEET"],
        TemplateType::Certificate => vec!["certificate", "Certificate", "CERTIFICATE"],
        TemplateType::IdCard => vec!["id_card", "IdCard", "Id_Card", "IDCard", "IDCARD"],
    };
    let try_type_regex = match template_type {
        TemplateType::Marksheet => doc! { "$regex": "^Marksheet$|^marksheet$|^MARKSHEET$", "$options": "" },
        TemplateType::Certificate => doc! { "$regex": "^Certificate$|^certificate$|^CERTIFICATE$", "$options": "" },
        TemplateType::IdCard => doc! { "$regex": "id.?card", "$options": "i" },
    };

    let templates_coll = db.collection::<Template>("templates");
    let templates_doc_coll: mongodb::Collection<mongodb::bson::Document> =
        db.collection::<mongodb::bson::Document>("templates");
    let found_template = {
        let mut t: Option<Template> = None;

        // Priority 1: template_type (case-insensitive/variants) + course_id + default_design=true
        if t.is_none() {
            for tstr in try_type_strings.iter() {
                let filter = doc! {
                    "template_type": tstr,
                    "course_id": &course_id,
                    "default_design": true,
                };
                if let Ok(Some(tpl)) = templates_coll.find_one(filter, None).await {
                    t = Some(tpl);
                    break;
                }
            }
            // Fallback regex match
            if t.is_none() {
                let filter = doc! {
                    "template_type": try_type_regex.clone(),
                    "course_id": &course_id,
                    "default_design": true,
                };
                if let Ok(Some(tpl)) = templates_coll.find_one(filter, None).await {
                    t = Some(tpl);
                }
            }
        }

        // Priority 2: template_type + course_id (any design)
        if t.is_none() {
            for tstr in try_type_strings.iter() {
                let filter = doc! {
                    "template_type": tstr,
                    "course_id": &course_id,
                };
                if let Ok(Some(tpl)) = templates_coll.find_one(filter, None).await {
                    t = Some(tpl);
                    break;
                }
            }
            if t.is_none() {
                let filter = doc! {
                    "template_type": try_type_regex.clone(),
                    "course_id": &course_id,
                };
                if let Ok(Some(tpl)) = templates_coll.find_one(filter, None).await {
                    t = Some(tpl);
                }
            }
        }

        // Priority 3: global default (no course_id filter but default_design=true preferred)
        if t.is_none() {
            for tstr in try_type_strings.iter() {
                let filter = doc! {
                    "template_type": tstr,
                    "default_design": true,
                };
                if let Ok(Some(tpl)) = templates_coll.find_one(filter, None).await {
                    t = Some(tpl);
                    break;
                }
            }
            if t.is_none() {
                let filter = doc! {
                    "template_type": try_type_regex.clone(),
                    "default_design": true,
                };
                if let Ok(Some(tpl)) = templates_coll.find_one(filter, None).await {
                    t = Some(tpl);
                }
            }
        }

        // Priority 4: ANY template of this type (most permissive — last resort)
        if t.is_none() {
            for tstr in try_type_strings.iter() {
                let filter = doc! { "template_type": tstr };
                if let Ok(Some(tpl)) = templates_coll.find_one(filter, None).await {
                    t = Some(tpl);
                    break;
                }
            }
            if t.is_none() {
                let filter = doc! { "template_type": try_type_regex.clone() };
                if let Ok(Some(tpl)) = templates_coll.find_one(filter, None).await {
                    t = Some(tpl);
                }
            }
        }

        // Priority 5 (ultra-paranoid): raw Document find_one with no template_type
        // filter at all, pick first document of ANY type (prevents the "no template"
        // 400 from ever firing if a single template exists in the DB).
        if t.is_none() {
            if let Ok(Some(raw_doc)) = templates_doc_coll
                .find_one(doc! {}, None)
                .await
            {
                // Convert raw Document -> Template via serde (BSON round-trip safe)
                if let Ok(tpl) = mongodb::bson::from_bson::<Template>(mongodb::bson::Bson::Document(raw_doc)) {
                    t = Some(tpl);
                }
            }
        }

        t
    };

    let template = match found_template {
        Some(t) => t,
        None => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(V2Msg {
                    success: false,
                    message: format!(
                        "No {} template exists (tried marksheet/Marksheet case variants, with/without course_id={}, with default_design=true/false, global fallback). Please create a template before downloading.",
                        template_type.to_str(),
                        course_id.to_hex()
                    ),
                }),
            ));
        }
    };

    let template_id_hex = match template.id {
        Some(id) => id.to_hex(),
        None => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(V2Msg {
                    success: false,
                    message: "Template has no ID".to_string(),
                }),
            ));
        }
    };

    // #region debug-point D:admin-template-selection
    debug_report(
        "pre-fix",
        "D",
        "backend/src/handlers/generate_certificates.rs:4025",
        "[DEBUG] Admin download resolved certificate template before generation",
        serde_json::json!({
            "student_id": student_id_str,
            "kind": kind,
            "template_id": template_id_hex.clone(),
            "course_id": course_id.to_hex(),
            "template_name": template.template_name,
            "default": template.default_design,
            "template_type": template.template_type.to_str(),
        }),
    )
    .await;
    // #endregion

    let payload = GenerateRequest {
        template_id: template_id_hex,
        student_ids: vec![student_id_str.clone()],
        issue_date: Some(Utc::now().naive_utc().date().to_string()),
        mode: if kind == "marksheet" {
            Some("single".to_string())
        } else {
            None
        },
        scheduled_at: None,
        reissue: Some(true),
        force_new: Some(true),
        attempt_number: params.attempt,
    };

    let (status, Json(resp)) = process_generate_certificates(&db, claims.role, payload).await;
    // #region debug-point E:admin-generation-result
    debug_report(
        "pre-fix",
        "E",
        "backend/src/handlers/generate_certificates.rs:4289",
        "[DEBUG] Admin Generate Certificates handler received generation result",
        serde_json::json!({
            "student_id": student_id_str,
            "kind": kind,
            "attempt": params.attempt,
            "status_code": status.as_u16(),
            "success": resp.success,
            "message": resp.message,
            "certificate_ids": resp.certificate_ids,
            "preview": resp.preview,
        }),
    )
    .await;
    // #endregion

    if status != StatusCode::OK || !resp.success {
        return Err((
            status,
            Json(V2Msg {
                success: false,
                message: resp.message,
            }),
        ));
    }

    let cert_id = resp
        .certificate_ids
        .as_ref()
        .and_then(|ids| ids.first())
        .cloned()
        .or_else(|| {
            resp.preview
                .as_ref()
                .and_then(|p| p.first())
                .map(|r| r.certificate_id.clone())
        });

    let cert_id = match cert_id {
        Some(id) => id,
        None => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(V2Msg {
                    success: false,
                    message: "No certificate ID returned from generation".to_string(),
                }),
            ));
        }
    };

    // =========================================================================
    // STAGE 1 DIAGNOSTIC (Admin Generate Certificates page ONLY, not shared)
    // Immediately after process_generate_certificates writes the PDF to disk:
    //   1. Look up DB row → file_path → absolute path
    //   2. Print: absolute path, file size, SHA256
    //   3. Execute: pdfinfo && qpdf --check
    // If generated PDF is ALREADY invalid here → STOP & fix generator.
    // =========================================================================
    {
        use std::process::Command;
        let upload_dir = std::env::var("UPLOAD_DIR")
            .unwrap_or_else(|_| "/var/www/html/scre/backend/uploads".to_string());
        let upload_pb = std::path::PathBuf::from(&upload_dir);
        let backend_dir = std::path::PathBuf::from("/var/www/html/scre/backend");
        let public_dir = std::path::PathBuf::from("/var/www/html/scre/public");
        let public_uploads_dir = public_dir.join("uploads");

        if let Ok(cert_oid) = ObjectId::parse_str(&cert_id) {
            // Check BOTH marksheets + certificates collections (marksheets may fallback to certs)
            let coll_ms: mongodb::Collection<mongodb::bson::Document> =
                db.collection::<mongodb::bson::Document>("marksheets");
            let coll_cert: mongodb::Collection<mongodb::bson::Document> =
                db.collection::<mongodb::bson::Document>("certificates");
            let doc_opt = match coll_ms.find_one(doc! { "_id": cert_oid }, None).await {
                Ok(Some(d)) => Some(d),
                _ => match coll_cert.find_one(doc! { "_id": cert_oid }, None).await {
                    Ok(Some(d)) => Some(d),
                    _ => None,
                }
            };

            if let Some(doc) = doc_opt {
                let fp_opt = doc.get("file_path").and_then(|b| match b {
                    mongodb::bson::Bson::String(s) if !s.is_empty() => Some(s.clone()),
                    _ => None,
                });
                let cn_opt = doc.get_str("certificate_no").ok().map(|s| s.to_string());

                let mut candidates: Vec<std::path::PathBuf> = Vec::new();
                if let Some(ref p) = fp_opt {
                    let pb = std::path::PathBuf::from(p);
                    candidates.push(pb.clone());
                    if pb.is_relative() {
                        candidates.push(upload_pb.join(p));
                        candidates.push(backend_dir.join(p));
                        candidates.push(public_dir.join(p));
                        candidates.push(public_uploads_dir.join(p));
                    }
                }
                if let Some(ref cn) = cn_opt {
                    for sub in &["certificates", "marksheets"] {
                        candidates.push(upload_pb.join(format!("{}/{}.pdf", sub, cn)));
                        candidates.push(backend_dir.join(format!("{}/{}.pdf", sub, cn)));
                        candidates.push(public_dir.join(format!("{}/{}.pdf", sub, cn)));
                        candidates.push(public_uploads_dir.join(format!("{}/{}.pdf", sub, cn)));
                    }
                    candidates.push(upload_pb.join(format!("{}.pdf", cn)));
                    candidates.push(backend_dir.join(format!("{}.pdf", cn)));
                    candidates.push(public_uploads_dir.join(format!("{}.pdf", cn)));
                }

                let mut seen = std::collections::HashSet::new();
                let found_path_opt = candidates.into_iter()
                    .filter(|p| seen.insert(p.clone()))
                    .find(|p| p.exists());

                if let Some(abs_path) = found_path_opt.and_then(|p| p.canonicalize().ok()) {
                    let abs_path_display = abs_path.display().to_string();
                    let size = std::fs::metadata(&abs_path).map(|m| m.len()).unwrap_or(0);

                    // SHA256 via `sha256sum`
                    let sha_out = Command::new("sha256sum").arg(&abs_path).output().ok();
                    let sha = sha_out.as_ref().and_then(|o| String::from_utf8(o.stdout.clone()).ok())
                        .and_then(|s| s.split_whitespace().next().map(|h| h.to_string()))
                        .unwrap_or_else(|| "(sha256sum failed)".to_string());

                    eprintln!("[STAGE1] ========== GENERATED PDF DIAGNOSTIC ==========");
                    eprintln!("[STAGE1] kind={} cert_id={} cert_no={:?} file_path_db={:?}",
                        kind, cert_id, cn_opt, fp_opt);
                    eprintln!("[STAGE1] absolute_path={}", abs_path_display);
                    eprintln!("[STAGE1] file_size={} bytes", size);
                    eprintln!("[STAGE1] sha256={}", sha);

                    // 16-byte header check
                    if let Ok(fbytes) = std::fs::read(&abs_path) {
                        let take = std::cmp::min(16, fbytes.len());
                        let hb: Vec<u8> = fbytes.iter().take(take).copied().collect();
                        let ht = String::from_utf8_lossy(&hb);
                        let first32: Vec<u8> = fbytes.iter().take(std::cmp::min(32, fbytes.len())).copied().collect();
                        let last32: Vec<u8> = fbytes.iter().skip(fbytes.len().saturating_sub(32)).copied().collect();
                        eprintln!("[STAGE1] header_bytes_hex={}",
                            hb.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "));
                        eprintln!("[STAGE1] header_text={:?}", ht);
                        eprintln!("[STAGE1] first32_hex={}",
                            first32.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "));
                        eprintln!("[STAGE1] last32_hex={}",
                            last32.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "));
                        debug_report(
                            "pre-fix",
                            "F",
                            "backend/src/handlers/generate_certificates.rs:4410",
                            "[DEBUG] Stage 1 generated PDF bytes captured before HTTP response",
                            serde_json::json!({
                                "kind": kind,
                                "cert_id": cert_id,
                                "certificate_no": cn_opt,
                                "generated_pdf_path": abs_path_display,
                                "file_exists": true,
                                "file_size": fbytes.len(),
                                "sha256": sha,
                                "first32_hex": first32.iter().map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(""),
                                "last32_hex": last32.iter().map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(""),
                            }),
                        )
                        .await;
                    }

                    eprintln!("[STAGE1] ----- file -----");
                    match Command::new("file").arg(&abs_path).output() {
                        Ok(o) => {
                            let stdout = String::from_utf8_lossy(&o.stdout);
                            let stderr = String::from_utf8_lossy(&o.stderr);
                            eprintln!("[STAGE1] file exit_status={}", o.status);
                            if !stdout.is_empty() { eprintln!("[STAGE1] file stdout:\n{}", stdout.trim()); }
                            if !stderr.is_empty() { eprintln!("[STAGE1] file stderr:\n{}", stderr.trim()); }
                            debug_report(
                                "pre-fix",
                                "F",
                                "backend/src/handlers/generate_certificates.rs:4430",
                                "[DEBUG] Stage 1 `file` verification executed on generated PDF",
                                serde_json::json!({
                                    "kind": kind,
                                    "cert_id": cert_id,
                                    "generated_pdf_path": abs_path_display,
                                    "file_command_stdout": stdout.trim(),
                                    "file_command_stderr": stderr.trim(),
                                    "file_command_success": o.status.success(),
                                }),
                            )
                            .await;
                        }
                        Err(e) => eprintln!("[STAGE1] file EXEC FAILED: {}", e),
                    }

                    // pdfinfo
                    eprintln!("[STAGE1] ----- pdfinfo -----");
                    match Command::new("pdfinfo").arg(&abs_path).output() {
                        Ok(o) => {
                            let stdout = String::from_utf8_lossy(&o.stdout);
                            let stderr = String::from_utf8_lossy(&o.stderr);
                            eprintln!("[STAGE1] pdfinfo exit_status={}", o.status);
                            if !stdout.is_empty() { eprintln!("[STAGE1] pdfinfo stdout:\n{}", stdout.trim()); }
                            if !stderr.is_empty() { eprintln!("[STAGE1] pdfinfo stderr:\n{}", stderr.trim()); }
                        }
                        Err(e) => eprintln!("[STAGE1] pdfinfo EXEC FAILED: {}", e),
                    }

                    // qpdf --check
                    eprintln!("[STAGE1] ----- qpdf --check -----");
                    match Command::new("qpdf").arg("--check").arg(&abs_path).output() {
                        Ok(o) => {
                            let stdout = String::from_utf8_lossy(&o.stdout);
                            let stderr = String::from_utf8_lossy(&o.stderr);
                            eprintln!("[STAGE1] qpdf exit_status={}", o.status);
                            if !stdout.is_empty() { eprintln!("[STAGE1] qpdf stdout:\n{}", stdout.trim()); }
                            if !stderr.is_empty() { eprintln!("[STAGE1] qpdf stderr:\n{}", stderr.trim()); }
                            if !o.status.success() {
                                eprintln!("[STAGE1] *** GENERATED PDF IS INVALID (qpdf failed). STAGE 1 STOP: fix generator. ***");
                            } else {
                                eprintln!("[STAGE1] *** GENERATED PDF VALID (qpdf OK). Proceed to Stage 2 on download. ***");
                            }
                        }
                        Err(e) => eprintln!("[STAGE1] qpdf EXEC FAILED: {}", e),
                    }
                    eprintln!("[STAGE1] ===================================================");
                } else {
                    eprintln!("[STAGE1] CANNOT FIND generated PDF on disk for kind={} cert_id={} candidates_tried={}",
                        kind, cert_id, "see above; file_path_db=".to_string() + &fp_opt.clone().unwrap_or_default());
                }
            } else {
                eprintln!("[STAGE1] cannot find DB row with _id={}", cert_id);
            }
        }
    }

    let redirect_url = if kind == "marksheet" {
        format!("/api/marksheets/{}/download", cert_id)
    } else {
        format!("/api/certificates/download/{}", cert_id)
    };
    // #region debug-point G:admin-redirect
    debug_report(
        "pre-fix",
        "G",
        "backend/src/handlers/generate_certificates.rs:4460",
        "[DEBUG] Admin Generate Certificates handler returning redirect to download endpoint",
        serde_json::json!({
            "student_id": student_id_str,
            "kind": kind,
            "attempt": params.attempt,
            "certificate_id": cert_id,
            "redirect_url": redirect_url,
        }),
    )
    .await;
    // #endregion
    Ok(Redirect::to(&redirect_url).into_response())
}
