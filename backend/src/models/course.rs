use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Course {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(default)]
    pub category_id: ObjectId,
    pub course_name: String,
    pub course_code: String,
    #[serde(default)]
    pub slug: String,
    #[serde(default)]
    pub short_code: String,
    #[serde(default)]
    pub duration_months: u32,
    /// display duration (when > 0); otherwise UI falls back to duration_months as months
    #[serde(default)]
    pub duration_value: u32,
    /// "months" | "years" | "weeks" | "days" | "hours"
    #[serde(default)]
    pub duration_unit: String,
    /// degree | diploma | crash_course | certification
    #[serde(default)]
    pub course_type: String,
    pub description: Option<String>,
    pub image_url: Option<String>,
    /// Social / Open Graph preview image (optional)
    #[serde(default)]
    pub og_image_url: Option<String>,
    pub syllabus: Option<String>,
    pub fees: Option<i32>,
    pub registration_fee: Option<i32>,
    #[serde(default)]
    pub exam_fees_applicable: bool,
    #[serde(default)]
    pub exam_fee_amount: Option<i32>,
    #[serde(default)]
    pub backlog_fees_applicable: bool,
    #[serde(default)]
    pub backlog_fee_amount: Option<i32>,
    #[serde(default, alias = "hasCourseStructureUnits")]
    pub has_course_structure_units: bool,
    #[serde(default, alias = "unitType")]
    pub unit_type: Option<String>, // "quarterly" | "semesters" | "yearly" | "custom"
    #[serde(default, alias = "unitCount")]
    pub unit_count: Option<u32>,
    #[serde(default, alias = "customUnitName")]
    pub custom_unit_name: Option<String>, // only if unit_type is "custom"
    pub eligibility: Option<String>,
    #[serde(default = "default_status")]
    pub status: String, // "active", "inactive"
    /// Shown on the public home page “Courses we offer” carousel (max 4, enforced in admin update).
    #[serde(default)]
    pub featured_on_home: bool,
    /// Lower numbers appear first among featured courses.
    #[serde(default)]
    pub home_feature_order: u32,
    /// When true, enrolled students may use linked typing lessons (or languages from typing allotment).
    #[serde(default)]
    pub typing_tests_enabled: bool,
    /// When true, students see mock tests mapped under Mock Tests for their course/subjects.
    #[serde(default)]
    pub mock_tests_enabled: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub linked_typing_tests: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub linked_mock_tests: Vec<ObjectId>,
    #[serde(default = "chrono::Utc::now")]
    #[serde(with = "crate::models::serde_helpers::rfc3339_datetime")]
    pub created_at: DateTime<Utc>,
}

fn default_status() -> String {
    "active".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AllottedCourse {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub center_id: ObjectId,
    pub course_id: ObjectId,
    #[serde(with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub allotted_at: DateTime<Utc>,
}
