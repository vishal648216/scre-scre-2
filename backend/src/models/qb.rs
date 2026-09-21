use mongodb::bson::DateTime;
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuestionBank {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    #[serde(default = "DateTime::now")]
    pub created_at: DateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Question {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub bank_id: ObjectId,
    #[serde(default)]
    pub subject_id: Option<ObjectId>,
    pub question_text: String,
    #[serde(default = "default_question_type")]
    pub question_type: String, // "MCQ", "Theory", "Practical"
    #[serde(default)] // For backward compatibility, keep the field but default to 1.0
    pub marks: f64,
    #[serde(default)]
    pub options: Vec<String>,
    #[serde(default)]
    pub correct_option_index: i32,
    #[serde(default)]
    pub options_pool: Option<Vec<serde_json::Value>>,
    #[serde(default)]
    pub correct_option_id: Option<String>,
    #[serde(
        rename = "created_by",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub created_by: Option<ObjectId>,
    #[serde(default = "DateTime::now")]
    pub created_at: DateTime,
}

fn default_question_type() -> String {
    "MCQ".to_string()
}
