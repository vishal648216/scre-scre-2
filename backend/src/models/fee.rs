use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PaymentMode {
    Cash,
    #[serde(alias = "online", alias = "upi", alias = "UPI")]
    UPI,
    #[serde(alias = "banktransfer", alias = "bank_transfer", alias = "transfer", alias = "bank")]
    BankTransfer,
    #[serde(alias = "card", alias = "CARD")]
    Card,
    #[serde(alias = "cheque", alias = "CHEQUE")]
    Cheque,
    #[serde(other)]
    Other,
}

impl Default for PaymentMode {
    fn default() -> Self {
        PaymentMode::Cash
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PaymentType {
    OneTime,
    Installment,
    LateFee,
    #[serde(other)]
    Other,
}

impl Default for PaymentType {
    fn default() -> Self {
        PaymentType::OneTime
    }
}

fn default_payment_name() -> String {
    "Fee Payment".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FeeRecord {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub student_id: ObjectId,
    pub center_id: ObjectId,
    pub amount: f64,
    pub payment_date: DateTime<Utc>,
    #[serde(default)]
    pub mode: PaymentMode,
    pub receipt_no: String,
    pub remarks: Option<String>,
    pub reference_number: Option<String>,
    pub previous_paid: f64,
    pub total_paid: f64,
    pub remaining_amount: f64,
    pub created_by: ObjectId,
    pub created_at: DateTime<Utc>,
    #[serde(default)]
    pub payment_type: PaymentType,
    #[serde(default = "default_payment_name")]
    pub payment_name: String,
}

