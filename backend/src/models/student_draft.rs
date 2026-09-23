use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StudentDraft {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub center_id: ObjectId,
    pub name: String, // Draft name or student name if provided
    pub data: serde_json::Value, // The full form data as JSON
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
