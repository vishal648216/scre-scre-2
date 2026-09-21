use std::collections::HashMap;

use axum::{extract::State, http::StatusCode, Json};
use futures_util::TryStreamExt;
use mongodb::bson::oid::ObjectId;
use mongodb::{Database, bson::doc};

use crate::models::course::Course;
use crate::models::erp_student::{ErpStudent, SubjectMarks as ErpSubjectMarks};
use crate::models::user::{Claims, UserRole};

/// GET /erp/students — students for certificate/marksheet issuance.
/// Always sourced from **`users`** (role `student`, not deleted), same as the student list,
/// so the Issue Documents page stays in sync. Optional `erp_students` collection is not used
/// for this list (it previously blocked the user fallback when non-empty).
pub async fn get_erp_students(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<ErpStudent>>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin && claims.role != UserRole::Center {
        return (StatusCode::FORBIDDEN, Json(Vec::new()));
    }

    students_from_users(State(db), claims).await
}

async fn load_course_name_map(db: &Database) -> HashMap<String, String> {
    let coll = db.collection::<Course>("courses");
    let Ok(cursor) = coll.find(doc! {}, None).await else {
        return HashMap::new();
    };
    let Ok(rows): Result<Vec<Course>, _> = cursor.try_collect().await else {
        return HashMap::new();
    };
    let mut m = HashMap::new();
    for c in rows {
        if let Some(id) = c.id {
            m.insert(id.to_hex(), c.course_name);
        }
    }
    m
}

fn resolve_course_field(
    raw: &Option<String>,
    names: &HashMap<String, String>,
) -> (Option<String>, Option<String>) {
    let Some(raw) = raw.as_ref() else {
        return (None, None);
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return (None, None);
    }
    if let Ok(oid) = ObjectId::parse_str(trimmed) {
        let hex = oid.to_hex();
        let display = names.get(&hex).cloned().unwrap_or_else(|| trimmed.to_string());
        return (Some(display), Some(hex));
    }
    (Some(trimmed.to_string()), None)
}

/// Map users with role=student to ErpStudent format for integration
async fn students_from_users(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<ErpStudent>>) {
    use crate::models::user::User;

    let mut filter = if claims.role == UserRole::SuperAdmin || claims.role == UserRole::Admin {
        doc! { "role": "student" }
    } else {
        let center_id = match ObjectId::parse_str(&claims.sub) {
            Ok(o) => o,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
        };
        doc! { "role": "student", "parent_id": center_id }
    };
    filter.insert("is_deleted", doc! { "$ne": true });

    let course_names = load_course_name_map(&db).await;

    let coll = db.collection::<User>("users");
    let cursor = match coll.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let users: Vec<User> = cursor.try_collect().await.unwrap_or_default();
    let centers_coll = db.collection::<crate::models::center::Center>("centers");

    let mut students: Vec<ErpStudent> = Vec::new();
    for u in users {
        let mut center_name = None;
        if let Some(parent_id) = u.parent_id {
            if let Ok(Some(c)) = centers_coll.find_one(doc! { "user_id": parent_id }, None).await {
                center_name = Some(c.name);
            }
        }

        let (course, course_id) = resolve_course_field(&u.course, &course_names);

        let marks: Option<Vec<ErpSubjectMarks>> = u.marks.as_ref().map(|rows| {
            rows.iter()
                .map(|m| ErpSubjectMarks {
                    subject: m.subject.clone(),
                    marks: m.marks,
                    total: m.total,
                })
                .collect()
        });

        students.push(ErpStudent {
            id: u.id,
            student_name: u.full_name.clone().unwrap_or_else(|| u.username.clone()),
            father_name: u.father_name.clone(),
            mother_name: u.mother_name.clone(),
            dob: u.dob.clone(),
            registration_number: u.username.clone(),
            course,
            course_id,
            session_from: None,
            session_to: None,
            institute: center_name.clone(),
            photo: u.photo_url.clone(),
            center_id: u.parent_id.clone(),
            center_name,
            created_at: Some(u.created_at),
            marks,
        });
    }

    (StatusCode::OK, Json(students))
}
