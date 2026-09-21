use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use chrono::Utc;
use futures_util::stream::StreamExt;
use mongodb::{
    Database,
    bson::{doc, oid::ObjectId},
};
use serde::{Deserialize, Serialize};

use crate::models::center_draft::CenterDraft;
use crate::models::user::{Claims, UserRole};

#[derive(Debug, Deserialize)]
pub struct CreateDraftRequest {
    pub id: Option<String>,
    pub name: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct DraftResponse {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub draft_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DraftListItem {
    pub id: String,
    pub name: String,
    pub updated_at: String,
}

pub async fn save_draft(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateDraftRequest>,
) -> (StatusCode, Json<DraftResponse>) {
    println!(
        "DEBUG: save_draft called by user: {}, role: {:?}, name: {:?}",
        claims.sub, claims.role, payload.name
    );

    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        println!("DEBUG: save_draft unauthorized role: {:?}", claims.role);
        return (
            StatusCode::FORBIDDEN,
            Json(DraftResponse {
                success: false,
                message: "Unauthorized".to_string(),
                draft_id: None,
            }),
        );
    }

    let admin_id = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(e) => {
            println!(
                "DEBUG: save_draft invalid admin_id: {}, error: {}",
                claims.sub, e
            );
            return (
                StatusCode::BAD_REQUEST,
                Json(DraftResponse {
                    success: false,
                    message: "Invalid admin ID".to_string(),
                    draft_id: None,
                }),
            );
        }
    };

    let coll = db.collection::<CenterDraft>("center_drafts");
    let now = Utc::now();

    // 1. Try to find by ID if provided
    let existing = if let Some(id_str) = &payload.id {
        if let Ok(oid) = ObjectId::parse_str(id_str) {
            coll.find_one(doc! { "_id": oid, "admin_id": admin_id }, None)
                .await
                .ok()
                .flatten()
        } else {
            None
        }
    } else {
        // 2. Fallback to finding by name for this admin
        coll.find_one(doc! { "admin_id": admin_id, "name": &payload.name }, None)
            .await
            .ok()
            .flatten()
    };

    if let Some(mut draft) = existing {
        println!("DEBUG: save_draft found existing draft: {:?}", draft.id);
        draft.name = payload.name; // Update name too if changed
        draft.data = payload.data;
        draft.updated_at = now;
        let id = draft.id.unwrap();
        match coll.replace_one(doc! { "_id": id }, draft, None).await {
            Ok(_) => {
                println!(
                    "DEBUG: save_draft replace_one success for id: {}",
                    id.to_hex()
                );
                (
                    StatusCode::OK,
                    Json(DraftResponse {
                        success: true,
                        message: "Draft updated".to_string(),
                        draft_id: Some(id.to_hex()),
                    }),
                )
            }
            Err(e) => {
                println!("DEBUG: save_draft replace_one failed: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(DraftResponse {
                        success: false,
                        message: "Update failed".to_string(),
                        draft_id: None,
                    }),
                )
            }
        }
    } else {
        println!("DEBUG: save_draft creating new draft");
        let draft = CenterDraft {
            id: None,
            admin_id: admin_id,
            name: payload.name,
            data: payload.data,
            created_at: now,
            updated_at: now,
        };
        match coll.insert_one(draft, None).await {
            Ok(res) => {
                let id = res.inserted_id.as_object_id().map(|o| o.to_hex());
                println!("DEBUG: save_draft insert_one success, new id: {:?}", id);
                (
                    StatusCode::CREATED,
                    Json(DraftResponse {
                        success: true,
                        message: "Draft saved".to_string(),
                        draft_id: id,
                    }),
                )
            }
            Err(e) => {
                println!("DEBUG: save_draft insert_one failed: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(DraftResponse {
                        success: false,
                        message: "Save failed".to_string(),
                        draft_id: None,
                    }),
                )
            }
        }
    }
}

pub async fn list_drafts(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<DraftListItem>>) {
    let admin_id = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
    };

    let coll = db.collection::<CenterDraft>("center_drafts");
    let filter = doc! { "admin_id": admin_id };
    let mut cursor = match coll.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut items = Vec::new();
    while let Some(res) = cursor.next().await {
        if let Ok(d) = res {
            items.push(DraftListItem {
                id: d.id.unwrap().to_hex(),
                name: d.name,
                updated_at: d.updated_at.to_rfc3339(),
            });
        }
    }
    (StatusCode::OK, Json(items))
}

pub async fn get_draft(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<Option<serde_json::Value>>) {
    let admin_id = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(None)),
    };

    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(None)),
    };
    let coll = db.collection::<CenterDraft>("center_drafts");
    let filter = doc! { "_id": oid, "admin_id": admin_id };
    match coll.find_one(filter, None).await {
        Ok(Some(d)) => (StatusCode::OK, Json(Some(d.data))),
        _ => (StatusCode::NOT_FOUND, Json(None)),
    }
}

pub async fn delete_draft(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<DraftResponse>) {
    let admin_id = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(DraftResponse {
                    success: false,
                    message: "Invalid admin ID".to_string(),
                    draft_id: None,
                }),
            );
        }
    };

    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(DraftResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                    draft_id: None,
                }),
            );
        }
    };
    let coll = db.collection::<CenterDraft>("center_drafts");
    let filter = doc! { "_id": oid, "admin_id": admin_id };
    match coll.delete_one(filter, None).await {
        Ok(_) => (
            StatusCode::OK,
            Json(DraftResponse {
                success: true,
                message: "Draft deleted".to_string(),
                draft_id: None,
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DraftResponse {
                success: false,
                message: "Delete failed".to_string(),
                draft_id: None,
            }),
        ),
    }
}
