use crate::db::get_next_sequence;
use crate::models::academic::Session;
use crate::models::course::{AllottedCourse, Course};
use crate::models::user::{Claims, UserRole};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use chrono::{DateTime, Utc};
use futures_util::stream::StreamExt;
use mongodb::{
    Database,
    bson::{Bson, doc, oid::ObjectId},
};
use serde::{Deserialize, Serialize};

/// Match a student's `user.course` string (name or ObjectId hex) to a `Course` document.
pub async fn resolve_course_from_enrollment_string(
    db: &Database,
    course_name_or_id: &str,
) -> Option<Course> {
    let course_coll = db.collection::<Course>("courses");
    let mut filter = doc! {
        "course_name": { "$regex": format!("^{}$", regex::escape(course_name_or_id)), "$options": "i" }
    };
    if let Ok(oid) = ObjectId::parse_str(course_name_or_id) {
        filter = doc! {
            "$or": [
                { "course_name": { "$regex": format!("^{}$", regex::escape(course_name_or_id)), "$options": "i" } },
                { "_id": oid }
            ]
        };
    }
    course_coll.find_one(filter, None).await.ok().flatten()
}

fn months_from_duration(value: u32, unit: &str) -> u32 {
    match unit {
        "years" => value.saturating_mul(12),
        "weeks" => {
            if value == 0 {
                0
            } else {
                ((value as f64 / 4.34).ceil() as u32).max(1)
            }
        }
        "days" => {
            if value == 0 {
                0
            } else {
                ((value as f64 / 30.0).ceil() as u32).max(1)
            }
        }
        "hours" => {
            // Hours don't translate well to months, but we'll use 1 month as minimum if any hours exist
            if value > 0 { 1 } else { 0 }
        }
        _ => value,
    }
}

fn parse_oid_list(ids: Option<Vec<String>>) -> Vec<ObjectId> {
    ids.unwrap_or_default()
        .into_iter()
        .filter_map(|s| ObjectId::parse_str(s.trim()).ok())
        .collect()
}

#[derive(Debug, Deserialize)]
pub struct CreateCourseRequest {
    #[serde(alias = "categoryId")]
    pub category_id: String,
    pub course_name: String,
    pub course_code: Option<String>,
    pub short_code: Option<String>,
    pub duration_months: Option<u32>,
    pub duration_value: Option<u32>,
    pub duration_unit: Option<String>,
    pub course_type: Option<String>,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub og_image_url: Option<String>,
    pub syllabus: Option<String>,
    pub fees: Option<i32>,
    pub registration_fee: Option<i32>,
    pub exam_fees_applicable: Option<bool>,
    pub exam_fee_amount: Option<i32>,
    pub backlog_fees_applicable: Option<bool>,
    pub backlog_fee_amount: Option<i32>,
    #[serde(alias = "hasCourseStructureUnits")]
    pub has_course_structure_units: Option<bool>,
    #[serde(alias = "unitType")]
    pub unit_type: Option<String>,
    #[serde(alias = "unitCount")]
    pub unit_count: Option<u32>,
    #[serde(alias = "customUnitName")]
    pub custom_unit_name: Option<String>,
    pub eligibility: Option<String>,
    pub status: Option<String>,
    pub featured_on_home: Option<bool>,
    pub home_feature_order: Option<u32>,
    pub linked_typing_tests: Option<Vec<String>>,
    pub linked_mock_tests: Option<Vec<String>>,
    pub typing_tests_enabled: Option<bool>,
    pub mock_tests_enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCourseRequest {
    #[serde(alias = "categoryId")]
    pub category_id: Option<String>,
    pub course_name: Option<String>,
    pub course_code: Option<String>,
    pub short_code: Option<String>,
    pub duration_months: Option<u32>,
    pub duration_value: Option<u32>,
    pub duration_unit: Option<String>,
    pub course_type: Option<String>,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub og_image_url: Option<String>,
    pub syllabus: Option<String>,
    pub fees: Option<i32>,
    pub registration_fee: Option<i32>,
    pub exam_fees_applicable: Option<bool>,
    pub exam_fee_amount: Option<i32>,
    pub backlog_fees_applicable: Option<bool>,
    pub backlog_fee_amount: Option<i32>,
    #[serde(alias = "hasCourseStructureUnits")]
    pub has_course_structure_units: Option<bool>,
    #[serde(alias = "unitType")]
    pub unit_type: Option<String>,
    #[serde(alias = "unitCount")]
    pub unit_count: Option<u32>,
    #[serde(alias = "customUnitName")]
    pub custom_unit_name: Option<String>,
    pub eligibility: Option<String>,
    pub status: Option<String>,
    pub featured_on_home: Option<bool>,
    pub home_feature_order: Option<u32>,
    pub linked_typing_tests: Option<Vec<String>>,
    pub linked_mock_tests: Option<Vec<String>>,
    pub typing_tests_enabled: Option<bool>,
    pub mock_tests_enabled: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct CourseResponse {
    pub success: bool,
    pub message: String,
}

use crate::services::translation_service::{get_translation, normalize_lang};

#[derive(Debug, Deserialize, Default)]
pub struct CourseQuery {
    pub category_id: Option<String>,
    pub status: Option<String>,
    pub featured_on_home: Option<bool>,
    pub search: Option<String>,
    pub lang: Option<String>,
}

pub async fn create_course(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateCourseRequest>,
) -> (StatusCode, Json<CourseResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(CourseResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let cat_oid = match ObjectId::parse_str(&payload.category_id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(CourseResponse {
                    success: false,
                    message: "Invalid Category ID".to_string(),
                }),
            );
        }
    };

    let collection = db.collection::<Course>("courses");

    // Check if course name exists
    if let Ok(Some(_)) = collection
        .find_one(doc! { "course_name": &payload.course_name }, None)
        .await
    {
        return (
            StatusCode::CONFLICT,
            Json(CourseResponse {
                success: false,
                message: "Course name already exists".to_string(),
            }),
        );
    }

    let mut course_code = if let Some(provided_code) = &payload.course_code {
        // Check if the provided course_code already exists
        if collection
            .find_one(doc! { "course_code": provided_code }, None)
            .await
            .unwrap_or(None)
            .is_some()
        {
            return (
                StatusCode::CONFLICT,
                Json(CourseResponse {
                    success: false,
                    message: format!("Course code '{}' is already in use", provided_code),
                }),
            );
        }
        provided_code.clone()
    } else {
        // Generate a new unique course code
        let mut next_seq = get_next_sequence(&db, "course_code").await;
        let mut gen_code = format!("CRS-{:04}", next_seq);

        let mut attempts = 0;
        while attempts < 20
            && collection
                .find_one(doc! { "course_code": &gen_code }, None)
                .await
                .unwrap_or(None)
                .is_some()
        {
            next_seq = get_next_sequence(&db, "course_code").await;
            gen_code = format!("CRS-{:04}", next_seq);
            attempts += 1;
        }

        if attempts >= 20 {
            gen_code = format!("CRS-U-{}", Utc::now().timestamp_millis());
        }
        gen_code
    };

    let featured_on = payload.featured_on_home.unwrap_or(false);
    let mut home_order = payload.home_feature_order.unwrap_or(0);
    if featured_on {
        let featured_count = collection
            .count_documents(doc! { "featured_on_home": true }, None)
            .await
            .unwrap_or(0);
        if featured_count >= 4 {
            return (
                StatusCode::BAD_REQUEST,
                Json(CourseResponse {
                    success: false,
                    message: "Maximum 4 courses can be featured on the home page".to_string(),
                }),
            );
        }
    } else {
        home_order = 0;
    }

    let duration_unit = payload
        .duration_unit
        .clone()
        .unwrap_or_else(|| "months".to_string());
    let unit_norm = match duration_unit.to_lowercase().as_str() {
        "years" => "years",
        "weeks" => "weeks",
        "days" => "days",
        "hours" => "hours",
        _ => "months",
    };
    let duration_value = payload.duration_value.unwrap_or(0);
    let duration_months = if duration_value > 0 {
        months_from_duration(duration_value, unit_norm)
    } else {
        payload.duration_months.unwrap_or(12).max(1)
    };
    let dur_val_store = if duration_value > 0 {
        duration_value
    } else {
        duration_months
    };
    let unit_store = if duration_value > 0 {
        unit_norm.to_string()
    } else {
        "months".to_string()
    };

    let ct_raw = payload
        .course_type
        .clone()
        .unwrap_or_else(|| "diploma".to_string());
    let ct_norm = match ct_raw.as_str() {
        "degree" | "diploma" | "crash_course" | "certification" => ct_raw,
        _ => "diploma".to_string(),
    };

    // Generate unique slug
    let timestamp = Utc::now().timestamp_millis();
    let base_slug = payload
        .course_name
        .to_lowercase()
        .replace(|c: char| !c.is_alphanumeric(), "-")
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    let mut slug = format!("{}-{}", base_slug, timestamp);

    // Double check slug uniqueness
    let mut slug_attempts = 0;
    while slug_attempts < 5
        && collection
            .find_one(doc! { "slug": &slug }, None)
            .await
            .unwrap_or(None)
            .is_some()
    {
        use rand::distributions::Alphanumeric;
        use rand::{Rng, thread_rng};
        let random_suffix: String = thread_rng()
            .sample_iter(&Alphanumeric)
            .take(5)
            .map(char::from)
            .collect();
        slug = format!(
            "{}-{}-{}",
            base_slug,
            timestamp,
            random_suffix.to_lowercase()
        );
        slug_attempts += 1;
    }

    // Handle short_code uniqueness
    let mut short_code = payload.short_code.unwrap_or_default();
    if short_code.is_empty() {
        // If empty, use the unique course_code as a fallback to avoid index collisions
        // This is safe because course_code is already strictly unique
        short_code = course_code.clone();
    } else {
        // If they provided one, we check for uniqueness manually to give a better error
        if collection
            .find_one(doc! { "short_code": &short_code }, None)
            .await
            .unwrap_or(None)
            .is_some()
        {
            return (
                StatusCode::CONFLICT,
                Json(CourseResponse {
                    success: false,
                    message: format!(
                        "Short code '{}' is already in use by another course",
                        short_code
                    ),
                }),
            );
        }
    }

    let has_struct = payload.has_course_structure_units.unwrap_or(false);
    let unit_type = if has_struct {
        payload.unit_type.as_ref().and_then(|s| {
            let t = s.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.to_string())
            }
        })
    } else {
        None
    };
    let unit_count = if has_struct { payload.unit_count } else { None };
    let custom_unit_name = if has_struct {
        payload.custom_unit_name.as_ref().and_then(|s| {
            let t = s.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.to_string())
            }
        })
    } else {
        None
    };

    let new_course = Course {
        id: None,
        category_id: cat_oid,
        course_name: payload.course_name,
        course_code,
        slug,
        short_code,
        duration_months,
        duration_value: dur_val_store,
        duration_unit: unit_store,
        course_type: ct_norm,
        description: payload.description,
        image_url: payload.image_url,
        og_image_url: payload.og_image_url,
        syllabus: payload.syllabus,
        fees: payload.fees,
        registration_fee: payload.registration_fee,
        exam_fees_applicable: payload.exam_fees_applicable.unwrap_or(false),
        exam_fee_amount: payload.exam_fee_amount,
        backlog_fees_applicable: payload.backlog_fees_applicable.unwrap_or(false),
        backlog_fee_amount: payload.backlog_fee_amount,
        has_course_structure_units: has_struct,
        unit_type,
        unit_count,
        custom_unit_name,
        eligibility: payload.eligibility,
        status: payload.status.unwrap_or_else(|| "active".to_string()),
        featured_on_home: featured_on,
        home_feature_order: home_order,
        typing_tests_enabled: payload.typing_tests_enabled.unwrap_or(false),
        mock_tests_enabled: payload.mock_tests_enabled.unwrap_or(false),
        linked_typing_tests: parse_oid_list(payload.linked_typing_tests),
        linked_mock_tests: parse_oid_list(payload.linked_mock_tests),
        created_at: Utc::now(),
    };

    match collection.insert_one(new_course, None).await {
        Ok(_) => (
            StatusCode::CREATED,
            Json(CourseResponse {
                success: true,
                message: "Course created successfully".to_string(),
            }),
        ),
        Err(e) => {
            let error_msg = format!("Database error: {}", e);
            eprintln!("COURSE_CREATE_ERROR: {}", error_msg);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(CourseResponse {
                    success: false,
                    message: format!("Failed to save course: {}", error_msg),
                }),
            )
        }
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct CourseListItem {
    pub id: String,
    pub category_id: String,
    pub course_name: String,
    pub course_code: String,
    pub slug: String,
    pub short_code: String,
    pub duration_months: u32,
    pub duration_value: u32,
    pub duration_unit: String,
    pub course_type: String,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub og_image_url: Option<String>,
    pub syllabus: Option<String>,
    pub fees: Option<i32>,
    pub registration_fee: Option<i32>,
    pub exam_fees_applicable: bool,
    pub exam_fee_amount: Option<i32>,
    pub backlog_fees_applicable: bool,
    pub backlog_fee_amount: Option<i32>,
    pub has_course_structure_units: bool,
    pub unit_type: Option<String>,
    pub unit_count: Option<u32>,
    pub custom_unit_name: Option<String>,
    pub eligibility: Option<String>,
    pub status: String,
    pub featured_on_home: bool,
    pub home_feature_order: u32,
    pub linked_typing_tests: Vec<String>,
    pub linked_mock_tests: Vec<String>,
    pub typing_tests_enabled: bool,
    pub mock_tests_enabled: bool,
    pub created_at: DateTime<Utc>,
}

fn course_to_list_item(course: Course) -> CourseListItem {
    let (dur_val, dur_unit) = if course.duration_value > 0 && !course.duration_unit.is_empty() {
        (course.duration_value, course.duration_unit.clone())
    } else {
        (course.duration_months, "months".to_string())
    };
    CourseListItem {
        id: course.id.map(|oid| oid.to_hex()).unwrap_or_default(),
        category_id: course.category_id.to_hex(),
        course_name: course.course_name,
        course_code: course.course_code,
        slug: course.slug,
        short_code: course.short_code,
        duration_months: course.duration_months,
        duration_value: dur_val,
        duration_unit: dur_unit,
        course_type: course.course_type,
        description: course.description,
        image_url: course.image_url,
        og_image_url: course.og_image_url,
        syllabus: course.syllabus,
        fees: course.fees,
        registration_fee: course.registration_fee,
        exam_fees_applicable: course.exam_fees_applicable,
        exam_fee_amount: course.exam_fee_amount,
        backlog_fees_applicable: course.backlog_fees_applicable,
        backlog_fee_amount: course.backlog_fee_amount,
        has_course_structure_units: course.has_course_structure_units,
        unit_type: course.unit_type,
        unit_count: course.unit_count,
        custom_unit_name: course.custom_unit_name,
        eligibility: course.eligibility,
        status: course.status,
        featured_on_home: course.featured_on_home,
        home_feature_order: course.home_feature_order,
        linked_typing_tests: course
            .linked_typing_tests
            .iter()
            .map(|o| o.to_hex())
            .collect(),
        linked_mock_tests: course
            .linked_mock_tests
            .iter()
            .map(|o| o.to_hex())
            .collect(),
        typing_tests_enabled: course.typing_tests_enabled,
        mock_tests_enabled: course.mock_tests_enabled,
        created_at: course.created_at,
    }
}

pub async fn fetch_courses_list(db: &Database, q: &CourseQuery) -> Vec<CourseListItem> {
    let collection = db.collection::<Course>("courses");
    let mut filter = doc! {};
    let lang = q.lang.as_ref().map(|l| normalize_lang(l));

    if let Some(cat_id) = &q.category_id {
        if let Ok(oid) = ObjectId::parse_str(cat_id) {
            filter.insert("category_id", oid);
        }
    }

    if let Some(status) = &q.status {
        filter.insert("status", status);
    }

    if let Some(featured) = q.featured_on_home {
        filter.insert("featured_on_home", featured);
    }

    if let Some(s) = &q.search {
        if !s.trim().is_empty() {
            let regex = mongodb::bson::Regex {
                pattern: s.clone(),
                options: "i".to_string(),
            };
            filter.insert(
                "$or",
                vec![
                    doc! { "course_name": { "$regex": regex.clone() } },
                    doc! { "course_code": { "$regex": regex } },
                ],
            );
        }
    }

    let mut cursor = collection
        .find(filter, None)
        .await
        .expect("Failed to fetch courses");
    let mut courses = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(course) = result {
            let mut item = course_to_list_item(course);
            if let Some(target_lang) = &lang {
                if target_lang != "en" {
                    item.course_name = get_translation(db, &item.course_name, target_lang)
                        .await
                        .unwrap_or(item.course_name);
                    if let Some(d) = item.description {
                        item.description =
                            Some(get_translation(db, &d, target_lang).await.unwrap_or(d));
                    }
                    if let Some(s) = item.syllabus {
                        item.syllabus =
                            Some(get_translation(db, &s, target_lang).await.unwrap_or(s));
                    }
                    if let Some(e) = item.eligibility {
                        item.eligibility =
                            Some(get_translation(db, &e, target_lang).await.unwrap_or(e));
                    }
                }
            }
            courses.push(item);
        }
    }
    courses
}

/// Public catalog (no auth) — use **`/api/public/courses`** only.
pub async fn get_public_courses(
    State(db): State<Database>,
    Query(q): Query<CourseQuery>,
) -> (StatusCode, Json<Vec<CourseListItem>>) {
    let courses = fetch_courses_list(&db, &q).await;
    (StatusCode::OK, Json(courses))
}

/// Single course for public detail pages (no auth).
pub async fn get_public_course_by_id(
    State(db): State<Database>,
    Path(id): Path<String>,
    Query(q): Query<CourseQuery>,
) -> Result<Json<CourseListItem>, (StatusCode, Json<CourseResponse>)> {
    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(CourseResponse {
                    success: false,
                    message: "Invalid Course ID".to_string(),
                }),
            ));
        }
    };
    let collection = db.collection::<Course>("courses");
    let course = match collection.find_one(doc! { "_id": oid }, None).await {
        Ok(Some(c)) => c,
        Ok(None) => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(CourseResponse {
                    success: false,
                    message: "Course not found".to_string(),
                }),
            ));
        }
        Err(_) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(CourseResponse {
                    success: false,
                    message: "Failed to fetch course".to_string(),
                }),
            ));
        }
    };

    let mut item = course_to_list_item(course);
    let lang = q
        .lang
        .as_ref()
        .map(|l| crate::services::translation_service::normalize_lang(l));

    if let Some(target_lang) = &lang {
        if target_lang != "en" {
            item.course_name = crate::services::translation_service::get_translation(
                &db,
                &item.course_name,
                target_lang,
            )
            .await
            .unwrap_or(item.course_name);
            if let Some(d) = item.description {
                item.description = Some(
                    crate::services::translation_service::get_translation(&db, &d, target_lang)
                        .await
                        .unwrap_or(d),
                );
            }
            if let Some(s) = item.syllabus {
                item.syllabus = Some(
                    crate::services::translation_service::get_translation(&db, &s, target_lang)
                        .await
                        .unwrap_or(s),
                );
            }
            if let Some(e) = item.eligibility {
                item.eligibility = Some(
                    crate::services::translation_service::get_translation(&db, &e, target_lang)
                        .await
                        .unwrap_or(e),
                );
            }
        }
    }

    Ok(Json(item))
}

/// Authenticated course list — **`/api/courses` GET** (dashboards). Not exposed anonymously.
pub async fn get_courses(
    State(db): State<Database>,
    claims: Claims,
    Query(q): Query<CourseQuery>,
) -> (StatusCode, Json<Vec<CourseListItem>>) {
    let _ = claims; // validated by extractor
    let courses = fetch_courses_list(&db, &q).await;
    (StatusCode::OK, Json(courses))
}

pub async fn update_course(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<UpdateCourseRequest>,
) -> (StatusCode, Json<CourseResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(CourseResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(CourseResponse {
                    success: false,
                    message: "Invalid Course ID".to_string(),
                }),
            );
        }
    };

    let collection = db.collection::<Course>("courses");
    let mut set = doc! {};
    if let Some(v) = payload.category_id {
        if let Ok(cat_oid) = ObjectId::parse_str(&v) {
            set.insert("category_id", cat_oid);
        }
    }
    if let Some(v) = payload.course_name {
        set.insert("course_name", v);
    }
    if let Some(v) = payload.course_code {
        // Check if the new course code is already used by another course
        let existing = collection
            .find_one(doc! { "course_code": &v, "_id": { "$ne": oid } }, None)
            .await
            .unwrap_or(None);
        if existing.is_some() {
            return (
                StatusCode::CONFLICT,
                Json(CourseResponse {
                    success: false,
                    message: format!("Course code '{}' is already in use by another course", v),
                }),
            );
        }
        set.insert("course_code", v);
    }
    if let Some(v) = payload.short_code {
        set.insert("short_code", v);
    }
    if let Some(v) = payload.description {
        set.insert("description", v);
    }
    if let Some(v) = payload.image_url {
        set.insert("image_url", v);
    }
    if let Some(v) = payload.og_image_url {
        set.insert("og_image_url", v);
    }
    if let Some(v) = payload.syllabus {
        set.insert("syllabus", v);
    }
    if let Some(v) = payload.fees {
        set.insert("fees", v);
    }
    if let Some(v) = payload.registration_fee {
        set.insert("registration_fee", v);
    }
    if let Some(v) = payload.exam_fees_applicable {
        set.insert("exam_fees_applicable", v);
    }
    if let Some(v) = payload.exam_fee_amount {
        set.insert("exam_fee_amount", v);
    }
    if let Some(v) = payload.backlog_fees_applicable {
        set.insert("backlog_fees_applicable", v);
    }
    if let Some(v) = payload.backlog_fee_amount {
        set.insert("backlog_fee_amount", v);
    }
    if let Some(v) = payload.has_course_structure_units {
        set.insert("has_course_structure_units", v);
    }
    let clearing_units = payload.has_course_structure_units == Some(false);
    if clearing_units {
        set.insert("unit_type", Bson::Null);
        set.insert("unit_count", Bson::Null);
        set.insert("custom_unit_name", Bson::Null);
    } else {
        if let Some(v) = payload.unit_type {
            let t = v.trim().to_string();
            if !t.is_empty() {
                set.insert("unit_type", t);
            }
        }
        if let Some(v) = payload.unit_count {
            set.insert("unit_count", v);
        }
        if let Some(v) = payload.custom_unit_name {
            let t = v.trim().to_string();
            if !t.is_empty() {
                set.insert("custom_unit_name", t);
            }
        }
    }
    if let Some(v) = payload.eligibility {
        set.insert("eligibility", v);
    }
    if let Some(v) = payload.status {
        set.insert("status", v);
    }

    if let Some(v) = payload.course_type {
        let ct_norm = match v.as_str() {
            "degree" | "diploma" | "crash_course" | "certification" => v,
            _ => "diploma".to_string(),
        };
        set.insert("course_type", ct_norm);
    }

    if payload.duration_value.is_some()
        || payload.duration_unit.is_some()
        || payload.duration_months.is_some()
    {
        if let Ok(Some(existing)) = collection.find_one(doc! { "_id": oid }, None).await {
            let dv = payload.duration_value.unwrap_or(existing.duration_value);
            let du = payload
                .duration_unit
                .clone()
                .unwrap_or_else(|| existing.duration_unit.clone());
            let unit_norm = match du.to_lowercase().as_str() {
                "years" => "years",
                "weeks" => "weeks",
                "days" => "days",
                "hours" => "hours",
                _ => "months",
            };
            let dm = if dv > 0 {
                months_from_duration(dv, unit_norm)
            } else {
                payload
                    .duration_months
                    .unwrap_or(existing.duration_months)
                    .max(1)
            };
            let dur_val_store = if dv > 0 { dv } else { dm };
            let unit_store = if dv > 0 {
                unit_norm.to_string()
            } else {
                "months".to_string()
            };
            set.insert("duration_months", dm);
            set.insert("duration_value", dur_val_store);
            set.insert("duration_unit", unit_store);
        } else if let Some(dm) = payload.duration_months {
            set.insert("duration_months", dm.max(1));
        }
    }

    if let Some(ref ids) = payload.linked_typing_tests {
        let parsed: Vec<ObjectId> = ids
            .iter()
            .filter_map(|s| ObjectId::parse_str(s.trim()).ok())
            .collect();
        set.insert("linked_typing_tests", parsed);
    }
    if let Some(ref ids) = payload.linked_mock_tests {
        let parsed: Vec<ObjectId> = ids
            .iter()
            .filter_map(|s| ObjectId::parse_str(s.trim()).ok())
            .collect();
        set.insert("linked_mock_tests", parsed);
    }
    if let Some(v) = payload.typing_tests_enabled {
        set.insert("typing_tests_enabled", v);
    }
    if let Some(v) = payload.mock_tests_enabled {
        set.insert("mock_tests_enabled", v);
    }

    if let Some(want) = payload.featured_on_home {
        if want {
            let collection = db.collection::<Course>("courses");
            let count = collection
                .count_documents(
                    doc! { "featured_on_home": true, "_id": { "$ne": oid } },
                    None,
                )
                .await
                .unwrap_or(0);
            if count >= 4 {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(CourseResponse {
                        success: false,
                        message: "Maximum 4 courses can be featured on the home page".to_string(),
                    }),
                );
            }
        }
        set.insert("featured_on_home", want);
        if !want {
            set.insert("home_feature_order", 0u32);
        }
    }
    if let Some(v) = payload.home_feature_order {
        set.insert("home_feature_order", v);
    }

    if set.is_empty() {
        return (
            StatusCode::OK,
            Json(CourseResponse {
                success: true,
                message: "Nothing to update".to_string(),
            }),
        );
    }

    match collection
        .update_one(doc! { "_id": oid }, doc! { "$set": set }, None)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(CourseResponse {
                success: true,
                message: "Course updated successfully".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CourseResponse {
                success: false,
                message: "Failed to update course".to_string(),
            }),
        ),
    }
}

pub async fn delete_course(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<CourseResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(CourseResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(CourseResponse {
                    success: false,
                    message: "Invalid Course ID".to_string(),
                }),
            );
        }
    };

    // Check if course has sessions
    let sessions_coll = db.collection::<Session>("sessions");
    let has_sessions = sessions_coll
        .find_one(doc! { "course_id": oid }, None)
        .await
        .ok()
        .flatten();
    if has_sessions.is_some() {
        return (
            StatusCode::BAD_REQUEST,
            Json(CourseResponse {
                success: false,
                message: "Cannot delete course with existing sessions".to_string(),
            }),
        );
    }

    let collection = db.collection::<Course>("courses");
    match collection.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => (
            StatusCode::OK,
            Json(CourseResponse {
                success: true,
                message: "Course deleted successfully".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CourseResponse {
                success: false,
                message: "Failed to delete course".to_string(),
            }),
        ),
    }
}

#[derive(Debug, Deserialize)]
pub struct AllotCourseRequest {
    pub center_id: String,
    pub course_id: String,
}

pub async fn allot_course(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<AllotCourseRequest>,
) -> (StatusCode, Json<CourseResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(CourseResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let collection = db.collection::<AllottedCourse>("allotted_courses");
    let center_oid = ObjectId::parse_str(&payload.center_id).unwrap();
    let course_oid = ObjectId::parse_str(&payload.course_id).unwrap();

    // Check if already allotted
    if let Ok(Some(_)) = collection
        .find_one(
            doc! { "center_id": center_oid, "course_id": course_oid },
            None,
        )
        .await
    {
        return (
            StatusCode::CONFLICT,
            Json(CourseResponse {
                success: false,
                message: "Course already allotted to this center".to_string(),
            }),
        );
    }

    let new_allotment = AllottedCourse {
        id: None,
        center_id: center_oid,
        course_id: course_oid,
        allotted_at: Utc::now(),
    };

    match collection.insert_one(new_allotment, None).await {
        Ok(_) => {
            // Also update the center's course_allotment field for consistency
            let course_coll = db.collection::<Course>("courses");
            if let Ok(Some(course)) = course_coll.find_one(doc! { "_id": course_oid }, None).await {
                let center_coll = db.collection::<crate::models::center::Center>("centers");
                let _ = center_coll
                    .update_one(
                        doc! { "_id": center_oid },
                        doc! { "$addToSet": { "course_allotment": course.course_name } },
                        None,
                    )
                    .await;
            }
            (
                StatusCode::CREATED,
                Json(CourseResponse {
                    success: true,
                    message: "Course allotted successfully".to_string(),
                }),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CourseResponse {
                success: false,
                message: "Failed to allot course".to_string(),
            }),
        ),
    }
}

pub async fn get_allotted_courses(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role == UserRole::Student {
        let user_oid = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!([]))),
        };

        let user_coll = db.collection::<crate::models::user::User>("users");
        if let Ok(Some(user)) = user_coll.find_one(doc! { "_id": user_oid }, None).await {
            let mut items = Vec::new();
            let course_coll = db.collection::<Course>("courses");
            let cat_coll = db
                .collection::<crate::models::course_category::CourseCategory>("course_categories");

            let mut filter = doc! {};
            let mut found_course = None;

            // 1. Try by course_id first (most accurate)
            if let Some(c_oid) = user.course_id {
                if let Ok(Some(course)) = course_coll.find_one(doc! { "_id": c_oid }, None).await {
                    found_course = Some(course);
                }
            }

            // 2. Fallback to matching by course name or ID string in user.course
            if found_course.is_none() {
                if let Some(course_name_or_id) = user.course {
                    let mut name_filter = doc! {
                        "course_name": { "$regex": format!("^{}$", regex::escape(&course_name_or_id)), "$options": "i" }
                    };

                    if let Ok(oid) = ObjectId::parse_str(&course_name_or_id) {
                        name_filter = doc! {
                            "$or": [
                                { "course_name": { "$regex": format!("^{}$", regex::escape(&course_name_or_id)), "$options": "i" } },
                                { "_id": oid }
                            ]
                        };
                    }
                    if let Ok(Some(course)) = course_coll.find_one(name_filter, None).await {
                        found_course = Some(course);
                    }
                }
            }

            if let Some(course) = found_course {
                // Fetch category name
                let mut category_name = "General".to_string();
                if let Ok(Some(cat)) = cat_coll
                    .find_one(doc! { "_id": course.category_id }, None)
                    .await
                {
                    category_name = cat.name;
                }

                // Return the course in an array
                items.push(serde_json::json!({
                    "_id": course.id.map(|id| id.to_hex()).unwrap_or_default(),
                    "name": course.course_name,
                    "course_name": course.course_name,
                    "code": course.course_code,
                    "course_code": course.course_code,
                    "short_code": course.short_code,
                    "course_type": course.course_type,
                    "description": course.description,
                    "image_url": course.image_url,
                    "og_image_url": course.og_image_url,
                    "duration_months": course.duration_months,
                    "duration_value": course.duration_value,
                    "duration_unit": course.duration_unit,
                    "total_fees": course.fees.unwrap_or(0),
                    "fees": course.fees.unwrap_or(0),
                    "registration_fee": course.registration_fee.unwrap_or(0),
                    "admission_fee": course.registration_fee.unwrap_or(0),
                    "exam_fees_applicable": course.exam_fees_applicable,
                    "exam_fee_amount": course.exam_fee_amount.unwrap_or(0),
                    "backlog_fees_applicable": course.backlog_fees_applicable,
                    "backlog_fee_amount": course.backlog_fee_amount.unwrap_or(0),
                    "has_course_structure_units": course.has_course_structure_units,
                    "unit_type": course.unit_type,
                    "unit_count": course.unit_count,
                    "custom_unit_name": course.custom_unit_name,
                    "typing_tests_enabled": course.typing_tests_enabled,
                    "mock_tests_enabled": course.mock_tests_enabled,
                    "linked_typing_tests": course.linked_typing_tests.iter().map(|o| o.to_hex()).collect::<Vec<_>>(),
                    "eligibility": course.eligibility,
                    "status": course.status,
                    "category": category_name,
                    "allotted_at": user.created_at,
                }));
            }
            return (StatusCode::OK, Json(serde_json::json!(items)));
        }
        return (StatusCode::OK, Json(serde_json::json!([])));
    }

    if claims.role == UserRole::Center {
        let user_oid = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => {
                eprintln!("[ERROR] Invalid center user_id in claims: {}", claims.sub);
                return (StatusCode::BAD_REQUEST, Json(serde_json::json!([])));
            }
        };

        let center_coll = db.collection::<crate::models::center::Center>("centers");
        let user_coll = db.collection::<crate::models::user::User>("users");

        let mut center_doc = None;

        // 1. Try finding by user_id
        if let Ok(Some(c)) = center_coll
            .find_one(doc! { "user_id": user_oid }, None)
            .await
        {
            center_doc = Some(c);
        }

        // 2. Fallback: search by current user's email
        if center_doc.is_none() {
            if let Ok(Some(user)) = user_coll.find_one(doc! { "_id": user_oid }, None).await {
                if let Some(email) = user.email {
                    if let Ok(Some(c)) = center_coll.find_one(doc! { "email": email }, None).await {
                        center_doc = Some(c);
                    }
                }
            }
        }

        // 3. Last resort: search for ANY center that has this user_id in its record (even if not as ObjectId)
        if center_doc.is_none() {
            if let Ok(Some(c)) = center_coll
                .find_one(
                    doc! { "$or": [ { "user_id": user_oid }, { "user_id": user_oid.to_hex() } ] },
                    None,
                )
                .await
            {
                center_doc = Some(c);
            }
        }

        if let Some(center) = center_doc {
            let mut items = Vec::new();
            let course_coll = db.collection::<Course>("courses");
            let cat_coll = db
                .collection::<crate::models::course_category::CourseCategory>("course_categories");

            eprintln!(
                "[INFO] Center found: {} (Code: {}). Allotment count: {}",
                center.name,
                center.code,
                center.course_allotment.len()
            );

            for course_name_or_id in center.course_allotment {
                // Try finding by name first, then by ID
                // Using regex for case-insensitive name match to be safe
                let mut filter = doc! {
                    "course_name": { "$regex": format!("^{}$", regex::escape(&course_name_or_id)), "$options": "i" }
                };

                if let Ok(oid) = ObjectId::parse_str(&course_name_or_id) {
                    filter = doc! {
                        "$or": [
                            { "course_name": { "$regex": format!("^{}$", regex::escape(&course_name_or_id)), "$options": "i" } },
                            { "_id": oid }
                        ]
                    };
                }

                if let Ok(Some(course)) = course_coll.find_one(filter.clone(), None).await {
                    // Fetch category name
                    let mut category_name = "General".to_string();
                    if let Ok(Some(cat)) = cat_coll
                        .find_one(doc! { "_id": course.category_id }, None)
                        .await
                    {
                        category_name = cat.name;
                    }

                    items.push(serde_json::json!({
                        "_id": course.id.map(|id| id.to_hex()).unwrap_or_default(),
                        "name": course.course_name,
                        "course_name": course.course_name,
                        "code": course.course_code,
                        "course_code": course.course_code,
                        "short_code": course.short_code,
                        "course_type": course.course_type,
                        "description": course.description,
                        "image_url": course.image_url,
                        "og_image_url": course.og_image_url,
                        "duration_months": course.duration_months,
                        "duration_value": course.duration_value,
                        "duration_unit": course.duration_unit,
                        "total_fees": course.fees.unwrap_or(0),
                        "fees": course.fees.unwrap_or(0),
                        "registration_fee": course.registration_fee.unwrap_or(0),
                        "admission_fee": course.registration_fee.unwrap_or(0),
                        "exam_fees_applicable": course.exam_fees_applicable,
                        "exam_fee_amount": course.exam_fee_amount.unwrap_or(0),
                        "backlog_fees_applicable": course.backlog_fees_applicable,
                        "backlog_fee_amount": course.backlog_fee_amount.unwrap_or(0),
                        "has_course_structure_units": course.has_course_structure_units,
                        "unit_type": course.unit_type,
                        "unit_count": course.unit_count,
                        "custom_unit_name": course.custom_unit_name,
                        "typing_tests_enabled": course.typing_tests_enabled,
                        "mock_tests_enabled": course.mock_tests_enabled,
                        "linked_typing_tests": course.linked_typing_tests.iter().map(|o| o.to_hex()).collect::<Vec<_>>(),
                        "eligibility": course.eligibility,
                        "status": course.status,
                        "category": category_name,
                        "allotted_at": Utc::now(), // Placeholder
                    }));
                } else {
                    eprintln!("[WARN] Course not found in DB: {}", course_name_or_id);
                }
            }
            eprintln!(
                "[INFO] Returning {} courses for center {}",
                items.len(),
                center.name
            );
            return (StatusCode::OK, Json(serde_json::json!(items)));
        } else {
            eprintln!("[WARN] Center record not found for user_id: {}", user_oid);
            return (StatusCode::OK, Json(serde_json::json!([])));
        }
    }

    if claims.role == UserRole::Admin || claims.role == UserRole::SuperAdmin {
        // For admin and superadmin, return ALL courses
        let mut items = Vec::new();
        let course_coll = db.collection::<Course>("courses");
        let cat_coll =
            db.collection::<crate::models::course_category::CourseCategory>("course_categories");

        let mut cursor = course_coll
            .find(doc! {}, None)
            .await
            .expect("Failed to fetch all courses");
        while let Some(result) = cursor.next().await {
            if let Ok(course) = result {
                // Fetch category name
                let mut category_name = "General".to_string();
                if let Ok(Some(cat)) = cat_coll
                    .find_one(doc! { "_id": course.category_id }, None)
                    .await
                {
                    category_name = cat.name;
                }

                items.push(serde_json::json!({
                    "_id": course.id.map(|id| id.to_hex()).unwrap_or_default(),
                    "name": course.course_name,
                    "course_name": course.course_name,
                    "code": course.course_code,
                    "course_code": course.course_code,
                    "short_code": course.short_code,
                    "course_type": course.course_type,
                    "description": course.description,
                    "image_url": course.image_url,
                    "og_image_url": course.og_image_url,
                    "duration_months": course.duration_months,
                    "duration_value": course.duration_value,
                    "duration_unit": course.duration_unit,
                    "total_fees": course.fees.unwrap_or(0),
                    "fees": course.fees.unwrap_or(0),
                    "registration_fee": course.registration_fee.unwrap_or(0),
                    "admission_fee": course.registration_fee.unwrap_or(0),
                    "exam_fees_applicable": course.exam_fees_applicable,
                    "exam_fee_amount": course.exam_fee_amount.unwrap_or(0),
                    "backlog_fees_applicable": course.backlog_fees_applicable,
                    "backlog_fee_amount": course.backlog_fee_amount.unwrap_or(0),
                    "has_course_structure_units": course.has_course_structure_units,
                    "unit_type": course.unit_type,
                    "unit_count": course.unit_count,
                    "custom_unit_name": course.custom_unit_name,
                    "typing_tests_enabled": course.typing_tests_enabled,
                    "mock_tests_enabled": course.mock_tests_enabled,
                    "linked_typing_tests": course.linked_typing_tests.iter().map(|o| o.to_hex()).collect::<Vec<_>>(),
                    "eligibility": course.eligibility,
                    "status": course.status,
                    "category": category_name,
                }));
            }
        }
        return (StatusCode::OK, Json(serde_json::json!(items)));
    }

    let collection = db.collection::<AllottedCourse>("allotted_courses");
    let filter = doc! {};

    if claims.role == UserRole::Center {
        // This part is only reached if the center was not found in the centers collection above
        // which is unlikely, but we still want to filter by center_id if we have one.
        // However, we don't have the center's ObjectId here easily.
        // Let's just return empty to be safe since centers should be found in the centers collection now.
        return (StatusCode::OK, Json(serde_json::json!([])));
    }

    let mut cursor = collection
        .find(filter, None)
        .await
        .expect("Failed to fetch allotments");
    let mut items = Vec::new();
    let course_coll = db.collection::<Course>("courses");
    let cat_coll =
        db.collection::<crate::models::course_category::CourseCategory>("course_categories");

    while let Some(result) = cursor.next().await {
        if let Ok(item) = result {
            // Fetch course details for each allotment
            if let Ok(Some(course)) = course_coll
                .find_one(doc! { "_id": item.course_id }, None)
                .await
            {
                // Fetch category name
                let mut category_name = "General".to_string();
                if let Ok(Some(cat)) = cat_coll
                    .find_one(doc! { "_id": course.category_id }, None)
                    .await
                {
                    category_name = cat.name;
                }

                items.push(serde_json::json!({
                    "_id": course.id.map(|id| id.to_hex()).unwrap_or_default(),
                    "name": course.course_name,
                    "course_name": course.course_name,
                    "code": course.course_code,
                    "course_code": course.course_code,
                    "short_code": course.short_code,
                    "course_type": course.course_type,
                    "description": course.description,
                    "image_url": course.image_url,
                    "og_image_url": course.og_image_url,
                    "duration_months": course.duration_months,
                    "duration_value": course.duration_value,
                    "duration_unit": course.duration_unit,
                    "total_fees": course.fees.unwrap_or(0),
                    "fees": course.fees.unwrap_or(0),
                    "registration_fee": course.registration_fee.unwrap_or(0),
                    "admission_fee": course.registration_fee.unwrap_or(0),
                    "exam_fees_applicable": course.exam_fees_applicable,
                    "exam_fee_amount": course.exam_fee_amount.unwrap_or(0),
                    "backlog_fees_applicable": course.backlog_fees_applicable,
                    "backlog_fee_amount": course.backlog_fee_amount.unwrap_or(0),
                    "has_course_structure_units": course.has_course_structure_units,
                    "unit_type": course.unit_type,
                    "unit_count": course.unit_count,
                    "custom_unit_name": course.custom_unit_name,
                    "eligibility": course.eligibility,
                    "status": course.status,
                    "category": category_name,
                    "course_id": item.course_id.to_hex(),
                    "allotted_at": item.allotted_at,
                }));
            }
        }
    }
    (StatusCode::OK, Json(serde_json::json!(items)))
}
