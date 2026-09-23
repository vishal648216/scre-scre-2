use axum::{
    extract::State,
    Json,
    http::StatusCode,
};
use mongodb::Database;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct Inquiry {
    pub center: String,
    pub name: String,
    pub email: String,
    pub message: String,
}

pub async fn handle_create_inquiry(
    State(db): State<Database>,
    Json(inquiry): Json<Inquiry>,
) -> Result<Json<Inquiry>, StatusCode> {
    let collection = db.collection::<Inquiry>("inquiries");
    let result = collection.insert_one(inquiry.clone(), None).await;
    match result {
        Ok(_) => Ok(Json(inquiry)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}
