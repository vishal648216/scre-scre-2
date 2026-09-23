use chrono::{DateTime, Utc};
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CouponType {
    Student,
    Center,
    Intern,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DiscountType {
    Percentage,
    Fixed,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Coupon {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub code: String,
    pub coupon_type: CouponType,
    pub discount_type: DiscountType,
    pub discount_value: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_id: Option<ObjectId>, // Specific student or center ID if applicable
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_name: Option<String>, // For display purposes in suggestion
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_date: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_date: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expiry_date: Option<DateTime<Utc>>,
    pub usage_limit: Option<i32>,
    pub usage_count: i32,
    pub is_active: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<DateTime<Utc>>,
}
