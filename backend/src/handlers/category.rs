
use axum::{extract::State, http::StatusCode, Json};
use mongodb::{Database, bson::doc, bson::oid::ObjectId};
use serde::{Deserialize, Serialize};
use crate::models::category::{Category, PublicCategory};
use crate::models::user::{UserRole, Claims};
use chrono::Utc;
use futures_util::stream::StreamExt;

#[derive(Debug, Deserialize)]
pub struct CreateCategoryRequest {
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct CategoryResponse {
    pub success: bool,
    pub message: String,
    pub category: Option<PublicCategory>,
}

pub async fn create_category(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateCategoryRequest>,
) -> (StatusCode, Json<CategoryResponse>) {
    // Only admins/superadmins can create categories
    if !matches!(claims.role, UserRole::Admin | UserRole::SuperAdmin) {
        return (
            StatusCode::FORBIDDEN,
            Json(CategoryResponse {
                success: false,
                message: "Unauthorized to create categories".to_string(),
                category: None,
            }),
        );
    }

    let collection = db.collection::<Category>("categories");

    // Check if category name already exists (case-insensitive)
    let existing = collection
        .find_one(doc! { "name": { "$regex": &payload.name, "$options": "i" } }, None)
        .await;

    match existing {
        Ok(Some(_)) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(CategoryResponse {
                    success: false,
                    message: "Category name already exists".to_string(),
                    category: None,
                }),
            );
        }
        Err(e) => {
            println!("Error checking existing category: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(CategoryResponse {
                    success: false,
                    message: "Failed to check category".to_string(),
                    category: None,
                }),
            );
        }
        _ => {}
    }

    let new_category = Category {
        id: None,
        name: payload.name.clone(),
        is_system: false,
        created_at: Utc::now(),
    };

    match collection.insert_one(new_category.clone(), None).await {
        Ok(res) => {
            let inserted_id = res.inserted_id.as_object_id().unwrap_or_else(|| ObjectId::new());
            let mut category = new_category;
            category.id = Some(inserted_id);

            (
                StatusCode::OK,
                Json(CategoryResponse {
                    success: true,
                    message: "Category created successfully".to_string(),
                    category: Some(PublicCategory::from(category)),
                }),
            )
        }
        Err(e) => {
            println!("Error creating category: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(CategoryResponse {
                    success: false,
                    message: "Failed to create category".to_string(),
                    category: None,
                }),
            )
        }
    }
}

pub async fn get_categories(
    State(db): State<Database>,
    _claims: Claims,
) -> (StatusCode, Json<Vec<PublicCategory>>) {
    let collection = db.collection::<Category>("categories");
    // First, check if there are any categories, if not, add default system ones
    let count = collection.count_documents(doc! {}, None).await.unwrap_or(0);
    if count == 0 {
        // Add default system categories
        let default_categories = vec![
            "System Notifications",
            "General",
            "Announcements",
            "Exams",
            "Certificates",
        ];

        for name in default_categories {
            let category = Category {
                id: None,
                name: name.to_string(),
                is_system: true,
                created_at: Utc::now(),
            };
            let _ = collection.insert_one(category, None).await;
        }
    }

    let mut cursor = match collection.find(doc! {}, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut categories = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(cat) = result {
            categories.push(PublicCategory::from(cat));
        }
    }

    (StatusCode::OK, Json(categories))
}

pub async fn delete_category(
    State(db): State<Database>,
    claims: Claims,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> (StatusCode, Json<CategoryResponse>) {
    // Only admins/superadmins can delete categories
    if !matches!(claims.role, UserRole::Admin | UserRole::SuperAdmin) {
        return (
            StatusCode::FORBIDDEN,
            Json(CategoryResponse {
                success: false,
                message: "Unauthorized to delete categories".to_string(),
                category: None,
            }),
        );
    }

    let collection = db.collection::<Category>("categories");
    
    // Parse the ID
    let object_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(CategoryResponse {
                    success: false,
                    message: "Invalid category ID".to_string(),
                    category: None,
                }),
            );
        }
    };

    // Check if category exists and is not system
    let existing = match collection.find_one(doc! { "_id": object_id }, None).await {
        Ok(Some(cat)) => cat,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(CategoryResponse {
                    success: false,
                    message: "Category not found".to_string(),
                    category: None,
                }),
            );
        }
        Err(e) => {
            println!("Error checking category: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(CategoryResponse {
                    success: false,
                    message: "Failed to check category".to_string(),
                    category: None,
                }),
            );
        }
    };

    if existing.is_system {
        return (
            StatusCode::BAD_REQUEST,
            Json(CategoryResponse {
                success: false,
                message: "Cannot delete system category".to_string(),
                category: None,
            }),
        );
    }

    // Now delete the category
    match collection.delete_one(doc! { "_id": object_id }, None).await {
        Ok(_) => {
            (
                StatusCode::OK,
                Json(CategoryResponse {
                    success: true,
                    message: "Category deleted successfully".to_string(),
                    category: None,
                }),
            )
        }
        Err(e) => {
            println!("Error deleting category: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(CategoryResponse {
                    success: false,
                    message: "Failed to delete category".to_string(),
                    category: None,
                }),
            )
        }
    }
}
