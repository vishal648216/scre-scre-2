use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CourseSubject {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub course_id: ObjectId,
    pub subject_id: ObjectId,
    pub subject_order: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Session {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub course_id: ObjectId, // Linked to a specific course
    pub session_name: String,
    #[serde(with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub start_date: DateTime<Utc>,
    #[serde(with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub end_date: DateTime<Utc>,
    pub status: String, // "active", "archived"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StudyMaterial {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub subject_id: ObjectId,
    pub title: String,
    pub description: Option<String>,
    pub file_url: String,
    pub uploaded_by: ObjectId,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub class_level: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chapter_name: Option<String>,
    #[serde(with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    #[serde(default = "chrono::Utc::now")]
    pub created_at: DateTime<Utc>,
}
