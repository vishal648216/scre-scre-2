use chrono::{DateTime, Utc};
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CertificateType {
    Certificate,
    Marksheet,
}

impl CertificateType {
    pub fn to_str(&self) -> &'static str {
        match self {
            CertificateType::Certificate => "certificate",
            CertificateType::Marksheet => "marksheet",
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Certificate {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub student_id: ObjectId,
    pub center_id: ObjectId,
    pub course: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub course_id: Option<ObjectId>,
    pub certificate_no: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub center_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub center_signature_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub center_stamp_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub admin_signature_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub admin_stamp_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signature_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stamp_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background_url: Option<String>,
    #[serde(with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub issued_on: DateTime<Utc>,
    /// draft = empty (no sign/stamp), pending_approval = center applied, scheduled = admin approved but not issued yet, approved = issued
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime_optional")]
    pub scheduled_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub template_id: Option<ObjectId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub verification_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pdf_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    #[serde(default = "default_certificate_type")]
    pub certificate_type: CertificateType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attempt_number: Option<i32>,
}

fn default_certificate_type() -> CertificateType {
    CertificateType::Certificate
}
