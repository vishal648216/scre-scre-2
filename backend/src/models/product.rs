use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Product {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    pub description: String,
    pub price: f64,
    pub image_url: String,
    pub category: String,
    pub created_by: String, // username of admin/student
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub status: String, // "active", "out_of_stock", "hidden"
}
