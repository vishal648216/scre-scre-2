use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use mongodb::{Database, bson::doc};
use serde::{Deserialize, Serialize};
use chrono::Utc;
use crate::models::user::{UserRole, Claims};
use crate::models::admin_assets::AdminAssets;

#[derive(Debug, Deserialize)]
pub struct SetAdminAssetsRequest {
    pub signature_url: Option<String>,
    pub stamp_url: Option<String>,
    pub background_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AdminAssetsResponse {
    pub success: bool,
    pub message: String,
}

pub async fn set_admin_assets(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<SetAdminAssetsRequest>,
) -> (StatusCode, Json<AdminAssetsResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(AdminAssetsResponse {
            success: false,
            message: "Unauthorized".to_string(),
        }));
    }

    let coll = db.collection::<AdminAssets>("admin_assets");
    let admin_id = mongodb::bson::oid::ObjectId::parse_str(&claims.sub).unwrap();

    let _ = coll
        .update_one(
            doc! { "admin_id": &admin_id },
            doc! { "$set": {
                "signature_url": payload.signature_url.clone(),
                "stamp_url": payload.stamp_url.clone(),
                "background_url": payload.background_url.clone(),
                "updated_at": Utc::now(),
            }},
            Some(mongodb::options::UpdateOptions::builder().upsert(true).build()),
        )
        .await;

    (
        StatusCode::OK,
        Json(AdminAssetsResponse {
            success: true,
            message: "Admin assets updated".to_string(),
        }),
    )
}

pub async fn get_admin_assets(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Option<AdminAssets>>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(None));
    }

    let coll = db.collection::<AdminAssets>("admin_assets");
    let admin_id = mongodb::bson::oid::ObjectId::parse_str(&claims.sub).unwrap();
    let doc: Option<AdminAssets> = coll
        .find_one(doc! { "admin_id": &admin_id }, None)
        .await
        .ok()
        .flatten();

    (StatusCode::OK, Json(doc))
}

