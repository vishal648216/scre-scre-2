//! After a student is registered (center enrollment), optionally queue creation of an `id_cards`
//! document using the single configured ID-card template, after a delay (minutes).

use chrono::{Duration, Utc};
use futures_util::TryStreamExt;
use mongodb::bson::doc;
use mongodb::bson::oid::ObjectId;
use mongodb::options::FindOneOptions;
use mongodb::Database;
use std::env;

use crate::models::center::Center;
use crate::models::course::Course;
use crate::models::id_card::IdCard;
use crate::models::id_card_auto_job::IdCardAutoJob;
use crate::models::system_settings::SystemSettings;
use crate::models::template::{Template, TemplateType};
use crate::models::user::User;

async fn load_settings(db: &Database) -> SystemSettings {
    db.collection::<SystemSettings>("system_settings")
        .find_one(None, None)
        .await
        .ok()
        .flatten()
        .unwrap_or_default()
}

/// Enqueue a delayed job when a new student row exists and belongs to a center (`parent_id`).
pub async fn enqueue_auto_id_card_job(db: &Database, student_id: ObjectId) {
    let settings = load_settings(db).await;
    if !settings.auto_id_card_enabled {
        return;
    }

    let users = db.collection::<User>("users");
    let Ok(Some(user)) = users
        .find_one(doc! { "_id": student_id, "role": "student" }, None)
        .await
    else {
        return;
    };
    if user.parent_id.is_none() || user.is_deleted {
        return;
    }

    let jobs = db.collection::<IdCardAutoJob>("id_card_auto_jobs");
    if jobs
        .find_one(
            doc! { "student_id": student_id, "status": "pending" },
            None,
        )
        .await
        .ok()
        .flatten()
        .is_some()
    {
        return;
    }

    let delay = settings.auto_id_card_delay_minutes.max(1) as i64;
    let run_at = Utc::now() + Duration::minutes(delay);
    let job = IdCardAutoJob {
        id: None,
        student_id,
        run_at,
        status: "pending".to_string(),
        error: None,
        created_at: Utc::now(),
    };
    let _ = jobs.insert_one(job, None).await;
}

async fn resolve_template_oid(db: &Database, settings: &SystemSettings) -> Result<ObjectId, String> {
    if let Some(ref s) = settings.auto_id_card_template_id {
        let t = s.trim();
        if !t.is_empty() {
            if let Ok(oid) = ObjectId::parse_str(t) {
                return verify_id_card_template(db, oid).await;
            }
        }
    }
    if let Ok(s) = env::var("AUTO_ID_CARD_TEMPLATE_ID") {
        let t = s.trim();
        if let Ok(oid) = ObjectId::parse_str(t) {
            return verify_id_card_template(db, oid).await;
        }
    }

    let coll = db.collection::<Template>("templates");
    let opts = FindOneOptions::builder()
        .sort(doc! { "_id": 1 })
        .build();
    let t = coll
        .find_one(doc! { "template_type": "id_card" }, opts)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| {
            "No ID card template: create one under Attachments → templates (ID card), or set the template ID in System Settings.".to_string()
        })?;
    t.id.ok_or_else(|| "Template document missing _id".to_string())
}

async fn verify_id_card_template(db: &Database, oid: ObjectId) -> Result<ObjectId, String> {
    let coll = db.collection::<Template>("templates");
    let t = coll
        .find_one(doc! { "_id": oid }, None)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Configured ID card template was not found".to_string())?;
    if t.template_type != TemplateType::IdCard {
        return Err("Configured template is not an ID card template".to_string());
    }
    Ok(oid)
}

async fn resolve_course_display(db: &Database, course: Option<&str>) -> String {
    let Some(raw) = course.map(str::trim).filter(|s| !s.is_empty()) else {
        return String::new();
    };
    if let Ok(oid) = ObjectId::parse_str(raw) {
        let courses = db.collection::<Course>("courses");
        if let Ok(Some(c)) = courses.find_one(doc! { "_id": oid }, None).await {
            return c.course_name;
        }
    }
    raw.to_string()
}

/// Inserts into `id_cards` from `users` (same center logic as manual apply). Skips if a row already exists.
pub async fn create_auto_id_card_for_student(db: &Database, student_id: ObjectId) -> Result<(), String> {
    let settings = load_settings(db).await;
    if !settings.auto_id_card_enabled {
        return Err("Auto ID card is disabled".to_string());
    }
    let template_oid = resolve_template_oid(db, &settings).await?;

    let cards = db.collection::<IdCard>("id_cards");
    if cards
        .find_one(doc! { "student_id": student_id }, None)
        .await
        .ok()
        .flatten()
        .is_some()
    {
        return Ok(());
    }

    let users = db.collection::<User>("users");
    let user = users
        .find_one(doc! { "_id": student_id, "role": "student" }, None)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Student not found".to_string())?;

    let parent_id = user
        .parent_id
        .ok_or_else(|| "Student has no center".to_string())?;

    let centers_coll = db.collection::<Center>("centers");
    let center_id = if let Ok(Some(center)) = centers_coll
        .find_one(doc! { "user_id": parent_id }, None)
        .await
    {
        center.id.unwrap_or(parent_id)
    } else {
        parent_id
    };

    let course_name = resolve_course_display(db, user.course.as_deref()).await;

    let id_card = IdCard {
        id: None,
        student_id,
        center_id,
        enrollment_number: user
            .enrollment_number
            .clone()
            .unwrap_or_else(|| user.username.clone()),
        student_name: user
            .full_name
            .clone()
            .unwrap_or_else(|| user.username.clone()),
        father_name: user.father_name.clone(),
        course_name,
        photo_url: user.photo_url.clone(),
        validity_date: None,
        issued_on: Utc::now(),
        status: "approved".to_string(),
        pdf_url: None,
        template_id: Some(template_oid),
    };
    cards
        .insert_one(id_card, None)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Run from background loop: process jobs whose `run_at` has passed.
pub async fn process_due_id_card_auto_jobs(db: &Database) {
    let now = Utc::now();
    let jobs_coll = db.collection::<IdCardAutoJob>("id_card_auto_jobs");
    let filter = doc! {
        "status": "pending",
        "run_at": { "$lte": mongodb::bson::DateTime::from_chrono(now) },
    };
    let Ok(cursor) = jobs_coll.find(filter, None).await else {
        return;
    };
    let jobs: Vec<IdCardAutoJob> = cursor.try_collect().await.unwrap_or_default();

    for job in jobs {
        let Some(job_id) = job.id else { continue };
        let upd = jobs_coll
            .update_one(
                doc! { "_id": job_id, "status": "pending" },
                doc! { "$set": { "status": "processing" } },
                None,
            )
            .await;
        if upd.is_err() || upd.map(|r| r.modified_count).unwrap_or(0) == 0 {
            continue;
        }

        match create_auto_id_card_for_student(db, job.student_id).await {
            Ok(()) => {
                let _ = jobs_coll.delete_one(doc! { "_id": job_id }, None).await;
            }
            Err(e) => {
                let _ = jobs_coll
                    .update_one(
                        doc! { "_id": job_id },
                        doc! { "$set": { "status": "failed", "error": e } },
                        None,
                    )
                    .await;
            }
        }
    }
}
