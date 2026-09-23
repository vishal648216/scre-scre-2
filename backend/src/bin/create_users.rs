use backend::models::user::{User, UserRole};
use backend::db::connect_db;
use bcrypt::{hash, DEFAULT_COST};
use mongodb::bson::doc;

#[tokio::main]
async fn main() {
    let (_client, db) = connect_db().await;
    let collection = db.collection::<User>("users");

    let users_to_create = vec![
        ("admin", "password", UserRole::Admin),
        ("center", "password", UserRole::Center),
        ("staff", "password", UserRole::Staff),
    ];

    for (username, password, role) in users_to_create {
        collection.delete_one(doc! { "username": username }, None).await.expect("Failed to delete user");

        let hashed_password = hash(password, DEFAULT_COST).expect("hashing failed");

        let new_user = User {
            id: None,
            username: username.to_string(),
            password_hash: hashed_password.clone(),
            raw_password: Some(password.to_string()),
            role: role,
            parent_id: None,
            full_name: Some(format!("{} User", username)),
            first_name: None,
            middle_name: None,
            last_name: None,
            email: Some(format!("{}@example.com", username)),
            phone: Some("1234567890".to_string()),
            course: None,
            father_name: None,
            mother_name: None,
            dob: None,
            gender: None,
            category: None,
            national_id_type: None,
            national_id: None,
            address: None,
            city: None,
            state: None,
            district: None,
            country: None,
            pincode: None,
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
            approval_status: Some("approved".to_string()),
            marks: None,
            active: true,
            is_deleted: false,
            deleted_at: None,
            created_at: chrono::Utc::now(),
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

        collection.insert_one(new_user, None).await.expect("Failed to insert user");
        println!("User {} created successfully", username);
    }
}
