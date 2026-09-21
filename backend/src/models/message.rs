use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crate::models::user::UserRole;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub sender_id: ObjectId,
    pub sender_role: UserRole,
    pub recipient_id: ObjectId,
    pub recipient_role: UserRole,
    pub content: String,
    pub created_at: DateTime<Utc>,
    pub is_read: bool,
}
