import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import { cn, normalizeAssetUrl } from "@/lib/utils";
import Header from "@/components/Header";
import { useTranslation } from "react-i18next";
import { useDynamicTranslations } from "@/hooks/useDynamicTranslations";

interface BlogItem {
  title: string;
  slug: string;
  featured_image?: string;
  meta_title?: string;
  meta_description?: string;
  categories?: string[];
  published_at?: string;
  featured?: boolean;
}

const BlogListPage = () => {
  const [initialLoading, setInitialLoading] = useState(true);
  const [blogs, setBlogs] = useState<BlogItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const [page, setPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const { preload, translate } = useDynamicTranslations();
  const { t } = useTranslation();

  // Fetch categories
  const fetchCategories = async () => {
    try {
      // Pass current language to API
      const lang = (localStorage.getItem("lang") || document.documentElement.getAttribute("lang") || "en").split("-")[0];
      const res = await fetch(`/api/blog-categories?lang=${lang}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setCategories(data);
      }
    } catch (e) {
      console.error("Failed to load categories", e);
    }
  };

  const fetchBlogs = async (p: number, cat: string, searchQuery: string) => {
    if (initialLoading) {
      setInitialLoading(true);
    } else {
      setIsSearching(true);
    }

    const params = new URLSearchParams();
    params.set("page", String(p));
    params.set("limit", "9");
    if (cat) params.set("category", cat);
    if (searchQuery) params.set("search", searchQuery);

    // Pass current language to API
    const lang = (localStorage.getItem("lang") || document.documentElement.getAttribute("lang") || "en").split("-")[0];
    params.set("lang", lang);

    const res = await fetch(`/api/blogs?${params.toString()}`);
    const data = await res.json();
    if (res.ok && Array.isArray(data)) {
      setBlogs(data);
    }

    if (initialLoading) {
      setInitialLoading(false);
    } else {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [preload, translate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    fetchBlogs(page, category, debouncedQuery);
  }, [page, category, debouncedQuery, preload, translate]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Top band */}
      <section className="bg-muted/30 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <span className="inline-flex items-center rounded-full bg-accent/15 text-accent border border-accent/25 px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.25em]">
            {t("Knowledge & Updates")}
          </span>

          <h1 className="font-heading font-extrabold text-4xl md:text-5xl text-foreground tracking-tight mt-5">
            {t("Our Blog")}
          </h1>

          <p className="text-muted-foreground mt-3 text-sm md:text-base font-medium max-w-2xl">
            {t("Insights, updates, and stories from our education community.")}
          </p>

          <div className="mt-8 relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              key="top-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("SEARCH BLOGS...")}
              className={cn(
                "w-full pl-11 pr-10 py-3 rounded-2xl border border-border bg-background text-sm",
                "text-[10px] font-extrabold uppercase tracking-[0.18em] text-foreground placeholder:text-muted-foreground",
                "focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
              )}
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-16">
        {initialLoading ? (
          <div className="py-24 flex justify-center">
            <Loader2 className="w-9 h-9 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-7">
              {/* Category pills */}
              <div className="flex flex-wrap gap-2.5">
                <button
                  key="all"
                  onClick={() => {
                    setPage(1);
                    setCategory("");
                  }}
                  className={cn(
                    "px-4 py-2 rounded-full text-[10px] font-extrabold uppercase tracking-[0.22em] border transition",
                    category === ""
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card text-foreground border-border hover:border-primary/40 hover:bg-primary/5"
                  )}
                >
                  All
                </button>
                {(showAllCategories ? categories : categories.slice(0, 7)).map(cat => (
                  <button
                    key={cat.slug}
                    onClick={() => {
                      setPage(1);
                      setCategory(cat.slug);
                    }}
                    className={cn(
                      "px-4 py-2 rounded-full text-[10px] font-extrabold uppercase tracking-[0.22em] border transition",
                      category === cat.slug
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card text-foreground border-border hover:border-primary/40 hover:bg-primary/5"
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
                {categories.length > 7 && (
                  <button
                    onClick={() => setShowAllCategories(!showAllCategories)}
                    className="px-4 py-2 rounded-full text-[10px] font-extrabold uppercase tracking-[0.22em] border border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5 transition"
                  >
                    {showAllCategories ? "Show Less" : "Show More"}
                  </button>
                )}
              </div>

              {/* Featured first */}
              {blogs.length > 0 && (
                <Link to={`/blog/${blogs[0].slug}`} className="block mb-10">
                  <Card className="rounded-3xl border-border overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all">
                    {blogs[0].featured_image && (
                      <div className="relative">
                        <img
                          src={normalizeAssetUrl(blogs[0].featured_image) || "/images/icc-2.jpg"}
                          alt={blogs[0].title}
                          className="w-full h-72 bg-muted object-cover"
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (!target.dataset.fallbackApplied) {
                              target.dataset.fallbackApplied = "true";
                              target.src = "/images/icc-2.jpg";
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-primary/10 to-transparent" />
                        <div className="absolute bottom-5 left-5 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.22em]">
                          <span className="px-3 py-1 rounded-full bg-accent text-accent-foreground shadow">
                            {t("Featured")}
                          </span>
                          <span className="text-primary-foreground/90">
                            {(blogs[0].categories || []).join(", ")}
                          </span>
                        </div>
                      </div>
                    )}

                    <CardContent className="py-6 space-y-3">
                      {!blogs[0].featured_image && (
                        <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.22em]">
                          <span className="px-3 py-1 rounded-full bg-accent/15 text-accent border border-accent/25">
                            Featured
                          </span>
                          <span className="text-muted-foreground">
                            {(blogs[0].categories || []).join(", ")}
                          </span>
                        </div>
                      )}

                      <h2 className="font-heading text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
                        {blogs[0].title}
                      </h2>

                      <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                        {blogs[0].meta_description}
                      </p>

                      <span className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.22em] text-primary hover:text-accent transition">
                        {t("Continue Reading")} →
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              )}

              {/* Rest list */}
              <div className="space-y-8">
                {blogs
                  .slice(1)
                  .map((b) => (
                    <Link key={b.slug} to={`/blog/${b.slug}`}>
                      <Card className="rounded-3xl mb-4 border-border overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all">
                        <div className="grid grid-cols-1 md:grid-cols-5">
                          <div className="md:col-span-2">
                            {b.featured_image && (
                              <div className="w-full h-52 flex items-center justify-center bg-muted border-b md:border-b-0 md:border-r border-border">
                                <img
                                  src={normalizeAssetUrl(b.featured_image) || "/images/icc-2.jpg"}
                                  alt={b.title}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.currentTarget;
                                    if (!target.dataset.fallbackApplied) {
                                      target.dataset.fallbackApplied = "true";
                                      target.src = "/images/icc-2.jpg";
                                    }
                                  }}
                                />
                              </div>
                            )}
                          </div>

                          <CardContent className="md:col-span-3 p-6 space-y-3">
                            <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-secondary">
                              {(b.categories || []).join(", ")}
                            </div>

                            <div className="font-heading text-lg md:text-xl font-extrabold tracking-tight text-foreground">
                              {b.title}
                            </div>

                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {b.meta_description}
                            </p>

                            <span className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.22em] text-primary hover:text-accent transition">
                              {t("Read article")} →
                            </span>
                          </CardContent>
                        </div>
                      </Card>
                    </Link>
                  ))}

                {blogs.length <= 1 && (
                  <div className="text-sm text-muted-foreground">{t("No more articles")}</div>
                )}
              </div>

              {/* Pagination */}
              <div className="mt-8 flex items-center justify-center gap-3">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-5 py-3 rounded-2xl border border-border bg-card text-[10px] font-extrabold uppercase tracking-[0.22em] disabled:opacity-50 hover:border-primary/40 hover:bg-primary/5 transition"
                >
                  {t("Previous")}
                </button>

                <span className="text-xs font-extrabold text-foreground">
                  Page <span className="text-primary">{page}</span>
                </span>

                <button
                  onClick={() => setPage((p) => p + 1)}
                  className="px-5 py-3 rounded-2xl border border-border bg-card text-[10px] font-extrabold uppercase tracking-[0.22em] hover:border-primary/40 hover:bg-primary/5 transition"
                >
                  {t("Next")}
                </button>
              </div>
            </div>

            {/* Sidebar */}
            <aside className="space-y-6">
              <Card className="rounded-3xl border-border shadow-sm">
                <CardHeader className="py-4">
                  <CardTitle className="font-heading text-sm font-extrabold">
                    {t("Search articles")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-6">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      key="sidebar-search-input"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t("Search topics...")}
                      className="w-full pl-11 pr-10 py-3 rounded-2xl border border-border bg-card text-xs font-extrabold uppercase tracking-[0.18em] focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition"
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-border shadow-sm">
                <CardHeader className="py-4">
                  <CardTitle className="font-heading text-sm font-extrabold">
                    {t("Categories")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-6 space-y-2">
                  <button
                    key="all"
                    onClick={() => {
                      setPage(1);
                      setCategory("");
                    }}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-2xl border border-border bg-card text-[10px] font-extrabold uppercase tracking-[0.22em] hover:bg-primary/5 hover:border-primary/40 transition",
                      category === "" &&
                      "bg-primary/10 border-primary/30"
                    )}
                  >
                    All
                  </button>
                  {(showAllCategories ? categories : categories.slice(0, 7)).map(cat => (
                    <button
                      key={cat.slug}
                      onClick={() => {
                        setPage(1);
                        setCategory(cat.slug);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-2xl border border-border bg-card text-[10px] font-extrabold uppercase tracking-[0.22em] hover:bg-primary/5 hover:border-primary/40 transition",
                        category === cat.slug &&
                        "bg-primary/10 border-primary/30"
                      )}
                    >
                      {cat.name}
                    </button>
                  ))}
                  {categories.length > 7 && (
                    <button
                      onClick={() => setShowAllCategories(!showAllCategories)}
                      className="w-full text-left px-4 py-3 rounded-2xl border border-border bg-card text-[10px] font-extrabold uppercase tracking-[0.22em] hover:bg-primary/5 hover:border-primary/40 transition"
                    >
                      {showAllCategories ? "Show Less" : "Show More"}
                    </button>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-border shadow-sm">
                <CardHeader className="py-4">
                  <CardTitle className="font-heading text-sm font-extrabold">
                    {t("Trending Topics")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-6 space-y-3">
                  {blogs.slice(0, 5).map((b) => (
                    <Link
                      key={b.slug}
                      to={`/blog/${b.slug}`}
                      className="block text-sm text-muted-foreground hover:text-foreground transition"
                    >
                      <span className="font-semibold">{b.title}</span>
                    </Link>
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-border shadow-sm overflow-hidden">
                <CardHeader className="py-4">
                  <CardTitle className="font-heading text-sm font-extrabold">
                    {t("Never miss an update")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-6 space-y-3">
                  <input
                    placeholder={t("Enter your email")}
                    className="w-full px-4 py-3 rounded-2xl border border-border bg-card text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition"
                  />
                  <button className="w-full px-4 py-3 rounded-2xl bg-primary text-primary-foreground text-[10px] font-extrabold uppercase tracking-[0.22em] hover:bg-primary-dark transition">
                    {t("Subscribe")}
                  </button>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("Get curated updates, career tips & course announcements.")}
                  </p>
                </CardContent>
              </Card>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
};

export default BlogListPage;
