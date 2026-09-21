use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StaffPermissions {
    pub can_manage_students: bool,
    pub can_manage_attendance: bool,
    pub can_manage_fees: bool,
    pub can_manage_courses: bool,
    pub can_manage_exams: bool,
    pub can_view_reports: bool,
    pub can_manage_staff: bool, // Can this staff add other staff?
}

impl Default for StaffPermissions {
    fn default() -> Self {
        Self {
            can_manage_students: false,
            can_manage_attendance: false,
            can_manage_fees: false,
            can_manage_courses: false,
            can_manage_exams: false,
            can_view_reports: false,
            can_manage_staff: false,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Staff {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub user_id: ObjectId, // Link to User collection
    pub parent_id: ObjectId, // ID of the Admin or Center that created this staff
    pub parent_role: String, // "admin" or "center"
    pub name: String,
    pub designation: String, // e.g., "Peon", "Teacher", "Accountant"
    pub role_type: String, // "peon", "teacher", "center_admin", "alternate_staff"
    pub permissions: StaffPermissions,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub status: String, // "active", "inactive"
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
pub struct ModulePermissionAction {
    #[serde(default)]
    pub view: bool,
    #[serde(default)]
    pub add: bool,
    #[serde(default)]
    pub edit: bool,
    #[serde(default)]
    pub delete: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct SubAdminPermissions {
    #[serde(default)]
    pub centers: ModulePermissionAction,
    #[serde(default)]
    pub students: ModulePermissionAction,
    #[serde(default)]
    pub finance: ModulePermissionAction,
    #[serde(default)]
    pub courses: ModulePermissionAction,
    #[serde(default)]
    pub exams: ModulePermissionAction,
    #[serde(default)]
    pub staff: ModulePermissionAction,
    #[serde(default)]
    pub leads: ModulePermissionAction,
    #[serde(default)]
    pub cms: ModulePermissionAction,
    #[serde(default)]
    pub settings: ModulePermissionAction,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubAdminRole {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    pub description: String,
    pub permissions: SubAdminPermissions,
    pub is_system: Option<bool>,
    #[serde(with = "crate::models::serde_helpers::flexible_datetime")]
    #[serde(default = "Utc::now")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "crate::models::serde_helpers::flexible_datetime")]
    #[serde(default = "Utc::now")]
    pub updated_at: DateTime<Utc>,
}
