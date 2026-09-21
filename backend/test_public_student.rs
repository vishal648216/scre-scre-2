
use mongodb::bson::{doc, oid::ObjectId};
use serde_json;

// Let's copy the User and PublicStudent structs!

use mongodb::bson;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum UserRole {
    SuperAdmin,
    Admin,
    Center,
    Student,
    Staff,
    Intern,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub username: String,
    pub password_hash: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw_password: Option<String>,
    pub role: UserRole,
    #[serde(default)]
    pub parent_id: Option<ObjectId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub full_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub middle_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub course: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub father_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mother_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dob: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gender: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub national_id_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub national_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub city: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub district: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pincode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub other_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emergency_contact_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emergency_contact_phone: Option<String>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emergency_contact_relation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub additional_docs: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enrollment_number: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub serial_number: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub photo_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signature_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub national_id_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub highest_qualification: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub college: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub admission_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exam_mode: Option<String>,
    #[serde(default)]
    pub session_id: Option<ObjectId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_start_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_end_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_status: Option<String>,
    #[serde(default)]
    pub marks: Option<Vec<()>>,
    #[serde(default = "default_active")]
    pub active: bool,
    #[serde(default)]
    pub is_deleted: bool,
    #[serde(default)]
    #[serde(with = "crate::models::serde_helpers::optional_flexible_datetime")]
    pub deleted_at: Option<()>,
    #[serde(with = "crate::models::serde_helpers::flexible_datetime")]
    #[serde(default = "chrono::Utc::now")]
    pub created_at: (),
    #[serde(default)]
    pub course_id: Option<ObjectId>,
    #[serde(default)]
    pub registration_date: Option<String>,
    #[serde(default)]
    pub roll_number: Option<String>,
    #[serde(default)]
    pub batch_id: Option<ObjectId>,
    #[serde(default)]
    pub current_unit: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub referral_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub referred_by_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub applied_coupon: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub course_category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub other_doc_url: Option<String>,
    #[serde(default)]
    pub is_email_verified: bool,
    #[serde(default)]
    pub is_deleted_by_center_final: bool,
    #[serde(default)]
    pub total_fees: Option<f64>,
    #[serde(default)]
    pub extra_charges: Option<f64>,
    #[serde(default)]
    pub grand_total: Option<f64>,
    #[serde(default)]
    pub fee_breakdown: Option<Vec<()>>,
}

fn default_active() -> bool {
    true
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PublicStudent {
    pub id: String,
    pub username: String,
    pub role: UserRole,
    pub parent_id: Option<String>,
    pub full_name: Option<String>,
    pub first_name: Option<String>,
    pub middle_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub course: Option<String>,
    pub enrollment_number: Option<String>,
    pub active: bool,
    pub address: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub district: Option<String>,
    pub country: Option<String>,
    pub pincode: Option<String>,
    pub national_id_type: Option<String>,
    pub national_id: Option<String>,
    pub national_id_url: Option<String>,
    pub signature_url: Option<String>,
    pub additional_docs: Option<String>,
    pub course_id: Option<String>,
    pub roll_number: Option<String>,
    pub registration_date: Option<String>,
    pub photo_url: Option<String>,
    pub session_start_date: Option<String>,
    pub session_end_date: Option<String>,
    pub course_category: Option<String>,
    pub batch_id: Option<String>,
    pub session_id: Option<String>,
    pub father_name: Option<String>,
    pub mother_name: Option<String>,
    pub dob: Option<String>,
    pub gender: Option<String>,
    pub category: Option<String>,
    pub other_address: Option<String>,
    pub emergency_contact_name: Option<String>,
    pub emergency_contact_phone: Option<String>,
    pub emergency_contact_relation: Option<String>,
    pub highest_qualification: Option<String>,
    pub admission_mode: Option<String>,
    pub exam_mode: Option<String>,
    pub current_unit: Option<String>,
    pub total_fees: Option<f64>,
    pub extra_charges: Option<f64>,
    pub grand_total: Option<f64>,
    pub fee_breakdown: Option<Vec<()>>,
}

impl From<User> for PublicStudent {
    fn from(u: User) -> Self {
        PublicStudent {
            id: u.id.unwrap_or_default().to_hex(),
            username: u.username,
            role: u.role,
            parent_id: u.parent_id.map(|oid| oid.to_hex()),
            full_name: u.full_name,
            first_name: u.first_name,
            middle_name: u.middle_name,
            last_name: u.last_name,
            email: u.email,
            phone: u.phone,
            course: u.course,
            enrollment_number: u.enrollment_number,
            active: u.active,
            address: u.address,
            city: u.city,
            state: u.state,
            district: u.district,
            country: u.country,
            pincode: u.pincode,
            national_id_type: u.national_id_type,
            national_id: u.national_id,
            national_id_url: u.national_id_url,
            signature_url: u.signature_url,
            additional_docs: u.additional_docs,
            course_id: u.course_id.map(|oid| oid.to_hex()),
            roll_number: u.roll_number,
            registration_date: u.registration_date,
            photo_url: u.photo_url,
            session_start_date: u.session_start_date,
            session_end_date: u.session_end_date,
            course_category: u.course_category,
            batch_id: u.batch_id.map(|oid| oid.to_hex()),
            session_id: u.session_id.map(|oid| oid.to_hex()),
            father_name: u.father_name,
            mother_name: u.mother_name,
            dob: u.dob,
            gender: u.gender,
            category: u.category,
            other_address: u.other_address,
            emergency_contact_name: u.emergency_contact_name,
            emergency_contact_phone: u.emergency_contact_phone,
            emergency_contact_relation: u.emergency_contact_relation,
            highest_qualification: u.highest_qualification,
            admission_mode: u.admission_mode,
            exam_mode: u.exam_mode,
            current_unit: u.current_unit,
            total_fees: u.total_fees,
            extra_charges: u.extra_charges,
            grand_total: u.grand_total,
            fee_breakdown: u.fee_breakdown,
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Let's create a mock user similar to teststudent1!
    let test_user_doc = bson::doc! {
        "_id": ObjectId::parse_str("6a34465f8c5fb3e3c4e77916")?,
        "username": "teststudent1",
        "password_hash": "test",
        "role": "student",
        "parent_id": ObjectId::parse_str("6a00b7ece2a8130b1a507dac")?,
        "full_name": "Test Student One",
        "first_name": "Test",
        "middle_name": "",
        "last_name": "Student",
        "email": "teststudent1@example.com",
        "phone": "9876543210",
        "course": "Basic Computer Course",
        "father_name": "Test Father",
        "mother_name": "Test Mother",
        "dob": "2000-01-01",
        "gender": "Male",
        "category": "General",
        "national_id_type": "Aadhaar",
        "national_id": "123456789012",
        "address": "123 Test Street",
        "city": "Test City",
        "state": "Test State",
        "district": "Test District",
        "country": "India",
        "pincode": "123456",
        "emergency_contact_name": "Test Contact",
        "emergency_contact_phone": "9876543211",
        "emergency_contact_relation": "Father",
        "enrollment_number": "SCRE-TEST-1781810783",
        "serial_number": "1",
        "highest_qualification": "10th",
        "admission_mode": "Direct",
        "exam_mode": "Online",
        "session_id": ObjectId::parse_str("69f1b5a9d48945fb547adf45")?,
        "session_start_date": "2025-06-01",
        "session_end_date": "2026-05-31",
        "approval_status": "Approved",
        "marks": null,
        "active": true,
        "is_deleted": false,
        "deleted_at": null,
        "created_at": "2026-06-18T19:26:23.435Z",
        "course_id": ObjectId::parse_str("69f1b5a9d48945fb547adf44")?,
        "registration_date": "2026-06-18",
        "roll_number": "ROLL-TEST-001",
        "batch_id": ObjectId::parse_str("69f1b5a9d48945fb547adf43")?,
        "course_category": "Computer",
        "total_fees": 5000.0,
        "extra_charges": 500.0,
        "grand_total": 5500.0,
        "fee_breakdown": null,
    };
    let test_user: User = bson::from_document(test_user_doc)?;
    let public_student = PublicStudent::from(test_user);
    println!("=== PublicStudent JSON ===");
    println!("{}", serde_json::to_string_pretty(&public_student)?);
    Ok(())
}
