use mongodb::Database;
use crate::config::languages::get_supported_languages;
use crate::config::translation::TranslationConfig;
use crate::services::translation_service::get_translation;
use crate::services::content_extractor::extract_all_content;
use tokio::time::{sleep, Duration};
use futures::future::join_all;

async fn check_provider_health(config: &TranslationConfig) -> Result<(), String> {
    let client = reqwest::Client::new();
    
    match config.provider.as_str() {
        "libre" => {
            let res = client.get(format!("{}/languages", config.libre_url))
                .send()
                .await
                .map_err(|e| format!("Failed to connect to LibreTranslate at {}: {}", config.libre_url, e))?;
            
            if !res.status().is_success() {
                return Err(format!("LibreTranslate health check failed: {}", res.status()));
            }
            Ok(())
        },
        "google" => {
            // Health check for Google Free (we just try to connect to the domain)
            let res = client.get("https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=health")
                .send()
                .await
                .map_err(|e| format!("Failed to connect to Google Translate: {}", e))?;
            
            if !res.status().is_success() {
                return Err(format!("Google Translate health check failed: {}", res.status()));
            }
            Ok(())
        },
        _ => Err(format!("Unknown translation provider: {}", config.provider))
    }
}

async fn get_provider_languages(config: &TranslationConfig) -> Vec<String> {
    let client = reqwest::Client::new();
    if config.provider == "libre" {
        if let Ok(res) = client.get(format!("{}/languages", config.libre_url)).send().await {
            if let Ok(langs) = res.json::<Vec<serde_json::Value>>().await {
                return langs.into_iter()
                    .filter_map(|l| l["code"].as_str().map(|s| s.to_string()))
                    .collect();
            }
        }
    }
    // Default or fallback
    Vec::new()
}

fn should_translate(text: &str) -> bool {
    let t = text.trim();
    if t.is_empty() { return false; }
    
    // Skip strings that look like names (2-3 words, capitalized, no common dictionary words)
    // This is a heuristic, but helps with things like "Amit Kapoor"
    let words: Vec<&str> = t.split_whitespace().collect();
    if words.len() >= 2 && words.len() <= 3 {
        let all_capitalized = words.iter().all(|w| {
            let first = w.chars().next().unwrap_or(' ');
            first.is_uppercase()
        });
        if all_capitalized {
            // Check if it's a known non-name string
            let lowercase = t.to_lowercase();
            if !lowercase.contains("education") && !lowercase.contains("certified") && !lowercase.contains("limited") {
                return false;
            }
        }
    }

    true
}

pub async fn bulk_translate_all_content(db: &Database) {
    let config = TranslationConfig::from_env();
    
    println!("--- Translation Provider Health Check ({}) ---", config.provider);
    if let Err(e) = check_provider_health(&config).await {
        eprintln!("CRITICAL ERROR: Translation provider health check failed!");
        eprintln!("{}", e);
        if config.provider == "libre" {
            eprintln!("Ensure LibreTranslate is running: docker run -d -p 5000:5000 libretranslate/libretranslate");
        }
        return;
    }
    println!("Provider health check passed.");

    let provider_langs = get_provider_languages(&config).await;
    if !provider_langs.is_empty() {
        println!("Provider supports {} languages.", provider_langs.len());
    }

    println!("--- Full Website Content Extraction Starting ---");
    let all_texts = extract_all_content(db).await;
    let texts: Vec<String> = all_texts.into_iter()
        .filter(|t| should_translate(t))
        .collect();
    
    let total_texts = texts.len();
    println!("Extracted {} unique text entries to translate (after filtering).", total_texts);

    let all_languages = get_supported_languages();
    let languages: Vec<String> = if !provider_langs.is_empty() {
        all_languages.into_iter()
            .filter(|l| *l == "en" || provider_langs.contains(&l.to_string()))
            .map(|s| s.to_string())
            .collect()
    } else {
        all_languages.into_iter().map(|s| s.to_string()).collect()
    };

    println!("Translating into {} languages (Filtered from {} requested): {:?}", languages.len(), get_supported_languages().len(), languages);
    let batch_size = 5; // Reduced batch size to be safer
    
    println!("Starting parallel bulk translation in batches of {}...", batch_size);
    
    let total_batches = (total_texts + batch_size - 1) / batch_size.max(1);
    for (idx, chunk) in texts.chunks(batch_size).enumerate() {
        let current_pos = idx * batch_size;
        let end_pos = (current_pos + chunk.len()).min(total_texts);
        let progress = (end_pos as f64 / total_texts.max(1) as f64) * 100.0;
        println!(
            "Processing batch {}/{} (Texts {} to {}) — {:.1}% complete",
            idx + 1,
            total_batches,
            current_pos + 1,
            end_pos,
            progress
        );
        
        let mut batch_futures = Vec::new();

        for text in chunk {
            for lang in &languages {
                if lang == "en" {
                    continue;
                }
                
                let db_clone = db.clone();
                let text_clone = text.to_string();
                let lang_clone = lang.to_string();

                batch_futures.push(async move {
                    // Not in DB or DB has English fallback, force translation
                    match get_translation(&db_clone, &text_clone, &lang_clone).await {
                        Ok(t) => {
                            if t == text_clone {
                                (false, lang_clone)
                            } else {
                                (true, lang_clone)
                            }
                        },
                        Err(_) => {
                            // Quietly fail for 400/unsupported
                            (false, lang_clone)
                        }
                    }
                });
            }
        }

        if !batch_futures.is_empty() {
            let results = join_all(batch_futures).await;
            let success_count = results.iter().filter(|(s, _)| *s).count();
            let fail_count = results.len() - success_count;
            
            if success_count > 0 {
                println!("Batch {} completed: {} successful translations.", idx + 1, success_count);
            }
            if fail_count > 0 {
                println!("Batch {} note: {} translations skipped (Provider limit or unsupported).", idx + 1, fail_count);
            }
        }

        // small delay between batches to avoid rate limit
        sleep(Duration::from_millis(500)).await;
    }

    println!("--- Full Website Bulk Translation Completed! ---");
}
