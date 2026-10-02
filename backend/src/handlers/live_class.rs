use crate::models::live_class::{CreateLiveClassPayload, LiveClass, UpdateLiveClassPayload};
use crate::models::user::{Claims, UserRole};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use chrono::Utc;
use futures_util::StreamExt;
use mongodb::{
    Database,
    bson::{Document, doc, oid::ObjectId},
    options::FindOptions,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct LiveClassResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct LiveClassQuery {
    pub course_id: Option<String>,
    pub status: Option<String>,
    pub limit: Option<i64>,
}

/// GET /api/live-classes — center sees own classes, student sees classes for their center
pub async fn list_live_classes(
    State(db): State<Database>,
    claims: Claims,
    Query(q): Query<LiveClassQuery>,
) -> (StatusCode, Json<serde_json::Value>) {
    let coll = db.collection::<LiveClass>("live_classes");

    let mut filter = doc! {};

    // Determine which center's classes to show
    match claims.role {
        UserRole::Center => {
            if let Ok(oid) = ObjectId::parse_str(&claims.sub) {
                filter.insert("center_id", oid);
            }
        }
        UserRole::Student => {
            // Students see non-hidden classes from their center
            filter.insert("is_hidden", doc! { "$ne": true });
            let users_coll = db.collection::<crate::models::user::User>("users");
            let user_oid = match ObjectId::parse_str(&claims.sub) {
                Ok(oid) => oid,
                Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"success": false, "message": "Invalid user ID"}))),
            };
            match users_coll.find_one(doc! {"_id": user_oid}, None).await {
                Ok(Some(user)) => {
                    if let Some(cid) = user.parent_id {
                        filter.insert("center_id", cid);
                    }
                }
                _ => {}
            }
        }
        UserRole::Admin | UserRole::SuperAdmin => {
            // Admin sees all
        }
        _ => {
            return (StatusCode::FORBIDDEN, Json(serde_json::json!({"success": false, "message": "Unauthorized"})));
        }
    }

    if let Some(cid) = &q.course_id {
        if let Ok(oid) = ObjectId::parse_str(cid) {
            filter.insert("course_id", oid);
        }
    }

    if let Some(status) = &q.status {
        filter.insert("status", status.as_str());
    } else {
        // Default: show upcoming and ongoing (and completed for recorded videos)
        filter.insert("status", doc! {"$in": ["upcoming", "ongoing", "completed"]});
    }

    let opts = FindOptions::builder()
        .sort(doc! {"scheduled_at": -1})
        .limit(q.limit.unwrap_or(100))
        .build();

    let mut classes = Vec::new();
    if let Ok(mut cursor) = coll.find(filter, opts).await {
        while let Some(Ok(cls)) = cursor.next().await {
            // Auto-compute status based on current time
            let now = Utc::now();
            let scheduled = cls.scheduled_at;
            let end_time = scheduled + chrono::Duration::minutes(cls.duration_minutes as i64);
            let computed_status = if cls.status == "cancelled" {
                "cancelled".to_string()
            } else if cls.is_hidden.unwrap_or(false) {
                "hidden".to_string()
            } else if now < scheduled {
                "upcoming".to_string()
            } else if now >= scheduled && now <= end_time {
                "ongoing".to_string()
            } else {
                "completed".to_string()
            };

            let mut val = serde_json::to_value(&cls).unwrap_or_default();
            if let Some(obj) = val.as_object_mut() {
                obj.insert("status".to_string(), serde_json::Value::String(computed_status));
                // Flatten _id
                if let Some(id_val) = obj.remove("_id") {
                    if let Some(oid_map) = id_val.as_object() {
                        if let Some(oid_str) = oid_map.get("$oid").and_then(|v| v.as_str()) {
                            obj.insert("id".to_string(), serde_json::Value::String(oid_str.to_string()));
                        }
                    }
                }
            }
            classes.push(val);
        }
    }

    (StatusCode::OK, Json(serde_json::json!({"success": true, "classes": classes})))
}

/// POST /api/live-classes — Center schedules a new live class or uploads video
pub async fn create_live_class(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateLiveClassPayload>,
) -> (StatusCode, Json<LiveClassResponse>) {
    if claims.role != UserRole::Center && claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(LiveClassResponse {
            success: false,
            message: "Only authorized personnel can publish course videos".to_string(),
        }));
    }

    // Determine center_id
    let center_id = if let Some(cid_str) = &payload.center_id {
        ObjectId::parse_str(cid_str).ok().or_else(|| ObjectId::parse_str(&claims.sub).ok()).unwrap_or_else(ObjectId::new)
    } else {
        match get_center_id(&db, &claims).await {
            Some(id) => id,
            None => ObjectId::parse_str(&claims.sub).unwrap_or_else(|_| ObjectId::new()),
        }
    };

    let scheduled_at = match payload.scheduled_at.as_deref() {
        Some(s) if !s.is_empty() => match chrono::DateTime::parse_from_rfc3339(s) {
            Ok(dt) => dt.with_timezone(&Utc),
            Err(_) => Utc::now(),
        },
        _ => Utc::now(),
    };

    let creator_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => ObjectId::new(),
    };

    let course_id = payload.course_id.as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok());

    let cls = LiveClass {
        id: None,
        title: payload.title,
        description: payload.description,
        platform: payload.platform.unwrap_or_else(|| "youtube".to_string()),
        join_url: payload.join_url,
        course_id,
        center_id,
        scheduled_at,
        duration_minutes: payload.duration_minutes.unwrap_or(45),
        status: if payload.is_hidden.unwrap_or(false) { "hidden".to_string() } else { "completed".to_string() },
        created_by: creator_oid,
        created_at: Utc::now(),
        is_hidden: payload.is_hidden,
        center_name: payload.center_name,
        subject_name: payload.subject_name,
        instructor_name: payload.instructor_name,
        thumbnail_url: payload.thumbnail_url,
        mode: payload.mode,
        chapter_title: payload.chapter_title,
        sequence_order: payload.sequence_order,
        keyword: payload.keyword,
        pdf_attachment_url: payload.pdf_attachment_url,
        visibility_state: payload.visibility_state,
    };

    let coll = db.collection::<LiveClass>("live_classes");
    match coll.insert_one(cls, None).await {
        Ok(_) => (StatusCode::CREATED, Json(LiveClassResponse {
            success: true,
            message: "Course video published successfully".to_string(),
        })),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(LiveClassResponse {
            success: false,
            message: format!("Failed to create: {}", e),
        })),
    }
}

/// PUT /api/live-classes/:id — Center updates a live class / video
pub async fn update_live_class(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<UpdateLiveClassPayload>,
) -> (StatusCode, Json<LiveClassResponse>) {
    if claims.role != UserRole::Center && claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(LiveClassResponse {
            success: false,
            message: "Unauthorized".to_string(),
        }));
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(LiveClassResponse {
            success: false,
            message: "Invalid ID".to_string(),
        })),
    };

    let mut update_doc = Document::new();
    if let Some(title) = payload.title { update_doc.insert("title", title); }
    if let Some(desc) = payload.description { update_doc.insert("description", desc); }
    if let Some(platform) = payload.platform { update_doc.insert("platform", platform); }
    if let Some(url) = payload.join_url { update_doc.insert("join_url", url); }
    if let Some(status) = payload.status { update_doc.insert("status", status); }
    if let Some(dur) = payload.duration_minutes { update_doc.insert("duration_minutes", dur); }
    if let Some(is_hid) = payload.is_hidden { update_doc.insert("is_hidden", is_hid); }
    if let Some(cname) = payload.center_name { update_doc.insert("center_name", cname); }
    if let Some(sname) = payload.subject_name { update_doc.insert("subject_name", sname); }
    if let Some(iname) = payload.instructor_name { update_doc.insert("instructor_name", iname); }
    if let Some(turl) = payload.thumbnail_url { update_doc.insert("thumbnail_url", turl); }
    if let Some(mode) = payload.mode { update_doc.insert("mode", mode); }
    if let Some(ctitle) = payload.chapter_title { update_doc.insert("chapter_title", ctitle); }
    if let Some(seq) = payload.sequence_order { update_doc.insert("sequence_order", seq); }
    if let Some(kw) = payload.keyword { update_doc.insert("keyword", kw); }
    if let Some(pdf) = payload.pdf_attachment_url { update_doc.insert("pdf_attachment_url", pdf); }
    if let Some(vstate) = payload.visibility_state { update_doc.insert("visibility_state", vstate); }
    if let Some(sched) = payload.scheduled_at {
        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&sched) {
            update_doc.insert("scheduled_at", mongodb::bson::DateTime::from_millis(dt.timestamp_millis()));
        }
    }

    if update_doc.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(LiveClassResponse {
            success: false,
            message: "No fields to update".to_string(),
        }));
    }

    let coll = db.collection::<Document>("live_classes");
    match coll.update_one(doc! {"_id": oid}, doc! {"$set": update_doc}, None).await {
        Ok(_) => (StatusCode::OK, Json(LiveClassResponse {
            success: true,
            message: "Updated successfully".to_string(),
        })),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(LiveClassResponse {
            success: false,
            message: format!("Update failed: {}", e),
        })),
    }
}

/// DELETE /api/live-classes/:id — Cancel/delete a live class
pub async fn delete_live_class(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<LiveClassResponse>) {
    if claims.role != UserRole::Center && claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(LiveClassResponse {
            success: false,
            message: "Unauthorized".to_string(),
        }));
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(LiveClassResponse {
            success: false,
            message: "Invalid ID".to_string(),
        })),
    };

    let coll = db.collection::<Document>("live_classes");
    // Mark as cancelled instead of hard delete
    match coll.update_one(doc! {"_id": oid}, doc! {"$set": {"status": "cancelled"}}, None).await {
        Ok(_) => (StatusCode::OK, Json(LiveClassResponse {
            success: true,
            message: "Class cancelled".to_string(),
        })),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(LiveClassResponse {
            success: false,
            message: format!("Failed: {}", e),
        })),
    }
}

// Helper: get center_id ObjectId for the calling user
async fn get_center_id(db: &Database, claims: &Claims) -> Option<ObjectId> {
    if claims.role == UserRole::Center {
        return ObjectId::parse_str(&claims.sub).ok();
    }
    if claims.role == UserRole::Student {
        let users_coll = db.collection::<crate::models::user::User>("users");
        let user_oid = ObjectId::parse_str(&claims.sub).ok()?;
        let user = users_coll.find_one(doc! {"_id": user_oid}, None).await.ok()??;
        return user.parent_id;
    }
    None
}
