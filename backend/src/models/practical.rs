use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Practical {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub title: String,
    pub experiment_code: String,
    pub course_id: Option<ObjectId>,
    pub course_name: Option<String>,
    pub subject_name: String,
    pub center_id: Option<ObjectId>,
    pub center_name: Option<String>,
    pub batch_id: Option<String>,
    pub batch_name: Option<String>,
    pub instructor_id: Option<ObjectId>,
    pub instructor_name: Option<String>,
    pub created_by: ObjectId,
    
    /// Practical Skill Mode: "physical_lab" | "computer_it" | "hybrid"
    pub practical_mode: String,
    pub delivery_mode: Option<String>,
    
    // Marking Rubric Split & Cutoff
    pub total_marks: i32,
    pub passing_marks: Option<i32>,
    pub exp_marks: i32,
    pub journal_marks: i32,
    pub viva_marks: i32,
    
    #[serde(with = "crate::models::serde_helpers::rfc3339_datetime")]
    pub scheduled_at: DateTime<Utc>,
    #[serde(with = "crate::models::serde_helpers::rfc3339_datetime")]
    pub due_date: DateTime<Utc>,
    
    pub pdf_manual_url: Option<String>,
    pub video_demo_url: Option<String>,
    pub starter_code_url: Option<String>,
    pub description: Option<String>,
    pub viva_questions: Option<Vec<String>>,
    pub allow_in_person_signoff: Option<bool>,
    pub allow_photo_proof: Option<bool>,
    pub allowed_file_types: Option<Vec<String>>,
    pub status: String, // "published" | "archived"
    
    #[serde(with = "crate::models::serde_helpers::rfc3339_datetime")]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PracticalSubmission {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub practical_id: ObjectId,
    pub practical_title: Option<String>,
    pub experiment_code: Option<String>,
    pub student_id: ObjectId,
    pub student_name: Option<String>,
    pub roll_no: Option<String>,
    pub center_id: ObjectId,
    pub center_name: Option<String>,
    
    /// Submission Type: "file_upload" | "photo_proof" | "in_person_signoff"
    pub submission_type: String,
    pub file_urls: Vec<String>,
    pub student_notes: Option<String>,
    
    #[serde(with = "crate::models::serde_helpers::rfc3339_datetime")]
    pub submitted_at: DateTime<Utc>,
    
    // Instructor Review & Evaluation
    pub evaluated_by: Option<ObjectId>,
    pub evaluator_name: Option<String>,
    pub exp_marks_obtained: Option<i32>,
    pub journal_marks_obtained: Option<i32>,
    pub viva_marks_obtained: Option<i32>,
    pub total_marks_obtained: Option<i32>,
    pub instructor_review_remarks: Option<String>,
    
    /// Status: "submitted" | "approved" | "revision_requested" | "in_person_pending"
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default, with = "crate::models::serde_helpers::optional_flexible_datetime")]
    pub evaluated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePracticalPayload {
    pub title: String,
    pub experiment_code: String,
    pub course_id: Option<String>,
    pub course_name: Option<String>,
    pub subject_name: String,
    pub center_id: Option<String>,
    pub batch_id: Option<String>,
    pub batch_name: Option<String>,
    pub instructor_name: Option<String>,
    pub practical_mode: Option<String>,
    pub delivery_mode: Option<String>,
    pub total_marks: Option<i32>,
    pub passing_marks: Option<i32>,
    pub exp_marks: Option<i32>,
    pub journal_marks: Option<i32>,
    pub viva_marks: Option<i32>,
    pub scheduled_at: Option<String>,
    pub due_date: Option<String>,
    pub pdf_manual_url: Option<String>,
    pub video_demo_url: Option<String>,
    pub starter_code_url: Option<String>,
    pub description: Option<String>,
    pub viva_questions: Option<Vec<String>>,
    pub allow_in_person_signoff: Option<bool>,
    pub allow_photo_proof: Option<bool>,
    pub allowed_file_types: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSubmissionPayload {
    pub submission_type: Option<String>,
    pub file_urls: Option<Vec<String>>,
    pub student_notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct EvaluateSubmissionPayload {
    pub exp_marks_obtained: i32,
    pub journal_marks_obtained: i32,
    pub viva_marks_obtained: i32,
    pub instructor_review_remarks: Option<String>,
    pub status: String, // "approved" | "revision_requested" | "in_person_pending"
}

#[derive(Debug, Deserialize)]
pub struct PracticalQuery {
    pub course_id: Option<String>,
    pub status: Option<String>,
    pub practical_mode: Option<String>,
    pub limit: Option<i64>,
}
