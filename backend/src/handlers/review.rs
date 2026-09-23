use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use futures_util::TryStreamExt;
use mongodb::{
    bson::{doc, oid::ObjectId},
    Database,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::models::{
    review::Review,
    user::{Claims, UserRole, User},
};

#[derive(Debug, Deserialize)]
pub struct CreateReviewRequest {
    pub rating: i32,
    pub comment: String,
}

#[derive(Debug, Serialize)]
pub struct ReviewResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct PublicReview {
    /// Stable but non-enumerable public identifier (hashed).
    pub public_id: String,
    pub student_name: String,
    pub student_photo: Option<String>,
    pub rating: i32,
    pub comment: String,
}

fn hash_public_id(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    let out = hex::encode(hasher.finalize());
    out[..16.min(out.len())].to_string()
}

pub async fn submit_review(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateReviewRequest>,
) -> (StatusCode, Json<ReviewResponse>) {
    if claims.role != UserRole::Student {
        return (StatusCode::FORBIDDEN, Json(ReviewResponse { success: false, message: "Only students can submit reviews".to_string() }));
    }

    if payload.comment.len() > 300 {
        return (StatusCode::BAD_REQUEST, Json(ReviewResponse { success: false, message: "Review must be 300 characters or less".to_string() }));
    }

    let student_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::UNAUTHORIZED, Json(ReviewResponse { success: false, message: "Invalid student ID".to_string() })),
    };
    
    let user_coll = db.collection::<User>("users");
    
    let student = match user_coll.find_one(doc! { "_id": student_oid }, None).await {
        Ok(Some(u)) => u,
        _ => return (StatusCode::NOT_FOUND, Json(ReviewResponse { success: false, message: "Student not found".to_string() })),
    };

    let review_coll = db.collection::<Review>("reviews");
    
    // Check if student already submitted a review
    if let Ok(Some(_)) = review_coll.find_one(doc! { "student_id": student_oid }, None).await {
        return (StatusCode::CONFLICT, Json(ReviewResponse { success: false, message: "You have already submitted a review".to_string() }));
    }

    let new_review = Review {
        id: None,
        student_id: student_oid,
        student_name: student.full_name.clone().unwrap_or(student.username.clone()),
        student_photo: student.photo_url.clone(),
        rating: payload.rating,
        comment: payload.comment,
        status: "pending".to_string(),
        created_at: Utc::now(),
    };

    match review_coll.insert_one(new_review, None).await {
        Ok(_) => (StatusCode::CREATED, Json(ReviewResponse { success: true, message: "Review submitted for approval".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(ReviewResponse { success: false, message: "Failed to submit review".to_string() })),
    }
}

pub async fn get_public_reviews(
    State(db): State<Database>,
) -> (StatusCode, Json<Vec<PublicReview>>) {
    let review_coll = db.collection::<Review>("reviews");
    let filter = doc! { "status": "approved" };
    
    let mut cursor = match review_coll.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut reviews = Vec::new();
    while let Ok(Some(review)) = cursor.try_next().await {
        let id_str = review.id.map(|oid| oid.to_hex()).unwrap_or_else(|| review.student_name.clone());
        reviews.push(PublicReview {
            public_id: hash_public_id(&id_str),
            student_name: review.student_name,
            student_photo: review.student_photo,
            rating: review.rating,
            comment: review.comment,
        });
    }

    (StatusCode::OK, Json(reviews))
}

pub async fn get_all_reviews(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<Review>>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(vec![]));
    }

    let review_coll = db.collection::<Review>("reviews");
    let mut cursor = match review_coll.find(None, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut reviews = Vec::new();
    while let Ok(Some(review)) = cursor.try_next().await {
        reviews.push(review);
    }

    (StatusCode::OK, Json(reviews))
}

pub async fn update_review_status(
    State(db): State<Database>,
    claims: Claims,
    Path((id, status)): Path<(String, String)>,
) -> (StatusCode, Json<ReviewResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(ReviewResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let review_oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(ReviewResponse { success: false, message: "Invalid review ID".to_string() })),
    };

    let review_coll = db.collection::<Review>("reviews");
    let filter = doc! { "_id": review_oid };
    let update = doc! { "$set": { "status": status } };

    match review_coll.update_one(filter, update, None).await {
        Ok(_) => (StatusCode::OK, Json(ReviewResponse { success: true, message: "Review status updated".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(ReviewResponse { success: false, message: "Failed to update review status".to_string() })),
    }
}

pub async fn delete_review(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<ReviewResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(ReviewResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let review_oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(ReviewResponse { success: false, message: "Invalid review ID".to_string() })),
    };

    let review_coll = db.collection::<Review>("reviews");
    match review_coll.delete_one(doc! { "_id": review_oid }, None).await {
        Ok(_) => (StatusCode::OK, Json(ReviewResponse { success: true, message: "Review deleted".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(ReviewResponse { success: false, message: "Failed to delete review".to_string() })),
    }
}
