use mongodb::bson::{oid::ObjectId, DateTime};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Book {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub title: String,
    pub author: String,
    pub category: String, // e.g. "Programming", "Accounting", "General", "Reference"
    pub isbn: Option<String>,
    pub publisher: Option<String>,
    pub edition: Option<String>,
    pub volume_part: Option<String>,
    pub registered_date: Option<String>,
    pub shelf_location: Option<String>,
    pub physical_copies: Option<i32>,
    pub available_copies: Option<i32>,
    pub fine_per_day: Option<f64>,
    pub description: Option<String>,
    pub cover_url: Option<String>,
    pub pdf_url: Option<String>,
    pub video_url: Option<String>,
    pub total_pages: Option<i32>,
    #[serde(default = "default_published")]
    pub is_published: bool,
    pub course_id: Option<ObjectId>,
    pub center_id: Option<ObjectId>,
    pub center_name: Option<String>,
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
pub struct BookPayload {
    pub title: String,
    pub author: String,
    pub category: String,
    pub isbn: Option<String>,
    pub publisher: Option<String>,
    pub edition: Option<String>,
    pub volume_part: Option<String>,
    pub registered_date: Option<String>,
    pub shelf_location: Option<String>,
    pub physical_copies: Option<i32>,
    pub available_copies: Option<i32>,
    pub fine_per_day: Option<f64>,
    pub description: Option<String>,
    pub cover_url: Option<String>,
    pub pdf_url: Option<String>,
    pub video_url: Option<String>,
    pub total_pages: Option<i32>,
    pub is_published: Option<bool>,
    pub course_id: Option<String>,
    pub center_id: Option<String>,
    pub center_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReadingHeartbeatPayload {
    pub book_id: String,
    pub seconds: i64,
    pub current_page: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BookIssueRecord {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub book_id: ObjectId,
    pub student_id: ObjectId,
    pub book_title: String,
    pub student_name: String,
    pub enrollment_number: Option<String>,
    pub student_address: Option<String>,
    pub student_phone: Option<String>,
    pub student_gov_id: Option<String>,
    pub center_id: Option<ObjectId>,
    pub center_name: Option<String>,
    pub librarian_name: Option<String>,
    pub document_number: Option<String>,
    pub document_url: Option<String>,
    pub penalty_reason: Option<String>,
    pub issue_date: DateTime,
    pub due_date: DateTime,
    pub return_date: Option<DateTime>,
    pub status: String, // "Issued", "Returned", "Overdue", "Lost"
    pub fine_amount: f64,
    pub fine_paid: bool,
    pub book_condition: Option<String>, // "Good", "Slightly Damaged", "Damaged", "Lost"
    pub notes: Option<String>,
    #[serde(rename = "created_at", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<DateTime>,
    #[serde(rename = "updated_at", skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<DateTime>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IssueBookPayload {
    pub book_id: String,
    pub student_id: String,
    pub student_name: Option<String>,
    pub due_date: String,
    pub student_address: Option<String>,
    pub student_phone: Option<String>,
    pub student_gov_id: Option<String>,
    pub center_id: Option<String>,
    pub center_name: Option<String>,
    pub librarian_name: Option<String>,
    pub document_number: Option<String>,
    pub document_url: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReturnBookPayload {
    pub return_date: Option<String>,
    pub fine_amount: Option<f64>,
    pub fine_paid: Option<bool>,
    pub book_condition: Option<String>,
    pub librarian_name: Option<String>,
    pub document_url: Option<String>,
    pub penalty_reason: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BookReservation {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub book_id: ObjectId,
    pub student_id: ObjectId,
    pub book_title: String,
    pub student_name: String,
    pub enrollment_number: Option<String>,
    pub center_id: Option<ObjectId>,
    pub center_name: Option<String>,
    pub reservation_date: DateTime,
    pub status: String, // "Pending", "Fulfilled", "Cancelled"
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReserveBookPayload {
    pub book_id: String,
    pub student_id: String,
    pub center_id: Option<String>,
    pub center_name: Option<String>,
    pub notes: Option<String>,
}
