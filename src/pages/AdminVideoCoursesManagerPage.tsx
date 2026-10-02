import React, { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

export interface CourseVideoItem {
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

const INITIAL_VIDEOS: CourseVideoItem[] = [
  {
    id: "v1",
    title: "DCA Chapter 1: Introduction to Computer Fundamentals & Hardware",
    description: "Detailed video lecture explaining CPU components, RAM vs ROM, motherboard architecture, and input/output peripherals.",
    platform: "youtube",
    join_url: "https://www.youtube.com/watch?v=L2G3s_4S-qE",
    course_id: "c1",
    course_name: "Diploma in Computer Application (DCA)",
    subject_name: "Computer Fundamentals",
    instructor_name: "Er. Rahul Verma",
    center_id: "all",
    center_name: "All Centers (Global)",
    scheduled_at: new Date().toISOString(),
    duration_minutes: 45,
    status: "completed",
    is_hidden: false,
  },
  {
    id: "v2",
    title: "Tally Prime Masterclass: GST Ledger Creation & Voucher Entry",
    description: "Complete guide on setting up Tally Prime, creating CGST/SGST/IGST tax ledgers, and recording sales/purchase invoices.",
    platform: "youtube",
    join_url: "https://www.youtube.com/watch?v=Ke90Tje7VS0",
    course_id: "c3",
    course_name: "Master Tally Prime & GST Accounting",
    subject_name: "Tally Accounting",
    instructor_name: "CA Ankit Agarwal",
    center_id: "all",
    center_name: "All Centers (Global)",
    scheduled_at: new Date().toISOString(),
    duration_minutes: 60,
    status: "completed",
    is_hidden: false,
  },
  {
    id: "v3",
    title: "ADCA Photoshop Design: Social Media Poster & Banner Creation",
    description: "Learn layer blending modes, masking techniques, clipping paths, typography, and image color correction in Photoshop CC.",
    platform: "youtube",
    join_url: "https://www.youtube.com/watch?v=IyR_uYsRdHs",
    course_id: "c2",
    course_name: "Advanced Diploma in Computer Application (ADCA)",
    subject_name: "Graphic Design",
    instructor_name: "Pooja Sharma",
    center_id: "all",
    center_name: "All Centers (Global)",
    scheduled_at: new Date().toISOString(),
    duration_minutes: 55,
    status: "completed",
    is_hidden: false,
  },
  {
    id: "v4",
    title: "Official SCRE Computer Education YouTube Channel Feed",
    description: "Subscribed official YouTube channel playlist stream auto-categorized into DCA, ADCA, Tally, and Web Development modules.",
    platform: "youtube_channel",
    join_url: "https://www.youtube.com/@SCRE_Education",
    course_id: "c5",
    course_name: "Web Development & MERN Stack",
    subject_name: "Official Channel Series",
    instructor_name: "SCRE Faculty Studio",
    center_id: "all",
    center_name: "All Centers (Global)",
    scheduled_at: new Date().toISOString(),
    duration_minutes: 120,
    status: "completed",
    is_hidden: false,
  },
];

export default function AdminVideoCoursesManagerPage() {
  const [videos, setVideos] = useState<CourseVideoItem[]>(INITIAL_VIDEOS);
  const [courses, setCourses] = useState<CourseOption[]>(DEFAULT_COURSES);
  const [centers, setCenters] = useState<CenterOption[]>([
    { id: "all", center_name: "All Centers (Global)" },
  ]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [centerFilter, setCenterFilter] = useState("all");
  const [tabFilter, setTabFilter] = useState("all"); // 'all', 'youtube', 'channel', 'mp4', 'hidden'

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<CourseVideoItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Player Preview Modal
  const [previewVideo, setPreviewVideo] = useState<CourseVideoItem | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    platform: "youtube",
    join_url: "",
    course_id: "",
    center_id: "all",
    subject_name: "",
    instructor_name: "Academic Faculty",
    duration_minutes: "45",
    is_hidden: false,
  });

  const [userProfile, setUserProfile] = useState<any>(null);

  // Helpers
  const extractYouTubeId = (url: string): string | null => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const getThumbnail = (video: CourseVideoItem): string => {
    if (video.thumbnail_url) return video.thumbnail_url;
    const ytId = extractYouTubeId(video.join_url);
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

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/live-classes?status=all");
      if (res.ok) {
        const data = await res.json();
        const raw: CourseVideoItem[] = data.classes || [];
        if (raw.length > 0) {
          // Merge with initial demo videos if needed
          setVideos([...raw, ...INITIAL_VIDEOS]);
        } else {
          setVideos(INITIAL_VIDEOS);
        }
      } else {
        setVideos(INITIAL_VIDEOS);
      }
    } catch {
      setVideos(INITIAL_VIDEOS);
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
    fetchVideos();
    fetchCourses();
    fetchCenters();
  }, [fetchUserProfile, fetchVideos, fetchCourses, fetchCenters]);

  const handleOpenAddModal = () => {
    setEditingVideo(null);
    setForm({
      title: "",
      description: "",
      platform: "youtube",
      join_url: "",
      course_id: courses[0]?.id || "c1",
      center_id: "all",
      subject_name: "",
      instructor_name: "Academic Faculty",
      duration_minutes: "45",
      is_hidden: false,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (video: CourseVideoItem) => {
    setEditingVideo(video);
    setForm({
      title: video.title,
      description: video.description || "",
      platform: video.platform || "youtube",
      join_url: video.join_url || "",
      course_id: video.course_id || "",
      center_id: video.center_id || "all",
      subject_name: video.subject_name || "",
      instructor_name: video.instructor_name || "Academic Faculty",
      duration_minutes: String(video.duration_minutes || 45),
      is_hidden: !!video.is_hidden,
    });
    setIsModalOpen(true);
  };

  const handleToggleHide = async (video: CourseVideoItem) => {
    const newHiddenState = !video.is_hidden;
    try {
      await apiFetch(`/api/live-classes/${video.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_hidden: newHiddenState,
          status: newHiddenState ? "hidden" : "completed",
        }),
      });

      setVideos((prev) =>
        prev.map((v) =>
          v.id === video.id
            ? { ...v, is_hidden: newHiddenState, status: newHiddenState ? "hidden" : "completed" }
            : v
        )
      );

      toast.success(
        newHiddenState
          ? `"${video.title}" is now hidden from Students.`
          : `"${video.title}" is now published & visible to Students!`
      );
    } catch {
      toast.error("Failed to update visibility state");
    }
  };

  const handleSaveVideo = async () => {
    if (!form.title.trim()) return toast.error("Please enter video title");
    if (!form.join_url.trim()) return toast.error("Please enter YouTube URL or MP4 Link");

    setSaving(true);
    try {
      const matchedCourse = courses.find((c) => c.id === form.course_id);
      const matchedCenter = centers.find((c) => c.id === form.center_id);

      const payload = {
        title: form.title,
        description: form.description || null,
        platform: form.platform,
        join_url: form.join_url,
        course_id: form.course_id || null,
        center_id: form.center_id === "all" ? null : form.center_id,
        center_name: matchedCenter?.center_name || "All Centers (Global)",
        subject_name: form.subject_name || "Course Lecture",
        instructor_name: form.instructor_name || "Academic Faculty",
        scheduled_at: new Date().toISOString(),
        duration_minutes: parseInt(form.duration_minutes) || 45,
        is_hidden: form.is_hidden,
        status: form.is_hidden ? "hidden" : "completed",
      };

      let res;
      if (editingVideo) {
        res = await apiFetch(`/api/live-classes/${editingVideo.id}`, {
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
        toast.success(editingVideo ? "Video lecture updated successfully!" : "Course video / YouTube channel added successfully!");

        const updatedItem: CourseVideoItem = {
          id: editingVideo ? editingVideo.id : `v_${Date.now()}`,
          title: form.title,
          description: form.description,
          platform: form.platform,
          join_url: form.join_url,
          course_id: form.course_id,
          course_name: matchedCourse?.course_name || "General Computer Course",
          subject_name: form.subject_name || "Module Lecture",
          instructor_name: form.instructor_name,
          center_id: form.center_id,
          center_name: matchedCenter?.center_name || "All Centers (Global)",
          scheduled_at: new Date().toISOString(),
          duration_minutes: parseInt(form.duration_minutes) || 45,
          status: form.is_hidden ? "hidden" : "completed",
          is_hidden: form.is_hidden,
        };

        if (editingVideo) {
          setVideos(videos.map((v) => (v.id === editingVideo.id ? updatedItem : v)));
        } else {
          setVideos([updatedItem, ...videos]);
        }

        setIsModalOpen(false);
      } else {
        toast.error(data.message || "Failed to save video");
      }
    } catch {
      toast.error("Error connecting to server");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVideo = async (id: string) => {
    if (!confirm("Are you sure you want to delete this video lecture?")) return;
    try {
      await apiFetch(`/api/live-classes/${id}`, { method: "DELETE" });
      setVideos(videos.filter((v) => v.id !== id));
      toast.success("Video lecture deleted");
    } catch {
      toast.error("Failed to delete video");
    }
  };

  const handleOpenPreview = (video: CourseVideoItem) => {
    setPreviewVideo(video);
    setIsPreviewOpen(true);
  };

  const filteredVideos = videos.filter((v) => {
    const matchesSearch =
      v.title.toLowerCase().includes(search.toLowerCase()) ||
      (v.description && v.description.toLowerCase().includes(search.toLowerCase())) ||
      (v.subject_name && v.subject_name.toLowerCase().includes(search.toLowerCase())) ||
      (v.instructor_name && v.instructor_name.toLowerCase().includes(search.toLowerCase()));

    const matchesCourse =
      courseFilter === "all" || v.course_id === courseFilter || v.course_name === courseFilter;

    const matchesCenter =
      centerFilter === "all" || v.center_id === centerFilter || v.center_id === "all";

    const matchesTab =
      tabFilter === "all" ||
      (tabFilter === "youtube" && (v.platform === "youtube" || v.join_url.includes("youtube.com/watch"))) ||
      (tabFilter === "channel" && (v.platform === "youtube_channel" || v.platform === "youtube_playlist" || v.join_url.includes("/@") || v.join_url.includes("playlist"))) ||
      (tabFilter === "mp4" && (v.platform === "video_file" || v.join_url.endsWith(".mp4"))) ||
      (tabFilter === "hidden" && v.is_hidden);

    return matchesSearch && matchesCourse && matchesCenter && matchesTab;
  });

  const previewYtId = extractYouTubeId(form.join_url);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-16">
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-slate-900 via-red-950 to-slate-900 text-white p-6 md:p-8 rounded-2xl border border-red-500/20 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-red-600 text-white rounded-full font-bold uppercase text-[10px] tracking-widest gap-1 px-3 py-1">
                <Tv className="w-3.5 h-3.5" /> Video Course Upload & Channel Studio
              </Badge>
              {userProfile?.role === "superadmin" ? (
                <Badge className="bg-amber-500 text-slate-950 rounded-full font-bold uppercase text-[10px] tracking-wider px-3 py-1">
                  ⚡ SuperAdmin: All Centers Scoped
                </Badge>
              ) : (
                <Badge className="bg-indigo-600 text-white rounded-full font-bold uppercase text-[10px] tracking-wider px-3 py-1">
                  📍 Center: {userProfile?.center_name || "Franchise Branch"}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-heading font-black tracking-tight uppercase flex items-center gap-3 text-white">
              <Film className="w-8 h-8 text-amber-400" /> Course Videos & YouTube Management
            </h1>
            <p className="text-xs md:text-sm text-slate-300">
              Manage YouTube channel playlists, MP4 recordings, center-wise video allotments, and control student visibility (Edit, Delete, Hide/Unhide).
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              onClick={handleOpenAddModal}
              className="rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold gap-2 text-xs h-11 px-5 shadow-lg shadow-red-600/30"
            >
              <Plus className="w-4 h-4" /> Upload Course Video / YouTube
            </Button>
            <Button
              onClick={() => window.open("/dashboard/student/recorded", "_blank")}
              variant="outline"
              className="rounded-2xl text-white border-white/20 hover:bg-white/10 text-xs h-11 px-4 gap-2"
            >
              <Eye className="w-4 h-4 text-amber-400" /> Student View Portal
            </Button>
          </div>
        </div>

        {/* Analytics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-border bg-card/70 backdrop-blur">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-red-600/10 text-red-600 dark:text-red-400">
                  <Tv className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-black">{videos.length}</p>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Total Video Lectures</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-card/70 backdrop-blur">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <ListVideo className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-black">
                    {videos.filter((v) => v.platform === "youtube_channel" || v.platform === "youtube_playlist").length || 2}
                  </p>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">YouTube Channels & Playlists</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-card/70 backdrop-blur">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-black">
                    {videos.reduce((acc, v) => acc + (v.duration_minutes || 45), 0)} Mins
                  </p>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Total Learning Hours</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-card/70 backdrop-blur">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-slate-500/10 text-slate-400">
                  <EyeOff className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-black">
                    {videos.filter((v) => v.is_hidden).length} Hidden
                  </p>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Hidden from Students</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card/80 backdrop-blur border border-border p-4 rounded-2xl shadow-sm">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, instructor, topic..."
              className="pl-10 rounded-xl h-10 text-xs font-bold bg-background/50 border-border"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Center Selector */}
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

            {/* Course Selector */}
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

        {/* Category Tabs */}
        <Tabs value={tabFilter} onValueChange={setTabFilter} className="w-full">
          <TabsList className="rounded-2xl bg-muted/60 p-1 w-full sm:w-auto grid grid-cols-5 h-11 border border-border">
            <TabsTrigger value="all" className="rounded-xl text-[10px] font-black uppercase px-4">
              All Videos
            </TabsTrigger>
            <TabsTrigger value="channel" className="rounded-xl text-[10px] font-black uppercase px-4">
              Channel / Playlist
            </TabsTrigger>
            <TabsTrigger value="youtube" className="rounded-xl text-[10px] font-black uppercase px-4">
              YouTube Single
            </TabsTrigger>
            <TabsTrigger value="mp4" className="rounded-xl text-[10px] font-black uppercase px-4">
              MP4 Recordings
            </TabsTrigger>
            <TabsTrigger value="hidden" className="rounded-xl text-[10px] font-black uppercase px-4 text-amber-500">
              Hidden
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Catalog Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredVideos.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-2 border-border bg-card/40 py-16 text-center">
            <CardContent className="space-y-3">
              <Video className="w-12 h-12 text-muted-foreground/40 mx-auto" />
              <p className="font-bold text-base text-foreground uppercase tracking-tight">No course videos found matching current filters.</p>
              <Button onClick={handleOpenAddModal} className="mt-2 rounded-xl bg-red-600 hover:bg-red-700 text-white gap-2 text-xs font-bold uppercase">
                <Plus className="w-4 h-4" /> Upload First Video / YouTube
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVideos.map((vid) => {
              const ytId = extractYouTubeId(vid.join_url);
              const thumb = getThumbnail(vid);
              const courseName = courses.find((c) => c.id === vid.course_id)?.course_name || vid.course_name;
              const isChannelOrPlaylist = vid.platform === "youtube_channel" || vid.platform === "youtube_playlist" || vid.join_url.includes("/@") || vid.join_url.includes("playlist");
              const isMp4 = vid.platform === "video_file" || vid.join_url.endsWith(".mp4");

              return (
                <Card
                  key={vid.id}
                  className={`rounded-2xl border overflow-hidden flex flex-col justify-between group shadow-md transition-all duration-300 ${
                    vid.is_hidden
                      ? "border-amber-500/40 bg-slate-950/60 opacity-80"
                      : "border-border/80 bg-card hover:border-red-500/50"
                  }`}
                >
                  <div>
                    {/* Thumbnail Box */}
                    <div className="relative aspect-video bg-slate-950 overflow-hidden cursor-pointer" onClick={() => handleOpenPreview(vid)}>
                      {thumb ? (
                        <img src={thumb} alt={vid.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-red-950">
                          <Film className="w-12 h-12 text-red-500/40 mb-2" />
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                            {isMp4 ? "MP4 Video Recording" : "YouTube Lecture"}
                          </span>
                        </div>
                      )}

                      {/* Top Badges */}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
                        {isChannelOrPlaylist ? (
                          <Badge className="bg-amber-500 text-slate-950 font-black uppercase text-[9px] rounded-full gap-1">
                            <Radio className="w-3 h-3" /> YouTube Channel / Series
                          </Badge>
                        ) : isMp4 ? (
                          <Badge className="bg-indigo-600 text-white font-black uppercase text-[9px] rounded-full gap-1">
                            <FileVideo className="w-3 h-3" /> MP4 Video File
                          </Badge>
                        ) : (
                          <Badge className="bg-red-600 text-white font-black uppercase text-[9px] rounded-full gap-1">
                            <Tv className="w-3 h-3" /> YouTube Video
                          </Badge>
                        )}

                        {vid.is_hidden && (
                          <Badge className="bg-amber-500/90 text-slate-950 font-black uppercase text-[9px] rounded-full gap-1 border border-amber-400">
                            <EyeOff className="w-3 h-3" /> Hidden from Students
                          </Badge>
                        )}
                      </div>

                      {/* Play Hover Overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl">
                          <Play className="w-5 h-5 fill-white ml-0.5" />
                        </div>
                      </div>

                      <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-mono px-2 py-0.5 rounded-full backdrop-blur border border-white/10">
                        {vid.duration_minutes || 45} mins
                      </div>
                    </div>

                    {/* Metadata Content */}
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {courseName && (
                          <Badge variant="outline" className="rounded-full text-[9px] uppercase font-bold text-primary border-primary/30">
                            {courseName}
                          </Badge>
                        )}
                        {vid.center_name && (
                          <Badge variant="secondary" className="rounded-full text-[9px] font-bold">
                            📍 {vid.center_name}
                          </Badge>
                        )}
                      </div>

                      <h3
                        onClick={() => handleOpenPreview(vid)}
                        className="font-heading font-black text-sm text-foreground line-clamp-2 hover:text-red-500 cursor-pointer leading-snug uppercase tracking-tight"
                      >
                        {vid.title}
                      </h3>

                      {vid.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 font-medium">{vid.description}</p>
                      )}

                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1 font-semibold">
                        <GraduationCap className="w-3.5 h-3.5 text-primary" /> Faculty: {vid.instructor_name || "Academic Faculty"}
                      </div>
                    </CardContent>
                  </div>

                  {/* Actions Footer - Edit, Delete, Hide/Unhide */}
                  <div className="p-4 pt-0 border-t border-border/40 mt-2 flex items-center justify-between gap-2">
                    <Button
                      onClick={() => handleOpenPreview(vid)}
                      size="sm"
                      variant="outline"
                      className="rounded-xl text-xs h-8 gap-1.5 font-bold"
                    >
                      <Play className="w-3 h-3 text-red-500" /> Play & Preview
                    </Button>

                    <div className="flex items-center gap-1">
                      {/* Hide / Unhide Toggle */}
                      <Button
                        onClick={() => handleToggleHide(vid)}
                        size="sm"
                        variant={vid.is_hidden ? "default" : "ghost"}
                        className={`rounded-xl h-8 px-2.5 text-xs font-bold gap-1 ${
                          vid.is_hidden
                            ? "bg-amber-500 hover:bg-amber-600 text-slate-950"
                            : "text-muted-foreground hover:text-amber-500"
                        }`}
                        title={vid.is_hidden ? "Click to Unhide for Students" : "Click to Hide from Students"}
                      >
                        {vid.is_hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">{vid.is_hidden ? "Unhide" : "Hide"}</span>
                      </Button>

                      {/* Edit Button */}
                      <Button onClick={() => handleOpenEditModal(vid)} size="sm" variant="ghost" className="rounded-xl h-8 w-8 p-0" title="Edit Video">
                        <Pencil className="w-3.5 h-3.5 text-blue-400" />
                      </Button>

                      {/* Delete Button */}
                      <Button onClick={() => handleDeleteVideo(vid.id)} size="sm" variant="ghost" className="rounded-xl h-8 w-8 p-0 text-destructive hover:text-destructive" title="Delete Video">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* UPLOAD / EDIT DIALOG */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-xl rounded-2xl border-border">
            <DialogHeader>
              <DialogTitle className="font-heading uppercase font-bold text-base flex items-center gap-2">
                <Tv className="w-5 h-5 text-red-600" />
                {editingVideo ? "Edit Course Video / YouTube Link" : "Upload Course Video or YouTube Channel"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="space-y-1">
                <Label className="font-bold">Video Lecture or Channel Title *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. DCA Chapter 1 – Computer Hardware Fundamentals"
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="font-bold">Media Type Source</Label>
                  <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                    <SelectTrigger className="rounded-xl h-10 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="youtube">📺 YouTube Single Video</SelectItem>
                      <SelectItem value="youtube_channel">📻 YouTube Channel Handle / URL</SelectItem>
                      <SelectItem value="youtube_playlist">📋 YouTube Playlist URL</SelectItem>
                      <SelectItem value="video_file">📼 Direct MP4 Video URL</SelectItem>
                    </SelectContent>
                  </Select>
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

              <div className="space-y-1">
                <Label className="font-bold">YouTube URL / Channel Link / MP4 Video Link *</Label>
                <Input
                  value={form.join_url}
                  onChange={(e) => setForm({ ...form, join_url: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=... or https://youtube.com/@channel or .mp4 URL"
                  className="rounded-xl h-10 font-bold"
                />
              </div>

              {/* YouTube Live Form Preview */}
              {previewYtId && (
                <div className="space-y-1 bg-slate-950 p-3 rounded-xl border border-border">
                  <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Live YouTube Link Validated
                  </p>
                  <div className="aspect-video w-full max-h-48 rounded-lg overflow-hidden">
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
                  <Label className="font-bold">Subject / Topic</Label>
                  <Input
                    value={form.subject_name}
                    onChange={(e) => setForm({ ...form, subject_name: e.target.value })}
                    placeholder="e.g. Hardware Fundamentals"
                    className="rounded-xl h-10 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="font-bold">Instructor Name</Label>
                  <Input
                    value={form.instructor_name}
                    onChange={(e) => setForm({ ...form, instructor_name: e.target.value })}
                    placeholder="e.g. Er. Rahul Verma"
                    className="rounded-xl h-10 font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="font-bold">Description / Lecture Notes</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Summary of topics covered in this video lecture..."
                  className="rounded-xl resize-none font-medium text-xs"
                  rows={3}
                />
              </div>

              {/* Visibility Hide Toggle */}
              <div className="flex items-center justify-between bg-muted/40 p-3 rounded-xl border border-border">
                <div>
                  <p className="font-bold text-xs text-foreground">Hide Video from Students?</p>
                  <p className="text-[11px] text-muted-foreground">If hidden, this video will not appear in student portals.</p>
                </div>
                <Button
                  type="button"
                  variant={form.is_hidden ? "default" : "outline"}
                  onClick={() => setForm({ ...form, is_hidden: !form.is_hidden })}
                  className={`rounded-xl text-xs font-bold gap-1.5 px-4 ${
                    form.is_hidden ? "bg-amber-500 hover:bg-amber-600 text-slate-950" : ""
                  }`}
                >
                  {form.is_hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {form.is_hidden ? "Hidden" : "Visible"}
                </Button>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl text-xs font-bold">
                Cancel
              </Button>
              <Button onClick={handleSaveVideo} disabled={saving} className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold gap-2 text-xs">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editingVideo ? "Update Video" : "Publish Video"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Video Preview Player Modal */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-3xl rounded-2xl p-0 overflow-hidden bg-slate-950 text-white border border-slate-800">
            {previewVideo && (
              <div>
                <div className="relative aspect-video w-full bg-black">
                  {extractYouTubeId(previewVideo.join_url) ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${extractYouTubeId(previewVideo.join_url)}?autoplay=1`}
                      title={previewVideo.title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video controls autoPlay src={previewVideo.join_url} className="w-full h-full object-contain" />
                  )}
                </div>

                <div className="p-5 space-y-3 bg-slate-900 text-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <Badge className="bg-red-600 text-white rounded-full uppercase text-[10px] font-bold">
                      {previewVideo.platform === "youtube" ? "📺 YouTube Video" : "📼 Video File"}
                    </Badge>
                    <span className="text-xs text-slate-400 font-mono">Duration: {previewVideo.duration_minutes || 45} mins</span>
                  </div>

                  <h2 className="text-lg font-black uppercase text-white tracking-tight">{previewVideo.title}</h2>
                  {previewVideo.description && <p className="text-xs text-slate-300 leading-relaxed font-medium">{previewVideo.description}</p>}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
