use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InternshipPosting {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub title: String,
    pub company_name: String,
    pub domain: String,
    #[serde(default = "default_location_type")]
    pub location_type: String, // "Remote", "On-site", "Hybrid"
    pub city: Option<String>,
    pub duration_months: u32,
    pub stipend_amount: Option<f64>,
    #[serde(default)]
    pub skills_required: Vec<String>,
    #[serde(default = "default_openings")]
    pub total_openings: u32,
    pub description: String,
    #[serde(default = "default_open_status")]
    pub status: String, // "Open", "Closed"
    pub created_by: Option<ObjectId>,
    #[serde(default = "chrono::Utc::now")]
    #[serde(with = "crate::models::serde_helpers::rfc3339_datetime")]
    pub created_at: DateTime<Utc>,
}

fn default_location_type() -> String { "Remote".to_string() }
fn default_openings() -> u32 { 5 }
fn default_open_status() -> String { "Open".to_string() }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InternshipApplication {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub internship_id: ObjectId,
    pub internship_title: String,
    pub company_name: String,
    pub student_id: ObjectId,
    pub student_name: String,
    pub student_email: String,
    pub student_phone: String,
    pub enrollment_no: Option<String>,
    pub resume_url: Option<String>,
    pub cover_note: Option<String>,
    pub status: String, // "Applied", "Shortlisted", "Selected", "Completed", "Rejected"
    pub certificate_id: Option<String>,
    #[serde(default = "chrono::Utc::now")]
    #[serde(with = "crate::models::serde_helpers::rfc3339_datetime")]
    pub applied_at: DateTime<Utc>,
    #[serde(default = "chrono::Utc::now")]
    #[serde(with = "crate::models::serde_helpers::rfc3339_datetime")]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateInternshipPayload {
    pub title: String,
    pub company_name: String,
    pub domain: String,
    pub location_type: Option<String>,
    pub city: Option<String>,
    pub duration_months: u32,
    pub stipend_amount: Option<f64>,
    pub skills_required: Option<Vec<String>>,
    pub total_openings: Option<u32>,
    pub description: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateInternshipPayload {
    pub title: Option<String>,
    pub company_name: Option<String>,
    pub domain: Option<String>,
    pub location_type: Option<String>,
    pub city: Option<String>,
    pub duration_months: Option<u32>,
    pub stipend_amount: Option<f64>,
    pub skills_required: Option<Vec<String>>,
    pub total_openings: Option<u32>,
    pub description: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ApplyInternshipPayload {
    pub resume_url: Option<String>,
    pub cover_note: Option<String>,
    pub phone: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateApplicationStatusPayload {
    pub status: String, // "Applied", "Shortlisted", "Selected", "Completed", "Rejected"
}
