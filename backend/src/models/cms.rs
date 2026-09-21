use chrono::{DateTime, Utc};
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CMSType {
    Page,
    Slider,
    Gallery,
    Teacher,
    Partner,
    Download,
    Verification,
    Ticker,
    Faq,
    IdCardTemplate,
    Shop,
    DirectorMessage,
    GalleryCategory,
    Heropartners,
    Student,
    University,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CMSItem {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub category: CMSType,
    pub title: String,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub mobile_image_url: Option<String>,
    pub link: Option<String>,
    pub content: Option<String>, // For pages
    pub order: i32,
    pub active: bool,
    // Category specific fields
    pub designation: Option<String>,          // For teachers
    pub specialization: Option<String>,       // For teachers
    pub education: Option<String>,            // For teachers
    pub note: Option<String>,                 // For students
    pub role: Option<String>,                 // For students
    pub student_description: Option<String>,  // For students
    pub file_size: Option<String>,            // For downloads
    pub file_type: Option<String>,            // For downloads
    pub button_text: Option<String>,          // For sliders
    pub tag: Option<String>,                  // For sliders (e.g. "🎓 Admissions Open")
    pub highlight: Option<String>,            // For sliders (e.g. "IT & Skill")
    pub show_view_courses: Option<bool>,      // For sliders
    pub show_stats: Option<bool>,             // For sliders
    pub view_courses_button_text: Option<String>, // For sliders
    pub view_courses_button_link: Option<String>, // For sliders
    pub stat1_text: Option<String>,           // For sliders
    pub stat2_text: Option<String>,           // For sliders
    pub stat3_text: Option<String>,           // For sliders
    pub stat4_text: Option<String>,           // For sliders
    pub pdf_url: Option<String>,              // For verification
    pub video_url: Option<String>,            // For gallery/youtube clips
    pub price: Option<f64>,                   // For shop items
    pub download_category_id: Option<String>, // For downloads
    pub is_featured: Option<bool>,            // For gallery/home
    pub is_main: Option<bool>,                // For gallery/home
    #[serde(
        default,
        with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime_optional"
    )]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime_optional"
    )]
    pub updated_at: Option<DateTime<Utc>>,
}
