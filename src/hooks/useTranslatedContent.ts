import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";

export interface TranslatedContent {
  cms: any[];
  blogs: any[];
  news: any[];
  courses: any[];
  categories: any[];
  static_texts: Record<string, string>;
}

export const fetchTranslatedContent = async (lang: string): Promise<TranslatedContent> => {
  const res = await apiFetch(`/api/content?lang=${lang}`);
  if (!res.ok) throw new Error("Failed to fetch translated content");
  const data = await res.json();
  
  // Ensure data is an object
  const safeData = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  
  return {
    cms: Array.isArray(safeData.cms) ? safeData.cms : [],
    blogs: Array.isArray(safeData.blogs) ? safeData.blogs : [],
    news: Array.isArray(safeData.news) ? safeData.news : [],
    courses: Array.isArray(safeData.courses) ? safeData.courses : [],
    categories: Array.isArray(safeData.categories) ? safeData.categories : [],
    static_texts: safeData.static_texts && typeof safeData.static_texts === "object" ? safeData.static_texts : {},
  };
};

export function useTranslatedContent() {
  const { i18n } = useTranslation();
  const lang = (i18n.language || "en").split("-")[0].toLowerCase();
  
  return useQuery({
    queryKey: ["translated-content", lang],
    queryFn: () => fetchTranslatedContent(lang),
    staleTime: 1000 * 60 * 15, // 15 minutes
  });
}
