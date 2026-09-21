use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PaymentMode {
    Cash,
    UPI,
    BankTransfer,
    Card,
    Cheque,
    Other,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PaymentType {
    OneTime,
    Installment,
    LateFee,
    Other,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FeeRecord {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub student_id: ObjectId,
    pub center_id: ObjectId,
    pub amount: f64,
    pub payment_date: DateTime<Utc>,
    pub mode: PaymentMode,
    pub receipt_no: String,
    pub remarks: Option<String>,
    pub reference_number: Option<String>,
    pub previous_paid: f64,
    pub total_paid: f64,
    pub remaining_amount: f64,
    pub created_by: ObjectId,
    pub created_at: DateTime<Utc>,
    pub payment_type: PaymentType,
    pub payment_name: String,
}
