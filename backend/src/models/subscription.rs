use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubscriptionPlan {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String, // "Starter", "Professional", "Enterprise"
    pub price: f64,
    pub duration_days: i32,
    pub student_limit: i32,
    pub course_limit: i32,
    pub storage_limit_gb: f64,
    pub features: Vec<String>,
    pub status: String, // "active", "inactive"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CenterSubscription {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub center_id: ObjectId,
    pub plan_id: ObjectId,
    pub start_date: DateTime<Utc>,
    pub expiry_date: DateTime<Utc>,
    pub status: String, // "active", "expired", "pending"
    pub last_payment_amount: f64,
    pub transaction_id: Option<String>,
}
