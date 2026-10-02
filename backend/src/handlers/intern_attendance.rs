
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
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub intern_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MarkInternAttendanceRequest {
    pub intern_id: String,
    pub date: String,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct InternAttendanceResponse {
    pub success: bool,
    pub message: String,
}

fn parse_date_to_bson_datetime(date_str: &str) -> DateTime {
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(date_str) {
        DateTime::from_millis(dt.timestamp_millis())
    } else if let Ok(nd) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        let dt = nd.and_hms_opt(12, 0, 0).unwrap_or_default();
        DateTime::from_millis(dt.and_utc().timestamp_millis())
    } else {
        DateTime::now()
    }
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
        ObjectId::parse_str("000000000000000000000000").unwrap()
    };

    let intern_oid = match ObjectId::parse_str(&payload.intern_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(InternAttendanceResponse { success: false, message: "Invalid Intern ID".to_string() })),
    };

    let target_date = parse_date_to_bson_datetime(&payload.date);
    let collection = db.collection::<InternAttendance>("intern_attendances");
    let filter = doc! {
        "intern_id": intern_oid,
        "date": target_date
    };
    let update = doc! {
        "$set": { 
            "status": payload.status,
            "center_id": center_oid
        },
        "$setOnInsert": {
            "intern_id": intern_oid,
            "date": target_date
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
        if let Some(ref start) = query.start_date {
            let start_dt = parse_date_to_bson_datetime(start);
            date_filter.insert("$gte", start_dt);
        }
        if let Some(ref end) = query.end_date {
            let end_dt = parse_date_to_bson_datetime(end);
            date_filter.insert("$lte", end_dt);
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

#[derive(Debug, Deserialize)]
pub struct BulkInternAttendanceRequest {
    pub records: Vec<MarkInternAttendanceRequest>,
}

#[derive(Debug, Deserialize)]
pub struct StipendPayoutQuery {
    pub month: Option<String>,
    pub intern_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DisburseStipendRequest {
    pub intern_id: String,
    pub month: String,
    pub amount: f64,
    pub remarks: Option<String>,
}

pub async fn save_bulk_intern_attendance(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<BulkInternAttendanceRequest>,
) -> (StatusCode, Json<InternAttendanceResponse>) {
    if claims.role != UserRole::Center && claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(InternAttendanceResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let default_center_oid = if claims.role == UserRole::Center {
        ObjectId::parse_str(&claims.sub).ok()
    } else {
        None
    };

    let collection = db.collection::<mongodb::bson::Document>("intern_attendances");

    for rec in payload.records {
        let intern_id_str = rec.intern_id.trim().to_string();
        if intern_id_str.is_empty() {
            continue;
        }

        let intern_bson = if let Ok(oid) = ObjectId::parse_str(&intern_id_str) {
            mongodb::bson::Bson::ObjectId(oid)
        } else {
            mongodb::bson::Bson::String(intern_id_str.clone())
        };

        let clean_date = rec.date.split('T').next().unwrap_or(&rec.date).to_string();
        let target_date = parse_date_to_bson_datetime(&clean_date);
        let center_oid = default_center_oid.unwrap_or_else(|| ObjectId::default());

        let existing_doc = collection.find_one(
            doc! {
                "date_str": &clean_date,
                "$or": [
                    { "intern_id": &intern_bson },
                    { "intern_id": &intern_id_str }
                ]
            },
            None
        ).await.ok().flatten();

        let filter = if let Some(ref existing) = existing_doc {
            if let Ok(oid) = existing.get_object_id("_id") {
                doc! { "_id": oid }
            } else {
                doc! { "date_str": &clean_date, "intern_id": &intern_bson }
            }
        } else {
            doc! { "date_str": &clean_date, "intern_id": &intern_bson }
        };

        let rec_doc = doc! {
            "intern_id": intern_bson,
            "center_id": center_oid,
            "date_str": &clean_date,
            "date": target_date,
            "status": rec.status.to_lowercase(),
            "updated_at": chrono::Utc::now().to_rfc3339(),
        };

        let options = mongodb::options::ReplaceOptions::builder().upsert(true).build();
        let _ = collection.replace_one(filter, rec_doc, options).await;
    }

    (StatusCode::OK, Json(InternAttendanceResponse {
        success: true,
        message: "Intern attendance records saved successfully".to_string()
    }))
}

pub async fn get_intern_stipend_payouts(
    State(db): State<Database>,
    _claims: Claims,
    Query(query): Query<StipendPayoutQuery>,
) -> (StatusCode, Json<serde_json::Value>) {
    let coll = db.collection::<mongodb::bson::Document>("intern_payouts");
    let mut filter = doc! {};

    if let Some(ref m) = query.month {
        if !m.is_empty() {
            filter.insert("month", m);
        }
    }
    if let Some(ref i_id) = query.intern_id {
        if !i_id.is_empty() {
            if let Ok(oid) = ObjectId::parse_str(i_id) {
                filter.insert("$or", vec![
                    doc! { "intern_id": oid },
                    doc! { "intern_id": i_id }
                ]);
            } else {
                filter.insert("intern_id", i_id);
            }
        }
    }

    let mut cursor = match coll.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!([]))),
    };

    let mut results = vec![];
    use futures_util::stream::StreamExt;
    while let Some(result) = cursor.next().await {
        if let Ok(doc) = result {
            if let Ok(val) = serde_json::to_value(doc) {
                results.push(val);
            }
        }
    }

    (StatusCode::OK, Json(serde_json::json!(results)))
}

pub async fn disburse_intern_stipend(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<DisburseStipendRequest>,
) -> (StatusCode, Json<InternAttendanceResponse>) {
    if claims.role != UserRole::Center && claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(InternAttendanceResponse {
            success: false,
            message: "Unauthorized to disburse stipends".to_string()
        }));
    }

    let coll = db.collection::<mongodb::bson::Document>("intern_payouts");
    let intern_id_str = payload.intern_id.trim().to_string();
    let month_str = payload.month.trim().to_string();

    let intern_bson = if let Ok(oid) = ObjectId::parse_str(&intern_id_str) {
        mongodb::bson::Bson::ObjectId(oid)
    } else {
        mongodb::bson::Bson::String(intern_id_str.clone())
    };

    let filter = doc! {
        "month": &month_str,
        "$or": [
            { "intern_id": &intern_bson },
            { "intern_id": &intern_id_str }
        ]
    };

    let existing = coll.find_one(filter.clone(), None).await;
    if let Ok(Some(_)) = existing {
        return (StatusCode::BAD_REQUEST, Json(InternAttendanceResponse {
            success: false,
            message: format!("Stipend for month {} has already been disbursed!", month_str)
        }));
    }

    let payout_doc = doc! {
        "intern_id": intern_bson,
        "month": &month_str,
        "amount": payload.amount,
        "status": "Paid",
        "disbursed_at": chrono::Utc::now().to_rfc3339(),
        "disbursed_by": &claims.sub,
        "remarks": payload.remarks,
    };

    let options = mongodb::options::ReplaceOptions::builder().upsert(true).build();
    match coll.replace_one(filter, payout_doc, options).await {
        Ok(_) => (StatusCode::OK, Json(InternAttendanceResponse {
            success: true,
            message: format!("Stipend of ₹{} disbursed successfully for month {}!", payload.amount, month_str)
        })),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(InternAttendanceResponse {
            success: false,
            message: format!("Database error disbursing stipend: {}", e)
        })),
    }
}
