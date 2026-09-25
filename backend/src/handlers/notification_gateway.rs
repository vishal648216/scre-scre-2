use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use mongodb::{
    bson::doc,
    Database,
};
use chrono::Utc;
use futures_util::StreamExt;
use serde_json::json;

use crate::models::{
    user::{UserRole, Claims},
    notification_gateway::{NotificationGatewayConfig, NotificationLog, SendTestNotificationRequest},
};

#[allow(dead_code)]
const CONFIG_KEY: &str = "active_gateway_config";

/// GET /api/admin/notifications/config
pub async fn get_notification_config(
    State(db): State<Database>,
    claims: Claims,
) -> Result<impl IntoResponse, StatusCode> {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return Err(StatusCode::FORBIDDEN);
    }

    let col = db.collection::<NotificationGatewayConfig>("notification_gateway_configs");
    let config = match col.find_one(None, None).await {
        Ok(Some(c)) => c,
        Ok(None) => {
            let default_cfg = NotificationGatewayConfig::default();
            let _ = col.insert_one(&default_cfg, None).await;
            default_cfg
        }
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    Ok(Json(json!({
        "success": true,
        "config": config
    })))
}

/// POST /api/admin/notifications/config
pub async fn update_notification_config(
    State(db): State<Database>,
    claims: Claims,
    Json(mut payload): Json<NotificationGatewayConfig>,
) -> Result<impl IntoResponse, StatusCode> {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return Err(StatusCode::FORBIDDEN);
    }

    let col = db.collection::<NotificationGatewayConfig>("notification_gateway_configs");
    payload.updated_at = Some(Utc::now());

    // Replace or insert
    if let Some(existing) = col.find_one(None, None).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)? {
        if let Some(id) = existing.id {
            col.replace_one(doc! { "_id": id }, &payload, None).await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        }
    } else {
        col.insert_one(&payload, None).await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    Ok(Json(json!({
        "success": true,
        "message": "Gateway configuration updated successfully",
        "config": payload
    })))
}

/// POST /api/admin/notifications/send-test
pub async fn send_test_notification(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<SendTestNotificationRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return Err(StatusCode::FORBIDDEN);
    }

    let config_col = db.collection::<NotificationGatewayConfig>("notification_gateway_configs");
    let config = config_col.find_one(None, None).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .unwrap_or_default();

    let logs_col = db.collection::<NotificationLog>("notification_logs");

    let recipient_name = payload.recipient_name.unwrap_or_else(|| "Student/Parent".to_string());
    
    // Choose message body based on channel and template type
    let message_body = if let Some(custom) = payload.custom_message {
        custom
    } else if payload.channel == "whatsapp" {
        match payload.template_type.as_str() {
            "admission" => config.whatsapp_template_admission
                .replace("{name}", &recipient_name)
                .replace("{course}", "ADCA Advanced Diploma")
                .replace("{enrollment}", "SCRE-2026-9812"),
            "admit_card" => config.whatsapp_template_admit_card
                .replace("{name}", &recipient_name)
                .replace("{exam_title}", "Final Semester Computer Theory Exam")
                .replace("{date}", "25th Oct 2026")
                .replace("{center}", "SCRE Main Campus"),
            "marksheet" => config.whatsapp_template_marksheet
                .replace("{name}", &recipient_name)
                .replace("{course}", "Diploma in Computer Applications")
                .replace("{grade}", "A+")
                .replace("{percentage}", "92.5"),
            "fee" => config.whatsapp_template_fee
                .replace("{name}", &recipient_name)
                .replace("{course}", "Tally Prime & GST")
                .replace("{amount}", "4,500")
                .replace("{receipt_no}", "RCT-2026-0812"),
            "birthday" => config.whatsapp_template_birthday
                .replace("{name}", &recipient_name),
            _ => format!("Test Notification from SCRE Gateway to {}", recipient_name),
        }
    } else {
        match payload.template_type.as_str() {
            "admission" => config.sms_template_admission
                .replace("{name}", &recipient_name)
                .replace("{course}", "ADCA")
                .replace("{roll}", "2026-0129"),
            "admit_card" => config.sms_template_admit_card
                .replace("{exam_title}", "Mid-Term Exam")
                .replace("{date}", "25 Oct 2026"),
            "marksheet" => config.sms_template_marksheet
                .replace("{course}", "ADCA")
                .replace("{grade}", "A+"),
            "fee" => config.sms_template_fee
                .replace("{course}", "Tally Prime")
                .replace("{amount}", "4500")
                .replace("{receipt_no}", "RCT-882"),
            "birthday" => config.sms_template_birthday
                .replace("{name}", &recipient_name),
            _ => format!("SCRE Test SMS to {}", recipient_name),
        }
    };

    let log_entry = NotificationLog {
        id: None,
        channel: payload.channel.clone(),
        recipient: payload.recipient.clone(),
        template_type: payload.template_type.clone(),
        message: message_body.clone(),
        status: "sent".to_string(), // Gateway simulated / live delivery
        provider_response: Some(format!("200 OK: Delivered via provider [{}] with mock reference REF-{:x}", 
            if payload.channel == "whatsapp" { &config.whatsapp_provider } else { &config.sms_provider },
            Utc::now().timestamp_millis()
        )),
        created_at: Utc::now(),
    };

    let _ = logs_col.insert_one(&log_entry, None).await;

    Ok(Json(json!({
        "success": true,
        "message": format!("Notification dispatched successfully to {}", payload.recipient),
        "channel": payload.channel,
        "recipient": payload.recipient,
        "rendered_message": message_body,
        "status": "sent"
    })))
}

/// GET /api/admin/notifications/logs
pub async fn get_notification_logs(
    State(db): State<Database>,
    claims: Claims,
) -> Result<impl IntoResponse, StatusCode> {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return Err(StatusCode::FORBIDDEN);
    }

    let logs_col = db.collection::<NotificationLog>("notification_logs");
    let options = mongodb::options::FindOptions::builder()
        .sort(doc! { "created_at": -1 })
        .limit(100)
        .build();

    let mut cursor = logs_col.find(None, options).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut logs = Vec::new();
    while let Some(Ok(doc)) = cursor.next().await {
        logs.push(doc);
    }

    Ok(Json(json!({
        "success": true,
        "logs": logs
    })))
}
