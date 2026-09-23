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

use crate::models::blog::Blog;
use crate::models::blog_category::BlogCategory;
use crate::models::user::{Claims, UserRole};

use crate::services::translation_service::{get_translation, normalize_lang};

fn generate_slug(name: &str) -> String {
    name.to_lowercase()
        .replace(|c: char| !c.is_alphanumeric(), "-")
        .replace("--", "-")
        .trim_matches('-')
        .to_string()
}

#[derive(Debug, Deserialize)]
pub struct BlogCategoryQuery {
    pub search: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub lang: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBlogCategoryRequest {
    pub name: String,
    pub lang: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBlogCategoryRequest {
    pub name: Option<String>,
    pub lang: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct BlogCategoryListItem {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub lang: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct BlogCategoryListResponse {
    pub items: Vec<BlogCategoryListItem>,
    pub total: u64,
    pub page: u32,
    pub limit: u32,
}

#[derive(Debug, Serialize)]
pub struct BlogCategoryResponse {
    pub success: bool,
    pub message: String,
}

pub async fn create_blog_category(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateBlogCategoryRequest>,
) -> (StatusCode, Json<BlogCategoryResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(BlogCategoryResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }
    let coll = db.collection::<BlogCategory>("blog_categories");

    let name = payload.name.trim().to_string();
    if name.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(BlogCategoryResponse {
                success: false,
                message: "Category name is required".to_string(),
            }),
        );
    }
    let slug = generate_slug(&name);

    let exists = coll
        .find_one(doc! { "$or": [{"name": &name}, {"slug": &slug}] }, None)
        .await
        .ok()
        .flatten();
    if exists.is_some() {
        return (
            StatusCode::CONFLICT,
            Json(BlogCategoryResponse {
                success: false,
                message: "Category name or slug already exists".to_string(),
            }),
        );
    }

    let now = Utc::now();
    let cat = BlogCategory {
        id: None,
        name,
        slug,
        tenant_id: None,
        lang: payload.lang,
        created_at: now,
        updated_at: now,
    };
    match coll.insert_one(cat, None).await {
        Ok(_) => (
            StatusCode::CREATED,
            Json(BlogCategoryResponse {
                success: true,
                message: "Category created".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(BlogCategoryResponse {
                success: false,
                message: "Create failed".to_string(),
            }),
        ),
    }
}

pub async fn list_blog_categories(
    State(db): State<Database>,
    _claims: Claims,
    Query(q): Query<BlogCategoryQuery>,
) -> (StatusCode, Json<BlogCategoryListResponse>) {
    let coll = db.collection::<BlogCategory>("blog_categories");
    let mut filter = doc! {};
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
    let limit_u32 = q.limit.unwrap_or(50).min(100);
    let limit = limit_u32 as i64;
    let skip = ((page.saturating_sub(1)) as u64) * (limit as u64);
    let find_opts = FindOptions::builder()
        .sort(Some(doc! { "name": 1 }))
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
                Json(BlogCategoryListResponse {
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

                if let Some(target_lang) = &lang {
                    if target_lang != "en" {
                        name = get_translation(&db, &name, target_lang)
                            .await
                            .unwrap_or_else(|_| name);
                    }
                }

                items.push(BlogCategoryListItem {
                    id: id.to_hex(),
                    name,
                    slug: c.slug,
                    lang: c.lang,
                    created_at: c.created_at,
                });
            }
        }
    }
    (
        StatusCode::OK,
        Json(BlogCategoryListResponse {
            items,
            total,
            page,
            limit: limit_u32,
        }),
    )
}

pub async fn public_list_blog_categories(
    State(db): State<Database>,
    Query(q): Query<BlogCategoryQuery>,
) -> (StatusCode, Json<Vec<BlogCategoryListItem>>) {
    let coll = db.collection::<BlogCategory>("blog_categories");
    let mut filter = doc! {};
    if let Some(s) = &q.search {
        if !s.trim().is_empty() {
            let regex = mongodb::bson::Regex {
                pattern: s.clone(),
                options: "i".to_string(),
            };
            filter.insert("name", doc! { "$regex": regex });
        }
    }
    let find_opts = FindOptions::builder()
        .sort(Some(doc! { "name": 1 }))
        .build();

    let mut cursor = match coll.find(filter, find_opts).await {
        Ok(c) => c,
        Err(_) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new()));
        }
    };

    let lang = q.lang.as_ref().map(|l| normalize_lang(l));
    let mut items = Vec::new();
    while let Some(res) = cursor.next().await {
        if let Ok(c) = res {
            if let Some(id) = c.id {
                let mut name = c.name;

                if let Some(target_lang) = &lang {
                    if target_lang != "en" {
                        name = get_translation(&db, &name, target_lang)
                            .await
                            .unwrap_or_else(|_| name);
                    }
                }

                items.push(BlogCategoryListItem {
                    id: id.to_hex(),
                    name,
                    slug: c.slug,
                    lang: c.lang,
                    created_at: c.created_at,
                });
            }
        }
    }

    (StatusCode::OK, Json(items))
}

pub async fn update_blog_category(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<UpdateBlogCategoryRequest>,
) -> (StatusCode, Json<BlogCategoryResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(BlogCategoryResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }
    let coll = db.collection::<BlogCategory>("blog_categories");
    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(BlogCategoryResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };
    let mut set = doc! {};
    set.insert("updated_at", Utc::now());

    if let Some(v) = payload.name {
        let name = v.trim().to_string();
        if name.is_empty() {
            return (
                StatusCode::BAD_REQUEST,
                Json(BlogCategoryResponse {
                    success: false,
                    message: "Category name cannot be empty".to_string(),
                }),
            );
        }
        let slug = generate_slug(&name);
        // Check if name/slug is already used by another category
        if coll
            .find_one(
                doc! {
                    "$or": [{"name": &name}, {"slug": &slug}],
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
                Json(BlogCategoryResponse {
                    success: false,
                    message: "Category name or slug already in use".to_string(),
                }),
            );
        }
        set.insert("name", name);
        set.insert("slug", slug);
    }
    if let Some(v) = payload.lang {
        set.insert("lang", v);
    }

    if set.is_empty() {
        return (
            StatusCode::OK,
            Json(BlogCategoryResponse {
                success: true,
                message: "Nothing to update".to_string(),
            }),
        );
    }

    match coll
        .update_one(doc! { "_id": oid }, doc! { "$set": set }, None)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(BlogCategoryResponse {
                success: true,
                message: "Category updated".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(BlogCategoryResponse {
                success: false,
                message: "Update failed".to_string(),
            }),
        ),
    }
}

pub async fn delete_blog_category(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<BlogCategoryResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(BlogCategoryResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }
    let coll = db.collection::<BlogCategory>("blog_categories");
    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(BlogCategoryResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    // Check if category has blogs that reference it (using name/slug?)
    let blogs_coll = db.collection::<Blog>("blogs");
    let cat = coll
        .find_one(doc! { "_id": oid }, None)
        .await
        .ok()
        .flatten();
    if let Some(c) = cat {
        let has_blogs = blogs_coll
            .find_one(doc! { "categories": &c.slug }, None)
            .await
            .ok()
            .flatten();
        if has_blogs.is_some() {
            return (
                StatusCode::BAD_REQUEST,
                Json(BlogCategoryResponse {
                    success: false,
                    message: "Cannot delete category with existing blogs".to_string(),
                }),
            );
        }
    }

    match coll.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => (
            StatusCode::OK,
            Json(BlogCategoryResponse {
                success: true,
                message: "Category deleted".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(BlogCategoryResponse {
                success: false,
                message: "Delete failed".to_string(),
            }),
        ),
    }
}
