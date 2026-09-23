use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ReferralRewardType {
    Discount,
    Cash,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ReferralStatus {
    Pending,
    Activated,
    RewardGiven,
    RewardExpired,
    Rejected,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct ReferralLevel {
    pub level_number: u32,
    pub level_name: String,
    pub reward_amount: f64,
    pub required_referrals: u32,
    #[serde(default)]
    pub condition_text: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct ReferralBonus {
    pub bonus_name: String,
    #[serde(default)]
    pub reward_name: String,
    pub reward_amount: f64,
    pub required_referrals: u32,
    #[serde(default)]
    pub terms_and_conditions: String,
    #[serde(default)]
    pub bonus_pic: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReferralSettings {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub target_role: String, // "student" or "center"
    pub levels: Vec<ReferralLevel>,
    #[serde(default)]
    pub instructions: Vec<String>,
    #[serde(default)]
    pub bonuses: Vec<ReferralBonus>,
    pub max_child_depth: Option<u32>, // None for unlimited
    pub child_rewards: Vec<f64>, // Index 0 for direct, index 1 for level 2, etc.
    pub max_rewarded_referrals: Option<u32>, // None for unlimited
    pub min_withdrawal_amount: Option<f64>,
    pub activation_percentage: Option<f64>,
    pub default_reward_amount: f64,
    #[serde(default = "default_payout_model")]
    pub payout_model: String, // "flat" or "percentage"
    #[serde(default = "default_flat_amount")]
    pub flat_amount: f64, // e.g. 1000.0
    #[serde(default = "default_percentage_rate")]
    pub percentage_rate: f64, // e.g. 5.0 (%)
    #[serde(default = "default_franchise_base_fee")]
    pub franchise_base_fee: f64, // e.g. 20000.0
    #[serde(with = "crate::models::serde_helpers::flexible_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "crate::models::serde_helpers::flexible_datetime")]
    pub updated_at: DateTime<Utc>,
}

fn default_payout_model() -> String { "flat".to_string() }
fn default_flat_amount() -> f64 { 1000.0 }
fn default_percentage_rate() -> f64 { 5.0 }
fn default_franchise_base_fee() -> f64 { 20000.0 }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Referral {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub referrer_id: ObjectId, // The user who referred
    pub referred_id: ObjectId, // The new user who was referred
    pub code_used: String,
    pub reward_amount: f64,
    pub reward_type: ReferralRewardType,
    pub status: ReferralStatus,
    pub level: u32,
    pub depth: u32,
    pub is_applied: bool,
    pub parent_referral_id: Option<ObjectId>,
    #[serde(with = "crate::models::serde_helpers::flexible_datetime")]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReferralTransaction {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub referral_id: ObjectId,
    pub user_id: ObjectId,
    pub amount: f64,
    pub transaction_type: String, // "credit" or "debit"
    pub wallet_transaction_id: Option<ObjectId>,
    pub description: String,
    #[serde(with = "crate::models::serde_helpers::flexible_datetime")]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReferralWithdrawal {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub user_id: ObjectId,
    pub amount: f64,
    pub status: String, // "pending", "approved", "rejected"
    pub created_by: Option<ObjectId>,
    #[serde(with = "crate::models::serde_helpers::flexible_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "crate::models::serde_helpers::optional_flexible_datetime")]
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WithdrawalMethod {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub user_id: ObjectId,
    pub method_type: String, // "upi" or "bank"
    pub upi_id: Option<String>,
    pub bank_name: Option<String>,
    pub account_number: Option<String>,
    pub ifsc_code: Option<String>,
    pub account_holder_name: Option<String>,
    #[serde(with = "crate::models::serde_helpers::flexible_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "crate::models::serde_helpers::flexible_datetime")]
    pub updated_at: DateTime<Utc>,
}
