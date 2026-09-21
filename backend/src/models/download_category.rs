use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadCategory {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    pub description: Option<String>,
    pub order: i32,
    pub active: bool,
    #[serde(default, with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime_optional")]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(default, with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime_optional")]
    pub updated_at: Option<DateTime<Utc>>,
}
