use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use chrono::Utc;
use hmac::{Hmac, Mac};
use mongodb::{
    bson::{doc, oid::ObjectId},
    options::{FindOneAndUpdateOptions, ReturnDocument},
    Database,
};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use base64::Engine;
use crate::models::user::{Claims, UserRole};
use crate::models::payment::{Payment, PaymentStatus};
use crate::models::center_wallet::CenterWallet;
use crate::models::wallet_transaction::WalletTransaction;
use crate::models::system_settings::SystemSettings;

#[derive(Debug, Deserialize)]
pub struct CreateOrderRequest {
    pub amount: Option<f64>, // Backwards compatibility
    pub recharge_amount: Option<f64>, // New field for wallet recharge (amount to credit)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateOrderResponse {
    pub success: bool,
    pub order_id: Option<String>,
    pub amount: Option<f64>,
    pub key_id: Option<String>,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifyPaymentRequest {
    pub razorpay_order_id: String,
    pub razorpay_payment_id: String,
    pub razorpay_signature: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VerifyPaymentResponse {
    pub success: bool,
    pub message: String,
}

type HmacSha256 = Hmac<Sha256>;

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

pub async fn create_order(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateOrderRequest>,
) -> (StatusCode, Json<CreateOrderResponse>) {
    println!("CREATE_ORDER: create_order entered");
    if claims.role != UserRole::Center {
        println!("CREATE_ORDER: Unauthorized role");
        return (StatusCode::FORBIDDEN, Json(CreateOrderResponse {
            success: false,
            order_id: None,
            amount: None,
            key_id: None,
            message: "Only centers can recharge wallet".to_string(),
        }));
    }

    // Determine recharge amount and payable amount
    let recharge_amount_val: f64;
    let mut payable_amount_val: f64;
    let royalty_amount_val: f64;

    // Get user ID from claims.sub, then find the associated Center document to get center's _id
    let user_id = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => {
            println!("CREATE_ORDER: Invalid token");
            return (StatusCode::UNAUTHORIZED, Json(CreateOrderResponse {
                success: false,
                order_id: None,
                amount: None,
                key_id: None,
                message: "Invalid token".to_string(),
            }));
        }
    };
    let centers_coll = db.collection::<crate::models::center::Center>("centers");
    let center = match centers_coll.find_one(doc! { "user_id": user_id }, None).await {
        Ok(Some(c)) => c,
        Ok(None) => {
            println!("CREATE_ORDER: No center found for user");
            return (StatusCode::NOT_FOUND, Json(CreateOrderResponse {
                success: false,
                order_id: None,
                amount: None,
                key_id: None,
                message: "Center not found".to_string(),
            }));
        }
        Err(e) => {
            println!("CREATE_ORDER: Error finding center: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(CreateOrderResponse {
                success: false,
                order_id: None,
                amount: None,
                key_id: None,
                message: "Database error".to_string(),
            }));
        }
    };
    let center_id = match center.id {
        Some(id) => id,
        None => {
            println!("CREATE_ORDER: Center has no _id");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(CreateOrderResponse {
                success: false,
                order_id: None,
                amount: None,
                key_id: None,
                message: "Invalid center".to_string(),
            }));
        }
    };
    println!("CREATE_ORDER: Got center_id: {:?}", center_id);

    // Load system settings for Razorpay config
    let settings_coll = db.collection::<SystemSettings>("system_settings");
    let settings = match settings_coll.find_one(None, None).await {
        Ok(Some(s)) => s,
        _ => SystemSettings::default(),
    };

    if !settings.payment_gateway_enabled {
        println!("CREATE_ORDER: Payment gateway not enabled");
        return (StatusCode::BAD_REQUEST, Json(CreateOrderResponse {
            success: false,
            order_id: None,
            amount: None,
            key_id: None,
            message: "Payment gateway not enabled".to_string(),
        }));
    }

    let key_id_val = match settings.razorpay_key_id.as_ref() {
        Some(k) => k.clone(),
        None => {
            println!("CREATE_ORDER: No razorpay_key_id in settings");
            return (StatusCode::BAD_REQUEST, Json(CreateOrderResponse {
                success: false,
                order_id: None,
                amount: None,
                key_id: None,
                message: "Payment gateway not configured".to_string(),
            }));
        }
    };
    let key_secret_val = match settings.get_razorpay_key_secret() {
        Some(s) => s,
        None => {
            println!("CREATE_ORDER: No razorpay_key_secret in settings");
            return (StatusCode::BAD_REQUEST, Json(CreateOrderResponse {
                success: false,
                order_id: None,
                amount: None,
                key_id: None,
                message: "Payment gateway not configured".to_string(),
            }));
        }
    };

    // Get center wallet to get royalty percentage
    let wallet_coll = db.collection::<CenterWallet>("center_wallet");
    let wallet = match wallet_coll.find_one(doc! { "center_id": center_id }, None).await {
        Ok(Some(w)) => {
            println!("CREATE_ORDER: Found wallet: {:?}", w);
            w
        },
        Ok(None) => {
            // Create a default wallet
            println!("CREATE_ORDER: No wallet found, creating default");
            let default_wallet = CenterWallet {
                id: None,
                center_id,
                balance: 0.0,
                royalty_percentage: 0.0,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            };
            wallet_coll.insert_one(&default_wallet, None).await.ok();
            default_wallet
        },
        Err(e) => {
            println!("CREATE_ORDER: Error retrieving wallet: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(CreateOrderResponse {
                success: false,
                order_id: None,
                amount: None,
                key_id: None,
                message: "Failed to retrieve wallet".to_string(),
            }));
        }
    };

    let royalty_percent = wallet.royalty_percentage;
    println!("CREATE_ORDER: Royalty percent: {}", royalty_percent);

    // Backwards compatibility: if recharge_amount is not present, use amount
    if let Some(ra) = payload.recharge_amount {
        if ra <= 0.0 {
            println!("CREATE_ORDER: Recharge amount not >0: {}", ra);
            return (StatusCode::BAD_REQUEST, Json(CreateOrderResponse {
                success: false,
                order_id: None,
                amount: None,
                key_id: None,
                message: "Recharge amount must be greater than zero".to_string(),
            }));
        }
        recharge_amount_val = ra;
        royalty_amount_val = round2(recharge_amount_val * royalty_percent / 100.0);
        payable_amount_val = royalty_amount_val; // Center pays only the royalty amount
    } else if let Some(a) = payload.amount {
        if a <= 0.0 {
            println!("CREATE_ORDER: Amount not >0: {}", a);
            return (StatusCode::BAD_REQUEST, Json(CreateOrderResponse {
                success: false,
                order_id: None,
                amount: None,
                key_id: None,
                message: "Amount must be greater than zero".to_string(),
            }));
        }
        recharge_amount_val = a;
        royalty_amount_val = 0.0; // Backwards compatible: no royalty
        payable_amount_val = a;
    } else {
        println!("CREATE_ORDER: Neither amount nor recharge_amount provided");
        return (StatusCode::BAD_REQUEST, Json(CreateOrderResponse {
            success: false,
            order_id: None,
            amount: None,
            key_id: None,
            message: "Must provide either amount or recharge_amount".to_string(),
        }));
    }

    println!("CREATE_ORDER: recharge_amount_val: {}", recharge_amount_val);
    println!("CREATE_ORDER: royalty_amount_val: {}", royalty_amount_val);
    println!("CREATE_ORDER: payable_amount_val initial: {}", payable_amount_val);

    // Ensure payable amount is at least Razorpay's minimum (₹1.00)
    if payable_amount_val < 1.0 {
        payable_amount_val = 1.0;
    }
    println!("CREATE_ORDER: payable_amount_val after min check: {}", payable_amount_val);

    // Generate receipt number
    let receipt_number = format!("RC-{}-{}", Utc::now().format("%Y%m%d"), &ObjectId::new().to_hex()[..8]);
    println!("CREATE_ORDER: Generated receipt number: {}", receipt_number);

    // Ensure payable amount is at least Razpay's minimum (₹1.00) (duplicate check, just in case)
    let payable_amount_val = if payable_amount_val < 1.0 {
        1.0
    } else {
        payable_amount_val
    };
    println!("CREATE_ORDER: payable_amount_val final: {}", payable_amount_val);

    // Razorpay amount is in paise
    let amount_paise = (payable_amount_val * 100.0) as u64;
    println!("CREATE_ORDER: Amount in paise: {}", amount_paise);

    let client = reqwest::Client::new();
    let res = client
        .post("https://api.razorpay.com/v1/orders")
        .basic_auth(&key_id_val, Some(&key_secret_val))
        .json(&serde_json::json!({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": &receipt_number,
        }))
        .send()
        .await;

    match res {
        Ok(response) => {
            if response.status().is_success() {
                let razorpay_order: serde_json::Value = response.json().await.unwrap();
                let order_id = razorpay_order["id"].as_str().unwrap().to_string();
                println!("CREATE_ORDER: Got order_id from Razorpay: {}", order_id);

                let payment = Payment {
                    id: None,
                    center_id: Some(center_id),
                    student_data: None,
                    amount: payable_amount_val,
                    recharge_amount: Some(recharge_amount_val),
                    royalty_amount: Some(royalty_amount_val),
                    currency: "INR".to_string(),
                    razorpay_order_id: Some(order_id.clone()),
                    razorpay_payment_id: None,
                    razorpay_signature: None,
                    status: PaymentStatus::Pending,
                    receipt_number: Some(receipt_number.clone()),
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                };

                let collection = db.collection::<Payment>("payments");
                let insert_result = collection.insert_one(payment, None).await;
                match insert_result {
                    Ok(ir) => {
                        println!("CREATE_ORDER: Payment record saved, inserted id: {:?}", ir.inserted_id);
                    },
                    Err(e) => {
                        println!("CREATE_ORDER: Error saving payment record: {}", e);
                        return (StatusCode::INTERNAL_SERVER_ERROR, Json(CreateOrderResponse {
                            success: false,
                            order_id: None,
                            amount: None,
                            key_id: None,
                            message: "Failed to save payment record".to_string(),
                        }));
                    }
                }

                let response = CreateOrderResponse {
                    success: true,
                    order_id: Some(order_id),
                    amount: Some(payable_amount_val),
                    key_id: Some(key_id_val.clone()),
                    message: "Order created successfully".to_string(),
                };
                println!("CREATE_ORDER: Returning response: {:?}", response);
                (StatusCode::OK, Json(response))
            } else {
                let error_text = response.text().await.unwrap_or_else(|_| "unknown error".to_string());
                eprintln!("CREATE_ORDER: Razorpay API error: {}", error_text);
                (StatusCode::BAD_GATEWAY, Json(CreateOrderResponse {
                    success: false,
                    order_id: None,
                    amount: None,
                    key_id: None,
                    message: format!("Razorpay order creation failed: {}", error_text),
                }))
            }
        }
        Err(e) => {
            eprintln!("CREATE_ORDER: Failed to connect to Razorpay: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(CreateOrderResponse {
                success: false,
                order_id: None,
                amount: None,
                key_id: None,
                message: format!("Failed to connect to Razorpay: {}", e),
            }))
        }
    }
}

pub async fn verify_payment(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<VerifyPaymentRequest>,
) -> (StatusCode, Json<VerifyPaymentResponse>) {
    println!("1. verify_payment() entered: YES");
    println!("   Razorpay Order ID: {}", payload.razorpay_order_id);
    println!("   Razorpay Payment ID: {}", payload.razorpay_payment_id);

    if claims.role != UserRole::Center {
        println!("   ERROR: Unauthorized role");
        return (StatusCode::FORBIDDEN, Json(VerifyPaymentResponse {
            success: false,
            message: "Unauthorized".to_string(),
        }));
    }

    // Load system settings for Razorpay config
    let settings_coll = db.collection::<SystemSettings>("system_settings");
    let settings = match settings_coll.find_one(None, None).await {
        Ok(Some(s)) => s,
        _ => SystemSettings::default(),
    };
    let key_id = match settings.razorpay_key_id.as_ref() {
        Some(k) => k.clone(),
        None => {
            println!("   ERROR: Payment gateway not configured (no key_id)");
            return (StatusCode::BAD_REQUEST, Json(VerifyPaymentResponse {
                success: false,
                message: "Payment gateway not configured".to_string(),
            }));
        }
    };
    let key_secret = match settings.get_razorpay_key_secret() {
        Some(s) => s,
        None => {
            println!("   ERROR: Payment gateway not configured (no key_secret)");
            return (StatusCode::BAD_REQUEST, Json(VerifyPaymentResponse {
                success: false,
                message: "Payment gateway not configured".to_string(),
            }));
        }
    };

    // Verify signature
    println!("2. Verifying signature");
    let data = format!("{}|{}", payload.razorpay_order_id, payload.razorpay_payment_id);
    let mut mac = HmacSha256::new_from_slice(key_secret.as_bytes()).expect("HMAC can take key of any size");
    mac.update(data.as_bytes());
    let result = mac.finalize();
    let signature_bytes = result.into_bytes();
    let expected_signature = hex::encode(signature_bytes);

    if expected_signature != payload.razorpay_signature {
        println!("   ERROR: Invalid signature (expected: {}, received: {})", expected_signature, payload.razorpay_signature);
        return (StatusCode::BAD_REQUEST, Json(VerifyPaymentResponse {
            success: false,
            message: "Invalid signature".to_string(),
        }));
    }
    println!("   Signature verified successfully");

    // Verify payment with Razorpay API directly
    println!("3. Verifying payment with Razorpay API");
    let client = reqwest::Client::new();
    let auth = base64::engine::general_purpose::STANDARD.encode(format!("{}:{}", key_id, key_secret));
    let razorpay_res = client
        .get(format!("https://api.razorpay.com/v1/payments/{}", payload.razorpay_payment_id))
        .header("Authorization", format!("Basic {}", auth))
        .send()
        .await;

    match razorpay_res {
        Ok(res) => {
            if !res.status().is_success() {
                println!("   ERROR: Razorpay API request failed with status: {}", res.status());
                return (StatusCode::BAD_REQUEST, Json(VerifyPaymentResponse {
                    success: false,
                    message: "Failed to verify payment with gateway".to_string(),
                }));
            }
            let payment_json: serde_json::Value = res.json().await.unwrap();
            if payment_json["status"] != "captured" {
                println!("   ERROR: Payment not captured, status: {:?}", payment_json["status"]);
                return (StatusCode::BAD_REQUEST, Json(VerifyPaymentResponse {
                    success: false,
                    message: "Payment not captured by gateway".to_string(),
                }));
            }
            println!("   Payment verified as captured with Razorpay API");
        }
        Err(e) => {
            println!("   ERROR: Failed to connect to Razorpay API: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(VerifyPaymentResponse {
                success: false,
                message: "Failed to connect to payment gateway".to_string(),
            }));
        }
    }

    // Find payment
    println!("4. Looking up payment document");
    let payments_coll = db.collection::<Payment>("payments");
    let payment = match payments_coll.find_one(doc! { "razorpay_order_id": &payload.razorpay_order_id }, None).await {
        Ok(Some(p)) => p,
        Ok(None) => {
            println!("   ERROR: Payment not found for order ID: {}", payload.razorpay_order_id);
            return (StatusCode::NOT_FOUND, Json(VerifyPaymentResponse {
                success: false,
                message: "Payment not found".to_string(),
            }));
        }
        Err(e) => {
            println!("   ERROR: Database error looking up payment: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(VerifyPaymentResponse {
                success: false,
                message: "Database error".to_string(),
            }));
        }
    };

    println!("   Payment document found:");
    println!("   - _id: {:?}", payment.id);
    println!("   - status: {:?}", payment.status);
    println!("   - center_id: {:?}", payment.center_id);
    println!("   - recharge_amount: {:?}", payment.recharge_amount);
    println!("   - royalty_amount: {:?}", payment.royalty_amount);
    println!("   - amount: {:?}", payment.amount);

    if payment.status == PaymentStatus::Success {
        println!("   Payment already verified");
        return (StatusCode::OK, Json(VerifyPaymentResponse {
            success: true,
            message: "Payment already verified".to_string(),
        }));
    }

    let center_id = match payment.center_id {
        Some(id) => id,
        None => {
            println!("   ERROR: Payment has no center_id");
            return (StatusCode::BAD_REQUEST, Json(VerifyPaymentResponse {
                success: false,
                message: "Invalid payment".to_string(),
            }));
        }
    };

    // Calculate amounts: credit full recharge amount to wallet
    let recharge_amount = payment.recharge_amount.unwrap_or(payment.amount);
    let royalty_amount = payment.royalty_amount.unwrap_or(0.0);
    let credit_amount = recharge_amount;
    println!("5. Calculated amounts:");
    println!("   - Recharge amount: {}", recharge_amount);
    println!("   - Royalty amount: {}", royalty_amount);
    println!("   - Credit to wallet: {}", credit_amount);

    // Look up current wallet
    println!("6. Looking up wallet document");
    let wallet_coll = db.collection::<CenterWallet>("center_wallet");
    let _current_wallet = match wallet_coll.find_one(doc! { "center_id": center_id }, None).await {
        Ok(Some(w)) => {
            println!("   Wallet found:");
            println!("   - _id: {:?}", w.id);
            println!("   - center_id: {:?}", w.center_id);
            println!("   - current balance: {}", w.balance);
            Some(w)
        },
        Ok(None) => {
            println!("   Wallet not found, will create new one");
            None
        },
        Err(e) => {
            println!("   ERROR: Database error looking up wallet: {}", e);
            None
        }
    };

    // Update payment record
    println!("7. Updating payment status to SUCCESS");
    let update_res = payments_coll.update_one(
        doc! { "razorpay_order_id": &payload.razorpay_order_id },
        doc! {
            "$set": {
                "status": "success",
                "razorpay_payment_id": &payload.razorpay_payment_id,
                "razorpay_signature": &payload.razorpay_signature,
                "updated_at": Utc::now()
            }
        },
        None,
    ).await;

    match update_res {
        Ok(update_result) => {
            println!("   Payment update result:");
            println!("   - matched_count: {}", update_result.matched_count);
            println!("   - modified_count: {}", update_result.modified_count);
        },
        Err(e) => {
            println!("   ERROR: Failed to update payment: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(VerifyPaymentResponse {
                success: false,
                message: "Failed to update payment".to_string(),
            }));
        }
    }

    // Update wallet
    println!("8. Updating wallet balance");
    // First get current balance
    let existing_wallet = wallet_coll.find_one(doc! { "center_id": center_id }, None).await;
    let balance_before = match existing_wallet {
        Ok(Some(w)) => w.balance,
        Ok(None) => 0.0,
        Err(_) => 0.0
    };
    let opts = FindOneAndUpdateOptions::builder()
        .upsert(true)
        .return_document(ReturnDocument::After)
        .build();

    let wallet_update = wallet_coll.find_one_and_update(
        doc! { "center_id": center_id },
        doc! {
            "$inc": { "balance": credit_amount },
            "$set": { "updated_at": Utc::now() },
            "$setOnInsert": { "created_at": Utc::now(), "royalty_percentage": 0.0 }
        },
        opts,
    ).await;

    let updated_wallet = match wallet_update {
        Ok(Some(w)) => {
            println!("   Wallet update successful:");
            println!("   - New balance: {}", w.balance);
            w
        },
        Ok(None) => {
            println!("   ERROR: Wallet update returned no document");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(VerifyPaymentResponse {
                success: false,
                message: "Failed to update wallet".to_string(),
            }));
        },
        Err(e) => {
            println!("   ERROR: Failed to update wallet: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(VerifyPaymentResponse {
                success: false,
                message: "Failed to update wallet".to_string(),
            }));
        }
    };

    // Create transaction record with new fields (gateway, receipt_number, etc.)
    println!("9. Creating wallet transaction");
    let tx_coll = db.collection::<WalletTransaction>("wallet_transactions");
    let tx_oid = ObjectId::new();
    let transaction_id = format!("WALLET-{}-{}", Utc::now().format("%Y%m%d"), &tx_oid.to_hex()[..10]);

    let transaction = WalletTransaction {
        id: Some(tx_oid),
        center_id,
        transaction_id: transaction_id.clone(),
        tx_type: crate::models::wallet_transaction::WalletTransactionType::Credit,
        credit_amount: Some(recharge_amount),
        royalty_amount: Some(royalty_amount),
        paid_amount: Some(payment.amount),
        net_amount: recharge_amount,
        description: Some("Wallet Recharge via Razorpay".to_string()),
        payment_method: Some("razorpay".to_string()),
        gateway: Some("razorpay".to_string()),
        gateway_order_id: Some(payload.razorpay_order_id.clone()),
        gateway_payment_id: Some(payload.razorpay_payment_id.clone()),
        receipt_number: payment.receipt_number.clone(),
        verified: true,
        created_by: center_id,
        created_at: Utc::now(),
        student_id: None,
        student_name: None,
        student_enrollment: None,
        balance_before,
        balance_after: updated_wallet.balance,
    };

    let tx_insert_result = tx_coll.insert_one(transaction, None).await;
    match tx_insert_result {
        Ok(insert_result) => {
            println!("   Wallet transaction created successfully:");
            println!("   - Inserted ID: {:?}", insert_result.inserted_id);
        },
        Err(e) => {
            println!("   ERROR: Failed to create wallet transaction: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(VerifyPaymentResponse {
                success: false,
                message: "Failed to create transaction record".to_string(),
            }));
        }
    }

    // Final API response
    let response = VerifyPaymentResponse {
        success: true,
        message: "Payment verified and wallet updated".to_string(),
    };
    println!("10. Final API response to frontend: {:?}", response);

    (StatusCode::OK, Json(response))
}

#[derive(Debug, Deserialize)]
pub struct CreatePublicOrderRequest {
    pub amount: f64,
    pub student_data: serde_json::Value,
}

pub async fn create_public_order(
    State(db): State<Database>,
    Json(payload): Json<CreatePublicOrderRequest>,
) -> (StatusCode, Json<CreateOrderResponse>) {
    // Load system settings for Razorpay config if available, else use env (backwards compatible)
    let settings_coll = db.collection::<SystemSettings>("system_settings");
    let settings = match settings_coll.find_one(None, None).await {
        Ok(Some(s)) => s,
        _ => SystemSettings::default(),
    };

    let (key_id, key_secret): (String, String);
    if settings.payment_gateway_enabled && settings.razorpay_key_id.is_some() && settings.get_razorpay_key_secret().is_some() {
        key_id = settings.razorpay_key_id.as_ref().unwrap().clone();
        key_secret = settings.get_razorpay_key_secret().unwrap();
    } else {
        key_id = std::env::var("RAZORPAY_KEY_ID").expect("RAZORPAY_KEY_ID not set");
        key_secret = std::env::var("RAZORPAY_KEY_SECRET").expect("RAZORPAY_KEY_SECRET not set");
    }

    let amount_paise = (payload.amount * 100.0) as u64;

    let client = reqwest::Client::new();
    let res = client
        .post("https://api.razorpay.com/v1/orders")
        .basic_auth(&key_id, Some(&key_secret))
        .json(&serde_json::json!({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": format!("pub_{}", Utc::now().timestamp()),
        }))
        .send()
        .await;

    match res {
        Ok(response) => {
            if response.status().is_success() {
                let razorpay_order: serde_json::Value = response.json().await.unwrap();
                let order_id = razorpay_order["id"].as_str().unwrap().to_string();

                let payment = Payment {
                    id: None,
                    center_id: None,
                    student_data: Some(payload.student_data),
                    amount: payload.amount,
                    recharge_amount: None,
                    royalty_amount: None,
                    currency: "INR".to_string(),
                    razorpay_order_id: Some(order_id.clone()),
                    razorpay_payment_id: None,
                    razorpay_signature: None,
                    status: PaymentStatus::Pending,
                    receipt_number: None,
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                };

                let collection = db.collection::<Payment>("payments");
                let _ = collection.insert_one(payment, None).await;

                (StatusCode::OK, Json(CreateOrderResponse {
                    success: true,
                    order_id: Some(order_id),
                    amount: Some(payload.amount),
                    key_id: Some(key_id),
                    message: "Order created".to_string(),
                }))
            } else {
                (StatusCode::BAD_GATEWAY, Json(CreateOrderResponse {
                    success: false,
                    order_id: None,
                    amount: None,
                    key_id: None,
                    message: "Razorpay error".to_string(),
                }))
            }
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(CreateOrderResponse {
            success: false,
            order_id: None,
            amount: None,
            key_id: None,
            message: "Connection failed".to_string(),
        })),
    }
}

pub async fn verify_public_payment(
    State(db): State<Database>,
    Json(payload): Json<VerifyPaymentRequest>,
) -> (StatusCode, Json<VerifyPaymentResponse>) {
    // Load system settings for Razorpay config if available, else use env (backwards compatible)
    let settings_coll = db.collection::<SystemSettings>("system_settings");
    let settings = match settings_coll.find_one(None, None).await {
        Ok(Some(s)) => s,
        _ => SystemSettings::default(),
    };

    let key_secret: String;
    if settings.payment_gateway_enabled && settings.get_razorpay_key_secret().is_some() {
        key_secret = settings.get_razorpay_key_secret().unwrap();
    } else {
        key_secret = std::env::var("RAZORPAY_KEY_SECRET").expect("RAZORPAY_KEY_SECRET not set");
    }

    let data = format!("{}|{}", payload.razorpay_order_id, payload.razorpay_payment_id);
    let mut mac = HmacSha256::new_from_slice(key_secret.as_bytes()).unwrap();
    mac.update(data.as_bytes());
    let expected_signature = hex::encode(mac.finalize().into_bytes());

    if expected_signature != payload.razorpay_signature {
        return (StatusCode::BAD_REQUEST, Json(VerifyPaymentResponse { success: false, message: "Invalid signature".to_string() }));
    }

    let payments_coll = db.collection::<Payment>("payments");
    let payment = match payments_coll.find_one(doc! { "razorpay_order_id": &payload.razorpay_order_id }, None).await {
        Ok(Some(p)) => p,
        _ => return (StatusCode::NOT_FOUND, Json(VerifyPaymentResponse { success: false, message: "Not found".to_string() })),
    };

    if payment.status == PaymentStatus::Success {
        return (StatusCode::OK, Json(VerifyPaymentResponse { success: true, message: "Already verified".to_string() }));
    }

    // Update payment
    let _ = payments_coll.update_one(
        doc! { "razorpay_order_id": &payload.razorpay_order_id },
        doc! { "$set": { "status": "success", "razorpay_payment_id": &payload.razorpay_payment_id, "updated_at": Utc::now() } },
        None
    ).await;

    // Register student if student_data is present
    if let Some(student_data) = payment.student_data {
        use crate::handlers::student::{public_register_student, CreateStudentRequest};
        let req: CreateStudentRequest = serde_json::from_value(student_data).unwrap();
        let _ = public_register_student(State(db), Json(req)).await;
    }

    (StatusCode::OK, Json(VerifyPaymentResponse { success: true, message: "Payment verified and student registered".to_string() }))
}
