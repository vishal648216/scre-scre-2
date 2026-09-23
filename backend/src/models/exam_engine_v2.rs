//! Exam Engine V2 — architecture: **QuestionBank → PaperTemplate → Exam → Attempt** (`exam_v2_papers`).
//!
//! **Collections:** `exam_v2_question_banks`, `exam_v2_questions`, `exam_v2_paper_templates`,
//! `exam_v2_exams`, `exam_v2_papers`, `exam_v2_marksheets`.
//! Legacy `exam_v2_blueprints` is obsolete after migration (see `exam_v2_migrate`).

use serde::{Deserialize, Serialize};
use mongodb::bson::{oid::ObjectId, DateTime};
use std::collections::HashMap;

// --- Question bank (DEPRECATED - Module removal in progress) ---

#[derive(Debug, Serialize, Deserialize, Clone)]
#[deprecated(note = "Question Bank module is being rebuilt from scratch.")]
pub struct ExamV2QuestionBank {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    pub created_by: ObjectId,
    #[serde(default = "mongodb::bson::DateTime::now")]
    pub created_at: DateTime,
}

// --- Tag management (DEPRECATED - Module removal in progress) ---

#[derive(Debug, Serialize, Deserialize, Clone)]
#[deprecated(note = "Question Bank module is being rebuilt from scratch.")]
pub struct ExamV2Tag {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    pub description: Option<String>,
    #[serde(default = "mongodb::bson::DateTime::now")]
    pub created_at: DateTime,
}

// --- Paper template (format: sections = marks × count) ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExamV2PaperSection {
    pub name: String,
    /// Marks per question in this bucket.
    pub marks: f64,
    /// How many questions to draw for this bucket.
    pub count: u32,
    /// How many options to display for each question in this section.
    pub options_to_show: u32,
    /// Optional tag to filter questions for this section.
    pub tag: Option<String>,
    /// Optional wrong-answer penalty for MCQ.
    #[serde(default)]
    pub negative_marks: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExamV2PaperTemplate {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    /// Pool to draw questions from.
    pub question_bank_id: ObjectId,
    /// Curriculum subject this paper belongs to.
    pub subject_id: ObjectId,
    /// Declared total (should match sum of section marks×count within epsilon).
    pub total_marks: f64,
    #[serde(default)]
    pub passing_marks: f64,
    pub duration_minutes: i32,
    pub max_attempts: i32,
    pub sections: Vec<ExamV2PaperSection>,
    pub instructions: Option<String>,
    /// `Strict` (fail if pool small) | `Flex` (allow fallback)
    #[serde(default = "default_blueprint_mode")]
    pub mode: String,

    // Academic ERP components
    #[serde(default)]
    pub practical_enabled: bool,
    #[serde(default)]
    pub practical_marks: f64,
    #[serde(default)]
    pub assignment_enabled: bool,
    #[serde(default)]
    pub assignment_marks: f64,
    #[serde(default)]
    pub exam_marks: f64,

    pub created_by: ObjectId,
    #[serde(default = "mongodb::bson::DateTime::now")]
    pub created_at: DateTime,
}

fn default_blueprint_mode() -> String { "Strict".to_string() }

// --- Exam (scheduling only + binds paper template) ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExamV2Exam {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    pub course_id: ObjectId,
    pub session_id: ObjectId,
    /// References `exam_v2_paper_templates` (the “paper” definition).
    pub paper_id: ObjectId,
    /// Empty = all centers (enforcement still by attempt.center_id).
    pub center_ids: Vec<ObjectId>,
    /// `online` | `offline`
    pub exam_mode: String,
    /// `instant` | `manual`
    pub result_mode: String,
    pub start_at: DateTime,
    pub end_at: DateTime,
    pub lock_ui_at: Option<DateTime>,
    pub attendance_date: DateTime,
    pub require_attendance: bool,
    /// `draft` | `scheduled` | `live` | `closed`
    pub status: String,
    pub created_by: ObjectId,
    #[serde(default = "mongodb::bson::DateTime::now")]
    pub created_at: DateTime,
}

// --- Question (DEPRECATED - Module removal in progress) ---

#[derive(Debug, Serialize, Deserialize, Clone)]
#[deprecated(note = "Question Bank module is being rebuilt from scratch.")]
pub struct ExamV2Option {
    pub id: String,
    pub text: String,
    pub image_url: Option<String>,
    /// Meta for smart distractor selection
    pub difficulty: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[deprecated(note = "Question Bank module is being rebuilt from scratch.")]
pub struct ExamV2Question {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub question_bank_id: Option<ObjectId>,
    pub category: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub status: String,
    pub version: u32,
    pub is_latest: bool,
    pub parent_question_id: Option<ObjectId>,
    pub question_type: String,
    pub difficulty: String,
    pub marks: f64,
    pub question_text: String,
    pub options_pool: Vec<ExamV2Option>,
    pub correct_option_id: String,
    pub image_url: Option<String>,
    
    // --- Performance & Analytics ---
    #[serde(default)]
    pub usage_count: i64,
    pub last_used_at: Option<DateTime>,
    #[serde(default)]
    pub accuracy_rate: f64,
    #[serde(default)]
    pub skip_rate: f64,
    #[serde(default)]
    pub avg_time_spent_sec: f64,
    #[serde(default)]
    pub quality_score: f64,
    #[serde(default)]
    pub report_flags: i32,

    pub created_by: ObjectId,
    #[serde(default = "mongodb::bson::DateTime::now")]
    pub created_at: DateTime,
}

fn default_question_status() -> String { "Draft".to_string() }
fn default_version() -> u32 { 1 }
fn default_true() -> bool { true }

#[derive(Debug, Serialize, Deserialize, Clone)]
#[deprecated(note = "Question Bank module is being rebuilt from scratch.")]
pub struct ExamV2QuestionVersion {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub question_id: ObjectId,
    pub version: u32,
    pub data: ExamV2Question,
    #[serde(default = "mongodb::bson::DateTime::now")]
    pub created_at: DateTime,
    pub created_by: ObjectId,
}

// --- Attempt (generated instance per student) ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExamV2PaperQuestion {
    pub section_id: String,
    pub question_id: ObjectId,
    /// Lock the version at paper generation time
    pub version: u32,
    pub order: u32,
    pub display_options: Vec<ExamV2Option>,
    pub student_response: Option<String>,
    pub obtained_marks: f64,
    pub evaluation_status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExamV2Paper {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub exam_id: ObjectId,
    pub session_id: ObjectId,
    /// Template this attempt was generated from.
    pub paper_template_id: ObjectId,
    pub student_id: ObjectId,
    pub center_id: ObjectId,
    pub attempt_number: i32,
    /// `generated` | `in_progress` | `submitted` | `evaluated`
    pub status: String,
    pub generation_seed_hex: String,
    pub questions: Vec<ExamV2PaperQuestion>,
    pub server_started_at: Option<DateTime>,
    pub server_deadline_at: Option<DateTime>,
    pub last_autosave_at: Option<DateTime>,
    pub submit_time: Option<DateTime>,
    pub total_obtained_marks: f64,
    pub section_wise_marks: HashMap<String, f64>,
    pub security_log: Option<Vec<String>>,
    pub offline_uploaded: bool,
    /// Integrity hash to prevent tampering
    pub integrity_hash: Option<String>,
    #[serde(default = "mongodb::bson::DateTime::now")]
    pub created_at: DateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExamV2Marksheet {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub student_id: ObjectId,
    pub exam_id: ObjectId,
    pub course_id: ObjectId,
    pub session_id: ObjectId,
    pub total_marks: f64,
    pub obtained_marks: f64,
    pub practical_marks: Option<f64>,
    pub assignment_marks: Option<f64>,
    pub exam_marks: Option<f64>,
    pub template_id: Option<ObjectId>,
    pub pdf_path: Option<String>,
    pub status: String, // "draft", "approved", "locked"
    pub generated_at: Option<DateTime>,
    pub generated_by: Option<ObjectId>,
    #[serde(default = "mongodb::bson::DateTime::now")]
    pub created_at: DateTime,
}

// --- Academic ERP: Practical & Assignment Marks ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PracticalAssignmentMarks {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub student_id: ObjectId,
    pub subject_id: ObjectId,
    pub session_id: ObjectId,
    pub center_id: ObjectId,
    /// "practical" | "assignment"
    pub marks_type: String,
    pub marks: f64,
    pub max_marks: f64,
    pub status: String, // "pending", "approved"
    #[serde(default = "mongodb::bson::DateTime::now")]
    pub created_at: DateTime,
    #[serde(default = "mongodb::bson::DateTime::now")]
    pub updated_at: DateTime,
}

// --- Academic ERP: Reappear System ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReappearPayment {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub student_id: ObjectId,
    pub subject_id: ObjectId,
    pub session_id: ObjectId,
    pub attempt_no: i32,
    pub payment_id: String, // Razorpay payment ID
    pub amount: f64,
    pub status: String, // "paid"
    #[serde(default = "mongodb::bson::DateTime::now")]
    pub created_at: DateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReappearAllocation {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub student_id: ObjectId,
    pub subject_id: ObjectId,
    pub session_id: ObjectId,
    pub attempt_no: i32,
    pub blueprint_id: ObjectId, // ExamV2PaperTemplate ID
    pub question_bank_id: ObjectId, // Overridden QuestionBank ID
    #[serde(default = "mongodb::bson::DateTime::now")]
    pub created_at: DateTime,
}
