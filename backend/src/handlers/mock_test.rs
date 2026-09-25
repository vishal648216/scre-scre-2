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
    if !matches!(claims.role, UserRole::Admin | UserRole::SuperAdmin | UserRole::Center | UserRole::Staff) {
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
    if !matches!(claims.role, UserRole::Admin | UserRole::SuperAdmin | UserRole::Center | UserRole::Staff) {
        return (StatusCode::FORBIDDEN, Json(vec![]));
    }

    let mut filter = doc! {};
    if let Some(cid) = &q.course_id {
        if let Ok(oid) = ObjectId::parse_str(cid) {
            filter.insert("course_id", oid);
        } else if !cid.trim().is_empty() {
            filter.insert("course_id", cid.trim());
        }
    }

    let coll = db.collection::<mongodb::bson::Document>("mock_tests");
    let mut cursor = match coll.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut out = Vec::new();
    while let Some(res) = cursor.next().await {
        if let Ok(doc) = res {
            let id = doc
                .get_object_id("_id")
                .map(|o| o.to_hex())
                .or_else(|_| doc.get_str("id").map(|s| s.to_string()))
                .unwrap_or_default();
            if id.is_empty() {
                continue;
            }

            let name = doc.get_str("name").unwrap_or("").to_string();
            let course_id = doc
                .get_object_id("course_id")
                .map(|o| o.to_hex())
                .or_else(|_| doc.get_str("course_id").map(|s| s.to_string()))
                .unwrap_or_default();
            let subject_id = doc
                .get_object_id("subject_id")
                .map(|o| o.to_hex())
                .or_else(|_| doc.get_str("subject_id").map(|s| s.to_string()))
                .unwrap_or_default();
            let blueprint_id = doc
                .get_object_id("blueprint_id")
                .map(|o| o.to_hex())
                .or_else(|_| doc.get_str("blueprint_id").map(|s| s.to_string()))
                .unwrap_or_default();
            let status = doc.get_str("status").unwrap_or("active").to_string();

            let created_at = doc
                .get_datetime("created_at")
                .map(|dt| chrono::DateTime::<Utc>::from(dt.to_chrono()))
                .unwrap_or_else(|_| Utc::now());

            out.push(MockTestListItem {
                id,
                name,
                course_id,
                subject_id,
                blueprint_id,
                status,
                created_at,
            });
        }
    }
    (StatusCode::OK, Json(out))
}

pub async fn update_mock_test(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<MockTestUpdateRequest>,
) -> (StatusCode, Json<ExamEngineResponse>) {
    if !matches!(claims.role, UserRole::Admin | UserRole::SuperAdmin | UserRole::Center | UserRole::Staff) {
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
    if !matches!(claims.role, UserRole::Admin | UserRole::SuperAdmin | UserRole::Center | UserRole::Staff) {
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

#[derive(Debug, Deserialize)]
pub struct BulkItemsPayload {
    pub items: Vec<serde_json::Value>,
}

pub async fn bulk_create_mock_tests(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<BulkItemsPayload>,
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

    let created_by = match ObjectId::parse_str(&claims.sub) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ExamEngineResponse {
                    success: false,
                    message: "Invalid user session".to_string(),
                }),
            )
        }
    };

    let coll = db.collection::<MockTest>("mock_tests");
    let courses_coll = db.collection::<Course>("courses");
    let subjects_coll = db.collection::<crate::models::subject::Subject>("subjects");
    let blueprints_coll = db.collection::<ExamBlueprint>("exam_blueprints");
    let course_subjects_coll = db.collection::<CourseSubject>("course_subjects");

    let mut docs = Vec::new();
    let now = Utc::now();

    for mut item in payload.items {
        if let Some(obj) = item.as_object_mut() {
            let name = obj
                .get("name")
                .or_else(|| obj.get("mock_test_name"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim()
                .to_string();
            if name.is_empty() {
                continue;
            }

            let course_id_str = obj
                .get("course_id")
                .or_else(|| obj.get("course"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim();
            let subject_id_str = obj
                .get("subject_id")
                .or_else(|| obj.get("subject"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim();
            let blueprint_id_str = obj
                .get("blueprint_id")
                .or_else(|| obj.get("blueprint"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim();
            let status_str = obj
                .get("status")
                .and_then(|v| v.as_str())
                .unwrap_or("active");

            // 1. Resolve course_oid
            let course_oid = match ObjectId::parse_str(course_id_str) {
                Ok(o) => o,
                Err(_) => {
                    // Search course by name, code, or short_code
                    let filter = doc! {
                        "$or": [
                            { "course_name": { "$regex": course_id_str, "$options": "i" } },
                            { "course_code": course_id_str },
                            { "short_code": course_id_str },
                        ]
                    };
                    if let Ok(Some(c)) = courses_coll.find_one(filter, None).await {
                        c.id.unwrap_or_else(ObjectId::new)
                    } else if let Ok(Some(c)) = courses_coll.find_one(doc! {}, None).await {
                        c.id.unwrap_or_else(ObjectId::new)
                    } else {
                        continue;
                    }
                }
            };

            // 2. Resolve subject_oid
            let subject_oid = match ObjectId::parse_str(subject_id_str) {
                Ok(o) => o,
                Err(_) => {
                    let filter = doc! {
                        "$or": [
                            { "subject_name": { "$regex": subject_id_str, "$options": "i" } },
                            { "subject_code": subject_id_str },
                        ]
                    };
                    if let Ok(Some(s)) = subjects_coll.find_one(filter, None).await {
                        s.id.unwrap_or_else(ObjectId::new)
                    } else if let Ok(Some(cs)) = course_subjects_coll
                        .find_one(doc! { "course_id": course_oid }, None)
                        .await
                    {
                        cs.subject_id
                    } else if let Ok(Some(s)) = subjects_coll.find_one(doc! {}, None).await {
                        s.id.unwrap_or_else(ObjectId::new)
                    } else {
                        continue;
                    }
                }
            };

            // Ensure course-subject mapping exists so student start works
            let mapping_exists = course_subjects_coll
                .find_one(
                    doc! { "course_id": course_oid, "subject_id": subject_oid },
                    None,
                )
                .await
                .ok()
                .flatten()
                .is_some();

            if !mapping_exists {
                let _ = course_subjects_coll
                    .insert_one(
                        CourseSubject {
                            id: None,
                            course_id: course_oid,
                            subject_id: subject_oid,
                            subject_order: 1,
                        },
                        None,
                    )
                    .await;
            }

            // 3. Resolve blueprint_oid
            let blueprint_oid = match ObjectId::parse_str(blueprint_id_str) {
                Ok(o) => o,
                Err(_) => {
                    let filter = doc! {
                        "course_id": course_oid,
                        "name": { "$regex": blueprint_id_str, "$options": "i" }
                    };
                    if let Ok(Some(b)) = blueprints_coll.find_one(filter, None).await {
                        b.id.unwrap_or_else(ObjectId::new)
                    } else if let Ok(Some(b)) = blueprints_coll
                        .find_one(doc! { "course_id": course_oid }, None)
                        .await
                    {
                        b.id.unwrap_or_else(ObjectId::new)
                    } else {
                        // Auto-create blueprint for this course if none exists
                        let new_bp = ExamBlueprint {
                            id: None,
                            category_id: None,
                            course_id: course_oid,
                            session_id: None,
                            bank_id: None,
                            reappear_bank_id: None,
                            subject_id: None,
                            name: format!("Default Mock Blueprint - {}", name),
                            total_marks: 100.0,
                            minimum_marks: 40.0,
                            duration_minutes: 60,
                            total_duration_minutes: 60,
                            max_attempts: 5,
                            instructions: Some("Answer all questions.".to_string()),
                            mode: "Flex".to_string(),
                            exam_mode: Some("Computer Based Test (CBT)".to_string()),
                            practical_enabled: false,
                            assignment_enabled: false,
                            components: None,
                            allow_bank_override: false,
                            rules: vec![],
                            sections: vec![],
                            require_attendance: false,
                            subjects: vec![],
                            created_by: Some(created_by),
                            created_at: Some(mongodb::bson::DateTime::now()),
                            default_blueprint: true,
                            exam_pattern: None,
                            term_number: None,
                        };
                        match blueprints_coll.insert_one(new_bp, None).await {
                            Ok(res) => res.inserted_id.as_object_id().unwrap_or_else(ObjectId::new),
                            Err(_) => continue,
                        }
                    }
                }
            };

            docs.push(MockTest {
                id: None,
                name,
                course_id: course_oid,
                subject_id: subject_oid,
                blueprint_id: blueprint_oid,
                status: if status_str == "inactive" {
                    "inactive".to_string()
                } else {
                    "active".to_string()
                },
                created_by,
                created_at: now,
            });
        }
    }

    if docs.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ExamEngineResponse {
                success: false,
                message: "No valid mock test records could be parsed from the CSV.".to_string(),
            }),
        );
    }

    let count = docs.len();
    match coll.insert_many(docs, None).await {
        Ok(_) => (
            StatusCode::CREATED,
            Json(ExamEngineResponse {
                success: true,
                message: format!("Successfully imported {} mock tests!", count),
            }),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ExamEngineResponse {
                success: false,
                message: format!("Bulk insert failed: {}", e),
            }),
        ),
    }
}
