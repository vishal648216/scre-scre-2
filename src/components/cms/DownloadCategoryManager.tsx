import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil, Save, X, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";
import CMSManager from "./CMSManager";

interface DownloadCategory {
  _id?: string;
  name: string;
  description: string;
  order: number;
  active: boolean;
}

const DownloadCategoryManager = () => {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<DownloadCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DownloadCategory | null>(null);
  const [form, setForm] = useState<DownloadCategory>({
    name: "",
    description: "",
    order: 0,
    active: true,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await apiFetch("/api/download-categories");
      if (res.ok) {
        setCategories(await res.json());
      }
    } catch (err) {
      toast.error(t("Failed to fetch categories"));
    } finally {
      setLoading(false);
    }
  };

  if (selectedCategory) {
    return (
      <CMSManager 
        category="download" 
        title={`${t("Downloads in")} ${selectedCategory.name}`}
        downloadCategoryId={selectedCategory._id}
        onBack={() => setSelectedCategory(null)}
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = editingId ? `/api/download-categories/${editingId}` : "/api/download-categories";
      const method = editingId ? "PUT" : "POST";
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success(t(editingId ? "Category updated" : "Category created"));
        setEditingId(null);
        setForm({ name: "", description: "", order: 0, active: true });
        fetchCategories();
      }
    } catch (err) {
      toast.error(t("Failed to save category"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("Are you sure? All downloads in this category will become un-categorized."))) return;
    try {
      const res = await apiFetch(`/api/download-categories/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("Category deleted"));
        fetchCategories();
      }
    } catch (err) {
      toast.error(t("Failed to delete"));
    }
  };

  const startEdit = (cat: DownloadCategory) => {
    setEditingId(cat._id || null);
    setForm(cat);
  };

  if (loading) return <div className="p-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <Card className="rounded-none border-border shadow-md">
        <CardHeader className="bg-muted/30 border-b border-border py-4">
          <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">
            {t(editingId ? "Edit Category" : "Add New Download Category")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Category Name")}</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t("e.g. Syllabus, Brochures")}
                  className="rounded-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Display Order")}</Label>
                <Input
                  type="number"
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) })}
                  className="rounded-none"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Description")}</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t("Short description...")}
                className="rounded-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              {editingId && (
                <Button variant="outline" type="button" onClick={() => { setEditingId(null); setForm({ name: "", description: "", order: 0, active: true }); }} className="rounded-none uppercase text-[10px] font-black tracking-widest h-10 px-6">
                  {t("Cancel")}
                </Button>
              )}
              <Button type="submit" disabled={submitting} className="rounded-none gap-2 uppercase text-[10px] font-black tracking-widest h-10 px-6">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t(editingId ? "Update Category" : "Save Category")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((cat) => (
          <Card 
            key={cat._id} 
            className="rounded-none border-border group overflow-hidden hover:border-primary/50 transition-all cursor-pointer hover:shadow-lg bg-card/50"
            onClick={() => setSelectedCategory(cat)}
          >
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="font-black text-sm uppercase tracking-tight group-hover:text-primary transition-colors">{cat.name}</h3>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{cat.description || t("No description")}</p>
                </div>
                <div className="text-[10px] font-black bg-primary/10 text-primary px-3 py-1.5 uppercase tracking-widest">{t("Order")}: {cat.order}</div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-border/50">
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button variant="outline" size="sm" onClick={() => startEdit(cat)} className="h-8 w-8 p-0 rounded-none hover:bg-primary hover:text-white transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => cat._id && handleDelete(cat._id)} className="h-8 w-8 p-0 rounded-none">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary group-hover:translate-x-1 transition-transform">
                  {t("Manage Downloads")}
                  <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DownloadCategoryManager;
