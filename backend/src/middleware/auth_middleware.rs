// use crate::jwt::decode_jwt;
// use crate::models::user::{Claims, UserRole};
// use crate::services::translation_service::{IpRateLimit, check_rate_limit};
// use crate::util::http::client_ip;
// use axum::http::Request;
// use axum::{
//     body::Body,
//     http::{Method, StatusCode, header::AUTHORIZATION},
//     middleware::Next,
//     response::{IntoResponse, Response},
// };

// fn is_public_path(path: &str) -> bool {
//     path.starts_with("/api/public/")
//         || path == "/api/public"
//         || path.starts_with("/api/auth/")
//         || path == "/api/auth"
//         || path == "/api/health"
//         || path == "/rss.xml"
//         || path == "/sitemap.xml"
//         || path.starts_with("/api/cms")
//         || path.starts_with("/api/download-categories")
//         || (path.starts_with("/api/blogs") && !path.contains("/api/admin"))
//         || (path.starts_with("/api/news") && !path.contains("/api/admin"))
//         || (path.starts_with("/api/blog-categories") && !path.contains("/api/admin"))
//         || path == "/api/content"
//         || path == "/api/translate"
//         || path == "/api/translate/bulk"
//         || path == "/api/contact"
//         || path == "/api/public/maintenance/simulate-exam-flow-v2"
//         || path == "/api/coupons/validate"
//         || path == "/api/referrals/validate"
//         || path == "/api/interns/check-email"
//         || path == "/api/interns/check-enrollment"
//         || path == "/api/interns/check-serial"

//         // ADD THIS
//         || path.starts_with("/api/certificates/download/")
// }

// fn is_allowed_public_method(path: &str, method: &Method) -> bool {
//         // PUBLIC CERTIFICATE DOWNLOAD
//     if path.starts_with("/api/certificates/download/")
//         && method == Method::GET
//     {
//         return true;
//     }
//     // Marketing read endpoints
//     if (path.starts_with("/api/cms")
//         || path.starts_with("/api/download-categories")
//         || path.starts_with("/api/blogs")
//         || path.starts_with("/api/news")
//         || path.starts_with("/api/blog-categories")
//         || path == "/api/content")
//         && method == Method::GET
//     {
//         return true;
//     }
//     if (path == "/rss.xml" || path == "/sitemap.xml" || path == "/api/health")
//         && method == Method::GET
//     {
//         return true;
//     }
//     if path == "/api/coupons/validate" && method == Method::GET {
//         return true;
//     }
//     if path == "/api/referrals/validate" && method == Method::POST {
//         return true;
//     }
//     if (path == "/api/interns/check-email"
//         || path == "/api/interns/check-enrollment"
//         || path == "/api/interns/check-serial")
//         && method == Method::GET
//     {
//         return true;
//     }
//     // Public mutation endpoints that are spam/abuse protected by handlers.
//     if (path == "/api/contact") && method == Method::POST {
//         return true;
//     }
//     if (path == "/api/translate"
//         || path == "/api/translate/bulk"
//         || path == "/api/content"
//         || path == "/api/contact"
//         || path == "/api/public/maintenance/simulate-exam-flow-v2"
//         || path == "/api/admin/maintenance/simulate-exam-flow-v2")
//         && method == Method::POST
//     {
//         return true;
//     }
//     // Default allow for /api/public/* and /api/auth/*
//     path.starts_with("/api/public/") || path.starts_with("/api/auth/")
// }

// fn requires_admin(path: &str) -> bool {
//     path.starts_with("/api/admin/") || path.starts_with("/api/system/")
// }

// fn is_any_api_path(path: &str) -> bool {
//     path.starts_with("/api/")
// }

// pub async fn auth_middleware(mut req: Request<Body>, next: Next) -> Response {
//     let path = req.uri().path().to_string();
//     let method = req.method().clone();

//     if !is_any_api_path(&path) {
//         return next.run(req).await;
//     }

//     // Explicit allowlist: never deny these without auth.
//     println!("Checking auth for path: {} method: {}", path, method);
//     if is_public_path(&path) && is_allowed_public_method(&path, &method) {
//         println!("Path is public: {}", path);
//         // Rate limit anonymous public scraping (enumeration protection).
//         if path.starts_with("/api/public/") {
//             let ip = client_ip(req.headers());
//             let (limit, window) = if path.starts_with("/api/public/centers/") {
//                 (20u32, 60u64)
//             } else {
//                 (60u32, 60u64)
//             };
//             let limiter = IpRateLimit {
//                 limit,
//                 window: std::time::Duration::from_secs(window),
//             };
//             let key = format!("public:{ip}:{path}");
//             if !check_rate_limit(&key, &limiter) {
//                 println!(
//                     "{{\"type\":\"rate_limited\",\"ip\":\"{}\",\"path\":\"{}\",\"limit\":{},\"window_s\":{}}}",
//                     ip, path, limit, window
//                 );
//                 return (
//                     StatusCode::TOO_MANY_REQUESTS,
//                     axum::Json(serde_json::json!({
//                         "success": false,
//                         "message": "Too many requests"
//                     })),
//                 )
//                     .into_response();
//             }
//         }

//         return next.run(req).await;
//     }

//     // Default deny for any other /api/* unless it matches explicit allow rules.
//     // For admin/system, require admin/superadmin.
//     let auth_header = req
//         .headers()
//         .get(AUTHORIZATION)
//         .and_then(|v| v.to_str().ok());
//     let token = auth_header.and_then(|v| v.strip_prefix("Bearer "));

//     let token = match token {
//         Some(t) if !t.trim().is_empty() => t,
//         _ => {
//             let ip = client_ip(req.headers());
//             println!(
//                 "{{\"type\":\"unauthorized\",\"ip\":\"{}\",\"path\":\"{}\",\"reason\":\"missing_or_invalid_bearer\"}}",
//                 ip, path
//             );
//             return (
//                 StatusCode::UNAUTHORIZED,
//                 axum::Json(serde_json::json!({"success": false, "message": "Unauthorized"})),
//             )
//                 .into_response();
//         }
//     };

//     let claims = match decode_jwt(token) {
//         Ok(c) => c,
//         Err(code) => {
//             let ip = client_ip(req.headers());
//             println!(
//                 "{{\"type\":\"unauthorized\",\"ip\":\"{}\",\"path\":\"{}\",\"reason\":\"jwt_decode_failed\"}}",
//                 ip, path
//             );
//             return (
//                 code,
//                 axum::Json(serde_json::json!({"success": false, "message": "Unauthorized"})),
//             )
//                 .into_response();
//         }
//     };

//     if requires_admin(&path) {
//         // Allow GET on subjects and batches for all authenticated users (students/centers need this)
//         let is_subjects_get = path == "/api/admin/subjects" && method == Method::GET;
//         let is_batches_get = path == "/api/batches" && method == Method::GET;
//         let is_enquiries = path.starts_with("/api/admin/enquiries");

//         let allowed = matches!(claims.role, UserRole::SuperAdmin | UserRole::Admin | UserRole::Center)
//             || is_subjects_get
//             || is_batches_get;
//         if !allowed {
//             let ip = client_ip(req.headers());
//             println!(
//                 "{{\"type\":\"forbidden\",\"ip\":\"{}\",\"path\":\"{}\",\"role\":\"{:?}\"}}",
//                 ip, path, claims.role
//             );
//             return (
//                 StatusCode::FORBIDDEN,
//                 axum::Json(serde_json::json!({"success": false, "message": "Forbidden"})),
//             )
//                 .into_response();
//         }
//     }

//     // Attach validated claims for handler extractors.
//     req.extensions_mut().insert::<Claims>(claims);
//     next.run(req).await
// }
use crate::jwt::decode_jwt;
use crate::models::user::{Claims, UserRole};
use crate::services::translation_service::{check_rate_limit, IpRateLimit};
use crate::util::http::client_ip;

use axum::http::Request;
use axum::{
    body::Body,
    http::{header::AUTHORIZATION, Method, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};

fn is_public_path(path: &str) -> bool {
    path.starts_with("/api/public/")
        || path == "/api/public"
        || path.starts_with("/api/auth/")
        || path == "/api/auth"
        || path == "/api/health"
        || path == "/rss.xml"
        || path == "/sitemap.xml"
        || path.starts_with("/api/cms")
        || path.starts_with("/api/download-categories")
        || (path.starts_with("/api/blogs") && !path.contains("/api/admin"))
        || (path.starts_with("/api/news") && !path.contains("/api/admin"))
        || (path.starts_with("/api/blog-categories") && !path.contains("/api/admin"))
        || path == "/api/content"
        || path == "/api/translate"
        || path == "/api/translate/bulk"
        || path == "/api/contact"
        || path == "/api/public/maintenance/simulate-exam-flow-v2"
        || path == "/api/coupons/validate"
        || path == "/api/referrals/validate"
        || path == "/api/interns/check-email"
        || path == "/api/interns/check-enrollment"
        || path == "/api/interns/check-serial"
        || path == "/api/internships"

        // Public certificate download
        || path.starts_with("/api/certificates/download/")
}

fn is_allowed_public_method(path: &str, method: &Method) -> bool {
    // ---------------------------------------------------------
    // Public certificate download
    // ---------------------------------------------------------
    if path.starts_with("/api/certificates/download/")
        && *method == Method::GET
    {
        return true;
    }

    // ---------------------------------------------------------
    // Marketing read endpoints
    // ---------------------------------------------------------
    if (path.starts_with("/api/cms")
        || path.starts_with("/api/download-categories")
        || path.starts_with("/api/blogs")
        || path.starts_with("/api/news")
        || path.starts_with("/api/blog-categories")
        || path == "/api/content")
        && *method == Method::GET
    {
        return true;
    }

    // ---------------------------------------------------------
    // Basic public GET endpoints
    // ---------------------------------------------------------
    if (path == "/rss.xml"
        || path == "/sitemap.xml"
        || path == "/api/health"
        || path == "/api/internships")
        && *method == Method::GET
    {
        return true;
    }

    // ---------------------------------------------------------
    // Coupon validation
    // ---------------------------------------------------------
    if path == "/api/coupons/validate"
        && *method == Method::GET
    {
        return true;
    }

    // ---------------------------------------------------------
    // Referral validation
    // ---------------------------------------------------------
    if path == "/api/referrals/validate"
        && *method == Method::POST
    {
        return true;
    }

    // ---------------------------------------------------------
    // Intern validation endpoints
    // ---------------------------------------------------------
    if (path == "/api/interns/check-email"
        || path == "/api/interns/check-enrollment"
        || path == "/api/interns/check-serial")
        && *method == Method::GET
    {
        return true;
    }

    // ---------------------------------------------------------
    // Public contact endpoint
    // ---------------------------------------------------------
    if path == "/api/contact"
        && *method == Method::POST
    {
        return true;
    }

    // ---------------------------------------------------------
    // Public mutation endpoints
    // ---------------------------------------------------------
    if (path == "/api/translate"
        || path == "/api/translate/bulk"
        || path == "/api/content"
        || path == "/api/contact"
        || path == "/api/public/maintenance/simulate-exam-flow-v2"
        || path == "/api/admin/maintenance/simulate-exam-flow-v2")
        && *method == Method::POST
    {
        return true;
    }

    // ---------------------------------------------------------
    // Default allow for /api/public/* and /api/auth/*
    // ---------------------------------------------------------
    path.starts_with("/api/public/")
        || path.starts_with("/api/auth/")
}

fn requires_admin(path: &str) -> bool {
    path.starts_with("/api/admin/")
        || path.starts_with("/api/system/")
}

fn is_any_api_path(path: &str) -> bool {
    path.starts_with("/api/")
}

pub async fn auth_middleware(
    mut req: Request<Body>,
    next: Next,
) -> Response {
    let path = req.uri().path().to_string();
    let method = req.method().clone();

    // ---------------------------------------------------------
    // Non-API routes don't need API authentication
    // ---------------------------------------------------------
    if !is_any_api_path(&path) {
        return next.run(req).await;
    }

    println!(
        "Checking auth for path: {} method: {}",
        path, method
    );

    // ---------------------------------------------------------
    // PUBLIC ENDPOINTS
    //
    // IMPORTANT:
    // Certificate download reaches here and bypasses JWT.
    // ---------------------------------------------------------
    if is_public_path(&path)
        && is_allowed_public_method(&path, &method)
    {
        println!("Path is public: {}", path);

        // -----------------------------------------------------
        // Rate limit anonymous /api/public/* requests
        // -----------------------------------------------------
        if path.starts_with("/api/public/") {
            let ip = client_ip(req.headers());

            let (limit, window) =
                if path.starts_with("/api/public/centers/") {
                    (20u32, 60u64)
                } else {
                    (60u32, 60u64)
                };

            let limiter = IpRateLimit {
                limit,
                window: std::time::Duration::from_secs(window),
            };

            let key = format!("public:{ip}:{path}");

            if !check_rate_limit(&key, &limiter) {
                println!(
                    "{{\"type\":\"rate_limited\",\"ip\":\"{}\",\"path\":\"{}\",\"limit\":{},\"window_s\":{}}}",
                    ip,
                    path,
                    limit,
                    window
                );

                return (
                    StatusCode::TOO_MANY_REQUESTS,
                    axum::Json(serde_json::json!({
                        "success": false,
                        "message": "Too many requests"
                    })),
                )
                    .into_response();
            }
        }

        // -----------------------------------------------------
        // PUBLIC REQUEST → SKIP JWT AUTHENTICATION
        // -----------------------------------------------------
        return next.run(req).await;
    }

    // ---------------------------------------------------------
    // JWT AUTHENTICATION
    // ---------------------------------------------------------

    let auth_header = req
        .headers()
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok());

    let token = auth_header
        .and_then(|v| v.strip_prefix("Bearer "));

    let token = match token {
        Some(t) if !t.trim().is_empty() => t,

        _ => {
            let ip = client_ip(req.headers());

            println!(
                "{{\"type\":\"unauthorized\",\"ip\":\"{}\",\"path\":\"{}\",\"reason\":\"missing_or_invalid_bearer\"}}",
                ip,
                path
            );

            return (
                StatusCode::UNAUTHORIZED,
                axum::Json(serde_json::json!({
                    "success": false,
                    "message": "Unauthorized"
                })),
            )
                .into_response();
        }
    };

    // ---------------------------------------------------------
    // Decode JWT
    // ---------------------------------------------------------

    let claims = match decode_jwt(token) {
        Ok(c) => c,

        Err(code) => {
            let ip = client_ip(req.headers());

            println!(
                "{{\"type\":\"unauthorized\",\"ip\":\"{}\",\"path\":\"{}\",\"reason\":\"jwt_decode_failed\"}}",
                ip,
                path
            );

            return (
                code,
                axum::Json(serde_json::json!({
                    "success": false,
                    "message": "Unauthorized"
                })),
            )
                .into_response();
        }
    };

    // ---------------------------------------------------------
    // ADMIN / SYSTEM AUTHORIZATION
    // ---------------------------------------------------------

    if requires_admin(&path) {
        // Allow GET subjects for authenticated users
        let is_subjects_get =
            path == "/api/admin/subjects"
                && method == Method::GET;

        // Allow GET batches for authenticated users
        let is_batches_get =
            path == "/api/batches"
                && method == Method::GET;

        let allowed = matches!(
            claims.role,
            UserRole::SuperAdmin
                | UserRole::Admin
                | UserRole::Center
        ) || is_subjects_get
            || is_batches_get;

        if !allowed {
            let ip = client_ip(req.headers());

            println!(
                "{{\"type\":\"forbidden\",\"ip\":\"{}\",\"path\":\"{}\",\"role\":\"{:?}\"}}",
                ip,
                path,
                claims.role
            );

            return (
                StatusCode::FORBIDDEN,
                axum::Json(serde_json::json!({
                    "success": false,
                    "message": "Forbidden"
                })),
            )
                .into_response();
        }
    }

    // ---------------------------------------------------------
    // Attach validated claims to request
    // ---------------------------------------------------------

    req.extensions_mut()
        .insert::<Claims>(claims);

    next.run(req).await
}
