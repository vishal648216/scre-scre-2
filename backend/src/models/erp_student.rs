use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;

/// ERP Student schema - integrates with existing ERP where student data exists
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErpStudent {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub student_name: String,
    #[serde(default)]
    pub father_name: Option<String>,
    #[serde(default)]
    pub mother_name: Option<String>,
    #[serde(default)]
    pub dob: Option<String>,
    pub registration_number: String,
    #[serde(default)]
    pub course: Option<String>,
    /// Course document id (hex) when `course` on the user was an ObjectId — for admin filters.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub course_id: Option<String>,
    #[serde(default)]
    pub session_from: Option<String>,
    #[serde(default)]
    pub session_to: Option<String>,
    #[serde(default)]
    pub institute: Option<String>,
    #[serde(default)]
    pub photo: Option<String>,
    #[serde(default)]
    pub center_id: Option<ObjectId>,
    #[serde(default)]
    pub center_name: Option<String>,
    #[serde(default)]
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    /// Marks for marksheet: [{ "subject": "Math", "marks": 85, "total": 100 }]
    #[serde(default)]
    pub marks: Option<Vec<SubjectMarks>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubjectMarks {
    pub subject: String,
    pub marks: f64,
    pub total: f64,
}
