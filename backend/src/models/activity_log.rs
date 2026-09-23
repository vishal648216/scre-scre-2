use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ActivityLog {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub actor_id: ObjectId,
    pub action: String,          // e.g., "create", "update", "delete", "publish", "unpublish"
    pub entity_type: String,     // e.g., "blog", "news"
    pub entity_id: Option<ObjectId>,
    pub details: Option<String>, // optional message
    pub created_at: DateTime<Utc>,
}
