import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2, Pencil, Trash2, List, LayoutGrid, CheckCircle2, XCircle, Info, Book, HelpCircle, Upload, Image as ImageIcon, Link as LinkIcon, FileSpreadsheet } from "lucide-react";
import { BulkCsvUploadModal } from "@/components/BulkCsvUploadModal";
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
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

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
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16 relative">
        {/* Ambient background glows */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />

        {/* Page Header */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <LayoutGrid className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-heading font-black text-2xl md:text-3xl text-white uppercase tracking-tight">
                  Course Categories
                </h1>
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                  {categories.length} Categories
                </span>
              </div>
              <p className="text-slate-400 mt-1 text-xs md:text-sm font-medium">
                Define high-level groupings and taxonomies for your academic offerings.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="px-5 py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg hover:border-indigo-500/40"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Bulk Import
            </button>
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
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all transform active:scale-95"
                >
                  <Plus className="w-4 h-4" /> Add Category
                </button>
              </DialogTrigger>
              <DialogContent className="rounded-3xl border border-indigo-500/30 bg-slate-950/95 backdrop-blur-3xl text-slate-100 max-h-[90vh] flex flex-col shadow-2xl p-6 sm:p-8">
                <DialogHeader className="border-b border-slate-800/80 pb-4">
                  <DialogTitle className="font-heading font-black text-xl text-white uppercase tracking-tight flex items-center gap-2">
                    <LayoutGrid className="w-5 h-5 text-indigo-400" />
                    {isEditing ? "Edit Category" : "Create New Category"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-400">
                    {isEditing ? "Modify category details and branding." : "Fill in details below to register a new course grouping."}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto pr-1">
                  <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Category Name *</label>
                      <input
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                        placeholder="e.g. Computer Science & IT"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Category Code *</label>
                      <input
                        required
                        value={form.category_code}
                        onChange={(e) => setForm({ ...form, category_code: e.target.value })}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                        placeholder="e.g. CAT-CSIT-01"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Description</label>
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all min-h-[90px]"
                        placeholder="Provide a summary of programs under this category..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Image URL (Optional)</Label>
                      <input
                        value={form.image_url}
                        onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                        placeholder="https://example.com/banner.jpg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Or Upload Image</Label>
                      <div className="w-full h-36 rounded-2xl border-2 border-dashed border-slate-800 flex items-center justify-center bg-slate-900/50 relative group overflow-hidden">
                        {form.image_url ? (
                          <img src={normalizeAssetUrl(form.image_url)} alt="" className="w-full h-full object-cover rounded-2xl" />
                        ) : (
                          <div className="text-center p-4">
                            <ImageIcon className="w-8 h-8 text-slate-500 mx-auto mb-1" />
                            <p className="text-xs font-bold text-slate-400 uppercase">No image uploaded</p>
                          </div>
                        )}
                        <label className="absolute inset-0 bg-indigo-950/80 backdrop-blur-sm flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                          <Upload className="w-6 h-6 text-indigo-400 mb-1" />
                          <span className="text-xs font-bold text-white uppercase tracking-wider">Choose File</span>
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
                        <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold">
                          <Loader2 className="w-4 h-4 animate-spin" /> Uploading image...
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Sort Order</label>
                        <input
                          type="number"
                          value={form.sort_order}
                          onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                          className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Status</label>
                        <select
                          value={form.status}
                          onChange={(e) => setForm({ ...form, status: e.target.value })}
                          className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                    <DialogFooter className="pt-4 border-t border-slate-800/80">
                      <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        {isEditing ? "Update Category" : "Save Category"}
                      </button>
                    </DialogFooter>
                  </form>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Step-by-step Instructions Banner */}
        {showInstructions && (
          <div className="bg-slate-900/90 backdrop-blur-2xl border border-indigo-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden animate-in slide-in-from-top duration-500">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Info className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Category Setup Guide</h3>
                  <p className="text-xs text-slate-400">Essential rules for creating academic course hierarchies</p>
                </div>
              </div>
              <button
                onClick={() => setShowInstructions(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-3">
                <h4 className="font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                  <Book className="w-4 h-4" /> Recommended Steps
                </h4>
                <ul className="space-y-2">
                  {[
                    "Click 'Add Category' to create main academic streams.",
                    "Assign a unique category code (e.g., CAT-IT-01).",
                    "Add descriptive info to clearly state course domain.",
                    "Keep status 'Active' to display in student and center registration forms."
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-slate-300">
                      <span className="w-5 h-5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center shrink-0 font-bold text-[10px]">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" /> Example Streams
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl">
                    <p className="font-bold text-indigo-400 uppercase text-[10px] mb-1">Information Tech</p>
                    <p className="text-white font-semibold mb-0.5">Computer Courses</p>
                    <p className="text-slate-400 text-[10px]">DCA, ADCA, Tally Prime, Web Dev.</p>
                  </div>
                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl">
                    <p className="font-bold text-purple-400 uppercase text-[10px] mb-1">Vocational</p>
                    <p className="text-white font-semibold mb-0.5">Skill Training</p>
                    <p className="text-slate-400 text-[10px]">Short-term job oriented certification.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Categories Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Categories...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl p-16 flex flex-col items-center text-center">
            <LayoutGrid className="w-12 h-12 text-slate-600 mb-4 opacity-40" />
            <h3 className="text-lg font-bold text-white uppercase tracking-tight">No Categories Found</h3>
            <p className="text-slate-400 text-xs max-w-sm mt-1 mb-6">
              Create your first category to start organizing your academic courses and curriculum.
            </p>
            <button
              onClick={() => setIsAdding(true)}
              className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create Category
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 hover:border-indigo-500/50 rounded-3xl overflow-hidden shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 group flex flex-col"
              >
                {/* Image Banner */}
                <div className="h-44 relative overflow-hidden bg-slate-950">
                  <img
                    src={normalizeAssetUrl(cat.image_url) || CATEGORY_FALLBACK_IMAGE}
                    alt={cat.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
                  
                  {/* Category Code Badge */}
                  <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md border border-slate-700/60 text-indigo-300 text-[10px] font-mono font-bold px-3 py-1 rounded-xl shadow-lg">
                    {cat.category_code}
                  </div>

                  {/* Status Indicator */}
                  <div className="absolute top-3 right-3">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border backdrop-blur-md shadow-lg",
                      cat.status === "active"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                    )}>
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        cat.status === "active" ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                      )} />
                      {cat.status}
                    </span>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="font-heading font-black text-lg text-white group-hover:text-indigo-300 transition-colors uppercase tracking-tight flex items-center gap-2">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-3 mt-2 leading-relaxed">
                      {cat.description || "No description provided."}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <span className="font-medium text-[11px] text-slate-400">
                      Created {format(new Date(cat.created_at), "dd MMM yyyy")}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(cat)}
                        className="p-2 rounded-xl bg-slate-800/80 hover:bg-indigo-600/20 hover:text-indigo-300 border border-slate-700/60 hover:border-indigo-500/40 text-slate-300 transition-all"
                        title="Edit Category"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-600/20 hover:text-rose-400 border border-slate-700/60 hover:border-rose-500/40 text-slate-300 transition-all"
                        title="Delete Category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CSV Modal */}
        <BulkCsvUploadModal
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          title="Bulk Import Course Categories"
          description="Upload multiple course categories at once using a CSV spreadsheet file."
          uploadEndpoint="/api/admin/categories/bulk"
          sampleFilename="course_categories_template.csv"
          onSuccess={fetchCategories}
          columns={[
            { key: "name", label: "Category Name", required: true },
            { key: "category_code", label: "Category Code", required: true },
            { key: "description", label: "Description" },
            { key: "status", label: "Status" },
          ]}
          sampleData={[
            {
              name: "Computer Science and IT",
              category_code: "CAT-CSIT-01",
              description: "Courses related to computer fundamentals, software, and IT skills.",
              status: "active",
            },
            {
              name: "Vocational and Skill Training",
              category_code: "CAT-VOC-02",
              description: "Short term employment oriented skill certificates.",
              status: "active",
            },
          ]}
        />
      </div>
    </DashboardLayout>
  );
};

export default AdminCourseCategoriesPage;
