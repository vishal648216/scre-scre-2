use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NotificationGatewayConfig {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub whatsapp_enabled: bool,
    pub whatsapp_provider: String, // "meta_cloud", "twilio", "ultramsg", "generic_webhook"
    pub whatsapp_api_key: String,
    pub whatsapp_sender_number: String,
    pub whatsapp_template_admission: String,
    pub whatsapp_template_admit_card: String,
    pub whatsapp_template_marksheet: String,
    pub whatsapp_template_fee: String,
    pub whatsapp_template_birthday: String,

    pub sms_enabled: bool,
    pub sms_provider: String, // "fast2sms", "msg91", "twilio", "generic_webhook"
    pub sms_api_key: String,
    pub sms_sender_id: String, // e.g. "SCREIN"
    pub sms_template_admission: String,
    pub sms_template_admit_card: String,
    pub sms_template_marksheet: String,
    pub sms_template_fee: String,
    pub sms_template_birthday: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<DateTime<Utc>>,
}

impl Default for NotificationGatewayConfig {
    fn default() -> Self {
        Self {
            id: None,
            whatsapp_enabled: true,
            whatsapp_provider: "meta_cloud".to_string(),
            whatsapp_api_key: "SCRE_WHATSAPP_SANDBOX_KEY".to_string(),
            whatsapp_sender_number: "+919876543210".to_string(),
            whatsapp_template_admission: "Dear {name}, Congratulations! Your admission for {course} has been confirmed. Enrollment No: {enrollment}. SCRE Academy".to_string(),
            whatsapp_template_admit_card: "Dear {name}, Your Admit Card for {exam_title} is issued. Exam Date: {date}, Center: {center}. Best of luck! SCRE Academy".to_string(),
            whatsapp_template_marksheet: "Dear {name}, Your official marksheet/certificate for {course} is released. Grade: {grade}, Percentage: {percentage}%. Download from your portal. SCRE".to_string(),
            whatsapp_template_fee: "Dear {name}, We have received your fee payment of Rs. {amount} for {course}. Receipt No: {receipt_no}. Thank you! SCRE Academy".to_string(),
            whatsapp_template_birthday: "Happy Birthday {name}! Wishing you joy, health, and a successful career. Warm regards from the entire SCRE Academy family! 🎂🎉".to_string(),

            sms_enabled: true,
            sms_provider: "fast2sms".to_string(),
            sms_api_key: "SCRE_SMS_SANDBOX_KEY".to_string(),
            sms_sender_id: "SCREIN".to_string(),
            sms_template_admission: "SCRE: Admission confirmed for {name}, Course: {course}, Roll: {roll}. Check portal for details.".to_string(),
            sms_template_admit_card: "SCRE: Hall Ticket issued for {exam_title}. Date: {date}. Download from student dashboard.".to_string(),
            sms_template_marksheet: "SCRE: Results out for {course}. Grade: {grade}. Verify online at screduc.com.".to_string(),
            sms_template_fee: "SCRE: Fee payment of Rs {amount} received for {course}. Receipt #{receipt_no}.".to_string(),
            sms_template_birthday: "SCRE wishes {name} a very Happy Birthday! May you achieve great success in your learning journey! 🎂".to_string(),

            updated_at: Some(Utc::now()),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NotificationLog {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub channel: String, // "whatsapp" | "sms"
    pub recipient: String,
    pub template_type: String, // "admission" | "admit_card" | "marksheet" | "fee" | "birthday" | "custom_test"
    pub message: String,
    pub status: String, // "sent" | "simulated" | "failed"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_response: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct SendTestNotificationRequest {
    pub channel: String,
    pub recipient: String,
    pub template_type: String,
    pub recipient_name: Option<String>,
    pub custom_message: Option<String>,
}
