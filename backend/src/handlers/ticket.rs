use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use mongodb::{
    bson::{doc, oid::ObjectId},
    Database,
};
use chrono::{Utc, Datelike};
use futures_util::StreamExt;
use serde_json::json;

use crate::models::{
    user::{User, UserRole, Claims},
    ticket::{SupportTicket, TicketReply, CreateTicketRequest, ReplyTicketRequest, UpdateTicketStatusRequest},
};

/// Generates a human-friendly ticket number: TKT-YYYY-XXXXX
async fn generate_ticket_number(db: &Database) -> String {
    let year = Utc::now().year();
    let col = db.collection::<SupportTicket>("support_tickets");
    let count = col.count_documents(None, None).await.unwrap_or(0);
    format!("TKT-{}-{:05}", year, count + 101)
}

/// POST /api/tickets - Create new support ticket
pub async fn create_ticket(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateTicketRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let user_oid = ObjectId::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let users_col = db.collection::<User>("users");
    let user = users_col.find_one(doc! { "_id": user_oid }, None).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let (student_id, student_name, student_roll_no, center_id, center_name) = match claims.role {
        UserRole::Student => {
            let s_name = user.full_name.clone().unwrap_or_else(|| user.username.clone());
            let roll = user.enrollment_number.clone().or(user.roll_number.clone());
            let c_id = user.parent_id;
            let mut c_name = None;
            if let Some(pid) = c_id {
                if let Ok(Some(cu)) = users_col.find_one(doc! { "_id": pid }, None).await {
                    c_name = cu.full_name.or_else(|| Some(cu.username));
                }
            }
            (user_oid, s_name, roll, c_id, c_name)
        },
        UserRole::Center => {
            let c_name = user.full_name.clone().unwrap_or_else(|| user.username.clone());
            (user_oid, c_name.clone(), None, Some(user_oid), Some(c_name))
        },
        _ => {
            let admin_name = user.full_name.clone().unwrap_or_else(|| user.username.clone());
            (user_oid, admin_name, None, None, None)
        }
    };

    let ticket_num = generate_ticket_number(&db).await;
    let new_ticket = SupportTicket {
        id: None,
        ticket_number: ticket_num.clone(),
        student_id,
        student_name,
        student_roll_no,
        center_id,
        center_name,
        category: payload.category.trim().to_lowercase(),
        subject: payload.subject.trim().to_string(),
        description: payload.description.trim().to_string(),
        priority: payload.priority.unwrap_or_else(|| "medium".to_string()).to_lowercase(),
        status: "open".to_string(),
        assigned_to: None,
        replies: Vec::new(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    let col = db.collection::<SupportTicket>("support_tickets");
    let insert_res = col.insert_one(new_ticket, None).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let inserted_id = insert_res.inserted_id.as_object_id().unwrap_or(user_oid);

    Ok((StatusCode::CREATED, Json(json!({
        "success": true,
        "message": format!("Ticket {} successfully registered", ticket_num),
        "ticket_id": inserted_id.to_hex(),
        "ticket_number": ticket_num
    }))))
}

/// GET /api/tickets - List tickets with role isolation
pub async fn get_tickets(
    State(db): State<Database>,
    claims: Claims,
) -> Result<impl IntoResponse, StatusCode> {
    let user_oid = ObjectId::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let col = db.collection::<SupportTicket>("support_tickets");

    let filter = match claims.role {
        UserRole::Student => doc! { "student_id": user_oid },
        UserRole::Center => doc! {
            "$or": [
                { "center_id": user_oid },
                { "student_id": user_oid }
            ]
        },
        UserRole::Admin | UserRole::SuperAdmin | UserRole::Staff => doc! {},
        _ => doc! { "student_id": user_oid },
    };

    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "updated_at": -1 })
        .build();

    let mut cursor = col.find(filter, find_options).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut tickets = Vec::new();
    while let Some(Ok(ticket)) = cursor.next().await {
        tickets.push(ticket);
    }

    Ok(Json(json!({
        "success": true,
        "count": tickets.len(),
        "tickets": tickets
    })))
}

/// GET /api/tickets/:id - Get ticket details
pub async fn get_ticket_details(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, StatusCode> {
    let ticket_oid = ObjectId::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;
    let user_oid = ObjectId::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let col = db.collection::<SupportTicket>("support_tickets");

    let ticket = col.find_one(doc! { "_id": ticket_oid }, None).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Security Check
    let is_authorized = match claims.role {
        UserRole::Admin | UserRole::SuperAdmin | UserRole::Staff => true,
        UserRole::Center => ticket.center_id == Some(user_oid) || ticket.student_id == user_oid,
        UserRole::Student => ticket.student_id == user_oid,
        _ => false,
    };

    if !is_authorized {
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(Json(ticket))
}

/// POST /api/tickets/:id/reply - Post a reply to the ticket
pub async fn reply_ticket(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<ReplyTicketRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let ticket_oid = ObjectId::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;
    let user_oid = ObjectId::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let col = db.collection::<SupportTicket>("support_tickets");

    let ticket = col.find_one(doc! { "_id": ticket_oid }, None).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let users_col = db.collection::<User>("users");
    let sender_user = users_col.find_one(doc! { "_id": user_oid }, None).await
        .ok().flatten();
    let sender_display_name = sender_user
        .map(|u| u.full_name.clone().unwrap_or_else(|| u.username.clone()))
        .unwrap_or_else(|| format!("{:?}", claims.role));

    let reply = TicketReply {
        sender_id: user_oid,
        sender_name: sender_display_name,
        sender_role: claims.role.clone(),
        message: payload.message.trim().to_string(),
        attachments: payload.attachments.unwrap_or_default(),
        created_at: Utc::now(),
    };

    let reply_bson = mongodb::bson::to_bson(&reply).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // If staff/admin replied, update status from "open" to "in_progress" if open
    let new_status = if (claims.role == UserRole::Admin || claims.role == UserRole::SuperAdmin || claims.role == UserRole::Staff) 
        && ticket.status == "open" {
        "in_progress"
    } else {
        &ticket.status
    };

    let update_doc = doc! {
        "$push": { "replies": reply_bson },
        "$set": {
            "status": new_status,
            "updated_at": mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis())
        }
    };

    col.update_one(doc! { "_id": ticket_oid }, update_doc, None).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!({
        "success": true,
        "message": "Reply added successfully"
    })))
}

/// PUT /api/tickets/:id/status - Update ticket status & assignment
pub async fn update_ticket_status(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<UpdateTicketStatusRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    // Only Admin, SuperAdmin, Staff, or Center can change ticket status
    if claims.role == UserRole::Student {
        return Err(StatusCode::FORBIDDEN);
    }

    let ticket_oid = ObjectId::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;
    let col = db.collection::<SupportTicket>("support_tickets");

    let mut set_fields = doc! {
        "status": payload.status.to_lowercase(),
        "updated_at": mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis())
    };

    if let Some(assigned) = payload.assigned_to {
        set_fields.insert("assigned_to", assigned);
    }

    col.update_one(doc! { "_id": ticket_oid }, doc! { "$set": set_fields }, None).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!({
        "success": true,
        "message": "Ticket status updated successfully"
    })))
}
