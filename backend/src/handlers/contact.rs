use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
};
use std::time::Duration;

use crate::handlers::admin::invalidate_admin_dashboard_cache;
use crate::models::contact::{ContactEnquiry, EnquiryNote};
use crate::models::user::{Claims, UserRole};
use crate::services::translation_service::{IpRateLimit, check_rate_limit};
use crate::util::http::client_ip;
use chrono::Utc;
use futures_util::stream::StreamExt;
use mongodb::options::FindOptions;
use mongodb::{
    Database,
    bson::{Bson, doc, oid::ObjectId, to_bson},
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CreateContactRequest {
    pub name: String,
    pub phone: String,
    pub email: Option<String>,
    pub category_id: Option<String>,
    pub course: Option<String>,
    pub message: Option<String>,
    pub country_id: Option<String>,
    pub state_id: Option<String>,
    pub district_id: Option<String>,
    pub city_id: Option<String>,
    pub center_id: Option<String>,
    pub enquiry_type: Option<String>, // "franchise", "student", "general", "internship"
    pub college: Option<String>,
    pub subject: Option<String>,
    pub priority: Option<String>,
    pub notes: Option<String>,
    pub next_follow_up_at: Option<chrono::DateTime<chrono::Utc>>,
    pub source: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CreateContactResponse {
    pub success: bool,
    pub message: String,
}

pub async fn handle_create_enquiry(
    State(db): State<Database>,
    headers: HeaderMap,
    Json(payload): Json<CreateContactRequest>,
) -> (StatusCode, Json<CreateContactResponse>) {
    let ip = client_ip(&headers);
    let limiter = IpRateLimit {
        limit: 15,
        window: Duration::from_secs(3600),
    };
    if !check_rate_limit(&format!("contact:{ip}"), &limiter) {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(CreateContactResponse {
                success: false,
                message: "Too many enquiries from this network. Please try again later."
                    .to_string(),
            }),
        );
    }

    let _collection = db.collection::<ContactEnquiry>("enquiries");

    let center_oid = payload
        .center_id
        .and_then(|id| ObjectId::parse_str(&id).ok());
    let country_oid = payload
        .country_id
        .and_then(|id| ObjectId::parse_str(&id).ok());
    let state_oid = payload
        .state_id
        .and_then(|id| ObjectId::parse_str(&id).ok());
    let district_oid = payload
        .district_id
        .and_then(|id| ObjectId::parse_str(&id).ok());
    let city_oid = payload.city_id.and_then(|id| ObjectId::parse_str(&id).ok());
    let category_oid = payload
        .category_id
        .and_then(|id| ObjectId::parse_str(&id).ok());

    let now = Utc::now();
    let course_name = payload.course.clone().unwrap_or_else(|| "Franchise Application".to_string());
    let new_enquiry = ContactEnquiry {
        id: None,
        name: payload.name.clone(),
        phone: payload.phone.clone(),
        email: payload.email.clone(),
        course: course_name,
        message: payload.message.clone(),
        country_id: country_oid,
        state_id: state_oid,
        district_id: district_oid,
        city_id: city_oid,
        center_id: center_oid,
        college: payload.college.clone(),
        status: "new".to_string(),
        subject: payload.subject.clone(),
        priority: payload.priority.clone(),
        notes: payload.notes.clone(),
        assigned_to: None,
        next_follow_up_at: payload.next_follow_up_at,
        notes_history: Vec::new(),
        created_at: now,
        updated_at: now,
    };

    // Store enquiry_type if provided
    let mut doc_bson = match to_bson(&new_enquiry) {
        Ok(Bson::Document(d)) => d,
        _ => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(CreateContactResponse {
                    success: false,
                    message: "Internal error".to_string(),
                }),
            );
        }
    };

    let is_franchise = payload.enquiry_type.as_deref() == Some("franchise");
    if let Some(ref et) = payload.enquiry_type {
        doc_bson.insert("enquiry_type", et);
    } else {
        doc_bson.insert("enquiry_type", "student"); // Default
    }
    if let Some(cat) = category_oid {
        doc_bson.insert("category_id", cat);
    }
    if let Some(col) = payload.college {
        doc_bson.insert("college", col);
    }
    if let Some(src) = payload.source {
        doc_bson.insert("source", src);
    }

    // Insert enquiry document
    let insert_res = db
        .collection::<mongodb::bson::Document>("enquiries")
        .insert_one(doc_bson, None)
        .await;

    if insert_res.is_err() {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CreateContactResponse {
                success: false,
                message: "Failed to submit enquiry".to_string(),
            }),
        );
    }

    // If this is a Franchise Application, ALSO create a pending Center Registration Request
    if is_franchise {
        let city_str = payload.city.unwrap_or_else(|| "Location".to_string());
        let state_str = payload.state.unwrap_or_else(|| "State".to_string());
        let center_name = format!("SCRE Center - {}", city_str);
        let center_code = format!("C-{}", rand::random::<u32>() % 9000 + 1000);
        let user_id = ObjectId::new();

        // Create pending user account for center
        let default_email = payload.email.clone().unwrap_or_else(|| format!("center_{}@screduc.com", center_code.to_lowercase()));
        let hashed_password = bcrypt::hash("Center@123", bcrypt::DEFAULT_COST).unwrap_or_default();
        let user_doc = doc! {
            "_id": user_id,
            "username": default_email.clone(),
            "email": default_email.clone(),
            "password_hash": hashed_password,
            "raw_password": "Center@123",
            "role": "center",
            "full_name": payload.name.clone(),
            "phone": payload.phone.clone(),
            "address": payload.message.clone(),
            "city": city_str.clone(),
            "state": state_str.clone(),
            "country": "India",
            "active": false,
            "approval_status": "pending",
            "status": "pending",
            "created_at": now,
            "is_deleted": false,
            "is_email_verified": true,
        };

        let user_coll = db.collection::<mongodb::bson::Document>("users");
        if let Ok(_) = user_coll.insert_one(user_doc, None).await {
            // Find SuperAdmin user_id for admin_id field
            let super_admin_id = user_coll
                .find_one(doc! { "role": "superadmin" }, None)
                .await
                .ok()
                .flatten()
                .and_then(|u| u.get_object_id("_id").ok())
                .unwrap_or_else(ObjectId::new);

            let center_doc = crate::models::center::Center {
                id: None,
                name: center_name,
                code: center_code,
                owner_name: payload.name.clone(),
                about_center: payload.message.clone(),
                phone: payload.phone.clone(),
                email: default_email,
                address: payload.message.unwrap_or_else(|| city_str.clone()),
                city: city_str,
                district: None,
                state: state_str,
                center_code: None,
                discount_coupon: None,
                referral_code: None,
                location: None,
                infrastructure: None,
                course_allotment: Vec::new(),
                bank_details: None,
                documents: Vec::new(),
                key_documents: None,
                branding_media: None,
                working_hours: None,
                config_validity: None,
                admin_id: super_admin_id,
                user_id,
                active: false,
                is_deleted: false,
                deleted_at: None,
                permanent_delete_at: None,
                is_email_verified: true,
                email_verified_at: Some(now),
                created_at: now,
            };

            let center_coll = db.collection::<crate::models::center::Center>("centers");
            let _ = center_coll.insert_one(center_doc, None).await;
        }
    }

    invalidate_admin_dashboard_cache();
    (
        StatusCode::CREATED,
        Json(CreateContactResponse {
            success: true,
            message: "Application submitted successfully! Our team will contact you within 24 hours.".to_string(),
        }),
    )
}

#[derive(Debug, Deserialize)]
pub struct EnquiryQuery {
    pub status: Option<String>,
    pub search: Option<String>,
    pub due: Option<String>,
    pub enquiry_type: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct EnquiryListItem {
    pub id: String,
    pub name: String,
    pub phone: String,
    pub email: Option<String>,
    pub course: String,
    pub message: Option<String>,
    pub center_id: Option<String>,
    pub center_name: Option<String>,
    pub enquiry_type: Option<String>,
    pub college: Option<String>,
    pub status: String,
    pub assigned_to: Option<String>,
    pub next_follow_up_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct EnquiryListResponse {
    pub items: Vec<EnquiryListItem>,
    pub total: u64,
    pub page: u32,
    pub limit: u32,
}

pub async fn list_enquiries(
    State(db): State<Database>,
    claims: Claims,
    Query(q): Query<EnquiryQuery>,
) -> (StatusCode, Json<EnquiryListResponse>) {
    // Both admin and center can list, but with different filters
    let mut filter = doc! {};

    if claims.role == UserRole::Center {
        let user_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => {
                return (
                    StatusCode::UNAUTHORIZED,
                    Json(EnquiryListResponse {
                        items: Vec::new(),
                        total: 0,
                        page: 1,
                        limit: 0,
                    }),
                );
            }
        };
        // Find the Center record that has user_id = this user's id
        let centers_coll = db.collection::<mongodb::bson::Document>("centers");
        match centers_coll
            .find_one(doc! { "user_id": user_id }, None)
            .await
        {
            Ok(Some(center)) => {
                if let Ok(center_id) = center.get_object_id("_id") {
                    filter.insert("center_id", center_id);
                }
            }
            _ => {
                return (
                    StatusCode::FORBIDDEN,
                    Json(EnquiryListResponse {
                        items: Vec::new(),
                        total: 0,
                        page: 1,
                        limit: 0,
                    }),
                );
            }
        }
    } else if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(EnquiryListResponse {
                items: Vec::new(),
                total: 0,
                page: 1,
                limit: 0,
            }),
        );
    }

    let coll = db.collection::<mongodb::bson::Document>("enquiries");
    if let Some(status) = &q.status {
        if !status.trim().is_empty() {
            filter.insert("status", status.to_lowercase());
        }
    }
    if let Some(et) = &q.enquiry_type {
        if !et.trim().is_empty() {
            filter.insert("enquiry_type", et);
        }
    }
    if let Some(search) = &q.search {
        let s = search.trim();
        if !s.is_empty() {
            let regex = mongodb::bson::Regex {
                pattern: s.to_string(),
                options: "i".to_string(),
            };
            filter.insert(
                "$or",
                vec![
                    doc! { "name": { "$regex": regex.clone() } },
                    doc! { "phone": { "$regex": regex.clone() } },
                    doc! { "email": { "$regex": regex.clone() } },
                    doc! { "course": { "$regex": regex } },
                ],
            );
        }
    }
    if let Some(due) = &q.due {
        let now = Utc::now();
        if due == "today" {
            let start = now.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc();
            let end = now.date_naive().and_hms_opt(23, 59, 59).unwrap().and_utc();
            filter.insert("next_follow_up_at", doc! { "$gte": start, "$lte": end });
        } else if due == "overdue" {
            filter.insert("next_follow_up_at", doc! { "$lt": now });
        } else if due == "upcoming" {
            filter.insert("next_follow_up_at", doc! { "$gt": now });
        }
    }

    let page = q.page.unwrap_or(1);
    let limit = q.limit.unwrap_or(20).min(100);
    let skip = ((page.saturating_sub(1)) as u64) * (limit as u64);
    let find_opts = FindOptions::builder()
        .sort(Some(doc! { "created_at": -1 }))
        .limit(Some(limit as i64))
        .skip(Some(skip))
        .build();

    let total = coll
        .count_documents(filter.clone(), None)
        .await
        .unwrap_or(0);
    let mut cursor = match coll.find(filter, find_opts).await {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(EnquiryListResponse {
                    items: Vec::new(),
                    total,
                    page,
                    limit,
                }),
            );
        }
    };
    let mut items = Vec::new();
    while let Some(res) = cursor.next().await {
        if let Ok(e) = res {
            let id = e.get_object_id("_id").ok();
            if let Some(id) = id {
                let mut center_name = None;
                if let Ok(cid) = e.get_object_id("center_id") {
                    let centers = db.collection::<mongodb::bson::Document>("centers");
                    if let Ok(Some(c)) = centers.find_one(doc! { "_id": cid }, None).await {
                        center_name = c.get_str("name").ok().map(|s| s.to_string());
                    }
                }

                items.push(EnquiryListItem {
                    id: id.to_hex(),
                    name: e.get_str("name").unwrap_or("").to_string(),
                    phone: e.get_str("phone").unwrap_or("").to_string(),
                    email: e.get_str("email").ok().map(|s| s.to_string()),
                    course: e.get_str("course").unwrap_or("").to_string(),
                    message: e.get_str("message").ok().map(|s| s.to_string()),
                    center_id: e.get_object_id("center_id").ok().map(|x| x.to_hex()),
                    center_name,
                    enquiry_type: e.get_str("enquiry_type").ok().map(|s| s.to_string()),
                    college: e.get_str("college").ok().map(|s| s.to_string()),
                    status: e.get_str("status").unwrap_or("new").to_string(),
                    assigned_to: e.get_object_id("assigned_to").ok().map(|x| x.to_hex()),
                    next_follow_up_at: e
                        .get_datetime("next_follow_up_at")
                        .ok()
                        .map(|dt| dt.to_chrono()),
                    created_at: e.get_datetime("created_at").unwrap().to_chrono(),
                    updated_at: e.get_datetime("updated_at").unwrap().to_chrono(),
                });
            }
        }
    }

    (
        StatusCode::OK,
        Json(EnquiryListResponse {
            items,
            total,
            page,
            limit,
        }),
    )
}

#[derive(Debug, Deserialize)]
pub struct UpdateEnquiryRequest {
    pub status: Option<String>,
    pub notes: Option<String>,
    pub assigned_to: Option<String>,
    pub next_follow_up_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize)]
pub struct UpdateEnquiryResponse {
    pub success: bool,
    pub message: String,
}

pub async fn update_enquiry(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<UpdateEnquiryRequest>,
) -> (StatusCode, Json<UpdateEnquiryResponse>) {
    // Both admin and center can update their own enquiries
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(UpdateEnquiryResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let coll = db.collection::<mongodb::bson::Document>("enquiries");

    // Check ownership if Center
    if claims.role == UserRole::Center {
        let user_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => {
                return (
                    StatusCode::UNAUTHORIZED,
                    Json(UpdateEnquiryResponse {
                        success: false,
                        message: "Unauthorized".to_string(),
                    }),
                );
            }
        };
        // Find center by user_id
        let centers_coll = db.collection::<mongodb::bson::Document>("centers");
        match centers_coll
            .find_one(doc! { "user_id": user_id }, None)
            .await
        {
            Ok(Some(center)) => {
                if let Ok(center_id) = center.get_object_id("_id") {
                    // Verify center_id matches
                    if let Err(_) = coll
                        .find_one(doc! { "_id": oid, "center_id": center_id }, None)
                        .await
                    {
                        return (
                            StatusCode::FORBIDDEN,
                            Json(UpdateEnquiryResponse {
                                success: false,
                                message: "Not your enquiry".to_string(),
                            }),
                        );
                    }
                }
            }
            _ => {
                return (
                    StatusCode::FORBIDDEN,
                    Json(UpdateEnquiryResponse {
                        success: false,
                        message: "Unauthorized".to_string(),
                    }),
                );
            }
        }
    } else if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(UpdateEnquiryResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let mut update_doc = doc! { "updated_at": Utc::now() };
    let mut set_fields = doc! {};

    if let Some(status) = payload.status {
        set_fields.insert("status", status.to_lowercase());
    }
    if let Some(notes) = payload.notes {
        set_fields.insert("notes", notes);
    }
    if let Some(assigned_to) = payload.assigned_to {
        if let Ok(a_oid) = ObjectId::parse_str(&assigned_to) {
            set_fields.insert("assigned_to", a_oid);
        }
    }
    if let Some(next_follow_up) = payload.next_follow_up_at {
        set_fields.insert("next_follow_up_at", next_follow_up);
    }

    if !set_fields.is_empty() {
        update_doc.insert("$set", set_fields);
    }

    match coll.update_one(doc! { "_id": oid }, update_doc, None).await {
        Ok(_) => {
            invalidate_admin_dashboard_cache();
            (
                StatusCode::OK,
                Json(UpdateEnquiryResponse {
                    success: true,
                    message: "Updated".to_string(),
                }),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(UpdateEnquiryResponse {
                success: false,
                message: "Update failed".to_string(),
            }),
        ),
    }
}

pub async fn delete_enquiry(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<UpdateEnquiryResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(UpdateEnquiryResponse {
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
                Json(UpdateEnquiryResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };
    let coll = db.collection::<ContactEnquiry>("enquiries");
    match coll.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => {
            invalidate_admin_dashboard_cache();
            (
                StatusCode::OK,
                Json(UpdateEnquiryResponse {
                    success: true,
                    message: "Enquiry deleted".to_string(),
                }),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(UpdateEnquiryResponse {
                success: false,
                message: "Delete failed".to_string(),
            }),
        ),
    }
}

#[derive(Debug, Serialize)]
pub struct EnquiryDetailResponse {
    pub id: String,
    pub name: String,
    pub phone: String,
    pub email: Option<String>,
    pub course: String,
    pub message: Option<String>,
    pub college: Option<String>,
    pub status: String,
    pub notes: Option<String>,
    pub assigned_to: Option<String>,
    pub next_follow_up_at: Option<chrono::DateTime<chrono::Utc>>,
    pub notes_history: Vec<EnquiryNote>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

pub async fn get_enquiry(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<Option<EnquiryDetailResponse>>) {
    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(None)),
    };
    let coll = db.collection::<ContactEnquiry>("enquiries");
    match coll.find_one(doc! { "_id": oid }, None).await {
        Ok(Some(e)) => {
            if claims.role == UserRole::Center {
                let user_id = ObjectId::parse_str(&claims.sub).unwrap();
                // Find center by user_id
                let centers_coll = db.collection::<mongodb::bson::Document>("centers");
                match centers_coll
                    .find_one(doc! { "user_id": user_id }, None)
                    .await
                {
                    Ok(Some(center)) => {
                        if let Ok(center_id) = center.get_object_id("_id") {
                            if e.center_id != Some(center_id) {
                                return (StatusCode::FORBIDDEN, Json(None));
                            }
                        }
                    }
                    _ => {
                        return (StatusCode::FORBIDDEN, Json(None));
                    }
                }
            } else if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
                return (StatusCode::FORBIDDEN, Json(None));
            }

            (
                StatusCode::OK,
                Json(Some(EnquiryDetailResponse {
                    id: e.id.unwrap().to_hex(),
                    name: e.name,
                    phone: e.phone,
                    email: e.email,
                    course: e.course,
                    message: e.message,
                    college: e.college,
                    status: e.status,
                    notes: e.notes,
                    assigned_to: e.assigned_to.map(|x| x.to_hex()),
                    next_follow_up_at: e.next_follow_up_at,
                    notes_history: e.notes_history,
                    created_at: e.created_at,
                    updated_at: e.updated_at,
                })),
            )
        }
        Ok(None) => (StatusCode::NOT_FOUND, Json(None)),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(None)),
    }
}

#[derive(Debug, Deserialize)]
pub struct AddNoteRequest {
    pub text: String,
}

#[derive(Debug, Serialize)]
pub struct AddNoteResponse {
    pub success: bool,
    pub message: String,
}

pub async fn add_enquiry_note(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<AddNoteRequest>,
) -> (StatusCode, Json<AddNoteResponse>) {
    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(AddNoteResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let coll = db.collection::<mongodb::bson::Document>("enquiries");

    // Check permissions
    if claims.role == UserRole::Center {
        let user_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => {
                return (
                    StatusCode::UNAUTHORIZED,
                    Json(AddNoteResponse {
                        success: false,
                        message: "Unauthorized".to_string(),
                    }),
                );
            }
        };
        // Find center by user_id
        let centers_coll = db.collection::<mongodb::bson::Document>("centers");
        match centers_coll
            .find_one(doc! { "user_id": user_id }, None)
            .await
        {
            Ok(Some(center)) => {
                if let Ok(center_id) = center.get_object_id("_id") {
                    // Verify center_id matches
                    match coll
                        .find_one(doc! { "_id": oid, "center_id": center_id }, None)
                        .await
                    {
                        Ok(Some(_)) => {}
                        _ => {
                            return (
                                StatusCode::FORBIDDEN,
                                Json(AddNoteResponse {
                                    success: false,
                                    message: "Not your enquiry".to_string(),
                                }),
                            );
                        }
                    }
                }
            }
            _ => {
                return (
                    StatusCode::FORBIDDEN,
                    Json(AddNoteResponse {
                        success: false,
                        message: "Unauthorized".to_string(),
                    }),
                );
            }
        }
    } else if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(AddNoteResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }
    let note = EnquiryNote {
        id: Some(ObjectId::new()),
        text: payload.text,
        created_by: ObjectId::parse_str(&claims.sub).unwrap(),
        created_at: Utc::now(),
    };
    let coll = db.collection::<ContactEnquiry>("enquiries");
    match coll.update_one(
        doc! { "_id": oid },
        doc! { "$push": { "notes_history": to_bson(&note).unwrap() }, "$set": { "updated_at": Utc::now() } },
        None
    ).await {
        Ok(_) => {
            invalidate_admin_dashboard_cache();
            (StatusCode::OK, Json(AddNoteResponse { success: true, message: "Note added".to_string() }))
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(AddNoteResponse { success: false, message: "Add note failed".to_string() })),
    }
}

#[derive(Debug, Serialize)]
pub struct EnquiryMetricsResponse {
    pub total: u64,
    pub new_count: u64,
    pub contacted_count: u64,
    pub followup_count: u64,
    pub converted_count: u64,
    pub lost_count: u64,
    pub due_today: u64,
    pub overdue: u64,
    pub upcoming: u64,
}

pub async fn enquiry_metrics(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<EnquiryMetricsResponse>) {
    let mut filter = doc! {};
    if claims.role == UserRole::Center {
        let user_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => {
                return (
                    StatusCode::UNAUTHORIZED,
                    Json(EnquiryMetricsResponse {
                        total: 0,
                        new_count: 0,
                        contacted_count: 0,
                        followup_count: 0,
                        converted_count: 0,
                        lost_count: 0,
                        due_today: 0,
                        overdue: 0,
                        upcoming: 0,
                    }),
                );
            }
        };
        // Find center by user_id
        let centers_coll = db.collection::<mongodb::bson::Document>("centers");
        match centers_coll
            .find_one(doc! { "user_id": user_id }, None)
            .await
        {
            Ok(Some(center)) => {
                if let Ok(center_id) = center.get_object_id("_id") {
                    filter.insert("center_id", center_id);
                }
            }
            _ => {
                return (
                    StatusCode::FORBIDDEN,
                    Json(EnquiryMetricsResponse {
                        total: 0,
                        new_count: 0,
                        contacted_count: 0,
                        followup_count: 0,
                        converted_count: 0,
                        lost_count: 0,
                        due_today: 0,
                        overdue: 0,
                        upcoming: 0,
                    }),
                );
            }
        }
    } else if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(EnquiryMetricsResponse {
                total: 0,
                new_count: 0,
                contacted_count: 0,
                followup_count: 0,
                converted_count: 0,
                lost_count: 0,
                due_today: 0,
                overdue: 0,
                upcoming: 0,
            }),
        );
    }

    let coll = db.collection::<ContactEnquiry>("enquiries");
    let total = coll
        .count_documents(filter.clone(), None)
        .await
        .unwrap_or(0);

    let mut new_filter = filter.clone();
    new_filter.insert("status", "new");
    let new_count = coll.count_documents(new_filter, None).await.unwrap_or(0);

    let mut contacted_filter = filter.clone();
    contacted_filter.insert("status", "contacted");
    let contacted_count = coll
        .count_documents(contacted_filter, None)
        .await
        .unwrap_or(0);

    let mut followup_filter = filter.clone();
    followup_filter.insert("status", "followup");
    let followup_count = coll
        .count_documents(followup_filter, None)
        .await
        .unwrap_or(0);

    let mut converted_filter = filter.clone();
    converted_filter.insert("status", "converted");
    let converted_count = coll
        .count_documents(converted_filter, None)
        .await
        .unwrap_or(0);

    let mut lost_filter = filter.clone();
    lost_filter.insert("status", "lost");
    let lost_count = coll.count_documents(lost_filter, None).await.unwrap_or(0);

    let now = Utc::now();
    let start = now.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc();
    let end = now.date_naive().and_hms_opt(23, 59, 59).unwrap().and_utc();

    let mut due_today_filter = filter.clone();
    due_today_filter.insert("next_follow_up_at", doc! { "$gte": start, "$lte": end });
    let due_today = coll
        .count_documents(due_today_filter, None)
        .await
        .unwrap_or(0);

    let mut overdue_filter = filter.clone();
    overdue_filter.insert("next_follow_up_at", doc! { "$lt": now });
    let overdue = coll
        .count_documents(overdue_filter, None)
        .await
        .unwrap_or(0);

    let mut upcoming_filter = filter.clone();
    upcoming_filter.insert("next_follow_up_at", doc! { "$gt": now });
    let upcoming = coll
        .count_documents(upcoming_filter, None)
        .await
        .unwrap_or(0);

    (
        StatusCode::OK,
        Json(EnquiryMetricsResponse {
            total,
            new_count,
            contacted_count,
            followup_count,
            converted_count,
            lost_count,
            due_today,
            overdue,
            upcoming,
        }),
    )
}

pub async fn export_enquiries(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, axum::http::HeaderMap, String) {
    let mut headers = axum::http::HeaderMap::new();
    let mut filter = doc! {};
    if claims.role == UserRole::Center {
        let user_id = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => {
                return (StatusCode::FORBIDDEN, headers, "Unauthorized".to_string());
            }
        };
        // Find center by user_id
        let centers_coll = db.collection::<mongodb::bson::Document>("centers");
        match centers_coll
            .find_one(doc! { "user_id": user_id }, None)
            .await
        {
            Ok(Some(center)) => {
                if let Ok(center_id) = center.get_object_id("_id") {
                    filter.insert("center_id", center_id);
                }
            }
            _ => {
                return (StatusCode::FORBIDDEN, headers, "Unauthorized".to_string());
            }
        }
    } else if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, headers, "Unauthorized".to_string());
    }

    let coll = db.collection::<ContactEnquiry>("enquiries");
    let mut cursor = match coll.find(filter, None).await {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                headers,
                "Failed to fetch".to_string(),
            );
        }
    };

    let mut csv = String::from("ID,Name,Phone,Email,Course,Center,Status,Follow-up,Created At\n");
    while let Some(res) = cursor.next().await {
        if let Ok(e) = res {
            let mut center_name = String::new();
            if let Some(cid) = e.center_id {
                let centers = db.collection::<mongodb::bson::Document>("centers");
                if let Ok(Some(c)) = centers.find_one(doc! { "_id": cid }, None).await {
                    center_name = c.get_str("name").unwrap_or("").to_string();
                }
            }

            csv.push_str(&format!(
                "{},\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\"\n",
                e.id.unwrap().to_hex(),
                e.name.replace("\"", "\"\""),
                e.phone.replace("\"", "\"\""),
                e.email.unwrap_or_default().replace("\"", "\"\""),
                e.course.replace("\"", "\"\""),
                center_name.replace("\"", "\"\""),
                e.status.replace("\"", "\"\""),
                e.next_follow_up_at
                    .map(|x| x.to_rfc3339())
                    .unwrap_or_default(),
                e.created_at.to_rfc3339()
            ));
        }
    }

    headers.insert(
        axum::http::header::CONTENT_TYPE,
        "text/csv".parse().unwrap(),
    );
    headers.insert(
        axum::http::header::CONTENT_DISPOSITION,
        "attachment; filename=\"enquiries.csv\"".parse().unwrap(),
    );

    (StatusCode::OK, headers, csv)
}
