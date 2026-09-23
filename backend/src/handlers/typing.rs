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
            name: "Spanish (Español)",
            code: "es",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Spanish QWERTY",
            sample_title: "Práctica de Mecanografía en Español",
            sample_content: "La práctica constante de mecanografía mejora tu velocidad y precisión al escribir en la computadora. El aprendizaje continuo abre puertas al éxito laboral.",
        },
        LangDef {
            name: "French (Français)",
            code: "fr",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "AZERTY",
            sample_title: "Exercice de Dactylographie Française",
            sample_content: "La pratique quotidienne du clavier améliore la vitesse et la précision de frappe. La maîtrise informatique est indispensable pour réussir son parcours professionnel.",
        },
        LangDef {
            name: "German (Deutsch)",
            code: "de",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "QWERTZ",
            sample_title: "Deutsche Tastaturübung",
            sample_content: "Regelmäßiges Zehnfingerschreiben verbessert Ihre Schreibgeschwindigkeit und Genauigkeit am Arbeitsplatz. Stetige Weiterbildung sichert Ihren beruflichen Erfolg.",
        },
        LangDef {
            name: "Chinese Simplified (简体中文 - 拼音)",
            code: "zh-Hans",
            font_family: "'Noto Sans SC', sans-serif",
            keyboard_layout: "Pinyin / QWERTY",
            sample_title: "中文拼音打字基础练习",
            sample_content: "坚持每天进行汉字拼音打字练习，能够快速提升文字录入的速度与准确率。信息技术知识是迈向成功未来的基石。",
        },
        LangDef {
            name: "Chinese Traditional (繁體中文 - 注音/倉頡)",
            code: "zh-Hant",
            font_family: "'Noto Sans TC', sans-serif",
            keyboard_layout: "Zhuyin / Cangjie",
            sample_title: "正體中文打字練習",
            sample_content: "持續練習中文輸入法可以有效提升打字速度與正確率。熟練掌握電腦打字技能，是現代職場不可或缺的重要能力。",
        },
        LangDef {
            name: "Japanese (日本語 - ローマ字/かな)",
            code: "ja",
            font_family: "'Noto Sans JP', sans-serif",
            keyboard_layout: "Romaji / Kana",
            sample_title: "日本語タイピング練習",
            sample_content: "毎日のタイピング練習が速度と正確さを向上させます。継続は力なり、新しいスキルを身につけて将来に役立てましょう。",
        },
        LangDef {
            name: "Korean (한국어 - 2벌식)",
            code: "ko",
            font_family: "'Noto Sans KR', sans-serif",
            keyboard_layout: "2-Set Hangul",
            sample_title: "한국어 타자 연습",
            sample_content: "꾸준한 타자 연습은 정확도와 타이핑 속도를 크게 향상시킵니다. 배움에는 끝이 없으며 지식은 큰 힘이 됩니다.",
        },
        LangDef {
            name: "Arabic (العربية)",
            code: "ar",
            font_family: "'Noto Naskh Arabic', 'Amiri', serif",
            keyboard_layout: "Arabic 101",
            sample_title: "تمارين الطباعة باللغة العربية",
            sample_content: "العمل الجاد والمثابرة هما مفتاح النجاح. التدريب اليومي على لوحة المفاتيح يعزز السرعة والدقة في إدخال البيانات بكفاءة عالية.",
        },
        LangDef {
            name: "Russian (Русский)",
            code: "ru",
            font_family: "Inter, 'Noto Sans', sans-serif",
            keyboard_layout: "JCUKEN Cyrillic",
            sample_title: "Практика печати на русском языке",
            sample_content: "Регулярная тренировка слепой печати развивает скорость и безошибочность ввода текста. Компьютерные навыки открывают новые карьерные горизонты.",
        },
        LangDef {
            name: "Portuguese (Português)",
            code: "pt",
            font_family: "Inter, system-ui, sans-serif",
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
        LangDef {
            name: "Dutch (Nederlands)",
            code: "nl",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Dutch QWERTY",
            sample_title: "Nederlandse Typvaardigheidsoefening",
            sample_content: "Regelmatige typevaardigheidsoefening verbetert uw typesnelheid en nauwkeurigheid achter de computer. Kennis en toewijding vormen de sleutel tot professioneel succes.",
        },
        LangDef {
            name: "Polish (Polski)",
            code: "pl",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Polish Programmers",
            sample_title: "Ćwiczenia Szybkiego Pisania po Polsku",
            sample_content: "Codzienne ćwiczenia bezwzrokowego pisania na klawiaturze pozwalają osiągnąć wysoką szybkość i bezbłędność. Umiejętności cyfrowe otwierają drogę do lepszej przyszłości.",
        },
        LangDef {
            name: "Swedish (Svenska)",
            code: "sv",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Nordic Swedish",
            sample_title: "Svensk Tangentbordsövning",
            sample_content: "Regelbunden skrivträning ökar din hastighet och precision vid datorn. Goda IT-kunskaper skapar utmärkta möjligheter på den moderna arbetsmarknaden.",
        },
        LangDef {
            name: "Norwegian (Norsk)",
            code: "no",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Norwegian QWERTY",
            sample_title: "Norsk Skrivetrening",
            sample_content: "Daglig skrivetrening forbedrer tastehastigheten og nøyaktigheten din betydelig. Kontinuerlig læring er nøkkelen til personlig og profesjonell utvikling.",
        },
        LangDef {
            name: "Danish (Dansk)",
            code: "da",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Danish QWERTY",
            sample_title: "Dansk Maskinskrivning",
            sample_content: "Flittig øvelse i blindskrift øger både skrivehastigheden og præcisionen. Digitale færdigheder er fundamentet for effektivt arbejde i det moderne samfund.",
        },
        LangDef {
            name: "Finnish (Suomi)",
            code: "fi",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Finnish QWERTY",
            sample_title: "Suomalainen Kirjoitusharjoitus",
            sample_content: "Säännöllinen näppäimistöharjoittelu kehittää kirjoitusnopeutta ja parantaa tarkkuutta. Tietotekniset taidot ovat avain menestyksekkääseen uraan.",
        },
        LangDef {
            name: "Greek (Ελληνικά)",
            code: "el",
            font_family: "'Noto Sans', sans-serif",
            keyboard_layout: "Greek Monotonic",
            sample_title: "Εξάσκηση Πληκτρολόγησης στα Ελληνικά",
            sample_content: "Η καθημερινή εξάσκηση στην πληκτρολόγηση βελτιώνει την ταχύτητα και την ακρίβειά σας στον υπολογιστή. Η συνεχής μάθηση οδηγεί στην επιτυχία.",
        },
        LangDef {
            name: "Czech (Čeština)",
            code: "cs",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Czech QWERTZ",
            sample_title: "Procvičování Psaní na Klávesnici",
            sample_content: "Pravidelný nácvik psaní všemi deseti prsty zvyšuje rychlost a spolehlivost zadávání textu. Digitální gramotnost je klíčem k profesnímu růstu.",
        },
        LangDef {
            name: "Hungarian (Magyar)",
            code: "hu",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Hungarian QWERTZ",
            sample_title: "Magyar Gépírás Gyakorlás",
            sample_content: "A rendszeres gépírási gyakorlat növeli a billentyűzetkezelés sebességét és pontosságát. A digitális kompetenciák elengedhetetlenek a sikerhez.",
        },
        LangDef {
            name: "Romanian (Română)",
            code: "ro",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Romanian Standard",
            sample_title: "Exercițiu de Dactilografie în Română",
            sample_content: "Exercițiul constant de dactilografie sporește viteza și corectitudinea redactării documentelor. Educația digitală deschide noi oportunități profesionale.",
        },
        LangDef {
            name: "Ukrainian (Українська)",
            code: "uk",
            font_family: "Inter, 'Noto Sans', sans-serif",
            keyboard_layout: "Ukrainian Cyrillic",
            sample_title: "Практика друку українською мовою",
            sample_content: "Щоденні вправи з клавіатурного набору суттєво підвищують швидкість і точність введення інформації. Сучасні комп'ютерні навички формують успішне майбутнє.",
        },
        LangDef {
            name: "Bulgarian (Български)",
            code: "bg",
            font_family: "Inter, 'Noto Sans', sans-serif",
            keyboard_layout: "Bulgarian BDS",
            sample_title: "Упражнение по машинопис на български",
            sample_content: "Редовните тренировки по писане на клавиатура развиват бързина и прецизност. Компютърното образование е надеждна инвестиция в личното развитие.",
        },
        LangDef {
            name: "Slovak (Slovenčina)",
            code: "sk",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Slovak QWERTZ",
            sample_title: "Precvičovanie Písania na Klávesnici",
            sample_content: "Pravidelné precvičovanie písania hmatovou metódou zvyšuje tempo a bezchybnosť. Znalosť práce s počítačom je základom úspechu v zamestnaní.",
        },
        LangDef {
            name: "Croatian (Hrvatski)",
            code: "hr",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Croatian QWERTZ",
            sample_title: "Vježba Tipkanja na Hrvatskom",
            sample_content: "Redovito vježbanje tipkanja sa svih deset prstiju osigurava veću brzinu i točnost. Računalno obrazovanje ključ je za suvremenu karijeru.",
        },
        LangDef {
            name: "Serbian (Српски)",
            code: "sr",
            font_family: "Inter, 'Noto Sans', sans-serif",
            keyboard_layout: "Serbian Cyrillic",
            sample_title: "Вежба куцања на српском језику",
            sample_content: "Редовно вежбање куцања на тастатури значајно унапређује брзину и тачност рада. Савремено рачунарско знање доноси успех у сваком послу.",
        },
        LangDef {
            name: "Slovenian (Slovenščina)",
            code: "sl",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Slovenian QWERTZ",
            sample_title: "Vaja Slepega Tipkanja",
            sample_content: "Vsakodnevna vaja slepega tipkanja bistveno izboljša hitrost in zanesljivost pri delu z računalnikom. Znanje odpira vsa vrata.",
        },
        LangDef {
            name: "Lithuanian (Lietuvių)",
            code: "lt",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Lithuanian Standard",
            sample_title: "Lietuvių Kalbos Spausdinimo Praktika",
            sample_content: "Nuolatinė spausdinimo klaviatūra praktika padeda pasiekti didelį greitį ir tikslumą. Skaitmeniniai įgūdžiai garantuoja profesinę sėkmę.",
        },
        LangDef {
            name: "Latvian (Latviešu)",
            code: "lv",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Latvian Standard",
            sample_title: "Latviešu Tastatūras Rakstīšanas Treniņš",
            sample_content: "Regulāri mašīnrakstīšanas treniņi ievērojami uzlabo darba tempu un teksta ievades precizitāti. Izglītība ir labākais ceļš uz panākumiem.",
        },
        LangDef {
            name: "Estonian (Eesti)",
            code: "et",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Estonian QWERTY",
            sample_title: "Eesti Keele Klahvikirja Harjutus",
            sample_content: "Järjepidev pimekirja harjutamine tõstab kirjutamiskiirust ja tagab vigadeta teksti. Digitaalne kirjaoskus viib sihile.",
        },
        LangDef {
            name: "Irish (Gaeilge)",
            code: "ga",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Irish QWERTY",
            sample_title: "Cleachtadh Clóscríofa i nGaeilge",
            sample_content: "Feabhsaíonn cleachtadh leanúnach luas agus cruinneas clóscríofa ar an ríomhaire. Is í an fhoghlaim bhuan eochair an ratha.",
        },
        LangDef {
            name: "Icelandic (Íslenska)",
            code: "is",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Icelandic QWERTY",
            sample_title: "Íslensk Ritvinnsluæfing",
            sample_content: "Regluleg vélritunaræfing eykur hraða og nákvæmni við tölvuvinnu. Góð tölvukunnátta skilar ávallt árangri.",
        },
        LangDef {
            name: "Albanian (Shqip)",
            code: "sq",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Albanian QWERTZ",
            sample_title: "Praktikë Shtypjeje në Shqip",
            sample_content: "Praktika e përditshme e shtypjes në tastierë rrit shpejtësinë dhe saktësinë e punës në kompjuter. Arsimi është themeli i përparimit.",
        },
        LangDef {
            name: "Maltese (Malti)",
            code: "mt",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Maltese 48-Key",
            sample_title: "Taħriġ fit-Ttajpjar bil-Malti",
            sample_content: "It-taħriġ kontinwu fit-ttajpjar itejjeb il-ħeffa u l-eżattezza fuq it-tastiera. It-tagħlim diġitali jwassal għal riżultati eċċellenti.",
        },
        LangDef {
            name: "Macedonian (Македонски)",
            code: "mk",
            font_family: "Inter, 'Noto Sans', sans-serif",
            keyboard_layout: "Macedonian Cyrillic",
            sample_title: "Вежбање пишување на тастатура",
            sample_content: "Секојдневната вежба на тастатура ја зголемува брзината и прецизноста при пишување. Компјутерските вештини се клуч за успехот.",
        },
        LangDef {
            name: "Bosnian (Bosanski)",
            code: "bs",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Bosnian QWERTZ",
            sample_title: "Vježba Kucanja na Bosanskom",
            sample_content: "Svakodnevno vježbanje kucanja omogućava veću efikasnost i tačnost rada. Obrazovanje pruža siguran temelj za budućnost.",
        },
        LangDef {
            name: "Belarusian (Беларуская)",
            code: "be",
            font_family: "Inter, 'Noto Sans', sans-serif",
            keyboard_layout: "Belarusian Cyrillic",
            sample_title: "Практыкаванне друку на беларускай мове",
            sample_content: "Штодзённая трэніроўка набору тэксту значна павышае хуткасць і якасць працы. Камп'ютарная адукацыя стварае надзейную будучыню.",
        },
        LangDef {
            name: "Basque (Euskara)",
            code: "eu",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Spanish/Basque QWERTY",
            sample_title: "Euskarazko Idazketa Ariketa",
            sample_content: "Egunero ordenagailuan idazten trebatzeak lastertasuna eta zehaztasuna hobetzen ditu. Ikaskuntzak etorkizun oparoa bermatzen du.",
        },
        LangDef {
            name: "Catalan (Català)",
            code: "ca",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Catalan QWERTY",
            sample_title: "Pràctica de Mecanografia en Català",
            sample_content: "La pràctica regular de mecanografia millora el rendiment i la precisió amb el teclat. El coneixement tecnològic és clau per al progrés.",
        },
        LangDef {
            name: "Galician (Galego)",
            code: "gl",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Galician QWERTY",
            sample_title: "Práctica de Mecanografía en Galego",
            sample_content: "Practicar a mecanografía a diario optimiza a rapidez e a exactitude diante do computador. A formación constante abre novas portas.",
        },
        LangDef {
            name: "Hebrew (עברית)",
            code: "he",
            font_family: "'Noto Sans Hebrew', sans-serif",
            keyboard_layout: "Hebrew Standard",
            sample_title: "אימון הקלדה בעברית",
            sample_content: "אימון הקלדה עיוורת יומיומי משפר באופן ניכר את המהירות והדיוק במחשב. רכישת מיומנויות טכנולוגיות היא המפתח להצלחה מקצועית.",
        },
        LangDef {
            name: "Indonesian (Bahasa Indonesia)",
            code: "id",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Indonesian QWERTY",
            sample_title: "Latihan Mengetik Bahasa Indonesia",
            sample_content: "Latihan mengetik secara teratur dapat meningkatkan kecepatan dan ketepatan jari di keyboard. Penguasaan komputer sangat penting untuk masa depan.",
        },
        LangDef {
            name: "Malay (Bahasa Melayu)",
            code: "ms",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Malay QWERTY",
            sample_title: "Latihan Menaip Bahasa Melayu",
            sample_content: "Latihan menaip sepuluh jari setiap hari meningkatkan ketangkasan dan ketepatan menaip. Kemahiran digital adalah asas kemajuan masa kini.",
        },
        LangDef {
            name: "Filipino / Tagalog",
            code: "fil",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Filipino QWERTY",
            sample_title: "Pagsasanay sa Pag-type sa Filipino",
            sample_content: "Ang araw-araw na pagsasanay sa pag-type ay nagpapabilis at nagpapadali sa paggamit ng computer. Ang edukasyon ang pinakamahalagang susi sa tagumpay.",
        },
        LangDef {
            name: "Swahili (Kiswahili)",
            code: "sw",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Swahili QWERTY",
            sample_title: "Mazoezi ya Kuchapa kwa Kiswahili",
            sample_content: "Mazoezi ya mara kwa mara ya kupiga chapa kwenye kompyuta huongeza kasi na usahihi. Elimu na maarifa ni nguzo kuu ya maendeleo.",
        },
        LangDef {
            name: "Amharic (አማርኛ - Ethiopia)",
            code: "am",
            font_family: "'Noto Sans Ethiopic', sans-serif",
            keyboard_layout: "Ge'ez Phonetic",
            sample_title: "የአማርኛ ፊደላት የጽሕፈት ልምምድ",
            sample_content: "የየዕለት የኮምፒውተር ጽሕፈት ልምምድ ፍጥነትንና ትክክለኛነትን ያዳብራል። ዕውቀትና ጥረት ለስኬታማ ሕይወት ወሳኝ መሠረቶች ናቸው።",
        },
        LangDef {
            name: "Yoruba (Èdè Yorùbá)",
            code: "yo",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Yoruba Standard",
            sample_title: "Ìdánwò Kíkọ Èdè Yorùbá",
            sample_content: "Kíkọ lẹ́tà lórí kọ̀mpútà lójoojúmọ́ ń mu ìmọ̀ àti ìyára pọ̀ sí i. Ẹ̀kọ́ àti ìfaradà ni kókó fún àṣeyọrí tó dájú.",
        },
        LangDef {
            name: "Igbo (Asụsụ Igbo)",
            code: "ig",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Igbo Standard",
            sample_title: "Mmụta Ịkụ Kọmputa n'Asụsụ Igbo",
            sample_content: "Ịmụta ịkụ kọmputa kwa ụbọchị na-eme ka ọsọ na izi ezi dị mma. Mmụta na nraranye na-eweta ọganihu dị ukwuu ná ndụ.",
        },
        LangDef {
            name: "Hausa (Harshen Hausa)",
            code: "ha",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Hausa Latin",
            sample_title: "Aikin Buga Rubutu da Hausa",
            sample_content: "Yin aikin rubutu a kowace rana yana ƙara sauri da ƙwarewa wajen amfani da na'ura mai ƙwaƙwalwa. Ilimi shi ne ginshiƙin rayuwa.",
        },
        LangDef {
            name: "Zulu (isiZulu)",
            code: "zu",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Zulu QWERTY",
            sample_title: "Ukuzilolonga Ukuthayipha ngesiZulu",
            sample_content: "Ukuzilolonga ukuthayipha nsuku zonke kuthuthukisa ijubane nokunemba kwakho kukhompyutha. Imfundo iyisisekelo sempumelelo yangomuso.",
        },
        LangDef {
            name: "Xhosa (isiXhosa)",
            code: "xh",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Xhosa QWERTY",
            sample_title: "Uqeqesho Lokuchwetheza ngesiXhosa",
            sample_content: "Ukuchwetheza rhoqo kwikhompyutha kwandisa isantya nokungaphazami komsebenzi. Imfundo nobuchule zizitshixo zekamva eliqhakazileyo.",
        },
        LangDef {
            name: "Afrikaans",
            code: "af",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Afrikaans QWERTY",
            sample_title: "Afrikaanse Tik Oefening",
            sample_content: "Daaglikse tikoefening verbeter jou spoed en akkuraatheid op die rekenaar. Rekenaarvaardighede is noodsaaklik vir professionele sukses.",
        },
        LangDef {
            name: "Somali (Af-Soomaali)",
            code: "so",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Somali QWERTY",
            sample_title: "Layliga Qorista Af-Soomaaliga",
            sample_content: "Tababarka joogtada ah ee qorista kombuyuutarku wuxuu kordhiyaa xawaaraha iyo saxnaanta. Waxbarashadu waa furaha horumarka iyo mustaqbalka.",
        },
        LangDef {
            name: "Burmese / Myanmar (မြန်မာစာ)",
            code: "my",
            font_family: "'Noto Sans Myanmar', sans-serif",
            keyboard_layout: "Myanmar Unicode",
            sample_title: "မြန်မာစာ ကွန်ပျူတာ စာရိုက်လေ့ကျင့်ခန်း",
            sample_content: "နေ့စဉ် လက်ကွက်ကျင့်ခြင်းဖြင့် စာရိုက်နှုန်းမြန်ဆန်ပြီး တိကျမှုရှိလာမည်ဖြစ်သည်။ ကွန်ပျူတာပညာသည် အနာဂတ်အတွက် အလွန်အရေးပါသည်။",
        },
        LangDef {
            name: "Khmer / Cambodian (ភាសាខ្មែរ)",
            code: "km",
            font_family: "'Noto Sans Khmer', sans-serif",
            keyboard_layout: "Khmer Unicode",
            sample_title: "លំហាត់វាយអត្ថបទភាសាខ្មែរ",
            sample_content: "ការអនុវត្តវាយអក្សរជាប្រចាំជួយបង្កើនល្បឿន និងភាពត្រឹមត្រូវក្នុងការប្រើប្រាស់កុំព្យូទ័រ។ ចំណេះដឹងគឺជាគន្លឹះឆ្ពោះទៅរកភាពជោគជ័យ។",
        },
        LangDef {
            name: "Lao (ພາສາລາວ)",
            code: "lo",
            font_family: "'Noto Sans Lao', sans-serif",
            keyboard_layout: "Lao Unicode",
            sample_title: "ບົດເຝິກຫັດພິມດີດພາສາລາວ",
            sample_content: "ການເຝິກພິມເປັນປະຈຳຈະຊ່ວຍເພີ່ມຄວາມໄວ ແລະ ຄວາມຖືກຕ້ອງໃນການພິມ. ການສຶກສາແມ່ນກຸນແຈສຳຄັນສູ່ຄວາມສຳເລັດ.",
        },
        LangDef {
            name: "Mongolian (Монгол хэл)",
            code: "mn",
            font_family: "Inter, 'Noto Sans', sans-serif",
            keyboard_layout: "Mongolian Cyrillic",
            sample_title: "Монгол хэлний шивэх дасгал",
            sample_content: "Өдөр бүр компьютерын гар дээр шивж суралцах нь хурд болон нарийвчлалыг мэдэгдэхүйц нэмэгдүүлдэг. Боловсрол бол хөгжлийн түлхүүр мөн.",
        },
        LangDef {
            name: "Kazakh (Қазақ тілі)",
            code: "kk",
            font_family: "Inter, 'Noto Sans', sans-serif",
            keyboard_layout: "Kazakh Cyrillic",
            sample_title: "Қазақша мәтін теру жаттығуы",
            sample_content: "Күнделікті пернетақтамен мәтін теру машығы жылдамдық пен дәлдікті арттырады. Заманауи білім мен цифрлық дағдылар табысқа жетелейді.",
        },
        LangDef {
            name: "Uzbek (Oʻzbek tili)",
            code: "uz",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Uzbek Latin",
            sample_title: "O'zbekcha Matn Terish Mashqi",
            sample_content: "Muntazam ravishda klaviaturada matn terish tezlik va aniqlikni sezilarli darajada oshiradi. Zamonaviy kompyuter bilimlari muvaffaqiyat garovidir.",
        },
        LangDef {
            name: "Azerbaijani (Azərbaycan dili)",
            code: "az",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Azerbaijani Latin",
            sample_title: "Azərbaycan Dilində Mətn Yazma Təlimi",
            sample_content: "Hər gün klaviaturada mətn yazmaq sürəti və dəqiqliyi xeyli artırır. İnformasiya texnologiyalarını mənimsəmək parlaq gələcəyə yoldur.",
        },
        LangDef {
            name: "Georgian (ქართული)",
            code: "ka",
            font_family: "'Noto Sans Georgian', sans-serif",
            keyboard_layout: "Georgian QWERTY",
            sample_title: "ქართული ბეჭდვის სავარჯიშო",
            sample_content: "კომპიუტერზე ყოველდღიური ბეჭდვის პრაქტიკა საგრძნობლად ზრდის სისწრაფესა და სიზუსტეს. ცოდნა და განათლება წარმატების საწინდარია.",
        },
        LangDef {
            name: "Armenian (Հայերեն)",
            code: "hy",
            font_family: "'Noto Sans Armenian', sans-serif",
            keyboard_layout: "Armenian Phonetic",
            sample_title: "Հայերեն մուտքագրման վարժություն",
            sample_content: "Ստեղնաշարով ամենօրյա վարժանքը բարելավում է մուտքագրման արագությունն ու ճշգրտությունը: Կրթությունը հաջողության հիմնական գրավականն է:",
        },
        LangDef {
            name: "Nepali (नेपाली)",
            code: "ne",
            font_family: "'Noto Sans Devanagari', sans-serif",
            keyboard_layout: "Traditional Nepali / Inscript",
            sample_title: "नेपाली टाइपिङ अभ्यास",
            sample_content: "निरन्तर अभ्यास नै सफलताको मूल मन्त्र हो। दैनिक रूपमा कम्प्युटरमा टाइपिङ गर्नाले गति र शुद्धतामा धेरै सुधार आउँछ। शिक्षा नै उज्ज्वल भविष्यको आधार हो।",
        },
        LangDef {
            name: "Sinhala (සිංහල - Sri Lanka)",
            code: "si",
            font_family: "'Noto Sans Sinhala', sans-serif",
            keyboard_layout: "Sinhala Wijesekara",
            sample_title: "සිංහල ටයිප් කිරීමේ පුහුණුව",
            sample_content: "දිනපතා පරිගණක යතුරුපුවරු පුහුණුව ඔබගේ වේගය හා නිරවද්‍යතාවය ඉහළ නංවයි. අධ්‍යාපනය අනාගත සාර්ථකත්වයේ මාවතයි.",
        },
        LangDef {
            name: "Pashto (پښتو)",
            code: "ps",
            font_family: "'Noto Naskh Arabic', sans-serif",
            keyboard_layout: "Pashto Phonetic",
            sample_title: "د پښتو ژبې ټايپينګ مشق",
            sample_content: "مسلسل تمرين او زيار د برياليتوب لار پرانيزي. هره ورځ د کمپيوټر پر کي بورډ مشق کول ستاسو سرعت او پوره درستي ډېروي.",
        },
        LangDef {
            name: "Kurdish (Kurdî / کوردی)",
            code: "ku",
            font_family: "'Noto Naskh Arabic', sans-serif",
            keyboard_layout: "Kurdish Sorani / Latin",
            sample_title: "ڕاهێنانی تایپکردن بە زمانی کوردی",
            sample_content: "ڕاهێنانی بەردەوام خێرایی و وردی لەسەر تەختەکلیل بەرز دەکاتەوە. زانست و فێربوون سەرچاوەی پێشکەوتن و سەرکەوتنن.",
        },
        LangDef {
            name: "Haitian Creole (Kreyòl Ayisyen)",
            code: "ht",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "US QWERTY",
            sample_title: "Egzèsis Tape an Kreyòl Ayisyen",
            sample_content: "Pratike tape chak jou amelyore vitès ak presizyon w sou òdinatè a. Edikasyon ak konesans se kle pou louvri tout pòt.",
        },
        LangDef {
            name: "Quechua (Runasimi)",
            code: "qu",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Latin QWERTY",
            sample_title: "Runasimi Qillqana Yachay",
            sample_content: "Sapa p'unchay yuyaywan qillqayqa aswan utqayta allinta ruwayta yachachin. Yachayqa kawsayninchikpa k'anchayninmi.",
        },
        LangDef {
            name: "Guarani (Avañe'ẽ)",
            code: "gn",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Latin QWERTY",
            sample_title: "Avañe'ẽ Hai Mbarete Jehecha",
            sample_content: "Ko'ẽ ko'ẽre jahaikuévo mbeguekatu jahupyty arandu ha pya'ekue. Arandupy niko omombarete ñande rekove.",
        },
        LangDef {
            name: "Tibetan (བོད་སྐད)",
            code: "bo",
            font_family: "'Noto Serif Tibetan', sans-serif",
            keyboard_layout: "Tibetan Sambhota",
            sample_title: "བོད་ཡིག་གློག་ཀླད་མཐེབ་གཞོང་སྦྱོང་བརྡར།",
            sample_content: "ཉིན་ལྟར་གློག་ཀླད་མཐེབ་གཞོང་སྟེང་ཡིག་འབྲུ་མནན་པའི་སྦྱོང་བརྡར་བྱས་ན་མགྱོགས་ཚད་དང་དག་ཚད་ཇེ་མཐོར་འགྲོ། ཤེས་རིག་ནི་མདུན་ལམ་གྱི་སྒྲོན་མེ་ཡིན།",
        },
        LangDef {
            name: "Javanese (Basa Jawa)",
            code: "jv",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Javanese QWERTY",
            sample_title: "Gladhen Ngetik Basa Jawa",
            sample_content: "Saben dina gladhen ngetik ing komputer bakal nambahi cepet lan patitis. Ngelmu iku kelakone kanthi laku.",
        },
        LangDef {
            name: "Sundanese (Basa Sunda)",
            code: "su",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Sundanese QWERTY",
            sample_title: "Latihan Ngetik Basa Sunda",
            sample_content: "Diajar ngetik saban dinten tiasa ngaronjatkeun kagancangan sareng katepatan dina komputer. Élmu pangaweruh mangrupakeun konci kasuksesan.",
        },
        LangDef {
            name: "Malagasy",
            code: "mg",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "French AZERTY",
            sample_title: "Fampiharana Fandefasana Soratra Malagasy",
            sample_content: "Ny fanazaran-tena isan'andro amin'ny solosaina dia manatsara ny fahaizana sy ny hafainganam-pandeha. Ny fahalalana no fototry ny fahombiazana.",
        },
        LangDef {
            name: "Esperanto",
            code: "eo",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Esperanto QWERTY",
            sample_title: "Esperanta Tajpekzerco",
            sample_content: "Regula tajpa ekzercado plibonigas vian rapidecon kaj precizecon ĉe la komputilo. Scio kaj internacia amikeco estas la celo.",
        },
        LangDef {
            name: "Latin (Lingua Latina)",
            code: "la",
            font_family: "Inter, system-ui, serif",
            keyboard_layout: "Classical Latin QWERTY",
            sample_title: "Exercitatio Scribendi Latina",
            sample_content: "Labor omnia vincit improbus. Cotidiana exercitatio celeritatem et diligentiam auget. Scientia ipsa potestas est.",
        },
        LangDef {
            name: "Welsh (Cymraeg)",
            code: "cy",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "UK Welsh QWERTY",
            sample_title: "Ymarfer Teipio Cymraeg",
            sample_content: "Mae ymarfer teipio dyddiol yn gwella cyflymder a chywirdeb ar y bysellfwrdd. Addysg yw sail pob llwyddiant.",
        },
        LangDef {
            name: "Luxembourgish (Lëtzebuergesch)",
            code: "lb",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Luxembourgish QWERTZ",
            sample_title: "Lëtzebuergesch Tippübung",
            sample_content: "Reegelméissegt Tippen um Computer mécht ee méi séier a méi präzis. Weiderbildung ass d'Basis fir e gelongene Wee.",
        },
        LangDef {
            name: "Tajik (Тоҷикӣ)",
            code: "tg",
            font_family: "Inter, 'Noto Sans', sans-serif",
            keyboard_layout: "Tajik Cyrillic",
            sample_title: "Машқи чоп ба забони тоҷикӣ",
            sample_content: "Машқи пайвастаи чоп суръат ва саҳеҳиро дар истифодаи компютер меафзояд. Илм сармояи бузургтарин барои фардои дурахшон аст.",
        },
        LangDef {
            name: "Turkmen (Türkmençe)",
            code: "tk",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Turkmen Latin",
            sample_title: "Türkmençe Ýazuw Maşky",
            sample_content: "Ýazuw endiklerini yzygiderli kämilleşdirmek çaltlygy we takyklygy ýokarlandyrýar. Ylym we bilim üstünligiň açarydyr.",
        },
        LangDef {
            name: "Kyrgyz (Кыргызча)",
            code: "ky",
            font_family: "Inter, 'Noto Sans', sans-serif",
            keyboard_layout: "Kyrgyz Cyrillic",
            sample_title: "Кыргызча терүү көнүгүүсү",
            sample_content: "Күндөлүк терүү көнүгүүлөрү клавиатурада иштөө ылдамдыгын жана тактыгын арттырат. Билим алуу келечектин пайдубалы.",
        },
        LangDef {
            name: "Tatar (Татарча)",
            code: "tt",
            font_family: "Inter, 'Noto Sans', sans-serif",
            keyboard_layout: "Tatar Cyrillic",
            sample_title: "Татарча язу күнегүләре",
            sample_content: "Көн саен клавиатурада язу осталыгын үстерү тизлекне һәм төгәллекне арттыра. Белемле кеше барлык уңышларга ирешә ала.",
        },
        LangDef {
            name: "Uyghur (ئۇيغۇرچە)",
            code: "ug",
            font_family: "'Noto Naskh Arabic', sans-serif",
            keyboard_layout: "Uyghur Arabic",
            sample_title: "ئۇيغۇرچە خەت بېسىش مەشىقى",
            sample_content: "ھەر كۈنى خەت بېسىشنى مەشىق قىلىش تېزلىك ۋە توغرىلىقنى زور دەرىجىدە ئاشۇرىدۇ. بىلىم كەلگۈسىگە يول ئاچىدۇ.",
        },
        LangDef {
            name: "Oromo (Afaan Oromoo)",
            code: "om",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Oromo QWERTY",
            sample_title: "Shaakala Barruu Afaan Oromoo",
            sample_content: "Shaakalli kompiitaraa guyyaa guyyaan saffisaa fi qulqullina barreessuu cimsa. Beekumsi furtuu milkaa'inaati.",
        },
        LangDef {
            name: "Tigrinya (ትግርኛ)",
            code: "ti",
            font_family: "'Noto Sans Ethiopic', sans-serif",
            keyboard_layout: "Ge'ez Phonetic",
            sample_title: "ናይ ትግርኛ ምጽሓፍ ልምምድ",
            sample_content: "መዓልታዊ ናይ ኮምፒውተር ምጽሓፍ ልምምድ ቅልጣፈን ጽሬትን የዕቢ። ትምህርቲ ናይ ጽባሕ ውሕስነት እዩ።",
        },
        LangDef {
            name: "Shona (chiShona)",
            code: "sn",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Shona QWERTY",
            sample_title: "Kudzidzira Kutaipa nechiShona",
            sample_content: "Kudzidzira kutaipa mazuva ose kunowedzera kumhanya uye kururama kwebasa. Dzidzo ndiyo nheyo yehupenyu hunobudirira.",
        },
        LangDef {
            name: "Kinyarwanda",
            code: "rw",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "French AZERTY / QWERTY",
            sample_title: "Imyitozo yo Kwandika mu Kinyarwanda",
            sample_content: "Gukora imyitozo yo kwandika buri munsi byongera umuvuduko n'ubunyangamugayo mu kazi. Ubumenyi ni umusingi w'iterambere.",
        },
        LangDef {
            name: "Cebuano (Bisaya)",
            code: "ceb",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "US QWERTY",
            sample_title: "Pagpraktis og Type sa Binisaya",
            sample_content: "Ang pagpraktis og type matag adlaw makapauswag sa imong kapaspas ug katukma sa computer. Ang edukasyon maoy tuboran sa kalampusan.",
        },
        LangDef {
            name: "Hawaiian (`Ōlelo Hawaiʻi)",
            code: "haw",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Hawaiian QWERTY",
            sample_title: "Haʻawina Pākīkē `Ōlelo Hawaiʻi",
            sample_content: "Ma ka hana ka ʻike, ma ka ʻimi ka loaʻa. E hoʻomau i ka hoʻomaʻamaʻa ʻana ma ka lolo uila no ka pono o ke au hou.",
        },
        LangDef {
            name: "Maori (Te Reo Māori)",
            code: "mi",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Māori QWERTY",
            sample_title: "Whakaharatau Patopato Māori",
            sample_content: "Ko te reo te tuakiri, ko te ako te huarahi. Mā te whakaharatau i ia rā e tere ake ai, e tika ai hoki te tuhituhi.",
        },
        LangDef {
            name: "Samoan (Gagana Sāmoa)",
            code: "sm",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Samoan QWERTY",
            sample_title: "Aʻoaʻoga o le Taina i le Gagana Sāmoa",
            sample_content: "O le toʻaga i aso uma e faʻaleleia ai le saosaoa ma le saʻo o lau taina i luga o le komepiuta. O le poto e manuia ai a taeao.",
        },
        LangDef {
            name: "Fijian (Na Vosa Vakaviti)",
            code: "fj",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Fijian QWERTY",
            sample_title: "Vuli Taba Ivola Vakaviti",
            sample_content: "Na vakatovotovo e veisiga ena vakatubura na totolo kei na dodonu ni nomu taba ivola. Na vuli sa idola ni noda bula.",
        },
        LangDef {
            name: "Tongan (Lea Fakatonga)",
            code: "to",
            font_family: "Inter, system-ui, sans-serif",
            keyboard_layout: "Tongan QWERTY",
            sample_title: "Ako Taipeni ʻi he Lea Fakatonga",
            sample_content: "Ko e toutou ako taipeni ʻoku ne fakatupulekina ʻa e vave mo e totonu ʻo e tohi. Ko e poto ʻa e tefitoʻi koloa maʻa e kahaʻu.",
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
            name: "Marathi (मराठी)",
            code: "mr",
            font_family: "'Noto Sans Devanagari', sans-serif",
            keyboard_layout: "Inscript",
            sample_title: "मराठी टंकलेखन सराव",
            sample_content: "प्रयत्नांती परमेश्वर. संगणक शिक्षण आजच्या युगात अत्यंत आवश्यक आहे. नियमित सरावाने टाइपिंगचा वेग आणि अचूकता दोन्ही वाढतात.",
        },
        LangDef {
            name: "Gujarati (ગુજરાતી)",
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
            name: "Kannada (ಕನ್ನಡ)",
            code: "kn",
            font_family: "'Noto Sans Kannada', sans-serif",
            keyboard_layout: "Inscript",
            sample_title: "ಕನ್ನಡ ಟೈಪಿಂಗ್ ಅಭ್ಯಾಸ",
            sample_content: "ಕಾಯಕವೇ ಕೈಲಾಸ. ಪ್ರತಿದಿನ ಗಣಕಯಂತ್ರದಲ್ಲಿ ಟೈಪಿಂಗ್ ಅಭ್ಯಾಸ ಮಾಡುವುದರಿಂದ ವೇಗ ಹಾಗೂ ನಿಖರತೆ ಗಣನೀಯವಾಗಿ ಹೆಚ್ಚುತ್ತದೆ.",
        },
        LangDef {
            name: "Malayalam (മലയാളം)",
            code: "ml",
            font_family: "'Noto Sans Malayalam', sans-serif",
            keyboard_layout: "Inscript",
            sample_title: "മലയാളം ടൈപ്പിംഗ് പരിശീലനം",
            sample_content: "അധ്വാനമാണ് വിജയത്തിന്റെ അടിസ്ഥാനം. ദിവസേനയുള്ള കമ്പ്യൂട്ടർ ടൈപ്പിംഗ് പരിശീലനം വേഗതയും കൃത്യതയും വർദ്ധിപ്പിക്കുന്നു.",
        },
        LangDef {
            name: "Odia (ଓଡ଼ିଆ)",
            code: "or",
            font_family: "'Noto Sans Oriya', sans-serif",
            keyboard_layout: "Inscript",
            sample_title: "ଓଡ଼ିଆ ଟାଇପିଂ ଅଭ୍ୟାସ",
            sample_content: "ଅଧ୍ୟବସାୟ ହିଁ ସଫଳତାର ଚାବିକାଠି। ନିୟମିତ କମ୍ପ୍ୟୁଟର ଟାଇପିଂ କରିବା ଦ୍ୱାରା ଦକ୍ଷତା ଓ ଗତିରେ ବହୁତ ଉନ୍ନତି ହୁଏ।",
        },
        LangDef {
            name: "Assamese (অসমীয়া)",
            code: "as",
            font_family: "'Noto Sans Bengali', sans-serif",
            keyboard_layout: "Inscript",
            sample_title: "অসমীয়া টাইপিং পাঠ",
            sample_content: "পৰিশ্ৰমেই সৌভাগ্যৰ প্ৰসূতি। প্ৰতিদিনে কম্পিউটাৰত টাইপিং অনুশীলন কৰিলে কামৰ গতি আৰু শুদ্ধতা বৃদ্ধি পায়।",
        },
        LangDef {
            name: "Sanskrit (संस्कृतम्)",
            code: "sa",
            font_family: "'Noto Sans Devanagari', serif",
            keyboard_layout: "Inscript",
            sample_title: "संस्कृत टङ्कन अभ्यासः",
            sample_content: "उद्यमेन हि सिध्यन्ति कार्याणि न मनोरथैः। न हि सुप्तस्य सिंहस्य प्रविशन्ति मुखे मृगाः। विद्या ददाति विनयं विनयाद्याति पात्रताम्।",
        },
        LangDef {
            name: "Kashmiri (کٲشُر)",
            code: "ks",
            font_family: "'Noto Naskh Arabic', serif",
            keyboard_layout: "Kashmiri Arabic",
            sample_title: "کٲشُر ٹائپنگ مشق",
            sample_content: "علم چھ انسان سنز ساروئی کھوتہٕ بڈھ دولت۔ پرؠتھ دۄہ ٹائپنگ مشق کرنہٕ سٟتؠ چھ رفتار تہٕ صفائی گژھان۔",
        },
        LangDef {
            name: "Sindhi (سنڌي)",
            code: "sd",
            font_family: "'Noto Naskh Arabic', serif",
            keyboard_layout: "Sindhi Arabic",
            sample_title: "سنڌي ٽائپنگ جي مشق",
            sample_content: "محنت ۽ لڳن سان هر منزل ماڻي سگهجي ٿي. روزانو ڪمپيوٽر تي ٽائپنگ ڪرڻ سان رفتار ۽ درستگي وڌي ٿي.",
        },
        LangDef {
            name: "Konkani (कोंकणी)",
            code: "kok",
            font_family: "'Noto Sans Devanagari', sans-serif",
            keyboard_layout: "Inscript",
            sample_title: "कोंकणी टायपिंग सराव",
            sample_content: "कष्ट करिनासतना फळ मेळना. दर दिसा टायपिंग अभ्यास केल्ल्यान संगणकाचेर काम करपाची गती आनी अचूकताय वाडटा.",
        },
        LangDef {
            name: "Manipuri / Meitei (মৈতৈলোন্)",
            code: "mni",
            font_family: "'Noto Sans Meetei Mayek', 'Noto Sans Bengali', sans-serif",
            keyboard_layout: "Inscript",
            sample_title: "মৈতৈলোন্ তাইপিং প্রাক্টিস",
            sample_content: "হৈশিংবা অমসুং কুপ্না হোৎনবনা মায়পাকপগী লম্বী য়াৎলি। নোংমগী তাইপিং প্রাক্টিস তৌবনা কমপ্যুটারগী হৈথোই-শিংথোইবা হেনগৎহল্লি।",
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
    pub lesson_id: Option<String>,
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

#[derive(Debug, Deserialize)]
pub struct UpdateLessonRequest {
    pub language_id: Option<String>,
    pub title: Option<String>,
    pub content: Option<String>,
    pub level: Option<TypingLevel>,
    pub min_wpm: Option<f64>,
    pub min_accuracy: Option<f64>,
    pub active: Option<bool>,
}

pub async fn update_lesson(
    State(db): State<Database>,
    claims: Claims,
    ax_path: axum::extract::Path<String>,
    Json(payload): Json<UpdateLessonRequest>,
) -> (StatusCode, Json<TypingResponse>) {
    if claims.role != UserRole::Admin && claims.role != UserRole::SuperAdmin {
        return (StatusCode::FORBIDDEN, Json(TypingResponse { success: false, message: "Unauthorized".to_string() }));
    }

    let lesson_oid = match ObjectId::parse_str(&ax_path.0) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(TypingResponse { success: false, message: "Invalid Lesson ID".to_string() })),
    };

    let collection = db.collection::<TypingLesson>("typing_lessons");

    let mut update_doc = doc! {};
    if let Some(title) = payload.title {
        update_doc.insert("title", title);
    }
    if let Some(content) = payload.content {
        update_doc.insert("content", content);
    }
    if let Some(level) = payload.level {
        if let Ok(b) = mongodb::bson::to_bson(&level) {
            update_doc.insert("level", b);
        }
    }
    if let Some(lang_id) = payload.language_id {
        if let Ok(lang_oid) = ObjectId::parse_str(&lang_id) {
            update_doc.insert("language_id", lang_oid);
        }
    }
    if let Some(wpm) = payload.min_wpm {
        update_doc.insert("min_wpm", wpm);
    }
    if let Some(acc) = payload.min_accuracy {
        update_doc.insert("min_accuracy", acc);
    }
    if let Some(active) = payload.active {
        update_doc.insert("active", active);
    }

    if update_doc.is_empty() {
        return (StatusCode::OK, Json(TypingResponse { success: true, message: "Nothing to update".to_string() }));
    }

    match collection.update_one(doc! { "_id": lesson_oid }, doc! { "$set": update_doc }, None).await {
        Ok(_) => (StatusCode::OK, Json(TypingResponse { success: true, message: "Lesson updated successfully".to_string() })),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(TypingResponse { success: false, message: "Failed to update lesson".to_string() })),
    }
}

pub async fn submit_typing_result(
    State(db): State<Database>,
    claims: Claims,
    Json(payload): Json<SubmitTypingResult>,
) -> (StatusCode, Json<TypingResponse>) {
    let student_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(TypingResponse { success: false, message: "Invalid user ID".to_string() })),
    };

    let users_coll = db.collection::<User>("users");
    let student = users_coll.find_one(doc! { "_id": student_oid }, None).await.ok().flatten();
    let center_id = student.as_ref().and_then(|u| u.parent_id).unwrap_or(student_oid);

    let lesson_oid_opt = match payload.lesson_id.as_deref() {
        None | Some("") => None,
        Some(id) => ObjectId::parse_str(id).ok(),
    };

    let lesson_oid = match lesson_oid_opt {
        Some(oid) => oid,
        None => {
            // Quick lesson / unsaved lesson practice — still record a minimal result
            return (StatusCode::OK, Json(TypingResponse { success: true, message: "Practice session completed!".to_string() }));
        }
    };

    let lessons_coll = db.collection::<TypingLesson>("typing_lessons");
    let lesson = match lessons_coll.find_one(doc! { "_id": lesson_oid }, None).await {
        Ok(Some(l)) => l,
        _ => return (StatusCode::OK, Json(TypingResponse { success: true, message: "Practice completed".to_string() })),
    };

    if claims.role == UserRole::Student {
        if let Some(ref st) = student {
            if let Some(allowed) = student_allowed_typing_lesson_ids(&db, st).await {
                if !allowed.contains(&lesson_oid) {
                    return (
                        StatusCode::FORBIDDEN,
                        Json(TypingResponse {
                            success: false,
                            message: "This typing lesson is not assigned to your course".to_string(),
                        }),
                    );
                }
            }
        }
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
        let uname = student.as_ref().map(|s| s.username.as_str()).unwrap_or("USER");
        let cert_no = format!("TYP-{}-{}-{}", ts, uname.chars().take(4).collect::<String>(), result_id.to_hex().chars().take(4).collect::<String>());

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
