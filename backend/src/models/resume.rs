use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ResumeExperience {
    #[serde(default)]
    pub company: Option<String>,
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default, alias = "duration")]
    pub start_date: Option<String>,
    #[serde(default)]
    pub end_date: Option<String>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub current: Option<bool>,
    #[serde(default, alias = "details")]
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ResumeEducation {
    #[serde(default)]
    pub institution: Option<String>,
    #[serde(default)]
    pub degree: Option<String>,
    #[serde(default)]
    pub field_of_study: Option<String>,
    #[serde(default, alias = "year")]
    pub pass_year: Option<String>,
    #[serde(default)]
    pub score: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ResumeProject {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default, alias = "tech")]
    pub technologies: Option<serde_json::Value>,
    #[serde(default)]
    pub link: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct StudentResume {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub user_id: ObjectId,
    pub full_name: String,
    pub email: String,
    pub phone: String,
    pub linkedin_url: Option<String>,
    pub github_url: Option<String>,
    pub portfolio_url: Option<String>,
    pub professional_summary: String,
    pub target_job_title: String,
    pub technical_skills: Vec<String>,
    pub soft_skills: Vec<String>,
    pub experience: Vec<ResumeExperience>,
    pub education: Vec<ResumeEducation>,
    pub projects: Vec<ResumeProject>,
    pub certifications: Vec<String>,
    pub ats_score: Option<u32>,
    #[serde(with = "crate::models::serde_helpers::flexible_datetime")]
    #[serde(default = "Utc::now")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "crate::models::serde_helpers::flexible_datetime")]
    #[serde(default = "Utc::now")]
    pub updated_at: DateTime<Utc>,
}
