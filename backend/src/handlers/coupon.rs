use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use chrono::{Utc, DateTime};
use futures_util::stream::StreamExt;
use mongodb::options::FindOptions;
use mongodb::{
    Database,
    bson::{doc, oid::ObjectId},
};
use serde::Deserialize;

use crate::models::coupon::{Coupon, CouponType, DiscountType};
use crate::models::user::{Claims, User, UserRole};

pub async fn list_coupons(
    State(db): State<Database>,
    claims: Claims,
    Query(params): Query<CouponListQuery>,
) -> (StatusCode, Json<Vec<serde_json::Value>>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(Vec::new()));
    }

    let coll = db.collection::<mongodb::bson::Document>("coupons");
    let mut filter = doc! {};
    if let Some(t) = params.coupon_type {
        filter.insert("coupon_type", t);
    }

    let find_opts = FindOptions::builder()
        .sort(doc! { "created_at": -1 })
        .build();
    let mut cursor = match coll.find(filter, find_opts).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut coupons = Vec::new();
    while let Some(Ok(doc)) = cursor.next().await {
        let mut json_val = serde_json::to_value(&doc).unwrap();

        if let Some(obj) = json_val.as_object_mut() {
            // Convert _id to string
            if let Some(id_val) = obj.get("_id") {
                if let Some(oid_str) = id_val.get("$oid").and_then(|v| v.as_str()) {
                    obj.insert(
                        "_id".to_string(),
                        serde_json::Value::String(oid_str.to_string()),
                    );
                }
            }
            // Convert target_id to string if present
            if let Some(target_id_val) = obj.get("target_id") {
                if let Some(oid_str) = target_id_val.get("$oid").and_then(|v| v.as_str()) {
                    obj.insert(
                        "target_id".to_string(),
                        serde_json::Value::String(oid_str.to_string()),
                    );
                }
            }
        }

        coupons.push(json_val);
    }
    (StatusCode::OK, Json(coupons))
}

#[derive(Debug, Deserialize)]
pub struct CouponListQuery {
    pub coupon_type: Option<String>,
}

pub async fn create_coupon(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<serde_json::Value>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"message": "Unauthorized"})),
        );
    }

    let coll = db.collection::<mongodb::bson::Document>("coupons");

    // Extract code first
    let code = match payload.get("code").and_then(|v| v.as_str()) {
        Some(c) => c.to_string().to_uppercase(),
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"message": "Code is required"})),
            );
        }
    };

    // Check if code already exists
    if let Ok(Some(_)) = coll.find_one(doc! { "code": &code }, None).await {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"message": "Coupon code already exists"})),
        );
    }

    // Build document manually
    let mut doc = doc! {
        "code": code,
        "usage_count": 0,
        "created_at": Utc::now(),
        "updated_at": Utc::now(),
    };

    let coupon_type = match payload.get("coupon_type").and_then(|v| v.as_str()) {
        Some("student") => "student",
        Some("center") => "center",
        Some("intern") => "intern",
        _ => "student",
    };
    doc.insert("coupon_type", coupon_type);

    let discount_type = match payload.get("discount_type").and_then(|v| v.as_str()) {
        Some("percentage") => "percentage",
        Some("fixed") => "fixed",
        _ => "percentage",
    };
    doc.insert("discount_type", discount_type);

    let discount_value = payload
        .get("discount_value")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    doc.insert("discount_value", discount_value);

    if let Some(target_id_str) = payload.get("target_id").and_then(|v| v.as_str()) {
        if let Ok(target_oid) = ObjectId::parse_str(target_id_str) {
            doc.insert("target_id", target_oid);
        }
    }

    if let Some(tn) = payload.get("target_name").and_then(|v| v.as_str()) {
        doc.insert("target_name", tn.to_string());
    }

    if let Some(sd) = payload.get("start_date").and_then(|v| v.as_str()) {
        if let Ok(dt) = DateTime::parse_from_rfc3339(sd) {
            doc.insert("start_date", dt.with_timezone(&Utc));
        }
    }

    if let Some(ed) = payload.get("end_date").and_then(|v| v.as_str()) {
        if let Ok(dt) = DateTime::parse_from_rfc3339(ed) {
            doc.insert("end_date", dt.with_timezone(&Utc));
            doc.insert("expiry_date", dt.with_timezone(&Utc));
        }
    }

    if let Some(ul) = payload.get("usage_limit").and_then(|v| v.as_i64()) {
        doc.insert("usage_limit", ul as i32);
    }

    let is_active = payload.get("is_active").and_then(|v| v.as_bool()).unwrap_or(true);
    doc.insert("is_active", is_active);

    match coll.insert_one(doc, None).await {
        Ok(_) => (
            StatusCode::CREATED,
            Json(serde_json::json!({"success": true})),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"message": "Failed to create coupon"})),
        ),
    }
}

pub async fn update_coupon(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<serde_json::Value>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"message": "Unauthorized"})),
        );
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"message": "Invalid ID"})),
            );
        }
    };

    let coll = db.collection::<Coupon>("coupons");

    // Build update document manually
    let mut update_doc = doc! {};
    update_doc.insert("updated_at", Utc::now());

    if let Some(code) = payload.get("code").and_then(|v| v.as_str()) {
        let upper_code = code.to_string().to_uppercase();
        // Check if code is already taken by another coupon
        if let Ok(Some(existing)) = coll.find_one(doc! { "code": &upper_code, "_id": { "$ne": oid } }, None).await {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"message": "Coupon code already exists"})),
            );
        }
        update_doc.insert("code", upper_code);
    }

    if let Some(ct) = payload.get("coupon_type").and_then(|v| v.as_str()) {
        let coupon_type_str = match ct {
            "student" => "student",
            "center" => "center",
            "intern" => "intern",
            _ => "student",
        };
        update_doc.insert("coupon_type", coupon_type_str);
    }

    if let Some(dt) = payload.get("discount_type").and_then(|v| v.as_str()) {
        let discount_type_str = match dt {
            "percentage" => "percentage",
            "fixed" => "fixed",
            _ => "percentage",
        };
        update_doc.insert("discount_type", discount_type_str);
    }

    if let Some(dv) = payload.get("discount_value").and_then(|v| v.as_f64()) {
        update_doc.insert("discount_value", dv);
    }

    if let Some(target_id_str) = payload.get("target_id").and_then(|v| v.as_str()) {
        if let Ok(target_oid) = ObjectId::parse_str(target_id_str) {
            update_doc.insert("target_id", target_oid);
        }
    } else if payload.get("target_id").is_none() || payload.get("target_id").and_then(|v| v.as_str()).map(|s| s.is_empty()).unwrap_or(false) {
        update_doc.insert("target_id", mongodb::bson::Bson::Null);
    }

    if let Some(tn) = payload.get("target_name").and_then(|v| v.as_str()) {
        update_doc.insert("target_name", tn.to_string());
    }

    if let Some(sd) = payload.get("start_date").and_then(|v| v.as_str()) {
        if let Ok(dt) = DateTime::parse_from_rfc3339(sd) {
            update_doc.insert("start_date", dt.with_timezone(&Utc));
        }
    } else if payload.get("start_date").is_none() {
        update_doc.insert("start_date", mongodb::bson::Bson::Null);
    }

    if let Some(ed) = payload.get("end_date").and_then(|v| v.as_str()) {
        if let Ok(dt) = DateTime::parse_from_rfc3339(ed) {
            update_doc.insert("end_date", dt.with_timezone(&Utc));
            update_doc.insert("expiry_date", dt.with_timezone(&Utc));
        }
    } else if payload.get("end_date").is_none() {
        update_doc.insert("end_date", mongodb::bson::Bson::Null);
        update_doc.insert("expiry_date", mongodb::bson::Bson::Null);
    }

    if let Some(ul) = payload.get("usage_limit").and_then(|v| v.as_i64()) {
        update_doc.insert("usage_limit", ul as i32);
    } else if payload.get("usage_limit").is_none() {
        update_doc.insert("usage_limit", mongodb::bson::Bson::Null);
    }

    if let Some(ia) = payload.get("is_active").and_then(|v| v.as_bool()) {
        update_doc.insert("is_active", ia);
    }

    match coll
        .update_one(doc! { "_id": oid }, doc! { "$set": update_doc }, None)
        .await
    {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"success": true}))),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"message": "Failed to update coupon"})),
        ),
    }
}

pub async fn delete_coupon(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"message": "Unauthorized"})),
        );
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"message": "Invalid ID"})),
            );
        }
    };

    let coll = db.collection::<Coupon>("coupons");
    match coll.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"success": true}))),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"message": "Failed to delete coupon"})),
        ),
    }
}

pub async fn search_coupon_targets(
    State(db): State<Database>,
    claims: Claims,
    Query(params): Query<SearchQuery>,
) -> (StatusCode, Json<Vec<serde_json::Value>>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(Vec::new()));
    }

    let q = params.q.unwrap_or_default();
    let target_type = params.target_type.unwrap_or_default();

    let coll = db.collection::<User>("users");
    let mut filter = doc! {
        "$or": [
            { "full_name": { "$regex": &q, "$options": "i" } },
            { "email": { "$regex": &q, "$options": "i" } },
        ]
    };

    if target_type == "student" {
        filter.insert("role", "student");
    } else if target_type == "center" {
        filter.insert("role", "center");
    } else {
        return (StatusCode::BAD_REQUEST, Json(Vec::new()));
    }

    let find_opts = FindOptions::builder().limit(10).build();
    let mut cursor = match coll.find(filter, find_opts).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut results = Vec::new();
    while let Some(Ok(user)) = cursor.next().await {
        results.push(serde_json::json!({
            "id": user.id,
            "name": user.full_name,
            "email": user.email,
        }));
    }

    (StatusCode::OK, Json(results))
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: Option<String>,
    pub target_type: Option<String>,
}

pub async fn validate_coupon(
    State(db): State<Database>,
    Query(params): Query<ValidateCouponQuery>,
) -> (StatusCode, Json<serde_json::Value>) {
    let code = params.code.trim().to_uppercase();
    let coupon_type = params.coupon_type;
    let target_id = params.target_id;

    let coll = db.collection::<Coupon>("coupons");
    let mut filter = doc! {
        "code": { "$regex": format!("^{}$", code), "$options": "i" },
        "is_active": true
    };
    if let Some(ct) = coupon_type {
        filter.insert("coupon_type", ct);
    }

    match coll.find_one(filter, None).await {
        Ok(Some(coupon)) => {
            // Check start date
            if let Some(start) = coupon.start_date {
                if start > Utc::now() {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(serde_json::json!({"message": "Coupon is not yet active"})),
                    );
                }
            }

            // Check end date
            if let Some(end) = coupon.end_date {
                if end < Utc::now() {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(serde_json::json!({"message": "Coupon has expired"})),
                    );
                }
            }

            // Check expiry (legacy)
            if let Some(expiry) = coupon.expiry_date {
                if expiry < Utc::now() {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(serde_json::json!({"message": "Coupon expired"})),
                    );
                }
            }

            // Check usage limit
            if let Some(limit) = coupon.usage_limit {
                if coupon.usage_count >= limit {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(serde_json::json!({"message": "Coupon usage limit reached"})),
                    );
                }
            }

            // Check target if specified
            if let Some(c_target_id) = coupon.target_id {
                if let Some(req_target_id) = target_id {
                    if c_target_id.to_hex() != req_target_id {
                        return (
                            StatusCode::BAD_REQUEST,
                            Json(serde_json::json!({"message": "Coupon not valid for this user"})),
                        );
                    }
                } else {
                    // If target is required but not provided
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(serde_json::json!({"message": "Coupon requires specific user"})),
                    );
                }
            }

            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "valid": true,
                    "success": true,
                    "discount_type": coupon.discount_type,
                    "discount_value": coupon.discount_value
                })),
            )
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"message": "Invalid coupon code"})),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"message": "Database error"})),
        ),
    }
}

pub async fn consume_coupon(
    db: &Database,
    code: &str,
    coupon_type: &str,
    target_id: Option<ObjectId>,
) -> Result<(DiscountType, f64), String> {
    let coll = db.collection::<Coupon>("coupons");
    let filter = doc! {
        "code": { "$regex": format!("^{}$", code.trim()), "$options": "i" },
        "coupon_type": coupon_type,
        "is_active": true
    };

    match coll.find_one(filter, None).await {
        Ok(Some(coupon)) => {
            // Check start date
            if let Some(start) = coupon.start_date {
                if start > Utc::now() {
                    return Err("Coupon is not yet active".to_string());
                }
            }

            // Check end date
            if let Some(end) = coupon.end_date {
                if end < Utc::now() {
                    return Err("Coupon has expired".to_string());
                }
            }

            // Check expiry (legacy)
            if let Some(expiry) = coupon.expiry_date {
                if expiry < Utc::now() {
                    return Err("Coupon expired".to_string());
                }
            }

            // Check usage limit
            if let Some(limit) = coupon.usage_limit {
                if coupon.usage_count >= limit {
                    return Err("Coupon usage limit reached".to_string());
                }
            }

            // Check target if specified
            if let Some(c_target_id) = coupon.target_id {
                if let Some(req_target_id) = target_id {
                    if c_target_id != req_target_id {
                        return Err("Coupon not valid for this user".to_string());
                    }
                } else {
                    return Err("Coupon requires specific user".to_string());
                }
            }

            // Increment usage count
            let _ = coll
                .update_one(
                    doc! { "_id": coupon.id.unwrap() },
                    doc! { "$inc": { "usage_count": 1 }, "$set": { "updated_at": Utc::now() } },
                    None,
                )
                .await;

            Ok((coupon.discount_type, coupon.discount_value))
        }
        Ok(None) => Err("Invalid coupon code".to_string()),
        Err(_) => Err("Database error".to_string()),
    }
}

#[derive(Debug, Deserialize)]
pub struct ValidateCouponQuery {
    pub code: String,
    pub coupon_type: Option<String>,
    pub target_id: Option<String>,
}
