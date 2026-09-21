use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use mongodb::{
    bson::{doc, oid::ObjectId},
    options::FindOneOptions,
    Database,
};
use serde::{Deserialize, Serialize};

use crate::handlers::course::resolve_course_from_enrollment_string;
use crate::handlers::exam_engine::{insert_generated_student_paper, ExamEngineResponse};
use crate::models::academic::CourseSubject;
use crate::models::center::Center;
use crate::models::course::Course;
use crate::models::exam_engine::{ExamBlueprint, StudentPaper};
use crate::models::mock_test::MockTest;
use crate::models::user::{Claims, User, UserRole};
use chrono::NaiveDate;
use futures_util::stream::StreamExt;

fn center_mock_error_message(center: &Center) -> Option<String> {
    let cfg = center.config_validity.as_ref()?;
    if !cfg.mock_test_enabled {
        return Some("Mock tests are not enabled for your center.".to_string());
    }
    let now = chrono::Utc::now().naive_utc().date();
    if let Some(ref start_str) = cfg.mock_test_start_date {
        if let Ok(start_dt) = NaiveDate::parse_from_str(start_str, "%Y-%m-%d") {
            if now < start_dt {
                return Some(format!("Mock tests will be available from {}.", start_str));
            }
        }
    }
    if let Some(ref end_str) = cfg.mock_test_end_date {
        if let Ok(end_dt) = NaiveDate::parse_from_str(end_str, "%Y-%m-%d") {
            if now > end_dt {
                return Some("Mock test subscription has expired for your center.".to_string());
            }
        }
    }
    None
}

#[derive(Debug, Deserialize)]
pub struct MockTestCreateRequest {
    pub name: String,
    pub course_id: String,
    pub subject_id: String,
    pub blueprint_id: String,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MockTestUpdateRequest {
    pub name: Option<String>,
    pub course_id: Option<String>,
    pub subject_id: Option<String>,
    pub blueprint_id: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MockTestListQuery {
    pub course_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MockTestListItem {
    pub id: String,
    pub name: String,
    pub course_id: String,
    pub subject_id: String,
    pub blueprint_id: String,
    pub status: String,
    pub created_at: chrono::DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct EligibleMockTestItem {
    pub mock_test_id: String,
    pub name: String,
    pub course_id: String,
    pub subject_id: String,
    pub blueprint_id: String,
    pub blueprint_name: String,
    pub duration_minutes: i32,
    pub max_attempts: i32,
    pub paper_id: Option<String>,
    pub paper_status: Option<String>,
    pub attempt_number: Option<i32>,
    pub can_start_new: bool,
}

#[derive(Debug, Serialize)]
pub struct StartMockResponse {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paper_id: Option<String>,
}

async fn validate_course_subject_mapping(db: &Database, course_id: ObjectId, subject_id: ObjectId) -> bool {
    let coll = db.collection::<CourseSubject>("course_subjects");
    coll
        .find_one(doc! { "course_id": course_id, "subject_id": subject_id }, None)
        .await
        .ok()
        .flatten()
        .is_some()
}

/// Admin: create mock test mapping (course + subject → v1 blueprint).
pub async fn create_mock_test(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<MockTestCreateRequest>,
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

    let course_id = match ObjectId::parse_str(&payload.course_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid course_id".to_string(),
                }),
            )
        }
    };
    let subject_id = match ObjectId::parse_str(&payload.subject_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid subject_id".to_string(),
                }),
            )
        }
    };
    let blueprint_id = match ObjectId::parse_str(&payload.blueprint_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid blueprint_id".to_string(),
                }),
            )
        }
    };

    if !validate_course_subject_mapping(&db, course_id, subject_id).await {
        return (
            StatusCode::BAD_REQUEST,
            Json(ExamEngineResponse {
                success: false,
                message: "Subject is not mapped to this course. Map it in course–subjects first.".to_string(),
            }),
        );
    }

    let bp_coll = db.collection::<ExamBlueprint>("exam_blueprints");
    let blueprint = match bp_coll.find_one(doc! { "_id": blueprint_id }, None).await {
        Ok(Some(b)) => b,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Blueprint not found".to_string(),
                }),
            )
        }
    };

    if blueprint.course_id != course_id {
        return (
            StatusCode::BAD_REQUEST,
            Json(ExamEngineResponse {
                success: false,
                message: "Blueprint belongs to a different course. Pick a blueprint for this course.".to_string(),
            }),
        );
    }

    let created_by = match ObjectId::parse_str(&claims.sub) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid user".to_string(),
                }),
            )
        }
    };

    let status = payload
        .status
        .unwrap_or_else(|| "active".to_string());
    let status = if status == "inactive" {
        "inactive".to_string()
    } else {
        "active".to_string()
    };

    let doc = MockTest {
        id: None,
        name: payload.name.trim().to_string(),
        course_id,
        subject_id,
        blueprint_id,
        status,
        created_by,
        created_at: Utc::now(),
    };

    let coll = db.collection::<MockTest>("mock_tests");
    match coll.insert_one(doc, None).await {
        Ok(_) => (
            StatusCode::CREATED,
            Json(ExamEngineResponse {
                success: true,
                message: "Mock test created".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ExamEngineResponse {
                success: false,
                message: "Failed to save mock test".to_string(),
            }),
        ),
    }
}

pub async fn list_mock_tests_admin(
    State(db): State<Database>,
    claims: Claims,
    Query(q): Query<MockTestListQuery>,
) -> (StatusCode, Json<Vec<MockTestListItem>>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(vec![]));
    }

    let mut filter = doc! {};
    if let Some(cid) = &q.course_id {
        if let Ok(oid) = ObjectId::parse_str(cid) {
            filter.insert("course_id", oid);
        }
    }

    let coll = db.collection::<MockTest>("mock_tests");
    let mut cursor = match coll.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut out = Vec::new();
    while let Some(Ok(mt)) = cursor.next().await {
        let id = match mt.id {
            Some(i) => i.to_hex(),
            None => continue,
        };
        out.push(MockTestListItem {
            id,
            name: mt.name,
            course_id: mt.course_id.to_hex(),
            subject_id: mt.subject_id.to_hex(),
            blueprint_id: mt.blueprint_id.to_hex(),
            status: mt.status,
            created_at: mt.created_at,
        });
    }
    (StatusCode::OK, Json(out))
}

pub async fn update_mock_test(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<MockTestUpdateRequest>,
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

    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid id".to_string(),
                }),
            )
        }
    };

    let mut set = doc! {};
    if let Some(n) = payload.name {
        set.insert("name", n.trim().to_string());
    }
    let mut new_course = None;
    if let Some(ref s) = payload.course_id {
        if let Ok(c) = ObjectId::parse_str(s) {
            set.insert("course_id", c);
            new_course = Some(c);
        }
    }
    let mut new_subject = None;
    if let Some(ref s) = payload.subject_id {
        if let Ok(sid) = ObjectId::parse_str(s) {
            set.insert("subject_id", sid);
            new_subject = Some(sid);
        }
    }
    if let Some(ref s) = payload.blueprint_id {
        if let Ok(b) = ObjectId::parse_str(s) {
            set.insert("blueprint_id", b);
        }
    }
    if let Some(st) = payload.status {
        let st = if st == "inactive" {
            "inactive".to_string()
        } else {
            "active".to_string()
        };
        set.insert("status", st);
    }

    if set.is_empty() {
        return (
            StatusCode::OK,
            Json(ExamEngineResponse {
                success: true,
                message: "Nothing to update".to_string(),
            }),
        );
    }

    let coll = db.collection::<MockTest>("mock_tests");
    if new_course.is_some() || new_subject.is_some() {
        let cur = match coll.find_one(doc! { "_id": oid }, None).await {
            Ok(Some(m)) => m,
            _ => {
                return (
                    StatusCode::NOT_FOUND,
                    Json(ExamEngineResponse {
                        success: false,
                        message: "Mock test not found".to_string(),
                    }),
                )
            }
        };
        let c = new_course.unwrap_or(cur.course_id);
        let s = new_subject.unwrap_or(cur.subject_id);
        if !validate_course_subject_mapping(&db, c, s).await {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Subject is not mapped to this course.".to_string(),
                }),
            );
        }
    }

    match coll
        .update_one(doc! { "_id": oid }, doc! { "$set": set }, None)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(ExamEngineResponse {
                success: true,
                message: "Updated".to_string(),
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

pub async fn delete_mock_test(
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

    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid id".to_string(),
                }),
            )
        }
    };

    let coll = db.collection::<MockTest>("mock_tests");
    match coll.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => (
            StatusCode::OK,
            Json(ExamEngineResponse {
                success: true,
                message: "Deleted".to_string(),
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

/// Student: mock tests for enrolled course + curriculum subjects (course must have mock_tests_enabled).
pub async fn list_eligible_mock_tests_for_student(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<EligibleMockTestItem>>) {
    if claims.role != UserRole::Student {
        return (StatusCode::FORBIDDEN, Json(vec![]));
    }

    let student_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(vec![])),
    };

    let users_coll = db.collection::<User>("users");
    let student = match users_coll.find_one(doc! { "_id": student_oid }, None).await {
        Ok(Some(u)) => u,
        _ => return (StatusCode::OK, Json(vec![])),
    };

    let course_str = match student.course.as_deref() {
        Some(s) if !s.is_empty() => s,
        _ => return (StatusCode::OK, Json(vec![])),
    };

    let course = match resolve_course_from_enrollment_string(&db, course_str).await {
        Some(c) => c,
        None => return (StatusCode::OK, Json(vec![])),
    };

    if !course.mock_tests_enabled {
        return (StatusCode::OK, Json(vec![]));
    }

    let course_oid = match course.id {
        Some(i) => i,
        None => return (StatusCode::OK, Json(vec![])),
    };

    let center_login_id = match student.parent_id {
        Some(p) => p,
        None => return (StatusCode::OK, Json(vec![])),
    };

    let center_coll = db.collection::<Center>("centers");
    let center = match center_coll
        .find_one(doc! { "user_id": center_login_id }, None)
        .await
    {
        Ok(Some(c)) => c,
        _ => return (StatusCode::OK, Json(vec![])),
    };

    if center_mock_error_message(&center).is_some() {
        return (StatusCode::OK, Json(vec![]));
    }

    let cs_coll = db.collection::<CourseSubject>("course_subjects");
    let mut sub_cursor = match cs_coll.find(doc! { "course_id": course_oid }, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut subject_ids: Vec<ObjectId> = Vec::new();
    while let Some(Ok(m)) = sub_cursor.next().await {
        subject_ids.push(m.subject_id);
    }

    if subject_ids.is_empty() {
        return (StatusCode::OK, Json(vec![]));
    }

    let mt_coll = db.collection::<MockTest>("mock_tests");
    let filter = if !course.linked_mock_tests.is_empty() {
        // If course has explicit linked mock tests, only show those
        doc! {
            "_id": { "$in": &course.linked_mock_tests },
            "status": "active"
        }
    } else {
        // Fallback to subject-based mapping
        doc! {
            "course_id": course_oid,
            "subject_id": { "$in": subject_ids },
            "status": "active"
        }
    };

    let mut mt_cursor = match mt_coll.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let bp_coll = db.collection::<ExamBlueprint>("exam_blueprints");
    let paper_coll = db.collection::<StudentPaper>("student_papers");

    let mut items = Vec::new();

    while let Some(Ok(mt)) = mt_cursor.next().await {
        let mt_id = match mt.id {
            Some(i) => i.to_hex(),
            None => continue,
        };

        let blueprint = match bp_coll
            .find_one(doc! { "_id": mt.blueprint_id }, None)
            .await
        {
            Ok(Some(b)) => b,
            _ => continue,
        };

        let attempts = match paper_coll
            .count_documents(
                doc! { "student_id": student_oid, "blueprint_id": mt.blueprint_id },
                None,
            )
            .await
        {
            Ok(n) => n as i32,
            Err(_) => 0,
        };

        let opts = FindOneOptions::builder()
            .sort(doc! { "attempt_number": -1 })
            .build();
        let latest = paper_coll
            .find_one(
                doc! { "student_id": student_oid, "blueprint_id": mt.blueprint_id },
                opts,
            )
            .await
            .ok()
            .flatten();

        let mut paper_id = None;
        let mut paper_status = None;
        let mut attempt_number = None;
        let mut has_open = false;

        if let Some(ref p) = latest {
            paper_id = p.id.map(|i| i.to_hex());
            paper_status = Some(p.status.clone());
            attempt_number = Some(p.attempt_number);
            if p.status == "Generated" || p.status == "InProgress" {
                has_open = true;
            }
        }

        let can_start_new = !has_open && attempts < blueprint.max_attempts;

        items.push(EligibleMockTestItem {
            mock_test_id: mt_id,
            name: mt.name,
            course_id: mt.course_id.to_hex(),
            subject_id: mt.subject_id.to_hex(),
            blueprint_id: mt.blueprint_id.to_hex(),
            blueprint_name: blueprint.name.clone(),
            duration_minutes: blueprint.duration_minutes,
            max_attempts: blueprint.max_attempts,
            paper_id,
            paper_status,
            attempt_number,
            can_start_new,
        });
    }

    (StatusCode::OK, Json(items))
}

/// Student: generate a new attempt for an eligible mock test.
pub async fn start_mock_test_for_student(
    State(db): State<Database>,
    claims: Claims,
    Path(mock_id): Path<String>,
) -> (StatusCode, Json<StartMockResponse>) {
    if claims.role != UserRole::Student {
        return (
            StatusCode::FORBIDDEN,
            Json(StartMockResponse {
                success: false,
                message: "Only students can start mock tests".to_string(),
                paper_id: None,
            }),
        );
    }

    let student_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(StartMockResponse {
                    success: false,
                    message: "Invalid session".to_string(),
                    paper_id: None,
                }),
            )
        }
    };

    let mt_oid = match ObjectId::parse_str(&mock_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(StartMockResponse {
                    success: false,
                    message: "Invalid mock test id".to_string(),
                    paper_id: None,
                }),
            )
        }
    };

    let users_coll = db.collection::<User>("users");
    let student = match users_coll.find_one(doc! { "_id": student_oid }, None).await {
        Ok(Some(u)) => u,
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(StartMockResponse {
                    success: false,
                    message: "Student not found".to_string(),
                    paper_id: None,
                }),
            )
        }
    };

    let center_login_id = match student.parent_id {
        Some(p) => p,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(StartMockResponse {
                    success: false,
                    message: "Center not linked to your account".to_string(),
                    paper_id: None,
                }),
            )
        }
    };

    let center_coll = db.collection::<Center>("centers");
    let center = match center_coll
        .find_one(doc! { "user_id": center_login_id }, None)
        .await
    {
        Ok(Some(c)) => c,
        _ => {
            return (
                StatusCode::FORBIDDEN,
                Json(StartMockResponse {
                    success: false,
                    message: "Center not found".to_string(),
                    paper_id: None,
                }),
            )
        }
    };

    if let Some(msg) = center_mock_error_message(&center) {
        return (
            StatusCode::FORBIDDEN,
            Json(StartMockResponse {
                success: false,
                message: msg,
                paper_id: None,
            }),
        );
    }

    let course_str = match student.course.as_deref() {
        Some(s) if !s.is_empty() => s,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(StartMockResponse {
                    success: false,
                    message: "No course on your profile".to_string(),
                    paper_id: None,
                }),
            )
        }
    };

    let course: Course = match resolve_course_from_enrollment_string(&db, course_str).await {
        Some(c) => c,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(StartMockResponse {
                    success: false,
                    message: "Course not found for your profile".to_string(),
                    paper_id: None,
                }),
            )
        }
    };

    if !course.mock_tests_enabled {
        return (
            StatusCode::FORBIDDEN,
            Json(StartMockResponse {
                success: false,
                message: "Mock tests are not enabled for your course".to_string(),
                paper_id: None,
            }),
        );
    }

    let course_oid = match course.id {
        Some(i) => i,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(StartMockResponse {
                    success: false,
                    message: "Invalid course record".to_string(),
                    paper_id: None,
                }),
            )
        }
    };

    let mt_coll = db.collection::<MockTest>("mock_tests");
    let mt = match mt_coll.find_one(doc! { "_id": mt_oid }, None).await {
        Ok(Some(m)) => m,
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(StartMockResponse {
                    success: false,
                    message: "Mock test not found".to_string(),
                    paper_id: None,
                }),
            )
        }
    };

    if mt.status != "active" {
        return (
            StatusCode::BAD_REQUEST,
            Json(StartMockResponse {
                success: false,
                message: "This mock test is inactive".to_string(),
                paper_id: None,
            }),
        );
    }

    if mt.course_id != course_oid {
        return (
            StatusCode::FORBIDDEN,
            Json(StartMockResponse {
                success: false,
                message: "This mock test is not for your enrolled course".to_string(),
                paper_id: None,
            }),
        );
    }

    if !validate_course_subject_mapping(&db, mt.course_id, mt.subject_id).await {
        return (
            StatusCode::BAD_REQUEST,
            Json(StartMockResponse {
                success: false,
                message: "Curriculum mapping is missing for this mock test".to_string(),
                paper_id: None,
            }),
        );
    }

    let cs_coll = db.collection::<CourseSubject>("course_subjects");
    let in_curriculum = cs_coll
        .find_one(
            doc! { "course_id": course_oid, "subject_id": mt.subject_id },
            None,
        )
        .await
        .ok()
        .flatten()
        .is_some();

    if !in_curriculum {
        return (
            StatusCode::FORBIDDEN,
            Json(StartMockResponse {
                success: false,
                message: "This subject is not part of your course curriculum".to_string(),
                paper_id: None,
            }),
        );
    }

    let bp_coll = db.collection::<ExamBlueprint>("exam_blueprints");
    if bp_coll
        .find_one(doc! { "_id": mt.blueprint_id }, None)
        .await
        .ok()
        .flatten()
        .is_none()
    {
        return (
            StatusCode::BAD_REQUEST,
            Json(StartMockResponse {
                success: false,
                message: "Blueprint missing".to_string(),
                paper_id: None,
            }),
        );
    }

    let paper_coll = db.collection::<StudentPaper>("student_papers");
    let opts = FindOneOptions::builder()
        .sort(doc! { "attempt_number": -1 })
        .build();
    if let Ok(Some(p)) = paper_coll
        .find_one(
            doc! { "student_id": student_oid, "blueprint_id": mt.blueprint_id },
            opts,
        )
        .await
    {
        if p.status == "Generated" || p.status == "InProgress" {
            return (
                StatusCode::BAD_REQUEST,
                Json(StartMockResponse {
                    success: false,
                    message: "You already have an open attempt. Continue from My Examinations.".to_string(),
                    paper_id: p.id.map(|i| i.to_hex()),
                }),
            );
        }
    }

    match insert_generated_student_paper(
        &db,
        mt.blueprint_id,
        student_oid,
        center_login_id,
        None,
        None,
        Some(mt.subject_id),
        false,
        None,
        None,
        None,
        false,
        1,
    )
    .await
    {
        Ok(pid) => (
            StatusCode::CREATED,
            Json(StartMockResponse {
                success: true,
                message: "Paper generated".to_string(),
                paper_id: Some(pid.to_hex()),
            }),
        ),
        Err((code, eng)) => (
            code,
            Json(StartMockResponse {
                success: false,
                message: eng.message,
                paper_id: None,
            }),
        ),
    }
}
