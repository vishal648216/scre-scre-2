
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Pencil, Trash2, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useNavigate } from "react-router-dom";

interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  lang?: string;
  created_at: string;
}

const AdminBlogCategoriesPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BlogCategory | null>(null);
  const [formData, setFormData] = useState({ name: "", lang: "en" });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/blog-categories");
      const data = await res.json();
      if (res.ok && data.items) {
        setCategories(data.items);
      }
    } catch (e) {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let res;
      if (editingCategory) {
        res = await apiFetch(`/api/admin/blog-categories/${editingCategory.id}`, {
          method: "PUT",
          body: JSON.stringify(formData),
        });
      } else {
        res = await apiFetch("/api/admin/blog-categories", {
          method: "POST",
          body: JSON.stringify(formData),
        });
      }
      if (res.ok) {
        toast.success(editingCategory ? "Category updated" : "Category created");
        setIsModalOpen(false);
        setEditingCategory(null);
        setFormData({ name: "", lang: "en" });
        fetchCategories();
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to save category");
      }
    } catch (e) {
      toast.error("Failed to save category");
    }
  };

  const handleEdit = (category: BlogCategory) => {
    setEditingCategory(category);
    setFormData({ name: category.name, lang: category.lang || "en" });
    setIsModalOpen(true);
  };

  const handleDelete = async (categoryId: string) => {
    if (!confirm("Delete this category? This cannot be undone.")) return;
    try {
      const res = await apiFetch(`/api/admin/blog-categories/${categoryId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Category deleted");
        fetchCategories();
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to delete category");
      }
    } catch (e) {
      toast.error("Failed to delete category");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard/cms/blogs")}
            className="p-2 border border-border hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Blog Categories</h1>
          <div className="flex-grow" />
          <button onClick={() => { setEditingCategory(null); setFormData({ name: "", lang: "en" }); setIsModalOpen(true); }} className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Category
          </button>
        </div>

        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">All Blog Categories</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Name</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Slug</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Lang</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => (
                      <tr key={cat.id} className="border-b border-border hover:bg-muted/10">
                        <td className="px-4 py-3 text-sm font-bold">{cat.name}</td>
                        <td className="px-4 py-3 text-xs font-mono">{cat.slug}</td>
                        <td className="px-4 py-3 text-xs">{cat.lang || "-"}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center gap-2 justify-center">
                            <button onClick={() => handleEdit(cat)} className="p-2 border border-border hover:bg-muted" title="Edit">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(cat.id)} className="p-2 border border-border hover:bg-muted" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {categories.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-10 text-center text-xs text-muted-foreground">No blog categories</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card p-6 rounded-lg shadow-lg w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">{editingCategory ? "Edit Category" : "New Category"}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-bold mb-1 block">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold mb-1 block">Language</label>
                  <input
                    type="text"
                    value={formData.lang}
                    onChange={(e) => setFormData({ ...formData, lang: e.target.value })}
                    className="w-full px-3 py-2 border border-border bg-background text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-border text-sm font-bold">Cancel</button>
                  <button type="submit" className="flex-1 bg-primary text-primary-foreground px-4 py-2 text-sm font-bold">{editingCategory ? "Update" : "Create"}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminBlogCategoriesPage;
