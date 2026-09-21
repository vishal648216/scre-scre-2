use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Batch {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    pub center_id: ObjectId, // The center that owns this batch

    // Make optional during migration so old docs without session_id won't crash deserialization
    #[serde(default)]
    pub session_id: Option<ObjectId>,

    pub time_slot: String,   // e.g., "10:00 AM - 12:00 PM"
    pub days: Vec<String>,   // e.g., ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    pub max_capacity: i32,
    pub current_count: i32,  // Number of students currently in this batch
    pub status: String,      // "active", "inactive"
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}