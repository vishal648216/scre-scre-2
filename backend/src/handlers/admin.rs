use crate::authz::require_admin;
use crate::handlers::activity_logs::LogListItem;
use crate::models::activity_log::ActivityLog;
use crate::models::center::Center;
use crate::models::user::{Claims, User, UserRole};
use crate::models::staff::{SubAdminRole, SubAdminPermissions};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use futures_util::stream::StreamExt;
use mongodb::options::FindOptions;
use mongodb::{
    Database,
    bson::{doc, oid::ObjectId},
};
use chrono::Utc;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::RwLock;
use std::time::{Duration, Instant};

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AdminMetricsResponse {
    pub total_centers: u64,
    pub total_students: u64,
    pub total_revenue: f64,
    pub active_announcements: u64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AdminDashboardData {
    pub metrics: AdminMetricsResponse,
    pub crm_metrics: serde_json::Value,
    pub recent_centers: Vec<serde_json::Value>,
    pub recent_logs: Vec<LogListItem>,
}

struct AdminCache {
    data: Option<AdminDashboardData>,
    last_updated: Instant,
}

static ADMIN_DASHBOARD_CACHE: Lazy<RwLock<AdminCache>> = Lazy::new(|| {
    RwLock::new(AdminCache {
        data: None,
        last_updated: Instant::now() - Duration::from_secs(3600),
    })
});

pub fn invalidate_admin_dashboard_cache() {
    let mut cache = ADMIN_DASHBOARD_CACHE.write().unwrap();
    cache.last_updated = Instant::now() - Duration::from_secs(3600);
    cache.data = None;
}

pub async fn get_admin_metrics(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<AdminMetricsResponse>) {
    if !require_admin(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(AdminMetricsResponse {
                total_centers: 0,
                total_students: 0,
                total_revenue: 0.0,
                active_announcements: 0,
            }),
        );
    }
    let user_collection = db.collection::<User>("users");
    let center_collection = db.collection::<Center>("centers");
    let fee_collection = db.collection::<mongodb::bson::Document>("fees");
    let ann_collection = db.collection::<mongodb::bson::Document>("announcements");

    // Count centers (from centers collection, exclude deleted)
    let total_centers = center_collection
        .count_documents(doc! { "is_deleted": false }, None)
        .await
        .unwrap_or(0);
    // Count students (exclude deleted/inactive)
    let total_students = user_collection
        .count_documents(
            doc! { "role": "student", "is_deleted": false, "active": true },
            None,
        )
        .await
        .unwrap_or(0);

    // Count active announcements
    let active_announcements = ann_collection
        .count_documents(doc! {}, None)
        .await
        .unwrap_or(0);

    // Sum revenue
    let mut cursor = fee_collection
        .find(doc! {}, None)
        .await
        .expect("Failed to fetch fees");
    let mut total_revenue = 0.0;
    while let Some(result) = cursor.next().await {
        if let Ok(doc) = result {
            if let Ok(amount) = doc.get_f64("amount") {
                total_revenue += amount;
            }
        }
    }

    (
        StatusCode::OK,
        Json(AdminMetricsResponse {
            total_centers,
            total_students,
            total_revenue,
            active_announcements,
        }),
    )
}

pub async fn get_admin_dashboard_data(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Option<AdminDashboardData>>) {
    if !require_admin(&claims) {
        return (StatusCode::FORBIDDEN, Json(None));
    }

    // Check cache
    {
        let cache = ADMIN_DASHBOARD_CACHE.read().unwrap();
        if let Some(data) = &cache.data {
            if cache.last_updated.elapsed() < Duration::from_secs(60) {
                return (StatusCode::OK, Json(Some(data.clone())));
            }
        }
    }

    // Fetch Metrics
    let user_coll = db.collection::<User>("users");
    let center_coll = db.collection::<Center>("centers");
    let fee_coll = db.collection::<mongodb::bson::Document>("fees");
    let ann_coll = db.collection::<mongodb::bson::Document>("announcements");

    let total_centers = center_coll
        .count_documents(doc! { "is_deleted": false }, None)
        .await
        .unwrap_or(0);
    let total_students = user_coll
        .count_documents(
            doc! { "role": "student", "is_deleted": false, "active": true },
            None,
        )
        .await
        .unwrap_or(0);
    let active_announcements = ann_coll.count_documents(doc! {}, None).await.unwrap_or(0);

    let mut fee_cursor = fee_coll.find(doc! {}, None).await.expect("Fees");
    let mut total_revenue = 0.0;
    while let Some(Ok(doc)) = fee_cursor.next().await {
        total_revenue += doc.get_f64("amount").unwrap_or(0.0);
    }

    let metrics = AdminMetricsResponse {
        total_centers,
        total_students,
        total_revenue,
        active_announcements,
    };

    // Fetch CRM Metrics from enquiries
    let enq_coll = db.collection::<mongodb::bson::Document>("enquiries");
    let total = enq_coll.count_documents(doc! {}, None).await.unwrap_or(0);

    let new_count = enq_coll
        .count_documents(doc! { "status": "new" }, None)
        .await
        .unwrap_or(0);
    let contacted_count = enq_coll
        .count_documents(doc! { "status": "contacted" }, None)
        .await
        .unwrap_or(0);
    let followup_count = enq_coll
        .count_documents(doc! { "status": "followup" }, None)
        .await
        .unwrap_or(0);
    let converted_count = enq_coll
        .count_documents(doc! { "status": "converted" }, None)
        .await
        .unwrap_or(0);
    let lost_count = enq_coll
        .count_documents(doc! { "status": "lost" }, None)
        .await
        .unwrap_or(0);

    let now = Utc::now();
    let start = now.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc();
    let end = now.date_naive().and_hms_opt(23, 59, 59).unwrap().and_utc();

    let due_today = enq_coll
        .count_documents(
            doc! { "next_follow_up_at": { "$gte": start, "$lte": end } },
            None,
        )
        .await
        .unwrap_or(0);
    let overdue = enq_coll
        .count_documents(doc! { "next_follow_up_at": { "$lt": now } }, None)
        .await
        .unwrap_or(0);
    let upcoming = enq_coll
        .count_documents(doc! { "next_follow_up_at": { "$gt": now } }, None)
        .await
        .unwrap_or(0);

    let crm_metrics = serde_json::json!({
        "total": total,
        "new_count": new_count,
        "contacted_count": contacted_count,
        "followup_count": followup_count,
        "converted_count": converted_count,
        "lost_count": lost_count,
        "due_today": due_today,
        "overdue": overdue,
        "upcoming": upcoming
    });

    // Fetch Recent Centers
    let center_coll = db.collection::<Center>("centers");
    let find_opts = FindOptions::builder()
        .sort(doc! {"created_at": -1})
        .limit(5)
        .build();
    let mut center_cursor = center_coll
        .find(doc! { "active": true }, find_opts)
        .await
        .expect("Centers");
    let mut recent_centers = Vec::new();
    while let Some(Ok(c)) = center_cursor.next().await {
        recent_centers.push(serde_json::json!({
            "name": c.name,
            "code": c.code,
            "city": c.city,
            "state": c.state,
            "active": c.active,
        }));
    }

    // Fetch Recent Logs
    let log_coll = db.collection::<ActivityLog>("activity_logs");
    let log_opts = FindOptions::builder()
        .sort(doc! {"created_at": -1})
        .limit(4)
        .build();
    let mut log_cursor = log_coll.find(None, log_opts).await.expect("Logs");
    let mut recent_logs = Vec::new();
    while let Some(Ok(l)) = log_cursor.next().await {
        recent_logs.push(LogListItem {
            id: l.id.unwrap_or_default().to_hex(),
            actor_id: l.actor_id.to_hex(),
            action: l.action,
            entity_type: l.entity_type,
            entity_id: l.entity_id.map(|e| e.to_hex()),
            details: l.details,
            created_at: l.created_at.to_rfc3339(),
        });
    }

    let data = AdminDashboardData {
        metrics,
        crm_metrics,
        recent_centers,
        recent_logs,
    };

    // Update cache
    {
        let mut cache = ADMIN_DASHBOARD_CACHE.write().unwrap();
        cache.data = Some(data.clone());
        cache.last_updated = Instant::now();
    }

    (StatusCode::OK, Json(Some(data)))
}

#[derive(Debug, Serialize)]
pub struct UserListItem {
    pub id: String,
    pub username: String,
    pub password: Option<String>,
    pub role: UserRole,
    pub joined: String,
    pub status: String,
}

pub async fn get_all_users(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<UserListItem>>) {
    // Only admins/superadmins can list users
    if !require_admin(&claims) {
        return (StatusCode::FORBIDDEN, Json(Vec::new()));
    }

    // We ALWAYS hide superadmin role from this list to maintain "God" status
    // (not visible for assignment or management by anyone)
    let collection = db.collection::<User>("users");
    let filter = doc! { "role": { "$ne": "superadmin" } };

    let mut cursor = collection
        .find(filter, None)
        .await
        .expect("Failed to fetch users");

    let mut users = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(user) = result {
            // Extra safety check: never return superadmin in this list
            if user.role == UserRole::SuperAdmin {
                continue;
            }

            users.push(UserListItem {
                id: user.id.unwrap().to_hex(),
                username: user.username,
                password: user.raw_password,
                role: user.role,
                joined: user.created_at.format("%b %Y").to_string(),
                status: if user.active {
                    "Active".to_string()
                } else {
                    "Inactive".to_string()
                },
            });
        }
    }

    (StatusCode::OK, Json(users))
}

#[derive(Debug, Serialize)]
pub struct DeleteUserResponse {
    pub success: bool,
    pub message: String,
}

pub async fn delete_user(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<DeleteUserResponse>) {
    if !require_admin(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(DeleteUserResponse {
                success: false,
                message: "Only Administrators can delete users".to_string(),
            }),
        );
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(DeleteUserResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let collection = db.collection::<User>("users");

    // Protect Super Admin from being deleted
    if let Ok(Some(target_user)) = collection.find_one(doc! { "_id": oid }, None).await {
        if target_user.role == UserRole::SuperAdmin {
            return (
                StatusCode::FORBIDDEN,
                Json(DeleteUserResponse {
                    success: false,
                    message: "Super Admin account cannot be deleted".to_string(),
                }),
            );
        }
    }

    match collection.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => (
            StatusCode::OK,
            Json(DeleteUserResponse {
                success: true,
                message: "User deleted".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DeleteUserResponse {
                success: false,
                message: "Delete failed".to_string(),
            }),
        ),
    }
}

#[derive(Debug, Deserialize)]
pub struct UpdateRolePayload {
    pub role: UserRole,
}

pub async fn update_user_role(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<UpdateRolePayload>,
) -> (StatusCode, Json<DeleteUserResponse>) {
    if !require_admin(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(DeleteUserResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(DeleteUserResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let user_collection = db.collection::<User>("users");

    let target_user = match user_collection.find_one(doc! { "_id": oid }, None).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(DeleteUserResponse {
                    success: false,
                    message: "User not found".to_string(),
                }),
            );
        }
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(DeleteUserResponse {
                    success: false,
                    message: "Database error".to_string(),
                }),
            );
        }
    };

    // Protect Super Admin from having their role changed
    if target_user.role == UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(DeleteUserResponse {
                success: false,
                message: "Super Admin role cannot be modified".to_string(),
            }),
        );
    }

    let role_str = serde_json::to_value(&payload.role).ok().and_then(|v| v.as_str().map(|s| s.to_string())).unwrap_or_else(|| "admin".to_string());

    let mut set_fields = doc! {
        "role": &role_str,
        "active": true,
        "is_deleted": false
    };

    if payload.role == UserRole::Center {
        // Ensure Center document exists in `centers` collection
        let center_coll = db.collection::<Center>("centers");
        let existing = center_coll.find_one(doc! { "user_id": oid }, None).await.unwrap_or(None);
        if existing.is_none() {
            let now = Utc::now();
            let name = target_user.full_name.clone().filter(|s| !s.trim().is_empty()).unwrap_or_else(|| target_user.username.clone());
            let phone = target_user.phone.clone().unwrap_or_default();
            let email = target_user.email.clone().unwrap_or_default();
            let city = target_user.city.clone().unwrap_or_default();
            let state = target_user.state.clone().unwrap_or_default();
            let admin_id = ObjectId::parse_str(&claims.sub).unwrap_or(oid);
            let new_center = Center {
                id: None,
                user_id: oid,
                admin_id,
                name: name.clone(),
                code: target_user.username.clone(),
                owner_name: name,
                phone,
                email,
                address: String::new(),
                city,
                state,
                about_center: None,
                location: None,
                infrastructure: None,
                course_allotment: Vec::new(),
                branding_media: None,
                working_hours: None,
                active: true,
                district: None,
                center_code: Some(target_user.username.clone()),
                discount_coupon: None,
                referral_code: None,
                bank_details: None,
                documents: Vec::new(),
                key_documents: None,
                config_validity: None,
                is_email_verified: true,
                email_verified_at: Some(now),
                is_deleted: false,
                deleted_at: None,
                permanent_delete_at: None,
                created_at: now,
            };
            let _ = center_coll.insert_one(new_center, None).await;
        } else {
            let _ = center_coll.update_one(
                doc! { "user_id": oid },
                doc! { "$set": { "is_deleted": false, "active": true } },
                None
            ).await;
        }
    } else if payload.role == UserRole::Student {
        set_fields.insert("approval_status", "approved");
        if target_user.enrollment_number.is_none() {
            let ts = Utc::now().timestamp() % 10000;
            set_fields.insert("enrollment_number", format!("SCRE{:04}", ts));
        }
        if target_user.full_name.is_none() {
            set_fields.insert("full_name", &target_user.username);
        }
        // If center exists, deactivate center document
        let center_coll = db.collection::<Center>("centers");
        let _ = center_coll.update_one(
            doc! { "user_id": oid },
            doc! { "$set": { "active": false, "is_deleted": true } },
            None
        ).await;
    } else if payload.role == UserRole::Admin {
        // If center exists, deactivate center document
        let center_coll = db.collection::<Center>("centers");
        let _ = center_coll.update_one(
            doc! { "user_id": oid },
            doc! { "$set": { "active": false, "is_deleted": true } },
            None
        ).await;
    }

    match user_collection.update_one(doc! { "_id": oid }, doc! { "$set": set_fields }, None).await {
        Ok(_) => {
            invalidate_admin_dashboard_cache();
            (StatusCode::OK, Json(DeleteUserResponse { success: true, message: "Role updated".to_string() }))
        },
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(DeleteUserResponse { success: false, message: "Update failed".to_string() })),
    }
}

pub async fn toggle_user_status(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<DeleteUserResponse>) {
    if !require_admin(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(DeleteUserResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(DeleteUserResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let collection = db.collection::<User>("users");

    if let Ok(Some(target_user)) = collection.find_one(doc! { "_id": oid }, None).await {
        if target_user.role == UserRole::SuperAdmin {
            return (
                StatusCode::FORBIDDEN,
                Json(DeleteUserResponse {
                    success: false,
                    message: "Super Admin status cannot be toggled".to_string(),
                }),
            );
        }
        let new_active = !target_user.active;
        let update_res = collection
            .update_one(doc! { "_id": oid }, doc! { "$set": { "active": new_active } }, None)
            .await;

        if update_res.is_ok() {
            // Also toggle corresponding Center document if one exists
            let center_coll = db.collection::<Center>("centers");
            let _ = center_coll
                .update_one(doc! { "user_id": oid }, doc! { "$set": { "active": new_active } }, None)
                .await;

            invalidate_admin_dashboard_cache();

            (
                StatusCode::OK,
                Json(DeleteUserResponse {
                    success: true,
                    message: format!("Status changed to {}", if new_active { "Active" } else { "Inactive" }),
                }),
            )
        } else {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(DeleteUserResponse {
                    success: false,
                    message: "Update failed".to_string(),
                }),
            )
        }
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(DeleteUserResponse {
                success: false,
                message: "User not found".to_string(),
            }),
        )
    }
}


#[derive(Debug, Deserialize)]
pub struct ResetPasswordPayload {
    pub new_password: String,
}

pub async fn reset_user_password(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<ResetPasswordPayload>,
) -> (StatusCode, Json<DeleteUserResponse>) {
    if !require_admin(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(DeleteUserResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(DeleteUserResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let raw_password = payload.new_password.clone();
    let hashed_password = bcrypt::hash(payload.new_password, bcrypt::DEFAULT_COST).unwrap();

    let collection = db.collection::<User>("users");
    match collection
        .update_one(
            doc! { "_id": oid },
            doc! { "$set": { "password_hash": hashed_password, "raw_password": raw_password } },
            None,
        )
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(DeleteUserResponse {
                success: true,
                message: "Password reset".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DeleteUserResponse {
                success: false,
                message: "Reset failed".to_string(),
            }),
        ),
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateRolePayload {
    pub name: String,
    pub description: String,
    pub permissions: SubAdminPermissions,
}

#[derive(Debug, Deserialize)]
pub struct AssignRolePermissionsPayload {
    pub role_id: Option<String>,
    pub role_name: Option<String>,
    pub permissions: Option<SubAdminPermissions>,
}

pub async fn list_sub_admin_roles(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<SubAdminRole>>) {
    if !require_admin(&claims) {
        return (StatusCode::FORBIDDEN, Json(vec![]));
    }

    let coll = db.collection::<SubAdminRole>("sub_admin_roles");
    let mut cursor = match coll.find(doc! {}, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut roles = Vec::new();
    while let Some(Ok(role)) = cursor.next().await {
        roles.push(role);
    }

    (StatusCode::OK, Json(roles))
}

pub async fn create_sub_admin_role(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateRolePayload>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::SuperAdmin && claims.role != UserRole::Admin {
        return (StatusCode::FORBIDDEN, Json(serde_json::json!({ "success": false, "message": "Admin access required" })));
    }

    let coll = db.collection::<SubAdminRole>("sub_admin_roles");
    let now = Utc::now();
    let new_role = SubAdminRole {
        id: None,
        name: payload.name,
        description: payload.description,
        permissions: payload.permissions,
        is_system: Some(false),
        created_at: now,
        updated_at: now,
    };

    match coll.insert_one(new_role, None).await {
        Ok(res) => (StatusCode::CREATED, Json(serde_json::json!({
            "success": true,
            "message": "Role created successfully",
            "inserted_id": res.inserted_id.as_object_id().map(|o| o.to_hex())
        }))),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "success": false,
            "message": format!("Failed to create role: {}", e)
        }))),
    }
}

pub async fn update_sub_admin_role(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<CreateRolePayload>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::SuperAdmin && claims.role != UserRole::Admin {
        return (StatusCode::FORBIDDEN, Json(serde_json::json!({ "success": false, "message": "Admin access required" })));
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "message": "Invalid ID" }))),
    };

    let coll = db.collection::<SubAdminRole>("sub_admin_roles");
    let permissions_doc = match mongodb::bson::to_document(&payload.permissions) {
        Ok(d) => d,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "message": format!("Invalid permissions format: {}", e) }))),
    };

    let update = doc! {
        "$set": {
            "name": payload.name,
            "description": payload.description,
            "permissions": permissions_doc,
            "updated_at": mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis())
        }
    };

    match coll.update_one(doc! { "_id": oid }, update, None).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({ "success": true, "message": "Role updated successfully" }))),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "message": format!("Failed to update role: {}", e) }))),
    }
}

pub async fn delete_sub_admin_role(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    if claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(serde_json::json!({ "success": false, "message": "Super Admin access required" })));
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "message": "Invalid ID" }))),
    };

    let coll = db.collection::<SubAdminRole>("sub_admin_roles");
    match coll.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({ "success": true, "message": "Role deleted successfully" }))),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "message": format!("Failed to delete role: {}", e) }))),
    }
}

pub async fn assign_user_role_and_permissions(
    State(db): State<Database>,
    claims: Claims,
    Path(user_id): Path<String>,
    Json(payload): Json<AssignRolePermissionsPayload>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !require_admin(&claims) {
        return (StatusCode::FORBIDDEN, Json(serde_json::json!({ "success": false, "message": "Admin access required" })));
    }

    let oid = match ObjectId::parse_str(&user_id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "message": "Invalid user ID" }))),
    };

    let user_coll = db.collection::<User>("users");
    let mut update_fields = doc! {};

    if let Some(role_id_str) = payload.role_id {
        if let Ok(role_oid) = ObjectId::parse_str(&role_id_str) {
            update_fields.insert("sub_admin_role_id", role_oid);
        }
    }

    if let Some(role_name) = payload.role_name {
        update_fields.insert("sub_admin_role_name", role_name);
    }

    if let Some(perms) = payload.permissions {
        if let Ok(perms_doc) = mongodb::bson::to_document(&perms) {
            update_fields.insert("sub_admin_permissions", perms_doc);
        }
    }

    match user_coll.update_one(doc! { "_id": oid }, doc! { "$set": update_fields }, None).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({ "success": true, "message": "User role and permissions updated" }))),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "message": format!("Update failed: {}", e) }))),
    }
}

pub async fn get_current_admin_permissions(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<serde_json::Value>) {
    let user_id = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "Invalid token" }))),
    };

    let user_coll = db.collection::<User>("users");
    if let Ok(Some(u)) = user_coll.find_one(doc! { "_id": user_id }, None).await {
        // Superadmin has all permissions enabled by default
        if u.role == UserRole::SuperAdmin {
            let full_action = doc! { "view": true, "add": true, "edit": true, "delete": true };
            return (StatusCode::OK, Json(serde_json::json!({
                "role": "superadmin",
                "is_superadmin": true,
                "permissions": {
                    "centers": full_action.clone(),
                    "students": full_action.clone(),
                    "finance": full_action.clone(),
                    "courses": full_action.clone(),
                    "exams": full_action.clone(),
                    "staff": full_action.clone(),
                    "leads": full_action.clone(),
                    "cms": full_action.clone(),
                    "settings": full_action.clone()
                }
            })));
        }

        return (StatusCode::OK, Json(serde_json::json!({
            "role": format!("{:?}", u.role).to_lowercase(),
            "role_name": u.sub_admin_role_name,
            "permissions": u.sub_admin_permissions
        })));
    }

    (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "User not found" })))
}
