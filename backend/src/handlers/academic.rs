use axum::{
    extract::{State, Path, Query},
    http::StatusCode,
    Json,
};
use mongodb::{Database, bson::{doc, oid::ObjectId}};
use serde::{Deserialize, Serialize};
use crate::authz::can_view_all_course_mappings;
use crate::models::user::{UserRole, Claims};
use crate::models::academic::*;
use chrono::{Utc, DateTime};
use futures_util::stream::StreamExt;

#[derive(Debug, Serialize)]
pub struct AcademicResponse {
    pub success: bool,
    pub message: String,
}

// --- Course Subject Mapping ---

#[derive(Debug, Deserialize)]
pub struct MapSubjectRequest {
    pub course_id: String,
    pub subject_id: String,
    pub subject_order: i32,
}

#[derive(Debug, Deserialize)]
pub struct BulkMapSubjectsToCourseRequest {
    pub course_id: String,
    pub subject_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct BulkMapCoursesToSubjectRequest {
    pub subject_id: String,
    pub course_ids: Vec<String>,
}

pub async fn bulk_map_subjects_to_course(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<BulkMapSubjectsToCourseRequest>,
) -> (StatusCode, Json<AcademicResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(AcademicResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let course_oid = match ObjectId::parse_str(&payload.course_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(AcademicResponse { success: false, message: "Invalid Course ID".to_string() })),
    };

    let coll = db.collection::<CourseSubject>("course_subjects");
    
    // Get existing mapping to determine starting order
    let existing_count = coll.count_documents(doc! { "course_id": course_oid }, None).await.unwrap_or(0);
    let mut current_order = (existing_count as i32) + 1;

    let mut new_mappings = Vec::new();
    for sub_id in payload.subject_ids {
        if let Ok(sub_oid) = ObjectId::parse_str(&sub_id) {
            // Check if already mapped
            if let Ok(None) = coll.find_one(doc! { "course_id": course_oid, "subject_id": sub_oid }, None).await {
                new_mappings.push(CourseSubject {
                    id: None,
                    course_id: course_oid,
                    subject_id: sub_oid,
                    subject_order: current_order,
                });
                current_order += 1;
            }
        }
    }

    if new_mappings.is_empty() {
        return (StatusCode::OK, Json(AcademicResponse { success: true, message: "No new subjects to map".to_string() }));
    }

    match coll.insert_many(new_mappings, None).await {
        Ok(_) => (StatusCode::CREATED, Json(AcademicResponse { success: true, message: "Subjects mapped successfully".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(AcademicResponse { success: false, message: "Bulk mapping failed".to_string() })),
    }
}

pub async fn bulk_map_courses_to_subject(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<BulkMapCoursesToSubjectRequest>,
) -> (StatusCode, Json<AcademicResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(AcademicResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let sub_oid = match ObjectId::parse_str(&payload.subject_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(AcademicResponse { success: false, message: "Invalid Subject ID".to_string() })),
    };

    let coll = db.collection::<CourseSubject>("course_subjects");
    let mut new_mappings = Vec::new();

    for course_id in payload.course_ids {
        if let Ok(course_oid) = ObjectId::parse_str(&course_id) {
            // Check if already mapped
            if let Ok(None) = coll.find_one(doc! { "course_id": course_oid, "subject_id": sub_oid }, None).await {
                // For bulk course mapping, we assign a default order (could be based on existing count for that course)
                let existing_count = coll.count_documents(doc! { "course_id": course_oid }, None).await.unwrap_or(0);
                new_mappings.push(CourseSubject {
                    id: None,
                    course_id: course_oid,
                    subject_id: sub_oid,
                    subject_order: (existing_count as i32) + 1,
                });
            }
        }
    }

    if new_mappings.is_empty() {
        return (StatusCode::OK, Json(AcademicResponse { success: true, message: "No new courses to map".to_string() }));
    }

    match coll.insert_many(new_mappings, None).await {
        Ok(_) => (StatusCode::CREATED, Json(AcademicResponse { success: true, message: "Courses mapped successfully".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(AcademicResponse { success: false, message: "Bulk mapping failed".to_string() })),
    }
}

pub async fn map_subject_to_course(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<MapSubjectRequest>,
) -> (StatusCode, Json<AcademicResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(AcademicResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let course_oid = match ObjectId::parse_str(&payload.course_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(AcademicResponse { success: false, message: "Invalid Course ID".to_string() })),
    };
    let sub_oid = match ObjectId::parse_str(&payload.subject_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(AcademicResponse { success: false, message: "Invalid Subject ID".to_string() })),
    };

    let coll = db.collection::<CourseSubject>("course_subjects");
    
    // Check if already mapped
    if let Ok(Some(_)) = coll.find_one(doc! { "course_id": course_oid, "subject_id": sub_oid }, None).await {
        return (StatusCode::CONFLICT, Json(AcademicResponse { success: false, message: "Subject already mapped to this course".to_string() }));
    }

    let mapping = CourseSubject {
        id: None,
        course_id: course_oid,
        subject_id: sub_oid,
        subject_order: payload.subject_order,
    };

    match coll.insert_one(mapping, None).await {
        Ok(_) => (StatusCode::CREATED, Json(AcademicResponse { success: true, message: "Subject mapped to course".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(AcademicResponse { success: false, message: "Mapping failed".to_string() })),
    }
}

#[derive(Debug, Serialize)]
pub struct CourseSubjectListItem {
    pub id: String,
    pub course_id: String,
    pub subject_id: String,
    pub subject_order: i32,
}

pub async fn list_course_subjects(
    State(db): State<Database>,
    _claims: Claims,
    Path(course_id): Path<String>,
) -> (StatusCode, Json<Vec<CourseSubjectListItem>>) {
    let course_oid = match ObjectId::parse_str(&course_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
    };

    let coll = db.collection::<CourseSubject>("course_subjects");
    let mut cursor = coll.find(doc! { "course_id": course_oid }, None).await.expect("Failed to fetch mapping");
    let mut items = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(item) = result {
            items.push(CourseSubjectListItem {
                id: item.id.map(|id| id.to_hex()).unwrap_or_default(),
                course_id: item.course_id.to_hex(),
                subject_id: item.subject_id.to_hex(),
                subject_order: item.subject_order,
            });
        }
    }
    (StatusCode::OK, Json(items))
}

pub async fn list_subject_courses(
    State(db): State<Database>,
    _claims: Claims,
    Path(subject_id): Path<String>,
) -> (StatusCode, Json<Vec<CourseSubjectListItem>>) {
    let sub_oid = match ObjectId::parse_str(&subject_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
    };

    let coll = db.collection::<CourseSubject>("course_subjects");
    let mut cursor = coll.find(doc! { "subject_id": sub_oid }, None).await.expect("Failed to fetch mapping");
    let mut items = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(item) = result {
            items.push(CourseSubjectListItem {
                id: item.id.map(|id| id.to_hex()).unwrap_or_default(),
                course_id: item.course_id.to_hex(),
                subject_id: item.subject_id.to_hex(),
                subject_order: item.subject_order,
            });
        }
    }
    (StatusCode::OK, Json(items))
}

pub async fn list_all_course_subjects(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<CourseSubjectListItem>>) {
    if !can_view_all_course_mappings(&claims) {
        return (StatusCode::FORBIDDEN, Json(Vec::new()));
    }
    let coll = db.collection::<CourseSubject>("course_subjects");
    let mut cursor = coll.find(doc! {}, None).await.expect("Failed to fetch all mappings");
    let mut items = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(item) = result {
            items.push(CourseSubjectListItem {
                id: item.id.map(|id| id.to_hex()).unwrap_or_default(),
                course_id: item.course_id.to_hex(),
                subject_id: item.subject_id.to_hex(),
                subject_order: item.subject_order,
            });
        }
    }
    (StatusCode::OK, Json(items))
}

pub async fn delete_course_subject_mapping(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<AcademicResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(AcademicResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(AcademicResponse { success: false, message: "Invalid ID".to_string() })),
    };

    let coll = db.collection::<CourseSubject>("course_subjects");
    match coll.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => (StatusCode::OK, Json(AcademicResponse { success: true, message: "Mapping deleted".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(AcademicResponse { success: false, message: "Delete failed".to_string() })),
    }
}

// --- Sessions ---

#[derive(Debug, Deserialize)]
pub struct CreateSessionRequest {
    pub course_id: String,
    pub session_name: String,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub status: Option<String>,
}

pub async fn create_session(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateSessionRequest>,
) -> (StatusCode, Json<AcademicResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(AcademicResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let course_oid = match ObjectId::parse_str(&payload.course_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(AcademicResponse { success: false, message: "Invalid Course ID".to_string() })),
    };

    let coll = db.collection::<Session>("sessions");
    
    // Parse comma-separated session names
    let session_names: Vec<String> = payload.session_name
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    if session_names.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(AcademicResponse { success: false, message: "Session name(s) required".to_string() }));
    }

    // If setting as active, deactivate others for THIS course
    let status = payload.status.unwrap_or_else(|| "active".to_string());
    if status == "active" {
        let _ = coll.update_many(doc! { "course_id": course_oid, "status": "active" }, doc! { "$set": { "status": "archived" } }, None).await;
    }

    let now = Utc::now();
    let mut created_count = 0;

    for name in session_names {
        // Check if name exists for this course
        if let Ok(Some(_)) = coll.find_one(doc! { "course_id": course_oid, "session_name": &name }, None).await {
            continue; // Skip duplicates
        }

        let session = Session {
            id: None,
            course_id: course_oid,
            session_name: name,
            start_date: payload.start_date.unwrap_or(now),
            end_date: payload.end_date.unwrap_or(now + chrono::Duration::days(365)),
            status: status.clone(),
        };

        if let Ok(_) = coll.insert_one(session, None).await {
            created_count += 1;
        }
    }

    if created_count > 0 {
        (StatusCode::CREATED, Json(AcademicResponse { success: true, message: format!("{} session(s) created", created_count) }))
    } else {
        (StatusCode::OK, Json(AcademicResponse { success: true, message: "No new sessions created (duplicates)".to_string() }))
    }
}

pub async fn update_session(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<CreateSessionRequest>,
) -> (StatusCode, Json<AcademicResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(AcademicResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(AcademicResponse { success: false, message: "Invalid Session ID".to_string() })),
    };

    let course_oid = match ObjectId::parse_str(&payload.course_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(AcademicResponse { success: false, message: "Invalid Course ID".to_string() })),
    };

    let coll = db.collection::<Session>("sessions");
    
    // Get existing session first to preserve start/end dates if not provided
    let existing = match coll.find_one(doc! { "_id": oid }, None).await {
        Ok(Some(s)) => s,
        _ => return (StatusCode::NOT_FOUND, Json(AcademicResponse { success: false, message: "Session not found".to_string() })),
    };

    // If setting as active, deactivate others for THIS course
    let status = payload.status.unwrap_or(existing.status);
    if status == "active" {
        let _ = coll.update_many(
            doc! { "course_id": course_oid, "status": "active", "_id": { "$ne": oid } }, 
            doc! { "$set": { "status": "archived" } }, 
            None
        ).await;
    }

    let update_doc = doc! {
        "$set": {
            "course_id": course_oid,
            "session_name": payload.session_name,
            "start_date": payload.start_date.unwrap_or(existing.start_date),
            "end_date": payload.end_date.unwrap_or(existing.end_date),
            "status": status,
        }
    };

    match coll.update_one(doc! { "_id": oid }, update_doc, None).await {
        Ok(_) => (StatusCode::OK, Json(AcademicResponse { success: true, message: "Session updated".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(AcademicResponse { success: false, message: "Update failed".to_string() })),
    }
}

pub async fn delete_session(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<AcademicResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(AcademicResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(AcademicResponse { success: false, message: "Invalid Session ID".to_string() })),
    };

    let coll = db.collection::<Session>("sessions");
    match coll.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => (StatusCode::OK, Json(AcademicResponse { success: true, message: "Session deleted".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(AcademicResponse { success: false, message: "Delete failed".to_string() })),
    }
}

#[derive(Debug, Serialize)]
pub struct SessionListItem {
    pub id: String,
    pub course_id: String,
    pub session_name: String,
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
    pub status: String,
}

pub async fn list_sessions(
    State(db): State<Database>,
    _claims: Claims,
) -> (StatusCode, Json<Vec<SessionListItem>>) {
    let coll = db.collection::<Session>("sessions");
    
    let mut cursor = coll.find(None, None).await.expect("Failed to fetch sessions");
    let mut items = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(item) = result {
            items.push(SessionListItem {
                id: item.id.map(|id| id.to_hex()).unwrap_or_default(),
                course_id: item.course_id.to_hex(),
                session_name: item.session_name,
                start_date: item.start_date,
                end_date: item.end_date,
                status: item.status,
            });
        }
    }
    (StatusCode::OK, Json(items))
}

// --- Study Material ---

#[derive(Debug, Deserialize)]
pub struct CreateMaterialRequest {
    pub subject_id: String,
    pub title: String,
    pub description: Option<String>,
    pub file_url: String,
    pub class_level: Option<String>,
    pub media_type: Option<String>,
    pub chapter_name: Option<String>,
}

pub async fn upload_study_material(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateMaterialRequest>,
) -> (StatusCode, Json<AcademicResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(AcademicResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let sub_oid = match ObjectId::parse_str(&payload.subject_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(AcademicResponse { success: false, message: "Invalid Subject ID".to_string() })),
    };

    let uploaded_by = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(AcademicResponse { success: false, message: "Invalid User ID".to_string() })),
    };

    let coll = db.collection::<StudyMaterial>("study_materials");
    let material = StudyMaterial {
        id: None,
        subject_id: sub_oid,
        title: payload.title,
        description: payload.description,
        file_url: payload.file_url,
        uploaded_by,
        class_level: payload.class_level,
        media_type: payload.media_type,
        chapter_name: payload.chapter_name,
        created_at: Utc::now(),
    };

    match coll.insert_one(material, None).await {
        Ok(_) => (StatusCode::CREATED, Json(AcademicResponse { success: true, message: "Study material uploaded".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(AcademicResponse { success: false, message: "Upload failed".to_string() })),
    }
}

#[derive(Debug, Serialize)]
pub struct StudyMaterialListItem {
    pub id: String,
    pub subject_id: String,
    pub title: String,
    pub description: Option<String>,
    pub file_url: String,
    pub uploaded_by: String,
    pub class_level: Option<String>,
    pub media_type: Option<String>,
    pub chapter_name: Option<String>,
    pub created_at: DateTime<Utc>,
}

pub async fn list_study_materials(
    State(db): State<Database>,
    _claims: Claims,
    Query(q): Query<serde_json::Value>,
) -> (StatusCode, Json<Vec<StudyMaterialListItem>>) {
    let coll = db.collection::<StudyMaterial>("study_materials");
    let mut filter = doc! {};
    if let Some(sub_id) = q.get("subject_id").and_then(|v| v.as_str()) {
        if let Ok(oid) = ObjectId::parse_str(sub_id) {
            filter.insert("subject_id", oid);
        }
    }
    if let Some(cl) = q.get("class_level").and_then(|v| v.as_str()) {
        filter.insert("class_level", cl);
    }
    if let Some(mt) = q.get("media_type").and_then(|v| v.as_str()) {
        filter.insert("media_type", mt);
    }

    let mut cursor = coll.find(filter, None).await.expect("Failed to fetch materials");
    let mut items = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(item) = result {
            items.push(StudyMaterialListItem {
                id: item.id.map(|id| id.to_hex()).unwrap_or_default(),
                subject_id: item.subject_id.to_hex(),
                title: item.title,
                description: item.description,
                file_url: item.file_url,
                uploaded_by: item.uploaded_by.to_hex(),
                class_level: item.class_level,
                media_type: item.media_type,
                chapter_name: item.chapter_name,
                created_at: item.created_at,
            });
        }
    }
    (StatusCode::OK, Json(items))
}

#[derive(Debug, Deserialize)]
pub struct BulkSessionPayload {
    pub items: Vec<CreateSessionRequest>,
}

pub async fn bulk_create_sessions(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<BulkSessionPayload>,
) -> (StatusCode, Json<AcademicResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(AcademicResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let coll = db.collection::<Session>("sessions");
    let now = Utc::now();
    let mut count = 0;

    for item in payload.items {
        if item.session_name.trim().is_empty() {
            continue;
        }
        let course_oid = match ObjectId::parse_str(&item.course_id) {
            Ok(oid) => oid,
            Err(_) => continue,
        };

        let session = Session {
            id: None,
            course_id: course_oid,
            session_name: item.session_name.trim().to_string(),
            start_date: item.start_date.unwrap_or(now),
            end_date: item.end_date.unwrap_or(now + chrono::Duration::days(365)),
            status: item.status.unwrap_or_else(|| "active".to_string()),
        };

        if let Ok(_) = coll.insert_one(session, None).await {
            count += 1;
        }
    }

    (StatusCode::CREATED, Json(AcademicResponse {
        success: true,
        message: format!("Successfully imported {} sessions!", count),
    }))
}

