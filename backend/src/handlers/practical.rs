use crate::models::practical::{
    CreatePracticalPayload, CreateSubmissionPayload, EvaluateSubmissionPayload, Practical,
    PracticalQuery, PracticalSubmission,
};
use crate::models::user::{Claims, UserRole};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use chrono::Utc;
use futures_util::StreamExt;
use mongodb::{
    Database,
    bson::{Document, doc, oid::ObjectId},
    options::FindOptions,
};
use serde_json::{Value, json};

fn extract_id_str(val: &Value) -> Option<String> {
    match val {
        Value::String(s) => Some(s.clone()),
        Value::Object(m) => {
            if let Some(Value::String(s)) = m.get("$oid") {
                Some(s.clone())
            } else if let Some(Value::String(s)) = m.get("_id") {
                Some(s.clone())
            } else {
                None
            }
        }
        _ => None,
    }
}

async fn resolve_center_oids(db: &Database, center_ref_oid: ObjectId) -> Vec<ObjectId> {
    let mut oids = vec![center_ref_oid];
    let centers_coll = db.collection::<Document>("centers");

    // Check if center_ref_oid is a center document _id
    if let Ok(Some(cdoc)) = centers_coll.find_one(doc! {"_id": center_ref_oid}, None).await {
        if let Ok(uid) = cdoc.get_object_id("user_id") {
            if !oids.contains(&uid) {
                oids.push(uid);
            }
        } else if let Ok(uid_str) = cdoc.get_str("user_id") {
            if let Ok(uid) = ObjectId::parse_str(uid_str) {
                if !oids.contains(&uid) {
                    oids.push(uid);
                }
            }
        }
    }

    // Check if center_ref_oid is a center user_id (stored as ObjectId or string)
    let user_id_filter = doc! {
        "$or": [
            { "user_id": center_ref_oid },
            { "user_id": center_ref_oid.to_hex() }
        ]
    };
    if let Ok(Some(cdoc)) = centers_coll.find_one(user_id_filter, None).await {
        if let Ok(doc_id) = cdoc.get_object_id("_id") {
            if !oids.contains(&doc_id) {
                oids.push(doc_id);
            }
        }
    }

    oids
}

/// GET /api/practicals — List practicals based on role & filter
pub async fn list_practicals(
    State(db): State<Database>,
    claims: Claims,
    Query(q): Query<PracticalQuery>,
) -> (StatusCode, Json<Value>) {
    eprintln!("[list_practicals] CALLED! sub='{}', username='{}', role={:?}", claims.sub, claims.username, claims.role);

    let coll = db.collection::<Practical>("practicals");
    let mut filter = doc! {};

    fn default_all_center_conds() -> Vec<Document> {
        vec![
            doc! { "center_id": null },
            doc! { "center_id": { "$exists": false } },
            doc! { "center_id": "all" },
            doc! { "center_id": "" },
        ]
    }

    match claims.role {
        UserRole::Center => {
            let mut or_conds = default_all_center_conds();
            if let Ok(user_oid) = ObjectId::parse_str(&claims.sub) {
                let center_oids = resolve_center_oids(&db, user_oid).await;
                for oid in center_oids {
                    or_conds.push(doc! { "center_id": oid });
                    or_conds.push(doc! { "center_id": oid.to_hex() });
                    or_conds.push(doc! { "created_by": oid });
                    or_conds.push(doc! { "created_by": oid.to_hex() });
                }
            }
            filter.insert("$or", or_conds);
        }
        UserRole::Staff => {
            let mut or_conds = default_all_center_conds();
            let users_coll = db.collection::<crate::models::user::User>("users");
            if let Ok(user_oid) = ObjectId::parse_str(&claims.sub) {
                or_conds.push(doc! { "created_by": user_oid });
                or_conds.push(doc! { "created_by": user_oid.to_hex() });
                let cid = if let Ok(Some(user)) = users_coll.find_one(doc! {"_id": user_oid}, None).await {
                    user.parent_id.unwrap_or(user_oid)
                } else {
                    user_oid
                };
                let center_oids = resolve_center_oids(&db, cid).await;
                for oid in center_oids {
                    or_conds.push(doc! { "center_id": oid });
                    or_conds.push(doc! { "center_id": oid.to_hex() });
                    or_conds.push(doc! { "created_by": oid });
                    or_conds.push(doc! { "created_by": oid.to_hex() });
                }
            }
            filter.insert("$or", or_conds);
        }
        UserRole::Student => {
            let mut or_conds = default_all_center_conds();
            let users_coll = db.collection::<crate::models::user::User>("users");
            if let Ok(user_oid) = ObjectId::parse_str(&claims.sub) {
                if let Ok(Some(user)) = users_coll.find_one(doc! {"_id": user_oid}, None).await {
                    if let Some(c) = user.parent_id {
                        let center_oids = resolve_center_oids(&db, c).await;
                        for oid in center_oids {
                            or_conds.push(doc! { "center_id": oid });
                            or_conds.push(doc! { "center_id": oid.to_hex() });
                            or_conds.push(doc! { "created_by": oid });
                            or_conds.push(doc! { "created_by": oid.to_hex() });
                        }
                    }
                }
            }
            filter.insert("$or", or_conds);
        }
        UserRole::Admin | UserRole::SuperAdmin => {
            // Admin sees all
        }
        _ => {
            // Guest or public: show general practical tasks
            filter.insert("$or", default_all_center_conds());
        }
    }

    if let Some(cid) = &q.course_id {
        if let Ok(oid) = ObjectId::parse_str(cid) {
            filter.insert("course_id", oid);
        }
    }

    if let Some(mode) = &q.practical_mode {
        if !mode.is_empty() && mode != "all" {
            filter.insert("practical_mode", mode.as_str());
        }
    }

    eprintln!("[list_practicals] FINAL FILTER: {:?}", filter);

    let opts = FindOptions::builder()
        .sort(doc! {"created_at": -1})
        .limit(q.limit.unwrap_or(100))
        .build();

    let mut practicals = Vec::new();
    if let Ok(mut cursor) = coll.find(filter, opts).await {
        while let Some(Ok(prac)) = cursor.next().await {
            let mut val = serde_json::to_value(&prac).unwrap_or_default();
            if let Some(obj) = val.as_object_mut() {
                let id_str = obj.get("_id")
                    .and_then(extract_id_str)
                    .or_else(|| obj.get("id").and_then(extract_id_str));
                
                if let Some(s) = id_str {
                    obj.insert("id".to_string(), Value::String(s.clone()));
                    obj.insert("_id".to_string(), Value::String(s));
                }
            }
            practicals.push(val);
        }
    }

    eprintln!("[list_practicals] RETURNING {} practicals", practicals.len());

    (StatusCode::OK, Json(json!({"success": true, "practicals": practicals})))
}

/// POST /api/practicals — Create a new practical assignment
pub async fn create_practical(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreatePracticalPayload>,
) -> (StatusCode, Json<Value>) {
    if claims.role != UserRole::Center && claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin && claims.role != UserRole::Staff {
        return (StatusCode::FORBIDDEN, Json(json!({"success": false, "message": "Unauthorized"})));
    }

    let creator_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => ObjectId::new(),
    };

    let mut center_id = match payload.center_id.as_deref() {
        Some(cid_str) if !cid_str.is_empty() && cid_str != "all" => {
            if let Ok(oid) = ObjectId::parse_str(cid_str) {
                let centers_coll = db.collection::<Document>("centers");
                if let Ok(Some(cdoc)) = centers_coll.find_one(doc! {"_id": oid}, None).await {
                    if let Ok(uid_str) = cdoc.get_str("user_id") {
                        ObjectId::parse_str(uid_str).ok().or(Some(oid))
                    } else {
                        Some(oid)
                    }
                } else {
                    Some(oid)
                }
            } else {
                None
            }
        }
        _ => None,
    };

    if center_id.is_none() {
        if claims.role == UserRole::Center {
            center_id = Some(creator_oid);
        } else if claims.role == UserRole::Staff {
            let users_coll = db.collection::<crate::models::user::User>("users");
            if let Ok(Some(u)) = users_coll.find_one(doc! {"_id": creator_oid}, None).await {
                center_id = u.parent_id;
            }
        }
    }

    let mut center_name = None;
    if let Some(cid) = center_id {
        let centers_coll = db.collection::<Document>("centers");
        if let Ok(Some(cdoc)) = centers_coll.find_one(doc! {"$or": [{"user_id": cid.to_hex()}, {"_id": cid}]}, None).await {
            center_name = cdoc.get_str("name").ok().or_else(|| cdoc.get_str("center_name").ok()).map(|s| s.to_string());
        }
    }

    let course_id = payload.course_id.as_deref().and_then(|s| ObjectId::parse_str(s).ok());

    let scheduled_at = match payload.scheduled_at.as_deref() {
        Some(s) if !s.is_empty() => chrono::DateTime::parse_from_rfc3339(s).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        _ => Utc::now(),
    };

    let due_date = match payload.due_date.as_deref() {
        Some(s) if !s.is_empty() => chrono::DateTime::parse_from_rfc3339(s).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now() + chrono::Duration::days(7)),
        _ => Utc::now() + chrono::Duration::days(7),
    };

    let exp_marks = payload.exp_marks.unwrap_or(20);
    let journal_marks = payload.journal_marks.unwrap_or(10);
    let viva_marks = payload.viva_marks.unwrap_or(20);
    let total_marks = payload.total_marks.unwrap_or(exp_marks + journal_marks + viva_marks);

    let prac = Practical {
        id: None,
        title: payload.title,
        experiment_code: payload.experiment_code,
        course_id,
        course_name: payload.course_name,
        subject_name: payload.subject_name,
        center_id,
        center_name,
        batch_id: payload.batch_id,
        batch_name: payload.batch_name,
        instructor_id: None,
        instructor_name: payload.instructor_name,
        created_by: creator_oid,
        practical_mode: payload.practical_mode.unwrap_or_else(|| "physical_lab".to_string()),
        delivery_mode: payload.delivery_mode.or(Some("offline_center".to_string())),
        total_marks,
        passing_marks: payload.passing_marks.or(Some((total_marks as f32 * 0.4) as i32)),
        exp_marks,
        journal_marks,
        viva_marks,
        scheduled_at,
        due_date,
        pdf_manual_url: payload.pdf_manual_url,
        video_demo_url: payload.video_demo_url,
        starter_code_url: payload.starter_code_url,
        description: payload.description,
        viva_questions: payload.viva_questions,
        allow_in_person_signoff: payload.allow_in_person_signoff.or(Some(true)),
        allow_photo_proof: payload.allow_photo_proof.or(Some(true)),
        allowed_file_types: payload.allowed_file_types,
        status: "published".to_string(),
        created_at: Utc::now(),
    };

    let coll = db.collection::<Practical>("practicals");
    match coll.insert_one(prac, None).await {
        Ok(res) => {
            let id_str = res.inserted_id.as_object_id().map(|o| o.to_hex());
            (StatusCode::CREATED, Json(json!({"success": true, "message": "Practical task published successfully", "id": id_str})))
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "message": format!("Failed to publish: {}", e)}))),
    }
}

/// GET /api/practicals/submissions — List student submissions for evaluation
pub async fn list_submissions(
    State(db): State<Database>,
    claims: Claims,
    Query(q): Query<std::collections::HashMap<String, String>>,
) -> (StatusCode, Json<Value>) {
    let coll = db.collection::<PracticalSubmission>("practical_submissions");
    let mut filter = doc! {};

    match claims.role {
        UserRole::Student => {
            if let Ok(oid) = ObjectId::parse_str(&claims.sub) {
                filter.insert("student_id", oid);
            }
        }
        UserRole::Center | UserRole::Staff => {
            if let Ok(user_oid) = ObjectId::parse_str(&claims.sub) {
                let users_coll = db.collection::<crate::models::user::User>("users");
                if let Ok(Some(user)) = users_coll.find_one(doc! {"_id": user_oid}, None).await {
                    let cid = user.parent_id.unwrap_or(user_oid);
                    filter.insert("center_id", cid);
                } else {
                    filter.insert("center_id", user_oid);
                }
            }
        }
        UserRole::Admin | UserRole::SuperAdmin => {}
        _ => return (StatusCode::FORBIDDEN, Json(json!({"success": false, "message": "Unauthorized"}))),
    }

    if let Some(pid) = q.get("practical_id") {
        if let Ok(oid) = ObjectId::parse_str(pid) {
            filter.insert("practical_id", oid);
        }
    }

    if let Some(st) = q.get("status") {
        if !st.is_empty() && st != "all" {
            filter.insert("status", st.as_str());
        }
    }

    let opts = FindOptions::builder()
        .sort(doc! {"submitted_at": -1})
        .limit(100)
        .build();

    let mut submissions = Vec::new();
    if let Ok(mut cursor) = coll.find(filter, opts).await {
        while let Some(Ok(sub)) = cursor.next().await {
            let mut val = serde_json::to_value(&sub).unwrap_or_default();
            if let Some(obj) = val.as_object_mut() {
                let id_str = obj.get("_id")
                    .and_then(extract_id_str)
                    .or_else(|| obj.get("id").and_then(extract_id_str));
                
                if let Some(s) = id_str {
                    obj.insert("id".to_string(), Value::String(s.clone()));
                    obj.insert("_id".to_string(), Value::String(s));
                }
            }
            submissions.push(val);
        }
    }

    (StatusCode::OK, Json(json!({"success": true, "submissions": submissions})))
}

/// POST /api/practicals/:id/submit — Student submits practical report/file/signoff
pub async fn submit_practical(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<CreateSubmissionPayload>,
) -> (StatusCode, Json<Value>) {
    if claims.role != UserRole::Student {
        return (StatusCode::FORBIDDEN, Json(json!({"success": false, "message": "Only students can submit practical tasks"})));
    }

    let prac_oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(json!({"success": false, "message": "Invalid practical ID"}))),
    };

    let student_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(json!({"success": false, "message": "Invalid student ID"}))),
    };

    let users_coll = db.collection::<crate::models::user::User>("users");
    let student_user = match users_coll.find_one(doc! {"_id": student_oid}, None).await {
        Ok(Some(u)) => u,
        _ => return (StatusCode::NOT_FOUND, Json(json!({"success": false, "message": "Student profile not found"}))),
    };

    let center_id = student_user.parent_id.unwrap_or(student_oid);

    let prac_coll = db.collection::<Practical>("practicals");
    let prac = match prac_coll.find_one(doc! {"_id": prac_oid}, None).await {
        Ok(Some(p)) => p,
        _ => return (StatusCode::NOT_FOUND, Json(json!({"success": false, "message": "Practical task not found"}))),
    };

    let sub_coll = db.collection::<PracticalSubmission>("practical_submissions");

    // Upsert submission
    let sub = PracticalSubmission {
        id: None,
        practical_id: prac_oid,
        practical_title: Some(prac.title),
        experiment_code: Some(prac.experiment_code),
        student_id: student_oid,
        student_name: student_user.full_name.clone().or(student_user.first_name.clone()).or(Some(student_user.username.clone())),
        roll_no: None,
        center_id,
        center_name: None,
        submission_type: payload.submission_type.unwrap_or_else(|| "file_upload".to_string()),
        file_urls: payload.file_urls.unwrap_or_default(),
        student_notes: payload.student_notes,
        submitted_at: Utc::now(),
        evaluated_by: None,
        evaluator_name: None,
        exp_marks_obtained: None,
        journal_marks_obtained: None,
        viva_marks_obtained: None,
        total_marks_obtained: None,
        instructor_review_remarks: None,
        status: "submitted".to_string(),
        evaluated_at: None,
    };

    // Replace if exists, else insert
    let filter = doc! {"practical_id": prac_oid, "student_id": student_oid};
    let opts = mongodb::options::ReplaceOptions::builder().upsert(true).build();

    match sub_coll.replace_one(filter, sub, opts).await {
        Ok(_) => (StatusCode::OK, Json(json!({"success": true, "message": "Practical submitted successfully for instructor review!"}))),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "message": format!("Submission failed: {}", e)}))),
    }
}

/// PUT /api/practicals/submissions/:id/evaluate — Instructor evaluates submission with 360° rubric & remarks
pub async fn evaluate_submission(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<EvaluateSubmissionPayload>,
) -> (StatusCode, Json<Value>) {
    if claims.role != UserRole::Center && claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin && claims.role != UserRole::Staff {
        return (StatusCode::FORBIDDEN, Json(json!({"success": false, "message": "Unauthorized"})));
    }

    let sub_oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(json!({"success": false, "message": "Invalid submission ID"}))),
    };

    let evaluator_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(json!({"success": false, "message": "Invalid evaluator ID"}))),
    };

    let total_obtained = payload.exp_marks_obtained + payload.journal_marks_obtained + payload.viva_marks_obtained;

    let update_doc = doc! {
        "$set": {
            "evaluated_by": evaluator_oid,
            "evaluator_name": claims.username,
            "exp_marks_obtained": payload.exp_marks_obtained,
            "journal_marks_obtained": payload.journal_marks_obtained,
            "viva_marks_obtained": payload.viva_marks_obtained,
            "total_marks_obtained": total_obtained,
            "instructor_review_remarks": payload.instructor_review_remarks,
            "status": payload.status,
            "evaluated_at": mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis()),
        }
    };

    let coll = db.collection::<Document>("practical_submissions");
    match coll.update_one(doc! {"_id": sub_oid}, update_doc, None).await {
        Ok(_) => (StatusCode::OK, Json(json!({"success": true, "message": "360° Practical evaluation & review saved successfully!"}))),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "message": format!("Evaluation failed: {}", e)}))),
    }
}

/// DELETE /api/practicals/:id — Delete single practical assignment or purge all
pub async fn delete_practical(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<Value>) {
    eprintln!("[delete_practical] CALLED with id='{}', role={:?}", id, claims.role);

    let prac_coll = db.collection::<Document>("practicals");
    let sub_coll = db.collection::<Document>("practical_submissions");

    if id == "purge" || id == "all" || id == "undefined" {
        let _ = prac_coll.delete_many(doc! {}, None).await;
        let _ = sub_coll.delete_many(doc! {}, None).await;
        return (StatusCode::OK, Json(json!({"success": true, "message": "All practical tasks deleted successfully"})));
    }

    if let Ok(prac_oid) = ObjectId::parse_str(&id) {
        let _ = sub_coll.delete_many(doc! {"practical_id": prac_oid}, None).await;
        let res = prac_coll.delete_one(doc! {"_id": prac_oid}, None).await;
        if let Ok(r) = res {
            if r.deleted_count > 0 {
                return (StatusCode::OK, Json(json!({"success": true, "message": "Practical task deleted successfully"})));
            }
        }
    }

    // Fallback delete by string _id or id
    let _ = sub_coll.delete_many(doc! {"practical_id": &id}, None).await;
    let _ = prac_coll.delete_one(doc! {"_id": &id}, None).await;
    let _ = prac_coll.delete_one(doc! {"id": &id}, None).await;

    (StatusCode::OK, Json(json!({"success": true, "message": "Practical task deleted successfully"})))
}

/// POST or DELETE /api/practicals/purge — Purge all practical tasks and submissions
pub async fn purge_all_practicals(
    State(db): State<Database>,
) -> (StatusCode, Json<Value>) {
    eprintln!("[purge_all_practicals] CALLED!");

    let prac_coll = db.collection::<Document>("practicals");
    let sub_coll = db.collection::<Document>("practical_submissions");

    let _ = prac_coll.delete_many(doc! {}, None).await;
    let _ = sub_coll.delete_many(doc! {}, None).await;

    (StatusCode::OK, Json(json!({"success": true, "message": "All practical tasks and submissions purged successfully"})))
}
