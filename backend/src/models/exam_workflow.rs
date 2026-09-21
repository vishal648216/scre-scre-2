//! Course-level exam workflow: attempts, reappear permissions, allotment batches.
use mongodb::bson::{oid::ObjectId, DateTime};
use serde::{Deserialize, Serialize};

use super::exam_engine::PaperQuestionMapping;

/// Component-wise marks per subject (center marks entry).
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct SubjectMarkComponents {
    #[serde(default)]
    pub exam_obtained: f64,
    #[serde(default)]
    pub exam_total: f64,
    #[serde(default)]
    pub practical_obtained: f64,
    #[serde(default)]
    pub practical_total: f64,
    #[serde(default)]
    pub assignment_obtained: f64,
    #[serde(default)]
    pub assignment_total: f64,
}

/// Per-subject marks in a course exam attempt (center marks entry).
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct CourseSubjectMark {
    pub subject_id: ObjectId,
    /// Total obtained = exam + practical + assignment
    pub obtained: f64,
    /// Total marks = exam + practical + assignment
    pub total: f64,
    #[serde(default)]
    pub components: SubjectMarkComponents,
    #[serde(default)]
    pub from_online_exam: bool,
    #[serde(default)]
    pub exam_readonly: bool,
    #[serde(default)]
    pub subject_passed: bool,
}

/// One course-level exam attempt per student (source of truth for pass/fail & reappear).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CourseExamAttempt {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub student_id: ObjectId,
    pub course_id: ObjectId,
    pub center_id: ObjectId,
    pub attempt_number: i32,
    #[serde(default)]
    pub appeared: bool,
    #[serde(default)]
    pub allow_reappear: bool,
    #[serde(default)]
    pub reappear_locked: bool,
    pub overall_result: Option<String>,
    #[serde(default)]
    pub subject_marks: Vec<CourseSubjectMark>,
    #[serde(default)]
    pub total_obtained: f64,
    #[serde(default)]
    pub total_marks: f64,
    #[serde(default)]
    pub percentage: f64,
    #[serde(default)]
    pub marks_submitted: bool,
    /// Admin approved edit after change request
    #[serde(default)]
    pub marks_edit_unlocked: bool,
    #[serde(default)]
    pub is_reappear_student: bool,
    pub marks_submitted_at: Option<DateTime>,
    #[serde(default = "mongodb::bson::DateTime::now")]
    pub created_at: DateTime,
    #[serde(default = "mongodb::bson::DateTime::now")]
    pub updated_at: DateTime,
}

/// Center request to edit submitted marks (admin approval required).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MarksChangeRequest {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub student_id: ObjectId,
    pub course_id: ObjectId,
    pub center_id: ObjectId,
    pub attempt_number: i32,
    pub reason: String,
    /// pending | approved | disapproved
    pub status: String,
    #[serde(default)]
    pub admin_viewed: bool,
    pub admin_response: Option<String>,
    pub responded_by: Option<ObjectId>,
    #[serde(default = "mongodb::bson::DateTime::now")]
    pub created_at: DateTime,
    #[serde(default = "mongodb::bson::DateTime::now")]
    pub updated_at: DateTime,
}

/// Shared question set for one subject within an allotment batch (same paper for all students).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubjectQuestionSet {
    pub subject_id: ObjectId,
    pub blueprint_id: ObjectId,
    pub questions: Vec<PaperQuestionMapping>,
}

/// Subject schedule stored on an allotment batch.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AllotmentSubjectSlot {
    pub subject_id: ObjectId,
    pub blueprint_id: ObjectId,
    pub start_window: Option<DateTime>,
    pub end_window: Option<DateTime>,
    pub bank_id_override: Option<ObjectId>,
}

/// Admin bulk allotment — one batch, identical question papers per subject for all students.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExamAllotmentBatch {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub course_id: ObjectId,
    #[serde(default)]
    pub for_reappear: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    pub subjects: Vec<AllotmentSubjectSlot>,
    pub subject_question_sets: Vec<SubjectQuestionSet>,
    pub created_by: ObjectId,
    #[serde(default = "mongodb::bson::DateTime::now")]
    pub created_at: DateTime,
}

/// Scheduler execution metadata — prevents duplicate monthly auto-allotment per course/type.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExamAutoAllotmentRun {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// Course being allotted.
    pub course_id: ObjectId,
    /// Year (e.g. 2026) for the allotment cycle.
    pub year: i32,
    /// Month (1-12) for the allotment cycle.
    pub month: i32,
    /// Regular (false) or reappear (true).
    #[serde(default)]
    pub for_reappear: bool,
    /// pending | success | failed | skipped.
    pub status: String,
    /// Batch created for this run (one per run).
    pub batch_id: Option<ObjectId>,
    /// Allotted student count.
    #[serde(default)]
    pub allotted_count: u32,
    /// Skipped student count.
    #[serde(default)]
    pub skipped_count: u32,
    /// Human-readable error if failed.
    pub error_message: Option<String>,
    #[serde(default = "mongodb::bson::DateTime::now")]
    pub created_at: DateTime,
    #[serde(default = "mongodb::bson::DateTime::now")]
    pub updated_at: DateTime,
}
