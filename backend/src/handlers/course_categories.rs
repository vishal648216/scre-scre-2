use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use chrono::{DateTime, Utc};
use futures_util::stream::StreamExt;
use mongodb::options::FindOptions;
use mongodb::{
    Database,
    bson::{doc, oid::ObjectId},
};
use serde::{Deserialize, Serialize};

use crate::models::course::Course;
use crate::models::course_category::CourseCategory;
use crate::models::user::{Claims, UserRole};

use crate::services::translation_service::{get_translation, normalize_lang};

/// Trim and drop empty image strings so we never persist whitespace-only URLs.
fn normalize_image_url(raw: Option<String>) -> Option<String> {
    raw.and_then(|s| {
        let t = s.trim();
        if t.is_empty() {
            None
        } else {
            Some(t.to_string())
        }
    })
}

#[derive(Debug, Deserialize)]
pub struct CategoryQuery {
    pub search: Option<String>,
    pub status: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub lang: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCourseCategoryRequest {
    pub name: String,
    #[serde(alias = "categoryCode")]
    pub category_code: String,
    pub description: Option<String>,
    pub status: Option<String>,
    #[serde(default, alias = "imageUrl", alias = "image")]
    pub image_url: Option<String>,
    #[serde(default)]
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCourseCategoryRequest {
    pub name: Option<String>,
    #[serde(alias = "categoryCode")]
    pub category_code: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    #[serde(default, alias = "imageUrl", alias = "image")]
    pub image_url: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Serialize, Clone)]
pub struct CategoryListItem {
    pub id: String,
    pub name: String,
    pub category_code: String,
    pub description: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub image_url: Option<String>,
    pub sort_order: i32,
}

#[derive(Debug, Serialize)]
pub struct CategoryListResponse {
    pub items: Vec<CategoryListItem>,
    pub total: u64,
    pub page: u32,
    pub limit: u32,
}

#[derive(Debug, Serialize)]
pub struct CategoryResponse {
    pub success: bool,
    pub message: String,
}

pub async fn create_category(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateCourseCategoryRequest>,
) -> (StatusCode, Json<CategoryResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(CategoryResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }
    let coll = db.collection::<CourseCategory>("course_categories");

    let exists = coll
        .find_one(doc! { "name": &payload.name }, None)
        .await
        .ok()
        .flatten();
    if exists.is_some() {
        return (
            StatusCode::CONFLICT,
            Json(CategoryResponse {
                success: false,
                message: "Category name already exists".to_string(),
            }),
        );
    }

    let category_code = payload.category_code.trim().to_string();
    if category_code.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(CategoryResponse {
                success: false,
                message: "Category code is required".to_string(),
            }),
        );
    }
    if coll
        .find_one(
            doc! {
                "$or": [
                    { "category_code": &category_code },
                    { "code": &category_code },
                ]
            },
            None,
        )
        .await
        .ok()
        .flatten()
        .is_some()
    {
        return (
            StatusCode::CONFLICT,
            Json(CategoryResponse {
                success: false,
                message: "Category code already in use".to_string(),
            }),
        );
    }

    let now = Utc::now();
    let cat = CourseCategory {
        id: None,
        name: payload.name,
        category_code,
        description: payload.description,
        status: payload.status.unwrap_or_else(|| "active".to_string()),
        created_at: now,
        image_url: normalize_image_url(payload.image_url),
        sort_order: payload.sort_order.unwrap_or(0),
    };
    match coll.insert_one(cat, None).await {
        Ok(_) => (
            StatusCode::CREATED,
            Json(CategoryResponse {
                success: true,
                message: "Category created".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CategoryResponse {
                success: false,
                message: "Create failed".to_string(),
            }),
        ),
    }
}

pub async fn list_categories(
    State(db): State<Database>,
    _claims: Claims,
    Query(q): Query<CategoryQuery>,
) -> (StatusCode, Json<CategoryListResponse>) {
    let coll = db.collection::<CourseCategory>("course_categories");
    let mut filter = doc! {};
    if let Some(s) = q.status {
        filter.insert("status", s);
    }
    if let Some(s) = &q.search {
        if !s.trim().is_empty() {
            let regex = mongodb::bson::Regex {
                pattern: s.clone(),
                options: "i".to_string(),
            };
            filter.insert("name", doc! { "$regex": regex });
        }
    }
    let page = q.page.unwrap_or(1);
    let limit_u32 = q.limit.unwrap_or(20).min(100);
    let limit = limit_u32 as i64;
    let skip = ((page.saturating_sub(1)) as u64) * (limit as u64);
    let find_opts = FindOptions::builder()
        .sort(Some(doc! { "sort_order": 1, "name": 1 }))
        .limit(Some(limit))
        .skip(Some(skip))
        .build();
    let total = coll
        .count_documents(filter.clone(), None)
        .await
        .unwrap_or(0);
    let mut cursor = match coll.find(filter, find_opts).await {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(CategoryListResponse {
                    items: Vec::new(),
                    total: 0,
                    page,
                    limit: limit_u32,
                }),
            );
        }
    };
    let lang = q.lang.as_ref().map(|l| normalize_lang(l));
    let mut items = Vec::new();
    while let Some(res) = cursor.next().await {
        if let Ok(c) = res {
            if let Some(id) = c.id {
                let mut name = c.name;
                let mut description = c.description;

                if let Some(target_lang) = &lang {
                    if target_lang != "en" {
                        name = get_translation(&db, &name, target_lang)
                            .await
                            .unwrap_or(name);
                        if let Some(d) = description {
                            description =
                                Some(get_translation(&db, &d, target_lang).await.unwrap_or(d));
                        }
                    }
                }

                items.push(CategoryListItem {
                    id: id.to_hex(),
                    name,
                    category_code: c.category_code,
                    description,
                    status: c.status,
                    created_at: c.created_at,
                    image_url: c.image_url,
                    sort_order: c.sort_order,
                });
            }
        }
    }
    (
        StatusCode::OK,
        Json(CategoryListResponse {
            items,
            total,
            page,
            limit: limit_u32,
        }),
    )
}

/// Public course category listing (no auth).
///
/// Kept in a separate endpoint to avoid exposing admin-only APIs.
pub async fn public_list_categories(
    State(db): State<Database>,
    Query(q): Query<CategoryQuery>,
) -> (StatusCode, Json<CategoryListResponse>) {
    let coll = db.collection::<CourseCategory>("course_categories");
    let mut filter = doc! {};
    if let Some(s) = q.status {
        filter.insert("status", s);
    }
    if let Some(s) = &q.search {
        if !s.trim().is_empty() {
            let regex = mongodb::bson::Regex {
                pattern: s.clone(),
                options: "i".to_string(),
            };
            filter.insert("name", doc! { "$regex": regex });
        }
    }
    let page = q.page.unwrap_or(1);
    let limit_u32 = q.limit.unwrap_or(20).min(100);
    let limit = limit_u32 as i64;
    let skip = ((page.saturating_sub(1)) as u64) * (limit as u64);
    let find_opts = FindOptions::builder()
        .sort(Some(doc! { "sort_order": 1, "name": 1 }))
        .limit(Some(limit))
        .skip(Some(skip))
        .build();

    let total = coll
        .count_documents(filter.clone(), None)
        .await
        .unwrap_or(0);
    let mut cursor = match coll.find(filter, find_opts).await {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(CategoryListResponse {
                    items: Vec::new(),
                    total: 0,
                    page,
                    limit: limit_u32,
                }),
            );
        }
    };

    let lang = q.lang.as_ref().map(|l| normalize_lang(l));
    let mut items = Vec::new();
    while let Some(res) = cursor.next().await {
        if let Ok(c) = res {
            if let Some(id) = c.id {
                let mut name = c.name;
                let mut description = c.description;

                if let Some(target_lang) = &lang {
                    if target_lang != "en" {
                        name = get_translation(&db, &name, target_lang)
                            .await
                            .unwrap_or(name);
                        if let Some(d) = description {
                            description =
                                Some(get_translation(&db, &d, target_lang).await.unwrap_or(d));
                        }
                    }
                }

                items.push(CategoryListItem {
                    id: id.to_hex(),
                    name,
                    category_code: c.category_code,
                    description,
                    status: c.status,
                    created_at: c.created_at,
                    image_url: c.image_url,
                    sort_order: c.sort_order,
                });
            }
        }
    }

    (
        StatusCode::OK,
        Json(CategoryListResponse {
            items,
            total,
            page,
            limit: limit_u32,
        }),
    )
}

pub async fn update_category(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<UpdateCourseCategoryRequest>,
) -> (StatusCode, Json<CategoryResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(CategoryResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }
    let coll = db.collection::<CourseCategory>("course_categories");
    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(CategoryResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };
    let mut set = doc! {};
    let mut unset = doc! {};
    if let Some(v) = payload.name {
        set.insert("name", v);
    }
    if let Some(v) = payload.category_code {
        let trimmed = v.trim().to_string();
        if trimmed.is_empty() {
            return (
                StatusCode::BAD_REQUEST,
                Json(CategoryResponse {
                    success: false,
                    message: "Category code cannot be empty".to_string(),
                }),
            );
        }
        // Check if category_code is already used by another category
        if coll
            .find_one(
                doc! {
                    "$or": [
                        { "category_code": &trimmed },
                        { "code": &trimmed },
                    ],
                    "_id": { "$ne": oid }
                },
                None,
            )
            .await
            .ok()
            .flatten()
            .is_some()
        {
            return (
                StatusCode::CONFLICT,
                Json(CategoryResponse {
                    success: false,
                    message: "Category code already in use".to_string(),
                }),
            );
        }
        set.insert("category_code", trimmed);
        // Remove legacy/alternate keys so reads always resolve to `category_code`.
        unset.insert("code", "");
        unset.insert("categoryCode", "");
    }
    if let Some(v) = payload.description {
        set.insert("description", v);
    }
    if let Some(v) = payload.status {
        set.insert("status", v);
    }
    if let Some(raw) = payload.image_url {
        match normalize_image_url(Some(raw)) {
            Some(v) => {
                set.insert("image_url", v);
            }
            None => {
                unset.insert("image_url", "");
            }
        }
    }
    if let Some(v) = payload.sort_order {
        set.insert("sort_order", v);
    }

    if set.is_empty() && unset.is_empty() {
        return (
            StatusCode::OK,
            Json(CategoryResponse {
                success: true,
                message: "Nothing to update".to_string(),
            }),
        );
    }

    let mut update = doc! {};
    if !set.is_empty() {
        update.insert("$set", set);
    }
    if !unset.is_empty() {
        update.insert("$unset", unset);
    }

    match coll.update_one(doc! { "_id": oid }, update, None).await {
        Ok(_) => (
            StatusCode::OK,
            Json(CategoryResponse {
                success: true,
                message: "Category updated".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CategoryResponse {
                success: false,
                message: "Update failed".to_string(),
            }),
        ),
    }
}

pub async fn delete_category(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<CategoryResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(CategoryResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }
    let coll = db.collection::<CourseCategory>("course_categories");
    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(CategoryResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    // Check if category has courses
    let courses_coll = db.collection::<Course>("courses");
    let has_courses = courses_coll
        .find_one(doc! { "category_id": oid }, None)
        .await
        .ok()
        .flatten();
    if has_courses.is_some() {
        return (
            StatusCode::BAD_REQUEST,
            Json(CategoryResponse {
                success: false,
                message: "Cannot delete category with existing courses".to_string(),
            }),
        );
    }

    match coll.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => (
            StatusCode::OK,
            Json(CategoryResponse {
                success: true,
                message: "Category deleted".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CategoryResponse {
                success: false,
                message: "Delete failed".to_string(),
            }),
        ),
    }
}

#[derive(Debug, Deserialize)]
pub struct BulkCategoryPayload {
    pub items: Vec<CreateCourseCategoryRequest>,
}

pub async fn bulk_create_categories(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<BulkCategoryPayload>,
) -> (StatusCode, Json<CategoryResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(CategoryResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }
    let coll = db.collection::<CourseCategory>("course_categories");
    let now = Utc::now();
    let mut new_cats = Vec::new();

    for item in payload.items {
        let name = item.name.trim().to_string();
        if name.is_empty() {
            continue;
        }
        let code = if item.category_code.trim().is_empty() {
            let slug = name
                .to_uppercase()
                .chars()
                .filter(|c| c.is_alphanumeric())
                .take(6)
                .collect::<String>();
            format!("CAT-{}-{}", if slug.is_empty() { "GEN" } else { &slug }, Utc::now().timestamp_subsec_millis())
        } else {
            item.category_code.trim().to_string()
        };

        new_cats.push(CourseCategory {
            id: None,
            name,
            category_code: code,
            description: item.description,
            status: item.status.unwrap_or_else(|| "active".to_string()),
            created_at: now,
            image_url: normalize_image_url(item.image_url),
            sort_order: item.sort_order.unwrap_or(0),
        });
    }

    if new_cats.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(CategoryResponse {
                success: false,
                message: "No valid categories provided".to_string(),
            }),
        );
    }

    let count = new_cats.len();
    match coll.insert_many(new_cats, None).await {
        Ok(_) => (
            StatusCode::CREATED,
            Json(CategoryResponse {
                success: true,
                message: format!("Successfully imported {} categories!", count),
            }),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CategoryResponse {
                success: false,
                message: format!("Bulk category creation failed: {}", e),
            }),
        ),
    }
}

