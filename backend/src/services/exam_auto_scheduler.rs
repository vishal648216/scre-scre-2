//! Dedicated Automatic Exam Scheduler Service.
//!
//! Responsibility:
//! 1. Runs continuously from the backend background task (woken minutely).
//! 2. Reads Automation Settings.
//! 3. If today == configured Exam Allotment Day, triggers automatic allotment.
//!
//! Architectural invariants:
//! - There is ONLY one source of truth for allotment logic: `internal_bulk_allot`.
//!   This service only builds the `BulkAllotRequest` and delegates to it.
//! - Per-course, per-month, per-type execution metadata is persisted in
//!   `exam_auto_allotment_runs` to ensure the scheduler never allots the same
//!   course/month/type twice.

use chrono::{Datelike, Duration, Timelike, Utc};
use chrono_tz::Asia::Kolkata;
use futures_util::{StreamExt, TryStreamExt};
use mongodb::bson::{doc, oid::ObjectId, Document};
use mongodb::options::FindOneAndUpdateOptions;
use mongodb::options::IndexOptions;
use mongodb::options::ReturnDocument;
use mongodb::{Database, IndexModel};

use crate::handlers::exam_workflow::internal_bulk_allot;
use crate::handlers::exam_workflow::BulkAllotRequest;
use crate::handlers::exam_workflow::BulkAllotSubject;
use crate::models::course::Course;
use crate::models::exam_engine::ExamBlueprint;
use crate::models::exam_workflow::ExamAutoAllotmentRun;
use crate::models::system_settings::{system_settings_singleton_id, SystemSettings};
use mongodb::bson::from_document;

const SYSTEM_CREATED_BY: &str = "000000000000000000000000";

fn system_created_by() -> ObjectId {
    ObjectId::parse_str(SYSTEM_CREATED_BY).unwrap_or_else(|_| ObjectId::new())
}

async fn ensure_run_collection_indexes(db: &Database) {
    let coll = db.collection::<Document>("exam_auto_allotment_runs");
    let _ = coll
        .create_index(
            IndexModel::builder()
                .keys(doc! {
                    "course_id": 1, "year": 1, "month": 1, "for_reappear": 1
                })
                .options(
                    IndexOptions::builder()
                        .name("auto_allot_run_unique_cycle".to_string())
                        .unique(true)
                        .build(),
                )
                .build(),
            None,
        )
        .await;
    let _ = coll
        .create_index(
            IndexModel::builder()
                .keys(doc! { "status": 1, "updated_at": -1 })
                .options(
                    IndexOptions::builder()
                        .name("auto_allot_run_status".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;
}

async fn load_settings(db: &Database) -> SystemSettings {
    let coll = db.collection::<SystemSettings>("system_settings");
    let singleton_id = system_settings_singleton_id();
    if let Ok(Some(s)) = coll.find_one(doc! { "_id": singleton_id }, None).await {
        return s;
    }
    match coll.find_one(None, None).await {
        Ok(Some(s)) => s,
        _ => SystemSettings::default(),
    }
}

fn parse_exam_time(time_str: Option<&str>) -> (u32, u32) {
    time_str
        .and_then(|t| {
            let parts: Vec<&str> = t.split(':').collect();
            if parts.len() != 2 {
                return None;
            }
            let h = parts[0].parse::<u32>().ok()?;
            let m = parts[1].parse::<u32>().ok()?;
            if !(0..24).contains(&h) || !(0..60).contains(&m) {
                return None;
            }
            Some((h, m))
        })
        .unwrap_or((9, 0))
}

fn with_day_safe<Tz: chrono::TimeZone>(
    dt: chrono::DateTime<Tz>,
    day: u32,
) -> chrono::DateTime<Tz> {
    let max_day = dt
        .with_day(31)
        .or_else(|| dt.with_day(30))
        .or_else(|| dt.with_day(29))
        .or_else(|| dt.with_day(28))
        .map(|d| d.day())
        .unwrap_or(1);
    let safe_day = day.min(max_day);
    dt.with_day(safe_day).unwrap_or(dt)
}

fn with_hms_safe<Tz: chrono::TimeZone>(
    dt: chrono::DateTime<Tz>,
    hour: u32,
    min: u32,
) -> chrono::DateTime<Tz> {
    let safe_hour = hour.min(23);
    let safe_min = min.min(59);
    dt.with_hour(safe_hour)
        .and_then(|d| d.with_minute(safe_min))
        .and_then(|d| d.with_second(0))
        .and_then(|d| d.with_nanosecond(0))
        .unwrap_or(dt)
}

async fn acquire_pending_run(
    db: &Database,
    course_id: ObjectId,
    year: i32,
    month: i32,
    for_reappear: bool,
) -> Option<ExamAutoAllotmentRun> {
    let coll = db.collection::<ExamAutoAllotmentRun>("exam_auto_allotment_runs");
    let now = mongodb::bson::DateTime::now();
    let filter = doc! {
        "course_id": course_id,
        "year": year,
        "month": month,
        "for_reappear": for_reappear,
    };
    let update = doc! {
        "$setOnInsert": {
            "course_id": course_id,
            "year": year,
            "month": month,
            "for_reappear": for_reappear,
            "status": "pending",
            "allotted_count": 0,
            "skipped_count": 0,
            "created_at": now,
            "updated_at": now,
        }
    };
    let opts = FindOneAndUpdateOptions::builder()
        .upsert(true)
        .return_document(ReturnDocument::After)
        .build();
    coll.find_one_and_update(filter, update, opts).await.ok().flatten()
}

async fn update_run_status(
    db: &Database,
    run_id: ObjectId,
    status: &str,
    batch_id: Option<ObjectId>,
    allotted_count: u32,
    skipped_count: u32,
    error_message: Option<String>,
) {
    let coll = db.collection::<ExamAutoAllotmentRun>("exam_auto_allotment_runs");
    let mut set_doc = doc! {
        "status": status,
        "allotted_count": allotted_count as i64,
        "skipped_count": skipped_count as i64,
        "updated_at": mongodb::bson::DateTime::now(),
    };
    if let Some(bid) = batch_id {
        set_doc.insert("batch_id", bid);
    }
    if let Some(msg) = error_message {
        set_doc.insert("error_message", msg);
    }
    let _ = coll
        .update_one(doc! { "_id": run_id }, doc! { "$set": set_doc }, None)
        .await;
}

async fn run_already_successful(
    db: &Database,
    course_id: ObjectId,
    year: i32,
    month: i32,
    for_reappear: bool,
) -> bool {
    let coll = db.collection::<ExamAutoAllotmentRun>("exam_auto_allotment_runs");
    matches!(
        coll.find_one(
            doc! {
                "course_id": course_id,
                "year": year,
                "month": month,
                "for_reappear": for_reappear,
                "status": "success",
            },
            None,
        )
        .await,
        Ok(Some(_))
    )
}

fn format_rfc3339<Tz: chrono::TimeZone>(dt: chrono::DateTime<Tz>) -> String
where
    Tz::Offset: std::fmt::Display,
{
    dt.with_timezone(&Utc).to_rfc3339()
}

async fn build_auto_subjects(
    default_bp: &ExamBlueprint,
    exam_start_ist: chrono::DateTime<chrono_tz::Tz>,
    subject_gap_minutes: i32,
    for_reappear: bool,
) -> Result<Vec<BulkAllotSubject>, String> {
    let mut slots: Vec<BulkAllotSubject> = Vec::new();
    let mut cursor = exam_start_ist;
    let bp_id_hex = default_bp
        .id
        .map(|id| id.to_hex())
        .ok_or_else(|| "blueprint missing id".to_string())?;

    for subject_config in default_bp.subjects.iter() {
        let duration = subject_config.duration_minutes.max(1) as i64;
        let start_utc = cursor.with_timezone(&Utc);
        let end_utc = start_utc + Duration::minutes(duration);
        slots.push(BulkAllotSubject {
            subject_id: subject_config.subject_id.to_hex(),
            blueprint_id: bp_id_hex.clone(),
            start_window: format_rfc3339(start_utc),
            end_window: format_rfc3339(end_utc),
            bank_id_override: if for_reappear
                && default_bp.allow_bank_override
            {
                subject_config.reappear_question_bank_id.map(|id| id.to_hex())
            } else {
                None
            },
        });
        let gap = subject_gap_minutes.max(0) as i64;
        cursor = cursor + Duration::minutes(duration + gap);
    }
    Ok(slots)
}

async fn process_course_cycle(
    db: &Database,
    course: &Course,
    default_bp: &ExamBlueprint,
    year: i32,
    month: i32,
    allotment_day: i32,
    exam_day: i32,
    exam_hour: u32,
    exam_minute: u32,
    subject_gap_minutes: i32,
    force: bool,
) {
    let course_id = match course.id {
        Some(id) => id,
        None => return,
    };
    let course_name = course.course_name.clone();

    let y = year;
    let m = month;
    let d = exam_day.max(1).min(31) as u32;
    let naive = chrono::NaiveDate::from_ymd_opt(y, m as u32, 1).unwrap_or_else(|| {
        chrono::Utc::now().with_timezone(&Kolkata).date_naive()
    });
    let max_day = naive
        .with_day(31)
        .or_else(|| naive.with_day(30))
        .or_else(|| naive.with_day(29))
        .or_else(|| naive.with_day(28))
        .map(|nd| nd.day())
        .unwrap_or(28);
    let safe_day = d.min(max_day);
    let exam_day_naive = naive
        .with_day(safe_day)
        .unwrap_or_else(|| chrono::Utc::now().with_timezone(&Kolkata).date_naive());
    let exam_time_naive = chrono::NaiveTime::from_hms_opt(
        exam_hour.min(23),
        exam_minute.min(59),
        0,
    )
    .unwrap_or_else(|| chrono::NaiveTime::from_hms_opt(9, 0, 0).unwrap());
    use chrono::TimeZone;
    let naive_dt = chrono::NaiveDateTime::new(exam_day_naive, exam_time_naive);
    let tz: chrono_tz::Tz = Kolkata;
    let mut exam_date_ist = match tz
        .from_local_datetime(&naive_dt)
        .single()
    {
        Some(dt) => dt,
        None => {
            chrono::Utc::now().with_timezone(&Kolkata)
        }
    };
    if exam_day < allotment_day {
        exam_date_ist = exam_date_ist + chrono::Months::new(1);
    }
    let exam_start = exam_date_ist;

    for &for_reappear in &[false, true] {
        if force {
            eprintln!(
                "[auto-exam-scheduler] force=true: bypassing already-successful dedup for course={} ({}) type={} {}-{}",
                course_name,
                course_id,
                if for_reappear { "reappear" } else { "regular" },
                year, month
            );
        } else if run_already_successful(db, course_id, year, month, for_reappear).await {
            eprintln!(
                "[auto-exam-scheduler] skip: course={} ({}) type={} {}-{}: already successful",
                course_name,
                course_id,
                if for_reappear { "reappear" } else { "regular" },
                year, month
            );
            continue;
        }

        let subjects = match build_auto_subjects(
            default_bp,
            exam_start,
            subject_gap_minutes,
            for_reappear,
        )
        .await
        {
            Ok(s) => s,
            Err(e) => {
                eprintln!(
                    "[auto-exam-scheduler] build subjects failed course={}: {}",
                    course_name, e
                );
                continue;
            }
        };

        if subjects.is_empty() {
            eprintln!(
                "[auto-exam-scheduler] skip course={} type={}: no blueprint subjects",
                course_name,
                if for_reappear { "reappear" } else { "regular" }
            );
            continue;
        }

        let run = match acquire_pending_run(db, course_id, year, month, for_reappear).await {
            Some(r) => r,
            None => {
                eprintln!(
                    "[auto-exam-scheduler] could not acquire run row for course={} type={}",
                    course_name,
                    if for_reappear { "reappear" } else { "regular" }
                );
                continue;
            }
        };
        let run_id = match run.id {
            Some(id) => id,
            None => continue,
        };

        let payload = BulkAllotRequest {
            course_id: course_id.to_hex(),
            for_reappear,
            force: Some(force),
            center_ids: None,
            subjects,
        };

        eprintln!(
            "[auto-exam-scheduler] invoking internal_bulk_allot: course={} type={} {}-{}",
            course_name,
            if for_reappear { "reappear" } else { "regular" },
            year, month
        );

        let created_by = system_created_by();
        let (status_code, axum::Json(resp)) =
            internal_bulk_allot(db, created_by, None, Some("automatic".into()), payload).await;

        if !status_code.is_success() {
            let msg = resp.message.clone();
            eprintln!(
                "[auto-exam-scheduler] FAILED course={} type={}: status={:?} msg={}",
                course_name,
                if for_reappear { "reappear" } else { "regular" },
                status_code, msg
            );
            update_run_status(db, run_id, "failed", None, 0, 0, Some(msg)).await;
            continue;
        }

        let batch_oid = resp
            .batch_id
            .as_ref()
            .and_then(|s| ObjectId::parse_str(s).ok());
        let allotted = resp.allotted_count;
        let skipped = resp.skipped.len() as u32;

        eprintln!(
            "[auto-exam-scheduler] OK course={} type={}: allotted={} skipped={}",
            course_name,
            if for_reappear { "reappear" } else { "regular" },
            allotted, skipped
        );

        let new_status = if resp.success {
            "success"
        } else {
            "skipped"
        };
        update_run_status(
            db,
            run_id,
            new_status,
            batch_oid,
            allotted,
            skipped,
            None,
        )
        .await;
    }
}

pub async fn run_auto_exam_allotment_cycle(db: &Database, force: bool) {
    ensure_run_collection_indexes(db).await;

    let settings = load_settings(db).await;
    let now_ist = Utc::now().with_timezone(&Kolkata);
    let current_day = now_ist.day() as i32;
    eprintln!(
        "[auto-exam-scheduler] tick: force={} ist_day={} enabled={} allotment_day={:?} exam_day={:?} exam_time={:?}",
        force,
        current_day,
        settings.auto_exam_enabled,
        settings.auto_exam_allotment_day,
        settings.auto_exam_day,
        settings.auto_exam_time,
    );
    if !force && !settings.auto_exam_enabled {
        eprintln!(
            "[auto-exam-scheduler] skip tick: auto_exam_enabled=false (to enable: Admin → Exam Allotment → Auto Exam Settings → toggle ON + Save)"
        );
        return;
    }
    let allotment_day = match settings.auto_exam_allotment_day {
        Some(d) => d,
        None if !force => {
            eprintln!(
                "[auto-exam-scheduler] skip tick: auto_exam_allotment_day=None (set a day 1-31 in Auto Exam Settings)"
            );
            return;
        }
        None => Utc::now().with_timezone(&Kolkata).day() as i32,
    };
    let exam_day = settings.auto_exam_day.unwrap_or(allotment_day);
    let subject_gap = settings.auto_exam_subject_gap_minutes;
    let (exam_hour, exam_minute) = parse_exam_time(settings.auto_exam_time.as_deref());

    if !force && current_day != allotment_day {
        eprintln!(
            "[auto-exam-scheduler] skip tick: IST day {} != configured allotment_day {} (will run on day {} each month)",
            current_day, allotment_day, allotment_day
        );
        return;
    }
    let cycle_year = now_ist.year();
    let cycle_month = now_ist.month() as i32;

    eprintln!(
        "[auto-exam-scheduler] cycle start: day={} year={} month={} force={} exam_day={} exam_time={:02}:{:02} gap_min={}",
        current_day, cycle_year, cycle_month, force, exam_day, exam_hour, exam_minute, subject_gap
    );

    let course_coll = db.collection::<Document>("courses");
    let bp_coll = db.collection::<Document>("exam_blueprints");

    let mut courses_loaded: Vec<Course> = Vec::new();
    if let Ok(mut cursor) = course_coll.find(None, None).await {
        while let Some(doc_res) = cursor.next().await {
            let doc = match doc_res {
                Ok(d) => d,
                Err(e) => {
                    eprintln!("[auto-exam-scheduler] course cursor error: {e}");
                    continue;
                }
            };
            let course_name = doc
                .get_str("course_name")
                .map(|s| s.to_string())
                .unwrap_or_else(|_| "?".into());
            match from_document::<Course>(doc) {
                Ok(c) => courses_loaded.push(c),
                Err(e) => eprintln!(
                    "[auto-exam-scheduler] SKIP course {course_name}: Course BSON deserialization error: {e}"
                ),
            }
        }
    }

    for course in &courses_loaded {
        let course_id = match course.id {
            Some(id) => id,
            None => continue,
        };
        let default_bp_doc = match bp_coll
            .find_one(
                doc! { "course_id": course_id, "default_blueprint": true },
                None,
            )
            .await
        {
            Ok(Some(bp)) => bp,
            Ok(None) => {
                eprintln!(
                    "[auto-exam-scheduler] course={} ({}): no explicit default_blueprint=true; trying fallback pick",
                    course.course_name, course_id
                );
                let fallback = bp_coll
                    .find(
                        doc! { "course_id": course_id },
                        mongodb::options::FindOptions::builder()
                            .sort(doc! { "created_at": -1 })
                            .build(),
                    )
                    .await;
                match fallback {
                    Ok(mut cursor) => {
                        let mut chosen: Option<mongodb::bson::Document> = None;
                        while let Ok(Some(cand)) = cursor.try_next().await {
                            let n_subjects = cand
                                .get_array("subjects")
                                .map(|a| a.len())
                                .unwrap_or(0);
                            if n_subjects > 0 {
                                chosen = Some(cand);
                                break;
                            }
                            if chosen.is_none() {
                                chosen = Some(cand);
                            }
                        }
                        match chosen {
                            Some(bp) => {
                                eprintln!(
                                    "[auto-exam-scheduler] course={} ({}): using fallback blueprint",
                                    course.course_name, course_id
                                );
                                bp
                            }
                            None => {
                                eprintln!(
                                    "[auto-exam-scheduler] skip course={} ({}): no default blueprint AND no fallback blueprint found",
                                    course.course_name, course_id
                                );
                                continue;
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!(
                            "[auto-exam-scheduler] skip course={} ({}): fallback blueprint query error: {e}",
                            course.course_name, course_id
                        );
                        continue;
                    }
                }
            }
            Err(e) => {
                eprintln!(
                    "[auto-exam-scheduler] skip course={} ({}): default blueprint query error: {e}",
                    course.course_name, course_id
                );
                continue;
            }
        };
        let mut default_bp: ExamBlueprint = match from_document(default_bp_doc.clone()) {
            Ok(bp) => bp,
            Err(e) => {
                eprintln!(
                    "[auto-exam-scheduler] skip course={} ({}): ExamBlueprint BSON deserialization error: {e}",
                    course.course_name, course_id
                );
                continue;
            }
        };
        if default_bp.subjects.is_empty() {
            eprintln!(
                "[auto-exam-scheduler] auto-repair: course={} blueprint subjects empty; attempting legacy-topic-field migration",
                course.course_name
            );
            if let (Some(subj), Some(bank)) = (
                default_bp_doc.get_object_id("subject_id").ok(),
                default_bp_doc.get_object_id("bank_id").ok(),
            ) {
                let duration = default_bp_doc
                    .get_i32("duration_minutes")
                    .unwrap_or(default_bp.duration_minutes);
                let total_marks = default_bp_doc
                    .get_f64("total_marks")
                    .unwrap_or(default_bp.total_marks);
                let minimum_marks = default_bp_doc
                    .get_f64("passing_marks")
                    .or_else(|_| default_bp_doc.get_f64("minimum_marks"))
                    .unwrap_or(default_bp.minimum_marks);
                let rules_raw: Vec<crate::models::exam_engine::BlueprintRule> = default_bp_doc
                    .get_array("rules")
                    .ok()
                    .and_then(|arr| mongodb::bson::from_bson(mongodb::bson::Bson::Array(arr.clone())).ok())
                    .unwrap_or_default();
                let reappear_bank = default_bp_doc
                    .get_object_id("reappear_bank_id")
                    .ok();
                default_bp.subjects = vec![crate::models::exam_engine::SubjectBlueprintConfig {
                    subject_id: subj,
                    default_question_bank_id: bank,
                    reappear_question_bank_id: reappear_bank,
                    duration_minutes: duration,
                    final_subject_total_marks: total_marks,
                    practical_component: Default::default(),
                    assignment_component: Default::default(),
                    final_exam_component: crate::models::exam_engine::BlueprintComponentsPart {
                        enabled: true,
                        marks: total_marks,
                        min_marks: minimum_marks,
                    },
                    question_distribution: rules_raw,
                    advanced_settings: None,
                    instructions: default_bp.instructions.clone(),
                }];
            }
        }
        if default_bp.subjects.is_empty() {
            eprintln!(
                "[auto-exam-scheduler] auto-repair stage 2: course={} subjects still empty; deriving from course_subjects table",
                course.course_name
            );
            let cs_coll: mongodb::Collection<mongodb::bson::Document> =
                db.collection("course_subjects");
            if let (Some(course_id_oid), Ok(&bank_oid)) = (
                Some(default_bp.course_id),
                default_bp_doc.get_object_id("bank_id").as_ref(),
            ) {
                let mut cs_cursor = cs_coll
                    .find(
                        doc! { "course_id": course_id_oid },
                        mongodb::options::FindOptions::builder()
                            .sort(doc! { "subject_order": 1 })
                            .build(),
                    )
                    .await
                    .ok();
                let mut derived = Vec::<crate::models::exam_engine::SubjectBlueprintConfig>::new();
                if let Some(ref mut cur) = cs_cursor {
                    while let Ok(Some(cs)) = cur.try_next().await {
                        if let Ok(&subj_oid) = cs.get_object_id("subject_id").as_ref() {
                            let duration = default_bp_doc
                                .get_i32("duration_minutes")
                                .unwrap_or(default_bp.duration_minutes);
                            let total_marks = default_bp_doc
                                .get_f64("total_marks")
                                .unwrap_or(default_bp.total_marks);
                            let minimum_marks = default_bp_doc
                                .get_f64("passing_marks")
                                .or_else(|_| default_bp_doc.get_f64("minimum_marks"))
                                .unwrap_or(default_bp.minimum_marks);
                            let rules_raw: Vec<crate::models::exam_engine::BlueprintRule> =
                                default_bp_doc
                                    .get_array("rules")
                                    .ok()
                                    .and_then(|arr| {
                                        mongodb::bson::from_bson(mongodb::bson::Bson::Array(
                                            arr.clone(),
                                        ))
                                        .ok()
                                    })
                                    .unwrap_or_default();
                            let reap_bank = default_bp_doc
                                .get_object_id("reappear_bank_id")
                                .ok();
                            derived.push(
                                crate::models::exam_engine::SubjectBlueprintConfig {
                                    subject_id: subj_oid,
                                    default_question_bank_id: bank_oid,
                                    reappear_question_bank_id: reap_bank,
                                    duration_minutes: duration,
                                    final_subject_total_marks: total_marks,
                                    practical_component: Default::default(),
                                    assignment_component: Default::default(),
                                    final_exam_component: crate::models::exam_engine::BlueprintComponentsPart {
                                        enabled: true,
                                        marks: total_marks,
                                        min_marks: minimum_marks,
                                    },
                                    question_distribution: rules_raw,
                                    advanced_settings: None,
                                    instructions: default_bp.instructions.clone(),
                                },
                            );
                        }
                    }
                }
                if !derived.is_empty() {
                    default_bp.subjects = derived;
                    eprintln!(
                        "[auto-exam-scheduler] auto-repair stage 2: course={} derived {} subjects from course_subjects",
                        course.course_name,
                        default_bp.subjects.len()
                    );
                }
            }
        }
        if default_bp.subjects.is_empty() {
            eprintln!(
                "[auto-exam-scheduler] skip course={}: default blueprint has no subjects (after repair attempted)",
                course.course_name
            );
            continue;
        }

        process_course_cycle(
            db,
            course,
            &default_bp,
            cycle_year,
            cycle_month,
            allotment_day,
            exam_day,
            exam_hour,
            exam_minute,
            subject_gap,
            force,
        )
        .await;
    }

    eprintln!(
        "[auto-exam-scheduler] cycle complete: checked {} courses",
        courses_loaded.len()
    );
}
