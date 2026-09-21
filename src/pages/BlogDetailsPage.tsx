import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import Header from "@/components/Header";
import { apiFetch } from "@/lib/api";

interface BlogDetail {
  title: string;
  slug: string;
  content: string;
  meta_title?: string;
  meta_description?: string;
  featured_image?: string;
  categories?: string[];
}

interface BlogSummary {
  title: string;
  slug: string;
  meta_description?: string;
  featured_image?: string;
  categories?: string[];
}

const BlogDetailsPage = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isPreview = searchParams.get("preview") === "true";
  const [loading, setLoading] = useState(true);
  const [blog, setBlog] = useState<BlogDetail | null>(null);
  const [related, setRelated] = useState<BlogSummary[]>([]);
  const [allBlogs, setAllBlogs] = useState<BlogSummary[]>([]);

  useEffect(() => {
    (async () => {
      if (!slug) return;
      setLoading(true);
      try {
        const res = await apiFetch(isPreview ? `/api/admin/blog/by-slug/${encodeURIComponent(slug)}` : `/api/blogs/${encodeURIComponent(slug)}`);
        if (res.ok) {
          const b = await res.json();
          setBlog(b);

          // Fetch sidebar data separately - don't block main blog load
          try {
            const resAll = await apiFetch("/api/blogs?limit=10");
            const allData = await resAll.json();
            if (Array.isArray(allData)) {
              setAllBlogs(allData);
            }
          } catch (err) {
            console.error("Failed to fetch all blogs for sidebar", err);
          }

          try {
            const cat = (b.categories || [])[0];
            const resRel = await apiFetch(`/api/blogs?category=${encodeURIComponent(cat || "")}`);
            const relData = await resRel.json();
            if (Array.isArray(relData)) {
              setRelated(relData.filter((x) => x.slug !== slug).slice(0, 4));
            }
          } catch (err) {
            console.error("Failed to fetch related blogs", err);
          }
        }
      } catch (e) {
        console.error("Failed to load blog", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, isPreview]);

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!blog) return <div className="max-w-4xl mx-auto py-10 text-sm text-muted-foreground">Blog not found</div>;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <section className="bg-muted/30 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => navigate("/blog")}
              className="p-2 border border-border hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
          <nav className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Link to="/">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link to="/blog">Blog</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">{blog.title}</span>
          </nav>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <h1 className="font-heading font-extrabold text-3xl md:text-4xl text-foreground tracking-tight">{blog.title}</h1>
            {blog.featured_image && (
              <img src={blog.featured_image} alt={blog.title} className="w-full h-96 object-fill border border-border rounded-2xl" />
            )}
            <Card className="rounded-3xl border-border overflow-hidden">
              <CardContent
                className="prose prose-sm max-w-none p-6 md:p-8 overflow-x-hidden"
                dangerouslySetInnerHTML={{ __html: blog.content }}
              />
            </Card>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            <Card className="rounded-3xl border-border shadow-sm overflow-hidden">
              <CardHeader className="py-4">
                <CardTitle className="font-heading text-sm font-extrabold">
                  Related Posts
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-6 space-y-4">
                {(related.length > 0 ? related : allBlogs.filter((x) => x.slug !== slug)).slice(0, 4).map((r) => (
                  <Link key={r.slug} to={`/blog/${r.slug}`} className="block group">
                    <Card className="rounded-2xl border-border overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all">
                      {r.featured_image && (
                        <img
                          src={r.featured_image}
                          alt={r.title}
                          className="w-full h-36 object-cover border-b border-border"
                        />
                      )}
                      <CardContent className="p-4 space-y-2">
                        <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground">
                          {(r.categories || []).join(", ")}
                        </div>
                        <h3 className="font-heading text-sm font-extrabold tracking-tight text-foreground group-hover:text-primary transition">
                          {r.title}
                        </h3>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
                {related.length === 0 && allBlogs.length === 0 && (
                  <p className="text-sm text-muted-foreground px-4">No other posts available</p>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>

      <style>{`
        /* Never override inline styles - let them take precedence */
        /* Basic styles for media */
        .prose img,
        .prose video,
        .prose .youtube-embed-container {
          max-width: 100%;
          max-height: 700px;
          object-fit: contain;
          margin: 24px 0;
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
        /* Prevent content overflow */
        .prose {
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .prose * {
          max-width: 100%;
        }
        .prose pre {
          overflow-x: auto;
        }
        .prose table {
          display: block;
          overflow-x: auto;
        }
      `}</style>
    </div>
  );
};

export default BlogDetailsPage;
