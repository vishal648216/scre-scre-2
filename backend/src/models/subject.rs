use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Subject {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub subject_name: String,
    pub subject_code: String,
    pub description: Option<String>,
    pub status: String, // "active", "inactive"
    #[serde(with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    #[serde(default = "chrono::Utc::now")]
    pub created_at: DateTime<Utc>,
}
