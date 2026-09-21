import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface HomeData {
  cms: any[];
  blogs: any[];
  news: any[];
  courses: any[];
  categories: any[];
  static_texts: Record<string, string>;
  stats: {
    totalCenters: number;
    totalStudents: number;
    totalCourses: number;
  };
}

export const HOME_DATA_QUERY_KEY = (lang: string) => ["home-data", lang];

const getActiveLang = () =>
  (localStorage.getItem("lang") || document.documentElement.getAttribute("lang") || "en")
    .split("-")[0]
    .toLowerCase();

export const fetchHomeData = async (): Promise<HomeData> => {
  const lang = getActiveLang();
  const res = await apiFetch(`/api/content?lang=${lang}`);
  if (!res.ok) throw new Error("Failed to fetch home data");
  const data = await res.json();
  
  // Ensure data is an object
  const safeData = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  
  // Stats are from /api/public/home-data
  const statsRes = await apiFetch("/api/public/home-data");
  const statsData = await statsRes.json();
  const safeStatsData = statsData && typeof statsData === "object" && !Array.isArray(statsData) ? statsData : {};

  return {
    cms: Array.isArray(safeData.cms) ? safeData.cms : [],
    blogs: Array.isArray(safeData.blogs) ? safeData.blogs : [],
    news: Array.isArray(safeData.news) ? safeData.news : [],
    courses: Array.isArray(safeData.courses) ? safeData.courses : [],
    categories: Array.isArray(safeData.categories) ? safeData.categories : [],
    static_texts: safeData.static_texts && typeof safeData.static_texts === "object" ? safeData.static_texts : {},
    stats: {
      totalCenters: safeStatsData.stats?.totalCenters || 0,
      totalStudents: safeStatsData.stats?.totalStudents || 0,
      totalCourses: safeStatsData.stats?.totalCourses || 0,
    },
  };
};

export function useHomeData(): UseQueryResult<HomeData> {
  const lang = getActiveLang();
  return useQuery({
    queryKey: HOME_DATA_QUERY_KEY(lang),
    queryFn: fetchHomeData,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}
