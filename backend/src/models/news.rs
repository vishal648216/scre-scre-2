use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crate::models::serde_helpers::{flexible_datetime, optional_flexible_datetime};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum NewsStatus {
    Draft,
    Published,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct News {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub tenant_id: Option<ObjectId>,
    pub title: String,
    pub slug: String,
    pub content: String,
    pub featured_image: Option<String>,
    pub category: Option<String>,
    pub status: NewsStatus,
    #[serde(with = "optional_flexible_datetime")]
    pub published_at: Option<DateTime<Utc>>,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    #[serde(with = "flexible_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "flexible_datetime")]
    pub updated_at: DateTime<Utc>,
}
