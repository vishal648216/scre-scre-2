use axum::{
    extract::{State, Query},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use futures_util::stream::StreamExt;
use mongodb::{Database, bson::{doc, oid::ObjectId, Bson, Document}};
use mongodb::options::FindOptions;
use serde::{Deserialize, Serialize};

use crate::models::user::Claims;
use crate::models::activity_log::ActivityLog;

#[derive(Debug, Deserialize)]
pub struct LogQuery {
    pub action: Option<String>,
    pub entity_type: Option<String>,
    pub actor_id: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Debug, Serialize, Clone)]
pub struct LogListItem {
    pub id: String,
    pub actor_id: String,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Option<String>,
    pub details: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct LogListResponse {
    pub items: Vec<LogListItem>,
    pub total: u64,
    pub page: u32,
    pub limit: u32,
}

#[derive(Debug, Serialize)]
pub struct TranslationUsageStatsResponse {
    pub total_events: u64,
    pub last_24h_events: u64,
    pub by_source: Vec<UsageBucket>,
    pub by_language: Vec<UsageBucket>,
}

#[derive(Debug, Serialize)]
pub struct UsageBucket {
    pub key: String,
    pub count: u64,
}

pub async fn get_logs(
    State(db): State<Database>,
    _claims: Claims,
    Query(q): Query<LogQuery>,
) -> (StatusCode, Json<LogListResponse>) {
    let coll = db.collection::<ActivityLog>("activity_logs");
    let mut filter = doc! {};
    if let Some(a) = &q.action {
        if !a.is_empty() { filter.insert("action", a); }
    }
    if let Some(et) = &q.entity_type {
        if !et.is_empty() { filter.insert("entity_type", et); }
    }
    if let Some(actor) = &q.actor_id {
        if let Ok(oid) = ObjectId::parse_str(actor) {
            filter.insert("actor_id", oid);
        }
    }
    let page = q.page.unwrap_or(1);
    let limit_u32 = q.limit.unwrap_or(20).min(100);
    let limit = limit_u32 as i64;
    let skip = ((page.saturating_sub(1)) as u64) * (limit as u64);
    let find_opts = FindOptions::builder()
        .sort(Some(doc! { "created_at": -1 }))
        .skip(Some(skip))
        .limit(Some(limit))
        .build();
    let total = coll.count_documents(filter.clone(), None).await.unwrap_or(0);
    let mut cursor = match coll.find(filter, find_opts).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(LogListResponse { items: Vec::new(), total: 0, page, limit: limit_u32 })),
    };
    let mut items = Vec::new();
    while let Some(Ok(l)) = cursor.next().await {
        items.push(LogListItem {
            id: l.id.unwrap_or_default().to_hex(),
            actor_id: l.actor_id.to_hex(),
            action: l.action,
            entity_type: l.entity_type,
            entity_id: l.entity_id.map(|e| e.to_hex()),
            details: l.details,
            created_at: l.created_at.to_rfc3339(),
        });
    }
    (StatusCode::OK, Json(LogListResponse { items, total, page, limit: limit_u32 }))
}

pub async fn get_translation_usage_stats(
    State(db): State<Database>,
    _claims: Claims,
) -> (StatusCode, Json<TranslationUsageStatsResponse>) {
    let coll = db.collection::<Document>("translation_usage_logs");
    let now = Utc::now();
    let last_24h = now - chrono::Duration::hours(24);

    let total_events = coll.count_documents(doc! {}, None).await.unwrap_or(0);
    let last_24h_events = coll
        .count_documents(
            doc! { "created_at": { "$gte": mongodb::bson::DateTime::from_millis(last_24h.timestamp_millis()) } },
            None,
        )
        .await
        .unwrap_or(0);

    let by_source = aggregate_usage(&coll, "source").await;
    let by_language = aggregate_usage(&coll, "lang").await;

    (
        StatusCode::OK,
        Json(TranslationUsageStatsResponse {
            total_events,
            last_24h_events,
            by_source,
            by_language,
        }),
    )
}

async fn aggregate_usage(
    coll: &mongodb::Collection<Document>,
    field: &str,
) -> Vec<UsageBucket> {
    let pipeline = vec![
        doc! { "$group": { "_id": format!("${}", field), "count": { "$sum": 1 } } },
        doc! { "$sort": { "count": -1 } },
    ];

    let mut out = Vec::new();
    if let Ok(mut cursor) = coll.aggregate(pipeline, None).await {
        while let Some(Ok(row)) = cursor.next().await {
            let key = match row.get("_id") {
                Some(Bson::String(s)) => s.clone(),
                Some(v) => v.to_string(),
                None => "unknown".to_string(),
            };
            let count = match row.get("count") {
                Some(Bson::Int32(v)) => (*v).max(0) as u64,
                Some(Bson::Int64(v)) => (*v).max(0) as u64,
                Some(Bson::Double(v)) => (*v).max(0.0) as u64,
                _ => 0,
            };
            out.push(UsageBucket { key, count });
        }
    }
    out
}

pub async fn insert_log(
    db: &Database,
    actor_id: ObjectId,
    action: &str,
    entity_type: &str,
    entity_id: Option<ObjectId>,
    details: Option<String>,
) {
    let coll = db.collection::<ActivityLog>("activity_logs");
    let log = ActivityLog {
        id: None,
        actor_id,
        action: action.to_string(),
        entity_type: entity_type.to_string(),
        entity_id,
        details,
        created_at: Utc::now(),
    };
    let _ = coll.insert_one(log, None).await;
}
