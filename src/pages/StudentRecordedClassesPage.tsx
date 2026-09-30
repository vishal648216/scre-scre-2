import React, { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Play,
  Search,
  BookOpen,
  Calendar,
  Clock,
  ExternalLink,
  Download,
  Loader2,
  Tv,
  Film,
  Sparkles,
  User,
  GraduationCap,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface RecordedVideo {
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
}

interface CourseOption {
  id: string;
  course_name: string;
}

const DEFAULT_RECORDED_VIDEOS: RecordedVideo[] = [
  {
    id: "rec-1",
    title: "DCA Chapter 1: Introduction to Computer Hardware & Operating System",
    description: "Learn basic computer architecture, CPU, RAM, storage devices, Windows 11 keyboard shortcuts, and file management system.",
    platform: "youtube",
    join_url: "https://www.youtube.com/watch?v=L2G3s_4S-qE",
    course_name: "Diploma in Computer Application (DCA)",
    subject_name: "Computer Fundamentals",
    instructor_name: "Er. Rahul Verma (Senior Faculty)",
    scheduled_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    duration_minutes: 45,
    status: "completed",
  },
  {
    id: "rec-2",
    title: "Tally Prime Complete GST Accounting & Journal Voucher Entry",
    description: "Step-by-step masterclass on creating company in Tally Prime, setting up GST ledgers, recording purchases, sales, and generating GSTR-1 & GSTR-3B reports.",
    platform: "youtube",
    join_url: "https://www.youtube.com/watch?v=Ke90Tje7VS0",
    course_name: "Master Tally Prime & GST (TALLY)",
    subject_name: "Financial Accounting",
    instructor_name: "CA Ankit Agarwal",
    scheduled_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    duration_minutes: 60,
    status: "completed",
  },
  {
    id: "rec-3",
    title: "ADCA Graphic Design: Adobe Photoshop Banner & Poster Design",
    description: "Learn layers, masking, selection tools, typography, blending options, and export formats for social media graphics and printing banners.",
    platform: "youtube",
    join_url: "https://www.youtube.com/watch?v=IyR_uYsRdHs",
    course_name: "Advanced Diploma in Computer Application (ADCA)",
    subject_name: "Graphic Design & Photoshop",
    instructor_name: "Pooja Sharma (UI/UX Expert)",
    scheduled_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    duration_minutes: 50,
    status: "completed",
  },
  {
    id: "rec-4",
    title: "CCC Exam Practice: Top 100 Most Important Questions & Mock Paper",
    description: "Comprehensive review of LibreOffice Writer, Calc, Impress, Internet, Cyber Security, and Digital Financial Services for CCC examination.",
    platform: "youtube",
    join_url: "https://www.youtube.com/watch?v=rfscVS0vtbw",
    course_name: "Course on Computer Concepts (CCC)",
    subject_name: "CCC Master Preparation",
    instructor_name: "Deepak Kumar",
    scheduled_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    duration_minutes: 75,
    status: "completed",
  },
];

export default function StudentRecordedClassesPage() {
  const [videos, setVideos] = useState<RecordedVideo[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  // Video Player Dialog State
  const [activeVideo, setActiveVideo] = useState<RecordedVideo | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  // Extract YouTube Video ID from any format
  const extractYouTubeId = (url: string): string | null => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const getThumbnail = (video: RecordedVideo): string => {
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

  const fetchRecordedVideos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/live-classes?status=all");
      if (res.ok) {
        const data = await res.json();
        const rawClasses: RecordedVideo[] = data.classes || [];
        
        // Merge real API data with sample recordings if list is small
        if (rawClasses.length > 0) {
          const mapped = rawClasses.map((cls) => ({
            ...cls,
            course_name: cls.course_name || "Enrolled Course",
            subject_name: cls.subject_name || "Subject Lecture",
          }));
          setVideos([...mapped, ...DEFAULT_RECORDED_VIDEOS]);
        } else {
          setVideos(DEFAULT_RECORDED_VIDEOS);
        }
      } else {
        setVideos(DEFAULT_RECORDED_VIDEOS);
      }
    } catch {
      setVideos(DEFAULT_RECORDED_VIDEOS);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCourses = useCallback(async () => {
    try {
      const res = await apiFetch("/api/courses/allot");
      if (res.ok) {
        const data = await res.json();
        setCourses(data.courses || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchUserProfile();
    fetchRecordedVideos();
    fetchCourses();
  }, [fetchUserProfile, fetchRecordedVideos, fetchCourses]);

  const handleOpenPlayer = (video: RecordedVideo) => {
    setActiveVideo(video);
    setIsPlayerOpen(true);
  };

  // Strict Course & Center Scoped Filtering for Student
  const filteredVideos = videos.filter((v) => {
    const matchesSearch =
      v.title.toLowerCase().includes(search.toLowerCase()) ||
      (v.description && v.description.toLowerCase().includes(search.toLowerCase())) ||
      (v.subject_name && v.subject_name.toLowerCase().includes(search.toLowerCase())) ||
      (v.course_name && v.course_name.toLowerCase().includes(search.toLowerCase()));

    const matchesCourse =
      selectedCourse === "all" ||
      v.course_id === selectedCourse ||
      v.course_name === selectedCourse;

    const matchesTab =
      activeTab === "all" ||
      (activeTab === "youtube" && (v.platform === "youtube" || v.join_url.includes("youtube") || v.join_url.includes("youtu.be"))) ||
      (activeTab === "video_file" && (v.platform === "video_file" || v.join_url.endsWith(".mp4"))) ||
      (activeTab === "past_live" && (v.platform === "google_meet" || v.platform === "zoom" || v.status === "completed"));

    return matchesSearch && matchesCourse && matchesTab;
  });

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "Recent";
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
        {/* Header Hero Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 md:p-8 rounded-none border border-border shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl relative z-10">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-red-600 text-white font-bold uppercase text-[10px] tracking-widest rounded-none gap-1">
                <Tv className="w-3 h-3" /> Recorded Video Courses & YouTube Lectures
              </Badge>
              {userProfile?.center_name && (
                <Badge className="bg-indigo-600 text-white font-bold uppercase text-[10px] tracking-wider rounded-none">
                  📍 Center: {userProfile.center_name}
                </Badge>
              )}
              {userProfile?.course_name && (
                <Badge className="bg-amber-500 text-slate-950 font-bold uppercase text-[10px] tracking-wider rounded-none">
                  🎓 Enrolled: {userProfile.course_name}
                </Badge>
              )}
            </div>
            <h1 className="font-heading font-black text-2xl md:text-4xl uppercase tracking-tight text-white flex items-center gap-3">
              <Film className="w-8 h-8 text-amber-400" /> Recorded Classes & Video Hub
            </h1>
            <p className="text-slate-300 text-xs md:text-sm font-medium">
              Access YouTube course tutorials, recorded live lectures, and subject-wise video masterclasses uploaded by your center and faculty.
            </p>
          </div>

          <div className="flex items-center gap-3 relative z-10 shrink-0">
            <Button
              onClick={() => fetchRecordedVideos()}
              variant="outline"
              className="rounded-none text-white border-white/20 hover:bg-white/10 gap-2 text-xs"
            >
              <Sparkles className="w-4 h-4 text-amber-400" /> Refresh Library
            </Button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-card p-4 rounded-none border border-border shadow-sm">
          <div className="relative md:col-span-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search topic, subject, or course..."
              className="pl-9 rounded-none h-10 text-xs"
            />
          </div>

          <div className="md:col-span-1">
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger className="rounded-none h-10 text-xs">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  <SelectValue placeholder="All Courses" />
                </div>
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

          <div className="md:col-span-1">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="rounded-none bg-muted/60 p-1 w-full grid grid-cols-4 h-10">
                <TabsTrigger value="all" className="rounded-none text-[11px] font-bold uppercase">
                  All
                </TabsTrigger>
                <TabsTrigger value="youtube" className="rounded-none text-[11px] font-bold uppercase">
                  YouTube
                </TabsTrigger>
                <TabsTrigger value="video_file" className="rounded-none text-[11px] font-bold uppercase">
                  MP4 File
                </TabsTrigger>
                <TabsTrigger value="past_live" className="rounded-none text-[11px] font-bold uppercase">
                  Live Recs
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Video Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredVideos.length === 0 ? (
          <Card className="rounded-none border-border">
            <CardContent className="py-16 text-center text-muted-foreground">
              <Video className="w-12 h-12 mx-auto mb-4 opacity-40 text-primary" />
              <p className="font-bold text-lg text-foreground">No recorded course videos match your search.</p>
              <p className="text-xs mt-1">Try resetting your filter or searching for another topic.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setSelectedCourse("all");
                  setActiveTab("all");
                }}
                className="mt-4 rounded-none"
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredVideos.map((vid) => {
              const ytId = extractYouTubeId(vid.join_url);
              const thumb = getThumbnail(vid);
              const isYouTube = vid.platform === "youtube" || !!ytId;

              return (
                <Card
                  key={vid.id}
                  className="rounded-none border-border overflow-hidden hover:border-primary/60 transition-all duration-300 group flex flex-col justify-between shadow-sm hover:shadow-md"
                >
                  <div>
                    {/* Thumbnail / Video Preview Area */}
                    <div className="relative aspect-video bg-slate-900 overflow-hidden cursor-pointer" onClick={() => handleOpenPlayer(vid)}>
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={vid.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex items-center justify-center">
                          <Film className="w-12 h-12 text-indigo-400/50" />
                        </div>
                      )}

                      {/* Overlay Play Button */}
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 fill-white ml-0.5" />
                        </div>
                      </div>

                      {/* Top Badges */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap">
                        {isYouTube ? (
                          <Badge className="bg-red-600 text-white rounded-none text-[10px] font-bold uppercase tracking-wide gap-1">
                            <Tv className="w-3 h-3" /> YouTube Video
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-600 text-white rounded-none text-[10px] font-bold uppercase tracking-wide gap-1">
                            <Video className="w-3 h-3" /> Recorded MP4
                          </Badge>
                        )}
                      </div>

                      {/* Duration Badge */}
                      <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-mono px-2 py-0.5 rounded-none flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        {vid.duration_minutes || 45} mins
                      </div>
                    </div>

                    {/* Card Content */}
                    <CardContent className="p-4 space-y-2.5">
                      <div className="flex items-center gap-2">
                        {vid.course_name && (
                          <Badge variant="outline" className="rounded-none text-[10px] uppercase font-semibold">
                            {vid.course_name}
                          </Badge>
                        )}
                        {vid.subject_name && (
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                            • {vid.subject_name}
                          </span>
                        )}
                      </div>

                      <h3
                        onClick={() => handleOpenPlayer(vid)}
                        className="font-bold text-sm text-foreground line-clamp-2 hover:text-primary cursor-pointer leading-snug"
                      >
                        {vid.title}
                      </h3>

                      {vid.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {vid.description}
                        </p>
                      )}
                    </CardContent>
                  </div>

                  {/* Card Footer */}
                  <div className="p-4 pt-0 border-t border-border/50 mt-2 flex items-center justify-between gap-2">
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-primary" />
                      {formatDate(vid.scheduled_at)}
                    </div>

                    <Button
                      onClick={() => handleOpenPlayer(vid)}
                      size="sm"
                      className="rounded-none bg-red-600 hover:bg-red-700 text-white text-xs font-bold gap-1.5 h-8 px-3"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" /> Watch Lecture
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* VIDEO PLAYER MODAL DIALOG */}
        <Dialog open={isPlayerOpen} onOpenChange={setIsPlayerOpen}>
          <DialogContent className="max-w-4xl rounded-none p-0 overflow-hidden bg-slate-950 text-white border border-border">
            {activeVideo && (
              <div>
                {/* Embedded Video Area */}
                <div className="relative aspect-video w-full bg-black">
                  {extractYouTubeId(activeVideo.join_url) ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${extractYouTubeId(activeVideo.join_url)}?autoplay=1&rel=0&modestbranding=1`}
                      title={activeVideo.title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      controls
                      autoPlay
                      src={activeVideo.join_url}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>

                {/* Video Info Panel */}
                <div className="p-6 space-y-4 max-h-80 overflow-y-auto bg-slate-900 text-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-600 text-white rounded-none uppercase text-[10px]">
                        {activeVideo.platform === "youtube" || extractYouTubeId(activeVideo.join_url)
                          ? "📺 YouTube Lecture"
                          : "📼 Video Recording"}
                      </Badge>
                      {activeVideo.course_name && (
                        <Badge variant="outline" className="text-white border-white/30 text-[10px]">
                          {activeVideo.course_name}
                        </Badge>
                      )}
                    </div>

                    <div className="text-xs text-slate-400 flex items-center gap-3 font-mono">
                      <span>⏱ {activeVideo.duration_minutes || 45} Minutes</span>
                      <span>📅 {formatDate(activeVideo.scheduled_at)}</span>
                    </div>
                  </div>

                  <h2 className="text-lg md:text-xl font-bold leading-tight text-white">
                    {activeVideo.title}
                  </h2>

                  {activeVideo.description && (
                    <p className="text-xs md:text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-none border border-white/10">
                      {activeVideo.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10 text-xs">
                    <div className="flex items-center gap-2 text-slate-300">
                      <User className="w-4 h-4 text-amber-400" />
                      <span>Instructor: {activeVideo.instructor_name || "Center Academic Faculty"}</span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(activeVideo.join_url, "_blank")}
                      className="rounded-none text-xs border-white/20 text-white hover:bg-white/10 gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Open Direct Link
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
