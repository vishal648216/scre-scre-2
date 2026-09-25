use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use futures::StreamExt;
use mongodb::{
    bson::{doc, oid::ObjectId},
    Database,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IncomeRecord {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub category: String,
    pub particular: String,
    #[serde(default)]
    pub payer_name: String,
    #[serde(default)]
    pub center_name: String,
    pub amount: f64,
    pub income_date: String,
    pub payment_mode: String,
    #[serde(default)]
    pub receipt_ref: String,
    #[serde(default = "default_income_status")]
    pub status: String,
    #[serde(default = "default_timestamp")]
    pub created_at: String,
}

fn default_income_status() -> String {
    "Received".to_string()
}

fn default_timestamp() -> String {
    chrono::Utc::now().to_rfc3339()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExpenseRecord {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub category: String,
    pub particular: String,
    #[serde(default)]
    pub vendor_name: String,
    pub amount: f64,
    pub expense_date: String,
    pub payment_mode: String,
    #[serde(default)]
    pub receipt_ref: String,
    #[serde(default = "default_expense_status")]
    pub status: String,
    #[serde(default = "default_timestamp")]
    pub created_at: String,
}

fn default_expense_status() -> String {
    "Paid".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PayoutRecord {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub center_name: String,
    #[serde(default)]
    pub bank_name: String,
    #[serde(default)]
    pub account_no: String,
    pub amount: f64,
    pub payment_ref: String,
    #[serde(default = "default_timestamp")]
    pub disbursed_at: String,
    #[serde(default)]
    pub remarks: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AdjustmentRecord {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub center_id: String,
    pub center_name: String,
    pub adjustment_type: String, // "credit" or "debit"
    pub amount: f64,
    pub reason: String,
    pub reference_no: String,
    #[serde(default = "default_timestamp")]
    pub created_at: String,
}

// Handler: List Incomes
pub async fn list_incomes(
    State(db): State<Database>,
) -> Result<Json<Value>, StatusCode> {
    let coll = db.collection::<IncomeRecord>("incomes");
    let mut cursor = coll.find(doc! {}, None).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let mut list = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(item) = result {
            list.push(item);
        }
    }
    
    Ok(Json(json!(list)))
}

// Handler: Create Income
pub async fn create_income(
    State(db): State<Database>,
    Json(mut payload): Json<IncomeRecord>,
) -> Result<(StatusCode, Json<Value>), StatusCode> {
    if payload.receipt_ref.is_empty() {
        payload.receipt_ref = format!("INC-{}", rand::random::<u32>() % 90000 + 10000);
    }
    if payload.created_at.is_empty() {
        payload.created_at = chrono::Utc::now().to_rfc3339();
    }

    let coll = db.collection::<IncomeRecord>("incomes");
    let res = coll.insert_one(payload.clone(), None).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let inserted_id = res.inserted_id.as_object_id().map(|o| o.to_hex());
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "message": "Income record saved successfully",
            "id": inserted_id,
            "income": payload
        })),
    ))
}

// Handler: Delete Income
pub async fn delete_income(
    State(db): State<Database>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let coll = db.collection::<IncomeRecord>("incomes");
    let obj_id = ObjectId::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;
    
    let res = coll.delete_one(doc! { "_id": obj_id }, None).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if res.deleted_count == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(Json(json!({ "message": "Income record deleted" })))
}

// Handler: List Expenses
pub async fn list_expenses(
    State(db): State<Database>,
) -> Result<Json<Value>, StatusCode> {
    let coll = db.collection::<ExpenseRecord>("expenses");
    let mut cursor = coll.find(doc! {}, None).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let mut list = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(item) = result {
            list.push(item);
        }
    }
    
    Ok(Json(json!(list)))
}

// Handler: Create Expense
pub async fn create_expense(
    State(db): State<Database>,
    Json(mut payload): Json<ExpenseRecord>,
) -> Result<(StatusCode, Json<Value>), StatusCode> {
    if payload.receipt_ref.is_empty() {
        payload.receipt_ref = format!("EXP-{}", rand::random::<u32>() % 90000 + 10000);
    }
    if payload.created_at.is_empty() {
        payload.created_at = chrono::Utc::now().to_rfc3339();
    }

    let coll = db.collection::<ExpenseRecord>("expenses");
    let res = coll.insert_one(payload.clone(), None).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let inserted_id = res.inserted_id.as_object_id().map(|o| o.to_hex());
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "message": "Expense record saved successfully",
            "id": inserted_id,
            "expense": payload
        })),
    ))
}

// Handler: Delete Expense
pub async fn delete_expense(
    State(db): State<Database>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let coll = db.collection::<ExpenseRecord>("expenses");
    let obj_id = ObjectId::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;
    
    let res = coll.delete_one(doc! { "_id": obj_id }, None).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if res.deleted_count == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(Json(json!({ "message": "Expense record deleted" })))
}

// Handler: List Payouts
pub async fn list_payouts(
    State(db): State<Database>,
) -> Result<Json<Value>, StatusCode> {
    let coll = db.collection::<PayoutRecord>("payout_logs");
    let mut cursor = coll.find(doc! {}, None).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let mut list = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(item) = result {
            list.push(item);
        }
    }
    
    Ok(Json(json!(list)))
}

// Handler: Create Payout
pub async fn create_payout(
    State(db): State<Database>,
    Json(mut payload): Json<PayoutRecord>,
) -> Result<(StatusCode, Json<Value>), StatusCode> {
    if payload.payment_ref.is_empty() {
        payload.payment_ref = format!("BANK-REF-{}", rand::random::<u32>() % 900000 + 100000);
    }
    if payload.disbursed_at.is_empty() {
        payload.disbursed_at = chrono::Utc::now().to_rfc3339();
    }

    let coll = db.collection::<PayoutRecord>("payout_logs");
    let res = coll.insert_one(payload.clone(), None).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let inserted_id = res.inserted_id.as_object_id().map(|o| o.to_hex());
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "message": "Payout transfer recorded successfully",
            "id": inserted_id,
            "payout": payload
        })),
    ))
}

// Handler: List Adjustments
pub async fn list_adjustments(
    State(db): State<Database>,
) -> Result<Json<Value>, StatusCode> {
    let coll = db.collection::<AdjustmentRecord>("wallet_adjustments");
    let mut cursor = coll.find(doc! {}, None).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let mut list = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(item) = result {
            list.push(item);
        }
    }
    
    Ok(Json(json!(list)))
}

// Handler: Create Adjustment
pub async fn create_adjustment(
    State(db): State<Database>,
    Json(mut payload): Json<AdjustmentRecord>,
) -> Result<(StatusCode, Json<Value>), StatusCode> {
    if payload.reference_no.is_empty() {
        payload.reference_no = format!("ADJ-{}", rand::random::<u32>() % 900000 + 100000);
    }
    if payload.created_at.is_empty() {
        payload.created_at = chrono::Utc::now().to_rfc3339();
    }

    let coll = db.collection::<AdjustmentRecord>("wallet_adjustments");
    let res = coll.insert_one(payload.clone(), None).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let inserted_id = res.inserted_id.as_object_id().map(|o| o.to_hex());
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "message": "Wallet adjustment saved successfully",
            "id": inserted_id,
            "adjustment": payload
        })),
    ))
}

// Handler: Financial Summary
pub async fn get_financial_summary(
    State(db): State<Database>,
) -> Result<Json<Value>, StatusCode> {
    let inc_coll = db.collection::<IncomeRecord>("incomes");
    let exp_coll = db.collection::<ExpenseRecord>("expenses");

    let mut inc_cursor = inc_coll.find(doc! {}, None).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut exp_cursor = exp_coll.find(doc! {}, None).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut total_income = 0.0;
    while let Some(Ok(inc)) = inc_cursor.next().await {
        total_income += inc.amount;
    }

    let mut total_expense = 0.0;
    while let Some(Ok(exp)) = exp_cursor.next().await {
        total_expense += exp.amount;
    }

    let net_profit = total_income - total_expense;
    let hq_commission = total_income * 0.15;
    let center_share = total_income * 0.85;

    Ok(Json(json!({
        "total_income": total_income,
        "total_expense": total_expense,
        "net_profit": net_profit,
        "hq_commission_15": hq_commission,
        "center_share_85": center_share
    })))
}
