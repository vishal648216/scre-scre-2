
use axum::{
    extract::{State, Query},
    http::StatusCode,
    Json,
};
use mongodb::{Database, bson::{doc, oid::ObjectId, DateTime}};
use serde::{Deserialize, Serialize};
use crate::models::user::{UserRole, Claims};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InternAttendance {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub intern_id: ObjectId,
    pub center_id: ObjectId,
    pub date: DateTime,
    pub status: String,
    pub remarks: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct InternAttendanceQuery {
    pub start_date: Option<DateTime>,
    pub end_date: Option<DateTime>,
    pub intern_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MarkInternAttendanceRequest {
    pub intern_id: String,
    pub date: DateTime,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct InternAttendanceResponse {
    pub success: bool,
    pub message: String,
}

pub async fn mark_intern_attendance(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<MarkInternAttendanceRequest>,
) -> (StatusCode, Json<InternAttendanceResponse>) {
    if claims.role != UserRole::Center && claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(InternAttendanceResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let center_oid = if claims.role == UserRole::Center {
        match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(InternAttendanceResponse { success: false, message: "Invalid Center ID".to_string() })),
        }
    } else {
        ObjectId::parse_str("000000000000000000000000").unwrap() // Placeholder for admin/superadmin, maybe we can get from intern's parent_id later
    };

    let intern_oid = match ObjectId::parse_str(&payload.intern_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(InternAttendanceResponse { success: false, message: "Invalid Intern ID".to_string() })),
    };

    let collection = db.collection::<InternAttendance>("intern_attendances");
    let filter = doc! {
        "intern_id": intern_oid,
        "date": payload.date
    };
    let update = doc! {
        "$set": { 
            "status": payload.status,
            "center_id": center_oid
        },
        "$setOnInsert": {
            "intern_id": intern_oid,
            "date": payload.date
        }
    };
    let options = mongodb::options::UpdateOptions::builder().upsert(true).build();

    match collection.update_one(filter, update, options).await {
        Ok(_) => (StatusCode::OK, Json(InternAttendanceResponse { success: true, message: "Attendance marked".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(InternAttendanceResponse { success: false, message: "Failed to mark attendance".to_string() })),
    }
}

pub async fn get_intern_attendance(
    State(db): State<Database>,
    claims: Claims,
    Query(query): Query<InternAttendanceQuery>,
) -> (StatusCode, Json<Vec<InternAttendance>>) {
    let collection = db.collection::<InternAttendance>("intern_attendances");
    let mut filter = doc! {};

    if claims.role == UserRole::Intern {
        let intern_oid = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(vec![])),
        };
        filter.insert("intern_id", intern_oid);
    } else if claims.role == UserRole::Center {
        let center_oid = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(vec![])),
        };
        filter.insert("center_id", center_oid);
    }

    if let Some(intern_id) = query.intern_id {
        if let Ok(intern_oid) = ObjectId::parse_str(&intern_id) {
            filter.insert("intern_id", intern_oid);
        }
    }

    if query.start_date.is_some() || query.end_date.is_some() {
        let mut date_filter = doc! {};
        if let Some(start) = query.start_date {
            date_filter.insert("$gte", start);
        }
        if let Some(end) = query.end_date {
            date_filter.insert("$lte", end);
        }
        filter.insert("date", date_filter);
    }

    let mut cursor = match collection.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut results = vec![];
    use futures_util::stream::StreamExt;
    while let Some(result) = cursor.next().await {
        if let Ok(record) = result {
            results.push(record);
        }
    }

    (StatusCode::OK, Json(results))
}
