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

const getActiveLang = () => {
  try {
    return (localStorage.getItem("lang") || document.documentElement.getAttribute("lang") || "en")
      .split("-")[0]
      .toLowerCase();
  } catch {
    return "en";
  }
};

export const fetchHomeData = async (): Promise<HomeData> => {
  try {
    const lang = getActiveLang();
    const res = await apiFetch(`/api/content?lang=${lang}`).catch(() => null);
    const data = res && res.ok ? await res.json().catch(() => ({})) : {};
    
    // Ensure data is an object
    const safeData = data && typeof data === "object" && !Array.isArray(data) ? data : {};
    
    // Stats are from /api/public/home-data
    const statsRes = await apiFetch("/api/public/home-data").catch(() => null);
    const statsData = statsRes && statsRes.ok ? await statsRes.json().catch(() => ({})) : {};
    const safeStatsData = statsData && typeof statsData === "object" && !Array.isArray(statsData) ? statsData : {};

    return {
      cms: Array.isArray(safeData.cms) ? safeData.cms : [],
      blogs: Array.isArray(safeData.blogs) ? safeData.blogs : [],
      news: Array.isArray(safeData.news) ? safeData.news : [],
      courses: Array.isArray(safeData.courses) ? safeData.courses : [],
      categories: Array.isArray(safeData.categories) ? safeData.categories : [],
      static_texts: safeData.static_texts && typeof safeData.static_texts === "object" ? safeData.static_texts : {},
      stats: {
        totalCenters: safeStatsData.stats?.totalCenters || safeStatsData.totalCenters || 0,
        totalStudents: safeStatsData.stats?.totalStudents || safeStatsData.totalStudents || 0,
        totalCourses: safeStatsData.stats?.totalCourses || safeStatsData.totalCourses || 0,
      },
    };
  } catch (err) {
    console.error("Error fetching home data:", err);
    return {
      cms: [],
      blogs: [],
      news: [],
      courses: [],
      categories: [],
      static_texts: {},
      stats: { totalCenters: 0, totalStudents: 0, totalCourses: 0 },
    };
  }
};

export function useHomeData(): UseQueryResult<HomeData> {
  const lang = getActiveLang();
  return useQuery({
    queryKey: HOME_DATA_QUERY_KEY(lang),
    queryFn: fetchHomeData,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

