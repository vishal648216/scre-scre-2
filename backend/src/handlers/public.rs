use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use mongodb::{Database, bson::doc};
use serde::Serialize;
use crate::handlers::course::{fetch_courses_list, CourseQuery, CourseListItem};
use crate::handlers::course_categories::CategoryListItem;
use crate::models::course_category::CourseCategory;
use crate::handlers::center::PublicCenter;
use crate::models::center::Center;
use crate::models::user::User;
use futures_util::stream::StreamExt;
use std::sync::RwLock;
use std::time::{Instant, Duration};
use once_cell::sync::Lazy;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HomeDataResponse {
    pub courses: Vec<CourseListItem>,
    pub categories: Vec<CategoryListItem>,
    pub centers: Vec<PublicCenter>,
    pub stats: HomeStats,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HomeStats {
    pub total_centers: u64,
    pub total_students: u64,
    pub total_courses: u64,
}

struct Cache {
    data: Option<HomeDataResponse>,
    last_updated: Instant,
}

static HOME_DATA_CACHE: Lazy<RwLock<Cache>> = Lazy::new(|| {
    RwLock::new(Cache {
        data: None,
        last_updated: Instant::now() - Duration::from_secs(3600), // Force initial fetch
    })
});

const CACHE_DURATION: Duration = Duration::from_secs(600); // 10 minutes

pub async fn get_home_data(
    State(db): State<Database>,
) -> (StatusCode, Json<HomeDataResponse>) {
    // 1. Check cache
    if let Ok(cache) = HOME_DATA_CACHE.read() {
        if let Some(data) = &cache.data {
            if cache.last_updated.elapsed() < CACHE_DURATION {
                return (StatusCode::OK, Json(data.clone()));
            }
        }
    }

    // 2. Fetch fresh data
    // Featured courses
    let course_query = CourseQuery {
        featured_on_home: Some(true),
        status: Some("Active".to_string()),
        ..Default::default()
    };
    let courses = fetch_courses_list(&db, &course_query).await;

    // Categories
    let cat_coll = db.collection::<CourseCategory>("course_categories");
    let mut categories = Vec::new();
    if let Ok(mut cat_cursor) = cat_coll.find(doc! { "status": "Active" }, None).await {
        while let Some(res) = cat_cursor.next().await {
            if let Ok(c) = res {
                if let Some(cid) = c.id {
                    categories.push(CategoryListItem {
                        id: cid.to_hex(),
                        name: c.name,
                        category_code: c.category_code,
                        description: c.description,
                        status: c.status,
                        created_at: c.created_at,
                        image_url: c.image_url,
                        sort_order: c.sort_order,
                    });
                }
            }
        }
    }

    // Centers (limit 6)
    let center_coll = db.collection::<Center>("centers");
    let mut centers = Vec::new();
    if let Ok(mut center_cursor) = center_coll.find(doc! { "active": true, "is_deleted": false }, None).await {
        while let Some(res) = center_cursor.next().await {
            if let Ok(c) = res {
                centers.push(PublicCenter::from(c));
                if centers.len() >= 6 {
                    break;
                }
            }
        }
    }

    // Stats
    let user_coll = db.collection::<User>("users");
    let total_centers = user_coll
        .count_documents(doc! { "role": "center" }, None)
        .await
        .unwrap_or(0);
    let total_students = user_coll
        .count_documents(doc! { "role": "student" }, None)
        .await
        .unwrap_or(0);
    let total_courses = db
        .collection::<mongodb::bson::Document>("courses")
        .count_documents(doc! { "status": "Active" }, None)
        .await
        .unwrap_or(0);

    let fresh_data = HomeDataResponse {
        courses,
        categories,
        centers,
        stats: HomeStats {
            total_centers,
            total_students,
            total_courses,
        },
    };

    // 3. Update cache
    if let Ok(mut cache) = HOME_DATA_CACHE.write() {
        cache.data = Some(fresh_data.clone());
        cache.last_updated = Instant::now();
    }

    (StatusCode::OK, Json(fresh_data))
}
