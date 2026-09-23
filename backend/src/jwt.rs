use crate::models::user::Claims;
use jsonwebtoken::{decode, DecodingKey, Validation};
use axum::http::StatusCode;

/// Decode and validate a JWT strictly.
///
/// Security goals:
/// - signature verified
/// - expiry enforced
/// - role required
/// - invalid tokens rejected with 401
pub fn decode_jwt(token: &str) -> Result<Claims, StatusCode> {
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "default_secret_key_change_me".to_string());
    if jwt_secret.trim().is_empty() {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Current system uses HS256 (secret-based) tokens.
    let mut validation = Validation::new(jsonwebtoken::Algorithm::HS256);
    validation.validate_exp = true;
    validation.leeway = 0;
    // `jsonwebtoken` will reject tokens with missing/invalid claims during decode.

    let decoded = decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_ref()),
        &validation,
    )
    .map_err(|_| StatusCode::UNAUTHORIZED)?;

    // Basic sanity: role must not be empty (enum covers this) and username must exist.
    // Also prevents any unexpected zeroed claims.
    if decoded.claims.username.trim().is_empty() {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Keep as-is; handlers will enforce RBAC.
    Ok(decoded.claims)
}

