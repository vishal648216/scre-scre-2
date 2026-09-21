//! Create or update dedicated Exam / E2E accounts (center + student). Idempotent.
//!
//! Load the same `.env` as the API (`MONGODB_URI`, `DATABASE_NAME`).
//!
//! Required:
//! - `E2E_CENTER_USER`, `E2E_CENTER_PASS`
//! - `E2E_STUDENT_USER`, `E2E_STUDENT_PASS`
//! - `E2E_COURSE_ID` — 24-char hex; stored on the student `course` field (and center allotment).
//!
//! Optional:
//! - `E2E_BOOTSTRAP_ADMIN_USERNAME` — existing admin/superadmin username used as `centers.admin_id`
//!   (default: first `superadmin` in `users`).
//!
//! After run, set `E2E_CENTER_ID` to the printed **center login user** ObjectId (not `centers._id`)
//! for `scripts/live_exam_v2_e2e.py`.

use backend::db::{connect_db, get_next_sequence};
use backend::models::center::Center;
use backend::models::user::{User, UserRole};
use bcrypt::{DEFAULT_COST, hash};
use chrono::Utc;
use mongodb::bson::doc;
use mongodb::bson::oid::ObjectId;
use std::env;

#[tokio::main]
async fn main() {
    let (_client, db) = connect_db().await;
    let users = db.collection::<User>("users");
    let centers = db.collection::<Center>("centers");

    let center_user = env::var("E2E_CENTER_USER").expect("E2E_CENTER_USER must be set");
    let center_pass = env::var("E2E_CENTER_PASS").expect("E2E_CENTER_PASS must be set");
    let student_user = env::var("E2E_STUDENT_USER").expect("E2E_STUDENT_USER must be set");
    let student_pass = env::var("E2E_STUDENT_PASS").expect("E2E_STUDENT_PASS must be set");
    let course_id_hex = env::var("E2E_COURSE_ID").expect("E2E_COURSE_ID must be set");
    let _ =
        ObjectId::parse_str(&course_id_hex).expect("E2E_COURSE_ID must be a valid ObjectId hex");

    let admin_filter = if let Ok(u) = env::var("E2E_BOOTSTRAP_ADMIN_USERNAME") {
        doc! {
            "username": u,
            "$or": [ { "role": "superadmin" }, { "role": "admin" } ]
        }
    } else {
        doc! { "role": "superadmin" }
    };

    let admin = users
        .find_one(admin_filter, None)
        .await
        .expect("users query failed")
        .expect("No bootstrap admin found. Create superadmin first or set E2E_BOOTSTRAP_ADMIN_USERNAME.");
    let admin_id = admin.id.expect("admin user missing _id");

    let ph_center = hash(&center_pass, DEFAULT_COST).expect("bcrypt center");
    let ph_student = hash(&student_pass, DEFAULT_COST).expect("bcrypt student");

    let center_user_oid = match users
        .find_one(doc! { "username": &center_user }, None)
        .await
        .expect("find center user")
    {
        Some(mut u) => {
            let id = u.id.expect("center user id");
            u.password_hash = ph_center.clone();
            u.role = UserRole::Center;
            u.parent_id = Some(admin_id);
            u.full_name = Some("E2E Exam Center Account".to_string());
            u.active = true;
            u.is_deleted = false;
            u.deleted_at = None;
            users
                .replace_one(doc! { "_id": id }, u, None)
                .await
                .expect("replace center user");
            id
        }
        None => {
            let new_u = User {
                id: None,
                username: center_user.clone(),
                password_hash: ph_center,
                raw_password: Some(center_pass.clone()),
                role: UserRole::Center,
                parent_id: Some(admin_id),
                full_name: Some("E2E Exam Center Account".to_string()),
                first_name: None,
                middle_name: None,
                last_name: None,
                email: Some("e2e-center@local.test".to_string()),
                phone: Some("9999999999".to_string()),
                course: None,
                father_name: None,
                mother_name: None,
                dob: None,
                gender: None,
                category: None,
                national_id_type: None,
                national_id: None,
                address: Some("E2E".to_string()),
                city: Some("E2E".to_string()),
                state: Some("E2E".to_string()),
                district: None,
                country: Some("IN".to_string()),
                pincode: Some("000000".to_string()),
                other_address: None,
                emergency_contact_name: None,
                emergency_contact_phone: None,
                emergency_contact_relation: None,
                additional_docs: None,
                enrollment_number: None,
                serial_number: None,
                photo_url: None,
                signature_url: None,
                national_id_url: None,
                highest_qualification: None,
                college: None,
                admission_mode: None,
                exam_mode: None,
                session_id: None,
                session_start_date: None,
                session_end_date: None,
                approval_status: None,
                marks: None,
                active: true,
                is_deleted: false,
                deleted_at: None,
                created_at: Utc::now(),
                course_id: None,
                registration_date: None,
                roll_number: None,
                batch_id: None,
                referral_code: None,
                referred_by_code: None,
                applied_coupon: None,
                course_category: None,
                enrolled_courses: None,
                current_unit: None,
                other_doc_url: None,
                updated_at: None,
                is_email_verified: false,
                is_deleted_by_center_final: false,
                internship_domain: None,
                internship_mode: None,
                total_fees: None,
                extra_charges: None,
                grand_total: None,
                fee_breakdown: None,
                payment_type: None,
                is_payment_type_locked: false,
                installments: None,
                extra_charges_list: None,
        due_date: None,
        remarks: None,
        sub_admin_role_id: None,
        sub_admin_role_name: None,
        sub_admin_permissions: None,
    };
            users
                .insert_one(new_u, None)
                .await
                .expect("insert center user")
                .inserted_id
                .as_object_id()
                .expect("center user oid")
        }
    };

    let center_code = format!(
        "E2E{:05}",
        (get_next_sequence(&db, "e2e_center_code").await % 100_000).max(1)
    );

    match centers
        .find_one(doc! { "user_id": center_user_oid }, None)
        .await
        .expect("find center doc")
    {
        Some(mut c) => {
            c.active = true;
            c.is_deleted = false;
            c.admin_id = admin_id;
            c.course_allotment = vec![course_id_hex.clone()];
            let id = c.id.expect("center id");
            centers
                .replace_one(doc! { "_id": id }, c, None)
                .await
                .expect("replace center");
        }
        None => {
            let c = Center {
                id: None,
                name: "E2E Exam Center".to_string(),
                code: center_code,
                owner_name: "E2E Owner".to_string(),
                about_center: None,
                phone: "9999999999".to_string(),
                email: "e2e-center@local.test".to_string(),
                address: "E2E Address".to_string(),
                city: "E2E".to_string(),
                district: None,
                state: "E2E".to_string(),
                center_code: None,
                discount_coupon: None,
                referral_code: None,
                location: None,
                infrastructure: None,
                course_allotment: vec![course_id_hex.clone()],
                bank_details: None,
                documents: vec![],
                key_documents: None,
                branding_media: None,
                working_hours: None,
                config_validity: None,
                admin_id,
                user_id: center_user_oid,
                active: true,
                is_deleted: false,
                deleted_at: None,
                permanent_delete_at: None,
                is_email_verified: true,
                email_verified_at: Some(Utc::now()),
                created_at: Utc::now(),
            };
            centers.insert_one(c, None).await.expect("insert center");
        }
    }

    let reg_seq = get_next_sequence(&db, "registration_no").await;
    let reg_no = format!("SCRE{:04}", (reg_seq % 10_000).max(1));

    match users
        .find_one(doc! { "username": &student_user }, None)
        .await
        .expect("find student")
    {
        Some(mut u) => {
            u.password_hash = ph_student.clone();
            u.role = UserRole::Student;
            u.parent_id = Some(center_user_oid);
            u.course = Some(course_id_hex.clone());
            u.active = true;
            u.is_deleted = false;
            u.deleted_at = None;
            u.approval_status = Some("approved".to_string());
            u.full_name = Some("E2E Exam Student".to_string());
            if u.enrollment_number.is_none() {
                u.enrollment_number = Some(reg_no.clone());
            }
            let id = u.id.expect("student id");
            users
                .replace_one(doc! { "_id": id }, u, None)
                .await
                .expect("replace student");
        }
        None => {
            let new_u = User {
                id: None,
                username: student_user.clone(),
                password_hash: ph_student,
                raw_password: Some(student_pass.clone()),
                role: UserRole::Student,
                parent_id: Some(center_user_oid),
                full_name: Some("E2E Exam Student Account".to_string()),
                first_name: None,
                middle_name: None,
                last_name: None,
                email: Some("e2e-student@local.test".to_string()),
                phone: Some("8888888888".to_string()),
                course: Some(course_id_hex.clone()),
                father_name: None,
                mother_name: None,
                dob: None,
                gender: None,
                category: None,
                national_id_type: None,
                national_id: None,
                address: Some("E2E Student".to_string()),
                city: Some("E2E".to_string()),
                state: Some("E2E".to_string()),
                district: None,
                country: Some("IN".to_string()),
                pincode: Some("000000".to_string()),
                other_address: None,
                emergency_contact_name: None,
                emergency_contact_phone: None,
                emergency_contact_relation: None,
                additional_docs: None,
                enrollment_number: Some(reg_no.clone()),
                serial_number: None,
                photo_url: None,
                signature_url: None,
                national_id_url: None,
                highest_qualification: None,
                college: None,
                admission_mode: None,
                exam_mode: None,
                session_id: None,
                session_start_date: None,
                session_end_date: None,
                approval_status: Some("approved".to_string()),
                marks: None,
                active: true,
                is_deleted: false,
                deleted_at: None,
                created_at: Utc::now(),
                course_id: None,
                registration_date: None,
                roll_number: Some("E2E-ROLL-001".to_string()),
                batch_id: None,
                referral_code: None,
                referred_by_code: None,
                applied_coupon: None,
                course_category: None,
                enrolled_courses: None,
                current_unit: None,
                other_doc_url: None,
                updated_at: None,
                is_email_verified: false,
                is_deleted_by_center_final: false,
                internship_domain: None,
                internship_mode: None,
                total_fees: None,
                extra_charges: None,
                grand_total: None,
                fee_breakdown: None,
                payment_type: None,
                is_payment_type_locked: false,
                installments: None,
                extra_charges_list: None,
        due_date: None,
        remarks: None,
        sub_admin_role_id: None,
        sub_admin_role_name: None,
        sub_admin_permissions: None,
    };
            users.insert_one(new_u, None).await.expect("insert student");
        }
    }

    println!("create_exam_e2e_accounts: OK");
    println!("  Center login username: {}", center_user);
    println!("  Student login username: {}", student_user);
    println!("  Course id on student: {}", course_id_hex);
    println!("  Export for live_exam_v2_e2e.py (center_id = center **user** id):");
    println!("    export E2E_CENTER_ID=\"{}\"", center_user_oid.to_hex());
}
