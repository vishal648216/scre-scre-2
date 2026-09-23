import { useCallback } from "react";
import { preloadDynamicTranslations, translateDynamic } from "@/lib/translateDynamic";

const getActiveLang = () =>
  (localStorage.getItem("lang") || document.documentElement.getAttribute("lang") || "en")
    .split("-")[0]
    .toLowerCase();

export const useDynamicTranslations = () => {
  const lang = getActiveLang();

  const preload = useCallback(
    async (texts: string[]) => {
      await preloadDynamicTranslations(texts, lang);
    },
    [lang],
  );

  const translate = useCallback(
    async (text: string) => translateDynamic(text, lang),
    [lang],
  );

  return { lang, preload, translate };
};
