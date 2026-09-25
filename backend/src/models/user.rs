use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize, Deserializer};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum UserRole {
    SuperAdmin,
    Admin,
    Center,
    #[default]
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
    pub sub_admin_role_id: Option<ObjectId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sub_admin_role_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sub_admin_permissions: Option<crate::models::staff::SubAdminPermissions>,
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
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_status: Option<String>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub admin_instructions: Option<String>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority_centers: Option<Vec<String>>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_priority: Option<i32>,
    /// Marks for marksheet: [{ "subject": "Math", "marks": 85, "total": 100 }]
    #[serde(default)]
    pub marks: Option<Vec<SubjectMarks>>,
    #[serde(deserialize_with = "deserialize_bool_or_null")]
    #[serde(default = "default_active")]
    pub active: bool,
    #[serde(default)]
    pub is_deleted: bool,
    #[serde(default)]
    #[serde(with = "crate::models::serde_helpers::optional_flexible_datetime")]
    pub deleted_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(with = "crate::models::serde_helpers::flexible_datetime")]
    #[serde(default = "chrono::Utc::now")]
    pub created_at: chrono::DateTime<chrono::Utc>,
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
    #[serde(default)]
    pub enrolled_courses: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub other_doc_url: Option<String>,
    #[serde(with = "crate::models::serde_helpers::optional_flexible_datetime")]
    #[serde(default)]
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(deserialize_with = "deserialize_bool_or_null")]
    #[serde(default)]
    pub is_email_verified: bool,
    #[serde(deserialize_with = "deserialize_bool_or_null")]
    #[serde(default)]
    pub is_deleted_by_center_final: bool,
    // Intern-specific fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub internship_domain: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub internship_mode: Option<String>,
    // Fees
    #[serde(default)]
    pub total_fees: Option<f64>,
    #[serde(default)]
    pub extra_charges: Option<f64>,
    #[serde(default)]
    pub grand_total: Option<f64>,
    #[serde(default)]
    pub fee_breakdown: Option<Vec<FeeBreakdownItem>>,
    // New payment structure fields
    #[serde(default)]
    pub payment_type: Option<String>, // "one_time" or "installments"
    #[serde(default)]
    pub is_payment_type_locked: bool,
    #[serde(default)]
    pub installments: Option<Vec<Installment>>,
    #[serde(default)]
    pub extra_charges_list: Option<Vec<ExtraCharge>>,
    // Due date for student's fee payment
    #[serde(default)]
    pub due_date: Option<String>,
    // Remarks for student
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remarks: Option<String>,
}

impl Default for User {
    fn default() -> Self {
        Self {
            id: None,
            username: String::new(),
            password_hash: String::new(),
            raw_password: None,
            role: UserRole::Student,
            parent_id: None,
            sub_admin_role_id: None,
            sub_admin_role_name: None,
            sub_admin_permissions: None,
            full_name: None,
            first_name: None,
            middle_name: None,
            last_name: None,
            email: None,
            phone: None,
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
            approval_status: None,
            status: None,
            admin_instructions: None,
            priority_centers: None,
            current_priority: None,
            marks: None,
            active: true,
            is_deleted: false,
            deleted_at: None,
            created_at: chrono::Utc::now(),
            course_id: None,
            registration_date: None,
            roll_number: None,
            batch_id: None,
            current_unit: None,
            referral_code: None,
            referred_by_code: None,
            applied_coupon: None,
            course_category: None,
            enrolled_courses: None,
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
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Installment {
    pub installment_number: u32,
    pub amount_due: f64,
    pub due_date: String,
    pub payment_date: Option<String>,
    pub amount_paid: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExtraCharge {
    #[serde(default = "generate_extra_charge_id")]
    pub id: String,
    pub name: String,
    pub amount: f64,
    pub paid_amount: f64,
}

fn generate_extra_charge_id() -> String {
    use uuid::Uuid;
    Uuid::new_v4().to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FeeBreakdownItem {
    pub name: String,
    pub amount: f64,
    pub description: Option<String>,
}

fn default_active() -> bool {
    true
}

fn deserialize_bool_or_null<'de, D: Deserializer<'de>>(deserializer: D) -> Result<bool, D::Error> {
    
    let opt = Option::deserialize(deserializer)?;
    Ok(opt.unwrap_or(false))
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String, // user_id
    pub username: String,
    pub role: UserRole,
    pub exp: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubjectMarks {
    pub subject: String,
    pub marks: f64,
    pub total: f64,
}
