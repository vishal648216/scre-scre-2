import React, { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BookOpen,
  Loader2,
  FileText,
  Download,
  Search,
  FolderOpen,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Filter,
  FileCode,
  FileSpreadsheet,
  File,
  UserCheck,
  Calendar,
  Layers,
  CheckCircle2,
  CloudDownload,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Material {
  id: string;
  subject_id: string;
  title: string;
  description?: string;
  file_url: string;
  created_at: string;
  class_level?: string;
  media_type?: string;
  chapter_name?: string;
  uploaded_by?: string;
  uploaded_by_name?: string;
  file_size?: string;
}

interface Subject {
  id: string;
  subject_name: string;
  subject_code?: string;
}

interface EnrolledCourse {
  _id: string;
  course_name?: string;
  name?: string;
  course_code?: string;
}

const StudentCourseMaterialsPage: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  
  // Filter States
  const [search, setSearch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [selectedType, setSelectedType] = useState("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [materialsRes, subsRes, coursesRes] = await Promise.all([
        apiFetch("/api/academic/study-materials"),
        apiFetch("/api/admin/subjects"),
        apiFetch("/api/courses/allot"),
      ]);

      const materialsData = await materialsRes.json();
      const subsData = await subsRes.json();
      const coursesData = await coursesRes.json();

      if (coursesRes.ok) {
        setCourses(Array.isArray(coursesData) ? coursesData : []);
      }

      if (subsRes.ok) {
        const items = Array.isArray(subsData) ? subsData : subsData.items || [];
        setSubjects(items.map((s: any) => ({ ...s, id: String(s.id || s._id) })));
      }

      let fetchedMaterials: Material[] = [];
      if (materialsRes.ok) {
        const raw = Array.isArray(materialsData) ? materialsData : [];
        fetchedMaterials = raw.map((m: any) => ({
          id: String(m.id || m._id || Math.random()),
          subject_id: String(m.subject_id || ""),
          title: String(m.title || "Study Document"),
          description: m.description ? String(m.description) : undefined,
          file_url: String(m.file_url || ""),
          created_at: String(m.created_at || new Date().toISOString()),
          class_level: m.class_level || "General",
          media_type: m.media_type || "book",
          chapter_name: m.chapter_name || "General Chapter",
          uploaded_by: m.uploaded_by || "",
          uploaded_by_name: m.uploaded_by_name || m.uploader_name || "",
          file_size: m.file_size || "PDF File",
        }));
      }

      setMaterials(fetchedMaterials);
    } catch (err) {
      console.error("Error fetching course materials:", err);
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  const getSubjectName = (id: string) => {
    const s = subjects.find((sub) => sub.id === id);
    return s ? s.subject_name : "General Subject";
  };

  const formatUploaderName = (mat: Material) => {
    if (mat.uploaded_by_name && mat.uploaded_by_name.trim()) {
      return mat.uploaded_by_name;
    }
    if (mat.uploaded_by && !/^[0-9a-fA-F]{24}$/.test(mat.uploaded_by.trim())) {
      return mat.uploaded_by;
    }
    return "Course Faculty / Center Team";
  };

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchSearch =
        m.title.toLowerCase().includes(search.toLowerCase()) ||
        (m.description && m.description.toLowerCase().includes(search.toLowerCase())) ||
        (m.chapter_name && m.chapter_name.toLowerCase().includes(search.toLowerCase())) ||
        getSubjectName(m.subject_id).toLowerCase().includes(search.toLowerCase());

      const matchSubject = selectedSubject === "all" || m.subject_id === selectedSubject;
      const matchType =
        selectedType === "all" ||
        (selectedType === "notes" && (m.title.toLowerCase().includes("note") || m.title.toLowerCase().includes("fundamental"))) ||
        (selectedType === "sheets" && (m.title.toLowerCase().includes("sheet") || m.title.toLowerCase().includes("formula"))) ||
        (selectedType === "papers" && (m.title.toLowerCase().includes("paper") || m.title.toLowerCase().includes("question")));

      return matchSearch && matchSubject && matchType;
    });
  }, [materials, search, selectedSubject, selectedType, subjects]);

  const handleDownload = (fileUrl: string, title: string) => {
    if (!fileUrl) {
      toast.error("Resource URL is not available");
      return;
    }
    toast.success(`Starting download: ${title}`);
    window.open(fileUrl, "_blank");
  };

  const getFileIcon = (title: string, url: string) => {
    const ext = url.split(".").pop()?.toLowerCase();
    if (ext === "pdf" || title.toLowerCase().includes("pdf")) return <FileText className="w-6 h-6 text-rose-500" />;
    if (ext === "xlsx" || ext === "csv" || title.toLowerCase().includes("sheet")) return <FileSpreadsheet className="w-6 h-6 text-emerald-500" />;
    if (ext === "js" || ext === "html" || ext === "py") return <FileCode className="w-6 h-6 text-indigo-500" />;
    return <File className="w-6 h-6 text-primary" />;
  };

  return (
    <DashboardLayout role="Student">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        {/* Header Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-slate-900 via-primary/10 to-slate-900 p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-primary/20 text-primary border border-primary/30 font-black uppercase text-[10px] tracking-widest rounded-full gap-1 px-3 py-1">
                  <Sparkles className="w-3.5 h-3.5" /> Faculty Study Hub
                </Badge>
                {courses.length > 0 && (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black uppercase text-[10px] tracking-wider rounded-full px-3 py-1">
                    🎓 Enrolled: {courses[0].course_name || courses[0].name}
                  </Badge>
                )}
              </div>
              <h1 className="font-heading font-black text-3xl md:text-4xl text-white uppercase tracking-tight flex items-center gap-3">
                <FolderOpen className="w-8 h-8 text-primary" /> Course Materials & Downloads
              </h1>
              <p className="text-slate-300 text-xs md:text-sm font-medium leading-relaxed">
                Download official textbooks, faculty notes, chapter PDFs, assignment sheets, and reference materials uploaded for your course.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-center">
                <p className="text-2xl font-black text-primary">{filteredMaterials.length}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Available Files</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-card/80 backdrop-blur-xl border border-border p-4 rounded-3xl shadow-sm flex flex-col md:flex-row items-center gap-4">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by note title, chapter, or subject..."
              className="pl-10 h-11 rounded-2xl border-border bg-background/50 font-bold text-xs"
            />
          </div>

          {/* Subject Select */}
          <div className="w-full md:w-64">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full h-11 rounded-2xl border border-border bg-background/50 px-4 text-xs font-bold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary"
            >
              <option value="all">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.subject_name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter Select */}
          <div className="w-full md:w-52">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full h-11 rounded-2xl border border-border bg-background/50 px-4 text-xs font-bold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary"
            >
              <option value="all">All Resource Types</option>
              <option value="notes">Faculty Lecture Notes</option>
              <option value="sheets">Formula & Cheatsheets</option>
              <option value="papers">Question & Exam Papers</option>
            </select>
          </div>
        </div>

        {/* Materials Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Loading course materials...
            </p>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <Card className="rounded-3xl border-dashed border-2 border-border bg-card/40 py-16 text-center">
            <CardContent className="space-y-4">
              <BookOpen className="w-12 h-12 text-muted-foreground/40 mx-auto" />
              <h3 className="text-lg font-black uppercase tracking-tight text-foreground">No Materials Found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No course study materials match the selected criteria. Try adjusting your search query or subject filters.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setSelectedSubject("all");
                  setSelectedType("all");
                }}
                className="rounded-2xl text-xs font-bold uppercase"
              >
                Reset Filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredMaterials.map((mat) => (
              <Card
                key={mat.id}
                className="rounded-3xl border border-border/80 bg-card hover:border-primary/50 transition-all duration-300 shadow-md hover:shadow-xl hover:shadow-primary/5 overflow-hidden flex flex-col justify-between group"
              >
                <CardContent className="p-6 space-y-5">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20">
                      {mat.chapter_name || "Course Module"}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-primary" />
                      {new Date(mat.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>

                  {/* Title & File Icon */}
                  <div className="flex items-start gap-4">
                    <div className="p-3.5 rounded-2xl bg-muted/60 border border-border shrink-0 group-hover:scale-105 transition-transform">
                      {getFileIcon(mat.title, mat.file_url)}
                    </div>
                    <div className="space-y-1 min-w-0">
                      <h3 className="font-heading font-black text-base text-foreground group-hover:text-primary transition-colors leading-snug uppercase tracking-tight">
                        {mat.title}
                      </h3>
                      <p className="text-[11px] font-bold text-primary uppercase tracking-wider">
                        {getSubjectName(mat.subject_id)}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  {mat.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 bg-muted/30 p-3.5 rounded-2xl border border-border/50 font-medium">
                      {mat.description}
                    </p>
                  )}

                  {/* Uploader & Size Info */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium pt-2 border-t border-border/60">
                    <span className="flex items-center gap-1.5 font-semibold text-foreground">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                      {formatUploaderName(mat)}
                    </span>
                    <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-md">
                      {mat.file_size || "PDF Document"}
                    </span>
                  </div>
                </CardContent>

                {/* Bottom Action Footer */}
                <div className="p-4 bg-muted/30 border-t border-border/60 flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified Faculty Resource
                  </span>

                  <Button
                    onClick={() => handleDownload(mat.file_url, mat.title)}
                    className="rounded-2xl bg-primary text-white hover:bg-primary/90 font-black text-xs uppercase tracking-wider px-5 py-2.5 shadow-md shadow-primary/20 flex items-center gap-2 group/btn"
                  >
                    <CloudDownload className="w-4 h-4 group-hover/btn:-translate-y-0.5 transition-transform" />
                    <span>Download File</span>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentCourseMaterialsPage;

