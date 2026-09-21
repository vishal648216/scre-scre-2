use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize)]
pub struct EmailOtp {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub email: String,
    pub otp_hash: String,
    pub expires_at: DateTime<Utc>,
    pub verified: bool,
    pub created_at: DateTime<Utc>,
}
