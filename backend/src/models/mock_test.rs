use chrono::{DateTime, Utc};
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MockTest {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    pub course_id: ObjectId,
    pub subject_id: ObjectId,
    pub blueprint_id: ObjectId,
    /// "active" | "inactive"
    #[serde(default = "default_status")]
    pub status: String,
    pub created_by: ObjectId,
    pub created_at: DateTime<Utc>,
}

fn default_status() -> String {
    "active".to_string()
}
