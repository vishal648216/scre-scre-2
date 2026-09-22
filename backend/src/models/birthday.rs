use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crate::models::user::UserRole;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BirthdayRecord {
    pub user_id: String,
    pub name: String,
    pub role: UserRole,
    pub dob: String,
    pub course_or_designation: Option<String>,
    pub center_id: Option<String>,
    pub center_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub has_wished_today: bool,
    pub wished_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BirthdayWish {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub user_id: ObjectId,
    pub sender_id: ObjectId,
    pub sender_name: String,
    pub sender_role: UserRole,
    pub message: String,
    pub date: String, // YYYY-MM-DD
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct SendBirthdayWishRequest {
    pub user_id: String,
    pub custom_message: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BirthdayGreeting {
    pub is_birthday_today: bool,
    pub name: String,
    pub message: String,
    pub wishes_received: Vec<String>,
}
