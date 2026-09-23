use axum::{extract::{State, Path}, http::StatusCode, Json};
use mongodb::{Database, bson::{doc, oid::ObjectId}};
use crate::models::user::{UserRole, Claims};
use crate::models::product::Product;
use futures_util::StreamExt;
use serde_json::json;

pub async fn create_product(
    State(db): State<Database>,
    claims: Claims,
    Json(mut payload): Json<Product>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(json!({"success": false, "message": "Unauthorized"})));
    }

    let collection = db.collection::<Product>("products");
    payload.created_by = claims.username.clone();
    payload.created_at = chrono::Utc::now();
    payload.status = "active".to_string();

    match collection.insert_one(payload, None).await {
        Ok(_) => (StatusCode::CREATED, Json(json!({"success": true, "message": "Product created successfully"}))),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "message": e.to_string()}))),
    }
}

pub async fn get_products(
    State(db): State<Database>,
) -> (StatusCode, Json<Vec<Product>>) {
    let collection = db.collection::<Product>("products");
    let mut cursor = match collection.find(doc! { "status": "active" }, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut products = Vec::new();
    while let Some(Ok(product)) = cursor.next().await {
        products.push(product);
    }

    (StatusCode::OK, Json(products))
}

pub async fn admin_list_products(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<Product>>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(vec![]));
    }

    let collection = db.collection::<Product>("products");
    let mut cursor = match collection.find(None, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut products = Vec::new();
    while let Some(Ok(product)) = cursor.next().await {
        products.push(product);
    }

    (StatusCode::OK, Json(products))
}

pub async fn update_product(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<Product>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(json!({"success": false, "message": "Unauthorized"})));
    }

    let obj_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(json!({"success": false, "message": "Invalid ID"}))),
    };

    let collection = db.collection::<Product>("products");
    let update = doc! {
        "$set": {
            "name": payload.name,
            "description": payload.description,
            "price": payload.price,
            "image_url": payload.image_url,
            "category": payload.category,
            "status": payload.status,
        }
    };

    match collection.update_one(doc! { "_id": obj_id }, update, None).await {
        Ok(_) => (StatusCode::OK, Json(json!({"success": true, "message": "Product updated"}))),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "message": e.to_string()}))),
    }
}

pub async fn delete_product(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(json!({"success": false, "message": "Unauthorized"})));
    }

    let obj_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(json!({"success": false, "message": "Invalid ID"}))),
    };

    let collection = db.collection::<Product>("products");
    match collection.delete_one(doc! { "_id": obj_id }, None).await {
        Ok(_) => (StatusCode::OK, Json(json!({"success": true, "message": "Product deleted"}))),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "message": e.to_string()}))),
    }
}
