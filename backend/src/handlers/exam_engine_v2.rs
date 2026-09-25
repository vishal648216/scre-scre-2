//! HTTP API for Exam Engine V2 (`/api/exam-v2/*`). Legacy `/api/exam/*` unchanged.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::io::Write;
use chrono::{TimeZone, Utc};
use futures_util::StreamExt;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use mongodb::bson::{doc, oid::ObjectId, DateTime as BsonDateTime};
use mongodb::Database;
use serde::{Deserialize, Serialize};

type HmacSha256 = Hmac<Sha256>;

fn hmac_secret_val() -> Result<String, String> {
    if let Ok(s) = std::env::var("EXAM_V2_PAPER_SECRET") {
        if !s.trim().is_empty() { return Ok(s); }
    }
    std::env::var("JWT_SECRET")
        .map_err(|_| "Set EXAM_V2_PAPER_SECRET or JWT_SECRET".to_string())
}

use crate::models::exam_engine_v2::{
    ExamV2Exam, ExamV2Marksheet, ExamV2Paper, ExamV2PaperQuestion, ExamV2PaperTemplate, ExamV2Question,
    PracticalAssignmentMarks, ReappearPayment, ReappearAllocation
};
use crate::handlers::exam_v2_migrate::run_migration;
use crate::services::exam_engine_v2::validate_template_structure;
use crate::models::user::{Claims, User, UserRole};
use crate::handlers::attendance::Attendance;

#[derive(Debug, Serialize)]
pub struct V2Msg {
    pub success: bool,
    pub message: String,
}

fn admin_ok(role: &UserRole) -> bool {
    matches!(role, UserRole::Admin | UserRole::SuperAdmin)
}

fn center_ok(role: &UserRole) -> bool {
    *role == UserRole::Center
}

fn student_ok(role: &UserRole) -> bool {
    *role == UserRole::Student
}

// --- Question Bank Module (REMOVED - Rebuilding) ---

pub async fn v2_list_tags(
    State(_db): State<Database>,
    _claims: Claims,
) -> (StatusCode, Json<Vec<String>>) {
    (StatusCode::OK, Json(vec![]))
}

pub async fn v2_list_question_banks(
    State(_db): State<Database>,
    _claims: Claims,
) -> (StatusCode, Json<Vec<String>>) {
    (StatusCode::OK, Json(vec![]))
}

pub async fn v2_list_questions(
    State(_db): State<Database>,
    _claims: Claims,
) -> (StatusCode, Json<Vec<String>>) {
    (StatusCode::OK, Json(vec![]))
}

pub async fn v2_add_question(
    State(_db): State<Database>,
    _claims: Claims,
) -> (StatusCode, Json<V2Msg>) {
    (StatusCode::SERVICE_UNAVAILABLE, Json(V2Msg { success: false, message: "Question Bank is under reconstruction.".into() }))
}

pub async fn v2_update_question(
    State(_db): State<Database>,
    _claims: Claims,
) -> (StatusCode, Json<V2Msg>) {
    (StatusCode::SERVICE_UNAVAILABLE, Json(V2Msg { success: false, message: "Question Bank is under reconstruction.".into() }))
}

pub async fn v2_get_question_versions(
    State(_db): State<Database>,
    _claims: Claims,
) -> (StatusCode, Json<Vec<String>>) {
    (StatusCode::SERVICE_UNAVAILABLE, Json(vec![]))
}

pub async fn v2_rollback_question(
    State(_db): State<Database>,
    _claims: Claims,
) -> (StatusCode, Json<V2Msg>) {
    (StatusCode::SERVICE_UNAVAILABLE, Json(V2Msg { success: false, message: "Question Bank is under reconstruction.".into() }))
}

pub async fn v2_bulk_upload_preview(
    State(_db): State<Database>,
    _claims: Claims,
) -> (StatusCode, Json<V2Msg>) {
    (StatusCode::SERVICE_UNAVAILABLE, Json(V2Msg { success: false, message: "Question Bank is under reconstruction.".into() }))
}

pub async fn v2_bulk_upload_confirm(
    State(_db): State<Database>,
    _claims: Claims,
) -> (StatusCode, Json<V2Msg>) {
    (StatusCode::SERVICE_UNAVAILABLE, Json(V2Msg { success: false, message: "Question Bank is under reconstruction.".into() }))
}

pub async fn v2_create_tag(
    State(_db): State<Database>,
    _claims: Claims,
) -> (StatusCode, Json<V2Msg>) {
    (StatusCode::SERVICE_UNAVAILABLE, Json(V2Msg { success: false, message: "Question Bank is under reconstruction.".into() }))
}

pub async fn v2_delete_tag(
    State(_db): State<Database>,
    _claims: Claims,
) -> (StatusCode, Json<V2Msg>) {
    (StatusCode::SERVICE_UNAVAILABLE, Json(V2Msg { success: false, message: "Question Bank is under reconstruction.".into() }))
}

pub async fn v2_create_question_bank(
    State(_db): State<Database>,
    _claims: Claims,
) -> (StatusCode, Json<V2Msg>) {
    (StatusCode::SERVICE_UNAVAILABLE, Json(V2Msg { success: false, message: "Question Bank is under reconstruction.".into() }))
}

// --- Paper templates (format: sections marks × count) ---

pub async fn v2_create_paper_template(
    State(db): State<Database>,
    claims: Claims,
    Json(mut payload): Json<ExamV2PaperTemplate>,
) -> (StatusCode, Json<V2Msg>) {
    if !admin_ok(&claims.role) {
        return (StatusCode::FORBIDDEN, Json(V2Msg { success: false, message: "Unauthorized".into() }));
    }
    
    if let Err(e) = validate_template_structure(&payload) {
        return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: e }));
    }

    let coll = db.collection::<ExamV2PaperTemplate>("exam_v2_paper_templates");
    payload.id = None;
    payload.created_by = match ObjectId::parse_str(&claims.sub) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Invalid user".into() })),
    };
    payload.created_at = BsonDateTime::now();
    match coll.insert_one(payload, None).await {
        Ok(_) => (StatusCode::CREATED, Json(V2Msg { success: true, message: "Paper template created".into() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(V2Msg { success: false, message: "Failed".into() })),
    }
}

pub async fn v2_list_paper_templates(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<ExamV2PaperTemplate>>) {
    if !admin_ok(&claims.role) && !center_ok(&claims.role) && !student_ok(&claims.role) {
        return (StatusCode::FORBIDDEN, Json(vec![]));
    }
    let coll = db.collection::<ExamV2PaperTemplate>("exam_v2_paper_templates");
    let mut cur = match coll.find(None, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };
    let mut v = Vec::new();
    while let Some(Ok(b)) = cur.next().await {
        v.push(b);
    }
    (StatusCode::OK, Json(v))
}

pub async fn v2_get_paper_template(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<Option<ExamV2PaperTemplate>>) {
    if !admin_ok(&claims.role) && !center_ok(&claims.role) {
        return (StatusCode::FORBIDDEN, Json(None));
    }
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(None)),
    };
    let coll = db.collection::<ExamV2PaperTemplate>("exam_v2_paper_templates");
    match coll.find_one(doc! { "_id": oid }, None).await {
        Ok(b) => (StatusCode::OK, Json(b)),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(None)),
    }
}

/// One-shot migration from legacy blueprint/course questions → banks + paper templates (admin).
pub async fn v2_run_migration(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<V2Msg>) {
    if !admin_ok(&claims.role) {
        return (StatusCode::FORBIDDEN, Json(V2Msg { success: false, message: "Unauthorized".into() }));
    }
    
    // 1. Run legacy ID migration
    let _ = run_migration(&db).await;
    
    // 2. Run new Tag-based migration
    match crate::handlers::exam_v2_migration_tags::migrate_questions_to_tags(&db).await {
        Ok(m) => (StatusCode::OK, Json(V2Msg { success: true, message: m })),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(V2Msg { success: false, message: e })),
    }
}

// --- Exams ---

pub async fn v2_create_exam(
    State(db): State<Database>,
    claims: Claims,
    Json(mut payload): Json<ExamV2Exam>,
) -> (StatusCode, Json<V2Msg>) {
    if !admin_ok(&claims.role) {
        return (StatusCode::FORBIDDEN, Json(V2Msg { success: false, message: "Unauthorized".into() }));
    }
    let coll = db.collection::<ExamV2Exam>("exam_v2_exams");
    payload.id = None;
    payload.created_by = match ObjectId::parse_str(&claims.sub) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Invalid user".into() })),
    };
    payload.created_at = BsonDateTime::now();
    if payload.status.is_empty() {
        payload.status = "draft".into();
    }
    match coll.insert_one(payload, None).await {
        Ok(_) => (StatusCode::CREATED, Json(V2Msg { success: true, message: "Exam created".into() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(V2Msg { success: false, message: "Failed".into() })),
    }
}

#[derive(Debug, Deserialize)]
pub struct ExamListQuery {
    pub center_id: Option<String>,
    pub status: Option<String>,
}

pub async fn v2_list_exams(
    State(db): State<Database>,
    claims: Claims,
    Query(q): Query<ExamListQuery>,
) -> (StatusCode, Json<Vec<ExamV2Exam>>) {
    if student_ok(&claims.role) {
        let sid = match ObjectId::parse_str(&claims.sub) {
            Ok(o) => o,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(vec![])),
        };
        let paper_coll = db.collection::<ExamV2Paper>("exam_v2_papers");
        let mut pc = match paper_coll.find(doc! { "student_id": sid }, None).await {
            Ok(c) => c,
            Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
        };
        use std::collections::HashSet;
        let mut ids: HashSet<ObjectId> = HashSet::new();
        while let Some(Ok(p)) = pc.next().await {
            ids.insert(p.exam_id);
        }
        if ids.is_empty() {
            return (StatusCode::OK, Json(vec![]));
        }
        let list: Vec<ObjectId> = ids.into_iter().collect();
        let coll = db.collection::<ExamV2Exam>("exam_v2_exams");
        let mut cur = match coll.find(doc! { "_id": { "$in": list } }, None).await {
            Ok(c) => c,
            Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
        };
        let mut v = Vec::new();
        while let Some(Ok(e)) = cur.next().await {
            v.push(e);
        }
        return (StatusCode::OK, Json(v));
    }
    if !admin_ok(&claims.role) && !center_ok(&claims.role) {
        return (StatusCode::FORBIDDEN, Json(vec![]));
    }
    let mut filter = doc! {};
    if let Some(st) = &q.status {
        filter.insert("status", st);
    }
    if center_ok(&claims.role) {
        let cid = match ObjectId::parse_str(&claims.sub) {
            Ok(o) => o,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(vec![])),
        };
        filter.insert("$or", vec![
            doc! { "center_ids": doc! { "$size": 0 } },
            doc! { "center_ids": cid },
        ]);
    } else if let Some(cid) = q.center_id.as_ref().and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("center_ids", doc! { "$in": vec![cid] });
    }
    let coll = db.collection::<ExamV2Exam>("exam_v2_exams");
    let mut cur = match coll.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };
    let mut v = Vec::new();
    while let Some(Ok(e)) = cur.next().await {
        v.push(e);
    }
    (StatusCode::OK, Json(v))
}

#[derive(Debug, Deserialize)]
pub struct PatchExam {
    pub status: Option<String>,
}

pub async fn v2_patch_exam(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(patch): Json<PatchExam>,
) -> (StatusCode, Json<V2Msg>) {
    if !admin_ok(&claims.role) {
        return (StatusCode::FORBIDDEN, Json(V2Msg { success: false, message: "Unauthorized".into() }));
    }
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Bad id".into() })),
    };
    let mut set = doc! {};
    if let Some(s) = patch.status {
        set.insert("status", s);
    }
    if set.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Nothing to update".into() }));
    }
    let coll = db.collection::<ExamV2Exam>("exam_v2_exams");
    match coll.update_one(doc! { "_id": oid }, doc! { "$set": set }, None).await {
        Ok(r) if r.modified_count > 0 || r.matched_count > 0 => {
            (StatusCode::OK, Json(V2Msg { success: true, message: "Updated".into() }))
        }
        Ok(_) => (StatusCode::NOT_FOUND, Json(V2Msg { success: false, message: "Not found".into() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(V2Msg { success: false, message: "Failed".into() })),
    }
}

#[derive(Debug, Deserialize)]
pub struct QuestionListQuery {
    pub question_bank_id: Option<String>,
    pub course_id: Option<String>,
    pub subject_id: Option<String>,
    pub status: Option<String>,
    pub tags: Option<String>, // comma separated
}

// --- Generate paper ---

#[derive(Debug, Deserialize)]
pub struct GenPaperReq {
    pub exam_id: String,
    pub student_id: String,
    pub center_id: String,
}

pub async fn v2_generate_paper(
    State(_db): State<Database>,
    _claims: Claims,
    Json(_payload): Json<GenPaperReq>,
) -> (StatusCode, Json<V2Msg>) {
    (StatusCode::SERVICE_UNAVAILABLE, Json(V2Msg { success: false, message: "Question Bank is under reconstruction. Paper generation disabled.".into() }))
}

pub async fn v2_list_papers(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<ExamV2Paper>>) {
    let coll = db.collection::<ExamV2Paper>("exam_v2_papers");
    let filter = match claims.role {
        UserRole::Admin | UserRole::SuperAdmin => doc! {},
        UserRole::Center => {
            let oid = match ObjectId::parse_str(&claims.sub) {
                Ok(o) => o,
                Err(_) => return (StatusCode::BAD_REQUEST, Json(vec![])),
            };
            doc! { "center_id": oid }
        }
        UserRole::Student => {
            let oid = match ObjectId::parse_str(&claims.sub) {
                Ok(o) => o,
                Err(_) => return (StatusCode::BAD_REQUEST, Json(vec![])),
            };
            doc! { "student_id": oid }
        }
        _ => return (StatusCode::FORBIDDEN, Json(vec![])),
    };
    let mut cur = match coll.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };
    let mut v = Vec::new();
    while let Some(Ok(p)) = cur.next().await {
        v.push(p);
    }
    (StatusCode::OK, Json(v))
}

#[derive(Debug, Serialize)]
pub struct PaperDetail {
    pub paper: ExamV2Paper,
    pub exam: Option<ExamV2Exam>,
    pub paper_template: Option<ExamV2PaperTemplate>,
    pub questions: Vec<ExamV2Question>,
    /// When `exam.require_attendance` is true and the viewer is the student: whether they are marked present for `attendance_date`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attendance_satisfied: Option<bool>,
}

pub async fn v2_get_paper(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<Option<PaperDetail>>) {
    let pid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(None)),
    };
    let paper_coll = db.collection::<ExamV2Paper>("exam_v2_papers");
    let paper = match paper_coll.find_one(doc! { "_id": pid }, None).await {
        Ok(Some(p)) => p,
        _ => return (StatusCode::NOT_FOUND, Json(None)),
    };

    let sub = match ObjectId::parse_str(&claims.sub) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(None)),
    };
    if student_ok(&claims.role) && paper.student_id != sub {
        return (StatusCode::FORBIDDEN, Json(None));
    }
    if center_ok(&claims.role) && paper.center_id != sub {
        return (StatusCode::FORBIDDEN, Json(None));
    }

    let exam = db
        .collection::<ExamV2Exam>("exam_v2_exams")
        .find_one(doc! { "_id": paper.exam_id }, None)
        .await
        .ok()
        .flatten();
    let paper_template = db
        .collection::<ExamV2PaperTemplate>("exam_v2_paper_templates")
        .find_one(doc! { "_id": paper.paper_template_id }, None)
        .await
        .ok()
        .flatten();

    let q_coll = db.collection::<ExamV2Question>("exam_v2_questions");
    let mut questions = Vec::new();
    for m in &paper.questions {
        let q_filter = doc! { 
            "parent_question_id": m.question_id, 
            "version": m.version 
        };
        
        let q_doc = match q_coll.find_one(q_filter, None).await {
            Ok(Some(q)) => Some(q),
            _ => {
                // Fallback to _id match if version-specific fetch fails
                q_coll.find_one(doc! { "_id": m.question_id }, None).await.ok().flatten()
            }
        };

        if let Some(mut q) = q_doc {
            // Use the student-specific shuffled options from the paper snapshot
            q.options_pool = m.display_options.clone();
            questions.push(q);
        } else {
            // Placeholder for missing question
            eprintln!("WARNING: Question {} v{} not found for paper {}", m.question_id, m.version, pid);
        }
    }

    let attendance_satisfied = if student_ok(&claims.role) {
        match &exam {
            Some(e) if e.require_attendance => Some(
                attendance_present(&db, paper.student_id, paper.center_id, e.attendance_date).await,
            ),
            _ => None,
        }
    } else {
        None
    };

    (
        StatusCode::OK,
        Json(Some(PaperDetail {
            paper,
            exam,
            paper_template,
            questions,
            attendance_satisfied,
        })),
    )
}

async fn attendance_present(
    db: &Database,
    student_id: ObjectId,
    center_id: ObjectId,
    day: BsonDateTime,
) -> bool {
    let dt = Utc.timestamp_millis_opt(day.timestamp_millis()).unwrap();
    let d = dt.date_naive();
    let start = Utc.from_utc_datetime(&d.and_hms_opt(0, 0, 0).unwrap());
    let end = start + chrono::Duration::days(1);
    let coll = db.collection::<Attendance>("attendances");
    let filter = doc! {
        "student_id": student_id,
        "center_id": center_id,
        "date": { "$gte": BsonDateTime::from_millis(start.timestamp_millis()), "$lt": BsonDateTime::from_millis(end.timestamp_millis()) },
        "status": { "$regex": "^present$", "$options": "i" }
    };
    coll.find_one(filter, None).await.ok().flatten().is_some()
}

pub async fn v2_start_attempt(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<V2Msg>) {
    if !student_ok(&claims.role) {
        return (StatusCode::FORBIDDEN, Json(V2Msg { success: false, message: "Students only".into() }));
    }
    let pid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Bad id".into() })),
    };
    let sid = match ObjectId::parse_str(&claims.sub) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Bad user".into() })),
    };

    let paper_coll = db.collection::<ExamV2Paper>("exam_v2_papers");
    let mut paper = match paper_coll.find_one(doc! { "_id": pid }, None).await {
        Ok(Some(p)) => p,
        _ => return (StatusCode::NOT_FOUND, Json(V2Msg { success: false, message: "Not found".into() })),
    };
    if paper.student_id != sid {
        return (StatusCode::FORBIDDEN, Json(V2Msg { success: false, message: "Not your paper".into() }));
    }
    if paper.status != "generated" {
        return (
            StatusCode::BAD_REQUEST,
            Json(V2Msg {
                success: false,
                message: "Already started or finished".into(),
            }),
        );
    }

    let exam = match db
        .collection::<ExamV2Exam>("exam_v2_exams")
        .find_one(doc! { "_id": paper.exam_id }, None)
        .await
    {
        Ok(Some(e)) => e,
        _ => return (StatusCode::NOT_FOUND, Json(V2Msg { success: false, message: "Exam not found".into() })),
    };

    // Offline students cannot start online exams — hall ticket only
    let user_coll = db.collection::<User>("users");
    if let Ok(Some(student)) = user_coll.find_one(doc! { "_id": sid }, None).await {
        if let Some(ref mode) = student.exam_mode {
            let lower = mode.to_lowercase();
            let is_online = lower.contains("online")
                || lower.contains("cbt")
                || lower == "computer based test (cbt)";
            if !is_online {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(V2Msg {
                        success: false,
                        message: "Offline exam mode — download hall ticket from My Examinations".into(),
                    }),
                );
            }
        }
    }

    // Check attendance if required
    if exam.require_attendance {
        let user_coll = db.collection::<User>("users");
        let student_user = match user_coll.find_one(doc! { "_id": sid }, None).await {
            Ok(Some(user)) => user,
            _ => return (StatusCode::NOT_FOUND, Json(V2Msg { success: false, message: "Student user not found".into() })),
        };
        let center_id = match student_user.parent_id {
            Some(pid) => pid,
            None => return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Student not associated with a center".into() })),
        };

        if !attendance_present(&db, sid, center_id, exam.attendance_date).await {
            return (StatusCode::FORBIDDEN, Json(V2Msg { success: false, message: "Attendance not marked for exam date".into() }));
        }
    }

    let now = BsonDateTime::now();
    if now < exam.start_at {
        return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Exam not started".into() }));
    }
    if now > exam.end_at {
        return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Exam ended".into() }));
    }

    if exam.require_attendance
        && !attendance_present(&db, sid, paper.center_id, exam.attendance_date).await
    {
        return (
            StatusCode::FORBIDDEN,
            Json(V2Msg {
                success: false,
                message: "Attendance not marked present for required day".into(),
            }),
        );
    }

    let tpl = match db
        .collection::<ExamV2PaperTemplate>("exam_v2_paper_templates")
        .find_one(doc! { "_id": paper.paper_template_id }, None)
        .await
    {
        Ok(Some(b)) => b,
        _ => return (StatusCode::INTERNAL_SERVER_ERROR, Json(V2Msg { success: false, message: "Paper template missing".into() })),
    };

    let deadline = if exam.exam_mode == "offline" {
        None
    } else {
        let end = now.timestamp_millis() + (tpl.duration_minutes as i64) * 60_000;
        Some(BsonDateTime::from_millis(end))
    };

    paper.status = "in_progress".into();
    paper.server_started_at = Some(now);
    paper.server_deadline_at = deadline;

    match paper_coll.replace_one(doc! { "_id": pid }, &paper, None).await {
        Ok(_) => (StatusCode::OK, Json(V2Msg { success: true, message: "Started".into() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(V2Msg { success: false, message: "Failed".into() })),
    }
}

#[derive(Debug, Serialize)]
pub struct AttemptState {
    pub server_now_ms: i64,
    pub deadline_ms: Option<i64>,
    pub status: String,
}

pub async fn v2_attempt_state(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<Option<AttemptState>>) {
    let pid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(None)),
    };
    let paper_coll = db.collection::<ExamV2Paper>("exam_v2_papers");
    let mut paper = match paper_coll.find_one(doc! { "_id": pid }, None).await {
        Ok(Some(p)) => p,
        _ => return (StatusCode::NOT_FOUND, Json(None)),
    };
    if student_ok(&claims.role) {
        let sid = ObjectId::parse_str(&claims.sub).ok();
        if sid != Some(paper.student_id) {
            return (StatusCode::FORBIDDEN, Json(None));
        }
        // Server-side auto-submit when deadline passed (no client trust).
        if paper.status == "in_progress" {
            if let Some(dl) = paper.server_deadline_at {
                if BsonDateTime::now() > dl {
                    let _ = evaluate_and_persist_paper(&db, &pid, &mut paper).await;
                    if let Ok(Some(p2)) = paper_coll.find_one(doc! { "_id": pid }, None).await {
                        paper = p2;
                    }
                }
            }
        }
    }
    let now = BsonDateTime::now().timestamp_millis();
    let dl = paper.server_deadline_at.map(|d| d.timestamp_millis());
    (
        StatusCode::OK,
        Json(Some(AttemptState {
            server_now_ms: now,
            deadline_ms: dl,
            status: paper.status.clone(),
        })),
    )
}

#[derive(Debug, Deserialize)]
pub struct AutosaveReq {
    pub responses: Vec<QuestionResp>,
}

#[derive(Debug, Deserialize)]
pub struct QuestionResp {
    pub question_id: String,
    pub response: String,
}

pub async fn v2_autosave(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<AutosaveReq>,
) -> (StatusCode, Json<V2Msg>) {
    if !student_ok(&claims.role) {
        return (StatusCode::FORBIDDEN, Json(V2Msg { success: false, message: "Unauthorized".into() }));
    }
    let pid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Bad id".into() })),
    };
    let sid = match ObjectId::parse_str(&claims.sub) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Bad user".into() })),
    };
    let paper_coll = db.collection::<ExamV2Paper>("exam_v2_papers");
    let mut paper = match paper_coll.find_one(doc! { "_id": pid }, None).await {
        Ok(Some(p)) => p,
        _ => return (StatusCode::NOT_FOUND, Json(V2Msg { success: false, message: "Not found".into() })),
    };
    if paper.student_id != sid || paper.status != "in_progress" {
        return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Cannot autosave".into() }));
    }
    let now = BsonDateTime::now();
    if let Some(dl) = paper.server_deadline_at {
        if now > dl {
            return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Time expired".into() }));
        }
    }
    for r in payload.responses {
        if let Ok(qid) = ObjectId::parse_str(&r.question_id) {
            // Find by question_id (parent) OR by its specific versioned _id
            if let Some(m) = paper.questions.iter_mut().find(|x| x.question_id == qid) {
                m.student_response = Some(r.response);
            }
        }
    }
    paper.last_autosave_at = Some(now);
    match paper_coll.replace_one(doc! { "_id": pid }, &paper, None).await {
        Ok(_) => (StatusCode::OK, Json(V2Msg { success: true, message: "Saved".into() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(V2Msg { success: false, message: "Failed".into() })),
    }
}

#[derive(Debug, Deserialize)]
pub struct SubmitReq {
    pub responses: Vec<QuestionResp>,
    pub security_events: Option<Vec<String>>,
}

async fn evaluate_and_persist_paper(
    db: &Database,
    pid: &ObjectId,
    paper: &mut ExamV2Paper,
) -> Result<(), String> {
    let q_coll = db.collection::<ExamV2Question>("exam_v2_questions");
    let tpl = db
        .collection::<ExamV2PaperTemplate>("exam_v2_paper_templates")
        .find_one(doc! { "_id": paper.paper_template_id }, None)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Paper template missing".to_string())?;

    let mut total = 0.0;
    let mut sections: std::collections::HashMap<String, f64> = std::collections::HashMap::new();

    for m in paper.questions.iter_mut() {
        // --- 1. Version Locking Security ---
        // Always fetch the specific version locked during paper generation.
        let q_filter = doc! { 
            "parent_question_id": m.question_id, 
            "version": m.version 
        };
        
        let q = match q_coll.find_one(q_filter, None).await {
            Ok(Some(q)) => q,
            _ => {
                // Fallback to current if version not found (migration safety)
                match q_coll.find_one(doc! { "_id": m.question_id }, None).await {
                    Ok(Some(q)) => q,
                    _ => {
                        m.obtained_marks = 0.0;
                        m.evaluation_status = "error".into();
                        continue;
                    }
                }
            }
        };

        if q.question_type == "MCQ" {
            let (mk, ev) = eval_mcq(m, &q, &tpl);
            if ev {
                m.obtained_marks = mk;
                m.evaluation_status = "evaluated".into();
            }
            total += m.obtained_marks;
            *sections.entry(m.section_id.clone()).or_insert(0.0) += m.obtained_marks;
        } else {
            m.evaluation_status = "pending".into();
        }
    }

    paper.total_obtained_marks = total;
    paper.section_wise_marks = sections;
    paper.submit_time = Some(BsonDateTime::now());
    paper.status = if paper.questions.iter().all(|m| m.evaluation_status == "evaluated") {
        "evaluated".into()
    } else {
        "submitted".into()
    };

    // --- 3. Result Integrity Protection ---
    // Generate a secure HMAC hash of the final result state to prevent tampering via API.
    if let Ok(secret) = hmac_secret_val() {
        if let Ok(mut mac) = HmacSha256::new_from_slice(secret.as_bytes()) {
            mac.update(pid.to_hex().as_bytes());
            mac.update(format!("{:.2}", total).as_bytes());
            mac.update(paper.status.as_bytes());
            let hash = hex::encode(mac.finalize().into_bytes());
            paper.integrity_hash = Some(hash);
        }
    }

    // --- Analytics & Quality Score Update ---
    for m in &paper.questions {
        let q_coll = db.collection::<ExamV2Question>("exam_v2_questions");
        let q_filter = doc! { "_id": m.question_id };
        
        // Skip analytics if question missing during reconstruction
        if q_coll.find_one(q_filter.clone(), None).await.ok().flatten().is_none() {
            continue;
        }

        let mut update_doc = doc! { "$inc": { "total_attempts": 1 } };
        if m.evaluation_status == "evaluated" {
            let is_correct = m.obtained_marks > 0.0;
            let is_skipped = m.student_response.as_ref().map(|r| r.is_empty()).unwrap_or(true);
            
            if is_correct {
                update_doc.get_document_mut("$inc").unwrap().insert("correct_attempts", 1);
            }
            if is_skipped {
                update_doc.get_document_mut("$inc").unwrap().insert("skip_count", 1);
            }
            
            // Re-calculate accuracy and quality score asynchronously in a real system, 
            // but for this MVP we'll push the updates directly.
            let _ = q_coll.update_one(q_filter, update_doc, None).await;
        }
    }

    // Sync marks back to user model for certificate/marksheet generation compatibility
    if paper.status == "evaluated" {
        let mut subject_marks = Vec::new();
        for (sec_id, obtained) in &paper.section_wise_marks {
            if let Some(sec) = tpl.sections.iter().find(|s| &s.name == sec_id || format!("{:?}", s.marks) == *sec_id) {
                subject_marks.push(mongodb::bson::doc! {
                    "subject": sec_id.clone(),
                    "marks": obtained,
                    "total": sec.marks * (sec.count as f64)
                });
            }
        }
        if !subject_marks.is_empty() {
            let user_coll = db.collection::<mongodb::bson::Document>("users");
            let _ = user_coll.update_one(
                doc! { "_id": paper.student_id },
                doc! { "$set": { "marks": subject_marks } },
                None
            ).await;
        }
    }

    let paper_coll = db.collection::<ExamV2Paper>("exam_v2_papers");
    paper_coll
        .replace_one(doc! { "_id": pid }, paper, None)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn eval_mcq(
    mapping: &ExamV2PaperQuestion,
    bank: &ExamV2Question,
    template: &ExamV2PaperTemplate,
) -> (f64, bool) {
    let Some(ref ans) = mapping.student_response else {
        return (0.0, true);
    };
    
    if ans.is_empty() {
        return (0.0, true);
    }

    // 1. Check if selected option ID matches correct_option_id
    let mut ok = ans.trim() == bank.correct_option_id.trim();
    
    // 2. Fallback: Check if selected text matches correct option text (resilience for ID mismatches)
    if !ok {
        if let Some(correct_opt) = bank.options_pool.iter().find(|o| o.id == bank.correct_option_id) {
            // Check if student response is actually the text of an option
            if ans.trim().to_lowercase() == correct_opt.text.trim().to_lowercase() {
                ok = true;
            }
        }
    }

    // 3. Fallback: If student response is an ID, check if its text matches correct text
    if !ok {
        if let Some(selected_opt) = bank.options_pool.iter().find(|o| o.id == *ans) {
            if let Some(correct_opt) = bank.options_pool.iter().find(|o| o.id == bank.correct_option_id) {
                if selected_opt.text.trim().to_lowercase() == correct_opt.text.trim().to_lowercase() {
                    ok = true;
                }
            }
        }
    }
    
    if ok {
        return (bank.marks, true);
    }

    // Apply negative marks if incorrect and not empty
    if let Some(si) = mapping.section_id.strip_prefix('s').and_then(|s| s.parse::<usize>().ok()) {
        if let Some(sec) = template.sections.get(si) {
            if let Some(neg) = sec.negative_marks {
                return (-neg, true);
            }
        }
    }
    (0.0, true)
}

pub async fn v2_submit(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<SubmitReq>,
) -> (StatusCode, Json<V2Msg>) {
    if !student_ok(&claims.role) {
        return (StatusCode::FORBIDDEN, Json(V2Msg { success: false, message: "Unauthorized".into() }));
    }
    let pid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Bad id".into() })),
    };
    let sid = match ObjectId::parse_str(&claims.sub) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Bad user".into() })),
    };

    let paper_coll = db.collection::<ExamV2Paper>("exam_v2_papers");
    let mut paper = match paper_coll.find_one(doc! { "_id": pid }, None).await {
        Ok(Some(p)) => p,
        _ => return (StatusCode::NOT_FOUND, Json(V2Msg { success: false, message: "Not found".into() })),
    };
    if paper.student_id != sid || paper.status != "in_progress" {
        return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Invalid state".into() }));
    }

    let exam = match db
        .collection::<ExamV2Exam>("exam_v2_exams")
        .find_one(doc! { "_id": paper.exam_id }, None)
        .await
    {
        Ok(Some(e)) => e,
        _ => return (StatusCode::NOT_FOUND, Json(V2Msg { success: false, message: "Exam missing".into() })),
    };

    let now = BsonDateTime::now();
    if exam.exam_mode != "offline" {
        if let Some(dl) = paper.server_deadline_at {
            if now > dl {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(V2Msg {
                        success: false,
                        message: "Time expired — server will auto-submit; refresh exam state".into(),
                    }),
                );
            }
        }
    }

    for r in payload.responses {
        if let Ok(qid) = ObjectId::parse_str(&r.question_id) {
            if let Some(m) = paper.questions.iter_mut().find(|x| x.question_id == qid) {
                m.student_response = Some(r.response);
            }
        }
    }
    if let Some(log) = payload.security_events {
        paper.security_log = Some(log);
    }

    if let Err(e) = evaluate_and_persist_paper(&db, &pid, &mut paper).await {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(V2Msg { success: false, message: e }));
    }

    (StatusCode::OK, Json(V2Msg { success: true, message: "Submitted".into() }))
}

/// Center uploads offline attempt results (same shape as autosave + submit).
pub async fn v2_offline_submit(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<SubmitReq>,
) -> (StatusCode, Json<V2Msg>) {
    if !center_ok(&claims.role) && !admin_ok(&claims.role) {
        return (StatusCode::FORBIDDEN, Json(V2Msg { success: false, message: "Unauthorized".into() }));
    }
    let pid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Bad id".into() })),
    };
    let paper_coll = db.collection::<ExamV2Paper>("exam_v2_papers");
    let mut paper = match paper_coll.find_one(doc! { "_id": pid }, None).await {
        Ok(Some(p)) => p,
        _ => return (StatusCode::NOT_FOUND, Json(V2Msg { success: false, message: "Not found".into() })),
    };

    if center_ok(&claims.role) {
        let cid = match ObjectId::parse_str(&claims.sub) {
            Ok(o) => o,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Bad center".into() })),
        };
        if paper.center_id != cid {
            return (StatusCode::FORBIDDEN, Json(V2Msg { success: false, message: "Wrong center".into() }));
        }
    }

    let exam = match db
        .collection::<ExamV2Exam>("exam_v2_exams")
        .find_one(doc! { "_id": paper.exam_id }, None)
        .await
    {
        Ok(Some(e)) => e,
        _ => return (StatusCode::NOT_FOUND, Json(V2Msg { success: false, message: "Exam missing".into() })),
    };
    if exam.exam_mode != "offline" {
        return (
            StatusCode::BAD_REQUEST,
            Json(V2Msg {
                success: false,
                message: "Not an offline exam".into(),
            }),
        );
    }

    for r in payload.responses {
        if let Ok(qid) = ObjectId::parse_str(&r.question_id) {
            if let Some(m) = paper.questions.iter_mut().find(|x| x.question_id == qid) {
                m.student_response = Some(r.response);
            }
        }
    }
    if let Err(e) = evaluate_and_persist_paper(&db, &pid, &mut paper).await {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(V2Msg { success: false, message: e }));
    }

    // Do not override status: evaluate_and_persist_paper already set submitted vs evaluated from question rows.
    paper.offline_uploaded = true;
    match paper_coll.replace_one(doc! { "_id": pid }, &paper, None).await {
        Ok(_) => (StatusCode::OK, Json(V2Msg { success: true, message: "Offline results saved".into() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(V2Msg { success: false, message: "Failed".into() })),
    }
}

#[derive(Debug, Deserialize)]
pub struct MarksheetReq {
    pub exam_id: String,
    pub student_id: String,
    pub template_id: Option<String>,
}

pub async fn v2_generate_marksheet(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<MarksheetReq>,
) -> (StatusCode, Json<V2Msg>) {
    if !admin_ok(&claims.role) {
        return (StatusCode::FORBIDDEN, Json(V2Msg { success: false, message: "Unauthorized".into() }));
    }
    let exam_id = match ObjectId::parse_str(&payload.exam_id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Bad exam".into() })),
    };
    let student_id = match ObjectId::parse_str(&payload.student_id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Bad student".into() })),
    };
    let marksheet_template_id = payload.template_id.as_ref().and_then(|s| ObjectId::parse_str(s).ok());

    let exam = match db
        .collection::<ExamV2Exam>("exam_v2_exams")
        .find_one(doc! { "_id": exam_id }, None)
        .await
    {
        Ok(Some(e)) => e,
        _ => return (StatusCode::NOT_FOUND, Json(V2Msg { success: false, message: "Exam not found".into() })),
    };

    let paper_coll = db.collection::<ExamV2Paper>("exam_v2_papers");
    let paper = match paper_coll
        .find_one(
            doc! { "exam_id": exam_id, "student_id": student_id, "status": "evaluated" },
            None,
        )
        .await
    {
        Ok(Some(p)) => p,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(V2Msg {
                    success: false,
                    message: "No evaluated paper for student".into(),
                }),
            )
        }
    };

    let paper_tpl = match db
        .collection::<ExamV2PaperTemplate>("exam_v2_paper_templates")
        .find_one(doc! { "_id": exam.paper_id }, None)
        .await
    {
        Ok(Some(b)) => b,
        _ => return (StatusCode::INTERNAL_SERVER_ERROR, Json(V2Msg { success: false, message: "Paper template missing".into() })),
    };

    let total_marks = paper_tpl.total_marks;

    // Fetch practical and assignment marks if enabled in template
    let mut practical_marks = None;
    let mut assignment_marks = None;

    if paper_tpl.practical_enabled || paper_tpl.assignment_enabled {
        let marks_coll = db.collection::<PracticalAssignmentMarks>("practical_assignment_marks");
        let mut cursor = marks_coll.find(doc! { "student_id": student_id, "session_id": exam.session_id, "status": "approved" }, None).await.expect("Failed to fetch marks");
        while let Some(Ok(m)) = cursor.next().await {
            if m.marks_type == "practical" {
                practical_marks = Some(m.marks);
            } else if m.marks_type == "assignment" {
                assignment_marks = Some(m.marks);
            }
        }
    }

    let uid = ObjectId::parse_str(&claims.sub).ok();
    let ms = ExamV2Marksheet {
        id: None,
        student_id,
        exam_id,
        course_id: exam.course_id,
        session_id: exam.session_id,
        total_marks,
        obtained_marks: paper.total_obtained_marks + practical_marks.unwrap_or(0.0) + assignment_marks.unwrap_or(0.0),
        practical_marks,
        assignment_marks,
        exam_marks: Some(paper.total_obtained_marks),
        template_id: marksheet_template_id,
        pdf_path: None,
        status: "pending".into(),
        generated_at: Some(BsonDateTime::now()),
        generated_by: uid,
        created_at: BsonDateTime::now(),
    };

    let coll = db.collection::<ExamV2Marksheet>("exam_v2_marksheets");
    match coll.insert_one(ms, None).await {
        Ok(_) => (
            StatusCode::CREATED,
            Json(V2Msg {
                success: true,
                message: "Marksheet record created (PDF generation can be wired to template service)".into(),
            }),
        ),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(V2Msg { success: false, message: "Failed".into() })),
    }
}

pub async fn v2_list_marksheets(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<ExamV2Marksheet>>) {
    let coll = db.collection::<ExamV2Marksheet>("exam_v2_marksheets");
    let filter = match claims.role {
        UserRole::Admin | UserRole::SuperAdmin => doc! {},
        UserRole::Center => {
            // join via papers — simplified: list all for now; center filters client-side
            doc! {}
        }
        UserRole::Student => {
            let oid = match ObjectId::parse_str(&claims.sub) {
                Ok(o) => o,
                Err(_) => return (StatusCode::BAD_REQUEST, Json(vec![])),
            };
            doc! { "student_id": oid }
        }
        _ => return (StatusCode::FORBIDDEN, Json(vec![])),
    };
    let mut cur = match coll.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };
    let mut v = Vec::new();
    while let Some(Ok(m)) = cur.next().await {
        v.push(m);
    }
    (StatusCode::OK, Json(v))
}

#[derive(Debug, Serialize)]
pub struct ExamLockInfo {
    pub exam_id: String,
    pub exam_name: String,
    pub paper_id: String,
    pub lock_at_ms: i64,
    pub start_at_ms: i64,
    pub end_at_ms: i64,
}

#[derive(Debug, Serialize)]
pub struct StudentExamContext {
    pub server_now_ms: i64,
    pub exam_lock: Option<ExamLockInfo>,
}

fn lock_ui_ms(exam: &ExamV2Exam) -> i64 {
    if let Some(l) = exam.lock_ui_at {
        return l.timestamp_millis();
    }
    let start = exam.start_at.timestamp_millis();
    (start - 10 * 60_000).max(0)
}

/// Server time + optional pre-exam lock window (T−10 min by default) for dashboard takeover.
pub async fn v2_student_exam_context(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<StudentExamContext>) {
    let now_ms = BsonDateTime::now().timestamp_millis();
    if !student_ok(&claims.role) {
        return (
            StatusCode::FORBIDDEN,
            Json(StudentExamContext {
                server_now_ms: now_ms,
                exam_lock: None,
            }),
        );
    }
    let sid = match ObjectId::parse_str(&claims.sub) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(StudentExamContext {
                    server_now_ms: now_ms,
                    exam_lock: None,
                }),
            )
        }
    };
    let paper_coll = db.collection::<ExamV2Paper>("exam_v2_papers");
    let exam_coll = db.collection::<ExamV2Exam>("exam_v2_exams");
    let mut cur = match paper_coll.find(doc! { "student_id": sid }, None).await {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(StudentExamContext {
                    server_now_ms: now_ms,
                    exam_lock: None,
                }),
            )
        }
    };
    let mut best: Option<ExamLockInfo> = None;
    while let Some(Ok(paper)) = cur.next().await {
        if paper.status != "generated" {
            continue;
        }
        let Ok(Some(exam)) = exam_coll.find_one(doc! { "_id": paper.exam_id }, None).await else {
            continue;
        };
        let lock_ms = lock_ui_ms(&exam);
        let start_ms = exam.start_at.timestamp_millis();
        let end_ms = exam.end_at.timestamp_millis();
        if now_ms >= lock_ms && now_ms < start_ms {
            let paper_id = paper.id.map(|x| x.to_hex()).unwrap_or_default();
            let info = ExamLockInfo {
                exam_id: paper.exam_id.to_hex(),
                exam_name: exam.name.clone(),
                paper_id,
                lock_at_ms: lock_ms,
                start_at_ms: start_ms,
                end_at_ms: end_ms,
            };
            best = match best {
                None => Some(info),
                Some(b) if info.start_at_ms < b.start_at_ms => Some(info),
                Some(b) => Some(b),
            };
        }
    }
    (
        StatusCode::OK,
        Json(StudentExamContext {
            server_now_ms: now_ms,
            exam_lock: best,
        }),
    )
}

/// Generate PDF for marksheet row (admin). Writes under UPLOAD_DIR/exam_v2_marksheets/.
pub async fn v2_marksheet_render_pdf(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<V2Msg>) {
    if !admin_ok(&claims.role) {
        return (StatusCode::FORBIDDEN, Json(V2Msg { success: false, message: "Unauthorized".into() }));
    }
    let ms_id = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Bad id".into() })),
    };
    let coll = db.collection::<ExamV2Marksheet>("exam_v2_marksheets");
    let mut ms = match coll.find_one(doc! { "_id": ms_id }, None).await {
        Ok(Some(m)) => m,
        _ => return (StatusCode::NOT_FOUND, Json(V2Msg { success: false, message: "Not found".into() })),
    };
    let exam = match db
        .collection::<ExamV2Exam>("exam_v2_exams")
        .find_one(doc! { "_id": ms.exam_id }, None)
        .await
    {
        Ok(Some(e)) => e,
        _ => return (StatusCode::NOT_FOUND, Json(V2Msg { success: false, message: "Exam missing".into() })),
    };
    let html = format!(
        r#"<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body {{ font-family: system-ui; padding: 24px; }}
        h1 {{ color: #0a4d8c; }}
        </style></head><body>
        <h1>Marksheet</h1>
        <p><b>Exam:</b> {}</p>
        <p><b>Total:</b> {} &nbsp; <b>Obtained:</b> {}</p>
        <p>Student ID: {}</p>
        </body></html>"#,
        html_escape::encode_text(&exam.name).to_string(),
        ms.total_marks,
        ms.obtained_marks,
        ms.student_id.to_hex()
    );
    let upload_dir = std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string());
    let sub = format!("{}/exam_v2_marksheets", upload_dir);
    let _ = std::fs::create_dir_all(&sub);
    let path = std::path::PathBuf::from(&sub).join(format!("{}.pdf", ms_id.to_hex()));
    let pdf_err: Option<String> = match crate::services::pdf_generator::PdfGenerator::html_to_pdf(&html, path.clone()) {
        Ok(()) => None,
        Err(e) => Some(e.to_string()),
    };
    if let Some(err) = pdf_err {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(V2Msg {
                success: false,
                message: format!("PDF failed: {err}"),
            }),
        );
    }
    let url = format!("/uploads/exam_v2_marksheets/{}.pdf", ms_id.to_hex());
    ms.pdf_path = Some(url.clone());
    ms.status = "ready".into();
    ms.generated_at = Some(BsonDateTime::now());
    let _ = coll.replace_one(doc! { "_id": ms_id }, ms, None).await;
    (
        StatusCode::OK,
        Json(V2Msg {
            success: true,
            message: url,
        }),
    )
}

#[derive(Debug, Deserialize)]
pub struct BulkZipQuery {
    pub exam_id: String,
}

pub async fn v2_marksheets_bulk_zip(
    State(db): State<Database>,
    claims: Claims,
    Query(q): Query<BulkZipQuery>,
) -> Result<axum::response::Response, (StatusCode, Json<V2Msg>)> {
    if !admin_ok(&claims.role) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(V2Msg {
                success: false,
                message: "Unauthorized".into(),
            }),
        ));
    }
    let exam_id = ObjectId::parse_str(&q.exam_id).map_err(|_| {
        (
            StatusCode::BAD_REQUEST,
            Json(V2Msg {
                success: false,
                message: "Bad exam id".into(),
            }),
        )
    })?;
    let coll = db.collection::<ExamV2Marksheet>("exam_v2_marksheets");
    let mut cur = coll
        .find(doc! { "exam_id": exam_id, "status": "ready" }, None)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(V2Msg {
                    success: false,
                    message: "DB error".into(),
                }),
            )
        })?;
    let upload_dir = std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string());
    let mut buf = std::io::Cursor::new(Vec::new());
    {
        let mut zip = zip::ZipWriter::new(&mut buf);
        let opts = zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        while let Some(Ok(ms)) = cur.next().await {
            let Some(ref rel) = ms.pdf_path else { continue };
            let fname = rel.trim_start_matches("/uploads/");
            let disk = std::path::Path::new(&upload_dir).join(fname);
            if let Ok(data) = std::fs::read(&disk) {
                let name = format!("marksheet_{}.pdf", ms.student_id.to_hex());
                if zip.start_file(&name, opts).is_ok() {
                    let _ = zip.write_all(&data);
                }
            }
        }
        let _ = zip.finish();
    }
    let bytes = buf.into_inner();
    if bytes.is_empty() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(V2Msg {
                success: false,
                message: "No PDFs to zip".into(),
            }),
        ));
    }
    Ok((
        StatusCode::OK,
        [(
            axum::http::header::CONTENT_TYPE,
            axum::http::HeaderValue::from_static("application/zip"),
        )],
        bytes,
    )
        .into_response())
}

// --- Academic ERP: Practical & Assignment Marks ---

#[derive(Debug, Deserialize)]
pub struct SubmitMarksRequest {
    pub student_id: String,
    pub subject_id: String,
    pub session_id: String,
    pub marks_type: String, // "practical" | "assignment"
    pub marks: f64,
    pub max_marks: f64,
}

pub async fn v2_submit_marks(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<SubmitMarksRequest>,
) -> (StatusCode, Json<V2Msg>) {
    if !admin_ok(&claims.role) && !center_ok(&claims.role) {
        return (StatusCode::FORBIDDEN, Json(V2Msg { success: false, message: "Unauthorized".into() }));
    }
    
    let sid = match ObjectId::parse_str(&payload.student_id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Invalid student".into() })),
    };
    let sub_id = match ObjectId::parse_str(&payload.subject_id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Invalid subject".into() })),
    };
    let sess_id = match ObjectId::parse_str(&payload.session_id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Invalid session".into() })),
    };
    
    let center_id = match claims.role {
        UserRole::Center => ObjectId::parse_str(&claims.sub).unwrap(),
        _ => {
            let user_coll = db.collection::<User>("users");
            match user_coll.find_one(doc! { "_id": sid }, None).await {
                Ok(Some(u)) => u.parent_id.unwrap_or(ObjectId::parse_str("000000000000000000000000").unwrap()),
                _ => return (StatusCode::NOT_FOUND, Json(V2Msg { success: false, message: "Student not found".into() })),
            }
        }
    };

    let coll = db.collection::<PracticalAssignmentMarks>("practical_assignment_marks");
    let filter = doc! { "student_id": sid, "subject_id": sub_id, "session_id": sess_id, "marks_type": &payload.marks_type };
    
    let existing = coll.find_one(filter.clone(), None).await.ok().flatten();
    if let Some(m) = existing {
        if m.status == "approved" {
            return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Marks already approved and cannot be changed".into() }));
        }
    }

    let marks_record = PracticalAssignmentMarks {
        id: None,
        student_id: sid,
        subject_id: sub_id,
        session_id: sess_id,
        center_id,
        marks_type: payload.marks_type,
        marks: payload.marks,
        max_marks: payload.max_marks,
        status: "pending".into(),
        created_at: BsonDateTime::now(),
        updated_at: BsonDateTime::now(),
    };

    let mut doc = mongodb::bson::to_document(&marks_record).unwrap();
    doc.remove("_id");

    let options = mongodb::options::UpdateOptions::builder().upsert(true).build();
    match coll.update_one(filter, doc! { "$set": doc }, options).await {
        Ok(_) => (StatusCode::OK, Json(V2Msg { success: true, message: "Marks submitted successfully".into() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(V2Msg { success: false, message: "Failed to submit marks".into() })),
    }
}

pub async fn v2_approve_marks(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<V2Msg>) {
    if !admin_ok(&claims.role) {
        return (StatusCode::FORBIDDEN, Json(V2Msg { success: false, message: "Unauthorized".into() }));
    }
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "Invalid ID".into() })),
    };
    let coll = db.collection::<PracticalAssignmentMarks>("practical_assignment_marks");
    match coll.update_one(doc! { "_id": oid }, doc! { "$set": { "status": "approved", "updated_at": BsonDateTime::now() } }, None).await {
        Ok(_) => (StatusCode::OK, Json(V2Msg { success: true, message: "Marks approved".into() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(V2Msg { success: false, message: "Failed to approve marks".into() })),
    }
}

pub async fn v2_list_marks(
    State(db): State<Database>,
    claims: Claims,
    Query(q): Query<serde_json::Value>,
) -> (StatusCode, Json<Vec<PracticalAssignmentMarks>>) {
    let coll = db.collection::<PracticalAssignmentMarks>("practical_assignment_marks");
    let mut filter = doc! {};
    if center_ok(&claims.role) {
        let cid = ObjectId::parse_str(&claims.sub).unwrap();
        filter.insert("center_id", cid);
    }
    if let Some(sid) = q.get("student_id").and_then(|v| v.as_str()) {
        if let Ok(oid) = ObjectId::parse_str(sid) {
            filter.insert("student_id", oid);
        }
    }
    let mut cur = match coll.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };
    let mut v = Vec::new();
    while let Some(Ok(m)) = cur.next().await {
        v.push(m);
    }
    (StatusCode::OK, Json(v))
}

// --- Academic ERP: Reappear System ---

#[derive(Debug, Deserialize)]
pub struct ReappearRequest {
    pub subject_id: String,
    pub session_id: String,
    pub payment_id: String,
    pub amount: f64,
}

pub async fn v2_apply_reappear(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<ReappearRequest>,
) -> (StatusCode, Json<V2Msg>) {
    if !student_ok(&claims.role) {
        return (StatusCode::FORBIDDEN, Json(V2Msg { success: false, message: "Students only".into() }));
    }
    let sid = ObjectId::parse_str(&claims.sub).unwrap();
    let sub_id = ObjectId::parse_str(&payload.subject_id).unwrap();
    let sess_id = ObjectId::parse_str(&payload.session_id).unwrap();

    let pay_coll = db.collection::<ReappearPayment>("reappear_payments");
    let payment = ReappearPayment {
        id: None,
        student_id: sid,
        subject_id: sub_id,
        session_id: sess_id,
        attempt_no: 2,
        payment_id: payload.payment_id,
        amount: payload.amount,
        status: "paid".into(),
        created_at: BsonDateTime::now(),
    };
    let _ = pay_coll.insert_one(payment, None).await;

    let tpl_coll = db.collection::<ExamV2PaperTemplate>("exam_v2_paper_templates");
    let tpl = match tpl_coll.find_one(doc! { "subject_id": sub_id }, None).await {
        Ok(Some(t)) => t,
        _ => return (StatusCode::BAD_REQUEST, Json(V2Msg { success: false, message: "No template found for this subject".into() })),
    };

    let alloc_coll = db.collection::<ReappearAllocation>("reappear_allocations");
    let allocation = ReappearAllocation {
        id: None,
        student_id: sid,
        subject_id: sub_id,
        session_id: sess_id,
        attempt_no: 2,
        blueprint_id: tpl.id.unwrap(),
        question_bank_id: tpl.question_bank_id,
        created_at: BsonDateTime::now(),
    };

    match alloc_coll.insert_one(allocation, None).await {
        Ok(_) => (StatusCode::OK, Json(V2Msg { success: true, message: "Reappear applied successfully".into() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(V2Msg { success: false, message: "Failed to allocate reappear".into() })),
    }
}
