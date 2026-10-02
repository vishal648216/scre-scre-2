use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CourseCategory {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    /// Canonical key in MongoDB is `category_code`; older clients or imports may use `categoryCode` or `code`.
    #[serde(alias = "categoryCode", alias = "code")]
    pub category_code: String,
    pub description: Option<String>,
    pub status: String, // "active", "inactive"
    pub created_at: DateTime<Utc>,
    #[serde(default, alias = "imageUrl", alias = "image")]
    pub image_url: Option<String>,
    #[serde(default = "default_sort_order")]
    pub sort_order: i32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_by_center_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_by_center_name: Option<String>,
}

fn default_sort_order() -> i32 {
    0
}
