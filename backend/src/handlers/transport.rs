use crate::models::transport::{
    CreateBusPayload, CreateRoutePayload, CreateTransportRequestPayload, TransportBus,
    TransportPass, TransportRequest, TransportRoute,
};
use crate::models::user::{Claims, UserRole};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use chrono::Utc;
use futures_util::StreamExt;
use mongodb::{
    Database,
    bson::{doc, oid::ObjectId},
};
use serde_json::json;

/// Helper: Resolve center_id ObjectId from logged in Claims
async fn resolve_center_id(db: &Database, claims: &Claims) -> Option<ObjectId> {
    match claims.role {
        UserRole::Center => ObjectId::parse_str(&claims.sub).ok(),
        UserRole::Student | UserRole::Staff => {
            let users = db.collection::<mongodb::bson::Document>("users");
            if let Ok(user_oid) = ObjectId::parse_str(&claims.sub) {
                if let Ok(Some(user_doc)) = users.find_one(doc! {"_id": user_oid}, None).await {
                    if let Ok(parent_id) = user_doc.get_object_id("parent_id") {
                        return Some(parent_id);
                    }
                    if let Ok(center_id) = user_doc.get_object_id("center_id") {
                        return Some(center_id);
                    }
                }
            }
            None
        }
        UserRole::Admin | UserRole::SuperAdmin => {
            // SuperAdmin falls back to user_oid or None
            ObjectId::parse_str(&claims.sub).ok()
        }
        _ => None,
    }
}

/// GET /api/transport/buses — List center buses
pub async fn list_buses(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<serde_json::Value>) {
    let coll = db.collection::<TransportBus>("transport_buses");
    let mut filter = doc! {};

    if claims.role == UserRole::Center || claims.role == UserRole::Student || claims.role == UserRole::Staff {
        if let Some(cid) = resolve_center_id(&db, &claims).await {
            filter.insert("center_id", cid);
        }
    }

    let mut buses = Vec::new();
    if let Ok(mut cursor) = coll.find(filter, None).await {
        while let Some(Ok(bus)) = cursor.next().await {
            let mut val = serde_json::to_value(&bus).unwrap_or_default();
            if let Some(obj) = val.as_object_mut() {
                if let Some(id_val) = obj.remove("_id") {
                    if let Some(oid_map) = id_val.as_object() {
                        if let Some(s) = oid_map.get("$oid").and_then(|v| v.as_str()) {
                            obj.insert("id".to_string(), json!(s));
                        }
                    }
                }
            }
            buses.push(val);
        }
    }

    (StatusCode::OK, Json(json!({"success": true, "buses": buses})))
}

/// POST /api/transport/buses — Add bus to fleet
pub async fn create_bus(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateBusPayload>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Center && claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(json!({"success": false, "message": "Unauthorized"})));
    }

    let center_id = match resolve_center_id(&db, &claims).await {
        Some(cid) => cid,
        None => ObjectId::new(),
    };

    let bus = TransportBus {
        id: None,
        vehicle_no: payload.vehicle_no,
        vehicle_type: payload.vehicle_type,
        capacity: payload.capacity.unwrap_or(32),
        driver_name: payload.driver_name.unwrap_or_else(|| "Unassigned".to_string()),
        driver_phone: payload.driver_phone.unwrap_or_else(|| "N/A".to_string()),
        route_assigned: payload.route_assigned,
        center_id,
        status: "ACTIVE".to_string(),
        created_at: Some(Utc::now()),
    };

    let coll = db.collection::<TransportBus>("transport_buses");
    match coll.insert_one(bus, None).await {
        Ok(res) => (
            StatusCode::CREATED,
            Json(json!({"success": true, "message": "Bus added to fleet", "id": res.inserted_id})),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"success": false, "message": format!("Failed: {}", e)})),
        ),
    }
}

/// DELETE /api/transport/buses/:id
pub async fn delete_bus(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Center && claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(json!({"success": false, "message": "Unauthorized"})));
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(json!({"success": false, "message": "Invalid ID"}))),
    };

    let coll = db.collection::<mongodb::bson::Document>("transport_buses");
    let _ = coll.delete_one(doc! {"_id": oid}, None).await;

    (StatusCode::OK, Json(json!({"success": true, "message": "Bus removed"})))
}

/// GET /api/transport/routes — List routes
pub async fn list_routes(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<serde_json::Value>) {
    let coll = db.collection::<TransportRoute>("transport_routes");
    let mut filter = doc! {};

    if claims.role == UserRole::Center || claims.role == UserRole::Student || claims.role == UserRole::Staff {
        if let Some(cid) = resolve_center_id(&db, &claims).await {
            filter.insert("center_id", cid);
        }
    }

    let mut routes = Vec::new();
    if let Ok(mut cursor) = coll.find(filter, None).await {
        while let Some(Ok(r)) = cursor.next().await {
            let mut val = serde_json::to_value(&r).unwrap_or_default();
            if let Some(obj) = val.as_object_mut() {
                if let Some(id_val) = obj.remove("_id") {
                    if let Some(oid_map) = id_val.as_object() {
                        if let Some(s) = oid_map.get("$oid").and_then(|v| v.as_str()) {
                            obj.insert("id".to_string(), json!(s));
                        }
                    }
                }
            }
            routes.push(val);
        }
    }

    (StatusCode::OK, Json(json!({"success": true, "routes": routes})))
}

/// POST /api/transport/routes — Add route
pub async fn create_route(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateRoutePayload>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Center && claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(json!({"success": false, "message": "Unauthorized"})));
    }

    let center_id = match resolve_center_id(&db, &claims).await {
        Some(cid) => cid,
        None => ObjectId::new(),
    };

    let route = TransportRoute {
        id: None,
        route_name: payload.route_name,
        start_point: payload.start_point.unwrap_or_else(|| "City Center".to_string()),
        destination: payload.destination.unwrap_or_else(|| "Campus".to_string()),
        stops_count: payload.stops_count.unwrap_or(5),
        monthly_fee: payload.monthly_fee.unwrap_or(1500.0),
        assigned_vehicle: payload.assigned_vehicle,
        center_id,
        status: "OPERATIONAL".to_string(),
        created_at: Some(Utc::now()),
    };

    let coll = db.collection::<TransportRoute>("transport_routes");
    match coll.insert_one(route, None).await {
        Ok(res) => (
            StatusCode::CREATED,
            Json(json!({"success": true, "message": "Route added", "id": res.inserted_id})),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"success": false, "message": format!("Failed: {}", e)})),
        ),
    }
}

/// DELETE /api/transport/routes/:id
pub async fn delete_route(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Center && claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(json!({"success": false, "message": "Unauthorized"})));
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(json!({"success": false, "message": "Invalid ID"}))),
    };

    let coll = db.collection::<mongodb::bson::Document>("transport_routes");
    let _ = coll.delete_one(doc! {"_id": oid}, None).await;

    (StatusCode::OK, Json(json!({"success": true, "message": "Route removed"})))
}

/// GET /api/transport/passes/me — Get logged-in student transport pass
pub async fn get_my_pass(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<serde_json::Value>) {
    let student_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(json!({"success": false, "message": "Invalid user ID"}))),
    };

    let coll = db.collection::<TransportPass>("transport_passes");
    match coll.find_one(doc! {"student_id": student_oid, "status": "VALID"}, None).await {
        Ok(Some(pass)) => {
            let mut val = serde_json::to_value(&pass).unwrap_or_default();
            if let Some(obj) = val.as_object_mut() {
                if let Some(id_val) = obj.remove("_id") {
                    if let Some(oid_map) = id_val.as_object() {
                        if let Some(s) = oid_map.get("$oid").and_then(|v| v.as_str()) {
                            obj.insert("id".to_string(), json!(s));
                        }
                    }
                }
            }
            (StatusCode::OK, Json(json!({"success": true, "pass": val})))
        }
        _ => (StatusCode::OK, Json(json!({"success": true, "pass": null}))),
    }
}

/// POST /api/transport/requests — Submit student bus pass allotment request
pub async fn create_request(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateTransportRequestPayload>,
) -> (StatusCode, Json<serde_json::Value>) {
    let student_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(json!({"success": false, "message": "Invalid user ID"}))),
    };

    let center_id = match resolve_center_id(&db, &claims).await {
        Some(cid) => cid,
        None => ObjectId::new(),
    };

    let req = TransportRequest {
        id: None,
        student_id: student_oid,
        route_id: payload.route_id,
        stop_name: payload.stop_name,
        reason: payload.reason,
        center_id,
        status: "PENDING".to_string(),
        created_at: Some(Utc::now()),
    };

    let coll = db.collection::<TransportRequest>("transport_requests");
    match coll.insert_one(req, None).await {
        Ok(res) => (
            StatusCode::CREATED,
            Json(json!({"success": true, "message": "Request submitted", "id": res.inserted_id})),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"success": false, "message": format!("Failed: {}", e)})),
        ),
    }
}
