import { useEffect } from "react";
import i18n from "@/i18n";
import { useTranslatedContent } from "@/hooks/useTranslatedContent";

/**
 * Syncs backend translations (static_texts) into i18next resources.
 * This ensures that t() calls in components work with the latest
 * translations fetched from the backend.
 */
export function LanguageSync() {
  // useTranslatedContent fetches /api/content which includes static_texts
  const { data } = useTranslatedContent();

  useEffect(() => {
    if (data?.static_texts) {
      const lang = (localStorage.getItem("lang") || i18n.language || "en").split("-")[0].toLowerCase();
      
      console.log(`[LanguageSync] Injecting ${Object.keys(data.static_texts).length} translations for ${lang}`);
      
      // Add the backend translations to i18next
      i18n.addResourceBundle(
        lang,
        "translation",
        data.static_texts,
        true, // deep merge
        true  // overwrite existing
      );
      
      // Notify i18next that resources have been added
      // This helps with re-rendering components
      i18n.emit("added");
    }
  }, [data?.static_texts]);

  return null;
}

export default LanguageSync;
