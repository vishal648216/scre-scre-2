import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Upload, X, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "@/lib/api";

type Status = "draft" | "published";

const AdminNewsEditorPage = () => {
  const { slug } = useParams();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newsId, setNewsId] = useState("");
  const [title, setTitle] = useState("");
  const [slugValue, setSlugValue] = useState("");
  const [content, setContent] = useState("");
  const [featuredImage, setFeaturedImage] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<Status>("draft");
  const [publishedAt, setPublishedAt] = useState<string>("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [tenantId, setTenantId] = useState("");
  const navigate = useNavigate();

  const handleFeaturedImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await apiFetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setFeaturedImage(data.url);
        toast.success("Featured image updated");
      } else {
        toast.error(data.message || "Upload failed");
      }
    } catch (err) {
      toast.error("Error uploading file");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (slug) {
      loadExisting(slug);
    }
  }, [slug]);

  const loadExisting = async (s: string) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/news/by-slug/${encodeURIComponent(s)}`);
      if (res.status === 200) {
        const n = await res.json();
        setNewsId(n.id || "");
        setTitle(n.title || "");
        setSlugValue(n.slug || "");
        setContent(n.content || "");
        setFeaturedImage(n.featured_image || "");
        setCategory(n.category || "");
        setStatus(n.status || "draft");
        setPublishedAt(n.published_at || "");
        setMetaTitle(n.meta_title || "");
        setMetaDescription(n.meta_description || "");
      }
    } catch {
      toast.error("Failed to load news");
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    setLoading(true);
    try {
      const payload = {
        tenant_id: tenantId || null,
        title,
        slug: slugValue,
        content,
        featured_image: featuredImage || null,
        category: category || null,
        status,
        published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
        meta_title: metaTitle || null,
        meta_description: metaDescription || null,
      };
      const res = await apiFetch(slug ? `/api/admin/news/${encodeURIComponent(newsId)}` : "/api/admin/news", {
        method: slug ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(slug ? "News updated" : "News created");
        navigate("/dashboard/cms/news");
      } else {
        toast.error(data.message || "Save failed");
      }
    } catch {
      toast.error("Save failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate("/dashboard/cms/news")}
              className="p-2 border border-border hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">{slug ? "Edit News" : "Create News"}</h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                const win = window.open(`/news/${slugValue}?preview=true`, '_blank');
                win?.focus();
              }}
              disabled={!slugValue}
              className="bg-muted text-muted-foreground px-4 py-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-muted/80 disabled:opacity-50"
            >
              Preview
            </button>
            <button onClick={onSave} className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>
        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">News Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="news-title" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Title</label>
                <input id="news-title" name="title" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm" />
              </div>
              <div>
                <label htmlFor="news-slug" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Slug</label>
                <input id="news-slug" name="slug" value={slugValue} onChange={e => setSlugValue(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm" />
              </div>
              <div>
                <label htmlFor="news-category" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category</label>
                <input id="news-category" name="category" value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm" />
              </div>
              <div>
                <label htmlFor="news-featured-image" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Featured Image</label>
                <div className="flex gap-2">
                  <input id="news-featured-image" name="featured_image" value={featuredImage} onChange={e => setFeaturedImage(e.target.value)} className="flex-1 px-3 py-2 border border-border bg-background text-sm" placeholder="Image URL" />
                  <div className="relative">
                    <button className="bg-muted hover:bg-muted/80 p-2 border border-border flex items-center justify-center">
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    </button>
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFeaturedImageUpload(e.target.files[0]);
                        }
                      }}
                    />
                  </div>
                </div>
                {featuredImage && (
                  <div className="mt-2 relative group w-32 aspect-video">
                    <img src={featuredImage} className="w-full h-full object-cover border border-border" alt="Preview" />
                    <button
                      onClick={() => setFeaturedImage("")}
                      className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="news-status" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</label>
                  <select id="news-status" name="status" value={status} onChange={e => setStatus(e.target.value as Status)} className="w-full px-3 py-2 border border-border bg-background text-sm">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="news-published-at" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Publish At (UTC)</label>
                  <input id="news-published-at" name="published_at" type="datetime-local" value={publishedAt} onChange={e => setPublishedAt(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm" />
                </div>
              </div>
              <div>
                <label htmlFor="news-meta-title" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Meta Title</label>
                <input id="news-meta-title" name="meta_title" value={metaTitle} onChange={e => setMetaTitle(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm" />
              </div>
              <div>
                <label htmlFor="news-meta-description" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Meta Description</label>
                <input id="news-meta-description" name="meta_description" value={metaDescription} onChange={e => setMetaDescription(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm" />
              </div>
              <div>
                <label htmlFor="news-tenant-id" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tenant ID (optional)</label>
                <input id="news-tenant-id" name="tenant_id" value={tenantId} onChange={e => setTenantId(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm" />
              </div>
            </div>
            <div>
              <label htmlFor="news-content" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rich Text Editor</label>
              <textarea id="news-content" name="content" value={content} onChange={e => setContent(e.target.value)} rows={12} className="w-full px-3 py-2 border border-border bg-background text-sm" />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminNewsEditorPage;
