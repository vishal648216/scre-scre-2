use axum::{
    extract::{State, Path},
    http::StatusCode,
    Json,
};
use mongodb::{Database, bson::{doc, oid::ObjectId}};
use serde::Deserialize;
use crate::models::user::{UserRole, Claims};
use crate::models::center::Center;
use crate::models::center_update::{CenterUpdateRequest, CenterUpdateHistory};
use crate::services::email_service::send_update_notification_email;
use chrono::Utc;
use futures_util::stream::StreamExt;

#[derive(Debug, Deserialize)]
pub struct CreateUpdateRequest {
    pub new_data: serde_json::Value,
}

pub async fn request_center_update(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateUpdateRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Center {
        return (StatusCode::FORBIDDEN, Json(serde_json::json!({ "success": false, "message": "Only centers can request updates" })));
    }

    let user_id = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "message": "Invalid user ID" }))),
    };

    let center_coll = db.collection::<Center>("centers");
    let center = match center_coll.find_one(doc! { "user_id": user_id }, None).await {
        Ok(Some(c)) => c,
        _ => return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "success": false, "message": "Center not found" }))),
    };

    let update_req_coll = db.collection::<CenterUpdateRequest>("center_update_requests");
    
    let new_request = CenterUpdateRequest {
        id: None,
        center_id: center.id.unwrap(),
        old_data: center,
        new_data: payload.new_data,
        status: "pending".to_string(),
        requested_at: Utc::now(),
        processed_at: None,
        admin_notes: None,
    };

    match update_req_coll.insert_one(new_request, None).await {
        Ok(_) => (StatusCode::CREATED, Json(serde_json::json!({ "success": true, "message": "Update request submitted for approval" }))),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "message": "Failed to submit request" }))),
    }
}

pub async fn list_center_update_requests(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<CenterUpdateRequest>>) {
    let mut filter = doc! {};

    if claims.role == UserRole::Center {
        let user_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
        };
        let center_coll = db.collection::<Center>("centers");
        if let Ok(Some(center)) = center_coll.find_one(doc! { "user_id": user_id }, None).await {
            filter.insert("center_id", center.id.unwrap());
        } else {
            return (StatusCode::NOT_FOUND, Json(Vec::new()));
        }
    } else if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(Vec::new()));
    }

    let update_req_coll = db.collection::<CenterUpdateRequest>("center_update_requests");
    let mut cursor = match update_req_coll.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut items = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(item) = result {
            items.push(item);
        }
    }
    (StatusCode::OK, Json(items))
}

#[derive(Debug, Deserialize)]
pub struct ProcessUpdatePayload {
    pub status: String, // "approved" or "rejected"
    pub admin_notes: Option<String>,
}

pub async fn process_center_update(
    State(db): State<Database>,
    claims: Claims,
    Path(request_id): Path<String>,
    Json(payload): Json<ProcessUpdatePayload>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(serde_json::json!({ "success": false, "message": "Unauthorized" })));
    }

    let req_oid = match ObjectId::parse_str(&request_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "message": "Invalid request ID" }))),
    };

    let admin_id = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "message": "Invalid admin ID" }))),
    };
    let update_req_coll = db.collection::<CenterUpdateRequest>("center_update_requests");
    let center_coll = db.collection::<Center>("centers");
    let history_coll = db.collection::<CenterUpdateHistory>("center_update_history");

    let req = match update_req_coll.find_one(doc! { "_id": req_oid }, None).await {
        Ok(Some(r)) => r,
        _ => return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "success": false, "message": "Request not found" }))),
    };

    if req.status != "pending" {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "message": "Request already processed" })));
    }

    if payload.status == "approved" {
        // 1. Convert new_data JSON to Center struct
        let new_center_data: Center = match serde_json::from_value(req.new_data.clone()) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("Failed to parse new data: {}", e);
                return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "message": "Invalid new data format" })));
            }
        };

        // 2. Save history
        let history = CenterUpdateHistory {
            id: None,
            center_id: req.center_id,
            old_state: req.old_data.clone(),
            new_state: new_center_data.clone(),
            approved_at: Utc::now(),
            approved_by: admin_id,
        };
        let _ = history_coll.insert_one(history, None).await;

        // 3. Update the center in DB
        let mut update_doc = match mongodb::bson::to_document(&new_center_data) {
            Ok(d) => d,
            Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "message": "Failed to serialize data" }))),
        };
        update_doc.remove("_id"); // Don't overwrite ID

        if let Err(e) = center_coll.update_one(doc! { "_id": req.center_id }, doc! { "$set": update_doc }, None).await {
            eprintln!("Failed to update center: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "message": "Database update failed" })));
        }
    }

    // Update request status
    let _ = update_req_coll.update_one(
        doc! { "_id": req_oid },
        doc! { "$set": { "status": &payload.status, "processed_at": Utc::now(), "admin_notes": &payload.admin_notes } },
        None
    ).await;

    // Send notification email
    let _ = send_update_notification_email(
        &req.old_data.email,
        &req.old_data.name,
        &format!("Your profile update request has been {}. {}", payload.status, payload.admin_notes.unwrap_or_default())
    ).await;

    (StatusCode::OK, Json(serde_json::json!({ "success": true, "message": format!("Request {}", payload.status) })))
}

pub async fn get_update_history(
    State(db): State<Database>,
    claims: Claims,
    Path(center_id): Path<String>,
) -> (StatusCode, Json<Vec<CenterUpdateHistory>>) {
    let center_oid = match ObjectId::parse_str(&center_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
    };

    // Centers can only see their own history
    if claims.role == UserRole::Center {
        let user_id = ObjectId::parse_str(&claims.sub).unwrap();
        let center_coll = db.collection::<Center>("centers");
        match center_coll.find_one(doc! { "_id": center_oid, "user_id": user_id }, None).await {
            Ok(Some(_)) => {},
            _ => return (StatusCode::FORBIDDEN, Json(Vec::new())),
        }
    } else if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(Vec::new()));
    }

    let history_coll = db.collection::<CenterUpdateHistory>("center_update_history");
    let mut cursor = match history_coll.find(doc! { "center_id": center_oid }, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut items = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(item) = result {
            items.push(item);
        }
    }
    (StatusCode::OK, Json(items))
}
