use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TypingLanguage {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    pub code: String, // e.g. "en", "hi", "mr"
    pub font_family: Option<String>,
    pub keyboard_layout: Option<String>,
    pub active: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TypingLesson {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub language_id: ObjectId,
    pub title: String,
    pub content: String,
    pub level: TypingLevel,
    pub min_wpm: Option<f64>,
    pub min_accuracy: Option<f64>,
    pub active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TypingLevel {
    Beginner,
    Intermediate,
    Advanced,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TypingMode {
    Practice,
    Test,
    Exam,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TypingStatus {
    Completed,
    Abandoned,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TypingResult {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub student_id: ObjectId,
    pub center_id: ObjectId,
    pub course_id: Option<ObjectId>,
    pub lesson_id: ObjectId,
    pub language_id: ObjectId,
    pub mode: TypingMode,
    pub attempt_no: u32,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub duration_sec: u32,
    pub total_chars: u32,
    pub correct_chars: u32,
    pub incorrect_chars: u32,
    pub extra_chars: u32,
    pub wpm: f64,
    pub accuracy: f64,
    pub is_passed: bool,
    pub certificate_id: Option<ObjectId>,
    pub status: TypingStatus,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TypingCertificate {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub student_id: ObjectId,
    pub center_id: ObjectId,
    pub result_id: ObjectId,
    pub certificate_no: String,
    pub wpm: f64,
    pub accuracy: f64,
    pub language: String,
    pub issued_on: DateTime<Utc>,
}
