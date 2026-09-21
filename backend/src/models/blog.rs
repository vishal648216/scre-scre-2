use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crate::models::serde_helpers::{flexible_datetime, optional_flexible_datetime};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum BlogStatus {
    Draft,
    Published,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Blog {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub tenant_id: Option<ObjectId>, // None means global
    pub title: String,
    pub slug: String,
    pub content: String,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub featured_image: Option<String>,
    pub video_url: Option<String>, // For youtube clips
    pub status: BlogStatus,
    #[serde(with = "optional_flexible_datetime")]
    pub published_at: Option<DateTime<Utc>>,
    pub categories: Option<Vec<String>>,
    pub authors: Option<Vec<String>>,
    pub lang: Option<String>, // e.g. "en"
    pub created_by: ObjectId,
    #[serde(with = "flexible_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "flexible_datetime")]
    pub updated_at: DateTime<Utc>,
    pub views: u64,
    #[serde(default = "default_false")]
    pub featured: bool,
}

fn default_false() -> bool {
    false
}
