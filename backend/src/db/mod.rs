use dotenvy::dotenv;
use futures_util::StreamExt;
use mongodb::IndexModel;
use mongodb::bson::doc;
use mongodb::options::DropIndexOptions;
use mongodb::options::FindOneAndUpdateOptions;
use mongodb::options::IndexOptions;
use mongodb::options::ReturnDocument;
use mongodb::{Client, Database};
use std::env;

pub async fn connect_db() -> (Client, Database) {
    dotenv().ok();
    let database_name = env::var("DATABASE_NAME").unwrap_or("scre_db".to_string());
    let primary_uri = env::var("MONGO_URI")
        .or_else(|_| env::var("MONGODB_URI"))
        .unwrap_or("mongodb://localhost:27017".to_string());
    let fallback_uri = "mongodb://localhost:27017";

    // Function to always set retryWrites=false in URI
    let set_retry_writes_false = |uri: &str| -> String {
        // Remove any existing retryWrites parameter
        let uri_without_retry = if uri.contains("retryWrites=") {
            // Split into parts
            if let Some(query_start) = uri.find('?') {
                let base = &uri[0..query_start];
                let query = &uri[query_start+1..];
                let params: Vec<&str> = query.split('&').filter(|p| !p.starts_with("retryWrites=")).collect();
                if params.is_empty() {
                    base.to_string()
                } else {
                    format!("{}?{}", base, params.join("&"))
                }
            } else {
                uri.to_string()
            }
        } else {
            uri.to_string()
        };

        // Now add retryWrites=false
        if uri_without_retry.contains('?') {
            format!("{}&retryWrites=false", uri_without_retry)
        } else {
            format!("{}?retryWrites=false", uri_without_retry)
        }
    };

    let primary_uri_with_retry = set_retry_writes_false(&primary_uri);
    let fallback_uri_with_retry = set_retry_writes_false(fallback_uri);

    // First try to connect with MONGODB_URI
    match Client::with_uri_str(&primary_uri_with_retry).await {
        Ok(client) => {
            // Actually test the connection by listing database names
            match client.list_database_names(None, None).await {
                Ok(_) => {
                    println!(
                        "DEBUG: Successfully connected to MongoDB at {} / DB: {}",
                        primary_uri_with_retry, database_name
                    );
                    return (client.clone(), client.database(&database_name));
                }
                Err(e) => {
                    eprintln!(
                        "WARNING: Failed to connect to MongoDB at {}: {}",
                        primary_uri_with_retry, e
                    );
                    eprintln!("INFO: Falling back to MongoDB at localhost:27017");
                    // Fall through to fallback
                }
            }
        }
        Err(e) => {
            eprintln!(
                "WARNING: Failed to create MongoDB client for {}: {}",
                primary_uri_with_retry, e
            );
            eprintln!("INFO: Falling back to MongoDB at localhost:27017");
        }
    }

    // Fallback to localhost
    let client = Client::with_uri_str(&fallback_uri_with_retry)
        .await
        .expect("Failed to connect to MongoDB at localhost:27017");
    // Test the fallback connection too
    client
        .list_database_names(None, None)
        .await
        .expect("Failed to verify localhost MongoDB connection");
    println!(
        "DEBUG: Successfully connected to MongoDB at {} / DB: {}",
        fallback_uri_with_retry, database_name
    );
    (client.clone(), client.database(&database_name))
}

pub async fn get_next_sequence(db: &Database, sequence_name: &str) -> i64 {
    let counters = db.collection::<mongodb::bson::Document>("counters");
    let filter = doc! { "_id": sequence_name };
    let update = doc! { "$inc": { "seq": 1 } };
    let options = FindOneAndUpdateOptions::builder()
        .upsert(true)
        .return_document(ReturnDocument::After)
        .build();

    match counters.find_one_and_update(filter, update, options).await {
        Ok(Some(doc)) => {
            // Try to get as i64, fallback to i32 if needed
            if let Ok(seq) = doc.get_i64("seq") {
                seq
            } else if let Ok(seq) = doc.get_i32("seq") {
                seq as i64
            } else {
                1
            }
        }
        _ => 1,
    }
}

pub async fn ensure_indexes(db: &Database) {
    let users = db.collection::<mongodb::bson::Document>("users");
    if let Ok(mut cursor) = users.list_indexes(None).await {
        while let Some(Ok(model)) = cursor.next().await {
            let IndexModel { options, .. } = model;
            if let Some(opts) = options {
                if opts.expire_after.is_some() {
                    let name = opts.name.unwrap_or_else(|| "ttl_index".to_string());
                    let _ = users
                        .drop_index(name, Some(DropIndexOptions::builder().build()))
                        .await;
                }
            }
        }
    }

    // Center wallet: one wallet per center
    let wallets = db.collection::<mongodb::bson::Document>("center_wallet");
    let _ = wallets
        .create_index(
            IndexModel::builder()
                .keys(doc! { "center_id": 1 })
                .options(
                    IndexOptions::builder()
                        .name("center_wallet_center_id_unique".to_string())
                        .unique(true)
                        .build(),
                )
                .build(),
            None,
        )
        .await;

    // Wallet transactions: fast history lookup & unique transaction_id
    let tx = db.collection::<mongodb::bson::Document>("wallet_transactions");
    let _ = tx
        .create_index(
            IndexModel::builder()
                .keys(doc! { "center_id": 1, "created_at": -1 })
                .options(
                    IndexOptions::builder()
                        .name("wallet_tx_center_date".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;
    let _ = tx
        .create_index(
            IndexModel::builder()
                .keys(doc! { "transaction_id": 1 })
                .options(
                    IndexOptions::builder()
                        .name("wallet_tx_transaction_id_unique".to_string())
                        .unique(true)
                        .build(),
                )
                .build(),
            None,
        )
        .await;

    // Enquiries: fast lookup by phone/email/status/date
    let enquiries = db.collection::<mongodb::bson::Document>("enquiries");
    let _ = enquiries
        .create_index(
            IndexModel::builder()
                .keys(doc! { "phone": 1 })
                .options(
                    IndexOptions::builder()
                        .name("enquiry_phone".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;
    let _ = enquiries
        .create_index(
            IndexModel::builder()
                .keys(doc! { "status": 1 })
                .options(
                    IndexOptions::builder()
                        .name("enquiry_status".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;
    let _ = enquiries
        .create_index(
            IndexModel::builder()
                .keys(doc! { "created_at": -1 })
                .options(
                    IndexOptions::builder()
                        .name("enquiry_created_at".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;

    // Users: fast login by username/email and role lookup
    let users_coll = db.collection::<mongodb::bson::Document>("users");
    let _ = users_coll
        .create_index(
            IndexModel::builder()
                .keys(doc! { "username": 1 })
                .options(
                    IndexOptions::builder()
                        .name("user_username_unique".to_string())
                        .unique(true)
                        .build(),
                )
                .build(),
            None,
        )
        .await;
    let _ = users_coll
        .create_index(
            IndexModel::builder()
                .keys(doc! { "email": 1 })
                .options(
                    IndexOptions::builder()
                        .name("user_email".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;
    let _ = users_coll
        .create_index(
            IndexModel::builder()
                .keys(doc! { "role": 1 })
                .options(
                    IndexOptions::builder()
                        .name("user_role".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;
    let _ = users_coll
        .create_index(
            IndexModel::builder()
                .keys(doc! { "parent_id": 1 })
                .options(
                    IndexOptions::builder()
                        .name("user_parent".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;

    // Courses: fast lookup by code/name
    let courses_coll = db.collection::<mongodb::bson::Document>("courses");
    let _ = courses_coll
        .create_index(
            IndexModel::builder()
                .keys(doc! { "course_code": 1 })
                .options(
                    IndexOptions::builder()
                        .name("course_code_unique".to_string())
                        .unique(true)
                        .build(),
                )
                .build(),
            None,
        )
        .await;
    let _ = courses_coll
        .create_index(
            IndexModel::builder()
                .keys(doc! { "slug": 1 })
                .options(
                    IndexOptions::builder()
                        .name("course_slug_unique".to_string())
                        .unique(true)
                        .build(),
                )
                .build(),
            None,
        )
        .await;
    let _ = courses_coll
        .create_index(
            IndexModel::builder()
                .keys(doc! { "course_name": 1 })
                .options(
                    IndexOptions::builder()
                        .name("course_name".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;

    // Attendance: fast history lookup
    let attendance_coll = db.collection::<mongodb::bson::Document>("attendance");
    let _ = attendance_coll
        .create_index(
            IndexModel::builder()
                .keys(doc! { "student_id": 1, "date": -1 })
                .options(
                    IndexOptions::builder()
                        .name("attendance_student_date".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;

    // Certificates: fast verification lookup
    let certs_coll = db.collection::<mongodb::bson::Document>("certificates");
    let _ = certs_coll
        .create_index(
            IndexModel::builder()
                .keys(doc! { "certificate_no": 1 })
                .options(
                    IndexOptions::builder()
                        .name("cert_no_unique".to_string())
                        .unique(true)
                        .build(),
                )
                .build(),
            None,
        )
        .await;
    let _ = certs_coll
        .create_index(
            IndexModel::builder()
                .keys(doc! { "student_id": 1 })
                .options(
                    IndexOptions::builder()
                        .name("cert_student".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;

    // Translations: unique content_key + lang, fast lookups
    let translations = db.collection::<mongodb::bson::Document>("translations");
    let _ = translations
        .create_index(
            IndexModel::builder()
                .keys(doc! { "content_key": 1, "lang": 1 })
                .options(
                    IndexOptions::builder()
                        .name("translation_key_lang_unique".to_string())
                        .unique(true)
                        .build(),
                )
                .build(),
            None,
        )
        .await;

    // Question Banks: fast lookup by name
    let qb_banks = db.collection::<mongodb::bson::Document>("qb_banks");
    let _ = qb_banks
        .create_index(
            IndexModel::builder()
                .keys(doc! { "name": 1 })
                .options(
                    IndexOptions::builder()
                        .name("qb_bank_name".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;

    // Questions: fast lookup by bank, marks, and text search
    let qb_questions = db.collection::<mongodb::bson::Document>("qb_questions");
    let _ = qb_questions
        .create_index(
            IndexModel::builder()
                .keys(doc! { "bank_id": 1, "marks": 1 })
                .options(
                    IndexOptions::builder()
                        .name("question_bank_marks".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;
    let _ = qb_questions
        .create_index(
            IndexModel::builder()
                .keys(doc! { "question_text": "text" })
                .options(
                    IndexOptions::builder()
                        .name("question_text_search".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;

    // Exam Blueprints: fast lookup by course and bank
    let exam_blueprints = db.collection::<mongodb::bson::Document>("exam_blueprints");
    let _ = exam_blueprints
        .create_index(
            IndexModel::builder()
                .keys(doc! { "course_id": 1, "bank_id": 1 })
                .options(
                    IndexOptions::builder()
                        .name("blueprint_course_bank".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;

    // Exam Papers/Attempts: fast student lookup
    let student_papers = db.collection::<mongodb::bson::Document>("student_papers");
    let _ = student_papers
        .create_index(
            IndexModel::builder()
                .keys(doc! { "student_id": 1, "exam_id": 1 })
                .options(
                    IndexOptions::builder()
                        .name("student_exam_lookup".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;
    let _ = student_papers
        .create_index(
            IndexModel::builder()
                .keys(doc! { "created_at": -1 })
                .options(
                    IndexOptions::builder()
                        .name("paper_created_at".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;
    let _ = translations
        .create_index(
            IndexModel::builder()
                .keys(doc! { "content_key": 1, "lang": 1 })
                .options(
                    IndexOptions::builder()
                        .name("translation_key_lang_unique".to_string())
                        .unique(true)
                        .build(),
                )
                .build(),
            None,
        )
        .await;
    let _ = translations
        .create_index(
            IndexModel::builder()
                .keys(doc! { "updated_at": -1 })
                .options(
                    IndexOptions::builder()
                        .name("translation_updated_at".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;

    // Translation content registry
    let sources = db.collection::<mongodb::bson::Document>("translation_sources");
    let _ = sources
        .create_index(
            IndexModel::builder()
                .keys(doc! { "content_key": 1 })
                .options(
                    IndexOptions::builder()
                        .name("translation_source_content_key_unique".to_string())
                        .unique(true)
                        .build(),
                )
                .build(),
            None,
        )
        .await;

    // Usage logs for observability
    let usage = db.collection::<mongodb::bson::Document>("translation_usage_logs");
    let _ = usage
        .create_index(
            IndexModel::builder()
                .keys(doc! { "created_at": -1 })
                .options(
                    IndexOptions::builder()
                        .name("translation_usage_created_at".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;

    // Exam Engine V2
    let exam_v2_papers = db.collection::<mongodb::bson::Document>("exam_v2_papers");
    let _ = exam_v2_papers
        .create_index(
            IndexModel::builder()
                .keys(doc! { "exam_id": 1, "student_id": 1, "attempt_number": 1 })
                .options(
                    IndexOptions::builder()
                        .name("exam_v2_paper_attempt".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;

    let exam_v2_q = db.collection::<mongodb::bson::Document>("exam_v2_questions");
    let _ = exam_v2_q
        .create_index(
            IndexModel::builder()
                .keys(doc! { "question_bank_id": 1, "is_latest": 1, "status": 1 })
                .options(
                    IndexOptions::builder()
                        .name("exam_v2_q_bank_latest_status".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;
    let _ = exam_v2_q
        .create_index(
            IndexModel::builder()
                .keys(doc! { "tags": 1 })
                .options(
                    IndexOptions::builder()
                        .name("exam_v2_q_tags".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;
    let _ = exam_v2_q
        .create_index(
            IndexModel::builder()
                .keys(doc! { "subject_id": 1 })
                .options(
                    IndexOptions::builder()
                        .name("exam_v2_q_subject".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;

    let exam_v2_tags = db.collection::<mongodb::bson::Document>("exam_v2_tags");
    let _ = exam_v2_tags
        .create_index(
            IndexModel::builder()
                .keys(doc! { "name": 1 })
                .options(
                    IndexOptions::builder()
                        .name("exam_v2_tag_name_unique".to_string())
                        .unique(true)
                        .build(),
                )
                .build(),
            None,
        )
        .await;

    let exam_v2_versions = db.collection::<mongodb::bson::Document>("exam_v2_question_versions");
    let _ = exam_v2_versions
        .create_index(
            IndexModel::builder()
                .keys(doc! { "question_id": 1, "version": -1 })
                .options(
                    IndexOptions::builder()
                        .name("exam_v2_v_q_version".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;

    // CMS Items: fast lookup by category and active status
    let cms_items = db.collection::<mongodb::bson::Document>("cms_items");
    let _ = cms_items
        .create_index(
            IndexModel::builder()
                .keys(doc! { "category": 1, "active": 1, "order": 1 })
                .options(
                    IndexOptions::builder()
                        .name("cms_category_active_order".to_string())
                        .build(),
                )
                .build(),
            None,
        )
        .await;

    // Centers: unique center code
    let centers = db.collection::<mongodb::bson::Document>("centers");
    let _ = centers
        .create_index(
            IndexModel::builder()
                .keys(doc! { "code": 1 })
                .options(
                    IndexOptions::builder()
                        .name("center_code_unique".to_string())
                        .unique(true)
                        .build(),
                )
                .build(),
            None,
        )
        .await;

    // Users: unique serial number and enrollment number
    let users = db.collection::<mongodb::bson::Document>("users");
    let _ = users
        .create_index(
            IndexModel::builder()
                .keys(doc! { "serial_number": 1 })
                .options(
                    IndexOptions::builder()
                        .name("user_serial_number_unique".to_string())
                        .unique(true)
                        .build(),
                )
                .build(),
            None,
        )
        .await;
    let _ = users
        .create_index(
            IndexModel::builder()
                .keys(doc! { "enrollment_number": 1 })
                .options(
                    IndexOptions::builder()
                        .name("user_enrollment_number_unique".to_string())
                        .unique(true)
                        .build(),
                )
                .build(),
            None,
        )
        .await;
}
