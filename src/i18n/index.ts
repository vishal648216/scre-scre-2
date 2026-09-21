import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import hi from "./hi.json";

/** i18next may still log a Locize promo when `process.env` is missing in the browser bundle. */
if (typeof globalThis !== "undefined" && typeof console !== "undefined" && console.info) {
  const originalInfo = console.info.bind(console);
  console.info = (...args: unknown[]) => {
    const msg = args[0];
    if (typeof msg === "string" && msg.includes("locize.com") && msg.includes("i18next")) return;
    originalInfo(...args);
  };
}

// Full list of supported languages from backend config
export const SUPPORTED_LANGUAGES = [ 
    "en", "hi", "fr", "es", "de", "ar", "zh", "ru", "pt", "ja", "ur", "bn", "mr", "te", "ta", "gu", "kn", "ml", "pa", "it", "ko", "tr", "vi", "th", "pl", "nl", "id",
    "ms", "fa", "he", "el", "sv", "no", "da", "fi", "cs", "hu", "ro", "sk", "uk", "bg", "hr", "sr", "sl", "et", "lv", "lt", "sq", "mk", "hy", "ka", "az", "uz", "kk", "sw", "am", "km",
    "mi", "fj", "to", "sm", "haw", "mg", "ny", "xh", "zu", "st", "tn", "ts", "ss", "nr", "ve", "jv", "su", "ceb", "tl", "ga", "cy", "br", "sco", "gd", "is", "fo", "eu", "oc", "ca", "gl",
    "jct", "wa", "fy", "lb", "csb", "mwl", "an", "co", "fur", "lld", "lij", "lmo", "pms", "sc", "scn", "vec", "szl", "dsb", "hsb", "krl", "vep", "vro", "gil", "pau", "pon",
    "ay", "qu", "gn", "iu", "kl", "se", "bo", "dz", "lo", "my", "mn", "tt", "ba", "cv", "ce", "os", "ab", "av", "kbd", "inh", "ady", "xal", "bua", "sah", "tyv",
    "yo", "ig", "ha", "so", "om", "rw", "rn", "lg", "wo", "bm", "ff", "ak", "sn", "ti", "dv", "si", "ne", "ps", "sd", "bal", "ku", "as", "or", "sa", "mai",
    "kok", "mni", "doi", "ks", "sat", "brx", "tcy", "kfa", "bgc", "raj", "bho", "mag", "awa", "mwr", "mtr", "swv", "bgq", "gbm", "kfy", "bns", "mup", "noe", "bra", "anp", "kht",
    "tk", "tg", "ky", "la", "cor", "bre", "arg", "lim", "ltz", "kas", "gag", "sgh", "bej", "kau", "dje", "ee", "ddn", "fon", "snk", "fuc", "mnk", "dyu", "mey", "taq", "ful"
];

const rtlLanguages = ["ar", "ur", "fa", "he", "ps", "sd", "bal", "ks", "bej", "mey"];

export const i18nInitPromise = i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    debug: false,
    showSupportNotice: false,
    resources: {
      en: { translation: en },
      hi: { translation: hi },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "cookie", "navigator"],
      caches: ["localStorage", "cookie"],
      lookupLocalStorage: "lang",
      lookupCookie: "lang",
      cookieMinutes: 60 * 24 * 365,
      cookieOptions: { path: "/", sameSite: "lax" },
    },
    react: {
      useSuspense: false,
      bindI18n: "languageChanged loaded added",
    },
  });

const applyDocumentLanguage = (lng: string) => {
  if (typeof document === "undefined") return;
  const htmlElement = document.documentElement;
  const normalized = (lng || "en").split("-")[0].toLowerCase();
  htmlElement.setAttribute("lang", normalized);
  htmlElement.setAttribute("dir", rtlLanguages.includes(normalized) ? "rtl" : "ltr");
};

i18n.on("languageChanged", (lng) => {
  const normalized = (lng || "en").split("-")[0].toLowerCase();
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("lang", normalized);
  }
  if (typeof document !== "undefined") {
    document.cookie = `lang=${normalized}; path=/; max-age=31536000; SameSite=Lax`;
    applyDocumentLanguage(normalized);
  }
});

if (typeof window !== "undefined") {
  const bootLang = (localStorage.getItem("lang") || i18n.language || "en").split("-")[0].toLowerCase();
  applyDocumentLanguage(bootLang);
}

export default i18n;
