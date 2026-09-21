use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DocumentRequest {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub student_id: ObjectId,
    pub center_id: ObjectId,
    pub document_type: String, // "certificate" or "marksheet"
    pub student_name: String,
    pub course_name: String,
    pub notes: Option<String>,
    pub status: String, // "pending", "approved", "rejected"
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
