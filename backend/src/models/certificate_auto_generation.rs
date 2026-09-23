use mongodb::bson::{oid::ObjectId, DateTime};
use serde::{Deserialize, Serialize};
use crate::models::certificate::CertificateType;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CertificateEligibility {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub student_id: ObjectId,
    pub course_id: ObjectId,
    pub eligibility_type: CertificateType,
    /// For marksheet, this is the attempt number; for certificate, this is None
    pub attempt_number: Option<i32>,
    pub eligible_at: DateTime,
    pub processed: bool,
    pub processed_at: Option<DateTime>,
    #[serde(default = "mongodb::bson::DateTime::now")]
    pub created_at: DateTime,
    #[serde(default = "mongodb::bson::DateTime::now")]
    pub updated_at: DateTime,
}
