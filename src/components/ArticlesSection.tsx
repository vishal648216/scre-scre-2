import { ArrowRight, CalendarDays, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useHomeData } from "@/hooks/useHomeData";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

interface BlogSummary {
  title: string;
  slug: string;
  meta_title?: string;
  meta_description?: string;
  featured_image?: string;
  categories?: string[];
  status: "draft" | "published";
  published_at?: string;
  featured: boolean;
}

const ArticlesSection = () => {
  const { data: homeData } = useHomeData();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [blogs, setBlogs] = useState<BlogSummary[]>([]);

  useEffect(() => {
    const fetchFeaturedBlogs = async () => {
      try {
        const res = await apiFetch("/api/blogs/featured?limit=3");
        const data = await res.json();
        if (Array.isArray(data)) {
          setBlogs(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchFeaturedBlogs();
  }, []);

  const th = (key: string) => homeData?.static_texts?.[key] || t(key);

  return (
    <section className="pt-6 pb-16 bg-background relative overflow-hidden">
      <div className="container mx-auto px-4">

        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* ================= LEFT PANEL (UNCHANGED) ================= */}
          <div className="bg-primary text-primary-foreground rounded-3xl p-10 relative overflow-hidden shadow-xl">

            <div className="absolute top-0 left-0 h-full w-1 bg-accent"></div>

            <span className="text-accent text-xs font-bold uppercase tracking-widest">
              {th("Knowledge Center")}
            </span>

            <h2 className="text-4xl md:text-5xl font-extrabold mt-6 leading-tight">
              {th("Industry Insights")} <br />
              <span className="text-accent">{th("For Future Professionals")}</span>
            </h2>

            <p className="text-primary-foreground/80 mt-6 leading-relaxed">
              {t("Stay ahead with expert-written articles covering technology, marketing, finance, design, and career development. Our research-driven content delivers practical insights, industry analysis, and real-world strategies to help you build skills, make informed decisions, and remain competitive in an evolving job market.")}
            </p>

            <Link
              to="/blog"
              className="inline-flex items-center gap-2 mt-8 bg-accent text-accent-foreground font-bold px-6 py-3 rounded-xl hover:opacity-90 transition"
            >
              {th("Explore All Articles")}
              <ArrowRight size={18} />
            </Link>
          </div>

          {/* ================= RIGHT PANEL ================= */}
          <div className="space-y-8">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* ===== Featured Article ===== */}
                {blogs.length > 0 && (
                  <Link to={`/blog/${blogs[0].slug}`} className="block">
                    <div className="bg-card border border-border rounded-3xl p-8 hover-popup-subtle transition-all flex flex-col lg:h-[260px] relative group">
                      <span className="text-xs uppercase tracking-widest font-bold text-accent">
                        {blogs[0].categories?.[0] || th("Featured Article")}
                      </span>

                      <h3 className="text-2xl font-bold text-foreground mt-3 line-clamp-2 group-hover:text-primary transition-colors">
                        {blogs[0].title}
                      </h3>

                      <p className="text-muted-foreground text-sm mt-3 line-clamp-2">
                        {blogs[0].meta_description}
                      </p>

                      {blogs[0].published_at && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
                          <CalendarDays size={14} />
                          <span>{new Date(blogs[0].published_at).toLocaleDateString()}</span>
                        </div>
                      )}

                      <div className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-accent transition-colors">
                        {th("Read More")} <ArrowRight size={16} />
                      </div>
                    </div>
                  </Link>
                )}

                {/* ===== Bottom Two Equal Height Cards ===== */}
                {blogs.length > 1 && (
                  <div className="grid md:grid-cols-2 gap-6">
                    {blogs.slice(1, 3).map((blog, index) => (
                      <Link key={blog.slug} to={`/blog/${blog.slug}`} className="block">
                        <div className={`${index === 0 ? "bg-secondary/10 border border-secondary/20" : "bg-accent/5 border border-accent/20"} rounded-2xl p-6 flex flex-col lg:h-[220px] relative group hover-popup-subtle`}>
                          <span className="text-xs uppercase tracking-widest font-bold text-secondary">
                            {blog.categories?.[0] || (index === 0 ? th("Career Growth") : th("Design Industry"))}
                          </span>

                          <h4 className="font-bold text-foreground text-lg mt-3 line-clamp-2 group-hover:text-primary transition-colors">
                            {blog.title}
                          </h4>

                          <p className="text-muted-foreground text-sm mt-3 line-clamp-2">
                            {blog.meta_description}
                          </p>

                          <div className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-accent transition-colors">
                            {th("Read More")} <ArrowRight size={16} />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {blogs.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    {t("No featured articles yet.")}
                  </div>
                )}
              </>
            )}
          </div>

        </div>

      </div>
    </section>
  );
};

export default ArticlesSection;
