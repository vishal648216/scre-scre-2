use crate::models::qb::{Question, QuestionBank};
use crate::models::user::{Claims, UserRole};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use futures_util::StreamExt;
use mongodb::{
    Database,
    bson::{DateTime, doc, oid::ObjectId},
    options::FindOptions,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct QbMsg {
    pub success: bool,
    pub message: String,
}

fn admin_ok(role: &UserRole) -> bool {
    matches!(
        role,
        UserRole::Admin | UserRole::SuperAdmin | UserRole::Center | UserRole::Staff
    )
}

fn clean_bson_doc_to_json(doc: &mongodb::bson::Document) -> serde_json::Value {
    let mut json_val = serde_json::to_value(doc).unwrap_or_default();
    if let Some(obj) = json_val.as_object_mut() {
        let keys: Vec<String> = obj.keys().cloned().collect();
        for key in keys {
            if let Some(val) = obj.get(&key) {
                if let Some(oid_str) = val.get("$oid").and_then(|v| v.as_str()) {
                    obj.insert(key, serde_json::Value::String(oid_str.to_string()));
                }
            }
        }
    }
    json_val
}

fn extract_oid(doc: &mongodb::bson::Document, key: &str) -> Option<ObjectId> {
    if let Ok(oid) = doc.get_object_id(key) {
        return Some(oid);
    }
    if let Ok(s) = doc.get_str(key) {
        if let Ok(oid) = ObjectId::parse_str(s.trim()) {
            return Some(oid);
        }
    }
    if let Ok(sub_doc) = doc.get_document(key) {
        if let Ok(s) = sub_doc.get_str("$oid") {
            if let Ok(oid) = ObjectId::parse_str(s.trim()) {
                return Some(oid);
            }
        }
    }
    None
}

// --- Bank Handlers ---

pub async fn list_banks(
    State(db): State<Database>,
    _claims: Claims,
) -> (StatusCode, Json<Vec<serde_json::Value>>) {
    let coll = db.collection::<mongodb::bson::Document>("qb_banks");
    let find_opts = FindOptions::builder()
        .sort(doc! { "created_at": -1 })
        .build();
    let mut cur = match coll.find(None, find_opts).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };
    let mut v = Vec::new();
    while let Some(res) = cur.next().await {
        if let Ok(mut doc) = res {
            // Get the bank's _id
            if let Some(bank_oid) = doc.get_object_id("_id").ok() {
                let bank_hex = bank_oid.to_hex();
                // Count the number of questions for this bank (handling ObjectId or String)
                let q_coll = db.collection::<mongodb::bson::Document>("qb_questions");
                let count = match q_coll
                    .count_documents(
                        doc! {
                            "$or": [
                                { "bank_id": bank_oid },
                                { "bank_id": &bank_hex }
                            ]
                        },
                        None,
                    )
                    .await
                {
                    Ok(c) => c as i64,
                    Err(_) => 0,
                };
                doc.insert("question_count", count);
            }

            let mut json_val = serde_json::to_value(&doc).unwrap();
            // Critical: Force ID to string
            if let Some(obj) = json_val.as_object_mut() {
                // Process _id
                if let Some(id_val) = obj.get("_id") {
                    if let Some(oid_str) = id_val.get("$oid").and_then(|v| v.as_str()) {
                        obj.insert(
                            "_id".to_string(),
                            serde_json::Value::String(oid_str.to_string()),
                        );
                    } else if let Some(oid_str) = id_val.as_str() {
                        obj.insert(
                            "_id".to_string(),
                            serde_json::Value::String(oid_str.to_string()),
                        );
                    }
                }
                // Process category_id, course_id, subject_id
                for field in &["category_id", "course_id", "subject_id"] {
                    if let Some(val) = obj.get(*field) {
                        if let Some(oid_str) = val.get("$oid").and_then(|v| v.as_str()) {
                            obj.insert(
                                field.to_string(),
                                serde_json::Value::String(oid_str.to_string()),
                            );
                        } else if let Some(oid_str) = val.as_str() {
                            obj.insert(
                                field.to_string(),
                                serde_json::Value::String(oid_str.to_string()),
                            );
                        }
                    }
                }
            }
            v.push(json_val);
        }
    }
    (StatusCode::OK, Json(v))
}

#[derive(Debug, Deserialize)]
pub struct CreateBankPayload {
    pub name: String,
    pub target_question_count: Option<i32>,
    pub category_id: Option<String>,
    pub course_id: Option<String>,
    pub subject_id: Option<String>,
}

pub async fn create_bank(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateBankPayload>,
) -> (StatusCode, Json<QbMsg>) {
    if !admin_ok(&claims.role) {
        return (
            StatusCode::FORBIDDEN,
            Json(QbMsg {
                success: false,
                message: "Unauthorized".into(),
            }),
        );
    }
    let coll = db.collection::<mongodb::bson::Document>("qb_banks");
    let mut new_bank = doc! {
        "name": payload.name,
        "target_question_count": payload.target_question_count,
        "created_at": DateTime::now(),
    };
    if let Some(cat_id) = payload.category_id {
        if let Ok(oid) = ObjectId::parse_str(&cat_id) {
            new_bank.insert("category_id", oid);
        }
    }
    if let Some(course_id) = payload.course_id {
        if let Ok(oid) = ObjectId::parse_str(&course_id) {
            new_bank.insert("course_id", oid);
        }
    }
    if let Some(sub_id) = payload.subject_id {
        if let Ok(oid) = ObjectId::parse_str(&sub_id) {
            new_bank.insert("subject_id", oid);
        }
    }
    match coll.insert_one(new_bank, None).await {
        Ok(_) => (
            StatusCode::CREATED,
            Json(QbMsg {
                success: true,
                message: "Bank created".into(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(QbMsg {
                success: false,
                message: "Failed to create bank".into(),
            }),
        ),
    }
}

#[derive(Debug, Deserialize)]
pub struct UpdateBankPayload {
    pub name: Option<String>,
    pub target_question_count: Option<i32>,
    pub category_id: Option<String>,
    pub course_id: Option<String>,
    pub subject_id: Option<String>,
}

pub async fn update_bank(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<UpdateBankPayload>,
) -> (StatusCode, Json<QbMsg>) {
    if !admin_ok(&claims.role) {
        return (
            StatusCode::FORBIDDEN,
            Json(QbMsg {
                success: false,
                message: "Unauthorized".into(),
            }),
        );
    }
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(QbMsg {
                    success: false,
                    message: "Invalid ID".into(),
                }),
            );
        }
    };
    let coll = db.collection::<mongodb::bson::Document>("qb_banks");
    let mut update_doc = doc! {};
    if let Some(name) = payload.name {
        update_doc.insert("name", name);
    }
    if let Some(tqc) = payload.target_question_count {
        update_doc.insert("target_question_count", tqc);
    }
    if let Some(cat_id) = payload.category_id {
        if let Ok(oid) = ObjectId::parse_str(&cat_id) {
            update_doc.insert("category_id", oid);
        }
    } else {
        update_doc.insert("category_id", mongodb::bson::Bson::Null);
    }
    if let Some(course_id) = payload.course_id {
        if let Ok(oid) = ObjectId::parse_str(&course_id) {
            update_doc.insert("course_id", oid);
        }
    } else {
        update_doc.insert("course_id", mongodb::bson::Bson::Null);
    }
    if let Some(sub_id) = payload.subject_id {
        if let Ok(oid) = ObjectId::parse_str(&sub_id) {
            update_doc.insert("subject_id", oid);
        }
    } else {
        update_doc.insert("subject_id", mongodb::bson::Bson::Null);
    }
    match coll
        .update_one(doc! { "_id": oid }, doc! { "$set": update_doc }, None)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(QbMsg {
                success: true,
                message: "Bank updated".into(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(QbMsg {
                success: false,
                message: "Failed to update bank".into(),
            }),
        ),
    }
}

pub async fn delete_bank(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<QbMsg>) {
    if !admin_ok(&claims.role) {
        return (
            StatusCode::FORBIDDEN,
            Json(QbMsg {
                success: false,
                message: "Unauthorized".into(),
            }),
        );
    }
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(QbMsg {
                    success: false,
                    message: "Invalid ID".into(),
                }),
            );
        }
    };

    let bank_coll = db.collection::<mongodb::bson::Document>("qb_banks");
    match bank_coll.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => {
            let q_coll = db.collection::<mongodb::bson::Document>("qb_questions");
            let _ = q_coll.delete_many(doc! { "bank_id": oid }, None).await;
            (
                StatusCode::OK,
                Json(QbMsg {
                    success: true,
                    message: "Bank deleted".into(),
                }),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(QbMsg {
                success: false,
                message: "Failed to delete bank".into(),
            }),
        ),
    }
}

// --- Question Handlers ---

pub async fn list_bank_questions(
    State(db): State<Database>,
    _claims: Claims,
    Path(bank_id): Path<String>,
) -> (StatusCode, Json<Vec<serde_json::Value>>) {
    let bank_str = bank_id.trim().to_string();
    let filter = if let Ok(bid) = ObjectId::parse_str(&bank_str) {
        doc! {
            "$or": [
                { "bank_id": bid },
                { "bank_id": &bank_str }
            ]
        }
    } else {
        doc! { "bank_id": &bank_str }
    };

    let coll = db.collection::<mongodb::bson::Document>("qb_questions");
    let find_opts = FindOptions::builder()
        .sort(doc! { "created_at": 1 })
        .build();
    let mut cur = match coll.find(filter, find_opts).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };
    let mut v = Vec::new();
    while let Some(res) = cur.next().await {
        if let Ok(doc) = res {
            v.push(clean_bson_doc_to_json(&doc));
        }
    }
    (StatusCode::OK, Json(v))
}

pub async fn get_question(
    State(db): State<Database>,
    _claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "message": "Invalid ID" })),
            );
        }
    };
    let coll = db.collection::<mongodb::bson::Document>("qb_questions");
    match coll.find_one(doc! { "_id": oid }, None).await {
        Ok(Some(doc)) => (StatusCode::OK, Json(clean_bson_doc_to_json(&doc))),
        _ => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "message": "Not found" })),
        ),
    }
}

pub async fn create_question(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<serde_json::Value>,
) -> (StatusCode, Json<QbMsg>) {
    if !admin_ok(&claims.role) {
        return (
            StatusCode::FORBIDDEN,
            Json(QbMsg {
                success: false,
                message: "Unauthorized".into(),
            }),
        );
    }

    let mut doc = match mongodb::bson::to_document(&payload) {
        Ok(d) => d,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(QbMsg {
                    success: false,
                    message: "Invalid data".into(),
                }),
            );
        }
    };

    if let Some(bid) = extract_oid(&doc, "bank_id") {
        doc.insert("bank_id", bid);
    } else if let Ok(s) = doc.get_str("bank_id") {
        let trimmed = s.trim().to_string();
        if !trimmed.is_empty() {
            doc.insert("bank_id", trimmed);
        } else {
            return (
                StatusCode::BAD_REQUEST,
                Json(QbMsg {
                    success: false,
                    message: "Missing bank_id".into(),
                }),
            );
        }
    }

    doc.remove("_id");
    doc.insert("created_at", DateTime::now());

    let coll = db.collection::<mongodb::bson::Document>("qb_questions");
    match coll.insert_one(doc, None).await {
        Ok(_) => (
            StatusCode::CREATED,
            Json(QbMsg {
                success: true,
                message: "Question created".into(),
            }),
        ),
        Err(e) => {
            eprintln!("Question create error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(QbMsg {
                    success: false,
                    message: format!("Failed to create question: {}", e),
                }),
            )
        }
    }
}

pub async fn update_question(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
    Json(payload): Json<serde_json::Value>,
) -> (StatusCode, Json<QbMsg>) {
    if !admin_ok(&claims.role) {
        return (
            StatusCode::FORBIDDEN,
            Json(QbMsg {
                success: false,
                message: "Unauthorized".into(),
            }),
        );
    }
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(QbMsg {
                    success: false,
                    message: "Invalid ID".into(),
                }),
            );
        }
    };

    let mut doc = match mongodb::bson::to_document(&payload) {
        Ok(d) => d,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(QbMsg {
                    success: false,
                    message: "Invalid data".into(),
                }),
            );
        }
    };

    if let Some(bid) = extract_oid(&doc, "bank_id") {
        doc.insert("bank_id", bid);
    }

    doc.remove("_id");
    let coll = db.collection::<mongodb::bson::Document>("qb_questions");
    match coll
        .update_one(doc! { "_id": oid }, doc! { "$set": doc }, None)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(QbMsg {
                success: true,
                message: "Question updated".into(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(QbMsg {
                success: false,
                message: "Failed".into(),
            }),
        ),
    }
}

pub async fn delete_question(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<QbMsg>) {
    if !admin_ok(&claims.role) {
        return (
            StatusCode::FORBIDDEN,
            Json(QbMsg {
                success: false,
                message: "Unauthorized".into(),
            }),
        );
    }
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(QbMsg {
                    success: false,
                    message: "Invalid ID".into(),
                }),
            );
        }
    };
    let coll = db.collection::<mongodb::bson::Document>("qb_questions");
    match coll.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => (
            StatusCode::OK,
            Json(QbMsg {
                success: true,
                message: "Question deleted".into(),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(QbMsg {
                success: false,
                message: "Failed".into(),
            }),
        ),
    }
}

#[derive(Debug, Deserialize)]
pub struct BulkItemsPayload {
    pub bank_id: Option<String>,
    pub items: Vec<serde_json::Value>,
}

pub async fn bulk_create_questions(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<BulkItemsPayload>,
) -> (StatusCode, Json<QbMsg>) {
    if claims.role != UserRole::Admin
        && claims.role != UserRole::SuperAdmin
        && claims.role != UserRole::Center
    {
        return (
            StatusCode::FORBIDDEN,
            Json(QbMsg {
                success: false,
                message: "Unauthorized".into(),
            }),
        );
    }

    let coll = db.collection::<mongodb::bson::Document>("qb_questions");
    let bank_coll = db.collection::<mongodb::bson::Document>("qb_banks");
    let mut docs = Vec::new();
    let now = DateTime::now();

    let global_bank_oid = payload
        .bank_id
        .as_ref()
        .and_then(|s| ObjectId::parse_str(s.trim()).ok());

    for mut item in payload.items {
        if let Some(obj) = item.as_object_mut() {
            let q_text = obj
                .get("question_text")
                .or_else(|| obj.get("question"))
                .or_else(|| obj.get("question_name"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim()
                .to_string();

            if q_text.is_empty() {
                continue;
            }

            let opt_a = obj
                .get("option_a")
                .or_else(|| obj.get("option1"))
                .or_else(|| obj.get("option_1"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim()
                .to_string();
            let opt_b = obj
                .get("option_b")
                .or_else(|| obj.get("option2"))
                .or_else(|| obj.get("option_2"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim()
                .to_string();
            let opt_c = obj
                .get("option_c")
                .or_else(|| obj.get("option3"))
                .or_else(|| obj.get("option_3"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim()
                .to_string();
            let opt_d = obj
                .get("option_d")
                .or_else(|| obj.get("option4"))
                .or_else(|| obj.get("option_4"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim()
                .to_string();

            let raw_correct = obj
                .get("correct_option")
                .or_else(|| obj.get("correct_answer"))
                .or_else(|| obj.get("answer"))
                .and_then(|v| v.as_str())
                .unwrap_or("a")
                .trim()
                .to_lowercase();

            let correct = match raw_correct.as_str() {
                "a" | "option a" | "option_a" | "1" => "a".to_string(),
                "b" | "option b" | "option_b" | "2" => "b".to_string(),
                "c" | "option c" | "option_c" | "3" => "c".to_string(),
                "d" | "option d" | "option_d" | "4" => "d".to_string(),
                _ => "a".to_string(),
            };

            let diff = obj
                .get("difficulty")
                .and_then(|v| v.as_str())
                .unwrap_or("medium")
                .trim()
                .to_string();

            let marks_num: i32 = obj
                .get("marks")
                .and_then(|v| {
                    v.as_str()
                        .and_then(|s| s.parse().ok())
                        .or_else(|| v.as_i64().map(|n| n as i32))
                })
                .unwrap_or(1);

            let explanation = obj
                .get("explanation")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let correct_idx = match correct.as_str() {
                "a" => 0,
                "b" => 1,
                "c" => 2,
                "d" => 3,
                _ => 0,
            };

            let mut options_strings = vec![];
            let mut options_formatted = vec![];
            if !opt_a.is_empty() {
                options_strings.push(opt_a.clone());
                options_formatted.push(doc! { "key": "a", "text": opt_a });
            }
            if !opt_b.is_empty() {
                options_strings.push(opt_b.clone());
                options_formatted.push(doc! { "key": "b", "text": opt_b });
            }
            if !opt_c.is_empty() {
                options_strings.push(opt_c.clone());
                options_formatted.push(doc! { "key": "c", "text": opt_c });
            }
            if !opt_d.is_empty() {
                options_strings.push(opt_d.clone());
                options_formatted.push(doc! { "key": "d", "text": opt_d });
            }

            let bank_id_str = obj
                .get("bank_id")
                .or_else(|| obj.get("bank"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim();
            let mut bank_oid = ObjectId::parse_str(bank_id_str).ok().or(global_bank_oid);

            if bank_oid.is_none() && !bank_id_str.is_empty() {
                if let Ok(Some(b)) = bank_coll
                    .find_one(
                        doc! { "name": { "$regex": bank_id_str, "$options": "i" } },
                        None,
                    )
                    .await
                {
                    bank_oid = b.get_object_id("_id").ok();
                }
            }

            if bank_oid.is_none() {
                if let Ok(Some(b)) = bank_coll.find_one(doc! {}, None).await {
                    bank_oid = b.get_object_id("_id").ok();
                }
            }

            let mut d = doc! {
                "question_text": q_text,
                "options": options_strings,
                "formatted_options": options_formatted,
                "correct_option": correct,
                "correct_option_index": correct_idx,
                "difficulty": diff.to_lowercase(),
                "marks": marks_num,
                "explanation": explanation,
                "created_at": now,
            };
            if let Some(boid) = bank_oid {
                d.insert("bank_id", boid);
            } else if !bank_id_str.is_empty() {
                d.insert("bank_id", bank_id_str);
            }
            docs.push(d);
        }
    }

    if docs.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(QbMsg {
                success: false,
                message: "No valid questions provided".into(),
            }),
        );
    }

    let count = docs.len();
    match coll.insert_many(docs, None).await {
        Ok(_) => (
            StatusCode::CREATED,
            Json(QbMsg {
                success: true,
                message: format!("Successfully imported {} questions!", count),
            }),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(QbMsg {
                success: false,
                message: format!("Failed bulk insert: {}", e),
            }),
        ),
    }
}

