use chrono::{DateTime, Utc};
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum WalletTransactionType {
    Credit,
    Debit,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WalletTransaction {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub center_id: ObjectId,
    pub transaction_id: String,
    #[serde(rename = "type")]
    pub tx_type: WalletTransactionType,
    pub credit_amount: Option<f64>,
    pub royalty_amount: Option<f64>,
    pub paid_amount: Option<f64>, // Amount center actually paid (after royalty)
    pub net_amount: f64,
    pub description: Option<String>,
    pub payment_method: Option<String>,
    pub gateway: Option<String>, // e.g., "razorpay"
    pub gateway_order_id: Option<String>,
    pub gateway_payment_id: Option<String>,
    pub receipt_number: Option<String>,
    pub verified: bool,
    pub created_by: ObjectId,
    #[serde(with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub created_at: DateTime<Utc>,
    // For fee deduction transactions
    pub student_id: Option<ObjectId>,
    pub student_name: Option<String>,
    pub student_enrollment: Option<String>,
    pub balance_before: f64,
    pub balance_after: f64,
}

