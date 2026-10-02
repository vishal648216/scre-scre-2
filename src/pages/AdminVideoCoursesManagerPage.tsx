import React, { useState, useEffect, useCallback, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Video,
  Upload,
  Play,
  Plus,
  Search,
  Pencil,
  Trash2,
  Tv,
  Film,
  Sparkles,
  BookOpen,
  GraduationCap,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  Layers,
  Folder,
  Share2,
  Building,
  ListVideo,
  Radio,
  FileText,
  Zap,
  ArrowUpDown,
  Lock,
  Download,
  SlidersHorizontal,
  CloudUpload,
  Image as ImageIcon,
  FileUp,
  Cloud,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

export interface MasterclassTrackItem {
  id: string;
  title: string;
  description?: string;
  platform: string; // 'youtube', 'youtube_channel', 'youtube_playlist', 'video_file', 'google_meet'
  join_url: string;
  course_id?: string;
  course_name?: string;
  subject_name?: string;
  instructor_name?: string;
  center_id?: string;
  center_name?: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  thumbnail_url?: string;
  is_hidden?: boolean;

  // Plan B Masterclass Extensions
  mode?: string; // 'youtube_channel_sync' | 'mp4_chapter_vault' | 'center_broadcast'
  chapter_title?: string;
  sequence_order?: number;
  keyword?: string;
  pdf_attachment_url?: string;
  visibility_state?: string; // 'published' | 'center_scoped' | 'hidden'
}

export interface CourseOption {
  id: string;
  course_name: string;
}

export interface CenterOption {
  id: string;
  center_name: string;
  code?: string;
}

const DEFAULT_COURSES: CourseOption[] = [
  { id: "c1", course_name: "Diploma in Computer Application (DCA)" },
  { id: "c2", course_name: "Advanced Diploma in Computer Application (ADCA)" },
  { id: "c3", course_name: "Master Tally Prime & GST Accounting" },
  { id: "c4", course_name: "Course on Computer Concepts (CCC)" },
  { id: "c5", course_name: "Web Development & MERN Stack" },
  { id: "c6", course_name: "Python Programming & Data Science" },
];

const INITIAL_MASTERCLASSES: MasterclassTrackItem[] = [
  {
    id: "m1",
    title: "DCA Module 1: Introduction to Computer Architecture & Hardware",
    description: "Complete chapter masterclass explaining motherboard components, CPU registers, RAM vs ROM, and input/output devices.",
    platform: "youtube",
    join_url: "https://www.youtube.com/watch?v=L2G3s_4S-qE",
    course_id: "c1",
    course_name: "Diploma in Computer Application (DCA)",
    subject_name: "Computer Fundamentals",
    chapter_title: "Chapter 1: Hardware Architecture",
    sequence_order: 1,
    mode: "mp4_chapter_vault",
    visibility_state: "published",
    instructor_name: "Er. Rahul Verma",
    center_id: "all",
    center_name: "All Centers (Global)",
    scheduled_at: new Date().toISOString(),
    duration_minutes: 45,
    status: "completed",
    is_hidden: false,
    pdf_attachment_url: "https://example.com/notes/dca_chapter1.pdf",
  },
  {
    id: "m2",
    title: "Tally Prime Masterclass Track: GST Ledgers & Sales Vouchers",
    description: "Keyword synced series from SCRE Official YouTube Channel for GST voucher entries and tax computation.",
    platform: "youtube_channel",
    join_url: "https://www.youtube.com/@SCRE_Education",
    course_id: "c3",
    course_name: "Master Tally Prime & GST Accounting",
    subject_name: "Tally Accounting",
    chapter_title: "Chapter 2: GST Voucher Entries",
    sequence_order: 2,
    mode: "youtube_channel_sync",
    keyword: "Tally GST",
    visibility_state: "published",
    instructor_name: "CA Ankit Agarwal",
    center_id: "all",
    center_name: "All Centers (Global)",
    scheduled_at: new Date().toISOString(),
    duration_minutes: 60,
    status: "completed",
    is_hidden: false,
  },
  {
    id: "m3",
    title: "ADCA Graphic Design: Photoshop CC Banner & Poster Studio",
    description: "Layer masking, clipping paths, poster typography, and color grading studio masterclass.",
    platform: "youtube",
    join_url: "https://www.youtube.com/watch?v=IyR_uYsRdHs",
    course_id: "c2",
    course_name: "Advanced Diploma in Computer Application (ADCA)",
    subject_name: "Graphic Design",
    chapter_title: "Chapter 3: Photoshop Design",
    sequence_order: 3,
    mode: "mp4_chapter_vault",
    visibility_state: "published",
    instructor_name: "Pooja Sharma",
    center_id: "all",
    center_name: "All Centers (Global)",
    scheduled_at: new Date().toISOString(),
    duration_minutes: 55,
    status: "completed",
    is_hidden: false,
  },
];

export default function AdminVideoCoursesManagerPage() {
  const [tracks, setTracks] = useState<MasterclassTrackItem[]>(INITIAL_MASTERCLASSES);
  const [courses, setCourses] = useState<CourseOption[]>(DEFAULT_COURSES);
  const [centers, setCenters] = useState<CenterOption[]>([
    { id: "all", center_name: "All Centers (Global)" },
  ]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [centerFilter, setCenterFilter] = useState("all");
  const [tabFilter, setTabFilter] = useState("all"); // 'all', 'youtube_channel_sync', 'mp4_chapter_vault', 'center_broadcast', 'hidden'

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeUploadMode, setActiveUploadMode] = useState<"youtube_channel_sync" | "mp4_chapter_vault" | "center_broadcast">("mp4_chapter_vault");
  const [editingTrack, setEditingTrack] = useState<MasterclassTrackItem | null>(null);
  const [saving, setSaving] = useState(false);

  // File Upload State
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  const videoFileInputRef = useRef<HTMLInputElement | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  // Cinema Preview Modal
  const [previewTrack, setPreviewTrack] = useState<MasterclassTrackItem | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    platform: "video_file",
    join_url: "",
    course_id: "c1",
    center_id: "all",
    subject_name: "",
    chapter_title: "",
    sequence_order: "1",
    keyword: "",
    thumbnail_url: "",
    pdf_attachment_url: "",
    instructor_name: "Academic Faculty",
    duration_minutes: "45",
    visibility_state: "published", // 'published' | 'center_scoped' | 'hidden'
  });

  const [userProfile, setUserProfile] = useState<any>(null);

  // Helpers
  const extractYouTubeId = (url: string): string | null => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const getThumbnail = (track: MasterclassTrackItem): string => {
    if (track.thumbnail_url) return track.thumbnail_url;
    const ytId = extractYouTubeId(track.join_url);
    if (ytId) {
      return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    }
    return "";
  };

  const fetchUserProfile = useCallback(async () => {
    try {
      const res = await apiFetch("/api/users/me");
      if (res.ok) {
        const u = await res.json();
        setUserProfile(u);
      }
    } catch {}
  }, []);

  const fetchCenters = useCallback(async () => {
    try {
      const res = await apiFetch("/api/centers");
      if (res.ok) {
        const data = await res.json();
        const raw = data.centers || data || [];
        const mapped: CenterOption[] = raw.map((c: any) => ({
          id: c.id || c._id,
          center_name: c.center_name || c.name || "Franchise Center",
          code: c.code || c.center_code,
        }));
        setCenters([{ id: "all", center_name: "All Centers (Global)" }, ...mapped]);
      }
    } catch {}
  }, []);

  const fetchTracks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/live-classes?status=all");
      if (res.ok) {
        const data = await res.json();
        const raw: MasterclassTrackItem[] = data.classes || [];
        if (raw.length > 0) {
          const mapped = raw.map((cls) => ({
            ...cls,
            mode: cls.mode || (cls.platform === "youtube_channel" ? "youtube_channel_sync" : cls.join_url.endsWith(".mp4") ? "mp4_chapter_vault" : "mp4_chapter_vault"),
            visibility_state: cls.visibility_state || (cls.is_hidden ? "hidden" : "published"),
          }));
          setTracks([...mapped, ...INITIAL_MASTERCLASSES]);
        } else {
          setTracks(INITIAL_MASTERCLASSES);
        }
      } else {
        setTracks(INITIAL_MASTERCLASSES);
      }
    } catch {
      setTracks(INITIAL_MASTERCLASSES);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCourses = useCallback(async () => {
    try {
      const res = await apiFetch("/api/courses/allot");
      if (res.ok) {
        const data = await res.json();
        if (data.courses && data.courses.length > 0) {
          setCourses(data.courses);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchUserProfile();
    fetchTracks();
    fetchCourses();
    fetchCenters();
  }, [fetchUserProfile, fetchTracks, fetchCourses, fetchCenters]);

  // Handle Direct Computer File Browsing & Cloud Upload
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    targetField: "join_url" | "thumbnail_url" | "pdf_attachment_url",
    setUploading: (v: boolean) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    toast.info(`Uploading ${file.name} to Cloud Storage CDN...`);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await apiFetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        setForm((prev) => ({ ...prev, [targetField]: data.url }));
        toast.success(`Uploaded ${file.name} to CDN Storage!`);
      } else {
        toast.error(data.message || "Failed to upload file to storage.");
      }
    } catch {
      toast.error("Network error during file upload");
    } finally {
      setUploading(false);
    }
  };

  const handleOpenAddModal = (mode: "youtube_channel_sync" | "mp4_chapter_vault" | "center_broadcast" = "mp4_chapter_vault") => {
    setEditingTrack(null);
    setActiveUploadMode(mode);
    setForm({
      title: "",
      description: "",
      platform: mode === "youtube_channel_sync" ? "youtube_channel" : "video_file",
      join_url: "",
      course_id: courses[0]?.id || "c1",
      center_id: mode === "center_broadcast" ? (centers[1]?.id || "all") : "all",
      subject_name: "",
      chapter_title: "Chapter 1: Masterclass Module",
      sequence_order: "1",
      keyword: "",
      thumbnail_url: "",
      pdf_attachment_url: "",
      instructor_name: "Academic Faculty",
      duration_minutes: "45",
      visibility_state: mode === "center_broadcast" ? "center_scoped" : "published",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (track: MasterclassTrackItem) => {
    setEditingTrack(track);
    setActiveUploadMode((track.mode as any) || "mp4_chapter_vault");
    setForm({
      title: track.title,
      description: track.description || "",
      platform: track.platform || "video_file",
      join_url: track.join_url || "",
      course_id: track.course_id || "",
      center_id: track.center_id || "all",
      subject_name: track.subject_name || "",
      chapter_title: track.chapter_title || "Chapter 1: Module",
      sequence_order: String(track.sequence_order || 1),
      keyword: track.keyword || "",
      thumbnail_url: track.thumbnail_url || "",
      pdf_attachment_url: track.pdf_attachment_url || "",
      instructor_name: track.instructor_name || "Academic Faculty",
      duration_minutes: String(track.duration_minutes || 45),
      visibility_state: track.visibility_state || (track.is_hidden ? "hidden" : "published"),
    });
    setIsModalOpen(true);
  };

  const handleToggleVisibility = async (track: MasterclassTrackItem) => {
    let nextState = "hidden";
    if (track.visibility_state === "published") nextState = "center_scoped";
    else if (track.visibility_state === "center_scoped") nextState = "hidden";
    else nextState = "published";

    const isHidden = nextState === "hidden";

    try {
      await apiFetch(`/api/live-classes/${track.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visibility_state: nextState,
          is_hidden: isHidden,
          status: isHidden ? "hidden" : "completed",
        }),
      });

      setTracks((prev) =>
        prev.map((t) =>
          t.id === track.id
            ? { ...t, visibility_state: nextState, is_hidden: isHidden, status: isHidden ? "hidden" : "completed" }
            : t
        )
      );

      toast.success(`Visibility updated to ${nextState.toUpperCase()}`);
    } catch {
      toast.error("Failed to update visibility state");
    }
  };

  const handleSaveTrack = async () => {
    if (!form.title.trim()) return toast.error("Please enter Masterclass Track Title");
    if (!form.join_url.trim()) return toast.error("Please browse and upload a Video File or enter URL");

    setSaving(true);
    try {
      const matchedCourse = courses.find((c) => c.id === form.course_id);
      const matchedCenter = centers.find((c) => c.id === form.center_id);
      const isHidden = form.visibility_state === "hidden";

      const payload = {
        title: form.title,
        description: form.description || null,
        platform: form.platform,
        join_url: form.join_url,
        course_id: form.course_id || null,
        center_id: form.center_id === "all" ? null : form.center_id,
        center_name: matchedCenter?.center_name || "All Centers (Global)",
        subject_name: form.subject_name || "Module Masterclass",
        instructor_name: form.instructor_name || "Academic Faculty",
        scheduled_at: new Date().toISOString(),
        duration_minutes: parseInt(form.duration_minutes) || 45,
        is_hidden: isHidden,
        status: isHidden ? "hidden" : "completed",
        mode: activeUploadMode,
        chapter_title: form.chapter_title || "Chapter 1: Masterclass",
        sequence_order: parseInt(form.sequence_order) || 1,
        keyword: form.keyword || null,
        thumbnail_url: form.thumbnail_url || null,
        pdf_attachment_url: form.pdf_attachment_url || null,
        visibility_state: form.visibility_state,
      };

      let res;
      if (editingTrack) {
        res = await apiFetch(`/api/live-classes/${editingTrack.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await apiFetch("/api/live-classes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (res.ok || data.success) {
        toast.success(editingTrack ? "Masterclass track updated!" : "New Masterclass track published successfully!");

        const updatedItem: MasterclassTrackItem = {
          id: editingTrack ? editingTrack.id : `m_${Date.now()}`,
          title: form.title,
          description: form.description,
          platform: form.platform,
          join_url: form.join_url,
          course_id: form.course_id,
          course_name: matchedCourse?.course_name || "General Computer Course",
          subject_name: form.subject_name || "Module Masterclass",
          instructor_name: form.instructor_name,
          center_id: form.center_id,
          center_name: matchedCenter?.center_name || "All Centers (Global)",
          scheduled_at: new Date().toISOString(),
          duration_minutes: parseInt(form.duration_minutes) || 45,
          status: isHidden ? "hidden" : "completed",
          is_hidden: isHidden,
          mode: activeUploadMode,
          chapter_title: form.chapter_title,
          sequence_order: parseInt(form.sequence_order) || 1,
          keyword: form.keyword,
          thumbnail_url: form.thumbnail_url,
          pdf_attachment_url: form.pdf_attachment_url,
          visibility_state: form.visibility_state,
        };

        if (editingTrack) {
          setTracks(tracks.map((t) => (t.id === editingTrack.id ? updatedItem : t)));
        } else {
          setTracks([updatedItem, ...tracks]);
        }

        setIsModalOpen(false);
      } else {
        toast.error(data.message || "Failed to save masterclass");
      }
    } catch {
      toast.error("Error connecting to server");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTrack = async (id: string) => {
    if (!confirm("Are you sure you want to delete this Masterclass Track?")) return;
    try {
      await apiFetch(`/api/live-classes/${id}`, { method: "DELETE" });
      setTracks(tracks.filter((t) => t.id !== id));
      toast.success("Masterclass track deleted");
    } catch {
      toast.error("Failed to delete track");
    }
  };

  const handleOpenPreview = (track: MasterclassTrackItem) => {
    setPreviewTrack(track);
    setIsPreviewOpen(true);
  };

  const filteredTracks = tracks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(search.toLowerCase())) ||
      (t.chapter_title && t.chapter_title.toLowerCase().includes(search.toLowerCase())) ||
      (t.instructor_name && t.instructor_name.toLowerCase().includes(search.toLowerCase()));

    const matchesCourse =
      courseFilter === "all" || t.course_id === courseFilter || t.course_name === courseFilter;

    const matchesCenter =
      centerFilter === "all" || t.center_id === centerFilter || t.center_id === "all";

    const matchesTab =
      tabFilter === "all" ||
      (tabFilter === "youtube_channel_sync" && (t.mode === "youtube_channel_sync" || t.platform === "youtube_channel")) ||
      (tabFilter === "mp4_chapter_vault" && (t.mode === "mp4_chapter_vault" || t.join_url.endsWith(".mp4"))) ||
      (tabFilter === "center_broadcast" && (t.mode === "center_broadcast" || t.visibility_state === "center_scoped")) ||
      (tabFilter === "hidden" && (t.visibility_state === "hidden" || t.is_hidden));

    return matchesSearch && matchesCourse && matchesCenter && matchesTab;
  });

  const previewYtId = extractYouTubeId(form.join_url);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-16">
        {/* Hidden File Inputs */}
        <input
          ref={videoFileInputRef}
          type="file"
          accept="video/*,.mp4,.mkv,.webm"
          className="hidden"
          onChange={(e) => handleFileUpload(e, "join_url", setUploadingVideo)}
        />
        <input
          ref={thumbnailInputRef}
          type="file"
          accept="image/*,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e) => handleFileUpload(e, "thumbnail_url", setUploadingThumbnail)}
        />
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => handleFileUpload(e, "pdf_attachment_url", setUploadingPdf)}
        />

        {/* Header Hero Studio Banner */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-red-950 text-white p-6 md:p-8 rounded-3xl border border-red-500/30 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-red-600 text-white rounded-full font-black uppercase text-[10px] tracking-widest gap-1 px-3 py-1">
                <Tv className="w-3.5 h-3.5" /> Direct Cloud Upload & CDN Studio
              </Badge>
              {userProfile?.role === "superadmin" ? (
                <Badge className="bg-amber-400 text-slate-950 rounded-full font-black uppercase text-[10px] tracking-wider px-3 py-1">
                  ⚡ SuperAdmin: Global Control
                </Badge>
              ) : (
                <Badge className="bg-indigo-600 text-white rounded-full font-black uppercase text-[10px] tracking-wider px-3 py-1">
                  📍 Center: {userProfile?.center_name || "Franchise Branch"}
                </Badge>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-heading font-black tracking-tight uppercase flex items-center gap-3 text-white">
              <Film className="w-8 h-8 text-amber-400" /> Recorded Video Masterclass Studio
            </h1>

            <p className="text-xs md:text-sm text-slate-300 max-w-2xl font-medium leading-relaxed">
              Upload MP4 files & custom thumbnails directly from your computer to Cloud Storage CDN. Organize videos into course playlists and control visibility.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <Button
              onClick={() => handleOpenAddModal("mp4_chapter_vault")}
              className="rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold gap-2 text-xs h-11 px-5 shadow-lg shadow-red-600/30"
            >
              <CloudUpload className="w-4 h-4 text-white" /> Browse & Upload MP4 Video
            </Button>
            <Button
              onClick={() => handleOpenAddModal("youtube_channel_sync")}
              variant="outline"
              className="rounded-2xl border-white/20 bg-slate-900/60 text-white hover:bg-white/10 text-xs h-11 px-4 gap-2 font-bold"
            >
              <Radio className="w-4 h-4 text-amber-400" /> YouTube Channel Sync
            </Button>
            <Button
              onClick={() => window.open("/dashboard/student/recorded", "_blank")}
              variant="secondary"
              className="rounded-2xl text-slate-950 font-bold text-xs h-11 px-4 gap-1.5"
            >
              <Eye className="w-4 h-4" /> Student Portal
            </Button>
          </div>
        </div>

        {/* Analytics Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-border bg-card/80 backdrop-blur">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-red-600/10 text-red-600">
                  <Tv className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-black">{tracks.length}</p>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Total Masterclasses</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-card/80 backdrop-blur">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600">
                  <Folder className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-black">
                    {tracks.filter((t) => t.mode === "mp4_chapter_vault" || t.platform === "video_file").length}
                  </p>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Direct MP4 Files</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-card/80 backdrop-blur">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600">
                  <Radio className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-black">
                    {tracks.filter((t) => t.mode === "youtube_channel_sync").length}
                  </p>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Channel Synced</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-card/80 backdrop-blur">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-slate-500/10 text-slate-400">
                  <EyeOff className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-black">
                    {tracks.filter((t) => t.visibility_state === "hidden" || t.is_hidden).length}
                  </p>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Hidden Drafts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card/80 backdrop-blur border border-border p-4 rounded-2xl shadow-sm">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chapter, subject, instructor..."
              className="pl-10 rounded-xl h-10 text-xs font-bold bg-background/50 border-border"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="w-full sm:w-52">
              <Select value={centerFilter} onValueChange={setCenterFilter}>
                <SelectTrigger className="rounded-xl h-10 text-xs font-bold border-border bg-background/50">
                  <Building className="w-3.5 h-3.5 mr-1 text-indigo-400" />
                  <SelectValue placeholder="All Centers" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {centers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.center_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-56">
              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger className="rounded-xl h-10 text-xs font-bold border-border bg-background/50">
                  <GraduationCap className="w-3.5 h-3.5 mr-1 text-primary" />
                  <SelectValue placeholder="All Courses" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Course Series</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.course_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Masterclass Category Tabs */}
        <Tabs value={tabFilter} onValueChange={setTabFilter} className="w-full">
          <TabsList className="rounded-2xl bg-muted/60 p-1 w-full sm:w-auto grid grid-cols-5 h-11 border border-border">
            <TabsTrigger value="all" className="rounded-xl text-[10px] font-black uppercase px-3">
              All Tracks
            </TabsTrigger>
            <TabsTrigger value="mp4_chapter_vault" className="rounded-xl text-[10px] font-black uppercase px-3">
              MP4 Vault
            </TabsTrigger>
            <TabsTrigger value="youtube_channel_sync" className="rounded-xl text-[10px] font-black uppercase px-3">
              YouTube Sync
            </TabsTrigger>
            <TabsTrigger value="center_broadcast" className="rounded-xl text-[10px] font-black uppercase px-3">
              Center Exclusive
            </TabsTrigger>
            <TabsTrigger value="hidden" className="rounded-xl text-[10px] font-black uppercase px-3 text-red-400">
              Hidden Drafts
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Masterclass Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredTracks.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-2 border-border bg-card/40 py-16 text-center">
            <CardContent className="space-y-3">
              <Video className="w-12 h-12 text-muted-foreground/40 mx-auto" />
              <p className="font-bold text-base text-foreground uppercase tracking-tight">No Masterclass Tracks found matching current filters.</p>
              <div className="flex justify-center gap-2 pt-2">
                <Button onClick={() => handleOpenAddModal("mp4_chapter_vault")} className="rounded-xl bg-red-600 hover:bg-red-700 text-white gap-2 text-xs font-bold uppercase">
                  <CloudUpload className="w-4 h-4" /> Upload Video File
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTracks.map((track) => {
              const ytId = extractYouTubeId(track.join_url);
              const thumb = getThumbnail(track);
              const courseName = courses.find((c) => c.id === track.course_id)?.course_name || track.course_name;
              const isHidden = track.visibility_state === "hidden" || track.is_hidden;

              return (
                <Card
                  key={track.id}
                  className={`rounded-3xl border overflow-hidden flex flex-col justify-between group shadow-md transition-all duration-300 ${
                    isHidden
                      ? "border-red-500/40 bg-slate-950/70 opacity-85"
                      : track.visibility_state === "center_scoped"
                      ? "border-amber-500/40 bg-card hover:border-amber-500"
                      : "border-border/80 bg-card hover:border-red-500/50"
                  }`}
                >
                  <div>
                    {/* Thumbnail Frame */}
                    <div className="relative aspect-video bg-slate-950 overflow-hidden cursor-pointer" onClick={() => handleOpenPreview(track)}>
                      {thumb ? (
                        <img src={thumb} alt={track.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-red-950">
                          <Film className="w-12 h-12 text-red-500/40 mb-2" />
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                            {track.mode === "youtube_channel_sync" ? "YouTube Channel Sync" : "MP4 Chapter Vault"}
                          </span>
                        </div>
                      )}

                      {/* Top Badges */}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
                        {track.mode === "youtube_channel_sync" ? (
                          <Badge className="bg-amber-500 text-slate-950 font-black uppercase text-[9px] rounded-full gap-1">
                            <Radio className="w-3 h-3" /> Channel Keyword Sync
                          </Badge>
                        ) : track.mode === "center_broadcast" ? (
                          <Badge className="bg-indigo-600 text-white font-black uppercase text-[9px] rounded-full gap-1">
                            <Building className="w-3 h-3" /> Center Exclusive
                          </Badge>
                        ) : (
                          <Badge className="bg-red-600 text-white font-black uppercase text-[9px] rounded-full gap-1">
                            <Folder className="w-3 h-3" /> MP4 Chapter Vault
                          </Badge>
                        )}

                        {track.visibility_state === "published" ? (
                          <Badge className="bg-emerald-600 text-white font-black uppercase text-[9px] rounded-full">
                            🟢 Published
                          </Badge>
                        ) : track.visibility_state === "center_scoped" ? (
                          <Badge className="bg-amber-500 text-slate-950 font-black uppercase text-[9px] rounded-full">
                            🟡 Center Scoped
                          </Badge>
                        ) : (
                          <Badge className="bg-red-600 text-white font-black uppercase text-[9px] rounded-full">
                            🔴 Hidden Draft
                          </Badge>
                        )}
                      </div>

                      {/* Play Overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl">
                          <Play className="w-5 h-5 fill-white ml-0.5" />
                        </div>
                      </div>

                      <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-mono px-2 py-0.5 rounded-full backdrop-blur border border-white/10">
                        {track.duration_minutes || 45} mins
                      </div>
                    </div>

                    {/* Metadata Content */}
                    <CardContent className="p-5 space-y-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {courseName && (
                          <Badge variant="outline" className="rounded-full text-[9px] uppercase font-black text-primary border-primary/30">
                            {courseName}
                          </Badge>
                        )}
                        {track.chapter_title && (
                          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                            • {track.chapter_title} (Order #{track.sequence_order || 1})
                          </span>
                        )}
                      </div>

                      <h3
                        onClick={() => handleOpenPreview(track)}
                        className="font-heading font-black text-base text-foreground line-clamp-2 hover:text-red-500 cursor-pointer leading-snug uppercase tracking-tight"
                      >
                        {track.title}
                      </h3>

                      {track.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 font-medium leading-relaxed">
                          {track.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-border/40 font-semibold">
                        <div className="flex items-center gap-1">
                          <GraduationCap className="w-3.5 h-3.5 text-primary" /> Faculty: {track.instructor_name || "Academic Faculty"}
                        </div>

                        {track.pdf_attachment_url && (
                          <span className="text-emerald-400 flex items-center gap-1 text-[10px]">
                            <FileText className="w-3 h-3" /> PDF Notes
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </div>

                  {/* Actions Footer */}
                  <div className="p-4 pt-0 border-t border-border/40 mt-2 flex items-center justify-between gap-2">
                    <Button
                      onClick={() => handleOpenPreview(track)}
                      size="sm"
                      variant="outline"
                      className="rounded-2xl text-xs h-9 gap-1.5 font-bold"
                    >
                      <Play className="w-3.5 h-3.5 text-red-500" /> Cinema Play
                    </Button>

                    <div className="flex items-center gap-1">
                      <Button
                        onClick={() => handleToggleVisibility(track)}
                        size="sm"
                        variant="ghost"
                        className="rounded-xl h-8 px-2 text-xs font-bold gap-1"
                        title="Click to Cycle Visibility: Published -> Center Scoped -> Hidden"
                      >
                        {track.visibility_state === "published" ? (
                          <span className="text-emerald-400 flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> Pub</span>
                        ) : track.visibility_state === "center_scoped" ? (
                          <span className="text-amber-400 flex items-center gap-1"><Building className="w-3.5 h-3.5" /> Center</span>
                        ) : (
                          <span className="text-red-400 flex items-center gap-1"><EyeOff className="w-3.5 h-3.5" /> Hid</span>
                        )}
                      </Button>

                      <Button onClick={() => handleOpenEditModal(track)} size="sm" variant="ghost" className="rounded-xl h-8 w-8 p-0" title="Edit Track">
                        <Pencil className="w-3.5 h-3.5 text-blue-400" />
                      </Button>

                      <Button onClick={() => handleDeleteTrack(track.id)} size="sm" variant="ghost" className="rounded-xl h-8 w-8 p-0 text-destructive hover:text-destructive" title="Delete Track">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* UPLOAD / EDIT DIALOG MODAL WITH DIRECT BROWSER FILE UPLOAD */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-2xl rounded-3xl border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading uppercase font-bold text-base flex items-center gap-2">
                <Tv className="w-5 h-5 text-red-600" />
                {editingTrack ? "Edit Course Masterclass Track" : "Publish Masterclass Track (Cloud CDN Studio)"}
              </DialogTitle>
            </DialogHeader>

            {/* Mode Switcher Tabs inside Modal */}
            <div className="py-1">
              <Tabs value={activeUploadMode} onValueChange={(v: any) => setActiveUploadMode(v)}>
                <TabsList className="rounded-xl bg-muted/60 p-1 w-full grid grid-cols-3 h-10 border border-border">
                  <TabsTrigger value="mp4_chapter_vault" className="rounded-lg text-[10px] font-bold uppercase">
                    📼 Direct MP4 Upload
                  </TabsTrigger>
                  <TabsTrigger value="youtube_channel_sync" className="rounded-lg text-[10px] font-bold uppercase">
                    📺 Channel Sync
                  </TabsTrigger>
                  <TabsTrigger value="center_broadcast" className="rounded-lg text-[10px] font-bold uppercase">
                    ⚡ Center Exclusive
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-4 py-2 text-xs">
              <div className="space-y-1">
                <Label className="font-bold">Masterclass Track Title *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. DCA Chapter 1 – Computer Hardware & Motherboard Studio"
                  className="rounded-xl h-10 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="font-bold">Course Series *</Label>
                  <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
                    <SelectTrigger className="rounded-xl h-10 font-bold">
                      <SelectValue placeholder="Select Course" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.course_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="font-bold">Center Allotment *</Label>
                  <Select value={form.center_id} onValueChange={(v) => setForm({ ...form, center_id: v })}>
                    <SelectTrigger className="rounded-xl h-10 font-bold">
                      <SelectValue placeholder="Select Center" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {centers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.center_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="font-bold">Module / Chapter Title</Label>
                  <Input
                    value={form.chapter_title}
                    onChange={(e) => setForm({ ...form, chapter_title: e.target.value })}
                    placeholder="e.g. Chapter 1: Hardware"
                    className="rounded-xl h-10 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="font-bold">Sequence Order #</Label>
                  <Input
                    type="number"
                    value={form.sequence_order}
                    onChange={(e) => setForm({ ...form, sequence_order: e.target.value })}
                    className="rounded-xl h-10 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="font-bold">Duration (Minutes)</Label>
                  <Input
                    type="number"
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                    className="rounded-xl h-10 font-bold"
                  />
                </div>
              </div>

              {/* 1. DIRECT MP4 VIDEO FILE UPLOAD ZONE */}
              {activeUploadMode !== "youtube_channel_sync" && (
                <div className="space-y-2 bg-indigo-500/10 p-3.5 rounded-2xl border border-indigo-500/30">
                  <div className="flex items-center justify-between">
                    <Label className="font-bold text-indigo-400 flex items-center gap-1.5">
                      <CloudUpload className="w-4 h-4" /> MP4 Video File (Browser Upload to CDN) *
                    </Label>
                    <Button
                      type="button"
                      size="sm"
                      disabled={uploadingVideo}
                      onClick={() => videoFileInputRef.current?.click()}
                      className="rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 h-8 px-3"
                    >
                      {uploadingVideo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
                      {uploadingVideo ? "Uploading to CDN..." : "Browse PC for Video"}
                    </Button>
                  </div>

                  <Input
                    value={form.join_url}
                    onChange={(e) => setForm({ ...form, join_url: e.target.value })}
                    placeholder="Auto-populated CDN URL or paste https://... video link"
                    className="rounded-xl h-10 font-bold bg-background text-xs"
                  />

                  {form.join_url && !previewYtId && (
                    <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-mono font-bold pt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Video Ready: {form.join_url}
                    </div>
                  )}
                </div>
              )}

              {/* 2. YOUTUBE CHANNEL SYNC INPUT */}
              {activeUploadMode === "youtube_channel_sync" && (
                <div className="space-y-3 bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20">
                  <div className="space-y-1">
                    <Label className="font-bold text-amber-400">YouTube Channel URL / Handle *</Label>
                    <Input
                      value={form.join_url}
                      onChange={(e) => setForm({ ...form, join_url: e.target.value })}
                      placeholder="https://youtube.com/@SCRE_Education or playlist link"
                      className="rounded-xl h-10 font-bold bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-bold text-amber-400">Subject Sync Keyword (Optional)</Label>
                    <Input
                      value={form.keyword}
                      onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                      placeholder="e.g. Tally GST, DCA, Photoshop"
                      className="rounded-xl h-10 font-bold bg-background"
                    />
                  </div>
                </div>
              )}

              {/* 3. CUSTOM THUMBNAIL IMAGE FILE BROWSER UPLOAD */}
              <div className="space-y-2 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <Label className="font-bold text-slate-200 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-amber-400" /> Custom Cover Thumbnail Image
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    disabled={uploadingThumbnail}
                    onClick={() => thumbnailInputRef.current?.click()}
                    className="rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white gap-1.5 h-8 px-3 border border-slate-700"
                  >
                    {uploadingThumbnail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5 text-amber-400" />}
                    {uploadingThumbnail ? "Uploading Thumbnail..." : "Browse PC for Thumbnail"}
                  </Button>
                </div>

                <Input
                  value={form.thumbnail_url}
                  onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
                  placeholder="Auto-populated thumbnail image CDN URL"
                  className="rounded-xl h-10 font-bold bg-background text-xs"
                />

                {form.thumbnail_url && (
                  <div className="flex items-center gap-3 pt-2">
                    <div className="w-24 aspect-video rounded-lg overflow-hidden border border-border bg-black">
                      <img src={form.thumbnail_url} alt="Cover Thumbnail Preview" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[11px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Thumbnail CDN Ready
                    </span>
                  </div>
                )}
              </div>

              {/* 4. PDF STUDY NOTES FILE BROWSER UPLOAD */}
              <div className="space-y-2 bg-emerald-500/10 p-3.5 rounded-2xl border border-emerald-500/20">
                <div className="flex items-center justify-between">
                  <Label className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" /> PDF Study Notes Attachment (Optional)
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    disabled={uploadingPdf}
                    onClick={() => pdfInputRef.current?.click()}
                    className="rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white gap-1.5 h-8 px-3"
                  >
                    {uploadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
                    {uploadingPdf ? "Uploading PDF..." : "Browse PC for PDF"}
                  </Button>
                </div>

                <Input
                  value={form.pdf_attachment_url}
                  onChange={(e) => setForm({ ...form, pdf_attachment_url: e.target.value })}
                  placeholder="Auto-populated PDF study notes CDN URL"
                  className="rounded-xl h-10 font-bold bg-background text-xs"
                />

                {form.pdf_attachment_url && (
                  <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-mono font-bold pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> PDF Notes Attached: {form.pdf_attachment_url}
                  </div>
                )}
              </div>

              {/* YouTube Live Form Preview */}
              {previewYtId && (
                <div className="space-y-1 bg-slate-950 p-3 rounded-xl border border-border">
                  <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Live YouTube Link Validated
                  </p>
                  <div className="aspect-video w-full max-h-44 rounded-lg overflow-hidden">
                    <iframe
                      src={`https://www.youtube.com/embed/${previewYtId}`}
                      title="YouTube Preview"
                      className="w-full h-full border-0"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="font-bold">Subject / Topic Name</Label>
                  <Input
                    value={form.subject_name}
                    onChange={(e) => setForm({ ...form, subject_name: e.target.value })}
                    placeholder="e.g. Hardware Architecture"
                    className="rounded-xl h-10 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="font-bold">Faculty Instructor Name</Label>
                  <Input
                    value={form.instructor_name}
                    onChange={(e) => setForm({ ...form, instructor_name: e.target.value })}
                    placeholder="e.g. Er. Rahul Verma"
                    className="rounded-xl h-10 font-bold"
                  />
                </div>
              </div>

              {/* Tri-State Visibility Control */}
              <div className="space-y-1.5 bg-muted/40 p-3 rounded-2xl border border-border">
                <Label className="font-bold">Visibility & Access Control</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={form.visibility_state === "published" ? "default" : "outline"}
                    onClick={() => setForm({ ...form, visibility_state: "published" })}
                    className={`rounded-xl text-[10px] font-black uppercase ${
                      form.visibility_state === "published" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                    }`}
                  >
                    🟢 Published
                  </Button>
                  <Button
                    type="button"
                    variant={form.visibility_state === "center_scoped" ? "default" : "outline"}
                    onClick={() => setForm({ ...form, visibility_state: "center_scoped" })}
                    className={`rounded-xl text-[10px] font-black uppercase ${
                      form.visibility_state === "center_scoped" ? "bg-amber-500 hover:bg-amber-600 text-slate-950" : ""
                    }`}
                  >
                    🟡 Center Scoped
                  </Button>
                  <Button
                    type="button"
                    variant={form.visibility_state === "hidden" ? "default" : "outline"}
                    onClick={() => setForm({ ...form, visibility_state: "hidden" })}
                    className={`rounded-xl text-[10px] font-black uppercase ${
                      form.visibility_state === "hidden" ? "bg-red-600 hover:bg-red-700 text-white" : ""
                    }`}
                  >
                    🔴 Hidden Draft
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl text-xs font-bold">
                Cancel
              </Button>
              <Button onClick={handleSaveTrack} disabled={saving || uploadingVideo || uploadingThumbnail || uploadingPdf} className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold gap-2 text-xs">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editingTrack ? "Update Track" : "Publish Masterclass"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cinema Preview Player Modal */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-4xl rounded-3xl p-0 overflow-hidden bg-slate-950 text-white border border-slate-800 shadow-2xl">
            {previewTrack && (
              <div>
                <div className="relative aspect-video w-full bg-black">
                  {extractYouTubeId(previewTrack.join_url) ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${extractYouTubeId(previewTrack.join_url)}?autoplay=1`}
                      title={previewTrack.title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video controls autoPlay src={previewTrack.join_url} className="w-full h-full object-contain" />
                  )}
                </div>

                <div className="p-6 space-y-3 bg-slate-900 text-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <Badge className="bg-red-600 text-white rounded-full uppercase text-[10px] font-bold">
                      {previewTrack.mode === "youtube_channel_sync" ? "📺 YouTube Sync" : "📼 MP4 Vault"}
                    </Badge>
                    <span className="text-xs text-slate-400 font-mono">Duration: {previewTrack.duration_minutes || 45} mins</span>
                  </div>

                  <h2 className="text-lg font-black uppercase text-white tracking-tight">{previewTrack.title}</h2>
                  {previewTrack.description && <p className="text-xs text-slate-300 leading-relaxed font-medium">{previewTrack.description}</p>}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
