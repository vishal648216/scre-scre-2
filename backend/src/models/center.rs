use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct CenterLocation {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(alias = "District")]
    pub district: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub city: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub maps_embed_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pincode: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CenterInfrastructure {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub computers: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub classrooms: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub staff: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lab_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub internet_available: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub power_backup: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CenterBankDetails {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bank_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_number: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ifsc_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_holder: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branch_address: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CenterDocumentItem {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub number: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CenterKeyDocuments {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth_letter_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub owner_photo_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub owner_signature_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub center_stamp_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CenterBrandingMedia {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub center_logo_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub banner_image_url: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub gallery_urls: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub qr_code_1_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub qr_code_2_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub director_video_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub short_clip_url: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub short_clip_urls: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CenterWorkingHours {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opening_time: Option<String>, // "HH:MM"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub closing_time: Option<String>, // "HH:MM"
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub working_days: Vec<String>, // ["Mon", "Tue", ...]
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CenterConfigValidity {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub creation_date: Option<String>, // ISO date
    #[serde(skip_serializing_if = "Option::is_none")]
    pub validity_date: Option<String>, // ISO date
    #[serde(skip_serializing_if = "Option::is_none")]
    pub franchise_fee: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub royalty_percent: Option<f64>,
    #[serde(default)]
    pub mock_test_enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mock_test_start_date: Option<String>, // ISO date
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mock_test_end_date: Option<String>, // ISO date
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Center {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    pub code: String, // Unique center code
    pub owner_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub about_center: Option<String>,
    pub phone: String,
    pub email: String,
    pub address: String,
    pub city: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub district: Option<String>,
    pub state: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub center_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub discount_coupon: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub referral_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<CenterLocation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub infrastructure: Option<CenterInfrastructure>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub course_allotment: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bank_details: Option<CenterBankDetails>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub documents: Vec<CenterDocumentItem>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key_documents: Option<CenterKeyDocuments>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branding_media: Option<CenterBrandingMedia>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub working_hours: Option<CenterWorkingHours>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config_validity: Option<CenterConfigValidity>,
    pub admin_id: ObjectId, // The Admin who created/owns this center
    pub user_id: ObjectId,  // Linked user account for login
    #[serde(default = "default_active")]
    pub active: bool,
    #[serde(default)]
    pub is_deleted: bool,
    #[serde(default, with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime_optional")]
    pub deleted_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default, with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime_optional")]
    pub permanent_delete_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub is_email_verified: bool,
    #[serde(default, with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime_optional")]
    pub email_verified_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub created_at: chrono::DateTime<chrono::Utc>,
}

fn default_active() -> bool {
    true
}
