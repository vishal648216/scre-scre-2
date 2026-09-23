use axum::{
    extract::{State, Query},
    http::StatusCode,
    Json,
};
use mongodb::{Database, bson::{doc, oid::ObjectId}};
use serde::{Deserialize, Serialize};
use chrono::Utc;
use crate::models::user::{UserRole, Claims};
use crate::models::center_assets::CenterAssets;

#[derive(Debug, Deserialize)]
pub struct SetAssetsRequest {
    pub center_id: Option<String>,
    pub center_name: Option<String>,
    pub signature_url: Option<String>,
    pub stamp_url: Option<String>,
    pub background_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AssetsResponse {
    pub success: bool,
    pub message: String,
}

pub async fn set_assets(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<SetAssetsRequest>,
) -> (StatusCode, Json<AssetsResponse>) {
    let coll = db.collection::<CenterAssets>("center_assets");
    let target_center = if claims.role == UserRole::Admin || claims.role == UserRole::SuperAdmin {
        match &payload.center_id {
            Some(cid) => match ObjectId::parse_str(cid) {
                Ok(oid) => oid,
                Err(_) => return (StatusCode::BAD_REQUEST, Json(AssetsResponse { success: false, message: "Invalid center_id".to_string() })),
            },
            None => return (StatusCode::BAD_REQUEST, Json(AssetsResponse { success: false, message: "center_id required".to_string() })),
        }
    } else {
        return (StatusCode::FORBIDDEN, Json(AssetsResponse { success: false, message: "Only admin can update center assets".to_string() }));
    };

    let _ = coll.update_one(
        doc! { "center_id": &target_center },
        doc! { "$set": {
            "center_name": payload.center_name.clone(),
            "signature_url": payload.signature_url.clone(),
            "stamp_url": payload.stamp_url.clone(),
            "background_url": payload.background_url.clone(),
            "updated_at": Utc::now(),
        }},
        Some(mongodb::options::UpdateOptions::builder().upsert(true).build()),
    ).await;

    (StatusCode::OK, Json(AssetsResponse { success: true, message: "Assets updated".to_string() }))
}

#[derive(Debug, Deserialize)]
pub struct GetAssetsQuery {
    pub center_id: Option<String>,
}

pub async fn get_assets(
    State(db): State<Database>,
    claims: Claims,
    Query(params): Query<GetAssetsQuery>,
) -> (StatusCode, Json<Option<CenterAssets>>) {
    let coll = db.collection::<CenterAssets>("center_assets");
    let query_center = if claims.role == UserRole::Center {
        ObjectId::parse_str(&claims.sub).unwrap()
    } else if claims.role == UserRole::Admin || claims.role == UserRole::SuperAdmin {
        match &params.center_id {
            Some(cid) => match ObjectId::parse_str(cid) {
                Ok(oid) => oid,
                Err(_) => return (StatusCode::BAD_REQUEST, Json(None)),
            },
            None => return (StatusCode::BAD_REQUEST, Json(None)),
        }
    } else {
        return (StatusCode::FORBIDDEN, Json(None));
    };
    let doc: Option<CenterAssets> = coll.find_one(doc! { "center_id": &query_center }, None).await.ok().flatten();
    (StatusCode::OK, Json(doc))
}
