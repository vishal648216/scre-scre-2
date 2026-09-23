use mongodb::bson::{oid::ObjectId, DateTime};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Book {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub title: String,
    pub author: String,
    pub category: String, // e.g. "Programming", "Accounting", "General", "Reference"
    pub categories: Option<Vec<String>>, // Multiple categories support
    pub description: Option<String>,
    pub cover_url: Option<String>,
    pub pdf_url: Option<String>,
    pub youtube_url: Option<String>,
    pub external_url: Option<String>,
    pub price: Option<f64>,
    pub isbn: Option<String>,
    pub edition: Option<String>,
    pub is_physical: Option<bool>,
    pub total_copies: Option<i32>,
    pub available_copies: Option<i32>,
    pub damaged_copies: Option<i32>, // Damaged / Torn copies count
    pub shelf_location: Option<String>,
    pub rack_number: Option<String>,
    pub procurement_needed: Option<bool>, // Re-stocking / New procurement flag
    pub total_pages: Option<i32>,
    #[serde(default = "default_published")]
    pub is_published: bool,
    pub course_id: Option<ObjectId>,
    #[serde(rename = "created_at", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<DateTime>,
    #[serde(rename = "updated_at", skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<DateTime>,
}

fn default_published() -> bool {
    true
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BookReadingRecord {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub student_id: ObjectId,
    pub book_id: ObjectId,
    pub total_seconds_read: i64,
    pub last_page: i32,
    pub last_read_at: DateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BookIssueRecord {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub book_id: ObjectId,
    pub book_title: String,
    pub student_id: ObjectId,
    pub student_name: String,
    pub student_username: String,
    pub center_id: Option<ObjectId>,
    pub issue_date: DateTime,
    pub due_date: DateTime,
    pub return_date: Option<DateTime>,
    pub status: String, // "Issued", "Returned", "Overdue"
    pub fine_amount: Option<f64>,
    pub initial_condition: Option<String>, // "Brand New", "Good Condition", "Pre-existing Wear"
    pub condition_on_return: Option<String>, // e.g. "Good Condition", "Torn / Damaged Pages", "Lost"
    pub doc_verified: Option<bool>,
    pub student_photo_url: Option<String>,
    pub issue_doc_url: Option<String>,
    pub student_rating: Option<i32>, // 1 to 5 stars
    pub student_feedback: Option<String>, // Return review/notes
    pub remarks: Option<String>,
    #[serde(rename = "created_at", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<DateTime>,
    #[serde(rename = "updated_at", skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<DateTime>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BookReservation {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub book_id: ObjectId,
    pub book_title: String,
    pub student_id: ObjectId,
    pub student_name: String,
    pub student_username: String,
    pub center_id: Option<ObjectId>,
    pub reserved_at: DateTime,
    pub status: String, // "Pending", "Fulfilled", "Cancelled"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BookPayload {
    pub title: String,
    pub author: String,
    pub category: String,
    pub categories: Option<Vec<String>>,
    pub description: Option<String>,
    pub cover_url: Option<String>,
    pub pdf_url: Option<String>,
    pub youtube_url: Option<String>,
    pub external_url: Option<String>,
    pub price: Option<f64>,
    pub isbn: Option<String>,
    pub edition: Option<String>,
    pub is_physical: Option<bool>,
    pub total_copies: Option<i32>,
    pub damaged_copies: Option<i32>,
    pub shelf_location: Option<String>,
    pub rack_number: Option<String>,
    pub procurement_needed: Option<bool>,
    pub total_pages: Option<i32>,
    pub is_published: Option<bool>,
    pub course_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BookIssuePayload {
    pub book_id: String,
    pub student_id: String,
    pub reservation_id: Option<String>,
    pub due_days: Option<i64>, // e.g. 7, 14, 30 days
    pub issue_date: Option<String>,
    pub due_date: Option<String>,
    pub initial_condition: Option<String>,
    pub doc_verified: Option<bool>,
    pub student_photo_url: Option<String>,
    pub issue_doc_url: Option<String>,
    pub remarks: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReturnBookPayload {
    pub remarks: Option<String>,
    pub fine_amount: Option<f64>,
    pub condition_on_return: Option<String>,
    pub student_rating: Option<i32>,
    pub student_feedback: Option<String>,
    pub mark_as_damaged: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BookReservationPayload {
    pub book_id: String,
    pub student_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReadingHeartbeatPayload {
    pub book_id: String,
    pub seconds: i64,
    pub current_page: Option<i32>,
}

