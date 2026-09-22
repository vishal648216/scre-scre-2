use axum::{extract::{State, Path}, http::StatusCode, Json};
use mongodb::{Database, bson::doc, bson::oid::ObjectId};
use serde::{Deserialize, Serialize};
use crate::models::user::{UserRole, Claims};
use crate::models::announcement::{Announcement, AnnouncementPriority, TargetType};
use chrono::{DateTime, Utc};
use futures_util::stream::StreamExt;

#[derive(Debug, Serialize, Clone)]
pub struct PublicAnnouncement {
    pub id: String,
    pub title: String,
    pub content: String,
    pub sender_id: String,
    pub sender_role: UserRole,
    pub target_type: TargetType,
    pub target_centers: Option<Vec<String>>,
    pub target_students: Option<Vec<String>>,
    pub target_center_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub priority: AnnouncementPriority,
    pub is_edited: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edited_at: Option<DateTime<Utc>>,
    pub category_id: Option<String>,
}

impl From<Announcement> for PublicAnnouncement {
    fn from(ann: Announcement) -> Self {
        PublicAnnouncement {
            id: ann.id.unwrap_or_else(|| ObjectId::new()).to_hex(),
            title: ann.title,
            content: ann.content,
            sender_id: ann.sender_id.to_hex(),
            sender_role: ann.sender_role,
            target_type: ann.target_type,
            target_centers: ann.target_centers.map(|vec| {
                vec.iter().map(|oid| oid.to_hex()).collect()
            }),
            target_students: ann.target_students.map(|vec| {
                vec.iter().map(|oid| oid.to_hex()).collect()
            }),
            target_center_id: ann.target_center_id.map(|oid| oid.to_hex()),
            created_at: ann.created_at,
            priority: ann.priority,
            is_edited: ann.is_edited,
            edited_at: ann.edited_at,
            category_id: ann.category_id.map(|oid| oid.to_hex()),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateAnnouncementRequest {
    pub title: String,
    pub content: String,
    pub target_type: TargetType,
    pub target_centers: Option<Vec<String>>, // Optional: center IDs as strings
    pub target_students: Option<Vec<String>>, // Optional: student IDs as strings
    pub priority: AnnouncementPriority,
    pub category_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AnnouncementResponse {
    pub success: bool,
    pub message: String,
}

pub async fn create_announcement(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateAnnouncementRequest>,
) -> (StatusCode, Json<AnnouncementResponse>) {
    println!("create_announcement called! Payload: {:?}", payload);
    println!("Claims role: {:?}", claims.role);
    
    let collection = db.collection::<Announcement>("announcements");
    let sender_id = ObjectId::parse_str(&claims.sub).unwrap();

    // Validate permissions
    let can_announce = match claims.role {
        UserRole::Admin | UserRole::SuperAdmin => true,
        UserRole::Center => {
            // Center can only target their own students
            payload.target_type == TargetType::SelectedStudents || 
            payload.target_type == TargetType::AllStudents // But we'll restrict to their own
        },
        _ => false
    };

    if !can_announce {
        println!("Permission denied!");
        return (StatusCode::FORBIDDEN, Json(AnnouncementResponse { 
            success: false, 
            message: "Unauthorized to create announcement".to_string() 
        }));
    }

    // Process target IDs
    let target_centers = payload.target_centers.map(|ids| {
        ids.iter()
            .filter_map(|id| ObjectId::parse_str(id).ok())
            .collect::<Vec<ObjectId>>()
    });
    
    let target_students = payload.target_students.map(|ids| {
        ids.iter()
            .filter_map(|id| ObjectId::parse_str(id).ok())
            .collect::<Vec<ObjectId>>()
    });

    let category_id = payload.category_id.and_then(|id| ObjectId::parse_str(&id).ok());
    let new_announcement = Announcement {
        id: None,
        title: payload.title,
        content: payload.content,
        sender_id,
        sender_role: claims.role.clone(),
        target_type: payload.target_type,
        target_centers,
        target_students,
        target_center_id: if claims.role == UserRole::Center { Some(sender_id) } else { None },
        created_at: Utc::now(),
        priority: payload.priority,
        is_edited: false,
        edited_at: None,
        category_id,
    };

    println!("Inserting announcement: {:?}", new_announcement);
    match collection.insert_one(new_announcement, None).await {
        Ok(_) => {
            println!("Announcement created successfully!");
            (StatusCode::CREATED, Json(AnnouncementResponse { success: true, message: "Announcement created successfully".to_string() }))
        },
        Err(e) => {
            println!("Error inserting announcement: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(AnnouncementResponse { success: false, message: "Failed to save announcement".to_string() }))
        },
    }
}

pub async fn get_announcements(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<PublicAnnouncement>>) {
    let collection = db.collection::<Announcement>("announcements");
    let user_id = ObjectId::parse_str(&claims.sub).unwrap();
    
    let mut filter = doc! {};

    match claims.role {
        UserRole::Admin | UserRole::SuperAdmin => {
            // Admins see all announcements
        }
        UserRole::Center => {
            // Centers see announcements for all centers or specifically for them
            filter = doc! {
                "$or": [
                    { "target_type": "allcenters" },
                    { "target_type": "allusers" },
                    { "target_type": "selectedcenters", "target_centers": user_id },
                ]
            };
        }
        UserRole::Student => {
            // Students see announcements targeted to them
            let user_collection = db.collection::<crate::models::user::User>("users");
            let mut parent_id: Option<ObjectId> = None;
            
            if let Ok(Some(student)) = user_collection.find_one(doc! { "_id": user_id }, None).await {
                parent_id = student.parent_id;
            }

            let mut or_conditions = vec![];
            or_conditions.push(doc! { "target_type": "allstudents" });
            or_conditions.push(doc! { "target_type": "allusers" });
            
            if let Some(pid) = parent_id {
                or_conditions.push(doc! { "target_type": "selectedcenters", "target_centers": pid });
                or_conditions.push(doc! { "target_center_id": pid }); // Legacy
            }
            
            or_conditions.push(doc! { "target_type": "selectedstudents", "target_students": user_id });
            
            filter = doc! { "$or": or_conditions };
        }
        _ => {}
    }

    // Sort by created_at descending
    let mut cursor = match collection.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut announcements = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(ann) = result {
            announcements.push(PublicAnnouncement::from(ann));
        }
    }
    
    // Sort in descending order of creation time
    announcements.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    
    (StatusCode::OK, Json(announcements))
}

pub async fn edit_announcement(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<CreateAnnouncementRequest>,
) -> (StatusCode, Json<AnnouncementResponse>) {
    let collection = db.collection::<Announcement>("announcements");
    
    // Validate permissions
    let can_edit = match claims.role {
        UserRole::Admin | UserRole::SuperAdmin => true,
        _ => false
    };
    
    if !can_edit {
        return (StatusCode::FORBIDDEN, Json(AnnouncementResponse { 
            success: false, 
            message: "Unauthorized to edit announcement".to_string() 
        }));
    }
    
    let obj_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(AnnouncementResponse {
            success: false,
            message: "Invalid announcement ID".to_string()
        }))
    };
    
    // Process target IDs
    let target_centers = payload.target_centers.map(|ids| {
        ids.iter()
            .filter_map(|id| ObjectId::parse_str(id).ok())
            .collect::<Vec<ObjectId>>()
    });
    
    let target_students = payload.target_students.map(|ids| {
        ids.iter()
            .filter_map(|id| ObjectId::parse_str(id).ok())
            .collect::<Vec<ObjectId>>()
    });
    
    // Manually convert TargetType and AnnouncementPriority to their lowercase string representations
    let target_type_str = match payload.target_type {
        crate::models::announcement::TargetType::AllCenters => "allcenters",
        crate::models::announcement::TargetType::AllStudents => "allstudents",
        crate::models::announcement::TargetType::AllUsers => "allusers",
        crate::models::announcement::TargetType::SelectedCenters => "selectedcenters",
        crate::models::announcement::TargetType::SelectedStudents => "selectedstudents",
        crate::models::announcement::TargetType::SelectedCentersAndStudents => "selectedcentersandstudents",
    };
    let priority_str = match payload.priority {
        crate::models::announcement::AnnouncementPriority::Low => "low",
        crate::models::announcement::AnnouncementPriority::Medium => "medium",
        crate::models::announcement::AnnouncementPriority::High => "high",
        crate::models::announcement::AnnouncementPriority::Urgent => "urgent",
    };
    let category_id = payload.category_id.and_then(|id| ObjectId::parse_str(&id).ok());
    let update = doc! {
        "$set": {
            "title": payload.title,
            "content": payload.content,
            "target_type": target_type_str,
            "target_centers": target_centers,
            "target_students": target_students,
            "priority": priority_str,
            "category_id": category_id,
            "is_edited": true,
            "edited_at": Utc::now()
        }
    };
    
    match collection.update_one(doc! { "_id": obj_id }, update, None).await {
        Ok(_) => (StatusCode::OK, Json(AnnouncementResponse { success: true, message: "Announcement updated successfully".to_string() })),
        Err(e) => {
            println!("Error updating announcement: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(AnnouncementResponse { success: false, message: "Failed to update announcement".to_string() }))
        }
    }
}

pub async fn delete_announcement(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<AnnouncementResponse>) {
    let collection = db.collection::<Announcement>("announcements");
    let obj_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(AnnouncementResponse {
            success: false,
            message: "Invalid announcement ID".to_string(),
        })),
    };

    let can_delete = match claims.role {
        UserRole::Admin | UserRole::SuperAdmin => true,
        UserRole::Center => {
            // Check if center owns this announcement
            let sender_id = ObjectId::parse_str(&claims.sub).unwrap_or_default();
            collection.find_one(doc! { "_id": obj_id, "sender_id": sender_id }, None).await.ok().flatten().is_some()
        },
        _ => false,
    };

    if !can_delete {
        return (StatusCode::FORBIDDEN, Json(AnnouncementResponse {
            success: false,
            message: "Unauthorized to delete this announcement".to_string(),
        }));
    }

    match collection.delete_one(doc! { "_id": obj_id }, None).await {
        Ok(_) => (StatusCode::OK, Json(AnnouncementResponse {
            success: true,
            message: "Announcement deleted successfully".to_string(),
        })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(AnnouncementResponse {
            success: false,
            message: "Failed to delete announcement".to_string(),
        })),
    }
}
