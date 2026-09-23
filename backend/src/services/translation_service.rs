use futures::stream::{FuturesUnordered, StreamExt};
use mongodb::{
    bson::{doc, DateTime as BsonDateTime},
    options::UpdateOptions,
    Database,
};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    sync::{Arc, OnceLock, RwLock},
    time::Duration,
};
use tokio::sync::Mutex;

use crate::config::languages::get_supported_languages;
use crate::config::translation::TranslationConfig;

pub fn get_all_supported_languages() -> Vec<String> {
    get_supported_languages().into_iter().map(|s| s.to_string()).collect()
}

static TRANSLATION_CACHE: OnceLock<RwLock<HashMap<String, String>>> = OnceLock::new();
static KEY_LOCKS: OnceLock<Mutex<HashMap<String, Arc<Mutex<()>>>>> = OnceLock::new();

fn cache() -> &'static RwLock<HashMap<String, String>> {
    TRANSLATION_CACHE.get_or_init(|| RwLock::new(HashMap::new()))
}

fn key_locks() -> &'static Mutex<HashMap<String, Arc<Mutex<()>>>> {
    KEY_LOCKS.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn normalize_lang(lang: &str) -> String {
    let normalized = lang.trim().to_lowercase();
    let base = normalized.split('-').next().unwrap_or("en").to_string();
    if get_supported_languages().contains(&base.as_str()) {
        base
    } else {
        "en".to_string()
    }
}

pub fn content_key_for_text(text: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(text.trim().as_bytes());
    hex::encode(hasher.finalize())
}

fn cache_key(content_key: &str, lang: &str) -> String {
    format!("{content_key}:{lang}")
}

async fn log_usage(db: &Database, content_key: &str, lang: &str, source: &str) {
    let coll = db.collection::<mongodb::bson::Document>("translation_usage_logs");
    let _ = coll
        .insert_one(
            doc! {
                "content_key": content_key,
                "lang": lang,
                "source": source,
                "created_at": BsonDateTime::now(),
            },
            None,
        )
        .await;
}

async fn translate_with_libre(text: &str, target_lang: &str) -> Result<String, String> {
    let config = TranslationConfig::from_env();
    let client = reqwest::Client::new();
    
    let res = client.post(format!("{}/translate", config.libre_url)) 
        .json(&serde_json::json!({ 
            "q": text, 
            "source": "en", 
            "target": target_lang, 
            "format": "text" 
        })) 
        .send() 
        .await
        .map_err(|e| format!("Failed to connect to LibreTranslate: {}", e))?;
    
    if !res.status().is_success() {
        return Err(format!("LibreTranslate returned error: {}", res.status()));
    }

    let json: serde_json::Value = res.json().await
        .map_err(|_| "Invalid response from LibreTranslate".to_string())?;
    
    Ok(json["translatedText"] 
        .as_str() 
        .unwrap_or(text) 
        .to_string()) 
}

async fn translate_with_google(text: &str, target_lang: &str) -> Result<String, String> {
    let config = TranslationConfig::from_env();
    
    // Check for real Google API key
    if let Some(api_key) = config.google_key.filter(|k| !k.trim().is_empty()) {
        let endpoint = format!(
            "https://translation.googleapis.com/language/translate/v2?key={}",
            api_key
        );

        let response = reqwest::Client::new()
            .post(&endpoint)
            .json(&serde_json::json!({
                "q": text,
                "target": target_lang,
                "format": "text"
            }))
            .send()
            .await
            .map_err(|_| "Failed to connect to Google translation service".to_string())?;

        if response.status().is_success() {
            let data = response
                .json::<Value>()
                .await
                .map_err(|_| "Invalid Google translation response".to_string())?;

            let translated = data
                .get("data")
                .and_then(|d| d.get("translations"))
                .and_then(|t| t.as_array())
                .and_then(|arr| arr.first())
                .and_then(|item| item.get("translatedText"))
                .and_then(|s| s.as_str())
                .unwrap_or("")
                .trim()
                .to_string();

            if !translated.is_empty() {
                return Ok(translated);
            }
        }
    }

    // Fallback to Google Free (Translate-Shell style URL)
    let url = format!(
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl={}&dt=t&q={}",
        target_lang,
        urlencoding::encode(text)
    );

    let client = reqwest::Client::new();
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    
    if !res.status().is_success() {
        return Err(format!("Google Free API returned error: {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    // Google Free API returns a nested array: [[["translated", "original", ...]]]
    let mut translated = String::new();
    if let Some(outer) = json.as_array() {
        if let Some(inner) = outer.get(0).and_then(|v| v.as_array()) {
            for segment in inner {
                if let Some(t) = segment.get(0).and_then(|v| v.as_str()) {
                    translated.push_str(t);
                }
            }
        }
    }

    if translated.is_empty() {
        return Err("Google Free API returned empty translation".to_string());
    }

    Ok(translated)
}

async fn translate_with_provider(text: &str, target_lang: &str) -> Result<String, String> {
    let config = TranslationConfig::from_env();
    
    match config.provider.as_str() { 
        "google" => translate_with_google(text, target_lang).await,
        "libre" => translate_with_libre(text, target_lang).await,
        _ => {
            eprintln!("Unknown translation provider: {}, falling back to LibreTranslate", config.provider);
            translate_with_libre(text, target_lang).await
        }
    }
}

pub struct IpRateLimit {
    pub limit: u32,
    pub window: Duration,
}

pub fn check_rate_limit(_key: &str, _limit: &IpRateLimit) -> bool {
    // Basic implementation for now, always returns true
    // In a real scenario, this would use Redis or an in-memory store
    true
}

pub async fn get_translation(db: &Database, text: &str, target_lang: &str) -> Result<String, String> {
    let original_text = text.trim().to_string();
    if original_text.is_empty() {
        return Err("Text is required".to_string());
    }

    let lang = normalize_lang(target_lang);
    if lang == "en" {
        return Ok(original_text);
    }

    let content_key = content_key_for_text(&original_text);
    let memory_key = cache_key(&content_key, &lang);

    let first_cached = cache()
        .read()
        .ok()
        .and_then(|guard| guard.get(&memory_key).cloned());
    if let Some(hit) = first_cached {
        log_usage(db, &content_key, &lang, "cache").await;
        return Ok(hit);
    }

    let lock = {
        let mut guard = key_locks().lock().await;
        guard
            .entry(memory_key.clone())
            .or_insert_with(|| Arc::new(Mutex::new(())))
            .clone()
    };
    let _key_guard = lock.lock().await;

    let second_cached = cache()
        .read()
        .ok()
        .and_then(|guard| guard.get(&memory_key).cloned());
    if let Some(hit) = second_cached {
        log_usage(db, &content_key, &lang, "cache").await;
        return Ok(hit);
    }

    let coll = db.collection::<mongodb::bson::Document>("translations");
    if let Ok(Some(doc_hit)) = coll
        .find_one(doc! { "content_key": &content_key, "lang": &lang }, None)
        .await
    {
        if let Ok(translated) = doc_hit.get_str("translated_text") {
            let translated = translated.to_string();
            // If it's already translated (not just English fallback), return it
            if translated != original_text {
                if let Ok(mut guard) = cache().write() {
                    guard.insert(memory_key.clone(), translated.clone());
                }
                log_usage(db, &content_key, &lang, "db").await;
                return Ok(translated);
            }
        }
    }

    // Attempt translation with configured provider
    let translated_res = translate_with_provider(&original_text, &lang).await;
    
    let (translated, was_successful) = match translated_res {
        Ok(t) => (t.trim().to_string(), true),
        Err(e) => {
            // Only log if it's not a common 400 (unsupported) or 429 (rate limit) error
            if !e.contains("400") && !e.contains("429") {
                eprintln!("Translation failed for [{}]: {} - Error: {}", lang, original_text, e);
            }
            // Fallback to original text if translation fails
            (original_text.clone(), false)
        }
    };

    let now = BsonDateTime::now();
    // Only save to DB if it was actually translated and it's NOT the same as original
    if was_successful && !translated.is_empty() && translated != original_text {
        println!("Saving successful translation [{}]: {} -> {}", lang, original_text, translated);
        let _ = coll
            .update_one(
                doc! { "content_key": &content_key, "lang": &lang },
                doc! {
                    "$set": {
                        "content_key": &content_key,
                        "lang": &lang,
                        "original_text": &original_text,
                        "translated_text": &translated,
                        "updated_at": now,
                    },
                    "$setOnInsert": {
                        "created_at": now,
                    }
                },
                UpdateOptions::builder().upsert(true).build(),
            )
            .await;

        if let Ok(mut guard) = cache().write() {
            guard.insert(memory_key, translated.clone());
        }
        log_usage(db, &content_key, &lang, "provider").await;
        Ok(translated)
    } else {
        // Return error so bulk service knows it failed
        Err(format!("Provider failed for language: {}", lang))
    }
}

pub async fn bulk_translate(
    db: &Database,
    text: &str,
    languages: &[String],
) -> HashMap<String, String> {
    let source = text.trim();
    if source.is_empty() {
        return HashMap::new();
    }

    let mut tasks = FuturesUnordered::new();
    for lang in languages {
        let clean_lang = normalize_lang(lang);
        let db = db.clone();
        let source = source.to_string();
        tasks.push(async move {
            let translated = get_translation(&db, &source, &clean_lang)
                .await
                .unwrap_or_else(|_| source.clone());
            (clean_lang, translated)
        });
    }

    let mut out = HashMap::new();
    while let Some((lang, translated)) = tasks.next().await {
        out.insert(lang, translated);
    }
    out
}

pub async fn register_content_source(
    db: &Database,
    source_type: &str,
    source_id: &str,
    text: &str,
) {
    let original = text.trim();
    if original.is_empty() {
        return;
    }
    let content_key = content_key_for_text(original);
    let coll = db.collection::<mongodb::bson::Document>("translation_sources");
    let now = BsonDateTime::now();
    let _ = coll
        .update_one(
            doc! { "content_key": &content_key },
            doc! {
                "$set": {
                    "content_key": &content_key,
                    "text": original,
                    "updated_at": now,
                },
                "$addToSet": {
                    "references": doc! {
                        "type": source_type,
                        "id": source_id,
                    }
                },
                "$setOnInsert": {
                    "created_at": now,
                }
            },
            UpdateOptions::builder().upsert(true).build(),
        )
        .await;
}

pub async fn backfill_missing_translations(db: &Database, languages: &[String]) -> usize {
    let sources_coll = db.collection::<mongodb::bson::Document>("translation_sources");
    let mut cursor = match sources_coll.find(None, None).await {
        Ok(c) => c,
        Err(_) => return 0,
    };

    let mut created = 0;
    while let Some(Ok(doc)) = cursor.next().await {
        if let Ok(text) = doc.get_str("text") {
            let res = bulk_translate(db, text, languages).await;
            created += res.len();
        }
    }
    created
}

pub async fn register_and_pretranslate(
    db: &Database,
    source_type: &str,
    source_id: &str,
    text: &str,
    languages: &[String],
) {
    register_content_source(db, source_type, source_id, text).await;
    let _ = bulk_translate(db, text, languages).await;
}
