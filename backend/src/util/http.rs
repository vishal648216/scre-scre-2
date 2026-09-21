use axum::http::HeaderMap;

/// Best-effort client IP from reverse-proxy headers.
pub fn client_ip(headers: &HeaderMap) -> String {
    if let Some(v) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()) {
        if let Some(ip) = v.split(',').next() {
            let cleaned = ip.trim();
            if !cleaned.is_empty() {
                return cleaned.to_string();
            }
        }
    }
    if let Some(v) = headers.get("x-real-ip").and_then(|v| v.to_str().ok()) {
        let cleaned = v.trim();
        if !cleaned.is_empty() {
            return cleaned.to_string();
        }
    }
    "unknown".to_string()
}
