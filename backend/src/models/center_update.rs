use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crate::models::center::Center;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CenterUpdateRequest {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub center_id: ObjectId,
    pub old_data: Center,
    pub new_data: serde_json::Value, // Store the diff or the full new object
    pub status: String, // "pending", "approved", "rejected"
    pub requested_at: DateTime<Utc>,
    pub processed_at: Option<DateTime<Utc>>,
    pub admin_notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CenterUpdateHistory {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub center_id: ObjectId,
    pub old_state: Center,
    pub new_state: Center,
    pub approved_at: DateTime<Utc>,
    pub approved_by: ObjectId,
}
