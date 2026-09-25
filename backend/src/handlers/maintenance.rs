use crate::models::user::{Claims, UserRole};
use axum::{Json, extract::State, http::StatusCode};
use chrono::Utc;
use mongodb::{
    Database,
    bson::{DateTime as BsonDateTime, doc, oid::ObjectId},
};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct PurgeResponse {
    pub success: bool,
    pub message: String,
}

pub async fn simulate_exam_flow(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<PurgeResponse>) {
    if claims.role != UserRole::SuperAdmin && claims.role != UserRole::Admin {
        return (
            StatusCode::FORBIDDEN,
            Json(PurgeResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    // 1. Cleanup
    let users_coll = db.collection::<mongodb::bson::Document>("users");
    let courses_coll = db.collection::<mongodb::bson::Document>("courses");
    let subjects_coll = db.collection::<mongodb::bson::Document>("subjects");
    let course_subjects_coll = db.collection::<mongodb::bson::Document>("course_subjects");
    let exam_v2_papers_coll = db.collection::<mongodb::bson::Document>("exam_v2_papers");
    let exam_v2_exams_coll = db.collection::<mongodb::bson::Document>("exam_v2_exams");
    let exam_v2_tpl_coll = db.collection::<mongodb::bson::Document>("exam_v2_paper_templates");
    let certs_coll = db.collection::<mongodb::bson::Document>("certificates");

    let _ = users_coll
        .delete_many(doc! { "role": "student" }, None)
        .await;
    let _ = exam_v2_papers_coll.delete_many(doc! {}, None).await;
    let _ = exam_v2_exams_coll.delete_many(doc! {}, None).await;
    let _ = certs_coll.delete_many(doc! {}, None).await;

    // 2. Setup Course and Subjects
    let course_id = ObjectId::new();
    let course = doc! {
        "_id": &course_id,
        "course_name": "Simulated IT Diploma",
        "course_code": "SIM-IT-001",
        "duration_months": 12,
        "total_fees": 15000.0,
        "is_active": true,
        "created_at": BsonDateTime::now(),
        "short_code": "SIM-IT",
        "duration_value": 1,
        "duration_unit": "Year",
        "course_type": "Diploma",
        "status": "active",
    };
    let _ = courses_coll.insert_one(course, None).await;

    let sub_names = vec![
        "Computer Fundamentals",
        "Web Development",
        "Python Programming",
    ];
    let mut sub_ids = Vec::new();
    for name in sub_names {
        let sid = ObjectId::new();
        let sub = doc! {
            "_id": &sid,
            "subject_name": name,
            "subject_code": format!("SUB-{}", name.replace(" ", "-").to_uppercase()),
            "created_at": BsonDateTime::now(),
        };
        let _ = subjects_coll.insert_one(sub, None).await;
        let _ = course_subjects_coll
            .insert_one(
                doc! {
                    "course_id": &course_id,
                    "subject_id": &sid,
                    "semester": 1,
                    "is_elective": false,
                },
                None,
            )
            .await;
        sub_ids.push(sid);
    }

    // 3. Create Student
    let student_id = ObjectId::new();
    let student = doc! {
        "_id": &student_id,
        "username": "test_student",
        "password_hash": "none",
        "role": "student",
        "full_name": "Dipanshu Mehra (Simulated)",
        "email": "student@example.com",
        "is_active": true,
        "course_id": &course_id,
        "course": "Simulated IT Diploma",
        "enrollment_number": "SC-SIM-2026001",
        "registration_date": Utc::now().to_rfc3339(),
        "father_name": "Jai Singh",
        "mother_name": "Sunita",
        "dob": "2000-01-12",
        "gender": "Male",
        "address": "Simulation City",
        "session_start_date": "2025-01-01",
        "session_end_date": "2028-01-01",
    };
    let _ = users_coll.insert_one(student, None).await;

    // 4. Create Paper Template & Exams & Evaluated Papers
    let tpl_id = ObjectId::new();
    let tpl = doc! {
        "_id": &tpl_id,
        "name": "Simulated Template",
        "question_bank_id": ObjectId::new(),
        "subject_id": &sub_ids[0],
        "total_marks": 20.0,
        "passing_marks": 8.0,
        "duration_minutes": 30,
        "max_attempts": 1,
        "created_at": BsonDateTime::now(),
        "created_by": ObjectId::new(),
        "sections": [
            {
                "name": "Main Section",
                "marks": 2.0,
                "count": 10,
                "negative_marks": 0.0,
            }
        ],
        "practical_enabled": false,
        "assignment_enabled": false,
        "exam_marks": 20.0,
    };
    let _ = exam_v2_tpl_coll.insert_one(tpl, None).await;

    for sid in sub_ids {
        let exam_id = ObjectId::new();
        let exam = doc! {
            "_id": &exam_id,
            "name": format!("Final Exam: {}", sid),
            "course_id": &course_id,
            "session_id": ObjectId::new(),
            "paper_template_id": &tpl_id,
            "center_ids": [],
            "exam_mode": "online",
            "result_mode": "instant",
            "start_at": Utc::now().to_rfc3339(),
            "end_at": (Utc::now() + chrono::Duration::hours(24)).to_rfc3339(),
            "attendance_date": Utc::now().to_rfc3339(),
            "require_attendance": false,
            "status": "active",
            "created_at": BsonDateTime::now(),
        };
        let _ = exam_v2_exams_coll.insert_one(exam, None).await;

        // Create Evaluated Paper
        let score = (13 + (student_id.to_hex().chars().next().unwrap() as u32 % 3)) as f64;
        let paper = doc! {
            "exam_id": &exam_id,
            "student_id": &student_id,
            "paper_template_id": &tpl_id,
            "status": "evaluated",
            "start_time": BsonDateTime::now(),
            "submit_time": BsonDateTime::now(),
            "total_obtained_marks": score,
            "section_wise_marks": {
                "Main Section": score
            },
            "security_events": [],
            "server_deadline_ms": 0,
            "attendance_satisfied": true,
            "center_id": ObjectId::new(),
            "created_at": BsonDateTime::now(),
        };
        let _ = exam_v2_papers_coll.insert_one(paper, None).await;
    }

    (StatusCode::OK, Json(PurgeResponse { success: true, message: "Simulation complete: Purged users, created course, test student, and 3 evaluated exams (13-15 marks)".to_string() }))
}

pub async fn purge_students(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<PurgeResponse>) {
    if claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(PurgeResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let users = db.collection::<mongodb::bson::Document>("users");
    let certs = db.collection::<mongodb::bson::Document>("certificates");
    let results = db.collection::<mongodb::bson::Document>("exam_results");
    let marksheets = db.collection::<mongodb::bson::Document>("marksheets");

    // Delete all students
    let _ = users.delete_many(doc! { "role": "student" }, None).await;
    // Also delete their related data to avoid orphans
    let _ = certs.delete_many(doc! {}, None).await;
    let _ = results.delete_many(doc! {}, None).await;
    let _ = marksheets.delete_many(doc! {}, None).await;

    (
        StatusCode::OK,
        Json(PurgeResponse {
            success: true,
            message: "Purged all students and related records (certificates, results, marksheets)"
                .to_string(),
        }),
    )
}

pub async fn purge_centers_students(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<PurgeResponse>) {
    if claims.role != UserRole::SuperAdmin {
        return (
            StatusCode::FORBIDDEN,
            Json(PurgeResponse {
                success: false,
                message: "Unauthorized".to_string(),
            }),
        );
    }

    let users = db.collection::<mongodb::bson::Document>("users");
    let centers = db.collection::<mongodb::bson::Document>("centers");

    let _ = users
        .delete_many(doc! { "role": { "$in": ["center", "student"] } }, None)
        .await;
    let _ = centers.delete_many(doc! {}, None).await;

    (
        StatusCode::OK,
        Json(PurgeResponse {
            success: true,
            message: "Purged all centers and center/student users".to_string(),
        }),
    )
}
