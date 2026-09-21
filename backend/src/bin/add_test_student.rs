
use backend::db::connect_db;
use backend::models::user::{User, UserRole};
use mongodb::bson::oid::ObjectId;
use chrono::Utc;
use bcrypt::{hash, DEFAULT_COST};

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    let (_client, db) = connect_db().await;

    let center_id_str = "6a00b7ece2a8130b1a507dad"; // SCRE-0004 center ID
    let center_id = ObjectId::parse_str(center_id_str).unwrap();

    let password = "Test1234";
    let hashed_password = hash(password, DEFAULT_COST).unwrap();
    let current_time = Utc::now();
    let user_id = ObjectId::new();

    let new_user = User {
        id: Some(user_id),
        username: "teststudent1".to_string(),
        password_hash: hashed_password,
        raw_password: Some(password.to_string()),
        role: UserRole::Student,
        parent_id: Some(center_id),
        full_name: Some("Test Student One".to_string()),
        first_name: Some("Test".to_string()),
        middle_name: Some("".to_string()),
        last_name: Some("Student".to_string()),
        email: Some("teststudent1@example.com".to_string()),
        phone: Some("9876543210".to_string()),
        course: Some("Basic Computer Course".to_string()),
        father_name: Some("Test Father".to_string()),
        mother_name: Some("Test Mother".to_string()),
        dob: Some("2000-01-01".to_string()),
        gender: Some("Male".to_string()),
        category: Some("General".to_string()),
        national_id_type: Some("Aadhaar".to_string()),
        national_id: Some("123456789012".to_string()),
        address: Some("123 Test Street".to_string()),
        city: Some("Test City".to_string()),
        state: Some("Test State".to_string()),
        district: Some("Test District".to_string()),
        country: Some("India".to_string()),
        pincode: Some("123456".to_string()),
        other_address: None,
        emergency_contact_name: Some("Test Contact".to_string()),
        emergency_contact_phone: Some("9876543211".to_string()),
        emergency_contact_relation: Some("Father".to_string()),
        additional_docs: None,
        enrollment_number: Some(format!("SCRE-TEST-{}", Utc::now().timestamp())),
        photo_url: None,
        signature_url: None,
        national_id_url: None,
        highest_qualification: Some("10th".to_string()),
        college: None,
        admission_mode: Some("Direct".to_string()),
        exam_mode: Some("Online".to_string()),
        session_id: Some(ObjectId::parse_str("69f1b5a9d48945fb547adf45").unwrap()), // A sample session ID
        session_start_date: Some("2025-06-01".to_string()),
        session_end_date: Some("2026-05-31".to_string()),
        approval_status: Some("Approved".to_string()),
        marks: None,
        active: true,
        is_deleted: false,
        deleted_at: None,
        created_at: current_time,
        course_id: Some(ObjectId::parse_str("69f1b5a9d48945fb547adf44").unwrap()), // A sample course ID
        registration_date: Some(current_time.date_naive().to_string()),
        roll_number: Some("ROLL-TEST-001".to_string()),
        serial_number: Some("1".to_string()),
        batch_id: Some(ObjectId::parse_str("69f1b5a9d48945fb547adf43").unwrap()), // A sample batch ID
        referral_code: None,
        referred_by_code: None,
        applied_coupon: None,
        course_category: Some("Computer".to_string()),
        current_unit: None,
        other_doc_url: None,
        updated_at: Some(current_time),
        is_email_verified: true,
        is_deleted_by_center_final: false,
        internship_domain: None,
        internship_mode: None,
        total_fees: Some(5000.0),
        extra_charges: Some(500.0),
        grand_total: Some(5500.0),
        fee_breakdown: Some(vec![
            backend::models::user::FeeBreakdownItem {
                name: "Course Fee".to_string(),
                amount: 5000.0,
                description: Some("Base course fee".to_string()),
            },
            backend::models::user::FeeBreakdownItem {
                name: "Exam Fee".to_string(),
                amount: 500.0,
                description: Some("Exam charges".to_string()),
            },
        ]),
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

    let users_coll = db.collection::<User>("users");
    let result = users_coll.insert_one(new_user, None).await;
    match result {
        Ok(_) => println!("Test student added successfully! Username: teststudent1, Password: Test1234"),
        Err(e) => println!("Error adding test student: {}", e),
    }
}
