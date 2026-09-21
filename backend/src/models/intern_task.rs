
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InternTask {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub intern_id: ObjectId,
    pub title: String,
    pub description: String,
    pub status: String, // pending, in_progress, completed
    pub assigned_by: ObjectId,
    pub assigned_at: DateTime<Utc>,
    pub due_date: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub remarks: Option<String>,
}
