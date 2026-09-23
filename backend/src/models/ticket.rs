use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crate::models::user::UserRole;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TicketReply {
    pub sender_id: ObjectId,
    pub sender_name: String,
    pub sender_role: UserRole,
    pub message: String,
    #[serde(default)]
    pub attachments: Vec<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SupportTicket {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub ticket_number: String,
    pub student_id: ObjectId,
    pub student_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub student_roll_no: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub center_id: Option<ObjectId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub center_name: Option<String>,
    pub category: String, // "fees", "exams", "course", "certificates", "technical", "general"
    pub subject: String,
    pub description: String,
    pub priority: String, // "low", "medium", "high", "urgent"
    pub status: String,   // "open", "in_progress", "resolved", "closed"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assigned_to: Option<String>,
    #[serde(default)]
    pub replies: Vec<TicketReply>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTicketRequest {
    pub category: String,
    pub subject: String,
    pub description: String,
    pub priority: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReplyTicketRequest {
    pub message: String,
    pub attachments: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTicketStatusRequest {
    pub status: String,
    pub assigned_to: Option<String>,
}
