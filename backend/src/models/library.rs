use mongodb::bson::{oid::ObjectId, DateTime};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Book {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub title: String,
    pub author: String,
    pub category: String, // e.g. "Programming", "Accounting", "General", "Reference"
    pub description: Option<String>,
    pub cover_url: Option<String>,
    pub pdf_url: Option<String>,
    pub total_pages: Option<i32>,
    #[serde(default = "default_published")]
    pub is_published: bool,
    pub course_id: Option<ObjectId>,
    #[serde(rename = "created_at", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<DateTime>,
    #[serde(rename = "updated_at", skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<DateTime>,
}

fn default_published() -> bool {
    true
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BookReadingRecord {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub student_id: ObjectId,
    pub book_id: ObjectId,
    pub total_seconds_read: i64,
    pub last_page: i32,
    pub last_read_at: DateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BookPayload {
    pub title: String,
    pub author: String,
    pub category: String,
    pub description: Option<String>,
    pub cover_url: Option<String>,
    pub pdf_url: Option<String>,
    pub total_pages: Option<i32>,
    pub is_published: Option<bool>,
    pub course_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReadingHeartbeatPayload {
    pub book_id: String,
    pub seconds: i64,
    pub current_page: Option<i32>,
}
