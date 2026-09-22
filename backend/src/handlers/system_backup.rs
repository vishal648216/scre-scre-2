use axum::{
    extract::State,
    http::{header, StatusCode},
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

use crate::models::user::{UserRole, Claims};

/// GET /api/admin/system/diagnostics
pub async fn get_system_diagnostics(
    State(db): State<Database>,
    claims: Claims,
) -> Result<impl IntoResponse, StatusCode> {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return Err(StatusCode::FORBIDDEN);
    }

    // Measure DB latency
    let start = std::time::Instant::now();
    let ping_result = db.run_command(doc! { "ping": 1 }, None).await;
    let latency_ms = start.elapsed().as_millis();

    let is_connected = ping_result.is_ok();

    // Fetch collection counts
    let users_col = db.collection::<mongodb::bson::Document>("users");
    let centers_col = db.collection::<mongodb::bson::Document>("centers");
    let courses_col = db.collection::<mongodb::bson::Document>("courses");
    let certs_col = db.collection::<mongodb::bson::Document>("certificates");
    let marksheets_col = db.collection::<mongodb::bson::Document>("marksheets");
    let tickets_col = db.collection::<mongodb::bson::Document>("support_tickets");
    let notifications_col = db.collection::<mongodb::bson::Document>("notification_logs");

    let total_users = users_col.count_documents(None, None).await.unwrap_or(0);
    let total_students = users_col.count_documents(doc! { "role": "Student" }, None).await.unwrap_or(0);
    let total_centers = centers_col.count_documents(None, None).await.unwrap_or(0);
    let total_courses = courses_col.count_documents(None, None).await.unwrap_or(0);
    let total_certificates = certs_col.count_documents(None, None).await.unwrap_or(0);
    let total_marksheets = marksheets_col.count_documents(None, None).await.unwrap_or(0);
    let total_tickets = tickets_col.count_documents(None, None).await.unwrap_or(0);
    let total_notifications = notifications_col.count_documents(None, None).await.unwrap_or(0);

    // List collections
    let col_names = db.list_collection_names(None).await.unwrap_or_default();

    Ok(Json(json!({
        "success": true,
        "status": if is_connected { "healthy" } else { "degraded" },
        "database_name": db.name(),
        "database_latency_ms": latency_ms,
        "is_connected": is_connected,
        "collections_count": col_names.len(),
        "collections": col_names,
        "metrics": {
            "total_users": total_users,
            "total_students": total_students,
            "total_centers": total_centers,
            "total_courses": total_courses,
            "total_certificates": total_certificates,
            "total_marksheets": total_marksheets,
            "total_tickets": total_tickets,
            "total_notifications_dispatched": total_notifications
        },
        "server_environment": {
            "os": std::env::consts::OS,
            "arch": std::env::consts::ARCH,
            "timestamp": Utc::now().to_rfc3339()
        }
    })))
}

/// GET /api/admin/system/backup
/// Generates a complete JSON backup snapshot of critical system collections
pub async fn export_system_backup(
    State(db): State<Database>,
    claims: Claims,
) -> Result<impl IntoResponse, StatusCode> {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return Err(StatusCode::FORBIDDEN);
    }

    let collections_to_backup = vec![
        "courses",
        "centers",
        "categories",
        "system_settings",
        "notification_gateway_configs",
        "cms_pages",
        "coupons"
    ];

    let mut backup_data = serde_json::Map::new();

    for col_name in collections_to_backup {
        let col = db.collection::<mongodb::bson::Document>(col_name);
        let mut cursor = match col.find(None, None).await {
            Ok(c) => c,
            Err(_) => continue,
        };

        let mut docs = Vec::new();
        while let Some(Ok(doc)) = cursor.next().await {
            let json_val: serde_json::Value = mongodb::bson::from_document(doc).unwrap_or(serde_json::Value::Null);
            if !json_val.is_null() {
                docs.push(json_val);
            }
        }
        backup_data.insert(col_name.to_string(), serde_json::Value::Array(docs));
    }

    let backup_payload = json!({
        "scre_backup_version": "1.0.0",
        "exported_at": Utc::now().to_rfc3339(),
        "database": db.name(),
        "exported_by": claims.sub,
        "collections": backup_data
    });

    let json_bytes = serde_json::to_vec_pretty(&backup_payload)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let timestamp_str = Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let filename = format!("scre_backup_{}.json", timestamp_str);

    let response = axum::response::Response::builder()
        .header(header::CONTENT_TYPE, "application/json")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", filename),
        )
        .body(axum::body::Body::from(json_bytes))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(response)
}
