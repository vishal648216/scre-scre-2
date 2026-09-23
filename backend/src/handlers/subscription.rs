use axum::{
    extract::{State, Path},
    http::StatusCode,
    Json,
};
use mongodb::{Database, bson::{doc, oid::ObjectId}};
use serde::{Deserialize, Serialize};
use crate::models::user::{Claims, UserRole};
use crate::models::subscription::*;
use chrono::{Utc, Duration};
use futures_util::StreamExt;

#[derive(Debug, Serialize)]
pub struct SubscriptionResponse {
    pub success: bool,
    pub message: String,
}

// --- Plan Management (SuperAdmin only) ---

pub async fn create_plan(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<SubscriptionPlan>,
) -> (StatusCode, Json<SubscriptionResponse>) {
    if claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(SubscriptionResponse { success: false, message: "Forbidden".to_string() }));
    }

    let coll = db.collection::<SubscriptionPlan>("subscription_plans");
    match coll.insert_one(payload, None).await {
        Ok(_) => (StatusCode::CREATED, Json(SubscriptionResponse { success: true, message: "Plan created successfully".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(SubscriptionResponse { success: false, message: "Failed to create plan".to_string() })),
    }
}

pub async fn get_plans(
    State(db): State<Database>,
) -> (StatusCode, Json<Vec<SubscriptionPlan>>) {
    let coll = db.collection::<SubscriptionPlan>("subscription_plans");
    let mut cursor = match coll.find(doc! { "status": "active" }, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut plans = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(plan) = result {
            plans.push(plan);
        }
    }
    (StatusCode::OK, Json(plans))
}

// --- Center Subscription Logic ---

#[derive(Debug, Deserialize)]
pub struct AllotSubscriptionRequest {
    pub center_id: String,
    pub plan_id: String,
}

pub async fn allot_subscription(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<AllotSubscriptionRequest>,
) -> (StatusCode, Json<SubscriptionResponse>) {
    if claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(SubscriptionResponse { success: false, message: "Forbidden".to_string() }));
    }

    let center_oid = match ObjectId::parse_str(&payload.center_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(SubscriptionResponse { success: false, message: "Invalid Center ID".to_string() })),
    };
    let plan_oid = match ObjectId::parse_str(&payload.plan_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(SubscriptionResponse { success: false, message: "Invalid Plan ID".to_string() })),
    };

    let plan_coll = db.collection::<SubscriptionPlan>("subscription_plans");
    let plan = match plan_coll.find_one(doc! { "_id": plan_oid }, None).await {
        Ok(Some(p)) => p,
        _ => return (StatusCode::NOT_FOUND, Json(SubscriptionResponse { success: false, message: "Plan not found".to_string() })),
    };

    let sub_coll = db.collection::<CenterSubscription>("center_subscriptions");
    let now = Utc::now();
    let expiry = now + Duration::days(plan.duration_days as i64);

    let new_sub = CenterSubscription {
        id: None,
        center_id: center_oid,
        plan_id: plan_oid,
        start_date: now,
        expiry_date: expiry,
        status: "active".to_string(),
        last_payment_amount: plan.price,
        transaction_id: None,
    };

    // Deactivate old subscriptions for this center
    let _ = sub_coll.update_many(
        doc! { "center_id": center_oid, "status": "active" },
        doc! { "$set": { "status": "expired" } },
        None
    ).await;

    match sub_coll.insert_one(new_sub, None).await {
        Ok(_) => (StatusCode::OK, Json(SubscriptionResponse { success: true, message: "Subscription allotted successfully".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(SubscriptionResponse { success: false, message: "Failed to allot subscription".to_string() })),
    }
}

pub async fn get_center_subscription(
    State(db): State<Database>,
    claims: Claims,
    Path(center_id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    let center_oid = match ObjectId::parse_str(&center_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"message": "Invalid ID"}))),
    };

    // Security: Only center itself or Admin/SuperAdmin
    if claims.role == UserRole::Center && claims.sub != center_id {
        return (StatusCode::FORBIDDEN, Json(serde_json::json!({"message": "Unauthorized"})));
    }

    let sub_coll = db.collection::<CenterSubscription>("center_subscriptions");
    let plan_coll = db.collection::<SubscriptionPlan>("subscription_plans");

    match sub_coll.find_one(doc! { "center_id": center_oid, "status": "active" }, None).await {
        Ok(Some(sub)) => {
            if let Ok(Some(plan)) = plan_coll.find_one(doc! { "_id": sub.plan_id }, None).await {
                return (StatusCode::OK, Json(serde_json::json!({
                    "subscription": sub,
                    "plan": plan
                })));
            }
            (StatusCode::OK, Json(serde_json::json!({ "subscription": sub })))
        },
        _ => (StatusCode::NOT_FOUND, Json(serde_json::json!({"message": "No active subscription"}))),
    }
}
