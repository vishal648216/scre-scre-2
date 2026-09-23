import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { normalizeAssetUrl } from "@/lib/utils";

interface NewsDetail {
  id: string;
  title: string;
  slug: string;
  content: string;
  featured_image?: string;
  category?: string;
  meta_title?: string;
  meta_description?: string;
  published_at?: string;
}

interface NewsSummary {
  title: string;
  slug: string;
  featured_image?: string;
  category?: string;
  meta_description?: string;
}

const NewsDetailsPage = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isPreview = searchParams.get("preview") === "true";
  const [loading, setLoading] = useState(true);
  const [news, setNews] = useState<NewsDetail | null>(null);
  const [related, setRelated] = useState<NewsSummary[]>([]);

  useEffect(() => {
    (async () => {
      if (!slug) return;
      setLoading(true);
      try {
        const res = await apiFetch(isPreview ? `/api/admin/news/by-slug/${encodeURIComponent(slug)}` : `/api/news/${encodeURIComponent(slug)}`);
        if (res.ok) {
          const n: NewsDetail = await res.json();
          setNews(n);
          const cat = n.category || "";
          const resRel = await fetch(`/api/news?category=${encodeURIComponent(cat)}`);
          const relData = await resRel.json();
          const list = (relData || []) as NewsSummary[];
          setRelated(list.filter((x) => x.slug !== slug).slice(0, 4));
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, [slug, isPreview]);

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary"/></div>;
  if (!news) return <div className="max-w-4xl mx-auto py-10 text-sm text-muted-foreground">News not found</div>;

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-muted/30 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <button 
              onClick={() => navigate("/news")}
              className="p-2 border border-border hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
          <nav className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Link to="/">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link to="/news">News</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">{news.title}</span>
          </nav>
          <h1 className="font-heading font-extrabold text-3xl text-foreground tracking-tight mt-2">{news.title}</h1>
          {news.meta_description && (
            <p className="text-sm text-muted-foreground mt-1">{news.meta_description}</p>
          )}
        </div>
      </section>

      {news.featured_image && (
        <div className="border-b border-border">
          <img
            src={normalizeAssetUrl(news.featured_image) || "/images/icc-1.jpg"}
            alt={news.title}
            className="w-full max-h-[420px] object-cover"
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.dataset.fallbackApplied) {
                target.dataset.fallbackApplied = "true";
                target.src = "/images/icc-1.jpg";
              }
            }}
          />
        </div>
      )}

      <section className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="rounded-none border-border">
              <CardContent className="prose prose-sm sm:prose lg:prose-lg max-w-none p-6">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">
                  {news.category || "-"}
                </div>
                <div dangerouslySetInnerHTML={{ __html: news.content }} />
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-1">
            <h2 className="text-base font-black tracking-tight mb-3">Related</h2>
            <div className="space-y-3">
              {related.map((r) => (
                <Link key={r.slug} to={`/news/${r.slug}`} className="block p-3 border border-border hover:border-primary/40 transition-all">
                  <div className="text-sm font-bold">{r.title}</div>
                  {r.meta_description && (
                    <div className="text-xs text-muted-foreground mt-1">{r.meta_description}</div>
                  )}
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">
                    {r.category || "-"}
                  </div>
                </Link>
              ))}
              {related.length === 0 && (
                <div className="text-sm text-muted-foreground">No related items</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <style>{`
        /* Never override inline styles - let them take precedence */
        .prose img,
        .prose video,
        .prose .youtube-embed-container {
          max-width: 100%;
          max-height: 700px;
          object-fit: contain;
          display: block;
          border-radius: 8px;
        }
        /* Only apply default sizes when there's NO inline style */
        .prose img:not([style*="width"]),
        .prose video:not([style*="width"]) {
          width: 100%;
          height: auto;
        }
        /* Hide editor overlay */
        .prose .youtube-embed-container .youtube-overlay {
          display: none;
        }
        /* Default YouTube size only when no inline width */
        .prose .youtube-embed-container iframe:not([style*="width"]),
        .prose iframe[src*="youtube.com"]:not([style*="width"]),
        .prose iframe[src*="youtu.be"]:not([style*="width"]) {
          width: 100%;
          height: 315px;
        }
        .prose .youtube-embed-container iframe,
        .prose iframe[src*="youtube.com"],
        .prose iframe[src*="youtu.be"] {
          max-width: 100%;
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
};

export default NewsDetailsPage;
