import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Loader2, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import Header from "@/components/Header";
import { useTranslation } from "react-i18next";
import { useDynamicTranslations } from "@/hooks/useDynamicTranslations";

interface NewsItem {
  title: string;
  slug: string;
  featured_image?: string;
  category?: string;
  meta_title?: string;
  meta_description?: string;
  published_at?: string;
}

const NewsListPage = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(9);
  const { preload, translate } = useDynamicTranslations();
  const { t } = useTranslation();

  const fetchNews = async (p: number, cat: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(p));
    params.set("limit", String(limit));
    if (cat) params.set("category", cat);
    
    // Pass current language to API
    const lang = (localStorage.getItem("lang") || document.documentElement.getAttribute("lang") || "en").split("-")[0];
    params.set("lang", lang);

    const res = await fetch(`/api/news?${params.toString()}`);
    const data = await res.json();
    if (res.ok && Array.isArray(data)) {
      setItems(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNews(page, category);
  }, [page, category, limit, preload, translate]);

  const filtered = items.filter((n) =>
    [n.title, n.meta_description, n.category]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <section className="bg-muted/30 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <h1 className="font-heading font-extrabold text-4xl text-foreground tracking-tight">{t("Latest News")}</h1>
          <p className="text-muted-foreground mt-2 text-sm font-medium">
            {t("Updates and announcements from our organization.")}
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative max-w-lg w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("SEARCH NEWS...")}
                className={cn(
                  "w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-muted/30",
                  "text-xs font-bold uppercase tracking-wider focus:border-primary focus:outline-none transition-all",
                )}
              />
            </div>
            <select
              value={category}
              onChange={(e) => {
                setPage(1);
                setCategory(e.target.value);
              }}
              className="w-full sm:w-48 px-3 py-2.5 rounded-none border border-border bg-muted/30 text-xs font-bold uppercase tracking-wider"
            >
              <option value="">{t("All Categories")}</option>
              <option value="updates">{t("Updates")}</option>
              <option value="events">{t("Events")}</option>
              <option value="press">{t("Press")}</option>
            </select>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Per Page")}</label>
              <select
                value={limit}
                onChange={(e) => { setPage(1); setLimit(Number(e.target.value)); }}
                className="w-24 px-3 py-2.5 rounded-none border border-border bg-muted/30 text-xs font-bold uppercase tracking-wider"
              >
                <option value={6}>6</option>
                <option value={9}>9</option>
                <option value={12}>12</option>
                <option value={18}>18</option>
              </select>
            </div>
            <button
              onClick={() => {
                const header = ["Title","Slug","Category","Published At"];
                const rows = filtered.map(n => [
                  n.title,
                  n.slug,
                  n.category || "",
                  n.published_at ? new Date(n.published_at).toISOString() : "",
                ]);
                const csv = [header, ...rows].map(r => r.map(field => {
                  const s = String(field ?? "");
                  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
                    return `"${s.replace(/"/g, '""')}"`;
                  }
                  return s;
                }).join(",")).join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `news_page${page}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-4 py-2.5 rounded-none border border-border bg-card text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2"
            >
              <Filter className="w-3.5 h-3.5" /> {t("Export CSV")}
            </button>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-10">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((n) => (
                <Link key={n.slug} to={`/news/${n.slug}`}>
                  <Card className="rounded-none border-border hover:border-primary/40 transition-all">
                    {n.featured_image && (
                      <img
                        src={n.featured_image}
                        alt={n.title}
                        className="w-full h-40 object-cover border-b border-border"
                      />
                    )}
                    <CardHeader className="py-4">
                      <CardTitle className="text-base font-black tracking-tight">{n.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm text-muted-foreground">{n.meta_description}</p>
                      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {n.category || "-"}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {n.published_at ? new Date(n.published_at).toLocaleDateString() : ""}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {filtered.length === 0 && (
                <div className="text-sm text-muted-foreground">{t("No news found")}</div>
              )}
            </div>
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-4 py-2 border border-border bg-card text-[10px] font-black uppercase tracking-[0.2em] disabled:opacity-50"
              >
                {t("Previous")}
              </button>
              <span className="text-xs font-bold">Page {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 border border-border bg-card text-[10px] font-black uppercase tracking-[0.2em]"
              >
                {t("Next")}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default NewsListPage;
