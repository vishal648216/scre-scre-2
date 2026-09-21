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
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-xl">
                <Layers className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold text-foreground">Study Material Explorer</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Organize curriculum resources by Class (e.g. 10th Class), Media Type, Subject, and Chapters.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-muted p-1 rounded-xl border">
              <Button
                variant={viewMode === "tree" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("tree")}
                className="gap-1.5 h-8"
              >
                <ListTree className="w-4 h-4" />
                Folder Hierarchy
              </Button>
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className="gap-1.5 h-8"
              >
                <LayoutGrid className="w-4 h-4" />
                Grid View
              </Button>
            </div>

            <Dialog open={isAdding} onOpenChange={setIsAdding}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow">
                  <Plus className="w-4 h-4" /> Add Material
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    Upload Study Material
                  </DialogTitle>
                  <DialogDescription>
                    Fill in the hierarchy details (Class ➡️ Media ➡️ Subject ➡️ Chapter) and upload your file.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Class / Course Level *</Label>
                      <select
                        value={form.class_level}
                        onChange={(e) => setForm({ ...form, class_level: e.target.value })}
                        className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        {DEFAULT_CLASSES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Media Type *</Label>
                      <select
                        value={form.media_type}
                        onChange={(e) => setForm({ ...form, media_type: e.target.value })}
                        className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="book">Book / PDF Notes 📖</option>
                        <option value="video">Video Lecture 🎥</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Subject *</Label>
                      <select
                        required
                        value={form.subject_id}
                        onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
                        className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Subject</option>
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.subject_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Chapter / Unit Name</Label>
                      <Input
                        value={form.chapter_name}
                        onChange={(e) => setForm({ ...form, chapter_name: e.target.value })}
                        placeholder="e.g. Chapter 1: Introduction"
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Material Title *</Label>
                    <Input
                      required
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. Class 10th Mathematics Formulas & Notes"
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Description / Notes</Label>
                    <Textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Brief details about topics covered in this material..."
                      rows={2}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">File / Video Resource *</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="material-upload"
                      />
                      <label
                        htmlFor="material-upload"
                        className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-input rounded-xl p-3 cursor-pointer hover:border-blue-500 hover:bg-blue-50/20 transition-all text-xs text-muted-foreground font-medium"
                      >
                        {uploading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        ) : (
                          <Upload className="w-4 h-4 text-blue-600" />
                        )}
                        <span>{form.file_url ? `Uploaded: ${form.file_url.split("/").pop()}` : "Upload File (PDF/Docs)"}</span>
                      </label>
                    </div>

                    <div className="pt-1">
                      <Label className="text-[11px] text-muted-foreground">Or direct URL (YouTube, Vimeo, Cloud Storage):</Label>
                      <Input
                        value={form.file_url}
                        onChange={(e) => setForm({ ...form, file_url: e.target.value })}
                        placeholder="https://..."
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                  </div>

                  <DialogFooter className="pt-3">
                    <Button
                      type="submit"
                      disabled={saving || uploading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                      Save Study Material
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filter Bar */}
        <Card className="shadow-sm border">
          <CardContent className="p-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search by title, subject, chapter..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="w-48">
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm"
              >
                <option value="all">All Classes / Levels</option>
                {DEFAULT_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-40">
              <select
                value={filterMedia}
                onChange={(e) => setFilterMedia(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm"
              >
                <option value="all">All Media Types</option>
                <option value="book">Books / PDFs 📖</option>
                <option value="video">Videos 🎥</option>
              </select>
            </div>
            <Badge variant="outline" className="px-3 py-1 text-xs">
              {filteredMaterials.length} Resources
            </Badge>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          </div>
        ) : filteredMaterials.length === 0 ? (
          <Card className="border-dashed border-2 py-16 text-center">
            <CardContent className="flex flex-col items-center">
              <BookOpen className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <h3 className="text-lg font-bold text-foreground">No Materials Found</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                No study resources match the selected filters. Click "Add Material" to upload the first file.
              </p>
            </CardContent>
          </Card>
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
                  className="border rounded-2xl bg-card overflow-hidden shadow-sm transition-all"
                >
                  {/* Level 1: Class Header */}
                  <div
                    onClick={() => toggleExpand(setExpandedClasses, className)}
                    className="flex items-center justify-between p-4 cursor-pointer bg-slate-50/80 dark:bg-slate-900/50 hover:bg-slate-100/80 transition-all select-none border-b"
                  >
                    <div className="flex items-center gap-3">
                      {isClassExpanded ? (
                        <FolderOpen className="w-5 h-5 text-amber-500 fill-amber-100 dark:fill-amber-950" />
                      ) : (
                        <Folder className="w-5 h-5 text-amber-500 fill-amber-100 dark:fill-amber-950" />
                      )}
                      <span className="font-bold text-base text-foreground">{className}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs font-semibold">
                        {totalInClass} {totalInClass === 1 ? "Item" : "Items"}
                      </Badge>
                      <ChevronRight
                        className={cn(
                          "w-4 h-4 text-muted-foreground transition-transform duration-200",
                          isClassExpanded && "rotate-90"
                        )}
                      />
                    </div>
                  </div>

                  {/* Level 2: Media Type (Books vs Videos) */}
                  {isClassExpanded && (
                    <div className="p-4 space-y-3 pl-6">
                      {Object.entries(mediaMap).map(([mediaType, subjectMap]) => {
                        const mediaKey = `${className}-${mediaType}`;
                        const isMediaExpanded = expandedMedia[mediaKey] ?? true;

                        return (
                          <div key={mediaKey} className="border-l-2 border-blue-200 dark:border-blue-900 pl-4 space-y-3">
                            <div
                              onClick={() => toggleExpand(setExpandedMedia, mediaKey)}
                              className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-foreground hover:text-blue-600 transition-colors select-none"
                            >
                              <ChevronRight
                                className={cn(
                                  "w-3.5 h-3.5 text-muted-foreground transition-transform",
                                  isMediaExpanded && "rotate-90"
                                )}
                              />
                              {mediaType.includes("Video") ? (
                                <Video className="w-4 h-4 text-purple-600" />
                              ) : (
                                <Book className="w-4 h-4 text-emerald-600" />
                              )}
                              <span>{mediaType}</span>
                            </div>

                            {/* Level 3: Subject */}
                            {isMediaExpanded && (
                              <div className="pl-4 space-y-3">
                                {Object.entries(subjectMap).map(([subjectName, chapterMap]) => {
                                  const subjKey = `${mediaKey}-${subjectName}`;
                                  const isSubjExpanded = expandedSubjects[subjKey] ?? true;

                                  return (
                                    <div
                                      key={subjKey}
                                      className="border rounded-xl p-3 bg-muted/20 space-y-2"
                                    >
                                      <div
                                        onClick={() => toggleExpand(setExpandedSubjects, subjKey)}
                                        className="flex items-center justify-between cursor-pointer select-none"
                                      >
                                        <div className="flex items-center gap-2">
                                          <ChevronRight
                                            className={cn(
                                              "w-3.5 h-3.5 text-muted-foreground transition-transform",
                                              isSubjExpanded && "rotate-90"
                                            )}
                                          />
                                          <BookOpen className="w-4 h-4 text-blue-500" />
                                          <span className="font-semibold text-sm text-foreground">
                                            {subjectName}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Level 4: Chapter & Level 5: Material Items */}
                                      {isSubjExpanded && (
                                        <div className="pl-5 pt-2 space-y-3">
                                          {Object.entries(chapterMap).map(([chapterName, items]) => (
                                            <div key={chapterName} className="space-y-1.5">
                                              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                {chapterName} ({items.length})
                                              </div>

                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                                                {items.map((item) => (
                                                  <div
                                                    key={item.id}
                                                    className="flex items-center justify-between p-3 rounded-lg border bg-background hover:border-blue-400 dark:hover:border-blue-700 transition-all text-xs"
                                                  >
                                                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                                                      <div className="truncate">
                                                        <div className="font-semibold text-foreground truncate">
                                                          {item.title}
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground truncate">
                                                          {item.description || "Resource file"}
                                                        </div>
                                                      </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                      <a
                                                        href={item.file_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-1.5 rounded-md hover:bg-muted text-blue-600 transition-colors"
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
                                                        className="p-1.5 rounded-md hover:bg-red-50 text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMaterials.map((m) => (
              <Card key={m.id} className="hover:border-blue-500 transition-all flex flex-col">
                <CardHeader className="pb-3 border-b flex flex-row items-start justify-between space-y-0">
                  <div>
                    <Badge variant="outline" className="mb-2 text-[10px] font-semibold">
                      {m.class_level || "General"}
                    </Badge>
                    <CardTitle className="text-base font-bold leading-snug">{m.title}</CardTitle>
                  </div>
                  {m.media_type === "video" ? (
                    <span className="p-2 bg-purple-50 text-purple-600 rounded-lg shrink-0">
                      <Video className="w-4 h-4" />
                    </span>
                  ) : (
                    <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                      <Book className="w-4 h-4" />
                    </span>
                  )}
                </CardHeader>
                <CardContent className="p-4 flex-1 flex flex-col justify-between text-xs space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Subject:</span>
                      <span className="font-semibold text-foreground">{getSubjectName(m.subject_id)}</span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Chapter:</span>
                      <span className="font-semibold text-foreground">{m.chapter_name || "General"}</span>
                    </div>
                    {m.description && (
                      <p className="text-muted-foreground line-clamp-2 pt-1 border-t">{m.description}</p>
                    )}
                  </div>

                  <div className="pt-3 border-t flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(m.created_at), "dd MMM yyyy")}
                    </span>
                    <div className="flex items-center gap-1">
                      <a
                        href={m.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg border hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleDelete(m.id)}
                        disabled={deletingId === m.id}
                        className="p-1.5 rounded-lg border hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all disabled:opacity-50"
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

export default AdminStudyMaterialPage;
