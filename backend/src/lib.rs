pub mod authz;
pub mod config;
pub mod db;
pub mod handlers;
mod jwt;
mod middleware;
pub mod models;
mod routes;
pub mod services;
pub mod util;

use crate::handlers::generate_certificates::{
    GenerateRequest, admin_download_student_document, approve_and_schedule_marksheets,
    list_eligible_for_marksheet, process_generate_certificates,
};
use crate::models::certificate::Certificate;
use crate::models::user::Claims;
use crate::models::user::UserRole;
use crate::services::translation_service::{
    backfill_missing_translations, get_all_supported_languages,
};
use axum::http::HeaderValue;
use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, FromRequestParts},
    http::{StatusCode, request::Parts},
    routing::{delete, get, patch, post, put},
};
use chrono::Utc;
use futures_util::stream::StreamExt;
use mongodb::bson::doc;
use serde_json::json;
use std::net::SocketAddr;
use tokio::time::{Duration, sleep};
use tower_http::{
    compression::CompressionLayer,
    cors::{AllowOrigin, Any, CorsLayer},
    services::ServeDir,
    set_header::SetResponseHeaderLayer,
};

/// Middleware: removes `Accept-Encoding` request header for PDF download URLs before
/// the global CompressionLayer runs. CompressionLayer reads Accept-Encoding from the
/// request to decide whether to gzip the response. Since PDFs / images / videos embed
/// internal zlib/flate compression already, HTTP gzip buys ~0% size and can cause strict
/// PDF readers (Adobe, built-in viewers) to fail on proxy-chain decompression bugs.
/// This way text/json still compress normally (Accept-Encoding preserved) but download
/// endpoints always serve raw bytes with a real Content-Length.
pub async fn strip_accept_encoding_for_downloads(
    mut req: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    let path = req.uri().path();
    let is_binary_download = path.contains("/certificates/download/")
        || (path.contains("/marksheets/") && path.ends_with("/download"))
        || path.ends_with("/documents/download");
    if is_binary_download {
        req.headers_mut().remove(axum::http::header::ACCEPT_ENCODING);
    }
    next.run(req).await
}

async fn start_scheduler(db: mongodb::Database) {
    loop {
        let now = Utc::now();
        let certs_coll = db.collection::<Certificate>("certificates");

        // Find certificates that are scheduled and the time has come
        let filter = doc! {
            "status": "scheduled",
            "scheduled_at": { "$lte": now }
        };

        if let Ok(mut cursor) = certs_coll.find(filter, None).await {
            while let Some(Ok(cert)) = cursor.next().await {
                if let (Some(_cert_id), Some(template_id)) = (cert.id, cert.template_id) {
                    println!("Processing scheduled certificate: {}", cert.certificate_no);

                    let payload = GenerateRequest {
                        template_id: template_id.to_hex(),
                        student_ids: vec![cert.student_id.to_hex()],
                        issue_date: Some(cert.issued_on.naive_utc().date().to_string()),
                        mode: None,
                        scheduled_at: None, // This will make it process immediately
                        reissue: Some(true),
                        force_new: Some(false),
                        attempt_number: None,
                    };

                    // Process it
                    let _ = process_generate_certificates(&db, UserRole::Admin, payload).await;
                    println!(
                        "Finished processing scheduled certificate: {}",
                        cert.certificate_no
                    );
                }
            }
        }
        sleep(Duration::from_secs(60)).await; // Check every minute
    }
}

async fn start_translation_backfill_scheduler(db: mongodb::Database) {
    // Translation backfill is disabled to prevent CPU spikes (503 Service Unavailable)
    return;
    /*
    loop {
        let langs = get_all_supported_languages();
        let created = backfill_missing_translations(&db, &langs).await;
        if created > 0 {
            println!("Translation backfill completed. Created {} missing translations", created);
        }
        sleep(Duration::from_secs(60 * 60)).await; // hourly
    }
    */
}

async fn start_id_card_auto_scheduler(db: mongodb::Database) {
    loop {
        crate::services::id_card_auto::process_due_id_card_auto_jobs(&db).await;
        sleep(Duration::from_secs(30)).await;
    }
}

async fn start_marksheet_auto_scheduler(db: mongodb::Database) {
    loop {
        crate::services::marksheet_automation::process_pending_marksheets(&db).await;
        sleep(Duration::from_secs(60)).await; // Check every minute
    }
}

async fn start_certificate_auto_scheduler(db: mongodb::Database) {
    loop {
        crate::services::certificate_automation::process_pending_certificates(&db).await;
        sleep(Duration::from_secs(60)).await; // Check every minute
    }
}

async fn start_exam_auto_allotment_scheduler(db: mongodb::Database) {
    eprintln!(
        "[auto-exam-scheduler] SPAWNED: minutely loop started (backend {} pid {})",
        env!("CARGO_PKG_VERSION"),
        std::process::id()
    );
    loop {
        crate::services::exam_auto_scheduler::run_auto_exam_allotment_cycle(&db, false).await;
        sleep(Duration::from_secs(60)).await; // Check every minute
    }
}

#[axum::async_trait]
impl<S> FromRequestParts<S> for Claims
where
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        // Middleware may already have validated the JWT and attached claims.
        if let Some(existing) = parts.extensions.get::<Claims>() {
            return Ok(existing.clone());
        }

        let auth_header = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.strip_prefix("Bearer "));

        let token = auth_header.ok_or(StatusCode::UNAUTHORIZED)?;

        jwt::decode_jwt(token)
    }
}

use axum::extract::FromRef;

#[derive(Clone)]
pub struct AppState {
    client: mongodb::Client,
    db: mongodb::Database,
}

impl FromRef<AppState> for mongodb::Database {
    fn from_ref(state: &AppState) -> Self {
        state.db.clone()
    }
}

pub async fn run_server() {
    dotenvy::dotenv().ok();
    let (client, db) = db::connect_db().await;
    println!("Successfully connected to MongoDB");

    db::ensure_indexes(&db).await;

    // Start background scheduler (commented out to prevent auto-generation)
    // let db_clone = db.clone();
    // tokio::spawn(async move {
    //     start_scheduler(db_clone).await;
    // });
    let db_clone = db.clone();
    tokio::spawn(async move {
        start_translation_backfill_scheduler(db_clone).await;
    });
    let db_clone = db.clone();
    tokio::spawn(async move {
        start_id_card_auto_scheduler(db_clone).await;
    });
    let db_clone = db.clone();
    tokio::spawn(async move {
        start_marksheet_auto_scheduler(db_clone).await;
    });
    let db_clone = db.clone();
    tokio::spawn(async move {
        start_certificate_auto_scheduler(db_clone).await;
    });
    let db_clone = db.clone();
    tokio::spawn(async move {
        start_exam_auto_allotment_scheduler(db_clone).await;
    });

    // Optional destructive maintenance switches (meant for controlled environments only).
    // - PURGE_DB=true: wipes all collections (except system), keeps only superadmin in `users`.
    // - PURGE_USERS=true: wipes all users, then reseeds superadmin.
    if std::env::var("PURGE_DB").ok().as_deref() == Some("true") {
        // Purge all non-users collections
        if let Ok(names) = db.list_collection_names(None).await {
            for name in names {
                if name.starts_with("system.") || name == "users" {
                    continue;
                }
                let coll = db.collection::<mongodb::bson::Document>(&name);
                let _ = coll.delete_many(doc! {}, None).await;
            }
        }

        // Keep only superadmin user document(s)
        let users = db.collection::<mongodb::bson::Document>("users");
        let _ = users
            .delete_many(doc! { "role": { "$ne": "superadmin" } }, None)
            .await;
        println!("Purged database (kept only superadmin). Reseeding Super Admin...");
    }

    if std::env::var("PURGE_USERS").ok().as_deref() == Some("true") {
        let users = db.collection::<mongodb::bson::Document>("users");
        let _ = users.delete_many(mongodb::bson::doc! {}, None).await;
        println!("Purged all users. Reseeding Super Admin...");
    }
    if std::env::var("PURGE_DB").ok().as_deref() == Some("true") {
        handlers::auth::seed_super_admin_with_force(&db, true).await;
    } else {
        handlers::auth::seed_super_admin(&db).await;
    }

    let app = Router::new()
        .route("/", get(|| async { "Hello from Rust Backend!" }))
        .route("/api/health", get(|| async { (StatusCode::OK, Json(json!({"status":"ok"}))) }))
        .route("/api/public/centers", get(handlers::center::public_list_centers))
        .route("/api/public/home-data", get(handlers::public::get_home_data))
        .route("/api/public/courses", get(handlers::course::get_public_courses))
        .route("/api/public/courses/:id", get(handlers::course::get_public_course_by_id))
        .route("/api/public/payments/create-order", post(handlers::payment::create_public_order))
        .route("/api/public/payments/verify", post(handlers::payment::verify_public_payment))
        .route("/api/public/inquiry", post(handlers::inquiry::handle_create_inquiry))
        .route("/api/public/register", post(handlers::student::public_register_student))
        .route("/api/public/centers/:code", get(handlers::center::public_get_center_by_code))
        .route("/api/public/products", get(handlers::product::get_products))
        .route("/api/public/verify/:reg_no", get(handlers::certificate::public_verify_certificate))
        .route("/api/public/verify-certificate/:id", get(handlers::certificate::public_verify_certificate_by_id))
        .route("/api/public/verify-student", get(handlers::student::public_verify_student))
        .route("/api/contact", post(handlers::contact::handle_create_enquiry))
        .route("/api/admin/enquiries", get(handlers::contact::list_enquiries))
        .route("/api/admin/enquiries/:id", get(handlers::contact::get_enquiry).put(handlers::contact::update_enquiry).delete(handlers::contact::delete_enquiry))
        .route("/api/admin/enquiries/:id/notes", post(handlers::contact::add_enquiry_note))
        .route("/api/admin/enquiries/metrics", get(handlers::contact::enquiry_metrics))
        .route("/api/admin/enquiries/export", get(handlers::contact::export_enquiries))
        .route("/api/auth/login", post(handlers::auth::login))
        .route("/api/auth/me", get(handlers::auth::get_current_user))
        .route("/api/auth/send-email-otp", post(handlers::auth::send_email_otp))
        .route("/api/auth/verify-email-otp", post(handlers::auth::verify_email_otp))
        .route("/api/content", get(handlers::translate::get_translated_content))
        .route("/api/translate", post(handlers::translate::translate_text))
        .route("/api/translate/bulk", post(handlers::translate::translate_bulk))
        .route("/api/auth/create-admin", post(handlers::auth::create_admin))
        .route("/api/admin/metrics", get(handlers::admin::get_admin_metrics))
        .route("/api/admin/dashboard-data", get(handlers::admin::get_admin_dashboard_data))
        .route("/api/admin/users", get(handlers::admin::get_all_users))
        .route("/api/admin/users/:id", delete(handlers::admin::delete_user))
        .route("/api/admin/users/:id/role", put(handlers::admin::update_user_role))
        .route("/api/admin/users/:id/reset-password", post(handlers::admin::reset_user_password))
        .route("/api/admin/roles", get(handlers::admin::list_sub_admin_roles).post(handlers::admin::create_sub_admin_role))
        .route("/api/admin/roles/:id", put(handlers::admin::update_sub_admin_role).delete(handlers::admin::delete_sub_admin_role))
        .route("/api/admin/users/:id/permissions", put(handlers::admin::assign_user_role_and_permissions))
        .route("/api/admin/permissions/me", get(handlers::admin::get_current_admin_permissions))
        .route("/api/centers", post(handlers::center::handle_create_center).get(handlers::center::get_centers))
        .route("/api/centers/check-code", get(handlers::center::check_center_code))
        .route("/api/centers/drafts", post(handlers::center_draft::save_draft).get(handlers::center_draft::list_drafts))
        .route("/api/centers/drafts/:id", get(handlers::center_draft::get_draft).delete(handlers::center_draft::delete_draft))
        .route("/api/students/drafts", post(handlers::student_draft::save_draft).get(handlers::student_draft::list_drafts))
        .route("/api/students/drafts/:id", get(handlers::student_draft::get_draft).delete(handlers::student_draft::delete_draft))
        // .route("/api/interns/drafts", post(handlers::intern_draft::save_draft).get(handlers::intern_draft::list_drafts))
        // .route("/api/interns/drafts/:id", get(handlers::intern_draft::get_draft).delete(handlers::intern_draft::delete_draft))
        .route("/api/center/metrics", get(handlers::center::get_center_metrics))
        .route("/api/centers/:id", delete(handlers::center::delete_center).put(handlers::center::update_center))
        .route("/api/centers/:id/print", get(handlers::center_pdf::generate_center_details_pdf))
        .route("/api/centers/:id/preview", get(handlers::center_pdf::get_center_preview))
        .route("/api/admin/bin/centers", get(handlers::center::list_deleted_centers))
        .route("/api/admin/bin/centers/:id/restore", post(handlers::center::restore_center))
        .route("/api/admin/bin/centers/:id/initiate-delete", post(handlers::center::initiate_permanent_delete))
        .route("/api/admin/bin/centers/:id/cancel-delete", post(handlers::center::cancel_permanent_delete))
        .route("/api/admin/bin/centers/:id/permanent", delete(handlers::center::execute_permanent_delete))
        .route("/api/students", post(handlers::student::handle_create_student).get(handlers::student::list_students))
        .route("/api/student/metrics", get(handlers::student::get_student_metrics))
          .route("/api/students/bin", get(handlers::student::list_deleted_students))
          .route("/api/students/:id", get(handlers::student::get_student_by_id).put(handlers::student::update_student).delete(handlers::student::delete_student))
          .route("/api/students/:id/status", patch(handlers::student::toggle_student_status))
          .route("/api/students/:id/restore", post(handlers::student::restore_student))
          .route("/api/students/:id/admin-bin", post(handlers::student::move_to_admin_bin))
          .route("/api/students/:id/permanent", delete(handlers::student::permanent_delete_student))
          .route("/api/students/:id/enrollment-pdf", get(handlers::student::generate_student_enrollment_pdf))
          .route("/api/students/:id/id-card-pdf", get(handlers::id_card::generate_student_id_card))
          .route("/api/students/:id/fee-structure", put(handlers::student::update_student_fee_structure))
          .route("/api/students/:id/extra-charges", put(handlers::student::update_student_extra_charges))
        .route("/api/attendance", get(handlers::attendance::get_attendance))
        .route("/api/fees", post(handlers::fee::collect_fee).get(handlers::fee::get_fees))
        .route("/api/fees/collect", post(handlers::fee::collect_fee))
        .route("/api/fees/total", post(handlers::fee::update_student_total_fees))
        .route("/api/fees/preview", get(handlers::fee::preview_fee_slip))
        .route("/api/fees/print", get(handlers::fee::print_fee_slip))
        .route("/api/fees/receipt/latest", get(handlers::fee::download_latest_fee_receipt))
        .route("/api/fees/summary/:student_id", get(handlers::fee::get_student_fee_summary))
        .route("/api/courses", post(handlers::course::create_course).get(handlers::course::get_courses))
        .route("/api/courses/:id", put(handlers::course::update_course).delete(handlers::course::delete_course))
        .route("/api/courses/allot", post(handlers::course::allot_course).get(handlers::course::get_allotted_courses))
        .route("/api/academic/course-subjects/bulk-subjects", post(handlers::academic::bulk_map_subjects_to_course))
        .route("/api/academic/course-subjects/bulk-courses", post(handlers::academic::bulk_map_courses_to_subject))
        .route("/api/academic/course-subjects/mapping/:id", delete(handlers::academic::delete_course_subject_mapping))
        .route("/api/academic/course-subjects/:course_id", get(handlers::academic::list_course_subjects))
        .route("/api/academic/course-subjects/subject/:subject_id", get(handlers::academic::list_subject_courses))
        .route("/api/academic/course-subjects/all", get(handlers::academic::list_all_course_subjects))
        .route("/api/academic/course-subjects", post(handlers::academic::map_subject_to_course))
        .route("/api/academic/sessions", post(handlers::academic::create_session).get(handlers::academic::list_sessions))
        .route("/api/academic/sessions/:id", put(handlers::academic::update_session).delete(handlers::academic::delete_session))
        .route("/api/academic/study-materials", post(handlers::academic::upload_study_material).get(handlers::academic::list_study_materials))
        .route("/api/announcements", post(handlers::announcement::create_announcement).get(handlers::announcement::get_announcements))
        .route("/api/announcements/:id", put(handlers::announcement::edit_announcement).delete(handlers::announcement::delete_announcement))
        .route("/api/categories", post(handlers::category::create_category).get(handlers::category::get_categories))
        .route("/api/categories/:id", delete(handlers::category::delete_category))
        .route("/api/messages", post(handlers::message::send_message))
        .route("/api/messages/recent", get(handlers::message::get_recent_chats))
        .route("/api/messages/chats/recent", get(handlers::message::get_recent_chats))
        .route("/api/messages/user/:username", get(handlers::message::find_user_by_username))
        .route("/api/messages/user/by-username/:username", get(handlers::message::find_user_by_username))
        .route("/api/messages/:other_id", get(handlers::message::get_messages))
        .route("/api/public/system/time", get(handlers::system_settings::get_server_time))
        .route("/api/public/system-settings", get(handlers::system_settings::get_public_system_settings))
        .route("/api/system/settings/public", get(handlers::system_settings::get_public_system_settings))
        .route("/api/system/settings", get(handlers::system_settings::get_system_settings).put(handlers::system_settings::update_system_settings))
        .route("/api/system/settings/auto-exam", put(handlers::system_settings::update_auto_exam_settings))
        .route("/api/system/settings/cursor", post(handlers::system_settings::upload_cursor))
        .route("/api/public/country-fees", get(handlers::system_settings::get_country_fees))
        .route("/api/system/stats", get(handlers::system_stats::get_system_stats).put(handlers::system_stats::update_system_stats))
        .route("/api/subscriptions/plans", post(handlers::subscription::create_plan).get(handlers::subscription::get_plans))
        .route("/api/subscriptions/allot", post(handlers::subscription::allot_subscription))
        .route("/api/subscriptions/center/:center_id", get(handlers::subscription::get_center_subscription))
        .route("/api/staff", post(handlers::staff::handle_create_staff).get(handlers::staff::get_staff_list))
        .route("/api/staff/:id", put(handlers::staff::update_staff).delete(handlers::staff::delete_staff))
        .route("/api/staff/permissions", get(handlers::staff::get_staff_permissions))
        .route("/api/typing/languages", post(handlers::typing::create_language).get(handlers::typing::get_languages))
        .route("/api/typing/languages/seed-default", post(handlers::typing::seed_default_languages))
        .route("/api/typing/languages/:id", delete(handlers::typing::delete_language))
        .route("/api/typing/lessons", post(handlers::typing::create_lesson).get(handlers::typing::get_lessons))
        .route("/api/typing/lessons/:id", delete(handlers::typing::delete_lesson).patch(handlers::typing::toggle_lesson_status))
        .route("/api/typing/results", post(handlers::typing::submit_typing_result))
        .route("/api/typing/history", get(handlers::typing::get_typing_history))
        .route("/api/typing/leaderboard", get(handlers::typing::get_leaderboard))
        .route("/api/typing/certificates", get(handlers::typing::get_typing_certificates))
        .route("/api/typing/certificates/:id", get(handlers::typing::get_typing_certificate_by_id))
        .route("/api/qb/banks", get(handlers::qb::list_banks).post(handlers::qb::create_bank))
        .route("/api/qb/banks/:id", delete(handlers::qb::delete_bank).put(handlers::qb::update_bank))
        .route("/api/qb/banks/:bank_id/questions", get(handlers::qb::list_bank_questions))
        .route("/api/qb/questions", post(handlers::qb::create_question))
        .route("/api/qb/questions/:id", get(handlers::qb::get_question).put(handlers::qb::update_question).delete(handlers::qb::delete_question))
        .route("/api/typing/report", get(handlers::typing::get_typing_report))
        .route("/api/typing/analytics", get(handlers::typing::get_typing_analytics))
        .route("/api/exam/mock-tests/eligible", get(handlers::mock_test::list_eligible_mock_tests_for_student))
        .route(
            "/api/exam/mock-tests/:id/start",
            post(handlers::mock_test::start_mock_test_for_student),
        )
        .route(
            "/api/exam/mock-tests/:id",
            put(handlers::mock_test::update_mock_test).delete(handlers::mock_test::delete_mock_test),
        )
        .route(
            "/api/exam/mock-tests",
            post(handlers::mock_test::create_mock_test).get(handlers::mock_test::list_mock_tests_admin),
        )
        .route("/api/exam/blueprints", post(handlers::exam_engine::create_blueprint).get(handlers::exam_engine::list_blueprints))
        .route("/api/exam/blueprints/:id", put(handlers::exam_engine::update_blueprint).delete(handlers::exam_engine::delete_blueprint))
        .route("/api/exam/blueprints/:id/set-default", post(handlers::exam_engine::set_default_blueprint))
        .route("/api/exam/questions", post(handlers::exam_engine::add_question).get(handlers::exam_engine::list_questions))
        .route("/api/exam/questions/:id", put(handlers::exam_engine::update_question).delete(handlers::exam_engine::delete_question))
        .route("/api/exam/generate-paper", post(handlers::exam_engine::generate_student_paper))
        .route("/api/exam/papers", get(handlers::exam_engine::list_student_papers))
        .route("/api/exam/papers/:id", get(handlers::exam_engine::get_student_paper).delete(handlers::exam_engine::delete_student_paper).put(handlers::exam_engine::update_student_paper))
        .route("/api/exam/postpone", post(handlers::exam_engine::postpone_allotted_exams))
        .route("/api/exam/hall-ticket/:id", get(handlers::hall_ticket::generate_hall_ticket))
        .route("/api/exam/attempt/:id/start", post(handlers::exam_engine::start_exam))
        .route("/api/exam/attempt/:id/submit", post(handlers::exam_engine::submit_exam))
        .route("/api/exam/questions/:id/feedback", post(handlers::exam_engine::report_question_feedback))
        .route("/api/exam/questions/feedback", get(handlers::exam_engine::list_question_feedback))
        .route("/api/exam/evaluate/:id", post(handlers::exam_engine::evaluate_paper))
        .route("/api/exam/analytics/questions", get(handlers::exam_engine::get_question_analytics))
        .route("/api/exam/bulk-allot", post(handlers::exam_workflow::bulk_allot_exam))
        .route("/api/exam/eligible-students", get(handlers::exam_workflow::list_eligible_students))
        .route("/api/exam/reappear/students", get(handlers::exam_workflow::list_reappear_students))
        .route("/api/exam/reappear/:student_id/:course_id", put(handlers::exam_workflow::update_reappear_permission))
        .route("/api/exam/marks-entry/students", get(handlers::exam_workflow::list_marks_entry_students))
        .route("/api/exam/marks-entry/:student_id/:course_id", get(handlers::exam_workflow::get_marks_entry_form))
        .route("/api/exam/marks-entry/submit", post(handlers::exam_workflow::submit_marks_entry))
        .route("/api/exam/marks-entry/request-changes", post(handlers::exam_workflow::submit_marks_change_request))
        .route("/api/exam/center-requests", get(handlers::exam_workflow::list_center_marks_requests))
        .route("/api/exam/center-requests/:id", get(handlers::exam_workflow::get_center_marks_request))
        .route("/api/exam/center-requests/:id/respond", put(handlers::exam_workflow::respond_center_marks_request))
        .route("/api/exam/allotment-batches", get(handlers::exam_workflow::list_allotment_batches_for_center))
        .route("/api/exam/allotment-batches/:batch_id/subjects/:subject_id", get(handlers::exam_workflow::get_batch_paper_for_subject))
        .route("/api/exam/auto-allot", post(handlers::exam_workflow::trigger_automatic_exam_allotment))
        .route(
            "/api/exam-v2/question-banks",
            get(handlers::exam_engine_v2::v2_list_question_banks),
        )
        .route(
            "/api/exam-v2/paper-templates",
            post(handlers::exam_engine_v2::v2_create_paper_template).get(handlers::exam_engine_v2::v2_list_paper_templates),
        )
        .route("/api/exam-v2/paper-templates/:id", get(handlers::exam_engine_v2::v2_get_paper_template))
        .route("/api/exam-v2/migrate", post(handlers::exam_engine_v2::v2_run_migration))
        .route("/api/exam-v2/exams", post(handlers::exam_engine_v2::v2_create_exam).get(handlers::exam_engine_v2::v2_list_exams))
        .route("/api/exam-v2/exams/:id", patch(handlers::exam_engine_v2::v2_patch_exam))
        .route(
            "/api/exam-v2/tags",
            get(handlers::exam_engine_v2::v2_list_tags),
        )
        .route(
            "/api/exam-v2/questions",
            get(handlers::exam_engine_v2::v2_list_questions),
        )
        .route("/api/exam-v2/papers", get(handlers::exam_engine_v2::v2_list_papers))
        .route("/api/exam-v2/papers/:id", get(handlers::exam_engine_v2::v2_get_paper))
        .route("/api/exam-v2/attempts/:id/start", post(handlers::exam_engine_v2::v2_start_attempt))
        .route("/api/exam-v2/attempts/:id/state", get(handlers::exam_engine_v2::v2_attempt_state))
        .route("/api/exam-v2/attempts/:id/autosave", patch(handlers::exam_engine_v2::v2_autosave))
        .route("/api/exam-v2/attempts/:id/submit", post(handlers::exam_engine_v2::v2_submit))
        .route("/api/exam-v2/offline/:id/submit", post(handlers::exam_engine_v2::v2_offline_submit))
        .route("/api/exam-v2/marksheets/generate", post(handlers::exam_engine_v2::v2_generate_marksheet))
        .route("/api/exam-v2/marksheets/bulk-zip", get(handlers::exam_engine_v2::v2_marksheets_bulk_zip))
        .route("/api/exam-v2/marksheets", get(handlers::exam_engine_v2::v2_list_marksheets))
        .route("/api/exam-v2/marksheets/render-pdf/:id", post(handlers::exam_engine_v2::v2_marksheet_render_pdf))
        .route("/api/exam-v2/student/exam-context", get(handlers::exam_engine_v2::v2_student_exam_context))
        .route("/api/exam-v2/marks/submit", post(handlers::exam_engine_v2::v2_submit_marks))
        .route("/api/exam-v2/marks/list", get(handlers::exam_engine_v2::v2_list_marks))
        .route("/api/exam-v2/marks/:id/approve", post(handlers::exam_engine_v2::v2_approve_marks))
        .route("/api/exam-v2/reappear/apply", post(handlers::exam_engine_v2::v2_apply_reappear))
        // --- LIVE CLASSES ---
        .route("/api/live-classes", get(handlers::live_class::list_live_classes).post(handlers::live_class::create_live_class))
        .route("/api/live-classes/:id", put(handlers::live_class::update_live_class).delete(handlers::live_class::delete_live_class))
        .route("/api/attendance/bulk", post(handlers::attendance::bulk_upsert_attendance))
        .route("/api/certificates", post(handlers::certificate::issue_certificate).get(handlers::certificate::get_certificates))
        .route("/api/certificates/download-bulk", post(handlers::certificate::download_bulk_certificates))
        .route("/api/certificates/download/:id", get(handlers::certificate::download_certificate))
        .route("/api/certificates/:id", delete(handlers::certificate::delete_certificate))
        .route("/api/certificates/verify/:reg_no", get(handlers::certificate::public_verify_certificate))
        .route("/api/certificates/:id/apply-sign-stamp", patch(handlers::certificate::apply_sign_stamp))
        .route("/api/certificates/apply-sign-stamp-bulk", patch(handlers::certificate::apply_sign_stamp_bulk))
        .route("/api/admin/certificates/:id/approve", post(handlers::certificate::admin_approve_certificate))
        .route("/api/admin/marksheets/eligible", get(list_eligible_for_marksheet))
        .route("/api/admin/students/:id/documents/download", get(admin_download_student_document))
        .route("/api/admin/marksheets/approve-schedule", post(approve_and_schedule_marksheets))
        .route("/api/admin/certificates/approve-bulk", post(handlers::certificate::admin_approve_certificates_bulk))
        .route("/api/admin/students/:id/approve", post(handlers::admin_students::approve_student))
        .route("/api/admin/students/:id/reject", post(handlers::admin_students::reject_student))
        .route("/api/admin/students/:id/toggle-active", post(handlers::admin_students::toggle_student_active))
        .route("/api/admin/centers/:id/toggle-active", post(handlers::center::toggle_center_active))
        .route("/api/admin/check-email", get(handlers::center::check_email_unique))
        .route("/api/center/assets", get(handlers::center_assets::get_assets).put(handlers::center_assets::set_assets))
        .route("/api/admin/assets", get(handlers::admin_assets::get_admin_assets).put(handlers::admin_assets::set_admin_assets))
        .route("/api/admin/locations/countries", get(handlers::locations::list_countries).post(handlers::locations::create_country))
        .route("/api/admin/locations/countries/:id", axum::routing::delete(handlers::locations::delete_country))
        .route("/api/admin/locations/states", get(handlers::locations::list_states).post(handlers::locations::create_state))
        .route("/api/admin/locations/states/bulk", post(handlers::locations::bulk_states))
        .route("/api/admin/locations/states/:id", axum::routing::delete(handlers::locations::delete_state))
        .route("/api/admin/locations/cities", get(handlers::locations::list_cities).post(handlers::locations::create_city))
        .route("/api/admin/locations/cities/bulk", post(handlers::locations::bulk_cities))
        .route("/api/admin/locations/cities/:id", axum::routing::delete(handlers::locations::delete_city))
        .route("/api/admin/locations/districts", get(handlers::locations::list_districts).post(handlers::locations::create_district))
        .route("/api/admin/locations/districts/bulk", post(handlers::locations::bulk_districts))
        .route("/api/admin/locations/districts/:id", axum::routing::delete(handlers::locations::delete_district))
        .route("/api/admin/locations/pincodes", get(handlers::locations::list_pincodes).post(handlers::locations::create_pincode))
        .route("/api/admin/locations/pincodes/bulk", post(handlers::locations::bulk_pincodes))
        .route("/api/admin/locations/pincodes/:id", axum::routing::delete(handlers::locations::delete_pincode))
        .route("/api/admin/locations/areas", get(handlers::locations::list_areas).post(handlers::locations::create_area))
        .route("/api/admin/locations/areas/bulk", post(handlers::locations::bulk_areas))
        .route("/api/admin/locations/areas/:id", axum::routing::delete(handlers::locations::delete_area))
        .route("/api/admin/locations/seed-india", post(handlers::locations::seed_india))
        // --- COLLEGE ROUTES ---
        .route("/api/admin/colleges", get(handlers::colleges::list_colleges).post(handlers::colleges::create_college))
        .route("/api/admin/colleges/:id", put(handlers::colleges::update_college).delete(handlers::colleges::delete_college))
        // --- PUBLIC LOCATIONS ---
        .route("/api/public/locations/countries", get(handlers::locations::public_list_countries))
        .route("/api/public/locations/states", get(handlers::locations::public_list_states))
        .route("/api/public/locations/districts", get(handlers::locations::public_list_districts))
        .route("/api/public/locations/cities", get(handlers::locations::public_list_cities))
        .route("/api/public/locations/pincodes", get(handlers::locations::public_list_pincodes))
        .route("/api/public/colleges", get(handlers::colleges::public_list_colleges))
        .route(
            "/api/admin/categories",
            get(handlers::course_categories::list_categories)
                .post(handlers::course_categories::create_category),
        )
        .route("/api/public/categories", get(handlers::course_categories::public_list_categories))
        .route("/api/public/batches", get(handlers::batch::public_get_batches))
        .route("/api/admin/categories/:id", put(handlers::course_categories::update_category).delete(handlers::course_categories::delete_category))
        .route("/api/admin/subjects", get(handlers::subjects::list_subjects).post(handlers::subjects::create_subject))
        .route("/api/admin/subjects/:id", put(handlers::subjects::update_subject).delete(handlers::subjects::delete_subject))
        .route("/api/blogs", get(handlers::blog::list_blogs))
        .route("/api/blogs/featured", get(handlers::blog::list_featured_blogs))
        .route("/api/blogs/:slug", get(handlers::blog::get_blog_by_slug))
        .route("/api/blog-categories", get(handlers::blog_categories::public_list_blog_categories))
        .route("/api/admin/blogs", get(handlers::blog::admin_list_blogs))
        .route("/api/admin/blogs/export", get(handlers::blog::admin_export_blogs))
        .route("/api/admin/blog/by-slug/:slug", get(handlers::blog::admin_get_blog_by_slug))
        .route("/api/admin/blog", post(handlers::blog::create_blog))
        .route("/api/admin/blog/:id", put(handlers::blog::update_blog).delete(handlers::blog::delete_blog))
        .route("/api/admin/blog-categories", get(handlers::blog_categories::list_blog_categories).post(handlers::blog_categories::create_blog_category))
        .route("/api/admin/blog-categories/:id", put(handlers::blog_categories::update_blog_category).delete(handlers::blog_categories::delete_blog_category))
        .route("/rss.xml", get(handlers::blog::rss_feed))
        .route("/sitemap.xml", get(handlers::blog::sitemap_xml))
        .route("/news.xml", get(handlers::news::news_rss_feed))
        .route("/api/news", get(handlers::news::list_news))
        .route("/api/news/:slug", get(handlers::news::get_news_by_slug))
        .route("/api/admin/news", get(handlers::news::admin_list_news).post(handlers::news::create_news))
        .route("/api/admin/news/:id", put(handlers::news::update_news).delete(handlers::news::delete_news))
        .route("/api/admin/news/by-slug/:slug", get(handlers::news::admin_get_news_by_slug))
        .route("/api/admin/products", get(handlers::product::admin_list_products).post(handlers::product::create_product))
        .route("/api/admin/products/:id", put(handlers::product::update_product).delete(handlers::product::delete_product))
        .route("/api/admin/news/export", get(handlers::news::admin_export_news))
        .route("/api/admin/logs", get(handlers::activity_logs::get_logs))
        .route("/api/admin/bulk-translate", post(handlers::translate::admin_bulk_translate))
        .route("/api/admin/translation-usage", get(handlers::activity_logs::get_translation_usage_stats))
        .route("/api/admin/courses/:id/typing", get(handlers::course_typing::get_course_typing_allotment).put(handlers::course_typing::set_course_typing_allotment))
        .route("/api/admin/purge/centers-students", post(handlers::maintenance::purge_centers_students))
        .route("/api/admin/purge/students", post(handlers::maintenance::purge_students))
        .route("/api/admin/maintenance/simulate-exam-flow", post(handlers::maintenance::simulate_exam_flow))
        .route("/api/admin/center-wallet/:centerId", get(handlers::center_wallet::admin_get_wallet).patch(handlers::center_wallet::admin_update_royalty))
        .route("/api/admin/center-wallet/add-funds", post(handlers::center_wallet::admin_add_funds))
        .route("/api/admin/center-wallet/transactions/:centerId", get(handlers::center_wallet::admin_list_transactions))
        .route("/api/admin/center-wallet/transactions/:txId/date", patch(handlers::center_wallet::admin_update_transaction_date))
        .route("/api/admin/center-wallet/bootstrap-from-fees", post(handlers::center_wallet::admin_bootstrap_wallets_from_fees))
        .route("/api/center/wallet", get(handlers::center_wallet::center_get_wallet))
        .route("/api/center/wallet/transactions", get(handlers::center_wallet::center_list_transactions))
        .route("/api/wallet/transactions/:txId/receipt", get(handlers::center_wallet::download_receipt_by_transaction_id))
        .route("/api/payments/create-order", post(handlers::payment::create_order))
        .route("/api/payments/verify", post(handlers::payment::verify_payment))
        .route("/api/templates", post(handlers::templates::create_template).get(handlers::templates::list_templates))
        .route("/api/templates/:id", get(handlers::templates::get_template).put(handlers::templates::update_template).delete(handlers::templates::delete_template))
        .route("/api/templates/:id/set-default", post(handlers::templates::set_default_design))
        .route("/api/templates/:id/fields", post(handlers::templates::create_field).get(handlers::templates::list_fields))
        .route(
            "/api/templates/:id/fields/:field_id",
            axum::routing::put(handlers::templates::update_field)
                .delete(handlers::templates::delete_field),
        )
        .route("/api/erp/students", get(handlers::erp::get_erp_students))
        .route(
            "/api/marksheets/:id/download",
            get(handlers::marksheets::download_marksheet),
        )
        .route("/api/marksheets", get(handlers::marksheets::list_marksheets))
        .route("/api/generate-certificates", post(handlers::generate_certificates::generate_certificates))
        .route("/api/id-cards", post(handlers::id_card::apply_id_cards).get(handlers::id_card::list_id_cards))
        .route("/api/batches", post(handlers::batch::handle_create_batch).get(handlers::batch::handle_get_batches))
        .route("/api/batches/:id", put(handlers::batch::handle_update_batch))
        .route("/api/batches/assign", post(handlers::batch::handle_assign_student))
        .route("/api/batch-students/assign", post(handlers::batch_student::assign_student_to_batch))
        .route("/api/batch-students/unassigned", get(handlers::batch_student::list_unassigned_center_students))
        .route("/api/batch-students/batch/:batch_id", get(handlers::batch_student::list_batch_students))
        .route("/api/batch-students/edit", post(handlers::batch_student::edit_student_batch))
        .route("/api/admin/id-cards/:id/approve", post(handlers::id_card::approve_id_card))
        .route("/api/coupons", post(handlers::coupon::create_coupon).get(handlers::coupon::list_coupons))
        .route("/api/coupons/:id", put(handlers::coupon::update_coupon).delete(handlers::coupon::delete_coupon))
        .route("/api/coupons/search-targets", get(handlers::coupon::search_coupon_targets))
        .route("/api/coupons/validate", get(handlers::coupon::validate_coupon))
        .route("/api/cms", get(handlers::cms::list_cms_items))
        .route("/api/admin/cms", post(handlers::cms::create_cms_item).put(handlers::cms::update_cms_item))
        .route("/api/admin/cms/:id", delete(handlers::cms::delete_cms_item).put(handlers::cms::update_cms_item))
        .route("/api/download-categories", get(handlers::cms::list_download_categories).post(handlers::cms::create_download_category))
        .route("/api/download-categories/:id", put(handlers::cms::update_download_category).delete(handlers::cms::delete_download_category))
        .route("/api/public/reviews", get(handlers::review::get_public_reviews))
        .route("/api/reviews", post(handlers::review::submit_review).get(handlers::review::get_all_reviews))
        .route("/api/reviews/:id", delete(handlers::review::delete_review))
        .route("/api/reviews/:id/:status", patch(handlers::review::update_review_status))
        .route("/api/document-requests", post(handlers::document_request::create_document_request).get(handlers::document_request::get_document_requests))
        .route("/api/document-requests/:id/status", patch(handlers::document_request::update_request_status))
        .route("/api/center-updates", post(handlers::center_update::request_center_update).get(handlers::center_update::list_center_update_requests))
        .route("/api/center-updates/:id/process", patch(handlers::center_update::process_center_update))
        .route("/api/center-updates/history/:center_id", get(handlers::center_update::get_update_history))
        .route("/api/uploads", post(handlers::upload::upload_file))
        .route("/api/referrals/validate", post(handlers::referral::validate_referral_code))
        .route("/api/referrals/my", get(handlers::referral::get_my_referrals))
        .route("/api/referrals/stats", get(handlers::referral::get_referral_stats))
        .route("/api/referrals/dashboard", get(handlers::referral::get_referral_dashboard))
        .route("/api/referrals/referred", get(handlers::referral::get_referred_users))
        .route("/api/referrals/transactions", get(handlers::referral::get_referral_transactions))
        .route("/api/referrals/withdrawal-method", get(handlers::referral::get_withdrawal_method).put(handlers::referral::update_withdrawal_method))
        .route("/api/referrals/withdraw", post(handlers::referral::request_withdrawal))
        .route("/api/admin/referrals", get(handlers::referral::get_all_referrals_admin))
        .route("/api/admin/referral-settings/:target_role", get(handlers::referral::get_referral_settings))
        .route("/api/admin/referral-settings", put(handlers::referral::update_referral_settings))
        .route("/api/interns", post(handlers::intern::handle_create_intern).get(handlers::intern::get_interns))
        .route("/api/interns/:id", get(handlers::intern::get_intern).put(handlers::intern::update_intern).delete(handlers::intern::delete_intern))
        .route("/api/interns/check-email", get(handlers::intern::check_intern_email_exists))
        .route("/api/interns/check-enrollment", get(handlers::intern::check_intern_enrollment_exists))
        .route("/api/interns/check-serial", get(handlers::intern::check_intern_serial_exists))
        .route("/api/intern-attendance", post(handlers::intern_attendance::mark_intern_attendance).get(handlers::intern_attendance::get_intern_attendance))
        .route("/api/intern-tasks", post(handlers::intern_task::create_intern_task).get(handlers::intern_task::get_intern_tasks))
        .route("/api/intern-tasks/:task_id", put(handlers::intern_task::update_intern_task).delete(handlers::intern_task::delete_intern_task))
        .route("/api/intern-tasks/for-intern/:intern_id", get(handlers::intern_task::get_intern_tasks_for_intern))
        .route("/api/intern-tasks/:task_id/status", patch(handlers::intern_task::update_intern_task_status))
        .route("/api/interns/progress", get(handlers::intern::get_intern_progress))
        .route("/api/interns/:id/progress", get(handlers::intern::get_single_intern_progress))
        .route("/api/library/books", get(handlers::library::get_books).post(handlers::library::create_book))
        .route("/api/library/admin/books", get(handlers::library::get_all_books_admin))
        .route("/api/library/books/:id", put(handlers::library::update_book).delete(handlers::library::delete_book))
        .route("/api/library/reading/heartbeat", post(handlers::library::record_heartbeat))
        .route("/api/library/reading/my-stats", get(handlers::library::get_my_reading_stats))
        .route("/api/internships", get(handlers::internship::get_internships).post(handlers::internship::create_internship))
        .route("/api/internships/all", get(handlers::internship::get_all_internships_admin))
        .route("/api/internships/:id", put(handlers::internship::update_internship).delete(handlers::internship::delete_internship))
        .route("/api/internships/:id/apply", post(handlers::internship::apply_internship))
        .route("/api/internships/my-applications", get(handlers::internship::get_my_applications))
        .route("/api/internships/:id/applications", get(handlers::internship::get_internship_applications))
        .route("/api/internships/applications/:app_id/status", put(handlers::internship::update_application_status))
        // --- PHASE 6: BIRTHDAYS ---
        .route("/api/birthdays/today", get(handlers::birthday::get_today_birthdays))
        .route("/api/birthdays/send-wish", post(handlers::birthday::send_birthday_wish))
        .route("/api/birthdays/my-wish", get(handlers::birthday::get_my_birthday_wish))
        // --- PHASE 6: SUPPORT TICKETS & QUERIES ---
        .route("/api/tickets", post(handlers::ticket::create_ticket).get(handlers::ticket::get_tickets))
        .route("/api/tickets/:id", get(handlers::ticket::get_ticket_details))
        .route("/api/tickets/:id/reply", post(handlers::ticket::reply_ticket))
        .route("/api/tickets/:id/status", put(handlers::ticket::update_ticket_status))
        // --- PHASE 6: DIGILOCKER & NAD GATEWAY ---
        .route("/api/public/digilocker/certificate/:cert_no", get(handlers::digilocker::get_digilocker_metadata))
        .route("/api/public/digilocker/certificate/:cert_no/xml", get(handlers::digilocker::get_digilocker_xml))
        // --- PHASE 7: AI STUDY ASSISTANT & DOUBT SOLVER ---
        .route("/api/ai/doubt-solver", post(handlers::ai_tutor::solve_doubt))
        // --- PHASE 7: NOTIFICATION GATEWAY (WHATSAPP & SMS) ---
        .route("/api/admin/notifications/config", get(handlers::notification_gateway::get_notification_config).post(handlers::notification_gateway::update_notification_config))
        .route("/api/admin/notifications/send-test", post(handlers::notification_gateway::send_test_notification))
        .route("/api/admin/notifications/logs", get(handlers::notification_gateway::get_notification_logs))
        // --- PHASE 7: DATABASE BACKUP & DIAGNOSTICS ---
        .route("/api/admin/system/diagnostics", get(handlers::system_backup::get_system_diagnostics))
        .route("/api/admin/system/backup", get(handlers::system_backup::export_system_backup))
        .nest_service("/uploads", ServeDir::new(std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string()))
            .precompressed_gzip()
            .precompressed_br())
        .with_state(AppState { client, db: db.clone() })
        // Default axum limit (~2MiB) breaks multipart uploads and large JSON; raise for uploads/admin saves.
        .layer(DefaultBodyLimit::max(64 * 1024 * 1024))
        // Enterprise default-deny auth: all /api/* are protected unless explicitly allowlisted.
        .layer(axum::middleware::from_fn(
            middleware::auth_middleware::auth_middleware,
        ))
        // NOTE: layer order = onion layers. Last .layer() = outermost = runs FIRST on requests.
        // We MUST strip Accept-Encoding BEFORE CompressionLayer reads it, so strip is listed
        // AFTER CompressionLayer (= outer layer, runs first on request).
        .layer(CompressionLayer::new())
        .layer(axum::middleware::from_fn(
            strip_accept_encoding_for_downloads,
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::HeaderName::from_static("strict-transport-security"),
            HeaderValue::from_static("max-age=31536000; includeSubDomains"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::HeaderName::from_static("x-content-type-options"),
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::HeaderName::from_static("x-frame-options"),
            HeaderValue::from_static("SAMEORIGIN"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::HeaderName::from_static("referrer-policy"),
            HeaderValue::from_static("strict-origin-when-cross-origin"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::HeaderName::from_static("permissions-policy"),
            HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::HeaderName::from_static("content-security-policy"),
            HeaderValue::from_static(
                "default-src 'self'; script-src 'self' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://screduc.com; frame-src 'self' https://www.google.com",
            ),
        ))
        .layer(
            CorsLayer::permissive(),
        )
        .fallback(|| async {
            (StatusCode::NOT_FOUND, Json(json!({"success":false, "message":"Not Found"})))
        });

    let port = std::env::var("PORT").unwrap_or_else(|_| "3002".to_string());
    let addr: SocketAddr = format!("0.0.0.0:{}", port).parse().unwrap();
    println!("listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
