use axum::{extract::{State, Query, Path}, http::StatusCode, Json};
use mongodb::{Database, bson::{doc, oid::ObjectId}, options::FindOptions};
use serde::{Deserialize, Serialize};
use crate::handlers::course::resolve_course_from_enrollment_string;
use crate::models::user::{UserRole, Claims, User};
use crate::models::typing::{TypingLanguage, TypingLesson, TypingResult, TypingLevel, TypingMode, TypingStatus, TypingCertificate};
use chrono::{Utc, DateTime};
use futures_util::stream::StreamExt;
use std::collections::HashSet;

async fn student_allowed_typing_lesson_ids(db: &Database, student: &User) -> Option<HashSet<ObjectId>> {
    let course_str = student.course.as_deref()?.trim();
    if course_str.is_empty() {
        return None;
    }
    let course = resolve_course_from_enrollment_string(db, course_str).await?;
    if !course.typing_tests_enabled {
        return Some(HashSet::new());
    }
    let course_oid = course.id?;

    if !course.linked_typing_tests.is_empty() {
        return Some(course.linked_typing_tests.iter().cloned().collect());
    }

    let coll = db.collection::<mongodb::bson::Document>("course_typing_allotments");
    let doc = coll.find_one(doc! { "course_id": course_oid }, None).await.ok().flatten()?;
    let arr = doc.get_array("language_ids").ok()?;
    let lang_ids: Vec<ObjectId> = arr
        .iter()
        .filter_map(|v| v.as_object_id())
        .collect();
    if lang_ids.is_empty() {
        return Some(HashSet::new());
    }

    let lesson_coll = db.collection::<TypingLesson>("typing_lessons");
    let mut cursor = lesson_coll
        .find(
            doc! { "language_id": { "$in": lang_ids }, "active": true },
            None,
        )
        .await
        .ok()?;

    let mut ids = HashSet::new();
    while let Some(Ok(lesson)) = cursor.next().await {
        if let Some(id) = lesson.id {
            ids.insert(id);
        }
    }
    Some(ids)
}

#[derive(Debug, Deserialize)]
pub struct CreateLanguageRequest {
    pub name: String,
    pub code: String,
    pub font_family: Option<String>,
    pub keyboard_layout: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TypingResponse {
    pub success: bool,
    pub message: String,
}

pub async fn create_language(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateLanguageRequest>,
) -> (StatusCode, Json<TypingResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(TypingResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let collection = db.collection::<TypingLanguage>("typing_languages");
    
    if let Ok(Some(_)) = collection.find_one(doc! { "code": &payload.code }, None).await {
        return (StatusCode::CONFLICT, Json(TypingResponse { success: false, message: "Language code already exists".to_string() }));
    }

    let new_lang = TypingLanguage {
        id: None,
        name: payload.name,
        code: payload.code,
        font_family: payload.font_family,
        keyboard_layout: payload.keyboard_layout,
        active: true,
    };

    match collection.insert_one(new_lang, None).await {
        Ok(_) => (StatusCode::CREATED, Json(TypingResponse { success: true, message: "Language added successfully".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(TypingResponse { success: false, message: "Failed to save language".to_string() })),
    }
}

pub async fn seed_default_languages_internal(db: &Database) -> Result<usize, String> {
    struct LangDef {
        name: &'static str,
        code: &'static str,
        font_family: &'static str,
        keyboard_layout: &'static str,
        sample_title: &'static str,
        sample_content: &'static str,
    }

    let defs = [
        LangDef {
            name: "English (Standard / QWERTY)",
            code: "en",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "QWERTY",
            sample_title: "English Typing Fundamentals",
            sample_content: "The quick brown fox jumps over the lazy dog. Daily typing practice significantly improves your speed, accuracy, and professional efficiency in computer education and office administration.",
        },
        LangDef {
            name: "Hindi - Mangal (Inscript)",
            code: "hi",
            font_family: "'Noto Sans Devanagari', 'Mangal', sans-serif",
            keyboard_layout: "Inscript",
            sample_title: "हिंदी इंस्क्रिप्ट अभ्यास",
            sample_content: "अभ्यास ही सफलता की सबसे बड़ी कुंजी है। नियमित रूप से टाइपिंग करने से गति और शुद्धता दोनों में बहुत सुधार होता है। कंप्यूटर शिक्षा आज के युग में अत्यंत महत्वपूर्ण है।",
        },
        LangDef {
            name: "Hindi - Kruti Dev 010 (Remington)",
            code: "hi-kd",
            font_family: "'Kruti Dev 010', 'Devlys 010', sans-serif",
            keyboard_layout: "Remington (Kruti Dev)",
            sample_title: "कुर्तीदेव रेमिंगटन अभ्यास",
            sample_content: "Hkkjr ,d egku ns'k gSA ;gk¡ fofo/krk esa ,drk gSA dEI;wVj f'k{kk vkt ds ;qx esa vko';d gSA fu;fer vH;kl ls gh xfr rFkk 'kq)rk c<+rh gSA",
        },
        LangDef {
            name: "Punjabi (Raavi / Inscript)",
            code: "pa",
            font_family: "'Noto Sans Gurmukhi', 'Raavi', sans-serif",
            keyboard_layout: "Inscript",
            sample_title: "ਪੰਜਾਬੀ ਰਾਵੀ ਟਾਈਪਿੰਗ",
            sample_content: "ਸਿੱਖਿਆ ਮਨੁੱਖ ਦਾ ਸਭ ਤੋਂ ਵੱਡਾ ਗਹਿਣਾ ਹੈ। ਨਿਰੰਤਰ ਅਭਿਆਸ ਨਾਲ ਟਾਈਪਿੰਗ ਗਤੀ ਅਤੇ ਸ਼ੁੱਧਤਾ ਦੋਵੇਂ ਵਧਦੀਆਂ ਹਨ। ਕੰਪਿਊਟਰ ਹੁਨਰ ਅੱਜ ਦੇ ਯੁੱਗ ਵਿੱਚ ਬਹੁਤ ਜ਼ਰੂਰੀ ਹੈ।",
        },
        LangDef {
            name: "Punjabi (Asees)",
            code: "pa-asees",
            font_family: "'Asees', sans-serif",
            keyboard_layout: "Phonetic",
            sample_title: "ਅਸੀਸ ਫੌਂਟ ਅਭਿਆਸ",
            sample_content: "is`iKAw mnu`K dw sB qoN v`fw gihxw hY[ inrMqr AiBAws nwl twieipMg sqwrI huMdI hY[ hryk ivaupwr ivc kMipaUtr bhuq zrUrI hY[",
        },
        LangDef {
            name: "Marathi",
            code: "mr",
            font_family: "'Noto Sans Devanagari', sans-serif",
            keyboard_layout: "Inscript",
            sample_title: "मराठी टंकलेखन सराव",
            sample_content: "प्रयत्नांती परमेश्वर. संगणक शिक्षण आजच्या युगात अत्यंत आवश्यक आहे. नियमित सरावाने टाइपिंगचा वेग आणि अचूकता दोन्ही वाढतात.",
        },
        LangDef {
            name: "Gujarati",
            code: "gu",
            font_family: "'Noto Sans Gujarati', 'Shruti', sans-serif",
            keyboard_layout: "Inscript",
            sample_title: "ગુજરાતી ટાઈપિંગ પ્રેક્ટિસ",
            sample_content: "શિક્ષણ એ જીવનનો આધારસ્તંભ છે. નિયમિત ટાઈપિંગ અભ્યાસથી તમારી ઝડપ અને ચોકસાઈ બંનેમાં મોટો સુધારો થાય છે.",
        },
        LangDef {
            name: "Bengali (বাংলা)",
            code: "bn",
            font_family: "'Noto Sans Bengali', 'Vrinda', sans-serif",
            keyboard_layout: "Inscript",
            sample_title: "বাংলা টাইপিং পাঠ",
            sample_content: "পরিশ্রমই সৌভাগ্যের প্রসূতি। প্রতিদিন মনোযোগ দিয়ে টাইপিং অনুশীলন করলে কাজের গতি দ্রুত বৃদ্ধি পায় এবং নির্ভুলতা বাড়ে।",
        },
        LangDef {
            name: "Tamil (தமிழ்)",
            code: "ta",
            font_family: "'Noto Sans Tamil', 'Latha', sans-serif",
            keyboard_layout: "Inscript",
            sample_title: "தமிழ் தட்டச்சு பயிற்சி",
            sample_content: "முயற்சி திருவினையாக்கும். கணினி தட்டச்சு பயிற்சி உங்கள் வேகத்தையும் துல்லியத்தையும் பெரிதும் மேம்படுத்துகிறது.",
        },
        LangDef {
            name: "Telugu (తెలుగు)",
            code: "te",
            font_family: "'Noto Sans Telugu', 'Gautami', sans-serif",
            keyboard_layout: "Inscript",
            sample_title: "తెలుగు టైపింగ్ సాధన",
            sample_content: "నిరంతర సాధనతో ఏదైనా సాధించవచ్చు. రోజూ టైపింగ్ చేయడం వల్ల వేగం మరియు ఖచ్చితత్వం మెరుగవుతాయి.",
        },
        LangDef {
            name: "Urdu (اردو)",
            code: "ur",
            font_family: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', sans-serif",
            keyboard_layout: "Phonetic",
            sample_title: "اردو ٹائپنگ مشق",
            sample_content: "محنت کامیابی کی کنجی ہے۔ کمپیوٹر ٹائپنگ کی باقاعدہ مشق سے رفتار اور درستگی دونوں بہتر ہوتی ہیں۔ علم حاصل کرنا ہر انسان کے لیے ضروری ہے۔",
        },
        LangDef {
            name: "Arabic (العربية)",
            code: "ar",
            font_family: "'Noto Naskh Arabic', sans-serif",
            keyboard_layout: "Arabic 101",
            sample_title: "ممارسة الطباعة باللغة العربية",
            sample_content: "الممارسة المستمرة هي سر النجاح في سرعة الطباعة ولوحة المفاتيح. التعليم قوة تبني المستقبل وتفتح آفاق النجاح للجميع.",
        },
        LangDef {
            name: "Spanish (Español)",
            code: "es",
            font_family: "sans-serif",
            keyboard_layout: "QWERTY Spanish",
            sample_title: "Práctica de Mecanografía en Español",
            sample_content: "La práctica constante es la clave para dominar la mecanografía. El conocimiento y la perseverancia abren todas las puertas del éxito laboral.",
        },
        LangDef {
            name: "French (Français)",
            code: "fr",
            font_family: "sans-serif",
            keyboard_layout: "AZERTY",
            sample_title: "Pratique de Dactylographie Française",
            sample_content: "La pratique régulière permet d'améliorer la vitesse de frappe et la précision au clavier. L'apprentissage numérique est un trésor inestimable.",
        },
        LangDef {
            name: "German (Deutsch)",
            code: "de",
            font_family: "sans-serif",
            keyboard_layout: "QWERTZ",
            sample_title: "Deutsche Tastaturschreibübung",
            sample_content: "Übung macht den Meister beim Tastaturschreiben. Schnelligkeit und Genauigkeit sind entscheidende Fähigkeiten in der modernen Berufswelt.",
        },
        LangDef {
            name: "Russian (Русский)",
            code: "ru",
            font_family: "'Noto Sans', sans-serif",
            keyboard_layout: "JCUKEN Cyrillic",
            sample_title: "Урок слепой печати на русском",
            sample_content: "Постоянная практика — залог успеха в быстрой и точной печати на клавиатуре. Знания и компьютерные навыки открывают двери в будущее.",
        },
        LangDef {
            name: "Chinese (中文)",
            code: "zh",
            font_family: "'Noto Sans SC', sans-serif",
            keyboard_layout: "Pinyin",
            sample_title: "中文拼音打字练习",
            sample_content: "坚持每天练习打字可以显著提高打字速度与准确率。熟能生巧，知识就是力量，努力开创美好未来。",
        },
        LangDef {
            name: "Japanese (日本語)",
            code: "ja",
            font_family: "'Noto Sans JP', sans-serif",
            keyboard_layout: "Romaji / Kana",
            sample_title: "日本語タイピング練習",
            sample_content: "毎日のタイピング練習が速度と正確さを向上させます。継続は力なり、新しいスキルを身につけて将来に役立てましょう。",
        },
        LangDef {
            name: "Korean (한국어)",
            code: "ko",
            font_family: "'Noto Sans KR', sans-serif",
            keyboard_layout: "2-Set Hangul",
            sample_title: "한국어 타자 연습",
            sample_content: "꾸준한 타자 연습은 정확도와 타이핑 속도를 크게 향상시킵니다. 배움에는 끝이 없으며 지식은 큰 힘이 됩니다.",
        },
        LangDef {
            name: "Portuguese (Português)",
            code: "pt",
            font_family: "sans-serif",
            keyboard_layout: "ABNT2",
            sample_title: "Prática de Digitação em Português",
            sample_content: "A prática diária de digitação melhora sua velocidade e produtividade no trabalho digital. O aprendizado constante transforma carreiras.",
        },
        LangDef {
            name: "Italian (Italiano)",
            code: "it",
            font_family: "sans-serif",
            keyboard_layout: "QWERTY Italian",
            sample_title: "Esercizio di Dattilografia in Italiano",
            sample_content: "La pratica costante della dattilografia aumenta la velocità e la precisione sulla tastiera. La formazione apre le vie del futuro.",
        },
        LangDef {
            name: "Turkish (Türkçe)",
            code: "tr",
            font_family: "sans-serif",
            keyboard_layout: "Turkish Q",
            sample_title: "Türkçe Klavye Yazma Pratiği",
            sample_content: "Düzenli klavye yazma pratiği hızınızı ve doğruluğunuzu geliştirir. Bilgi güçtür ve dijital beceriler başarı getirir.",
        },
        LangDef {
            name: "Persian / Farsi (فارسی)",
            code: "fa",
            font_family: "'Noto Naskh Arabic', sans-serif",
            keyboard_layout: "Persian Standard",
            sample_title: "تمرین تایپ زبان فارسی",
            sample_content: "تمرین منظم تایپ سرعت و دقت شما را در کار با رایانه به میزان چشمگیری افزایش می‌دهد. دانش و پشتکار ضامن پیروزی است.",
        },
        LangDef {
            name: "Vietnamese (Tiếng Việt)",
            code: "vi",
            font_family: "sans-serif",
            keyboard_layout: "Telex",
            sample_title: "Luyện Gõ Tiếng Việt",
            sample_content: "Luyện gõ bàn phím hàng ngày giúp tăng tốc độ và độ chính xác trong học tập và công việc. Kỹ năng công nghệ thông tin là chìa khóa thành công.",
        },
        LangDef {
            name: "Thai (ไทย)",
            code: "th",
            font_family: "'Noto Sans Thai', sans-serif",
            keyboard_layout: "Kedmanee",
            sample_title: "แบบฝึกหัดพิมพ์ดีดภาษาไทย",
            sample_content: "การฝึกพิมพ์สัมผัสเป็นประจำจะช่วยเพิ่มความเร็วและความแม่นยำในการพิมพ์อย่างมีประสิทธิภาพ ความรู้คือกุญแจสู่ความสำเร็จ",
        },
    ];

    let lang_col = db.collection::<TypingLanguage>("typing_languages");
    let lesson_col = db.collection::<TypingLesson>("typing_lessons");

    let mut seeded = 0;
    for def in defs {
        let existing = lang_col.find_one(doc! { "code": def.code }, None).await.map_err(|e| e.to_string())?;
        let lang_id = match existing {
            Some(l) => l.id.unwrap_or_default(),
            None => {
                let new_lang = TypingLanguage {
                    id: None,
                    name: def.name.to_string(),
                    code: def.code.to_string(),
                    font_family: Some(def.font_family.to_string()),
                    keyboard_layout: Some(def.keyboard_layout.to_string()),
                    active: true,
                };
                let res = lang_col.insert_one(new_lang, None).await.map_err(|e| e.to_string())?;
                res.inserted_id.as_object_id().unwrap_or_default()
            }
        };

        // Ensure at least one lesson exists for this language
        if !lang_id.to_hex().is_empty() {
            let lesson_exists = lesson_col.find_one(doc! { "language_id": lang_id }, None).await.map_err(|e| e.to_string())?;
            if lesson_exists.is_none() {
                let lesson = TypingLesson {
                    id: None,
                    language_id: lang_id,
                    title: def.sample_title.to_string(),
                    content: def.sample_content.to_string(),
                    level: TypingLevel::Beginner,
                    min_wpm: Some(25.0),
                    min_accuracy: Some(85.0),
                    active: true,
                    created_at: Utc::now(),
                };
                let _ = lesson_col.insert_one(lesson, None).await;
            }
        }
        seeded += 1;
    }

    Ok(seeded)
}

pub async fn get_languages(
    State(db): State<Database>,
) -> (StatusCode, Json<Vec<TypingLanguage>>) {
    let collection = db.collection::<TypingLanguage>("typing_languages");
    
    // Auto-seed if empty so user always sees all languages
    let count = collection.count_documents(None, None).await.unwrap_or(0);
    if count == 0 {
        let _ = seed_default_languages_internal(&db).await;
    }

    let options = FindOptions::builder().sort(doc! { "name": 1 }).build();
    let mut cursor = match collection.find(doc! { "active": true }, options).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut languages = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(lang) = result {
            languages.push(lang);
        }
    }
    (StatusCode::OK, Json(languages))
}

pub async fn seed_default_languages(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<TypingResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(TypingResponse { success: false, message: "Unauthorized".to_string() }));
    }

    match seed_default_languages_internal(&db).await {
        Ok(count) => (StatusCode::OK, Json(TypingResponse {
            success: true,
            message: format!("Successfully seeded and verified {} global and Indian typing languages with lessons", count),
        })),
        Err(err) => (StatusCode::INTERNAL_SERVER_ERROR, Json(TypingResponse {
            success: false,
            message: format!("Failed to seed languages: {}", err),
        })),
    }
}

pub async fn delete_language(
    State(db): State<Database>,
    claims: Claims,
    Path(id): Path<String>,
) -> (StatusCode, Json<TypingResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(TypingResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(TypingResponse { success: false, message: "Invalid Language ID".to_string() })),
    };

    let collection = db.collection::<TypingLanguage>("typing_languages");
    match collection.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => (StatusCode::OK, Json(TypingResponse { success: true, message: "Language removed successfully".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(TypingResponse { success: false, message: "Failed to delete language".to_string() })),
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateLessonRequest {
    pub language_id: String,
    pub title: String,
    pub content: String,
    pub level: TypingLevel,
    pub min_wpm: Option<f64>,
    pub min_accuracy: Option<f64>,
}

pub async fn create_lesson(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<CreateLessonRequest>,
) -> (StatusCode, Json<TypingResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(TypingResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let collection = db.collection::<TypingLesson>("typing_lessons");
    let lang_oid = match ObjectId::parse_str(&payload.language_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(TypingResponse { success: false, message: "Invalid Language ID".to_string() })),
    };

    let new_lesson = TypingLesson {
        id: None,
        language_id: lang_oid,
        title: payload.title,
        content: payload.content,
        level: payload.level,
        min_wpm: payload.min_wpm,
        min_accuracy: payload.min_accuracy,
        active: true,
        created_at: Utc::now(),
    };

    match collection.insert_one(new_lesson, None).await {
        Ok(_) => (StatusCode::CREATED, Json(TypingResponse { success: true, message: "Lesson added successfully".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(TypingResponse { success: false, message: "Failed to save lesson".to_string() })),
    }
}

pub async fn get_lessons(
    State(db): State<Database>,
    claims: Claims,
    Query(params): Query<LessonsQuery>,
) -> (StatusCode, Json<Vec<TypingLesson>>) {
    let collection = db.collection::<TypingLesson>("typing_lessons");

    let mut filter = doc! {};
    if let Some(lang_id) = params.language_id {
        let lang_oid = match ObjectId::parse_str(&lang_id) {
            Ok(oid) => oid,
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(vec![]),
                )
            }
        };
        filter.insert("language_id", lang_oid);
    }

    if let Some(active) = params.active {
        filter.insert("active", active);
    }

    let mut cursor = collection
        .find(filter, None)
        .await
        .expect("Failed to fetch lessons");
    let mut lessons = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(lesson) = result {
            lessons.push(lesson);
        }
    }

    if claims.role == UserRole::Student {
        let users_coll = db.collection::<User>("users");
        let student_oid = match ObjectId::parse_str(&claims.sub) {
            Ok(o) => o,
            Err(_) => return (StatusCode::OK, Json(vec![])),
        };
        let student = match users_coll.find_one(doc! { "_id": student_oid }, None).await {
            Ok(Some(u)) => u,
            _ => return (StatusCode::OK, Json(vec![])),
        };
        let allowed = match student_allowed_typing_lesson_ids(&db, &student).await {
            Some(a) => a,
            None => return (StatusCode::OK, Json(vec![])),
        };
        lessons.retain(|l| l.id.map(|id| allowed.contains(&id)).unwrap_or(false));
    }

    (StatusCode::OK, Json(lessons))
}

#[derive(Debug, Deserialize)]
pub struct LessonsQuery {
    pub language_id: Option<String>,
    pub active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SubmitTypingResult {
    pub lesson_id: String,
    pub mode: TypingMode,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub total_chars: u32,
    pub correct_chars: u32,
    pub incorrect_chars: u32,
    pub extra_chars: u32,
    pub raw_data: Option<String>, // Optional: store keystrokes for deep analysis
}

pub async fn get_typing_report(
    State(db): State<Database>,
    claims: Claims,
    Query(params): Query<mongodb::bson::Document>,
) -> (StatusCode, Json<Vec<serde_json::Value>>) {
    if claims.role != UserRole::Center && claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(vec![]));
    }

    let results_coll = db.collection::<TypingResult>("typing_results");
    let mut filter = params.clone();
    if claims.role == UserRole::Center {
        let center_oid = ObjectId::parse_str(&claims.sub).unwrap();
        filter.insert("center_id", center_oid);
    }

    let pipeline = vec![
        doc! { "$match": filter },
        doc! { "$lookup": {
            "from": "users",
            "localField": "student_id",
            "foreignField": "_id",
            "as": "student"
        }},
        doc! { "$unwind": "$student" },
        doc! { "$project": {
            "wpm": 1,
            "accuracy": 1,
            "created_at": 1,
            "mode": 1,
            "student_name": "$student.full_name",
            "course_name": "$student.course",
            "student_id": 1
        }},
        doc! { "$sort": { "created_at": -1 } }
    ];

    let mut cursor = match results_coll.aggregate(pipeline, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut results = vec![];
    while let Some(result) = cursor.next().await {
        if let Ok(doc) = result {
            results.push(serde_json::to_value(doc).unwrap());
        }
    }
    (StatusCode::OK, Json(results))
}

pub async fn delete_lesson(
    State(db): State<Database>,
    claims: Claims,
    ax_path: axum::extract::Path<String>,
) -> (StatusCode, Json<TypingResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(TypingResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let lesson_oid = match ObjectId::parse_str(&ax_path.0) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(TypingResponse { success: false, message: "Invalid Lesson ID".to_string() })),
    };

    let collection = db.collection::<TypingLesson>("typing_lessons");
    match collection.delete_one(doc! { "_id": lesson_oid }, None).await {
        Ok(_) => (StatusCode::OK, Json(TypingResponse { success: true, message: "Lesson deleted successfully".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(TypingResponse { success: false, message: "Failed to delete lesson".to_string() })),
    }
}

pub async fn toggle_lesson_status(
    State(db): State<Database>,
    claims: Claims,
    ax_path: axum::extract::Path<String>,
) -> (StatusCode, Json<TypingResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(TypingResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let lesson_oid = match ObjectId::parse_str(&ax_path.0) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(TypingResponse { success: false, message: "Invalid Lesson ID".to_string() })),
    };

    let collection = db.collection::<TypingLesson>("typing_lessons");
    let lesson = match collection.find_one(doc! { "_id": lesson_oid }, None).await {
        Ok(Some(l)) => l,
        _ => return (StatusCode::NOT_FOUND, Json(TypingResponse { success: false, message: "Lesson not found".to_string() })),
    };

    match collection.update_one(doc! { "_id": lesson_oid }, doc! { "$set": { "active": !lesson.active } }, None).await {
        Ok(_) => (StatusCode::OK, Json(TypingResponse { success: true, message: "Status updated".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(TypingResponse { success: false, message: "Update failed".to_string() })),
    }
}

pub async fn submit_typing_result(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<SubmitTypingResult>,
) -> (StatusCode, Json<TypingResponse>) {
    if claims.role != UserRole::Student {
        return (StatusCode::FORBIDDEN, Json(TypingResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let student_oid = ObjectId::parse_str(&claims.sub).unwrap();
    let users_coll = db.collection::<User>("users");
    let student = match users_coll.find_one(doc! { "_id": student_oid }, None).await {
        Ok(Some(u)) => u,
        _ => return (StatusCode::NOT_FOUND, Json(TypingResponse { success: false, message: "Student not found".to_string() })),
    };

    let center_id = student.parent_id.ok_or((StatusCode::BAD_REQUEST, Json(TypingResponse { success: false, message: "Center ID not found".to_string() })));
    let center_id = match center_id {
        Ok(id) => id,
        Err(e) => return e,
    };

    let lesson_oid = match ObjectId::parse_str(&payload.lesson_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(TypingResponse { success: false, message: "Invalid Lesson ID".to_string() })),
    };

    let lessons_coll = db.collection::<TypingLesson>("typing_lessons");
    let lesson = match lessons_coll.find_one(doc! { "_id": lesson_oid }, None).await {
        Ok(Some(l)) => l,
        _ => return (StatusCode::NOT_FOUND, Json(TypingResponse { success: false, message: "Lesson not found".to_string() })),
    };

    let allowed = match student_allowed_typing_lesson_ids(&db, &student).await {
        Some(a) => a,
        None => {
            return (
                StatusCode::FORBIDDEN,
                Json(TypingResponse {
                    success: false,
                    message: "Typing tests are not available for your course".to_string(),
                }),
            )
        }
    };
    if !allowed.contains(&lesson_oid) {
        return (
            StatusCode::FORBIDDEN,
            Json(TypingResponse {
                success: false,
                message: "This typing lesson is not assigned to your course".to_string(),
            }),
        );
    }

    let duration_sec = (payload.end_time - payload.start_time).num_seconds().max(1) as u32;
    
    // WPM Calculation: (total_chars / 5) / (duration_min)
    let wpm = (payload.total_chars as f64 / 5.0) / (duration_sec as f64 / 60.0);
    
    // Accuracy Calculation: (correct_chars / total_chars) * 100
    let accuracy = if payload.total_chars > 0 {
        (payload.correct_chars as f64 / payload.total_chars as f64) * 100.0
    } else {
        0.0
    };

    let is_passed = match (lesson.min_wpm, lesson.min_accuracy) {
        (Some(min_wpm), Some(min_acc)) => wpm >= min_wpm && accuracy >= min_acc,
        (Some(min_wpm), None) => wpm >= min_wpm,
        (None, Some(min_acc)) => accuracy >= min_acc,
        _ => true, // No criteria means pass by default
    };

    // Anti-cheat / Validation
    if wpm > 300.0 || accuracy > 100.0 || duration_sec < 5 {
        return (StatusCode::BAD_REQUEST, Json(TypingResponse { success: false, message: "Invalid result detected".to_string() }));
    }

    let results_coll = db.collection::<TypingResult>("typing_results");
    let attempt_no = (results_coll.count_documents(doc! { "student_id": student_oid, "lesson_id": lesson_oid }, None).await.unwrap_or(0) + 1) as u32;

    let new_result = TypingResult {
        id: None,
        student_id: student_oid,
        center_id,
        course_id: None, // Optional: pull from user if needed
        lesson_id: lesson_oid,
        language_id: lesson.language_id,
        mode: payload.mode,
        attempt_no,
        start_time: payload.start_time,
        end_time: payload.end_time,
        duration_sec,
        total_chars: payload.total_chars,
        correct_chars: payload.correct_chars,
        incorrect_chars: payload.incorrect_chars,
        extra_chars: payload.extra_chars,
        wpm,
        accuracy,
        is_passed,
        certificate_id: None,
        status: TypingStatus::Completed,
        created_at: Utc::now(),
    };

    let result_id = results_coll.insert_one(new_result.clone(), None).await.expect("Failed to save result").inserted_id.as_object_id().unwrap();

    // Generate Certificate if mode is Exam and it's passed
    if payload.mode == TypingMode::Exam && is_passed {
        let cert_coll = db.collection::<TypingCertificate>("typing_certificates");
        let lang_coll = db.collection::<TypingLanguage>("typing_languages");
        let lang = lang_coll.find_one(doc! { "_id": lesson.language_id }, None).await.unwrap_or(None);
        let lang_name = lang.map(|l| l.name).unwrap_or_else(|| "Unknown".to_string());

        let ts = Utc::now().format("%Y%m%d").to_string();
        let cert_no = format!("TYP-{}-{}-{}", ts, student.username.chars().take(4).collect::<String>(), result_id.to_hex().chars().take(4).collect::<String>());

        let cert = TypingCertificate {
            id: None,
            student_id: student_oid,
            center_id,
            result_id,
            certificate_no: cert_no,
            wpm,
            accuracy,
            language: lang_name,
            issued_on: Utc::now(),
        };

        if let Ok(inserted) = cert_coll.insert_one(cert, None).await {
            let cert_id = inserted.inserted_id.as_object_id();
            let _ = results_coll.update_one(doc! { "_id": result_id }, doc! { "$set": { "certificate_id": cert_id } }, None).await;
        }
    }

    (StatusCode::CREATED, Json(TypingResponse { success: true, message: "Typing result saved".to_string() }))
}

pub async fn get_typing_history(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<TypingResult>>) {
    let student_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
    };

    let collection = db.collection::<TypingResult>("typing_results");
    let find_options = FindOptions::builder().sort(doc! { "created_at": -1 }).build();
    let mut cursor = match collection.find(doc! { "student_id": student_oid }, find_options).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut results = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(res) = result {
            results.push(res);
        }
    }
    (StatusCode::OK, Json(results))
}

pub async fn get_leaderboard(
    State(db): State<Database>,
    Query(params): Query<mongodb::bson::Document>,
) -> (StatusCode, Json<Vec<serde_json::Value>>) {
    let collection = db.collection::<TypingResult>("typing_results");
    
    // Aggregation for leaderboard (only best WPM per student)
    let pipeline = vec![
        doc! { "$match": params },
        doc! { "$sort": { "wpm": -1 } },
        doc! { "$group": {
            "_id": "$student_id",
            "best_result": { "$first": "$$ROOT" }
        }},
        doc! { "$replaceRoot": { "newRoot": "$best_result" } },
        doc! { "$lookup": {
            "from": "users",
            "localField": "student_id",
            "foreignField": "_id",
            "as": "student"
        }},
        doc! { "$unwind": "$student" },
        doc! { "$project": {
            "wpm": 1,
            "accuracy": 1,
            "student_name": "$student.full_name",
            "student_id": 1
        }},
        doc! { "$sort": { "wpm": -1 } },
        doc! { "$limit": 50 }
    ];

    let mut cursor = match collection.aggregate(pipeline, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut results = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(doc) = result {
            results.push(serde_json::to_value(doc).unwrap());
        }
    }
    (StatusCode::OK, Json(results))
}

#[derive(Debug, Serialize)]
pub struct TypingAnalytics {
    pub date: String,
    pub avg_wpm: f64,
    pub avg_accuracy: f64,
    pub total_attempts: u32,
}

pub async fn get_typing_certificates(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<Vec<TypingCertificate>>) {
    let student_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(Vec::new())),
    };

    let collection = db.collection::<TypingCertificate>("typing_certificates");
    let mut cursor = match collection.find(doc! { "student_id": student_oid }, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Vec::new())),
    };

    let mut certs = Vec::new();
    while let Some(result) = cursor.next().await {
        if let Ok(cert) = result {
            certs.push(cert);
        }
    }
    (StatusCode::OK, Json(certs))
}

pub async fn get_typing_certificate_by_id(
    State(db): State<Database>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> (StatusCode, Json<Option<TypingCertificate>>) {
    let cert_oid = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(None)),
    };

    let collection = db.collection::<TypingCertificate>("typing_certificates");
    match collection.find_one(doc! { "_id": cert_oid }, None).await {
        Ok(cert) => (StatusCode::OK, Json(cert)),
        Err(_) => (StatusCode::NOT_FOUND, Json(None)),
    }
}

pub async fn get_typing_analytics(
    State(db): State<Database>,
    claims: Claims,
    Query(params): Query<mongodb::bson::Document>,
) -> (StatusCode, Json<Vec<TypingAnalytics>>) {
    let collection = db.collection::<TypingResult>("typing_results");
    
    let mut filter = params.clone();
    match claims.role {
        UserRole::Student => {
            filter.insert("student_id", ObjectId::parse_str(&claims.sub).unwrap());
        },
        UserRole::Center => {
            filter.insert("center_id", ObjectId::parse_str(&claims.sub).unwrap());
        },
        UserRole::Admin | UserRole::SuperAdmin => {},
        _ => return (StatusCode::FORBIDDEN, Json(vec![])),
    }

    let pipeline = vec![
        doc! { "$match": filter },
        doc! { "$group": {
            "_id": { "$dateToString": { "format": "%Y-%m-%d", "date": "$created_at" } },
            "avg_wpm": { "$avg": "$wpm" },
            "avg_accuracy": { "$avg": "$accuracy" },
            "total_attempts": { "$sum": 1 }
        }},
        doc! { "$sort": { "_id": 1 } }
    ];

    let mut cursor = match collection.aggregate(pipeline, None).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(vec![])),
    };

    let mut analytics = vec![];
    while let Some(result) = cursor.next().await {
        if let Ok(doc) = result {
            analytics.push(TypingAnalytics {
                date: doc.get_str("_id").unwrap_or_default().to_string(),
                avg_wpm: doc.get_f64("avg_wpm").unwrap_or(0.0),
                avg_accuracy: doc.get_f64("avg_accuracy").unwrap_or(0.0),
                total_attempts: doc.get_i32("total_attempts").unwrap_or(0) as u32,
            });
        }
    }
    (StatusCode::OK, Json(analytics))
}
