use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use futures_util::TryStreamExt;
use mongodb::{Database, bson::doc, bson::oid::ObjectId};
use serde::{Deserialize, Serialize};

use crate::models::center::Center;
use crate::models::course::Course;
use crate::models::template::{PageOrientation, PageSize, Template, TemplateField, TemplateType};
use crate::models::user::{Claims, UserRole};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct PublicTemplate {
    pub id: String,
    pub template_name: String,
    pub template_type: String,
    pub course_category_id: Option<String>,
    pub course_id: Option<String>,
    pub default_design: bool,
    pub page_size: String,
    pub orientation: String,
    pub background_image: Option<String>,
    pub logo_left: Option<String>,
    pub logo_right: Option<String>,
    pub authority_signature: Option<String>,
    pub admin_signature: Option<String>,
    pub admin_stamp: Option<String>,
}

impl From<Template> for PublicTemplate {
    fn from(t: Template) -> Self {
        PublicTemplate {
            id: t.id.expect("Template must have id").to_hex(),
            template_name: t.template_name,
            template_type: t.template_type.to_str().to_string(),
            course_category_id: t.course_category_id.map(|oid| oid.to_hex()),
            course_id: t.course_id.map(|oid| oid.to_hex()),
            default_design: t.default_design,
            page_size: match t.page_size {
                PageSize::A4 => "a4".to_string(),
                PageSize::A3 => "a3".to_string(),
                PageSize::Letter => "letter".to_string(),
            },
            orientation: match t.orientation {
                PageOrientation::Portrait => "portrait".to_string(),
                PageOrientation::Landscape => "landscape".to_string(),
            },
            background_image: t.background_image,
            logo_left: t.logo_left,
            logo_right: t.logo_right,
            authority_signature: t.authority_signature,
            admin_signature: t.admin_signature,
            admin_stamp: t.admin_stamp,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct CreateTemplateRequest {
    pub template_name: String,
    pub template_type: TemplateType,
    #[serde(default)]
    pub course_category_id: Option<String>,
    #[serde(default)]
    pub course_id: Option<String>,
    #[serde(default)]
    pub default_design: Option<bool>,
    #[serde(default)]
    pub page_size: Option<PageSize>,
    #[serde(default)]
    pub orientation: Option<PageOrientation>,
    pub background_image: Option<String>,
    pub admin_signature: Option<String>,
    pub admin_stamp: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct UpdateTemplateRequest {
    #[serde(default)]
    pub template_name: Option<String>,
    #[serde(default)]
    pub template_type: Option<TemplateType>,
    #[serde(default)]
    pub background_image: Option<String>,
    #[serde(default)]
    pub course_category_id: Option<String>,
    #[serde(default)]
    pub course_id: Option<String>,
    #[serde(default)]
    pub default_design: Option<bool>,
    pub logo_left: Option<String>,
    pub logo_right: Option<String>,
    pub authority_signature: Option<String>,
    pub admin_signature: Option<String>,
    pub admin_stamp: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateFieldRequest {
    pub field_name: String,
    pub field_type: String,
    pub x_position: f64,
    pub y_position: f64,
    pub width: f64,
    pub height: f64,
    #[serde(default)]
    pub font_size: Option<f64>,
    #[serde(default)]
    pub font_family: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub text_align: Option<String>,
    pub custom_text: Option<String>,
    pub table_columns: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct ApiResponse {
    pub success: bool,
    pub message: String,
}

fn require_admin(claims: &Claims) -> Result<(), StatusCode> {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct ListTemplatesQuery {
    pub template_type: Option<String>,
    pub course_category_id: Option<String>,
    pub course_id: Option<String>,
    pub search: Option<String>,
    pub sort: Option<String>,
}

fn parse_template_type(raw: &str) -> Option<TemplateType> {
    match raw.trim().to_lowercase().as_str() {
        "certificate" => Some(TemplateType::Certificate),
        "marksheet" => Some(TemplateType::Marksheet),
        "id_card" | "idcard" => Some(TemplateType::IdCard),
        _ => None,
    }
}

pub async fn create_template(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateTemplateRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if let Err(c) = require_admin(&claims) {
        return (
            c,
            Json(serde_json::json!({"success": false, "message": "Unauthorized"})),
        );
    }

    let course_oid = payload
        .course_id
        .as_deref()
        .and_then(|v| ObjectId::parse_str(v).ok());
    let category_oid = payload
        .course_category_id
        .as_deref()
        .and_then(|v| ObjectId::parse_str(v).ok());
    let default_design = payload.default_design.unwrap_or(false);

    // If setting as default, unset default on other templates for the same course
    if default_design {
        if let Some(course_id) = course_oid {
            let coll = db.collection::<Template>("templates");
            let _ = coll
                .update_many(
                    doc! {
                        "course_id": course_id,
                        "template_type": payload.template_type.to_str()
                    },
                    doc! { "$set": { "default_design": false } },
                    None,
                )
                .await;
        }
    }

    let template = Template {
        id: None,
        template_name: payload.template_name,
        template_type: payload.template_type,
        course_category_id: category_oid,
        course_id: course_oid,
        default_design,
        page_size: payload.page_size.unwrap_or(PageSize::A4),
        orientation: payload.orientation.unwrap_or(PageOrientation::Portrait),
        background_image: payload.background_image,
        logo_left: None,
        logo_right: None,
        authority_signature: None,
        admin_signature: payload.admin_signature,
        admin_stamp: payload.admin_stamp,
    };

    let coll = db.collection::<Template>("templates");
    match coll.insert_one(&template, None).await {
        Ok(result) => {
            let id = result.inserted_id.as_object_id().map(|o| o.to_hex());
            (
                StatusCode::CREATED,
                Json(serde_json::json!({
                    "success": true,
                    "message": "Template created",
                    "id": id
                })),
            )
        }
        Err(e) => {
            eprintln!("create_template error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "success": false,
                    "message": "Failed to create template"
                })),
            )
        }
    }
}

pub async fn list_templates(
    State(db): State<Database>,
    claims: Claims,
    Query(q): Query<ListTemplatesQuery>,
) -> (StatusCode, Json<Vec<PublicTemplate>>) {
    let coll = db.collection::<Template>("templates");

    // Admins can see all templates (with optional filters).
    if claims.role == UserRole::Admin || claims.role == UserRole::SuperAdmin {
        let mut filter = doc! {};
        if let Some(ref t) = q.template_type {
            if parse_template_type(t).is_some() {
                filter.insert("template_type", t.trim().to_lowercase());
            }
        } else {
            // When no template_type specified, return both certificate and marksheet
            filter.insert("template_type", doc! { "$in": ["certificate", "marksheet"] });
        }
        if let Some(ref category_id) = q.course_category_id {
            if let Ok(oid) = ObjectId::parse_str(category_id) {
                filter.insert("course_category_id", oid);
            }
        }
        if let Some(ref cid) = q.course_id {
            if let Ok(oid) = ObjectId::parse_str(cid) {
                filter.insert("course_id", oid);
            }
        }
        if let Some(ref search) = q.search {
            let search_regex = regex::escape(search);
            filter.insert(
                "template_name",
                doc! { "$regex": search_regex, "$options": "i" },
            );
        }

        let options = match q.sort.as_deref() {
            Some("a-z") => mongodb::options::FindOptions::builder()
                .sort(doc! { "template_name": 1 })
                .build(),
            Some("z-a") => mongodb::options::FindOptions::builder()
                .sort(doc! { "template_name": -1 })
                .build(),
            Some("newest") => mongodb::options::FindOptions::builder()
                .sort(doc! { "_id": -1 })
                .build(),
            Some("oldest") => mongodb::options::FindOptions::builder()
                .sort(doc! { "_id": 1 })
                .build(),
            _ => mongodb::options::FindOptions::builder()
                .sort(doc! { "_id": -1 })
                .build(),
        };

        // Projection to retrieve only necessary fields
        let projection = doc! {
            "_id": 1,
            "template_name": 1,
            "template_type": 1,
            "course_category_id": 1,
            "course_id": 1,
            "default_design": 1,
            "page_size": 1,
            "orientation": 1,
            "background_image": 1,
            "logo_left": 1,
            "logo_right": 1,
            "authority_signature": 1,
            "admin_signature": 1,
            "admin_stamp": 1
        };
        // Apply projection to existing options
        let find_options = mongodb::options::FindOptions::builder()
            .projection(projection)
            .sort(options.sort)
            .build();
        let cursor = match coll.find(filter, find_options).await {
            Ok(c) => c,
            Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
        };
        let templates: Vec<Template> = cursor.try_collect().await.unwrap_or_default();
        let public_templates: Vec<PublicTemplate> =
            templates.into_iter().map(|t| t.into()).collect();
        return (StatusCode::OK, Json(public_templates));
    }

    // Center can see only certificate templates assigned to its allotted courses.
    if claims.role == UserRole::Center {
        let user_oid = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
        };

        let centers_coll = db.collection::<Center>("centers");
        let users_coll = db.collection::<crate::models::user::User>("users");
        let courses_coll = db.collection::<Course>("courses");

        let mut center_doc = centers_coll
            .find_one(doc! { "user_id": user_oid }, None)
            .await
            .ok()
            .flatten();
        if center_doc.is_none() {
            if let Ok(Some(user)) = users_coll.find_one(doc! { "_id": user_oid }, None).await {
                if let Some(email) = user.email {
                    center_doc = centers_coll
                        .find_one(doc! { "email": email }, None)
                        .await
                        .ok()
                        .flatten();
                }
            }
        }
        let center = match center_doc {
            Some(c) => c,
            None => return (StatusCode::OK, Json(Vec::new())),
        };

        let mut course_ids: Vec<ObjectId> = Vec::new();
        for name_or_id in center.course_allotment {
            if let Ok(oid) = ObjectId::parse_str(&name_or_id) {
                course_ids.push(oid);
                continue;
            }
            let filter = doc! {
                "course_name": { "$regex": format!("^{}$", regex::escape(&name_or_id)), "$options": "i" }
            };
            if let Ok(Some(course)) = courses_coll.find_one(filter, None).await {
                if let Some(oid) = course.id {
                    course_ids.push(oid);
                }
            }
        }
        course_ids.sort();
        course_ids.dedup();

        if course_ids.is_empty() {
            return (StatusCode::OK, Json(Vec::new()));
        }

        // Certificate vs marksheet issuance — same course scope. ID card templates are not listed here
        // (handled at student registration).
        let allowed_course_ids = course_ids.clone();
        let mut filter = doc! {
            "course_id": { "$in": allowed_course_ids }
        };
        
        // Only filter by template_type if explicitly provided
        if let Some(ref t) = q.template_type {
            let template_type = t.trim().to_lowercase();
            let template_type = if template_type == "marksheet" {
                "marksheet"
            } else if template_type == "certificate" {
                "certificate"
            } else {
                return (StatusCode::OK, Json(Vec::new()));
            };
            filter.insert("template_type", template_type);
        } else {
            // When no template_type specified, return both certificate and marksheet
            filter.insert("template_type", doc! { "$in": ["certificate", "marksheet"] });
        }
        if let Some(ref cid) = q.course_id {
            if let Ok(oid) = ObjectId::parse_str(cid) {
                if !course_ids.contains(&oid) {
                    return (StatusCode::OK, Json(Vec::new()));
                }
                filter.insert("course_id", oid);
            }
        }
        // Projection to retrieve only necessary fields
        let projection = doc! {
            "_id": 1,
            "template_name": 1,
            "template_type": 1,
            "course_category_id": 1,
            "course_id": 1,
            "default_design": 1,
            "page_size": 1,
            "orientation": 1,
            "background_image": 1,
            "logo_left": 1,
            "logo_right": 1,
            "authority_signature": 1,
            "admin_signature": 1,
            "admin_stamp": 1
        };
        let find_options = mongodb::options::FindOptions::builder()
            .projection(projection)
            .build();
        let cursor = match coll.find(filter, find_options).await {
            Ok(c) => c,
            Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
        };
        let templates: Vec<Template> = cursor.try_collect().await.unwrap_or_default();
        let public_templates: Vec<PublicTemplate> =
            templates.into_iter().map(|t| t.into()).collect();
        return (StatusCode::OK, Json(public_templates));
    }

    // Students/staff don't have template management access.
    (StatusCode::FORBIDDEN, Json(Vec::new()))
}

pub async fn get_template(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"success": false, "message": "Invalid ID"})),
            );
        }
    };

    let coll = db.collection::<Template>("templates");

    // Admins can access any template
    if claims.role == UserRole::Admin || claims.role == UserRole::SuperAdmin {
        match coll.find_one(doc! { "_id": oid }, None).await {
            Ok(Some(t)) => {
                let public_template: PublicTemplate = t.into();
                (
                    StatusCode::OK,
                    Json(serde_json::to_value(public_template).unwrap_or(serde_json::json!({}))),
                )
            }
            Ok(None) => (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"success": false, "message": "Template not found"})),
            ),
            Err(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"success": false})),
            ),
        }
    } else if claims.role == UserRole::Center {
        // Centers can only access templates for their allotted courses
        let user_oid = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"success": false, "message": "Invalid user ID"}))),
        };

        let centers_coll = db.collection::<Center>("centers");
        let users_coll = db.collection::<crate::models::user::User>("users");
        let courses_coll = db.collection::<Course>("courses");

        let mut center_doc = centers_coll
            .find_one(doc! { "user_id": user_oid }, None)
            .await
            .ok()
            .flatten();
        if center_doc.is_none() {
            if let Ok(Some(user)) = users_coll.find_one(doc! { "_id": user_oid }, None).await {
                if let Some(email) = user.email {
                    center_doc = centers_coll
                        .find_one(doc! { "email": email }, None)
                        .await
                        .ok()
                        .flatten();
                }
            }
        }
        let center = match center_doc {
            Some(c) => c,
            None => return (StatusCode::FORBIDDEN, Json(serde_json::json!({"success": false, "message": "Center not found"}))),
        };

        let mut course_ids: Vec<ObjectId> = Vec::new();
        for name_or_id in center.course_allotment {
            if let Ok(oid) = ObjectId::parse_str(&name_or_id) {
                course_ids.push(oid);
                continue;
            }
            let filter = doc! {
                "course_name": { "$regex": format!("^{}$", regex::escape(&name_or_id)), "$options": "i" }
            };
            if let Ok(Some(course)) = courses_coll.find_one(filter, None).await {
                if let Some(oid) = course.id {
                    course_ids.push(oid);
                }
            }
        }

        match coll.find_one(doc! { "_id": oid, "course_id": { "$in": course_ids } }, None).await {
            Ok(Some(t)) => {
                let public_template: PublicTemplate = t.into();
                (
                    StatusCode::OK,
                    Json(serde_json::to_value(public_template).unwrap_or(serde_json::json!({}))),
                )
            }
            Ok(None) => (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"success": false, "message": "Template not found or not accessible"})),
            ),
            Err(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"success": false})),
            ),
        }
    } else {
        (StatusCode::FORBIDDEN, Json(serde_json::json!({"success": false})))
    }
}

pub async fn update_template(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<UpdateTemplateRequest>,
) -> (StatusCode, Json<ApiResponse>) {
    if let Err(c) = require_admin(&claims) {
        return (
            c,
            Json(ApiResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ApiResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let coll = db.collection::<Template>("templates");

    // Get current template to check course and type
    let current_template = match coll.find_one(doc! { "_id": oid }, None).await {
        Ok(Some(t)) => t,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(ApiResponse {
                    success: false,
                    message: "Template not found".to_string(),
                }),
            );
        }
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse {
                    success: false,
                    message: "Failed to get template".to_string(),
                }),
            );
        }
    };

    let mut set_doc = doc! {};
    if let Some(name) = payload.template_name {
        set_doc.insert("template_name", name);
    }
    let template_type = if let Some(tt) = payload.template_type {
        set_doc.insert("template_type", tt.to_str());
        tt
    } else {
        current_template.template_type.clone()
    };
    if let Some(bg) = payload.background_image {
        set_doc.insert("background_image", bg);
    }
    if let Some(logo) = payload.logo_left {
        set_doc.insert("logo_left", logo);
    }
    if let Some(logo) = payload.logo_right {
        set_doc.insert("logo_right", logo);
    }
    if let Some(sig) = payload.authority_signature {
        set_doc.insert("authority_signature", sig);
    }
    if let Some(admin_sig) = payload.admin_signature {
        set_doc.insert("admin_signature", admin_sig);
    }
    if let Some(admin_stp) = payload.admin_stamp {
        set_doc.insert("admin_stamp", admin_stp);
    }
    if let Some(category_id) = payload.course_category_id {
        if category_id.trim().is_empty() {
            set_doc.insert("course_category_id", mongodb::bson::Bson::Null);
        } else if let Ok(oid) = ObjectId::parse_str(&category_id) {
            set_doc.insert("course_category_id", oid);
        }
    }
    let course_oid = if let Some(course_id) = payload.course_id {
        if course_id.trim().is_empty() {
            set_doc.insert("course_id", mongodb::bson::Bson::Null);
            None
        } else if let Ok(oid) = ObjectId::parse_str(&course_id) {
            set_doc.insert("course_id", oid);
            Some(oid)
        } else {
            None
        }
    } else {
        current_template.course_id
    };

    let default_design = if let Some(dd) = payload.default_design {
        set_doc.insert("default_design", dd);
        dd
    } else {
        current_template.default_design
    };

    // If setting as default, unset default on other templates for the same course
    if default_design {
        if let Some(course_id) = course_oid {
            let _ = coll
                .update_many(
                    doc! {
                        "_id": { "$ne": oid },
                        "course_id": course_id,
                        "template_type": template_type.to_str()
                    },
                    doc! { "$set": { "default_design": false } },
                    None,
                )
                .await;
        }
    }

    if set_doc.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse {
                success: false,
                message: "Nothing to update".to_string(),
            }),
        );
    }

    match coll
        .update_one(doc! { "_id": oid }, doc! { "$set": set_doc }, None)
        .await
    {
        Ok(r) if r.matched_count > 0 => (
            StatusCode::OK,
            Json(ApiResponse {
                success: true,
                message: "Updated".to_string(),
            }),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(ApiResponse {
                success: false,
                message: "Template not found".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse {
                success: false,
                message: "Update failed".to_string(),
            }),
        ),
    }
}

pub async fn set_default_design(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<ApiResponse>) {
    if let Err(c) = require_admin(&claims) {
        return (
            c,
            Json(ApiResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ApiResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let coll = db.collection::<Template>("templates");
    let template = match coll.find_one(doc! { "_id": oid }, None).await {
        Ok(Some(t)) => t,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(ApiResponse {
                    success: false,
                    message: "Template not found".to_string(),
                }),
            );
        }
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse {
                    success: false,
                    message: "Failed to get template".to_string(),
                }),
            );
        }
    };

    // Unset default on other templates for the same type and same course
    let mut unset_filter = doc! {
        "_id": { "$ne": oid },
        "template_type": template.template_type.to_str(),
    };
    if let Some(course_id) = template.course_id {
        unset_filter.insert("course_id", course_id);
    } else {
        // If template has no course, unset defaults on all other templates of same type with no course
        unset_filter.insert("course_id", mongodb::bson::Bson::Null);
    }
    let _ = coll
        .update_many(
            unset_filter,
            doc! { "$set": { "default_design": false } },
            None,
        )
        .await;

    // Set this template as default
    match coll
        .update_one(
            doc! { "_id": oid },
            doc! { "$set": { "default_design": true } },
            None,
        )
        .await
    {
        Ok(r) if r.matched_count > 0 => (
            StatusCode::OK,
            Json(ApiResponse {
                success: true,
                message: "Set as default".to_string(),
            }),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(ApiResponse {
                success: false,
                message: "Template not found".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse {
                success: false,
                message: "Update failed".to_string(),
            }),
        ),
    }
}

pub async fn delete_template(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<ApiResponse>) {
    if let Err(c) = require_admin(&claims) {
        return (
            c,
            Json(ApiResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ApiResponse {
                    success: false,
                    message: "Invalid ID".to_string(),
                }),
            );
        }
    };

    let coll = db.collection::<Template>("templates");
    let fields_coll = db.collection::<TemplateField>("template_fields");
    let _ = fields_coll
        .delete_many(doc! { "template_id": oid }, None)
        .await;
    match coll.delete_one(doc! { "_id": oid }, None).await {
        Ok(r) if r.deleted_count > 0 => (
            StatusCode::OK,
            Json(ApiResponse {
                success: true,
                message: "Deleted".to_string(),
            }),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(ApiResponse {
                success: false,
                message: "Template not found".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse {
                success: false,
                message: "Delete failed".to_string(),
            }),
        ),
    }
}

pub async fn create_field(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<CreateFieldRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if let Err(c) = require_admin(&claims) {
        return (c, Json(serde_json::json!({"success": false})));
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"success": false, "message": "Invalid template ID"})),
            );
        }
    };

    let field = TemplateField {
        id: None,
        template_id: oid,
        field_name: payload.field_name,
        field_type: payload.field_type,
        x_position: payload.x_position,
        y_position: payload.y_position,
        width: payload.width,
        height: payload.height,
        font_size: payload.font_size.unwrap_or(14.0),
        font_family: payload.font_family.unwrap_or_else(|| "Arial".to_string()),
        color: payload.color.unwrap_or_else(|| "#000000".to_string()),
        text_align: payload.text_align.unwrap_or_else(|| "left".to_string()),
        custom_text: payload.custom_text,
        table_columns: payload.table_columns,
    };

    let coll = db.collection::<TemplateField>("template_fields");
    match coll.insert_one(&field, None).await {
        Ok(result) => {
            let field_id = result.inserted_id.as_object_id().map(|o| o.to_hex());
            (
                StatusCode::CREATED,
                Json(serde_json::json!({
                    "success": true,
                    "id": field_id
                })),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"success": false})),
        ),
    }
}

pub async fn update_field(
    State(db): State<Database>,
    claims: Claims,
    Path((template_id, field_id)): Path<(String, String)>,
    Json(payload): Json<CreateFieldRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if let Err(c) = require_admin(&claims) {
        return (c, Json(serde_json::json!({"success": false})));
    }

    let tid = match ObjectId::parse_str(&template_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"success": false})),
            );
        }
    };
    let fid = match ObjectId::parse_str(&field_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"success": false})),
            );
        }
    };

    let coll = db.collection::<TemplateField>("template_fields");
    let mut set_doc = mongodb::bson::doc! {
            "x_position": payload.x_position,
            "y_position": payload.y_position,
            "width": payload.width,
            "height": payload.height,
            "font_size": payload.font_size.unwrap_or(14.0),
            "font_family": payload.font_family.as_deref().unwrap_or("Arial"),
            "color": payload.color.as_deref().unwrap_or("#000000"),
            "text_align": payload.text_align.as_deref().unwrap_or("left"),
            "custom_text": payload.custom_text,
    };
    if let Some(ref tc) = payload.table_columns {
        set_doc.insert("table_columns", tc.clone());
    }
    let update = doc! { "$set": set_doc };

    match coll
        .update_one(doc! { "_id": fid, "template_id": tid }, update, None)
        .await
    {
        Ok(r) if r.modified_count > 0 || r.matched_count > 0 => {
            (StatusCode::OK, Json(serde_json::json!({"success": true})))
        }
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"success": false})),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"success": false})),
        ),
    }
}

pub async fn delete_field(
    State(db): State<Database>,
    claims: Claims,
    Path((template_id, field_id)): Path<(String, String)>,
) -> (StatusCode, Json<ApiResponse>) {
    if let Err(c) = require_admin(&claims) {
        return (
            c,
            Json(ApiResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let tid = match ObjectId::parse_str(&template_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ApiResponse {
                    success: false,
                    message: "Invalid template ID".to_string(),
                }),
            );
        }
    };
    let fid = match ObjectId::parse_str(&field_id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ApiResponse {
                    success: false,
                    message: "Invalid field ID".to_string(),
                }),
            );
        }
    };

    let coll = db.collection::<TemplateField>("template_fields");
    match coll
        .delete_one(doc! { "_id": fid, "template_id": tid }, None)
        .await
    {
        Ok(r) if r.deleted_count > 0 => (
            StatusCode::OK,
            Json(ApiResponse {
                success: true,
                message: "Field deleted".to_string(),
            }),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(ApiResponse {
                success: false,
                message: "Field not found".to_string(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse {
                success: false,
                message: "Delete failed".to_string(),
            }),
        ),
    }
}

pub async fn list_fields(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<Vec<TemplateField>>) {
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
    };

    // Admins can access any template fields
    if claims.role == UserRole::Admin || claims.role == UserRole::SuperAdmin {
        let coll = db.collection::<TemplateField>("template_fields");
        let cursor = match coll.find(doc! { "template_id": oid }, None).await {
            Ok(c) => c,
            Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
        };
        let fields: Vec<TemplateField> = cursor.try_collect().await.unwrap_or_default();
        return (StatusCode::OK, Json(fields));
    }

    // Centers can only access fields for their allotted courses
    if claims.role == UserRole::Center {
        let user_oid = match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => oid,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
        };

        let centers_coll = db.collection::<Center>("centers");
        let users_coll = db.collection::<crate::models::user::User>("users");
        let courses_coll = db.collection::<Course>("courses");

        let mut center_doc = centers_coll
            .find_one(doc! { "user_id": user_oid }, None)
            .await
            .ok()
            .flatten();
        if center_doc.is_none() {
            if let Ok(Some(user)) = users_coll.find_one(doc! { "_id": user_oid }, None).await {
                if let Some(email) = user.email {
                    center_doc = centers_coll
                        .find_one(doc! { "email": email }, None)
                        .await
                        .ok()
                        .flatten();
                }
            }
        }
        let center = match center_doc {
            Some(c) => c,
            None => return (StatusCode::FORBIDDEN, Json(Vec::new())),
        };

        let mut course_ids: Vec<ObjectId> = Vec::new();
        for name_or_id in center.course_allotment {
            if let Ok(oid) = ObjectId::parse_str(&name_or_id) {
                course_ids.push(oid);
                continue;
            }
            let filter = doc! {
                "course_name": { "$regex": format!("^{}$", regex::escape(&name_or_id)), "$options": "i" }
            };
            if let Ok(Some(course)) = courses_coll.find_one(filter, None).await {
                if let Some(oid) = course.id {
                    course_ids.push(oid);
                }
            }
        }

        // Get the template to check if it belongs to the center's courses
        let templates_coll = db.collection::<Template>("templates");
        let template = match templates_coll.find_one(doc! { "_id": oid }, None).await {
            Ok(Some(t)) => t,
            _ => return (StatusCode::NOT_FOUND, Json(Vec::new())),
        };

        if let Some(course_id) = template.course_id {
            if !course_ids.contains(&course_id) {
                return (StatusCode::FORBIDDEN, Json(Vec::new()));
            }
        } else {
            return (StatusCode::FORBIDDEN, Json(Vec::new()));
        }

        let coll = db.collection::<TemplateField>("template_fields");
        let cursor = match coll.find(doc! { "template_id": oid }, None).await {
            Ok(c) => c,
            Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
        };
        let fields: Vec<TemplateField> = cursor.try_collect().await.unwrap_or_default();
        return (StatusCode::OK, Json(fields));
    }

    (StatusCode::FORBIDDEN, Json(Vec::<TemplateField>::new()))
}
