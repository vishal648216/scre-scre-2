use crate::models::center::Center;
use crate::models::course::Course;
use crate::models::fee::{FeeRecord, PaymentMode};
use crate::models::user::{Claims, User, UserRole};
use crate::models::center_wallet::CenterWallet;
use crate::models::wallet_transaction::{WalletTransaction, WalletTransactionType};
use crate::handlers::center_wallet::get_center_id_for_center_user;

use crate::AppState;
use axum::{
    extract::{Query, State, Path},
    http::{header, StatusCode},
    response::IntoResponse,
    Json,
};
use base64::{engine::general_purpose, Engine as _};
use chrono::{Datelike, Utc, TimeZone};
use futures_util::StreamExt;
use mongodb::{bson::doc, bson::oid::ObjectId, Database, options::{FindOneAndUpdateOptions, ReturnDocument}};
use serde::{Deserialize, Serialize};
use std::fs;
use std::process::Command;

#[derive(Debug, Deserialize)]
pub struct CollectFeeRequest {
    pub student_id: String,
    pub amount: f64,
    pub mode: PaymentMode,
    pub receipt_no: Option<String>,
    pub payment_date: Option<String>,
    pub reference_number: Option<String>,
    pub remarks: Option<String>,
    pub referral_discount_applied: Option<f64>,
    pub coupon_code: Option<String>,
    pub idempotency_key: Option<String>,
    pub payment_type: crate::models::fee::PaymentType,
    pub payment_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FeeResponse {
    pub success: bool,
    pub message: String,
    pub receipt_no: String,
}

pub async fn collect_fee(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CollectFeeRequest>,
) -> (StatusCode, Json<FeeResponse>) {
    eprintln!("collect_fee: claims.role = {:?}, claims.sub = {:?}", claims.role, claims.sub);
    if claims.role != UserRole::Center && claims.role != UserRole::Admin {
        return (
            StatusCode::FORBIDDEN,
            Json(FeeResponse {
                success: false,
                message: "Unauthorized".to_string(),
                receipt_no: "".to_string(),
            }),
        );
    }

    let student_oid = match ObjectId::parse_str(&payload.student_id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(FeeResponse {
                    success: false,
                    message: "Invalid Student ID".to_string(),
                    receipt_no: "".to_string(),
                }),
            );
        }
    };

    // Get center_id
    let center_id = if claims.role == UserRole::Center {
        match get_center_id_for_center_user(&state.db, &claims).await {
            Ok(oid) => {
                eprintln!("collect_fee: using center_id from get_center_id_for_center_user: {:?}", oid);
                oid
            }
            Err(code) => {
                return (
                    code,
                    Json(FeeResponse {
                        success: false,
                        message: "Unauthorized".to_string(),
                        receipt_no: "".to_string(),
                    }),
                );
            }
        }
    } else {
        // If admin, get student's center
        let students_coll = state.db.collection::<User>("users");
        match students_coll.find_one(doc! { "_id": student_oid }, None).await {
            Ok(Some(student)) => {
                let center = student.parent_id.unwrap();
                eprintln!("collect_fee: admin using center_id from student: {:?}", center);
                center
            }
            _ => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(FeeResponse {
                        success: false,
                        message: "Student not found".to_string(),
                        receipt_no: "".to_string(),
                    }),
                );
            }
        }
    };

    // Generate receipt number if not provided
    let receipt_no = payload.receipt_no.unwrap_or_else(|| {
        format!("REC-{}-{}", chrono::Utc::now().format("%Y%m%d%H%M%S"), rand::random::<u32>() % 10000)
    });

    // Parse payment date if provided, else use now
    let payment_date = match payload.payment_date {
        Some(date_str) => {
            chrono::NaiveDate::parse_from_str(&date_str, "%Y-%m-%d")
                .ok()
                .and_then(|d| {
                    d.and_hms_opt(0, 0, 0)
                        .map(|dt| dt.and_utc())
                })
                .unwrap_or_else(|| Utc::now())
        }
        None => Utc::now(),
    };

    let amount = payload.amount;
    eprintln!("collect_fee: payment amount = {:?}", amount);
    if amount <= 0.0 {
        return (
            StatusCode::BAD_REQUEST,
            Json(FeeResponse {
                success: false,
                message: "Amount must be greater than 0".to_string(),
                receipt_no: "".to_string(),
            }),
        );
    }

    // Start MongoDB session and transaction
    let mut session = match state.client.start_session(None).await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Failed to start session: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(FeeResponse {
                    success: false,
                    message: "Internal server error".to_string(),
                    receipt_no: "".to_string(),
                }),
            );
        }
    };

    let transaction_result = session.start_transaction(None).await;
    if transaction_result.is_err() {
        eprintln!("Failed to start transaction: {:?}", transaction_result.err());
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(FeeResponse {
                success: false,
                message: "Internal server error".to_string(),
                receipt_no: "".to_string(),
            }),
        );
    }

    // Now perform all operations in transaction
    let result: Result<_, (StatusCode, FeeResponse)> = async {
        // Step 1: Check idempotency key
        if let Some(ref idempotency_key) = payload.idempotency_key {
            eprintln!("collect_fee: checking idempotency key: {:?}", idempotency_key);
            let idempotency_coll = state.db.collection::<mongodb::bson::Document>("idempotency_keys");
            let existing = idempotency_coll
                .find_one_with_session(doc! { "key": idempotency_key }, None, &mut session)
                .await
                .map_err(|e| {
                    eprintln!("collect_fee: idempotency check error: {:?}", e);
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        FeeResponse {
                            success: false,
                            message: "Internal server error".to_string(),
                            receipt_no: "".to_string(),
                        },
                    )
                })?;
            if let Some(doc) = existing {
                let receipt_no = doc.get_str("receipt_no").unwrap_or_default().to_string();
                eprintln!("collect_fee: found existing idempotency key with receipt: {:?}", receipt_no);
                return Err((
                    StatusCode::OK,
                    FeeResponse {
                        success: true,
                        message: "Fee already collected".to_string(),
                        receipt_no,
                    },
                ));
            }
        }

        // Step 2: Get student to verify parent/center and get total fees
        let students_coll = state.db.collection::<User>("users");
        let student = students_coll
            .find_one_with_session(doc! { "_id": student_oid }, None, &mut session)
            .await
            .map_err(|e| {
                eprintln!("collect_fee: student fetch error: {:?}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    FeeResponse {
                        success: false,
                        message: "Internal server error".to_string(),
                        receipt_no: "".to_string(),
                    },
                )
            })?
            .ok_or((
                StatusCode::NOT_FOUND,
                FeeResponse {
                    success: false,
                    message: "Student not found".to_string(),
                    receipt_no: "".to_string(),
                },
            ))?;

        // Verify center owns student
        eprintln!("collect_fee: student.parent_id = {:?}, center_id = {:?}", student.parent_id, center_id);
        if student.parent_id != Some(center_id) {
            return Err((
                StatusCode::FORBIDDEN,
                FeeResponse {
                    success: false,
                    message: "Unauthorized".to_string(),
                    receipt_no: "".to_string(),
                },
            ));
        }

        // Clone student fields we need
        let student_full_name = student.full_name.clone();
        let student_username = student.username.clone();
        let student_enrollment = student.enrollment_number.clone();

        // Step 3: Calculate previous paid, total fees, remaining
    let previous_paid = calculate_total_paid(&state.db, student_oid).await;
    let total_fees = calculate_total_fees(&state.db, &student).await;
    let extra_charges_total: f64 = student
        .extra_charges_list
        .as_ref()
        .map(|list| list.iter().map(|c| c.amount).sum())
        .unwrap_or(0.0);
    let overall_total = total_fees + extra_charges_total;
    
    // Auto-fill payment name based on payment type if not provided
    let payment_name = payload.payment_name.unwrap_or_else(|| match payload.payment_type {
        crate::models::fee::PaymentType::OneTime => "One Time Payment".to_string(),
        crate::models::fee::PaymentType::Installment => "Installment".to_string(),
        crate::models::fee::PaymentType::LateFee => "Late Fee".to_string(),
        crate::models::fee::PaymentType::Other => "Other Payment".to_string(),
    });
    
    // Validate payment amount can't be negative
    if amount <= 0.0 {
        return Err((
            StatusCode::BAD_REQUEST,
            FeeResponse {
                success: false,
                message: "Amount must be greater than 0".to_string(),
                receipt_no: "".to_string(),
            },
        ));
    }
    
    let total_paid = previous_paid + amount;
    let remaining_amount = (overall_total - total_paid).max(0.0);
    eprintln!("collect_fee: previous_paid = {:?}, overall_total = {:?}, total_paid = {:?}, remaining_amount = {:?}", previous_paid, overall_total, total_paid, remaining_amount);

        // Step 4: Ensure center wallet exists (auto-create if needed)
        let wallet_coll = state.db.collection::<CenterWallet>("center_wallet");
        let now = Utc::now();

        // Upsert wallet (create if not exists)
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
        let wallet = wallet_coll
            .find_one_and_update_with_session(doc! { "center_id": center_id }, update, opts, &mut session)
            .await
            .map_err(|e| {
                eprintln!("collect_fee: wallet upsert error: {:?}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    FeeResponse {
                        success: false,
                        message: "Internal server error".to_string(),
                        receipt_no: "".to_string(),
                    },
                )
            })?
            .ok_or_else(|| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    FeeResponse {
                        success: false,
                        message: "Failed to get wallet".to_string(),
                        receipt_no: "".to_string(),
                    },
                )
            })?;
        eprintln!("collect_fee: got center wallet: center_id = {:?}, balance = {:?}", wallet.center_id, wallet.balance);

        // Step 5: Check if wallet has sufficient balance
        if wallet.balance < amount {
            return Err((
                StatusCode::BAD_REQUEST,
                FeeResponse {
                    success: false,
                    message: "Insufficient Wallet Balance".to_string(),
                    receipt_no: "".to_string(),
                },
            ));
        }

        // Step 6: Deduct from wallet
        let balance_before = wallet.balance;
        let balance_after = balance_before - amount;
        eprintln!("collect_fee: deducting from wallet: balance_before = {:?}, balance_after = {:?}", balance_before, balance_after);
        let update_wallet_result = wallet_coll
            .find_one_and_update_with_session(
                doc! { "center_id": center_id, "balance": balance_before },
                doc! { "$set": { "balance": balance_after, "updated_at": Utc::now() } },
                FindOneAndUpdateOptions::builder()
                    .return_document(ReturnDocument::After)
                    .build(),
                &mut session,
            )
            .await
            .map_err(|e| {
                eprintln!("collect_fee: wallet update error: {:?}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    FeeResponse {
                        success: false,
                        message: "Internal server error".to_string(),
                        receipt_no: "".to_string(),
                    },
                )
            })?;

        if update_wallet_result.is_none() {
            eprintln!("collect_fee: no wallet found with center_id = {:?} and balance = {:?}", center_id, balance_before);
            return Err((
                StatusCode::CONFLICT,
                FeeResponse {
                    success: false,
                    message: "Wallet balance changed, please try again".to_string(),
                    receipt_no: "".to_string(),
                },
            ));
        }

        // Step 6: Create wallet transaction
        let tx_coll = state.db.collection::<WalletTransaction>("wallet_transactions");
        let tx_oid = ObjectId::new();
        let transaction_id = format!(
            "CW-FEE-{}-{}",
            Utc::now().format("%Y%m%d%H%M%S"),
            &tx_oid.to_hex()[..8]
        );
        let created_by = ObjectId::parse_str(&claims.sub).unwrap_or_else(|_| ObjectId::new());

        let tx = WalletTransaction {
            id: Some(tx_oid),
            center_id,
            transaction_id: transaction_id.clone(),
            tx_type: WalletTransactionType::Debit,
            credit_amount: None,
            royalty_amount: None,
            paid_amount: Some(amount),
            net_amount: amount,
            description: Some(format!(
                "Fee collection for student {} ({})",
                student_full_name.as_ref().unwrap_or(&student_username),
                student_enrollment.as_deref().unwrap_or("N/A")
            )),
            payment_method: Some(format!("{:?}", payload.mode)),
            gateway: None,
            gateway_order_id: None,
            gateway_payment_id: None,
            receipt_number: Some(receipt_no.clone()),
            verified: true,
            created_by,
            created_at: Utc::now(),
            student_id: Some(student_oid),
            student_name: student_full_name.or(Some(student_username)),
            student_enrollment,
            balance_before,
            balance_after,
        };

        tx_coll
            .insert_one_with_session(tx, None, &mut session)
            .await
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    FeeResponse {
                        success: false,
                        message: "Internal server error".to_string(),
                        receipt_no: "".to_string(),
                    },
                )
            })?;

        // Step 7: Create fee record
        let fees_coll = state.db.collection::<FeeRecord>("fees");
        let new_fee = FeeRecord {
            id: None,
            student_id: student_oid,
            center_id,
            amount,
            payment_date,
            mode: payload.mode,
            receipt_no: receipt_no.clone(),
            remarks: payload.remarks,
            reference_number: payload.reference_number,
            previous_paid,
            total_paid,
            remaining_amount,
            created_by,
            created_at: Utc::now(),
            payment_type: payload.payment_type,
            payment_name,
        };

        fees_coll
            .insert_one_with_session(new_fee, None, &mut session)
            .await
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    FeeResponse {
                        success: false,
                        message: "Failed to save fee record".to_string(),
                        receipt_no: "".to_string(),
                    },
                )
            })?;

        // Step 9: Lock payment type since payment has been made
        students_coll
            .update_one_with_session(
                doc! { "_id": student_oid },
                doc! { "$set": { "is_payment_type_locked": true } },
                None,
                &mut session
            )
            .await
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    FeeResponse {
                        success: false,
                        message: "Failed to lock payment type".to_string(),
                        receipt_no: "".to_string(),
                    },
                )
            })?;

        // Step 8: Save idempotency key
        if let Some(ref idempotency_key) = payload.idempotency_key {
            let idempotency_coll = state.db.collection::<mongodb::bson::Document>("idempotency_keys");
            idempotency_coll
                .insert_one_with_session(
                    doc! {
                        "key": idempotency_key,
                        "receipt_no": &receipt_no,
                        "created_at": Utc::now()
                    },
                    None,
                    &mut session,
                )
                .await
                .map_err(|_| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        FeeResponse {
                            success: false,
                            message: "Internal server error".to_string(),
                            receipt_no: "".to_string(),
                        },
                    )
                })?;
        }

        Ok(receipt_no)
    }.await;

    // Commit or abort transaction
    match result {
        Ok(receipt_no) => {
            match session.commit_transaction().await {
                Ok(_) => (
                    StatusCode::CREATED,
                    Json(FeeResponse {
                        success: true,
                        message: "Fee collected successfully".to_string(),
                        receipt_no,
                    }),
                ),
                Err(e) => {
                    eprintln!("Failed to commit transaction: {:?}", e);
                    let _ = session.abort_transaction().await;
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(FeeResponse {
                            success: false,
                            message: "Internal server error".to_string(),
                            receipt_no: "".to_string(),
                        }),
                    )
                }
            }
        }
        Err((status_code, response)) => {
            let _ = session.abort_transaction().await;
            (status_code, Json(response))
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct GetFeesQuery {
    pub student_id: Option<String>,
    pub center_id: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub month: Option<u32>,
    pub year: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct FeeWithDetails {
    #[serde(flatten)]
    pub fee: FeeRecord,
    pub student_name: Option<String>,
    pub center_name: Option<String>,
    pub total_fees: Option<f64>,
    pub total_paid: f64,
}

pub async fn get_fees(
    State(db): State<Database>,
    claims: Claims,
    Query(params): Query<GetFeesQuery>,
) -> (StatusCode, Json<serde_json::Value>) {
    let collection = db.collection::<FeeRecord>("fees");
    let mut filter = doc! {};

    if claims.role == UserRole::Center {
        let center_id = match get_center_id_for_center_user(&db, &claims).await {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::UNAUTHORIZED, Json(serde_json::json!([]))),
        };
        filter.insert("center_id", center_id);
    } else if claims.role == UserRole::Student {
        let student_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::UNAUTHORIZED, Json(serde_json::json!([]))),
        };
        filter.insert("student_id", student_id);
    } else if (claims.role == UserRole::Admin || claims.role == UserRole::SuperAdmin)
        && params.center_id.is_some()
    {
        if let Ok(oid) = ObjectId::parse_str(params.center_id.as_ref().unwrap()) {
            filter.insert("center_id", oid);
        }
    }

    if let Some(sid) = params.student_id {
        if let Ok(oid) = ObjectId::parse_str(&sid) {
            filter.insert("student_id", oid);
        }
    }

    // Date range filtering
    if let (Some(start), Some(end)) = (params.start_date, params.end_date) {
        // Try parsing as full RFC3339 first, then as just date (YYYY-MM-DD)
        let start_dt = if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&start) {
            dt.with_timezone(&Utc)
        } else if let Ok(naive) = chrono::NaiveDate::parse_from_str(&start, "%Y-%m-%d") {
            naive.and_hms_opt(0, 0, 0).unwrap().and_utc()
        } else {
            Utc::now() // Fallback if parse fails
        };
        
        let end_dt = if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&end) {
            dt.with_timezone(&Utc)
        } else if let Ok(naive) = chrono::NaiveDate::parse_from_str(&end, "%Y-%m-%d") {
            naive.and_hms_opt(23, 59, 59).unwrap().and_utc()
        } else {
            Utc::now() // Fallback if parse fails
        };
        
        filter.insert(
            "payment_date",
            doc! {
                "$gte": start_dt,
                "$lte": end_dt,
            },
        );
    } else if let (Some(month), Some(year)) = (params.month, params.year) {
        let start = chrono::Utc.with_ymd_and_hms(year, month, 1, 0, 0, 0).unwrap();
        let end = start.with_month(month + 1).unwrap_or_else(|| start.with_year(year + 1).unwrap().with_month(1).unwrap());
        filter.insert(
            "payment_date",
            doc! {
                "$gte": start,
                "$lt": end,
            },
        );
    } else if let Some(year) = params.year {
        let start = chrono::Utc.with_ymd_and_hms(year, 1, 1, 0, 0, 0).unwrap();
        let end = start.with_year(year + 1).unwrap();
        filter.insert(
            "payment_date",
            doc! {
                "$gte": start,
                "$lt": end,
            },
        );
    }

    let mut cursor = match collection.find(filter, None).await {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!([])),
            );
        }
    };

    let mut items = Vec::new();
    let center_coll = db.collection::<Center>("centers");
    let student_coll = db.collection::<User>("users");

    while let Some(result) = cursor.next().await {
        if let Ok(fee) = result {
            let mut item = serde_json::to_value(&fee).unwrap_or(serde_json::json!({}));

            // Fetch center name for Admin/SuperAdmin
            if claims.role == UserRole::Admin || claims.role == UserRole::SuperAdmin {
                if let Ok(Some(center)) = center_coll
                    .find_one(doc! { "user_id": fee.center_id }, None)
                    .await
                {
                    item.as_object_mut()
                        .unwrap()
                        .insert("center_name".to_string(), serde_json::json!(center.name));
                }
            }

            // Fetch student name
            if let Ok(Some(student)) = student_coll
                .find_one(doc! { "_id": fee.student_id }, None)
                .await
            {
                item.as_object_mut().unwrap().insert(
                    "student_name".to_string(),
                    serde_json::json!(student.full_name.clone().unwrap_or(student.username)),
                );
                item.as_object_mut().unwrap().insert(
                    "total_fees".to_string(),
                    serde_json::json!(student.total_fees),
                );
            }

            // Calculate total paid for student
            let total_paid = calculate_total_paid(&db, fee.student_id).await;
            item.as_object_mut().unwrap().insert(
                "total_paid".to_string(),
                serde_json::json!(total_paid),
            );

            items.push(item);
        }
    }

    (StatusCode::OK, Json(serde_json::json!(items)))
}

async fn calculate_total_paid(db: &Database, student_id: ObjectId) -> f64 {
    let coll = db.collection::<FeeRecord>("fees");
    let filter = doc! { "student_id": student_id };
    let mut total = 0.0;
    
    let mut cursor = match coll.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return total,
    };
    
    while let Some(result) = cursor.next().await {
        if let Ok(fee) = result {
            total += fee.amount;
        }
    }
    
    total
}

async fn calculate_total_fees(db: &Database, student: &User) -> f64 {
    // Always calculate from course: Course Fee + Admission Fee (registration_fee) + Exam Fee
    let course_id = match student.course_id {
        Some(id) => id,
        None => return 0.0,
    };
    let courses_coll = db.collection::<Course>("courses");
    match courses_coll.find_one(doc! { "_id": course_id }, None).await {
        Ok(Some(course)) => {
            let course_fee = course.fees.unwrap_or(0) as f64;
            let admission_fee = course.registration_fee.unwrap_or(0) as f64;
            let exam_fee = course.exam_fee_amount.unwrap_or(0) as f64;
            course_fee + admission_fee + exam_fee
        },
        _ => 0.0,
    }
}

pub async fn get_student_fee_summary(
    State(db): State<Database>,
    claims: Claims,
    Path(student_id_str): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    let student_oid = match ObjectId::parse_str(&student_id_str) {
        Ok(oid) => oid,
        Err(_) => {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "message": "Invalid Student ID" })));
        }
    };

    let students_coll = db.collection::<User>("users");
    let student = match students_coll.find_one(doc! { "_id": student_oid }, None).await {
        Ok(Some(s)) => s,
        _ => {
            return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "success": false, "message": "Student not found" })));
        }
    };

    // Check authorization
    if claims.role == UserRole::Center {
        let user_oid = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "success": false, "message": "Unauthorized" }))),
        };
        let student_center_id = match student.parent_id {
            Some(id) => id,
            None => {
                return (StatusCode::FORBIDDEN, Json(serde_json::json!({ "success": false, "message": "Unauthorized" })));
            }
        };
        if user_oid != student_center_id {
            return (StatusCode::FORBIDDEN, Json(serde_json::json!({ "success": false, "message": "Unauthorized" })));
        }
    } else if claims.role == UserRole::Student {
        let user_oid = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "success": false, "message": "Unauthorized" }))),
        };
        if user_oid != student_oid {
            return (StatusCode::FORBIDDEN, Json(serde_json::json!({ "success": false, "message": "Unauthorized" })));
        }
    } else if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(serde_json::json!({ "success": false, "message": "Unauthorized" })));
    }

    let total_fees = calculate_total_fees(&db, &student).await;
    let extra_charges_total: f64 = student
        .extra_charges_list
        .as_ref()
        .map(|list| list.iter().map(|c| c.amount).sum())
        .unwrap_or(0.0);
    let overall_total = total_fees + extra_charges_total;
    let total_paid = calculate_total_paid(&db, student_oid).await;
    let remaining_amount = (overall_total - total_paid).max(0.0);

    #[derive(Serialize)]
    struct StudentFeeSummary {
        student_id: String,
        total_fees: f64,
        extra_charges_total: f64,
        overall_total: f64,
        total_paid: f64,
        remaining_amount: f64,
        payment_type: Option<String>,
        is_payment_type_locked: bool,
        installments: Option<Vec<crate::models::user::Installment>>,
        extra_charges_list: Option<Vec<crate::models::user::ExtraCharge>>,
    }
    let summary = StudentFeeSummary {
        student_id: student_id_str,
        total_fees,
        extra_charges_total,
        overall_total,
        total_paid,
        remaining_amount,
        payment_type: student.payment_type,
        is_payment_type_locked: student.is_payment_type_locked,
        installments: student.installments,
        extra_charges_list: student.extra_charges_list,
    };

    (StatusCode::OK, Json(serde_json::json!(summary)))
}

fn get_image_base64(url: &str) -> String {
    if url.starts_with("data:image") {
        return url.to_string();
    }

    let path_to_check = if url.starts_with("http") {
        if let Some(pos) = url.find("/uploads/") {
            &url[pos..]
        } else {
            return url.to_string();
        }
    } else {
        url
    };

    if path_to_check.starts_with("/uploads/") {
        let relative_path = path_to_check.trim_start_matches('/');

        let possible_paths = vec![
            std::path::PathBuf::from("/var/www/html/scre/backend").join(relative_path),
            std::path::PathBuf::from(".").join(relative_path),
            std::path::PathBuf::from("backend").join(relative_path),
        ];

        for path in possible_paths {
            if let Ok(bytes) = std::fs::read(&path) {
                let b64 = general_purpose::STANDARD.encode(bytes);
                let ext = url.rsplit('.').next().unwrap_or("png");
                let mime = match ext.to_lowercase().as_str() {
                    "jpg" | "jpeg" => "image/jpeg",
                    "png" => "image/png",
                    "gif" => "image/gif",
                    "webp" => "image/webp",
                    "svg" => "image/svg+xml",
                    _ => "image/png",
                };
                return format!("data:{};base64,{}", mime, b64);
            }
        }
    }

    url.to_string()
}

fn generate_fee_slip_html(
    student: &User,
    center: &Center,
    fees: &[FeeRecord],
    total_fees: f64,
    total_paid: f64,
) -> String {
    let center_logo = center
        .branding_media
        .as_ref()
        .and_then(|m| m.center_logo_url.as_ref());

    let fees_table = fees
        .iter()
        .enumerate()
        .map(|(i, f)| {
            format!(
                r#"
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 12px;">{}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 12px;">{}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 12px;">{}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 12px;">{:?}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 12px;">{}</td>
                </tr>
            "#,
                i + 1,
                f.payment_date.format("%d %B %Y"),
                f.receipt_no,
                f.mode,
                format!("₹{:.2}", f.amount)
            )
        })
        .collect::<Vec<_>>()
        .join("");

    format!(
        r#"
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Fee Slip</title>
            <style>
                body {{ font-family: 'Helvetica', 'Arial', sans-serif; margin: 40px; color: #333; line-height: 1.6; }}
                .header {{ text-align: center; border-bottom: 3px solid #0F172A; padding-bottom: 20px; margin-bottom: 30px; }}
                .center-logo {{ max-height: 80px; margin-bottom: 10px; }}
                .center-name {{ font-size: 24px; font-weight: 900; text-transform: uppercase; margin: 10px 0; color: #0F172A; }}
                .center-code {{ font-size: 14px; font-weight: bold; color: #666; }}
                .title {{ font-size: 20px; font-weight: 900; text-transform: uppercase; margin: 20px 0; color: #0F172A; text-align: center; }}
                .section {{ margin-bottom: 25px; }}
                .section-title {{ font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #fff; background: #0F172A; padding: 8px 15px; margin-bottom: 15px; display: flex; align-items: center; }}
                .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }}
                .field {{ margin-bottom: 10px; border-bottom: 1px solid #f9f9f9; padding-bottom: 5px; }}
                .label {{ font-size: 10px; font-weight: 900; text-transform: uppercase; color: #999; display: block; }}
                .value {{ font-size: 13px; font-weight: bold; color: #111; }}
                .table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
                .table th {{ padding: 10px; text-align: left; background: #f0f2f5; border-bottom: 2px solid #0F172A; font-size: 12px; text-transform: uppercase; }}
                .summary {{ margin-top: 20px; padding: 15px; background: #fafafa; border: 1px solid #eee; }}
                .summary-item {{ display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }}
                .summary-item:last-child {{ border-bottom: none; }}
                .summary-label {{ font-weight: bold; font-size: 14px; }}
                .summary-value {{ font-weight: 900; font-size: 16px; }}
                .total {{ color: #0F172A; font-size: 18px; }}
                .due {{ color: #dc2626; }}
                .paid {{ color: #16a34a; }}
                @media print {{
                    body {{ margin: 0; }}
                    @page {{ margin: 1cm; }}
                    .section-title {{ -webkit-print-color-adjust: exact; }}
                }}
            </style>
        </head>
        <body>
            <div class="header">
                {}
                <div class="center-name">{}</div>
                <div class="center-code">CENTER CODE: {}</div>
            </div>

            <div class="title">Fee Slip</div>

            <div class="grid">
                <div class="section">
                    <div class="section-title">Student Details</div>
                    <div class="field">
                        <span class="label">Name</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Enrollment No.</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Course</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Phone</span>
                        <span class="value">{}</span>
                    </div>
                </div>
                <div class="section">
                    <div class="section-title">Center Details</div>
                    <div class="field">
                        <span class="label">Center Name</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Owner Name</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Phone</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Date Issued</span>
                        <span class="value">{}</span>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Payment History</div>
                <table class="table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Date</th>
                            <th>Receipt No.</th>
                            <th>Mode</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {}
                    </tbody>
                </table>
            </div>

            <div class="summary">
                <div class="summary-item">
                    <span class="summary-label">Total Fees</span>
                    <span class="summary-value total">₹{:.2}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Total Paid</span>
                    <span class="summary-value paid">₹{:.2}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Balance Due</span>
                    <span class="summary-value due">₹{:.2}</span>
                </div>
            </div>

            <div style="margin-top: 50px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 20px;">
                This is a system-generated fee slip.
            </div>
        </body>
        </html>
    "#,
        center_logo
            .map(|url| format!(
                r#"<img src="{}" class="center-logo">"#,
                get_image_base64(url)
            ))
            .unwrap_or_default(),
        center.name,
        center.code,
        student.full_name.clone().unwrap_or(student.username.clone()),
        student.enrollment_number.clone().unwrap_or("N/A".to_string()),
        student.course.clone().unwrap_or("N/A".to_string()),
        student.phone.clone().unwrap_or("N/A".to_string()),
        center.name,
        center.owner_name,
        center.phone,
        Utc::now().format("%d %B %Y, %H:%M"),
        fees_table,
        total_fees,
        total_paid,
        (total_fees - total_paid).max(0.0)
    )
}

fn generate_single_fee_receipt_html(
    student: &User,
    center: &Center,
    fee: &FeeRecord,
    previous_paid: f64,
    total_fees: f64,
    total_paid: f64,
    remaining_balance: f64,
    collected_by: &str,
) -> String {
    format!(
        r#"
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Student Fee Receipt - {}</title>
            <style>
                body {{ font-family: 'Helvetica', 'Arial', sans-serif; margin: 40px; color: #333; line-height: 1.6; }}
                .header {{ text-align: center; border-bottom: 3px solid #0F172A; padding-bottom: 20px; margin-bottom: 30px; }}
                .org-name {{ font-size: 28px; font-weight: 900; text-transform: uppercase; margin: 10px 0; color: #0F172A; }}
                .receipt-title {{ font-size: 22px; font-weight: 900; text-transform: uppercase; margin: 15px 0; color: #1e40af; }}
                .section {{ margin-bottom: 25px; }}
                .section-title {{ font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #fff; background: #0F172A; padding: 8px 15px; margin-bottom: 15px; display: flex; align-items: center; }}
                .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }}
                .field {{ margin-bottom: 10px; border-bottom: 1px solid #f9f9f9; padding-bottom: 5px; }}
                .label {{ font-size: 10px; font-weight: 900; text-transform: uppercase; color: #999; display: block; }}
                .value {{ font-size: 13px; font-weight: bold; color: #111; }}
                .summary {{ margin-top: 20px; padding: 15px; background: #fafafa; border: 1px solid #eee; }}
                .summary-item {{ display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }}
                .summary-item:last-child {{ border-bottom: none; }}
                .summary-label {{ font-weight: bold; font-size: 14px; }}
                .summary-value {{ font-weight: 900; font-size: 16px; }}
                .total {{ color: #0F172A; font-size: 18px; }}
                .due {{ color: #dc2626; }}
                .paid {{ color: #16a34a; }}
                .current {{ color: #1e40af; }}
                .footer {{ margin-top: 40px; }}
                .footer-section {{ margin-top: 25px; }}
                .org-footer {{ margin-top: 24px; font-size: 11px; color: #666; text-align: center; border-top: 1px solid #eee; padding-top: 16px; }}
                @media print {{
                    body {{ margin: 0; }}
                    @page {{ margin: 1cm; }}
                    .section-title {{ -webkit-print-color-adjust: exact; }}
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <div class="org-name">{}</div>
                <div style="font-size: 14px; font-weight: bold; color: #666;">CENTER CODE: {}</div>
                <div class="receipt-title">Student Fee Receipt</div>
            </div>

            <div class="grid">
                <div class="section">
                    <div class="section-title">Center Details</div>
                    <div class="field">
                        <span class="label">Center Name</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Center Code</span>
                        <span class="value">{}</span>
                    </div>
                </div>
                <div class="section">
                    <div class="section-title">Student Details</div>
                    <div class="field">
                        <span class="label">Student Name</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Father's Name</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Enrollment Number</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Course</span>
                        <span class="value">{}</span>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Payment Details</div>
                <div class="grid">
                    <div class="field">
                        <span class="label">Receipt Number</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Payment Date</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Payment Name</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Payment Type</span>
                        <span class="value">{:?}</span>
                    </div>
                    <div class="field">
                        <span class="label">Payment Mode</span>
                        <span class="value">{:?}</span>
                    </div>
                    <div class="field">
                        <span class="label">Reference Number</span>
                        <span class="value">{}</span>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Fee Summary</div>
                <div class="summary">
                    <div class="summary-item">
                        <span class="summary-label">Total Fees</span>
                        <span class="summary-value total">₹{:.2}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Previously Paid</span>
                        <span class="summary-value paid">₹{:.2}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Current Payment</span>
                        <span class="summary-value current">₹{:.2}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Total Paid</span>
                        <span class="summary-value paid">₹{:.2}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Remaining Balance</span>
                        <span class="summary-value due">₹{:.2}</span>
                    </div>
                </div>
            </div>

            <div class="footer">
                <div class="footer-section">
                    <div class="grid">
                        <div class="field">
                            <span class="label">Collected By</span>
                            <span class="value">{}</span>
                        </div>
                        <div class="field">
                            <span class="label">Generated Date & Time</span>
                            <span class="value">{}</span>
                        </div>
                    </div>
                </div>
                <div class="org-footer">
                    <div>{} | {}</div>
                    <div>{}{}</div>
                    <div>This is a system-generated receipt and does not require a signature.</div>
                </div>
            </div>
        </body>
        </html>
    "#,
        fee.receipt_no,
        center.name,
        center.code,
        center.name,
        center.code,
        student.full_name.clone().unwrap_or(student.username.clone()),
        student.father_name.clone().unwrap_or("N/A".to_string()),
        student.enrollment_number.clone().unwrap_or("N/A".to_string()),
        student.course.clone().unwrap_or("N/A".to_string()),
        fee.receipt_no,
        fee.payment_date.format("%d %B %Y"),
        fee.payment_name.clone(),
        fee.payment_type,
        fee.mode,
        fee.reference_number.clone().unwrap_or("N/A".to_string()),
        total_fees,
        previous_paid,
        fee.amount,
        total_paid,
        remaining_balance,
        collected_by,
        Utc::now().format("%d %B %Y, %H:%M:%S"),
        center.name,
        center.code,
        center.address,
        if center.phone.is_empty() {
            String::new()
        } else {
            format!(" | {}", center.phone)
        }
    )
}

#[derive(Debug, Deserialize)]
pub struct PrintFeeSlipQuery {
    pub student_id: String,
}

pub async fn preview_fee_slip(
    State(db): State<Database>,
    claims: Claims,
    Query(params): Query<PrintFeeSlipQuery>,
) -> impl IntoResponse {
    let student_oid = match ObjectId::parse_str(&params.student_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, "Invalid Student ID").into_response(),
    };

    // Check authorization
    let students_coll = db.collection::<User>("users");
    let student = match students_coll.find_one(doc! { "_id": student_oid }, None).await {
        Ok(Some(s)) => s,
        _ => return (StatusCode::NOT_FOUND, "Student not found").into_response(),
    };

    if claims.role == UserRole::Student && claims.sub != student_oid.to_hex() {
        return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
    }

    if claims.role == UserRole::Center {
        let center_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::BAD_REQUEST, "Invalid Center ID").into_response(),
        };
        if student.parent_id != Some(center_id) {
            return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
        }
    }

    // Get center
    let center_user_id = student.parent_id.unwrap();
    let centers_coll = db.collection::<Center>("centers");
    let center = match centers_coll.find_one(doc! { "user_id": center_user_id }, None).await {
        Ok(Some(c)) => c,
        _ => return (StatusCode::NOT_FOUND, "Center not found").into_response(),
    };

    // Get all fees for student
    let fees_coll = db.collection::<FeeRecord>("fees");
    let mut fees = Vec::new();
    let mut cursor = match fees_coll.find(doc! { "student_id": student_oid }, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch fees").into_response(),
    };

    while let Some(result) = cursor.next().await {
        if let Ok(fee) = result {
            fees.push(fee);
        }
    }

    let total_paid = calculate_total_paid(&db, student_oid).await;
    let total_fees = student.total_fees.unwrap_or(0.0);

    let html = generate_fee_slip_html(&student, &center, &fees, total_fees, total_paid);

    (StatusCode::OK, [(header::CONTENT_TYPE, "text/html")], html).into_response()
}

pub async fn print_fee_slip(
    State(db): State<Database>,
    claims: Claims,
    Query(params): Query<PrintFeeSlipQuery>,
) -> impl IntoResponse {
    let student_oid = match ObjectId::parse_str(&params.student_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, "Invalid Student ID").into_response(),
    };

    // Check authorization
    let students_coll = db.collection::<User>("users");
    let student = match students_coll.find_one(doc! { "_id": student_oid }, None).await {
        Ok(Some(s)) => s,
        _ => return (StatusCode::NOT_FOUND, "Student not found").into_response(),
    };

    if claims.role == UserRole::Student && claims.sub != student_oid.to_hex() {
        return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
    }

    if claims.role == UserRole::Center {
        let center_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::BAD_REQUEST, "Invalid Center ID").into_response(),
        };
        if student.parent_id != Some(center_id) {
            return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
        }
    }

    // Get center
    let center_user_id = student.parent_id.unwrap();
    let centers_coll = db.collection::<Center>("centers");
    let center = match centers_coll.find_one(doc! { "user_id": center_user_id }, None).await {
        Ok(Some(c)) => c,
        _ => return (StatusCode::NOT_FOUND, "Center not found").into_response(),
    };

    // Get all fees for student
    let fees_coll = db.collection::<FeeRecord>("fees");
    let mut fees = Vec::new();
    let mut cursor = match fees_coll.find(doc! { "student_id": student_oid }, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch fees").into_response(),
    };

    while let Some(result) = cursor.next().await {
        if let Ok(fee) = result {
            fees.push(fee);
        }
    }

    let total_paid = calculate_total_paid(&db, student_oid).await;
    let total_fees = student.total_fees.unwrap_or(0.0);

    let html = generate_fee_slip_html(&student, &center, &fees, total_fees, total_paid);

    // Use chromium to generate PDF
    let temp_dir = std::env::temp_dir();
    let timestamp = Utc::now().timestamp();
    let html_filename = format!("fee_slip_{}_{}.html", student_oid, timestamp);
    let pdf_filename = format!("fee_slip_{}_{}.pdf", student_oid, timestamp);
    let abs_html_path = temp_dir.join(&html_filename);
    let abs_pdf_path = temp_dir.join(&pdf_filename);

    if let Err(e) = fs::write(&abs_html_path, html) {
        eprintln!("Failed to write temp HTML: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to write temporary HTML file",
        )
            .into_response();
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

    let mut pdf_generated = false;
    let mut last_error = String::new();

    for path in chromium_paths {
        let input_url = format!("file://{}", abs_html_path.display());
        println!("Attempting PDF generation with {} for URL {}", path, input_url);

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
                    println!("Successfully generated PDF with {}", path);
                    break;
                } else {
                    last_error = format!(
                        "Chromium at {} reported success but PDF file not found at {}",
                        path,
                        abs_pdf_path.display()
                    );
                    eprintln!("{}", last_error);
                }
            }
            Ok(out) => {
                let err = String::from_utf8_lossy(&out.stderr);
                let stdout = String::from_utf8_lossy(&out.stdout);
                last_error = format!(
                    "Chromium at {} failed. Stderr: {}. Stdout: {}",
                    path, err, stdout
                );
                eprintln!("{}", last_error);
            }
            Err(e) => {
                last_error = format!("Failed to run chromium at {}: {}", path, e);
                eprintln!("{}", last_error);
            }
        }
    }

    if pdf_generated {
        let pdf_content = match fs::read(&abs_pdf_path) {
            Ok(content) => {
                if content.is_empty() {
                    eprintln!("PDF generated but is empty at {}", abs_pdf_path.display());
                    return (StatusCode::INTERNAL_SERVER_ERROR, "Generated PDF is empty")
                        .into_response();
                }
                content
            }
            Err(e) => {
                eprintln!("Failed to read generated PDF: {}", e);
                return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read generated PDF")
                    .into_response();
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
                    &format!(
                        "attachment; filename=\"fee_slip_{}.pdf\"",
                        student.enrollment_number.clone().unwrap_or(student_oid.to_string())
                    ),
                ),
            ],
            pdf_content,
        )
            .into_response()
    } else {
        let _ = fs::remove_file(&abs_html_path);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to generate PDF. Error: {}", last_error),
        )
            .into_response()
    }
}

#[derive(Debug, Deserialize)]
pub struct DownloadLatestFeeReceiptQuery {
    pub student_id: String,
}

pub async fn download_latest_fee_receipt(
    State(db): State<Database>,
    claims: Claims,
    Query(params): Query<DownloadLatestFeeReceiptQuery>,
) -> impl IntoResponse {
    let student_oid = match ObjectId::parse_str(&params.student_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, "Invalid Student ID").into_response(),
    };

    let students_coll = db.collection::<User>("users");
    let student = match students_coll.find_one(doc! { "_id": student_oid }, None).await {
        Ok(Some(s)) => s,
        _ => return (StatusCode::NOT_FOUND, "Student not found").into_response(),
    };

    if claims.role == UserRole::Student && claims.sub != student_oid.to_hex() {
        return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
    }

    if claims.role == UserRole::Center {
        let center_id = match get_center_id_for_center_user(&db, &claims).await {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
        };
        if student.parent_id != Some(center_id) {
            return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
        }
    } else if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin && claims.role != UserRole::Student {
        return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
    }

    let center_user_id = match student.parent_id {
        Some(id) => id,
        None => return (StatusCode::NOT_FOUND, "Center not found").into_response(),
    };
    let centers_coll = db.collection::<Center>("centers");
    let center = match centers_coll.find_one(doc! { "user_id": center_user_id }, None).await {
        Ok(Some(c)) => c,
        _ => return (StatusCode::NOT_FOUND, "Center not found").into_response(),
    };

    let fees_coll = db.collection::<FeeRecord>("fees");
    let mut latest_fee: Option<FeeRecord> = None;
    let mut cursor = match fees_coll
        .find(
            doc! { "student_id": student_oid },
            mongodb::options::FindOptions::builder()
                .sort(doc! { "payment_date": -1, "created_at": -1 })
                .limit(1)
                .build(),
        )
        .await
    {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch fee receipt").into_response(),
    };

    while let Some(result) = cursor.next().await {
        if let Ok(fee) = result {
            latest_fee = Some(fee);
            break;
        }
    }

    let latest_fee = match latest_fee {
        Some(fee) => fee,
        None => return (StatusCode::NOT_FOUND, "No fee receipt found").into_response(),
    };

    let total_fees = calculate_total_fees(&db, &student).await
        + student
            .extra_charges_list
            .as_ref()
            .map(|list| list.iter().map(|c| c.amount).sum::<f64>())
            .unwrap_or(0.0);
    let total_paid = calculate_total_paid(&db, student_oid).await;
    let previous_paid = latest_fee.previous_paid;
    let remaining_balance = (total_fees - total_paid).max(0.0);
    let collected_by = match students_coll
        .find_one(doc! { "_id": latest_fee.created_by }, None)
        .await
    {
        Ok(Some(user)) => user.full_name.unwrap_or(user.username),
        _ => "System".to_string(),
    };

    let html = generate_single_fee_receipt_html(
        &student,
        &center,
        &latest_fee,
        previous_paid,
        total_fees,
        total_paid,
        remaining_balance,
        &collected_by,
    );

    let temp_dir = std::env::temp_dir();
    let timestamp = Utc::now().timestamp();
    let html_filename = format!("fee_receipt_{}_{}.html", student_oid, timestamp);
    let pdf_filename = format!("fee_receipt_{}_{}.pdf", student_oid, timestamp);
    let abs_html_path = temp_dir.join(&html_filename);
    let abs_pdf_path = temp_dir.join(&pdf_filename);

    if let Err(e) = fs::write(&abs_html_path, html) {
        eprintln!("Failed to write temp HTML: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to write temporary HTML file",
        )
            .into_response();
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

    let mut pdf_generated = false;
    let mut last_error = String::new();

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
                last_error = format!(
                    "Chromium at {} failed. Stderr: {}. Stdout: {}",
                    path, err, stdout
                );
                eprintln!("{}", last_error);
            }
            Err(e) => {
                last_error = format!("Failed to run chromium at {}: {}", path, e);
                eprintln!("{}", last_error);
            }
        }
    }

    if pdf_generated {
        let pdf_content = match fs::read(&abs_pdf_path) {
            Ok(content) => content,
            Err(e) => {
                eprintln!("Failed to read generated PDF: {}", e);
                return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read generated PDF")
                    .into_response();
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
                    &format!(
                        "attachment; filename=\"fee_receipt_{}_{}.pdf\"",
                        student.enrollment_number.clone().unwrap_or(student_oid.to_string()),
                        latest_fee.receipt_no
                    ),
                ),
            ],
            pdf_content,
        )
            .into_response()
    } else {
        let _ = fs::remove_file(&abs_html_path);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to generate PDF. Error: {}", last_error),
        )
            .into_response()
    }
}

#[derive(Debug, Deserialize)]
pub struct UpdateStudentTotalFeesRequest {
    pub student_id: String,
    pub total_fees: f64,
}

pub async fn update_student_total_fees(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<UpdateStudentTotalFeesRequest>,
) -> (StatusCode, Json<FeeResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin && claims.role != UserRole::Center {
        return (
            StatusCode::FORBIDDEN,
            Json(FeeResponse {
                success: false,
                message: "Unauthorized".to_string(),
                receipt_no: "".to_string(),
            }),
        );
    }

    let student_oid = match ObjectId::parse_str(&payload.student_id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(FeeResponse {
                    success: false,
                    message: "Invalid Student ID".to_string(),
                    receipt_no: "".to_string(),
                }),
            );
        }
    };

    let students_coll = db.collection::<User>("users");

    // Check authorization for centers
    if claims.role == UserRole::Center {
        let center_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(FeeResponse {
                        success: false,
                        message: "Invalid Center ID".to_string(),
                        receipt_no: "".to_string(),
                    }),
                );
            }
        };
        match students_coll.find_one(doc! { "_id": student_oid }, None).await {
            Ok(Some(student)) => {
                if student.parent_id != Some(center_id) {
                    return (
                        StatusCode::FORBIDDEN,
                        Json(FeeResponse {
                            success: false,
                            message: "Unauthorized".to_string(),
                            receipt_no: "".to_string(),
                        }),
                    );
                }
            }
            _ => {
                return (
                    StatusCode::NOT_FOUND,
                    Json(FeeResponse {
                        success: false,
                        message: "Student not found".to_string(),
                        receipt_no: "".to_string(),
                    }),
                );
            }
        }
    }

    match students_coll
        .update_one(
            doc! { "_id": student_oid },
            doc! { "$set": { "total_fees": payload.total_fees } },
            None,
        )
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(FeeResponse {
                success: true,
                message: "Total fees updated successfully".to_string(),
                receipt_no: "".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(FeeResponse {
                success: false,
                message: "Failed to update total fees".to_string(),
                receipt_no: "".to_string(),
            }),
        ),
    }
}
