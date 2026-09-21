use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnquiryNote {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub text: String,
    pub created_by: ObjectId,
    #[serde(with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContactEnquiry {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    pub phone: String,
    pub email: Option<String>,
    pub course: String,
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country_id: Option<ObjectId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state_id: Option<ObjectId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub district_id: Option<ObjectId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub city_id: Option<ObjectId>,
    pub center_id: Option<ObjectId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub college: Option<String>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,
    pub notes: Option<String>,
    pub assigned_to: Option<ObjectId>,
    pub next_follow_up_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub notes_history: Vec<EnquiryNote>,
    #[serde(with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub updated_at: chrono::DateTime<chrono::Utc>,
}
