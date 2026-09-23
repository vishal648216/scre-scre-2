use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Review {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub student_id: ObjectId,
    pub student_name: String,
    pub student_photo: Option<String>,
    pub rating: i32,
    pub comment: String,
    pub status: String, // "pending", "approved", "rejected"
    #[serde(default = "chrono::Utc::now")]
    pub created_at: DateTime<Utc>,
}
