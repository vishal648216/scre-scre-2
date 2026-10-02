use axum::{
    extract::{State, Query},
    http::StatusCode,
    Json,
};
use mongodb::{Database, bson::{doc, oid::ObjectId, DateTime}};
use serde::{Deserialize, Serialize};
use crate::models::user::{UserRole, Claims};
use futures_util::stream::StreamExt;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Attendance {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub student_id: ObjectId,
    pub center_id: ObjectId,
    pub date: DateTime,
    pub status: String, // present, absent, late, leave
    pub remarks: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AttendanceQuery {
    #[serde(default)]
    pub date: Option<String>,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub end_date: Option<String>,
    #[serde(default)]
    pub student_id: Option<String>,
    #[serde(default)]
    pub center_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BulkAttendanceRequest {
    pub records: Vec<AttendanceRecord>,
    #[serde(default)]
    pub center_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AttendanceRecord {
    pub student_id: String,
    pub status: String,
    pub date: String,
    #[serde(default)]
    pub center_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StudentAttendanceRecordPayload {
    pub student_id: String,
    pub date: String,
    pub status: String,
    #[serde(default)]
    pub center_id: Option<String>,
    #[serde(default)]
    pub remarks: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SaveStudentAttendanceRequest {
    pub date: String,
    #[serde(default)]
    pub center_id: Option<String>,
    pub records: Vec<StudentAttendanceRecordPayload>,
}

#[derive(Debug, Serialize)]
pub struct AttendanceResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct MarkAttendanceRequest {
    pub student_id: String,
    pub date: String,
    pub status: String,
    #[serde(default)]
    pub center_id: Option<String>,
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

pub async fn mark_attendance(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<MarkAttendanceRequest>,
) -> (StatusCode, Json<AttendanceResponse>) {
    if claims.role == UserRole::Student {
        return (StatusCode::FORBIDDEN, Json(AttendanceResponse { success: false, message: "Students cannot mark attendance".to_string() }));
    }

    let student_id_str = payload.student_id.trim().to_string();
    if student_id_str.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(AttendanceResponse { success: false, message: "Invalid Student ID".to_string() }));
    }

    let (student_id_bson, student_filter_doc) = if let Ok(s_oid) = ObjectId::parse_str(&student_id_str) {
        (
            mongodb::bson::Bson::ObjectId(s_oid),
            doc! { "$or": [{ "student_id": s_oid }, { "student_id": &student_id_str }] }
        )
    } else {
        (
            mongodb::bson::Bson::String(student_id_str.clone()),
            doc! { "student_id": &student_id_str }
        )
    };

    let clean_date = payload.date.split('T').next().unwrap_or(&payload.date).to_string();

    let center_oid = if claims.role == UserRole::Center {
        ObjectId::parse_str(&claims.sub).unwrap_or_default()
    } else if let Some(ref c_id) = payload.center_id {
        if c_id.is_empty() { ObjectId::default() } else { ObjectId::parse_str(c_id).unwrap_or_default() }
    } else {
        let student_coll = db.collection::<mongodb::bson::Document>("users");
        if let Ok(s_oid) = ObjectId::parse_str(&student_id_str) {
            if let Ok(Some(s_doc)) = student_coll.find_one(doc! { "_id": s_oid }, None).await {
                s_doc.get_object_id("parent_id")
                    .or_else(|_| s_doc.get_object_id("center_id"))
                    .unwrap_or_default()
            } else {
                ObjectId::default()
            }
        } else {
            ObjectId::default()
        }
    };

    let target_date = parse_date_to_bson_datetime(&clean_date);
    let collection = db.collection::<mongodb::bson::Document>("attendances");
    let filter = doc! {
        "$and": [
            student_filter_doc,
            doc! {
                "$or": [
                    { "date_str": &clean_date },
                    { "date": {
                        "$gte": parse_date_to_bson_datetime(&format!("{}T00:00:00Z", clean_date)),
                        "$lte": parse_date_to_bson_datetime(&format!("{}T23:59:59Z", clean_date))
                    }}
                ]
            }
        ]
    };
    let update = doc! {
        "$set": { 
            "status": payload.status.to_lowercase(),
            "center_id": center_oid,
            "date_str": &clean_date,
            "date": target_date
        },
        "$setOnInsert": {
            "student_id": student_id_bson
        }
    };
    let options = mongodb::options::UpdateOptions::builder().upsert(true).build();

    match collection.update_one(filter, update, options).await {
        Ok(_) => (StatusCode::OK, Json(AttendanceResponse { success: true, message: "Attendance marked".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(AttendanceResponse { success: false, message: "Failed to mark attendance".to_string() })),
    }
}

pub async fn get_attendance(
    State(db): State<Database>,
    claims: Claims,
    Query(query): Query<AttendanceQuery>,
) -> (StatusCode, Json<serde_json::Value>) {
    let att_coll = db.collection::<mongodb::bson::Document>("attendances");
    
    // Check if ?date=YYYY-MM-DD query is passed
    if let Some(date_val) = &query.date {
        let clean_date = date_val.split('T').next().unwrap_or(date_val).to_string();
        
        let is_locked = match att_coll.find_one(doc! { "date_str": &clean_date, "type": "lock_marker", "is_locked": true }, None).await {
            Ok(Some(_)) => true,
            _ => false,
        };

        let mut filter = doc! { 
            "type": { "$ne": "lock_marker" },
            "$or": [
                { "date_str": &clean_date },
                { "date": {
                    "$gte": parse_date_to_bson_datetime(&format!("{}T00:00:00Z", clean_date)),
                    "$lte": parse_date_to_bson_datetime(&format!("{}T23:59:59Z", clean_date))
                }}
            ]
        };

        if claims.role == UserRole::Student {
            if let Ok(student_oid) = ObjectId::parse_str(&claims.sub) {
                filter.insert("$or", vec![
                    doc! { "student_id": student_oid },
                    doc! { "student_id": &claims.sub }
                ]);
            } else {
                filter.insert("student_id", &claims.sub);
            }
        } else if claims.role == UserRole::Center {
            if let Ok(center_oid) = ObjectId::parse_str(&claims.sub) {
                filter.insert("center_id", center_oid);
            }
        } else if let Some(ref c_id) = query.center_id {
            if c_id != "all" && !c_id.is_empty() {
                if let Ok(center_oid) = ObjectId::parse_str(c_id) {
                    filter.insert("center_id", center_oid);
                }
            }
        }

        if let Some(ref student_id) = query.student_id {
            if !student_id.is_empty() {
                if let Ok(student_oid) = ObjectId::parse_str(student_id) {
                    filter.insert("$or", vec![
                        doc! { "student_id": student_oid },
                        doc! { "student_id": student_id }
                    ]);
                } else {
                    filter.insert("student_id", student_id);
                }
            }
        }

        let mut cursor = match att_coll.find(filter, None).await {
            Ok(c) => c,
            Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "date": clean_date, "is_locked": is_locked, "records": [] }))),
        };

        let mut records = Vec::new();
        while let Some(result) = cursor.next().await {
            if let Ok(doc) = result {
                if let Ok(val) = serde_json::to_value(doc) {
                    records.push(val);
                }
            }
        }

        return (StatusCode::OK, Json(serde_json::json!({
            "date": clean_date,
            "is_locked": is_locked,
            "records": records
        })));
    }

    // Range query (e.g. start_date & end_date for Monthly Report)
    let mut filter = doc! { "type": { "$ne": "lock_marker" } };

    if claims.role == UserRole::Student {
        if let Ok(student_oid) = ObjectId::parse_str(&claims.sub) {
            filter.insert("$or", vec![
                doc! { "student_id": student_oid },
                doc! { "student_id": &claims.sub }
            ]);
        } else {
            filter.insert("student_id", &claims.sub);
        }
    } else if claims.role == UserRole::Center {
        if let Ok(center_oid) = ObjectId::parse_str(&claims.sub) {
            filter.insert("center_id", center_oid);
        }
    } else if let Some(ref c_id) = query.center_id {
        if c_id != "all" && !c_id.is_empty() {
            if let Ok(center_oid) = ObjectId::parse_str(c_id) {
                filter.insert("center_id", center_oid);
            }
        }
    }

    if let Some(ref student_id) = query.student_id {
        if !student_id.is_empty() {
            if let Ok(student_oid) = ObjectId::parse_str(student_id) {
                filter.insert("$or", vec![
                    doc! { "student_id": student_oid },
                    doc! { "student_id": student_id }
                ]);
            } else {
                filter.insert("student_id", student_id);
            }
        }
    }

    if query.start_date.is_some() || query.end_date.is_some() {
        if let (Some(start), Some(end)) = (query.start_date.as_ref(), query.end_date.as_ref()) {
            let start_dt = parse_date_to_bson_datetime(start);
            let end_dt = parse_date_to_bson_datetime(end);
            let start_str = start.split('T').next().unwrap_or(start);
            let end_str = end.split('T').next().unwrap_or(end);

            filter.insert("$or", vec![
                doc! { "date": { "$gte": start_dt, "$lte": end_dt } },
                doc! { "date_str": { "$gte": start_str, "$lte": end_str } }
            ]);
        } else if let Some(ref start) = query.start_date {
            let start_dt = parse_date_to_bson_datetime(start);
            filter.insert("date", doc! { "$gte": start_dt });
        } else if let Some(ref end) = query.end_date {
            let end_dt = parse_date_to_bson_datetime(end);
            filter.insert("date", doc! { "$lte": end_dt });
        }
    }

    let mut cursor = match att_coll.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!([]))),
    };

    let mut results = vec![];
    while let Some(result) = cursor.next().await {
        if let Ok(doc) = result {
            if let Ok(val) = serde_json::to_value(doc) {
                results.push(val);
            }
        }
    }

    (StatusCode::OK, Json(serde_json::json!(results)))
}

pub async fn save_student_attendance(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<SaveStudentAttendanceRequest>,
) -> (StatusCode, Json<AttendanceResponse>) {
    if claims.role == UserRole::Student {
        return (StatusCode::FORBIDDEN, Json(AttendanceResponse {
            success: false,
            message: "Students cannot mark attendance".to_string()
        }));
    }

    let clean_date = payload.date.split('T').next().unwrap_or(&payload.date).to_string();
    let att_coll = db.collection::<mongodb::bson::Document>("attendances");
    let student_coll = db.collection::<mongodb::bson::Document>("users");

    // Check if date is locked (Only restrict non-Admins)
    if claims.role != UserRole::SuperAdmin && claims.role != UserRole::Admin {
        if let Ok(Some(_)) = att_coll.find_one(doc! { "date_str": &clean_date, "type": "lock_marker", "is_locked": true }, None).await {
            return (StatusCode::FORBIDDEN, Json(AttendanceResponse {
                success: false,
                message: format!("Attendance for date {} is locked and cannot be edited!", clean_date)
            }));
        }
    }

    let now = Utc::now();
    let target_date = parse_date_to_bson_datetime(&clean_date);

    let default_center_oid = if claims.role == UserRole::Center {
        ObjectId::parse_str(&claims.sub).ok()
    } else if let Some(ref c_id) = payload.center_id {
        if c_id.is_empty() { None } else { ObjectId::parse_str(c_id).ok() }
    } else {
        None
    };

    for rec in payload.records {
        let student_id_str = rec.student_id.trim().to_string();
        if student_id_str.is_empty() {
            continue;
        }

        let student_id_bson = if let Ok(s_oid) = ObjectId::parse_str(&student_id_str) {
            mongodb::bson::Bson::ObjectId(s_oid)
        } else {
            mongodb::bson::Bson::String(student_id_str.clone())
        };

        let center_oid = rec.center_id.as_ref()
            .and_then(|c| if c.is_empty() { None } else { ObjectId::parse_str(c).ok() })
            .or(default_center_oid);

        let final_center_oid = match center_oid {
            Some(oid) => oid,
            None => {
                if let Ok(s_oid) = ObjectId::parse_str(&student_id_str) {
                    if let Ok(Some(s_doc)) = student_coll.find_one(doc! { "_id": s_oid }, None).await {
                        s_doc.get_object_id("parent_id")
                            .or_else(|_| s_doc.get_object_id("center_id"))
                            .unwrap_or_default()
                    } else {
                        ObjectId::default()
                    }
                } else {
                    ObjectId::default()
                }
            }
        };

        let existing_doc = att_coll.find_one(
            doc! {
                "type": { "$ne": "lock_marker" },
                "date_str": &clean_date,
                "$or": [
                    { "student_id": student_id_bson.clone() },
                    { "student_id": &student_id_str }
                ]
            },
            None
        ).await.ok().flatten();

        let filter = if let Some(ref existing) = existing_doc {
            if let Ok(oid) = existing.get_object_id("_id") {
                doc! { "_id": oid }
            } else {
                doc! { "date_str": &clean_date, "student_id": &student_id_bson }
            }
        } else {
            doc! { "date_str": &clean_date, "student_id": &student_id_bson }
        };

        let rec_doc = doc! {
            "student_id": student_id_bson,
            "center_id": final_center_oid,
            "date_str": &clean_date,
            "date": target_date,
            "status": rec.status.to_lowercase(),
            "remarks": rec.remarks,
            "updated_at": now.to_rfc3339(),
        };

        let options = mongodb::options::ReplaceOptions::builder().upsert(true).build();
        if let Err(e) = att_coll.replace_one(filter, rec_doc, options).await {
            eprintln!("Error saving student attendance: {:?}", e);
        }
    }

    // Save date lock marker doc
    let lock_doc = doc! {
        "date_str": &clean_date,
        "type": "lock_marker",
        "is_locked": true,
        "locked_by": &claims.sub,
        "locked_at": now.to_rfc3339(),
    };
    let _ = att_coll.replace_one(
        doc! { "date_str": &clean_date, "type": "lock_marker" },
        lock_doc,
        mongodb::options::ReplaceOptions::builder().upsert(true).build()
    ).await;

    (StatusCode::OK, Json(AttendanceResponse {
        success: true,
        message: format!("Attendance for {} saved & locked successfully", clean_date)
    }))
}

pub async fn bulk_upsert_attendance(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<BulkAttendanceRequest>,
) -> (StatusCode, Json<AttendanceResponse>) {
    if claims.role == UserRole::Student {
        return (StatusCode::FORBIDDEN, Json(AttendanceResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let default_center_oid = if claims.role == UserRole::Center {
        ObjectId::parse_str(&claims.sub).ok()
    } else if let Some(ref c_id) = payload.center_id {
        if c_id.is_empty() { None } else { ObjectId::parse_str(c_id).ok() }
    } else {
        None
    };

    let att_coll = db.collection::<mongodb::bson::Document>("attendances");
    let student_coll = db.collection::<mongodb::bson::Document>("users");
    let now = Utc::now();

    for record in &payload.records {
        let student_id_str = record.student_id.trim().to_string();
        if student_id_str.is_empty() {
            continue;
        }

        let student_id_bson = if let Ok(s_oid) = ObjectId::parse_str(&student_id_str) {
            mongodb::bson::Bson::ObjectId(s_oid)
        } else {
            mongodb::bson::Bson::String(student_id_str.clone())
        };

        let clean_date = record.date.split('T').next().unwrap_or(&record.date).to_string();

        let center_oid = record.center_id.as_ref()
            .and_then(|c| if c.is_empty() { None } else { ObjectId::parse_str(c).ok() })
            .or(default_center_oid);

        let final_center_oid = match center_oid {
            Some(oid) => oid,
            None => {
                if let Ok(s_oid) = ObjectId::parse_str(&student_id_str) {
                    if let Ok(Some(s_doc)) = student_coll.find_one(doc! { "_id": s_oid }, None).await {
                        s_doc.get_object_id("parent_id")
                            .or_else(|_| s_doc.get_object_id("center_id"))
                            .unwrap_or_default()
                    } else {
                        ObjectId::default()
                    }
                } else {
                    ObjectId::default()
                }
            }
        };

        let target_date = parse_date_to_bson_datetime(&clean_date);

        let existing_doc = att_coll.find_one(
            doc! {
                "type": { "$ne": "lock_marker" },
                "date_str": &clean_date,
                "$or": [
                    { "student_id": student_id_bson.clone() },
                    { "student_id": &student_id_str }
                ]
            },
            None
        ).await.ok().flatten();

        let filter = if let Some(ref existing) = existing_doc {
            if let Ok(oid) = existing.get_object_id("_id") {
                doc! { "_id": oid }
            } else {
                doc! { "date_str": &clean_date, "student_id": &student_id_bson }
            }
        } else {
            doc! { "date_str": &clean_date, "student_id": &student_id_bson }
        };

        let rec_doc = doc! {
            "student_id": student_id_bson,
            "center_id": final_center_oid,
            "date_str": &clean_date,
            "date": target_date,
            "status": record.status.to_lowercase(),
            "updated_at": now.to_rfc3339(),
        };

        let options = mongodb::options::ReplaceOptions::builder().upsert(true).build();
        if let Err(e) = att_coll.replace_one(filter, rec_doc, options).await {
            eprintln!("Error bulk upserting attendance: {:?}", e);
        }
    }

    (StatusCode::OK, Json(AttendanceResponse { success: true, message: "Bulk attendance updated successfully".to_string() }))
}

pub async fn unlock_attendance(
    State(db): State<Database>,
    claims: Claims,
    Query(query): Query<AttendanceQuery>,
) -> (StatusCode, Json<AttendanceResponse>) {
    if claims.role != UserRole::SuperAdmin && claims.role != UserRole::Admin {
        return (StatusCode::FORBIDDEN, Json(AttendanceResponse {
            success: false,
            message: "Only SuperAdmin/Admin can unlock attendance registers".to_string(),
        }));
    }

    if let Some(ref date_val) = query.date {
        let clean_date = date_val.split('T').next().unwrap_or(date_val).to_string();
        let att_coll = db.collection::<mongodb::bson::Document>("attendances");
        let _ = att_coll.delete_many(doc! { "date_str": &clean_date, "type": "lock_marker" }, None).await;
        return (StatusCode::OK, Json(AttendanceResponse {
            success: true,
            message: format!("Attendance for {} unlocked successfully", clean_date),
        }));
    }

    (StatusCode::BAD_REQUEST, Json(AttendanceResponse { success: false, message: "Missing date parameter".to_string() }))
}
