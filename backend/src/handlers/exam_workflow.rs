//! Exam workflow: bulk allotment, reappear management, marks entry.
use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use futures_util::stream::StreamExt;
use mongodb::{
    Database,
    bson::{Document, doc, oid::ObjectId},
};
use serde::{Deserialize, Serialize};

use crate::handlers::exam_engine::{
    ExamEngineResponse, insert_generated_student_paper, mark_course_attempt_appeared,
    pick_questions_for_blueprint,
};
use crate::models::certificate::CertificateType;
use crate::models::certificate_auto_generation::CertificateEligibility;
use crate::models::course::Course;
use crate::models::exam_engine::{
    ExamBlueprint, PaperQuestionMapping, StudentPaper, SubjectBlueprintConfig,
};
use crate::models::exam_workflow::{
    AllotmentSubjectSlot, CourseExamAttempt, ExamAllotmentBatch, MarksChangeRequest,
    SubjectQuestionSet,
};
use crate::models::user::{Claims, User, UserRole};
use crate::services::exam_eligibility::{
    check_first_attempt_eligibility, check_marks_entry_list_visibility,
    check_marks_entry_submit_eligibility, check_reappear_eligibility, is_online_exam_mode,
    latest_course_attempt, latest_submitted_course_attempt, max_course_attempt_number,
};
use crate::services::marks_calculation::{self, SubjectMarkInput};
use chrono::{Datelike, Timelike, Utc};
use chrono_tz::Asia::Kolkata;

// #region debug-point E:report-helper
async fn report_auto_exam_debug(
    run_id: &str,
    hypothesis_id: &str,
    location: &str,
    msg: &str,
    data: serde_json::Value,
) {
    let env_path = "/var/www/html/scre/.dbg/auto-exam-allotment.env";
    let mut debug_server_url = "http://127.0.0.1:7780/event".to_string();
    let mut session_id = "auto-exam-allotment".to_string();
    if let Ok(env_text) = std::fs::read_to_string(env_path) {
        for line in env_text.lines() {
            if let Some(value) = line.strip_prefix("DEBUG_SERVER_URL=") {
                debug_server_url = value.trim().to_string();
            } else if let Some(value) = line.strip_prefix("DEBUG_SESSION_ID=") {
                session_id = value.trim().to_string();
            }
        }
    }
    let payload = serde_json::json!({
        "sessionId": session_id,
        "runId": run_id,
        "hypothesisId": hypothesis_id,
        "location": location,
        "msg": msg,
        "data": data,
        "ts": Utc::now().timestamp_millis(),
    });
    let _ = reqwest::Client::new()
        .post(debug_server_url)
        .json(&payload)
        .send()
        .await;
}
// #endregion

async fn get_course(db: &Database, course_id: &ObjectId) -> Option<Course> {
    db.collection::<Course>("courses")
        .find_one(doc! { "_id": course_id }, None)
        .await
        .ok()
        .flatten()
}

async fn get_course_subject_ids(db: &Database, course_id: &ObjectId) -> Vec<ObjectId> {
    let coll = db.collection::<Document>("course_subjects");
    let mut ids = Vec::new();
    if let Ok(mut cursor) = coll.find(doc! { "course_id": course_id }, None).await {
        while let Some(Ok(d)) = cursor.next().await {
            if let Ok(oid) = d.get_object_id("subject_id") {
                ids.push(oid);
            }
        }
    }
    ids
}

/// Parent id values stored on students for a center (login user id and/or center document id).
fn center_parent_ids(center: &crate::models::center::Center) -> Vec<ObjectId> {
    let mut ids = vec![center.user_id];
    if let Some(doc_id) = center.id {
        if doc_id != center.user_id {
            ids.push(doc_id);
        }
    }
    ids
}

/// Resolve student `parent_id` values for selected center documents.
/// Accepts center document `_id` or center login `user_id` in the input list.
/// Students may reference either id on `parent_id`.
/// Inactive/suspended/deleted centers are excluded.
async fn resolve_parent_ids_for_centers(
    db: &Database,
    center_doc_ids: &[ObjectId],
) -> Vec<ObjectId> {
    println!(
        "DEBUG: resolve_parent_ids_for_centers: center_doc_ids: {:?}",
        center_doc_ids
    );
    let centers_coll = db.collection::<crate::models::center::Center>("centers");
    let mut valid_parent_ids: Vec<ObjectId> = Vec::new();
    let filter = doc! {
        "$or": [
            { "_id": { "$in": center_doc_ids } },
            { "user_id": { "$in": center_doc_ids } },
        ],
        "active": true,
        "is_deleted": false,
    };
    println!(
        "DEBUG: resolve_parent_ids_for_centers: query filter: {:?}",
        filter
    );
    if let Ok(mut cursor) = centers_coll.find(filter, None).await {
        while let Some(Ok(center)) = cursor.next().await {
            println!(
                "DEBUG: resolve_parent_ids_for_centers: found center: _id={:?}, user_id={:?}",
                center.id, center.user_id
            );
            valid_parent_ids.extend(center_parent_ids(&center));
        }
    }
    valid_parent_ids.sort_unstable();
    valid_parent_ids.dedup();
    println!(
        "DEBUG: resolve_parent_ids_for_centers: returning valid_parent_ids: {:?}",
        valid_parent_ids
    );
    valid_parent_ids
}

async fn active_center_parent_ids(db: &Database) -> Vec<ObjectId> {
    let centers_coll = db.collection::<crate::models::center::Center>("centers");
    let mut parent_ids: Vec<ObjectId> = Vec::new();
    if let Ok(mut cursor) = centers_coll
        .find(doc! { "active": true, "is_deleted": false }, None)
        .await
    {
        while let Some(Ok(center)) = cursor.next().await {
            parent_ids.extend(center_parent_ids(&center));
        }
    }
    parent_ids.sort_unstable();
    parent_ids.dedup();
    parent_ids
}

async fn fetch_students_for_course(
    db: &Database,
    course_id: &ObjectId,
    course_name: Option<&str>,
    center_ids: Option<Vec<ObjectId>>,
) -> Vec<User> {
    let coll = db.collection::<User>("users");
    let mut course_or = vec![doc! { "course_id": course_id }];
    if let Some(name) = course_name {
        let trimmed = name.trim();
        if !trimmed.is_empty() {
            course_or.push(doc! {
                "course": { "$regex": format!("^{}$", regex::escape(trimmed)), "$options": "i" }
            });
        }
    }
    let mut filter = doc! {
        "role": "student",
        "active": true,
        "is_deleted": { "$ne": true },
        "$or": course_or,
    };

    // Only include students belonging to active (non-suspended/deleted) centers
    let active_parent_ids = active_center_parent_ids(db).await;
    println!(
        "DEBUG: fetch_students_for_course: active_parent_ids: {:?}",
        active_parent_ids
    );
    println!(
        "DEBUG: fetch_students_for_course: center_ids input: {:?}",
        center_ids
    );

    if let Some(cids) = center_ids {
        if !cids.is_empty() {
            let valid_parent_ids = resolve_parent_ids_for_centers(db, &cids).await;
            println!(
                "DEBUG: fetch_students_for_course: cids: {:?}, valid_parent_ids: {:?}",
                cids, valid_parent_ids
            );
            if valid_parent_ids.is_empty() {
                return vec![];
            }
            // When every active center is selected, parent scope equals the no-filter case.
            let mut scoped_parent_ids = active_parent_ids.clone();
            scoped_parent_ids.sort_unstable();
            scoped_parent_ids.dedup();
            let use_parent_ids = if valid_parent_ids == scoped_parent_ids {
                active_parent_ids.clone()
            } else {
                valid_parent_ids
            };
            println!(
                "DEBUG: fetch_students_for_course: use_parent_ids: {:?}",
                use_parent_ids
            );
            filter.insert("parent_id", doc! { "$in": use_parent_ids });
        } else if !active_parent_ids.is_empty() {
            filter.insert("parent_id", doc! { "$in": active_parent_ids.clone() });
        } else {
            return vec![];
        }
    } else if !active_parent_ids.is_empty() {
        filter.insert("parent_id", doc! { "$in": active_parent_ids.clone() });
    } else {
        return vec![];
    }

    println!(
        "DEBUG: fetch_students_for_course: final filter: {:?}",
        filter
    );

    let mut students = Vec::new();
    if let Ok(mut cursor) = coll.find(filter.clone(), None).await {
        while let Some(Ok(u)) = cursor.next().await {
            println!(
                "DEBUG: fetch_students_for_course: found student: id={:?}, parent_id={:?}, full_name={:?}",
                u.id, u.parent_id, u.full_name
            );
            students.push(u);
        }
    }

    println!(
        "DEBUG: fetch_students_for_course: total students found: {}",
        students.len()
    );
    students
}

fn flatten_center_id_strings(ids: Option<CenterIds>) -> Vec<String> {
    println!("DEBUG: flatten_center_id_strings: input ids: {:?}", ids);
    match ids {
        Some(center_ids) => center_ids.0,
        None => vec![],
    }
}

fn parse_center_id_filter(ids: Option<CenterIds>) -> Option<Vec<ObjectId>> {
    println!("DEBUG: parse_center_id_filter: input ids: {:?}", ids);
    let parsed: Vec<ObjectId> = flatten_center_id_strings(ids)
        .iter()
        .filter_map(|id| {
            let res = ObjectId::parse_str(id);
            println!(
                "DEBUG: parse_center_id_filter: parsing id {:?}: {:?}",
                id, res
            );
            res.ok()
        })
        .collect();
    println!("DEBUG: parse_center_id_filter: output: {:?}", parsed);
    if parsed.is_empty() {
        None
    } else {
        Some(parsed)
    }
}

fn parse_dt(s: &str) -> Option<mongodb::bson::DateTime> {
    chrono::DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| mongodb::bson::DateTime::from_millis(dt.timestamp_millis()))
}

fn clone_questions(qs: &[PaperQuestionMapping]) -> Vec<PaperQuestionMapping> {
    qs.iter()
        .map(|q| PaperQuestionMapping {
            section_id: q.section_id.clone(),
            question_id: q.question_id,
            order: q.order,
            student_response: None,
            obtained_marks: 0.0,
            evaluation_status: "Pending".to_string(),
            evaluator_remarks: None,
        })
        .collect()
}

async fn next_attempt_number(db: &Database, student_id: &ObjectId, course_id: &ObjectId) -> i32 {
    if let Some(latest) = latest_course_attempt(db, student_id, course_id).await {
        if latest
            .overall_result
            .as_deref()
            .map(|r| r.eq_ignore_ascii_case("fail"))
            .unwrap_or(false)
            && latest.allow_reappear
        {
            return latest.attempt_number + 1;
        }
        return latest.attempt_number;
    }
    1
}

async fn get_pending_change_request(
    db: &Database,
    student_id: &ObjectId,
    course_id: &ObjectId,
    attempt_number: i32,
) -> Option<MarksChangeRequest> {
    db.collection::<MarksChangeRequest>("marks_change_requests")
        .find_one(
            doc! {
                "student_id": student_id,
                "course_id": course_id,
                "attempt_number": attempt_number,
                "status": "pending"
            },
            mongodb::options::FindOneOptions::builder()
                .sort(doc! { "created_at": -1 })
                .build(),
        )
        .await
        .ok()
        .flatten()
}

async fn get_latest_change_request(
    db: &Database,
    student_id: &ObjectId,
    course_id: &ObjectId,
    attempt_number: i32,
) -> Option<MarksChangeRequest> {
    db.collection::<MarksChangeRequest>("marks_change_requests")
        .find_one(
            doc! {
                "student_id": student_id,
                "course_id": course_id,
                "attempt_number": attempt_number,
            },
            mongodb::options::FindOneOptions::builder()
                .sort(doc! { "created_at": -1 })
                .build(),
        )
        .await
        .ok()
        .flatten()
}

async fn blueprint_context_for_subject(
    db: &Database,
    student_id: &ObjectId,
    subject_id: &ObjectId,
    attempt_number: i32,
) -> (Option<ExamBlueprint>, Option<SubjectBlueprintConfig>) {
    let paper_coll = db.collection::<StudentPaper>("student_papers");
    let paper = paper_coll
        .find_one(
            doc! {
                "student_id": student_id,
                "subject_id": subject_id,
                "attempt_number": attempt_number,
            },
            None,
        )
        .await
        .ok()
        .flatten();

    let blueprint = if let Some(ref paper) = paper {
        db.collection::<ExamBlueprint>("exam_blueprints")
            .find_one(doc! { "_id": paper.blueprint_id }, None)
            .await
            .ok()
            .flatten()
    } else {
        None
    };

    let subject_config = paper
        .as_ref()
        .and_then(|p| p.subject_config_snapshot.clone())
        .or_else(|| {
            blueprint
                .as_ref()
                .and_then(|b| b.subjects.iter().find(|s| s.subject_id == *subject_id).cloned())
        });

    (blueprint, subject_config)
}

async fn load_exam_marks_for_subject(
    db: &Database,
    student: &User,
    subject_id: &ObjectId,
    attempt_number: i32,
) -> (f64, f64, bool, bool) {
    let online = is_online_exam_mode(&student.exam_mode);
    let paper_coll = db.collection::<StudentPaper>("student_papers");
    let now = mongodb::bson::DateTime::now();

    let paper = paper_coll
        .find_one(
            doc! {
                "student_id": student.id,
                "subject_id": subject_id,
                "attempt_number": attempt_number,
            },
            None,
        )
        .await
        .ok()
        .flatten();

    let (bp, subject_config) =
        blueprint_context_for_subject(db, student.id.as_ref().unwrap(), subject_id, attempt_number)
            .await;
    let exam_total = subject_config
        .as_ref()
        .map(|sc| sc.final_exam_component.marks)
        .or_else(|| {
            bp.as_ref().map(|b| {
                b.components
                    .as_ref()
                    .map(|c| c.exam_marks)
                    .unwrap_or(b.total_marks)
            })
        })
        .unwrap_or(100.0);
    let practical_total = subject_config
        .as_ref()
        .map(|sc| sc.practical_component.marks)
        .or_else(|| {
            bp.as_ref()
                .and_then(|b| b.components.as_ref().map(|c| c.practical_marks))
        })
        .unwrap_or(0.0);
    let assignment_total = subject_config
        .as_ref()
        .map(|sc| sc.assignment_component.marks)
        .or_else(|| {
            bp.as_ref()
                .and_then(|b| b.components.as_ref().map(|c| c.assignment_marks))
        })
        .unwrap_or(0.0);
    let _ = (practical_total, assignment_total);

    if let Some(p) = paper {
        if matches!(
            p.status.as_str(),
            "Submitted" | "Evaluated" | "submitted" | "evaluated"
        ) {
            let obtained = p.total_obtained_marks;
            return (obtained, exam_total, online, online);
        }
        if p.status == "InProgress" {
            return (p.total_obtained_marks, exam_total, online, online);
        }
        // Allotted but expired / never attempted
        if p.status == "Generated" {
            let expired = p.end_window.map(|e| now > e).unwrap_or(false);
            let never_started = p.start_time.is_none();
            if expired && never_started {
                return (0.0, exam_total, online, online);
            }
            if !expired {
                return (0.0, exam_total, online, online);
            }
        }
    }

    if online {
        return (0.0, exam_total, online, true);
    }

    (0.0, exam_total, false, false)
}

async fn ensure_next_attempt_on_fail(
    db: &Database,
    student_id: ObjectId,
    course_id: ObjectId,
    center_id: ObjectId,
    failed_attempt: i32,
) {
    if failed_attempt < 1 {
        return;
    }
    let coll = db.collection::<CourseExamAttempt>("course_exam_attempts");
    let next_no = failed_attempt + 1;
    let exists = coll
        .find_one(
            doc! {
                "student_id": student_id,
                "course_id": course_id,
                "attempt_number": next_no
            },
            None,
        )
        .await
        .ok()
        .flatten()
        .is_some();
    if exists {
        return;
    }
    let _ = coll
        .update_one(
            doc! {
                "student_id": student_id,
                "course_id": course_id,
                "attempt_number": next_no
            },
            doc! {
                "$setOnInsert": {
                    "student_id": student_id,
                    "course_id": course_id,
                    "center_id": center_id,
                    "attempt_number": next_no,
                    "appeared": false,
                    "allow_reappear": false,
                    "reappear_locked": false,
                    "overall_result": "pending",
                    "subject_marks": [],
                    "total_obtained": 0.0,
                    "total_marks": 0.0,
                    "percentage": 0.0,
                    "marks_submitted": false,
                    "marks_edit_unlocked": false,
                    "is_reappear_student": true,
                    "created_at": mongodb::bson::DateTime::now(),
                    "updated_at": mongodb::bson::DateTime::now(),
                }
            },
            mongodb::options::UpdateOptions::builder()
                .upsert(true)
                .build(),
        )
        .await;
}

#[derive(Debug, Deserialize)]
pub struct BulkAllotSubject {
    pub subject_id: String,
    pub blueprint_id: String,
    pub start_window: String,
    pub end_window: String,
    pub bank_id_override: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BulkAllotRequest {
    pub course_id: String,
    pub for_reappear: bool,
    pub force: Option<bool>,
    pub center_ids: Option<CenterIds>,
    pub subjects: Vec<BulkAllotSubject>,
}

#[derive(Debug, Serialize)]
pub struct BulkAllotResponse {
    pub success: bool,
    pub message: String,
    pub batch_id: Option<String>,
    pub allotted_count: u32,
    pub skipped: Vec<SkippedStudent>,
}

#[derive(Debug, Serialize)]
pub struct SkippedStudent {
    pub student_id: String,
    pub name: String,
    pub reason: String,
}

pub async fn internal_bulk_allot(
    db: &Database,
    created_by: ObjectId,
    center_filter: Option<Vec<ObjectId>>,
    source: Option<String>,
    payload: BulkAllotRequest,
) -> (StatusCode, Json<BulkAllotResponse>) {
    let course_oid = match ObjectId::parse_str(&payload.course_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(BulkAllotResponse {
                    success: false,
                    message: "Invalid course_id".into(),
                    batch_id: None,
                    allotted_count: 0,
                    skipped: vec![],
                }),
            );
        }
    };

    let course = match get_course(db, &course_oid).await {
        Some(c) => c,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(BulkAllotResponse {
                    success: false,
                    message: "Course not found".into(),
                    batch_id: None,
                    allotted_count: 0,
                    skipped: vec![],
                }),
            );
        }
    };

    let course_name = course.course_name.clone();
    let subject_ids = get_course_subject_ids(db, &course_oid).await;

    let students =
        fetch_students_for_course(db, &course_oid, Some(&course_name), center_filter).await;

    let bp_coll = db.collection::<ExamBlueprint>("exam_blueprints");
    let mut subject_slots: Vec<AllotmentSubjectSlot> = Vec::new();
    let mut question_sets: Vec<SubjectQuestionSet> = Vec::new();
    let mut skipped_subject_reasons: Vec<String> = Vec::new();
    let batch_seed = mongodb::bson::DateTime::now().timestamp_millis() as u64;

    for (idx, sub) in payload.subjects.iter().enumerate() {
        let sub_oid = match ObjectId::parse_str(&sub.subject_id) {
            Ok(o) => o,
            Err(_) => {
                skipped_subject_reasons.push(format!("subject_id={}: invalid id", sub.subject_id));
                continue;
            }
        };
        let bp_oid = match ObjectId::parse_str(&sub.blueprint_id) {
            Ok(o) => o,
            Err(_) => {
                skipped_subject_reasons.push(format!(
                    "subject_id={}: invalid blueprint_id",
                    sub.subject_id
                ));
                continue;
            }
        };
        let bp = match bp_coll.find_one(doc! { "_id": bp_oid }, None).await {
            Ok(Some(b)) => b,
            Ok(None) => {
                skipped_subject_reasons.push(format!(
                    "subject_id={}: blueprint not found",
                    sub.subject_id
                ));
                continue;
            }
            Err(e) => {
                skipped_subject_reasons.push(format!(
                    "subject_id={}: blueprint db error: {}",
                    sub.subject_id, e
                ));
                continue;
            }
        };
        let bank_override = sub
            .bank_id_override
            .as_ref()
            .and_then(|id| ObjectId::parse_str(id).ok());
        let subject_config = bp.subjects.iter().find(|s| s.subject_id == sub_oid);
        let seed = batch_seed.wrapping_add(idx as u64);
        let questions = match pick_questions_for_blueprint(
            db,
            &bp,
            subject_config,
            bank_override,
            payload.for_reappear,
            Some(seed),
        )
        .await
        {
            Ok(q) => q,
            Err((_, e)) => {
                skipped_subject_reasons.push(format!(
                    "subject_id={}: {}",
                    sub.subject_id, e.message
                ));
                eprintln!(
                    "[internal_bulk_allot] SKIP subject {}: {}",
                    sub.subject_id, e.message
                );
                continue;
            }
        };

        subject_slots.push(AllotmentSubjectSlot {
            subject_id: sub_oid,
            blueprint_id: bp_oid,
            start_window: parse_dt(&sub.start_window),
            end_window: parse_dt(&sub.end_window),
            bank_id_override: bank_override,
        });
        question_sets.push(SubjectQuestionSet {
            subject_id: sub_oid,
            blueprint_id: bp_oid,
            questions,
        });
    }

    if subject_slots.is_empty() {
        let msg = if skipped_subject_reasons.is_empty() {
            "No valid subjects to allot".into()
        } else {
            format!(
                "No valid subjects to allot. Skipped {} subject(s): {}",
                skipped_subject_reasons.len(),
                skipped_subject_reasons.join("; ")
            )
        };
        return (
            StatusCode::BAD_REQUEST,
            Json(BulkAllotResponse {
                success: false,
                message: msg,
                batch_id: None,
                allotted_count: 0,
                skipped: vec![],
            }),
        );
    }

    let batch = ExamAllotmentBatch {
        id: None,
        course_id: course_oid,
        for_reappear: payload.for_reappear,
        source: source.or(Some("manual".into())),
        subjects: subject_slots.clone(),
        subject_question_sets: question_sets.clone(),
        created_by,
        created_at: mongodb::bson::DateTime::now(),
    };
    let batch_coll = db.collection::<ExamAllotmentBatch>("exam_allotment_batches");
    let batch_id = match batch_coll.insert_one(batch, None).await {
        Ok(r) => r.inserted_id.as_object_id().unwrap(),
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(BulkAllotResponse {
                    success: false,
                    message: "Failed to create allotment batch".into(),
                    batch_id: None,
                    allotted_count: 0,
                    skipped: vec![],
                }),
            );
        }
    };

    let mut allotted_count = 0u32;
    let mut skipped = Vec::new();
    let force = payload.force.unwrap_or(false);

    for student in &students {
        let sid = match student.id {
            Some(id) => id,
            None => continue,
        };

        let eligibility = if payload.for_reappear {
            check_reappear_eligibility(db, student, &course_oid, Some(&course_name), &subject_ids)
                .await
        } else {
            check_first_attempt_eligibility(
                db,
                student,
                &course_oid,
                Some(&course_name),
                &subject_ids,
            )
            .await
        };

        if !force && !eligibility.eligible {
            skipped.push(SkippedStudent {
                student_id: sid.to_hex(),
                name: student.full_name.clone().unwrap_or_default(),
                reason: eligibility.reason.unwrap_or_else(|| "Not eligible".into()),
            });
            continue;
        }

        let center_id = student.parent_id.unwrap_or_else(ObjectId::new);
        let attempt_no = if payload.for_reappear {
            next_attempt_number(db, &sid, &course_oid).await
        } else {
            1
        };

        let mut student_ok = true;
        for slot in &subject_slots {
            let qs = question_sets
                .iter()
                .find(|q| q.subject_id == slot.subject_id)
                .map(|q| clone_questions(&q.questions))
                .unwrap_or_default();

            match insert_generated_student_paper(
                db,
                slot.blueprint_id,
                sid,
                center_id,
                slot.start_window,
                slot.end_window,
                Some(slot.subject_id),
                force,
                slot.bank_id_override,
                Some(qs),
                Some(batch_id),
                payload.for_reappear,
                attempt_no,
            )
            .await
            {
                Ok(_) => {}
                Err((_, e)) => {
                    student_ok = false;
                    skipped.push(SkippedStudent {
                        student_id: sid.to_hex(),
                        name: student.full_name.clone().unwrap_or_default(),
                        reason: e.message,
                    });
                    break;
                }
            }
        }
        if student_ok {
            allotted_count += 1;
            if payload.for_reappear {
                let attempt_coll = db.collection::<CourseExamAttempt>("course_exam_attempts");
                let _ = attempt_coll
                    .update_one(
                        doc! {
                            "student_id": sid,
                            "course_id": course_oid,
                            "attempt_number": attempt_no
                        },
                        doc! {
                            "$setOnInsert": {
                                "student_id": sid,
                                "course_id": course_oid,
                                "center_id": center_id,
                                "attempt_number": attempt_no,
                                "appeared": false,
                                "allow_reappear": false,
                                "reappear_locked": false,
                                "overall_result": "pending",
                                "subject_marks": [],
                                "total_obtained": 0.0,
                                "total_marks": 0.0,
                                "percentage": 0.0,
                                "marks_submitted": false,
                                "is_reappear_student": true,
                                "created_at": mongodb::bson::DateTime::now(),
                                "updated_at": mongodb::bson::DateTime::now(),
                            }
                        },
                        mongodb::options::UpdateOptions::builder()
                            .upsert(true)
                            .build(),
                    )
                    .await;
            }
        }
    }

    let mut message = format!(
        "Allotted {} student(s), skipped {} ({} subject slots used)",
        allotted_count,
        skipped.len(),
        subject_slots.len()
    );
    if !skipped_subject_reasons.is_empty() {
        message.push_str(&format!(
            " | {} subject(s) skipped during build: {}",
            skipped_subject_reasons.len(),
            skipped_subject_reasons.join("; ")
        ));
    }

    (
        StatusCode::OK,
        Json(BulkAllotResponse {
            success: allotted_count > 0,
            message,
            batch_id: Some(batch_id.to_hex()),
            allotted_count,
            skipped,
        }),
    )
}

pub async fn bulk_allot_exam(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<BulkAllotRequest>,
) -> (StatusCode, Json<BulkAllotResponse>) {
    if claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
        && claims.role != UserRole::Center
    {
        return (
            StatusCode::FORBIDDEN,
            Json(BulkAllotResponse {
                success: false,
                message: "Unauthorized".into(),
                batch_id: None,
                allotted_count: 0,
                skipped: vec![],
            }),
        );
    }

    let center_filter: Option<Vec<ObjectId>> = if claims.role == UserRole::Center {
        let user_oid = match ObjectId::parse_str(&claims.sub) {
            Ok(o) => Some(o),
            Err(_) => None,
        };
        if let Some(oid) = user_oid {
            let centers_coll = db.collection::<crate::models::center::Center>("centers");
            if let Ok(Some(center)) = centers_coll.find_one(doc! { "user_id": oid }, None).await {
                center.id.map(|cid| vec![cid])
            } else {
                None
            }
        } else {
            None
        }
    } else {
        parse_center_id_filter(payload.center_ids.clone())
    };

    let created_by = ObjectId::parse_str(&claims.sub).unwrap_or_else(|_| ObjectId::new());
    internal_bulk_allot(&db, created_by, center_filter, Some("manual".into()), payload).await
}

use serde::de;
use std::fmt;

#[derive(Debug, Clone)]
pub struct CenterIds(pub Vec<String>);

impl<'de> Deserialize<'de> for CenterIds {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: de::Deserializer<'de>,
    {
        struct CenterIdsVisitor;

        impl<'de> de::Visitor<'de> for CenterIdsVisitor {
            type Value = CenterIds;

            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("a string or a list of strings")
            }

            fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
            where
                E: de::Error,
            {
                Ok(CenterIds(
                    v.split(',')
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect(),
                ))
            }

            fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
            where
                A: de::SeqAccess<'de>,
            {
                let mut vec = Vec::new();
                while let Some(s) = seq.next_element::<String>()? {
                    vec.extend(
                        s.split(',')
                            .map(|part| part.trim().to_string())
                            .filter(|part| !part.is_empty()),
                    );
                }
                Ok(CenterIds(vec))
            }
        }

        deserializer.deserialize_any(CenterIdsVisitor)
    }
}

#[derive(Debug, Deserialize)]
pub struct EligibleQuery {
    pub course_id: String,
    pub for_reappear: Option<bool>,
    pub center_ids: Option<CenterIds>,
}

#[derive(Debug, Serialize)]
pub struct EligibleStudentItem {
    pub student_id: String,
    pub name: String,
    pub enrollment_number: Option<String>,
    pub serial_number: Option<String>,
    pub eligible: bool,
    pub reason: Option<String>,
}

pub async fn list_eligible_students(
    State(db): State<Database>,
    claims: Claims,
    Query(q): Query<EligibleQuery>,
) -> (StatusCode, Json<Vec<EligibleStudentItem>>) {
    let course_oid = match ObjectId::parse_str(&q.course_id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(vec![])),
    };
    let course = match get_course(&db, &course_oid).await {
        Some(c) => c,
        None => return (StatusCode::NOT_FOUND, Json(vec![])),
    };
    let subject_ids = get_course_subject_ids(&db, &course_oid).await;
    let for_reappear = q.for_reappear.unwrap_or(false);
    let center_filter: Option<Vec<ObjectId>> = if claims.role == UserRole::Center {
        // For center role, get the center document by user_id and use its _id
        let user_oid = match ObjectId::parse_str(&claims.sub) {
            Ok(o) => Some(o),
            Err(_) => None,
        };
        if let Some(oid) = user_oid {
            let centers_coll = db.collection::<crate::models::center::Center>("centers");
            if let Ok(Some(center)) = centers_coll.find_one(doc! { "user_id": oid }, None).await {
                center.id.map(|cid| vec![cid])
            } else {
                None
            }
        } else {
            None
        }
    } else {
        parse_center_id_filter(q.center_ids)
    };
    let students =
        fetch_students_for_course(&db, &course_oid, Some(&course.course_name), center_filter).await;

    let mut out = Vec::new();
    for s in students {
        let sid = match s.id {
            Some(id) => id,
            None => continue,
        };
        let r = if for_reappear {
            check_reappear_eligibility(
                &db,
                &s,
                &course_oid,
                Some(&course.course_name),
                &subject_ids,
            )
            .await
        } else {
            check_first_attempt_eligibility(
                &db,
                &s,
                &course_oid,
                Some(&course.course_name),
                &subject_ids,
            )
            .await
        };
        out.push(EligibleStudentItem {
            student_id: sid.to_hex(),
            name: s.full_name.clone().unwrap_or_default(),
            enrollment_number: s.enrollment_number.clone(),
            serial_number: s.serial_number.clone(),
            eligible: r.eligible,
            reason: r.reason,
        });
    }
    (StatusCode::OK, Json(out))
}

#[derive(Debug, Deserialize)]
pub struct ReappearListQuery {
    pub category_id: Option<String>,
    pub course_id: Option<String>,
    pub search: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ReappearAttemptView {
    pub attempt_number: i32,
    pub appeared: bool,
    pub allow_reappear: bool,
    pub reappear_locked: bool,
    pub overall_result: Option<String>,
    pub marks_submitted: bool,
    pub is_current: bool,
    pub is_editable: bool,
}

#[derive(Debug, Serialize)]
pub struct ReappearStudentRow {
    pub student_id: String,
    pub serial_number: Option<String>,
    pub enrollment_number: Option<String>,
    pub name: String,
    pub course_id: String,
    pub course_name: String,
    pub current_attempt: i32,
    /// Allowed | Not Allowed
    pub status: String,
    pub can_manage: bool,
    pub can_view: bool,
    pub attempts: Vec<ReappearAttemptView>,
}

pub async fn list_reappear_students(
    State(db): State<Database>,
    claims: Claims,
    Query(q): Query<ReappearListQuery>,
) -> (StatusCode, Json<Vec<ReappearStudentRow>>) {
    if claims.role != UserRole::Center
        && claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
    {
        return (StatusCode::FORBIDDEN, Json(vec![]));
    }

    let center_oid = if claims.role == UserRole::Center {
        ObjectId::parse_str(&claims.sub).ok()
    } else {
        None
    };

    let attempt_coll = db.collection::<CourseExamAttempt>("course_exam_attempts");
    let mut filter = doc! {};
    if let Some(c) = center_oid {
        filter.insert("center_id", c);
    }

    let mut rows = Vec::new();
    let user_coll = db.collection::<User>("users");

    if let Ok(mut cursor) = attempt_coll.find(filter, None).await {
        let mut grouped: std::collections::HashMap<(ObjectId, ObjectId), Vec<CourseExamAttempt>> =
            std::collections::HashMap::new();
        while let Some(Ok(a)) = cursor.next().await {
            grouped
                .entry((a.student_id, a.course_id))
                .or_default()
                .push(a);
        }

        for ((student_id, course_id), mut attempts) in grouped {
            attempts.sort_by_key(|a| a.attempt_number);
            let latest_submitted = attempts
                .iter()
                .filter(|a| a.marks_submitted)
                .max_by_key(|a| a.attempt_number);
            let overall_fail = latest_submitted
                .and_then(|a| a.overall_result.as_deref())
                .map(|r| r.eq_ignore_ascii_case("fail"))
                .unwrap_or(false);
            if !overall_fail {
                continue;
            }

            let current_attempt = attempts.iter().map(|a| a.attempt_number).max().unwrap_or(1);
            let current = attempts
                .iter()
                .find(|a| a.attempt_number == current_attempt);

            let student = match user_coll.find_one(doc! { "_id": student_id }, None).await {
                Ok(Some(s)) => s,
                _ => continue,
            };

            if let Some(ref search) = q.search {
                let s_lower = search.to_lowercase();
                let match_enroll = student
                    .enrollment_number
                    .as_deref()
                    .map(|e| e.to_lowercase().contains(&s_lower))
                    .unwrap_or(false);
                let match_serial = student
                    .serial_number
                    .as_deref()
                    .map(|e| e.to_lowercase().contains(&s_lower))
                    .unwrap_or(false);
                if !match_enroll && !match_serial {
                    continue;
                }
            }

            if let Some(ref cid) = q.course_id {
                if course_id.to_hex() != *cid {
                    continue;
                }
            }

            let course = match get_course(&db, &course_id).await {
                Some(c) => c,
                None => continue,
            };

            if let Some(ref cat) = q.category_id {
                if course.category_id.to_hex() != *cat {
                    continue;
                }
            }

            let marks_submitted_current = current.map(|a| a.marks_submitted).unwrap_or(false);
            let allow_reappear = current.map(|a| a.allow_reappear).unwrap_or(false);
            let can_manage = !marks_submitted_current;
            let can_view = marks_submitted_current;

            let attempt_views: Vec<ReappearAttemptView> = attempts
                .iter()
                .map(|a| {
                    let is_current = a.attempt_number == current_attempt;
                    ReappearAttemptView {
                        attempt_number: a.attempt_number,
                        appeared: if a.attempt_number == 1 {
                            true
                        } else {
                            a.appeared
                        },
                        allow_reappear: a.allow_reappear,
                        reappear_locked: a.reappear_locked,
                        overall_result: a.overall_result.clone(),
                        marks_submitted: a.marks_submitted,
                        is_current,
                        is_editable: is_current && !a.marks_submitted,
                    }
                })
                .collect();

            rows.push(ReappearStudentRow {
                student_id: student_id.to_hex(),
                serial_number: student.serial_number.clone(),
                enrollment_number: student.enrollment_number.clone(),
                name: student.full_name.clone().unwrap_or_default(),
                course_id: course_id.to_hex(),
                course_name: course.course_name.clone(),
                current_attempt,
                status: if allow_reappear {
                    "Allowed".into()
                } else {
                    "Not Allowed".into()
                },
                can_manage,
                can_view,
                attempts: attempt_views,
            });
        }
    }

    (StatusCode::OK, Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct ReappearUpdateRequest {
    pub allow_reappear: bool,
}

pub async fn update_reappear_permission(
    State(db): State<Database>,
    claims: Claims,
    Path((student_id, course_id)): Path<(String, String)>,
    Json(payload): Json<ReappearUpdateRequest>,
) -> (StatusCode, Json<ExamEngineResponse>) {
    if claims.role != UserRole::Center
        && claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
    {
        return (
            StatusCode::FORBIDDEN,
            Json(ExamEngineResponse {
                success: false,
                message: "Unauthorized".into(),
            }),
        );
    }

    let sid = match ObjectId::parse_str(&student_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid student".into(),
                }),
            );
        }
    };
    let cid = match ObjectId::parse_str(&course_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid course".into(),
                }),
            );
        }
    };

    let coll = db.collection::<CourseExamAttempt>("course_exam_attempts");
    let mut attempts = Vec::new();
    if let Ok(mut ac) = coll
        .find(
            doc! { "student_id": sid, "course_id": cid },
            mongodb::options::FindOptions::builder()
                .sort(doc! { "attempt_number": 1 })
                .build(),
        )
        .await
    {
        while let Some(Ok(a)) = ac.next().await {
            attempts.push(a);
        }
    }

    if attempts.is_empty() {
        return (
            StatusCode::NOT_FOUND,
            Json(ExamEngineResponse {
                success: false,
                message: "No attempt found".into(),
            }),
        );
    }

    let latest_submitted = attempts
        .iter()
        .filter(|a| a.marks_submitted)
        .max_by_key(|a| a.attempt_number);
    let overall_fail = latest_submitted
        .and_then(|a| a.overall_result.as_deref())
        .map(|r| r.eq_ignore_ascii_case("fail"))
        .unwrap_or(false);
    if !overall_fail {
        return (
            StatusCode::BAD_REQUEST,
            Json(ExamEngineResponse {
                success: false,
                message: "Only failed overall results can allow reappear".into(),
            }),
        );
    }

    let current_attempt_no = attempts.iter().map(|a| a.attempt_number).max().unwrap_or(1);
    let current = match attempts
        .iter()
        .find(|a| a.attempt_number == current_attempt_no)
    {
        Some(a) => a,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Current attempt not found".into(),
                }),
            );
        }
    };

    if current.marks_submitted {
        return (
            StatusCode::BAD_REQUEST,
            Json(ExamEngineResponse {
                success: false,
                message: "Current attempt marks already submitted — use View mode".into(),
            }),
        );
    }

    if claims.role == UserRole::Center && current.center_id.to_hex() != claims.sub {
        return (
            StatusCode::FORBIDDEN,
            Json(ExamEngineResponse {
                success: false,
                message: "Unauthorized".into(),
            }),
        );
    }

    match coll
        .update_one(
            doc! { "_id": current.id },
            doc! {
                "$set": {
                    "allow_reappear": payload.allow_reappear,
                    "reappear_locked": true,
                    "is_reappear_student": current_attempt_no > 1,
                    "updated_at": mongodb::bson::DateTime::now(),
                }
            },
            None,
        )
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(ExamEngineResponse {
                success: true,
                message: "Reappear permission updated".into(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ExamEngineResponse {
                success: false,
                message: "Update failed".into(),
            }),
        ),
    }
}

#[derive(Debug, Deserialize)]
pub struct MarksEntryListQuery {
    pub category_id: Option<String>,
    pub course_id: Option<String>,
    pub student_type: Option<String>,
    pub search: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MarksEntryRow {
    pub student_id: String,
    pub serial_number: Option<String>,
    pub enrollment_number: Option<String>,
    pub name: String,
    pub course_id: String,
    pub course_name: String,
    pub attempt: i32,
    pub current_attempt: i32,
    pub available_attempts: Vec<i32>,
    pub marks_obtained: Option<f64>,
    pub percentage: Option<f64>,
    pub result: Option<String>,
    pub is_reappear: bool,
    pub marks_submitted: bool,
    pub can_enter: bool,
    /// none | pending | approved | disapproved
    pub change_request_status: String,
    pub has_pending_request: bool,
}

pub async fn list_marks_entry_students(
    State(db): State<Database>,
    claims: Claims,
    Query(q): Query<MarksEntryListQuery>,
) -> (StatusCode, Json<Vec<MarksEntryRow>>) {
    if claims.role != UserRole::Center
        && claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
    {
        return (StatusCode::FORBIDDEN, Json(vec![]));
    }

    let center_oid = if claims.role == UserRole::Center {
        ObjectId::parse_str(&claims.sub).ok()
    } else {
        None
    };

    let course_oid = q
        .course_id
        .as_ref()
        .and_then(|id| ObjectId::parse_str(id).ok());
    let students = if let Some(ref c) = course_oid {
        let center_list = center_oid.map(|oid| vec![oid]);
        fetch_students_for_course(&db, c, None, center_list).await
    } else {
        let coll = db.collection::<User>("users");
        let mut filter = doc! { "role": "student", "active": true };
        if let Some(ref c) = center_oid {
            filter.insert("parent_id", c);
        }
        let mut list = Vec::new();
        if let Ok(mut cursor) = coll.find(filter, None).await {
            while let Some(Ok(u)) = cursor.next().await {
                list.push(u);
            }
        }
        list
    };

    let mut rows = Vec::new();
    for s in students {
        let sid = match s.id {
            Some(id) => id,
            None => continue,
        };
        let c_oid = match s.course_id.or(course_oid) {
            Some(id) => id,
            None => continue,
        };
        let course = match get_course(&db, &c_oid).await {
            Some(c) => c,
            None => continue,
        };

        if let Some(ref cat) = q.category_id {
            if course.category_id.to_hex() != *cat {
                continue;
            }
        }

        let elig =
            check_marks_entry_list_visibility(&db, &s, &c_oid, Some(&course.course_name)).await;
        if !elig.eligible {
            continue;
        }

        let latest = latest_course_attempt(&db, &sid, &c_oid).await;
        let latest_submitted = latest_submitted_course_attempt(&db, &sid, &c_oid).await;

        let current_attempt = max_course_attempt_number(&db, &sid, &c_oid).await;
        let marks_submitted = latest_submitted
            .as_ref()
            .map(|a| a.marks_submitted)
            .unwrap_or(false);
        let marks_edit_unlocked = latest_submitted
            .as_ref()
            .map(|a| a.marks_edit_unlocked)
            .unwrap_or(false);
        let allow_reappear = latest.as_ref().map(|a| a.allow_reappear).unwrap_or(false);
        let is_reappear = latest
            .as_ref()
            .map(|a| a.is_reappear_student || a.attempt_number > 1)
            .unwrap_or(false);

        let mut available_attempts: Vec<i32> = Vec::new();
        if let Ok(mut ac) = db
            .collection::<CourseExamAttempt>("course_exam_attempts")
            .find(
                doc! { "student_id": sid, "course_id": c_oid },
                mongodb::options::FindOptions::builder()
                    .sort(doc! { "attempt_number": 1 })
                    .build(),
            )
            .await
        {
            while let Some(Ok(a)) = ac.next().await {
                available_attempts.push(a.attempt_number);
            }
        }
        if available_attempts.is_empty() {
            available_attempts.push(1);
        }

        if let Some(ref st) = q.student_type {
            match st.as_str() {
                "regular" if is_reappear => continue,
                "reappear" if !is_reappear => continue,
                _ => {}
            }
        }

        if let Some(ref search) = q.search {
            let sl = search.to_lowercase();
            let ok = s
                .enrollment_number
                .as_deref()
                .map(|e| e.to_lowercase().contains(&sl))
                .unwrap_or(false)
                || s.serial_number
                    .as_deref()
                    .map(|e| e.to_lowercase().contains(&sl))
                    .unwrap_or(false);
            if !ok {
                continue;
            }
        }

        let change_req_attempt = latest_submitted
            .as_ref()
            .map(|a| a.attempt_number)
            .unwrap_or(current_attempt);
        let change_req = get_latest_change_request(&db, &sid, &c_oid, change_req_attempt).await;
        let change_request_status = change_req
            .as_ref()
            .map(|r| r.status.clone())
            .unwrap_or_else(|| "none".into());
        let has_pending_request = change_req
            .as_ref()
            .map(|r| r.status == "pending")
            .unwrap_or(false);

        // Check if student is in online exam mode and if any subjects have practical/assignment components enabled
        let online = is_online_exam_mode(&s.exam_mode);
        let mut has_any_practical_or_assignment = false;
        let subject_ids = get_course_subject_ids(&db, &c_oid).await;
        for sub_id in &subject_ids {
            let (bp, subject_config) =
                blueprint_context_for_subject(&db, &sid, sub_id, current_attempt).await;
            if let Some(subject_config) = subject_config {
                if subject_config.practical_component.enabled
                    || subject_config.assignment_component.enabled
                {
                    has_any_practical_or_assignment = true;
                    break;
                }
            } else if let Some(bp) = bp {
                if bp.practical_enabled || bp.assignment_enabled {
                    has_any_practical_or_assignment = true;
                    break;
                }
            }
        }

        let can_enter = (current_attempt == 1 || allow_reappear || marks_edit_unlocked)
            && (!marks_submitted || marks_edit_unlocked)
            && !(online && !has_any_practical_or_assignment);

        let display = latest_submitted.as_ref().or(latest.as_ref());
        rows.push(MarksEntryRow {
            student_id: sid.to_hex(),
            serial_number: s.serial_number.clone(),
            enrollment_number: s.enrollment_number.clone(),
            name: s.full_name.clone().unwrap_or_default(),
            course_id: c_oid.to_hex(),
            course_name: course.course_name.clone(),
            attempt: change_req_attempt,
            current_attempt,
            available_attempts,
            marks_obtained: display.map(|a| a.total_obtained),
            percentage: display.map(|a| a.percentage),
            result: display.and_then(|a| a.overall_result.clone()),
            is_reappear,
            marks_submitted: latest_submitted.is_some(),
            can_enter,
            change_request_status,
            has_pending_request,
        });
    }

    (StatusCode::OK, Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct MarksEntrySubjectInput {
    pub subject_id: String,
    #[serde(default)]
    pub exam_obtained: f64,
    #[serde(default)]
    pub exam_total: f64,
    #[serde(default)]
    pub practical_obtained: f64,
    #[serde(default)]
    pub practical_total: f64,
    #[serde(default)]
    pub assignment_obtained: f64,
    #[serde(default)]
    pub assignment_total: f64,
    /// Legacy single-field support
    #[serde(default)]
    pub obtained: Option<f64>,
    #[serde(default)]
    pub total: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct MarksEntrySubmitRequest {
    pub student_id: String,
    pub course_id: String,
    pub attempt_number: Option<i32>,
    pub subjects: Vec<MarksEntrySubjectInput>,
}

#[derive(Debug, Deserialize)]
pub struct MarksChangeRequestPayload {
    pub student_id: String,
    pub course_id: String,
    pub attempt_number: Option<i32>,
    pub reason: String,
}

pub async fn get_marks_entry_form(
    State(db): State<Database>,
    _claims: Claims,
    Path((student_id, course_id)): Path<(String, String)>,
    Query(q): Query<std::collections::HashMap<String, String>>,
) -> (StatusCode, Json<serde_json::Value>) {
    let sid = match ObjectId::parse_str(&student_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Invalid ids" })),
            );
        }
    };
    let cid = match ObjectId::parse_str(&course_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Invalid ids" })),
            );
        }
    };
    let attempt_no: i32 = q.get("attempt").and_then(|s| s.parse().ok()).unwrap_or(0);

    let user_coll = db.collection::<User>("users");
    let student = match user_coll.find_one(doc! { "_id": sid }, None).await {
        Ok(Some(s)) => s,
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Student not found" })),
            );
        }
    };

    let online = is_online_exam_mode(&student.exam_mode);
    let current_attempt = max_course_attempt_number(&db, &sid, &cid).await;
    let attempt_no = if attempt_no > 0 {
        attempt_no
    } else {
        current_attempt
    };
    let is_current_attempt = attempt_no == current_attempt;

    let subject_ids = get_course_subject_ids(&db, &cid).await;
    let attempt = db
        .collection::<CourseExamAttempt>("course_exam_attempts")
        .find_one(
            doc! {
                "student_id": sid,
                "course_id": cid,
                "attempt_number": attempt_no
            },
            None,
        )
        .await
        .ok()
        .flatten();

    let mut subject_marks: Vec<serde_json::Value> = Vec::new();

    for sub_id in &subject_ids {
        let (bp, subject_config_snapshot) =
            blueprint_context_for_subject(&db, &sid, sub_id, attempt_no).await;
        let subject_config = subject_config_snapshot.as_ref();
        let practical_enabled = subject_config
            .map(|sc| sc.practical_component.enabled)
            .unwrap_or(false);
        let assignment_enabled = subject_config
            .map(|sc| sc.assignment_component.enabled)
            .unwrap_or(false);

        let exam_total = subject_config
            .map(|sc| sc.final_exam_component.marks)
            .or_else(|| bp.as_ref().and_then(|b| b.components.as_ref().map(|c| c.exam_marks)))
            .unwrap_or_else(|| bp.as_ref().map(|b| b.total_marks).unwrap_or(100.0));
        let practical_total = subject_config
            .map(|sc| sc.practical_component.marks)
            .unwrap_or(
                bp.as_ref()
                    .and_then(|b| b.components.as_ref().map(|c| c.practical_marks))
                    .unwrap_or(0.0),
            );
        let assignment_total = subject_config
            .map(|sc| sc.assignment_component.marks)
            .unwrap_or(
                bp.as_ref()
                    .and_then(|b| b.components.as_ref().map(|c| c.assignment_marks))
                    .unwrap_or(0.0),
            );

        let (mut exam_obtained, loaded_exam_total, from_online, mut exam_readonly) =
            load_exam_marks_for_subject(&db, &student, sub_id, attempt_no).await;
        let mut exam_total = if loaded_exam_total > 0.0 {
            loaded_exam_total
        } else {
            exam_total
        };

        let mut practical_obtained = 0.0;
        let mut assignment_obtained = 0.0;

        if let Some(ref att) = attempt {
            if let Some(sm) = att.subject_marks.iter().find(|m| m.subject_id == *sub_id) {
                if att.marks_submitted || sm.obtained > 0.0 || sm.components.exam_total > 0.0 {
                    if !online {
                        exam_obtained = sm.components.exam_obtained;
                        if sm.components.exam_total > 0.0 {
                            exam_total = sm.components.exam_total;
                        }
                    }
                    practical_obtained = sm.components.practical_obtained;
                    assignment_obtained = sm.components.assignment_obtained;
                }
            }
        }

        if online {
            exam_readonly = true;
        }

        // Get min marks from subject config
        let min_exam_marks = subject_config
            .map(|sc| sc.final_exam_component.min_marks)
            .unwrap_or(0.0);
        let min_practical_marks = subject_config
            .map(|sc| sc.practical_component.min_marks)
            .unwrap_or(0.0);
        let min_assignment_marks = subject_config
            .map(|sc| sc.assignment_component.min_marks)
            .unwrap_or(0.0);

        let (obtained, total, subject_passed) =
            marks_calculation::compute_subject_totals(&SubjectMarkInput {
                exam_obtained,
                exam_total,
                min_exam_marks,
                practical_obtained,
                practical_total,
                min_practical_marks,
                practical_enabled,
                assignment_obtained,
                assignment_total,
                min_assignment_marks,
                assignment_enabled,
                from_online_exam: from_online,
                exam_readonly,
            });

        subject_marks.push(serde_json::json!({
            "subject_id": sub_id.to_hex(),
            "exam_obtained": exam_obtained,
            "exam_total": exam_total,
            "min_exam_marks": min_exam_marks,
            "practical_obtained": practical_obtained,
            "practical_total": practical_total,
            "min_practical_marks": min_practical_marks,
            "practical_component_enabled": practical_enabled,
            "assignment_obtained": assignment_obtained,
            "assignment_total": assignment_total,
            "min_assignment_marks": min_assignment_marks,
            "assignment_component_enabled": assignment_enabled,
            "obtained": obtained,
            "total": total,
            "subject_passed": subject_passed,
            "from_online_exam": from_online,
            "exam_readonly": exam_readonly,
        }));
    }

    let mut history: Vec<CourseExamAttempt> = Vec::new();
    let mut available_attempts: Vec<i32> = Vec::new();
    if let Ok(mut c) = db
        .collection::<CourseExamAttempt>("course_exam_attempts")
        .find(
            doc! { "student_id": sid, "course_id": cid },
            mongodb::options::FindOptions::builder()
                .sort(doc! { "attempt_number": 1 })
                .build(),
        )
        .await
    {
        while let Some(Ok(a)) = c.next().await {
            history.push(a.clone());
            available_attempts.push(a.attempt_number);
        }
    }
    if available_attempts.is_empty() {
        available_attempts.push(1);
    }

    let marks_submitted = attempt.as_ref().map(|a| a.marks_submitted).unwrap_or(false);
    let marks_edit_unlocked = attempt
        .as_ref()
        .map(|a| a.marks_edit_unlocked)
        .unwrap_or(false);
    let read_only =
        !marks_edit_unlocked && (!is_current_attempt || (marks_submitted && !marks_edit_unlocked));
    (
        StatusCode::OK,
        Json(serde_json::json!({
            "student_id": student_id,
            "course_id": course_id,
            "attempt_number": attempt_no,
            "current_attempt_number": current_attempt,
            "available_attempts": available_attempts,
            "is_current_attempt": is_current_attempt,
            "exam_mode_online": online,
            "read_only": read_only,
            "subjects": subject_marks,
        })),
    )
}

pub async fn auto_allot_exams(db: Database) {
    // #region debug-point E:auto-allot-entry
    report_auto_exam_debug(
        "pre-fix",
        "E",
        "exam_workflow.rs:auto_allot_exams:entry",
        "[DEBUG] auto_allot_exams invoked",
        serde_json::json!({}),
    )
    .await;
    // #endregion
    // Get system settings
    let settings_coll =
        db.collection::<crate::models::system_settings::SystemSettings>("system_settings");
    let settings = match settings_coll.find_one(None, None).await {
        Ok(Some(s)) => s,
        _ => crate::models::system_settings::SystemSettings::default(),
    };

    if !settings.auto_exam_enabled {
        // #region debug-point A:auto-disabled
        report_auto_exam_debug(
            "pre-fix",
            "A",
            "exam_workflow.rs:auto_allot_exams:auto_exam_enabled",
            "[DEBUG] auto allot skipped because auto exam is disabled",
            serde_json::json!({ "auto_exam_enabled": settings.auto_exam_enabled }),
        )
        .await;
        // #endregion
        return;
    }

    let Some(allotment_day) = settings.auto_exam_allotment_day else {
        // #region debug-point A:missing-allotment-day
        report_auto_exam_debug(
            "pre-fix",
            "A",
            "exam_workflow.rs:auto_allot_exams:auto_exam_allotment_day",
            "[DEBUG] auto allot skipped because allotment day is missing",
            serde_json::json!({}),
        )
        .await;
        // #endregion
        return;
    };
    let exam_day = settings.auto_exam_day.unwrap_or(allotment_day);
    let subject_gap = settings.auto_exam_subject_gap_minutes;

    // Get current time in IST
    let now_ist = Utc::now().with_timezone(&Kolkata);
    let current_day = now_ist.day() as i32;

    // Check if today is the allotment day
    if current_day != allotment_day {
        // #region debug-point A:day-mismatch
        report_auto_exam_debug(
            "pre-fix",
            "A",
            "exam_workflow.rs:auto_allot_exams:day_check",
            "[DEBUG] auto allot skipped because current day does not match allotment day",
            serde_json::json!({
                "current_day_ist": current_day,
                "allotment_day": allotment_day,
                "now_ist": now_ist.to_rfc3339(),
            }),
        )
        .await;
        // #endregion
        return;
    }

    // Check if we already did automatic allotment today (IST) to avoid multiple runs
    let batch_coll = db.collection::<crate::models::exam_workflow::ExamAllotmentBatch>("exam_allotment_batches");
    let today_start_ist = now_ist.date_naive().and_hms_opt(0, 0, 0).unwrap().and_local_timezone(Kolkata).unwrap().with_timezone(&Utc);
    let today_start_bson = mongodb::bson::DateTime::from_chrono(today_start_ist);
    
    // Check if there are any batches created today
    if let Ok(count) = batch_coll
        .count_documents(
            doc! {
                "created_at": { "$gte": today_start_bson },
                "source": "automatic"
            },
            None,
        )
        .await
    {
        if count > 0 {
            // #region debug-point A:duplicate-batch-guard
            report_auto_exam_debug(
                "pre-fix",
                "A",
                "exam_workflow.rs:auto_allot_exams:existing_batches_today",
                "[DEBUG] auto allot skipped because batches already exist today",
                serde_json::json!({
                    "batch_count_today": count,
                    "today_start_utc": today_start_ist.to_rfc3339(),
                }),
            )
            .await;
            // #endregion
            println!("Already did automatic exam allotment today, skipping...");
            return;
        }
    }

    println!("Starting automated exam allotment...");

    // Get all courses
    let course_coll = db.collection::<Course>("courses");
    let mut courses = Vec::new();
    if let Ok(mut cursor) = course_coll.find(None, None).await {
        while let Some(Ok(course)) = cursor.next().await {
            courses.push(course);
        }
    }
    // #region debug-point A:courses-loaded
    report_auto_exam_debug(
        "pre-fix",
        "A",
        "exam_workflow.rs:auto_allot_exams:courses_loaded",
        "[DEBUG] courses loaded for automatic allotment",
        serde_json::json!({ "course_count": courses.len(), "exam_day": exam_day, "subject_gap": subject_gap }),
    )
    .await;
    // #endregion

    let bp_coll = db.collection::<crate::models::exam_engine::ExamBlueprint>("exam_blueprints");

    for course in courses {
        let course_id = match course.id {
            Some(id) => id,
            None => continue,
        };

        // Get default blueprint for this course
        let default_bp = match bp_coll
            .find_one(
                doc! { "course_id": course_id, "default_blueprint": true },
                None,
            )
            .await
        {
            Ok(Some(bp)) => bp,
            _ => {
                // #region debug-point A:no-default-blueprint
                report_auto_exam_debug(
                    "pre-fix",
                    "A",
                    "exam_workflow.rs:auto_allot_exams:default_blueprint",
                    "[DEBUG] skipped course because no default blueprint was found",
                    serde_json::json!({ "course_id": course_id.to_hex(), "course_name": course.course_name }),
                )
                .await;
                // #endregion
                continue;
            }
        };

        if default_bp.subjects.is_empty() {
            // #region debug-point A:blueprint-no-subjects
            report_auto_exam_debug(
                "pre-fix",
                "A",
                "exam_workflow.rs:auto_allot_exams:blueprint_subjects",
                "[DEBUG] skipped course because default blueprint has no subjects",
                serde_json::json!({
                    "course_id": course_id.to_hex(),
                    "course_name": course.course_name,
                    "blueprint_id": default_bp.id.map(|id| id.to_hex()),
                }),
            )
            .await;
            // #endregion
            continue;
        }

        // Get subject IDs for course
        let subject_ids = get_course_subject_ids(&db, &course_id).await;
        if subject_ids.is_empty() {
            // #region debug-point A:no-course-subjects
            report_auto_exam_debug(
                "pre-fix",
                "A",
                "exam_workflow.rs:auto_allot_exams:course_subjects",
                "[DEBUG] skipped course because no course subjects were mapped",
                serde_json::json!({ "course_id": course_id.to_hex(), "course_name": course.course_name }),
            )
            .await;
            // #endregion
            continue;
        }

        // Fetch all eligible students (no center filter, all active centers)
        let students =
            fetch_students_for_course(&db, &course_id, Some(&course.course_name), None).await;
        if students.is_empty() {
            // #region debug-point B:no-students
            report_auto_exam_debug(
                "pre-fix",
                "B",
                "exam_workflow.rs:auto_allot_exams:students",
                "[DEBUG] skipped course because no students were fetched",
                serde_json::json!({
                    "course_id": course_id.to_hex(),
                    "course_name": course.course_name,
                    "subject_ids": subject_ids.iter().map(|id| id.to_hex()).collect::<Vec<_>>(),
                }),
            )
            .await;
            // #endregion
            continue;
        }
        // #region debug-point B:students-loaded
        report_auto_exam_debug(
            "pre-fix",
            "B",
            "exam_workflow.rs:auto_allot_exams:students_loaded",
            "[DEBUG] fetched students for course",
            serde_json::json!({
                "course_id": course_id.to_hex(),
                "course_name": course.course_name,
                "student_count": students.len(),
            }),
        )
        .await;
        // #endregion

        // Calculate exam start date: use exam_day in current month, or next month if exam_day < allotment_day
        let mut exam_date = now_ist;
        exam_date = exam_date
            .with_day(exam_day as u32)
            .unwrap_or_else(|| exam_date);
        if exam_day < allotment_day {
            exam_date = exam_date + chrono::Months::new(1);
        }

        // Keep the previously configured local time if present, otherwise default to midnight IST.
        let (exam_hour, exam_minute) = settings
            .auto_exam_time
            .as_deref()
            .and_then(|time_str| {
                let parts: Vec<&str> = time_str.split(':').collect();
                if parts.len() != 2 {
                    return None;
                }
                let hour = parts[0].parse::<u32>().ok()?;
                let minute = parts[1].parse::<u32>().ok()?;
                Some((hour, minute))
            })
            .unwrap_or((0, 0));

        // Set start time to the configured time (IST)
        let mut current_start = exam_date
            .with_hour(exam_hour)
            .unwrap()
            .with_minute(exam_minute)
            .unwrap()
            .with_second(0)
            .unwrap()
            .with_nanosecond(0)
            .unwrap();

        for &for_reappear in &[false, true] {
            let mut subject_slots: Vec<AllotmentSubjectSlot> = Vec::new();
            let mut question_sets: Vec<crate::models::exam_workflow::SubjectQuestionSet> =
                Vec::new();
            let batch_seed = mongodb::bson::DateTime::now().timestamp_millis() as u64;

            for (idx, subject_config) in default_bp.subjects.iter().enumerate() {
                let sub_oid = subject_config.subject_id;
                let bp_oid = default_bp.id.unwrap();

                let seed = batch_seed.wrapping_add(idx as u64);
                let questions = match crate::handlers::exam_engine::pick_questions_for_blueprint(
                    &db,
                    &default_bp,
                    Some(subject_config),
                    None,
                    for_reappear,
                    Some(seed),
                )
                .await
                {
                    Ok(q) => q,
                    Err((status, err)) => {
                        // #region debug-point C:question-pick-failed
                        report_auto_exam_debug(
                            "pre-fix",
                            "C",
                            "exam_workflow.rs:auto_allot_exams:pick_questions_for_blueprint",
                            "[DEBUG] failed to pick questions for subject during automatic allotment",
                            serde_json::json!({
                                "course_id": course_id.to_hex(),
                                "course_name": course.course_name,
                                "subject_id": sub_oid.to_hex(),
                                "for_reappear": for_reappear,
                                "error_status": status.as_u16(),
                                "error_message": err.message,
                            }),
                        )
                        .await;
                        // #endregion
                        continue;
                    }
                };

                let duration = subject_config.duration_minutes as i64;
                let start_utc = current_start.with_timezone(&Utc);
                let end_utc = start_utc + chrono::Duration::minutes(duration);

                subject_slots.push(AllotmentSubjectSlot {
                    subject_id: sub_oid,
                    blueprint_id: bp_oid,
                    start_window: Some(mongodb::bson::DateTime::from_chrono(start_utc)),
                    end_window: Some(mongodb::bson::DateTime::from_chrono(end_utc)),
                    bank_id_override: None,
                });
                question_sets.push(crate::models::exam_workflow::SubjectQuestionSet {
                    subject_id: sub_oid,
                    blueprint_id: bp_oid,
                    questions,
                });

                // Add gap for next subject
                current_start =
                    current_start + chrono::Duration::minutes(duration + subject_gap as i64);
            }

            if subject_slots.is_empty() {
                // #region debug-point C:no-subject-slots
                report_auto_exam_debug(
                    "pre-fix",
                    "C",
                    "exam_workflow.rs:auto_allot_exams:subject_slots",
                    "[DEBUG] no subject slots were generated for course attempt type",
                    serde_json::json!({
                        "course_id": course_id.to_hex(),
                        "course_name": course.course_name,
                        "for_reappear": for_reappear,
                    }),
                )
                .await;
                // #endregion
                continue;
            }

            let mut eligible_students: Vec<(ObjectId, ObjectId, i32, Option<String>)> = Vec::new();
            for student in &students {
                let sid = match student.id {
                    Some(id) => id,
                    None => continue,
                };

                let eligibility = if for_reappear {
                    check_reappear_eligibility(
                        &db,
                        student,
                        &course_id,
                        Some(&course.course_name),
                        &subject_ids,
                    )
                    .await
                } else {
                    check_first_attempt_eligibility(
                        &db,
                        student,
                        &course_id,
                        Some(&course.course_name),
                        &subject_ids,
                    )
                    .await
                };

                if !eligibility.eligible {
                    // #region debug-point B:eligibility-rejected
                    report_auto_exam_debug(
                        "pre-fix",
                        "B",
                        "exam_workflow.rs:auto_allot_exams:eligibility",
                        "[DEBUG] student rejected by eligibility during automatic allotment",
                        serde_json::json!({
                            "course_id": course_id.to_hex(),
                            "course_name": course.course_name,
                            "student_id": sid.to_hex(),
                            "student_name": student.full_name,
                            "for_reappear": for_reappear,
                            "reason": eligibility.reason,
                        }),
                    )
                    .await;
                    // #endregion
                    continue;
                }

                let center_id = student.parent_id.unwrap_or_else(ObjectId::new);
                let attempt_no = if for_reappear {
                    next_attempt_number(&db, &sid, &course_id).await
                } else {
                    1
                };
                eligible_students.push((sid, center_id, attempt_no, student.full_name.clone()));
            }

            if eligible_students.is_empty() {
                // #region debug-point B:no-eligible-students
                report_auto_exam_debug(
                    "pre-fix",
                    "B",
                    "exam_workflow.rs:auto_allot_exams:no_eligible_students",
                    "[DEBUG] no eligible students found for course attempt type",
                    serde_json::json!({
                        "course_id": course_id.to_hex(),
                        "course_name": course.course_name,
                        "for_reappear": for_reappear,
                        "student_count": students.len(),
                    }),
                )
                .await;
                // #endregion
                continue;
            }

            // Create allotment batch
            let created_by = ObjectId::new(); // Use a system user
            let batch = crate::models::exam_workflow::ExamAllotmentBatch {
                id: None,
                course_id,
                for_reappear,
                source: Some("automatic".into()),
                subjects: subject_slots.clone(),
                subject_question_sets: question_sets.clone(),
                created_by,
                created_at: mongodb::bson::DateTime::now(),
            };
            let batch_coll = db.collection::<crate::models::exam_workflow::ExamAllotmentBatch>(
                "exam_allotment_batches",
            );
            let batch_id = match batch_coll.insert_one(batch, None).await {
                Ok(r) => r.inserted_id.as_object_id().unwrap(),
                Err(err) => {
                    // #region debug-point C:batch-insert-failed
                    report_auto_exam_debug(
                        "pre-fix",
                        "C",
                        "exam_workflow.rs:auto_allot_exams:insert_batch",
                        "[DEBUG] failed to insert automatic allotment batch",
                        serde_json::json!({
                            "course_id": course_id.to_hex(),
                            "course_name": course.course_name,
                            "for_reappear": for_reappear,
                            "error": err.to_string(),
                        }),
                    )
                    .await;
                    // #endregion
                    continue;
                }
            };
            // #region debug-point C:batch-created
            report_auto_exam_debug(
                "pre-fix",
                "C",
                "exam_workflow.rs:auto_allot_exams:batch_created",
                "[DEBUG] created automatic allotment batch",
                serde_json::json!({
                    "course_id": course_id.to_hex(),
                    "course_name": course.course_name,
                    "for_reappear": for_reappear,
                    "batch_id": batch_id.to_hex(),
                    "subject_slot_count": subject_slots.len(),
                }),
            )
            .await;
            // #endregion

            let mut allotted_count = 0u32;
            for (sid, center_id, attempt_no, student_name) in &eligible_students {

                let mut student_ok = true;
                for slot in &subject_slots {
                    let qs = question_sets
                        .iter()
                        .find(|q| q.subject_id == slot.subject_id)
                        .map(|q| clone_questions(&q.questions))
                        .unwrap_or_default();

                    match crate::handlers::exam_engine::insert_generated_student_paper(
                        &db,
                        slot.blueprint_id,
                        *sid,
                        *center_id,
                        slot.start_window,
                        slot.end_window,
                        Some(slot.subject_id),
                        true,
                        slot.bank_id_override,
                        Some(qs),
                        Some(batch_id),
                        for_reappear,
                        *attempt_no,
                    )
                    .await
                    {
                        Ok(_) => {}
                        Err((status, err)) => {
                            // #region debug-point C:paper-insert-failed
                            report_auto_exam_debug(
                                "pre-fix",
                                "C",
                                "exam_workflow.rs:auto_allot_exams:insert_generated_student_paper",
                                "[DEBUG] failed to insert generated student paper during automatic allotment",
                                serde_json::json!({
                                    "course_id": course_id.to_hex(),
                                    "course_name": course.course_name,
                                    "student_id": sid.to_hex(),
                                    "student_name": student_name,
                                    "subject_id": slot.subject_id.to_hex(),
                                    "batch_id": batch_id.to_hex(),
                                    "attempt_number": attempt_no,
                                    "for_reappear": for_reappear,
                                    "error_status": status.as_u16(),
                                    "error_message": err.message,
                                }),
                            )
                            .await;
                            // #endregion
                            student_ok = false;
                            break;
                        }
                    }
                }
                if student_ok {
                    allotted_count += 1;
                    if for_reappear {
                        let attempt_coll =
                            db.collection::<CourseExamAttempt>("course_exam_attempts");
                        let _ = attempt_coll
                            .update_one(
                                doc! {
                                    "student_id": sid,
                                    "course_id": course_id,
                                    "attempt_number": attempt_no
                                },
                                doc! {
                                    "$setOnInsert": {
                                        "student_id": sid,
                                        "course_id": course_id,
                                        "center_id": center_id,
                                        "attempt_number": attempt_no,
                                        "appeared": false,
                                        "allow_reappear": false,
                                        "reappear_locked": false,
                                        "overall_result": "pending",
                                        "subject_marks": [],
                                        "total_obtained": 0.0,
                                        "total_marks": 0.0,
                                        "percentage": 0.0,
                                        "marks_submitted": false,
                                        "is_reappear_student": true,
                                        "created_at": mongodb::bson::DateTime::now(),
                                        "updated_at": mongodb::bson::DateTime::now(),
                                    }
                                },
                                mongodb::options::UpdateOptions::builder()
                                    .upsert(true)
                                    .build(),
                            )
                            .await;
                    }
                }
            }

            println!(
                "Automatically allotted {} exams for course {}: {} students",
                if for_reappear { "reappear" } else { "regular" },
                course.course_name,
                allotted_count
            );
            // #region debug-point C:course-summary
            report_auto_exam_debug(
                "pre-fix",
                "C",
                "exam_workflow.rs:auto_allot_exams:course_summary",
                "[DEBUG] automatic allotment summary for course attempt type",
                serde_json::json!({
                    "course_id": course_id.to_hex(),
                    "course_name": course.course_name,
                    "for_reappear": for_reappear,
                    "allotted_count": allotted_count,
                    "student_count": students.len(),
                }),
            )
            .await;
            // #endregion
        }
    }
}

pub async fn submit_marks_entry(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<MarksEntrySubmitRequest>,
) -> (StatusCode, Json<ExamEngineResponse>) {
    if claims.role != UserRole::Center
        && claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
    {
        return (
            StatusCode::FORBIDDEN,
            Json(ExamEngineResponse {
                success: false,
                message: "Unauthorized".into(),
            }),
        );
    }

    let sid = match ObjectId::parse_str(&payload.student_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid student".into(),
                }),
            );
        }
    };
    let cid = match ObjectId::parse_str(&payload.course_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid course".into(),
                }),
            );
        }
    };
    let attempt_no = payload.attempt_number.unwrap_or(1);

    let user_coll = db.collection::<User>("users");
    let student = match user_coll.find_one(doc! { "_id": sid }, None).await {
        Ok(Some(s)) => s,
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Student not found".into(),
                }),
            );
        }
    };
    let course = match get_course(&db, &cid).await {
        Some(c) => c,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Course not found".into(),
                }),
            );
        }
    };

    let elig = check_marks_entry_submit_eligibility(
        &db,
        &student,
        &cid,
        Some(&course.course_name),
        attempt_no,
    )
    .await;
    if !elig.eligible {
        return (
            StatusCode::BAD_REQUEST,
            Json(ExamEngineResponse {
                success: false,
                message: elig.reason.unwrap_or_else(|| "Not eligible".into()),
            }),
        );
    }

    let coll = db.collection::<CourseExamAttempt>("course_exam_attempts");
    let existing = coll
        .find_one(
            doc! {
                "student_id": sid,
                "course_id": cid,
                "attempt_number": attempt_no
            },
            None,
        )
        .await
        .ok()
        .flatten();

    if let Some(ref e) = existing {
        if e.marks_submitted && !e.marks_edit_unlocked {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Marks already submitted and locked".into(),
                }),
            );
        }
    }

    let online = is_online_exam_mode(&student.exam_mode);
    let mut computed_subjects = Vec::new();
    for s in &payload.subjects {
        let sub_oid = match ObjectId::parse_str(&s.subject_id) {
            Ok(o) => o,
            Err(_) => continue,
        };

        let (exam_obtained, exam_total, from_online, exam_readonly) =
            load_exam_marks_for_subject(&db, &student, &sub_oid, attempt_no).await;

        let (bp, subject_config_snapshot) =
            blueprint_context_for_subject(&db, &sid, &sub_oid, attempt_no).await;
        let subject_config = subject_config_snapshot.as_ref();
        let practical_enabled = subject_config
            .map(|sc| sc.practical_component.enabled)
            .unwrap_or(false);
        let assignment_enabled = subject_config
            .map(|sc| sc.assignment_component.enabled)
            .unwrap_or(false);
        let min_exam_marks = subject_config
            .map(|sc| sc.final_exam_component.min_marks)
            .unwrap_or(0.0);
        let min_practical_marks = subject_config
            .map(|sc| sc.practical_component.min_marks)
            .unwrap_or(0.0);
        let min_assignment_marks = subject_config
            .map(|sc| sc.assignment_component.min_marks)
            .unwrap_or(0.0);
        
        let practical_total = s.practical_total.max(
            subject_config
                .map(|sc| sc.practical_component.marks)
                .unwrap_or_else(|| {
                    bp.as_ref()
                        .and_then(|b| b.components.as_ref().map(|c| c.practical_marks))
                        .unwrap_or(0.0)
                }),
        );
        let assignment_total = s.assignment_total.max(
            subject_config
                .map(|sc| sc.assignment_component.marks)
                .unwrap_or_else(|| {
                    bp.as_ref()
                        .and_then(|b| b.components.as_ref().map(|c| c.assignment_marks))
                        .unwrap_or(0.0)
                }),
        );

        let practical_obtained = s.practical_obtained;
        let assignment_obtained = s.assignment_obtained;

        let final_exam_obtained = if exam_readonly || online {
            exam_obtained
        } else if s.exam_total > 0.0 || s.exam_obtained > 0.0 {
            s.exam_obtained
        } else {
            s.obtained.unwrap_or(exam_obtained)
        };
        let final_exam_total = if exam_total > 0.0 {
            exam_total
        } else if s.exam_total > 0.0 {
            s.exam_total
        } else {
            subject_config
                .map(|sc| sc.final_exam_component.marks)
                .unwrap_or_else(|| {
                    bp.as_ref()
                        .and_then(|b| b.components.as_ref().map(|c| c.exam_marks))
                        .unwrap_or(100.0)
                })
        };

        computed_subjects.push(marks_calculation::compute_overall_result(
            sub_oid,
            SubjectMarkInput {
                exam_obtained: final_exam_obtained,
                exam_total: final_exam_total,
                min_exam_marks,
                practical_obtained,
                practical_total,
                min_practical_marks,
                practical_enabled,
                assignment_obtained,
                assignment_total,
                min_assignment_marks,
                assignment_enabled,
                from_online_exam: from_online,
                exam_readonly: exam_readonly || online,
            },
        ));
    }

    let overall = marks_calculation::aggregate_overall(computed_subjects);

    let center_id = student
        .parent_id
        .unwrap_or_else(|| ObjectId::parse_str(&claims.sub).unwrap_or_else(|_| ObjectId::new()));

    let update = doc! {
        "$set": {
            "student_id": sid,
            "course_id": cid,
            "center_id": center_id,
            "attempt_number": attempt_no,
            "appeared": true,
            "subject_marks": mongodb::bson::to_bson(&overall.subject_marks).unwrap_or(mongodb::bson::Bson::Array(vec![])),
            "total_obtained": overall.total_obtained,
            "total_marks": overall.total_marks,
            "percentage": overall.percentage,
            "overall_result": overall.overall_result.clone(),
            "marks_submitted": true,
            "marks_edit_unlocked": false,
            "marks_submitted_at": mongodb::bson::DateTime::now(),
            "reappear_locked": true,
            "is_reappear_student": attempt_no > 1,
            "updated_at": mongodb::bson::DateTime::now(),
        },
        "$setOnInsert": {
            "allow_reappear": false,
            "created_at": mongodb::bson::DateTime::now(),
        }
    };

    match coll
        .update_one(
            doc! {
                "student_id": sid,
                "course_id": cid,
                "attempt_number": attempt_no
            },
            update,
            mongodb::options::UpdateOptions::builder()
                .upsert(true)
                .build(),
        )
        .await
    {
        Ok(_) => {
            mark_course_attempt_appeared(&db, sid, center_id, cid, attempt_no).await;
            if overall.overall_result.eq_ignore_ascii_case("fail") {
                ensure_next_attempt_on_fail(&db, sid, cid, center_id, attempt_no).await;
            }

            // Add eligibility entries for marksheet and certificate
            let elig_coll = db.collection::<CertificateEligibility>("certificate_eligibility");
            let now = mongodb::bson::DateTime::now();

            // Marksheet eligibility (attempt-specific)
            let marksheet_elig = CertificateEligibility {
                id: None,
                student_id: sid,
                course_id: cid,
                eligibility_type: CertificateType::Marksheet,
                attempt_number: Some(attempt_no),
                eligible_at: now,
                processed: false,
                processed_at: None,
                created_at: now,
                updated_at: now,
            };
            let _ = elig_coll
                .update_one(
                    doc! {
                        "student_id": sid,
                        "course_id": cid,
                        "eligibility_type": "marksheet",
                        "attempt_number": attempt_no
                    },
                    doc! { "$setOnInsert": mongodb::bson::to_bson(&marksheet_elig).unwrap() },
                    mongodb::options::UpdateOptions::builder()
                        .upsert(true)
                        .build(),
                )
                .await;

            // Certificate eligibility (only if overall result is pass, no attempt number)
            if overall.overall_result.eq_ignore_ascii_case("pass") {
                let cert_elig = CertificateEligibility {
                    id: None,
                    student_id: sid,
                    course_id: cid,
                    eligibility_type: CertificateType::Certificate,
                    attempt_number: None,
                    eligible_at: now,
                    processed: false,
                    processed_at: None,
                    created_at: now,
                    updated_at: now,
                };
                let _ = elig_coll
                    .update_one(
                        doc! {
                            "student_id": sid,
                            "course_id": cid,
                            "eligibility_type": "certificate"
                        },
                        doc! { "$setOnInsert": mongodb::bson::to_bson(&cert_elig).unwrap() },
                        mongodb::options::UpdateOptions::builder()
                            .upsert(true)
                            .build(),
                    )
                    .await;
            }

            (
                StatusCode::OK,
                Json(ExamEngineResponse {
                    success: true,
                    message: "Marks submitted successfully".into(),
                }),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ExamEngineResponse {
                success: false,
                message: "Submit failed".into(),
            }),
        ),
    }
}

pub async fn submit_marks_change_request(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<MarksChangeRequestPayload>,
) -> (StatusCode, Json<ExamEngineResponse>) {
    if claims.role != UserRole::Center {
        return (
            StatusCode::FORBIDDEN,
            Json(ExamEngineResponse {
                success: false,
                message: "Only centers can request changes".into(),
            }),
        );
    }

    let reason = payload.reason.trim();
    if reason.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ExamEngineResponse {
                success: false,
                message: "Reason is required".into(),
            }),
        );
    }

    let sid = match ObjectId::parse_str(&payload.student_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid student".into(),
                }),
            );
        }
    };
    let cid = match ObjectId::parse_str(&payload.course_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid course".into(),
                }),
            );
        }
    };
    let attempt_no = payload.attempt_number.unwrap_or(1);
    let center_id = match ObjectId::parse_str(&claims.sub) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid center".into(),
                }),
            );
        }
    };

    let attempt = db
        .collection::<CourseExamAttempt>("course_exam_attempts")
        .find_one(
            doc! {
                "student_id": sid,
                "course_id": cid,
                "attempt_number": attempt_no,
                "marks_submitted": true,
            },
            None,
        )
        .await
        .ok()
        .flatten();

    let attempt = match attempt {
        Some(a) => a,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "No submitted marks found for this attempt".into(),
                }),
            );
        }
    };

    if attempt.center_id != center_id {
        return (
            StatusCode::FORBIDDEN,
            Json(ExamEngineResponse {
                success: false,
                message: "Unauthorized".into(),
            }),
        );
    }

    if get_pending_change_request(&db, &sid, &cid, attempt_no)
        .await
        .is_some()
    {
        return (
            StatusCode::BAD_REQUEST,
            Json(ExamEngineResponse {
                success: false,
                message: "A pending request already exists".into(),
            }),
        );
    }

    let req = MarksChangeRequest {
        id: None,
        student_id: sid,
        course_id: cid,
        center_id,
        attempt_number: attempt_no,
        reason: reason.to_string(),
        status: "pending".into(),
        admin_viewed: false,
        admin_response: None,
        responded_by: None,
        created_at: mongodb::bson::DateTime::now(),
        updated_at: mongodb::bson::DateTime::now(),
    };

    match db
        .collection::<MarksChangeRequest>("marks_change_requests")
        .insert_one(&req, None)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(ExamEngineResponse {
                success: true,
                message: "Change request submitted".into(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ExamEngineResponse {
                success: false,
                message: "Failed to save request".into(),
            }),
        ),
    }
}

#[derive(Debug, Deserialize)]
pub struct CenterRequestsQuery {
    pub search: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CenterRequestRow {
    pub id: String,
    pub center_name: String,
    pub student_name: String,
    pub enrollment_number: Option<String>,
    pub course_name: String,
    pub request_date: mongodb::bson::DateTime,
    pub status: String,
    pub is_new: bool,
    pub student_id: String,
    pub course_id: String,
    pub attempt_number: i32,
}

pub async fn list_center_marks_requests(
    State(db): State<Database>,
    claims: Claims,
    Query(q): Query<CenterRequestsQuery>,
) -> (StatusCode, Json<Vec<CenterRequestRow>>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(vec![]));
    }

    let coll = db.collection::<MarksChangeRequest>("marks_change_requests");
    let mut filter = doc! {};
    if let Some(ref st) = q.status {
        match st.as_str() {
            "new" => {
                filter.insert("admin_viewed", false);
            }
            "responded" => {
                filter.insert("status", doc! { "$in": ["approved", "disapproved"] });
            }
            "not_responded" => {
                filter.insert("status", "pending");
            }
            "pending" => {
                filter.insert("status", "pending");
            }
            _ => {}
        }
    }

    let mut rows = Vec::new();
    if let Ok(mut cursor) = coll
        .find(
            filter,
            mongodb::options::FindOptions::builder()
                .sort(doc! { "created_at": -1 })
                .build(),
        )
        .await
    {
        while let Some(Ok(req)) = cursor.next().await {
            let user_coll = db.collection::<User>("users");
            let center_coll = db.collection::<crate::models::center::Center>("centers");

            let student = user_coll
                .find_one(doc! { "_id": req.student_id }, None)
                .await
                .ok()
                .flatten();
            let course = get_course(&db, &req.course_id).await;
            let center = center_coll
                .find_one(doc! { "user_id": req.center_id }, None)
                .await
                .ok()
                .flatten();

            let center_name = center
                .as_ref()
                .map(|c| c.name.clone())
                .unwrap_or_else(|| "Unknown Center".into());
            let student_name = student
                .as_ref()
                .and_then(|s| s.full_name.clone())
                .unwrap_or_else(|| "Unknown".into());
            let enrollment = student.as_ref().and_then(|s| s.enrollment_number.clone());
            let course_name = course
                .as_ref()
                .map(|c| c.course_name.clone())
                .unwrap_or_else(|| "Unknown".into());

            if let Some(ref search) = q.search {
                let sl = search.to_lowercase();
                let ok = center_name.to_lowercase().contains(&sl)
                    || student_name.to_lowercase().contains(&sl)
                    || enrollment
                        .as_deref()
                        .map(|e| e.to_lowercase().contains(&sl))
                        .unwrap_or(false)
                    || req
                        .id
                        .as_ref()
                        .map(|id| id.to_hex().contains(&sl))
                        .unwrap_or(false);
                if !ok {
                    continue;
                }
            }

            rows.push(CenterRequestRow {
                id: req.id.map(|id| id.to_hex()).unwrap_or_default(),
                center_name,
                student_name,
                enrollment_number: enrollment,
                course_name,
                request_date: req.created_at,
                status: req.status.clone(),
                is_new: !req.admin_viewed,
                student_id: req.student_id.to_hex(),
                course_id: req.course_id.to_hex(),
                attempt_number: req.attempt_number,
            });
        }
    }

    (StatusCode::OK, Json(rows))
}

pub async fn get_center_marks_request(
    State(db): State<Database>,
    claims: Claims,
    Path(request_id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Unauthorized" })),
        );
    }

    let rid = match ObjectId::parse_str(&request_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Invalid id" })),
            );
        }
    };

    let coll = db.collection::<MarksChangeRequest>("marks_change_requests");
    let req = match coll.find_one(doc! { "_id": rid }, None).await {
        Ok(Some(r)) => r,
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Not found" })),
            );
        }
    };

    if !req.admin_viewed {
        let _ = coll
            .update_one(
                doc! { "_id": rid },
                doc! { "$set": { "admin_viewed": true, "updated_at": mongodb::bson::DateTime::now() } },
                None,
            )
            .await;
    }

    let user_coll = db.collection::<User>("users");
    let center_coll = db.collection::<crate::models::center::Center>("centers");
    let student = user_coll
        .find_one(doc! { "_id": req.student_id }, None)
        .await
        .ok()
        .flatten();
    let center = center_coll
        .find_one(doc! { "user_id": req.center_id }, None)
        .await
        .ok()
        .flatten();
    let course = get_course(&db, &req.course_id).await;

    let attempt = db
        .collection::<CourseExamAttempt>("course_exam_attempts")
        .find_one(
            doc! {
                "student_id": req.student_id,
                "course_id": req.course_id,
                "attempt_number": req.attempt_number
            },
            None,
        )
        .await
        .ok()
        .flatten();

    let mut history: Vec<CourseExamAttempt> = Vec::new();
    if let Ok(mut c) = db
        .collection::<CourseExamAttempt>("course_exam_attempts")
        .find(
            doc! { "student_id": req.student_id, "course_id": req.course_id },
            mongodb::options::FindOptions::builder()
                .sort(doc! { "attempt_number": 1 })
                .build(),
        )
        .await
    {
        while let Some(Ok(a)) = c.next().await {
            history.push(a);
        }
    }

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "request": {
                "id": request_id,
                "reason": req.reason,
                "status": req.status,
                "admin_response": req.admin_response,
                "attempt_number": req.attempt_number,
                "created_at": req.created_at,
            },
            "center": center,
            "student": student,
            "course": course,
            "marks": attempt,
            "attempt_history": history,
        })),
    )
}

#[derive(Debug, Deserialize)]
pub struct RespondCenterRequestPayload {
    pub action: String,
    pub admin_response: Option<String>,
}

pub async fn respond_center_marks_request(
    State(db): State<Database>,
    claims: Claims,
    Path(request_id): Path<String>,
    Json(payload): Json<RespondCenterRequestPayload>,
) -> (StatusCode, Json<ExamEngineResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(ExamEngineResponse {
                success: false,
                message: "Unauthorized".into(),
            }),
        );
    }

    let rid = match ObjectId::parse_str(&request_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid request id".into(),
                }),
            );
        }
    };

    let action = payload.action.to_lowercase();
    if action != "approve" && action != "disapprove" {
        return (
            StatusCode::BAD_REQUEST,
            Json(ExamEngineResponse {
                success: false,
                message: "Action must be approve or disapprove".into(),
            }),
        );
    }

    let req_coll = db.collection::<MarksChangeRequest>("marks_change_requests");
    let req = match req_coll.find_one(doc! { "_id": rid }, None).await {
        Ok(Some(r)) => r,
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Request not found".into(),
                }),
            );
        }
    };

    if req.status != "pending" {
        return (
            StatusCode::BAD_REQUEST,
            Json(ExamEngineResponse {
                success: false,
                message: "Request already responded".into(),
            }),
        );
    }

    let new_status = if action == "approve" {
        "approved"
    } else {
        "disapproved"
    };
    let admin_id = ObjectId::parse_str(&claims.sub).ok();

    let _ = req_coll
        .update_one(
            doc! { "_id": rid },
            doc! {
                "$set": {
                    "status": new_status,
                    "admin_response": payload.admin_response,
                    "responded_by": admin_id,
                    "admin_viewed": true,
                    "updated_at": mongodb::bson::DateTime::now(),
                }
            },
            None,
        )
        .await;

    if action == "approve" {
        let attempt_coll = db.collection::<CourseExamAttempt>("course_exam_attempts");
        let _ = attempt_coll
            .update_one(
                doc! {
                    "student_id": req.student_id,
                    "course_id": req.course_id,
                    "attempt_number": req.attempt_number
                },
                doc! {
                    "$set": {
                        "marks_edit_unlocked": true,
                        "updated_at": mongodb::bson::DateTime::now(),
                    }
                },
                None,
            )
            .await;
    }

    (
        StatusCode::OK,
        Json(ExamEngineResponse {
            success: true,
            message: format!("Request {}", new_status),
        }),
    )
}

pub async fn get_batch_paper_for_subject(
    State(db): State<Database>,
    claims: Claims,
    Path((batch_id, subject_id)): Path<(String, String)>,
) -> (StatusCode, Json<serde_json::Value>) {
    let bid = match ObjectId::parse_str(&batch_id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::Value::Null)),
    };
    let sid = match ObjectId::parse_str(&subject_id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::Value::Null)),
    };

    if claims.role == UserRole::Center {
        if let Ok(center_oid) = ObjectId::parse_str(&claims.sub) {
            let paper_coll = db.collection::<StudentPaper>("student_papers");
            let count = paper_coll
                .count_documents(
                    doc! { "allotment_batch_id": bid, "center_id": center_oid },
                    None,
                )
                .await
                .unwrap_or(0);
            if count == 0 {
                return (StatusCode::FORBIDDEN, Json(serde_json::Value::Null));
            }
        }
    }

    let batch_coll = db.collection::<ExamAllotmentBatch>("exam_allotment_batches");
    let batch = match batch_coll.find_one(doc! { "_id": bid }, None).await {
        Ok(Some(b)) => b,
        _ => return (StatusCode::NOT_FOUND, Json(serde_json::Value::Null)),
    };

    let qs = batch
        .subject_question_sets
        .iter()
        .find(|q| q.subject_id == sid);
    let slot = batch.subjects.iter().find(|s| s.subject_id == sid);

    match (qs, slot) {
        (Some(q), Some(s)) => {
            let paper_coll = db.collection::<StudentPaper>("student_papers");
            let sample = paper_coll
                .find_one(doc! { "allotment_batch_id": bid, "subject_id": sid }, None)
                .await
                .ok()
                .flatten();

            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "batch_id": batch_id,
                    "subject_id": subject_id,
                    "blueprint_id": s.blueprint_id.to_hex(),
                    "question_count": q.questions.len(),
                    "sample_paper_id": sample.and_then(|p| p.id.map(|id| id.to_hex())),
                    "start_window": s.start_window,
                    "end_window": s.end_window,
                })),
            )
        }
        _ => (StatusCode::NOT_FOUND, Json(serde_json::Value::Null)),
    }
}

pub async fn list_allotment_batches_for_center(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<serde_json::Value>>) {
    let paper_coll = db.collection::<StudentPaper>("student_papers");
    let mut filter = doc! { "allotment_batch_id": { "$exists": true, "$ne": null } };

    if claims.role == UserRole::Center {
        if let Ok(c) = ObjectId::parse_str(&claims.sub) {
            filter.insert("center_id", c);
        }
    }

    let mut batch_ids = std::collections::HashSet::new();
    if let Ok(mut cursor) = paper_coll.find(filter, None).await {
        while let Some(Ok(p)) = cursor.next().await {
            if let Some(bid) = p.allotment_batch_id {
                batch_ids.insert(bid);
            }
        }
    }

    let batch_coll = db.collection::<ExamAllotmentBatch>("exam_allotment_batches");
    let mut out = Vec::new();
    for bid in batch_ids {
        if let Ok(Some(batch)) = batch_coll.find_one(doc! { "_id": bid }, None).await {
            out.push(serde_json::json!({
                "batch_id": bid.to_hex(),
                "course_id": batch.course_id.to_hex(),
                "for_reappear": batch.for_reappear,
                "subjects": batch.subjects.iter().map(|s| serde_json::json!({
                    "subject_id": s.subject_id.to_hex(),
                    "blueprint_id": s.blueprint_id.to_hex(),
                    "start_window": s.start_window,
                })).collect::<Vec<_>>(),
                "created_at": batch.created_at,
            }));
        }
    }

    (StatusCode::OK, Json(out))
}

pub async fn trigger_automatic_exam_allotment(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"success": false, "message": "Unauthorized"})),
        );
    }

    let db_clone = db.clone();
    tokio::spawn(async move {
        crate::services::exam_auto_scheduler::run_auto_exam_allotment_cycle(&db_clone, true).await;
    });

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "success": true,
            "message": "Automatic exam allotment triggered successfully"
        })),
    )
}

#[cfg(test)]
mod center_filter_tests {
    use super::{flatten_center_id_strings, parse_center_id_filter, CenterIds};
    use mongodb::bson::oid::ObjectId;

    #[test]
    fn parse_center_ids_from_comma_separated_string() {
        let id1 = ObjectId::new().to_hex();
        let id2 = ObjectId::new().to_hex();
        let raw = format!("{id1},{id2}");
        let parsed = parse_center_id_filter(Some(CenterIds(vec![raw]))).expect("parsed");
        assert_eq!(parsed.len(), 2);
    }

    #[test]
    fn parse_center_ids_from_repeated_values() {
        let id1 = ObjectId::new().to_hex();
        let id2 = ObjectId::new().to_hex();
        let parsed =
            parse_center_id_filter(Some(CenterIds(vec![id1.clone(), id2.clone()])))
                .expect("parsed");
        assert_eq!(parsed.len(), 2);
    }

    #[test]
    fn flatten_center_ids_handles_mixed_formats() {
        let id1 = ObjectId::new().to_hex();
        let id2 = ObjectId::new().to_hex();
        let flat = flatten_center_id_strings(Some(CenterIds(vec![
            format!("{id1},{id2}"),
            id1.clone(),
        ])));
        assert_eq!(flat.len(), 3);
        assert!(flat.contains(&id1));
        assert!(flat.contains(&id2));
    }
}
