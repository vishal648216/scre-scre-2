use crate::models::center::Center;
use crate::models::exam_engine::{
    BlueprintComponentsPart, BlueprintComponentsPartPayload, BlueprintSnapshot, ExamBlueprint,
    ExamBlueprintPayload, PaperQuestionMapping, StudentPaper, SubjectBlueprintConfig,
    SubjectBlueprintConfigPayload,
};
use crate::models::exam_workflow::CourseExamAttempt;
use crate::models::qb::Question as QBQuestion;
use crate::models::user::{Claims, User, UserRole};
use crate::services::exam_eligibility;
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use chrono::Utc;
use futures_util::stream::StreamExt;
use mongodb::{
    Database,
    bson::{doc, oid::ObjectId, Document},
};
use rand::seq::SliceRandom;
use rand::thread_rng;
use serde::{Deserialize, Serialize};

// #region debug-point D:report-helper
async fn report_student_exam_debug(
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

#[derive(Debug, Serialize)]
pub struct ExamEngineResponse {
    pub success: bool,
    pub message: String,
}

// --- Blueprint Management ---

pub async fn create_blueprint(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<ExamBlueprintPayload>,
) -> (StatusCode, Json<ExamEngineResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(ExamEngineResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    // Convert payload IDs
    let category_id = payload
        .category_id
        .as_ref()
        .and_then(|id| ObjectId::parse_str(id).ok());
    let course_id = match ObjectId::parse_str(&payload.course_id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid Course ID".to_string(),
                }),
            );
        }
    };
    let session_id = payload
        .session_id
        .as_ref()
        .and_then(|id| ObjectId::parse_str(id).ok());
    let bank_id = payload
        .bank_id
        .as_ref()
        .and_then(|id| ObjectId::parse_str(id).ok());
    let reappear_bank_id = payload
        .reappear_bank_id
        .as_ref()
        .and_then(|id| ObjectId::parse_str(id).ok());
    let subject_id = payload
        .subject_id
        .as_ref()
        .and_then(|id| ObjectId::parse_str(id).ok());

    // Convert subjects (if any)
    let mut subjects = Vec::new();
    for subj_payload in payload.subjects {
        let subj_id = match ObjectId::parse_str(&subj_payload.subject_id) {
            Ok(oid) => oid,
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(ExamEngineResponse {
                        success: false,
                        message: "Invalid Subject ID".to_string(),
                    }),
                );
            }
        };
        let default_question_bank_id =
            ObjectId::parse_str(&subj_payload.default_question_bank_id)
                .unwrap_or_else(|_| ObjectId::parse_str("000000000000000000000000").unwrap());
        let reappear_question_bank_id = subj_payload
            .reappear_question_bank_id
            .as_ref()
            .and_then(|id| ObjectId::parse_str(id).ok());

        // Validate question distribution
        let calculated_exam_total: f64 = subj_payload
            .question_distribution
            .iter()
            .map(|r| r.marks * r.count as f64)
            .sum();
        if (calculated_exam_total - subj_payload.final_exam_component.marks).abs() > 0.01 {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: format!(
                        "Total distribution marks ({:.2}) does not match Final Exam marks ({:.2})",
                        calculated_exam_total, subj_payload.final_exam_component.marks
                    ),
                }),
            );
        }

        // Validate components sum to total marks (only count enabled components)
        let total_components = (if subj_payload.practical_component.enabled {
            subj_payload.practical_component.marks
        } else {
            0.0
        }) + (if subj_payload.assignment_component.enabled {
            subj_payload.assignment_component.marks
        } else {
            0.0
        }) + subj_payload.final_exam_component.marks;
        if (total_components - subj_payload.final_subject_total_marks).abs() > 0.01 {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: format!(
                        "Components total ({:.2}) does not match Subject Total Marks ({:.2})",
                        total_components, subj_payload.final_subject_total_marks
                    ),
                }),
            );
        }

        subjects.push(SubjectBlueprintConfig {
            subject_id: subj_id,
            default_question_bank_id,
            reappear_question_bank_id,
            final_subject_total_marks: subj_payload.final_subject_total_marks,
            practical_component: BlueprintComponentsPart {
                enabled: subj_payload.practical_component.enabled,
                marks: subj_payload.practical_component.marks,
                min_marks: subj_payload.practical_component.min_marks,
            },
            assignment_component: BlueprintComponentsPart {
                enabled: subj_payload.assignment_component.enabled,
                marks: subj_payload.assignment_component.marks,
                min_marks: subj_payload.assignment_component.min_marks,
            },
            final_exam_component: BlueprintComponentsPart {
                enabled: true, // Final exam is always enabled
                marks: subj_payload.final_exam_component.marks,
                min_marks: subj_payload.final_exam_component.min_marks,
            },
            question_distribution: subj_payload.question_distribution,
            advanced_settings: subj_payload.advanced_settings,
            instructions: subj_payload.instructions,
            duration_minutes: subj_payload.duration_minutes,
        });
    }

    let total_duration = subjects.iter().map(|s| s.duration_minutes).sum();

    let coll = db.collection::<ExamBlueprint>("exam_blueprints");

    // If this is the default blueprint, set all others for the same course to false
    if payload.default_blueprint {
        let _ = coll
            .update_many(
                doc! { "course_id": course_id },
                doc! { "$set": { "default_blueprint": false } },
                None,
            )
            .await;
    }

    let blueprint = ExamBlueprint {
        id: None,
        name: payload.name,
        category_id,
        course_id,
        session_id,
        bank_id,
        reappear_bank_id,
        subject_id,
        total_marks: payload.total_marks,
        minimum_marks: payload.minimum_marks,
        duration_minutes: payload.duration_minutes,
        total_duration_minutes: total_duration,
        max_attempts: payload.max_attempts,
        instructions: payload.instructions,
        mode: payload.mode,
        exam_mode: payload.exam_mode,
        practical_enabled: payload.practical_enabled,
        assignment_enabled: payload.assignment_enabled,
        components: payload.components,
        allow_bank_override: payload.allow_bank_override,
        rules: payload.rules,
        sections: payload.sections,
        require_attendance: payload.require_attendance,
        subjects,
        created_by: match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => Some(oid),
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(ExamEngineResponse {
                        success: false,
                        message: "Invalid user ID".to_string(),
                    }),
                );
            }
        },
        created_at: Some(mongodb::bson::DateTime::now()),
        default_blueprint: payload.default_blueprint,
        exam_pattern: payload.exam_pattern,
        term_number: payload.term_number,
    };

    match coll.insert_one(blueprint, None).await {
        Ok(_) => (
            StatusCode::CREATED,
            Json(ExamEngineResponse {
                success: true,
                message: "Blueprint created".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ExamEngineResponse {
                success: false,
                message: "Create failed".to_string(),
            }),
        ),
    }
}

pub async fn update_blueprint(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<ExamBlueprintPayload>,
) -> (StatusCode, Json<ExamEngineResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(ExamEngineResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let b_oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    // Convert payload IDs
    let category_id = payload
        .category_id
        .as_ref()
        .and_then(|id| ObjectId::parse_str(id).ok());
    let course_id = match ObjectId::parse_str(&payload.course_id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid Course ID".to_string(),
                }),
            );
        }
    };
    let session_id = payload
        .session_id
        .as_ref()
        .and_then(|id| ObjectId::parse_str(id).ok());
    let bank_id = payload
        .bank_id
        .as_ref()
        .and_then(|id| ObjectId::parse_str(id).ok());
    let reappear_bank_id = payload
        .reappear_bank_id
        .as_ref()
        .and_then(|id| ObjectId::parse_str(id).ok());
    let subject_id = payload
        .subject_id
        .as_ref()
        .and_then(|id| ObjectId::parse_str(id).ok());

    // Convert subjects (if any)
    let mut subjects = Vec::new();
    for subj_payload in payload.subjects {
        let subj_id = match ObjectId::parse_str(&subj_payload.subject_id) {
            Ok(oid) => oid,
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(ExamEngineResponse {
                        success: false,
                        message: "Invalid Subject ID".to_string(),
                    }),
                );
            }
        };
        let default_question_bank_id =
            ObjectId::parse_str(&subj_payload.default_question_bank_id)
                .unwrap_or_else(|_| ObjectId::parse_str("000000000000000000000000").unwrap());
        let reappear_question_bank_id = subj_payload
            .reappear_question_bank_id
            .as_ref()
            .and_then(|id| ObjectId::parse_str(id).ok());

        // Validate question distribution
        let calculated_exam_total: f64 = subj_payload
            .question_distribution
            .iter()
            .map(|r| r.marks * r.count as f64)
            .sum();
        if (calculated_exam_total - subj_payload.final_exam_component.marks).abs() > 0.01 {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: format!(
                        "Total distribution marks ({:.2}) does not match Final Exam marks ({:.2})",
                        calculated_exam_total, subj_payload.final_exam_component.marks
                    ),
                }),
            );
        }

        // Validate components sum to total marks (only count enabled components)
        let total_components = (if subj_payload.practical_component.enabled {
            subj_payload.practical_component.marks
        } else {
            0.0
        }) + (if subj_payload.assignment_component.enabled {
            subj_payload.assignment_component.marks
        } else {
            0.0
        }) + subj_payload.final_exam_component.marks;
        if (total_components - subj_payload.final_subject_total_marks).abs() > 0.01 {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: format!(
                        "Components total ({:.2}) does not match Subject Total Marks ({:.2})",
                        total_components, subj_payload.final_subject_total_marks
                    ),
                }),
            );
        }

        subjects.push(SubjectBlueprintConfig {
            subject_id: subj_id,
            default_question_bank_id,
            reappear_question_bank_id,
            final_subject_total_marks: subj_payload.final_subject_total_marks,
            practical_component: BlueprintComponentsPart {
                enabled: subj_payload.practical_component.enabled,
                marks: subj_payload.practical_component.marks,
                min_marks: subj_payload.practical_component.min_marks,
            },
            assignment_component: BlueprintComponentsPart {
                enabled: subj_payload.assignment_component.enabled,
                marks: subj_payload.assignment_component.marks,
                min_marks: subj_payload.assignment_component.min_marks,
            },
            final_exam_component: BlueprintComponentsPart {
                enabled: true, // Final exam is always enabled
                marks: subj_payload.final_exam_component.marks,
                min_marks: subj_payload.final_exam_component.min_marks,
            },
            question_distribution: subj_payload.question_distribution,
            advanced_settings: subj_payload.advanced_settings,
            instructions: subj_payload.instructions,
            duration_minutes: subj_payload.duration_minutes,
        });
    }

    let total_duration = subjects.iter().map(|s| s.duration_minutes).sum();

    let coll = db.collection::<ExamBlueprint>("exam_blueprints");

    // Fetch old to preserve internal fields
    let old_bp = match coll.find_one(doc! { "_id": b_oid }, None).await {
        Ok(Some(bp)) => bp,
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Blueprint not found".to_string(),
                }),
            );
        }
    };

    // If this is the default blueprint, set all others for the same course to false
    if payload.default_blueprint {
        let _ = coll
            .update_many(
                doc! { "course_id": course_id, "_id": { "$ne": b_oid } },
                doc! { "$set": { "default_blueprint": false } },
                None,
            )
            .await;
    }

    let blueprint = ExamBlueprint {
        id: Some(b_oid),
        name: payload.name,
        category_id,
        course_id,
        session_id,
        bank_id,
        reappear_bank_id,
        subject_id,
        total_marks: payload.total_marks,
        minimum_marks: payload.minimum_marks,
        duration_minutes: payload.duration_minutes,
        total_duration_minutes: total_duration,
        max_attempts: payload.max_attempts,
        instructions: payload.instructions,
        mode: payload.mode,
        exam_mode: payload.exam_mode,
        practical_enabled: payload.practical_enabled,
        assignment_enabled: payload.assignment_enabled,
        components: payload.components,
        allow_bank_override: payload.allow_bank_override,
        rules: payload.rules,
        sections: payload.sections,
        require_attendance: payload.require_attendance,
        subjects,
        created_by: old_bp.created_by,
        created_at: old_bp.created_at,
        default_blueprint: payload.default_blueprint,
        exam_pattern: payload.exam_pattern,
        term_number: payload.term_number,
    };

    // Freeze already-allotted papers against future blueprint edits by backfilling the
    // pre-update subject config into papers that do not yet have a snapshot.
    if !old_bp.subjects.is_empty() {
        let paper_coll = db.collection::<Document>("student_papers");
        for subject_config in &old_bp.subjects {
            if let Ok(snapshot_bson) = mongodb::bson::to_bson(subject_config) {
                let _ = paper_coll
                    .update_many(
                        doc! {
                            "blueprint_id": b_oid,
                            "subject_id": subject_config.subject_id,
                            "$or": [
                                { "subject_config_snapshot": { "$exists": false } },
                                { "subject_config_snapshot": mongodb::bson::Bson::Null }
                            ]
                        },
                        doc! {
                            "$set": {
                                "subject_config_snapshot": snapshot_bson.clone()
                            }
                        },
                        None,
                    )
                    .await;
            }
        }
    }

    match coll
        .replace_one(doc! { "_id": b_oid }, blueprint, None)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(ExamEngineResponse {
                success: true,
                message: "Blueprint updated".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ExamEngineResponse {
                success: false,
                message: "Update failed".to_string(),
            }),
        ),
    }
}

pub async fn set_default_blueprint(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<ExamEngineResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(ExamEngineResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let b_oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let coll = db.collection::<ExamBlueprint>("exam_blueprints");

    // First get the blueprint to get its course_id
    let blueprint = match coll.find_one(doc! { "_id": b_oid }, None).await {
        Ok(Some(bp)) => bp,
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Blueprint not found".to_string(),
                }),
            );
        }
    };

    // Set all blueprints for this course to false
    let _ = coll
        .update_many(
            doc! { "course_id": blueprint.course_id },
            doc! { "$set": { "default_blueprint": false } },
            None,
        )
        .await;

    // Set this one to true
    match coll
        .update_one(
            doc! { "_id": b_oid },
            doc! { "$set": { "default_blueprint": true } },
            None,
        )
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(ExamEngineResponse {
                success: true,
                message: "Default blueprint set".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ExamEngineResponse {
                success: false,
                message: "Failed to set default blueprint".to_string(),
            }),
        ),
    }
}

pub async fn delete_blueprint(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<ExamEngineResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(ExamEngineResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let b_oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let coll = db.collection::<ExamBlueprint>("exam_blueprints");
    match coll.delete_one(doc! { "_id": b_oid }, None).await {
        Ok(_) => (
            StatusCode::OK,
            Json(ExamEngineResponse {
                success: true,
                message: "Blueprint deleted".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ExamEngineResponse {
                success: false,
                message: "Delete failed".to_string(),
            }),
        ),
    }
}

pub async fn list_blueprints(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<serde_json::Value>>) {
    if claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
        && claims.role != UserRole::Center
        && claims.role != UserRole::Student
    {
        return (StatusCode::FORBIDDEN, Json(vec![]));
    }

    let coll = db.collection::<ExamBlueprint>("exam_blueprints");
    let mut cursor = match coll.find(None, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut blueprints = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(bp) = result {
            let mut json_val = serde_json::to_value(&bp).unwrap();
            if let Some(obj) = json_val.as_object_mut() {
                // Convert all ObjectId fields (including optional ones)
                for key in &[
                    "_id",
                    "category_id",
                    "course_id",
                    "session_id",
                    "bank_id",
                    "reappear_bank_id",
                    "subject_id",
                    "created_by",
                ] {
                    if let Some(id_val) = obj.get(*key) {
                        if id_val.is_null() {
                            // Skip if it's null
                            continue;
                        }
                        if let Some(oid_str) = id_val.get("$oid").and_then(|v| v.as_str()) {
                            obj.insert(
                                key.to_string(),
                                serde_json::Value::String(oid_str.to_string()),
                            );
                        }
                    }
                }
                // Convert created_at date field
                if let Some(created_at_val) = obj.get("created_at") {
                    // Handle both cases: if it's already a string or it's a $date object
                    if created_at_val.is_string() {
                        // It's already a string, leave it as-is
                    } else if let Some(date_obj) = created_at_val.as_object() {
                        if let Some(date_str) = date_obj.get("$date").and_then(|v| v.as_str()) {
                            obj.insert(
                                "created_at".to_string(),
                                serde_json::Value::String(date_str.to_string()),
                            );
                        } else if let Some(ts) =
                            date_obj.get("$numberLong").and_then(|v| v.as_str())
                        {
                            // If it's stored as a timestamp
                            if let Ok(millis) = ts.parse::<i64>() {
                                if let Some(dt) = chrono::DateTime::from_timestamp_millis(millis) {
                                    obj.insert(
                                        "created_at".to_string(),
                                        serde_json::Value::String(dt.to_rfc3339()),
                                    );
                                }
                            }
                        }
                    }
                }
                // Convert subjects array ObjectId fields
                if let Some(subjects_val) = obj.get_mut("subjects") {
                    if let Some(subjects_arr) = subjects_val.as_array_mut() {
                        for subj in subjects_arr {
                            if let Some(subj_obj) = subj.as_object_mut() {
                                for key in &[
                                    "subject_id",
                                    "default_question_bank_id",
                                    "reappear_question_bank_id",
                                ] {
                                    if let Some(id_val) = subj_obj.get(*key) {
                                        if id_val.is_null() {
                                            continue;
                                        }
                                        if let Some(oid_str) =
                                            id_val.get("$oid").and_then(|v| v.as_str())
                                        {
                                            subj_obj.insert(
                                                key.to_string(),
                                                serde_json::Value::String(oid_str.to_string()),
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            blueprints.push(json_val);
        }
    }
    (StatusCode::OK, Json(blueprints))
}

// --- Question Bank Management ---

pub async fn add_question(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<QBQuestion>,
) -> (StatusCode, Json<ExamEngineResponse>) {
    if claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
        && claims.role != UserRole::Center
    {
        return (
            StatusCode::FORBIDDEN,
            Json(ExamEngineResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let coll = db.collection::<QBQuestion>("qb_questions");
    let mut question = payload;
    question.id = None;
    question.created_by = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => Some(oid),
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid user ID".to_string(),
                }),
            );
        }
    };
    question.created_at = mongodb::bson::DateTime::now();

    match coll.insert_one(question, None).await {
        Ok(_) => (
            StatusCode::CREATED,
            Json(ExamEngineResponse {
                success: true,
                message: "Question added".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ExamEngineResponse {
                success: false,
                message: "Add failed".to_string(),
            }),
        ),
    }
}

pub async fn list_questions(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<QBQuestion>>) {
    if claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
        && claims.role != UserRole::Center
    {
        return (StatusCode::FORBIDDEN, Json(vec![]));
    }

    let coll = db.collection::<QBQuestion>("qb_questions");
    let mut cursor = match coll.find(None, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut questions = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(q) = result {
            questions.push(q);
        }
    }
    (StatusCode::OK, Json(questions))
}

pub async fn delete_question(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<ExamEngineResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(ExamEngineResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let q_oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let coll = db.collection::<QBQuestion>("qb_questions");
    match coll.delete_one(doc! { "_id": q_oid }, None).await {
        Ok(_) => (
            StatusCode::OK,
            Json(ExamEngineResponse {
                success: true,
                message: "Question deleted".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ExamEngineResponse {
                success: false,
                message: "Delete failed".to_string(),
            }),
        ),
    }
}

pub async fn update_question(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<QBQuestion>,
) -> (StatusCode, Json<ExamEngineResponse>) {
    if claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
        && claims.role != UserRole::Center
    {
        return (
            StatusCode::FORBIDDEN,
            Json(ExamEngineResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let q_oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let coll = db.collection::<QBQuestion>("qb_questions");
    let mut updated_q = payload;
    updated_q.id = Some(q_oid);

    match coll
        .replace_one(doc! { "_id": q_oid }, updated_q, None)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(ExamEngineResponse {
                success: true,
                message: "Question updated".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ExamEngineResponse {
                success: false,
                message: "Update failed".to_string(),
            }),
        ),
    }
}

// --- CORE ENGINE: Paper Generation ---

#[derive(Debug, Deserialize)]
pub struct GeneratePaperRequest {
    pub blueprint_id: String,
    pub student_id: String,
    pub center_id: String,
    pub start_window: Option<String>, // ISO Date String
    pub end_window: Option<String>,   // ISO Date String
    pub subject_id: Option<String>,
    pub force: Option<bool>,
    pub bank_id_override: Option<String>,
}

/// Pick questions from blueprint rules (deterministic seed optional for batch consistency).
pub async fn pick_questions_for_blueprint(
    db: &Database,
    blueprint: &ExamBlueprint,
    subject_config: Option<&SubjectBlueprintConfig>,
    bank_id_override: Option<ObjectId>,
    use_reappear_bank: bool,
    deterministic_seed: Option<u64>,
) -> Result<Vec<PaperQuestionMapping>, (StatusCode, ExamEngineResponse)> {
    // Helper to get the default bank ID with backward compatibility
    let get_default_bank = || -> Result<ObjectId, (StatusCode, ExamEngineResponse)> {
        if let Some(subject_config) = subject_config {
            Ok(subject_config.default_question_bank_id)
        } else if let Some(bank_id) = blueprint.bank_id {
            Ok(bank_id)
        } else if let Some(first_subject) = blueprint.subjects.first() {
            Ok(first_subject.default_question_bank_id)
        } else {
            Err((
                StatusCode::BAD_REQUEST,
                ExamEngineResponse {
                    success: false,
                    message: "No question bank configured for blueprint".to_string(),
                },
            ))
        }
    };

    // Helper to get reappear bank ID with backward compatibility
    let get_reappear_bank = || -> Result<ObjectId, (StatusCode, ExamEngineResponse)> {
        if let Some(subject_config) = subject_config {
            if let Some(bank_id) = subject_config.reappear_question_bank_id {
                Ok(bank_id)
            } else {
                Ok(subject_config.default_question_bank_id)
            }
        } else if let Some(bank_id) = blueprint.reappear_bank_id {
            Ok(bank_id)
        } else if let Some(first_subject) = blueprint.subjects.first() {
            first_subject.reappear_question_bank_id.ok_or_else(|| {
                (
                    StatusCode::BAD_REQUEST,
                    ExamEngineResponse {
                        success: false,
                        message: "No reappear question bank configured for blueprint".to_string(),
                    },
                )
            })
        } else {
            Err((
                StatusCode::BAD_REQUEST,
                ExamEngineResponse {
                    success: false,
                    message: "No question bank configured for blueprint".to_string(),
                },
            ))
        }
    };

    let q_bank_id = if let Some(oid) = bank_id_override {
        if !blueprint.allow_bank_override {
            return Err((
                StatusCode::BAD_REQUEST,
                ExamEngineResponse {
                    success: false,
                    message: "Bank override not allowed for this blueprint".to_string(),
                },
            ));
        }
        oid
    } else if use_reappear_bank {
        get_reappear_bank().or_else(|_| get_default_bank())?
    } else {
        get_default_bank()?
    };

    // Get the appropriate rules
    let rules = if let Some(subject_config) = subject_config {
        &subject_config.question_distribution
    } else {
        &blueprint.rules
    };

    let q_bank_coll = db.collection::<mongodb::bson::Document>("qb_questions");
    let mut paper_questions = Vec::new();
    let mut order = 1u32;

    if !rules.is_empty() {
        for rule in rules {
            // Just filter by bank ID, no marks filter (since marks are now from blueprint rules)
            let filter = doc! {
                "bank_id": q_bank_id
            };

            let mut cursor = q_bank_coll
                .find(filter, None)
                .await
                .expect("Failed to query bank");
            let mut eligible_qs = Vec::new();
            while let Some(result) = cursor.next().await {
                if let Ok(q) = result {
                    eligible_qs.push(q);
                }
            }

            if eligible_qs.len() < rule.count as usize && blueprint.mode == "Strict" {
                return Err((
                    StatusCode::BAD_REQUEST,
                    ExamEngineResponse {
                        success: false,
                        message: format!(
                            "STRICT MODE: Insufficient questions. Required: {}, Available: {}",
                            rule.count,
                            eligible_qs.len()
                        ),
                    },
                ));
            }

            if let Some(seed) = deterministic_seed {
                use rand::SeedableRng;
                use rand::rngs::StdRng;
                let mut rng = StdRng::seed_from_u64(seed);
                eligible_qs.shuffle(&mut rng);
            } else {
                let mut rng = thread_rng();
                eligible_qs.shuffle(&mut rng);
            }

            let pick_count = if blueprint.mode == "Strict" {
                rule.count as usize
            } else {
                std::cmp::min(rule.count as usize, eligible_qs.len())
            };

            for q in eligible_qs.into_iter().take(pick_count) {
                paper_questions.push(PaperQuestionMapping {
                    section_id: "default".to_string(),
                    question_id: q.get_object_id("_id").unwrap(),
                    order,
                    student_response: None,
                    obtained_marks: 0.0,
                    evaluation_status: "Pending".to_string(),
                    evaluator_remarks: None,
                });
                order += 1;
            }
        }
    }

    if paper_questions.is_empty() {
        return Err((StatusCode::BAD_REQUEST, ExamEngineResponse {
            success: false,
            message: "Failed to generate paper: No eligible questions found in the selected question bank matching the blueprint rules.".to_string(),
        }));
    }

    Ok(paper_questions)
}

/// Mark student as appeared for course attempt (called on exam start).
pub async fn mark_course_attempt_appeared(
    db: &Database,
    student_id: ObjectId,
    center_id: ObjectId,
    course_id: ObjectId,
    attempt_number: i32,
) {
    let coll = db.collection::<CourseExamAttempt>("course_exam_attempts");
    let filter = doc! {
        "student_id": student_id,
        "course_id": course_id,
        "attempt_number": attempt_number,
    };
    let update = doc! {
        "$set": {
            "appeared": true,
            "updated_at": mongodb::bson::DateTime::now(),
        },
        "$setOnInsert": {
            "student_id": student_id,
            "course_id": course_id,
            "center_id": center_id,
            "attempt_number": attempt_number,
            "allow_reappear": false,
            "reappear_locked": false,
            "overall_result": "pending",
            "subject_marks": [],
            "total_obtained": 0.0,
            "total_marks": 0.0,
            "percentage": 0.0,
            "marks_submitted": false,
            "is_reappear_student": attempt_number > 1,
            "created_at": mongodb::bson::DateTime::now(),
        }
    };
    let opts = mongodb::options::UpdateOptions::builder()
        .upsert(true)
        .build();
    let _ = coll.update_one(filter, update, opts).await;
}

/// Core v1 paper generation. `center_id` is the center **login user** id (matches `student_papers.center_id` filters).
pub async fn insert_generated_student_paper(
    db: &Database,
    blueprint_id: ObjectId,
    student_id: ObjectId,
    center_id: ObjectId,
    start_window: Option<mongodb::bson::DateTime>,
    end_window: Option<mongodb::bson::DateTime>,
    subject_id: Option<ObjectId>,
    force: bool,
    bank_id_override: Option<ObjectId>,
    preselected_questions: Option<Vec<PaperQuestionMapping>>,
    allotment_batch_id: Option<ObjectId>,
    use_reappear_bank: bool,
    course_attempt_number: i32,
) -> Result<ObjectId, (StatusCode, ExamEngineResponse)> {
    let paper_coll = db.collection::<StudentPaper>("student_papers");

    if force {
        // If force is true, we "cancel" active attempts by marking them as something else or deleting.
        // For simplicity, let's just delete them so the new one can be generated.
        let mut cancel_filter = doc! {
            "student_id": student_id,
            "blueprint_id": blueprint_id,
            "status": { "$nin": ["Evaluated", "Submitted", "submitted", "evaluated"] }
        };
        if let Some(sid) = subject_id {
            cancel_filter.insert("subject_id", sid);
        }
        let _ = paper_coll.delete_many(cancel_filter, None).await;
    } else {
        // Check for active attempts (not Evaluated or Submitted)
        let mut active_filter = doc! {
            "student_id": student_id,
            "blueprint_id": blueprint_id,
            "status": { "$nin": ["Evaluated", "Submitted", "submitted", "evaluated"] }
        };

        if let Some(sid) = subject_id {
            active_filter.insert("subject_id", sid);
        }

        let active_attempts = match paper_coll.count_documents(active_filter, None).await {
            Ok(count) => count as i32,
            Err(_) => 0,
        };

        if active_attempts > 0 {
            return Err((
                StatusCode::BAD_REQUEST,
                ExamEngineResponse {
                    success: false,
                    message: "An active attempt already exists for this exam/subject. Complete or evaluate it before re-allotting.".to_string(),
                },
            ));
        }
    }

    let mut existing_filter = doc! { "student_id": student_id, "blueprint_id": blueprint_id };
    if let Some(sid) = subject_id {
        existing_filter.insert("subject_id", sid);
    }

    let existing_attempts = match paper_coll.count_documents(existing_filter, None).await {
        Ok(count) => count as i32,
        Err(_) => 0,
    };

    let blueprint_coll = db.collection::<ExamBlueprint>("exam_blueprints");
    let blueprint = match blueprint_coll
        .find_one(doc! { "_id": blueprint_id }, None)
        .await
    {
        Ok(Some(b)) => b,
        _ => {
            return Err((
                StatusCode::NOT_FOUND,
                ExamEngineResponse {
                    success: false,
                    message: "Blueprint not found".to_string(),
                },
            ));
        }
    };

    let subject_id = subject_id.or(blueprint.subject_id);

    if existing_attempts >= blueprint.max_attempts && blueprint.max_attempts > 0 {
        // If we reach max attempts, check if we can reset.
        // User wants re-allotment to work after completion.
        println!(
            "INFO: Max attempts reached ({} / {}). Re-allotment allowed because existing attempts are finished.",
            existing_attempts, blueprint.max_attempts
        );
    }

    // Helper to get the default bank ID with backward compatibility
    let get_default_bank = || -> Result<ObjectId, (StatusCode, ExamEngineResponse)> {
        if let Some(bank_id) = blueprint.bank_id {
            Ok(bank_id)
        } else if let Some(first_subject) = blueprint.subjects.first() {
            Ok(first_subject.default_question_bank_id)
        } else {
            Err((
                StatusCode::BAD_REQUEST,
                ExamEngineResponse {
                    success: false,
                    message: "No question bank configured for blueprint".to_string(),
                },
            ))
        }
    };

    // Helper to get reappear bank ID with backward compatibility
    let get_reappear_bank = || -> Result<ObjectId, (StatusCode, ExamEngineResponse)> {
        if let Some(bank_id) = blueprint.reappear_bank_id {
            Ok(bank_id)
        } else if let Some(first_subject) = blueprint.subjects.first() {
            first_subject.reappear_question_bank_id.ok_or_else(|| {
                (
                    StatusCode::BAD_REQUEST,
                    ExamEngineResponse {
                        success: false,
                        message: "No reappear question bank configured for blueprint".to_string(),
                    },
                )
            })
        } else {
            Err((
                StatusCode::BAD_REQUEST,
                ExamEngineResponse {
                    success: false,
                    message: "No question bank configured for blueprint".to_string(),
                },
            ))
        }
    };

    let q_bank_id = if let Some(oid) = bank_id_override {
        if !blueprint.allow_bank_override {
            return Err((
                StatusCode::BAD_REQUEST,
                ExamEngineResponse {
                    success: false,
                    message: "Bank override not allowed for this blueprint".to_string(),
                },
            ));
        }
        oid
    } else if use_reappear_bank {
        get_reappear_bank().or_else(|_| get_default_bank())?
    } else {
        get_default_bank()?
    };
    let _ = q_bank_id; // used in pick_questions_for_blueprint when generating

    // Find subject config if subject_id is provided
    let subject_config =
        subject_id.and_then(|sid| blueprint.subjects.iter().find(|s| s.subject_id == sid));

    let paper_questions = if let Some(qs) = preselected_questions {
        qs
    } else {
        let seed = allotment_batch_id.map(|id| {
            let mut h: u64 = 0;
            for b in id.bytes() {
                h = h.wrapping_mul(31).wrapping_add(b as u64);
            }
            h
        });
        pick_questions_for_blueprint(
            db,
            &blueprint,
            subject_config,
            bank_id_override,
            use_reappear_bank,
            seed,
        )
        .await?
    };

    let bp_snapshot = BlueprintSnapshot {
        name: blueprint.name.clone(),
        max_attempts: blueprint.max_attempts,
        blueprint_total_marks: blueprint.total_marks,
        blueprint_duration_minutes: blueprint.duration_minutes,
    };

    let new_paper = StudentPaper {
        id: None,
        blueprint_id,
        session_id: None,
        student_id,
        center_id,
        status: "Generated".to_string(),
        start_window,
        end_window,
        start_time: None,
        submit_time: None,
        attempt_number: course_attempt_number.max(existing_attempts + 1),
        security_log: None,
        total_obtained_marks: 0.0,
        is_passed: None,
        practical_passed: None,
        assignment_passed: None,
        exam_passed: None,
        section_wise_marks: std::collections::HashMap::new(),
        questions: paper_questions,
        subject_id,
        subject_config_snapshot: subject_config.cloned(),
        blueprint_snapshot: Some(bp_snapshot),
        allotment_batch_id,
        created_at: mongodb::bson::DateTime::now(),
    };

    match paper_coll.insert_one(new_paper, None).await {
        Ok(ins) => {
            let id = ins.inserted_id.as_object_id().ok_or((
                StatusCode::INTERNAL_SERVER_ERROR,
                ExamEngineResponse {
                    success: false,
                    message: "Generation failed (no id)".to_string(),
                },
            ))?;

            // AUTO-MARK ATTENDANCE: When an exam is scheduled/generated, mark the student as present for that day
            let attendance_coll =
                db.collection::<crate::handlers::attendance::Attendance>("attendances");
            let now = chrono::Utc::now();
            let start_of_day = now.date_naive().and_hms_opt(0, 0, 0).unwrap();
            let attendance_date =
                mongodb::bson::DateTime::from_millis(start_of_day.and_utc().timestamp_millis());

            let att_filter = doc! {
                "student_id": student_id,
                "center_id": center_id,
                "date": attendance_date
            };
            let att_update = doc! {
                "$set": { "status": "present" },
                "$setOnInsert": {
                    "student_id": student_id,
                    "center_id": center_id,
                    "date": attendance_date
                }
            };
            let att_options = mongodb::options::UpdateOptions::builder()
                .upsert(true)
                .build();
            let _ = attendance_coll
                .update_one(att_filter, att_update, att_options)
                .await;

            Ok(id)
        }
        Err(_) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            ExamEngineResponse {
                success: false,
                message: "Generation failed".to_string(),
            },
        )),
    }
}

pub async fn generate_student_paper(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<GeneratePaperRequest>,
) -> (StatusCode, Json<ExamEngineResponse>) {
    if claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
        && claims.role != UserRole::Center
        && claims.role != UserRole::Student
    {
        return (
            StatusCode::FORBIDDEN,
            Json(ExamEngineResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    if claims.role == UserRole::Student && payload.student_id != claims.sub {
        return (
            StatusCode::FORBIDDEN,
            Json(ExamEngineResponse {
                success: false,
                message: "You can only generate papers for yourself".to_string(),
            }),
        );
    }

    let b_oid = match ObjectId::parse_str(&payload.blueprint_id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid Blueprint ID".to_string(),
                }),
            );
        }
    };
    let s_oid = match ObjectId::parse_str(&payload.student_id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid Student ID".to_string(),
                }),
            );
        }
    };
    let c_oid = match ObjectId::parse_str(&payload.center_id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid Center ID".to_string(),
                }),
            );
        }
    };
    let sub_oid = payload
        .subject_id
        .and_then(|s| ObjectId::parse_str(&s).ok());

    println!(
        "DEBUG: Generating paper for student {} from blueprint {} (Center: {}, Subject: {:?})",
        s_oid, b_oid, c_oid, sub_oid
    );

    // If caller didn't send windows, derive from blueprint
    let mut start_window = payload.start_window.and_then(|s| {
        chrono::DateTime::parse_from_rfc3339(&s)
            .ok()
            .map(|dt| mongodb::bson::DateTime::from_millis(dt.timestamp_millis()))
    });

    // Validation: Ensure start_window is not in the past
    if let Some(sw) = start_window {
        let now = Utc::now().timestamp_millis();
        // Allow a generous buffer (e.g., 2 hours) for clock drift or timezone issues
        // The frontend handles strict validation; the backend just needs to prevent ancient windows.
        if sw.to_chrono().timestamp_millis() < now - (2 * 3600_000) {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Start window is too far in the past".to_string(),
                }),
            );
        }
    }

    let mut end_window = payload.end_window.and_then(|s| {
        chrono::DateTime::parse_from_rfc3339(&s)
            .ok()
            .map(|dt| mongodb::bson::DateTime::from_millis(dt.timestamp_millis()))
    });

    if start_window.is_none() || end_window.is_none() {
        let bp_coll = db.collection::<ExamBlueprint>("exam_blueprints");
        if let Ok(Some(bp)) = bp_coll.find_one(doc! { "_id": b_oid }, None).await {
            // We no longer fallback to blueprint for start/end window as they are removed from blueprint.
            // If they are missing from payload, we might need a default or return error.
            // For now, if start_window is provided but end_window isn't, we calculate from duration.
            if end_window.is_none() {
                if let Some(s) = start_window {
                    let end_millis =
                        s.to_chrono().timestamp_millis() + (bp.duration_minutes as i64) * 60_000;
                    end_window = Some(mongodb::bson::DateTime::from_millis(end_millis));
                }
            }
        }
    }

    let bank_id_override = payload
        .bank_id_override
        .and_then(|id| ObjectId::parse_str(&id).ok());

    match insert_generated_student_paper(
        &db,
        b_oid,
        s_oid,
        c_oid,
        start_window,
        end_window,
        sub_oid,
        payload.force.unwrap_or(false),
        bank_id_override,
        None,
        None,
        false,
        1,
    )
    .await
    {
        Ok(_) => (
            StatusCode::CREATED,
            Json(ExamEngineResponse {
                success: true,
                message: "Paper generated successfully".to_string(),
            }),
        ),
        Err((code, msg)) => (code, Json(msg)),
    }
}

fn student_paper_to_json(p: &StudentPaper) -> serde_json::Value {
    let mut json_val = serde_json::to_value(p).unwrap_or(serde_json::Value::Null);
    if let Some(obj) = json_val.as_object_mut() {
        for key in &[
            "_id",
            "blueprint_id",
            "student_id",
            "center_id",
            "subject_id",
            "session_id",
            "allotment_batch_id",
        ] {
            if let Some(id_val) = obj.get(*key) {
                if let Some(oid_str) = id_val.get("$oid").and_then(|v| v.as_str()) {
                    obj.insert(
                        key.to_string(),
                        serde_json::Value::String(oid_str.to_string()),
                    );
                }
            }
        }
        for key in &[
            "start_window",
            "end_window",
            "start_time",
            "submit_time",
            "created_at",
        ] {
            if let Some(date_val) = obj.get(*key) {
                if let Some(date_obj) = date_val.get("$date") {
                    if let Some(ts) = date_obj.as_i64() {
                        let iso = chrono::DateTime::from_timestamp_millis(ts)
                            .map(|dt| dt.to_rfc3339())
                            .unwrap_or_default();
                        obj.insert(key.to_string(), serde_json::Value::String(iso));
                    } else if let Some(s) = date_obj.as_str() {
                        obj.insert(key.to_string(), serde_json::Value::String(s.to_string()));
                    }
                }
            }
        }
        if let Some(questions) = obj.get_mut("questions") {
            if let Some(arr) = questions.as_array_mut() {
                for q in arr.iter_mut() {
                    if let Some(qobj) = q.as_object_mut() {
                        if let Some(qid) = qobj.get("question_id") {
                            if let Some(oid_str) = qid.get("$oid").and_then(|v| v.as_str()) {
                                qobj.insert(
                                    "question_id".to_string(),
                                    serde_json::Value::String(oid_str.to_string()),
                                );
                            }
                        }
                    }
                }
            }
        }
    }
    json_val
}

pub async fn list_student_papers(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<serde_json::Value>>) {
    let coll = db.collection::<StudentPaper>("student_papers");

    let sub_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(vec![])),
    };

    let filter = match claims.role {
        UserRole::Admin | UserRole::SuperAdmin => doc! {},
        UserRole::Center => {
            let center_coll = db.collection::<Document>("centers");
            let center_doc = center_coll.find_one(doc! { "user_id": sub_oid }, None).await.ok().flatten();
            if let Some(cdoc) = center_doc {
                if let Ok(c_oid) = cdoc.get_object_id("_id") {
                    doc! { "center_id": { "$in": [sub_oid, c_oid] } }
                } else {
                    doc! { "center_id": sub_oid }
                }
            } else {
                doc! { "center_id": sub_oid }
            }
        }
        UserRole::Student => doc! { "student_id": sub_oid },
        _ => return (StatusCode::FORBIDDEN, Json(vec![])),
    };
    // #region debug-point D:list-student-papers-entry
    report_student_exam_debug(
        "pre-fix",
        "D",
        "exam_engine.rs:list_student_papers:filter",
        "[DEBUG] listing student papers",
        serde_json::json!({
            "claims_sub": claims.sub,
            "claims_role": format!("{:?}", claims.role),
            "filter": format!("{:?}", filter),
        }),
    )
    .await;
    // #endregion

    let mut cursor = match coll.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut papers = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(p) = result {
            papers.push(student_paper_to_json(&p));
        }
    }
    // #region debug-point D:list-student-papers-result
    report_student_exam_debug(
        "pre-fix",
        "D",
        "exam_engine.rs:list_student_papers:result",
        "[DEBUG] listed student papers successfully",
        serde_json::json!({
            "claims_sub": claims.sub,
            "claims_role": format!("{:?}", claims.role),
            "paper_count": papers.len(),
            "paper_ids": papers
                .iter()
                .take(20)
                .filter_map(|p| p.get("_id").cloned())
                .collect::<Vec<_>>(),
        }),
    )
    .await;
    // #endregion
    (StatusCode::OK, Json(papers))
}

#[derive(Debug, Serialize)]
pub struct StudentPaperWithDetails {
    pub paper: StudentPaper,
    pub blueprint: Option<ExamBlueprint>,
    pub questions: Vec<QBQuestion>,
    pub class_average: Option<f64>,
}

pub async fn get_student_paper(
    Path(id): Path<String>,
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<serde_json::Value>) {
    let p_oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::Value::Null)),
    };

    let paper_coll = db.collection::<StudentPaper>("student_papers");
    let paper = match paper_coll.find_one(doc! { "_id": p_oid }, None).await {
        Ok(Some(p)) => p,
        _ => return (StatusCode::NOT_FOUND, Json(serde_json::Value::Null)),
    };

    // Access control
    if claims.role == UserRole::Student {
        if paper.student_id.to_hex() != claims.sub {
            return (StatusCode::FORBIDDEN, Json(serde_json::Value::Null));
        }

        // Attendance check for active exams
        if paper.status == "Generated" || paper.status == "InProgress" {
            let blueprint_coll = db.collection::<ExamBlueprint>("exam_blueprints");
            let bp: Option<ExamBlueprint> = blueprint_coll
                .find_one(doc! { "_id": paper.blueprint_id }, None)
                .await
                .ok()
                .flatten();

            if let Some(b) = bp {
                if b.require_attendance {
                    let attendance_coll =
                        db.collection::<crate::handlers::attendance::Attendance>("attendances");

                    // Get today's range in UTC
                    let now = chrono::Utc::now();
                    let start_of_day = now.date_naive().and_hms_opt(0, 0, 0).unwrap();
                    let end_of_day = now.date_naive().and_hms_opt(23, 59, 59).unwrap();

                    let attendance = attendance_coll.find_one(
                        doc! {
                            "student_id": paper.student_id,
                            "status": "present",
                            "date": {
                                "$gte": mongodb::bson::DateTime::from_millis(start_of_day.and_utc().timestamp_millis()),
                                "$lte": mongodb::bson::DateTime::from_millis(end_of_day.and_utc().timestamp_millis())
                            }
                        },
                        None
                    ).await.ok().flatten();

                    if attendance.is_none() {
                        // AUTO-MARK ATTENDANCE: If they are accessing an active exam, mark them present
                        let attendance_date = mongodb::bson::DateTime::from_millis(
                            start_of_day.and_utc().timestamp_millis(),
                        );
                        let att_filter = doc! {
                            "student_id": paper.student_id,
                            "center_id": paper.center_id,
                            "date": attendance_date
                        };
                        let att_update = doc! {
                            "$set": { "status": "present" },
                            "$setOnInsert": {
                                "student_id": paper.student_id,
                                "center_id": paper.center_id,
                                "date": attendance_date
                            }
                        };
                        let att_options = mongodb::options::UpdateOptions::builder()
                            .upsert(true)
                            .build();
                        let _ = attendance_coll
                            .update_one(att_filter, att_update, att_options)
                            .await;
                    }
                }
            }
        }
    }

    let blueprint_coll = db.collection::<ExamBlueprint>("exam_blueprints");
    let mut blueprint: Option<ExamBlueprint> = blueprint_coll
        .find_one(doc! { "_id": paper.blueprint_id }, None)
        .await
        .ok()
        .flatten();

    // Apply subject-specific config if we have a subject_id
    if let Some(bp) = &mut blueprint {
        if let Some(subject_id) = paper.subject_id {
            if let Some(subject_config) = bp.subjects.iter().find(|s| s.subject_id == subject_id) {
                bp.total_marks = subject_config.final_subject_total_marks;
                bp.duration_minutes = subject_config.duration_minutes;
            }
        }
    }

    // Get subject config again to calculate question marks
    let subject_config = paper.subject_id.and_then(|sid| {
        blueprint
            .as_ref()
            .and_then(|bp| bp.subjects.iter().find(|s| s.subject_id == sid))
    });

    let q_bank_coll = db.collection::<mongodb::bson::Document>("qb_questions");
    let mut questions = Vec::new();

    for q_mapping in &paper.questions {
        match q_bank_coll
            .find_one(doc! { "_id": q_mapping.question_id }, None)
            .await
        {
            Ok(Some(doc)) => {
                // Manually build QBQuestion to be extremely resilient to data format variations
                let mut q = QBQuestion {
                    id: doc.get_object_id("_id").ok(),
                    bank_id: doc.get_object_id("bank_id").unwrap_or_default(),
                    subject_id: doc.get_object_id("subject_id").ok(),
                    question_text: doc.get_str("question_text").unwrap_or("").to_string(),
                    question_type: doc.get_str("question_type").unwrap_or("MCQ").to_string(),
                    // Use marks from subject config rules instead of question's own marks
                    marks: subject_config
                        .and_then(|sc| sc.question_distribution.first().map(|r| r.marks))
                        .unwrap_or(1.0),
                    options: doc
                        .get_array("options")
                        .map(|a| {
                            a.iter()
                                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                                .collect()
                        })
                        .unwrap_or_default(),
                    correct_option_index: doc.get_i32("correct_option_index").unwrap_or(0),
                    options_pool: doc.get_array("options_pool").ok().map(|a| {
                        a.iter()
                            .map(|v| {
                                // Convert BSON to JSON for options_pool
                                let bson_val = v.clone();
                                serde_json::to_value(&bson_val).unwrap_or(serde_json::Value::Null)
                            })
                            .collect()
                    }),
                    correct_option_id: doc.get_str("correct_option_id").ok().map(|s| s.to_string()),
                    created_by: doc.get_object_id("created_by").ok(),
                    created_at: doc
                        .get_datetime("created_at")
                        .map(|dt| *dt)
                        .unwrap_or_else(|_| mongodb::bson::DateTime::now()),
                };

                // Auto-convert options_pool to options for legacy frontend compatibility
                if q.options.is_empty() {
                    if let Some(pool) = &q.options_pool {
                        q.options = pool
                            .iter()
                            .filter_map(|v| {
                                v.get("text")
                                    .and_then(|t| t.as_str())
                                    .map(|s| s.to_string())
                            })
                            .collect();

                        if let Some(correct_id) = &q.correct_option_id {
                            if let Some(idx) = pool.iter().position(|v| {
                                v.get("id").and_then(|i| i.as_str()) == Some(correct_id)
                            }) {
                                q.correct_option_index = idx as i32;
                            }
                        }
                    }
                }

                // Hide correct answer/index from student if exam is not evaluated
                if claims.role == UserRole::Student && paper.status != "Evaluated" {
                    q.correct_option_index = -1;
                }
                questions.push(q);
            }
            Ok(None) => {
                eprintln!(
                    "WARNING: Question {} not found in qb_questions",
                    q_mapping.question_id
                );
            }
            Err(e) => {
                eprintln!(
                    "ERROR: Failed to load question {}: {}",
                    q_mapping.question_id, e
                );
            }
        }
    }

    // Calculate class average for this blueprint
    let mut class_average = None;
    if let Ok(mut cursor) = paper_coll
        .find(
            doc! { "blueprint_id": paper.blueprint_id, "status": "Evaluated" },
            None,
        )
        .await
    {
        let mut total_marks = 0.0;
        let mut count = 0;
        while let Some(Ok(p)) = cursor.next().await {
            total_marks += p.total_obtained_marks;
            count += 1;
        }
        if count > 0 {
            class_average = Some(total_marks / count as f64);
        }
    }

    let response = StudentPaperWithDetails {
        paper,
        blueprint,
        questions,
        class_average,
    };

    (StatusCode::OK, Json(serde_json::json!(response)))
}

#[derive(Debug, Serialize)]
pub struct QuestionAnalytics {
    pub question_id: String,
    pub total_attempts: u32,
    pub correct_attempts: u32,
    pub success_rate: f64,
    pub average_marks: f64,
}

pub async fn get_question_analytics(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<QuestionAnalytics>>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(vec![]));
    }

    let paper_coll = db.collection::<StudentPaper>("student_papers");
    let mut cursor = paper_coll
        .find(doc! { "status": "Evaluated" }, None)
        .await
        .expect("Failed to query papers");

    let mut stats: std::collections::HashMap<String, (u32, u32, f64, f64)> =
        std::collections::HashMap::new();

    while let Some(Ok(paper)) = cursor.next().await {
        for q in paper.questions {
            let q_id = q.question_id.to_hex();
            let entry = stats.entry(q_id).or_insert((0, 0, 0.0, 0.0));
            entry.0 += 1; // total attempts
            if q.obtained_marks > 0.0 {
                entry.1 += 1; // correct (or partial) attempts
            }
            entry.2 += q.obtained_marks; // sum of marks
        }
    }

    let mut analytics = Vec::new();
    for (q_id, (total, correct, sum_marks, _)) in stats {
        analytics.push(QuestionAnalytics {
            question_id: q_id,
            total_attempts: total,
            correct_attempts: correct,
            success_rate: if total > 0 {
                (correct as f64 / total as f64) * 100.0
            } else {
                0.0
            },
            average_marks: if total > 0 {
                sum_marks / total as f64
            } else {
                0.0
            },
        });
    }

    (StatusCode::OK, Json(analytics))
}



pub async fn delete_student_paper(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<ExamEngineResponse>) {
    if claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
        && claims.role != UserRole::Center
    {
        return (
            StatusCode::FORBIDDEN,
            Json(ExamEngineResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let p_oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let coll = db.collection::<StudentPaper>("student_papers");

    // Center users may only delete papers belonging to their center
    if claims.role == UserRole::Center {
        let paper = match coll.find_one(doc! { "_id": p_oid }, None).await {
            Ok(Some(p)) => p,
            Ok(None) => {
                return (
                    StatusCode::NOT_FOUND,
                    Json(ExamEngineResponse {
                        success: false,
                        message: "Paper not found".to_string(),
                    }),
                );
            }
            Err(_) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ExamEngineResponse {
                        success: false,
                        message: "Failed to fetch paper".to_string(),
                    }),
                );
            }
        };
        let center_oid = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(ExamEngineResponse {
                        success: false,
                        message: "Invalid center ID".to_string(),
                    }),
                );
            }
        };
        if paper.center_id != center_oid {
            return (
                StatusCode::FORBIDDEN,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Unauthorized".to_string(),
                }),
            );
        }
    }

    match coll.delete_one(doc! { "_id": p_oid }, None).await {
        Ok(_) => (
            StatusCode::OK,
            Json(ExamEngineResponse {
                success: true,
                message: "Attempt reset successfully".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ExamEngineResponse {
                success: false,
                message: "Reset failed".to_string(),
            }),
        ),
    }
}

#[derive(Debug, Deserialize)]
pub struct UpdateStudentPaperRequest {
    pub start_window: Option<String>,
    pub end_window: Option<String>,
}

pub async fn update_student_paper(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<UpdateStudentPaperRequest>,
) -> (StatusCode, Json<ExamEngineResponse>) {
    if claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
        && claims.role != UserRole::Center
    {
        return (
            StatusCode::FORBIDDEN,
            Json(ExamEngineResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let p_oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let coll = db.collection::<StudentPaper>("student_papers");

    // Fetch existing paper to check if it's already started/submitted
    let existing_paper = match coll.find_one(doc! { "_id": p_oid }, None).await {
        Ok(Some(p)) => p,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Paper not found".to_string(),
                }),
            );
        }
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Failed to fetch paper".to_string(),
                }),
            );
        }
    };

    // Center users may only update papers belonging to their center
    if claims.role == UserRole::Center {
        let center_oid = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(ExamEngineResponse {
                        success: false,
                        message: "Invalid center ID".to_string(),
                    }),
                );
            }
        };
        if existing_paper.center_id != center_oid {
            return (
                StatusCode::FORBIDDEN,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Unauthorized".to_string(),
                }),
            );
        }
    }

    // Prevent editing if exam is already started, submitted, or evaluated
    if existing_paper.status != "Generated" {
        return (
            StatusCode::BAD_REQUEST,
            Json(ExamEngineResponse {
                success: false,
                message: "Cannot edit: exam is already started, submitted, or evaluated"
                    .to_string(),
            }),
        );
    }

    // Build update
    let mut update_doc = doc! {};

    if let Some(start) = payload.start_window {
        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&start) {
            update_doc.insert(
                "start_window",
                mongodb::bson::DateTime::from_millis(dt.timestamp_millis()),
            );
        }
    }

    if let Some(end) = payload.end_window {
        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&end) {
            update_doc.insert(
                "end_window",
                mongodb::bson::DateTime::from_millis(dt.timestamp_millis()),
            );
        }
    }

    match coll
        .update_one(doc! { "_id": p_oid }, doc! { "$set": update_doc }, None)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(ExamEngineResponse {
                success: true,
                message: "Paper updated successfully".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ExamEngineResponse {
                success: false,
                message: "Update failed".to_string(),
            }),
        ),
    }
}

// --- Exam Attempt Flow ---

pub async fn start_exam(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<ExamEngineResponse>) {
    if claims.role != UserRole::Student {
        return (
            StatusCode::FORBIDDEN,
            Json(ExamEngineResponse {
                success: false,
                message: "Only students can attempt exams".to_string(),
            }),
        );
    }

    let p_oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid Paper ID".to_string(),
                }),
            );
        }
    };
    let coll = db.collection::<StudentPaper>("student_papers");

    let paper = match coll.find_one(doc! { "_id": p_oid }, None).await {
        Ok(Some(p)) => p,
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Paper not found".to_string(),
                }),
            );
        }
    };

    if paper.status != "Generated" {
        return (
            StatusCode::BAD_REQUEST,
            Json(ExamEngineResponse {
                success: false,
                message: "Exam already started or submitted".to_string(),
            }),
        );
    }

    // Offline students cannot start online exams — hall ticket only
    let user_coll = db.collection::<User>("users");
    if let Ok(Some(student)) = user_coll
        .find_one(doc! { "_id": paper.student_id }, None)
        .await
    {
        if let Some(ref mode) = student.exam_mode {
            let lower = mode.to_lowercase();
            let is_online = lower.contains("online")
                || lower.contains("cbt")
                || lower == "computer based test (cbt)";
            if !is_online {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(ExamEngineResponse {
                        success: false,
                        message: "Offline exam mode — download hall ticket from My Examinations"
                            .to_string(),
                    }),
                );
            }
        }
    }

    // Check window
    let now = mongodb::bson::DateTime::now();
    if let Some(start) = paper.start_window {
        if now < start {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Exam window has not started yet".to_string(),
                }),
            );
        }
    }
    if let Some(end) = paper.end_window {
        if now > end {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Exam window has expired".to_string(),
                }),
            );
        }
    }

    // Attendance check
    let blueprint_coll = db.collection::<ExamBlueprint>("exam_blueprints");
    let bp: Option<ExamBlueprint> = blueprint_coll
        .find_one(doc! { "_id": paper.blueprint_id }, None)
        .await
        .ok()
        .flatten();
    let course_id_for_attempt = bp.as_ref().map(|b| b.course_id);

    if let Some(b) = &bp {
        if b.require_attendance {
            // AUTO-MARK ATTENDANCE: When an exam is started, mark the student as present for that day
            let attendance_coll =
                db.collection::<crate::handlers::attendance::Attendance>("attendances");
            let now_chrono = chrono::Utc::now();
            let start_of_day = now_chrono.date_naive().and_hms_opt(0, 0, 0).unwrap();
            let attendance_date =
                mongodb::bson::DateTime::from_millis(start_of_day.and_utc().timestamp_millis());

            let att_filter = doc! {
                "student_id": paper.student_id,
                "center_id": paper.center_id,
                "date": attendance_date
            };
            let att_update = doc! {
                "$set": { "status": "present" },
                "$setOnInsert": {
                    "student_id": paper.student_id,
                    "center_id": paper.center_id,
                    "date": attendance_date
                }
            };
            let att_options = mongodb::options::UpdateOptions::builder()
                .upsert(true)
                .build();
            let _ = attendance_coll
                .update_one(att_filter, att_update, att_options)
                .await;

            // Allow for testing/requested student flow
            // let attendance = attendance_coll.find_one(
            //     doc! {
            //         "student_id": paper.student_id,
            //         "status": "present",
            //         "date": {
            //             "$gte": mongodb::bson::DateTime::from_millis(start_of_day.and_utc().timestamp_millis()),
            //             "$lte": mongodb::bson::DateTime::from_millis(end_of_day.and_utc().timestamp_millis())
            //         }
            //     },
            //     None
            // ).await.ok().flatten();
            // if attendance.is_none() {
            //     // return (StatusCode::FORBIDDEN, Json(ExamEngineResponse { success: false, message: "Attendance not marked present for today. Access denied.".to_string() }));
            // }
        }
    }

    match coll.update_one(
        doc! { "_id": p_oid },
        doc! { "$set": { "status": "InProgress", "start_time": mongodb::bson::DateTime::now() } },
        None
    ).await {
        Ok(_) => {
            if let Some(cid) = course_id_for_attempt {
                mark_course_attempt_appeared(
                    &db,
                    paper.student_id,
                    paper.center_id,
                    cid,
                    paper.attempt_number,
                ).await;
            }
            (StatusCode::OK, Json(ExamEngineResponse { success: true, message: "Exam started".to_string() }))
        },
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(ExamEngineResponse { success: false, message: "Start failed".to_string() })),
    }
}

#[derive(Debug, Deserialize)]
pub struct SubmitExamRequest {
    pub responses: Vec<QuestionResponse>,
    pub security_events: Option<Vec<SecurityEvent>>,
}

#[derive(Debug, Deserialize)]
pub struct QuestionResponse {
    pub question_id: String,
    pub response: String,
}

#[derive(Debug, Deserialize)]
pub struct SecurityEvent {
    pub event_type: String, // "TabSwitch", "FullscreenExit", "RightClick"
    pub timestamp: String,
}

pub async fn submit_exam(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<SubmitExamRequest>,
) -> (StatusCode, Json<ExamEngineResponse>) {
    if claims.role != UserRole::Student {
        return (
            StatusCode::FORBIDDEN,
            Json(ExamEngineResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let p_oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid Paper ID".to_string(),
                }),
            );
        }
    };
    let coll = db.collection::<StudentPaper>("student_papers");

    let mut paper = match coll.find_one(doc! { "_id": p_oid }, None).await {
        Ok(Some(p)) => p,
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Paper not found".to_string(),
                }),
            );
        }
    };

    if paper.status != "InProgress" {
        return (
            StatusCode::BAD_REQUEST,
            Json(ExamEngineResponse {
                success: false,
                message: "Exam not in progress".to_string(),
            }),
        );
    }

    let q_bank_coll = db.collection::<QBQuestion>("qb_questions");

    // Update responses
    for resp in payload.responses {
        if let Ok(q_oid) = ObjectId::parse_str(&resp.question_id) {
            if let Some(q_mapping) = paper.questions.iter_mut().find(|q| q.question_id == q_oid) {
                q_mapping.student_response = Some(resp.response);
            }
        }
    }

    // Auto-evaluate MCQs
    let mut all_evaluated = true;
    let mut total_score = 0.0;
    let mut section_scores: std::collections::HashMap<String, f64> =
        std::collections::HashMap::new();

    for q_mapping in &mut paper.questions {
        let question = match q_bank_coll
            .find_one(doc! { "_id": q_mapping.question_id }, None)
            .await
        {
            Ok(Some(q)) => q,
            _ => {
                all_evaluated = false;
                continue;
            }
        };

        if question.question_type == "MCQ" {
            if let Some(student_ans) = &q_mapping.student_response {
                let mut is_correct = false;

                // 1. Try to parse as index
                if let Ok(resp_idx) = student_ans.parse::<i32>() {
                    if resp_idx == question.correct_option_index {
                        is_correct = true;
                    }
                }

                // 2. Try direct text comparison
                if !is_correct {
                    if let Some(correct_opt_text) =
                        question.options.get(question.correct_option_index as usize)
                    {
                        if student_ans.trim().to_lowercase()
                            == correct_opt_text.trim().to_lowercase()
                        {
                            is_correct = true;
                        }
                    }
                }

                // 3. Try options_pool
                if !is_correct {
                    if let Some(pool) = &question.options_pool {
                        if let Some(correct_id) = &question.correct_option_id {
                            if let Some(correct_opt) = pool
                                .iter()
                                .find(|o| o.get("id").and_then(|i| i.as_str()) == Some(correct_id))
                            {
                                let correct_text = correct_opt
                                    .get("text")
                                    .and_then(|t| t.as_str())
                                    .unwrap_or("");
                                if student_ans.trim().to_lowercase()
                                    == correct_text.trim().to_lowercase()
                                    || student_ans == correct_id
                                {
                                    is_correct = true;
                                }
                            }
                        }
                    }
                }

                if is_correct {
                    q_mapping.obtained_marks = question.marks;
                } else if !student_ans.is_empty() {
                    // Apply negative marking if rule exists
                    let bp_coll = db.collection::<ExamBlueprint>("exam_blueprints");
                    let blueprint = bp_coll
                        .find_one(doc! { "_id": paper.blueprint_id }, None)
                        .await
                        .ok()
                        .flatten();
                    if let Some(bp) = blueprint {
                        for section in bp.sections {
                            if let Some(rule) = section.rules.iter().find(|r| {
                                if let Some(sid) = question.subject_id {
                                    r.subject_id == sid.to_hex() && r.question_type == "MCQ"
                                } else {
                                    false
                                }
                            }) {
                                if let Some(neg) = rule.negative_marks {
                                    q_mapping.obtained_marks = -neg;
                                }
                            }
                        }
                    }
                } else {
                    q_mapping.obtained_marks = 0.0;
                }
            }
            q_mapping.evaluation_status = "Evaluated".to_string();
        } else {
            // Theory/Practical - manual evaluation
            if let Some(_student_ans) = &q_mapping.student_response {
                if let Some(sid) = question.subject_id {
                    // Find passing marks or rules if needed
                    println!("Theory question for subject {} received response", sid);
                }
            }
            all_evaluated = false;
        }

        total_score += q_mapping.obtained_marks;
        let section_entry = section_scores
            .entry(q_mapping.section_id.clone())
            .or_insert(0.0);
        *section_entry += q_mapping.obtained_marks;
    }

    paper.status = if all_evaluated {
        "Evaluated".to_string()
    } else {
        "Submitted".to_string()
    };
    paper.total_obtained_marks = total_score;
    paper.section_wise_marks = section_scores;
    paper.submit_time = Some(mongodb::bson::DateTime::now());

    if let Some(events) = payload.security_events {
        let mut log = Vec::new();
        for event in events {
            log.push(format!("{}: {}", event.timestamp, event.event_type));
        }
        paper.security_log = Some(log);
    }

    // Sync marks if auto-evaluated completely
    if paper.status == "Evaluated" {
        let student_oid = paper.student_id;
        let user_coll = db.collection::<crate::models::user::User>("users");
        let mut subject_marks = Vec::new();
        let mut subj_map: std::collections::HashMap<String, (f64, f64)> =
            std::collections::HashMap::new();
        for q_mapping in &paper.questions {
            if let Ok(Some(q)) = q_bank_coll
                .find_one(doc! { "_id": q_mapping.question_id }, None)
                .await
            {
                if let Some(sid) = q.subject_id {
                    let sid_hex = sid.to_hex();
                    let entry = subj_map.entry(sid_hex).or_insert((0.0, 0.0));
                    entry.0 += q_mapping.obtained_marks;
                    entry.1 += q.marks;
                }
            }
        }
        for (subj_id, (obtained, total)) in subj_map {
            let subj_name = match db
                .collection::<mongodb::bson::Document>("subjects")
                .find_one(
                    doc! { "_id": ObjectId::parse_str(&subj_id).unwrap_or_default() },
                    None,
                )
                .await
            {
                Ok(Some(s)) => s
                    .get_str("name")
                    .unwrap_or(s.get_str("subject_name").unwrap_or(&subj_id))
                    .to_string(),
                _ => subj_id,
            };
            subject_marks.push(crate::models::user::SubjectMarks {
                subject: subj_name,
                marks: obtained,
                total,
            });
        }
        if !subject_marks.is_empty() {
            let _ = user_coll.update_one(
                doc! { "_id": student_oid },
                doc! { "$set": { "marks": mongodb::bson::to_bson(&subject_marks).unwrap_or(mongodb::bson::Bson::Null) } },
                None
            ).await;
        }
    }

    match coll.replace_one(doc! { "_id": p_oid }, paper, None).await {
        Ok(_) => (
            StatusCode::OK,
            Json(ExamEngineResponse {
                success: true,
                message: if all_evaluated {
                    "Exam submitted and evaluated successfully"
                } else {
                    "Exam submitted successfully"
                }
                .to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ExamEngineResponse {
                success: false,
                message: "Submit failed".to_string(),
            }),
        ),
    }
}

#[derive(Debug, Deserialize)]
pub struct ManualEvaluationRequest {
    pub question_id: String,
    pub obtained_marks: f64,
    pub remarks: Option<String>,
}

pub async fn evaluate_paper(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(eval_payload): Json<Vec<ManualEvaluationRequest>>,
) -> (StatusCode, Json<ExamEngineResponse>) {
    // Only Admin or Center can evaluate
    if claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
        && claims.role != UserRole::Center
    {
        return (
            StatusCode::FORBIDDEN,
            Json(ExamEngineResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let p_oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid Paper ID".to_string(),
                }),
            );
        }
    };
    let paper_coll = db.collection::<StudentPaper>("student_papers");
    let q_bank_coll = db.collection::<QBQuestion>("qb_questions");

    let mut paper = match paper_coll.find_one(doc! { "_id": p_oid }, None).await {
        Ok(Some(p)) => p,
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Paper not found".to_string(),
                }),
            );
        }
    };

    let mut total_score = 0.0;
    let mut section_scores: std::collections::HashMap<String, f64> =
        std::collections::HashMap::new();

    for q_mapping in &mut paper.questions {
        let question = match q_bank_coll
            .find_one(doc! { "_id": q_mapping.question_id }, None)
            .await
        {
            Ok(Some(q)) => q,
            _ => continue,
        };

        if question.question_type == "MCQ" {
            // Auto-evaluate MCQ
            if let Some(student_ans) = &q_mapping.student_response {
                let mut is_correct = false;

                // 1. Try to parse as index
                if let Ok(resp_idx) = student_ans.parse::<i32>() {
                    if resp_idx == question.correct_option_index {
                        is_correct = true;
                    }
                }

                // 2. Try direct text comparison
                if !is_correct {
                    if let Some(correct_opt_text) =
                        question.options.get(question.correct_option_index as usize)
                    {
                        if student_ans.trim().to_lowercase()
                            == correct_opt_text.trim().to_lowercase()
                        {
                            is_correct = true;
                        }
                    }
                }

                // 3. Try options_pool
                if !is_correct {
                    if let Some(pool) = &question.options_pool {
                        if let Some(correct_id) = &question.correct_option_id {
                            if let Some(correct_opt) = pool
                                .iter()
                                .find(|o| o.get("id").and_then(|i| i.as_str()) == Some(correct_id))
                            {
                                let correct_text = correct_opt
                                    .get("text")
                                    .and_then(|t| t.as_str())
                                    .unwrap_or("");
                                if student_ans.trim().to_lowercase()
                                    == correct_text.trim().to_lowercase()
                                    || student_ans == correct_id
                                {
                                    is_correct = true;
                                }
                            }
                        }
                    }
                }

                if is_correct {
                    q_mapping.obtained_marks = question.marks;
                } else {
                    q_mapping.obtained_marks = 0.0;
                }
            }
            q_mapping.evaluation_status = "Evaluated".to_string();
        } else {
            // Manual evaluation for Theory/Practical
            if let Some(eval) = eval_payload
                .iter()
                .find(|e| e.question_id == q_mapping.question_id.to_hex())
            {
                q_mapping.obtained_marks = eval.obtained_marks;
                q_mapping.evaluator_remarks = eval.remarks.clone();
                q_mapping.evaluation_status = "Evaluated".to_string();
            }
        }

        total_score += q_mapping.obtained_marks;
        let section_entry = section_scores
            .entry(q_mapping.section_id.clone())
            .or_insert(0.0);
        *section_entry += q_mapping.obtained_marks;
    }

    paper.total_obtained_marks = total_score;
    paper.section_wise_marks = section_scores;
    paper.status = "Evaluated".to_string();

    // Set pass/fail status based on blueprint minimum marks for each component
    let blueprint_coll = db.collection::<ExamBlueprint>("exam_blueprints");
    if let Ok(Some(bp)) = blueprint_coll
        .find_one(doc! { "_id": paper.blueprint_id }, None)
        .await
    {
        if let Some(comp) = &bp.components {
            // Check individual component passes
            // Note: Practical and Assignment marks are usually entered via a separate process or admin UI,
            // here we calculate the exam portion and aggregate everything.

            // 1. Exam Portion Pass Check
            paper.exam_passed = Some(total_score >= comp.exam_min_marks);

            // 2. Practical/Assignment (if enabled)
            // For now, we assume they are passed if enabled and marks >= min.
            // If they are not yet entered, they might be 0.
            // paper.practical_passed = Some(practical_marks >= comp.practical_min_marks);

            // Overall Pass: Must pass all enabled components
            let mut overall_pass = total_score >= comp.exam_min_marks;

            // If practical is enabled, we'd check practical marks too...
            // For this specific paper/attempt, we focus on the Exam portion.
            paper.is_passed = Some(overall_pass);
        } else {
            paper.is_passed = Some(total_score >= bp.minimum_marks);
        }
    }

    // Sync marks to user ERP for automatic marksheet generation
    let student_oid = paper.student_id;
    let user_coll = db.collection::<crate::models::user::User>("users");

    let mut subject_marks = Vec::new();
    // Group marks by subject_id from paper questions
    let mut subj_map: std::collections::HashMap<String, (f64, f64)> =
        std::collections::HashMap::new();

    for q_mapping in &paper.questions {
        if let Ok(Some(q)) = q_bank_coll
            .find_one(doc! { "_id": q_mapping.question_id }, None)
            .await
        {
            if let Some(sid) = q.subject_id {
                let sid_hex = sid.to_hex();
                let entry = subj_map.entry(sid_hex).or_insert((0.0, 0.0));
                entry.0 += q_mapping.obtained_marks;
                entry.1 += q.marks;
            }
        }
    }

    for (subj_id, (obtained, total)) in subj_map {
        // Try to get subject name from subjects collection if exists, else use ID
        let subj_name = match db
            .collection::<mongodb::bson::Document>("subjects")
            .find_one(
                doc! { "_id": ObjectId::parse_str(&subj_id).unwrap_or_default() },
                None,
            )
            .await
        {
            Ok(Some(s)) => s
                .get_str("name")
                .unwrap_or(s.get_str("subject_name").unwrap_or(&subj_id))
                .to_string(),
            _ => subj_id,
        };

        subject_marks.push(crate::models::user::SubjectMarks {
            subject: subj_name,
            marks: obtained,
            total,
        });
    }

    if !subject_marks.is_empty() {
        let _ = user_coll.update_one(
            doc! { "_id": student_oid },
            doc! { "$set": { "marks": mongodb::bson::to_bson(&subject_marks).unwrap_or(mongodb::bson::Bson::Null) } },
            None
        ).await;
        println!("DEBUG: Synced exam marks to user ERP for {}", student_oid);
    }

    match paper_coll
        .replace_one(doc! { "_id": p_oid }, paper, None)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(ExamEngineResponse {
                success: true,
                message: "Paper evaluated successfully".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ExamEngineResponse {
                success: false,
                message: "Evaluation failed".to_string(),
            }),
        ),
    }
}

#[derive(Debug, Deserialize)]
pub struct PostponeExamRequest {
    pub paper_ids: Vec<String>,
    #[serde(default)]
    pub days: i64,
    pub new_date: Option<String>,
    pub reason: Option<String>,
}

pub async fn postpone_allotted_exams(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<PostponeExamRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin && claims.role != UserRole::Center {
        return (StatusCode::FORBIDDEN, Json(serde_json::json!({ "success": false, "message": "Unauthorized" })));
    }

    if payload.paper_ids.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "message": "No paper IDs provided" })));
    }

    let coll = db.collection::<StudentPaper>("student_papers");
    let mut updated_count = 0;

    for pid in &payload.paper_ids {
        if let Ok(oid) = ObjectId::parse_str(pid) {
            if let Ok(Some(paper)) = coll.find_one(doc! { "_id": oid }, None).await {
                let new_start: Option<mongodb::bson::DateTime> = if let Some(ref nd) = payload.new_date {
                    if let Ok(d) = chrono::NaiveDate::parse_from_str(nd, "%Y-%m-%d") {
                        let dt = d.and_hms_opt(9, 0, 0).unwrap_or_default();
                        Some(mongodb::bson::DateTime::from_millis(dt.and_utc().timestamp_millis()))
                    } else {
                        paper.start_window
                    }
                } else if payload.days > 0 {
                    paper.start_window.map(|sw| {
                        mongodb::bson::DateTime::from_millis(sw.timestamp_millis() + payload.days * 86_400_000)
                    })
                } else {
                    paper.start_window
                };

                let new_end: Option<mongodb::bson::DateTime> = if let Some(ref nd) = payload.new_date {
                    if let Ok(d) = chrono::NaiveDate::parse_from_str(nd, "%Y-%m-%d") {
                        let dt = d.and_hms_opt(21, 0, 0).unwrap_or_default();
                        Some(mongodb::bson::DateTime::from_millis(dt.and_utc().timestamp_millis()))
                    } else {
                        paper.end_window
                    }
                } else if payload.days > 0 {
                    paper.end_window.map(|ew| {
                        mongodb::bson::DateTime::from_millis(ew.timestamp_millis() + payload.days * 86_400_000)
                    })
                } else {
                    paper.end_window
                };

                let mut update_doc = doc! {};
                if let Some(ns) = new_start {
                    update_doc.insert("start_window", ns);
                }
                if let Some(ne) = new_end {
                    update_doc.insert("end_window", ne);
                }
                if let Some(ref r) = payload.reason {
                    update_doc.insert("postpone_reason", r);
                }

                if !update_doc.is_empty() {
                    if coll.update_one(doc! { "_id": oid }, doc! { "$set": update_doc }, None).await.is_ok() {
                        updated_count += 1;
                    }
                }
            }
        }
    }

    (StatusCode::OK, Json(serde_json::json!({
        "success": true,
        "message": format!("Successfully postponed {} exam papers", updated_count),
        "updated_count": updated_count
    })))
}

#[derive(Debug, Deserialize)]
pub struct QuestionFeedbackRequest {
    pub feedback_type: String,
    pub comment: String,
}

pub async fn report_question_feedback(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<QuestionFeedbackRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    let coll = db.collection::<mongodb::bson::Document>("exam_question_feedback");
    let mut doc = doc! {
        "question_id": id.clone(),
        "student_id": claims.sub.clone(),
        "feedback_type": payload.feedback_type,
        "comment": payload.comment,
        "status": "Pending",
        "created_at": mongodb::bson::DateTime::now(),
    };
    if let Ok(qid) = ObjectId::parse_str(&id) {
        doc.insert("question_id", qid);
    }
    if let Ok(sid) = ObjectId::parse_str(&claims.sub) {
        doc.insert("student_id", sid);
    }
    match coll.insert_one(doc, None).await {
        Ok(_) => (StatusCode::CREATED, Json(serde_json::json!({ "success": true, "message": "Feedback submitted successfully" }))),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "message": "Failed to submit feedback" }))),
    }
}

pub async fn list_question_feedback(
    State(db): State<Database>,
    _claims: Claims,
) -> (StatusCode, Json<Vec<serde_json::Value>>) {
    let coll = db.collection::<mongodb::bson::Document>("exam_question_feedback");
    let find_opts = mongodb::options::FindOptions::builder()
        .sort(doc! { "created_at": -1 })
        .build();
    let mut cur = match coll.find(None, find_opts).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };
    let mut list = Vec::new();
    while let Some(res) = cur.next().await {
        if let Ok(doc) = res {
            let mut val = serde_json::to_value(&doc).unwrap_or_default();
            if let Some(obj) = val.as_object_mut() {
                for key in &["_id", "question_id", "student_id"] {
                    if let Some(v) = obj.get(*key) {
                        if let Some(oid_str) = v.get("$oid").and_then(|s| s.as_str()) {
                            obj.insert((*key).to_string(), serde_json::Value::String(oid_str.to_string()));
                        }
                    }
                }
            }
            list.push(val);
        }
    }
    (StatusCode::OK, Json(list))
}

#[derive(Debug, Deserialize)]
pub struct UpdateFeedbackStatusRequest {
    pub status: String,
}

pub async fn update_question_feedback_status(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<UpdateFeedbackStatusRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin && claims.role != UserRole::Center {
        return (StatusCode::FORBIDDEN, Json(serde_json::json!({ "success": false, "message": "Unauthorized" })));
    }
    let coll = db.collection::<mongodb::bson::Document>("exam_question_feedback");
    let filter = if let Ok(oid) = ObjectId::parse_str(&id) {
        doc! { "_id": oid }
    } else {
        doc! { "_id": id.clone() }
    };
    match coll.update_one(filter, doc! { "$set": { "status": payload.status } }, None).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({ "success": true, "message": "Feedback status updated" }))),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "message": "Failed to update feedback status" }))),
    }
}
