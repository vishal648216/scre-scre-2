import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2, Pencil, Trash2, List, LayoutGrid, CheckCircle2, XCircle, Info, Book, HelpCircle, Upload, Image as ImageIcon, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { cn, normalizeAssetUrl } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { format } from "date-fns";
import { useLocation } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Category {
  id: string;
  name: string;
  category_code: string;
  description?: string;
  status: string;
  created_at: string;
  image_url?: string;
  imageUrl?: string;
  image?: string;
  sort_order?: number;
}

const CATEGORY_FALLBACK_IMAGE = "/images/icc-3.jpg";

function resolveCategoryImage(cat: Partial<Category> | null | undefined): string {
  return (cat?.image_url || cat?.imageUrl || cat?.image || "").trim();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

/** Resize + JPEG encode so multipart + JSON payloads stay small (fixes axum/nginx default limits). */
async function shrinkImageForUpload(file: File): Promise<{ blob: Blob; filename: string }> {
  if (!file.type.startsWith("image/")) {
    return { blob: file, filename: file.name };
  }
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1920;
    let w = bitmap.width;
    let h = bitmap.height;
    if (w > maxSide || h > maxSide) {
      if (w >= h) {
        h = Math.round((h * maxSide) / w);
        w = maxSide;
      } else {
        w = Math.round((w * maxSide) / h);
        h = maxSide;
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return { blob: file, filename: file.name };
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.88);
    });
    const base = file.name.replace(/\.[^.]+$/, "") || "category-image";
    return { blob, filename: `${base}.jpg` };
  } catch {
    return { blob: file, filename: file.name };
  }
}

const AdminCourseCategoriesPage = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const fromCourses = searchParams.get("from") === "courses";

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    category_code: "",
    description: "",
    status: "active",
    image_url: "",
    sort_order: 0,
  });

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setUploading(true);
    const { blob: uploadBlob, filename: uploadName } = await shrinkImageForUpload(file);
    const formData = new FormData();
    formData.append("file", uploadBlob, uploadName);

    try {
      const response = await apiFetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      let data: { url?: string; message?: string } = {};
      try {
        data = await response.json();
      } catch {
        /* non-JSON */
      }
      if (response.ok && data.url) {
        setForm((prev) => ({ ...prev, image_url: data.url as string }));
        toast.success("Category image uploaded");
      } else {
        const inlineImage = await blobToDataUrl(uploadBlob);
        setForm((prev) => ({ ...prev, image_url: inlineImage }));
        toast.success(data.message ? `Upload issue — embedded for save (${data.message})` : "Image embedded for save");
      }
    } catch (error) {
      try {
        const fb = await blobToDataUrl(uploadBlob);
        setForm((prev) => ({ ...prev, image_url: fb }));
        toast.success("Image embedded for save (upload unavailable)");
      } catch {
        console.error("Upload error:", error);
        toast.error("An error occurred during upload");
      }
    } finally {
      setUploading(false);
    }
    e.target.value = "";
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (fromCourses) {
      setShowInstructions(true);
    }
  }, [fromCourses]);

  const fetchCategories = async () => {
    try {
      const response = await apiFetch("/api/admin/categories");
      const data = await response.json();
      if (response.ok) {
        const fetchedCats = (data.items || []).map((cat: Category) => ({
          ...cat,
          image_url: resolveCategoryImage(cat),
        }));
        setCategories(fetchedCats);
        if (fetchedCats.length === 0) {
          setShowInstructions(true);
        }
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = form.category_code.trim();
    if (!code) {
      toast.error("Category code is required (enter a unique code, e.g. CAT-IT-01)");
      return;
    }
    setSaving(true);
    try {
      const url = isEditing ? `/api/admin/categories/${selectedCategory?.id}` : "/api/admin/categories";
      const method = isEditing ? "PUT" : "POST";

      // Send only `image_url` — do not also send `imageUrl`. Serde aliases map them to the same
      // field; having both keys in one JSON object triggers duplicate-field deserialize errors → 422.
      const payload: Record<string, any> = {
        name: form.name,
        category_code: code,
        description: form.description || undefined,
        status: form.status,
        sort_order: form.sort_order,
      };
      const trimmedImg = form.image_url.trim();
      if (trimmedImg) {
        payload.image_url = trimmedImg;
      }

      const response = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast.success(isEditing ? "Category updated" : "Category created");
        setIsAdding(false);
        setIsEditing(false);
        setForm({ name: "", category_code: "", description: "", status: "active", image_url: "", sort_order: 0 });
        fetchCategories();
      } else {
        const text = await response.text();
        let msg = text.slice(0, 500) || "Operation failed";
        try {
          const data = JSON.parse(text) as { message?: string };
          if (data?.message) msg = data.message;
        } catch {
          /* body was plain text (e.g. Axum 422 JSON schema rejection) */
        }
        toast.error(msg);
      }
    } catch (error) {
      console.error("AdminCategoriesPage: Submit error:", error);
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (cat: Category) => {
    setSelectedCategory(cat);
    setForm({
      name: cat.name,
      category_code: cat.category_code || "",
      description: cat.description || "",
      status: cat.status,
      image_url: resolveCategoryImage(cat),
      sort_order: cat.sort_order || 0,
    });
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      const response = await apiFetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      if (response.ok) {
        toast.success("Category deleted");
        fetchCategories();
      } else {
        const data = await response.json();
        toast.error(data.message || "Delete failed");
      }
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        {showInstructions && (
          <Card className="rounded-none border-primary/50 bg-primary/5 shadow-sm overflow-hidden animate-in slide-in-from-top duration-500">
            <CardHeader className="bg-primary/10 border-b border-primary/20 py-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <Info className="w-4 h-4 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-primary">
                    How to Create Course Categories
                  </CardTitle>
                  <p className="text-[10px] font-bold text-primary/70 uppercase">Step-by-step guide for academic organization</p>
                </div>
              </div>
              <button
                onClick={() => setShowInstructions(false)}
                className="p-1 hover:bg-primary/20 rounded-full transition-colors"
              >
                <XCircle className="w-5 h-5 text-primary" />
              </button>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-tight flex items-center gap-2">
                  <Book className="w-4 h-4 text-primary" /> The Process
                </h4>
                <ul className="space-y-3">
                  {[
                    "Click 'Add New Category' button.",
                    "Enter a clear name for the category (e.g., Computer Courses).",
                    "Enter a unique category code (same idea as course codes).",
                    "Add a brief description to help identify the category purpose.",
                    "Set status to 'Active' to make it available for course mapping."
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3 text-xs font-medium text-muted-foreground">
                      <span className="w-5 h-5 bg-primary/20 text-primary rounded-full flex items-center justify-center shrink-0 text-[10px] font-black">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-tight flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-primary" /> Examples
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  <div className="p-3 bg-background border border-border/50 rounded-none shadow-sm">
                    <p className="text-[10px] font-black uppercase text-primary mb-1">Example 1: IT Programs</p>
                    <p className="text-xs font-bold mb-1">Name: Diploma in Computer Application</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">Description: Basic and advanced computer courses including Office, Tally, and Graphics.</p>
                  </div>
                  <div className="p-3 bg-background border border-border/50 rounded-none shadow-sm">
                    <p className="text-[10px] font-black uppercase text-primary mb-1">Example 2: Vocational</p>
                    <p className="text-xs font-bold mb-1">Name: Skill Development</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">Description: Short term job-oriented training programs for various industries.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Course Categories</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Define high-level groupings for your courses.</p>
          </div>
          <Dialog open={isAdding || isEditing} onOpenChange={(open) => {
            if (!open) {
              setIsAdding(false);
              setIsEditing(false);
              setForm({ name: "", category_code: "", description: "", status: "active", image_url: "", sort_order: 0 });
            }
          }}>
            <DialogTrigger asChild>
              <button
                onClick={() => setIsAdding(true)}
                className="bg-primary text-primary-foreground px-6 py-3 rounded-none font-heading font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:opacity-90 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add New Category
              </button>
            </DialogTrigger>
            <DialogContent className="rounded-none border-border max-h-[85vh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="font-heading font-bold uppercase tracking-tight">
                  {isEditing ? "Edit Category" : "Add New Category"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Fill in the details below to {isEditing ? "update the existing" : "create a new"} course category.
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto pr-1">
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category Name</label>
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                      placeholder="e.g. Computer Application"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category Code *</label>
                    <input
                      required
                      value={form.category_code}
                      onChange={(e) => setForm({ ...form, category_code: e.target.value })}
                      className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                      placeholder="e.g. CAT-IT-01 (must be unique)"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary min-h-[100px]"
                      placeholder="Enter category description..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Image URL (Optional)</Label>
                    <div className="flex gap-2">
                      <input
                        value={form.image_url}
                        onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                        className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                        placeholder="https://example.com/image.jpg"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Or Upload Image</Label>
                    <div className="w-full h-40 border-2 border-dashed border-border flex items-center justify-center bg-muted/20 relative group overflow-hidden rounded-md">
                      {form.image_url ? (
                        <img src={normalizeAssetUrl(form.image_url)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center p-4">
                          <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-1" />
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">No image</p>
                        </div>
                      )}
                      <label className="absolute inset-0 bg-primary/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <Upload className="w-6 h-6 text-white mb-1" />
                        <span className="text-[10px] font-black text-white uppercase">Upload</span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={uploadImage}
                          disabled={uploading}
                        />
                      </label>
                    </div>
                    {uploading && (
                      <div className="flex items-center gap-2 text-primary text-xs font-bold">
                        <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sort Order (Optional)</label>
                    <input
                      type="number"
                      value={form.sort_order}
                      onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                      className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                      placeholder="e.g. 1, 2, 3..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <DialogFooter className="pt-4">
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full bg-primary text-primary-foreground py-4 font-heading font-black text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {isEditing ? "Update Category" : "Create Category"}
                    </button>
                  </DialogFooter>
                </form>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : categories.length === 0 ? (
          <Card className="rounded-none border-dashed border-2 border-border">
            <CardContent className="py-20 flex flex-col items-center text-center">
              <LayoutGrid className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-lg font-bold uppercase tracking-tight">No Categories Found</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2">
                Start by creating a course category to organize your academic programs.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat) => (
              <Card key={cat.id} className="rounded-none border-border group hover:border-primary transition-all overflow-hidden">
                <div className="h-36 overflow-hidden">
                  <img
                    src={normalizeAssetUrl(cat.image_url) || CATEGORY_FALLBACK_IMAGE}
                    alt={cat.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between py-4">
                  <div className="space-y-1">
                    <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-primary" />
                      {cat.name}
                    </CardTitle>
                    <div className="text-[10px] font-mono text-muted-foreground">{cat.category_code}</div>
                  </div>
                  <div className={cn(
                    "text-[8px] font-black uppercase px-2 py-1 tracking-widest",
                    cat.status === "active" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                  )}>
                    {cat.status}
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground line-clamp-3 min-h-[60px]">
                    {cat.description || "No description provided."}
                  </p>
                  <div className="mt-6 pt-6 border-t border-border flex items-center justify-between">
                    <div className="text-[10px] text-muted-foreground font-medium">
                      Created: {format(new Date(cat.created_at), "dd MMM yyyy")}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(cat)}
                        className="p-2 border border-border hover:border-primary hover:text-primary transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        className="p-2 border border-border hover:border-red-500 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminCourseCategoriesPage;
