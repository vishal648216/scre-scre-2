use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LiveClass {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub title: String,
    pub description: Option<String>,
    /// Platform: "google_meet" | "zoom" | "other"
    pub platform: String,
    /// The join URL (Google Meet link, Zoom link, etc.)
    pub join_url: String,
    /// Optional course this class is for
    pub course_id: Option<ObjectId>,
    /// The center hosting this class
    pub center_id: ObjectId,
    /// Scheduled start time (UTC)
    pub scheduled_at: DateTime<Utc>,
    /// Duration in minutes
    pub duration_minutes: i32,
    /// "upcoming" | "ongoing" | "completed" | "cancelled"
    pub status: String,
    /// Who created this (center user _id)
    pub created_by: ObjectId,
    #[serde(with = "crate::models::serde_helpers::rfc3339_datetime")]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLiveClassPayload {
    pub title: String,
    pub description: Option<String>,
    pub platform: Option<String>,
    pub join_url: String,
    pub course_id: Option<String>,
    pub scheduled_at: String, // ISO8601 string from frontend
    pub duration_minutes: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateLiveClassPayload {
    pub title: Option<String>,
    pub description: Option<String>,
    pub platform: Option<String>,
    pub join_url: Option<String>,
    pub scheduled_at: Option<String>,
    pub duration_minutes: Option<i32>,
    pub status: Option<String>,
}
