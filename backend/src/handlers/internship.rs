use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use futures_util::StreamExt;
use mongodb::{
    bson::{doc, oid::ObjectId},
    Database,
};
use serde::{Deserialize, Serialize};
use chrono::Utc;

use crate::models::internship::{
    ApplyInternshipPayload, CreateInternshipPayload, InternshipApplication, InternshipPosting,
    UpdateApplicationStatusPayload, UpdateInternshipPayload,
};
use crate::models::user::{Claims, User};

#[derive(Serialize)]
pub struct InternshipResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub message: Option<String>,
}

#[derive(Deserialize)]
pub struct InternshipFilter {
    pub domain: Option<String>,
    pub location_type: Option<String>,
    pub search: Option<String>,
}

// GET /api/internships (Public / Student open listings)
pub async fn get_internships(
    State(db): State<Database>,
    Query(filter): Query<InternshipFilter>,
) -> impl IntoResponse {
    let coll = db.collection::<InternshipPosting>("internship_postings");
    let mut query = doc! { "status": "Open" };

    if let Some(domain) = filter.domain {
        if !domain.is_empty() && domain != "all" {
            query.insert("domain", domain);
        }
    }

    if let Some(loc) = filter.location_type {
        if !loc.is_empty() && loc != "all" {
            query.insert("location_type", loc);
        }
    }

    let mut cursor = match coll.find(query, None).await {
        Ok(c) => c,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(InternshipResponse::<Vec<InternshipPosting>> {
                    success: false,
                    data: None,
                    message: Some(format!("Database error: {}", e)),
                }),
            );
        }
    };

    let mut items = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(posting) = result {
            if let Some(ref s) = filter.search {
                let term = s.to_lowercase();
                if !posting.title.to_lowercase().contains(&term)
                    && !posting.company_name.to_lowercase().contains(&term)
                    && !posting.domain.to_lowercase().contains(&term)
                {
                    continue;
                }
            }
            items.push(posting);
        }
    }

    (
        StatusCode::OK,
        Json(InternshipResponse {
            success: true,
            data: Some(items),
            message: None,
        }),
    )
}

// GET /api/internships/all (Admin / Center view all listings)
pub async fn get_all_internships_admin(
    State(db): State<Database>,
    Extension(_claims): Extension<Claims>,
) -> impl IntoResponse {
    let coll = db.collection::<InternshipPosting>("internship_postings");
    let mut cursor = match coll.find(doc! {}, None).await {
        Ok(c) => c,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(InternshipResponse::<Vec<InternshipPosting>> {
                    success: false,
                    data: None,
                    message: Some(format!("Database error: {}", e)),
                }),
            );
        }
    };

    let mut items = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(p) = result {
            items.push(p);
        }
    }

    (
        StatusCode::OK,
        Json(InternshipResponse {
            success: true,
            data: Some(items),
            message: None,
        }),
    )
}

// POST /api/internships (Admin / Center create)
pub async fn create_internship(
    State(db): State<Database>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateInternshipPayload>,
) -> impl IntoResponse {
    let coll = db.collection::<InternshipPosting>("internship_postings");
    let created_by = ObjectId::parse_str(&claims.sub).ok();

    let new_posting = InternshipPosting {
        id: None,
        title: payload.title,
        company_name: payload.company_name,
        domain: payload.domain,
        location_type: payload.location_type.unwrap_or_else(|| "Remote".to_string()),
        city: payload.city,
        duration_months: payload.duration_months,
        stipend_amount: payload.stipend_amount,
        skills_required: payload.skills_required.unwrap_or_default(),
        total_openings: payload.total_openings.unwrap_or(5),
        description: payload.description,
        status: "Open".to_string(),
        created_by,
        created_at: Utc::now(),
    };

    match coll.insert_one(new_posting, None).await {
        Ok(res) => (
            StatusCode::CREATED,
            Json(InternshipResponse {
                success: true,
                data: Some(res.inserted_id.as_object_id().map(|o| o.to_hex()).unwrap_or_default()),
                message: Some("Internship posted successfully".to_string()),
            }),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(InternshipResponse {
                success: false,
                data: None,
                message: Some(format!("Failed to create posting: {}", e)),
            }),
        ),
    }
}

// PUT /api/internships/:id (Update)
pub async fn update_internship(
    State(db): State<Database>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateInternshipPayload>,
) -> impl IntoResponse {
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(InternshipResponse::<String> {
                    success: false,
                    data: None,
                    message: Some("Invalid internship ID".to_string()),
                }),
            )
        }
    };

    let mut update_doc = doc! {};
    if let Some(t) = payload.title { update_doc.insert("title", t); }
    if let Some(c) = payload.company_name { update_doc.insert("company_name", c); }
    if let Some(d) = payload.domain { update_doc.insert("domain", d); }
    if let Some(l) = payload.location_type { update_doc.insert("location_type", l); }
    if let Some(city) = payload.city { update_doc.insert("city", city); }
    if let Some(dur) = payload.duration_months { update_doc.insert("duration_months", dur as i64); }
    if let Some(stip) = payload.stipend_amount { update_doc.insert("stipend_amount", stip); }
    if let Some(skills) = payload.skills_required { update_doc.insert("skills_required", skills); }
    if let Some(op) = payload.total_openings { update_doc.insert("total_openings", op as i64); }
    if let Some(desc) = payload.description { update_doc.insert("description", desc); }
    if let Some(st) = payload.status { update_doc.insert("status", st); }

    let coll = db.collection::<InternshipPosting>("internship_postings");
    match coll.update_one(doc! { "_id": oid }, doc! { "$set": update_doc }, None).await {
        Ok(_) => (
            StatusCode::OK,
            Json(InternshipResponse {
                success: true,
                data: Some("Updated successfully".to_string()),
                message: None,
            }),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(InternshipResponse {
                success: false,
                data: None,
                message: Some(format!("Update failed: {}", e)),
            }),
        ),
    }
}

// DELETE /api/internships/:id
pub async fn delete_internship(
    State(db): State<Database>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(InternshipResponse::<String> {
                    success: false,
                    data: None,
                    message: Some("Invalid ID".to_string()),
                }),
            )
        }
    };

    let coll = db.collection::<InternshipPosting>("internship_postings");
    let _ = coll.delete_one(doc! { "_id": oid }, None).await;

    (
        StatusCode::OK,
        Json(InternshipResponse {
            success: true,
            data: Some("Deleted successfully".to_string()),
            message: None,
        }),
    )
}

// POST /api/internships/:id/apply (Student apply)
pub async fn apply_internship(
    State(db): State<Database>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<String>,
    Json(payload): Json<ApplyInternshipPayload>,
) -> impl IntoResponse {
    let intern_oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(InternshipResponse::<String> {
                    success: false,
                    data: None,
                    message: Some("Invalid internship ID".to_string()),
                }),
            )
        }
    };

    let student_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(InternshipResponse::<String> {
                    success: false,
                    data: None,
                    message: Some("Invalid user account".to_string()),
                }),
            )
        }
    };

    // Find internship
    let post_coll = db.collection::<InternshipPosting>("internship_postings");
    let posting = match post_coll.find_one(doc! { "_id": intern_oid }, None).await {
        Ok(Some(p)) => p,
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(InternshipResponse {
                    success: false,
                    data: None,
                    message: Some("Internship not found".to_string()),
                }),
            )
        }
    };

    // Check duplicate application
    let app_coll = db.collection::<InternshipApplication>("internship_applications");
    if let Ok(Some(_)) = app_coll.find_one(doc! { "internship_id": intern_oid, "student_id": student_oid }, None).await {
        return (
            StatusCode::CONFLICT,
            Json(InternshipResponse {
                success: false,
                data: None,
                message: Some("You have already applied for this internship.".to_string()),
            }),
        );
    }

    // Get user details
    let user_coll = db.collection::<User>("users");
    let (s_name, s_email, s_phone, s_enroll) = if let Ok(Some(u)) = user_coll.find_one(doc! { "_id": student_oid }, None).await {
        (
            u.full_name.unwrap_or(u.username),
            u.email.unwrap_or_default(),
            u.phone.or(payload.phone).unwrap_or_default(),
            u.enrollment_number,
        )
    } else {
        (
            claims.sub.clone(),
            "".to_string(),
            payload.phone.unwrap_or_default(),
            None,
        )
    };

    let application = InternshipApplication {
        id: None,
        internship_id: intern_oid,
        internship_title: posting.title,
        company_name: posting.company_name,
        student_id: student_oid,
        student_name: s_name,
        student_email: s_email,
        student_phone: s_phone,
        enrollment_no: s_enroll,
        resume_url: payload.resume_url,
        cover_note: payload.cover_note,
        status: "Applied".to_string(),
        certificate_id: None,
        applied_at: Utc::now(),
        updated_at: Utc::now(),
    };

    match app_coll.insert_one(application, None).await {
        Ok(res) => (
            StatusCode::CREATED,
            Json(InternshipResponse {
                success: true,
                data: Some(res.inserted_id.as_object_id().map(|o| o.to_hex()).unwrap_or_default()),
                message: Some("Application submitted successfully!".to_string()),
            }),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(InternshipResponse {
                success: false,
                data: None,
                message: Some(format!("Failed to submit application: {}", e)),
            }),
        ),
    }
}

// GET /api/internships/my-applications (Student view applications)
pub async fn get_my_applications(
    State(db): State<Database>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let student_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(InternshipResponse::<Vec<InternshipApplication>> {
                    success: false,
                    data: None,
                    message: Some("Invalid user ID".to_string()),
                }),
            )
        }
    };

    let app_coll = db.collection::<InternshipApplication>("internship_applications");
    let mut cursor = match app_coll.find(doc! { "student_id": student_oid }, None).await {
        Ok(c) => c,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(InternshipResponse {
                    success: false,
                    data: None,
                    message: Some(format!("Database error: {}", e)),
                }),
            )
        }
    };

    let mut list = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(app) = result {
            list.push(app);
        }
    }

    (
        StatusCode::OK,
        Json(InternshipResponse {
            success: true,
            data: Some(list),
            message: None,
        }),
    )
}

// GET /api/internships/:id/applications (Admin view applicants)
pub async fn get_internship_applications(
    State(db): State<Database>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let intern_oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(InternshipResponse::<Vec<InternshipApplication>> {
                    success: false,
                    data: None,
                    message: Some("Invalid internship ID".to_string()),
                }),
            )
        }
    };

    let app_coll = db.collection::<InternshipApplication>("internship_applications");
    let mut cursor = match app_coll.find(doc! { "internship_id": intern_oid }, None).await {
        Ok(c) => c,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(InternshipResponse {
                    success: false,
                    data: None,
                    message: Some(format!("Database error: {}", e)),
                }),
            )
        }
    };

    let mut list = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(app) = result {
            list.push(app);
        }
    }

    (
        StatusCode::OK,
        Json(InternshipResponse {
            success: true,
            data: Some(list),
            message: None,
        }),
    )
}

// PUT /api/internships/applications/:app_id/status (Admin updates status & issues cert)
pub async fn update_application_status(
    State(db): State<Database>,
    Extension(_claims): Extension<Claims>,
    Path(app_id): Path<String>,
    Json(payload): Json<UpdateApplicationStatusPayload>,
) -> impl IntoResponse {
    let app_oid = match ObjectId::parse_str(&app_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(InternshipResponse::<String> {
                    success: false,
                    data: None,
                    message: Some("Invalid application ID".to_string()),
                }),
            )
        }
    };

    let mut update_doc = doc! {
        "status": &payload.status,
        "updated_at": mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis()),
    };

    // If completed, generate an Internship Certificate ID if not present
    if payload.status.to_lowercase() == "completed" {
        let cert_id = format!("INT-CERT-{}", Utc::now().format("%Y%m%d%H%M%S"));
        update_doc.insert("certificate_id", cert_id);
    }

    let app_coll = db.collection::<InternshipApplication>("internship_applications");
    match app_coll.update_one(doc! { "_id": app_oid }, doc! { "$set": update_doc }, None).await {
        Ok(_) => (
            StatusCode::OK,
            Json(InternshipResponse {
                success: true,
                data: Some("Application status updated".to_string()),
                message: None,
            }),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(InternshipResponse {
                success: false,
                data: None,
                message: Some(format!("Failed to update: {}", e)),
            }),
        ),
    }
}
