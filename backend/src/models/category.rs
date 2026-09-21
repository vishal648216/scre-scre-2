
use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Category {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    pub is_system: bool,
    pub created_at: DateTime<Utc>,
}

// Public category for sending to frontend
#[derive(Debug, Serialize, Clone)]
pub struct PublicCategory {
    pub id: String,
    pub name: String,
    pub is_system: bool,
    pub created_at: DateTime<Utc>,
}

impl From<Category> for PublicCategory {
    fn from(cat: Category) -> Self {
        PublicCategory {
            id: cat.id.unwrap_or_else(|| ObjectId::new()).to_hex(),
            name: cat.name,
            is_system: cat.is_system,
            created_at: cat.created_at,
        }
    }
}

