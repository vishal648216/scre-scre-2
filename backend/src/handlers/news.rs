use axum::response::AppendHeaders;
use axum::response::{IntoResponse, Response};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use chrono::{DateTime, Utc};
use futures_util::stream::StreamExt;
use mongodb::bson::{self, to_bson};
use mongodb::options::FindOptions;
use mongodb::{
    Database,
    bson::{doc, oid::ObjectId},
};
use serde::{Deserialize, Serialize};

use crate::config::languages::get_supported_languages;
use crate::models::news::{News, NewsStatus};
use crate::models::user::{Claims, UserRole};
use crate::services::translation_service::register_and_pretranslate;
use crate::models::serde_helpers::optional_rfc3339_datetime;

use crate::services::translation_service::{get_translation, normalize_lang};

#[derive(Debug, Deserialize)]
pub struct NewsQuery {
    pub category: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub tenant_id: Option<String>,
    pub lang: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AdminNewsQuery {
    pub status: Option<String>,
    pub category: Option<String>,
    pub search: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct NewsListItem {
    pub title: String,
    pub slug: String,
    pub featured_image: Option<String>,
    pub category: Option<String>,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    #[serde(with = "optional_rfc3339_datetime")]
    pub published_at: Option<DateTime<Utc>>,
}

pub async fn list_news(
    State(db): State<Database>,
    Query(q): Query<NewsQuery>,
) -> (StatusCode, Json<Vec<NewsListItem>>) {
    let coll = db.collection::<News>("news");
    let mut filter = doc! { "status": to_bson(&NewsStatus::Published).unwrap() };
    filter.insert(
        "$or",
        vec![
            doc! { "published_at": { "$lte": Utc::now() } },
            doc! { "published_at": { "$exists": false } },
            doc! { "published_at": bson::Bson::Null },
        ],
    );

    if let Some(cat) = q.category {
        filter.insert("category", cat);
    }
    if let Some(tid) = q.tenant_id {
        if let Ok(oid) = ObjectId::parse_str(&tid) {
            filter.insert("tenant_id", oid);
        }
    }

    let limit = q.limit.unwrap_or(10) as i64;
    let skip = ((q.page.unwrap_or(1).saturating_sub(1)) as u64) * (limit as u64);
    let find_opts = FindOptions::builder()
        .limit(Some(limit))
        .skip(Some(skip))
        .sort(Some(doc! { "published_at": -1 }))
        .build();

    let lang = q.lang.as_ref().map(|l| normalize_lang(l));

    let mut cursor = match coll.find(filter, find_opts).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };
    let mut items = Vec::new();
    while let Some(res) = cursor.next().await {
        if let Ok(n) = res {
            let mut title = n.title;
            let mut category = n.category;
            let mut meta_description = n.meta_description;

            if let Some(target_lang) = &lang {
                if target_lang != "en" {
                    title = get_translation(&db, &title, target_lang)
                        .await
                        .unwrap_or(title);
                    if let Some(cat) = category {
                        category =
                            Some(get_translation(&db, &cat, target_lang).await.unwrap_or(cat));
                    }
                    if let Some(md) = meta_description {
                        meta_description =
                            Some(get_translation(&db, &md, target_lang).await.unwrap_or(md));
                    }
                }
            }

            items.push(NewsListItem {
                title,
                slug: n.slug,
                featured_image: n.featured_image,
                category,
                meta_title: n.meta_title,
                meta_description,
                published_at: n.published_at,
            });
        }
    }
    (StatusCode::OK, Json(items))
}

#[derive(Debug, Serialize)]
pub struct AdminNewsListItem {
    pub id: String,
    pub title: String,
    pub slug: String,
    pub category: Option<String>,
    pub status: NewsStatus,
    #[serde(with = "optional_rfc3339_datetime")]
    pub published_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct AdminNewsListResponse {
    pub items: Vec<AdminNewsListItem>,
    pub total: u64,
    pub page: u32,
    pub limit: u32,
}

pub async fn admin_list_news(
    State(db): State<Database>,
    _claims: Claims,
    Query(q): Query<AdminNewsQuery>,
) -> (StatusCode, Json<AdminNewsListResponse>) {
    let coll = db.collection::<News>("news");
    let mut filter = doc! {};
    if let Some(status) = &q.status {
        let s = status.to_lowercase();
        if s == "draft" || s == "published" {
            filter.insert("status", s);
        }
    }
    if let Some(cat) = &q.category {
        if !cat.is_empty() {
            filter.insert("category", cat);
        }
    }
    if let Some(search) = &q.search {
        if !search.trim().is_empty() {
            let regex = mongodb::bson::Regex {
                pattern: search.clone(),
                options: "i".to_string(),
            };
            filter.insert(
                "$or",
                vec![
                    doc! { "title": { "$regex": regex.clone() } },
                    doc! { "slug": { "$regex": regex } },
                ],
            );
        }
    }
    let page = q.page.unwrap_or(1);
    let limit_u32 = q.limit.unwrap_or(20).min(100);
    let limit = limit_u32 as i64;
    let skip = ((page.saturating_sub(1)) as u64) * (limit as u64);
    let find_opts = FindOptions::builder()
        .sort(Some(doc! { "updated_at": -1 }))
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
                Json(AdminNewsListResponse {
                    items: Vec::new(),
                    total: 0,
                    page,
                    limit: limit_u32,
                }),
            );
        }
    };
    let mut items = Vec::new();
    while let Some(res) = cursor.next().await {
        if let Ok(n) = res {
            if let Some(id) = n.id {
                items.push(AdminNewsListItem {
                    id: id.to_hex(),
                    title: n.title,
                    slug: n.slug,
                    category: n.category,
                    status: n.status,
                    published_at: n.published_at,
                });
            }
        }
    }
    (
        StatusCode::OK,
        Json(AdminNewsListResponse {
            items,
            total,
            page,
            limit: limit_u32,
        }),
    )
}

pub async fn news_rss_feed(State(db): State<Database>) -> Response {
    let coll = db.collection::<News>("news");
    let mut items: Vec<NewsListItem> = Vec::new();
    let mut cursor = coll
        .find(
            doc! {
                "status": to_bson(&NewsStatus::Published).unwrap(),
                "published_at": { "$lte": Utc::now() }
            },
            FindOptions::builder()
                .sort(Some(doc! { "published_at": -1 }))
                .limit(Some(50))
                .build(),
        )
        .await
        .ok()
        .unwrap();
    while let Some(Ok(n)) = cursor.next().await {
        items.push(NewsListItem {
            title: n.title,
            slug: n.slug,
            featured_image: n.featured_image,
            category: n.category,
            meta_title: n.meta_title,
            meta_description: n.meta_description,
            published_at: n.published_at,
        });
    }
    let site_url =
        std::env::var("PUBLIC_SITE_URL").unwrap_or_else(|_| "http://localhost:8086".to_string());
    let channel_title = "Latest News";
    let channel_link = format!("{}/news", site_url);
    let channel_desc = "Latest published news and announcements";
    let mut xml = String::new();
    xml.push_str(r#"<?xml version="1.0" encoding="UTF-8"?>"#);
    xml.push_str("<rss version=\"2.0\"><channel>");
    xml.push_str(&format!(
        "<title>{}</title><link>{}</link><description>{}</description>",
        channel_title, channel_link, channel_desc
    ));
    for it in items {
        let link = format!("{}/news/{}", site_url, it.slug);
        let title = it.title;
        let description = it.meta_description.unwrap_or_default();
        let pub_date = it.published_at.map(|d| d.to_rfc2822()).unwrap_or_default();
        xml.push_str("<item>");
        xml.push_str(&format!(
            "<title>{}</title>",
            title
                .replace('&', "&amp;")
                .replace('<', "&lt;")
                .replace('>', "&gt;")
        ));
        xml.push_str(&format!(
            "<link>{}</link>",
            link.replace('&', "&amp;")
                .replace('<', "&lt;")
                .replace('>', "&gt;")
        ));
        xml.push_str(&format!(
            "<description>{}</description>",
            description
                .replace('&', "&amp;")
                .replace('<', "&lt;")
                .replace('>', "&gt;")
        ));
        xml.push_str(&format!(
            "<pubDate>{}</pubDate>",
            pub_date
                .replace('&', "&amp;")
                .replace('<', "&lt;")
                .replace('>', "&gt;")
        ));
        xml.push_str("</item>");
    }
    xml.push_str("</channel></rss>");
    Response::builder()
        .header("Content-Type", "application/rss+xml; charset=utf-8")
        .body(xml.into())
        .unwrap()
}
#[derive(Debug, Serialize)]
pub struct NewsDetail {
    pub id: String,
    pub title: String,
    pub slug: String,
    pub content: String,
    pub featured_image: Option<String>,
    pub category: Option<String>,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    #[serde(with = "optional_rfc3339_datetime")]
    pub published_at: Option<DateTime<Utc>>,
    pub status: NewsStatus,
}

pub async fn get_news_by_slug(
    State(db): State<Database>,
    Path(slug): Path<String>,
    Query(q): Query<NewsQuery>,
) -> (StatusCode, Json<Option<NewsDetail>>) {
    let coll = db.collection::<News>("news");
    let mut filter = doc! {
        "slug": &slug,
        "status": to_bson(&NewsStatus::Published).unwrap(),
    };
    filter.insert(
        "$or",
        vec![
            doc! { "published_at": { "$lte": Utc::now() } },
            doc! { "published_at": { "$exists": false } },
            doc! { "published_at": bson::Bson::Null },
        ],
    );

    let lang = q.lang.as_ref().map(|l| normalize_lang(l));

    match coll.find_one(filter, None).await {
        Ok(Some(n)) => {
            let mut title = n.title;
            let mut content = n.content;
            let mut category = n.category;
            let mut meta_description = n.meta_description;

            if let Some(target_lang) = &lang {
                if target_lang != "en" {
                    title = get_translation(&db, &title, target_lang)
                        .await
                        .unwrap_or(title);
                    content = get_translation(&db, &content, target_lang)
                        .await
                        .unwrap_or(content);
                    if let Some(cat) = category {
                        category =
                            Some(get_translation(&db, &cat, target_lang).await.unwrap_or(cat));
                    }
                    if let Some(md) = meta_description {
                        meta_description =
                            Some(get_translation(&db, &md, target_lang).await.unwrap_or(md));
                    }
                }
            }

            (
                StatusCode::OK,
                Json(Some(NewsDetail {
                    id: n.id.unwrap().to_hex(),
                    title,
                    slug: n.slug,
                    content,
                    featured_image: n.featured_image,
                    category,
                    meta_title: n.meta_title,
                    meta_description,
                    published_at: n.published_at,
                    status: n.status,
                })),
            )
        }
        Ok(None) => (StatusCode::NOT_FOUND, Json(None)),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(None)),
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateNewsRequest {
    pub tenant_id: Option<String>,
    pub title: String,
    pub slug: String,
    pub content: String,
    pub featured_image: Option<String>,
    pub category: Option<String>,
    pub status: NewsStatus,
    pub published_at: Option<DateTime<Utc>>,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct NewsResponse {
    pub success: bool,
    pub message: String,
}

pub async fn create_news(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateNewsRequest>,
) -> (StatusCode, Json<NewsResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(NewsResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }
    let coll = db.collection::<News>("news");

    // slug uniqueness within tenant
    let mut filter = doc! { "slug": &payload.slug };
    if let Some(tid) = &payload.tenant_id {
        if let Ok(oid) = ObjectId::parse_str(tid) {
            filter.insert("tenant_id", oid);
        }
    }
    if let Ok(Some(_)) = coll.find_one(filter, None).await {
        return (
            StatusCode::CONFLICT,
            Json(NewsResponse {
                success: false,
                message: "Slug already exists".to_string(),
            }),
        );
    }

    let tenant_oid = match &payload.tenant_id {
        Some(t) => ObjectId::parse_str(t).ok(),
        None => None,
    };
    let now = Utc::now();
    let title_for_translate = payload.title.clone();
    let content_for_translate = payload.content.clone();
    let category_for_translate = payload.category.clone().unwrap_or_default();
    let meta_title_for_translate = payload.meta_title.clone().unwrap_or_default();
    let meta_desc_for_translate = payload.meta_description.clone().unwrap_or_default();
    let news = News {
        id: None,
        tenant_id: tenant_oid,
        title: payload.title,
        slug: payload.slug,
        content: payload.content,
        featured_image: payload.featured_image,
        category: payload.category,
        status: payload.status,
        published_at: payload.published_at,
        meta_title: payload.meta_title,
        meta_description: payload.meta_description,
        created_at: now,
        updated_at: now,
    };
    match coll.insert_one(news, None).await {
        Ok(res) => {
            if let Some(nid) = res.inserted_id.as_object_id() {
                let db_clone = db.clone();
                let source_id = nid.to_hex();
                let langs: Vec<String> = get_supported_languages()
                    .iter()
                    .map(|l| l.to_string())
                    .collect();
                tokio::spawn(async move {
                    register_and_pretranslate(
                        &db_clone,
                        "news.title",
                        &source_id,
                        &title_for_translate,
                        &langs,
                    )
                    .await;
                    register_and_pretranslate(
                        &db_clone,
                        "news.content",
                        &source_id,
                        &content_for_translate,
                        &langs,
                    )
                    .await;
                    if !category_for_translate.trim().is_empty() {
                        register_and_pretranslate(
                            &db_clone,
                            "news.category",
                            &source_id,
                            &category_for_translate,
                            &langs,
                        )
                        .await;
                    }
                    if !meta_title_for_translate.trim().is_empty() {
                        register_and_pretranslate(
                            &db_clone,
                            "news.meta_title",
                            &source_id,
                            &meta_title_for_translate,
                            &langs,
                        )
                        .await;
                    }
                    if !meta_desc_for_translate.trim().is_empty() {
                        register_and_pretranslate(
                            &db_clone,
                            "news.meta_description",
                            &source_id,
                            &meta_desc_for_translate,
                            &langs,
                        )
                        .await;
                    }
                });
            }
            (
                StatusCode::CREATED,
                Json(NewsResponse {
                    success: true,
                    message: "News created".to_string(),
                }),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(NewsResponse {
                success: false,
                message: "Create failed".to_string(),
            }),
        ),
    }
}

#[derive(Debug, Deserialize)]
pub struct UpdateNewsRequest {
    pub title: Option<String>,
    pub slug: Option<String>,
    pub content: Option<String>,
    pub featured_image: Option<String>,
    pub category: Option<String>,
    pub status: Option<NewsStatus>,
    pub published_at: Option<DateTime<Utc>>,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub tenant_id: Option<String>,
}

pub async fn update_news(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<UpdateNewsRequest>,
) -> (StatusCode, Json<NewsResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(NewsResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }
    let coll = db.collection::<News>("news");
    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(NewsResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    // slug uniqueness if changed
    if let Some(new_slug) = &payload.slug {
        let mut filter = doc! { "slug": new_slug, "_id": { "$ne": oid } };
        if let Some(tid) = &payload.tenant_id {
            if let Ok(tenant_oid) = ObjectId::parse_str(tid) {
                filter.insert("tenant_id", tenant_oid);
            }
        }
        if let Ok(Some(_)) = coll.find_one(filter, None).await {
            return (
                StatusCode::CONFLICT,
                Json(NewsResponse {
                    success: false,
                    message: "Slug already exists".to_string(),
                }),
            );
        }
    }

    let mut set = doc! { "updated_at": Utc::now() };
    if let Some(v) = payload.title {
        set.insert("title", v);
    }
    if let Some(v) = payload.slug {
        set.insert("slug", v);
    }
    if let Some(v) = payload.content {
        set.insert("content", v);
    }
    if let Some(v) = payload.featured_image {
        set.insert("featured_image", v);
    }
    if let Some(v) = payload.category {
        set.insert("category", v);
    }
    if let Some(v) = payload.status {
        set.insert("status", to_bson(&v).unwrap());
        if payload.published_at.is_none() {
            match v {
                NewsStatus::Published => {
                    set.insert("published_at", Utc::now());
                }
                NewsStatus::Draft => {
                    set.insert("published_at", bson::Bson::Null);
                }
            }
        }
    }
    if let Some(v) = payload.published_at {
        set.insert("published_at", v);
    }
    if let Some(v) = payload.meta_title {
        set.insert("meta_title", v);
    }
    if let Some(v) = payload.meta_description {
        set.insert("meta_description", v);
    }
    if let Some(v) = payload.tenant_id {
        if let Ok(tenant_oid) = ObjectId::parse_str(&v) {
            set.insert("tenant_id", tenant_oid);
        }
    }

    match coll
        .update_one(doc! { "_id": oid }, doc! { "$set": set }, None)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(NewsResponse {
                success: true,
                message: "News updated".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(NewsResponse {
                success: false,
                message: "Update failed".to_string(),
            }),
        ),
    }
}

pub async fn delete_news(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<NewsResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(NewsResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }
    let coll = db.collection::<News>("news");
    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(NewsResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };
    match coll.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => (
            StatusCode::OK,
            Json(NewsResponse {
                success: true,
                message: "News deleted".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(NewsResponse {
                success: false,
                message: "Delete failed".to_string(),
            }),
        ),
    }
}

pub async fn admin_export_news(
    State(db): State<Database>,
    _claims: Claims,
    Query(q): Query<AdminNewsQuery>,
) -> Response {
    let coll = db.collection::<News>("news");
    let mut filter = doc! {};
    if let Some(status) = &q.status {
        let s = status.to_lowercase();
        if s == "draft" || s == "published" {
            filter.insert("status", s);
        }
    }
    if let Some(cat) = &q.category {
        if !cat.is_empty() {
            filter.insert("category", cat);
        }
    }
    if let Some(search) = &q.search {
        if !search.trim().is_empty() {
            let regex = mongodb::bson::Regex {
                pattern: search.clone(),
                options: "i".to_string(),
            };
            filter.insert(
                "$or",
                vec![
                    doc! { "title": { "$regex": regex.clone() } },
                    doc! { "slug": { "$regex": regex } },
                ],
            );
        }
    }
    let find_opts = FindOptions::builder()
        .sort(Some(doc! { "updated_at": -1 }))
        .build();
    let mut cursor = coll.find(filter, find_opts).await.ok().unwrap();
    let mut csv = String::new();
    csv.push_str("Title,Slug,Category,Status,Published At\n");
    while let Some(Ok(n)) = cursor.next().await {
        let title = n.title.replace('"', "\"\"");
        let slug = n.slug.replace('"', "\"\"");
        let category = n.category.unwrap_or_default().replace('"', "\"\"");
        let status = match n.status {
            NewsStatus::Draft => "draft",
            NewsStatus::Published => "published",
        };
        let published_at = n
            .published_at
            .map(|d| d.to_rfc3339())
            .unwrap_or_default()
            .replace('"', "\"\"");
        let line = format!(
            "\"{}\",\"{}\",\"{}\",\"{}\",\"{}\"\n",
            title, slug, category, status, published_at
        );
        csv.push_str(&line);
    }
    let headers = AppendHeaders([
        ("Content-Type", "text/csv; charset=utf-8"),
        ("Content-Disposition", "attachment; filename=\"news.csv\""),
    ]);
    (headers, csv).into_response()
}
pub async fn admin_get_news_by_slug(
    State(db): State<Database>,
    _claims: Claims,
    Path(slug): Path<String>,
) -> (StatusCode, Json<Option<NewsDetail>>) {
    let coll = db.collection::<News>("news");
    let filter = doc! { "slug": &slug };
    match coll.find_one(filter, None).await {
        Ok(Some(n)) => (
            StatusCode::OK,
            Json(Some(NewsDetail {
                id: n.id.unwrap().to_hex(),
                title: n.title,
                slug: n.slug,
                content: n.content,
                featured_image: n.featured_image,
                category: n.category,
                meta_title: n.meta_title,
                meta_description: n.meta_description,
                published_at: n.published_at,
                status: n.status,
            })),
        ),
        Ok(None) => (StatusCode::NOT_FOUND, Json(None)),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(None)),
    }
}
