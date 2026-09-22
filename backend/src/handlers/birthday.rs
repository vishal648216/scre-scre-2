use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use mongodb::{
    bson::{doc, oid::ObjectId},
    Database,
};
use chrono::{Utc, Duration, Datelike};
use futures_util::StreamExt;
use serde_json::json;

use crate::models::{
    user::{User, UserRole, Claims},
    birthday::{BirthdayRecord, BirthdayWish, SendBirthdayWishRequest, BirthdayGreeting},
    message::Message,
};

/// Helper to format date in IST
fn get_ist_now() -> (chrono::DateTime<Utc>, u32, u32, String) {
    let ist = Utc::now() + Duration::hours(5) + Duration::minutes(30);
    let month = ist.month();
    let day = ist.day();
    let date_str = format!("{:04}-{:02}-{:02}", ist.year(), month, day);
    (ist, month, day, date_str)
}

/// Matches user's dob string with today's day and month
fn matches_today_birthday(dob_opt: &Option<String>, target_day: u32, target_month: u32) -> bool {
    if let Some(dob) = dob_opt {
        let cleaned = dob.trim().replace('/', "-");
        let parts: Vec<&str> = cleaned.split('-').collect();
        if parts.len() == 3 {
            // Check YYYY-MM-DD
            if let (Ok(m), Ok(d)) = (parts[1].parse::<u32>(), parts[2].parse::<u32>()) {
                if m == target_month && d == target_day {
                    return true;
                }
            }
            // Check DD-MM-YYYY
            if let (Ok(d), Ok(m)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
                if m == target_month && d == target_day {
                    return true;
                }
            }
        }
    }
    false
}

/// GET /api/birthdays/today
pub async fn get_today_birthdays(
    State(db): State<Database>,
    claims: Claims,
) -> Result<impl IntoResponse, StatusCode> {
    let (_, target_month, target_day, today_str) = get_ist_now();
    let users_col = db.collection::<User>("users");
    let wishes_col = db.collection::<BirthdayWish>("birthday_wishes");

    let mut filter = doc! {
        "is_deleted": { "$ne": true },
        "dob": { "$exists": true, "$ne": null }
    };

    let user_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(o) => o,
        Err(_) => return Err(StatusCode::UNAUTHORIZED),
    };

    // Centers only see their affiliated students and staff
    if claims.role == UserRole::Center {
        filter.insert("parent_id", user_oid);
    }

    let mut cursor = users_col.find(filter, None).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut matching_users: Vec<User> = Vec::new();

    while let Some(Ok(user)) = cursor.next().await {
        if matches_today_birthday(&user.dob, target_day, target_month) {
            matching_users.push(user);
        }
    }

    let mut records: Vec<BirthdayRecord> = Vec::new();

    for u in matching_users {
        let u_id = match u.id {
            Some(id) => id,
            None => continue,
        };

        // Check if wished today
        let wish_filter = doc! {
            "user_id": u_id,
            "date": &today_str,
        };
        let existing_wish = wishes_col.find_one(wish_filter, None).await.ok().flatten();

        let center_name = if let Some(pid) = u.parent_id {
            if let Ok(Some(parent_user)) = users_col.find_one(doc! { "_id": pid }, None).await {
                parent_user.full_name.clone().or_else(|| Some(parent_user.username.clone()))
            } else {
                None
            }
        } else {
            None
        };

        records.push(BirthdayRecord {
            user_id: u_id.to_hex(),
            name: u.full_name.clone().unwrap_or_else(|| u.username.clone()),
            role: u.role,
            dob: u.dob.unwrap_or_default(),
            course_or_designation: u.course,
            center_id: u.parent_id.map(|id| id.to_hex()),
            center_name,
            email: u.email,
            phone: u.phone,
            has_wished_today: existing_wish.is_some(),
            wished_at: existing_wish.map(|w| w.created_at),
        });
    }

    Ok(Json(json!({
        "success": true,
        "date": today_str,
        "count": records.len(),
        "birthdays": records
    })))
}

/// POST /api/birthdays/send-wish
pub async fn send_birthday_wish(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<SendBirthdayWishRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let target_oid = ObjectId::parse_str(&payload.user_id).map_err(|_| StatusCode::BAD_REQUEST)?;
    let sender_oid = ObjectId::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let users_col = db.collection::<User>("users");
    let target_user = users_col.find_one(doc! { "_id": target_oid }, None).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let sender_user = users_col.find_one(doc! { "_id": sender_oid }, None).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let (_, _, _, today_str) = get_ist_now();
    let wishes_col = db.collection::<BirthdayWish>("birthday_wishes");

    let recipient_name = target_user.full_name.clone().unwrap_or_else(|| target_user.username.clone());
    let sender_display_name = sender_user.full_name.clone().unwrap_or_else(|| sender_user.username.clone());

    let message_text = payload.custom_message.unwrap_or_else(|| {
        format!(
            "🎂 Happy Birthday {}! Wishing you a joyous day filled with success, prosperity, and great learning achievements from everyone at SCRE Academy!",
            recipient_name
        )
    });

    let new_wish = BirthdayWish {
        id: None,
        user_id: target_oid,
        sender_id: sender_oid,
        sender_name: sender_display_name.clone(),
        sender_role: claims.role.clone(),
        message: message_text.clone(),
        date: today_str,
        created_at: Utc::now(),
    };

    wishes_col.insert_one(new_wish, None).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Also send an in-app Message to their inbox
    let messages_col = db.collection::<Message>("messages");
    let in_app_msg = Message {
        id: None,
        sender_id: sender_oid,
        sender_role: claims.role,
        recipient_id: target_oid,
        recipient_role: target_user.role,
        content: message_text,
        created_at: Utc::now(),
        is_read: false,
    };
    let _ = messages_col.insert_one(in_app_msg, None).await;

    Ok(Json(json!({
        "success": true,
        "message": format!("Birthday wish successfully sent to {}", recipient_name)
    })))
}

/// GET /api/birthdays/my-wish (For student/staff logged in)
pub async fn get_my_birthday_wish(
    State(db): State<Database>,
    claims: Claims,
) -> Result<impl IntoResponse, StatusCode> {
    let user_oid = ObjectId::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let users_col = db.collection::<User>("users");
    let wishes_col = db.collection::<BirthdayWish>("birthday_wishes");

    let user = users_col.find_one(doc! { "_id": user_oid }, None).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let (_, target_month, target_day, today_str) = get_ist_now();
    let is_birthday = matches_today_birthday(&user.dob, target_day, target_month);

    let user_name = user.full_name.clone().unwrap_or_else(|| user.username.clone());

    if !is_birthday {
        return Ok(Json(BirthdayGreeting {
            is_birthday_today: false,
            name: user_name,
            message: String::new(),
            wishes_received: Vec::new(),
        }));
    }

    // Fetch all wishes received today
    let mut cursor = wishes_col.find(doc! { "user_id": user_oid, "date": &today_str }, None).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut wishes_received = Vec::new();
    while let Some(Ok(w)) = cursor.next().await {
        wishes_received.push(format!("{}: \"{}\"", w.sender_name, w.message));
    }

    let default_message = format!(
        "🎉 Happy Birthday, {}! 🎂 The entire SCRE Education family wishes you happiness, knowledge, and high achievements in your future!",
        user_name
    );

    Ok(Json(BirthdayGreeting {
        is_birthday_today: true,
        name: user_name,
        message: default_message,
        wishes_received,
    }))
}
