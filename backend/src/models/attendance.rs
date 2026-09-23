use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AttendanceStatus {
    Present,
    Absent,
    Late,
    Leave,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AttendanceRecord {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub student_id: ObjectId,
    pub batch_id: ObjectId,
    pub course_id: ObjectId,        // <-- added
    pub date: DateTime<Utc>,
    pub status: AttendanceStatus,
    pub remarks: Option<String>,
    pub marked_by: ObjectId,
    pub created_at: DateTime<Utc>,
}