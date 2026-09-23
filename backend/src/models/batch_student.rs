use chrono::{DateTime, Utc};
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BatchStudent {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    pub batch_id: ObjectId,
    pub student_id: ObjectId,
    pub center_id: ObjectId,

    #[serde(default)]
    pub session_id: Option<ObjectId>,
    #[serde(default)]
    pub course_id: Option<ObjectId>,

    #[serde(default)]
    pub status: String, // "active" | "removed"

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}