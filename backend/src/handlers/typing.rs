use axum::{extract::{State, Query}, http::StatusCode, Json};
use mongodb::{Database, bson::{doc, oid::ObjectId}, options::FindOptions};
use serde::{Deserialize, Serialize};
use crate::handlers::course::resolve_course_from_enrollment_string;
use crate::models::user::{UserRole, Claims, User};
use crate::models::typing::{TypingLanguage, TypingLesson, TypingResult, TypingLevel, TypingMode, TypingStatus, TypingCertificate};
use chrono::{Utc, DateTime};
use futures_util::stream::StreamExt;
use std::collections::HashSet;

async fn student_allowed_typing_lesson_ids(db: &Database, student: &User) -> Option<HashSet<ObjectId>> {
    let course_str = student.course.as_deref()?.trim();
    if course_str.is_empty() {
        return None;
    }
    let course = resolve_course_from_enrollment_string(db, course_str).await?;
    if !course.typing_tests_enabled {
        return Some(HashSet::new());
    }
    let course_oid = course.id?;

    if !course.linked_typing_tests.is_empty() {
        return Some(course.linked_typing_tests.iter().cloned().collect());
    }

    let coll = db.collection::<mongodb::bson::Document>("course_typing_allotments");
    let doc = coll.find_one(doc! { "course_id": course_oid }, None).await.ok().flatten()?;
    let arr = doc.get_array("language_ids").ok()?;
    let lang_ids: Vec<ObjectId> = arr
        .iter()
        .filter_map(|v| v.as_object_id())
        .collect();
    if lang_ids.is_empty() {
        return Some(HashSet::new());
    }

    let lesson_coll = db.collection::<TypingLesson>("typing_lessons");
    let mut cursor = lesson_coll
        .find(
            doc! { "language_id": { "$in": lang_ids }, "active": true },
            None,
        )
        .await
        .ok()?;

    let mut ids = HashSet::new();
    while let Some(Ok(lesson)) = cursor.next().await {
        if let Some(id) = lesson.id {
            ids.insert(id);
        }
    }
    Some(ids)
}

#[derive(Debug, Deserialize)]
pub struct CreateLanguageRequest {
    pub name: String,
    pub code: String,
    pub font_family: Option<String>,
    pub keyboard_layout: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TypingResponse {
    pub success: bool,
    pub message: String,
}

pub async fn create_language(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateLanguageRequest>,
) -> (StatusCode, Json<TypingResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(TypingResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let collection = db.collection::<TypingLanguage>("typing_languages");
    
    if let Ok(Some(_)) = collection.find_one(doc! { "code": &payload.code }, None).await {
        return (StatusCode::CONFLICT, Json(TypingResponse { success: false, message: "Language code already exists".to_string() }));
    }

    let new_lang = TypingLanguage {
        id: None,
        name: payload.name,
        code: payload.code,
        font_family: payload.font_family,
        keyboard_layout: payload.keyboard_layout,
        active: true,
    };

    match collection.insert_one(new_lang, None).await {
        Ok(_) => (StatusCode::CREATED, Json(TypingResponse { success: true, message: "Language added successfully".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(TypingResponse { success: false, message: "Failed to save language".to_string() })),
    }
}

pub async fn get_languages(
    State(db): State<Database>,
) -> (StatusCode, Json<Vec<TypingLanguage>>) {
    let collection = db.collection::<TypingLanguage>("typing_languages");
    let mut cursor = collection.find(doc! { "active": true }, None).await.expect("Failed to fetch languages");
    let mut languages = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(lang) = result {
            languages.push(lang);
        }
    }
    (StatusCode::OK, Json(languages))
}

#[derive(Debug, Deserialize)]
pub struct CreateLessonRequest {
    pub language_id: String,
    pub title: String,
    pub content: String,
    pub level: TypingLevel,
    pub min_wpm: Option<f64>,
    pub min_accuracy: Option<f64>,
}

pub async fn create_lesson(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateLessonRequest>,
) -> (StatusCode, Json<TypingResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(TypingResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let collection = db.collection::<TypingLesson>("typing_lessons");
    let lang_oid = match ObjectId::parse_str(&payload.language_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(TypingResponse { success: false, message: "Invalid Language ID".to_string() })),
    };

    let new_lesson = TypingLesson {
        id: None,
        language_id: lang_oid,
        title: payload.title,
        content: payload.content,
        level: payload.level,
        min_wpm: payload.min_wpm,
        min_accuracy: payload.min_accuracy,
        active: true,
        created_at: Utc::now(),
    };

    match collection.insert_one(new_lesson, None).await {
        Ok(_) => (StatusCode::CREATED, Json(TypingResponse { success: true, message: "Lesson added successfully".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(TypingResponse { success: false, message: "Failed to save lesson".to_string() })),
    }
}

pub async fn get_lessons(
    State(db): State<Database>,
    claims: Claims,
    Query(params): Query<LessonsQuery>,
) -> (StatusCode, Json<Vec<TypingLesson>>) {
    let collection = db.collection::<TypingLesson>("typing_lessons");

    let mut filter = doc! {};
    if let Some(lang_id) = params.language_id {
        let lang_oid = match ObjectId::parse_str(&lang_id) {
            Ok(oid) => oid,
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(vec![]),
                )
            }
        };
        filter.insert("language_id", lang_oid);
    }

    if let Some(active) = params.active {
        filter.insert("active", active);
    }

    let mut cursor = collection
        .find(filter, None)
        .await
        .expect("Failed to fetch lessons");
    let mut lessons = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(lesson) = result {
            lessons.push(lesson);
        }
    }

    if claims.role == UserRole::Student {
        let users_coll = db.collection::<User>("users");
        let student_oid = match ObjectId::parse_str(&claims.sub) {
            Ok(o) => o,
            Err(_) => return (StatusCode::OK, Json(vec![])),
        };
        let student = match users_coll.find_one(doc! { "_id": student_oid }, None).await {
            Ok(Some(u)) => u,
            _ => return (StatusCode::OK, Json(vec![])),
        };
        let allowed = match student_allowed_typing_lesson_ids(&db, &student).await {
            Some(a) => a,
            None => return (StatusCode::OK, Json(vec![])),
        };
        lessons.retain(|l| l.id.map(|id| allowed.contains(&id)).unwrap_or(false));
    }

    (StatusCode::OK, Json(lessons))
}

#[derive(Debug, Deserialize)]
pub struct LessonsQuery {
    pub language_id: Option<String>,
    pub active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SubmitTypingResult {
    pub lesson_id: String,
    pub mode: TypingMode,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub total_chars: u32,
    pub correct_chars: u32,
    pub incorrect_chars: u32,
    pub extra_chars: u32,
    pub raw_data: Option<String>, // Optional: store keystrokes for deep analysis
}

pub async fn get_typing_report(
    State(db): State<Database>,
    claims: Claims,
    Query(params): Query<mongodb::bson::Document>,
) -> (StatusCode, Json<Vec<serde_json::Value>>) {
    if claims.role != UserRole::Center && claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(vec![]));
    }

    let results_coll = db.collection::<TypingResult>("typing_results");
    let mut filter = params.clone();
    if claims.role == UserRole::Center {
        let center_oid = ObjectId::parse_str(&claims.sub).unwrap();
        filter.insert("center_id", center_oid);
    }

    let pipeline = vec![
        doc! { "$match": filter },
        doc! { "$lookup": {
            "from": "users",
            "localField": "student_id",
            "foreignField": "_id",
            "as": "student"
        }},
        doc! { "$unwind": "$student" },
        doc! { "$project": {
            "wpm": 1,
            "accuracy": 1,
            "created_at": 1,
            "mode": 1,
            "student_name": "$student.full_name",
            "course_name": "$student.course",
            "student_id": 1
        }},
        doc! { "$sort": { "created_at": -1 } }
    ];

    let mut cursor = match results_coll.aggregate(pipeline, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut results = vec![];
    while let Some(result) = cursor.next().await {
        if let Ok(doc) = result {
            results.push(serde_json::to_value(doc).unwrap());
        }
    }
    (StatusCode::OK, Json(results))
}

pub async fn delete_lesson(
    State(db): State<Database>,
    claims: Claims,
    ax_path: axum::extract::Path<String>,
) -> (StatusCode, Json<TypingResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(TypingResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let lesson_oid = match ObjectId::parse_str(&ax_path.0) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(TypingResponse { success: false, message: "Invalid Lesson ID".to_string() })),
    };

    let collection = db.collection::<TypingLesson>("typing_lessons");
    match collection.delete_one(doc! { "_id": lesson_oid }, None).await {
        Ok(_) => (StatusCode::OK, Json(TypingResponse { success: true, message: "Lesson deleted successfully".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(TypingResponse { success: false, message: "Failed to delete lesson".to_string() })),
    }
}

pub async fn toggle_lesson_status(
    State(db): State<Database>,
    claims: Claims,
    ax_path: axum::extract::Path<String>,
) -> (StatusCode, Json<TypingResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(TypingResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let lesson_oid = match ObjectId::parse_str(&ax_path.0) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(TypingResponse { success: false, message: "Invalid Lesson ID".to_string() })),
    };

    let collection = db.collection::<TypingLesson>("typing_lessons");
    let lesson = match collection.find_one(doc! { "_id": lesson_oid }, None).await {
        Ok(Some(l)) => l,
        _ => return (StatusCode::NOT_FOUND, Json(TypingResponse { success: false, message: "Lesson not found".to_string() })),
    };

    match collection.update_one(doc! { "_id": lesson_oid }, doc! { "$set": { "active": !lesson.active } }, None).await {
        Ok(_) => (StatusCode::OK, Json(TypingResponse { success: true, message: "Status updated".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(TypingResponse { success: false, message: "Update failed".to_string() })),
    }
}

pub async fn submit_typing_result(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<SubmitTypingResult>,
) -> (StatusCode, Json<TypingResponse>) {
    if claims.role != UserRole::Student {
        return (StatusCode::FORBIDDEN, Json(TypingResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let student_oid = ObjectId::parse_str(&claims.sub).unwrap();
    let users_coll = db.collection::<User>("users");
    let student = match users_coll.find_one(doc! { "_id": student_oid }, None).await {
        Ok(Some(u)) => u,
        _ => return (StatusCode::NOT_FOUND, Json(TypingResponse { success: false, message: "Student not found".to_string() })),
    };

    let center_id = student.parent_id.ok_or((StatusCode::BAD_REQUEST, Json(TypingResponse { success: false, message: "Center ID not found".to_string() })));
    let center_id = match center_id {
        Ok(id) => id,
        Err(e) => return e,
    };

    let lesson_oid = match ObjectId::parse_str(&payload.lesson_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(TypingResponse { success: false, message: "Invalid Lesson ID".to_string() })),
    };

    let lessons_coll = db.collection::<TypingLesson>("typing_lessons");
    let lesson = match lessons_coll.find_one(doc! { "_id": lesson_oid }, None).await {
        Ok(Some(l)) => l,
        _ => return (StatusCode::NOT_FOUND, Json(TypingResponse { success: false, message: "Lesson not found".to_string() })),
    };

    let allowed = match student_allowed_typing_lesson_ids(&db, &student).await {
        Some(a) => a,
        None => {
            return (
                StatusCode::FORBIDDEN,
                Json(TypingResponse {
                    success: false,
                    message: "Typing tests are not available for your course".to_string(),
                }),
            )
        }
    };
    if !allowed.contains(&lesson_oid) {
        return (
            StatusCode::FORBIDDEN,
            Json(TypingResponse {
                success: false,
                message: "This typing lesson is not assigned to your course".to_string(),
            }),
        );
    }

    let duration_sec = (payload.end_time - payload.start_time).num_seconds().max(1) as u32;
    
    // WPM Calculation: (total_chars / 5) / (duration_min)
    let wpm = (payload.total_chars as f64 / 5.0) / (duration_sec as f64 / 60.0);
    
    // Accuracy Calculation: (correct_chars / total_chars) * 100
    let accuracy = if payload.total_chars > 0 {
        (payload.correct_chars as f64 / payload.total_chars as f64) * 100.0
    } else {
        0.0
    };

    let is_passed = match (lesson.min_wpm, lesson.min_accuracy) {
        (Some(min_wpm), Some(min_acc)) => wpm >= min_wpm && accuracy >= min_acc,
        (Some(min_wpm), None) => wpm >= min_wpm,
        (None, Some(min_acc)) => accuracy >= min_acc,
        _ => true, // No criteria means pass by default
    };

    // Anti-cheat / Validation
    if wpm > 300.0 || accuracy > 100.0 || duration_sec < 5 {
        return (StatusCode::BAD_REQUEST, Json(TypingResponse { success: false, message: "Invalid result detected".to_string() }));
    }

    let results_coll = db.collection::<TypingResult>("typing_results");
    let attempt_no = (results_coll.count_documents(doc! { "student_id": student_oid, "lesson_id": lesson_oid }, None).await.unwrap_or(0) + 1) as u32;

    let new_result = TypingResult {
        id: None,
        student_id: student_oid,
        center_id,
        course_id: None, // Optional: pull from user if needed
        lesson_id: lesson_oid,
        language_id: lesson.language_id,
        mode: payload.mode,
        attempt_no,
        start_time: payload.start_time,
        end_time: payload.end_time,
        duration_sec,
        total_chars: payload.total_chars,
        correct_chars: payload.correct_chars,
        incorrect_chars: payload.incorrect_chars,
        extra_chars: payload.extra_chars,
        wpm,
        accuracy,
        is_passed,
        certificate_id: None,
        status: TypingStatus::Completed,
        created_at: Utc::now(),
    };

    let result_id = results_coll.insert_one(new_result.clone(), None).await.expect("Failed to save result").inserted_id.as_object_id().unwrap();

    // Generate Certificate if mode is Exam and it's passed
    if payload.mode == TypingMode::Exam && is_passed {
        let cert_coll = db.collection::<TypingCertificate>("typing_certificates");
        let lang_coll = db.collection::<TypingLanguage>("typing_languages");
        let lang = lang_coll.find_one(doc! { "_id": lesson.language_id }, None).await.unwrap_or(None);
        let lang_name = lang.map(|l| l.name).unwrap_or_else(|| "Unknown".to_string());

        let ts = Utc::now().format("%Y%m%d").to_string();
        let cert_no = format!("TYP-{}-{}-{}", ts, student.username.chars().take(4).collect::<String>(), result_id.to_hex().chars().take(4).collect::<String>());

        let cert = TypingCertificate {
            id: None,
            student_id: student_oid,
            center_id,
            result_id,
            certificate_no: cert_no,
            wpm,
            accuracy,
            language: lang_name,
            issued_on: Utc::now(),
        };

        if let Ok(inserted) = cert_coll.insert_one(cert, None).await {
            let cert_id = inserted.inserted_id.as_object_id();
            let _ = results_coll.update_one(doc! { "_id": result_id }, doc! { "$set": { "certificate_id": cert_id } }, None).await;
        }
    }

    (StatusCode::CREATED, Json(TypingResponse { success: true, message: "Typing result saved".to_string() }))
}

pub async fn get_typing_history(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<TypingResult>>) {
    let student_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
    };

    let collection = db.collection::<TypingResult>("typing_results");
    let find_options = FindOptions::builder().sort(doc! { "created_at": -1 }).build();
    let mut cursor = match collection.find(doc! { "student_id": student_oid }, find_options).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut results = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(res) = result {
            results.push(res);
        }
    }
    (StatusCode::OK, Json(results))
}

pub async fn get_leaderboard(
    State(db): State<Database>,
    Query(params): Query<mongodb::bson::Document>,
) -> (StatusCode, Json<Vec<serde_json::Value>>) {
    let collection = db.collection::<TypingResult>("typing_results");
    
    // Aggregation for leaderboard (only best WPM per student)
    let pipeline = vec![
        doc! { "$match": params },
        doc! { "$sort": { "wpm": -1 } },
        doc! { "$group": {
            "_id": "$student_id",
            "best_result": { "$first": "$$ROOT" }
        }},
        doc! { "$replaceRoot": { "newRoot": "$best_result" } },
        doc! { "$lookup": {
            "from": "users",
            "localField": "student_id",
            "foreignField": "_id",
            "as": "student"
        }},
        doc! { "$unwind": "$student" },
        doc! { "$project": {
            "wpm": 1,
            "accuracy": 1,
            "student_name": "$student.full_name",
            "student_id": 1
        }},
        doc! { "$sort": { "wpm": -1 } },
        doc! { "$limit": 50 }
    ];

    let mut cursor = match collection.aggregate(pipeline, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut results = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(doc) = result {
            results.push(serde_json::to_value(doc).unwrap());
        }
    }
    (StatusCode::OK, Json(results))
}

#[derive(Debug, Serialize)]
pub struct TypingAnalytics {
    pub date: String,
    pub avg_wpm: f64,
    pub avg_accuracy: f64,
    pub total_attempts: u32,
}

pub async fn get_typing_certificates(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<TypingCertificate>>) {
    let student_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
    };

    let collection = db.collection::<TypingCertificate>("typing_certificates");
    let mut cursor = match collection.find(doc! { "student_id": student_oid }, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut certs = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(cert) = result {
            certs.push(cert);
        }
    }
    (StatusCode::OK, Json(certs))
}

pub async fn get_typing_certificate_by_id(
    State(db): State<Database>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> (StatusCode, Json<Option<TypingCertificate>>) {
    let cert_oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(None)),
    };

    let collection = db.collection::<TypingCertificate>("typing_certificates");
    match collection.find_one(doc! { "_id": cert_oid }, None).await {
        Ok(cert) => (StatusCode::OK, Json(cert)),
        Err(_) => (StatusCode::NOT_FOUND, Json(None)),
    }
}

pub async fn get_typing_analytics(
    State(db): State<Database>,
    claims: Claims,
    Query(params): Query<mongodb::bson::Document>,
) -> (StatusCode, Json<Vec<TypingAnalytics>>) {
    let collection = db.collection::<TypingResult>("typing_results");
    
    let mut filter = params.clone();
    match claims.role {
        UserRole::Student => {
            filter.insert("student_id", ObjectId::parse_str(&claims.sub).unwrap());
        },
        UserRole::Center => {
            filter.insert("center_id", ObjectId::parse_str(&claims.sub).unwrap());
        },
        UserRole::Admin | UserRole::SuperAdmin => {},
        _ => return (StatusCode::FORBIDDEN, Json(vec![])),
    }

    let pipeline = vec![
        doc! { "$match": filter },
        doc! { "$group": {
            "_id": { "$dateToString": { "format": "%Y-%m-%d", "date": "$created_at" } },
            "avg_wpm": { "$avg": "$wpm" },
            "avg_accuracy": { "$avg": "$accuracy" },
            "total_attempts": { "$sum": 1 }
        }},
        doc! { "$sort": { "_id": 1 } }
    ];

    let mut cursor = match collection.aggregate(pipeline, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut analytics = vec![];
    while let Some(result) = cursor.next().await {
        if let Ok(doc) = result {
            analytics.push(TypingAnalytics {
                date: doc.get_str("_id").unwrap_or_default().to_string(),
                avg_wpm: doc.get_f64("avg_wpm").unwrap_or(0.0),
                avg_accuracy: doc.get_f64("avg_accuracy").unwrap_or(0.0),
                total_attempts: doc.get_i32("total_attempts").unwrap_or(0) as u32,
            });
        }
    }
    (StatusCode::OK, Json(analytics))
}
