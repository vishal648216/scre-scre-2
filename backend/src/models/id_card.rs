use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IdCard {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub student_id: ObjectId,
    pub center_id: ObjectId,
    pub enrollment_number: String,
    pub student_name: String,
    pub father_name: Option<String>,
    pub course_name: String,
    pub photo_url: Option<String>,
    pub validity_date: Option<DateTime<Utc>>,
    pub issued_on: DateTime<Utc>,
    /// pending_approval, approved, rejected
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pdf_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub template_id: Option<ObjectId>,
}
