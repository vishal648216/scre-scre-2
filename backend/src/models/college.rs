use super::serde_helpers;
use chrono::{DateTime, Utc};
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct College {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    pub country_id: Option<ObjectId>,
    pub state_id: Option<ObjectId>,
    pub district_id: Option<ObjectId>,
    pub city_id: Option<ObjectId>,
    #[serde(with = "serde_helpers::flexible_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "serde_helpers::optional_flexible_datetime")]
    pub updated_at: Option<DateTime<Utc>>,
}
