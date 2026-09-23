use axum::{extract::{State, Path}, http::StatusCode, Json};
use mongodb::{Database, bson::{doc, oid::ObjectId}};
use serde::{Deserialize, Serialize};
use crate::models::user::{User, UserRole, Claims};
use crate::models::message::Message;
use crate::models::system_settings::SystemSettings;
use chrono::Utc;
use futures_util::stream::StreamExt;

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub recipient_id: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub success: bool,
    pub message: String,
}

pub async fn send_message(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<SendMessageRequest>,
) -> (StatusCode, Json<MessageResponse>) {
    let sender_id = ObjectId::parse_str(&claims.sub).unwrap();
    let recipient_id = match ObjectId::parse_str(&payload.recipient_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(MessageResponse { success: false, message: "Invalid recipient ID".to_string() })),
    };

    let user_collection = db.collection::<User>("users");
    let sender = user_collection.find_one(doc! { "_id": sender_id }, None).await.unwrap().unwrap();
    let recipient = match user_collection.find_one(doc! { "_id": recipient_id }, None).await {
        Ok(Some(u)) => u,
        _ => return (StatusCode::NOT_FOUND, Json(MessageResponse { success: false, message: "Recipient not found".to_string() })),
    };

    // Fetch system settings for the "Wall" toggle
    let settings_coll = db.collection::<SystemSettings>("system_settings");
    let settings = settings_coll.find_one(None, None).await.unwrap_or(None).unwrap_or_default();

    // --- BRICKWORK SECURITY ---
    let can_message = if settings.is_messaging_wall_enabled {
        match (claims.role.clone(), recipient.role.clone()) {
            (UserRole::Center, UserRole::Admin) | (UserRole::Center, UserRole::SuperAdmin) => true,
            (UserRole::Admin, UserRole::Center) | (UserRole::SuperAdmin, UserRole::Center) => true,
            (UserRole::Student, UserRole::Center) => sender.parent_id == Some(recipient_id),
            (UserRole::Center, UserRole::Student) => recipient.parent_id == Some(sender_id),
            (UserRole::Student, UserRole::Student) => sender.parent_id == recipient.parent_id && sender.parent_id.is_some(),
            _ => false,
        }
    } else {
        // If wall is disabled, allow Student <-> Student across centers
        match (claims.role.clone(), recipient.role.clone()) {
            (UserRole::Student, UserRole::Student) => true,
            _ => {
                // Keep standard isolation for other roles
                match (claims.role.clone(), recipient.role.clone()) {
                    (UserRole::Center, UserRole::Admin) | (UserRole::Center, UserRole::SuperAdmin) => true,
                    (UserRole::Admin, UserRole::Center) | (UserRole::SuperAdmin, UserRole::Center) => true,
                    (UserRole::Student, UserRole::Center) => sender.parent_id == Some(recipient_id),
                    (UserRole::Center, UserRole::Student) => recipient.parent_id == Some(sender_id),
                    _ => false,
                }
            }
        }
    };

    if !can_message {
        return (StatusCode::FORBIDDEN, Json(MessageResponse { success: false, message: "Messaging isolation is active. You can only chat within your center boundary.".to_string() }));
    }

    let message_collection = db.collection::<Message>("messages");
    let new_message = Message {
        id: None,
        sender_id,
        sender_role: claims.role,
        recipient_id,
        recipient_role: recipient.role,
        content: payload.content,
        created_at: Utc::now(),
        is_read: false,
    };

    match message_collection.insert_one(new_message, None).await {
        Ok(_) => (StatusCode::CREATED, Json(MessageResponse { success: true, message: "Message sent".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(MessageResponse { success: false, message: "Failed to send message".to_string() })),
    }
}

pub async fn get_messages(
    State(db): State<Database>,
    claims: Claims,
    Path(other_id): Path<String>,
) -> (StatusCode, Json<Vec<Message>>) {
    let user_id = ObjectId::parse_str(&claims.sub).unwrap();
    let other_id = match ObjectId::parse_str(&other_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
    };

    let collection = db.collection::<Message>("messages");
    let filter = doc! {
        "$or": [
            { "sender_id": user_id, "recipient_id": other_id },
            { "sender_id": other_id, "recipient_id": user_id }
        ]
    };

    let mut cursor = match collection.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut messages = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(msg) = result {
            messages.push(msg);
        }
    }
    (StatusCode::OK, Json(messages))
}

pub async fn find_user_by_username(
    State(db): State<Database>,
    Path(username): Path<String>,
) -> (StatusCode, Json<Option<User>>) {
    let collection = db.collection::<User>("users");
    let filter = doc! { 
        "username": { "$regex": format!("^{}$", username), "$options": "i" },
        "is_deleted": { "$ne": true }
    };
    match collection.find_one(filter, None).await {
        Ok(user) => (StatusCode::OK, Json(user)),
        _ => (StatusCode::NOT_FOUND, Json(None)),
    }
}

pub async fn get_recent_chats(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<User>>) {
    let user_id = ObjectId::parse_str(&claims.sub).unwrap();
    let message_collection = db.collection::<Message>("messages");
    
    // Find unique user IDs that the current user has messaged or received messages from
    let filter = doc! {
        "$or": [
            { "sender_id": user_id },
            { "recipient_id": user_id }
        ]
    };
    
    let mut cursor = match message_collection.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut partner_ids = std::collections::HashSet::new();
    while let Some(result) = cursor.next().await {
        if let Ok(msg) = result {
            if msg.sender_id != user_id {
                partner_ids.insert(msg.sender_id);
            }
            if msg.recipient_id != user_id {
                partner_ids.insert(msg.recipient_id);
            }
        }
    }

    if partner_ids.is_empty() {
        return (StatusCode::OK, Json(Vec::new()));
    }

    let user_collection = db.collection::<User>("users");
    let user_filter = doc! { "_id": { "$in": partner_ids.into_iter().collect::<Vec<_>>() } };
    let mut user_cursor = match user_collection.find(user_filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut users = Vec::new();
    while let Some(result) = user_cursor.next().await {
        if let Ok(user) = result {
            users.push(user);
        }
    }

    (StatusCode::OK, Json(users))
}
