use axum::{
    extract::{State, Path},
    http::StatusCode,
    Json,
};
use mongodb::{Database, bson::{doc, oid::ObjectId}};
use serde::{Deserialize, Serialize};
use crate::models::user::{UserRole, Claims};

#[derive(Debug, Deserialize)]
pub struct SetAllotmentRequest {
    pub language_ids: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct AllotmentResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct AllotmentData {
    pub course_id: String,
    pub language_ids: Vec<String>,
}

pub async fn get_course_typing_allotment(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<AllotmentData>) {
    let course_id = id.clone();
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(AllotmentData { course_id, language_ids: vec![] }));
    }
    let coll = db.collection::<mongodb::bson::Document>("course_typing_allotments");
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(AllotmentData { course_id: course_id.clone(), language_ids: vec![] })),
    };
    let doc = coll.find_one(doc! { "course_id": oid }, None).await.ok().flatten();
    let language_ids: Vec<String> = if let Some(d) = &doc {
        d.get_array("language_ids")
            .ok()
            .map(|arr| arr.iter().filter_map(|v| v.as_object_id().map(|o| o.to_hex())).collect())
            .unwrap_or_default()
    } else {
        vec![]
    };
    (StatusCode::OK, Json(AllotmentData { course_id, language_ids }))
}

pub async fn set_course_typing_allotment(
    State(db): State<Database>,
    claims: Claims,
    Path(course_id): Path<String>,
    Json(payload): Json<SetAllotmentRequest>,
) -> (StatusCode, Json<AllotmentResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(AllotmentResponse { success: false, message: "Unauthorized".to_string() }));
    }
    let course_oid = match ObjectId::parse_str(&course_id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(AllotmentResponse { success: false, message: "Invalid course ID".to_string() })),
    };
    let mut lang_oids = Vec::new();
    for id in &payload.language_ids {
        if let Ok(oid) = ObjectId::parse_str(id) {
            lang_oids.push(oid);
        }
    }
    let coll = db.collection::<mongodb::bson::Document>("course_typing_allotments");
    let filter = doc! { "course_id": course_oid };
    let update = doc! {
        "$set": {
            "course_id": course_oid,
            "language_ids": lang_oids,
            "updated_at": chrono::Utc::now()
        }
    };
    match coll.update_one(filter, update, mongodb::options::UpdateOptions::builder().upsert(true).build()).await {
        Ok(_) => (StatusCode::OK, Json(AllotmentResponse { success: true, message: "Allotment updated".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(AllotmentResponse { success: false, message: "Update failed".to_string() })),
    }
}
