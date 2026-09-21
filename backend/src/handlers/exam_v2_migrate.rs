//! One-shot migration from legacy Exam V2 (blueprints + course-scoped questions) to
//! QuestionBank → PaperTemplate → Exam → Attempt.
//!
//! Idempotent: safe to run multiple times.

use futures_util::StreamExt;
use mongodb::bson::{doc, oid::ObjectId, DateTime as BsonDateTime, Document};
use mongodb::Database;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct MigrateReport {
    pub question_banks_created: u64,
    pub questions_updated: u64,
    pub paper_templates_created: u64,
    pub exams_updated: u64,
    pub attempts_updated: u64,
    pub message: String,
}

/// Run migration. Admin-only via HTTP handler.
pub async fn run_migration(db: &Database) -> Result<MigrateReport, String> {
    let mut report = MigrateReport {
        question_banks_created: 0,
        questions_updated: 0,
        paper_templates_created: 0,
        exams_updated: 0,
        attempts_updated: 0,
        message: "OK".into(),
    };

    let q_coll = db.collection::<Document>("exam_v2_questions");
    let bank_coll = db.collection::<Document>("exam_v2_question_banks");
    let tpl_coll = db.collection::<Document>("exam_v2_paper_templates");
    let bp_coll = db.collection::<Document>("exam_v2_blueprints");
    let exam_coll = db.collection::<Document>("exam_v2_exams");
    let paper_coll = db.collection::<Document>("exam_v2_papers");

    let mut course_to_bank: std::collections::HashMap<ObjectId, ObjectId> = std::collections::HashMap::new();

    // --- 1) Distinct course_id → question banks ---
    let mut cur = q_coll.find(None, None).await.map_err(|e| e.to_string())?;
    let mut distinct_courses = std::collections::HashSet::new();
    while let Some(Ok(d)) = cur.next().await {
        if let Ok(cid) = d.get_object_id("course_id") {
            distinct_courses.insert(cid);
        }
    }

    for cid in distinct_courses {
        let existing = q_coll
            .find_one(
                doc! { "course_id": cid, "question_bank_id": { "$exists": true, "$ne": null } },
                None,
            )
            .await
            .map_err(|e| e.to_string())?;
        if let Some(doc) = existing {
            if let Ok(bid) = doc.get_object_id("question_bank_id") {
                course_to_bank.insert(cid, bid);
                continue;
            }
        }

        let bank_id = ObjectId::new();
        let now = BsonDateTime::now();
        let name = format!("Migrated bank (course {})", cid.to_hex());
        bank_coll
            .insert_one(
                doc! {
                    "_id": bank_id,
                    "name": name,
                    "created_by": cid,
                    "created_at": now,
                },
                None,
            )
            .await
            .map_err(|e| e.to_string())?;
        course_to_bank.insert(cid, bank_id);
        report.question_banks_created += 1;
    }

    // Patch questions
    let mut cur2 = q_coll.find(None, None).await.map_err(|e| e.to_string())?;
    while let Some(Ok(d)) = cur2.next().await {
        let id = match d.get_object_id("_id") {
            Ok(id) => id,
            Err(_) => continue,
        };
        if d.get("question_bank_id").and_then(|v| v.as_object_id()).is_some() {
            continue;
        }
        let cid = match d.get_object_id("course_id") {
            Ok(c) => c,
            Err(_) => continue,
        };
        let bid = match course_to_bank.get(&cid) {
            Some(b) => *b,
            None => continue,
        };
        q_coll
            .update_one(
                doc! { "_id": id },
                doc! { "$set": { "question_bank_id": bid } },
                None,
            )
            .await
            .map_err(|e| e.to_string())?;
        report.questions_updated += 1;
    }

    // --- 2) Blueprints → paper templates ---
    let mut bp_to_tpl: std::collections::HashMap<ObjectId, ObjectId> = std::collections::HashMap::new();
    let mut bcur = bp_coll.find(None, None).await.map_err(|e| e.to_string())?;
    while let Some(Ok(bp)) = bcur.next().await {
        let bpid = match bp.get_object_id("_id") {
            Ok(id) => id,
            Err(_) => continue,
        };

        if tpl_coll
            .find_one(doc! { "legacy_blueprint_id": bpid }, None)
            .await
            .map_err(|e| e.to_string())?
            .is_some()
        {
            let ex = tpl_coll
                .find_one(doc! { "legacy_blueprint_id": bpid }, None)
                .await
                .map_err(|e| e.to_string())?
                .unwrap();
            if let Ok(tid) = ex.get_object_id("_id") {
                bp_to_tpl.insert(bpid, tid);
            }
            continue;
        }

        let course_id = match bp.get_object_id("course_id") {
            Ok(c) => c,
            Err(_) => continue,
        };
        let bank_id = match course_to_bank.get(&course_id) {
            Some(b) => *b,
            None => continue,
        };

        let name = bp.get_str("name").unwrap_or("Migrated paper").to_string();
        let duration = bp.get_i32("duration_minutes").unwrap_or(60);
        let max_att = bp.get_i32("max_attempts").unwrap_or(1);

        let mut sections_out: Vec<Document> = Vec::new();
        let mut subject_first: Option<ObjectId> = None;
        let mut total: f64 = 0.0;

        if let Ok(arr) = bp.get_array("sections") {
            for sec in arr.iter().filter_map(|v| v.as_document()) {
                if let Ok(rules) = sec.get_array("rules") {
                    for rule in rules.iter().filter_map(|v| v.as_document()) {
                        let subj = match rule.get_object_id("subject_id") {
                            Ok(s) => s,
                            Err(_) => continue,
                        };
                        if subject_first.is_none() {
                            subject_first = Some(subj);
                        }
                        let marks = rule.get_f64("marks_per_question").unwrap_or(1.0);
                        let count = rule.get_i32("total_questions_to_pick").unwrap_or(1) as u32;
                        total += marks * count as f64;
                        let neg = rule.get("negative_marks").and_then(|v| v.as_f64());
                        let mut d = doc! { "marks": marks, "count": count };
                        if let Some(n) = neg {
                            d.insert("negative_marks", n);
                        }
                        sections_out.push(d);
                    }
                }
            }
        }

        let subject_id = match subject_first {
            Some(s) => s,
            None => continue,
        };

        let tid = ObjectId::new();
        let now = BsonDateTime::now();
        let created_by = bp.get_object_id("created_by").unwrap_or(course_id);
        let sections_arr: mongodb::bson::Array = sections_out
            .into_iter()
            .map(mongodb::bson::Bson::Document)
            .collect();

        let mut ins = doc! {
            "_id": tid,
            "name": name,
            "question_bank_id": bank_id,
            "subject_id": subject_id,
            "total_marks": total,
            "duration_minutes": duration,
            "max_attempts": max_att,
            "sections": sections_arr,
            "created_at": now,
            "legacy_blueprint_id": bpid,
            "created_by": created_by,
        };
        match bp.get("instructions") {
            Some(inst) => {
                ins.insert("instructions", inst.clone());
            }
            None => {
                ins.insert("instructions", mongodb::bson::Bson::Null);
            }
        }

        tpl_coll.insert_one(ins, None).await.map_err(|e| e.to_string())?;
        bp_to_tpl.insert(bpid, tid);
        report.paper_templates_created += 1;
    }

    // --- 3) Exams ---
    let mut ecur = exam_coll.find(None, None).await.map_err(|e| e.to_string())?;
    while let Some(Ok(d)) = ecur.next().await {
        let id = match d.get_object_id("_id") {
            Ok(id) => id,
            Err(_) => continue,
        };
        if d.get("paper_id").and_then(|v| v.as_object_id()).is_some() {
            continue;
        }
        let bid = match d.get_object_id("blueprint_id") {
            Ok(b) => b,
            Err(_) => continue,
        };
        let pid = match bp_to_tpl.get(&bid) {
            Some(p) => *p,
            None => continue,
        };
        exam_coll
            .update_one(
                doc! { "_id": id },
                doc! { "$set": { "paper_id": pid }, "$unset": { "blueprint_id": "" } },
                None,
            )
            .await
            .map_err(|e| e.to_string())?;
        report.exams_updated += 1;
    }

    // --- 4) Attempts ---
    let mut pcur = paper_coll.find(None, None).await.map_err(|e| e.to_string())?;
    while let Some(Ok(d)) = pcur.next().await {
        let id = match d.get_object_id("_id") {
            Ok(id) => id,
            Err(_) => continue,
        };
        if d.get("paper_template_id").and_then(|v| v.as_object_id()).is_some() {
            continue;
        }
        let bid = match d.get_object_id("blueprint_id") {
            Ok(b) => b,
            Err(_) => continue,
        };
        let tid = match bp_to_tpl.get(&bid) {
            Some(p) => *p,
            None => continue,
        };
        paper_coll
            .update_one(
                doc! { "_id": id },
                doc! { "$set": { "paper_template_id": tid }, "$unset": { "blueprint_id": "" } },
                None,
            )
            .await
            .map_err(|e| e.to_string())?;
        report.attempts_updated += 1;
    }

    Ok(report)
}
