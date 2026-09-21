// // use axum::{
// //     extract::{State, Query, Path},
// //     http::{StatusCode, header},
// //     body::Body,
// //     Json,
// //     response::IntoResponse,
// // };
// // use std::path::PathBuf;
// // use std::collections::BTreeMap;
// // use std::process::Command;
// // use mongodb::{Database, bson::{doc, oid::ObjectId, Document as BsonDocument, Bson}};
// // use serde::{Deserialize, Serialize};
// // use crate::models::user::{UserRole, Claims};
// // use crate::models::certificate::Certificate;
// // use crate::models::center::Center;
// // use crate::models::center_assets::CenterAssets;
// // use crate::models::admin_assets::AdminAssets;
// // use crate::services::pdf_generator::PdfGenerator;
// // use chrono::Utc;
// // use futures_util::stream::StreamExt;
// // use lopdf::{Document, Object, ObjectId as PdfObjectId};

// // #[derive(Debug, Deserialize)]
// // pub struct IssueCertificateRequest {
// //     pub student_id: String,
// //     pub course: String,
// //     pub certificate_no: String,
// // }

// // #[derive(Debug, Serialize)]
// // pub struct CertificateResponse {
// //     pub success: bool,
// //     pub message: String,
// // }

// // fn debug_env_value(key: &str) -> Option<String> {
// //     let env_path = "/var/www/html/scre/.dbg/admin-certificate-download.env";
// //     let content = std::fs::read_to_string(env_path).ok()?;
// //     for line in content.lines() {
// //         if let Some(value) = line.strip_prefix(&format!("{key}=")) {
// //             return Some(value.trim().to_string());
// //         }
// //     }
// //     None
// // }

// // async fn debug_report(
// //     run_id: &str,
// //     hypothesis_id: &str,
// //     location: &str,
// //     msg: &str,
// //     data: serde_json::Value,
// // ) {
// //     let url = debug_env_value("DEBUG_SERVER_URL")
// //         .unwrap_or_else(|| "http://127.0.0.1:7780/event".to_string());
// //     let session_id = debug_env_value("DEBUG_SESSION_ID")
// //         .unwrap_or_else(|| "admin-certificate-download".to_string());
// //     let payload = serde_json::json!({
// //         "sessionId": session_id,
// //         "runId": run_id,
// //         "hypothesisId": hypothesis_id,
// //         "location": location,
// //         "msg": msg,
// //         "data": data,
// //         "ts": chrono::Utc::now().timestamp_millis(),
// //     });
// //     let _ = reqwest::Client::new().post(url).json(&payload).send().await;
// // }

// // pub async fn issue_certificate(
// //     State(db): State<Database>,
// //     claims: Claims,
// //     Json(payload): Json<IssueCertificateRequest>,
// // ) -> (StatusCode, Json<CertificateResponse>) {
// //     if claims.role != UserRole::Center && claims.role != UserRole::Admin {
// //         return (StatusCode::FORBIDDEN, Json(CertificateResponse {
// //             success: false,
// //             message: "Unauthorized".to_string(),
// //         }));
// //     }

// //     let collection = db.collection::<Certificate>("certificates");
// //     let student_oid = match ObjectId::parse_str(&payload.student_id) {
// //         Ok(oid) => oid,
// //         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid Student ID".to_string() })),
// //     };
// //     let center_id = match ObjectId::parse_str(&claims.sub) {
// //         Ok(oid) => oid,
// //         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid center user ID".to_string() })),
// //     };

// //     let cert = Certificate {
// //         id: None,
// //         student_id: student_oid,
// //         center_id,
// //         course: payload.course,
// //         course_id: None,
// //         certificate_no: payload.certificate_no,
// //         center_name: None,
// //         center_signature_url: None,
// //         center_stamp_url: None,
// //         admin_signature_url: None,
// //         admin_stamp_url: None,
// //         signature_url: None,
// //         stamp_url: None,
// //         background_url: None,
// //         issued_on: Utc::now(),
// //         status: Some("draft".to_string()),
// //         template_id: None,
// //         verification_url: None,
// //         pdf_url: None,
// //         file_path: None,
// //         scheduled_at: None,
// //         certificate_type: crate::models::certificate::CertificateType::Certificate,
// //         attempt_number: Some(1),
// //     };

// //     match collection.insert_one(cert, None).await {
// //         Ok(_) => (StatusCode::CREATED, Json(CertificateResponse { success: true, message: "Certificate issued".to_string() })),
// //         Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(CertificateResponse { success: false, message: "Failed to save certificate".to_string() })),
// //     }
// // }

// // #[derive(Debug, Deserialize)]
// // pub struct GetCertificatesQuery {
// //     pub student_id: Option<String>,
// //     pub template_id: Option<String>,
// // }

// // pub async fn get_certificates(
// //     State(db): State<Database>,
// //     claims: Claims,
// //     Query(params): Query<GetCertificatesQuery>,
// // ) -> (StatusCode, Json<Vec<Certificate>>) {
// //     let collection = db.collection::<Certificate>("certificates");
// //     let mut filter = doc! {};

// //     match claims.role {
// //         UserRole::Center => {
// //             let center_user_id = match ObjectId::parse_str(&claims.sub) {
// //                 Ok(oid) => oid,
// //                 Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
// //             };
// //             let centers_coll = db.collection::<crate::models::center::Center>("centers");
// //             if let Ok(Some(center)) = centers_coll.find_one(doc! { "user_id": center_user_id }, None).await {
// //                 if let Some(cid) = center.id {
// //                     filter.insert("center_id", cid);
// //                 } else {
// //                     filter.insert("center_id", center_user_id);
// //                 }
// //             } else {
// //                 filter.insert("center_id", center_user_id);
// //             }
// //         }
// //         UserRole::Student => {
// //             let student_id = match ObjectId::parse_str(&claims.sub) {
// //                 Ok(oid) => oid,
// //                 Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
// //             };
// //             filter.insert("student_id", student_id);
// //             filter.insert("status", "approved");
// //         }
// //         UserRole::Admin | UserRole::SuperAdmin => {}
// //         _ => {
// //             return (StatusCode::OK, Json(Vec::new()));
// //         }
// //     }

// //     if let Some(sid) = params.student_id {
// //         if let Ok(oid) = ObjectId::parse_str(&sid) {
// //             filter.insert("student_id", oid);
// //         }
// //     }

// //     if let Some(tid) = params.template_id {
// //         if let Ok(oid) = ObjectId::parse_str(&tid) {
// //             filter.insert("template_id", oid);
// //         }
// //     }

// //     let mut cursor = match collection.find(filter, None).await {
// //         Ok(c) => c,
// //         Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
// //     };

// //     let upload_dir = std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string());
// //     let upload_pb = std::path::PathBuf::from(&upload_dir);

// //     let mut certs = Vec::new();
// //     while let Some(result) = cursor.next().await {
// //         if let Ok(mut cert) = result {
// //             println!("get_certificates: Processing cert: cert_id = {:?}, cert_no = {:?}, file_path = {:?}", cert.id, cert.certificate_no, cert.file_path);
// //             // Proactively check if PDF exists on disk
// //             let mut exists = false;
// //             if let Some(ref p) = cert.file_path {
// //                 let pb = std::path::PathBuf::from(p);
// //                 println!("  Checking pb.exists() for {:?}: {}", pb, pb.exists());
// //                 println!("  Checking upload_pb.join(p).exists(): {}", upload_pb.join(p).exists());
// //                 if pb.exists() || upload_pb.join(p).exists() {
// //                     exists = true;
// //                 }
// //             }
// //             if !exists {
// //                 let fallback_cert = upload_pb.join(format!("certificates/{}.pdf", cert.certificate_no));
// //                 println!("  Checking fallback_cert {:?}: {}", fallback_cert, fallback_cert.exists());
// //                 if fallback_cert.exists() {
// //                     exists = true;
// //                 }
// //                 if !exists {
// //                     let fallback_marksheet = upload_pb.join(format!("marksheets/{}.pdf", cert.certificate_no));
// //                     println!("  Checking fallback_marksheet {:?}: {}", fallback_marksheet, fallback_marksheet.exists());
// //                     if fallback_marksheet.exists() {
// //                         exists = true;
// //                     }
// //                 }
// //             }
            
// //             println!("  Adding to certs: exists = {}", exists);
// //             certs.push(cert);
// //         }
// //     }
// //     (StatusCode::OK, Json(certs))
// // }

// // /// Center applies sign & stamp from their center assets to a draft certificate
// // pub async fn apply_sign_stamp(
// //     State(db): State<Database>,
// //     claims: Claims,
// //     Path(id): Path<String>,
// // ) -> (StatusCode, Json<CertificateResponse>) {
// //     if claims.role != UserRole::Center {
// //         return (StatusCode::FORBIDDEN, Json(CertificateResponse { success: false, message: "Unauthorized".to_string() }));
// //     }
// //     let cert_oid = match ObjectId::parse_str(&id) {
// //         Ok(o) => o,
// //         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid certificate ID".to_string() })),
// //     };
// //     let center_id = match ObjectId::parse_str(&claims.sub) {
// //         Ok(oid) => oid,
// //         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid center user ID".to_string() })),
// //     };

// //     let certs = db.collection::<Certificate>("certificates");
// //     let _cert = match certs.find_one(doc! { "_id": &cert_oid, "center_id": &center_id, "status": "draft" }, None).await {
// //         Ok(Some(c)) => c,
// //         _ => return (StatusCode::NOT_FOUND, Json(CertificateResponse { success: false, message: "Certificate not found or not in draft".to_string() })),
// //     };

// //     let assets_coll = db.collection::<CenterAssets>("center_assets");
// //     let assets: Option<CenterAssets> = assets_coll.find_one(doc! { "center_id": &center_id }, None).await.ok().flatten();
// //     let sig = assets.as_ref().and_then(|a| a.signature_url.clone());
// //     let stamp = assets.as_ref().and_then(|a| a.stamp_url.clone());
// //     if sig.is_none() && stamp.is_none() {
// //         return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Configure signature and stamp in Center Assets first".to_string() }));
// //     }

// //     let _ = certs.update_one(
// //         doc! { "_id": &cert_oid },
// //         doc! { "$set": {
// //             "center_signature_url": sig.clone(),
// //             "center_stamp_url": stamp.clone(),
// //             "signature_url": sig,
// //             "stamp_url": stamp,
// //             "status": "pending_approval",
// //         }},
// //         None,
// //     ).await;

// //     (StatusCode::OK, Json(CertificateResponse { success: true, message: "Sign and stamp applied. Awaiting admin approval.".to_string() }))
// // }

// // /// Admin approves certificate sign & stamp
// // pub async fn admin_approve_certificate(
// //     State(db): State<Database>,
// //     claims: Claims,
// //     Path(id): Path<String>,
// // ) -> (StatusCode, Json<CertificateResponse>) {
// //     if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
// //         return (StatusCode::FORBIDDEN, Json(CertificateResponse { success: false, message: "Unauthorized".to_string() }));
// //     }
// //     let cert_oid = match ObjectId::parse_str(&id) {
// //         Ok(o) => o,
// //         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid certificate ID".to_string() })),
// //     };

// //     let certs = db.collection::<Certificate>("certificates");

// //     // Load admin-specific assets (optional) to attach background/signature if desired
// //     let admin_id = match ObjectId::parse_str(&claims.sub) {
// //         Ok(oid) => oid,
// //         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid admin ID".to_string() })),
// //     };
// //     let admin_assets_coll = db.collection::<AdminAssets>("admin_assets");
// //     let admin_assets: Option<AdminAssets> = admin_assets_coll
// //         .find_one(doc! { "admin_id": &admin_id }, None)
// //         .await
// //         .ok()
// //         .flatten();

// //     let mut set_doc = doc! { "status": "approved" };
// //     if let Some(a) = admin_assets {
// //         if let Some(bg) = a.background_url {
// //             set_doc.insert("background_url", bg);
// //         }
// //         if let Some(sig) = a.signature_url {
// //             set_doc.insert("admin_signature_url", sig.clone());
// //             set_doc.insert("signature_url", sig);
// //         }
// //         if let Some(stamp) = a.stamp_url {
// //             set_doc.insert("admin_stamp_url", stamp.clone());
// //             set_doc.insert("stamp_url", stamp);
// //         }
// //     }

// //     let result = certs
// //         .update_one(
// //             doc! { "_id": &cert_oid, "status": "pending_approval" },
// //             doc! { "$set": set_doc },
// //             None,
// //         )
// //         .await;

// //     match result {
// //         Ok(r) if r.modified_count > 0 => (StatusCode::OK, Json(CertificateResponse { success: true, message: "Certificate approved".to_string() })),
// //         Ok(_) => (StatusCode::NOT_FOUND, Json(CertificateResponse { success: false, message: "Certificate not found or not pending approval".to_string() })),
// //         Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(CertificateResponse { success: false, message: "Failed to approve".to_string() })),
// //     }
// // }

// // #[derive(Debug, Deserialize)]
// // pub struct BulkIds {
// //     pub ids: Vec<String>,
// // }

// // pub async fn apply_sign_stamp_bulk(
// //     State(db): State<Database>,
// //     claims: Claims,
// //     Json(payload): Json<BulkIds>,
// // ) -> (StatusCode, Json<CertificateResponse>) {
// //     if claims.role != UserRole::Center {
// //         return (StatusCode::FORBIDDEN, Json(CertificateResponse { success: false, message: "Unauthorized".to_string() }));
// //     }
// //     let center_id = match ObjectId::parse_str(&claims.sub) {
// //         Ok(o) => o,
// //         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid center".to_string() })),
// //     };
// //     let ids: Vec<ObjectId> = payload.ids.iter().filter_map(|s| ObjectId::parse_str(s).ok()).collect();
// //     if ids.is_empty() {
// //         return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "No valid IDs".to_string() }));
// //     }
// //     let assets_coll = db.collection::<CenterAssets>("center_assets");
// //     let assets: Option<CenterAssets> = assets_coll.find_one(doc! { "center_id": &center_id }, None).await.ok().flatten();
// //     let sig = assets.as_ref().and_then(|a| a.signature_url.clone());
// //     let stamp = assets.as_ref().and_then(|a| a.stamp_url.clone());
// //     if sig.is_none() && stamp.is_none() {
// //         return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Configure signature and stamp in Center Assets first".to_string() }));
// //     }
// //     let certs = db.collection::<Certificate>("certificates");
// //     let _ = certs
// //         .update_many(
// //             doc! { "_id": { "$in": &ids }, "center_id": &center_id, "status": "draft" },
// //             doc! { "$set": {
// //                 "center_signature_url": sig.clone(),
// //                 "center_stamp_url": stamp.clone(),
// //                 "signature_url": sig,
// //                 "stamp_url": stamp,
// //                 "status": "pending_approval",
// //             }},
// //             None,
// //         )
// //         .await;
// //     (StatusCode::OK, Json(CertificateResponse { success: true, message: "Applied sign & stamp to selected certificates".to_string() }))
// // }

// // pub async fn admin_approve_certificates_bulk(
// //     State(db): State<Database>,
// //     claims: Claims,
// //     Json(payload): Json<BulkIds>,
// // ) -> (StatusCode, Json<CertificateResponse>) {
// //     if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
// //         return (StatusCode::FORBIDDEN, Json(CertificateResponse { success: false, message: "Unauthorized".to_string() }));
// //     }
// //     let admin_id = match ObjectId::parse_str(&claims.sub) {
// //         Ok(o) => o,
// //         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid admin".to_string() })),
// //     };
// //     let ids: Vec<ObjectId> = payload.ids.iter().filter_map(|s| ObjectId::parse_str(s).ok()).collect();
// //     if ids.is_empty() {
// //         return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "No valid IDs".to_string() }));
// //     }
// //     let admin_assets_coll = db.collection::<AdminAssets>("admin_assets");
// //     let admin_assets: Option<AdminAssets> = admin_assets_coll
// //         .find_one(doc! { "admin_id": &admin_id }, None)
// //         .await
// //         .ok()
// //         .flatten();
// //     let mut set_doc = doc! { "status": "approved" };
// //     if let Some(a) = admin_assets {
// //         if let Some(bg) = a.background_url {
// //             set_doc.insert("background_url", bg);
// //         }
// //         if let Some(sig) = a.signature_url {
// //             set_doc.insert("admin_signature_url", sig.clone());
// //             set_doc.insert("signature_url", sig);
// //         }
// //         if let Some(stamp) = a.stamp_url {
// //             set_doc.insert("admin_stamp_url", stamp.clone());
// //             set_doc.insert("stamp_url", stamp);
// //         }
// //     }
// //     let certs = db.collection::<Certificate>("certificates");
// //     let _ = certs
// //         .update_many(
// //             doc! { "_id": { "$in": &ids }, "status": "pending_approval" },
// //             doc! { "$set": set_doc },
// //             None,
// //         )
// //         .await;
// //     (StatusCode::OK, Json(CertificateResponse { success: true, message: "Approved selected certificates".to_string() }))
// // }

// // pub async fn public_verify_certificate(
// //     State(db): State<Database>,
// //     Path(reg_no): Path<String>,
// // ) -> impl IntoResponse {
// //     let collection = db.collection::<Certificate>("certificates");
// //     // Search by certificate_no which is used as registration_number in the URL
// //     match collection.find_one(doc! { "certificate_no": &reg_no, "status": "approved" }, None).await {
// //         Ok(Some(cert)) => (StatusCode::OK, Json(cert)).into_response(),
// //         Ok(None) => (
// //             StatusCode::NOT_FOUND,
// //             Json(serde_json::json!({"success": false, "message": "Not Found"})),
// //         )
// //             .into_response(),
// //         Err(_) => (
// //             StatusCode::NOT_FOUND,
// //             Json(serde_json::json!({"success": false, "message": "Not Found"})),
// //         )
// //             .into_response(),
// //     }
// // }

// // pub async fn public_verify_certificate_by_id(
// //     State(db): State<Database>,
// //     Path(id): Path<String>,
// // ) -> impl IntoResponse {
// //     let collection = db.collection::<Certificate>("certificates");
// //     let users_coll = db.collection::<crate::models::user::User>("users");
// //     let oid = match ObjectId::parse_str(&id) {
// //         Ok(o) => o,
// //         Err(_) => {
// //             return (
// //                 StatusCode::NOT_FOUND,
// //                 Json(serde_json::json!({"success": false, "message": "Not Found"})),
// //             )
// //                 .into_response();
// //         }
// //     };
// //     // Search by certificate id
// //     match collection.find_one(doc! { "_id": &oid, "status": "approved" }, None).await {
// //         Ok(Some(cert)) => {
// //             // Also fetch student details
// //             let student = users_coll.find_one(doc! { "_id": &cert.student_id }, None).await.ok().flatten();
            
// //             let response = serde_json::json!({
// //                 "success": true,
// //                 "certificate": cert,
// //                 "student": student
// //             });
// //             (StatusCode::OK, Json(response)).into_response()
// //         },
// //         Ok(None) => (
// //             StatusCode::NOT_FOUND,
// //             Json(serde_json::json!({"success": false, "message": "Not Found"})),
// //         )
// //             .into_response(),
// //         Err(_) => (
// //             StatusCode::NOT_FOUND,
// //             Json(serde_json::json!({"success": false, "message": "Not Found"})),
// //         )
// //             .into_response(),
// //     }
// // }

// // pub async fn delete_certificate(
// //     State(db): State<Database>,
// //     claims: Claims,
// //     Path(id): Path<String>,
// // ) -> (StatusCode, Json<CertificateResponse>) {
// //     if !require_admin(&claims) {
// //         return (StatusCode::FORBIDDEN, Json(CertificateResponse { success: false, message: "Unauthorized".to_string() }));
// //     }
// //     let oid = match ObjectId::parse_str(&id) {
// //         Ok(oid) => oid,
// //         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid ID".to_string() })),
// //     };
// //     let coll = db.collection::<Certificate>("certificates");
    
// //     // Optional: delete PDF file from disk
// //     if let Ok(Some(cert)) = coll.find_one(doc! { "_id": &oid }, None).await {
// //         if let Some(path) = cert.file_path {
// //             let upload_dir = std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string());
// //             let full_path = std::path::PathBuf::from(upload_dir).join(path);
// //             let _ = tokio::fs::remove_file(full_path).await;
// //         }
// //     }

// //     match coll.delete_one(doc! { "_id": oid }, None).await {
// //         Ok(_) => (StatusCode::OK, Json(CertificateResponse { success: true, message: "Certificate deleted successfully".to_string() })),
// //         Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(CertificateResponse { success: false, message: "Failed to delete".to_string() })),
// //     }
// // }

// // fn require_admin(claims: &Claims) -> bool {
// //     claims.role == UserRole::Admin || claims.role == UserRole::SuperAdmin
// // }

// // fn download_err_json(status: StatusCode, code: &'static str, message: &str) -> axum::response::Response {
// //     (
// //         status,
// //         Json(serde_json::json!({
// //             "success": false,
// //             "code": code,
// //             "message": message,
// //         })),
// //     )
// //         .into_response()
// // }

// // pub async fn download_certificate(
// //     State(db): State<Database>,
// //     claims: Claims,
// //     Path(id): Path<String>,
// // ) -> impl IntoResponse {
// //     // #region debug-point H:certificate-download-entry
// //     debug_report(
// //         "pre-fix",
// //         "H",
// //         "backend/src/handlers/certificate.rs:495",
// //         "[DEBUG] Shared certificate download handler entered",
// //         serde_json::json!({
// //             "certificate_id": id,
// //             "role": match claims.role {
// //                 UserRole::Admin => "admin",
// //                 UserRole::SuperAdmin => "superadmin",
// //                 UserRole::Student => "student",
// //                 UserRole::Center => "center",
// //                 _ => "other",
// //             },
// //         }),
// //     )
// //     .await;
// //     // #endregion
// //     // Read raw BSON — `find_one::<Certificate>` can fail deserialization on legacy/extra fields and
// //     // older binaries mapped that to 404, which looked like "wrong ID". Raw docs always load if the row exists.
// //     let coll = db.collection::<BsonDocument>("certificates");
// //     let cert_oid = match ObjectId::parse_str(&id) {
// //         Ok(oid) => oid,
// //         Err(_) => {
// //             return download_err_json(
// //                 StatusCode::BAD_REQUEST,
// //                 "INVALID_ID",
// //                 "Invalid certificate ID",
// //             );
// //         }
// //     };

// //     let cert_doc = match coll.find_one(doc! { "_id": &cert_oid }, None).await {
// //         Ok(Some(d)) => {
// //             d
// //         }
// //         Ok(None) => {
// //             return download_err_json(
// //                 StatusCode::NOT_FOUND,
// //                 "CERT_NOT_FOUND",
// //                 "Certificate not found (wrong ID, different database, or row deleted).",
// //             );
// //         }
// //         Err(e) => {
// //             eprintln!("download_certificate: find_one raw document failed: {}", e);
// //             return download_err_json(
// //                 StatusCode::INTERNAL_SERVER_ERROR,
// //                 "CERT_FETCH_ERROR",
// //                 "Could not read certificate from database.",
// //             );
// //         }
// //     };

// //     let cert_student_id = match cert_doc.get_object_id("student_id") {
// //         Ok(oid) => {
// //             oid
// //         }
// //         Err(e) => {
// //             return download_err_json(
// //                 StatusCode::INTERNAL_SERVER_ERROR,
// //                 "CERT_SCHEMA",
// //                 "Certificate record is missing a valid student_id.",
// //             );
// //         }
// //     };
// //     let cert_center_id = match cert_doc.get_object_id("center_id") {
// //         Ok(oid) => {
// //             oid
// //         }
// //         Err(e) => {
// //             return download_err_json(
// //                 StatusCode::INTERNAL_SERVER_ERROR,
// //                 "CERT_SCHEMA",
// //                 "Certificate record is missing a valid center_id.",
// //             );
// //         }
// //     };
// //     let certificate_no = match cert_doc.get_str("certificate_no") {
// //         Ok(s) => {
// //             s.to_string()
// //         }
// //         Err(e) => {
// //             return download_err_json(
// //                 StatusCode::INTERNAL_SERVER_ERROR,
// //                 "CERT_SCHEMA",
// //                 "Certificate record is missing certificate_no.",
// //             );
// //         }
// //     };
// //     let file_path_opt = cert_doc.get("file_path").and_then(|b| match b {
// //         Bson::String(s) if !s.is_empty() => Some(s.clone()),
// //         _ => None,
// //     });
// //     let pdf_url_opt = cert_doc.get("pdf_url").and_then(|b| match b {
// //         Bson::String(s) if !s.is_empty() => Some(s.clone()),
// //         _ => None,
// //     });
// //     let pdf_path_opt = cert_doc.get("pdf_path").and_then(|b| match b {
// //         Bson::String(s) if !s.is_empty() => Some(s.clone()),
// //         _ => None,
// //     });

// //     // Check permissions
// //     if claims.role == UserRole::Student {
// //         let student_id = match ObjectId::parse_str(&claims.sub) {
// //             Ok(oid) => oid,
// //             Err(_) => {
// //                 return download_err_json(
// //                     StatusCode::BAD_REQUEST,
// //                     "INVALID_SUBJECT",
// //                     "Invalid student ID in token",
// //                 );
// //             }
// //         };
// //         if cert_student_id != student_id {
// //             return download_err_json(
// //                 StatusCode::FORBIDDEN,
// //                 "FORBIDDEN",
// //                 "You do not have access to this certificate",
// //             );
// //         }
// //     } else if claims.role == UserRole::Center {
// //         let center_login_oid = match ObjectId::parse_str(&claims.sub) {
// //             Ok(oid) => oid,
// //             Err(_) => {
// //                 return download_err_json(
// //                     StatusCode::BAD_REQUEST,
// //                     "INVALID_SUBJECT",
// //                     "Invalid center ID in token",
// //                 );
// //             }
// //         };
// //         // Issued certs store `centers._id` as `center_id`, but the center account JWT `sub` is the center *login user* id (`centers.user_id`).
// //         let centers_coll = db.collection::<Center>("centers");
// //         let mut can_access = cert_center_id == center_login_oid;
// //         if !can_access {
// //             if let Ok(Some(center)) = centers_coll
// //                 .find_one(doc! { "user_id": &center_login_oid }, None)
// //                 .await
// //             {
// //                 if let Some(cid) = center.id {
// //                     can_access = cid == cert_center_id;
// //                 }
// //             }
// //         }
// //         if !can_access {
// //             return download_err_json(
// //                 StatusCode::FORBIDDEN,
// //                 "FORBIDDEN",
// //                 "You do not have access to this certificate",
// //             );
// //         }
// //     } else if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
// //         return download_err_json(
// //             StatusCode::FORBIDDEN,
// //             "FORBIDDEN",
// //             "You do not have access to this certificate",
// //         );
// //     } else {
// //         // Admin / SuperAdmin — allowed to view any certificate
// //     }

// //     // Resolve PDF on disk: DB may store absolute path, or relative to UPLOAD_DIR (e.g. `certificates/CERT-....pdf`).
// //     let upload_dir = std::env::var("UPLOAD_DIR")
// //         .unwrap_or_else(|_| "/var/www/html/scre/backend/uploads".to_string());
// //     let upload_pb = PathBuf::from(&upload_dir);
// //     let backend_dir = PathBuf::from("/var/www/html/scre/backend"); // Default backend directory
// //     let public_dir = PathBuf::from("/var/www/html/scre/public"); // Check public directory too
// //     let public_uploads_dir = public_dir.join("uploads");

// //     eprintln!("download_certificate: cert_id={}, cert_no={}, file_path={:?}, pdf_url={:?}, pdf_path={:?}",
// //         id, certificate_no, file_path_opt, pdf_url_opt, pdf_path_opt);

// //     let mut candidates: Vec<PathBuf> = Vec::new();
// //     // First try file_path
// //     if let Some(ref p) = file_path_opt {
// //         let pb = PathBuf::from(p);
// //         candidates.push(pb.clone());
// //         if pb.is_relative() {
// //             candidates.push(upload_pb.join(p));
// //             candidates.push(backend_dir.join(p));
// //             candidates.push(public_dir.join(p));
// //             candidates.push(public_uploads_dir.join(p));
// //         }
// //     }
// //     // Then try pdf_url (remove /uploads/ prefix if present)
// //     if let Some(ref p) = pdf_url_opt {
// //         let normalized = p.trim_start_matches('/').trim_start_matches("uploads/").to_string();
// //         candidates.push(upload_pb.join(&normalized));
// //         candidates.push(backend_dir.join(&normalized));
// //         candidates.push(public_dir.join(&normalized));
// //         candidates.push(public_uploads_dir.join(&normalized));
// //     }
// //     // Then try pdf_path
// //     if let Some(ref p) = pdf_path_opt {
// //         let pb = PathBuf::from(p);
// //         candidates.push(pb.clone());
// //         if pb.is_relative() {
// //             candidates.push(upload_pb.join(p));
// //             candidates.push(backend_dir.join(p));
// //             candidates.push(public_dir.join(p));
// //             candidates.push(public_uploads_dir.join(p));
// //         }
// //     }
// //     // Then try certificate_no fallback (both certificates and marksheets folders!)
// //     let cert_file = format!("certificates/{}.pdf", certificate_no);
// //     candidates.push(upload_pb.join(&cert_file));
// //     candidates.push(backend_dir.join(&cert_file));
// //     candidates.push(public_dir.join(&cert_file));
// //     candidates.push(public_uploads_dir.join(&cert_file));
// //     let marksheet_file = format!("marksheets/{}.pdf", certificate_no);
// //     candidates.push(upload_pb.join(&marksheet_file));
// //     candidates.push(backend_dir.join(&marksheet_file));
// //     candidates.push(public_dir.join(&marksheet_file));
// //     candidates.push(public_uploads_dir.join(&marksheet_file));
// //     // Also check just certificate_no.pdf directly in uploads folders
// //     candidates.push(upload_pb.join(format!("{}.pdf", certificate_no)));
// //     candidates.push(backend_dir.join(format!("{}.pdf", certificate_no)));
// //     candidates.push(public_uploads_dir.join(format!("{}.pdf", certificate_no)));

// //     let mut seen = std::collections::HashSet::<std::path::PathBuf>::new();
// //     for path in candidates {
// //         if !seen.insert(path.clone()) {
// //             continue;
// //         }
// //         if !path.exists() {
// //             continue;
// //         }
// //         match tokio::fs::read(&path).await {
// //             Ok(data) => {
// //                 let file_name = path
// //                     .file_name()
// //                     .and_then(|n| n.to_str())
// //                     .unwrap_or("certificate.pdf");
// //                 let data_len = data.len();
// //                 let header_take = std::cmp::min(16, data_len);
// //                 let header_bytes: Vec<u8> = data.iter().take(header_take).copied().collect();
// //                 let header_text = String::from_utf8_lossy(&header_bytes);
// //                 let first32: Vec<u8> = data.iter().take(std::cmp::min(32, data_len)).copied().collect();
// //                 let last32: Vec<u8> = data
// //                     .iter()
// //                     .skip(data_len.saturating_sub(32))
// //                     .copied()
// //                     .collect();
// //                 let sha_out = Command::new("sha256sum").arg(&path).output().ok();
// //                 let sha256 = sha_out
// //                     .as_ref()
// //                     .and_then(|o| String::from_utf8(o.stdout.clone()).ok())
// //                     .and_then(|s| s.split_whitespace().next().map(|h| h.to_string()))
// //                     .unwrap_or_else(|| "(sha256sum failed)".to_string());
// //                 eprintln!(
// //                     "[CERT_DOWNLOAD] serving path={:?} size={} bytes Content-Type=application/pdf Content-Length={} header_hex={} header_text={:?}",
// //                     path, data_len, data_len,
// //                     header_bytes.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
// //                     header_text
// //                 );
// //                 eprintln!(
// //                     "[CERT_DOWNLOAD] first32_hex={} last32_hex={} sha256={}",
// //                     first32.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
// //                     last32.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
// //                     sha256
// //                 );
// //                 if !header_text.starts_with("%PDF-") {
// //                     eprintln!(
// //                         "[CERT_DOWNLOAD] FATAL: file {:?} is NOT a PDF! Header bytes: {:02X?}",
// //                         path, header_bytes
// //                     );
// //                 }
// //                 // #region debug-point I:certificate-download-response
// //                 debug_report(
// //                     "pre-fix",
// //                     "I",
// //                     "backend/src/handlers/certificate.rs:720",
// //                     "[DEBUG] Shared certificate download response bytes prepared",
// //                     serde_json::json!({
// //                         "certificate_id": id,
// //                         "path": path.display().to_string(),
// //                         "content_type": "application/pdf",
// //                         "content_disposition": format!("attachment; filename=\"{}\"", file_name),
// //                         "content_length_header": data_len,
// //                         "actual_byte_length": data_len,
// //                         "sha256": sha256,
// //                         "first32_hex": first32.iter().map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(""),
// //                         "last32_hex": last32.iter().map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(""),
// //                     }),
// //                 )
// //                 .await;
// //                 // #endregion
// //                 let res = axum::response::Response::builder()
// //                     .status(StatusCode::OK)
// //                     .header(header::CONTENT_TYPE, "application/pdf")
// //                     .header(header::CONTENT_LENGTH, data_len.to_string())
// //                     .header(
// //                         header::CONTENT_DISPOSITION,
// //                         &format!("attachment; filename=\"{}\"", file_name),
// //                     )
// //                     .body(Body::from(data))
// //                     .expect("certificate response builder");
// //                 return res;
// //             }
// //             Err(e) => {
// //                 eprintln!("Failed to read certificate file at {:?}: {}", path, e);
// //             }
// //         }
// //     }

// //     // ---- Last-ditch: if the PDF artifact isn't on disk but the DB row already carries the fully
// //     // pre-rendered `html` blob (rendered at issue time — same data the Student Panel preview uses),
// //     // transparently materialize the PDF on-demand using the same PdfGenerator pipeline. No
// //     // re-approval, no re-issue, no template re-rendering. Write to
// //     // `uploads/certificates/{certificate_no}.pdf`, update the stored `file_path` for future hits,
// //     // then serve the freshly written bytes. If anything in this chain fails we still fall through
// //     // to the original 422 below so no behaviour regression.
// //     let cert_html_from_doc = cert_doc
// //         .get("html")
// //         .and_then(|b| match b {
// //             Bson::String(s) if !s.is_empty() => Some(s.clone()),
// //             _ => None,
// //         });

// //     // If the stored rendered HTML is absent on the cert row, do one last recovery: re-render the
// //     // page from the stored typed Certificate + referenced Template + User. This rescues rows that
// //     // were skipped entirely during the old generation loop because `ctx.serial_number` (derived
// //     // from `user.serial_number`) was `None` on the user record even though the row itself has a
// //     // valid `certificate_no`. Uses exactly the same `render_page`/`page_styles`/`CertContext`
// //     // pipeline as normal generation (just exported for this call).
// //     let certs_coll_typed = db.collection::<Certificate>("certificates");
// //     let users_coll_typed = db.collection::<crate::models::user::User>("users");
// //     let templates_coll = db.collection::<crate::models::template::Template>("templates");
// //     let templates_doc_coll: mongodb::Collection<mongodb::bson::Document> =
// //         db.collection::<mongodb::bson::Document>("templates");
// //     let template_fields_coll = db.collection::<crate::models::template::TemplateField>("template_fields");
// //     let centers_coll_typed = db.collection::<Center>("centers");
// //     let cert_and_user_and_template: Option<(Certificate, crate::models::user::User, crate::models::template::Template, Vec<crate::models::template::TemplateField>, Option<Center>)> =
// //         if cert_html_from_doc.is_some() {
// //             None
// //         } else {
// //             // Clone the DB handle (MongoDB Database is an Arc internally; this is cheap).
// //             // We use async move {} so that `return None` inside exits this Option-returning
// //             // block instead of the outer download_certificate fn.
// //             let db_for_block = db.clone();
// //             let certs_coll_typed_clone = certs_coll_typed.clone();
// //             let users_coll_typed_clone = users_coll_typed.clone();
// //             let templates_coll_clone = templates_coll.clone();
// //             let templates_doc_coll_clone = templates_doc_coll.clone();
// //             let template_fields_coll_clone = template_fields_coll.clone();
// //             let centers_coll_typed_clone = centers_coll_typed.clone();
// //             let cert_doc_clone = cert_doc.clone();
// //             async move {
// //                 let cert = match certs_coll_typed_clone.find_one(doc! { "_id": &cert_oid }, None).await {
// //                     Ok(Some(c)) => c,
// //                     _ => return None,
// //                 };
// //                 let user = match users_coll_typed_clone.find_one(doc! { "_id": &cert.student_id }, None).await.ok().flatten() {
// //                     Some(u) => u,
// //                     None => return None,
// //                 };
// //                 let mut resolved_course_id: Option<mongodb::bson::oid::ObjectId> =
// //                     cert.course_id.or_else(|| user.course_id);

// //                 if resolved_course_id.is_none() {
// //                     let cea_doc_coll: mongodb::Collection<mongodb::bson::Document> =
// //                         db_for_block.collection::<mongodb::bson::Document>("course_exam_attempts");
// //                     let proj = mongodb::options::FindOptions::builder()
// //                         .projection(doc! { "course_id": 1, "attempt_number": 1, "created_at": 1 })
// //                         .sort(doc! { "attempt_number": -1, "created_at": -1 })
// //                         .limit(1)
// //                         .build();
// //                     if let Ok(mut cursor) = cea_doc_coll.find(doc! { "student_id": &cert.student_id }, proj).await {
// //                         if let Some(Ok(row)) = cursor.next().await {
// //                             if let Ok(cid) = row.get_object_id("course_id") {
// //                                 resolved_course_id = Some(cid);
// //                             }
// //                         }
// //                     }
// //                 }
// //                 if resolved_course_id.is_none() {
// //                     let certs_doc_coll2: mongodb::Collection<mongodb::bson::Document> =
// //                         db_for_block.collection::<mongodb::bson::Document>("certificates");
// //                     let proj2 = mongodb::options::FindOptions::builder()
// //                         .projection(doc! { "course_id": 1, "created_at": 1 })
// //                         .sort(doc! { "created_at": -1 })
// //                         .limit(1)
// //                         .build();
// //                     if let Ok(mut cursor) = certs_doc_coll2.find(doc! { "student_id": &cert.student_id, "course_id": { "$exists": true, "$ne": null } }, proj2).await {
// //                         if let Some(Ok(row)) = cursor.next().await {
// //                             if let Ok(cid) = row.get_object_id("course_id") {
// //                                 resolved_course_id = Some(cid);
// //                             }
// //                         }
// //                     }
// //                 }

// //                 use crate::models::template::TemplateType;
// //                 let from_fp = cert_doc_clone.get_str("file_path").ok().map(|s| s.trim().starts_with("marksheets/")).unwrap_or(false);
// //                 let from_no = cert_doc_clone.get_str("certificate_no").ok().map(|s| s.trim().starts_with("SC-")).unwrap_or(false);
// //                 let explicit_type_str = cert_doc_clone.get_str("certificate_type").ok().map(|s| s.trim().to_lowercase());
// //                 let inferred_type: TemplateType = match explicit_type_str {
// //                     Some(ref s) if s == "marksheet" => TemplateType::Marksheet,
// //                     Some(ref s) if s == "certificate" => TemplateType::Certificate,
// //                     _ if from_fp || from_no => TemplateType::Marksheet,
// //                     _ => TemplateType::Certificate,
// //                 };

// //                 let mut tpl: Option<crate::models::template::Template> = match cert.template_id.clone() {
// //                     Some(tid) => templates_coll_clone.find_one(doc! { "_id": tid }, None).await.ok().flatten(),
// //                     None => None,
// //                 };

// //                 if tpl.is_none() {
// //                     let try_type_strings: Vec<&'static str> = match inferred_type {
// //                         TemplateType::Marksheet => vec!["marksheet", "Marksheet", "MARKSHEET"],
// //                         TemplateType::Certificate => vec!["certificate", "Certificate", "CERTIFICATE"],
// //                         TemplateType::IdCard => vec!["id_card", "IdCard", "Id_Card", "IDCard", "IDCARD"],
// //                     };
// //                     let try_type_regex = match inferred_type {
// //                         TemplateType::Marksheet => doc! { "$regex": "^Marksheet$|^marksheet$|^MARKSHEET$", "$options": "" },
// //                         TemplateType::Certificate => doc! { "$regex": "^Certificate$|^certificate$|^CERTIFICATE$", "$options": "" },
// //                         TemplateType::IdCard => doc! { "$regex": "id.?card", "$options": "i" },
// //                     };

// //                     macro_rules! apply_find {
// //                         ($filter:expr) => {
// //                             templates_coll_clone.find_one($filter, None).await.ok().flatten()
// //                         };
// //                     }

// //                     if tpl.is_none() {
// //                         if let Some(ref cid) = resolved_course_id {
// //                             for tstr in try_type_strings.iter() {
// //                                 let f = doc! { "template_type": tstr, "course_id": cid, "default_design": true };
// //                                 if let Some(x) = apply_find!(f) { tpl = Some(x); break; }
// //                             }
// //                             if tpl.is_none() {
// //                                 let f = doc! { "template_type": try_type_regex.clone(), "course_id": cid, "default_design": true };
// //                                 tpl = apply_find!(f);
// //                             }
// //                         }
// //                     }
// //                     if tpl.is_none() {
// //                         if let Some(ref cid) = resolved_course_id {
// //                             for tstr in try_type_strings.iter() {
// //                                 let f = doc! { "template_type": tstr, "course_id": cid };
// //                                 if let Some(x) = apply_find!(f) { tpl = Some(x); break; }
// //                             }
// //                             if tpl.is_none() {
// //                                 let f = doc! { "template_type": try_type_regex.clone(), "course_id": cid };
// //                                 tpl = apply_find!(f);
// //                             }
// //                         }
// //                     }
// //                     if tpl.is_none() {
// //                         for tstr in try_type_strings.iter() {
// //                             let f = doc! { "template_type": tstr, "default_design": true };
// //                             if let Some(x) = apply_find!(f) { tpl = Some(x); break; }
// //                         }
// //                         if tpl.is_none() {
// //                             let f = doc! { "template_type": try_type_regex.clone(), "default_design": true };
// //                             tpl = apply_find!(f);
// //                         }
// //                     }
// //                     if tpl.is_none() {
// //                         for tstr in try_type_strings.iter() {
// //                             let f = doc! { "template_type": tstr };
// //                             if let Some(x) = apply_find!(f) { tpl = Some(x); break; }
// //                         }
// //                         if tpl.is_none() {
// //                             let f = doc! { "template_type": try_type_regex.clone() };
// //                             tpl = apply_find!(f);
// //                         }
// //                     }
// //                     if tpl.is_none() {
// //                         if let Ok(Some(raw_doc)) = templates_doc_coll_clone.find_one(doc! {}, None).await {
// //                             if let Ok(deser) = mongodb::bson::from_bson::<crate::models::template::Template>(
// //                                 mongodb::bson::Bson::Document(raw_doc)
// //                             ) {
// //                                 tpl = Some(deser);
// //                             }
// //                         }
// //                     }
// //                 }

// //                 let template = match tpl {
// //                     Some(t) => t,
// //                     None => return None,
// //                 };

// //                 let mut cursor = template_fields_coll_clone
// //                     .find(doc! { "template_id": &template.id.expect("template.id") }, None)
// //                     .await
// //                     .unwrap();
// //                 let mut fields = Vec::new();
// //                 while let Some(result) = cursor.next().await {
// //                     if let Ok(field) = result {
// //                         fields.push(field);
// //                     }
// //                 }
// //                 fields.sort_by(|a, b| {
// //                     a.y_position
// //                         .partial_cmp(&b.y_position)
// //                         .unwrap_or(std::cmp::Ordering::Equal)
// //                         .then_with(|| {
// //                             a.x_position
// //                                 .partial_cmp(&b.x_position)
// //                                 .unwrap_or(std::cmp::Ordering::Equal)
// //                         })
// //                 });
// //                 let center = centers_coll_typed_clone.find_one(doc! { "_id": cert.center_id }, None).await.ok().flatten();
// //                 Some((cert, user, template, fields, center))
// //             }.await
// //         };

// //     let regenerated_html: Option<String> = match (cert_html_from_doc.clone(), cert_and_user_and_template) {
// //         (Some(s), _) => Some(s),
// //         (None, Some((cert, user, template, fields, center_doc))) => {
// //             use crate::handlers::generate_certificates::{CertContext, page_styles, render_page};
// //             use crate::models::template::{PageOrientation, PageSize, Template, TemplateField, TemplateType};
// //             let preview_oid = cert.id.clone().unwrap_or(cert_oid);
// //             let base_url = std::env::var("BASE_URL").unwrap_or_else(|_| "https://screduc.com".to_string());
// //             let verification_url = cert
// //                 .verification_url
// //                 .clone()
// //                 .unwrap_or_else(|| format!("{}/verify-certificate/{}", base_url.trim_end_matches('/'), preview_oid.to_hex()));
// //             let ctx = CertContext {
// //                 student_id: cert.student_id.clone(),
// //                 student_name: user
// //                     .full_name
// //                     .clone()
// //                     .unwrap_or_else(|| user.username.clone()),
// //                 registration_number: user.username.clone(),
// //                 enrollment_number: user.enrollment_number.clone(),
// //                 roll_number: user.roll_number.clone(),
// //                 national_id: user.national_id.clone(),
// //                 father_name: user.father_name.clone(),
// //                 mother_name: user.mother_name.clone(),
// //                 dob: user.dob.clone(),
// //                 background_url: cert.background_url.clone().or_else(|| template.background_image.clone()),
// //                 session_from: user
// //                     .session_start_date
// //                     .clone()
// //                     .or_else(|| user.registration_date.clone()),
// //                 session_to: user.session_end_date.clone(),
// //                 course: cert.course.clone(),
// //                 study_center: center_doc.as_ref().map(|c| c.name.clone()),
// //                 institute: center_doc.as_ref().map(|c| c.name.clone()),
// //                 course_duration: None,
// //                 obtained_marks: None,
// //                 total_marks: None,
// //                 grade: None,
// //                 result_status: None,
// //                 exam_date: None,
// //                 issue_date: cert.issued_on.date_naive().to_string(),
// //                 serial_number: user.serial_number.clone(),
// //                 verification_url,
// //                 photo: user.photo_url.clone(),
// //                 signature: user.signature_url.clone(),
// //                 gender: user.gender.clone(),
// //                 category: user.category.clone(),
// //                 national_id_type: user.national_id_type.clone(),
// //                 address: user.address.clone(),
// //                 city: user.city.clone(),
// //                 state: user.state.clone(),
// //                 pincode: user.pincode.clone(),
// //                 emergency_contact_name: user.emergency_contact_name.clone(),
// //                 emergency_contact_phone: user.emergency_contact_phone.clone(),
// //                 additional_docs: user.additional_docs.clone(),
// //                 subjects: None,
// //                 center_signature: center_doc
// //                     .as_ref()
// //                     .and_then(|c| c.key_documents.as_ref())
// //                     .and_then(|d| d.owner_signature_url.clone()),
// //                 center_stamp: center_doc
// //                     .as_ref()
// //                     .and_then(|c| c.key_documents.as_ref())
// //                     .and_then(|d| d.center_stamp_url.clone()),
// //                 admin_signature: template
// //                     .admin_signature
// //                     .clone(),
// //                 admin_stamp: template
// //                     .admin_stamp
// //                     .clone(),
// //                 marks_rows: None,
// //                 certificate_row_id: Some(preview_oid),
// //                 session: None,
// //                 exam_mode: None,
// //                 admission_mode: None,
// //                 center_address: None,
// //                 center_code: center_doc.as_ref().map(|c| c.code.clone()),
// //                 result_date: None,
// //                 result_percentage: None,
// //                 overall_status: None,
// //                 certificate_no: cert.certificate_no.clone(),
// //             };
// //             let page_css = page_styles(&template);
// //             let page = render_page(&template, &fields, &ctx, &base_url);
// //             let single_page_html = format!(
// //                 r#"<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>{}</style></head><body>{}</body></html>"#,
// //                 page_css, page
// //             );
// //             Some(single_page_html)
// //         }
// //         (None, None) => None,
// //     };

// //     if let Some(html_src) = regenerated_html.or(cert_html_from_doc) {
// //         let certs_dir = upload_pb.join("certificates");
// //         if let Err(e) = std::fs::create_dir_all(&certs_dir) {
// //             eprintln!(
// //                 "download_certificate: materialize: cannot create certificates dir {:?}: {}",
// //                 certs_dir, e
// //             );
// //         } else {
// //             let file_name = format!("{}.pdf", certificate_no);
// //             let rel_path = format!("certificates/{}", file_name);
// //             let full_path = upload_pb.join(&rel_path);
// //             let full_path_for_gen = full_path.clone();
// //             let html_owned = html_src;
// //             let gen_res = tokio::task::spawn_blocking(move || {
// //                 PdfGenerator::html_to_pdf(&html_owned, full_path_for_gen)
// //                     .map_err(|e| e.to_string())
// //             })
// //             .await;
// //             match gen_res {
// //                 Ok(Ok(())) => {
// //                     let coll = db.collection::<BsonDocument>("certificates");
// //                     let _ = coll
// //                         .update_one(
// //                             doc! { "_id": &cert_oid },
// //                             doc! { "$set": { "file_path": &rel_path } },
// //                             None,
// //                         )
// //                         .await;
// //                     match tokio::fs::read(&full_path).await {
// //                         Ok(data) => {
// //                             let data_len = data.len();
// //                             let header_take = std::cmp::min(16, data_len);
// //                             let header_bytes: Vec<u8> = data.iter().take(header_take).copied().collect();
// //                             let header_text = String::from_utf8_lossy(&header_bytes);
// //                             let first32: Vec<u8> = data.iter().take(std::cmp::min(32, data_len)).copied().collect();
// //                             let last32: Vec<u8> = data
// //                                 .iter()
// //                                 .skip(data_len.saturating_sub(32))
// //                                 .copied()
// //                                 .collect();
// //                             let sha_out = Command::new("sha256sum").arg(&full_path).output().ok();
// //                             let sha256 = sha_out
// //                                 .as_ref()
// //                                 .and_then(|o| String::from_utf8(o.stdout.clone()).ok())
// //                                 .and_then(|s| s.split_whitespace().next().map(|h| h.to_string()))
// //                                 .unwrap_or_else(|| "(sha256sum failed)".to_string());
// //                             eprintln!(
// //                                 "[CERT_DOWNLOAD_MATERIALIZED] cert_no={} path={:?} size={} bytes Content-Type=application/pdf Content-Length={} header_hex={} header_text={:?}",
// //                                 certificate_no,
// //                                 full_path, data_len, data_len,
// //                                 header_bytes.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
// //                                 header_text
// //                             );
// //                             eprintln!(
// //                                 "[CERT_DOWNLOAD_MATERIALIZED] first32_hex={} last32_hex={} sha256={}",
// //                                 first32.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
// //                                 last32.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
// //                                 sha256
// //                             );
// //                             if !header_text.starts_with("%PDF-") {
// //                                 eprintln!(
// //                                     "[CERT_DOWNLOAD_MATERIALIZED] FATAL: materialized file {:?} is NOT a PDF! Header bytes: {:02X?}",
// //                                     full_path, header_bytes
// //                                 );
// //                             }
// //                             // #region debug-point I:certificate-download-response
// //                             debug_report(
// //                                 "pre-fix",
// //                                 "I",
// //                                 "backend/src/handlers/certificate.rs:1082",
// //                                 "[DEBUG] Materialized certificate download response bytes prepared",
// //                                 serde_json::json!({
// //                                     "certificate_id": id,
// //                                     "certificate_no": certificate_no,
// //                                     "path": full_path.display().to_string(),
// //                                     "content_type": "application/pdf",
// //                                     "content_disposition": format!("attachment; filename=\"{}\"", file_name),
// //                                     "content_length_header": data_len,
// //                                     "actual_byte_length": data_len,
// //                                     "sha256": sha256,
// //                                     "first32_hex": first32.iter().map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(""),
// //                                     "last32_hex": last32.iter().map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(""),
// //                                 }),
// //                             )
// //                             .await;
// //                             // #endregion
// //                             let res = axum::response::Response::builder()
// //                                 .status(StatusCode::OK)
// //                                 .header(header::CONTENT_TYPE, "application/pdf")
// //                                 .header(header::CONTENT_LENGTH, data_len.to_string())
// //                                 .header(
// //                                     header::CONTENT_DISPOSITION,
// //                                     &format!("attachment; filename=\"{}\"", file_name),
// //                                 )
// //                                 .body(Body::from(data))
// //                                 .expect("materialized certificate response builder");
// //                             return res;
// //                         }
// //                         Err(e) => {
// //                             eprintln!(
// //                                 "download_certificate: materialize: read failed {:?}: {}",
// //                                 full_path, e
// //                             );
// //                         }
// //                     }
// //                 }
// //                 Ok(Err(e)) => {
// //                     eprintln!(
// //                         "download_certificate: materialize: PDF generator failed for cert_no={}: {}",
// //                         certificate_no, e
// //                     );
// //                 }
// //                 Err(e) => {
// //                     eprintln!(
// //                         "download_certificate: materialize: spawn_blocking join error for cert_no={}: {}",
// //                         certificate_no, e
// //                     );
// //                 }
// //             }
// //         }
// //     }

// //     eprintln!(
// //         "Certificate PDF missing for id={} cert_no={} file_path={:?} pdf_url={:?} pdf_path={:?} (tried UPLOAD_DIR={}, backend_dir={})",
// //         id, certificate_no, file_path_opt, pdf_url_opt, pdf_path_opt, upload_dir, backend_dir.display()
// //     );
// //     // 422: cert exists but PDF absent (often Chromium/headless failed during generation, or UPLOAD_DIR mismatch).
// //     (
// //         StatusCode::UNPROCESSABLE_ENTITY,
// //         Json(serde_json::json!({
// //             "success": false,
// //             "code": "PDF_MISSING",
// //             "message": "Certificate exists but PDF is not on disk. Regenerate from Issue certificates (Re-issue if it already exists). On the server: install Chromium (`chromium` or `google-chrome`) and ensure UPLOAD_DIR is writable."
// //         })),
// //     )
// //         .into_response()
// // }

// // #[derive(Debug, Deserialize)]
// // pub struct DownloadBulkCertificatesRequest {
// //     pub certificate_ids: Vec<String>,
// // }

// // fn merge_pdfs_lopdf(pdf_documents: Vec<Vec<u8>>) -> Result<Vec<u8>, String> {
// //     // Based on lopdf's merge example: create a new Document and append Page objects.
// //     if pdf_documents.is_empty() {
// //         return Err("No PDF documents provided".to_string());
// //     }

// //     // Load all PDFs into lopdf Documents, skipping invalid ones.
// //     let mut loaded_docs: Vec<Document> = Vec::new();
// //     for bytes in pdf_documents {
// //         match Document::load_mem(&bytes) {
// //             Ok(doc) => loaded_docs.push(doc),
// //             Err(e) => {
// //                 eprintln!("Skipping invalid PDF while merging: {}", e);
// //             }
// //         }
// //     }

// //     if loaded_docs.is_empty() {
// //         return Err("No valid PDFs could be loaded".to_string());
// //     }

// //     let mut max_id: u32 = 1;
// //     let mut documents_pages: BTreeMap<PdfObjectId, Object> = BTreeMap::new();
// //     let mut documents_objects: BTreeMap<PdfObjectId, Object> = BTreeMap::new();

// //     for mut document in loaded_docs {
// //         document.renumber_objects_with(max_id);
// //         max_id = document.max_id + 1;

// //         // Collect Page objects (and their owning Page content).
// //         documents_pages.extend(
// //             document
// //                 .get_pages()
// //                 .into_iter()
// //                 .map(|(_, object_id)| {
// //                     let obj = document.get_object(object_id).unwrap().to_owned();
// //                     (object_id, obj)
// //                 })
// //                 .collect::<BTreeMap<PdfObjectId, Object>>(),
// //         );

// //         // Collect all non-page objects.
// //         documents_objects.extend(document.objects);
// //     }

// //     let mut merged = Document::with_version("1.5");

// //     // Catalog and root Pages must be present.
// //     let mut catalog_object: Option<(PdfObjectId, Object)> = None;
// //     let mut pages_object: Option<(PdfObjectId, Object)> = None;

// //     // Process objects except "Page" (handled later), and ignore Outlines.
// //     for (object_id, object) in documents_objects.iter() {
// //         match object.type_name().unwrap_or("") {
// //             "Catalog" => {
// //                 catalog_object = Some((
// //                     if let Some((id, _)) = catalog_object {
// //                         id
// //                     } else {
// //                         *object_id
// //                     },
// //                     object.clone(),
// //                 ));
// //             }
// //             "Pages" => {
// //                 if let Ok(dictionary) = object.as_dict() {
// //                     let mut dictionary = dictionary.clone();
// //                     if let Some((_, ref old_pages_object)) = pages_object {
// //                         if let Ok(old_dictionary) = old_pages_object.as_dict() {
// //                             dictionary.extend(old_dictionary);
// //                         }
// //                     }

// //                     pages_object = Some((
// //                         if let Some((id, _)) = pages_object {
// //                             id
// //                         } else {
// //                             *object_id
// //                         },
// //                         Object::Dictionary(dictionary),
// //                     ));
// //                 }
// //             }
// //             "Page" => {} // ignored, processed later and separately
// //             "Outlines" => {} // ignored
// //             "Outline" => {} // ignored
// //             _ => {
// //                 merged.objects.insert(*object_id, object.clone());
// //             }
// //         }
// //     }

// //     let (pages_object_id, pages_root_object) = match pages_object {
// //         Some(v) => v,
// //         None => return Err("Pages root not found while merging PDFs".to_string()),
// //     };
// //     let (catalog_object_id, catalog_root_object) = match catalog_object {
// //         Some(v) => v,
// //         None => return Err("Catalog root not found while merging PDFs".to_string()),
// //     };

// //     // Attach all Page objects to the new root Pages.
// //     for (object_id, object) in documents_pages.iter() {
// //         if let Ok(dictionary) = object.as_dict() {
// //             let mut dictionary = dictionary.clone();
// //             dictionary.set("Parent", pages_object_id);
// //             merged.objects.insert(*object_id, Object::Dictionary(dictionary));
// //         }
// //     }

// //     // Update "Pages" dictionary.
// //     if let Ok(dictionary) = pages_root_object.as_dict() {
// //         let mut dictionary = dictionary.clone();
// //         dictionary.set("Count", documents_pages.len() as u32);
// //         dictionary.set(
// //             "Kids",
// //             documents_pages
// //                 .iter()
// //                 .map(|(object_id, _)| Object::Reference(*object_id))
// //                 .collect::<Vec<_>>(),
// //         );
// //         merged.objects.insert(pages_object_id, Object::Dictionary(dictionary));
// //     }

// //     // Update "Catalog" dictionary to point to Pages root.
// //     if let Ok(dictionary) = catalog_root_object.as_dict() {
// //         let mut dictionary = dictionary.clone();
// //         dictionary.set("Pages", pages_object_id);
// //         dictionary.remove(b"Outlines");
// //         merged.objects.insert(catalog_object_id, Object::Dictionary(dictionary));
// //     }

// //     merged.trailer.set("Root", catalog_object_id);
// //     merged.max_id = merged.objects.len() as u32;
// //     merged.renumber_objects();
// //     merged.compress();

// //     let mut out: Vec<u8> = Vec::new();
// //     merged
// //         .save_to(&mut out)
// //         .map_err(|e| format!("Failed to save merged PDF: {}", e))?;
// //     Ok(out)
// // }

// // pub async fn download_bulk_certificates(
// //     State(db): State<Database>,
// //     claims: Claims,
// //     Json(payload): Json<DownloadBulkCertificatesRequest>,
// // ) -> impl IntoResponse {
// //     if payload.certificate_ids.is_empty() {
// //         return (StatusCode::BAD_REQUEST, "No certificate ids provided").into_response();
// //     }

// //     let upload_dir = std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string());

// //     let mut requested_ids: Vec<ObjectId> = Vec::new();
// //     for id in payload.certificate_ids {
// //         match ObjectId::parse_str(&id) {
// //             Ok(oid) => requested_ids.push(oid),
// //             Err(_) => return (StatusCode::BAD_REQUEST, "Invalid ID in list").into_response(),
// //         }
// //     }

// //     let collection = db.collection::<Certificate>("certificates");
// //     let certs: Vec<Certificate> = match collection
// //         .find(doc! { "_id": { "$in": requested_ids.clone() } }, None)
// //         .await
// //     {
// //         Ok(mut cursor) => {
// //             let mut acc = Vec::new();
// //             while let Some(Ok(c)) = cursor.next().await {
// //                 acc.push(c);
// //             }
// //             acc
// //         }
// //         Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch certificates").into_response(),
// //     };

// //     // Index fetched certificates by their ObjectId.
// //     let mut cert_map: BTreeMap<ObjectId, Certificate> = BTreeMap::new();
// //     for c in certs {
// //         if let Some(oid) = c.id {
// //             cert_map.insert(oid, c);
// //         }
// //     }

// //     // Order the certificates according to the requested id order.
// //     let mut ordered_certs: Vec<Certificate> = Vec::new();
// //     for oid in requested_ids.iter() {
// //         if let Some(c) = cert_map.remove(oid) {
// //             ordered_certs.push(c);
// //         }
// //     }

// //     if ordered_certs.is_empty() {
// //         return (StatusCode::NOT_FOUND, "No certificates found").into_response();
// //     }

// //     // Validate permissions and load PDF bytes.
// //     let student_id = if claims.role == UserRole::Student {
// //         match ObjectId::parse_str(&claims.sub) {
// //             Ok(oid) => Some(oid),
// //             Err(_) => return (StatusCode::BAD_REQUEST, "Invalid student ID").into_response(),
// //         }
// //     } else {
// //         None
// //     };
// //     let center_id = if claims.role == UserRole::Center {
// //         match ObjectId::parse_str(&claims.sub) {
// //             Ok(oid) => Some(oid),
// //             Err(_) => return (StatusCode::BAD_REQUEST, "Invalid center ID").into_response(),
// //         }
// //     } else {
// //         None
// //     };

// //     let mut pdf_bytes: Vec<Vec<u8>> = Vec::new();
// //     let mut missing: Vec<String> = Vec::new();

// //     for cert in ordered_certs {
// //         if let Some(sid) = student_id {
// //             if cert.student_id != sid {
// //                 return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
// //             }
// //         }
// //         if let Some(cid) = center_id {
// //             if cert.center_id != cid {
// //                 return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
// //             }
// //         }

// //         // Only merge issued/approved certificates; draft/scheduled won't have final PDFs.
// //         let status = cert.status.clone().unwrap_or_default();
// //         if status != "approved" && status != "issued" {
// //             continue;
// //         }

// //         let mut found_path: Option<PathBuf> = None;
// //         if let Some(path_str) = cert.file_path.clone() {
// //             let p = PathBuf::from(path_str);
// //             if p.exists() {
// //                 found_path = Some(p);
// //             }
// //         }
// //         if found_path.is_none() {
// //             let expected_rel = format!("certificates/{}.pdf", cert.certificate_no);
// //             let expected = PathBuf::from(&upload_dir).join(&expected_rel);
// //             if expected.exists() {
// //                 found_path = Some(expected);
// //             }
// //         }

// //         if let Some(path) = found_path {
// //             match tokio::fs::read(&path).await {
// //                 Ok(bytes) => pdf_bytes.push(bytes),
// //                 Err(_) => missing.push(cert.certificate_no),
// //             }
// //         } else {
// //             missing.push(cert.certificate_no);
// //         }
// //     }

// //     if pdf_bytes.is_empty() {
// //         eprintln!("No valid PDFs found for bulk download. Missing: {:?}", missing);
// //         return (StatusCode::NOT_FOUND, "No certificate files found for bulk download").into_response();
// //     }

// //     let merged_pdf = match merge_pdfs_lopdf(pdf_bytes) {
// //         Ok(bytes) => bytes,
// //         Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to merge PDFs: {}", e)).into_response(),
// //     };

// //     let file_name = format!("Certificates_{}.pdf", chrono::Utc::now().format("%Y%m%d_%H%M%S"));
// //     let data_len = merged_pdf.len();
// //     let header_take = std::cmp::min(16, data_len);
// //     let header_bytes: Vec<u8> = merged_pdf.iter().take(header_take).copied().collect();
// //     let header_text = String::from_utf8_lossy(&header_bytes);
// //     eprintln!(
// //         "[CERT_BULK_DOWNLOAD] merged PDF size={} bytes Content-Type=application/pdf Content-Length={} header_hex={} header_text={:?}",
// //         data_len, data_len,
// //         header_bytes.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
// //         header_text
// //     );
// //     let res = axum::response::Response::builder()
// //         .status(StatusCode::OK)
// //         .header(header::CONTENT_TYPE, "application/pdf")
// //         .header(header::CONTENT_LENGTH, data_len.to_string())
// //         .header(
// //             header::CONTENT_DISPOSITION,
// //             &format!("attachment; filename=\"{}\"", file_name),
// //         )
// //         .body(Body::from(merged_pdf))
// //         .expect("bulk certificate response builder");
// //     res
// // }
// use axum::{
//     extract::{State, Query, Path},
//     http::{StatusCode, header},
//     body::Body,
//     Json,
//     response::IntoResponse,
// };
// use std::path::PathBuf;
// use std::collections::BTreeMap;
// use std::process::Command;
// use mongodb::{Database, bson::{doc, oid::ObjectId, Document as BsonDocument, Bson}};
// use serde::{Deserialize, Serialize};
// use crate::handlers::generate_certificates::{GenerateRequest, process_generate_certificates};
// use crate::models::user::{UserRole, Claims};
// use crate::models::certificate::Certificate;
// use crate::models::center::Center;
// use crate::models::center_assets::CenterAssets;
// use crate::models::admin_assets::AdminAssets; 
// use crate::services::pdf_generator::PdfGenerator;
// use chrono::Utc;
// use futures_util::stream::StreamExt;
// use lopdf::{Document, Object, ObjectId as PdfObjectId};

// #[derive(Debug, Deserialize)]
// pub struct IssueCertificateRequest {
//     pub student_id: String,
//     pub course: String,
//     pub certificate_no: String,
// }

// #[derive(Debug, Serialize)]
// pub struct CertificateResponse {
//     pub success: bool,
//     pub message: String,
// }

// fn debug_env_value(key: &str) -> Option<String> {
//     let env_path = "/var/www/html/scre/.dbg/admin-certificate-download.env";
//     let content = std::fs::read_to_string(env_path).ok()?;
//     for line in content.lines() {
//         if let Some(value) = line.strip_prefix(&format!("{key}=")) {
//             return Some(value.trim().to_string());
//         }
//     }
//     None
// }

// async fn debug_report(
//     run_id: &str,
//     hypothesis_id: &str,
//     location: &str,
//     msg: &str,
//     data: serde_json::Value,
// ) {
//     let url = debug_env_value("DEBUG_SERVER_URL")
//         .unwrap_or_else(|| "http://127.0.0.1:7780/event".to_string());
//     let session_id = debug_env_value("DEBUG_SESSION_ID")
//         .unwrap_or_else(|| "admin-certificate-download".to_string());
//     let payload = serde_json::json!({
//         "sessionId": session_id,
//         "runId": run_id,
//         "hypothesisId": hypothesis_id,
//         "location": location,
//         "msg": msg,
//         "data": data,
//         "ts": chrono::Utc::now().timestamp_millis(),
//     });
//     let _ = reqwest::Client::new().post(url).json(&payload).send().await;
// }

// pub async fn issue_certificate(
//     State(db): State<Database>,
//     claims: Claims,
//     Json(payload): Json<IssueCertificateRequest>,
// ) -> (StatusCode, Json<CertificateResponse>) {
//     if claims.role != UserRole::Center && claims.role != UserRole::Admin {
//         return (StatusCode::FORBIDDEN, Json(CertificateResponse {
//             success: false,
//             message: "Unauthorized".to_string(),
//         }));
//     }

//     let collection = db.collection::<Certificate>("certificates");
//     let student_oid = match ObjectId::parse_str(&payload.student_id) {
//         Ok(oid) => oid,
//         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid Student ID".to_string() })),
//     };
//     let center_id = match ObjectId::parse_str(&claims.sub) {
//         Ok(oid) => oid,
//         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid center user ID".to_string() })),
//     };

//     let cert = Certificate {
//         id: None,
//         student_id: student_oid,
//         center_id,
//         course: payload.course,
//         course_id: None,
//         certificate_no: payload.certificate_no,
//         center_name: None,
//         center_signature_url: None,
//         center_stamp_url: None,
//         admin_signature_url: None,
//         admin_stamp_url: None,
//         signature_url: None,
//         stamp_url: None,
//         background_url: None,
//         issued_on: Utc::now(),
//         status: Some("draft".to_string()),
//         template_id: None,
//         verification_url: None,
//         pdf_url: None,
//         file_path: None,
//         scheduled_at: None,
//         certificate_type: crate::models::certificate::CertificateType::Certificate,
//         attempt_number: Some(1),
//     };

//     match collection.insert_one(cert, None).await {
//         Ok(_) => (StatusCode::CREATED, Json(CertificateResponse { success: true, message: "Certificate issued".to_string() })),
//         Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(CertificateResponse { success: false, message: "Failed to save certificate".to_string() })),
//     }
// }

// #[derive(Debug, Deserialize)]
// pub struct GetCertificatesQuery {
//     pub student_id: Option<String>,
//     pub template_id: Option<String>,
// }

// pub async fn get_certificates(
//     State(db): State<Database>,
//     claims: Claims,
//     Query(params): Query<GetCertificatesQuery>,
// ) -> (StatusCode, Json<Vec<Certificate>>) {
//     let collection = db.collection::<Certificate>("certificates");
//     let mut filter = doc! {};

//     match claims.role {
//         UserRole::Center => {
//             let center_user_id = match ObjectId::parse_str(&claims.sub) {
//                 Ok(oid) => oid,
//                 Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
//             };
//             let centers_coll = db.collection::<crate::models::center::Center>("centers");
//             if let Ok(Some(center)) = centers_coll.find_one(doc! { "user_id": center_user_id }, None).await {
//                 if let Some(cid) = center.id {
//                     filter.insert("center_id", cid);
//                 } else {
//                     filter.insert("center_id", center_user_id);
//                 }
//             } else {
//                 filter.insert("center_id", center_user_id);
//             }
//         }
//         UserRole::Student => {
//             let student_id = match ObjectId::parse_str(&claims.sub) {
//                 Ok(oid) => oid,
//                 Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
//             };
//             filter.insert("student_id", student_id);
//             filter.insert("status", "approved");
//         }
//         UserRole::Admin | UserRole::SuperAdmin => {}
//         _ => {
//             return (StatusCode::OK, Json(Vec::new()));
//         }
//     }

//     if let Some(sid) = params.student_id {
//         if let Ok(oid) = ObjectId::parse_str(&sid) {
//             filter.insert("student_id", oid);
//         }
//     }

//     if let Some(tid) = params.template_id {
//         if let Ok(oid) = ObjectId::parse_str(&tid) {
//             filter.insert("template_id", oid);
//         }
//     }

//     let mut cursor = match collection.find(filter, None).await {
//         Ok(c) => c,
//         Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
//     };

//     let upload_dir = std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string());
//     let upload_pb = std::path::PathBuf::from(&upload_dir);

//     let mut certs = Vec::new();
//     while let Some(result) = cursor.next().await {
//         if let Ok(mut cert) = result {
//             println!("get_certificates: Processing cert: cert_id = {:?}, cert_no = {:?}, file_path = {:?}", cert.id, cert.certificate_no, cert.file_path);
//             // Proactively check if PDF exists on disk
//             let mut exists = false;
//             if let Some(ref p) = cert.file_path {
//                 let pb = std::path::PathBuf::from(p);
//                 println!("  Checking pb.exists() for {:?}: {}", pb, pb.exists());
//                 println!("  Checking upload_pb.join(p).exists(): {}", upload_pb.join(p).exists());
//                 if pb.exists() || upload_pb.join(p).exists() {
//                     exists = true;
//                 }
//             }
//             if !exists {
//                 let fallback_cert = upload_pb.join(format!("certificates/{}.pdf", cert.certificate_no));
//                 println!("  Checking fallback_cert {:?}: {}", fallback_cert, fallback_cert.exists());
//                 if fallback_cert.exists() {
//                     exists = true;
//                 }
//                 if !exists {
//                     let fallback_marksheet = upload_pb.join(format!("marksheets/{}.pdf", cert.certificate_no));
//                     println!("  Checking fallback_marksheet {:?}: {}", fallback_marksheet, fallback_marksheet.exists());
//                     if fallback_marksheet.exists() {
//                         exists = true;
//                     }
//                 }
//             }

//             println!("  Adding to certs: exists = {}", exists);
//             certs.push(cert);
//         }
//     }
//     (StatusCode::OK, Json(certs))
// }

// /// Center applies sign & stamp from their center assets to a draft certificate
// pub async fn apply_sign_stamp(
//     State(db): State<Database>,
//     claims: Claims,
//     Path(id): Path<String>,
// ) -> (StatusCode, Json<CertificateResponse>) {
//     if claims.role != UserRole::Center {
//         return (StatusCode::FORBIDDEN, Json(CertificateResponse { success: false, message: "Unauthorized".to_string() }));
//     }
//     let cert_oid = match ObjectId::parse_str(&id) {
//         Ok(o) => o,
//         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid certificate ID".to_string() })),
//     };
//     let center_id = match ObjectId::parse_str(&claims.sub) {
//         Ok(oid) => oid,
//         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid center user ID".to_string() })),
//     };

//     let certs = db.collection::<Certificate>("certificates");
//     let _cert = match certs.find_one(doc! { "_id": &cert_oid, "center_id": &center_id, "status": "draft" }, None).await {
//         Ok(Some(c)) => c,
//         _ => return (StatusCode::NOT_FOUND, Json(CertificateResponse { success: false, message: "Certificate not found or not in draft".to_string() })),
//     };

//     let assets_coll = db.collection::<CenterAssets>("center_assets");
//     let assets: Option<CenterAssets> = assets_coll.find_one(doc! { "center_id": &center_id }, None).await.ok().flatten();
//     let sig = assets.as_ref().and_then(|a| a.signature_url.clone());
//     let stamp = assets.as_ref().and_then(|a| a.stamp_url.clone());
//     if sig.is_none() && stamp.is_none() {
//         return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Configure signature and stamp in Center Assets first".to_string() }));
//     }

//     let _ = certs.update_one(
//         doc! { "_id": &cert_oid },
//         doc! { "$set": {
//             "center_signature_url": sig.clone(),
//             "center_stamp_url": stamp.clone(),
//             "signature_url": sig,
//             "stamp_url": stamp,
//             "status": "pending_approval",
//         }},
//         None,
//     ).await;

//     (StatusCode::OK, Json(CertificateResponse { success: true, message: "Sign and stamp applied. Awaiting admin approval.".to_string() }))
// }

// /// Admin approves certificate sign & stamp
// pub async fn admin_approve_certificate(
//     State(db): State<Database>,
//     claims: Claims,
//     Path(id): Path<String>,
// ) -> (StatusCode, Json<CertificateResponse>) {
//     if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
//         return (StatusCode::FORBIDDEN, Json(CertificateResponse { success: false, message: "Unauthorized".to_string() }));
//     }
//     let cert_oid = match ObjectId::parse_str(&id) {
//         Ok(o) => o,
//         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid certificate ID".to_string() })),
//     };

//     let certs = db.collection::<Certificate>("certificates");

//     // Load admin-specific assets (optional) to attach background/signature if desired
//     let admin_id = match ObjectId::parse_str(&claims.sub) {
//         Ok(oid) => oid,
//         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid admin ID".to_string() })),
//     };
//     let admin_assets_coll = db.collection::<AdminAssets>("admin_assets");
//     let admin_assets: Option<AdminAssets> = admin_assets_coll
//         .find_one(doc! { "admin_id": &admin_id }, None)
//         .await
//         .ok()
//         .flatten();

//     let mut set_doc = doc! { "status": "approved" };
//     if let Some(a) = admin_assets {
//         if let Some(bg) = a.background_url {
//             set_doc.insert("background_url", bg);
//         }
//         if let Some(sig) = a.signature_url {
//             set_doc.insert("admin_signature_url", sig.clone());
//             set_doc.insert("signature_url", sig);
//         }
//         if let Some(stamp) = a.stamp_url {
//             set_doc.insert("admin_stamp_url", stamp.clone());
//             set_doc.insert("stamp_url", stamp);
//         }
//     }

//     let result = certs
//         .update_one(
//             doc! { "_id": &cert_oid, "status": "pending_approval" },
//             doc! { "$set": set_doc },
//             None,
//         )
//         .await;

//     match result {
//         Ok(r) if r.modified_count > 0 => (StatusCode::OK, Json(CertificateResponse { success: true, message: "Certificate approved".to_string() })),
//         Ok(_) => (StatusCode::NOT_FOUND, Json(CertificateResponse { success: false, message: "Certificate not found or not pending approval".to_string() })),
//         Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(CertificateResponse { success: false, message: "Failed to approve".to_string() })),
//     }
// }

// #[derive(Debug, Deserialize)]
// pub struct BulkIds {
//     pub ids: Vec<String>,
// }

// pub async fn apply_sign_stamp_bulk(
//     State(db): State<Database>,
//     claims: Claims,
//     Json(payload): Json<BulkIds>,
// ) -> (StatusCode, Json<CertificateResponse>) {
//     if claims.role != UserRole::Center {
//         return (StatusCode::FORBIDDEN, Json(CertificateResponse { success: false, message: "Unauthorized".to_string() }));
//     }
//     let center_id = match ObjectId::parse_str(&claims.sub) {
//         Ok(o) => o,
//         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid center".to_string() })),
//     };
//     let ids: Vec<ObjectId> = payload.ids.iter().filter_map(|s| ObjectId::parse_str(s).ok()).collect();
//     if ids.is_empty() {
//         return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "No valid IDs".to_string() }));
//     }
//     let assets_coll = db.collection::<CenterAssets>("center_assets");
//     let assets: Option<CenterAssets> = assets_coll.find_one(doc! { "center_id": &center_id }, None).await.ok().flatten();
//     let sig = assets.as_ref().and_then(|a| a.signature_url.clone());
//     let stamp = assets.as_ref().and_then(|a| a.stamp_url.clone());
//     if sig.is_none() && stamp.is_none() {
//         return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Configure signature and stamp in Center Assets first".to_string() }));
//     }
//     let certs = db.collection::<Certificate>("certificates");
//     let _ = certs
//         .update_many(
//             doc! { "_id": { "$in": &ids }, "center_id": &center_id, "status": "draft" },
//             doc! { "$set": {
//                 "center_signature_url": sig.clone(),
//                 "center_stamp_url": stamp.clone(),
//                 "signature_url": sig,
//                 "stamp_url": stamp,
//                 "status": "pending_approval",
//             }},
//             None,
//         )
//         .await;
//     (StatusCode::OK, Json(CertificateResponse { success: true, message: "Applied sign & stamp to selected certificates".to_string() }))
// }

// pub async fn admin_approve_certificates_bulk(
//     State(db): State<Database>,
//     claims: Claims,
//     Json(payload): Json<BulkIds>,
// ) -> (StatusCode, Json<CertificateResponse>) {
//     if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
//         return (StatusCode::FORBIDDEN, Json(CertificateResponse { success: false, message: "Unauthorized".to_string() }));
//     }
//     let admin_id = match ObjectId::parse_str(&claims.sub) {
//         Ok(o) => o,
//         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid admin".to_string() })),
//     };
//     let ids: Vec<ObjectId> = payload.ids.iter().filter_map(|s| ObjectId::parse_str(s).ok()).collect();
//     if ids.is_empty() {
//         return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "No valid IDs".to_string() }));
//     }
//     let admin_assets_coll = db.collection::<AdminAssets>("admin_assets");
//     let admin_assets: Option<AdminAssets> = admin_assets_coll
//         .find_one(doc! { "admin_id": &admin_id }, None)
//         .await
//         .ok()
//         .flatten();
//     let mut set_doc = doc! { "status": "approved" };
//     if let Some(a) = admin_assets {
//         if let Some(bg) = a.background_url {
//             set_doc.insert("background_url", bg);
//         }
//         if let Some(sig) = a.signature_url {
//             set_doc.insert("admin_signature_url", sig.clone());
//             set_doc.insert("signature_url", sig);
//         }
//         if let Some(stamp) = a.stamp_url {
//             set_doc.insert("admin_stamp_url", stamp.clone());
//             set_doc.insert("stamp_url", stamp);
//         }
//     }
//     let certs = db.collection::<Certificate>("certificates");
//     let _ = certs
//         .update_many(
//             doc! { "_id": { "$in": &ids }, "status": "pending_approval" },
//             doc! { "$set": set_doc },
//             None,
//         )
//         .await;
//     (StatusCode::OK, Json(CertificateResponse { success: true, message: "Approved selected certificates".to_string() }))
// }

// pub async fn public_verify_certificate(
//     State(db): State<Database>,
//     Path(reg_no): Path<String>,
// ) -> impl IntoResponse {
//     let collection = db.collection::<Certificate>("certificates");
//     // Search by certificate_no which is used as registration_number in the URL
//     match collection.find_one(doc! { "certificate_no": &reg_no, "status": "approved" }, None).await {
//         Ok(Some(cert)) => (StatusCode::OK, Json(cert)).into_response(),
//         Ok(None) => (
//             StatusCode::NOT_FOUND,
//             Json(serde_json::json!({"success": false, "message": "Not Found"})),
//         )
//             .into_response(),
//         Err(_) => (
//             StatusCode::NOT_FOUND,
//             Json(serde_json::json!({"success": false, "message": "Not Found"})),
//         )
//             .into_response(),
//     }
// }

// pub async fn public_verify_certificate_by_id(
//     State(db): State<Database>,
//     Path(id): Path<String>,
// ) -> impl IntoResponse {
//     let collection = db.collection::<Certificate>("certificates");
//     let users_coll = db.collection::<crate::models::user::User>("users");
//     let oid = match ObjectId::parse_str(&id) {
//         Ok(o) => o,
//         Err(_) => {
//             return (
//                 StatusCode::NOT_FOUND,
//                 Json(serde_json::json!({"success": false, "message": "Not Found"})),
//             )
//                 .into_response();
//         }
//     };
//     // Search by certificate id
//     match collection.find_one(doc! { "_id": &oid, "status": "approved" }, None).await {
//         Ok(Some(cert)) => {
//             // Also fetch student details
//             let student = users_coll.find_one(doc! { "_id": &cert.student_id }, None).await.ok().flatten();

//             let response = serde_json::json!({
//                 "success": true,
//                 "certificate": cert,
//                 "student": student
//             });
//             (StatusCode::OK, Json(response)).into_response()
//         },
//         Ok(None) => (
//             StatusCode::NOT_FOUND,
//             Json(serde_json::json!({"success": false, "message": "Not Found"})),
//         )
//             .into_response(),
//         Err(_) => (
//             StatusCode::NOT_FOUND,
//             Json(serde_json::json!({"success": false, "message": "Not Found"})),
//         )
//             .into_response(),
//     }
// }

// pub async fn delete_certificate(
//     State(db): State<Database>,
//     claims: Claims,
//     Path(id): Path<String>,
// ) -> (StatusCode, Json<CertificateResponse>) {
//     if !require_admin(&claims) {
//         return (StatusCode::FORBIDDEN, Json(CertificateResponse { success: false, message: "Unauthorized".to_string() }));
//     }
//     let oid = match ObjectId::parse_str(&id) {
//         Ok(oid) => oid,
//         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid ID".to_string() })),
//     };
//     let coll = db.collection::<Certificate>("certificates");

//     // Optional: delete PDF file from disk
//     if let Ok(Some(cert)) = coll.find_one(doc! { "_id": &oid }, None).await {
//         if let Some(path) = cert.file_path {
//             let upload_dir = std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string());
//             let full_path = std::path::PathBuf::from(upload_dir).join(path);
//             let _ = tokio::fs::remove_file(full_path).await;
//         }
//     }

//     match coll.delete_one(doc! { "_id": oid }, None).await {
//         Ok(_) => (StatusCode::OK, Json(CertificateResponse { success: true, message: "Certificate deleted successfully".to_string() })),
//         Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(CertificateResponse { success: false, message: "Failed to delete".to_string() })),
//     }
// }

// fn require_admin(claims: &Claims) -> bool {
//     claims.role == UserRole::Admin || claims.role == UserRole::SuperAdmin
// }

// fn download_err_json(status: StatusCode, code: &'static str, message: &str) -> axum::response::Response {
//     (
//         status,
//         Json(serde_json::json!({
//             "success": false,
//             "code": code,
//             "message": message,
//         })),
//     )
//         .into_response()
// }

// // pub async fn download_certificate(
// //     State(db): State<Database>,
// //     claims: Claims,
// //     Path(id): Path<String>,
// // ) -> impl IntoResponse {
// //     // #region debug-point H:certificate-download-entry
// //     debug_report(
// //         "pre-fix",
// //         "H",
// //         "backend/src/handlers/certificate.rs:495",
// //         "[DEBUG] Shared certificate download handler entered",
// //         serde_json::json!({
// //             "certificate_id": id,
// //             "role": match claims.role {
// //                 UserRole::Admin => "admin",
// //                 UserRole::SuperAdmin => "superadmin",
// //                 UserRole::Student => "student",
// //                 UserRole::Center => "center",
// //                 _ => "other",
// //             },
// //         }),
// //     )
// //     .await;
// //     // #endregion
// //     // Read raw BSON — `find_one::<Certificate>` can fail deserialization on legacy/extra fields and
// //     // older binaries mapped that to 404, which looked like "wrong ID". Raw docs always load if the row exists.
// //     let coll = db.collection::<BsonDocument>("certificates");
// //     let cert_oid = match ObjectId::parse_str(&id) {
// //         Ok(oid) => oid,
// //         Err(_) => {
// //             return download_err_json(
// //                 StatusCode::BAD_REQUEST,
// //                 "INVALID_ID",
// //                 "Invalid certificate ID",
// //             );
// //         }
// //     };

// //     let cert_doc = match coll.find_one(doc! { "_id": &cert_oid }, None).await {
// //         Ok(Some(d)) => {
// //             d
// //         }
// //         Ok(None) => {
// //             return download_err_json(
// //                 StatusCode::NOT_FOUND,
// //                 "CERT_NOT_FOUND",
// //                 "Certificate not found (wrong ID, different database, or row deleted).",
// //             );
// //         }
// //         Err(e) => {
// //             eprintln!("download_certificate: find_one raw document failed: {}", e);
// //             return download_err_json(
// //                 StatusCode::INTERNAL_SERVER_ERROR,
// //                 "CERT_FETCH_ERROR",
// //                 "Could not read certificate from database.",
// //             );
// //         }
// //     };

// //     let cert_student_id = match cert_doc.get_object_id("student_id") {
// //         Ok(oid) => {
// //             oid
// //         }
// //         Err(e) => {
// //             return download_err_json(
// //                 StatusCode::INTERNAL_SERVER_ERROR,
// //                 "CERT_SCHEMA",
// //                 "Certificate record is missing a valid student_id.",
// //             );
// //         }
// //     };
// //     let cert_center_id = match cert_doc.get_object_id("center_id") {
// //         Ok(oid) => {
// //             oid
// //         }
// //         Err(e) => {
// //             return download_err_json(
// //                 StatusCode::INTERNAL_SERVER_ERROR,
// //                 "CERT_SCHEMA",
// //                 "Certificate record is missing a valid center_id.",
// //             );
// //         }
// //     };
// //     let certificate_no = match cert_doc.get_str("certificate_no") {
// //         Ok(s) => {
// //             s.to_string()
// //         }
// //         Err(e) => {
// //             return download_err_json(
// //                 StatusCode::INTERNAL_SERVER_ERROR,
// //                 "CERT_SCHEMA",
// //                 "Certificate record is missing certificate_no.",
// //             );
// //         }
// //     };
// //     let file_path_opt = cert_doc.get("file_path").and_then(|b| match b {
// //         Bson::String(s) if !s.is_empty() => Some(s.clone()),
// //         _ => None,
// //     });
// //     let pdf_url_opt = cert_doc.get("pdf_url").and_then(|b| match b {
// //         Bson::String(s) if !s.is_empty() => Some(s.clone()),
// //         _ => None,
// //     });
// //     let pdf_path_opt = cert_doc.get("pdf_path").and_then(|b| match b {
// //         Bson::String(s) if !s.is_empty() => Some(s.clone()),
// //         _ => None,
// //     });

// //     // Check permissions
// //     if claims.role == UserRole::Student {
// //         let student_id = match ObjectId::parse_str(&claims.sub) {
// //             Ok(oid) => oid,
// //             Err(_) => {
// //                 return download_err_json(
// //                     StatusCode::BAD_REQUEST,
// //                     "INVALID_SUBJECT",
// //                     "Invalid student ID in token",
// //                 );
// //             }
// //         };
// //         if cert_student_id != student_id {
// //             return download_err_json(
// //                 StatusCode::FORBIDDEN,
// //                 "FORBIDDEN",
// //                 "You do not have access to this certificate",
// //             );
// //         }
// //     } else if claims.role == UserRole::Center {
// //         let center_login_oid = match ObjectId::parse_str(&claims.sub) {
// //             Ok(oid) => oid,
// //             Err(_) => {
// //                 return download_err_json(
// //                     StatusCode::BAD_REQUEST,
// //                     "INVALID_SUBJECT",
// //                     "Invalid center ID in token",
// //                 );
// //             }
// //         };
// //         // Issued certs store `centers._id` as `center_id`, but the center account JWT `sub` is the center *login user* id (`centers.user_id`).
// //         let centers_coll = db.collection::<Center>("centers");
// //         let mut can_access = cert_center_id == center_login_oid;
// //         if !can_access {
// //             if let Ok(Some(center)) = centers_coll
// //                 .find_one(doc! { "user_id": &center_login_oid }, None)
// //                 .await
// //             {
// //                 if let Some(cid) = center.id {
// //                     can_access = cid == cert_center_id;
// //                 }
// //             }
// //         }
// //         if !can_access {
// //             return download_err_json(
// //                 StatusCode::FORBIDDEN,
// //                 "FORBIDDEN",
// //                 "You do not have access to this certificate",
// //             );
// //         }
// //     } else if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
// //         return download_err_json(
// //             StatusCode::FORBIDDEN,
// //             "FORBIDDEN",
// //             "You do not have access to this certificate",
// //         );
// //     } else {
// //         // Admin / SuperAdmin — allowed to view/download any center's, any student's certificate.
// //     }

// //     // Resolve PDF on disk: DB may store absolute path, or relative to UPLOAD_DIR (e.g. `certificates/CERT-....pdf`).
// //     let upload_dir = std::env::var("UPLOAD_DIR")
// //         .unwrap_or_else(|_| "/var/www/html/scre/backend/uploads".to_string());
// //     let upload_pb = PathBuf::from(&upload_dir);
// //     let backend_dir = PathBuf::from("/var/www/html/scre/backend"); // Default backend directory
// //     let public_dir = PathBuf::from("/var/www/html/scre/public"); // Check public directory too
// //     let public_uploads_dir = public_dir.join("uploads");

// //     eprintln!("download_certificate: cert_id={}, cert_no={}, file_path={:?}, pdf_url={:?}, pdf_path={:?}",
// //         id, certificate_no, file_path_opt, pdf_url_opt, pdf_path_opt);

// //     let mut candidates: Vec<PathBuf> = Vec::new();
// //     // First try file_path
// //     if let Some(ref p) = file_path_opt {
// //         let pb = PathBuf::from(p);
// //         candidates.push(pb.clone());
// //         if pb.is_relative() {
// //             candidates.push(upload_pb.join(p));
// //             candidates.push(backend_dir.join(p));
// //             candidates.push(public_dir.join(p));
// //             candidates.push(public_uploads_dir.join(p));
// //         }
// //     }
// //     // Then try pdf_url (remove /uploads/ prefix if present)
// //     if let Some(ref p) = pdf_url_opt {
// //         let normalized = p.trim_start_matches('/').trim_start_matches("uploads/").to_string();
// //         candidates.push(upload_pb.join(&normalized));
// //         candidates.push(backend_dir.join(&normalized));
// //         candidates.push(public_dir.join(&normalized));
// //         candidates.push(public_uploads_dir.join(&normalized));
// //     }
// //     // Then try pdf_path
// //     if let Some(ref p) = pdf_path_opt {
// //         let pb = PathBuf::from(p);
// //         candidates.push(pb.clone());
// //         if pb.is_relative() {
// //             candidates.push(upload_pb.join(p));
// //             candidates.push(backend_dir.join(p));
// //             candidates.push(public_dir.join(p));
// //             candidates.push(public_uploads_dir.join(p));
// //         }
// //     }
// //     // Then try certificate_no fallback (both certificates and marksheets folders!)
// //     let cert_file = format!("certificates/{}.pdf", certificate_no);
// //     candidates.push(upload_pb.join(&cert_file));
// //     candidates.push(backend_dir.join(&cert_file));
// //     candidates.push(public_dir.join(&cert_file));
// //     candidates.push(public_uploads_dir.join(&cert_file));
// //     let marksheet_file = format!("marksheets/{}.pdf", certificate_no);
// //     candidates.push(upload_pb.join(&marksheet_file));
// //     candidates.push(backend_dir.join(&marksheet_file));
// //     candidates.push(public_dir.join(&marksheet_file));
// //     candidates.push(public_uploads_dir.join(&marksheet_file));
// //     // Also check just certificate_no.pdf directly in uploads folders
// //     candidates.push(upload_pb.join(format!("{}.pdf", certificate_no)));
// //     candidates.push(backend_dir.join(format!("{}.pdf", certificate_no)));
// //     candidates.push(public_uploads_dir.join(format!("{}.pdf", certificate_no)));

// //     let mut seen = std::collections::HashSet::<std::path::PathBuf>::new();
// //     for path in candidates {
// //         if !seen.insert(path.clone()) {
// //             continue;
// //         }
// //         if !path.exists() {
// //             continue;
// //         }
// //         match tokio::fs::read(&path).await {
// //             Ok(data) => {
// //                 let file_name = path
// //                     .file_name()
// //                     .and_then(|n| n.to_str())
// //                     .unwrap_or("certificate.pdf");
// //                 let data_len = data.len();
// //                 let header_take = std::cmp::min(16, data_len);
// //                 let header_bytes: Vec<u8> = data.iter().take(header_take).copied().collect();
// //                 let header_text = String::from_utf8_lossy(&header_bytes);
// //                 let first32: Vec<u8> = data.iter().take(std::cmp::min(32, data_len)).copied().collect();
// //                 let last32: Vec<u8> = data
// //                     .iter()
// //                     .skip(data_len.saturating_sub(32))
// //                     .copied()
// //                     .collect();
// //                 let sha_out = Command::new("sha256sum").arg(&path).output().ok();
// //                 let sha256 = sha_out
// //                     .as_ref()
// //                     .and_then(|o| String::from_utf8(o.stdout.clone()).ok())
// //                     .and_then(|s| s.split_whitespace().next().map(|h| h.to_string()))
// //                     .unwrap_or_else(|| "(sha256sum failed)".to_string());
// //                 eprintln!(
// //                     "[CERT_DOWNLOAD] serving path={:?} size={} bytes Content-Type=application/pdf Content-Length={} header_hex={} header_text={:?}",
// //                     path, data_len, data_len,
// //                     header_bytes.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
// //                     header_text
// //                 );
// //                 eprintln!(
// //                     "[CERT_DOWNLOAD] first32_hex={} last32_hex={} sha256={}",
// //                     first32.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
// //                     last32.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
// //                     sha256
// //                 );
// //                 if !header_text.starts_with("%PDF-") {
// //                     eprintln!(
// //                         "[CERT_DOWNLOAD] FATAL: file {:?} is NOT a PDF! Header bytes: {:02X?}",
// //                         path, header_bytes
// //                     );
// //                 }
// //                 // #region debug-point I:certificate-download-response
// //                 debug_report(
// //                     "pre-fix",
// //                     "I",
// //                     "backend/src/handlers/certificate.rs:720",
// //                     "[DEBUG] Shared certificate download response bytes prepared",
// //                     serde_json::json!({
// //                         "certificate_id": id,
// //                         "path": path.display().to_string(),
// //                         "content_type": "application/pdf",
// //                         "content_disposition": format!("attachment; filename=\"{}\"", file_name),
// //                         "content_length_header": data_len,
// //                         "actual_byte_length": data_len,
// //                         "sha256": sha256,
// //                         "first32_hex": first32.iter().map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(""),
// //                         "last32_hex": last32.iter().map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(""),
// //                     }),
// //                 )
// //                 .await;
// //                 // #endregion
// //                 let res = axum::response::Response::builder()
// //                     .status(StatusCode::OK)
// //                     .header(header::CONTENT_TYPE, "application/pdf")
// //                     .header(header::CONTENT_LENGTH, data_len.to_string())
// //                     .header(
// //                         header::CONTENT_DISPOSITION,
// //                         &format!("attachment; filename=\"{}\"", file_name),
// //                     )
// //                     .body(Body::from(data))
// //                     .expect("certificate response builder");
// //                 return res;
// //             }
// //             Err(e) => {
// //                 eprintln!("Failed to read certificate file at {:?}: {}", path, e);
// //             }
// //         }
// //     }

// //     if let Some(template_oid) = cert_doc.get_object_id("template_id").ok() {
// //         let issue_date = cert_doc
// //             .get_datetime("issued_on")
// //             .ok()
// //             .map(|dt| dt.to_chrono().date_naive().to_string())
// //             .unwrap_or_else(|| Utc::now().date_naive().to_string());

// //         let regen_payload = GenerateRequest {
// //             template_id: template_oid.to_hex(),
// //             student_ids: vec![cert_student_id.to_hex()],
// //             issue_date: Some(issue_date),
// //             mode: None,
// //             scheduled_at: None,
// //             reissue: Some(true),
// //             force_new: Some(false),
// //             attempt_number: None,
// //         };

// //         let (regen_status, regen_resp) =
// //             process_generate_certificates(&db, UserRole::Admin, regen_payload).await;
// //         let regen_message = regen_resp.0.message.clone();
// //         eprintln!(
// //             "download_certificate: regen via process_generate_certificates status={} success={} cert_no={} message={}",
// //             regen_status.as_u16(),
// //             regen_resp.0.success,
// //             certificate_no,
// //             regen_message
// //         );

// //         let regenerated_path = upload_pb.join(format!("certificates/{}.pdf", certificate_no));
// //         if regenerated_path.exists() {
// //             match tokio::fs::read(&regenerated_path).await {
// //                 Ok(data) => {
// //                     let file_name = regenerated_path
// //                         .file_name()
// //                         .and_then(|n| n.to_str())
// //                         .unwrap_or("certificate.pdf");
// //                     let data_len = data.len();
// //                     let res = axum::response::Response::builder()
// //                         .status(StatusCode::OK)
// //                         .header(header::CONTENT_TYPE, "application/pdf")
// //                         .header(header::CONTENT_LENGTH, data_len.to_string())
// //                         .header(
// //                             header::CONTENT_DISPOSITION,
// //                             &format!("attachment; filename=\"{}\"", file_name),
// //                         )
// //                         .body(Body::from(data))
// //                         .expect("certificate response builder after regen");
// //                     return res;
// //                 }
// //                 Err(e) => {
// //                     eprintln!(
// //                         "download_certificate: regenerated file exists but could not be read {:?}: {}",
// //                         regenerated_path, e
// //                     );
// //                 }
// //             }
// //         }
// //     }

// //     // ---- Last-ditch: if the PDF artifact isn't on disk but the DB row already carries the fully
// //     // pre-rendered `html` blob (rendered at issue time — same data the Student Panel preview uses),
// //     // transparently materialize the PDF on-demand using the same PdfGenerator pipeline. No
// //     // re-approval, no re-issue, no template re-rendering. Write to
// //     // `uploads/certificates/{certificate_no}.pdf`, update the stored `file_path` for future hits,
// //     // then serve the freshly written bytes. If anything in this chain fails we still fall through
// //     // to the original 422 below so no behaviour regression.
// //     let cert_html_from_doc = cert_doc
// //         .get("html")
// //         .and_then(|b| match b {
// //             Bson::String(s) if !s.is_empty() => Some(s.clone()),
// //             _ => None,
// //         });

// //     // If the stored rendered HTML is absent on the cert row, do one last recovery: re-render the
// //     // page from the stored typed Certificate + referenced Template + User. This rescues rows that
// //     // were skipped entirely during the old generation loop because `ctx.serial_number` (derived
// //     // from `user.serial_number`) was `None` on the user record even though the row itself has a
// //     // valid `certificate_no`. Uses exactly the same `render_page`/`page_styles`/`CertContext`
// //     // pipeline as normal generation (just exported for this call).
// //     let certs_coll_typed = db.collection::<Certificate>("certificates");
// //     let users_coll_typed = db.collection::<crate::models::user::User>("users");
// //     let templates_coll = db.collection::<crate::models::template::Template>("templates");
// //     let templates_doc_coll: mongodb::Collection<mongodb::bson::Document> =
// //         db.collection::<mongodb::bson::Document>("templates");
// //     let template_fields_coll = db.collection::<crate::models::template::TemplateField>("template_fields");
// //     let centers_coll_typed = db.collection::<Center>("centers");
// //     let cert_and_user_and_template: Option<(Certificate, crate::models::user::User, crate::models::template::Template, Vec<crate::models::template::TemplateField>, Option<Center>)> =
// //         if cert_html_from_doc.is_some() {
// //             None
// //         } else {
// //             // Clone the DB handle (MongoDB Database is an Arc internally; this is cheap).
// //             // We use async move {} so that `return None` inside exits this Option-returning
// //             // block instead of the outer download_certificate fn.
// //             let db_for_block = db.clone();
// //             let certs_coll_typed_clone = certs_coll_typed.clone();
// //             let users_coll_typed_clone = users_coll_typed.clone();
// //             let templates_coll_clone = templates_coll.clone();
// //             let templates_doc_coll_clone = templates_doc_coll.clone();
// //             let template_fields_coll_clone = template_fields_coll.clone();
// //             let centers_coll_typed_clone = centers_coll_typed.clone();
// //             let cert_doc_clone = cert_doc.clone();
// //             async move {
// //                 let cert = match certs_coll_typed_clone.find_one(doc! { "_id": &cert_oid }, None).await {
// //                     Ok(Some(c)) => c,
// //                     _ => return None,
// //                 };
// //                 let user = match users_coll_typed_clone.find_one(doc! { "_id": &cert.student_id }, None).await.ok().flatten() {
// //                     Some(u) => u,
// //                     None => return None,
// //                 };
// //                 let mut resolved_course_id: Option<mongodb::bson::oid::ObjectId> =
// //                     cert.course_id.or_else(|| user.course_id);

// //                 if resolved_course_id.is_none() {
// //                     let cea_doc_coll: mongodb::Collection<mongodb::bson::Document> =
// //                         db_for_block.collection::<mongodb::bson::Document>("course_exam_attempts");
// //                     let proj = mongodb::options::FindOptions::builder()
// //                         .projection(doc! { "course_id": 1, "attempt_number": 1, "created_at": 1 })
// //                         .sort(doc! { "attempt_number": -1, "created_at": -1 })
// //                         .limit(1)
// //                         .build();
// //                     if let Ok(mut cursor) = cea_doc_coll.find(doc! { "student_id": &cert.student_id }, proj).await {
// //                         if let Some(Ok(row)) = cursor.next().await {
// //                             if let Ok(cid) = row.get_object_id("course_id") {
// //                                 resolved_course_id = Some(cid);
// //                             }
// //                         }
// //                     }
// //                 }
// //                 if resolved_course_id.is_none() {
// //                     let certs_doc_coll2: mongodb::Collection<mongodb::bson::Document> =
// //                         db_for_block.collection::<mongodb::bson::Document>("certificates");
// //                     let proj2 = mongodb::options::FindOptions::builder()
// //                         .projection(doc! { "course_id": 1, "created_at": 1 })
// //                         .sort(doc! { "created_at": -1 })
// //                         .limit(1)
// //                         .build();
// //                     if let Ok(mut cursor) = certs_doc_coll2.find(doc! { "student_id": &cert.student_id, "course_id": { "$exists": true, "$ne": null } }, proj2).await {
// //                         if let Some(Ok(row)) = cursor.next().await {
// //                             if let Ok(cid) = row.get_object_id("course_id") {
// //                                 resolved_course_id = Some(cid);
// //                             }
// //                         }
// //                     }
// //                 }

// //                 use crate::models::template::TemplateType;
// //                 let from_fp = cert_doc_clone.get_str("file_path").ok().map(|s| s.trim().starts_with("marksheets/")).unwrap_or(false);
// //                 let from_no = cert_doc_clone.get_str("certificate_no").ok().map(|s| s.trim().starts_with("SC-")).unwrap_or(false);
// //                 let explicit_type_str = cert_doc_clone.get_str("certificate_type").ok().map(|s| s.trim().to_lowercase());
// //                 let inferred_type: TemplateType = match explicit_type_str {
// //                     Some(ref s) if s == "marksheet" => TemplateType::Marksheet,
// //                     Some(ref s) if s == "certificate" => TemplateType::Certificate,
// //                     _ if from_fp || from_no => TemplateType::Marksheet,
// //                     _ => TemplateType::Certificate,
// //                 };

// //                 let mut tpl: Option<crate::models::template::Template> = match cert.template_id.clone() {
// //                     Some(tid) => templates_coll_clone.find_one(doc! { "_id": tid }, None).await.ok().flatten(),
// //                     None => None,
// //                 };

// //                 if tpl.is_none() {
// //                     let try_type_strings: Vec<&'static str> = match inferred_type {
// //                         TemplateType::Marksheet => vec!["marksheet", "Marksheet", "MARKSHEET"],
// //                         TemplateType::Certificate => vec!["certificate", "Certificate", "CERTIFICATE"],
// //                         TemplateType::IdCard => vec!["id_card", "IdCard", "Id_Card", "IDCard", "IDCARD"],
// //                     };
// //                     let try_type_regex = match inferred_type {
// //                         TemplateType::Marksheet => doc! { "$regex": "^Marksheet$|^marksheet$|^MARKSHEET$", "$options": "" },
// //                         TemplateType::Certificate => doc! { "$regex": "^Certificate$|^certificate$|^CERTIFICATE$", "$options": "" },
// //                         TemplateType::IdCard => doc! { "$regex": "id.?card", "$options": "i" },
// //                     };

// //                     macro_rules! apply_find {
// //                         ($filter:expr) => {
// //                             templates_coll_clone.find_one($filter, None).await.ok().flatten()
// //                         };
// //                     }

// //                     if tpl.is_none() {
// //                         if let Some(ref cid) = resolved_course_id {
// //                             for tstr in try_type_strings.iter() {
// //                                 let f = doc! { "template_type": tstr, "course_id": cid, "default_design": true };
// //                                 if let Some(x) = apply_find!(f) { tpl = Some(x); break; }
// //                             }
// //                             if tpl.is_none() {
// //                                 let f = doc! { "template_type": try_type_regex.clone(), "course_id": cid, "default_design": true };
// //                                 tpl = apply_find!(f);
// //                             }
// //                         }
// //                     }
// //                     if tpl.is_none() {
// //                         if let Some(ref cid) = resolved_course_id {
// //                             for tstr in try_type_strings.iter() {
// //                                 let f = doc! { "template_type": tstr, "course_id": cid };
// //                                 if let Some(x) = apply_find!(f) { tpl = Some(x); break; }
// //                             }
// //                             if tpl.is_none() {
// //                                 let f = doc! { "template_type": try_type_regex.clone(), "course_id": cid };
// //                                 tpl = apply_find!(f);
// //                             }
// //                         }
// //                     }
// //                     if tpl.is_none() {
// //                         for tstr in try_type_strings.iter() {
// //                             let f = doc! { "template_type": tstr, "default_design": true };
// //                             if let Some(x) = apply_find!(f) { tpl = Some(x); break; }
// //                         }
// //                         if tpl.is_none() {
// //                             let f = doc! { "template_type": try_type_regex.clone(), "default_design": true };
// //                             tpl = apply_find!(f);
// //                         }
// //                     }
// //                     if tpl.is_none() {
// //                         for tstr in try_type_strings.iter() {
// //                             let f = doc! { "template_type": tstr };
// //                             if let Some(x) = apply_find!(f) { tpl = Some(x); break; }
// //                         }
// //                         if tpl.is_none() {
// //                             let f = doc! { "template_type": try_type_regex.clone() };
// //                             tpl = apply_find!(f);
// //                         }
// //                     }
// //                     if tpl.is_none() {
// //                         if let Ok(Some(raw_doc)) = templates_doc_coll_clone.find_one(doc! {}, None).await {
// //                             if let Ok(deser) = mongodb::bson::from_bson::<crate::models::template::Template>(
// //                                 mongodb::bson::Bson::Document(raw_doc)
// //                             ) {
// //                                 tpl = Some(deser);
// //                             }
// //                         }
// //                     }
// //                 }

// //                 let template = match tpl {
// //                     Some(t) => t,
// //                     None => return None,
// //                 };

// //                 let mut cursor = template_fields_coll_clone
// //                     .find(doc! { "template_id": &template.id.expect("template.id") }, None)
// //                     .await
// //                     .unwrap();
// //                 let mut fields = Vec::new();
// //                 while let Some(result) = cursor.next().await {
// //                     if let Ok(field) = result {
// //                         fields.push(field);
// //                     }
// //                 }
// //                 fields.sort_by(|a, b| {
// //                     a.y_position
// //                         .partial_cmp(&b.y_position)
// //                         .unwrap_or(std::cmp::Ordering::Equal)
// //                         .then_with(|| {
// //                             a.x_position
// //                                 .partial_cmp(&b.x_position)
// //                                 .unwrap_or(std::cmp::Ordering::Equal)
// //                         })
// //                 });
// //                 let center = centers_coll_typed_clone.find_one(doc! { "_id": cert.center_id }, None).await.ok().flatten();
// //                 Some((cert, user, template, fields, center))
// //             }.await
// //         };

// //     let regenerated_html: Option<String> = match (cert_html_from_doc.clone(), cert_and_user_and_template) {
// //         (Some(s), _) => Some(s),
// //         (None, Some((cert, user, template, fields, center_doc))) => {
// //             use crate::handlers::generate_certificates::{CertContext, page_styles, render_page};
// //             use crate::models::template::{PageOrientation, PageSize, Template, TemplateField, TemplateType};
// //             let preview_oid = cert.id.clone().unwrap_or(cert_oid);
// //             let base_url = std::env::var("BASE_URL").unwrap_or_else(|_| "https://screduc.com".to_string());
// //             let verification_url = cert
// //                 .verification_url
// //                 .clone()
// //                 .unwrap_or_else(|| format!("{}/verify-certificate/{}", base_url.trim_end_matches('/'), preview_oid.to_hex()));
// //             let ctx = CertContext {
// //                 student_id: cert.student_id.clone(),
// //                 student_name: user
// //                     .full_name
// //                     .clone()
// //                     .unwrap_or_else(|| user.username.clone()),
// //                 registration_number: user.username.clone(),
// //                 enrollment_number: user.enrollment_number.clone(),
// //                 roll_number: user.roll_number.clone(),
// //                 national_id: user.national_id.clone(),
// //                 father_name: user.father_name.clone(),
// //                 mother_name: user.mother_name.clone(),
// //                 dob: user.dob.clone(),
// //                 background_url: cert.background_url.clone().or_else(|| template.background_image.clone()),
// //                 session_from: user
// //                     .session_start_date
// //                     .clone()
// //                     .or_else(|| user.registration_date.clone()),
// //                 session_to: user.session_end_date.clone(),
// //                 course: cert.course.clone(),
// //                 study_center: center_doc.as_ref().map(|c| c.name.clone()),
// //                 institute: center_doc.as_ref().map(|c| c.name.clone()),
// //                 course_duration: None,
// //                 obtained_marks: None,
// //                 total_marks: None,
// //                 grade: None,
// //                 result_status: None,
// //                 exam_date: None,
// //                 issue_date: cert.issued_on.date_naive().to_string(),
// //                 serial_number: user.serial_number.clone(),
// //                 verification_url,
// //                 photo: user.photo_url.clone(),
// //                 signature: user.signature_url.clone(),
// //                 gender: user.gender.clone(),
// //                 category: user.category.clone(),
// //                 national_id_type: user.national_id_type.clone(),
// //                 address: user.address.clone(),
// //                 city: user.city.clone(),
// //                 state: user.state.clone(),
// //                 pincode: user.pincode.clone(),
// //                 emergency_contact_name: user.emergency_contact_name.clone(),
// //                 emergency_contact_phone: user.emergency_contact_phone.clone(),
// //                 additional_docs: user.additional_docs.clone(),
// //                 subjects: None,
// //                 center_signature: center_doc
// //                     .as_ref()
// //                     .and_then(|c| c.key_documents.as_ref())
// //                     .and_then(|d| d.owner_signature_url.clone()),
// //                 center_stamp: center_doc
// //                     .as_ref()
// //                     .and_then(|c| c.key_documents.as_ref())
// //                     .and_then(|d| d.center_stamp_url.clone()),
// //                 admin_signature: template
// //                     .admin_signature
// //                     .clone(),
// //                 admin_stamp: template
// //                     .admin_stamp
// //                     .clone(),
// //                 marks_rows: None,
// //                 certificate_row_id: Some(preview_oid),
// //                 session: None,
// //                 exam_mode: None,
// //                 admission_mode: None,
// //                 center_address: None,
// //                 center_code: center_doc.as_ref().map(|c| c.code.clone()),
// //                 result_date: None,
// //                 result_percentage: None,
// //                 overall_status: None,
// //                 certificate_no: cert.certificate_no.clone(),
// //             };
// //             let page_css = page_styles(&template);
// //             let page = render_page(&template, &fields, &ctx, &base_url);
// //             let single_page_html = format!(
// //                 r#"<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>{}</style></head><body>{}</body></html>"#,
// //                 page_css, page
// //             );
// //             Some(single_page_html)
// //         }
// //         (None, None) => None,
// //     };

// //     if let Some(html_src) = regenerated_html.or(cert_html_from_doc) {
// //         let certs_dir = upload_pb.join("certificates");
// //         if let Err(e) = std::fs::create_dir_all(&certs_dir) {
// //             eprintln!(
// //                 "download_certificate: materialize: cannot create certificates dir {:?}: {}",
// //                 certs_dir, e
// //             );
// //         } else {
// //             let file_name = format!("{}.pdf", certificate_no);
// //             let rel_path = format!("certificates/{}", file_name);
// //             let full_path = upload_pb.join(&rel_path);
// //             let full_path_for_gen = full_path.clone();
// //             let html_owned = html_src;
// //             let gen_res = tokio::task::spawn_blocking(move || {
// //                 PdfGenerator::html_to_pdf(&html_owned, full_path_for_gen)
// //                     .map_err(|e| e.to_string())
// //             })
// //             .await;
// //             match gen_res {
// //                 Ok(Ok(())) => {
// //                     let coll = db.collection::<BsonDocument>("certificates");
// //                     let _ = coll
// //                         .update_one(
// //                             doc! { "_id": &cert_oid },
// //                             doc! { "$set": { "file_path": &rel_path } },
// //                             None,
// //                         )
// //                         .await;
// //                     match tokio::fs::read(&full_path).await {
// //                         Ok(data) => {
// //                             let data_len = data.len();
// //                             let header_take = std::cmp::min(16, data_len);
// //                             let header_bytes: Vec<u8> = data.iter().take(header_take).copied().collect();
// //                             let header_text = String::from_utf8_lossy(&header_bytes);
// //                             let first32: Vec<u8> = data.iter().take(std::cmp::min(32, data_len)).copied().collect();
// //                             let last32: Vec<u8> = data
// //                                 .iter()
// //                                 .skip(data_len.saturating_sub(32))
// //                                 .copied()
// //                                 .collect();
// //                             let sha_out = Command::new("sha256sum").arg(&full_path).output().ok();
// //                             let sha256 = sha_out
// //                                 .as_ref()
// //                                 .and_then(|o| String::from_utf8(o.stdout.clone()).ok())
// //                                 .and_then(|s| s.split_whitespace().next().map(|h| h.to_string()))
// //                                 .unwrap_or_else(|| "(sha256sum failed)".to_string());
// //                             eprintln!(
// //                                 "[CERT_DOWNLOAD_MATERIALIZED] cert_no={} path={:?} size={} bytes Content-Type=application/pdf Content-Length={} header_hex={} header_text={:?}",
// //                                 certificate_no,
// //                                 full_path, data_len, data_len,
// //                                 header_bytes.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
// //                                 header_text
// //                             );
// //                             eprintln!(
// //                                 "[CERT_DOWNLOAD_MATERIALIZED] first32_hex={} last32_hex={} sha256={}",
// //                                 first32.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
// //                                 last32.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
// //                                 sha256
// //                             );
// //                             if !header_text.starts_with("%PDF-") {
// //                                 eprintln!(
// //                                     "[CERT_DOWNLOAD_MATERIALIZED] FATAL: materialized file {:?} is NOT a PDF! Header bytes: {:02X?}",
// //                                     full_path, header_bytes
// //                                 );
// //                             }
// //                             // #region debug-point I:certificate-download-response
// //                             debug_report(
// //                                 "pre-fix",
// //                                 "I",
// //                                 "backend/src/handlers/certificate.rs:1082",
// //                                 "[DEBUG] Materialized certificate download response bytes prepared",
// //                                 serde_json::json!({
// //                                     "certificate_id": id,
// //                                     "certificate_no": certificate_no,
// //                                     "path": full_path.display().to_string(),
// //                                     "content_type": "application/pdf",
// //                                     "content_disposition": format!("attachment; filename=\"{}\"", file_name),
// //                                     "content_length_header": data_len,
// //                                     "actual_byte_length": data_len,
// //                                     "sha256": sha256,
// //                                     "first32_hex": first32.iter().map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(""),
// //                                     "last32_hex": last32.iter().map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(""),
// //                                 }),
// //                             )
// //                             .await;
// //                             // #endregion
// //                             let res = axum::response::Response::builder()
// //                                 .status(StatusCode::OK)
// //                                 .header(header::CONTENT_TYPE, "application/pdf")
// //                                 .header(header::CONTENT_LENGTH, data_len.to_string())
// //                                 .header(
// //                                     header::CONTENT_DISPOSITION,
// //                                     &format!("attachment; filename=\"{}\"", file_name),
// //                                 )
// //                                 .body(Body::from(data))
// //                                 .expect("materialized certificate response builder");
// //                             return res;
// //                         }
// //                         Err(e) => {
// //                             eprintln!(
// //                                 "download_certificate: materialize: read failed {:?}: {}",
// //                                 full_path, e
// //                             );
// //                         }
// //                     }
// //                 }
// //                 Ok(Err(e)) => {
// //                     eprintln!(
// //                         "download_certificate: materialize: PDF generator failed for cert_no={}: {}",
// //                         certificate_no, e
// //                     );
// //                 }
// //                 Err(e) => {
// //                     eprintln!(
// //                         "download_certificate: materialize: spawn_blocking join error for cert_no={}: {}",
// //                         certificate_no, e
// //                     );
// //                 }
// //             }
// //         }
// //     }

// //     eprintln!(
// //         "Certificate PDF missing for id={} cert_no={} file_path={:?} pdf_url={:?} pdf_path={:?} (tried UPLOAD_DIR={}, backend_dir={})",
// //         id, certificate_no, file_path_opt, pdf_url_opt, pdf_path_opt, upload_dir, backend_dir.display()
// //     );
// //     // 422: cert exists but PDF absent (often Chromium/headless failed during generation, or UPLOAD_DIR mismatch).
// //     (
// //         StatusCode::UNPROCESSABLE_ENTITY,
// //         Json(serde_json::json!({
// //             "success": false,
// //             "code": "PDF_MISSING",
// //             "message": "Certificate exists but PDF is not on disk. Regenerate from Issue certificates (Re-issue if it already exists). On the server: install Chromium (`chromium` or `google-chrome`) and ensure UPLOAD_DIR is writable."
// //         })),
// //     )
// //         .into_response()
// // }
// pub async fn download_certificate(
//     State(db): State<Database>,
//     Path(id): Path<String>,
// ) -> impl IntoResponse {
//     // =========================================================
//     // PUBLIC CERTIFICATE DOWNLOAD
//     // No authentication
//     // No authorization
//     // No JWT
//     // No Claims
//     // No role validation
//     // =========================================================

//     debug_report(
//         "public-download",
//         "H",
//         "backend/src/handlers/certificate.rs",
//         "[DEBUG] Public certificate download handler entered",
//         serde_json::json!({
//             "certificate_id": id,
//         }),
//     )
//     .await;

//     // ---------------------------------------------------------
//     // Parse certificate ObjectId
//     // ---------------------------------------------------------

//     let cert_oid = match ObjectId::parse_str(&id) {
//         Ok(oid) => oid,
//         Err(_) => {
//             return download_err_json(
//                 StatusCode::BAD_REQUEST,
//                 "INVALID_ID",
//                 "Invalid certificate ID",
//             );
//         }
//     };

//     // ---------------------------------------------------------
//     // Find certificate
//     // ---------------------------------------------------------

//     let coll = db.collection::<BsonDocument>("certificates");

//     let cert_doc = match coll
//         .find_one(doc! { "_id": cert_oid }, None)
//         .await
//     {
//         Ok(Some(doc)) => doc,

//         Ok(None) => {
//             return download_err_json(
//                 StatusCode::NOT_FOUND,
//                 "CERT_NOT_FOUND",
//                 "Certificate not found.",
//             );
//         }

//         Err(e) => {
//             eprintln!(
//                 "[CERT_DOWNLOAD] Database error: {}",
//                 e
//             );

//             return download_err_json(
//                 StatusCode::INTERNAL_SERVER_ERROR,
//                 "CERT_FETCH_ERROR",
//                 "Could not read certificate from database.",
//             );
//         }
//     };

//     // ---------------------------------------------------------
//     // Certificate number
//     // ---------------------------------------------------------

//     let certificate_no = match cert_doc.get_str("certificate_no") {
//         Ok(value) if !value.is_empty() => value.to_string(),

//         _ => {
//             return download_err_json(
//                 StatusCode::INTERNAL_SERVER_ERROR,
//                 "CERT_SCHEMA",
//                 "Certificate record is missing certificate_no.",
//             );
//         }
//     };

//     // ---------------------------------------------------------
//     // Get file_path
//     // ---------------------------------------------------------

//     let file_path_opt = cert_doc
//         .get_str("file_path")
//         .ok()
//         .filter(|value| !value.is_empty())
//         .map(String::from);

//     // ---------------------------------------------------------
//     // Get pdf_url
//     // ---------------------------------------------------------

//     let pdf_url_opt = cert_doc
//         .get_str("pdf_url")
//         .ok()
//         .filter(|value| !value.is_empty())
//         .map(String::from);

//     // ---------------------------------------------------------
//     // Get pdf_path
//     // ---------------------------------------------------------

//     let pdf_path_opt = cert_doc
//         .get_str("pdf_path")
//         .ok()
//         .filter(|value| !value.is_empty())
//         .map(String::from);

//     // ---------------------------------------------------------
//     // Directories
//     // ---------------------------------------------------------

//     let upload_dir = std::env::var("UPLOAD_DIR")
//         .unwrap_or_else(|_| {
//             "/var/www/html/scre/backend/uploads".to_string()
//         });

//     let upload_pb = PathBuf::from(&upload_dir);

//     let backend_dir =
//         PathBuf::from("/var/www/html/scre/backend");

//     let public_dir =
//         PathBuf::from("/var/www/html/scre/public");

//     let public_uploads_dir =
//         public_dir.join("uploads");

//     eprintln!(
//         "[CERT_DOWNLOAD] id={}, certificate_no={}, file_path={:?}, pdf_url={:?}, pdf_path={:?}",
//         id,
//         certificate_no,
//         file_path_opt,
//         pdf_url_opt,
//         pdf_path_opt
//     );

//     // ---------------------------------------------------------
//     // Candidate PDF paths
//     // ---------------------------------------------------------

//     let mut candidates: Vec<PathBuf> = Vec::new();

//     // =========================================================
//     // 1. file_path
//     // =========================================================

//     if let Some(ref file_path) = file_path_opt {
//         let path = PathBuf::from(file_path);

//         candidates.push(path.clone());

//         if path.is_relative() {
//             candidates.push(upload_pb.join(file_path));
//             candidates.push(backend_dir.join(file_path));
//             candidates.push(public_dir.join(file_path));
//             candidates.push(public_uploads_dir.join(file_path));
//         }
//     }

//     // =========================================================
//     // 2. pdf_url
//     // =========================================================

//     if let Some(ref pdf_url) = pdf_url_opt {
//         let normalized = pdf_url
//             .trim_start_matches('/')
//             .trim_start_matches("uploads/")
//             .to_string();

//         candidates.push(upload_pb.join(&normalized));
//         candidates.push(backend_dir.join(&normalized));
//         candidates.push(public_dir.join(&normalized));
//         candidates.push(public_uploads_dir.join(&normalized));
//     }

//     // =========================================================
//     // 3. pdf_path
//     // =========================================================

//     if let Some(ref pdf_path) = pdf_path_opt {
//         let path = PathBuf::from(pdf_path);

//         candidates.push(path.clone());

//         if path.is_relative() {
//             candidates.push(upload_pb.join(pdf_path));
//             candidates.push(backend_dir.join(pdf_path));
//             candidates.push(public_dir.join(pdf_path));
//             candidates.push(public_uploads_dir.join(pdf_path));
//         }
//     }

//     // =========================================================
//     // 4. certificates/{certificate_no}.pdf
//     // =========================================================

//     let certificate_file =
//         format!("certificates/{}.pdf", certificate_no);

//     candidates.push(upload_pb.join(&certificate_file));
//     candidates.push(backend_dir.join(&certificate_file));
//     candidates.push(public_dir.join(&certificate_file));
//     candidates.push(public_uploads_dir.join(&certificate_file));

//     // =========================================================
//     // 5. marksheets/{certificate_no}.pdf
//     // =========================================================

//     let marksheet_file =
//         format!("marksheets/{}.pdf", certificate_no);

//     candidates.push(upload_pb.join(&marksheet_file));
//     candidates.push(backend_dir.join(&marksheet_file));
//     candidates.push(public_dir.join(&marksheet_file));
//     candidates.push(public_uploads_dir.join(&marksheet_file));

//     // =========================================================
//     // 6. {certificate_no}.pdf
//     // =========================================================

//     let direct_file =
//         format!("{}.pdf", certificate_no);

//     candidates.push(upload_pb.join(&direct_file));
//     candidates.push(backend_dir.join(&direct_file));
//     candidates.push(public_dir.join(&direct_file));
//     candidates.push(public_uploads_dir.join(&direct_file));

//     // =========================================================
//     // Search for PDF
//     // =========================================================

//     let mut seen =
//         std::collections::HashSet::<PathBuf>::new();

//     for path in candidates {
//         if !seen.insert(path.clone()) {
//             continue;
//         }

//         if !path.exists() {
//             continue;
//         }

//         if !path.is_file() {
//             continue;
//         }

//         // -----------------------------------------------------
//         // Read PDF
//         // -----------------------------------------------------

//         let data = match tokio::fs::read(&path).await {
//             Ok(data) => data,

//             Err(e) => {
//                 eprintln!(
//                     "[CERT_DOWNLOAD] Failed to read {:?}: {}",
//                     path,
//                     e
//                 );

//                 continue;
//             }
//         };

//         if data.is_empty() {
//             continue;
//         }

//         // -----------------------------------------------------
//         // Verify PDF
//         // -----------------------------------------------------

//         let header_len = std::cmp::min(16, data.len());

//         let header_bytes = &data[..header_len];

//         let header_text =
//             String::from_utf8_lossy(header_bytes);

//         if !header_text.starts_with("%PDF-") {
//             eprintln!(
//                 "[CERT_DOWNLOAD] Invalid PDF file: {:?}, header={:02X?}",
//                 path,
//                 header_bytes
//             );

//             continue;
//         }

//         // -----------------------------------------------------
//         // Filename
//         // -----------------------------------------------------

//         let file_name = path
//             .file_name()
//             .and_then(|name| name.to_str())
//             .unwrap_or("certificate.pdf");

//         let file_size = data.len();

//         eprintln!(
//             "[CERT_DOWNLOAD] Serving PUBLIC certificate: path={:?}, size={} bytes",
//             path,
//             file_size
//         );

//         // -----------------------------------------------------
//         // Debug report
//         // -----------------------------------------------------

//         debug_report(
//             "public-download",
//             "I",
//             "backend/src/handlers/certificate.rs",
//             "[DEBUG] Public certificate download response prepared",
//             serde_json::json!({
//                 "certificate_id": id,
//                 "path": path.display().to_string(),
//                 "content_type": "application/pdf",
//                 "content_disposition": format!(
//                     "attachment; filename=\"{}\"",
//                     file_name
//                 ),
//                 "content_length": file_size,
//             }),
//         )
//         .await;

//         // -----------------------------------------------------
//         // Return PDF
//         // -----------------------------------------------------

//         let response = axum::response::Response::builder()
//             .status(StatusCode::OK)
//             .header(
//                 header::CONTENT_TYPE,
//                 "application/pdf",
//             )
//             .header(
//                 header::CONTENT_LENGTH,
//                 file_size.to_string(),
//             )
//             .header(
//                 header::CONTENT_DISPOSITION,
//                 format!(
//                     "attachment; filename=\"{}\"",
//                     file_name
//                 ),
//             )
//             .body(Body::from(data))
//             .expect("certificate response builder");

//         return response;
//     }

//     // =========================================================
//     // PDF NOT FOUND
//     // =========================================================

//     download_err_json(
//         StatusCode::NOT_FOUND,
//         "PDF_NOT_FOUND",
//         "Certificate PDF file could not be found.",
//     )
// }

// #[derive(Debug, Deserialize)]
// pub struct DownloadBulkCertificatesRequest {
//     pub certificate_ids: Vec<String>,
// }

// fn merge_pdfs_lopdf(pdf_documents: Vec<Vec<u8>>) -> Result<Vec<u8>, String> {
//     // Based on lopdf's merge example: create a new Document and append Page objects.
//     if pdf_documents.is_empty() {
//         return Err("No PDF documents provided".to_string());
//     }

//     // Load all PDFs into lopdf Documents, skipping invalid ones.
//     let mut loaded_docs: Vec<Document> = Vec::new();
//     for bytes in pdf_documents {
//         match Document::load_mem(&bytes) {
//             Ok(doc) => loaded_docs.push(doc),
//             Err(e) => {
//                 eprintln!("Skipping invalid PDF while merging: {}", e);
//             }
//         }
//     }

//     if loaded_docs.is_empty() {
//         return Err("No valid PDFs could be loaded".to_string());
//     }

//     let mut max_id: u32 = 1;
//     let mut documents_pages: BTreeMap<PdfObjectId, Object> = BTreeMap::new();
//     let mut documents_objects: BTreeMap<PdfObjectId, Object> = BTreeMap::new();

//     for mut document in loaded_docs {
//         document.renumber_objects_with(max_id);
//         max_id = document.max_id + 1;

//         // Collect Page objects (and their owning Page content).
//         documents_pages.extend(
//             document
//                 .get_pages()
//                 .into_iter()
//                 .map(|(_, object_id)| {
//                     let obj = document.get_object(object_id).unwrap().to_owned();
//                     (object_id, obj)
//                 })
//                 .collect::<BTreeMap<PdfObjectId, Object>>(),
//         );

//         // Collect all non-page objects.
//         documents_objects.extend(document.objects);
//     }

//     let mut merged = Document::with_version("1.5");

//     // Catalog and root Pages must be present.
//     let mut catalog_object: Option<(PdfObjectId, Object)> = None;
//     let mut pages_object: Option<(PdfObjectId, Object)> = None;

//     // Process objects except "Page" (handled later), and ignore Outlines.
//     for (object_id, object) in documents_objects.iter() {
//         match object.type_name().unwrap_or("") {
//             "Catalog" => {
//                 catalog_object = Some((
//                     if let Some((id, _)) = catalog_object {
//                         id
//                     } else {
//                         *object_id
//                     },
//                     object.clone(),
//                 ));
//             }
//             "Pages" => {
//                 if let Ok(dictionary) = object.as_dict() {
//                     let mut dictionary = dictionary.clone();
//                     if let Some((_, ref old_pages_object)) = pages_object {
//                         if let Ok(old_dictionary) = old_pages_object.as_dict() {
//                             dictionary.extend(old_dictionary);
//                         }
//                     }

//                     pages_object = Some((
//                         if let Some((id, _)) = pages_object {
//                             id
//                         } else {
//                             *object_id
//                         },
//                         Object::Dictionary(dictionary),
//                     ));
//                 }
//             }
//             "Page" => {} // ignored, processed later and separately
//             "Outlines" => {} // ignored
//             "Outline" => {} // ignored
//             _ => {
//                 merged.objects.insert(*object_id, object.clone());
//             }
//         }
//     }

//     let (pages_object_id, pages_root_object) = match pages_object {
//         Some(v) => v,
//         None => return Err("Pages root not found while merging PDFs".to_string()),
//     };
//     let (catalog_object_id, catalog_root_object) = match catalog_object {
//         Some(v) => v,
//         None => return Err("Catalog root not found while merging PDFs".to_string()),
//     };

//     // Attach all Page objects to the new root Pages.
//     for (object_id, object) in documents_pages.iter() {
//         if let Ok(dictionary) = object.as_dict() {
//             let mut dictionary = dictionary.clone();
//             dictionary.set("Parent", pages_object_id);
//             merged.objects.insert(*object_id, Object::Dictionary(dictionary));
//         }
//     }

//     // Update "Pages" dictionary.
//     if let Ok(dictionary) = pages_root_object.as_dict() {
//         let mut dictionary = dictionary.clone();
//         dictionary.set("Count", documents_pages.len() as u32);
//         dictionary.set(
//             "Kids",
//             documents_pages
//                 .iter()
//                 .map(|(object_id, _)| Object::Reference(*object_id))
//                 .collect::<Vec<_>>(),
//         );
//         merged.objects.insert(pages_object_id, Object::Dictionary(dictionary));
//     }

//     // Update "Catalog" dictionary to point to Pages root.
//     if let Ok(dictionary) = catalog_root_object.as_dict() {
//         let mut dictionary = dictionary.clone();
//         dictionary.set("Pages", pages_object_id);
//         dictionary.remove(b"Outlines");
//         merged.objects.insert(catalog_object_id, Object::Dictionary(dictionary));
//     }

//     merged.trailer.set("Root", catalog_object_id);
//     merged.max_id = merged.objects.len() as u32;
//     merged.renumber_objects();
//     merged.compress();

//     let mut out: Vec<u8> = Vec::new();
//     merged
//         .save_to(&mut out)
//         .map_err(|e| format!("Failed to save merged PDF: {}", e))?;
//     Ok(out)
// }

// pub async fn download_bulk_certificates(
//     State(db): State<Database>,
//     claims: Claims,
//     Json(payload): Json<DownloadBulkCertificatesRequest>,
// ) -> impl IntoResponse {
//     if payload.certificate_ids.is_empty() {
//         return (StatusCode::BAD_REQUEST, "No certificate ids provided").into_response();
//     }

//     // Explicit role gate: Student and Center are scoped to their own certificates below via
//     // student_id/center_id. Admin/SuperAdmin are intentionally granted unrestricted access to
//     // any center's/any student's certificates for bulk download. Any other role is rejected here
//     // rather than silently falling through with student_id/center_id both left as None.
//     let is_admin = claims.role == UserRole::Admin || claims.role == UserRole::SuperAdmin;
//     if !is_admin && claims.role != UserRole::Student && claims.role != UserRole::Center {
//         return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
//     }

//     let upload_dir = std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string());

//     let mut requested_ids: Vec<ObjectId> = Vec::new();
//     for id in payload.certificate_ids {
//         match ObjectId::parse_str(&id) {
//             Ok(oid) => requested_ids.push(oid),
//             Err(_) => return (StatusCode::BAD_REQUEST, "Invalid ID in list").into_response(),
//         }
//     }

//     let collection = db.collection::<Certificate>("certificates");
//     let certs: Vec<Certificate> = match collection
//         .find(doc! { "_id": { "$in": requested_ids.clone() } }, None)
//         .await
//     {
//         Ok(mut cursor) => {
//             let mut acc = Vec::new();
//             while let Some(Ok(c)) = cursor.next().await {
//                 acc.push(c);
//             }
//             acc
//         }
//         Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch certificates").into_response(),
//     };

//     // Index fetched certificates by their ObjectId.
//     let mut cert_map: BTreeMap<ObjectId, Certificate> = BTreeMap::new();
//     for c in certs {
//         if let Some(oid) = c.id {
//             cert_map.insert(oid, c);
//         }
//     }

//     // Order the certificates according to the requested id order.
//     let mut ordered_certs: Vec<Certificate> = Vec::new();
//     for oid in requested_ids.iter() {
//         if let Some(c) = cert_map.remove(oid) {
//             ordered_certs.push(c);
//         }
//     }

//     if ordered_certs.is_empty() {
//         return (StatusCode::NOT_FOUND, "No certificates found").into_response();
//     }

//     // Validate permissions and load PDF bytes.
//     // Admin/SuperAdmin: student_id and center_id both stay None, so the per-certificate
//     // ownership checks below are skipped entirely — by design (is_admin gate above already
//     // authorized this request for any center/any student).
//     let student_id = if claims.role == UserRole::Student {
//         match ObjectId::parse_str(&claims.sub) {
//             Ok(oid) => Some(oid),
//             Err(_) => return (StatusCode::BAD_REQUEST, "Invalid student ID").into_response(),
//         }
//     } else {
//         None
//     };
//     let center_id = if claims.role == UserRole::Center {
//         match ObjectId::parse_str(&claims.sub) {
//             Ok(oid) => Some(oid),
//             Err(_) => return (StatusCode::BAD_REQUEST, "Invalid center ID").into_response(),
//         }
//     } else {
//         None
//     };

//     let mut pdf_bytes: Vec<Vec<u8>> = Vec::new();
//     let mut missing: Vec<String> = Vec::new();

//     for cert in ordered_certs {
//         if let Some(sid) = student_id {
//             if cert.student_id != sid {
//                 return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
//             }
//         }
//         if let Some(cid) = center_id {
//             if cert.center_id != cid {
//                 return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
//             }
//         }
//         // Admin/SuperAdmin fall through here unrestricted — no student_id/center_id match required.

//         // Only merge issued/approved certificates; draft/scheduled won't have final PDFs.
//         let status = cert.status.clone().unwrap_or_default();
//         if status != "approved" && status != "issued" {
//             continue;
//         }

//         let mut found_path: Option<PathBuf> = None;
//         if let Some(path_str) = cert.file_path.clone() {
//             let p = PathBuf::from(path_str);
//             if p.exists() {
//                 found_path = Some(p);
//             }
//         }
//         if found_path.is_none() {
//             let expected_rel = format!("certificates/{}.pdf", cert.certificate_no);
//             let expected = PathBuf::from(&upload_dir).join(&expected_rel);
//             if expected.exists() {
//                 found_path = Some(expected);
//             }
//         }

//         if let Some(path) = found_path {
//             match tokio::fs::read(&path).await {
//                 Ok(bytes) => pdf_bytes.push(bytes),
//                 Err(_) => missing.push(cert.certificate_no),
//             }
//         } else {
//             missing.push(cert.certificate_no);
//         }
//     }

//     if pdf_bytes.is_empty() {
//         eprintln!("No valid PDFs found for bulk download. Missing: {:?}", missing);
//         return (StatusCode::NOT_FOUND, "No certificate files found for bulk download").into_response();
//     }

//     let merged_pdf = match merge_pdfs_lopdf(pdf_bytes) {
//         Ok(bytes) => bytes,
//         Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to merge PDFs: {}", e)).into_response(),
//     };

//     let file_name = format!("Certificates_{}.pdf", chrono::Utc::now().format("%Y%m%d_%H%M%S"));
//     let data_len = merged_pdf.len();
//     let header_take = std::cmp::min(16, data_len);
//     let header_bytes: Vec<u8> = merged_pdf.iter().take(header_take).copied().collect();
//     let header_text = String::from_utf8_lossy(&header_bytes);
//     eprintln!(
//         "[CERT_BULK_DOWNLOAD] merged PDF size={} bytes Content-Type=application/pdf Content-Length={} header_hex={} header_text={:?}",
//         data_len, data_len,
//         header_bytes.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
//         header_text
//     );
//     let res = axum::response::Response::builder()
//         .status(StatusCode::OK)
//         .header(header::CONTENT_TYPE, "application/pdf")
//         .header(header::CONTENT_LENGTH, data_len.to_string())
//         .header(
//             header::CONTENT_DISPOSITION,
//             &format!("attachment; filename=\"{}\"", file_name),
//         )
//         .body(Body::from(merged_pdf))
//         .expect("bulk certificate response builder");
//     res
// }








// use axum::{
//     extract::{State, Query, Path},
//     http::{StatusCode, header},
//     body::Body,
//     Json,
//     response::IntoResponse,
// };
// use std::path::PathBuf;
// use std::collections::BTreeMap;
// use std::process::Command;
// use mongodb::{Database, bson::{doc, oid::ObjectId, Document as BsonDocument, Bson}};
// use serde::{Deserialize, Serialize};
// use crate::models::user::{UserRole, Claims};
// use crate::models::certificate::Certificate;
// use crate::models::center::Center;
// use crate::models::center_assets::CenterAssets;
// use crate::models::admin_assets::AdminAssets;
// use crate::services::pdf_generator::PdfGenerator;
// use chrono::Utc;
// use futures_util::stream::StreamExt;
// use lopdf::{Document, Object, ObjectId as PdfObjectId};

// #[derive(Debug, Deserialize)]
// pub struct IssueCertificateRequest {
//     pub student_id: String,
//     pub course: String,
//     pub certificate_no: String,
// }

// #[derive(Debug, Serialize)]
// pub struct CertificateResponse {
//     pub success: bool,
//     pub message: String,
// }

// fn debug_env_value(key: &str) -> Option<String> {
//     let env_path = "/var/www/html/scre/.dbg/admin-certificate-download.env";
//     let content = std::fs::read_to_string(env_path).ok()?;
//     for line in content.lines() {
//         if let Some(value) = line.strip_prefix(&format!("{key}=")) {
//             return Some(value.trim().to_string());
//         }
//     }
//     None
// }

// async fn debug_report(
//     run_id: &str,
//     hypothesis_id: &str,
//     location: &str,
//     msg: &str,
//     data: serde_json::Value,
// ) {
//     let url = debug_env_value("DEBUG_SERVER_URL")
//         .unwrap_or_else(|| "http://127.0.0.1:7780/event".to_string());
//     let session_id = debug_env_value("DEBUG_SESSION_ID")
//         .unwrap_or_else(|| "admin-certificate-download".to_string());
//     let payload = serde_json::json!({
//         "sessionId": session_id,
//         "runId": run_id,
//         "hypothesisId": hypothesis_id,
//         "location": location,
//         "msg": msg,
//         "data": data,
//         "ts": chrono::Utc::now().timestamp_millis(),
//     });
//     let _ = reqwest::Client::new().post(url).json(&payload).send().await;
// }

// pub async fn issue_certificate(
//     State(db): State<Database>,
//     claims: Claims,
//     Json(payload): Json<IssueCertificateRequest>,
// ) -> (StatusCode, Json<CertificateResponse>) {
//     if claims.role != UserRole::Center && claims.role != UserRole::Admin {
//         return (StatusCode::FORBIDDEN, Json(CertificateResponse {
//             success: false,
//             message: "Unauthorized".to_string(),
//         }));
//     }

//     let collection = db.collection::<Certificate>("certificates");
//     let student_oid = match ObjectId::parse_str(&payload.student_id) {
//         Ok(oid) => oid,
//         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid Student ID".to_string() })),
//     };
//     let center_id = match ObjectId::parse_str(&claims.sub) {
//         Ok(oid) => oid,
//         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid center user ID".to_string() })),
//     };

//     let cert = Certificate {
//         id: None,
//         student_id: student_oid,
//         center_id,
//         course: payload.course,
//         course_id: None,
//         certificate_no: payload.certificate_no,
//         center_name: None,
//         center_signature_url: None,
//         center_stamp_url: None,
//         admin_signature_url: None,
//         admin_stamp_url: None,
//         signature_url: None,
//         stamp_url: None,
//         background_url: None,
//         issued_on: Utc::now(),
//         status: Some("draft".to_string()),
//         template_id: None,
//         verification_url: None,
//         pdf_url: None,
//         file_path: None,
//         scheduled_at: None,
//         certificate_type: crate::models::certificate::CertificateType::Certificate,
//         attempt_number: Some(1),
//     };

//     match collection.insert_one(cert, None).await {
//         Ok(_) => (StatusCode::CREATED, Json(CertificateResponse { success: true, message: "Certificate issued".to_string() })),
//         Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(CertificateResponse { success: false, message: "Failed to save certificate".to_string() })),
//     }
// }

// #[derive(Debug, Deserialize)]
// pub struct GetCertificatesQuery {
//     pub student_id: Option<String>,
//     pub template_id: Option<String>,
// }

// pub async fn get_certificates(
//     State(db): State<Database>,
//     claims: Claims,
//     Query(params): Query<GetCertificatesQuery>,
// ) -> (StatusCode, Json<Vec<Certificate>>) {
//     let collection = db.collection::<Certificate>("certificates");
//     let mut filter = doc! {};

//     match claims.role {
//         UserRole::Center => {
//             let center_user_id = match ObjectId::parse_str(&claims.sub) {
//                 Ok(oid) => oid,
//                 Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
//             };
//             let centers_coll = db.collection::<crate::models::center::Center>("centers");
//             if let Ok(Some(center)) = centers_coll.find_one(doc! { "user_id": center_user_id }, None).await {
//                 if let Some(cid) = center.id {
//                     filter.insert("center_id", cid);
//                 } else {
//                     filter.insert("center_id", center_user_id);
//                 }
//             } else {
//                 filter.insert("center_id", center_user_id);
//             }
//         }
//         UserRole::Student => {
//             let student_id = match ObjectId::parse_str(&claims.sub) {
//                 Ok(oid) => oid,
//                 Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
//             };
//             filter.insert("student_id", student_id);
//             filter.insert("status", "approved");
//         }
//         UserRole::Admin | UserRole::SuperAdmin => {}
//         _ => {
//             return (StatusCode::OK, Json(Vec::new()));
//         }
//     }

//     if let Some(sid) = params.student_id {
//         if let Ok(oid) = ObjectId::parse_str(&sid) {
//             filter.insert("student_id", oid);
//         }
//     }

//     if let Some(tid) = params.template_id {
//         if let Ok(oid) = ObjectId::parse_str(&tid) {
//             filter.insert("template_id", oid);
//         }
//     }

//     let mut cursor = match collection.find(filter, None).await {
//         Ok(c) => c,
//         Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
//     };

//     let upload_dir = std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string());
//     let upload_pb = std::path::PathBuf::from(&upload_dir);

//     let mut certs = Vec::new();
//     while let Some(result) = cursor.next().await {
//         if let Ok(mut cert) = result {
//             println!("get_certificates: Processing cert: cert_id = {:?}, cert_no = {:?}, file_path = {:?}", cert.id, cert.certificate_no, cert.file_path);
//             // Proactively check if PDF exists on disk
//             let mut exists = false;
//             if let Some(ref p) = cert.file_path {
//                 let pb = std::path::PathBuf::from(p);
//                 println!("  Checking pb.exists() for {:?}: {}", pb, pb.exists());
//                 println!("  Checking upload_pb.join(p).exists(): {}", upload_pb.join(p).exists());
//                 if pb.exists() || upload_pb.join(p).exists() {
//                     exists = true;
//                 }
//             }
//             if !exists {
//                 let fallback_cert = upload_pb.join(format!("certificates/{}.pdf", cert.certificate_no));
//                 println!("  Checking fallback_cert {:?}: {}", fallback_cert, fallback_cert.exists());
//                 if fallback_cert.exists() {
//                     exists = true;
//                 }
//                 if !exists {
//                     let fallback_marksheet = upload_pb.join(format!("marksheets/{}.pdf", cert.certificate_no));
//                     println!("  Checking fallback_marksheet {:?}: {}", fallback_marksheet, fallback_marksheet.exists());
//                     if fallback_marksheet.exists() {
//                         exists = true;
//                     }
//                 }
//             }
            
//             println!("  Adding to certs: exists = {}", exists);
//             certs.push(cert);
//         }
//     }
//     (StatusCode::OK, Json(certs))
// }

// /// Center applies sign & stamp from their center assets to a draft certificate
// pub async fn apply_sign_stamp(
//     State(db): State<Database>,
//     claims: Claims,
//     Path(id): Path<String>,
// ) -> (StatusCode, Json<CertificateResponse>) {
//     if claims.role != UserRole::Center {
//         return (StatusCode::FORBIDDEN, Json(CertificateResponse { success: false, message: "Unauthorized".to_string() }));
//     }
//     let cert_oid = match ObjectId::parse_str(&id) {
//         Ok(o) => o,
//         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid certificate ID".to_string() })),
//     };
//     let center_id = match ObjectId::parse_str(&claims.sub) {
//         Ok(oid) => oid,
//         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid center user ID".to_string() })),
//     };

//     let certs = db.collection::<Certificate>("certificates");
//     let _cert = match certs.find_one(doc! { "_id": &cert_oid, "center_id": &center_id, "status": "draft" }, None).await {
//         Ok(Some(c)) => c,
//         _ => return (StatusCode::NOT_FOUND, Json(CertificateResponse { success: false, message: "Certificate not found or not in draft".to_string() })),
//     };

//     let assets_coll = db.collection::<CenterAssets>("center_assets");
//     let assets: Option<CenterAssets> = assets_coll.find_one(doc! { "center_id": &center_id }, None).await.ok().flatten();
//     let sig = assets.as_ref().and_then(|a| a.signature_url.clone());
//     let stamp = assets.as_ref().and_then(|a| a.stamp_url.clone());
//     if sig.is_none() && stamp.is_none() {
//         return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Configure signature and stamp in Center Assets first".to_string() }));
//     }

//     let _ = certs.update_one(
//         doc! { "_id": &cert_oid },
//         doc! { "$set": {
//             "center_signature_url": sig.clone(),
//             "center_stamp_url": stamp.clone(),
//             "signature_url": sig,
//             "stamp_url": stamp,
//             "status": "pending_approval",
//         }},
//         None,
//     ).await;

//     (StatusCode::OK, Json(CertificateResponse { success: true, message: "Sign and stamp applied. Awaiting admin approval.".to_string() }))
// }

// /// Admin approves certificate sign & stamp
// pub async fn admin_approve_certificate(
//     State(db): State<Database>,
//     claims: Claims,
//     Path(id): Path<String>,
// ) -> (StatusCode, Json<CertificateResponse>) {
//     if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
//         return (StatusCode::FORBIDDEN, Json(CertificateResponse { success: false, message: "Unauthorized".to_string() }));
//     }
//     let cert_oid = match ObjectId::parse_str(&id) {
//         Ok(o) => o,
//         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid certificate ID".to_string() })),
//     };

//     let certs = db.collection::<Certificate>("certificates");

//     // Load admin-specific assets (optional) to attach background/signature if desired
//     let admin_id = match ObjectId::parse_str(&claims.sub) {
//         Ok(oid) => oid,
//         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid admin ID".to_string() })),
//     };
//     let admin_assets_coll = db.collection::<AdminAssets>("admin_assets");
//     let admin_assets: Option<AdminAssets> = admin_assets_coll
//         .find_one(doc! { "admin_id": &admin_id }, None)
//         .await
//         .ok()
//         .flatten();

//     let mut set_doc = doc! { "status": "approved" };
//     if let Some(a) = admin_assets {
//         if let Some(bg) = a.background_url {
//             set_doc.insert("background_url", bg);
//         }
//         if let Some(sig) = a.signature_url {
//             set_doc.insert("admin_signature_url", sig.clone());
//             set_doc.insert("signature_url", sig);
//         }
//         if let Some(stamp) = a.stamp_url {
//             set_doc.insert("admin_stamp_url", stamp.clone());
//             set_doc.insert("stamp_url", stamp);
//         }
//     }

//     let result = certs
//         .update_one(
//             doc! { "_id": &cert_oid, "status": "pending_approval" },
//             doc! { "$set": set_doc },
//             None,
//         )
//         .await;

//     match result {
//         Ok(r) if r.modified_count > 0 => (StatusCode::OK, Json(CertificateResponse { success: true, message: "Certificate approved".to_string() })),
//         Ok(_) => (StatusCode::NOT_FOUND, Json(CertificateResponse { success: false, message: "Certificate not found or not pending approval".to_string() })),
//         Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(CertificateResponse { success: false, message: "Failed to approve".to_string() })),
//     }
// }

// #[derive(Debug, Deserialize)]
// pub struct BulkIds {
//     pub ids: Vec<String>,
// }

// pub async fn apply_sign_stamp_bulk(
//     State(db): State<Database>,
//     claims: Claims,
//     Json(payload): Json<BulkIds>,
// ) -> (StatusCode, Json<CertificateResponse>) {
//     if claims.role != UserRole::Center {
//         return (StatusCode::FORBIDDEN, Json(CertificateResponse { success: false, message: "Unauthorized".to_string() }));
//     }
//     let center_id = match ObjectId::parse_str(&claims.sub) {
//         Ok(o) => o,
//         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid center".to_string() })),
//     };
//     let ids: Vec<ObjectId> = payload.ids.iter().filter_map(|s| ObjectId::parse_str(s).ok()).collect();
//     if ids.is_empty() {
//         return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "No valid IDs".to_string() }));
//     }
//     let assets_coll = db.collection::<CenterAssets>("center_assets");
//     let assets: Option<CenterAssets> = assets_coll.find_one(doc! { "center_id": &center_id }, None).await.ok().flatten();
//     let sig = assets.as_ref().and_then(|a| a.signature_url.clone());
//     let stamp = assets.as_ref().and_then(|a| a.stamp_url.clone());
//     if sig.is_none() && stamp.is_none() {
//         return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Configure signature and stamp in Center Assets first".to_string() }));
//     }
//     let certs = db.collection::<Certificate>("certificates");
//     let _ = certs
//         .update_many(
//             doc! { "_id": { "$in": &ids }, "center_id": &center_id, "status": "draft" },
//             doc! { "$set": {
//                 "center_signature_url": sig.clone(),
//                 "center_stamp_url": stamp.clone(),
//                 "signature_url": sig,
//                 "stamp_url": stamp,
//                 "status": "pending_approval",
//             }},
//             None,
//         )
//         .await;
//     (StatusCode::OK, Json(CertificateResponse { success: true, message: "Applied sign & stamp to selected certificates".to_string() }))
// }

// pub async fn admin_approve_certificates_bulk(
//     State(db): State<Database>,
//     claims: Claims,
//     Json(payload): Json<BulkIds>,
// ) -> (StatusCode, Json<CertificateResponse>) {
//     if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
//         return (StatusCode::FORBIDDEN, Json(CertificateResponse { success: false, message: "Unauthorized".to_string() }));
//     }
//     let admin_id = match ObjectId::parse_str(&claims.sub) {
//         Ok(o) => o,
//         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid admin".to_string() })),
//     };
//     let ids: Vec<ObjectId> = payload.ids.iter().filter_map(|s| ObjectId::parse_str(s).ok()).collect();
//     if ids.is_empty() {
//         return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "No valid IDs".to_string() }));
//     }
//     let admin_assets_coll = db.collection::<AdminAssets>("admin_assets");
//     let admin_assets: Option<AdminAssets> = admin_assets_coll
//         .find_one(doc! { "admin_id": &admin_id }, None)
//         .await
//         .ok()
//         .flatten();
//     let mut set_doc = doc! { "status": "approved" };
//     if let Some(a) = admin_assets {
//         if let Some(bg) = a.background_url {
//             set_doc.insert("background_url", bg);
//         }
//         if let Some(sig) = a.signature_url {
//             set_doc.insert("admin_signature_url", sig.clone());
//             set_doc.insert("signature_url", sig);
//         }
//         if let Some(stamp) = a.stamp_url {
//             set_doc.insert("admin_stamp_url", stamp.clone());
//             set_doc.insert("stamp_url", stamp);
//         }
//     }
//     let certs = db.collection::<Certificate>("certificates");
//     let _ = certs
//         .update_many(
//             doc! { "_id": { "$in": &ids }, "status": "pending_approval" },
//             doc! { "$set": set_doc },
//             None,
//         )
//         .await;
//     (StatusCode::OK, Json(CertificateResponse { success: true, message: "Approved selected certificates".to_string() }))
// }

// pub async fn public_verify_certificate(
//     State(db): State<Database>,
//     Path(reg_no): Path<String>,
// ) -> impl IntoResponse {
//     let collection = db.collection::<Certificate>("certificates");
//     // Search by certificate_no which is used as registration_number in the URL
//     match collection.find_one(doc! { "certificate_no": &reg_no, "status": "approved" }, None).await {
//         Ok(Some(cert)) => (StatusCode::OK, Json(cert)).into_response(),
//         Ok(None) => (
//             StatusCode::NOT_FOUND,
//             Json(serde_json::json!({"success": false, "message": "Not Found"})),
//         )
//             .into_response(),
//         Err(_) => (
//             StatusCode::NOT_FOUND,
//             Json(serde_json::json!({"success": false, "message": "Not Found"})),
//         )
//             .into_response(),
//     }
// }

// pub async fn public_verify_certificate_by_id(
//     State(db): State<Database>,
//     Path(id): Path<String>,
// ) -> impl IntoResponse {
//     let collection = db.collection::<Certificate>("certificates");
//     let users_coll = db.collection::<crate::models::user::User>("users");
//     let oid = match ObjectId::parse_str(&id) {
//         Ok(o) => o,
//         Err(_) => {
//             return (
//                 StatusCode::NOT_FOUND,
//                 Json(serde_json::json!({"success": false, "message": "Not Found"})),
//             )
//                 .into_response();
//         }
//     };
//     // Search by certificate id
//     match collection.find_one(doc! { "_id": &oid, "status": "approved" }, None).await {
//         Ok(Some(cert)) => {
//             // Also fetch student details
//             let student = users_coll.find_one(doc! { "_id": &cert.student_id }, None).await.ok().flatten();
            
//             let response = serde_json::json!({
//                 "success": true,
//                 "certificate": cert,
//                 "student": student
//             });
//             (StatusCode::OK, Json(response)).into_response()
//         },
//         Ok(None) => (
//             StatusCode::NOT_FOUND,
//             Json(serde_json::json!({"success": false, "message": "Not Found"})),
//         )
//             .into_response(),
//         Err(_) => (
//             StatusCode::NOT_FOUND,
//             Json(serde_json::json!({"success": false, "message": "Not Found"})),
//         )
//             .into_response(),
//     }
// }

// pub async fn delete_certificate(
//     State(db): State<Database>,
//     claims: Claims,
//     Path(id): Path<String>,
// ) -> (StatusCode, Json<CertificateResponse>) {
//     if !require_admin(&claims) {
//         return (StatusCode::FORBIDDEN, Json(CertificateResponse { success: false, message: "Unauthorized".to_string() }));
//     }
//     let oid = match ObjectId::parse_str(&id) {
//         Ok(oid) => oid,
//         Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid ID".to_string() })),
//     };
//     let coll = db.collection::<Certificate>("certificates");
    
//     // Optional: delete PDF file from disk
//     if let Ok(Some(cert)) = coll.find_one(doc! { "_id": &oid }, None).await {
//         if let Some(path) = cert.file_path {
//             let upload_dir = std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string());
//             let full_path = std::path::PathBuf::from(upload_dir).join(path);
//             let _ = tokio::fs::remove_file(full_path).await;
//         }
//     }

//     match coll.delete_one(doc! { "_id": oid }, None).await {
//         Ok(_) => (StatusCode::OK, Json(CertificateResponse { success: true, message: "Certificate deleted successfully".to_string() })),
//         Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(CertificateResponse { success: false, message: "Failed to delete".to_string() })),
//     }
// }

// fn require_admin(claims: &Claims) -> bool {
//     claims.role == UserRole::Admin || claims.role == UserRole::SuperAdmin
// }

// fn download_err_json(status: StatusCode, code: &'static str, message: &str) -> axum::response::Response {
//     (
//         status,
//         Json(serde_json::json!({
//             "success": false,
//             "code": code,
//             "message": message,
//         })),
//     )
//         .into_response()
// }

// pub async fn download_certificate(
//     State(db): State<Database>,
//     claims: Claims,
//     Path(id): Path<String>,
// ) -> impl IntoResponse {
//     // #region debug-point H:certificate-download-entry
//     debug_report(
//         "pre-fix",
//         "H",
//         "backend/src/handlers/certificate.rs:495",
//         "[DEBUG] Shared certificate download handler entered",
//         serde_json::json!({
//             "certificate_id": id,
//             "role": match claims.role {
//                 UserRole::Admin => "admin",
//                 UserRole::SuperAdmin => "superadmin",
//                 UserRole::Student => "student",
//                 UserRole::Center => "center",
//                 _ => "other",
//             },
//         }),
//     )
//     .await;
//     // #endregion
//     // Read raw BSON — `find_one::<Certificate>` can fail deserialization on legacy/extra fields and
//     // older binaries mapped that to 404, which looked like "wrong ID". Raw docs always load if the row exists.
//     let coll = db.collection::<BsonDocument>("certificates");
//     let cert_oid = match ObjectId::parse_str(&id) {
//         Ok(oid) => oid,
//         Err(_) => {
//             return download_err_json(
//                 StatusCode::BAD_REQUEST,
//                 "INVALID_ID",
//                 "Invalid certificate ID",
//             );
//         }
//     };

//     let cert_doc = match coll.find_one(doc! { "_id": &cert_oid }, None).await {
//         Ok(Some(d)) => {
//             d
//         }
//         Ok(None) => {
//             return download_err_json(
//                 StatusCode::NOT_FOUND,
//                 "CERT_NOT_FOUND",
//                 "Certificate not found (wrong ID, different database, or row deleted).",
//             );
//         }
//         Err(e) => {
//             eprintln!("download_certificate: find_one raw document failed: {}", e);
//             return download_err_json(
//                 StatusCode::INTERNAL_SERVER_ERROR,
//                 "CERT_FETCH_ERROR",
//                 "Could not read certificate from database.",
//             );
//         }
//     };

//     let cert_student_id = match cert_doc.get_object_id("student_id") {
//         Ok(oid) => {
//             oid
//         }
//         Err(e) => {
//             return download_err_json(
//                 StatusCode::INTERNAL_SERVER_ERROR,
//                 "CERT_SCHEMA",
//                 "Certificate record is missing a valid student_id.",
//             );
//         }
//     };
//     let cert_center_id = match cert_doc.get_object_id("center_id") {
//         Ok(oid) => {
//             oid
//         }
//         Err(e) => {
//             return download_err_json(
//                 StatusCode::INTERNAL_SERVER_ERROR,
//                 "CERT_SCHEMA",
//                 "Certificate record is missing a valid center_id.",
//             );
//         }
//     };
//     let certificate_no = match cert_doc.get_str("certificate_no") {
//         Ok(s) => {
//             s.to_string()
//         }
//         Err(e) => {
//             return download_err_json(
//                 StatusCode::INTERNAL_SERVER_ERROR,
//                 "CERT_SCHEMA",
//                 "Certificate record is missing certificate_no.",
//             );
//         }
//     };
//     let file_path_opt = cert_doc.get("file_path").and_then(|b| match b {
//         Bson::String(s) if !s.is_empty() => Some(s.clone()),
//         _ => None,
//     });
//     let pdf_url_opt = cert_doc.get("pdf_url").and_then(|b| match b {
//         Bson::String(s) if !s.is_empty() => Some(s.clone()),
//         _ => None,
//     });
//     let pdf_path_opt = cert_doc.get("pdf_path").and_then(|b| match b {
//         Bson::String(s) if !s.is_empty() => Some(s.clone()),
//         _ => None,
//     });

//     // Check permissions
//     if claims.role == UserRole::Student {
//         let student_id = match ObjectId::parse_str(&claims.sub) {
//             Ok(oid) => oid,
//             Err(_) => {
//                 return download_err_json(
//                     StatusCode::BAD_REQUEST,
//                     "INVALID_SUBJECT",
//                     "Invalid student ID in token",
//                 );
//             }
//         };
//         if cert_student_id != student_id {
//             return download_err_json(
//                 StatusCode::FORBIDDEN,
//                 "FORBIDDEN",
//                 "You do not have access to this certificate",
//             );
//         }
//     } else if claims.role == UserRole::Center {
//         let center_login_oid = match ObjectId::parse_str(&claims.sub) {
//             Ok(oid) => oid,
//             Err(_) => {
//                 return download_err_json(
//                     StatusCode::BAD_REQUEST,
//                     "INVALID_SUBJECT",
//                     "Invalid center ID in token",
//                 );
//             }
//         };
//         // Issued certs store `centers._id` as `center_id`, but the center account JWT `sub` is the center *login user* id (`centers.user_id`).
//         let centers_coll = db.collection::<Center>("centers");
//         let mut can_access = cert_center_id == center_login_oid;
//         if !can_access {
//             if let Ok(Some(center)) = centers_coll
//                 .find_one(doc! { "user_id": &center_login_oid }, None)
//                 .await
//             {
//                 if let Some(cid) = center.id {
//                     can_access = cid == cert_center_id;
//                 }
//             }
//         }
//         if !can_access {
//             return download_err_json(
//                 StatusCode::FORBIDDEN,
//                 "FORBIDDEN",
//                 "You do not have access to this certificate",
//             );
//         }
//     } else if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
//         return download_err_json(
//             StatusCode::FORBIDDEN,
//             "FORBIDDEN",
//             "You do not have access to this certificate",
//         );
//     } else {
//         // Admin / SuperAdmin — allowed to view any certificate
//     }

//     // Resolve PDF on disk: DB may store absolute path, or relative to UPLOAD_DIR (e.g. `certificates/CERT-....pdf`).
//     let upload_dir = std::env::var("UPLOAD_DIR")
//         .unwrap_or_else(|_| "/var/www/html/scre/backend/uploads".to_string());
//     let upload_pb = PathBuf::from(&upload_dir);
//     let backend_dir = PathBuf::from("/var/www/html/scre/backend"); // Default backend directory
//     let public_dir = PathBuf::from("/var/www/html/scre/public"); // Check public directory too
//     let public_uploads_dir = public_dir.join("uploads");

//     eprintln!("download_certificate: cert_id={}, cert_no={}, file_path={:?}, pdf_url={:?}, pdf_path={:?}",
//         id, certificate_no, file_path_opt, pdf_url_opt, pdf_path_opt);

//     let mut candidates: Vec<PathBuf> = Vec::new();
//     // First try file_path
//     if let Some(ref p) = file_path_opt {
//         let pb = PathBuf::from(p);
//         candidates.push(pb.clone());
//         if pb.is_relative() {
//             candidates.push(upload_pb.join(p));
//             candidates.push(backend_dir.join(p));
//             candidates.push(public_dir.join(p));
//             candidates.push(public_uploads_dir.join(p));
//         }
//     }
//     // Then try pdf_url (remove /uploads/ prefix if present)
//     if let Some(ref p) = pdf_url_opt {
//         let normalized = p.trim_start_matches('/').trim_start_matches("uploads/").to_string();
//         candidates.push(upload_pb.join(&normalized));
//         candidates.push(backend_dir.join(&normalized));
//         candidates.push(public_dir.join(&normalized));
//         candidates.push(public_uploads_dir.join(&normalized));
//     }
//     // Then try pdf_path
//     if let Some(ref p) = pdf_path_opt {
//         let pb = PathBuf::from(p);
//         candidates.push(pb.clone());
//         if pb.is_relative() {
//             candidates.push(upload_pb.join(p));
//             candidates.push(backend_dir.join(p));
//             candidates.push(public_dir.join(p));
//             candidates.push(public_uploads_dir.join(p));
//         }
//     }
//     // Then try certificate_no fallback (both certificates and marksheets folders!)
//     let cert_file = format!("certificates/{}.pdf", certificate_no);
//     candidates.push(upload_pb.join(&cert_file));
//     candidates.push(backend_dir.join(&cert_file));
//     candidates.push(public_dir.join(&cert_file));
//     candidates.push(public_uploads_dir.join(&cert_file));
//     let marksheet_file = format!("marksheets/{}.pdf", certificate_no);
//     candidates.push(upload_pb.join(&marksheet_file));
//     candidates.push(backend_dir.join(&marksheet_file));
//     candidates.push(public_dir.join(&marksheet_file));
//     candidates.push(public_uploads_dir.join(&marksheet_file));
//     // Also check just certificate_no.pdf directly in uploads folders
//     candidates.push(upload_pb.join(format!("{}.pdf", certificate_no)));
//     candidates.push(backend_dir.join(format!("{}.pdf", certificate_no)));
//     candidates.push(public_uploads_dir.join(format!("{}.pdf", certificate_no)));

//     let mut seen = std::collections::HashSet::<std::path::PathBuf>::new();
//     for path in candidates {
//         if !seen.insert(path.clone()) {
//             continue;
//         }
//         if !path.exists() {
//             continue;
//         }
//         match tokio::fs::read(&path).await {
//             Ok(data) => {
//                 let file_name = path
//                     .file_name()
//                     .and_then(|n| n.to_str())
//                     .unwrap_or("certificate.pdf");
//                 let data_len = data.len();
//                 let header_take = std::cmp::min(16, data_len);
//                 let header_bytes: Vec<u8> = data.iter().take(header_take).copied().collect();
//                 let header_text = String::from_utf8_lossy(&header_bytes);
//                 let first32: Vec<u8> = data.iter().take(std::cmp::min(32, data_len)).copied().collect();
//                 let last32: Vec<u8> = data
//                     .iter()
//                     .skip(data_len.saturating_sub(32))
//                     .copied()
//                     .collect();
//                 let sha_out = Command::new("sha256sum").arg(&path).output().ok();
//                 let sha256 = sha_out
//                     .as_ref()
//                     .and_then(|o| String::from_utf8(o.stdout.clone()).ok())
//                     .and_then(|s| s.split_whitespace().next().map(|h| h.to_string()))
//                     .unwrap_or_else(|| "(sha256sum failed)".to_string());
//                 eprintln!(
//                     "[CERT_DOWNLOAD] serving path={:?} size={} bytes Content-Type=application/pdf Content-Length={} header_hex={} header_text={:?}",
//                     path, data_len, data_len,
//                     header_bytes.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
//                     header_text
//                 );
//                 eprintln!(
//                     "[CERT_DOWNLOAD] first32_hex={} last32_hex={} sha256={}",
//                     first32.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
//                     last32.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
//                     sha256
//                 );
//                 if !header_text.starts_with("%PDF-") {
//                     eprintln!(
//                         "[CERT_DOWNLOAD] FATAL: file {:?} is NOT a PDF! Header bytes: {:02X?}",
//                         path, header_bytes
//                     );
//                 }
//                 // #region debug-point I:certificate-download-response
//                 debug_report(
//                     "pre-fix",
//                     "I",
//                     "backend/src/handlers/certificate.rs:720",
//                     "[DEBUG] Shared certificate download response bytes prepared",
//                     serde_json::json!({
//                         "certificate_id": id,
//                         "path": path.display().to_string(),
//                         "content_type": "application/pdf",
//                         "content_disposition": format!("attachment; filename=\"{}\"", file_name),
//                         "content_length_header": data_len,
//                         "actual_byte_length": data_len,
//                         "sha256": sha256,
//                         "first32_hex": first32.iter().map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(""),
//                         "last32_hex": last32.iter().map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(""),
//                     }),
//                 )
//                 .await;
//                 // #endregion
//                 let res = axum::response::Response::builder()
//                     .status(StatusCode::OK)
//                     .header(header::CONTENT_TYPE, "application/pdf")
//                     .header(header::CONTENT_LENGTH, data_len.to_string())
//                     .header(
//                         header::CONTENT_DISPOSITION,
//                         &format!("attachment; filename=\"{}\"", file_name),
//                     )
//                     .body(Body::from(data))
//                     .expect("certificate response builder");
//                 return res;
//             }
//             Err(e) => {
//                 eprintln!("Failed to read certificate file at {:?}: {}", path, e);
//             }
//         }
//     }

//     // ---- Last-ditch: if the PDF artifact isn't on disk but the DB row already carries the fully
//     // pre-rendered `html` blob (rendered at issue time — same data the Student Panel preview uses),
//     // transparently materialize the PDF on-demand using the same PdfGenerator pipeline. No
//     // re-approval, no re-issue, no template re-rendering. Write to
//     // `uploads/certificates/{certificate_no}.pdf`, update the stored `file_path` for future hits,
//     // then serve the freshly written bytes. If anything in this chain fails we still fall through
//     // to the original 422 below so no behaviour regression.
//     let cert_html_from_doc = cert_doc
//         .get("html")
//         .and_then(|b| match b {
//             Bson::String(s) if !s.is_empty() => Some(s.clone()),
//             _ => None,
//         });

//     // If the stored rendered HTML is absent on the cert row, do one last recovery: re-render the
//     // page from the stored typed Certificate + referenced Template + User. This rescues rows that
//     // were skipped entirely during the old generation loop because `ctx.serial_number` (derived
//     // from `user.serial_number`) was `None` on the user record even though the row itself has a
//     // valid `certificate_no`. Uses exactly the same `render_page`/`page_styles`/`CertContext`
//     // pipeline as normal generation (just exported for this call).
//     let certs_coll_typed = db.collection::<Certificate>("certificates");
//     let users_coll_typed = db.collection::<crate::models::user::User>("users");
//     let templates_coll = db.collection::<crate::models::template::Template>("templates");
//     let templates_doc_coll: mongodb::Collection<mongodb::bson::Document> =
//         db.collection::<mongodb::bson::Document>("templates");
//     let template_fields_coll = db.collection::<crate::models::template::TemplateField>("template_fields");
//     let centers_coll_typed = db.collection::<Center>("centers");
//     let cert_and_user_and_template: Option<(Certificate, crate::models::user::User, crate::models::template::Template, Vec<crate::models::template::TemplateField>, Option<Center>)> =
//         if cert_html_from_doc.is_some() {
//             None
//         } else {
//             // Clone the DB handle (MongoDB Database is an Arc internally; this is cheap).
//             // We use async move {} so that `return None` inside exits this Option-returning
//             // block instead of the outer download_certificate fn.
//             let db_for_block = db.clone();
//             let certs_coll_typed_clone = certs_coll_typed.clone();
//             let users_coll_typed_clone = users_coll_typed.clone();
//             let templates_coll_clone = templates_coll.clone();
//             let templates_doc_coll_clone = templates_doc_coll.clone();
//             let template_fields_coll_clone = template_fields_coll.clone();
//             let centers_coll_typed_clone = centers_coll_typed.clone();
//             let cert_doc_clone = cert_doc.clone();
//             async move {
//                 let cert = match certs_coll_typed_clone.find_one(doc! { "_id": &cert_oid }, None).await {
//                     Ok(Some(c)) => c,
//                     _ => return None,
//                 };
//                 let user = match users_coll_typed_clone.find_one(doc! { "_id": &cert.student_id }, None).await.ok().flatten() {
//                     Some(u) => u,
//                     None => return None,
//                 };
//                 let mut resolved_course_id: Option<mongodb::bson::oid::ObjectId> =
//                     cert.course_id.or_else(|| user.course_id);

//                 if resolved_course_id.is_none() {
//                     let cea_doc_coll: mongodb::Collection<mongodb::bson::Document> =
//                         db_for_block.collection::<mongodb::bson::Document>("course_exam_attempts");
//                     let proj = mongodb::options::FindOptions::builder()
//                         .projection(doc! { "course_id": 1, "attempt_number": 1, "created_at": 1 })
//                         .sort(doc! { "attempt_number": -1, "created_at": -1 })
//                         .limit(1)
//                         .build();
//                     if let Ok(mut cursor) = cea_doc_coll.find(doc! { "student_id": &cert.student_id }, proj).await {
//                         if let Some(Ok(row)) = cursor.next().await {
//                             if let Ok(cid) = row.get_object_id("course_id") {
//                                 resolved_course_id = Some(cid);
//                             }
//                         }
//                     }
//                 }
//                 if resolved_course_id.is_none() {
//                     let certs_doc_coll2: mongodb::Collection<mongodb::bson::Document> =
//                         db_for_block.collection::<mongodb::bson::Document>("certificates");
//                     let proj2 = mongodb::options::FindOptions::builder()
//                         .projection(doc! { "course_id": 1, "created_at": 1 })
//                         .sort(doc! { "created_at": -1 })
//                         .limit(1)
//                         .build();
//                     if let Ok(mut cursor) = certs_doc_coll2.find(doc! { "student_id": &cert.student_id, "course_id": { "$exists": true, "$ne": null } }, proj2).await {
//                         if let Some(Ok(row)) = cursor.next().await {
//                             if let Ok(cid) = row.get_object_id("course_id") {
//                                 resolved_course_id = Some(cid);
//                             }
//                         }
//                     }
//                 }

//                 use crate::models::template::TemplateType;
//                 let from_fp = cert_doc_clone.get_str("file_path").ok().map(|s| s.trim().starts_with("marksheets/")).unwrap_or(false);
//                 let from_no = cert_doc_clone.get_str("certificate_no").ok().map(|s| s.trim().starts_with("SC-")).unwrap_or(false);
//                 let explicit_type_str = cert_doc_clone.get_str("certificate_type").ok().map(|s| s.trim().to_lowercase());
//                 let inferred_type: TemplateType = match explicit_type_str {
//                     Some(ref s) if s == "marksheet" => TemplateType::Marksheet,
//                     Some(ref s) if s == "certificate" => TemplateType::Certificate,
//                     _ if from_fp || from_no => TemplateType::Marksheet,
//                     _ => TemplateType::Certificate,
//                 };

//                 let mut tpl: Option<crate::models::template::Template> = match cert.template_id.clone() {
//                     Some(tid) => templates_coll_clone.find_one(doc! { "_id": tid }, None).await.ok().flatten(),
//                     None => None,
//                 };

//                 if tpl.is_none() {
//                     let try_type_strings: Vec<&'static str> = match inferred_type {
//                         TemplateType::Marksheet => vec!["marksheet", "Marksheet", "MARKSHEET"],
//                         TemplateType::Certificate => vec!["certificate", "Certificate", "CERTIFICATE"],
//                         TemplateType::IdCard => vec!["id_card", "IdCard", "Id_Card", "IDCard", "IDCARD"],
//                     };
//                     let try_type_regex = match inferred_type {
//                         TemplateType::Marksheet => doc! { "$regex": "^Marksheet$|^marksheet$|^MARKSHEET$", "$options": "" },
//                         TemplateType::Certificate => doc! { "$regex": "^Certificate$|^certificate$|^CERTIFICATE$", "$options": "" },
//                         TemplateType::IdCard => doc! { "$regex": "id.?card", "$options": "i" },
//                     };

//                     macro_rules! apply_find {
//                         ($filter:expr) => {
//                             templates_coll_clone.find_one($filter, None).await.ok().flatten()
//                         };
//                     }

//                     if tpl.is_none() {
//                         if let Some(ref cid) = resolved_course_id {
//                             for tstr in try_type_strings.iter() {
//                                 let f = doc! { "template_type": tstr, "course_id": cid, "default_design": true };
//                                 if let Some(x) = apply_find!(f) { tpl = Some(x); break; }
//                             }
//                             if tpl.is_none() {
//                                 let f = doc! { "template_type": try_type_regex.clone(), "course_id": cid, "default_design": true };
//                                 tpl = apply_find!(f);
//                             }
//                         }
//                     }
//                     if tpl.is_none() {
//                         if let Some(ref cid) = resolved_course_id {
//                             for tstr in try_type_strings.iter() {
//                                 let f = doc! { "template_type": tstr, "course_id": cid };
//                                 if let Some(x) = apply_find!(f) { tpl = Some(x); break; }
//                             }
//                             if tpl.is_none() {
//                                 let f = doc! { "template_type": try_type_regex.clone(), "course_id": cid };
//                                 tpl = apply_find!(f);
//                             }
//                         }
//                     }
//                     if tpl.is_none() {
//                         for tstr in try_type_strings.iter() {
//                             let f = doc! { "template_type": tstr, "default_design": true };
//                             if let Some(x) = apply_find!(f) { tpl = Some(x); break; }
//                         }
//                         if tpl.is_none() {
//                             let f = doc! { "template_type": try_type_regex.clone(), "default_design": true };
//                             tpl = apply_find!(f);
//                         }
//                     }
//                     if tpl.is_none() {
//                         for tstr in try_type_strings.iter() {
//                             let f = doc! { "template_type": tstr };
//                             if let Some(x) = apply_find!(f) { tpl = Some(x); break; }
//                         }
//                         if tpl.is_none() {
//                             let f = doc! { "template_type": try_type_regex.clone() };
//                             tpl = apply_find!(f);
//                         }
//                     }
//                     if tpl.is_none() {
//                         if let Ok(Some(raw_doc)) = templates_doc_coll_clone.find_one(doc! {}, None).await {
//                             if let Ok(deser) = mongodb::bson::from_bson::<crate::models::template::Template>(
//                                 mongodb::bson::Bson::Document(raw_doc)
//                             ) {
//                                 tpl = Some(deser);
//                             }
//                         }
//                     }
//                 }

//                 let template = match tpl {
//                     Some(t) => t,
//                     None => return None,
//                 };

//                 let mut cursor = template_fields_coll_clone
//                     .find(doc! { "template_id": &template.id.expect("template.id") }, None)
//                     .await
//                     .unwrap();
//                 let mut fields = Vec::new();
//                 while let Some(result) = cursor.next().await {
//                     if let Ok(field) = result {
//                         fields.push(field);
//                     }
//                 }
//                 fields.sort_by(|a, b| {
//                     a.y_position
//                         .partial_cmp(&b.y_position)
//                         .unwrap_or(std::cmp::Ordering::Equal)
//                         .then_with(|| {
//                             a.x_position
//                                 .partial_cmp(&b.x_position)
//                                 .unwrap_or(std::cmp::Ordering::Equal)
//                         })
//                 });
//                 let center = centers_coll_typed_clone.find_one(doc! { "_id": cert.center_id }, None).await.ok().flatten();
//                 Some((cert, user, template, fields, center))
//             }.await
//         };

//     let regenerated_html: Option<String> = match (cert_html_from_doc.clone(), cert_and_user_and_template) {
//         (Some(s), _) => Some(s),
//         (None, Some((cert, user, template, fields, center_doc))) => {
//             use crate::handlers::generate_certificates::{CertContext, page_styles, render_page};
//             use crate::models::template::{PageOrientation, PageSize, Template, TemplateField, TemplateType};
//             let preview_oid = cert.id.clone().unwrap_or(cert_oid);
//             let base_url = std::env::var("BASE_URL").unwrap_or_else(|_| "https://screduc.com".to_string());
//             let verification_url = cert
//                 .verification_url
//                 .clone()
//                 .unwrap_or_else(|| format!("{}/verify-certificate/{}", base_url.trim_end_matches('/'), preview_oid.to_hex()));
//             let ctx = CertContext {
//                 student_id: cert.student_id.clone(),
//                 student_name: user
//                     .full_name
//                     .clone()
//                     .unwrap_or_else(|| user.username.clone()),
//                 registration_number: user.username.clone(),
//                 enrollment_number: user.enrollment_number.clone(),
//                 roll_number: user.roll_number.clone(),
//                 national_id: user.national_id.clone(),
//                 father_name: user.father_name.clone(),
//                 mother_name: user.mother_name.clone(),
//                 dob: user.dob.clone(),
//                 background_url: cert.background_url.clone().or_else(|| template.background_image.clone()),
//                 session_from: user
//                     .session_start_date
//                     .clone()
//                     .or_else(|| user.registration_date.clone()),
//                 session_to: user.session_end_date.clone(),
//                 course: cert.course.clone(),
//                 study_center: center_doc.as_ref().map(|c| c.name.clone()),
//                 institute: center_doc.as_ref().map(|c| c.name.clone()),
//                 course_duration: None,
//                 obtained_marks: None,
//                 total_marks: None,
//                 grade: None,
//                 result_status: None,
//                 exam_date: None,
//                 issue_date: cert.issued_on.date_naive().to_string(),
//                 serial_number: user.serial_number.clone(),
//                 verification_url,
//                 photo: user.photo_url.clone(),
//                 signature: user.signature_url.clone(),
//                 gender: user.gender.clone(),
//                 category: user.category.clone(),
//                 national_id_type: user.national_id_type.clone(),
//                 address: user.address.clone(),
//                 city: user.city.clone(),
//                 state: user.state.clone(),
//                 pincode: user.pincode.clone(),
//                 emergency_contact_name: user.emergency_contact_name.clone(),
//                 emergency_contact_phone: user.emergency_contact_phone.clone(),
//                 additional_docs: user.additional_docs.clone(),
//                 subjects: None,
//                 center_signature: center_doc
//                     .as_ref()
//                     .and_then(|c| c.key_documents.as_ref())
//                     .and_then(|d| d.owner_signature_url.clone()),
//                 center_stamp: center_doc
//                     .as_ref()
//                     .and_then(|c| c.key_documents.as_ref())
//                     .and_then(|d| d.center_stamp_url.clone()),
//                 admin_signature: template
//                     .admin_signature
//                     .clone(),
//                 admin_stamp: template
//                     .admin_stamp
//                     .clone(),
//                 marks_rows: None,
//                 certificate_row_id: Some(preview_oid),
//                 session: None,
//                 exam_mode: None,
//                 admission_mode: None,
//                 center_address: None,
//                 center_code: center_doc.as_ref().map(|c| c.code.clone()),
//                 result_date: None,
//                 result_percentage: None,
//                 overall_status: None,
//                 certificate_no: cert.certificate_no.clone(),
//             };
//             let page_css = page_styles(&template);
//             let page = render_page(&template, &fields, &ctx, &base_url);
//             let single_page_html = format!(
//                 r#"<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>{}</style></head><body>{}</body></html>"#,
//                 page_css, page
//             );
//             Some(single_page_html)
//         }
//         (None, None) => None,
//     };

//     if let Some(html_src) = regenerated_html.or(cert_html_from_doc) {
//         let certs_dir = upload_pb.join("certificates");
//         if let Err(e) = std::fs::create_dir_all(&certs_dir) {
//             eprintln!(
//                 "download_certificate: materialize: cannot create certificates dir {:?}: {}",
//                 certs_dir, e
//             );
//         } else {
//             let file_name = format!("{}.pdf", certificate_no);
//             let rel_path = format!("certificates/{}", file_name);
//             let full_path = upload_pb.join(&rel_path);
//             let full_path_for_gen = full_path.clone();
//             let html_owned = html_src;
//             let gen_res = tokio::task::spawn_blocking(move || {
//                 PdfGenerator::html_to_pdf(&html_owned, full_path_for_gen)
//                     .map_err(|e| e.to_string())
//             })
//             .await;
//             match gen_res {
//                 Ok(Ok(())) => {
//                     let coll = db.collection::<BsonDocument>("certificates");
//                     let _ = coll
//                         .update_one(
//                             doc! { "_id": &cert_oid },
//                             doc! { "$set": { "file_path": &rel_path } },
//                             None,
//                         )
//                         .await;
//                     match tokio::fs::read(&full_path).await {
//                         Ok(data) => {
//                             let data_len = data.len();
//                             let header_take = std::cmp::min(16, data_len);
//                             let header_bytes: Vec<u8> = data.iter().take(header_take).copied().collect();
//                             let header_text = String::from_utf8_lossy(&header_bytes);
//                             let first32: Vec<u8> = data.iter().take(std::cmp::min(32, data_len)).copied().collect();
//                             let last32: Vec<u8> = data
//                                 .iter()
//                                 .skip(data_len.saturating_sub(32))
//                                 .copied()
//                                 .collect();
//                             let sha_out = Command::new("sha256sum").arg(&full_path).output().ok();
//                             let sha256 = sha_out
//                                 .as_ref()
//                                 .and_then(|o| String::from_utf8(o.stdout.clone()).ok())
//                                 .and_then(|s| s.split_whitespace().next().map(|h| h.to_string()))
//                                 .unwrap_or_else(|| "(sha256sum failed)".to_string());
//                             eprintln!(
//                                 "[CERT_DOWNLOAD_MATERIALIZED] cert_no={} path={:?} size={} bytes Content-Type=application/pdf Content-Length={} header_hex={} header_text={:?}",
//                                 certificate_no,
//                                 full_path, data_len, data_len,
//                                 header_bytes.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
//                                 header_text
//                             );
//                             eprintln!(
//                                 "[CERT_DOWNLOAD_MATERIALIZED] first32_hex={} last32_hex={} sha256={}",
//                                 first32.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
//                                 last32.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
//                                 sha256
//                             );
//                             if !header_text.starts_with("%PDF-") {
//                                 eprintln!(
//                                     "[CERT_DOWNLOAD_MATERIALIZED] FATAL: materialized file {:?} is NOT a PDF! Header bytes: {:02X?}",
//                                     full_path, header_bytes
//                                 );
//                             }
//                             // #region debug-point I:certificate-download-response
//                             debug_report(
//                                 "pre-fix",
//                                 "I",
//                                 "backend/src/handlers/certificate.rs:1082",
//                                 "[DEBUG] Materialized certificate download response bytes prepared",
//                                 serde_json::json!({
//                                     "certificate_id": id,
//                                     "certificate_no": certificate_no,
//                                     "path": full_path.display().to_string(),
//                                     "content_type": "application/pdf",
//                                     "content_disposition": format!("attachment; filename=\"{}\"", file_name),
//                                     "content_length_header": data_len,
//                                     "actual_byte_length": data_len,
//                                     "sha256": sha256,
//                                     "first32_hex": first32.iter().map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(""),
//                                     "last32_hex": last32.iter().map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(""),
//                                 }),
//                             )
//                             .await;
//                             // #endregion
//                             let res = axum::response::Response::builder()
//                                 .status(StatusCode::OK)
//                                 .header(header::CONTENT_TYPE, "application/pdf")
//                                 .header(header::CONTENT_LENGTH, data_len.to_string())
//                                 .header(
//                                     header::CONTENT_DISPOSITION,
//                                     &format!("attachment; filename=\"{}\"", file_name),
//                                 )
//                                 .body(Body::from(data))
//                                 .expect("materialized certificate response builder");
//                             return res;
//                         }
//                         Err(e) => {
//                             eprintln!(
//                                 "download_certificate: materialize: read failed {:?}: {}",
//                                 full_path, e
//                             );
//                         }
//                     }
//                 }
//                 Ok(Err(e)) => {
//                     eprintln!(
//                         "download_certificate: materialize: PDF generator failed for cert_no={}: {}",
//                         certificate_no, e
//                     );
//                 }
//                 Err(e) => {
//                     eprintln!(
//                         "download_certificate: materialize: spawn_blocking join error for cert_no={}: {}",
//                         certificate_no, e
//                     );
//                 }
//             }
//         }
//     }

//     eprintln!(
//         "Certificate PDF missing for id={} cert_no={} file_path={:?} pdf_url={:?} pdf_path={:?} (tried UPLOAD_DIR={}, backend_dir={})",
//         id, certificate_no, file_path_opt, pdf_url_opt, pdf_path_opt, upload_dir, backend_dir.display()
//     );
//     // 422: cert exists but PDF absent (often Chromium/headless failed during generation, or UPLOAD_DIR mismatch).
//     (
//         StatusCode::UNPROCESSABLE_ENTITY,
//         Json(serde_json::json!({
//             "success": false,
//             "code": "PDF_MISSING",
//             "message": "Certificate exists but PDF is not on disk. Regenerate from Issue certificates (Re-issue if it already exists). On the server: install Chromium (`chromium` or `google-chrome`) and ensure UPLOAD_DIR is writable."
//         })),
//     )
//         .into_response()
// }

// #[derive(Debug, Deserialize)]
// pub struct DownloadBulkCertificatesRequest {
//     pub certificate_ids: Vec<String>,
// }

// fn merge_pdfs_lopdf(pdf_documents: Vec<Vec<u8>>) -> Result<Vec<u8>, String> {
//     // Based on lopdf's merge example: create a new Document and append Page objects.
//     if pdf_documents.is_empty() {
//         return Err("No PDF documents provided".to_string());
//     }

//     // Load all PDFs into lopdf Documents, skipping invalid ones.
//     let mut loaded_docs: Vec<Document> = Vec::new();
//     for bytes in pdf_documents {
//         match Document::load_mem(&bytes) {
//             Ok(doc) => loaded_docs.push(doc),
//             Err(e) => {
//                 eprintln!("Skipping invalid PDF while merging: {}", e);
//             }
//         }
//     }

//     if loaded_docs.is_empty() {
//         return Err("No valid PDFs could be loaded".to_string());
//     }

//     let mut max_id: u32 = 1;
//     let mut documents_pages: BTreeMap<PdfObjectId, Object> = BTreeMap::new();
//     let mut documents_objects: BTreeMap<PdfObjectId, Object> = BTreeMap::new();

//     for mut document in loaded_docs {
//         document.renumber_objects_with(max_id);
//         max_id = document.max_id + 1;

//         // Collect Page objects (and their owning Page content).
//         documents_pages.extend(
//             document
//                 .get_pages()
//                 .into_iter()
//                 .map(|(_, object_id)| {
//                     let obj = document.get_object(object_id).unwrap().to_owned();
//                     (object_id, obj)
//                 })
//                 .collect::<BTreeMap<PdfObjectId, Object>>(),
//         );

//         // Collect all non-page objects.
//         documents_objects.extend(document.objects);
//     }

//     let mut merged = Document::with_version("1.5");

//     // Catalog and root Pages must be present.
//     let mut catalog_object: Option<(PdfObjectId, Object)> = None;
//     let mut pages_object: Option<(PdfObjectId, Object)> = None;

//     // Process objects except "Page" (handled later), and ignore Outlines.
//     for (object_id, object) in documents_objects.iter() {
//         match object.type_name().unwrap_or("") {
//             "Catalog" => {
//                 catalog_object = Some((
//                     if let Some((id, _)) = catalog_object {
//                         id
//                     } else {
//                         *object_id
//                     },
//                     object.clone(),
//                 ));
//             }
//             "Pages" => {
//                 if let Ok(dictionary) = object.as_dict() {
//                     let mut dictionary = dictionary.clone();
//                     if let Some((_, ref old_pages_object)) = pages_object {
//                         if let Ok(old_dictionary) = old_pages_object.as_dict() {
//                             dictionary.extend(old_dictionary);
//                         }
//                     }

//                     pages_object = Some((
//                         if let Some((id, _)) = pages_object {
//                             id
//                         } else {
//                             *object_id
//                         },
//                         Object::Dictionary(dictionary),
//                     ));
//                 }
//             }
//             "Page" => {} // ignored, processed later and separately
//             "Outlines" => {} // ignored
//             "Outline" => {} // ignored
//             _ => {
//                 merged.objects.insert(*object_id, object.clone());
//             }
//         }
//     }

//     let (pages_object_id, pages_root_object) = match pages_object {
//         Some(v) => v,
//         None => return Err("Pages root not found while merging PDFs".to_string()),
//     };
//     let (catalog_object_id, catalog_root_object) = match catalog_object {
//         Some(v) => v,
//         None => return Err("Catalog root not found while merging PDFs".to_string()),
//     };

//     // Attach all Page objects to the new root Pages.
//     for (object_id, object) in documents_pages.iter() {
//         if let Ok(dictionary) = object.as_dict() {
//             let mut dictionary = dictionary.clone();
//             dictionary.set("Parent", pages_object_id);
//             merged.objects.insert(*object_id, Object::Dictionary(dictionary));
//         }
//     }

//     // Update "Pages" dictionary.
//     if let Ok(dictionary) = pages_root_object.as_dict() {
//         let mut dictionary = dictionary.clone();
//         dictionary.set("Count", documents_pages.len() as u32);
//         dictionary.set(
//             "Kids",
//             documents_pages
//                 .iter()
//                 .map(|(object_id, _)| Object::Reference(*object_id))
//                 .collect::<Vec<_>>(),
//         );
//         merged.objects.insert(pages_object_id, Object::Dictionary(dictionary));
//     }

//     // Update "Catalog" dictionary to point to Pages root.
//     if let Ok(dictionary) = catalog_root_object.as_dict() {
//         let mut dictionary = dictionary.clone();
//         dictionary.set("Pages", pages_object_id);
//         dictionary.remove(b"Outlines");
//         merged.objects.insert(catalog_object_id, Object::Dictionary(dictionary));
//     }

//     merged.trailer.set("Root", catalog_object_id);
//     merged.max_id = merged.objects.len() as u32;
//     merged.renumber_objects();
//     merged.compress();

//     let mut out: Vec<u8> = Vec::new();
//     merged
//         .save_to(&mut out)
//         .map_err(|e| format!("Failed to save merged PDF: {}", e))?;
//     Ok(out)
// }

// pub async fn download_bulk_certificates(
//     State(db): State<Database>,
//     claims: Claims,
//     Json(payload): Json<DownloadBulkCertificatesRequest>,
// ) -> impl IntoResponse {
//     if payload.certificate_ids.is_empty() {
//         return (StatusCode::BAD_REQUEST, "No certificate ids provided").into_response();
//     }

//     let upload_dir = std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string());

//     let mut requested_ids: Vec<ObjectId> = Vec::new();
//     for id in payload.certificate_ids {
//         match ObjectId::parse_str(&id) {
//             Ok(oid) => requested_ids.push(oid),
//             Err(_) => return (StatusCode::BAD_REQUEST, "Invalid ID in list").into_response(),
//         }
//     }

//     let collection = db.collection::<Certificate>("certificates");
//     let certs: Vec<Certificate> = match collection
//         .find(doc! { "_id": { "$in": requested_ids.clone() } }, None)
//         .await
//     {
//         Ok(mut cursor) => {
//             let mut acc = Vec::new();
//             while let Some(Ok(c)) = cursor.next().await {
//                 acc.push(c);
//             }
//             acc
//         }
//         Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch certificates").into_response(),
//     };

//     // Index fetched certificates by their ObjectId.
//     let mut cert_map: BTreeMap<ObjectId, Certificate> = BTreeMap::new();
//     for c in certs {
//         if let Some(oid) = c.id {
//             cert_map.insert(oid, c);
//         }
//     }

//     // Order the certificates according to the requested id order.
//     let mut ordered_certs: Vec<Certificate> = Vec::new();
//     for oid in requested_ids.iter() {
//         if let Some(c) = cert_map.remove(oid) {
//             ordered_certs.push(c);
//         }
//     }

//     if ordered_certs.is_empty() {
//         return (StatusCode::NOT_FOUND, "No certificates found").into_response();
//     }

//     // Validate permissions and load PDF bytes.
//     let student_id = if claims.role == UserRole::Student {
//         match ObjectId::parse_str(&claims.sub) {
//             Ok(oid) => Some(oid),
//             Err(_) => return (StatusCode::BAD_REQUEST, "Invalid student ID").into_response(),
//         }
//     } else {
//         None
//     };
//     let center_id = if claims.role == UserRole::Center {
//         match ObjectId::parse_str(&claims.sub) {
//             Ok(oid) => Some(oid),
//             Err(_) => return (StatusCode::BAD_REQUEST, "Invalid center ID").into_response(),
//         }
//     } else {
//         None
//     };

//     let mut pdf_bytes: Vec<Vec<u8>> = Vec::new();
//     let mut missing: Vec<String> = Vec::new();

//     for cert in ordered_certs {
//         if let Some(sid) = student_id {
//             if cert.student_id != sid {
//                 return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
//             }
//         }
//         if let Some(cid) = center_id {
//             if cert.center_id != cid {
//                 return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
//             }
//         }

//         // Only merge issued/approved certificates; draft/scheduled won't have final PDFs.
//         let status = cert.status.clone().unwrap_or_default();
//         if status != "approved" && status != "issued" {
//             continue;
//         }

//         let mut found_path: Option<PathBuf> = None;
//         if let Some(path_str) = cert.file_path.clone() {
//             let p = PathBuf::from(path_str);
//             if p.exists() {
//                 found_path = Some(p);
//             }
//         }
//         if found_path.is_none() {
//             let expected_rel = format!("certificates/{}.pdf", cert.certificate_no);
//             let expected = PathBuf::from(&upload_dir).join(&expected_rel);
//             if expected.exists() {
//                 found_path = Some(expected);
//             }
//         }

//         if let Some(path) = found_path {
//             match tokio::fs::read(&path).await {
//                 Ok(bytes) => pdf_bytes.push(bytes),
//                 Err(_) => missing.push(cert.certificate_no),
//             }
//         } else {
//             missing.push(cert.certificate_no);
//         }
//     }

//     if pdf_bytes.is_empty() {
//         eprintln!("No valid PDFs found for bulk download. Missing: {:?}", missing);
//         return (StatusCode::NOT_FOUND, "No certificate files found for bulk download").into_response();
//     }

//     let merged_pdf = match merge_pdfs_lopdf(pdf_bytes) {
//         Ok(bytes) => bytes,
//         Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to merge PDFs: {}", e)).into_response(),
//     };

//     let file_name = format!("Certificates_{}.pdf", chrono::Utc::now().format("%Y%m%d_%H%M%S"));
//     let data_len = merged_pdf.len();
//     let header_take = std::cmp::min(16, data_len);
//     let header_bytes: Vec<u8> = merged_pdf.iter().take(header_take).copied().collect();
//     let header_text = String::from_utf8_lossy(&header_bytes);
//     eprintln!(
//         "[CERT_BULK_DOWNLOAD] merged PDF size={} bytes Content-Type=application/pdf Content-Length={} header_hex={} header_text={:?}",
//         data_len, data_len,
//         header_bytes.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
//         header_text
//     );
//     let res = axum::response::Response::builder()
//         .status(StatusCode::OK)
//         .header(header::CONTENT_TYPE, "application/pdf")
//         .header(header::CONTENT_LENGTH, data_len.to_string())
//         .header(
//             header::CONTENT_DISPOSITION,
//             &format!("attachment; filename=\"{}\"", file_name),
//         )
//         .body(Body::from(merged_pdf))
//         .expect("bulk certificate response builder");
//     res
// }
use axum::{
    extract::{State, Query, Path},
    http::{StatusCode, header},
    body::Body,
    Json,
    response::IntoResponse,
};
use std::path::PathBuf;
use std::collections::BTreeMap;
use std::process::Command;
use mongodb::{Database, bson::{doc, oid::ObjectId, Document as BsonDocument, Bson}};
use serde::{Deserialize, Serialize};
use crate::handlers::generate_certificates::{GenerateRequest, process_generate_certificates};
use crate::models::user::{UserRole, Claims};
use crate::models::certificate::Certificate;
use crate::models::center::Center;
use crate::models::center_assets::CenterAssets;
use crate::models::admin_assets::AdminAssets; 
use crate::services::pdf_generator::PdfGenerator;
use chrono::Utc;
use futures_util::stream::StreamExt;
use lopdf::{Document, Object, ObjectId as PdfObjectId};

#[derive(Debug, Deserialize)]
pub struct IssueCertificateRequest {
    pub student_id: String,
    pub course: String,
    pub certificate_no: String,
}

#[derive(Debug, Serialize)]
pub struct CertificateResponse {
    pub success: bool,
    pub message: String,
}

fn debug_env_value(key: &str) -> Option<String> {
    let env_path = "/var/www/html/scre/.dbg/admin-certificate-download.env";
    let content = std::fs::read_to_string(env_path).ok()?;
    for line in content.lines() {
        if let Some(value) = line.strip_prefix(&format!("{key}=")) {
            return Some(value.trim().to_string());
        }
    }
    None
}

async fn debug_report(
    run_id: &str,
    hypothesis_id: &str,
    location: &str,
    msg: &str,
    data: serde_json::Value,
) {
    let url = debug_env_value("DEBUG_SERVER_URL")
        .unwrap_or_else(|| "http://127.0.0.1:7780/event".to_string());
    let session_id = debug_env_value("DEBUG_SESSION_ID")
        .unwrap_or_else(|| "admin-certificate-download".to_string());
    let payload = serde_json::json!({
        "sessionId": session_id,
        "runId": run_id,
        "hypothesisId": hypothesis_id,
        "location": location,
        "msg": msg,
        "data": data,
        "ts": chrono::Utc::now().timestamp_millis(),
    });
    let _ = reqwest::Client::new().post(url).json(&payload).send().await;
}

pub async fn issue_certificate(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<IssueCertificateRequest>,
) -> (StatusCode, Json<CertificateResponse>) {
    if claims.role != UserRole::Center && claims.role != UserRole::Admin {
        return (StatusCode::FORBIDDEN, Json(CertificateResponse {
            success: false,
            message: "Unauthorized".to_string(),
        }));
    }

    let collection = db.collection::<Certificate>("certificates");
    let student_oid = match ObjectId::parse_str(&payload.student_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid Student ID".to_string() })),
    };
    let center_id = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid center user ID".to_string() })),
    };

    let cert = Certificate {
        id: None,
        student_id: student_oid,
        center_id,
        course: payload.course,
        course_id: None,
        certificate_no: payload.certificate_no,
        center_name: None,
        center_signature_url: None,
        center_stamp_url: None,
        admin_signature_url: None,
        admin_stamp_url: None,
        signature_url: None,
        stamp_url: None,
        background_url: None,
        issued_on: Utc::now(),
        status: Some("draft".to_string()),
        template_id: None,
        verification_url: None,
        pdf_url: None,
        file_path: None,
        scheduled_at: None,
        certificate_type: crate::models::certificate::CertificateType::Certificate,
        attempt_number: Some(1),
    };

    match collection.insert_one(cert, None).await {
        Ok(_) => (StatusCode::CREATED, Json(CertificateResponse { success: true, message: "Certificate issued".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(CertificateResponse { success: false, message: "Failed to save certificate".to_string() })),
    }
}

#[derive(Debug, Deserialize)]
pub struct GetCertificatesQuery {
    pub student_id: Option<String>,
    pub template_id: Option<String>,
}

pub async fn get_certificates(
    State(db): State<Database>,
    claims: Claims,
    Query(params): Query<GetCertificatesQuery>,
) -> (StatusCode, Json<Vec<Certificate>>) {
    let collection = db.collection::<Certificate>("certificates");
    let mut filter = doc! {};

    match claims.role {
        UserRole::Center => {
            let center_user_id = match ObjectId::parse_str(&claims.sub) {
                Ok(oid) => oid,
                Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
            };
            let centers_coll = db.collection::<crate::models::center::Center>("centers");
            if let Ok(Some(center)) = centers_coll.find_one(doc! { "user_id": center_user_id }, None).await {
                if let Some(cid) = center.id {
                    filter.insert("center_id", cid);
                } else {
                    filter.insert("center_id", center_user_id);
                }
            } else {
                filter.insert("center_id", center_user_id);
            }
        }
        UserRole::Student => {
            let student_id = match ObjectId::parse_str(&claims.sub) {
                Ok(oid) => oid,
                Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
            };
            filter.insert("student_id", student_id);
            filter.insert("status", "approved");
        }
        UserRole::Admin | UserRole::SuperAdmin => {}
        _ => {
            return (StatusCode::OK, Json(Vec::new()));
        }
    }

    if let Some(sid) = params.student_id {
        if let Ok(oid) = ObjectId::parse_str(&sid) {
            filter.insert("student_id", oid);
        }
    }

    if let Some(tid) = params.template_id {
        if let Ok(oid) = ObjectId::parse_str(&tid) {
            filter.insert("template_id", oid);
        }
    }

    let mut cursor = match collection.find(filter, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let upload_dir = std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string());
    let upload_pb = std::path::PathBuf::from(&upload_dir);

    let mut certs = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(mut cert) = result {
            cert.background_url = None;
            certs.push(cert);
        }
    }
    (StatusCode::OK, Json(certs))
}

/// Center applies sign & stamp from their center assets to a draft certificate
pub async fn apply_sign_stamp(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<CertificateResponse>) {
    if claims.role != UserRole::Center {
        return (StatusCode::FORBIDDEN, Json(CertificateResponse { success: false, message: "Unauthorized".to_string() }));
    }
    let cert_oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid certificate ID".to_string() })),
    };
    let center_id = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid center user ID".to_string() })),
    };

    let certs = db.collection::<Certificate>("certificates");
    let _cert = match certs.find_one(doc! { "_id": &cert_oid, "center_id": &center_id, "status": "draft" }, None).await {
        Ok(Some(c)) => c,
        _ => return (StatusCode::NOT_FOUND, Json(CertificateResponse { success: false, message: "Certificate not found or not in draft".to_string() })),
    };

    let assets_coll = db.collection::<CenterAssets>("center_assets");
    let assets: Option<CenterAssets> = assets_coll.find_one(doc! { "center_id": &center_id }, None).await.ok().flatten();
    let sig = assets.as_ref().and_then(|a| a.signature_url.clone());
    let stamp = assets.as_ref().and_then(|a| a.stamp_url.clone());
    if sig.is_none() && stamp.is_none() {
        return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Configure signature and stamp in Center Assets first".to_string() }));
    }

    let _ = certs.update_one(
        doc! { "_id": &cert_oid },
        doc! { "$set": {
            "center_signature_url": sig.clone(),
            "center_stamp_url": stamp.clone(),
            "signature_url": sig,
            "stamp_url": stamp,
            "status": "pending_approval",
        }},
        None,
    ).await;

    (StatusCode::OK, Json(CertificateResponse { success: true, message: "Sign and stamp applied. Awaiting admin approval.".to_string() }))
}

/// Admin approves certificate sign & stamp
pub async fn admin_approve_certificate(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<CertificateResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(CertificateResponse { success: false, message: "Unauthorized".to_string() }));
    }
    let cert_oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid certificate ID".to_string() })),
    };

    let certs = db.collection::<Certificate>("certificates");

    // Load admin-specific assets (optional) to attach background/signature if desired
    let admin_id = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid admin ID".to_string() })),
    };
    let admin_assets_coll = db.collection::<AdminAssets>("admin_assets");
    let admin_assets: Option<AdminAssets> = admin_assets_coll
        .find_one(doc! { "admin_id": &admin_id }, None)
        .await
        .ok()
        .flatten();

    let mut set_doc = doc! { "status": "approved" };
    if let Some(a) = admin_assets {
        if let Some(bg) = a.background_url {
            set_doc.insert("background_url", bg);
        }
        if let Some(sig) = a.signature_url {
            set_doc.insert("admin_signature_url", sig.clone());
            set_doc.insert("signature_url", sig);
        }
        if let Some(stamp) = a.stamp_url {
            set_doc.insert("admin_stamp_url", stamp.clone());
            set_doc.insert("stamp_url", stamp);
        }
    }

    let result = certs
        .update_one(
            doc! { "_id": &cert_oid, "status": "pending_approval" },
            doc! { "$set": set_doc },
            None,
        )
        .await;

    match result {
        Ok(r) if r.modified_count > 0 => (StatusCode::OK, Json(CertificateResponse { success: true, message: "Certificate approved".to_string() })),
        Ok(_) => (StatusCode::NOT_FOUND, Json(CertificateResponse { success: false, message: "Certificate not found or not pending approval".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(CertificateResponse { success: false, message: "Failed to approve".to_string() })),
    }
}

#[derive(Debug, Deserialize)]
pub struct BulkIds {
    pub ids: Vec<String>,
}

pub async fn apply_sign_stamp_bulk(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<BulkIds>,
) -> (StatusCode, Json<CertificateResponse>) {
    if claims.role != UserRole::Center {
        return (StatusCode::FORBIDDEN, Json(CertificateResponse { success: false, message: "Unauthorized".to_string() }));
    }
    let center_id = match ObjectId::parse_str(&claims.sub) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid center".to_string() })),
    };
    let ids: Vec<ObjectId> = payload.ids.iter().filter_map(|s| ObjectId::parse_str(s).ok()).collect();
    if ids.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "No valid IDs".to_string() }));
    }
    let assets_coll = db.collection::<CenterAssets>("center_assets");
    let assets: Option<CenterAssets> = assets_coll.find_one(doc! { "center_id": &center_id }, None).await.ok().flatten();
    let sig = assets.as_ref().and_then(|a| a.signature_url.clone());
    let stamp = assets.as_ref().and_then(|a| a.stamp_url.clone());
    if sig.is_none() && stamp.is_none() {
        return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Configure signature and stamp in Center Assets first".to_string() }));
    }
    let certs = db.collection::<Certificate>("certificates");
    let _ = certs
        .update_many(
            doc! { "_id": { "$in": &ids }, "center_id": &center_id, "status": "draft" },
            doc! { "$set": {
                "center_signature_url": sig.clone(),
                "center_stamp_url": stamp.clone(),
                "signature_url": sig,
                "stamp_url": stamp,
                "status": "pending_approval",
            }},
            None,
        )
        .await;
    (StatusCode::OK, Json(CertificateResponse { success: true, message: "Applied sign & stamp to selected certificates".to_string() }))
}

pub async fn admin_approve_certificates_bulk(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<BulkIds>,
) -> (StatusCode, Json<CertificateResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(CertificateResponse { success: false, message: "Unauthorized".to_string() }));
    }
    let admin_id = match ObjectId::parse_str(&claims.sub) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid admin".to_string() })),
    };
    let ids: Vec<ObjectId> = payload.ids.iter().filter_map(|s| ObjectId::parse_str(s).ok()).collect();
    if ids.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "No valid IDs".to_string() }));
    }
    let admin_assets_coll = db.collection::<AdminAssets>("admin_assets");
    let admin_assets: Option<AdminAssets> = admin_assets_coll
        .find_one(doc! { "admin_id": &admin_id }, None)
        .await
        .ok()
        .flatten();
    let mut set_doc = doc! { "status": "approved" };
    if let Some(a) = admin_assets {
        if let Some(bg) = a.background_url {
            set_doc.insert("background_url", bg);
        }
        if let Some(sig) = a.signature_url {
            set_doc.insert("admin_signature_url", sig.clone());
            set_doc.insert("signature_url", sig);
        }
        if let Some(stamp) = a.stamp_url {
            set_doc.insert("admin_stamp_url", stamp.clone());
            set_doc.insert("stamp_url", stamp);
        }
    }
    let certs = db.collection::<Certificate>("certificates");
    let _ = certs
        .update_many(
            doc! { "_id": { "$in": &ids }, "status": "pending_approval" },
            doc! { "$set": set_doc },
            None,
        )
        .await;
    (StatusCode::OK, Json(CertificateResponse { success: true, message: "Approved selected certificates".to_string() }))
}

pub async fn public_verify_certificate(
    State(db): State<Database>,
    Path(reg_no): Path<String>,
) -> impl IntoResponse {
    let collection = db.collection::<Certificate>("certificates");
    let users_coll = db.collection::<crate::models::user::User>("users");
    // Search by certificate_no which is used as registration_number in the URL
    match collection.find_one(doc! { "certificate_no": &reg_no, "status": "approved" }, None).await {
        Ok(Some(cert)) => {
            // Also fetch student details
            let student = users_coll.find_one(doc! { "_id": &cert.student_id }, None).await.ok().flatten();

            let response = serde_json::json!({
                "success": true,
                "certificate": cert,
                "student": student
            });
            (StatusCode::OK, Json(response)).into_response()
        },
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"success": false, "message": "Not Found"})),
        )
            .into_response(),
        Err(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"success": false, "message": "Not Found"})),
        )
            .into_response(),
    }
}

pub async fn public_verify_certificate_by_id(
    State(db): State<Database>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let collection = db.collection::<Certificate>("certificates");
    let users_coll = db.collection::<crate::models::user::User>("users");
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"success": false, "message": "Not Found"})),
            )
                .into_response();
        }
    };
    // Search by certificate id
    match collection.find_one(doc! { "_id": &oid, "status": "approved" }, None).await {
        Ok(Some(cert)) => {
            // Also fetch student details
            let student = users_coll.find_one(doc! { "_id": &cert.student_id }, None).await.ok().flatten();

            let response = serde_json::json!({
                "success": true,
                "certificate": cert,
                "student": student
            });
            (StatusCode::OK, Json(response)).into_response()
        },
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"success": false, "message": "Not Found"})),
        )
            .into_response(),
        Err(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"success": false, "message": "Not Found"})),
        )
            .into_response(),
    }
}

pub async fn delete_certificate(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<CertificateResponse>) {
    if !require_admin(&claims) {
        return (StatusCode::FORBIDDEN, Json(CertificateResponse { success: false, message: "Unauthorized".to_string() }));
    }
    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(CertificateResponse { success: false, message: "Invalid ID".to_string() })),
    };
    let coll = db.collection::<Certificate>("certificates");

    // Optional: delete PDF file from disk
    if let Ok(Some(cert)) = coll.find_one(doc! { "_id": &oid }, None).await {
        if let Some(path) = cert.file_path {
            let upload_dir = std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string());
            let full_path = std::path::PathBuf::from(upload_dir).join(path);
            let _ = tokio::fs::remove_file(full_path).await;
        }
    }

    match coll.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => (StatusCode::OK, Json(CertificateResponse { success: true, message: "Certificate deleted successfully".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(CertificateResponse { success: false, message: "Failed to delete".to_string() })),
    }
}

fn require_admin(claims: &Claims) -> bool {
    claims.role == UserRole::Admin || claims.role == UserRole::SuperAdmin
}

fn download_err_json(status: StatusCode, code: &'static str, message: &str) -> axum::response::Response {
    (
        status,
        Json(serde_json::json!({
            "success": false,
            "code": code,
            "message": message,
        })),
    )
        .into_response()
}

/// Scans `candidates` in order, skipping duplicates, and returns the first path that
/// exists, is a non-empty file, and has a valid `%PDF-` header, along with its bytes.
/// Used by `download_certificate` both before and after an on-demand regeneration attempt.
async fn find_valid_pdf(candidates: &[PathBuf]) -> Option<(PathBuf, Vec<u8>)> {
    let mut seen = std::collections::HashSet::<PathBuf>::new();

    for path in candidates {
        if !seen.insert(path.clone()) {
            continue;
        }

        if !path.exists() || !path.is_file() {
            continue;
        }

        let data = match tokio::fs::read(path).await {
            Ok(data) => data,
            Err(e) => {
                eprintln!("[CERT_DOWNLOAD] Failed to read {:?}: {}", path, e);
                continue;
            }
        };

        if data.is_empty() {
            continue;
        }

        let header_len = std::cmp::min(16, data.len());
        let header_bytes = &data[..header_len];
        let header_text = String::from_utf8_lossy(header_bytes);

        if !header_text.starts_with("%PDF-") {
            eprintln!(
                "[CERT_DOWNLOAD] Invalid PDF file: {:?}, header={:02X?}",
                path, header_bytes
            );
            continue;
        }

        return Some((path.clone(), data));
    }

    None
}

// pub async fn download_certificate(
//     State(db): State<Database>,
//     claims: Claims,
//     Path(id): Path<String>,
// ) -> impl IntoResponse {
//     // #region debug-point H:certificate-download-entry
//     debug_report(
//         "pre-fix",
//         "H",
//         "backend/src/handlers/certificate.rs:495",
//         "[DEBUG] Shared certificate download handler entered",
//         serde_json::json!({
//             "certificate_id": id,
//             "role": match claims.role {
//                 UserRole::Admin => "admin",
//                 UserRole::SuperAdmin => "superadmin",
//                 UserRole::Student => "student",
//                 UserRole::Center => "center",
//                 _ => "other",
//             },
//         }),
//     )
//     .await;
//     // #endregion
//     // Read raw BSON — `find_one::<Certificate>` can fail deserialization on legacy/extra fields and
//     // older binaries mapped that to 404, which looked like "wrong ID". Raw docs always load if the row exists.
//     let coll = db.collection::<BsonDocument>("certificates");
//     let cert_oid = match ObjectId::parse_str(&id) {
//         Ok(oid) => oid,
//         Err(_) => {
//             return download_err_json(
//                 StatusCode::BAD_REQUEST,
//                 "INVALID_ID",
//                 "Invalid certificate ID",
//             );
//         }
//     };

//     let cert_doc = match coll.find_one(doc! { "_id": &cert_oid }, None).await {
//         Ok(Some(d)) => {
//             d
//         }
//         Ok(None) => {
//             return download_err_json(
//                 StatusCode::NOT_FOUND,
//                 "CERT_NOT_FOUND",
//                 "Certificate not found (wrong ID, different database, or row deleted).",
//             );
//         }
//         Err(e) => {
//             eprintln!("download_certificate: find_one raw document failed: {}", e);
//             return download_err_json(
//                 StatusCode::INTERNAL_SERVER_ERROR,
//                 "CERT_FETCH_ERROR",
//                 "Could not read certificate from database.",
//             );
//         }
//     };

//     let cert_student_id = match cert_doc.get_object_id("student_id") {
//         Ok(oid) => {
//             oid
//         }
//         Err(e) => {
//             return download_err_json(
//                 StatusCode::INTERNAL_SERVER_ERROR,
//                 "CERT_SCHEMA",
//                 "Certificate record is missing a valid student_id.",
//             );
//         }
//     };
//     let cert_center_id = match cert_doc.get_object_id("center_id") {
//         Ok(oid) => {
//             oid
//         }
//         Err(e) => {
//             return download_err_json(
//                 StatusCode::INTERNAL_SERVER_ERROR,
//                 "CERT_SCHEMA",
//                 "Certificate record is missing a valid center_id.",
//             );
//         }
//     };
//     let certificate_no = match cert_doc.get_str("certificate_no") {
//         Ok(s) => {
//             s.to_string()
//         }
//         Err(e) => {
//             return download_err_json(
//                 StatusCode::INTERNAL_SERVER_ERROR,
//                 "CERT_SCHEMA",
//                 "Certificate record is missing certificate_no.",
//             );
//         }
//     };
//     let file_path_opt = cert_doc.get("file_path").and_then(|b| match b {
//         Bson::String(s) if !s.is_empty() => Some(s.clone()),
//         _ => None,
//     });
//     let pdf_url_opt = cert_doc.get("pdf_url").and_then(|b| match b {
//         Bson::String(s) if !s.is_empty() => Some(s.clone()),
//         _ => None,
//     });
//     let pdf_path_opt = cert_doc.get("pdf_path").and_then(|b| match b {
//         Bson::String(s) if !s.is_empty() => Some(s.clone()),
//         _ => None,
//     });

//     // Check permissions
//     if claims.role == UserRole::Student {
//         let student_id = match ObjectId::parse_str(&claims.sub) {
//             Ok(oid) => oid,
//             Err(_) => {
//                 return download_err_json(
//                     StatusCode::BAD_REQUEST,
//                     "INVALID_SUBJECT",
//                     "Invalid student ID in token",
//                 );
//             }
//         };
//         if cert_student_id != student_id {
//             return download_err_json(
//                 StatusCode::FORBIDDEN,
//                 "FORBIDDEN",
//                 "You do not have access to this certificate",
//             );
//         }
//     } else if claims.role == UserRole::Center {
//         let center_login_oid = match ObjectId::parse_str(&claims.sub) {
//             Ok(oid) => oid,
//             Err(_) => {
//                 return download_err_json(
//                     StatusCode::BAD_REQUEST,
//                     "INVALID_SUBJECT",
//                     "Invalid center ID in token",
//                 );
//             }
//         };
//         // Issued certs store `centers._id` as `center_id`, but the center account JWT `sub` is the center *login user* id (`centers.user_id`).
//         let centers_coll = db.collection::<Center>("centers");
//         let mut can_access = cert_center_id == center_login_oid;
//         if !can_access {
//             if let Ok(Some(center)) = centers_coll
//                 .find_one(doc! { "user_id": &center_login_oid }, None)
//                 .await
//             {
//                 if let Some(cid) = center.id {
//                     can_access = cid == cert_center_id;
//                 }
//             }
//         }
//         if !can_access {
//             return download_err_json(
//                 StatusCode::FORBIDDEN,
//                 "FORBIDDEN",
//                 "You do not have access to this certificate",
//             );
//         }
//     } else if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
//         return download_err_json(
//             StatusCode::FORBIDDEN,
//             "FORBIDDEN",
//             "You do not have access to this certificate",
//         );
//     } else {
//         // Admin / SuperAdmin — allowed to view/download any center's, any student's certificate.
//     }

//     // Resolve PDF on disk: DB may store absolute path, or relative to UPLOAD_DIR (e.g. `certificates/CERT-....pdf`).
//     let upload_dir = std::env::var("UPLOAD_DIR")
//         .unwrap_or_else(|_| "/var/www/html/scre/backend/uploads".to_string());
//     let upload_pb = PathBuf::from(&upload_dir);
//     let backend_dir = PathBuf::from("/var/www/html/scre/backend"); // Default backend directory
//     let public_dir = PathBuf::from("/var/www/html/scre/public"); // Check public directory too
//     let public_uploads_dir = public_dir.join("uploads");

//     eprintln!("download_certificate: cert_id={}, cert_no={}, file_path={:?}, pdf_url={:?}, pdf_path={:?}",
//         id, certificate_no, file_path_opt, pdf_url_opt, pdf_path_opt);

//     let mut candidates: Vec<PathBuf> = Vec::new();
//     // First try file_path
//     if let Some(ref p) = file_path_opt {
//         let pb = PathBuf::from(p);
//         candidates.push(pb.clone());
//         if pb.is_relative() {
//             candidates.push(upload_pb.join(p));
//             candidates.push(backend_dir.join(p));
//             candidates.push(public_dir.join(p));
//             candidates.push(public_uploads_dir.join(p));
//         }
//     }
//     // Then try pdf_url (remove /uploads/ prefix if present)
//     if let Some(ref p) = pdf_url_opt {
//         let normalized = p.trim_start_matches('/').trim_start_matches("uploads/").to_string();
//         candidates.push(upload_pb.join(&normalized));
//         candidates.push(backend_dir.join(&normalized));
//         candidates.push(public_dir.join(&normalized));
//         candidates.push(public_uploads_dir.join(&normalized));
//     }
//     // Then try pdf_path
//     if let Some(ref p) = pdf_path_opt {
//         let pb = PathBuf::from(p);
//         candidates.push(pb.clone());
//         if pb.is_relative() {
//             candidates.push(upload_pb.join(p));
//             candidates.push(backend_dir.join(p));
//             candidates.push(public_dir.join(p));
//             candidates.push(public_uploads_dir.join(p));
//         }
//     }
//     // Then try certificate_no fallback (both certificates and marksheets folders!)
//     let cert_file = format!("certificates/{}.pdf", certificate_no);
//     candidates.push(upload_pb.join(&cert_file));
//     candidates.push(backend_dir.join(&cert_file));
//     candidates.push(public_dir.join(&cert_file));
//     candidates.push(public_uploads_dir.join(&cert_file));
//     let marksheet_file = format!("marksheets/{}.pdf", certificate_no);
//     candidates.push(upload_pb.join(&marksheet_file));
//     candidates.push(backend_dir.join(&marksheet_file));
//     candidates.push(public_dir.join(&marksheet_file));
//     candidates.push(public_uploads_dir.join(&marksheet_file));
//     // Also check just certificate_no.pdf directly in uploads folders
//     candidates.push(upload_pb.join(format!("{}.pdf", certificate_no)));
//     candidates.push(backend_dir.join(format!("{}.pdf", certificate_no)));
//     candidates.push(public_uploads_dir.join(format!("{}.pdf", certificate_no)));

//     let mut seen = std::collections::HashSet::<std::path::PathBuf>::new();
//     for path in candidates {
//         if !seen.insert(path.clone()) {
//             continue;
//         }
//         if !path.exists() {
//             continue;
//         }
//         match tokio::fs::read(&path).await {
//             Ok(data) => {
//                 let file_name = path
//                     .file_name()
//                     .and_then(|n| n.to_str())
//                     .unwrap_or("certificate.pdf");
//                 let data_len = data.len();
//                 let header_take = std::cmp::min(16, data_len);
//                 let header_bytes: Vec<u8> = data.iter().take(header_take).copied().collect();
//                 let header_text = String::from_utf8_lossy(&header_bytes);
//                 let first32: Vec<u8> = data.iter().take(std::cmp::min(32, data_len)).copied().collect();
//                 let last32: Vec<u8> = data
//                     .iter()
//                     .skip(data_len.saturating_sub(32))
//                     .copied()
//                     .collect();
//                 let sha_out = Command::new("sha256sum").arg(&path).output().ok();
//                 let sha256 = sha_out
//                     .as_ref()
//                     .and_then(|o| String::from_utf8(o.stdout.clone()).ok())
//                     .and_then(|s| s.split_whitespace().next().map(|h| h.to_string()))
//                     .unwrap_or_else(|| "(sha256sum failed)".to_string());
//                 eprintln!(
//                     "[CERT_DOWNLOAD] serving path={:?} size={} bytes Content-Type=application/pdf Content-Length={} header_hex={} header_text={:?}",
//                     path, data_len, data_len,
//                     header_bytes.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
//                     header_text
//                 );
//                 eprintln!(
//                     "[CERT_DOWNLOAD] first32_hex={} last32_hex={} sha256={}",
//                     first32.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
//                     last32.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
//                     sha256
//                 );
//                 if !header_text.starts_with("%PDF-") {
//                     eprintln!(
//                         "[CERT_DOWNLOAD] FATAL: file {:?} is NOT a PDF! Header bytes: {:02X?}",
//                         path, header_bytes
//                     );
//                 }
//                 // #region debug-point I:certificate-download-response
//                 debug_report(
//                     "pre-fix",
//                     "I",
//                     "backend/src/handlers/certificate.rs:720",
//                     "[DEBUG] Shared certificate download response bytes prepared",
//                     serde_json::json!({
//                         "certificate_id": id,
//                         "path": path.display().to_string(),
//                         "content_type": "application/pdf",
//                         "content_disposition": format!("attachment; filename=\"{}\"", file_name),
//                         "content_length_header": data_len,
//                         "actual_byte_length": data_len,
//                         "sha256": sha256,
//                         "first32_hex": first32.iter().map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(""),
//                         "last32_hex": last32.iter().map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(""),
//                     }),
//                 )
//                 .await;
//                 // #endregion
//                 let res = axum::response::Response::builder()
//                     .status(StatusCode::OK)
//                     .header(header::CONTENT_TYPE, "application/pdf")
//                     .header(header::CONTENT_LENGTH, data_len.to_string())
//                     .header(
//                         header::CONTENT_DISPOSITION,
//                         &format!("attachment; filename=\"{}\"", file_name),
//                     )
//                     .body(Body::from(data))
//                     .expect("certificate response builder");
//                 return res;
//             }
//             Err(e) => {
//                 eprintln!("Failed to read certificate file at {:?}: {}", path, e);
//             }
//         }
//     }

//     if let Some(template_oid) = cert_doc.get_object_id("template_id").ok() {
//         let issue_date = cert_doc
//             .get_datetime("issued_on")
//             .ok()
//             .map(|dt| dt.to_chrono().date_naive().to_string())
//             .unwrap_or_else(|| Utc::now().date_naive().to_string());

//         let regen_payload = GenerateRequest {
//             template_id: template_oid.to_hex(),
//             student_ids: vec![cert_student_id.to_hex()],
//             issue_date: Some(issue_date),
//             mode: None,
//             scheduled_at: None,
//             reissue: Some(true),
//             force_new: Some(false),
//             attempt_number: None,
//         };

//         let (regen_status, regen_resp) =
//             process_generate_certificates(&db, UserRole::Admin, regen_payload).await;
//         let regen_message = regen_resp.0.message.clone();
//         eprintln!(
//             "download_certificate: regen via process_generate_certificates status={} success={} cert_no={} message={}",
//             regen_status.as_u16(),
//             regen_resp.0.success,
//             certificate_no,
//             regen_message
//         );

//         let regenerated_path = upload_pb.join(format!("certificates/{}.pdf", certificate_no));
//         if regenerated_path.exists() {
//             match tokio::fs::read(&regenerated_path).await {
//                 Ok(data) => {
//                     let file_name = regenerated_path
//                         .file_name()
//                         .and_then(|n| n.to_str())
//                         .unwrap_or("certificate.pdf");
//                     let data_len = data.len();
//                     let res = axum::response::Response::builder()
//                         .status(StatusCode::OK)
//                         .header(header::CONTENT_TYPE, "application/pdf")
//                         .header(header::CONTENT_LENGTH, data_len.to_string())
//                         .header(
//                             header::CONTENT_DISPOSITION,
//                             &format!("attachment; filename=\"{}\"", file_name),
//                         )
//                         .body(Body::from(data))
//                         .expect("certificate response builder after regen");
//                     return res;
//                 }
//                 Err(e) => {
//                     eprintln!(
//                         "download_certificate: regenerated file exists but could not be read {:?}: {}",
//                         regenerated_path, e
//                     );
//                 }
//             }
//         }
//     }

//     // ---- Last-ditch: if the PDF artifact isn't on disk but the DB row already carries the fully
//     // pre-rendered `html` blob (rendered at issue time — same data the Student Panel preview uses),
//     // transparently materialize the PDF on-demand using the same PdfGenerator pipeline. No
//     // re-approval, no re-issue, no template re-rendering. Write to
//     // `uploads/certificates/{certificate_no}.pdf`, update the stored `file_path` for future hits,
//     // then serve the freshly written bytes. If anything in this chain fails we still fall through
//     // to the original 422 below so no behaviour regression.
//     let cert_html_from_doc = cert_doc
//         .get("html")
//         .and_then(|b| match b {
//             Bson::String(s) if !s.is_empty() => Some(s.clone()),
//             _ => None,
//         });

//     // If the stored rendered HTML is absent on the cert row, do one last recovery: re-render the
//     // page from the stored typed Certificate + referenced Template + User. This rescues rows that
//     // were skipped entirely during the old generation loop because `ctx.serial_number` (derived
//     // from `user.serial_number`) was `None` on the user record even though the row itself has a
//     // valid `certificate_no`. Uses exactly the same `render_page`/`page_styles`/`CertContext`
//     // pipeline as normal generation (just exported for this call).
//     let certs_coll_typed = db.collection::<Certificate>("certificates");
//     let users_coll_typed = db.collection::<crate::models::user::User>("users");
//     let templates_coll = db.collection::<crate::models::template::Template>("templates");
//     let templates_doc_coll: mongodb::Collection<mongodb::bson::Document> =
//         db.collection::<mongodb::bson::Document>("templates");
//     let template_fields_coll = db.collection::<crate::models::template::TemplateField>("template_fields");
//     let centers_coll_typed = db.collection::<Center>("centers");
//     let cert_and_user_and_template: Option<(Certificate, crate::models::user::User, crate::models::template::Template, Vec<crate::models::template::TemplateField>, Option<Center>)> =
//         if cert_html_from_doc.is_some() {
//             None
//         } else {
//             // Clone the DB handle (MongoDB Database is an Arc internally; this is cheap).
//             // We use async move {} so that `return None` inside exits this Option-returning
//             // block instead of the outer download_certificate fn.
//             let db_for_block = db.clone();
//             let certs_coll_typed_clone = certs_coll_typed.clone();
//             let users_coll_typed_clone = users_coll_typed.clone();
//             let templates_coll_clone = templates_coll.clone();
//             let templates_doc_coll_clone = templates_doc_coll.clone();
//             let template_fields_coll_clone = template_fields_coll.clone();
//             let centers_coll_typed_clone = centers_coll_typed.clone();
//             let cert_doc_clone = cert_doc.clone();
//             async move {
//                 let cert = match certs_coll_typed_clone.find_one(doc! { "_id": &cert_oid }, None).await {
//                     Ok(Some(c)) => c,
//                     _ => return None,
//                 };
//                 let user = match users_coll_typed_clone.find_one(doc! { "_id": &cert.student_id }, None).await.ok().flatten() {
//                     Some(u) => u,
//                     None => return None,
//                 };
//                 let mut resolved_course_id: Option<mongodb::bson::oid::ObjectId> =
//                     cert.course_id.or_else(|| user.course_id);

//                 if resolved_course_id.is_none() {
//                     let cea_doc_coll: mongodb::Collection<mongodb::bson::Document> =
//                         db_for_block.collection::<mongodb::bson::Document>("course_exam_attempts");
//                     let proj = mongodb::options::FindOptions::builder()
//                         .projection(doc! { "course_id": 1, "attempt_number": 1, "created_at": 1 })
//                         .sort(doc! { "attempt_number": -1, "created_at": -1 })
//                         .limit(1)
//                         .build();
//                     if let Ok(mut cursor) = cea_doc_coll.find(doc! { "student_id": &cert.student_id }, proj).await {
//                         if let Some(Ok(row)) = cursor.next().await {
//                             if let Ok(cid) = row.get_object_id("course_id") {
//                                 resolved_course_id = Some(cid);
//                             }
//                         }
//                     }
//                 }
//                 if resolved_course_id.is_none() {
//                     let certs_doc_coll2: mongodb::Collection<mongodb::bson::Document> =
//                         db_for_block.collection::<mongodb::bson::Document>("certificates");
//                     let proj2 = mongodb::options::FindOptions::builder()
//                         .projection(doc! { "course_id": 1, "created_at": 1 })
//                         .sort(doc! { "created_at": -1 })
//                         .limit(1)
//                         .build();
//                     if let Ok(mut cursor) = certs_doc_coll2.find(doc! { "student_id": &cert.student_id, "course_id": { "$exists": true, "$ne": null } }, proj2).await {
//                         if let Some(Ok(row)) = cursor.next().await {
//                             if let Ok(cid) = row.get_object_id("course_id") {
//                                 resolved_course_id = Some(cid);
//                             }
//                         }
//                     }
//                 }

//                 use crate::models::template::TemplateType;
//                 let from_fp = cert_doc_clone.get_str("file_path").ok().map(|s| s.trim().starts_with("marksheets/")).unwrap_or(false);
//                 let from_no = cert_doc_clone.get_str("certificate_no").ok().map(|s| s.trim().starts_with("SC-")).unwrap_or(false);
//                 let explicit_type_str = cert_doc_clone.get_str("certificate_type").ok().map(|s| s.trim().to_lowercase());
//                 let inferred_type: TemplateType = match explicit_type_str {
//                     Some(ref s) if s == "marksheet" => TemplateType::Marksheet,
//                     Some(ref s) if s == "certificate" => TemplateType::Certificate,
//                     _ if from_fp || from_no => TemplateType::Marksheet,
//                     _ => TemplateType::Certificate,
//                 };

//                 let mut tpl: Option<crate::models::template::Template> = match cert.template_id.clone() {
//                     Some(tid) => templates_coll_clone.find_one(doc! { "_id": tid }, None).await.ok().flatten(),
//                     None => None,
//                 };

//                 if tpl.is_none() {
//                     let try_type_strings: Vec<&'static str> = match inferred_type {
//                         TemplateType::Marksheet => vec!["marksheet", "Marksheet", "MARKSHEET"],
//                         TemplateType::Certificate => vec!["certificate", "Certificate", "CERTIFICATE"],
//                         TemplateType::IdCard => vec!["id_card", "IdCard", "Id_Card", "IDCard", "IDCARD"],
//                     };
//                     let try_type_regex = match inferred_type {
//                         TemplateType::Marksheet => doc! { "$regex": "^Marksheet$|^marksheet$|^MARKSHEET$", "$options": "" },
//                         TemplateType::Certificate => doc! { "$regex": "^Certificate$|^certificate$|^CERTIFICATE$", "$options": "" },
//                         TemplateType::IdCard => doc! { "$regex": "id.?card", "$options": "i" },
//                     };

//                     macro_rules! apply_find {
//                         ($filter:expr) => {
//                             templates_coll_clone.find_one($filter, None).await.ok().flatten()
//                         };
//                     }

//                     if tpl.is_none() {
//                         if let Some(ref cid) = resolved_course_id {
//                             for tstr in try_type_strings.iter() {
//                                 let f = doc! { "template_type": tstr, "course_id": cid, "default_design": true };
//                                 if let Some(x) = apply_find!(f) { tpl = Some(x); break; }
//                             }
//                             if tpl.is_none() {
//                                 let f = doc! { "template_type": try_type_regex.clone(), "course_id": cid, "default_design": true };
//                                 tpl = apply_find!(f);
//                             }
//                         }
//                     }
//                     if tpl.is_none() {
//                         if let Some(ref cid) = resolved_course_id {
//                             for tstr in try_type_strings.iter() {
//                                 let f = doc! { "template_type": tstr, "course_id": cid };
//                                 if let Some(x) = apply_find!(f) { tpl = Some(x); break; }
//                             }
//                             if tpl.is_none() {
//                                 let f = doc! { "template_type": try_type_regex.clone(), "course_id": cid };
//                                 tpl = apply_find!(f);
//                             }
//                         }
//                     }
//                     if tpl.is_none() {
//                         for tstr in try_type_strings.iter() {
//                             let f = doc! { "template_type": tstr, "default_design": true };
//                             if let Some(x) = apply_find!(f) { tpl = Some(x); break; }
//                         }
//                         if tpl.is_none() {
//                             let f = doc! { "template_type": try_type_regex.clone(), "default_design": true };
//                             tpl = apply_find!(f);
//                         }
//                     }
//                     if tpl.is_none() {
//                         for tstr in try_type_strings.iter() {
//                             let f = doc! { "template_type": tstr };
//                             if let Some(x) = apply_find!(f) { tpl = Some(x); break; }
//                         }
//                         if tpl.is_none() {
//                             let f = doc! { "template_type": try_type_regex.clone() };
//                             tpl = apply_find!(f);
//                         }
//                     }
//                     if tpl.is_none() {
//                         if let Ok(Some(raw_doc)) = templates_doc_coll_clone.find_one(doc! {}, None).await {
//                             if let Ok(deser) = mongodb::bson::from_bson::<crate::models::template::Template>(
//                                 mongodb::bson::Bson::Document(raw_doc)
//                             ) {
//                                 tpl = Some(deser);
//                             }
//                         }
//                     }
//                 }

//                 let template = match tpl {
//                     Some(t) => t,
//                     None => return None,
//                 };

//                 let mut cursor = template_fields_coll_clone
//                     .find(doc! { "template_id": &template.id.expect("template.id") }, None)
//                     .await
//                     .unwrap();
//                 let mut fields = Vec::new();
//                 while let Some(result) = cursor.next().await {
//                     if let Ok(field) = result {
//                         fields.push(field);
//                     }
//                 }
//                 fields.sort_by(|a, b| {
//                     a.y_position
//                         .partial_cmp(&b.y_position)
//                         .unwrap_or(std::cmp::Ordering::Equal)
//                         .then_with(|| {
//                             a.x_position
//                                 .partial_cmp(&b.x_position)
//                                 .unwrap_or(std::cmp::Ordering::Equal)
//                         })
//                 });
//                 let center = centers_coll_typed_clone.find_one(doc! { "_id": cert.center_id }, None).await.ok().flatten();
//                 Some((cert, user, template, fields, center))
//             }.await
//         };

//     let regenerated_html: Option<String> = match (cert_html_from_doc.clone(), cert_and_user_and_template) {
//         (Some(s), _) => Some(s),
//         (None, Some((cert, user, template, fields, center_doc))) => {
//             use crate::handlers::generate_certificates::{CertContext, page_styles, render_page};
//             use crate::models::template::{PageOrientation, PageSize, Template, TemplateField, TemplateType};
//             let preview_oid = cert.id.clone().unwrap_or(cert_oid);
//             let base_url = std::env::var("BASE_URL").unwrap_or_else(|_| "https://screduc.com".to_string());
//             let verification_url = cert
//                 .verification_url
//                 .clone()
//                 .unwrap_or_else(|| format!("{}/verify-certificate/{}", base_url.trim_end_matches('/'), preview_oid.to_hex()));
//             let ctx = CertContext {
//                 student_id: cert.student_id.clone(),
//                 student_name: user
//                     .full_name
//                     .clone()
//                     .unwrap_or_else(|| user.username.clone()),
//                 registration_number: user.username.clone(),
//                 enrollment_number: user.enrollment_number.clone(),
//                 roll_number: user.roll_number.clone(),
//                 national_id: user.national_id.clone(),
//                 father_name: user.father_name.clone(),
//                 mother_name: user.mother_name.clone(),
//                 dob: user.dob.clone(),
//                 background_url: cert.background_url.clone().or_else(|| template.background_image.clone()),
//                 session_from: user
//                     .session_start_date
//                     .clone()
//                     .or_else(|| user.registration_date.clone()),
//                 session_to: user.session_end_date.clone(),
//                 course: cert.course.clone(),
//                 study_center: center_doc.as_ref().map(|c| c.name.clone()),
//                 institute: center_doc.as_ref().map(|c| c.name.clone()),
//                 course_duration: None,
//                 obtained_marks: None,
//                 total_marks: None,
//                 grade: None,
//                 result_status: None,
//                 exam_date: None,
//                 issue_date: cert.issued_on.date_naive().to_string(),
//                 serial_number: user.serial_number.clone(),
//                 verification_url,
//                 photo: user.photo_url.clone(),
//                 signature: user.signature_url.clone(),
//                 gender: user.gender.clone(),
//                 category: user.category.clone(),
//                 national_id_type: user.national_id_type.clone(),
//                 address: user.address.clone(),
//                 city: user.city.clone(),
//                 state: user.state.clone(),
//                 pincode: user.pincode.clone(),
//                 emergency_contact_name: user.emergency_contact_name.clone(),
//                 emergency_contact_phone: user.emergency_contact_phone.clone(),
//                 additional_docs: user.additional_docs.clone(),
//                 subjects: None,
//                 center_signature: center_doc
//                     .as_ref()
//                     .and_then(|c| c.key_documents.as_ref())
//                     .and_then(|d| d.owner_signature_url.clone()),
//                 center_stamp: center_doc
//                     .as_ref()
//                     .and_then(|c| c.key_documents.as_ref())
//                     .and_then(|d| d.center_stamp_url.clone()),
//                 admin_signature: template
//                     .admin_signature
//                     .clone(),
//                 admin_stamp: template
//                     .admin_stamp
//                     .clone(),
//                 marks_rows: None,
//                 certificate_row_id: Some(preview_oid),
//                 session: None,
//                 exam_mode: None,
//                 admission_mode: None,
//                 center_address: None,
//                 center_code: center_doc.as_ref().map(|c| c.code.clone()),
//                 result_date: None,
//                 result_percentage: None,
//                 overall_status: None,
//                 certificate_no: cert.certificate_no.clone(),
//             };
//             let page_css = page_styles(&template);
//             let page = render_page(&template, &fields, &ctx, &base_url);
//             let single_page_html = format!(
//                 r#"<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>{}</style></head><body>{}</body></html>"#,
//                 page_css, page
//             );
//             Some(single_page_html)
//         }
//         (None, None) => None,
//     };

//     if let Some(html_src) = regenerated_html.or(cert_html_from_doc) {
//         let certs_dir = upload_pb.join("certificates");
//         if let Err(e) = std::fs::create_dir_all(&certs_dir) {
//             eprintln!(
//                 "download_certificate: materialize: cannot create certificates dir {:?}: {}",
//                 certs_dir, e
//             );
//         } else {
//             let file_name = format!("{}.pdf", certificate_no);
//             let rel_path = format!("certificates/{}", file_name);
//             let full_path = upload_pb.join(&rel_path);
//             let full_path_for_gen = full_path.clone();
//             let html_owned = html_src;
//             let gen_res = tokio::task::spawn_blocking(move || {
//                 PdfGenerator::html_to_pdf(&html_owned, full_path_for_gen)
//                     .map_err(|e| e.to_string())
//             })
//             .await;
//             match gen_res {
//                 Ok(Ok(())) => {
//                     let coll = db.collection::<BsonDocument>("certificates");
//                     let _ = coll
//                         .update_one(
//                             doc! { "_id": &cert_oid },
//                             doc! { "$set": { "file_path": &rel_path } },
//                             None,
//                         )
//                         .await;
//                     match tokio::fs::read(&full_path).await {
//                         Ok(data) => {
//                             let data_len = data.len();
//                             let header_take = std::cmp::min(16, data_len);
//                             let header_bytes: Vec<u8> = data.iter().take(header_take).copied().collect();
//                             let header_text = String::from_utf8_lossy(&header_bytes);
//                             let first32: Vec<u8> = data.iter().take(std::cmp::min(32, data_len)).copied().collect();
//                             let last32: Vec<u8> = data
//                                 .iter()
//                                 .skip(data_len.saturating_sub(32))
//                                 .copied()
//                                 .collect();
//                             let sha_out = Command::new("sha256sum").arg(&full_path).output().ok();
//                             let sha256 = sha_out
//                                 .as_ref()
//                                 .and_then(|o| String::from_utf8(o.stdout.clone()).ok())
//                                 .and_then(|s| s.split_whitespace().next().map(|h| h.to_string()))
//                                 .unwrap_or_else(|| "(sha256sum failed)".to_string());
//                             eprintln!(
//                                 "[CERT_DOWNLOAD_MATERIALIZED] cert_no={} path={:?} size={} bytes Content-Type=application/pdf Content-Length={} header_hex={} header_text={:?}",
//                                 certificate_no,
//                                 full_path, data_len, data_len,
//                                 header_bytes.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
//                                 header_text
//                             );
//                             eprintln!(
//                                 "[CERT_DOWNLOAD_MATERIALIZED] first32_hex={} last32_hex={} sha256={}",
//                                 first32.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
//                                 last32.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
//                                 sha256
//                             );
//                             if !header_text.starts_with("%PDF-") {
//                                 eprintln!(
//                                     "[CERT_DOWNLOAD_MATERIALIZED] FATAL: materialized file {:?} is NOT a PDF! Header bytes: {:02X?}",
//                                     full_path, header_bytes
//                                 );
//                             }
//                             // #region debug-point I:certificate-download-response
//                             debug_report(
//                                 "pre-fix",
//                                 "I",
//                                 "backend/src/handlers/certificate.rs:1082",
//                                 "[DEBUG] Materialized certificate download response bytes prepared",
//                                 serde_json::json!({
//                                     "certificate_id": id,
//                                     "certificate_no": certificate_no,
//                                     "path": full_path.display().to_string(),
//                                     "content_type": "application/pdf",
//                                     "content_disposition": format!("attachment; filename=\"{}\"", file_name),
//                                     "content_length_header": data_len,
//                                     "actual_byte_length": data_len,
//                                     "sha256": sha256,
//                                     "first32_hex": first32.iter().map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(""),
//                                     "last32_hex": last32.iter().map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(""),
//                                 }),
//                             )
//                             .await;
//                             // #endregion
//                             let res = axum::response::Response::builder()
//                                 .status(StatusCode::OK)
//                                 .header(header::CONTENT_TYPE, "application/pdf")
//                                 .header(header::CONTENT_LENGTH, data_len.to_string())
//                                 .header(
//                                     header::CONTENT_DISPOSITION,
//                                     &format!("attachment; filename=\"{}\"", file_name),
//                                 )
//                                 .body(Body::from(data))
//                                 .expect("materialized certificate response builder");
//                             return res;
//                         }
//                         Err(e) => {
//                             eprintln!(
//                                 "download_certificate: materialize: read failed {:?}: {}",
//                                 full_path, e
//                             );
//                         }
//                     }
//                 }
//                 Ok(Err(e)) => {
//                     eprintln!(
//                         "download_certificate: materialize: PDF generator failed for cert_no={}: {}",
//                         certificate_no, e
//                     );
//                 }
//                 Err(e) => {
//                     eprintln!(
//                         "download_certificate: materialize: spawn_blocking join error for cert_no={}: {}",
//                         certificate_no, e
//                     );
//                 }
//             }
//         }
//     }

//     eprintln!(
//         "Certificate PDF missing for id={} cert_no={} file_path={:?} pdf_url={:?} pdf_path={:?} (tried UPLOAD_DIR={}, backend_dir={})",
//         id, certificate_no, file_path_opt, pdf_url_opt, pdf_path_opt, upload_dir, backend_dir.display()
//     );
//     // 422: cert exists but PDF absent (often Chromium/headless failed during generation, or UPLOAD_DIR mismatch).
//     (
//         StatusCode::UNPROCESSABLE_ENTITY,
//         Json(serde_json::json!({
//             "success": false,
//             "code": "PDF_MISSING",
//             "message": "Certificate exists but PDF is not on disk. Regenerate from Issue certificates (Re-issue if it already exists). On the server: install Chromium (`chromium` or `google-chrome`) and ensure UPLOAD_DIR is writable."
//         })),
//     )
//         .into_response()
// }
pub async fn download_certificate(
    State(db): State<Database>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    // =========================================================
    // PUBLIC CERTIFICATE DOWNLOAD
    // No authentication
    // No authorization
    // No JWT
    // No Claims
    // No role validation
    // =========================================================

    debug_report(
        "public-download",
        "H",
        "backend/src/handlers/certificate.rs",
        "[DEBUG] Public certificate download handler entered",
        serde_json::json!({
            "certificate_id": id,
        }),
    )
    .await;

    // ---------------------------------------------------------
    // Parse certificate ObjectId
    // ---------------------------------------------------------

    let cert_oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return download_err_json(
                StatusCode::BAD_REQUEST,
                "INVALID_ID",
                "Invalid certificate ID",
            );
        }
    };

    // ---------------------------------------------------------
    // Find certificate
    // ---------------------------------------------------------

    let coll = db.collection::<BsonDocument>("certificates");

    let cert_doc = match coll
        .find_one(doc! { "_id": cert_oid }, None)
        .await
    {
        Ok(Some(doc)) => doc,

        Ok(None) => {
            return download_err_json(
                StatusCode::NOT_FOUND,
                "CERT_NOT_FOUND",
                "Certificate not found.",
            );
        }

        Err(e) => {
            eprintln!(
                "[CERT_DOWNLOAD] Database error: {}",
                e
            );

            return download_err_json(
                StatusCode::INTERNAL_SERVER_ERROR,
                "CERT_FETCH_ERROR",
                "Could not read certificate from database.",
            );
        }
    };

    // ---------------------------------------------------------
    // Certificate number
    // ---------------------------------------------------------

    let certificate_no = match cert_doc.get_str("certificate_no") {
        Ok(value) if !value.is_empty() => value.to_string(),

        _ => {
            return download_err_json(
                StatusCode::INTERNAL_SERVER_ERROR,
                "CERT_SCHEMA",
                "Certificate record is missing certificate_no.",
            );
        }
    };

    // ---------------------------------------------------------
    // Get file_path
    // ---------------------------------------------------------

    let file_path_opt = cert_doc
        .get_str("file_path")
        .ok()
        .filter(|value| !value.is_empty())
        .map(String::from);

    // ---------------------------------------------------------
    // Get pdf_url
    // ---------------------------------------------------------

    let pdf_url_opt = cert_doc
        .get_str("pdf_url")
        .ok()
        .filter(|value| !value.is_empty())
        .map(String::from);

    // ---------------------------------------------------------
    // Get pdf_path
    // ---------------------------------------------------------

    let pdf_path_opt = cert_doc
        .get_str("pdf_path")
        .ok()
        .filter(|value| !value.is_empty())
        .map(String::from);

    // ---------------------------------------------------------
    // Get student_id / template_id (needed only if we have to
    // regenerate the PDF on demand below)
    // ---------------------------------------------------------

    let cert_student_id_opt = cert_doc.get_object_id("student_id").ok();
    let cert_template_id_opt = cert_doc.get_object_id("template_id").ok();

    // ---------------------------------------------------------
    // Directories
    // ---------------------------------------------------------

    let upload_dir = std::env::var("UPLOAD_DIR")
        .unwrap_or_else(|_| {
            "/var/www/html/scre/backend/uploads".to_string()
        });

    let upload_pb = PathBuf::from(&upload_dir);

    let backend_dir =
        PathBuf::from("/var/www/html/scre/backend");

    let public_dir =
        PathBuf::from("/var/www/html/scre/public");

    let public_uploads_dir =
        public_dir.join("uploads");

    eprintln!(
        "[CERT_DOWNLOAD] id={}, certificate_no={}, file_path={:?}, pdf_url={:?}, pdf_path={:?}",
        id,
        certificate_no,
        file_path_opt,
        pdf_url_opt,
        pdf_path_opt
    );

    // ---------------------------------------------------------
    // Candidate PDF paths
    // ---------------------------------------------------------

    let mut candidates: Vec<PathBuf> = Vec::new();

    // =========================================================
    // 1. file_path
    // =========================================================

    if let Some(ref file_path) = file_path_opt {
        let path = PathBuf::from(file_path);

        candidates.push(path.clone());

        if path.is_relative() {
            candidates.push(upload_pb.join(file_path));
            candidates.push(backend_dir.join(file_path));
            candidates.push(public_dir.join(file_path));
            candidates.push(public_uploads_dir.join(file_path));
        }
    }

    // =========================================================
    // 2. pdf_url
    // =========================================================

    if let Some(ref pdf_url) = pdf_url_opt {
        let normalized = pdf_url
            .trim_start_matches('/')
            .trim_start_matches("uploads/")
            .to_string();

        candidates.push(upload_pb.join(&normalized));
        candidates.push(backend_dir.join(&normalized));
        candidates.push(public_dir.join(&normalized));
        candidates.push(public_uploads_dir.join(&normalized));
    }

    // =========================================================
    // 3. pdf_path
    // =========================================================

    if let Some(ref pdf_path) = pdf_path_opt {
        let path = PathBuf::from(pdf_path);

        candidates.push(path.clone());

        if path.is_relative() {
            candidates.push(upload_pb.join(pdf_path));
            candidates.push(backend_dir.join(pdf_path));
            candidates.push(public_dir.join(pdf_path));
            candidates.push(public_uploads_dir.join(pdf_path));
        }
    }

    // =========================================================
    // 4. certificates/{certificate_no}.pdf
    // =========================================================

    let certificate_file =
        format!("certificates/{}.pdf", certificate_no);

    candidates.push(upload_pb.join(&certificate_file));
    candidates.push(backend_dir.join(&certificate_file));
    candidates.push(public_dir.join(&certificate_file));
    candidates.push(public_uploads_dir.join(&certificate_file));

    // =========================================================
    // 5. marksheets/{certificate_no}.pdf
    // =========================================================

    let marksheet_file =
        format!("marksheets/{}.pdf", certificate_no);

    candidates.push(upload_pb.join(&marksheet_file));
    candidates.push(backend_dir.join(&marksheet_file));
    candidates.push(public_dir.join(&marksheet_file));
    candidates.push(public_uploads_dir.join(&marksheet_file));

    // =========================================================
    // 6. {certificate_no}.pdf
    // =========================================================

    let direct_file =
        format!("{}.pdf", certificate_no);

    candidates.push(upload_pb.join(&direct_file));
    candidates.push(backend_dir.join(&direct_file));
    candidates.push(public_dir.join(&direct_file));
    candidates.push(public_uploads_dir.join(&direct_file));

    // =========================================================
    // Search for PDF (first pass — no generation)
    // =========================================================

    let mut found = find_valid_pdf(&candidates).await;

    // =========================================================
    // Not found on disk — attempt on-demand generation, then
    // retry the same candidate list once.
    // =========================================================

    if found.is_none() {
        eprintln!(
            "[CERT_DOWNLOAD] No PDF found on disk for certificate_no={}, id={}. Attempting on-demand generation.",
            certificate_no, id
        );

        match (cert_student_id_opt, cert_template_id_opt) {
            (Some(student_oid), Some(template_oid)) => {
                let issue_date = cert_doc
                    .get_datetime("issued_on")
                    .ok()
                    .map(|dt| dt.to_chrono().date_naive().to_string())
                    .unwrap_or_else(|| Utc::now().date_naive().to_string());

                let regen_payload = GenerateRequest {
                    template_id: template_oid.to_hex(),
                    student_ids: vec![student_oid.to_hex()],
                    issue_date: Some(issue_date),
                    mode: None,
                    scheduled_at: None,
                    reissue: Some(true),
                    force_new: Some(false),
                    attempt_number: None,
                };

                let (regen_status, regen_resp) =
                    process_generate_certificates(&db, UserRole::Admin, regen_payload).await;

                eprintln!(
                    "[CERT_DOWNLOAD] on-demand regen for certificate_no={}: status={} success={} message={}",
                    certificate_no,
                    regen_status.as_u16(),
                    regen_resp.0.success,
                    regen_resp.0.message,
                );

                found = find_valid_pdf(&candidates).await;
            }
            _ => {
                eprintln!(
                    "[CERT_DOWNLOAD] Cannot regenerate certificate_no={}: record is missing student_id and/or template_id.",
                    certificate_no
                );
            }
        }
    }

    // =========================================================
    // Serve PDF, or report not found
    // =========================================================

    match found {
        Some((path, data)) => {
            let file_name = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("certificate.pdf");

            let file_size = data.len();

            eprintln!(
                "[CERT_DOWNLOAD] Serving PUBLIC certificate: path={:?}, size={} bytes",
                path, file_size
            );

            debug_report(
                "public-download",
                "I",
                "backend/src/handlers/certificate.rs",
                "[DEBUG] Public certificate download response prepared",
                serde_json::json!({
                    "certificate_id": id,
                    "path": path.display().to_string(),
                    "content_type": "application/pdf",
                    "content_disposition": format!(
                        "attachment; filename=\"{}\"",
                        file_name
                    ),
                    "content_length": file_size,
                }),
            )
            .await;

            axum::response::Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/pdf")
                .header(header::CONTENT_LENGTH, file_size.to_string())
                .header(
                    header::CONTENT_DISPOSITION,
                    format!("attachment; filename=\"{}\"", file_name),
                )
                .body(Body::from(data))
                .expect("certificate response builder")
        }
        None => download_err_json(
            StatusCode::NOT_FOUND,
            "PDF_NOT_FOUND",
            "Certificate PDF file could not be found.",
        ),
    }
}

#[derive(Debug, Deserialize)]
pub struct DownloadBulkCertificatesRequest {
    pub certificate_ids: Vec<String>,
}

fn merge_pdfs_lopdf(pdf_documents: Vec<Vec<u8>>) -> Result<Vec<u8>, String> {
    // Based on lopdf's merge example: create a new Document and append Page objects.
    if pdf_documents.is_empty() {
        return Err("No PDF documents provided".to_string());
    }

    // Load all PDFs into lopdf Documents, skipping invalid ones.
    let mut loaded_docs: Vec<Document> = Vec::new();
    for bytes in pdf_documents {
        match Document::load_mem(&bytes) {
            Ok(doc) => loaded_docs.push(doc),
            Err(e) => {
                eprintln!("Skipping invalid PDF while merging: {}", e);
            }
        }
    }

    if loaded_docs.is_empty() {
        return Err("No valid PDFs could be loaded".to_string());
    }

    let mut max_id: u32 = 1;
    let mut documents_pages: BTreeMap<PdfObjectId, Object> = BTreeMap::new();
    let mut documents_objects: BTreeMap<PdfObjectId, Object> = BTreeMap::new();

    for mut document in loaded_docs {
        document.renumber_objects_with(max_id);
        max_id = document.max_id + 1;

        // Collect Page objects (and their owning Page content).
        documents_pages.extend(
            document
                .get_pages()
                .into_iter()
                .map(|(_, object_id)| {
                    let obj = document.get_object(object_id).unwrap().to_owned();
                    (object_id, obj)
                })
                .collect::<BTreeMap<PdfObjectId, Object>>(),
        );

        // Collect all non-page objects.
        documents_objects.extend(document.objects);
    }

    let mut merged = Document::with_version("1.5");

    // Catalog and root Pages must be present.
    let mut catalog_object: Option<(PdfObjectId, Object)> = None;
    let mut pages_object: Option<(PdfObjectId, Object)> = None;

    // Process objects except "Page" (handled later), and ignore Outlines.
    for (object_id, object) in documents_objects.iter() {
        match object.type_name().unwrap_or("") {
            "Catalog" => {
                catalog_object = Some((
                    if let Some((id, _)) = catalog_object {
                        id
                    } else {
                        *object_id
                    },
                    object.clone(),
                ));
            }
            "Pages" => {
                if let Ok(dictionary) = object.as_dict() {
                    let mut dictionary = dictionary.clone();
                    if let Some((_, ref old_pages_object)) = pages_object {
                        if let Ok(old_dictionary) = old_pages_object.as_dict() {
                            dictionary.extend(old_dictionary);
                        }
                    }

                    pages_object = Some((
                        if let Some((id, _)) = pages_object {
                            id
                        } else {
                            *object_id
                        },
                        Object::Dictionary(dictionary),
                    ));
                }
            }
            "Page" => {} // ignored, processed later and separately
            "Outlines" => {} // ignored
            "Outline" => {} // ignored
            _ => {
                merged.objects.insert(*object_id, object.clone());
            }
        }
    }

    let (pages_object_id, pages_root_object) = match pages_object {
        Some(v) => v,
        None => return Err("Pages root not found while merging PDFs".to_string()),
    };
    let (catalog_object_id, catalog_root_object) = match catalog_object {
        Some(v) => v,
        None => return Err("Catalog root not found while merging PDFs".to_string()),
    };

    // Attach all Page objects to the new root Pages.
    for (object_id, object) in documents_pages.iter() {
        if let Ok(dictionary) = object.as_dict() {
            let mut dictionary = dictionary.clone();
            dictionary.set("Parent", pages_object_id);
            merged.objects.insert(*object_id, Object::Dictionary(dictionary));
        }
    }

    // Update "Pages" dictionary.
    if let Ok(dictionary) = pages_root_object.as_dict() {
        let mut dictionary = dictionary.clone();
        dictionary.set("Count", documents_pages.len() as u32);
        dictionary.set(
            "Kids",
            documents_pages
                .iter()
                .map(|(object_id, _)| Object::Reference(*object_id))
                .collect::<Vec<_>>(),
        );
        merged.objects.insert(pages_object_id, Object::Dictionary(dictionary));
    }

    // Update "Catalog" dictionary to point to Pages root.
    if let Ok(dictionary) = catalog_root_object.as_dict() {
        let mut dictionary = dictionary.clone();
        dictionary.set("Pages", pages_object_id);
        dictionary.remove(b"Outlines");
        merged.objects.insert(catalog_object_id, Object::Dictionary(dictionary));
    }

    merged.trailer.set("Root", catalog_object_id);
    merged.max_id = merged.objects.len() as u32;
    merged.renumber_objects();
    merged.compress();

    let mut out: Vec<u8> = Vec::new();
    merged
        .save_to(&mut out)
        .map_err(|e| format!("Failed to save merged PDF: {}", e))?;
    Ok(out)
}

pub async fn download_bulk_certificates(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<DownloadBulkCertificatesRequest>,
) -> impl IntoResponse {
    if payload.certificate_ids.is_empty() {
        return (StatusCode::BAD_REQUEST, "No certificate ids provided").into_response();
    }

    // Explicit role gate: Student and Center are scoped to their own certificates below via
    // student_id/center_id. Admin/SuperAdmin are intentionally granted unrestricted access to
    // any center's/any student's certificates for bulk download. Any other role is rejected here
    // rather than silently falling through with student_id/center_id both left as None.
    let is_admin = claims.role == UserRole::Admin || claims.role == UserRole::SuperAdmin;
    if !is_admin && claims.role != UserRole::Student && claims.role != UserRole::Center {
        return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
    }

    let upload_dir = std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string());

    let mut requested_ids: Vec<ObjectId> = Vec::new();
    for id in payload.certificate_ids {
        match ObjectId::parse_str(&id) {
            Ok(oid) => requested_ids.push(oid),
            Err(_) => return (StatusCode::BAD_REQUEST, "Invalid ID in list").into_response(),
        }
    }

    let collection = db.collection::<Certificate>("certificates");
    let certs: Vec<Certificate> = match collection
        .find(doc! { "_id": { "$in": requested_ids.clone() } }, None)
        .await
    {
        Ok(mut cursor) => {
            let mut acc = Vec::new();
            while let Some(Ok(c)) = cursor.next().await {
                acc.push(c);
            }
            acc
        }
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch certificates").into_response(),
    };

    // Index fetched certificates by their ObjectId.
    let mut cert_map: BTreeMap<ObjectId, Certificate> = BTreeMap::new();
    for c in certs {
        if let Some(oid) = c.id {
            cert_map.insert(oid, c);
        }
    }

    // Order the certificates according to the requested id order.
    let mut ordered_certs: Vec<Certificate> = Vec::new();
    for oid in requested_ids.iter() {
        if let Some(c) = cert_map.remove(oid) {
            ordered_certs.push(c);
        }
    }

    if ordered_certs.is_empty() {
        return (StatusCode::NOT_FOUND, "No certificates found").into_response();
    }

    // Validate permissions and load PDF bytes.
    // Admin/SuperAdmin: student_id and center_id both stay None, so the per-certificate
    // ownership checks below are skipped entirely — by design (is_admin gate above already
    // authorized this request for any center/any student).
    let student_id = if claims.role == UserRole::Student {
        match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => Some(oid),
            Err(_) => return (StatusCode::BAD_REQUEST, "Invalid student ID").into_response(),
        }
    } else {
        None
    };
    let center_id = if claims.role == UserRole::Center {
        match ObjectId::parse_str(&claims.sub) {
            Ok(oid) => Some(oid),
            Err(_) => return (StatusCode::BAD_REQUEST, "Invalid center ID").into_response(),
        }
    } else {
        None
    };

    let mut pdf_bytes: Vec<Vec<u8>> = Vec::new();
    let mut missing: Vec<String> = Vec::new();

    for cert in ordered_certs {
        if let Some(sid) = student_id {
            if cert.student_id != sid {
                return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
            }
        }
        if let Some(cid) = center_id {
            if cert.center_id != cid {
                return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
            }
        }
        // Admin/SuperAdmin fall through here unrestricted — no student_id/center_id match required.

        // Only merge issued/approved certificates; draft/scheduled won't have final PDFs.
        let status = cert.status.clone().unwrap_or_default();
        if status != "approved" && status != "issued" {
            continue;
        }

        let mut found_path: Option<PathBuf> = None;
        if let Some(path_str) = cert.file_path.clone() {
            let p = PathBuf::from(path_str);
            if p.exists() {
                found_path = Some(p);
            }
        }
        if found_path.is_none() {
            let expected_rel = format!("certificates/{}.pdf", cert.certificate_no);
            let expected = PathBuf::from(&upload_dir).join(&expected_rel);
            if expected.exists() {
                found_path = Some(expected);
            }
        }

        if let Some(path) = found_path {
            match tokio::fs::read(&path).await {
                Ok(bytes) => pdf_bytes.push(bytes),
                Err(_) => missing.push(cert.certificate_no),
            }
        } else {
            missing.push(cert.certificate_no);
        }
    }

    if pdf_bytes.is_empty() {
        eprintln!("No valid PDFs found for bulk download. Missing: {:?}", missing);
        return (StatusCode::NOT_FOUND, "No certificate files found for bulk download").into_response();
    }

    let merged_pdf = match merge_pdfs_lopdf(pdf_bytes) {
        Ok(bytes) => bytes,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to merge PDFs: {}", e)).into_response(),
    };

    let file_name = format!("Certificates_{}.pdf", chrono::Utc::now().format("%Y%m%d_%H%M%S"));
    let data_len = merged_pdf.len();
    let header_take = std::cmp::min(16, data_len);
    let header_bytes: Vec<u8> = merged_pdf.iter().take(header_take).copied().collect();
    let header_text = String::from_utf8_lossy(&header_bytes);
    eprintln!(
        "[CERT_BULK_DOWNLOAD] merged PDF size={} bytes Content-Type=application/pdf Content-Length={} header_hex={} header_text={:?}",
        data_len, data_len,
        header_bytes.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
        header_text
    );
    let res = axum::response::Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/pdf")
        .header(header::CONTENT_LENGTH, data_len.to_string())
        .header(
            header::CONTENT_DISPOSITION,
            &format!("attachment; filename=\"{}\"", file_name),
        )
        .body(Body::from(merged_pdf))
        .expect("bulk certificate response builder");
    res
}