use chrono::{DateTime, Utc};
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PaymentStatus {
    Pending,
    Success,
    Failed,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Payment {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub center_id: Option<ObjectId>,
    pub student_data: Option<serde_json::Value>,
    pub amount: f64, // Amount paid (after royalty)
    pub recharge_amount: Option<f64>, // Amount to add to wallet (original recharge amount)
    pub royalty_amount: Option<f64>, // Calculated royalty for this recharge
    pub currency: String,
    pub razorpay_order_id: Option<String>,
    pub razorpay_payment_id: Option<String>,
    pub razorpay_signature: Option<String>,
    pub status: PaymentStatus,
    pub receipt_number: Option<String>,
    #[serde(with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub updated_at: DateTime<Utc>,
}
