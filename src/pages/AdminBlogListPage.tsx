import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Pencil, Trash2, Globe } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";

interface BlogItem {
  id: string;
  title: string;
  slug: string;
  meta_title?: string;
  meta_description?: string;
  featured_image?: string;
  published_at?: string;
  categories?: string[];
  status: "draft" | "published";
  lang?: string;
  featured: boolean;
}

const AdminBlogListPage = () => {
  const [loading, setLoading] = useState(true);
  const [blogs, setBlogs] = useState<BlogItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">("all");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    setPage(1);
  }, [statusFilter, langFilter, search]);

  useEffect(() => {
    fetchBlogs();
  }, [statusFilter, langFilter, search, page, limit]);

  const fetchBlogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (langFilter !== "all") params.set("lang", langFilter);
      if (search.trim()) params.set("search", search.trim());
      params.set("page", String(page));
      params.set("limit", String(limit));
      const qs = params.toString();
      const res = await apiFetch(`/api/admin/blogs${qs ? `?${qs}` : ""}`);
      const data = await res.json();
      if (res.ok) {
        setBlogs(data.items || []);
        setTotal(data.total || 0);
        // prune selections to only those still visible in current page
        const ids = new Set((data.items || []).map((b: BlogItem) => b.id));
        setSelected(prev => {
          const next = new Set<string>();
          prev.forEach(id => { if (ids.has(id)) next.add(id); });
          return next;
        });
      }
    } catch (e) {
      toast.error("Failed to load blogs");
    } finally {
      setLoading(false);
    }
  };

  const languages = Array.from(new Set(blogs.map(b => b.lang).filter(Boolean))) as string[];
  const filtered = blogs.filter(b => {
    const statusOk = statusFilter === "all" ? true : b.status === statusFilter;
    const langOk = langFilter === "all" ? true : (b.lang || "").toLowerCase() === langFilter.toLowerCase();
    const s = search.trim().toLowerCase();
    const searchOk = s ? (b.title.toLowerCase().includes(s) || b.slug.toLowerCase().includes(s)) : true;
    return statusOk && langOk && searchOk;
  });

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAllCurrent = () => {
    setSelected(new Set(filtered.map(b => b.id)));
  };
  const clearSelection = () => setSelected(new Set());

  const publishBlog = async (id: string) => {
    try {
      const res = await apiFetch(`/api/admin/blog/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({ status: "published", published_at: new Date().toISOString() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Published");
        fetchBlogs();
      } else {
        toast.error(data.message || "Publish failed");
      }
    } catch {
      toast.error("Publish failed");
    }
  };

  const unpublishBlog = async (id: string) => {
    try {
      const res = await apiFetch(`/api/admin/blog/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({ status: "draft" }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Unpublished");
        fetchBlogs();
      } else {
        toast.error(data.message || "Unpublish failed");
      }
    } catch {
      toast.error("Unpublish failed");
    }
  };

  const deleteBlog = async (id: string) => {
    if (!confirm("Delete this blog? This cannot be undone.")) return;
    try {
      const res = await apiFetch(`/api/admin/blog/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Deleted");
        fetchBlogs();
      } else {
        toast.error(data.message || "Delete failed");
      }
    } catch {
      toast.error("Delete failed");
    }
  };

  const bulkPublish = async () => {
    if (selected.size === 0) return;
    try {
      await Promise.all(
        Array.from(selected).map(id =>
          apiFetch(`/api/admin/blog/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify({ status: "published", published_at: new Date().toISOString() }),
          })
        )
      );
      toast.success("Published selected");
      clearSelection();
      fetchBlogs();
    } catch {
      toast.error("Bulk publish failed");
    }
  };

  const bulkUnpublish = async () => {
    if (selected.size === 0) return;
    try {
      await Promise.all(
        Array.from(selected).map(id =>
          apiFetch(`/api/admin/blog/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify({ status: "draft" }),
          })
        )
      );
      toast.success("Unpublished selected");
      clearSelection();
      fetchBlogs();
    } catch {
      toast.error("Bulk unpublish failed");
    }
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected blog(s)? This cannot be undone.`)) return;
    try {
      await Promise.all(
        Array.from(selected).map(id =>
          apiFetch(`/api/admin/blog/${encodeURIComponent(id)}`, {
            method: "DELETE",
          })
        )
      );
      toast.success("Deleted selected");
      clearSelection();
      fetchBlogs();
    } catch {
      toast.error("Bulk delete failed");
    }
  };

  const exportCSV = () => {
    const header = ["Title", "Slug", "Status", "Lang", "Categories", "Published At"];
    const rows = filtered.map(b => [
      b.title,
      b.slug,
      b.status,
      b.lang || "",
      (b.categories || []).join(";"),
      b.published_at || "",
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
    a.download = `blogs_page${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Blogs</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/dashboard/cms/blog-categories")} className="bg-muted text-foreground px-4 py-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-border">
              Blog Categories
            </button>
            <button onClick={() => navigate("/dashboard/cms/blogs/new")} className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Blog
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-2">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className="px-3 py-2 border border-border bg-background text-sm">
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-2">Language</label>
            <select value={langFilter} onChange={e => setLangFilter(e.target.value)} className="px-3 py-2 border border-border bg-background text-sm">
              <option value="all">All</option>
              {languages.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-2">Search</label>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Title or slug" className="px-3 py-2 border border-border bg-background text-sm w-full" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-2">Per Page</label>
            <select value={limit} onChange={e => setLimit(Number(e.target.value))} className="px-3 py-2 border border-border bg-background text-sm">
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={selectAllCurrent} className="px-3 py-2 border border-border">Select Page</button>
            <button onClick={clearSelection} className="px-3 py-2 border border-border">Clear</button>
            <button onClick={bulkPublish} disabled={selected.size === 0} className="px-3 py-2 border border-border disabled:opacity-50">Publish Selected</button>
            <button onClick={bulkUnpublish} disabled={selected.size === 0} className="px-3 py-2 border border-border disabled:opacity-50">Unpublish Selected</button>
            <button onClick={bulkDelete} disabled={selected.size === 0} className="px-3 py-2 border border-border disabled:opacity-50">Delete Selected</button>
            <button onClick={exportCSV} className="px-3 py-2 border border-border">Export CSV (Page)</button>
            <button
              onClick={async () => {
                try {
                  const params = new URLSearchParams();
                  if (statusFilter !== "all") params.set("status", statusFilter);
                  if (langFilter !== "all") params.set("lang", langFilter);
                  if (search.trim()) params.set("search", search.trim());
                  const qs = params.toString();
                  const res = await apiFetch(`/api/admin/blogs/export${qs ? `?${qs}` : ""}`);
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `blogs_all.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  toast.error("Export failed");
                }
              }}
              className="px-3 py-2 border border-border"
            >
              Export CSV (All)
            </button>
          </div>
        </div>

        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">All Blogs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex items-center justify-between px-4 py-2 text-xs">
                  <div className="font-mono">Page {page} of {Math.max(1, Math.ceil(total / Math.max(1, limit)))}</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-2 py-1 border border-border disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={page * limit >= total}
                      className="px-2 py-1 border border-border disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">
                        <input
                          type="checkbox"
                          checked={filtered.length > 0 && filtered.every(b => selected.has(b.id))}
                          onChange={e => {
                            if (e.target.checked) selectAllCurrent(); else clearSelection();
                          }}
                        />
                      </th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Title</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Status</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Featured</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Slug</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Lang</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Categories</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((b) => (
                      <tr key={b.slug} className="border-b border-border hover:bg-muted/10">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(b.id)}
                            onChange={() => toggleSelect(b.id)}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-bold">{b.title}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest border ${b.status === "published" ? "border-green-600 text-green-700" : "border-yellow-600 text-yellow-700"}`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {b.featured ? (
                            <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest border border-blue-600 text-blue-700">Featured</span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono">{b.slug}</td>
                        <td className="px-4 py-3 text-xs font-mono">{b.lang || "-"}</td>
                        <td className="px-4 py-3 text-xs">{b.categories?.join(", ") || "-"}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center gap-2 justify-center">
                            {b.status === "published" && (
                              <Link to={`/blog/${b.slug}`} className="p-2 border border-border hover:bg-muted" title="View">
                                <Globe className="w-4 h-4" />
                              </Link>
                            )}
                            <Link to={`/dashboard/cms/blogs/edit/${encodeURIComponent(b.slug)}`} className="p-2 border border-border hover:bg-muted" title="Edit">
                              <Pencil className="w-4 h-4" />
                            </Link>
                            {b.status === "draft" ? (
                              <button onClick={() => publishBlog(b.id)} className="p-2 border border-border hover:bg-muted" title="Publish">
                                <span className="text-[10px] uppercase font-bold">Publish</span>
                              </button>
                            ) : (
                              <button onClick={() => unpublishBlog(b.id)} className="p-2 border border-border hover:bg-muted" title="Unpublish">
                                <span className="text-[10px] uppercase font-bold">Unpublish</span>
                              </button>
                            )}
                            <button onClick={() => deleteBlog(b.id)} className="p-2 border border-border hover:bg-muted" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-10 text-center text-xs text-muted-foreground">No blogs</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminBlogListPage;
