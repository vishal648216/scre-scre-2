use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CenterAssets {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub center_id: ObjectId,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub center_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signature_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stamp_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background_url: Option<String>,
    #[serde(with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub updated_at: DateTime<Utc>,
}
