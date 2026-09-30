use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TransportBus {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub vehicle_no: String,
    pub vehicle_type: String,
    pub capacity: i32,
    pub driver_name: String,
    pub driver_phone: String,
    pub route_assigned: Option<String>,
    pub center_id: ObjectId,
    pub status: String, // "ACTIVE", "MAINTENANCE", "INACTIVE"
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TransportRoute {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub route_name: String,
    pub start_point: String,
    pub destination: String,
    pub stops_count: i32,
    pub monthly_fee: f64,
    pub assigned_vehicle: Option<String>,
    pub center_id: ObjectId,
    pub status: String, // "OPERATIONAL", "SUSPENDED"
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TransportPass {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub student_id: ObjectId,
    pub student_name: String,
    pub enrollment_no: String,
    pub route_name: String,
    pub stop_name: String,
    pub pass_number: String,
    pub valid_till: String,
    pub center_id: ObjectId,
    pub status: String, // "VALID", "EXPIRED", "CANCELLED"
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TransportRequest {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub student_id: ObjectId,
    pub route_id: String,
    pub stop_name: String,
    pub reason: Option<String>,
    pub center_id: ObjectId,
    pub status: String, // "PENDING", "APPROVED", "REJECTED"
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBusPayload {
    pub vehicle_no: String,
    pub vehicle_type: String,
    pub capacity: Option<i32>,
    pub driver_name: Option<String>,
    pub driver_phone: Option<String>,
    pub route_assigned: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRoutePayload {
    pub route_name: String,
    pub start_point: Option<String>,
    pub destination: Option<String>,
    pub stops_count: Option<i32>,
    pub monthly_fee: Option<f64>,
    pub assigned_vehicle: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTransportRequestPayload {
    pub route_id: String,
    pub stop_name: String,
    pub reason: Option<String>,
}
