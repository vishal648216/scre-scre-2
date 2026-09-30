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
  Loader2,
  CheckCircle2,
  Layers,
  FileVideo,
  Folder,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface CourseVideoItem {
  id: string;
  title: string;
  description?: string;
  platform: string; // 'youtube', 'video_file', 'google_meet', 'zoom', 'other'
  join_url: string;
  course_id?: string;
  course_name?: string;
  subject_name?: string;
  instructor_name?: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  thumbnail_url?: string;
  is_published?: boolean;
}

interface CourseOption {
  id: string;
  course_name: string;
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
    scheduled_at: new Date().toISOString(),
    duration_minutes: 45,
    status: "completed",
    is_published: true,
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
    scheduled_at: new Date().toISOString(),
    duration_minutes: 60,
    status: "completed",
    is_published: true,
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
    scheduled_at: new Date().toISOString(),
    duration_minutes: 55,
    status: "completed",
    is_published: true,
  },
];

export default function AdminVideoCoursesManagerPage() {
  const [videos, setVideos] = useState<CourseVideoItem[]>(INITIAL_VIDEOS);
  const [courses, setCourses] = useState<CourseOption[]>(DEFAULT_COURSES);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("catalog");
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");

  // Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<CourseVideoItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    platform: "youtube",
    join_url: "",
    course_id: "",
    subject_name: "",
    instructor_name: "Academic Faculty",
    duration_minutes: "45",
  });

  // Extract YouTube ID helper
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

  const [userProfile, setUserProfile] = useState<any>(null);

  // Fetch logged-in user profile & role
  const fetchUserProfile = useCallback(async () => {
    try {
      const res = await apiFetch("/api/users/me");
      if (res.ok) {
        const u = await res.json();
        setUserProfile(u);
      }
    } catch {}
  }, []);

  // Fetch API classes
  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/live-classes?status=all");
      if (res.ok) {
        const data = await res.json();
        const raw: CourseVideoItem[] = data.classes || [];
        if (raw.length > 0) {
          setVideos([...raw, ...INITIAL_VIDEOS]);
        } else {
          setVideos(INITIAL_VIDEOS);
        }
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
  }, [fetchUserProfile, fetchVideos, fetchCourses]);

  const handleOpenAddModal = () => {
    setEditingVideo(null);
    setForm({
      title: "",
      description: "",
      platform: "youtube",
      join_url: "",
      course_id: courses[0]?.id || "",
      subject_name: "",
      instructor_name: "Academic Faculty",
      duration_minutes: "45",
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
      subject_name: video.subject_name || "",
      instructor_name: video.instructor_name || "Academic Faculty",
      duration_minutes: String(video.duration_minutes || 45),
    });
    setIsModalOpen(true);
  };

  const handleSaveVideo = async () => {
    if (!form.title.trim()) return toast.error("Please enter video title");
    if (!form.join_url.trim()) return toast.error("Please enter YouTube or Video URL");

    setSaving(true);
    try {
      const matchedCourse = courses.find((c) => c.id === form.course_id);
      const payload = {
        title: form.title,
        description: form.description || null,
        platform: form.platform,
        join_url: form.join_url,
        course_id: form.course_id || null,
        scheduled_at: new Date().toISOString(),
        duration_minutes: parseInt(form.duration_minutes) || 45,
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
        toast.success(editingVideo ? "Course video updated!" : "YouTube / Course video uploaded successfully!");
        
        // Update local state immediately
        const newV: CourseVideoItem = {
          id: editingVideo ? editingVideo.id : `v_${Date.now()}`,
          title: form.title,
          description: form.description,
          platform: form.platform,
          join_url: form.join_url,
          course_id: form.course_id,
          course_name: matchedCourse?.course_name || "General Computer Course",
          subject_name: form.subject_name || "Module Lecture",
          instructor_name: form.instructor_name,
          scheduled_at: new Date().toISOString(),
          duration_minutes: parseInt(form.duration_minutes) || 45,
          status: "completed",
          is_published: true,
        };

        if (editingVideo) {
          setVideos(videos.map((v) => (v.id === editingVideo.id ? newV : v)));
        } else {
          setVideos([newV, ...videos]);
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
    if (!confirm("Are you sure you want to delete this course video lecture?")) return;
    try {
      await apiFetch(`/api/live-classes/${id}`, { method: "DELETE" });
      setVideos(videos.filter((v) => v.id !== id));
      toast.success("Video lecture removed");
    } catch {
      toast.error("Failed to delete video");
    }
  };

  const filteredVideos = videos.filter((v) => {
    const matchesSearch =
      v.title.toLowerCase().includes(search.toLowerCase()) ||
      (v.description && v.description.toLowerCase().includes(search.toLowerCase())) ||
      (v.subject_name && v.subject_name.toLowerCase().includes(search.toLowerCase()));

    const matchesCourse =
      courseFilter === "all" ||
      v.course_id === courseFilter ||
      v.course_name === courseFilter;

    return matchesSearch && matchesCourse;
  });

  const previewYtId = extractYouTubeId(form.join_url);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-slate-900 via-red-950 to-slate-900 text-white p-6 md:p-8 rounded-none border border-border shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-red-600 text-white rounded-none font-bold uppercase text-[10px] tracking-widest gap-1">
                <Tv className="w-3.5 h-3.5" /> Video Course Upload & Playlist Studio
              </Badge>
              {userProfile?.role === "superadmin" ? (
                <Badge className="bg-amber-500 text-slate-950 rounded-none font-bold uppercase text-[10px] tracking-wider">
                  ⚡ SuperAdmin: All Centers Access
                </Badge>
              ) : (
                <Badge className="bg-indigo-600 text-white rounded-none font-bold uppercase text-[10px] tracking-wider">
                  📍 Center Scoped: {userProfile?.center_name || "Franchise Branch"}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-heading font-black tracking-tight uppercase flex items-center gap-3 text-white">
              <Film className="w-8 h-8 text-amber-400" /> Course Videos & YouTube Management
            </h1>
            <p className="text-xs md:text-sm text-slate-300">
              Upload YouTube lectures, MP4 video recordings, course playlists, and subject masterclasses for students across all centers.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              onClick={handleOpenAddModal}
              className="rounded-none bg-red-600 hover:bg-red-700 text-white font-bold gap-2 text-xs h-10 px-4"
            >
              <Plus className="w-4 h-4" /> Upload Course Video / YouTube
            </Button>
            <Button
              onClick={() => window.open("/dashboard/student/recorded", "_blank")}
              variant="outline"
              className="rounded-none text-white border-white/20 hover:bg-white/10 text-xs h-10 gap-2"
            >
              <Eye className="w-4 h-4 text-amber-400" /> Student View Portal
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-none border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-600/10 text-red-600 dark:text-red-400">
                  <Tv className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-black">{videos.length}</p>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Total Video Lectures</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Folder className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-black">{courses.length}</p>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Course Series</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-black">
                    {videos.reduce((acc, v) => acc + (v.duration_minutes || 45), 0)} Mins
                  </p>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Total Learning Time</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-black">100% Active</p>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Published Status</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter & Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-4 rounded-none border border-border">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by video title, subject, instructor..."
              className="pl-9 rounded-none h-9 text-xs"
            />
          </div>

          <div className="w-full sm:w-72">
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="rounded-none h-9 text-xs">
                <SelectValue placeholder="All Courses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Enrolled Courses</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.course_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Catalog List / Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredVideos.length === 0 ? (
          <Card className="rounded-none border-border">
            <CardContent className="py-14 text-center text-muted-foreground">
              <Video className="w-12 h-12 mx-auto mb-3 opacity-40 text-primary" />
              <p className="font-bold text-base text-foreground">No course videos found matching your filter.</p>
              <Button onClick={handleOpenAddModal} className="mt-4 rounded-none bg-red-600 hover:bg-red-700 text-white gap-2 text-xs">
                <Plus className="w-4 h-4" /> Upload First Video
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredVideos.map((vid) => {
              const ytId = extractYouTubeId(vid.join_url);
              const thumb = getThumbnail(vid);
              const courseName = courses.find((c) => c.id === vid.course_id)?.course_name || vid.course_name;

              return (
                <Card key={vid.id} className="rounded-none border-border overflow-hidden flex flex-col justify-between group shadow-sm hover:border-red-500/50 transition-all">
                  <div>
                    {/* Thumbnail preview */}
                    <div className="relative aspect-video bg-slate-900 overflow-hidden">
                      {thumb ? (
                        <img src={thumb} alt={vid.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-950">
                          <Film className="w-12 h-12 text-slate-700" />
                        </div>
                      )}

                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        <Badge className="bg-red-600 text-white rounded-none text-[10px] font-bold uppercase gap-1">
                          <Tv className="w-3 h-3" /> {ytId ? "YouTube" : "Video URL"}
                        </Badge>
                      </div>

                      <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-mono px-2 py-0.5">
                        {vid.duration_minutes || 45} mins
                      </div>
                    </div>

                    {/* Meta info */}
                    <CardContent className="p-4 space-y-2">
                      {courseName && (
                        <Badge variant="outline" className="rounded-none text-[10px] uppercase font-semibold">
                          {courseName}
                        </Badge>
                      )}

                      <h3 className="font-bold text-sm text-foreground line-clamp-2 leading-snug">
                        {vid.title}
                      </h3>

                      {vid.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{vid.description}</p>
                      )}

                      <div className="text-[11px] text-muted-foreground flex items-center gap-1 pt-1 font-medium">
                        <GraduationCap className="w-3.5 h-3.5 text-primary" /> Instructor: {vid.instructor_name || "Academic Faculty"}
                      </div>
                    </CardContent>
                  </div>

                  {/* Actions footer */}
                  <div className="p-4 pt-0 border-t border-border/40 mt-2 flex items-center justify-between gap-2">
                    <Button
                      onClick={() => window.open(vid.join_url, "_blank")}
                      size="sm"
                      variant="outline"
                      className="rounded-none text-xs h-8 gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Play Link
                    </Button>

                    <div className="flex items-center gap-1">
                      <Button onClick={() => handleOpenEditModal(vid)} size="sm" variant="ghost" className="rounded-none h-8 w-8 p-0">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button onClick={() => handleDeleteVideo(vid.id)} size="sm" variant="ghost" className="rounded-none h-8 w-8 p-0 text-destructive hover:text-destructive">
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
          <DialogContent className="max-w-xl rounded-none">
            <DialogHeader>
              <DialogTitle className="font-heading uppercase font-bold text-base flex items-center gap-2">
                <Tv className="w-5 h-5 text-red-600" />
                {editingVideo ? "Edit Course Video Lecture" : "Upload Course Video / YouTube Link"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <Label>Video Lecture Title *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. DCA Chapter 1 – Introduction to Computer Hardware"
                  className="rounded-none"
                />
              </div>

              <div className="space-y-1">
                <Label>Course Assignment *</Label>
                <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
                  <SelectTrigger className="rounded-none">
                    <SelectValue placeholder="Select Course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.course_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Video Platform Source</Label>
                  <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                    <SelectTrigger className="rounded-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="youtube">📺 YouTube Video Link</SelectItem>
                      <SelectItem value="video_file">📼 MP4 / Cloud Storage Video</SelectItem>
                      <SelectItem value="google_meet">🎥 Live Stream Recording</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Duration (Minutes)</Label>
                  <Input
                    type="number"
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                    className="rounded-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>YouTube Video Link or MP4 URL *</Label>
                <Input
                  value={form.join_url}
                  onChange={(e) => setForm({ ...form, join_url: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="rounded-none"
                />
              </div>

              {/* YouTube Live Form Preview */}
              {previewYtId && (
                <div className="space-y-1 bg-slate-950 p-2 border border-border">
                  <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Live YouTube Link Detected
                  </p>
                  <div className="aspect-video w-full max-h-48">
                    <iframe
                      src={`https://www.youtube.com/embed/${previewYtId}`}
                      title="YouTube Preview"
                      className="w-full h-full border-0"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Subject / Topic Name</Label>
                  <Input
                    value={form.subject_name}
                    onChange={(e) => setForm({ ...form, subject_name: e.target.value })}
                    placeholder="e.g. Computer Fundamentals"
                    className="rounded-none"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Faculty / Instructor Name</Label>
                  <Input
                    value={form.instructor_name}
                    onChange={(e) => setForm({ ...form, instructor_name: e.target.value })}
                    placeholder="e.g. Er. Rahul Verma"
                    className="rounded-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Description / Lecture Notes Summary</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Briefly describe what students will learn in this video..."
                  className="rounded-none resize-none"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-none text-xs">
                Cancel
              </Button>
              <Button onClick={handleSaveVideo} disabled={saving} className="rounded-none bg-red-600 hover:bg-red-700 text-white font-bold gap-2 text-xs">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editingVideo ? "Update Video" : "Publish Course Video"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
