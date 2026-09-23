import { apiFetch } from "@/lib/api";

export const SUPPORTED_CONTENT_LANGUAGES = ["en", "hi", "bn", "mr", "te", "ta", "gu", "kn", "ml", "pa", "or", "as", "ur", "sa", "fr", "es", "de", "ar", "zh"] as const;

const memoryCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

type TranslateResponse = {
  translated: string;
};

type BulkTranslateResponse = Record<string, string>;

const normalizeLang = (lang: string) => {
  const base = (lang || "en").trim().toLowerCase().split("-")[0];
  return SUPPORTED_CONTENT_LANGUAGES.includes(base as (typeof SUPPORTED_CONTENT_LANGUAGES)[number]) ? base : "en";
};

const cacheKeyFor = (text: string, lang: string) => `${lang}:${text}`;

export async function preloadDynamicTranslations(texts: string[], language: string) {
  const lang = normalizeLang(language);
  if (lang === "en") return;

  const uniqueTexts = Array.from(
    new Set(
      texts
        .map((t) => (t || "").trim())
        .filter(Boolean)
        .filter((text) => !memoryCache.has(cacheKeyFor(text, lang)))
    )
  );

  const tasks = uniqueTexts.map(async (text) => {
    const res = await apiFetch("/api/translate/bulk", {
      method: "POST",
      body: JSON.stringify({ text, languages: [lang] }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as BulkTranslateResponse;
    const translated = data?.[lang] || text;
    memoryCache.set(cacheKeyFor(text, lang), translated);
  });

  await Promise.all(tasks);
}

export async function translateDynamic(text: string, language: string): Promise<string> {
  const cleanText = (text || "").trim();
  const lang = normalizeLang(language);

  if (!cleanText || lang === "en") {
    return cleanText;
  }

  const cacheKey = cacheKeyFor(cleanText, lang);
  const cached = memoryCache.get(cacheKey);
  if (cached) return cached;

  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const promise = (async () => {
    const res = await apiFetch("/api/translate", {
      method: "POST",
      body: JSON.stringify({ text: cleanText, target: lang }),
    });

    if (!res.ok) {
      return cleanText;
    }

    const data = (await res.json()) as TranslateResponse;
    const translated = data?.translated || cleanText;
    memoryCache.set(cacheKey, translated);
    return translated;
  })();

  inFlight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(cacheKey);
  }
}
