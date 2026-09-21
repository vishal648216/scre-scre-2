import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Pencil, Globe, Filter, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";

interface NewsItem {
  id: string;
  title: string;
  slug: string;
  category?: string;
  status: "draft" | "published";
  published_at?: string;
}

const AdminNewsListPage = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    fetchNews();
  }, [page, limit, statusFilter, categoryFilter, search]);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (search.trim()) params.set("search", search.trim());
      
      const res = await apiFetch(`/api/admin/news?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setTotal(data.total || 0);
        // Prune selected set
        const ids = new Set((data.items || []).map((n: NewsItem) => n.id));
        setSelected(prev => {
          const next = new Set<string>();
          prev.forEach(id => { if (ids.has(id)) next.add(id); });
          return next;
        });
      }
    } catch (e) {
      toast.error("Failed to load news");
    } finally {
      setLoading(false);
    }
  };

  const publishNews = async (id: string) => {
    try {
      const res = await apiFetch(`/api/admin/news/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({ status: "published", published_at: new Date().toISOString() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Published");
        fetchNews();
      } else {
        toast.error(data.message || "Publish failed");
      }
    } catch {
      toast.error("Publish failed");
    }
  };

  const unpublishNews = async (id: string) => {
    try {
      const res = await apiFetch(`/api/admin/news/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({ status: "draft" }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Unpublished");
        fetchNews();
      } else {
        toast.error(data.message || "Unpublish failed");
      }
    } catch {
      toast.error("Unpublish failed");
    }
  };

  const deleteNews = async (id: string) => {
    if (!confirm("Delete this news? This cannot be undone.")) return;
    try {
      const res = await apiFetch(`/api/admin/news/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Deleted");
        fetchNews();
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
          apiFetch(`/api/admin/news/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify({ status: "published", published_at: new Date().toISOString() }),
          })
        )
      );
      toast.success("Published selected");
      clearSelection();
      fetchNews();
    } catch {
      toast.error("Bulk publish failed");
    }
  };

  const bulkUnpublish = async () => {
    if (selected.size === 0) return;
    try {
      await Promise.all(
        Array.from(selected).map(id =>
          apiFetch(`/api/admin/news/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify({ status: "draft" }),
          })
        )
      );
      toast.success("Unpublished selected");
      clearSelection();
      fetchNews();
    } catch {
      toast.error("Bulk unpublish failed");
    }
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected news? This cannot be undone.`)) return;
    try {
      await Promise.all(
        Array.from(selected).map(id =>
          apiFetch(`/api/admin/news/${encodeURIComponent(id)}`, {
            method: "DELETE",
          })
        )
      );
      toast.success("Deleted selected");
      clearSelection();
      fetchNews();
    } catch {
      toast.error("Bulk delete failed");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllCurrent = () => {
    setSelected(new Set(filtered.map(n => n.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const categories = Array.from(new Set(items.map(i => i.category).filter(Boolean))) as string[];
  const filtered = items.filter(n => {
    const statusOk = statusFilter === "all" ? true : n.status === statusFilter;
    const categoryOk = categoryFilter === "all" ? true : (n.category || "").toLowerCase() === categoryFilter.toLowerCase();
    const s = search.trim().toLowerCase();
    const searchOk = s ? (n.title.toLowerCase().includes(s) || n.slug.toLowerCase().includes(s)) : true;
    return statusOk && categoryOk && searchOk;
  });

  const exportCSV = () => {
    const header = ["Title", "Slug", "Category", "Status", "Published At"];
    const rows = filtered.map(n => [
      n.title,
      n.slug,
      n.category || "",
      n.status,
      n.published_at || "",
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
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-10">
        <div className="flex items-center justify-between">
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Latest News</h1>
          <button onClick={() => navigate("/dashboard/cms/news/new")} className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <Plus className="w-4 h-4" /> New News
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-2">Status</label>
            <select value={statusFilter} onChange={e => { setPage(1); setStatusFilter(e.target.value as typeof statusFilter); }} className="px-3 py-2 border border-border bg-background text-sm">
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-2">Category</label>
            <select value={categoryFilter} onChange={e => { setPage(1); setCategoryFilter(e.target.value); }} className="px-3 py-2 border border-border bg-background text-sm">
              <option value="all">All</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-2">Search</label>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Title or slug" className="px-3 py-2 border border-border bg-background text-sm w-full"/>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-2">Per Page</label>
            <select value={limit} onChange={e => { setPage(1); setLimit(Number(e.target.value)); }} className="px-3 py-2 border border-border bg-background text-sm">
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
            <button onClick={exportCSV} className="px-3 py-2 border border-border text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <Filter className="w-4 h-4"/> Export CSV (Page)
            </button>
            <button
              onClick={async () => {
                try {
                  const params = new URLSearchParams();
                  if (statusFilter !== "all") params.set("status", statusFilter);
                  if (categoryFilter !== "all") params.set("category", categoryFilter);
                  if (search.trim()) params.set("search", search.trim());
                  const res = await apiFetch(`/api/admin/news/export?${params.toString()}`);
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "news_all.csv";
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
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">All News</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary"/></div>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex items-center justify-between px-4 py-2 text-xs">
                  <div className="font-mono">Page {page} of {Math.max(1, Math.ceil(total / Math.max(1, limit)))}</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-2 py-1 border border-border disabled:opacity-50">Prev</button>
                    <button onClick={() => setPage(p => p + 1)} disabled={page * limit >= total} className="px-2 py-1 border border-border disabled:opacity-50">Next</button>
                  </div>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">
                        <input
                          type="checkbox"
                          checked={filtered.length > 0 && filtered.every(n => selected.has(n.id))}
                          onChange={e => {
                            if (e.target.checked) selectAllCurrent();
                            else clearSelection();
                          }}
                        />
                      </th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Status</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Title</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Slug</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Category</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((n) => (
                      <tr key={n.slug} className="border-b border-border hover:bg-muted/10">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(n.id)}
                            onChange={() => toggleSelect(n.id)}
                          />
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest border ${n.status === "published" ? "border-green-600 text-green-700" : "border-yellow-600 text-yellow-700"}`}>
                            {n.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-bold">{n.title}</td>
                        <td className="px-4 py-3 text-xs font-mono">{n.slug}</td>
                        <td className="px-4 py-3 text-xs">{n.category || "-"}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center gap-2 justify-center">
                            {n.status === "published" && (
                              <Link to={`/news/${n.slug}`} className="p-2 border border-border hover:bg-muted" title="View">
                                <Globe className="w-4 h-4"/>
                              </Link>
                            )}
                            <Link to={`/dashboard/cms/news/edit/${encodeURIComponent(n.slug)}`} className="p-2 border border-border hover:bg-muted" title="Edit">
                              <Pencil className="w-4 h-4"/>
                            </Link>
                            {n.status === "draft" ? (
                              <button onClick={() => publishNews(n.id)} className="p-2 border border-border hover:bg-muted" title="Publish">
                                <span className="text-[10px] uppercase font-bold">Publish</span>
                              </button>
                            ) : (
                              <button onClick={() => unpublishNews(n.id)} className="p-2 border border-border hover:bg-muted" title="Unpublish">
                                <span className="text-[10px] uppercase font-bold">Unpublish</span>
                              </button>
                            )}
                            <button onClick={() => deleteNews(n.id)} className="p-2 border border-border hover:bg-muted" title="Delete">
                              <Trash2 className="w-4 h-4"/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-muted-foreground">No news</td></tr>
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

export default AdminNewsListPage;
