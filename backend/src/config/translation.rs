pub struct TranslationConfig { 
    pub provider: String, 
    pub libre_url: String, 
    pub google_key: Option<String>,
} 

impl TranslationConfig { 
    pub fn from_env() -> Self { 
        Self { 
            provider: std::env::var("TRANSLATION_PROVIDER").unwrap_or("libre".to_string()), 
            libre_url: std::env::var("LIBRETRANSLATE_URL") 
                .unwrap_or("http://localhost:5000".to_string()), 
            google_key: std::env::var("GOOGLE_TRANSLATE_API_KEY").ok(),
        } 
    } 
} 
