import i18n from "@/i18n";

export interface LangOption {
  code: string;
  label: string;
  category?: string;
}

export const POPULAR_LANGUAGES: LangOption[] = [
  // --- Indian Languages (22 Official & Major Regional) ---
  { code: "en", label: "English", category: "Global" },
  { code: "hi", label: "हिन्दी (Hindi)", category: "Indian" },
  { code: "pa", label: "ਪੰਜਾਬੀ (Punjabi)", category: "Indian" },
  { code: "ur", label: "اردو (Urdu)", category: "Indian" },
  { code: "bn", label: "বাংলা (Bengali)", category: "Indian" },
  { code: "mr", label: "मराठी (Marathi)", category: "Indian" },
  { code: "gu", label: "ગુજરાતી (Gujarati)", category: "Indian" },
  { code: "te", label: "తెలుగు (Telugu)", category: "Indian" },
  { code: "ta", label: "தமிழ் (Tamil)", category: "Indian" },
  { code: "kn", label: "ಕನ್ನಡ (Kannada)", category: "Indian" },
  { code: "ml", label: "മലയാളം (Malayalam)", category: "Indian" },
  { code: "or", label: "ଓଡ଼ିଆ (Odia)", category: "Indian" },
  { code: "as", label: "অসমীয়া (Assamese)", category: "Indian" },
  { code: "sa", label: "संस्कृतम् (Sanskrit)", category: "Indian" },
  { code: "ne", label: "नेपाली (Nepali)", category: "Indian" },
  { code: "mai", label: "मैथिली (Maithili)", category: "Indian" },
  { code: "bho", label: "भोजपुरी (Bhojpuri)", category: "Indian" },
  { code: "kok", label: "कोंकणी (Konkani)", category: "Indian" },
  { code: "mni", label: "ਮੈਤੇਈ (Manipuri)", category: "Indian" },
  { code: "doi", label: "डोगरी (Dogri)", category: "Indian" },
  { code: "ks", label: "ਕਸ਼ਮੀਰੀ (Kashmiri)", category: "Indian" },
  { code: "sat", label: "ᱥᱟᱱᱛᅡᱲᱤ (Santali)", category: "Indian" },
  { code: "sd", label: "سنڌي (Sindhi)", category: "Indian" },
  { code: "brx", label: "बडो (Bodo)", category: "Indian" },

  // --- World Languages A to Z ---
  { code: "af", label: "Afrikaans", category: "World" },
  { code: "sq", label: "Shqip (Albanian)", category: "World" },
  { code: "am", label: "አማርኛ (Amharic)", category: "World" },
  { code: "ar", label: "العربية (Arabic)", category: "World" },
  { code: "hy", label: "Հայերեն (Armenian)", category: "World" },
  { code: "az", label: "Azərbaycan (Azerbaijani)", category: "World" },
  { code: "eu", label: "Euskara (Basque)", category: "World" },
  { code: "be", label: "Беларуская (Belarusian)", category: "World" },
  { code: "bs", label: "Bosanski (Bosnian)", category: "World" },
  { code: "bg", label: "Български (Bulgarian)", category: "World" },
  { code: "ca", label: "Català (Catalan)", category: "World" },
  { code: "ceb", label: "Cebuano", category: "World" },
  { code: "zh-CN", label: "中文 (Chinese Simplified)", category: "World" },
  { code: "zh-TW", label: "中文 (Chinese Traditional)", category: "World" },
  { code: "hr", label: "Hrvatski (Croatian)", category: "World" },
  { code: "cs", label: "Čeština (Czech)", category: "World" },
  { code: "da", label: "Dansk (Danish)", category: "World" },
  { code: "nl", label: "Nederlands (Dutch)", category: "World" },
  { code: "eo", label: "Esperanto", category: "World" },
  { code: "et", label: "Eesti (Estonian)", category: "World" },
  { code: "fi", label: "Suomi (Finnish)", category: "World" },
  { code: "fr", label: "Français (French)", category: "World" },
  { code: "gl", label: "Galego (Galician)", category: "World" },
  { code: "ka", label: "ქართული (Georgian)", category: "World" },
  { code: "de", label: "Deutsch (German)", category: "World" },
  { code: "el", label: "Ελληνικά (Greek)", category: "World" },
  { code: "ht", label: "Kreyòl Ayisyen (Haitian)", category: "World" },
  { code: "ha", label: "Hausa", category: "World" },
  { code: "haw", label: "ʻŌlelo Hawaiʻi (Hawaiian)", category: "World" },
  { code: "he", label: "עברית (Hebrew)", category: "World" },
  { code: "hmn", label: "Hmong", category: "World" },
  { code: "hu", label: "Magyar (Hungarian)", category: "World" },
  { code: "is", label: "Íslenska (Icelandic)", category: "World" },
  { code: "ig", label: "Asụsụ Igbo", category: "World" },
  { code: "id", label: "Bahasa Indonesia", category: "World" },
  { code: "ga", label: "Gaeilge (Irish)", category: "World" },
  { code: "it", label: "Italiano (Italian)", category: "World" },
  { code: "ja", label: "日本語 (Japanese)", category: "World" },
  { code: "jv", label: "Basa Jawa (Javanese)", category: "World" },
  { code: "kk", label: "Қазақ (Kazakh)", category: "World" },
  { code: "km", label: "ភាសាខ្មែរ (Khmer)", category: "World" },
  { code: "rw", label: "Kinyarwanda", category: "World" },
  { code: "ko", label: "한국어 (Korean)", category: "World" },
  { code: "ku", label: "Kurdî (Kurdish)", category: "World" },
  { code: "ky", label: "Кыргызча (Kyrgyz)", category: "World" },
  { code: "lo", label: "ພາສາລາວ (Lao)", category: "World" },
  { code: "la", label: "Latina (Latin)", category: "World" },
  { code: "lv", label: "Latviešu (Latvian)", category: "World" },
  { code: "lt", label: "Lietuvių (Lithuanian)", category: "World" },
  { code: "lb", label: "Lëtzebuergesch", category: "World" },
  { code: "mk", label: "Македонски (Macedonian)", category: "World" },
  { code: "mg", label: "Malagasy", category: "World" },
  { code: "ms", label: "Bahasa Melayu (Malay)", category: "World" },
  { code: "mt", label: "Malti (Maltese)", category: "World" },
  { code: "mi", label: "Te Reo Māori", category: "World" },
  { code: "mn", label: "Монгол (Mongolian)", category: "World" },
  { code: "my", label: "မြန်မာစာ (Myanmar)", category: "World" },
  { code: "no", label: "Norsk (Norwegian)", category: "World" },
  { code: "ps", label: "پښتو (Pashto)", category: "World" },
  { code: "fa", label: "فارسی (Persian)", category: "World" },
  { code: "pl", label: "Polski (Polish)", category: "World" },
  { code: "pt", label: "Português (Portuguese)", category: "World" },
  { code: "ro", label: "Română (Romanian)", category: "World" },
  { code: "ru", label: "Русский (Russian)", category: "World" },
  { code: "sm", label: "Gagana Samoa", category: "World" },
  { code: "gd", label: "Gàidhlig (Scots)", category: "World" },
  { code: "sr", label: "Српски (Serbian)", category: "World" },
  { code: "st", label: "Sesotho", category: "World" },
  { code: "sn", label: "ChiShona", category: "World" },
  { code: "si", label: "සිංහල (Sinhala)", category: "World" },
  { code: "sk", label: "Slovenčina (Slovak)", category: "World" },
  { code: "sl", label: "Slovenščina (Slovenian)", category: "World" },
  { code: "so", label: "Soomaali (Somali)", category: "World" },
  { code: "es", label: "Español (Spanish)", category: "World" },
  { code: "su", label: "Basa Sunda (Sundanese)", category: "World" },
  { code: "sw", label: "Kiswahili (Swahili)", category: "World" },
  { code: "sv", label: "Svenska (Swedish)", category: "World" },
  { code: "tl", label: "Tagalog (Filipino)", category: "World" },
  { code: "tg", label: "Тоҷикӣ (Tajik)", category: "World" },
  { code: "tt", label: "Татар (Tatar)", category: "World" },
  { code: "th", label: "ไทย (Thai)", category: "World" },
  { code: "tr", label: "Türkçe (Turkish)", category: "World" },
  { code: "tk", label: "Türkmen (Turkmen)", category: "World" },
  { code: "uk", label: "Українська (Ukrainian)", category: "World" },
  { code: "ug", label: "ئۇيغۇرچە (Uyghur)", category: "World" },
  { code: "uz", label: "Oʻzbek (Uzbek)", category: "World" },
  { code: "vi", label: "Tiếng Việt (Vietnamese)", category: "World" },
  { code: "cy", label: "Cymraeg (Welsh)", category: "World" },
  { code: "xh", label: "isiXhosa", category: "World" },
  { code: "yi", label: "ייִדיશ (Yiddish)", category: "World" },
  { code: "yo", label: "Èdè Yorùbá (Yoruba)", category: "World" },
  { code: "zu", label: "isiZulu", category: "World" },
];

export function triggerGoogleTranslateSync(langCode?: string) {
  const targetLang = (langCode || localStorage.getItem("lang") || i18n.language || "en")
    .trim()
    .toLowerCase();

  const combo = document.querySelector(".goog-te-combo") as HTMLSelectElement | null;
  if (!combo || !combo.options || combo.options.length <= 1) return;

  if (targetLang === "en") {
    if (combo.selectedIndex !== 0) {
      combo.selectedIndex = 0;
      combo.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return;
  }

  const baseCode = targetLang.split("-")[0];
  let targetIndex = -1;

  for (let i = 0; i < combo.options.length; i++) {
    const val = combo.options[i].value.toLowerCase();
    if (
      val === targetLang ||
      val === baseCode ||
      val.startsWith(targetLang) ||
      val.startsWith(baseCode) ||
      targetLang.startsWith(val)
    ) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex !== -1 && combo.selectedIndex !== targetIndex) {
    combo.selectedIndex = targetIndex;
    combo.value = combo.options[targetIndex].value;
    combo.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

export function enableDOMAutoTranslationObserver() {
  // Disabled to prevent infinite MutationObserver loops and website freezing
}

export function setLanguage(langCode: string) {
  const normalized = (langCode || "en").trim().toLowerCase();
  const previousLang = (localStorage.getItem("lang") || "en").trim().toLowerCase();

  // 1. Update i18next
  i18n.changeLanguage(normalized.split("-")[0]);

  // 2. Update localStorage
  localStorage.setItem("lang", normalized);

  // 3. Update cookies (googtrans and lang)
  if (normalized === "en") {
    document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "lang=en; path=/; max-age=31536000; SameSite=Lax";
  } else {
    const googTransVal = `/en/${normalized}`;
    const hostname = typeof window !== "undefined" ? window.location.hostname : "";

    document.cookie = `googtrans=${googTransVal}; path=/; max-age=31536000; SameSite=Lax`;
    document.cookie = `googtrans=${googTransVal}; path=/`;
    document.cookie = `lang=${normalized}; path=/; max-age=31536000; SameSite=Lax`;

    if (hostname && hostname.includes(".") && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      const rootDomain = hostname.replace(/^www\./, "");
      [hostname, `.${hostname}`, rootDomain, `.${rootDomain}`].forEach((d) => {
        document.cookie = `googtrans=${googTransVal}; path=/; domain=${d}; max-age=31536000; SameSite=Lax`;
      });
    }
  }

  // 4. Update HTML lang & dir
  const rtlLanguages = ["ar", "ur", "fa", "he", "ps", "sd", "bal", "ks", "bej", "mey", "ug", "yi"];
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("lang", normalized);
    document.documentElement.setAttribute("dir", rtlLanguages.includes(normalized.split("-")[0]) ? "rtl" : "ltr");
    if (document.body) {
      document.body.style.top = "0px";
      document.body.style.position = "static";
    }
  }

  // 5. Ensure scripts are initialized
  initGoogleTranslateScript();

  // 6. Trigger sync
  triggerGoogleTranslateSync(normalized);

  // 7. Reload page cleanly if language changed to apply fresh translation without lag
  if (previousLang !== normalized) {
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }
}

export function initGoogleTranslateScript() {
  if (typeof window === "undefined") return;

  let elementDiv = document.getElementById("google_translate_element");
  if (!elementDiv) {
    elementDiv = document.createElement("div");
    elementDiv.id = "google_translate_element";
    document.body.appendChild(elementDiv);
  }

  const savedLang = (localStorage.getItem("lang") || i18n.language || "en").trim().toLowerCase();
  if (savedLang !== "en") {
    const googTransVal = `/en/${savedLang}`;
    document.cookie = `googtrans=${googTransVal}; path=/; max-age=31536000; SameSite=Lax`;
    document.cookie = `googtrans=${googTransVal}; path=/`;
  }

  if (document.getElementById("google-translate-script")) return;

  (window as any).googleTranslateElementInit = () => {
    if ((window as any).google?.translate?.TranslateElement) {
      new (window as any).google.translate.TranslateElement(
        {
          pageLanguage: "en",
          layout: (window as any).google.translate.TranslateElement.InlineLayout.SIMPLE,
          autoDisplay: false,
        },
        "google_translate_element"
      );

      if (savedLang && savedLang !== "en") {
        setTimeout(() => {
          triggerGoogleTranslateSync(savedLang);
        }, 300);
      }
    }
  };

  const script = document.createElement("script");
  script.id = "google-translate-script";
  script.type = "text/javascript";
  script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  script.async = true;
  document.head.appendChild(script);
}
