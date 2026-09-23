use crate::models::referral::{
    Referral, ReferralRewardType, ReferralSettings, ReferralLevel, ReferralBonus, ReferralStatus,
    ReferralTransaction, ReferralWithdrawal, WithdrawalMethod,
};
use crate::models::user::{Claims, User, UserRole};
use crate::models::center_wallet::CenterWallet;
use crate::models::wallet_transaction::WalletTransaction;
use axum::{
    Json,
    extract::{Query, State, Path},
    http::StatusCode,
};
use chrono::Utc;
use futures_util::StreamExt;
use mongodb::{
    Database,
    bson::{doc, oid::ObjectId},
};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Deserialize)]
pub struct ValidateCodeRequest {
    pub code: String,
}

#[derive(Debug, Serialize)]
pub struct ValidateCodeResponse {
    pub success: bool,
    pub valid: bool,
    pub message: String,
    pub user_name: Option<String>,
    pub user_role: Option<UserRole>,
}

pub async fn validate_referral_code(
    State(db): State<Database>,
    Json(payload): Json<ValidateCodeRequest>,
) -> (StatusCode, Json<ValidateCodeResponse>) {
    let user_coll = db.collection::<User>("users");

    if let Ok(Some(user)) = user_coll
        .find_one(doc! { "referral_code": &payload.code }, None)
        .await
    {
        return (
            StatusCode::OK,
            Json(ValidateCodeResponse {
                success: true,
                valid: true,
                message: "Valid referral code".to_string(),
                user_name: user.full_name.or(user.first_name).or(Some(user.username)),
                user_role: Some(user.role),
            }),
        );
    }

    // Fallback: Check in centers collection by referral_code or center code
    let center_coll = db.collection::<crate::models::center::Center>("centers");
    if let Ok(Some(center)) = center_coll
        .find_one(
            doc! {
                "$or": [
                    { "referral_code": &payload.code },
                    { "code": &payload.code }
                ]
            },
            None,
        )
        .await
    {
        return (
            StatusCode::OK,
            Json(ValidateCodeResponse {
                success: true,
                valid: true,
                message: "Valid Center referral code".to_string(),
                user_name: Some(center.name),
                user_role: Some(UserRole::Center),
            }),
        );
    }

    (
        StatusCode::OK,
        Json(ValidateCodeResponse {
            success: false,
            valid: false,
            message: "Invalid referral code".to_string(),
            user_name: None,
            user_role: None,
        }),
    )
}

pub async fn get_my_referrals(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<serde_json::Value>>) {
    let user_id = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(vec![])),
    };

    let referral_coll = db.collection::<Referral>("referrals");
    let mut cursor = match referral_coll
        .find(doc! { "referrer_id": user_id }, None)
        .await
    {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut referrals = Vec::new();
    let user_coll = db.collection::<User>("users");

    while let Some(result) = cursor.next().await {
        if let Ok(ref_rec) = result {
            let mut val = serde_json::to_value(&ref_rec).unwrap();
            if let Some(obj) = val.as_object_mut() {
                if let Ok(Some(referred_user)) = user_coll
                    .find_one(doc! { "_id": ref_rec.referred_id }, None)
                    .await
                {
                    obj.insert(
                        "referred_user_name".to_string(),
                        serde_json::json!(referred_user.full_name),
                    );
                    obj.insert(
                        "referred_user_role".to_string(),
                        serde_json::json!(referred_user.role),
                    );
                }
            }
            referrals.push(val);
        }
    }

    (StatusCode::OK, Json(referrals))
}

#[derive(Debug, Serialize)]
pub struct ReferralStats {
    pub total_referrals: u64,
    pub total_rewards: f64,
    pub referral_code: String,
}

pub async fn get_referral_stats(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Option<ReferralStats>>) {
    let user_id = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(None)),
    };

    let user_coll = db.collection::<User>("users");
    let user = match user_coll.find_one(doc! { "_id": user_id }, None).await {
        Ok(Some(u)) => u,
        _ => return (StatusCode::NOT_FOUND, Json(None)),
    };

    let referral_coll = db.collection::<Referral>("referrals");
    let total_referrals = referral_coll
        .count_documents(doc! { "referrer_id": user_id }, None)
        .await
        .unwrap_or(0);

    let mut cursor = referral_coll
        .find(doc! { "referrer_id": user_id }, None)
        .await
        .unwrap();
    let mut total_rewards = 0.0;
    while let Some(result) = cursor.next().await {
        if let Ok(ref_rec) = result {
            total_rewards += ref_rec.reward_amount;
        }
    }

    (
        StatusCode::OK,
        Json(Some(ReferralStats {
            total_referrals,
            total_rewards,
            referral_code: user.referral_code.unwrap_or_default(),
        })),
    )
}

pub async fn get_all_referrals_admin(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<serde_json::Value>>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(vec![]));
    }

    let referral_coll = db.collection::<Referral>("referrals");
    let mut cursor = match referral_coll.find(doc! {}, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut referrals = Vec::new();
    let user_coll = db.collection::<User>("users");

    while let Some(result) = cursor.next().await {
        if let Ok(ref_rec) = result {
            let mut val = serde_json::to_value(&ref_rec).unwrap();
            if let Some(obj) = val.as_object_mut() {
                if let Ok(Some(referrer)) = user_coll
                    .find_one(doc! { "_id": ref_rec.referrer_id }, None)
                    .await
                {
                    obj.insert(
                        "referrer_name".to_string(),
                        serde_json::json!(referrer.full_name),
                    );
                    obj.insert(
                        "referrer_role".to_string(),
                        serde_json::json!(referrer.role),
                    );
                }
                if let Ok(Some(referred_user)) = user_coll
                    .find_one(doc! { "_id": ref_rec.referred_id }, None)
                    .await
                {
                    obj.insert(
                        "referred_user_name".to_string(),
                        serde_json::json!(referred_user.full_name),
                    );
                    obj.insert(
                        "referred_user_role".to_string(),
                        serde_json::json!(referred_user.role),
                    );
                }
            }
            referrals.push(val);
        }
    }

    (StatusCode::OK, Json(referrals))
}

#[derive(Debug, Deserialize)]
pub struct UpdateReferralSettingsRequest {
    pub target_role: String,
    pub levels: Vec<ReferralLevel>,
    pub instructions: Vec<String>,
    pub bonuses: Vec<ReferralBonus>,
    pub max_child_depth: Option<u32>,
    pub child_rewards: Vec<f64>,
    pub max_rewarded_referrals: Option<u32>,
    pub min_withdrawal_amount: Option<f64>,
    pub activation_percentage: Option<f64>,
    pub default_reward_amount: f64,
    #[serde(default)]
    pub payout_model: Option<String>,
    #[serde(default)]
    pub flat_amount: Option<f64>,
    #[serde(default)]
    pub percentage_rate: Option<f64>,
    #[serde(default)]
    pub franchise_base_fee: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct UpdateReferralSettingsResponse {
    pub success: bool,
    pub message: String,
    pub settings: Option<ReferralSettings>,
}

pub async fn get_referral_settings(
    State(db): State<Database>,
    claims: Claims,
    Path(target_role): Path<String>,
) -> (StatusCode, Json<Option<ReferralSettings>>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(None));
    }

    let settings_coll = db.collection::<ReferralSettings>("referral_settings");
    let existing_settings = match settings_coll.find_one(doc! { "target_role": &target_role }, None).await {
        Ok(Some(s)) => Some(s),
        _ => None,
    };

    (StatusCode::OK, Json(existing_settings))
}

pub async fn update_referral_settings(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<UpdateReferralSettingsRequest>,
) -> (StatusCode, Json<UpdateReferralSettingsResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(UpdateReferralSettingsResponse {
                success: false,
                message: "Unauthorized".to_string(),
                settings: None,
            }),
        );
    }

    let settings_coll = db.collection::<ReferralSettings>("referral_settings");
    let now = Utc::now();

    let existing = settings_coll.find_one(doc! { "target_role": &payload.target_role }, None).await;

    let payout_model = payload.payout_model.unwrap_or_else(|| "flat".to_string());
    let flat_amount = payload.flat_amount.unwrap_or(1000.0);
    let percentage_rate = payload.percentage_rate.unwrap_or(5.0);
    let franchise_base_fee = payload.franchise_base_fee.unwrap_or(20000.0);

    let new_settings = if let Ok(Some(mut existing)) = existing {
        existing.levels = payload.levels;
        existing.instructions = payload.instructions;
        existing.bonuses = payload.bonuses;
        existing.max_child_depth = payload.max_child_depth;
        existing.child_rewards = payload.child_rewards;
        existing.max_rewarded_referrals = payload.max_rewarded_referrals;
        existing.min_withdrawal_amount = payload.min_withdrawal_amount;
        existing.activation_percentage = payload.activation_percentage;
        existing.default_reward_amount = payload.default_reward_amount;
        existing.payout_model = payout_model;
        existing.flat_amount = flat_amount;
        existing.percentage_rate = percentage_rate;
        existing.franchise_base_fee = franchise_base_fee;
        existing.updated_at = now;
        existing
    } else {
        ReferralSettings {
            id: None,
            target_role: payload.target_role.clone(),
            levels: payload.levels,
            instructions: payload.instructions,
            bonuses: payload.bonuses,
            max_child_depth: payload.max_child_depth,
            child_rewards: payload.child_rewards,
            max_rewarded_referrals: payload.max_rewarded_referrals,
            min_withdrawal_amount: payload.min_withdrawal_amount,
            activation_percentage: payload.activation_percentage,
            default_reward_amount: payload.default_reward_amount,
            payout_model,
            flat_amount,
            percentage_rate,
            franchise_base_fee,
            created_at: now,
            updated_at: now,
        }
    };

    let result = settings_coll.replace_one(doc! { "target_role": &payload.target_role }, &new_settings, mongodb::options::ReplaceOptions::builder().upsert(true).build()).await;

    match result {
        Ok(_) => (
            StatusCode::OK,
            Json(UpdateReferralSettingsResponse {
                success: true,
                message: "Referral settings updated".to_string(),
                settings: Some(new_settings),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(UpdateReferralSettingsResponse {
                success: false,
                message: "Failed to update referral settings".to_string(),
                settings: None,
            }),
        ),
    }
}

#[derive(Debug, Deserialize)]
pub struct ReferralDashboardQuery {
    pub user_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ReferralDashboardResponse {
    pub referral_code: String,
    pub current_level: Option<u32>,
    pub current_level_name: Option<String>,
    pub total_direct_referrals: u64,
    pub total_child_referrals: u64,
    pub reward_earned: f64,
    pub reward_pending: f64,
    pub reward_withdrawn: f64,
    pub current_wallet_balance: Option<f64>,
    pub remaining_to_next_level: Option<u32>,
    pub settings: Option<ReferralSettings>,
}

pub async fn get_referral_dashboard(
    State(db): State<Database>,
    claims: Claims,
    Query(query): Query<ReferralDashboardQuery>,
) -> (StatusCode, Json<Option<ReferralDashboardResponse>>) {
    let target_user_id = match &query.user_id {
        Some(uid) => {
            if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
                return (StatusCode::FORBIDDEN, Json(None));
            }
            match ObjectId::parse_str(uid) {
                Ok(oid) => oid,
                Err(_) => return (StatusCode::BAD_REQUEST, Json(None)),
            }
        },
        None => match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(None)),
        },
    };

    let user_coll = db.collection::<User>("users");
    let user = match user_coll.find_one(doc! { "_id": target_user_id }, None).await {
        Ok(Some(u)) => u,
        _ => return (StatusCode::NOT_FOUND, Json(None)),
    };

    let referral_coll = db.collection::<Referral>("referrals");
    let total_direct_referrals = referral_coll.count_documents(doc! { "referrer_id": target_user_id }, None).await.unwrap_or(0);

    let tx_coll = db.collection::<ReferralTransaction>("referral_transactions");
    let mut cursor = tx_coll.find(doc! { "user_id": target_user_id }, None).await.unwrap();
    let mut reward_earned = 0.0;
    let mut reward_withdrawn = 0.0;
    while let Some(tx) = cursor.next().await {
        if let Ok(t) = tx {
            if t.transaction_type == "credit" {
                reward_earned += t.amount;
            } else {
                reward_withdrawn += t.amount;
            }
        }
    }
    let reward_pending = reward_earned - reward_withdrawn;

    let wallet_balance = if user.role == UserRole::Center {
        let wallet_coll = db.collection::<CenterWallet>("center_wallet");
        if let Ok(Some(wallet)) = wallet_coll.find_one(doc! { "center_id": target_user_id }, None).await {
            Some(wallet.balance)
        } else {
            None
        }
    } else {
        None
    };

    let settings_coll = db.collection::<ReferralSettings>("referral_settings");
    let role_str = match user.role {
        UserRole::Student => "student".to_string(),
        UserRole::Center => "center".to_string(),
        _ => "student".to_string(),
    };
    let settings = settings_coll.find_one(doc! { "target_role": role_str }, None).await.ok().flatten();
    let (current_level, current_level_name, remaining_to_next) = if let Some(s) = &settings {
        let mut current = 0;
        let mut current_name = None;
        let mut remaining = None;
        for lvl in s.levels.iter() {
            if total_direct_referrals >= lvl.required_referrals as u64 {
                current = lvl.level_number;
                current_name = Some(lvl.level_name.clone());
            } else if current > 0 || lvl.level_number == 1 {
                remaining = Some(lvl.required_referrals - total_direct_referrals as u32);
                break;
            }
        }
        (Some(current), current_name, remaining)
    } else {
        (None, None, None)
    };

    (
        StatusCode::OK,
        Json(Some(ReferralDashboardResponse {
            referral_code: user.referral_code.unwrap_or_default(),
            current_level,
            current_level_name,
            total_direct_referrals,
            total_child_referrals: 0,
            reward_earned,
            reward_pending,
            reward_withdrawn,
            current_wallet_balance: wallet_balance,
            remaining_to_next_level: remaining_to_next,
            settings,
        })),
    )
}

#[derive(Debug, Serialize)]
pub struct ReferredUserResponse {
    pub id: String,
    pub name: String,
    pub status: String,
    pub joined_date: String,
    pub reward_amount: Option<f64>,
}

pub async fn get_referred_users(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<ReferredUserResponse>>) {
    let user_id = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(vec![])),
    };

    let referral_coll = db.collection::<Referral>("referrals");
    let user_coll = db.collection::<User>("users");

    let mut cursor = match referral_coll.find(doc! { "referrer_id": user_id }, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut referrals = Vec::new();

    while let Some(result) = cursor.next().await {
        if let Ok(referral) = result {
            if let Ok(Some(referred_user)) = user_coll.find_one(doc! { "_id": referral.referred_id }, None).await {
                referrals.push(ReferredUserResponse {
                    id: referred_user.id.map(|oid| oid.to_hex()).unwrap_or_default(),
                    name: referred_user.full_name.unwrap_or_else(|| referred_user.username),
                    status: match referral.status {
                        ReferralStatus::Pending => "pending".to_string(),
                        ReferralStatus::Activated => "activated".to_string(),
                        ReferralStatus::RewardGiven => "reward_given".to_string(),
                        ReferralStatus::RewardExpired => "expired".to_string(),
                        ReferralStatus::Rejected => "rejected".to_string(),
                    },
                    joined_date: referral.created_at.to_rfc3339(),
                    reward_amount: Some(referral.reward_amount),
                });
            }
        }
    }

    (StatusCode::OK, Json(referrals))
}

pub async fn get_referral_transactions(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<serde_json::Value>>) {
    let user_id = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(vec![])),
    };

    let tx_coll = db.collection::<ReferralTransaction>("referral_transactions");
    let mut cursor = match tx_coll.find(doc! { "user_id": user_id }, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut transactions = Vec::new();

    while let Some(result) = cursor.next().await {
        if let Ok(tx) = result {
            let mut val = serde_json::to_value(tx).unwrap();
            if let Some(obj) = val.as_object_mut() {
                obj.insert("id".to_string(), serde_json::json!(obj.get("_id").and_then(|id| id.as_str()).unwrap_or_default()));
                obj.insert("date".to_string(), serde_json::json!(obj.get("created_at")));
            }
            transactions.push(val);
        }
    }

    (StatusCode::OK, Json(transactions))
}

pub async fn get_withdrawal_method(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Option<WithdrawalMethod>>) {
    let user_id = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(None)),
    };

    let method_coll = db.collection::<WithdrawalMethod>("withdrawal_methods");
    let existing = match method_coll.find_one(doc! { "user_id": user_id }, None).await {
        Ok(m) => m,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(None)),
    };

    (StatusCode::OK, Json(existing))
}

#[derive(Debug, Deserialize)]
pub struct UpdateWithdrawalMethodRequest {
    pub method_type: String,
    pub upi_id: Option<String>,
    pub bank_name: Option<String>,
    pub account_number: Option<String>,
    pub ifsc_code: Option<String>,
    pub account_holder_name: Option<String>,
}

pub async fn update_withdrawal_method(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<UpdateWithdrawalMethodRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    let user_id = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "message": "Invalid user ID" }))),
    };

    let method_coll = db.collection::<WithdrawalMethod>("withdrawal_methods");
    let now = Utc::now();

    let existing = method_coll.find_one(doc! { "user_id": user_id }, None).await;

    let new_method = if let Ok(Some(mut existing)) = existing {
        existing.method_type = payload.method_type;
        existing.upi_id = payload.upi_id;
        existing.bank_name = payload.bank_name;
        existing.account_number = payload.account_number;
        existing.ifsc_code = payload.ifsc_code;
        existing.account_holder_name = payload.account_holder_name;
        existing.updated_at = now;
        existing
    } else {
        WithdrawalMethod {
            id: None,
            user_id,
            method_type: payload.method_type,
            upi_id: payload.upi_id,
            bank_name: payload.bank_name,
            account_number: payload.account_number,
            ifsc_code: payload.ifsc_code,
            account_holder_name: payload.account_holder_name,
            created_at: now,
            updated_at: now,
        }
    };

    let result = method_coll.replace_one(doc! { "user_id": user_id }, &new_method, mongodb::options::ReplaceOptions::builder().upsert(true).build()).await;

    match result {
        Ok(_) => (StatusCode::OK, Json(json!({ "success": true, "message": "Withdrawal method updated", "method": new_method }))),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "success": false, "message": "Failed to update withdrawal method" }))),
    }
}

#[derive(Debug, Deserialize)]
pub struct WithdrawRequest {
    pub amount: f64,
    pub method: WithdrawalMethod,
}

pub async fn request_withdrawal(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<WithdrawRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    let user_id = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "message": "Invalid user ID" }))),
    };

    // Calculate available balance from referral transactions
    let tx_coll = db.collection::<ReferralTransaction>("referral_transactions");
    let mut cursor = tx_coll.find(doc! { "user_id": user_id }, None).await.unwrap();
    let mut earned = 0.0;
    let mut withdrawn = 0.0;

    while let Some(result) = cursor.next().await {
        if let Ok(tx) = result {
            if tx.transaction_type == "credit" {
                earned += tx.amount;
            } else {
                withdrawn += tx.amount;
            }
        }
    }
    let available = earned - withdrawn;

    if payload.amount > available {
        return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "message": "Amount exceeds available balance" })));
    }

    let now = Utc::now();
    let withdrawal = ReferralWithdrawal {
        id: None,
        user_id,
        amount: payload.amount,
        status: "pending".to_string(),
        created_by: None,
        created_at: now,
        updated_at: None,
    };

    let withdrawal_coll = db.collection::<ReferralWithdrawal>("referral_withdrawals");
    match withdrawal_coll.insert_one(withdrawal, None).await {
        Ok(_) => {
            // Add a debit transaction for this withdrawal
            let tx = ReferralTransaction {
                id: None,
                referral_id: ObjectId::new(),
                user_id,
                amount: payload.amount,
                transaction_type: "debit".to_string(),
                wallet_transaction_id: None,
                description: "Withdrawal request".to_string(),
                created_at: now,
            };
            let _ = tx_coll.insert_one(tx, None).await;

            (StatusCode::OK, Json(json!({ "success": true, "message": "Withdrawal request submitted" })))
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "success": false, "message": "Failed to submit withdrawal request" }))),
    }
}

pub async fn credit_center_referral_reward(
    db: &Database,
    referral_code: &str,
    new_center_id: &ObjectId,
    fee_paid_opt: Option<f64>,
) -> Result<f64, String> {
    let user_coll = db.collection::<User>("users");
    let referrer = match user_coll.find_one(doc! { "referral_code": referral_code }, None).await {
        Ok(Some(u)) => u,
        _ => return Err("Referral code not found".to_string()),
    };

    let referrer_id = match referrer.id {
        Some(id) => id,
        None => return Err("Referrer has no ID".to_string()),
    };

    let settings_coll = db.collection::<ReferralSettings>("referral_settings");
    let settings = settings_coll
        .find_one(doc! { "target_role": "center" }, None)
        .await
        .ok()
        .flatten()
        .unwrap_or_else(|| ReferralSettings {
            id: None,
            target_role: "center".to_string(),
            levels: vec![],
            instructions: vec![],
            bonuses: vec![],
            max_child_depth: None,
            child_rewards: vec![],
            max_rewarded_referrals: None,
            min_withdrawal_amount: None,
            activation_percentage: None,
            default_reward_amount: 1000.0,
            payout_model: "flat".to_string(),
            flat_amount: 1000.0,
            percentage_rate: 5.0,
            franchise_base_fee: 20000.0,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });

    let fee_paid = fee_paid_opt.unwrap_or(settings.franchise_base_fee);
    let reward_amount = if settings.payout_model.to_lowercase() == "percentage" {
        fee_paid * (settings.percentage_rate / 100.0)
    } else {
        settings.flat_amount
    };

    let wallet_coll = db.collection::<CenterWallet>("center_wallets");
    let _ = wallet_coll.update_one(
        doc! { "center_id": referrer_id },
        doc! {
            "$inc": { "balance": reward_amount },
            "$setOnInsert": { "created_at": mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis()) },
            "$set": { "updated_at": mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis()) }
        },
        mongodb::options::UpdateOptions::builder().upsert(true).build(),
    ).await;

    let tx_coll = db.collection::<ReferralTransaction>("referral_transactions");
    let tx = ReferralTransaction {
        id: None,
        referral_id: *new_center_id,
        user_id: referrer_id,
        amount: reward_amount,
        transaction_type: "credit".to_string(),
        wallet_transaction_id: None,
        description: format!(
            "Franchise referral commission ({}: {})",
            settings.payout_model,
            if settings.payout_model == "percentage" {
                format!("{}%", settings.percentage_rate)
            } else {
                format!("₹{}", settings.flat_amount)
            }
        ),
        created_at: Utc::now(),
    };
    let _ = tx_coll.insert_one(tx, None).await;

    Ok(reward_amount)
}
