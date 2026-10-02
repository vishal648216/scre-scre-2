use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LiveClass {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub title: String,
    pub description: Option<String>,
    /// Platform: "youtube" | "youtube_channel" | "youtube_playlist" | "video_file" | "google_meet" | "zoom" | "other"
    pub platform: String,
    /// The join URL (YouTube link, Channel URL, Playlist link, MP4 video link)
    pub join_url: String,
    /// Optional course this class is for
    pub course_id: Option<ObjectId>,
    /// The center hosting this class
    pub center_id: ObjectId,
    /// Scheduled start time (UTC)
    pub scheduled_at: DateTime<Utc>,
    /// Duration in minutes
    pub duration_minutes: i32,
    /// "upcoming" | "ongoing" | "completed" | "cancelled" | "hidden"
    pub status: String,
    /// Who created this (center user _id)
    pub created_by: ObjectId,
    #[serde(with = "crate::models::serde_helpers::rfc3339_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_hidden: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub center_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subject_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instructor_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail_url: Option<String>,

    // --- Plan B Masterclass Hub Extensions ---
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>, // "youtube_channel_sync" | "mp4_chapter_vault" | "center_broadcast"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chapter_title: Option<String>, // Module / Chapter Title
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sequence_order: Option<i32>, // 1, 2, 3...
    #[serde(skip_serializing_if = "Option::is_none")]
    pub keyword: Option<String>, // Keyword filter for channel sync
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pdf_attachment_url: Option<String>, // PDF Notes Link
    #[serde(skip_serializing_if = "Option::is_none")]
    pub visibility_state: Option<String>, // "published" | "center_scoped" | "hidden"

    // --- Multi-Audience Meeting Engine Extensions ---
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meeting_type: Option<String>, // "academic_class" | "ptm_parent_meeting" | "staff_director_meeting"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_audience: Option<String>, // "all_students" | "course_students" | "batch_students" | "parents_students" | "center_staff" | "all_center_directors"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_instant: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub joined_count: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLiveClassPayload {
    pub title: String,
    pub description: Option<String>,
    pub platform: Option<String>,
    pub join_url: Option<String>,
    pub course_id: Option<String>,
    pub center_id: Option<String>,
    pub scheduled_at: Option<String>, // ISO8601 string from frontend
    pub duration_minutes: Option<i32>,
    pub is_hidden: Option<bool>,
    pub center_name: Option<String>,
    pub subject_name: Option<String>,
    pub instructor_name: Option<String>,
    pub thumbnail_url: Option<String>,

    // Plan B Extensions
    pub mode: Option<String>,
    pub chapter_title: Option<String>,
    pub sequence_order: Option<i32>,
    pub keyword: Option<String>,
    pub pdf_attachment_url: Option<String>,
    pub visibility_state: Option<String>,

    // Multi-Audience Meeting Extensions
    pub meeting_type: Option<String>,
    pub target_audience: Option<String>,
    pub is_instant: Option<bool>,
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
    pub is_hidden: Option<bool>,
    pub center_name: Option<String>,
    pub subject_name: Option<String>,
    pub instructor_name: Option<String>,
    pub thumbnail_url: Option<String>,

    // Plan B Extensions
    pub mode: Option<String>,
    pub chapter_title: Option<String>,
    pub sequence_order: Option<i32>,
    pub keyword: Option<String>,
    pub pdf_attachment_url: Option<String>,
    pub visibility_state: Option<String>,

    // Multi-Audience Meeting Extensions
    pub meeting_type: Option<String>,
    pub target_audience: Option<String>,
    pub is_instant: Option<bool>,
    pub joined_count: Option<i32>,
}
