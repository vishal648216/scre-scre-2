import React, { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  Loader2,
  BookOpen,
  Download,
  FileText,
  Upload,
  Trash2,
  Folder,
  FolderOpen,
  ChevronRight,
  Video,
  Book,
  Layers,
  Sparkles,
  LayoutGrid,
  ListTree,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Subject {
  id: string;
  subject_name: string;
}

interface Material {
  id: string;
  subject_id: string;
  title: string;
  description?: string;
  file_url: string;
  created_at: string;
  class_level?: string;
  media_type?: string; // "book" | "video"
  chapter_name?: string;
}

const DEFAULT_CLASSES = [
  "10th Class",
  "12th Class",
  "DCA (Diploma in Computer Applications)",
  "ADCA (Advance Diploma)",
  "PGDCA",
  "Vocational / Skill",
  "General / All",
];

const AdminStudyMaterialPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // View mode: 'tree' | 'grid'
  const [viewMode, setViewMode] = useState<"tree" | "grid">("tree");
  const [filterClass, setFilterClass] = useState<string>("all");
  const [filterMedia, setFilterMedia] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  // Hierarchy expand state
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({
    "10th Class": true,
  });
  const [expandedMedia, setExpandedMedia] = useState<Record<string, boolean>>({});
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState({
    subject_id: "",
    title: "",
    description: "",
    file_url: "",
    class_level: "10th Class",
    media_type: "book",
    chapter_name: "Chapter 1: Basics",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subsRes, materialsRes] = await Promise.all([
        apiFetch("/api/admin/subjects"),
        apiFetch("/api/academic/study-materials"),
      ]);

      const subsData = await subsRes.json();
      const materialsData = await materialsRes.json();

      if (subsRes.ok) setSubjects(subsData.items || []);
      if (materialsRes.ok) {
        const raw = Array.isArray(materialsData) ? materialsData : [];
        setMaterials(
          raw.map((m: Record<string, unknown>) => ({
            id: String(m.id || m._id || ""),
            subject_id: String(m.subject_id || ""),
            title: String(m.title || ""),
            description: m.description ? String(m.description) : undefined,
            file_url: String(m.file_url || ""),
            created_at: String(m.created_at || new Date().toISOString()),
            class_level: m.class_level ? String(m.class_level) : "10th Class",
            media_type: m.media_type ? String(m.media_type) : "book",
            chapter_name: m.chapter_name ? String(m.chapter_name) : "General Chapter",
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load study materials");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = sessionStorage.getItem("token");
      const response = await fetch("/api/uploads", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await response.json();
      if (response.ok && data.url) {
        setForm({ ...form, file_url: data.url });
        toast.success("File uploaded successfully");
      } else {
        toast.error(data.message || "Upload failed");
      }
    } catch (error) {
      toast.error("An error occurred during upload");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject_id || !form.file_url || !form.title) {
      toast.error("Please fill all required fields and provide a file URL or upload a file");
      return;
    }
    setSaving(true);
    try {
      const response = await apiFetch("/api/academic/study-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (response.ok) {
        toast.success("Study material added successfully!");
        setIsAdding(false);
        setForm({
          subject_id: "",
          title: "",
          description: "",
          file_url: "",
          class_level: "10th Class",
          media_type: "book",
          chapter_name: "Chapter 1: Basics",
        });
        fetchData();
      } else {
        const data = await response.json().catch(() => null);
        toast.error(data?.message || "Operation failed");
      }
    } catch (error) {
      toast.error("An error occurred saving material");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this study material?")) return;
    setDeletingId(id);
    try {
      const res = await apiFetch(`/api/academic/study-materials/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Material deleted successfully");
        setMaterials((prev) => prev.filter((m) => m.id !== id));
      } else {
        toast.error("Failed to delete material");
      }
    } catch (err) {
      toast.error("Error deleting material");
    } finally {
      setDeletingId(null);
    }
  };

  const getSubjectName = (id: string) => subjects.find((s) => s.id === id)?.subject_name || "Unknown Subject";

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      if (filterClass !== "all" && m.class_level !== filterClass) return false;
      if (filterMedia !== "all" && m.media_type !== filterMedia) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        const titleMatch = m.title.toLowerCase().includes(s);
        const subjMatch = getSubjectName(m.subject_id).toLowerCase().includes(s);
        const chapterMatch = (m.chapter_name || "").toLowerCase().includes(s);
        if (!titleMatch && !subjMatch && !chapterMatch) return false;
      }
      return true;
    });
  }, [materials, filterClass, filterMedia, search, subjects]);

  // Nested hierarchy: Class -> Media (Books / Videos) -> Subject -> Chapter -> Items
  const hierarchy = useMemo(() => {
    const tree: Record<
      string,
      Record<string, Record<string, Record<string, Material[]>>>
    > = {};

    filteredMaterials.forEach((m) => {
      const cls = m.class_level || "General";
      const med = m.media_type === "video" ? "Videos 🎥" : "Books & Notes 📖";
      const subj = getSubjectName(m.subject_id);
      const ch = m.chapter_name || "General Chapter";

      if (!tree[cls]) tree[cls] = {};
      if (!tree[cls][med]) tree[cls][med] = {};
      if (!tree[cls][med][subj]) tree[cls][med][subj] = {};
      if (!tree[cls][med][subj][ch]) tree[cls][med][subj][ch] = [];

      tree[cls][med][subj][ch].push(m);
    });

    return tree;
  }, [filteredMaterials, subjects]);

  const toggleExpand = (setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>, key: string) => {
    setter((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16 relative">
        {/* Ambient background glows */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />

        {/* Page Header Banner */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Layers className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-heading font-black text-2xl md:text-3xl text-white uppercase tracking-tight">
                  Study Material Explorer
                </h1>
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                  {materials.length} Resources
                </span>
              </div>
              <p className="text-slate-400 mt-1 text-xs md:text-sm font-medium">
                Organize curriculum resources by Class level, Media Type, Subject, and Chapters.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800">
              <button
                onClick={() => setViewMode("tree")}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all",
                  viewMode === "tree"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <ListTree className="w-4 h-4" />
                Folder Hierarchy
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all",
                  viewMode === "grid"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
                Grid View
              </button>
            </div>

            <Dialog open={isAdding} onOpenChange={setIsAdding}>
              <DialogTrigger asChild>
                <button className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all transform active:scale-95">
                  <Plus className="w-4 h-4" /> Add Material
                </button>
              </DialogTrigger>
              <DialogContent className="rounded-3xl border border-indigo-500/30 bg-slate-950/95 backdrop-blur-3xl text-slate-100 shadow-2xl p-6 sm:p-8 sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                <DialogHeader className="border-b border-slate-800/80 pb-4">
                  <DialogTitle className="font-heading font-black text-xl text-white uppercase tracking-tight flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    Upload Study Material
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-400">
                    Fill in hierarchy details (Class ➡️ Media ➡️ Subject ➡️ Chapter) and upload resource files.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Class / Level *</label>
                      <select
                        value={form.class_level}
                        onChange={(e) => setForm({ ...form, class_level: e.target.value })}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                      >
                        {DEFAULT_CLASSES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Media Type *</label>
                      <select
                        value={form.media_type}
                        onChange={(e) => setForm({ ...form, media_type: e.target.value })}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                      >
                        <option value="book">Book / PDF Notes 📖</option>
                        <option value="video">Video Lecture 🎥</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Subject *</label>
                      <select
                        required
                        value={form.subject_id}
                        onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                      >
                        <option value="">Select Subject</option>
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.subject_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Chapter / Unit</label>
                      <input
                        value={form.chapter_name}
                        onChange={(e) => setForm({ ...form, chapter_name: e.target.value })}
                        placeholder="e.g. Chapter 1: Introduction"
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Material Title *</label>
                    <input
                      required
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. Class 10th Mathematics Formulas & Notes"
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Description / Summary</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Brief details about topics covered in this resource..."
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300">File / Video Resource *</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="material-upload"
                      />
                      <label
                        htmlFor="material-upload"
                        className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-slate-800 rounded-2xl p-4 cursor-pointer hover:border-indigo-500 hover:bg-slate-900/60 transition-all text-xs text-slate-400 font-bold uppercase tracking-wider"
                      >
                        {uploading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                        ) : (
                          <Upload className="w-4 h-4 text-indigo-400" />
                        )}
                        <span>{form.file_url ? `Uploaded: ${form.file_url.split("/").pop()}` : "Upload PDF/Docs File"}</span>
                      </label>
                    </div>

                    <div className="pt-2">
                      <label className="text-[11px] text-slate-400 block mb-1">Or Direct Resource URL (YouTube, Cloud Storage):</label>
                      <input
                        value={form.file_url}
                        onChange={(e) => setForm({ ...form, file_url: e.target.value })}
                        placeholder="https://..."
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  <DialogFooter className="pt-4 border-t border-slate-800/80">
                    <button
                      type="submit"
                      disabled={saving || uploading}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                      Save Study Material
                    </button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filter Bar Card */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-5 shadow-2xl flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              placeholder="Search by title, subject, chapter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>
          <div className="w-56">
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-xs font-bold text-slate-200 uppercase tracking-wider focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Classes / Levels</option>
              {DEFAULT_CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="w-44">
            <select
              value={filterMedia}
              onChange={(e) => setFilterMedia(e.target.value)}
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-xs font-bold text-slate-200 uppercase tracking-wider focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Media Types</option>
              <option value="book">Books / PDFs 📖</option>
              <option value="video">Videos 🎥</option>
            </select>
          </div>
          <span className="px-4 py-2 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold text-xs">
            {filteredMaterials.length} Resources
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Study Materials...</p>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl p-16 flex flex-col items-center text-center">
            <BookOpen className="w-12 h-12 text-slate-600 mb-4 opacity-40" />
            <h3 className="text-lg font-bold text-white uppercase tracking-tight">No Materials Found</h3>
            <p className="text-slate-400 text-xs max-w-sm mt-1 mb-6">
              No study resources match the selected filters. Click "Add Material" to upload the first file.
            </p>
            <button
              onClick={() => setIsAdding(true)}
              className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Material
            </button>
          </div>
        ) : viewMode === "tree" ? (
          /* Tree / Folder Hierarchy View */
          <div className="space-y-4">
            {Object.entries(hierarchy).map(([className, mediaMap]) => {
              const isClassExpanded = !!expandedClasses[className];
              const totalInClass = Object.values(mediaMap).reduce(
                (acc, subjMap) =>
                  acc +
                  Object.values(subjMap).reduce(
                    (sAcc, chMap) =>
                      sAcc + Object.values(chMap).reduce((cAcc, list) => cAcc + list.length, 0),
                    0
                  ),
                0
              );

              return (
                <div
                  key={className}
                  className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl overflow-hidden shadow-2xl transition-all"
                >
                  {/* Level 1: Class Header */}
                  <div
                    onClick={() => toggleExpand(setExpandedClasses, className)}
                    className="flex items-center justify-between p-5 cursor-pointer bg-slate-950/60 hover:bg-slate-950/80 transition-all select-none border-b border-slate-800/80"
                  >
                    <div className="flex items-center gap-3">
                      {isClassExpanded ? (
                        <FolderOpen className="w-6 h-6 text-amber-400 fill-amber-400/20" />
                      ) : (
                        <Folder className="w-6 h-6 text-amber-400 fill-amber-400/20" />
                      )}
                      <span className="font-heading font-black text-lg text-white uppercase tracking-tight">{className}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 text-xs font-bold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {totalInClass} {totalInClass === 1 ? "Item" : "Items"}
                      </span>
                      <ChevronRight
                        className={cn(
                          "w-5 h-5 text-slate-400 transition-transform duration-200",
                          isClassExpanded && "rotate-90 text-indigo-400"
                        )}
                      />
                    </div>
                  </div>

                  {/* Level 2: Media Type */}
                  {isClassExpanded && (
                    <div className="p-6 space-y-4 pl-8">
                      {Object.entries(mediaMap).map(([mediaType, subjectMap]) => {
                        const mediaKey = `${className}-${mediaType}`;
                        const isMediaExpanded = expandedMedia[mediaKey] ?? true;

                        return (
                          <div key={mediaKey} className="border-l-2 border-indigo-500/30 pl-5 space-y-4">
                            <div
                              onClick={() => toggleExpand(setExpandedMedia, mediaKey)}
                              className="flex items-center gap-2.5 cursor-pointer text-sm font-bold text-slate-200 hover:text-indigo-400 transition-colors select-none"
                            >
                              <ChevronRight
                                className={cn(
                                  "w-4 h-4 text-slate-500 transition-transform",
                                  isMediaExpanded && "rotate-90 text-indigo-400"
                                )}
                              />
                              {mediaType.includes("Video") ? (
                                <Video className="w-4 h-4 text-purple-400" />
                              ) : (
                                <Book className="w-4 h-4 text-emerald-400" />
                              )}
                              <span className="uppercase tracking-wider text-xs">{mediaType}</span>
                            </div>

                            {/* Level 3: Subject */}
                            {isMediaExpanded && (
                              <div className="pl-5 space-y-4">
                                {Object.entries(subjectMap).map(([subjectName, chapterMap]) => {
                                  const subjKey = `${mediaKey}-${subjectName}`;
                                  const isSubjExpanded = expandedSubjects[subjKey] ?? true;

                                  return (
                                    <div
                                      key={subjKey}
                                      className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3"
                                    >
                                      <div
                                        onClick={() => toggleExpand(setExpandedSubjects, subjKey)}
                                        className="flex items-center justify-between cursor-pointer select-none"
                                      >
                                        <div className="flex items-center gap-2.5">
                                          <ChevronRight
                                            className={cn(
                                              "w-4 h-4 text-slate-500 transition-transform",
                                              isSubjExpanded && "rotate-90 text-indigo-400"
                                            )}
                                          />
                                          <BookOpen className="w-4 h-4 text-indigo-400" />
                                          <span className="font-bold text-sm text-white uppercase tracking-tight">
                                            {subjectName}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Level 4: Chapter */}
                                      {isSubjExpanded && (
                                        <div className="pl-6 pt-2 space-y-4">
                                          {Object.entries(chapterMap).map(([chapterName, items]) => (
                                            <div key={chapterName} className="space-y-2">
                                              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                                {chapterName} ({items.length})
                                              </div>

                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                                {items.map((item) => (
                                                  <div
                                                    key={item.id}
                                                    className="flex items-center justify-between p-4 rounded-xl border border-slate-800/80 bg-slate-900/90 hover:border-indigo-500/50 transition-all"
                                                  >
                                                    <div className="flex items-center gap-3 min-w-0 pr-2">
                                                      <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                                                        <FileText className="w-4 h-4" />
                                                      </div>
                                                      <div className="truncate">
                                                        <div className="font-bold text-white text-xs truncate uppercase tracking-tight">
                                                          {item.title}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                                          {item.description || "Resource document file"}
                                                        </div>
                                                      </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                      <a
                                                        href={item.file_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 rounded-xl bg-slate-800 hover:bg-indigo-600/20 hover:text-indigo-300 border border-slate-700/60 text-slate-300 transition-all"
                                                        title="Download / View Resource"
                                                      >
                                                        {item.media_type === "video" ? (
                                                          <ExternalLink className="w-3.5 h-3.5" />
                                                        ) : (
                                                          <Download className="w-3.5 h-3.5" />
                                                        )}
                                                      </a>
                                                      <button
                                                        onClick={() => handleDelete(item.id)}
                                                        disabled={deletingId === item.id}
                                                        className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600/20 hover:text-rose-400 border border-slate-700/60 text-slate-300 transition-all disabled:opacity-50"
                                                        title="Delete"
                                                      >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                      </button>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMaterials.map((m) => (
              <div
                key={m.id}
                className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 hover:border-indigo-500/50 rounded-3xl p-6 shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 group flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                      {m.class_level || "General"}
                    </span>
                    {m.media_type === "video" ? (
                      <span className="p-2 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-xl">
                        <Video className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl">
                        <Book className="w-4 h-4" />
                      </span>
                    )}
                  </div>
                  <h3 className="font-heading font-black text-base text-white group-hover:text-indigo-300 transition-colors uppercase tracking-tight">
                    {m.title}
                  </h3>
                </div>

                <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80 text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Subject:</span>
                    <span className="font-bold text-white uppercase">{getSubjectName(m.subject_id)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Chapter:</span>
                    <span className="font-bold text-white uppercase">{m.chapter_name || "General"}</span>
                  </div>
                  {m.description && (
                    <p className="text-slate-400 text-xs line-clamp-2 pt-2 border-t border-slate-800">
                      {m.description}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-400">
                    {format(new Date(m.created_at), "dd MMM yyyy")}
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href={m.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-slate-800 hover:bg-indigo-600/20 hover:text-indigo-300 border border-slate-700/60 text-slate-300 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => handleDelete(m.id)}
                      disabled={deletingId === m.id}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600/20 hover:text-rose-400 border border-slate-700/60 text-slate-300 transition-all disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminStudyMaterialPage;
