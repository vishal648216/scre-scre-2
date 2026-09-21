
use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crate::models::serde_helpers::flexible_datetime;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BlogCategory {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    pub slug: String,
    pub tenant_id: Option<ObjectId>, // None means global
    pub lang: Option<String>,
    #[serde(with = "flexible_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "flexible_datetime")]
    pub updated_at: DateTime<Utc>,
}
