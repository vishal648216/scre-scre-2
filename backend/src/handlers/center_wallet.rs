use axum::{
    extract::{Path, Query, State},
    http::{StatusCode, header},
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use mongodb::{
    bson::{doc, oid::ObjectId},
    options::{FindOneAndUpdateOptions, FindOptions, ReturnDocument},
    Database,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::process::Command;

use crate::models::{
    center::Center,
    center_wallet::CenterWallet,
    fee::FeeRecord,
    user::{Claims, UserRole},
    wallet_transaction::{WalletTransaction, WalletTransactionType},
};

fn is_admin(claims: &Claims) -> bool {
    claims.role == UserRole::Admin || claims.role == UserRole::SuperAdmin
}

fn parse_object_id(id: &str) -> Result<ObjectId, StatusCode> {
    ObjectId::parse_str(id).map_err(|_| StatusCode::BAD_REQUEST)
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

#[derive(Debug, Serialize)]
pub struct WalletResponse {
    pub center_id: String,
    pub balance: f64,
    pub royalty_percentage: f64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRoyaltyRequest {
    pub royalty_percentage: f64,
}

#[derive(Debug, Serialize)]
pub struct UpdateRoyaltyResponse {
    pub success: bool,
    pub message: String,
    pub royalty_percentage: Option<f64>,
}

fn is_super_admin(claims: &Claims) -> bool {
    claims.role == UserRole::SuperAdmin
}

async fn ensure_wallet(db: &Database, center_id: ObjectId) -> Result<CenterWallet, StatusCode> {
    let coll = db.collection::<CenterWallet>("center_wallet");
    let now = Utc::now();

    let update = doc! {
        "$setOnInsert": {
            "center_id": center_id,
            "balance": 0.0,
            "royalty_percentage": 0.0,
            "created_at": now,
        },
        "$set": { "updated_at": now }
    };
    let opts = FindOneAndUpdateOptions::builder()
        .upsert(true)
        .return_document(ReturnDocument::After)
        .build();
    coll.find_one_and_update(doc! { "center_id": center_id }, update, opts)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)
}

pub(crate) async fn get_center_id_for_center_user(db: &Database, claims: &Claims) -> Result<ObjectId, StatusCode> {
    eprintln!("get_center_id_for_center_user: claims.role = {:?}, claims.sub = {:?}", claims.role, claims.sub);
    if claims.role != UserRole::Center {
        return Err(StatusCode::FORBIDDEN);
    }
    let user_id = ObjectId::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let centers = db.collection::<crate::models::center::Center>("centers");
    
    // First try to find by user_id
    let center = centers
        .find_one(doc! { "user_id": user_id }, None)
        .await
        .map_err(|e| {
            eprintln!("get_center_id_for_center_user: error finding center by user_id: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    
    // If not found, try to find by _id (since some centers might have _id = user_id)
    let center = if let Some(c) = center {
        Some(c)
    } else {
        eprintln!("get_center_id_for_center_user: no center with user_id, trying _id = {:?}", user_id);
        centers
            .find_one(doc! { "_id": user_id }, None)
            .await
            .map_err(|e| {
                eprintln!("get_center_id_for_center_user: error finding center by _id: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
    };
    
    eprintln!("get_center_id_for_center_user: found center = {:?}", center);
    if let Some(c) = center {
        // Return center.user_id, which is the ID stored in student.parent_id
        Ok(c.user_id)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

async fn get_center_user_id(db: &Database, input_id: ObjectId) -> Result<ObjectId, StatusCode> {
    let centers = db.collection::<Center>("centers");
    let center = centers
        .find_one(doc! { "$or": [{"user_id": input_id}, {"_id": input_id}] }, None)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    center.ok_or(StatusCode::NOT_FOUND).map(|c| c.user_id)
}

async fn ensure_center_exists(db: &Database, center_id: ObjectId) -> Result<(), StatusCode> {
    let centers = db.collection::<Center>("centers");
    let existing = centers
        .find_one(doc! { "$or": [{"user_id": center_id}, {"_id": center_id}] }, None)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if existing.is_some() {
        Ok(())
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn admin_get_wallet(
    State(db): State<Database>,
    claims: Claims,
    Path(center_id): Path<String>,
) -> (StatusCode, Json<Option<WalletResponse>>) {
    if !is_admin(&claims) {
        return (StatusCode::FORBIDDEN, Json(None));
    }
    let input_oid = match parse_object_id(&center_id) {
        Ok(v) => v,
        Err(s) => return (s, Json(None)),
    };
    let center_oid = match get_center_user_id(&db, input_oid).await {
        Ok(v) => v,
        Err(s) => return (s, Json(None)),
    };

    let wallet = match ensure_wallet(&db, center_oid).await {
        Ok(w) => w,
        Err(code) => return (code, Json(None)),
    };

    (
        StatusCode::OK,
        Json(Some(WalletResponse {
            center_id: wallet.center_id.to_hex(),
            balance: wallet.balance,
            royalty_percentage: wallet.royalty_percentage,
        })),
    )
}

pub async fn admin_update_royalty(
    State(db): State<Database>,
    claims: Claims,
    Path(center_id): Path<String>,
    Json(payload): Json<UpdateRoyaltyRequest>,
) -> (StatusCode, Json<UpdateRoyaltyResponse>) {
    if !is_admin(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(UpdateRoyaltyResponse {
                success: false,
                message: "Unauthorized".to_string(),
                royalty_percentage: None,
            }),
        );
    }

    if !payload.royalty_percentage.is_finite()
        || payload.royalty_percentage < 0.0
        || payload.royalty_percentage > 100.0
    {
        return (
            StatusCode::BAD_REQUEST,
            Json(UpdateRoyaltyResponse {
                success: false,
                message: "royalty_percentage must be between 0 and 100".to_string(),
                royalty_percentage: None,
            }),
        );
    }

    let input_oid = match parse_object_id(&center_id) {
        Ok(v) => v,
        Err(code) => {
            return (
                code,
                Json(UpdateRoyaltyResponse {
                    success: false,
                    message: "Invalid center_id".to_string(),
                    royalty_percentage: None,
                }),
            );
        }
    };
    let center_oid = match get_center_user_id(&db, input_oid).await {
        Ok(v) => v,
        Err(code) => {
            return (
                code,
                Json(UpdateRoyaltyResponse {
                    success: false,
                    message: "Center not found".to_string(),
                    royalty_percentage: None,
                }),
            );
        }
    };

    let coll = db.collection::<CenterWallet>("center_wallet");
    let now = Utc::now();
    let opts = FindOneAndUpdateOptions::builder()
        .upsert(true)
        .return_document(ReturnDocument::After)
        .build();

    let updated = coll
        .find_one_and_update(
            doc! { "center_id": center_oid },
            doc! {
                "$set": {
                    "royalty_percentage": payload.royalty_percentage,
                    "updated_at": now
                },
                "$setOnInsert": {
                    "balance": 0.0,
                    "created_at": now
                }
            },
            opts,
        )
        .await;

    match updated {
        Ok(Some(w)) => (
            StatusCode::OK,
            Json(UpdateRoyaltyResponse {
                success: true,
                message: "Royalty updated".to_string(),
                royalty_percentage: Some(w.royalty_percentage),
            }),
        ),
        _ => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(UpdateRoyaltyResponse {
                success: false,
                message: "Failed to update royalty".to_string(),
                royalty_percentage: None,
            }),
        ),
    }
}

#[derive(Debug, Deserialize)]
pub struct AddFundsRequest {
    pub center_id: String,
    pub amount: f64,
    pub description: Option<String>,
    pub payment_method: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AddFundsResponse {
    pub success: bool,
    pub message: String,
    pub balance: Option<f64>,
    pub transaction_id: Option<String>,
    pub royalty_amount: Option<f64>,
    pub net_amount: Option<f64>,
}

pub async fn admin_add_funds(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<AddFundsRequest>,
) -> (StatusCode, Json<AddFundsResponse>) {
    if !is_admin(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(AddFundsResponse {
                success: false,
                message: "Unauthorized".to_string(),
                balance: None,
                transaction_id: None,
                royalty_amount: None,
                net_amount: None,
            }),
        );
    }
    if !payload.amount.is_finite() || payload.amount <= 0.0 {
        return (
            StatusCode::BAD_REQUEST,
            Json(AddFundsResponse {
                success: false,
                message: "amount must be > 0".to_string(),
                balance: None,
                transaction_id: None,
                royalty_amount: None,
                net_amount: None,
            }),
        );
    }

    let input_oid = match parse_object_id(&payload.center_id) {
        Ok(v) => v,
        Err(code) => {
            return (
                code,
                Json(AddFundsResponse {
                    success: false,
                    message: "Invalid center_id".to_string(),
                    balance: None,
                    transaction_id: None,
                    royalty_amount: None,
                    net_amount: None,
                }),
            );
        }
    };
    let center_oid = match get_center_user_id(&db, input_oid).await {
        Ok(v) => v,
        Err(code) => {
            return (
                code,
                Json(AddFundsResponse {
                    success: false,
                    message: "Center not found".to_string(),
                    balance: None,
                    transaction_id: None,
                    royalty_amount: None,
                    net_amount: None,
                }),
            );
        }
    };

    let wallet = match ensure_wallet(&db, center_oid).await {
        Ok(w) => w,
        Err(code) => {
            return (
                code,
                Json(AddFundsResponse {
                    success: false,
                    message: "Failed to load wallet".to_string(),
                    balance: None,
                    transaction_id: None,
                    royalty_amount: None,
                    net_amount: None,
                }),
            );
        }
    };

    let royalty = round2(payload.amount * wallet.royalty_percentage / 100.0);
    let net_amount = payload.amount;

    let now = Utc::now();
    let tx_oid = ObjectId::new();
    let transaction_id = format!(
        "CW-{}-{}",
        now.format("%Y%m%d"),
        &tx_oid.to_hex()[..10]
    );
    let receipt_number = format!("RC-{}-{}", now.format("%Y%m%d"), tx_oid.to_hex());

    let created_by = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(AddFundsResponse {
                    success: false,
                    message: "Invalid token".to_string(),
                    balance: None,
                    transaction_id: None,
                    royalty_amount: None,
                    net_amount: None,
                }),
            );
        }
    };

    let balance_before = wallet.balance;
    let balance_after = balance_before + net_amount;

    // 1) Insert transaction record
    let tx_coll = db.collection::<WalletTransaction>("wallet_transactions");
    let tx = WalletTransaction {
        id: Some(tx_oid),
        center_id: center_oid,
        transaction_id: transaction_id.clone(),
        tx_type: WalletTransactionType::Credit,
        credit_amount: Some(payload.amount),
        royalty_amount: Some(royalty),
        net_amount,
        paid_amount: Some(payload.amount),
        gateway: None,
        gateway_order_id: None,
        gateway_payment_id: None,
        receipt_number: Some(receipt_number.clone()),
        verified: true,
        description: payload.description.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        payment_method: payload.payment_method.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        created_by,
        created_at: now,
        student_id: None,
        student_name: None,
        student_enrollment: None,
        balance_before,
        balance_after,
    };

    if tx_coll
        .insert_one(tx, None)
        .await
        .is_err()
    {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(AddFundsResponse {
                success: false,
                message: "Failed to create transaction".to_string(),
                balance: None,
                transaction_id: None,
                royalty_amount: None,
                net_amount: None,
            }),
        );
    }

    // 2) Update wallet balance
    let wallet_coll = db.collection::<CenterWallet>("center_wallet");
    let opts = FindOneAndUpdateOptions::builder()
        .return_document(ReturnDocument::After)
        .build();

    let updated = wallet_coll
        .find_one_and_update(
            doc! { "center_id": center_oid },
            doc! { "$inc": { "balance": net_amount }, "$set": { "updated_at": now } },
            opts,
        )
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR);

    match updated {
        Ok(Some(w)) => (
            StatusCode::OK,
            Json(AddFundsResponse {
                success: true,
                message: "Funds added".to_string(),
                balance: Some(w.balance),
                transaction_id: Some(transaction_id),
                royalty_amount: Some(royalty),
                net_amount: Some(net_amount),
            }),
        ),
        _ => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(AddFundsResponse {
                success: false,
                message: "Failed to update wallet".to_string(),
                balance: None,
                transaction_id: None,
                royalty_amount: None,
                net_amount: None,
            }),
        ),
    }
}

#[derive(Debug, Deserialize)]
pub struct TxQuery {
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct TxItem {
    pub id: String,
    pub center_id: String,
    pub transaction_id: String,
    #[serde(rename = "type")]
    pub tx_type: WalletTransactionType,
    pub credit_amount: Option<f64>,
    pub royalty_amount: Option<f64>,
    pub paid_amount: Option<f64>,
    pub net_amount: f64,
    pub description: Option<String>,
    pub payment_method: Option<String>,
    pub gateway: Option<String>,
    pub gateway_order_id: Option<String>,
    pub gateway_payment_id: Option<String>,
    pub receipt_number: Option<String>,
    pub verified: bool,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
    // For fee deduction transactions
    pub student_id: Option<String>,
    pub student_name: Option<String>,
    pub student_enrollment: Option<String>,
    pub balance_before: f64,
    pub balance_after: f64,
}

#[derive(Debug, Serialize)]
pub struct TxListResponse {
    pub items: Vec<TxItem>,
    pub total: u64,
    pub page: u32,
    pub limit: u32,
}

pub async fn admin_list_transactions(
    State(db): State<Database>,
    claims: Claims,
    Path(center_id): Path<String>,
    Query(q): Query<TxQuery>,
) -> (StatusCode, Json<TxListResponse>) {
    if !is_admin(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(TxListResponse {
                items: Vec::new(),
                total: 0,
                page: 1,
                limit: 0,
            }),
        );
    }
    let input_oid = match parse_object_id(&center_id) {
        Ok(v) => v,
        Err(code) => {
            return (
                code,
                Json(TxListResponse {
                    items: Vec::new(),
                    total: 0,
                    page: 1,
                    limit: 0,
                }),
            );
        }
    };
    let center_oid = match get_center_user_id(&db, input_oid).await {
        Ok(v) => v,
        Err(code) => {
            return (
                code,
                Json(TxListResponse {
                    items: Vec::new(),
                    total: 0,
                    page: 1,
                    limit: 0,
                }),
            );
        }
    };

    let page = q.page.unwrap_or(1);
    let limit = q.limit.unwrap_or(20).min(100);
    let skip = ((page.saturating_sub(1)) as u64) * (limit as u64);

    let coll = db.collection::<WalletTransaction>("wallet_transactions");
    let filter = doc! { "center_id": center_oid };
    let total = coll
        .count_documents(filter.clone(), None)
        .await
        .unwrap_or(0);

    let find_opts = FindOptions::builder()
        .sort(Some(doc! { "created_at": -1 }))
        .limit(Some(limit as i64))
        .skip(Some(skip))
        .build();

    let mut cursor = match coll.find(filter, find_opts).await {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(TxListResponse {
                    items: Vec::new(),
                    total,
                    page,
                    limit,
                }),
            );
        }
    };

    let mut items = Vec::new();
    use futures_util::stream::StreamExt;
    while let Some(res) = cursor.next().await {
        if let Ok(tx) = res {
            if let Some(id) = tx.id {
                items.push(TxItem {
                    id: id.to_hex(),
                    center_id: tx.center_id.to_hex(),
                    transaction_id: tx.transaction_id,
                    tx_type: tx.tx_type,
                    credit_amount: tx.credit_amount,
                    royalty_amount: tx.royalty_amount,
                    paid_amount: tx.paid_amount,
                    net_amount: tx.net_amount,
                    description: tx.description,
                    payment_method: tx.payment_method,
                    gateway: tx.gateway,
                    gateway_order_id: tx.gateway_order_id,
                    gateway_payment_id: tx.gateway_payment_id,
                    receipt_number: tx.receipt_number,
                    verified: tx.verified,
                    created_by: tx.created_by.to_hex(),
                    created_at: tx.created_at,
                    student_id: tx.student_id.map(|oid| oid.to_hex()),
                    student_name: tx.student_name,
                    student_enrollment: tx.student_enrollment,
                    balance_before: tx.balance_before,
                    balance_after: tx.balance_after,
                });
            }
        }
    }

    (
        StatusCode::OK,
        Json(TxListResponse {
            items,
            total,
            page,
            limit,
        }),
    )
}

pub async fn center_get_wallet(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Option<WalletResponse>>) {
    let center_oid = match get_center_id_for_center_user(&db, &claims).await {
        Ok(v) => v,
        Err(code) => return (code, Json(None)),
    };

    if let Err(code) = ensure_center_exists(&db, center_oid).await {
        return (code, Json(None));
    }

    let wallet = match ensure_wallet(&db, center_oid).await {
        Ok(w) => w,
        Err(code) => return (code, Json(None)),
    };

    (
        StatusCode::OK,
        Json(Some(WalletResponse {
            center_id: wallet.center_id.to_hex(),
            balance: wallet.balance,
            royalty_percentage: wallet.royalty_percentage,
        })),
    )
}

pub async fn center_list_transactions(
    State(db): State<Database>,
    claims: Claims,
    Query(q): Query<TxQuery>,
) -> (StatusCode, Json<TxListResponse>) {
    let center_oid = match get_center_id_for_center_user(&db, &claims).await {
        Ok(v) => v,
        Err(code) => {
            return (
                code,
                Json(TxListResponse {
                    items: Vec::new(),
                    total: 0,
                    page: 1,
                    limit: 0,
                }),
            );
        }
    };

    let page = q.page.unwrap_or(1);
    let limit = q.limit.unwrap_or(20).min(100);
    let skip = ((page.saturating_sub(1)) as u64) * (limit as u64);

    let coll = db.collection::<WalletTransaction>("wallet_transactions");
    let filter = doc! { "center_id": center_oid };
    let total = coll
        .count_documents(filter.clone(), None)
        .await
        .unwrap_or(0);

    let find_opts = FindOptions::builder()
        .sort(Some(doc! { "created_at": -1 }))
        .limit(Some(limit as i64))
        .skip(Some(skip))
        .build();

    let mut cursor = match coll.find(filter, find_opts).await {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(TxListResponse {
                    items: Vec::new(),
                    total,
                    page,
                    limit,
                }),
            );
        }
    };

    let mut items = Vec::new();
    use futures_util::stream::StreamExt;
    while let Some(res) = cursor.next().await {
        if let Ok(tx) = res {
            if let Some(id) = tx.id {
                items.push(TxItem {
                    id: id.to_hex(),
                    center_id: tx.center_id.to_hex(),
                    transaction_id: tx.transaction_id,
                    tx_type: tx.tx_type,
                    credit_amount: tx.credit_amount,
                    royalty_amount: tx.royalty_amount,
                    paid_amount: tx.paid_amount,
                    net_amount: tx.net_amount,
                    description: tx.description,
                    payment_method: tx.payment_method,
                    gateway: tx.gateway,
                    gateway_order_id: tx.gateway_order_id,
                    gateway_payment_id: tx.gateway_payment_id,
                    receipt_number: tx.receipt_number,
                    verified: tx.verified,
                    created_by: tx.created_by.to_hex(),
                    created_at: tx.created_at,
                    student_id: tx.student_id.map(|oid| oid.to_hex()),
                    student_name: tx.student_name,
                    student_enrollment: tx.student_enrollment,
                    balance_before: tx.balance_before,
                    balance_after: tx.balance_after,
                });
            }
        }
    }

    (
        StatusCode::OK,
        Json(TxListResponse {
            items,
            total,
            page,
            limit,
        }),
    )
}

#[derive(Debug, Deserialize)]
pub struct UpdateTxDateRequest {
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct UpdateTxDateResponse {
    pub success: bool,
    pub message: String,
}

pub async fn admin_update_transaction_date(
    State(db): State<Database>,
    claims: Claims,
    Path(tx_id): Path<String>,
    Json(payload): Json<UpdateTxDateRequest>,
) -> (StatusCode, Json<UpdateTxDateResponse>) {
    if !is_admin(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(UpdateTxDateResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }
    let oid = match parse_object_id(&tx_id) {
        Ok(v) => v,
        Err(code) => {
            return (
                code,
                Json(UpdateTxDateResponse {
                    success: false,
                    message: "Invalid transaction id".to_string(),
                }),
            );
        }
    };

    let coll = db.collection::<WalletTransaction>("wallet_transactions");
    let res = coll
        .update_one(
            doc! { "_id": oid },
            doc! { "$set": { "created_at": payload.created_at } },
            None,
        )
        .await;

    match res {
        Ok(r) if r.matched_count == 1 => (
            StatusCode::OK,
            Json(UpdateTxDateResponse {
                success: true,
                message: "Transaction date updated".to_string(),
            }),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(UpdateTxDateResponse {
                success: false,
                message: "Transaction not found".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(UpdateTxDateResponse {
                success: false,
                message: "Update failed".to_string(),
            }),
        ),
    }
}

#[derive(Debug, Serialize)]
pub struct BootstrapResponse {
    pub success: bool,
    pub message: String,
    pub processed_centers: u64,
    pub wallets_initialized: u64,
    pub opening_transactions_created: u64,
}

pub async fn admin_bootstrap_wallets_from_fees(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<BootstrapResponse>) {
    if !is_super_admin(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(BootstrapResponse {
                success: false,
                message: "Only superadmin can bootstrap wallets".to_string(),
                processed_centers: 0,
                wallets_initialized: 0,
                opening_transactions_created: 0,
            }),
        );
    }

    let centers_coll = db.collection::<crate::models::center::Center>("centers");
    let fees_coll = db.collection::<FeeRecord>("fees");
    let wallets_coll = db.collection::<CenterWallet>("center_wallet");
    let tx_coll = db.collection::<WalletTransaction>("wallet_transactions");

    let mut cursor = match centers_coll.find(doc! {}, None).await {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(BootstrapResponse {
                    success: false,
                    message: "Failed to read centers".to_string(),
                    processed_centers: 0,
                    wallets_initialized: 0,
                    opening_transactions_created: 0,
                }),
            );
        }
    };

    let mut processed = 0;
    let mut wallets_initialized = 0;
    let mut opening_created = 0;
    use futures_util::stream::StreamExt;

    while let Some(res) = cursor.next().await {
        if let Ok(center) = res {
            let center_id = center.user_id; // Use center.user_id instead of center.id
            processed += 1;

            // Sum all fees for this center
            let mut fee_cursor = match fees_coll
                .find(doc! { "center_id": center_id }, None)
                .await
            {
                Ok(c) => c,
                Err(_) => continue,
            };
            let mut total: f64 = 0.0;
            while let Some(fr) = fee_cursor.next().await {
                if let Ok(f) = fr {
                    total += f.amount;
                }
            }
            if total <= 0.0 {
                continue;
            }

            // Skip if wallet already has non-zero balance
            let existing_wallet = wallets_coll
                .find_one(doc! { "center_id": center_id }, None)
                .await
                .ok()
                .flatten();
            if let Some(w) = &existing_wallet {
                if w.balance.abs() > f64::EPSILON {
                    continue;
                }
            }

            let royalty_pct = center
                .config_validity
                .as_ref()
                .and_then(|c| c.royalty_percent)
                .unwrap_or(10.0);
            let royalty = round2(total * royalty_pct / 100.0);
            let net = total;
            let now = Utc::now();

            // Upsert wallet
            let update = doc! {
                "$setOnInsert": {
                    "center_id": center_id,
                    "created_at": now,
                },
                "$set": {
                    "balance": net,
                    "royalty_percentage": royalty_pct,
                    "updated_at": now,
                }
            };
            let _ = wallets_coll
                .update_one(doc! { "center_id": center_id }, update, None)
                .await;
            wallets_initialized += 1;

            // Create opening transaction only if none exists
            let existing_tx = tx_coll
                .find_one(doc! { "center_id": center_id }, None)
                .await
                .ok()
                .flatten();
            if existing_tx.is_some() {
                continue;
            }

            let tx_oid = ObjectId::new();
            let transaction_id = format!(
                "CW-OPEN-{}-{}",
                now.format("%Y%m%d"),
                &tx_oid.to_hex()[..8]
            );

            let created_by = ObjectId::parse_str(&claims.sub).unwrap_or_else(|_| center.admin_id);

            let tx = WalletTransaction {
                id: Some(tx_oid),
                center_id,
                transaction_id,
                tx_type: WalletTransactionType::Credit,
                credit_amount: Some(total),
                royalty_amount: Some(royalty),
                net_amount: net,
                paid_amount: Some(total),
                gateway: None,
                gateway_order_id: None,
                gateway_payment_id: None,
                receipt_number: None,
                verified: true,
                description: Some("Opening balance from historical fees".to_string()),
                payment_method: Some("opening_balance".to_string()),
                created_by,
                created_at: now,
                student_id: None,
                student_name: None,
                student_enrollment: None,
                balance_before: 0.0,
                balance_after: net,
            };
            if tx_coll.insert_one(tx, None).await.is_ok() {
                opening_created += 1;
            }
        }
    }

    (
        StatusCode::OK,
        Json(BootstrapResponse {
            success: true,
            message: "Bootstrap completed".to_string(),
            processed_centers: processed,
            wallets_initialized,
            opening_transactions_created: opening_created,
        }),
    )
}

fn generate_receipt_html(
    center: &Center,
    transaction: &WalletTransaction,
    paid_amount: f64,
    royalty_amount: f64,
    receipt_number: &str,
) -> String {
    let center_name = &center.name;
    let center_code = &center.code;
    let tx_id = &transaction.transaction_id;
    let recharge_amount = transaction.credit_amount.unwrap_or(0.0);
    let date = transaction.created_at.format("%d-%m-%Y").to_string();
    let time = transaction.created_at.format("%H:%M:%S").to_string();
    let _gateway_order_id = transaction.gateway_order_id.as_deref().unwrap_or("—");
    let gateway_payment_id = transaction.gateway_payment_id.as_deref().unwrap_or("—");

    format!(
        r#"
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Receipt - {}</title>
            <style>
                body {{ font-family: 'Helvetica', 'Arial', sans-serif; margin: 20px; color: #333; line-height: 1.6; }}
                .receipt {{ max-width: 800px; margin: 0 auto; border: 2px solid #0F172A; padding: 40px; }}
                .header {{ text-align: center; border-bottom: 3px solid #0F172A; padding-bottom: 20px; margin-bottom: 30px; }}
                .center-name {{ font-size: 28px; font-weight: 900; text-transform: uppercase; color: #0F172A; }}
                .receipt-title {{ font-size: 20px; font-weight: bold; margin-top: 10px; color: #1e40af; text-transform: uppercase; }}
                .section {{ margin-bottom: 20px; }}
                .section-title {{ font-size: 13px; font-weight: bold; text-transform: uppercase; color: #666; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 10px; }}
                .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }}
                .field {{ margin-bottom: 8px; }}
                .label {{ font-size: 11px; font-weight: bold; text-transform: uppercase; color: #999; display: block; }}
                .value {{ font-size: 14px; font-weight: 600; color: #111; }}
                .amount-row {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #eee; }}
                .amount-label {{ font-weight: bold; }}
                .amount-value {{ font-weight: bold; font-size: 14px; }}
                .total-amount {{ font-size: 18px; font-weight: 900; color: #dc2626; }}
                .footer {{ margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee; text-align: center; font-size: 11px; color: #666; }}
                @media print {{
                    body {{ margin: 0; }}
                    @page {{ margin: 1cm; }}
                    .receipt {{ border: none; }}
                }}
            </style>
        </head>
        <body>
            <div class="receipt">
                <div class="header">
                    <div class="center-name">{}</div>
                    <div style="margin-top: 8px; font-size: 12px; font-weight: bold;">Center Code: {}</div>
                    <div class="receipt-title">Payment Receipt</div>
                    <div style="margin-top: 10px; font-size: 12px;">Receipt No: <span style="font-weight: bold;">{}</span></div>
                </div>

                <div class="section">
                    <div class="section-title">Transaction Details</div>
                    <div class="grid">
                        <div class="field">
                            <span class="label">Transaction ID</span>
                            <span class="value">{}</span>
                        </div>
                        <div class="field">
                            <span class="label">Date</span>
                            <span class="value">{}</span>
                        </div>
                        <div class="field">
                            <span class="label">Time</span>
                            <span class="value">{}</span>
                        </div>
                        <div class="field">
                            <span class="label">Payment ID (Gateway)</span>
                            <span class="value">{}</span>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Payment Breakdown</div>
                    <div class="amount-row">
                        <span class="amount-label">Recharge Amount</span>
                        <span class="amount-value">₹{:.2}</span>
                    </div>
                    <div class="amount-row">
                        <span class="amount-label">Royalty Deducted</span>
                        <span class="amount-value">₹{:.2}</span>
                    </div>
                    <div class="amount-row" style="border-bottom: 2px solid #0F172A; padding-bottom: 10px;">
                        <span class="amount-label" style="font-size: 16px;">Total Paid</span>
                        <span class="amount-value total-amount">₹{:.2}</span>
                    </div>
                </div>

                <div class="footer">
                    <p>This is a system-generated receipt and does not require a signature.</p>
                    <p>Generated on: {}</p>
                </div>
            </div>
        </body>
        </html>
        "#,
        receipt_number,
        center_name,
        center_code,
        receipt_number,
        tx_id,
        date,
        time,
        gateway_payment_id,
        recharge_amount,
        royalty_amount,
        paid_amount,
        Utc::now().format("%d-%m-%Y %H:%M:%S"),
    )
}

pub async fn download_receipt_by_transaction_id(
    State(db): State<Database>,
    claims: Claims,
    Path(tx_id): Path<String>,
) -> impl IntoResponse {
    let tx_oid = match ObjectId::parse_str(&tx_id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, "Invalid transaction ID").into_response(),
    };

    // Get the wallet transaction
    let tx_coll = db.collection::<WalletTransaction>("wallet_transactions");
    let transaction = match tx_coll.find_one(doc! { "_id": tx_oid }, None).await {
        Ok(Some(t)) => t,
        _ => return (StatusCode::NOT_FOUND, "Transaction not found").into_response(),
    };

    // Verify authorization:
    // Admin/SuperAdmin can see all
    // Center can only see their own
    let center_oid = transaction.center_id;
    let center_coll = db.collection::<Center>("centers");
    let center = match center_coll.find_one(doc! { "user_id": center_oid }, None).await { // Find center by user_id now
        Ok(Some(c)) => c,
        _ => return (StatusCode::NOT_FOUND, "Center not found").into_response(),
    };

    if claims.role != UserRole::SuperAdmin
        && claims.role != UserRole::Admin
        && claims.sub != center.user_id.to_hex()
    {
        return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
    }

    let paid_amount = transaction.paid_amount.unwrap_or(0.0);
    let royalty_amount = transaction.royalty_amount.unwrap_or(0.0);
    let receipt_number = if let Some(rn) = &transaction.receipt_number {
        rn.clone()
    } else {
        format!("RC-{}-{}", transaction.created_at.format("%Y%m%d"), tx_oid.to_hex())
    };
    let html = generate_receipt_html(&center, &transaction, paid_amount, royalty_amount, &receipt_number);

    // Generate PDF using the same approach as center_pdf.rs
    let temp_dir = std::env::temp_dir();
    let timestamp = Utc::now().timestamp();
    let pdf_filename = format!("receipt_{}_{}.pdf", receipt_number, timestamp);
    let abs_pdf_path = temp_dir.join(&pdf_filename);

    let mut pdf_generated = false;
    let mut last_error = String::new();

    // First write HTML to temp file
    let html_filename = format!("receipt_{}_{}.html", receipt_number, timestamp);
    let abs_html_path = temp_dir.join(&html_filename);
    if let Err(e) = fs::write(&abs_html_path, html) {
        eprintln!("Failed to write temp HTML for receipt: {}", e);
        return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to generate receipt").into_response();
    }

    let chromium_paths = [
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/snap/bin/chromium",
        "google-chrome-stable",
        "google-chrome",
        "chromium-browser",
        "chromium",
    ];

    for path in chromium_paths {
        let input_url = format!("file://{}", abs_html_path.display());
        let output = Command::new(path)
            .args([
                "--headless=new",
                "--disable-gpu",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-extensions",
                "--allow-file-access-from-files",
                &format!("--print-to-pdf={}", abs_pdf_path.display()),
                &input_url,
            ])
            .output();

        match output {
            Ok(out) if out.status.success() => {
                if abs_pdf_path.exists() {
                    pdf_generated = true;
                    break;
                }
            }
            Ok(out) => {
                let err = String::from_utf8_lossy(&out.stderr);
                let stdout = String::from_utf8_lossy(&out.stdout);
                last_error = format!("Chromium failed: stderr: {}, stdout: {}", err, stdout);
                eprintln!("{}", last_error);
            }
            Err(e) => {
                last_error = format!("Failed to run chromium: {}", e);
                eprintln!("{}", last_error);
            }
        }
    }

    if pdf_generated {
        let pdf_content = match fs::read(&abs_pdf_path) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("Failed to read generated PDF: {}", e);
                return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read PDF").into_response();
            }
        };

        let _ = fs::remove_file(&abs_html_path);
        let _ = fs::remove_file(&abs_pdf_path);

        (
            StatusCode::OK,
            [
                (header::CONTENT_TYPE, "application/pdf"),
                (
                    header::CONTENT_DISPOSITION,
                    &format!("attachment; filename=\"receipt_{}.pdf\"", receipt_number),
                ),
            ],
            pdf_content,
        ).into_response()
    } else {
        let _ = fs::remove_file(&abs_html_path);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to generate PDF: {}", last_error),
        ).into_response()
    }
}
