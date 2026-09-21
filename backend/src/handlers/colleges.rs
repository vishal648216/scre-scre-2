use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use chrono::Utc;
use futures_util::StreamExt;
use mongodb::{
    Database,
    bson::{doc, oid::ObjectId},
};
use serde::{Deserialize, Serialize};

use crate::models::college::College;
use crate::models::user::{Claims, UserRole};

#[derive(Debug, Deserialize)]
pub struct CreateCollegeRequest {
    pub name: String,
    pub country_id: Option<String>,
    pub state_id: Option<String>,
    pub district_id: Option<String>,
    pub city_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCollegeRequest {
    pub name: Option<String>,
    pub country_id: Option<String>,
    pub state_id: Option<String>,
    pub district_id: Option<String>,
    pub city_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct OkMsg {
    pub success: bool,
    pub message: String,
    pub id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListCollegesQuery {
    pub search: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CollegeDto {
    pub _id: String,
    pub name: String,
    pub country_id: Option<String>,
    pub state_id: Option<String>,
    pub district_id: Option<String>,
    pub city_id: Option<String>,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: Option<chrono::DateTime<Utc>>,
}

pub async fn list_colleges(
    State(db): State<Database>,
    Query(q): Query<ListCollegesQuery>,
) -> (StatusCode, Json<Vec<CollegeDto>>) {
    let coll = db.collection::<College>("colleges");
    let mut filter = doc! {};
    
    if let Some(search) = q.search {
        filter = doc! {
            "$or": [
                { "name": { "$regex": &search, "$options": "i" } }
            ]
        };
    }

    let mut cursor = match coll.find(filter, None).await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Error finding colleges: {:?}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![]));
        }
    };

    let mut results = vec![];
    while let Some(result) = cursor.next().await {
        match result {
            Ok(college) => {
                results.push(CollegeDto {
                    _id: college.id.unwrap().to_hex(),
                    name: college.name,
                    country_id: college.country_id.map(|id| id.to_hex()),
                    state_id: college.state_id.map(|id| id.to_hex()),
                    district_id: college.district_id.map(|id| id.to_hex()),
                    city_id: college.city_id.map(|id| id.to_hex()),
                    created_at: college.created_at,
                    updated_at: college.updated_at,
                });
            }
            Err(e) => {
                eprintln!("Error deserializing college document: {:?}", e);
            }
        }
    }

    (StatusCode::OK, Json(results))
}

pub async fn create_college(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateCollegeRequest>,
) -> (StatusCode, Json<OkMsg>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(OkMsg {
                success: false,
                message: "Unauthorized".into(),
                id: None,
            }),
        );
    }

    let coll = db.collection::<College>("colleges");
    
    let college = College {
        id: None,
        name: payload.name,
        country_id: payload.country_id.and_then(|s| ObjectId::parse_str(&s).ok()),
        state_id: payload.state_id.and_then(|s| ObjectId::parse_str(&s).ok()),
        district_id: payload.district_id.and_then(|s| ObjectId::parse_str(&s).ok()),
        city_id: payload.city_id.and_then(|s| ObjectId::parse_str(&s).ok()),
        created_at: Utc::now(),
        updated_at: None,
    };

    match coll.insert_one(college, None).await {
        Ok(r) => (
            StatusCode::OK,
            Json(OkMsg {
                success: true,
                message: "College created successfully".into(),
                id: r.inserted_id.as_object_id().map(|id| id.to_hex()),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(OkMsg {
                success: false,
                message: "Failed to create college".into(),
                id: None,
            }),
        ),
    }
}

pub async fn update_college(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<UpdateCollegeRequest>,
) -> (StatusCode, Json<OkMsg>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(OkMsg {
                success: false,
                message: "Unauthorized".into(),
                id: None,
            }),
        );
    }

    let coll = db.collection::<College>("colleges");
    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(OkMsg {
                    success: false,
                    message: "Invalid ID".into(),
                    id: None,
                }),
            );
        }
    };

    let mut update_doc = doc! {};
    if let Some(name) = payload.name {
        update_doc.insert("name", name);
    }
    // Only update location fields if they are present in payload
    if let Some(country_id) = payload.country_id {
        if !country_id.is_empty() {
            if let Ok(oid) = ObjectId::parse_str(&country_id) {
                update_doc.insert("country_id", oid);
            }
        } else {
            update_doc.insert("country_id", None::<ObjectId>);
        }
    }
    if let Some(state_id) = payload.state_id {
        if !state_id.is_empty() {
            if let Ok(oid) = ObjectId::parse_str(&state_id) {
                update_doc.insert("state_id", oid);
            }
        } else {
            update_doc.insert("state_id", None::<ObjectId>);
        }
    }
    if let Some(district_id) = payload.district_id {
        if !district_id.is_empty() {
            if let Ok(oid) = ObjectId::parse_str(&district_id) {
                update_doc.insert("district_id", oid);
            }
        } else {
            update_doc.insert("district_id", None::<ObjectId>);
        }
    }
    if let Some(city_id) = payload.city_id {
        if !city_id.is_empty() {
            if let Ok(oid) = ObjectId::parse_str(&city_id) {
                update_doc.insert("city_id", oid);
            }
        } else {
            update_doc.insert("city_id", None::<ObjectId>);
        }
    }
    update_doc.insert("updated_at", Utc::now());

    match coll
        .update_one(doc! { "_id": oid }, doc! { "$set": update_doc }, None)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(OkMsg {
                success: true,
                message: "College updated successfully".into(),
                id: Some(id),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(OkMsg {
                success: false,
                message: "Failed to update college".into(),
                id: None,
            }),
        ),
    }
}

pub async fn delete_college(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<OkMsg>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(OkMsg {
                success: false,
                message: "Unauthorized".into(),
                id: None,
            }),
        );
    }

    let coll = db.collection::<College>("colleges");
    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(OkMsg {
                    success: false,
                    message: "Invalid ID".into(),
                    id: None,
                }),
            );
        }
    };

    match coll.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => (
            StatusCode::OK,
            Json(OkMsg {
                success: true,
                message: "College deleted successfully".into(),
                id: Some(id),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(OkMsg {
                success: false,
                message: "Failed to delete college".into(),
                id: None,
            }),
        ),
    }
}

pub async fn public_list_colleges(
    State(db): State<Database>,
) -> (StatusCode, Json<Vec<CollegeDto>>) {
    let coll = db.collection::<College>("colleges");

    let mut cursor = match coll.find(doc! {}, None).await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Error finding colleges: {:?}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![]));
        }
    };

    let mut results = vec![];
    while let Some(result) = cursor.next().await {
        match result {
            Ok(college) => {
                results.push(CollegeDto {
                    _id: college.id.unwrap().to_hex(),
                    name: college.name,
                    country_id: college.country_id.map(|id| id.to_hex()),
                    state_id: college.state_id.map(|id| id.to_hex()),
                    district_id: college.district_id.map(|id| id.to_hex()),
                    city_id: college.city_id.map(|id| id.to_hex()),
                    created_at: college.created_at,
                    updated_at: college.updated_at,
                });
            }
            Err(e) => {
                eprintln!("Error deserializing college document: {:?}", e);
            }
        }
    }

    (StatusCode::OK, Json(results))
}
