use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use aes_gcm::aead::{Aead, OsRng, AeadCore};
use typenum::U12;
use base64::{engine::general_purpose, Engine as _};
use std::env;

pub const SYSTEM_SETTINGS_SINGLETON_ID_HEX: &str = "000000000000000000000001";

pub fn system_settings_singleton_id() -> ObjectId {
    ObjectId::parse_str(SYSTEM_SETTINGS_SINGLETON_ID_HEX).unwrap_or_else(|_| ObjectId::new())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemSettings {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(default = "default_messaging_wall")]
    pub is_messaging_wall_enabled: bool, // If true, isolation is active
    #[serde(default = "default_max_disk_space")]
    pub max_disk_space_gb: f64,
    #[serde(default = "default_storage_warning")]
    pub storage_warning_threshold: f64, // e.g., 0.8 for 80%
    pub cursor_url: Option<String>,
    #[serde(default = "default_students_trained")]
    pub students_trained: i32,
    #[serde(default = "default_courses_offered")]
    pub courses_offered: i32,
    #[serde(default = "default_placements_done")]
    pub placements_done: i32,
    #[serde(default = "default_years_experience")]
    pub years_experience: i32,
    pub popup_enabled: Option<bool>,
    pub popup_title: Option<String>,
    pub popup_subtitle: Option<String>,
    pub popup_accent_text: Option<String>,
    pub popup_image_url: Option<String>,
    pub popup_bg_color: Option<String>, // e.g. "#004a89"
    pub popup_text_color: Option<String>,
    pub popup_button_text: Option<String>,
    pub popup_button_link: Option<String>,
    /// When true, new students linked to a center get an `id_cards` row after a delay (see below).
    #[serde(default = "default_auto_id_card_enabled")]
    pub auto_id_card_enabled: bool,
    /// Preferred ID card template (MongoDB hex `_id`). If empty, the oldest `id_card` template is used.
    #[serde(default)]
    pub auto_id_card_template_id: Option<String>,
    /// Wait this many minutes after registration before creating the ID card record.
    #[serde(default = "default_auto_id_card_delay_minutes")]
    pub auto_id_card_delay_minutes: u32,
    #[serde(default = "default_enrollment_prefix")]
    pub enrollment_prefix: String,
    #[serde(default = "default_roll_number_prefix")]
    pub roll_number_prefix: String,
    #[serde(default = "default_generate_roll_at_registration")]
    pub generate_roll_at_registration: bool,
    #[serde(default = "default_false")]
    pub maintenance_mode: bool,
    #[serde(default = "default_contact_phone")]
    pub contact_phone: String,
    #[serde(default = "default_contact_email")]
    pub contact_email: String,
    #[serde(default = "default_contact_address")]
    pub contact_address: String,
    #[serde(default = "default_contact_map_url")]
    pub contact_map_url: String,
    #[serde(default = "default_false")]
    pub auto_exam_enabled: bool,
    pub auto_exam_allotment_day: Option<i32>, // 1-31, the day to allot exams
    pub auto_exam_day: Option<i32>,           // 1-31, exam start day
    pub auto_exam_time: Option<String>,       // HH:MM in IST
    #[serde(default = "default_zero")]
    pub auto_exam_subject_gap_minutes: i32,
    #[serde(default = "default_zero")]
    pub auto_marksheet_generation_days: i32, // 0 = immediate
    #[serde(default = "default_zero")]
    pub auto_certificate_generation_days: i32, // 0 = immediate

    // Payment gateway settings (new fields)
    #[serde(default = "default_false")]
    pub payment_gateway_enabled: bool,
    pub razorpay_key_id: Option<String>,
    pub razorpay_key_secret_encrypted: Option<String>,
    pub razorpay_webhook_secret_encrypted: Option<String>,
    /// Country-wise fee rules: each entry maps a country code to a currency + multiplier
    #[serde(default)]
    pub country_fee_rules: Vec<CountryFeeRule>,
}

/// Maps a country code (e.g. "IN", "US", "GB") to a currency display config.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CountryFeeRule {
    /// ISO 3166-1 alpha-2 country code, e.g. "IN", "US"
    pub country_code: String,
    /// Country name for display, e.g. "India"
    pub country_name: String,
    /// Currency code, e.g. "INR", "USD"
    pub currency_code: String,
    /// Currency symbol, e.g. "₹", "$"
    pub currency_symbol: String,
    /// Fee multiplier relative to base INR fee, e.g. 1.0 for India, 0.012 for USD
    pub multiplier: f64,
}

fn default_false() -> bool {
    false
}
fn default_zero() -> i32 {
    0
}
fn default_messaging_wall() -> bool {
    true
}
fn default_max_disk_space() -> f64 {
    20.0
}
fn default_storage_warning() -> f64 {
    0.8
}
fn default_students_trained() -> i32 {
    5000
}
fn default_courses_offered() -> i32 {
    20
}
fn default_placements_done() -> i32 {
    3000
}
fn default_years_experience() -> i32 {
    10
}
fn default_contact_phone() -> String {
    "+91 94663 17100".to_string()
}
fn default_contact_email() -> String {
    "info@screduc.com".to_string()
}
fn default_contact_address() -> String {
    "# 785/10 Main Bazar Jeweler Market , opposite N.R, Jeweler, Jind, Haryana 126102".to_string()
}
fn default_contact_map_url() -> String {
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3500!2d76.8!3d28.9!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjjCsDU0JzAwLjAiTiA3NsKwNDgnMDAuMCJF!5e0!3m2!1sen!2sin!4v1".to_string()
}
fn default_auto_id_card_enabled() -> bool {
    false
}
fn default_auto_id_card_delay_minutes() -> u32 {
    15
}
fn default_enrollment_prefix() -> String {
    "SCRE/".to_string()
}
fn default_roll_number_prefix() -> String {
    "".to_string()
}
fn default_generate_roll_at_registration() -> bool {
    true
}

impl Default for SystemSettings {
    fn default() -> Self {
        Self {
            id: None,
            is_messaging_wall_enabled: true,
            max_disk_space_gb: 20.0,
            storage_warning_threshold: 0.8,
            cursor_url: None,
            students_trained: 5000,
            courses_offered: 20,
            placements_done: 3000,
            years_experience: 10,
            popup_enabled: Some(true),
            popup_title: Some("Admission Open".to_string()),
            popup_subtitle: Some("2026 - 2027".to_string()),
            popup_accent_text: Some("April 2026".to_string()),
            popup_image_url: None,
            popup_bg_color: Some("#004a89".to_string()),
            popup_text_color: Some("#ffffff".to_string()),
            popup_button_text: Some("Apply Now".to_string()),
            popup_button_link: Some("#contact".to_string()),
            auto_id_card_enabled: false,
            auto_id_card_template_id: None,
            auto_id_card_delay_minutes: 15,
            enrollment_prefix: "SCRE/".to_string(),
            roll_number_prefix: "".to_string(),
            generate_roll_at_registration: true,
            maintenance_mode: false,
            contact_phone: "+91 94663 17100".to_string(),
            contact_email: "info@screduc.com".to_string(),
            contact_address: "# 785/10 Main Bazar Jeweler Market , opposite N.R, Jeweler, Jind, Haryana 126102".to_string(),
            contact_map_url: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3500!2d76.8!3d28.9!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjjCsDU0JzAwLjAiTiA3NsKwNDgnMDAuMCJF!5e0!3m2!1sen!2sin!4v1".to_string(),
            auto_exam_enabled: false,
            auto_exam_allotment_day: None,
            auto_exam_day: None,
            auto_exam_time: None,
            auto_exam_subject_gap_minutes: 0,
            auto_marksheet_generation_days: 0,
            auto_certificate_generation_days: 0,
            payment_gateway_enabled: false,
            razorpay_key_id: None,
            razorpay_key_secret_encrypted: None,
            razorpay_webhook_secret_encrypted: None,
            country_fee_rules: Vec::new(),
        }
    }
}

// Encryption helpers
fn get_encryption_key() -> Result<[u8; 32], String> {
    let key_hex = env::var("ENCRYPTION_KEY").map_err(|e| format!("ENCRYPTION_KEY not set: {}", e))?;
    let key_bytes = hex::decode(key_hex).map_err(|e| format!("ENCRYPTION_KEY invalid hex: {}", e))?;
    if key_bytes.len() != 32 {
        return Err(format!("ENCRYPTION_KEY must be 32 bytes (64 hex characters), got {}", key_bytes.len()));
    }
    let mut key = [0u8; 32];
    key.copy_from_slice(&key_bytes);
    Ok(key)
}

fn encrypt_secret(secret: &str) -> Result<String, String> {
    let key = get_encryption_key()?;
    let cipher = Aes256Gcm::new(&key.into());
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher.encrypt(&nonce, secret.as_bytes()).map_err(|e| format!("encryption failed: {}", e))?;
    // Combine nonce and ciphertext: nonce (12 bytes) + ciphertext
    let mut combined = nonce.to_vec();
    combined.extend_from_slice(&ciphertext);
    Ok(general_purpose::STANDARD.encode(combined))
}

fn decrypt_secret(encrypted: &str) -> Option<String> {
    let key = match get_encryption_key() {
        Ok(k) => k,
        Err(_) => return None,
    };
    let cipher = Aes256Gcm::new(&key.into());
    let combined = general_purpose::STANDARD.decode(encrypted).ok()?;
    if combined.len() < 12 {
        return None;
    }
    let (nonce_bytes, ciphertext) = combined.split_at(12);
    // Create a Nonce (GenericArray<u8, U12>) from nonce_bytes
    let nonce: &Nonce<U12> = match <&Nonce<U12>>::try_from(nonce_bytes) {
        Ok(n) => n,
        Err(_) => return None,
    };
    let plaintext = cipher.decrypt(nonce, ciphertext).ok()?;
    String::from_utf8(plaintext).ok()
}

impl SystemSettings {
    pub fn set_razorpay_key_secret(&mut self, secret: &str) -> Result<(), String> {
        self.razorpay_key_secret_encrypted = Some(encrypt_secret(secret)?);
        Ok(())
    }
    
    pub fn get_razorpay_key_secret(&self) -> Option<String> {
        self.razorpay_key_secret_encrypted.as_ref().and_then(|s| decrypt_secret(s))
    }
    
    pub fn set_razorpay_webhook_secret(&mut self, secret: &str) -> Result<(), String> {
        self.razorpay_webhook_secret_encrypted = Some(encrypt_secret(secret)?);
        Ok(())
    }
    
    pub fn get_razorpay_webhook_secret(&self) -> Option<String> {
        self.razorpay_webhook_secret_encrypted.as_ref().and_then(|s| decrypt_secret(s))
    }
}
