use mongodb::bson::{DateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuestionBank {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub course_id: ObjectId,
    pub subject_id: ObjectId,
    pub question_type: String, // "MCQ", "Theory", "Practical"
    pub marks: f64,
    pub question_text: String,
    pub options: Option<Vec<String>>,   // For MCQ
    pub correct_answer: Option<String>, // For MCQ auto-evaluation
    pub difficulty: String,             // "Easy", "Medium", "Hard"
    pub image_url: Option<String>,
    pub created_by: ObjectId,
    pub created_at: DateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BlueprintRule {
    pub marks: f64,
    pub count: u32,
    pub options_count: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BlueprintComponents {
    pub practical_marks: f64,
    pub practical_min_marks: f64,
    pub assignment_marks: f64,
    pub assignment_min_marks: f64,
    pub exam_marks: f64,
    pub exam_min_marks: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct BlueprintComponentsPart {
    #[serde(default)]
    pub enabled: bool,
    pub marks: f64,
    pub min_marks: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubjectBlueprintConfig {
    pub subject_id: ObjectId,
    pub default_question_bank_id: ObjectId,
    pub reappear_question_bank_id: Option<ObjectId>,
    pub final_subject_total_marks: f64,
    pub practical_component: BlueprintComponentsPart,
    pub assignment_component: BlueprintComponentsPart,
    pub final_exam_component: BlueprintComponentsPart,
    pub question_distribution: Vec<BlueprintRule>,
    #[serde(default)]
    pub advanced_settings: Option<serde_json::Value>,
    #[serde(default)]
    pub instructions: Option<String>,
    #[serde(default)]
    pub duration_minutes: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct BlueprintComponentsPartPayload {
    #[serde(default)]
    pub enabled: bool,
    pub marks: f64,
    pub min_marks: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubjectBlueprintConfigPayload {
    pub subject_id: String,
    pub default_question_bank_id: String,
    pub reappear_question_bank_id: Option<String>,
    pub final_subject_total_marks: f64,
    pub practical_component: BlueprintComponentsPartPayload,
    pub assignment_component: BlueprintComponentsPartPayload,
    pub final_exam_component: BlueprintComponentsPartPayload,
    pub question_distribution: Vec<BlueprintRule>,
    #[serde(default)]
    pub advanced_settings: Option<serde_json::Value>,
    #[serde(default)]
    pub instructions: Option<String>,
    #[serde(default)]
    pub duration_minutes: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExamBlueprint {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    #[serde(default)]
    pub category_id: Option<ObjectId>,
    pub course_id: ObjectId,
    #[serde(default)]
    pub session_id: Option<ObjectId>,
    #[serde(default)]
    pub bank_id: Option<ObjectId>,
    #[serde(default)]
    pub reappear_bank_id: Option<ObjectId>,
    #[serde(default)]
    pub subject_id: Option<ObjectId>,
    #[serde(default)]
    pub total_marks: f64,
    #[serde(default)]
    #[serde(alias = "passing_marks")]
    pub minimum_marks: f64,
    pub duration_minutes: i32,
    #[serde(default)]
    pub total_duration_minutes: i32,
    pub max_attempts: i32,
    pub instructions: Option<String>,
    #[serde(default)]
    pub mode: String, // "Strict", "Flex"
    pub exam_mode: Option<String>, // "Computer Based Test (CBT)", "Offline", etc.
    #[serde(default)]
    pub practical_enabled: bool,
    #[serde(default)]
    pub assignment_enabled: bool,
    #[serde(default)]
    pub components: Option<BlueprintComponents>,
    #[serde(default)]
    pub allow_bank_override: bool,
    #[serde(default)]
    pub rules: Vec<BlueprintRule>,
    #[serde(default)]
    pub sections: Vec<SectionConfig>,
    #[serde(default)]
    pub require_attendance: bool,
    #[serde(default)]
    pub subjects: Vec<SubjectBlueprintConfig>,
    #[serde(rename = "created_by", skip_serializing_if = "Option::is_none")]
    pub created_by: Option<ObjectId>,
    #[serde(rename = "created_at", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<DateTime>,
    #[serde(default)]
    pub default_blueprint: bool,
    #[serde(default)]
    pub exam_pattern: Option<String>, // "Semester", "Yearly", "Monthly", "Weekly", "Days"
    #[serde(default)]
    pub term_number: Option<i32>,    // e.g. 1, 2, 3, 4
}

// Payload for API requests (uses String for IDs)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExamBlueprintPayload {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub name: String,
    pub category_id: Option<String>,
    pub course_id: String,
    pub session_id: Option<String>,
    pub bank_id: Option<String>,
    pub reappear_bank_id: Option<String>,
    pub subject_id: Option<String>,
    #[serde(default)]
    pub total_marks: f64,
    #[serde(default)]
    pub minimum_marks: f64,
    pub duration_minutes: i32,
    #[serde(default)]
    pub total_duration_minutes: i32,
    pub max_attempts: i32,
    pub instructions: Option<String>,
    #[serde(default)]
    pub mode: String,
    pub exam_mode: Option<String>,
    #[serde(default)]
    pub practical_enabled: bool,
    #[serde(default)]
    pub assignment_enabled: bool,
    pub components: Option<BlueprintComponents>,
    #[serde(default)]
    pub allow_bank_override: bool,
    #[serde(default)]
    pub rules: Vec<BlueprintRule>,
    #[serde(default)]
    pub sections: Vec<SectionConfig>,
    #[serde(default)]
    pub require_attendance: bool,
    #[serde(default)]
    pub subjects: Vec<SubjectBlueprintConfigPayload>,
    #[serde(default)]
    pub default_blueprint: bool,
    #[serde(default)]
    pub exam_pattern: Option<String>,
    #[serde(default)]
    pub term_number: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuestionRule {
    pub rule_id: String,
    #[serde(default)]
    pub subject_id: String,
    #[serde(rename = "tag")]
    pub tag: Option<String>,
    pub question_type: String,      // "MCQ", "Theory", "Practical"
    pub difficulty: Option<String>, // "Easy", "Medium", "Hard" or None for any
    pub marks_per_question: f64,
    pub negative_marks: Option<f64>,
    pub total_questions_to_pick: u32,
    #[serde(default)]
    pub options_to_show: u32,
    pub is_compulsory: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SectionConfig {
    pub section_id: String, // Unique within blueprint (slug)
    pub name: String,
    pub section_type: String, // "Theory", "Practical", "Assignment"
    pub total_section_marks: f64,
    pub rules: Vec<QuestionRule>,
    pub group_size: Option<u32>, // For "Answer any X from this group"
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct BlueprintSnapshot {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub max_attempts: i32,
    #[serde(default)]
    pub blueprint_total_marks: f64,
    #[serde(default)]
    pub blueprint_duration_minutes: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StudentPaper {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub blueprint_id: ObjectId,
    pub session_id: Option<ObjectId>,
    pub student_id: ObjectId,
    pub center_id: ObjectId,
    pub status: String, // "Generated", "InProgress", "Submitted", "Evaluated"
    pub start_window: Option<DateTime>,
    pub end_window: Option<DateTime>,
    pub start_time: Option<DateTime>,
    pub submit_time: Option<DateTime>,
    pub attempt_number: i32,
    pub security_log: Option<Vec<String>>, // JSON strings or descriptions of events
    pub total_obtained_marks: f64,
    pub is_passed: Option<bool>,
    pub practical_passed: Option<bool>,
    pub assignment_passed: Option<bool>,
    pub exam_passed: Option<bool>,
    pub section_wise_marks: std::collections::HashMap<String, f64>,
    pub questions: Vec<PaperQuestionMapping>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub paper_code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject_config_snapshot: Option<SubjectBlueprintConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub blueprint_snapshot: Option<BlueprintSnapshot>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub allotment_batch_id: Option<ObjectId>,
    pub created_at: DateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PaperQuestionMapping {
    pub section_id: String,
    pub question_id: ObjectId,
    pub order: u32,
    pub student_response: Option<String>, // Answer text or option index
    pub obtained_marks: f64,
    pub evaluation_status: String, // "Pending", "Evaluated"
    pub evaluator_remarks: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExamSchedule {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub blueprint_id: ObjectId,
    pub center_id: ObjectId,
    pub start_window: DateTime,
    pub end_window: DateTime,
    pub student_ids: Vec<ObjectId>,
    pub created_by: ObjectId,
    pub created_at: DateTime,
}
