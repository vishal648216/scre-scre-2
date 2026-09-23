use axum::response::AppendHeaders;
use axum::response::{IntoResponse, Response};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use chrono::{DateTime, Utc};
use futures_util::stream::StreamExt;
use mongodb::bson::to_bson;
use mongodb::options::FindOptions;
use mongodb::{
    Database,
    bson::{self, doc, oid::ObjectId},
};
use serde::{Deserialize, Serialize};

use crate::config::languages::get_supported_languages;
use crate::handlers::activity_logs::insert_log;
use crate::models::blog::{Blog, BlogStatus};
use crate::models::news::{News, NewsStatus};
use crate::models::serde_helpers::{optional_rfc3339_datetime, rfc3339_datetime};
use crate::models::user::{Claims, UserRole};
use crate::services::translation_service::register_and_pretranslate;

#[derive(Debug, Deserialize)]
pub struct AdminBlogQuery {
    pub status: Option<String>,
    pub lang: Option<String>,
    pub search: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct BlogQuery {
    pub category: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub lang: Option<String>,
    pub tenant_id: Option<String>, // optional tenant filter
    pub search: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BlogListItem {
    pub title: String,
    pub slug: String,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub featured_image: Option<String>,
    pub video_url: Option<String>,
    #[serde(with = "optional_rfc3339_datetime")]
    pub published_at: Option<DateTime<Utc>>,
    pub categories: Option<Vec<String>>,
    pub status: BlogStatus,
    pub featured: bool,
}

#[derive(Debug, Serialize)]
pub struct AdminBlogListItem {
    pub id: String,
    pub title: String,
    pub slug: String,
    #[serde(with = "optional_rfc3339_datetime")]
    pub published_at: Option<DateTime<Utc>>,
    pub categories: Option<Vec<String>>,
    pub status: BlogStatus,
    pub lang: Option<String>,
    pub featured: bool,
}

#[derive(Debug, Serialize)]
pub struct AdminBlogListResponse {
    pub items: Vec<AdminBlogListItem>,
    pub total: u64,
    pub page: u32,
    pub limit: u32,
}

use crate::services::translation_service::{get_translation, normalize_lang};

pub async fn list_blogs(
    State(db): State<Database>,
    Query(q): Query<BlogQuery>,
) -> (StatusCode, Json<Vec<BlogListItem>>) {
    let coll = db.collection::<Blog>("blogs");
    let mut filter = doc! { "status": "published" };

    // Use lang as translation target, not as a filter
    let lang = q.lang.as_ref().map(|l| normalize_lang(l));

    if let Some(cat) = q.category {
        filter.insert("categories", doc! { "$in": [cat] });
    }
    if let Some(tid) = q.tenant_id {
        if let Ok(oid) = ObjectId::parse_str(&tid) {
            filter.insert("tenant_id", oid);
        }
    }

    let published_or_filter = vec![
        doc! { "published_at": { "$lte": Utc::now() } },
        doc! { "published_at": { "$exists": false } },
        doc! { "published_at": bson::Bson::Null },
    ];

    if let Some(search) = &q.search {
        if !search.trim().is_empty() {
            let regex = mongodb::bson::Regex {
                pattern: search.clone(),
                options: "i".to_string(),
            };
            // Combine published_or and search_or with $and
            filter.insert(
                "$and",
                vec![
                    doc! { "$or": published_or_filter },
                    doc! {
                        "$or": [
                            { "title": { "$regex": regex.clone() } },
                            { "slug": { "$regex": regex.clone() } },
                            { "content": { "$regex": regex.clone() } },
                            { "categories": { "$regex": regex } }
                        ]
                    },
                ],
            );
            println!("DEBUG: Search query: {}, filter: {:?}", search, filter);
        } else {
            filter.insert("$or", published_or_filter);
        }
    } else {
        filter.insert("$or", published_or_filter);
    }

    let limit = q.limit.unwrap_or(10) as i64;
    let skip = ((q.page.unwrap_or(1).saturating_sub(1)) as u64) * (limit as u64);
    let find_opts = FindOptions::builder()
        .limit(Some(limit))
        .skip(Some(skip))
        .sort(Some(doc! { "featured": -1, "published_at": -1 }))
        .build();

    let mut cursor = match coll.find(filter, find_opts).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };
    let mut items = Vec::new();
    while let Some(res) = cursor.next().await {
        if let Ok(b) = res {
            let mut title = b.title;
            let mut meta_description = b.meta_description;
            let mut categories = b.categories;

            if let Some(target_lang) = &lang {
                if target_lang != "en" {
                    title = get_translation(&db, &title, target_lang)
                        .await
                        .unwrap_or_else(|_| title);
                    if let Some(md) = meta_description {
                        meta_description = Some(
                            get_translation(&db, &md, target_lang)
                                .await
                                .unwrap_or_else(|_| md),
                        );
                    }
                    if let Some(cats) = categories {
                        let mut trans_cats = Vec::new();
                        for c in cats {
                            trans_cats.push(
                                get_translation(&db, &c, target_lang)
                                    .await
                                    .unwrap_or_else(|_| c),
                            );
                        }
                        categories = Some(trans_cats);
                    }
                }
            }

            items.push(BlogListItem {
                title,
                slug: b.slug,
                meta_title: b.meta_title,
                meta_description,
                featured_image: b.featured_image,
                video_url: b.video_url,
                published_at: b.published_at,
                categories,
                status: b.status,
                featured: b.featured,
            });
        }
    }
    (StatusCode::OK, Json(items))
}

pub async fn admin_list_blogs(
    State(db): State<Database>,
    _claims: Claims,
    Query(q): Query<AdminBlogQuery>,
) -> (StatusCode, Json<AdminBlogListResponse>) {
    let coll = db.collection::<Blog>("blogs");
    let mut filter = doc! {};
    if let Some(status) = &q.status {
        let s = status.to_lowercase();
        if s == "draft" || s == "published" {
            filter.insert("status", s);
        }
    }
    if let Some(lang) = &q.lang {
        if !lang.is_empty() {
            filter.insert("lang", lang);
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
                Json(AdminBlogListResponse {
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
        if let Ok(b) = res {
            if let Some(id) = b.id {
                items.push(AdminBlogListItem {
                    id: id.to_hex(),
                    title: b.title,
                    slug: b.slug,
                    published_at: b.published_at,
                    categories: b.categories,
                    status: b.status,
                    lang: b.lang,
                    featured: b.featured,
                });
            }
        }
    }
    (
        StatusCode::OK,
        Json(AdminBlogListResponse {
            items,
            total,
            page,
            limit: limit_u32,
        }),
    )
}

pub async fn admin_export_blogs(
    State(db): State<Database>,
    _claims: Claims,
    Query(q): Query<AdminBlogQuery>,
) -> Response {
    let coll = db.collection::<Blog>("blogs");
    let mut filter = doc! {};
    if let Some(status) = &q.status {
        let s = status.to_lowercase();
        if s == "draft" || s == "published" {
            filter.insert("status", s);
        }
    }
    if let Some(lang) = &q.lang {
        if !lang.is_empty() {
            filter.insert("lang", lang);
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
    csv.push_str("Title,Slug,Status,Lang,Categories,Published At\n");
    while let Some(Ok(b)) = cursor.next().await {
        let title = b.title.replace('"', "\"\"");
        let slug = b.slug.replace('"', "\"\"");
        let status = match b.status {
            BlogStatus::Draft => "draft",
            BlogStatus::Published => "published",
        };
        let lang = b.lang.unwrap_or_default().replace('"', "\"\"");
        let categories = b.categories.unwrap_or_default().join(";");
        let published_at = b.published_at.map(|d| d.to_rfc3339()).unwrap_or_default();
        let line = format!(
            "\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\"\n",
            title,
            slug,
            status,
            lang,
            categories.replace('"', "\"\""),
            published_at.replace('"', "\"\"")
        );
        csv.push_str(&line);
    }
    let headers = AppendHeaders([
        ("Content-Type", "text/csv; charset=utf-8"),
        ("Content-Disposition", "attachment; filename=\"blogs.csv\""),
    ]);
    (headers, csv).into_response()
}
pub async fn rss_feed(State(db): State<Database>) -> Response {
    let coll = db.collection::<Blog>("blogs");
    let mut items: Vec<BlogListItem> = Vec::new();
    let mut cursor = coll
        .find(
            doc! {
                "status": "published",
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
    while let Some(Ok(b)) = cursor.next().await {
        items.push(BlogListItem {
            title: b.title,
            slug: b.slug,
            meta_title: b.meta_title,
            meta_description: b.meta_description,
            featured_image: b.featured_image,
            video_url: b.video_url,
            published_at: b.published_at,
            categories: b.categories,
            status: b.status,
            featured: b.featured,
        });
    }
    let site_url =
        std::env::var("PUBLIC_SITE_URL").unwrap_or_else(|_| "http://localhost:8086".to_string());
    let channel_title = "Latest Insights";
    let channel_link = format!("{}/blog", site_url);
    let channel_desc = "Latest published articles";
    let mut xml = String::new();
    xml.push_str(r#"<?xml version="1.0" encoding="UTF-8"?>"#);
    xml.push_str("<rss version=\"2.0\"><channel>");
    xml.push_str(&format!(
        "<title>{}</title><link>{}</link><description>{}</description>",
        channel_title, channel_link, channel_desc
    ));
    for it in items {
        let link = format!("{}/blog/{}", site_url, it.slug);
        let title = it.title;
        let description = it.meta_description.unwrap_or_default();
        let pub_date = it.published_at.map(|d| d.to_rfc2822()).unwrap_or_default();
        xml.push_str("<item>");
        xml.push_str(&format!("<title>{}</title>", xml_escape(&title)));
        xml.push_str(&format!("<link>{}</link>", xml_escape(&link)));
        xml.push_str(&format!(
            "<description>{}</description>",
            xml_escape(&description)
        ));
        xml.push_str(&format!("<pubDate>{}</pubDate>", xml_escape(&pub_date)));
        xml.push_str("</item>");
    }
    xml.push_str("</channel></rss>");
    Response::builder()
        .header("Content-Type", "application/rss+xml; charset=utf-8")
        .body(xml.into())
        .unwrap()
}

pub async fn sitemap_xml(State(db): State<Database>) -> Response {
    let site_url =
        std::env::var("PUBLIC_SITE_URL").unwrap_or_else(|_| "http://localhost:8086".to_string());
    let blog_coll = db.collection::<Blog>("blogs");
    let news_coll = db.collection::<News>("news");

    let mut urls: Vec<(String, Option<DateTime<Utc>>)> = Vec::new();

    // Blogs
    let mut bcursor = blog_coll
        .find(
            doc! { "status": "published", "published_at": { "$lte": Utc::now() } },
            FindOptions::builder().projection(None).build(),
        )
        .await
        .ok()
        .unwrap();
    while let Some(Ok(b)) = bcursor.next().await {
        urls.push((format!("{}/blog/{}", site_url, b.slug), b.published_at));
    }

    // News
    let mut ncursor = news_coll
        .find(
            doc! { "status": to_bson(&NewsStatus::Published).unwrap(), "published_at": { "$lte": Utc::now() } },
            FindOptions::builder().projection(None).build(),
        )
        .await
        .ok()
        .unwrap();
    while let Some(Ok(n)) = ncursor.next().await {
        urls.push((format!("{}/news/{}", site_url, n.slug), n.published_at));
    }

    let mut xml = String::new();
    xml.push_str(r#"<?xml version="1.0" encoding="UTF-8"?>"#);
    xml.push_str(r#"<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">"#);
    xml.push_str(&format!(
        r#"<url><loc>{}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>"#,
        site_url
    ));
    xml.push_str(&format!(
        r#"<url><loc>{}/blog</loc><changefreq>daily</changefreq><priority>0.8</priority></url>"#,
        site_url
    ));
    xml.push_str(&format!(
        r#"<url><loc>{}/news</loc><changefreq>daily</changefreq><priority>0.8</priority></url>"#,
        site_url
    ));
    for (loc, lastmod) in urls {
        let last = lastmod.map(|d| d.to_rfc3339()).unwrap_or_default();
        if last.is_empty() {
            xml.push_str(&format!(r#"<url><loc>{}</loc></url>"#, loc));
        } else {
            xml.push_str(&format!(
                r#"<url><loc>{}</loc><lastmod>{}</lastmod></url>"#,
                loc, last
            ));
        }
    }
    xml.push_str("</urlset>");
    Response::builder()
        .header("Content-Type", "application/xml; charset=utf-8")
        .body(xml.into())
        .unwrap()
}
fn xml_escape(s: &str) -> String {
    s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
}
#[derive(Debug, Serialize)]
pub struct BlogDetail {
    pub id: String,
    pub title: String,
    pub slug: String,
    pub content: String,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub featured_image: Option<String>,
    #[serde(with = "optional_rfc3339_datetime")]
    pub published_at: Option<DateTime<Utc>>,
    pub categories: Option<Vec<String>>,
    pub authors: Option<Vec<String>>,
    pub status: BlogStatus,
    pub lang: Option<String>,
    pub featured: bool,
}

pub async fn get_blog_by_slug(
    State(db): State<Database>,
    Path(slug): Path<String>,
    Query(q): Query<BlogQuery>,
) -> (StatusCode, Json<Option<BlogDetail>>) {
    let coll = db.collection::<Blog>("blogs");
    let mut filter = doc! {
        "slug": &slug,
        "status": "published",
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
        Ok(Some(b)) => {
            // increment views
            let bid = b.id.unwrap();
            let _ = coll
                .update_one(
                    doc! { "_id": &bid },
                    doc! { "$inc": { "views": 1i64 } },
                    None,
                )
                .await;

            let mut title = b.title;
            let mut content = b.content;
            let mut meta_description = b.meta_description;
            let mut categories = b.categories;

            if let Some(target_lang) = &lang {
                if target_lang != "en" {
                    title = get_translation(&db, &title, target_lang)
                        .await
                        .unwrap_or_else(|_| title);
                    content = get_translation(&db, &content, target_lang)
                        .await
                        .unwrap_or_else(|_| content);
                    if let Some(md) = meta_description {
                        meta_description = Some(
                            get_translation(&db, &md, target_lang)
                                .await
                                .unwrap_or_else(|_| md),
                        );
                    }
                    if let Some(cats) = categories {
                        let mut trans_cats = Vec::new();
                        for c in cats {
                            trans_cats.push(
                                get_translation(&db, &c, target_lang)
                                    .await
                                    .unwrap_or_else(|_| c),
                            );
                        }
                        categories = Some(trans_cats);
                    }
                }
            }

            (
                StatusCode::OK,
                Json(Some(BlogDetail {
                    id: bid.to_hex(),
                    title,
                    slug: b.slug,
                    content,
                    meta_title: b.meta_title,
                    meta_description,
                    featured_image: b.featured_image,
                    published_at: b.published_at,
                    categories,
                    authors: b.authors,
                    status: b.status,
                    lang: b.lang,
                    featured: b.featured,
                })),
            )
        }
        Ok(None) => (StatusCode::NOT_FOUND, Json(None)),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(None)),
    }
}

pub async fn admin_get_blog_by_slug(
    State(db): State<Database>,
    _claims: Claims,
    Path(slug): Path<String>,
) -> (StatusCode, Json<Option<BlogDetail>>) {
    let coll = db.collection::<Blog>("blogs");
    let filter = doc! { "slug": &slug };
    match coll.find_one(filter, None).await {
        Ok(Some(b)) => (
            StatusCode::OK,
            Json(Some(BlogDetail {
                id: b.id.unwrap().to_hex(),
                title: b.title,
                slug: b.slug,
                content: b.content,
                meta_title: b.meta_title,
                meta_description: b.meta_description,
                featured_image: b.featured_image,
                published_at: b.published_at,
                categories: b.categories,
                authors: b.authors,
                status: b.status,
                lang: b.lang,
                featured: b.featured,
            })),
        ),
        Ok(None) => (StatusCode::NOT_FOUND, Json(None)),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(None)),
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateBlogRequest {
    pub tenant_id: Option<String>,
    pub title: String,
    pub slug: String,
    pub content: String,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub featured_image: Option<String>,
    pub video_url: Option<String>,
    pub status: BlogStatus,
    pub published_at: Option<DateTime<Utc>>,
    pub categories: Option<Vec<String>>,
    pub authors: Option<Vec<String>>,
    pub lang: Option<String>,
    pub featured: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct BlogResponse {
    pub success: bool,
    pub message: String,
}

pub async fn create_blog(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateBlogRequest>,
) -> (StatusCode, Json<BlogResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(BlogResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }
    let coll = db.collection::<Blog>("blogs");

    // slug uniqueness within tenant + lang
    let mut filter = doc! { "slug": &payload.slug };
    if let Some(lang) = &payload.lang {
        filter.insert("lang", lang.clone());
    }
    if let Some(tid) = &payload.tenant_id {
        if let Ok(oid) = ObjectId::parse_str(tid) {
            filter.insert("tenant_id", oid);
        }
    }
    if let Ok(Some(_)) = coll.find_one(filter, None).await {
        return (
            StatusCode::CONFLICT,
            Json(BlogResponse {
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
    let meta_title_for_translate = payload.meta_title.clone().unwrap_or_default();
    let meta_desc_for_translate = payload.meta_description.clone().unwrap_or_default();
    let effective_published_at = match (&payload.status, &payload.published_at) {
        (BlogStatus::Published, None) => Some(now),
        _ => payload.published_at,
    };
    let slug_clone = payload.slug.clone();
    let blog = Blog {
        id: None,
        tenant_id: tenant_oid,
        title: payload.title,
        slug: payload.slug,
        content: payload.content,
        meta_title: payload.meta_title,
        meta_description: payload.meta_description,
        featured_image: payload.featured_image,
        video_url: payload.video_url,
        status: payload.status,
        published_at: effective_published_at,
        categories: payload.categories,
        authors: payload.authors,
        lang: payload.lang,
        created_by: ObjectId::parse_str(&claims.sub).unwrap(),
        created_at: now,
        updated_at: now,
        views: 0,
        featured: payload.featured.unwrap_or(false),
    };
    match coll.insert_one(blog, None).await {
        Ok(res) => {
            let bid = res.inserted_id.as_object_id();
            if let Some(bid) = bid {
                insert_log(
                    &db,
                    ObjectId::parse_str(&claims.sub).unwrap(),
                    "create",
                    "blog",
                    Some(bid),
                    Some(format!("slug={}", slug_clone)),
                )
                .await;
                let db_clone = db.clone();
                let source_id = bid.to_hex();
                let langs: Vec<String> = get_supported_languages()
                    .iter()
                    .map(|l| l.to_string())
                    .collect();
                tokio::spawn(async move {
                    register_and_pretranslate(
                        &db_clone,
                        "blog.title",
                        &source_id,
                        &title_for_translate,
                        &langs,
                    )
                    .await;
                    register_and_pretranslate(
                        &db_clone,
                        "blog.content",
                        &source_id,
                        &content_for_translate,
                        &langs,
                    )
                    .await;
                    if !meta_title_for_translate.trim().is_empty() {
                        register_and_pretranslate(
                            &db_clone,
                            "blog.meta_title",
                            &source_id,
                            &meta_title_for_translate,
                            &langs,
                        )
                        .await;
                    }
                    if !meta_desc_for_translate.trim().is_empty() {
                        register_and_pretranslate(
                            &db_clone,
                            "blog.meta_description",
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
                Json(BlogResponse {
                    success: true,
                    message: "Blog created".to_string(),
                }),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(BlogResponse {
                success: false,
                message: "Create failed".to_string(),
            }),
        ),
    }
}

#[derive(Debug, Deserialize)]
pub struct UpdateBlogRequest {
    pub title: Option<String>,
    pub slug: Option<String>,
    pub content: Option<String>,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub featured_image: Option<String>,
    pub video_url: Option<String>,
    pub status: Option<BlogStatus>,
    pub published_at: Option<DateTime<Utc>>,
    pub categories: Option<Vec<String>>,
    pub authors: Option<Vec<String>>,
    pub lang: Option<String>,
    pub tenant_id: Option<String>,
    pub featured: Option<bool>,
}

pub async fn update_blog(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<UpdateBlogRequest>,
) -> (StatusCode, Json<BlogResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(BlogResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }
    let coll = db.collection::<Blog>("blogs");
    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(BlogResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    // slug uniqueness if changed
    if let Some(new_slug) = &payload.slug {
        // Validate slug is not empty
        if new_slug.trim().is_empty() {
            return (
                StatusCode::BAD_REQUEST,
                Json(BlogResponse {
                    success: false,
                    message: "Slug cannot be empty".to_string(),
                }),
            );
        }
        let mut filter = doc! { "slug": new_slug, "_id": { "$ne": oid } };
        if let Some(lang) = &payload.lang {
            filter.insert("lang", lang.clone());
        }
        if let Some(tid) = &payload.tenant_id {
            if let Ok(tenant_oid) = ObjectId::parse_str(tid) {
                filter.insert("tenant_id", tenant_oid);
            }
        }
        if let Ok(Some(_)) = coll.find_one(filter, None).await {
            return (
                StatusCode::CONFLICT,
                Json(BlogResponse {
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
    if let Some(v) = payload.meta_title {
        set.insert("meta_title", v);
    }
    if let Some(v) = payload.meta_description {
        set.insert("meta_description", v);
    }
    if let Some(v) = payload.featured_image {
        set.insert("featured_image", v);
    }
    if let Some(v) = payload.video_url {
        set.insert("video_url", v);
    }
    if let Some(v) = payload.status {
        set.insert("status", to_bson(&v).unwrap());
        if payload.published_at.is_none() {
            match v {
                BlogStatus::Published => {
                    set.insert("published_at", Utc::now());
                }
                BlogStatus::Draft => {
                    set.insert("published_at", bson::Bson::Null);
                }
            }
        }
    }
    if let Some(v) = payload.published_at {
        set.insert("published_at", v);
    }
    if let Some(v) = payload.categories {
        set.insert("categories", v);
    }
    if let Some(v) = payload.authors {
        set.insert("authors", v);
    }
    if let Some(v) = payload.lang {
        set.insert("lang", v);
    }
    if let Some(v) = payload.tenant_id {
        if let Ok(tenant_oid) = ObjectId::parse_str(&v) {
            set.insert("tenant_id", tenant_oid);
        }
    }
    if let Some(v) = payload.featured {
        set.insert("featured", v);
    }

    match coll
        .update_one(doc! { "_id": oid }, doc! { "$set": set }, None)
        .await
    {
        Ok(_) => {
            insert_log(
                &db,
                ObjectId::parse_str(&claims.sub).unwrap(),
                "update",
                "blog",
                Some(oid),
                None,
            )
            .await;
            (
                StatusCode::OK,
                Json(BlogResponse {
                    success: true,
                    message: "Blog updated".to_string(),
                }),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(BlogResponse {
                success: false,
                message: "Update failed".to_string(),
            }),
        ),
    }
}

pub async fn list_featured_blogs(
    State(db): State<Database>,
    Query(q): Query<BlogQuery>,
) -> (StatusCode, Json<Vec<BlogListItem>>) {
    let coll = db.collection::<Blog>("blogs");
    let mut filter = doc! {
        "status": "published",
        "featured": true
    };

    let lang = q.lang.as_ref().map(|l| normalize_lang(l));

    filter.insert(
        "$or",
        vec![
            doc! { "published_at": { "$lte": Utc::now() } },
            doc! { "published_at": { "$exists": false } },
            doc! { "published_at": bson::Bson::Null },
        ],
    );

    let limit = q.limit.unwrap_or(3) as i64;
    let skip = ((q.page.unwrap_or(1).saturating_sub(1)) as u64) * (limit as u64);
    let find_opts = FindOptions::builder()
        .limit(Some(limit))
        .skip(Some(skip))
        .sort(Some(doc! { "published_at": -1 }))
        .build();

    let mut cursor = match coll.find(filter, find_opts).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };
    let mut items = Vec::new();
    while let Some(res) = cursor.next().await {
        if let Ok(b) = res {
            let mut title = b.title;
            let mut meta_description = b.meta_description;
            let mut categories = b.categories;

            if let Some(target_lang) = &lang {
                if target_lang != "en" {
                    title = get_translation(&db, &title, target_lang)
                        .await
                        .unwrap_or_else(|_| title);
                    if let Some(md) = meta_description {
                        meta_description = Some(
                            get_translation(&db, &md, target_lang)
                                .await
                                .unwrap_or_else(|_| md),
                        );
                    }
                    if let Some(cats) = categories {
                        let mut trans_cats = Vec::new();
                        for c in cats {
                            trans_cats.push(
                                get_translation(&db, &c, target_lang)
                                    .await
                                    .unwrap_or_else(|_| c),
                            );
                        }
                        categories = Some(trans_cats);
                    }
                }
            }

            items.push(BlogListItem {
                title,
                slug: b.slug,
                meta_title: b.meta_title,
                meta_description,
                featured_image: b.featured_image,
                video_url: b.video_url,
                published_at: b.published_at,
                categories,
                status: b.status,
                featured: b.featured,
            });
        }
    }
    (StatusCode::OK, Json(items))
}

pub async fn delete_blog(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<BlogResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(BlogResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }
    let coll = db.collection::<Blog>("blogs");
    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(BlogResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };
    match coll.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => {
            insert_log(
                &db,
                ObjectId::parse_str(&claims.sub).unwrap(),
                "delete",
                "blog",
                Some(oid),
                None,
            )
            .await;
            (
                StatusCode::OK,
                Json(BlogResponse {
                    success: true,
                    message: "Blog deleted".to_string(),
                }),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(BlogResponse {
                success: false,
                message: "Delete failed".to_string(),
            }),
        ),
    }
}
