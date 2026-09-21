//! Centralized role checks for RBAC.
use crate::models::user::{Claims, UserRole};

/// Super-admin or admin only (dashboard admin APIs).
pub fn require_admin(claims: &Claims) -> bool {
    matches!(
        claims.role,
        UserRole::SuperAdmin | UserRole::Admin
    )
}

/// Users who may view global course–subject mappings (not students).
pub fn can_view_all_course_mappings(claims: &Claims) -> bool {
    matches!(
        claims.role,
        UserRole::SuperAdmin | UserRole::Admin | UserRole::Center | UserRole::Staff
    )
}
