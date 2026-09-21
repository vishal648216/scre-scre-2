use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crate::models::user::UserRole;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Announcement {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub title: String,
    pub content: String,
    pub sender_id: ObjectId,
    pub sender_role: UserRole,
    pub target_type: TargetType, // New field: specifies how we're targeting
    pub target_centers: Option<Vec<ObjectId>>, // Optional: specific centers
    pub target_students: Option<Vec<ObjectId>>, // Optional: specific students
    pub target_center_id: Option<ObjectId>, // Legacy for center's own students
    pub created_at: DateTime<Utc>,
    pub priority: AnnouncementPriority,
    #[serde(default)]
    pub is_edited: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edited_at: Option<DateTime<Utc>>,
    pub category_id: Option<ObjectId>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TargetType {
    AllCenters,
    AllStudents,
    AllUsers,
    SelectedCenters,
    SelectedStudents,
    SelectedCentersAndStudents,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AnnouncementPriority {
    Low,
    Medium,
    High,
    Urgent,
}
