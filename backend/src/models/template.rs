use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TemplateType {
    Certificate,
    Marksheet,
    IdCard,
}

impl TemplateType {
    pub fn to_str(&self) -> &'static str {
        match self {
            TemplateType::Certificate => "certificate",
            TemplateType::Marksheet => "marksheet",
            TemplateType::IdCard => "id_card",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PageSize {
    A4,
    A3,
    Letter,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PageOrientation {
    Portrait,
    Landscape,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Template {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub template_name: String,
    pub template_type: TemplateType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub course_category_id: Option<ObjectId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub course_id: Option<ObjectId>,
    #[serde(default)]
    pub default_design: bool,
    #[serde(default = "default_page_size")]
    pub page_size: PageSize,
    #[serde(default = "default_orientation")]
    pub orientation: PageOrientation,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background_image: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logo_left: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logo_right: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub authority_signature: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub admin_signature: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub admin_stamp: Option<String>,
}

fn default_page_size() -> PageSize {
    PageSize::A4
}

fn default_orientation() -> PageOrientation {
    PageOrientation::Portrait
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateField {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub template_id: ObjectId,
    pub field_name: String,
    pub field_type: String, // text, photo, qr_code, custom_text, marks_table
    pub x_position: f64,
    pub y_position: f64,
    pub width: f64,
    pub height: f64,
    #[serde(default = "default_font_size")]
    pub font_size: f64,
    #[serde(default = "default_font_family")]
    pub font_family: String,
    #[serde(default = "default_color")]
    pub color: String,
    #[serde(default = "default_text_align")]
    pub text_align: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_text: Option<String>,
    /// For marks_table: column definitions as JSON array
    #[serde(skip_serializing_if = "Option::is_none")]
    pub table_columns: Option<Vec<String>>,
}

fn default_font_size() -> f64 {
    14.0
}

fn default_font_family() -> String {
    "Arial".to_string()
}

fn default_color() -> String {
    "#000000".to_string()
}

fn default_text_align() -> String {
    "left".to_string()
}
