import React, { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
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
  DownloadCloud,
  Radio,
  BookOpen,
  Filter,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

export interface RecordedVideo {
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

const DEFAULT_COURSES: CourseOption[] = [
  { id: "c1", course_name: "Diploma in Computer Application (DCA)" },
  { id: "c2", course_name: "Advanced Diploma in Computer Application (ADCA)" },
  { id: "c3", course_name: "Master Tally Prime & GST Accounting" },
  { id: "c4", course_name: "Course on Computer Concepts (CCC)" },
  { id: "c5", course_name: "Web Development & MERN Stack" },
  { id: "c6", course_name: "Python Programming & Data Science" },
];

const FALLBACK_VIDEOS: RecordedVideo[] = [
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
    scheduled_at: new Date().toISOString(),
    duration_minutes: 55,
    status: "completed",
    is_hidden: false,
  },
  {
    id: "v4",
    title: "MERN Fullstack Web Dev: HTML5, CSS3 & Responsive UI Masterclass",
    description: "Learn HTML5 semantics, CSS grid, flexbox layout, and modern JavaScript ES6+ features for web applications.",
    platform: "youtube_channel",
    join_url: "https://www.youtube.com/@SCRE_Education",
    course_id: "c5",
    course_name: "Web Development & MERN Stack",
    subject_name: "Web Architecture",
    instructor_name: "Er. Rahul Verma",
    scheduled_at: new Date().toISOString(),
    duration_minutes: 90,
    status: "completed",
    is_hidden: false,
  },
  {
    id: "v5",
    title: "Python Programming: Data Structures, Loops & Functions",
    description: "Complete practical tutorial covering Python lists, tuples, dictionaries, functions, OOP concepts, and file handling.",
    platform: "youtube",
    join_url: "https://www.youtube.com/watch?v=_uQrJ0TkZlc",
    course_id: "c6",
    course_name: "Python Programming & Data Science",
    subject_name: "Python Basics",
    instructor_name: "Academic Faculty",
    scheduled_at: new Date().toISOString(),
    duration_minutes: 75,
    status: "completed",
    is_hidden: false,
  },
];

export default function StudentRecordedClassesPage() {
  const [videos, setVideos] = useState<RecordedVideo[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>(DEFAULT_COURSES);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  // Video Player Dialog State
  const [activeVideo, setActiveVideo] = useState<RecordedVideo | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  // YouTube ID Extractor
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
        
        // Strictly filter out HIDDEN videos from Student portal!
        const visibleClasses = rawClasses.filter((v) => !v.is_hidden && v.status !== "hidden");

        if (visibleClasses.length > 0) {
          const mapped = visibleClasses.map((cls) => ({
            ...cls,
            course_name: cls.course_name || "Enrolled Course",
            subject_name: cls.subject_name || "Subject Lecture",
          }));
          setVideos(mapped);
        } else {
          // Use pre-loaded channel playlists if DB has no unhidden entries
          setVideos(FALLBACK_VIDEOS);
        }
      } else {
        setVideos(FALLBACK_VIDEOS);
      }
    } catch {
      setVideos(FALLBACK_VIDEOS);
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
    fetchRecordedVideos();
    fetchCourses();
  }, [fetchUserProfile, fetchRecordedVideos, fetchCourses]);

  const handleOpenPlayer = (video: RecordedVideo) => {
    setActiveVideo(video);
    setIsPlayerOpen(true);
  };

  const handleDownloadVideo = (url: string, title: string) => {
    if (!url) return;
    toast.success(`Downloading lecture video: ${title}`);
    window.open(url, "_blank");
  };

  const filteredVideos = videos.filter((v) => {
    // Double check hidden state
    if (v.is_hidden || v.status === "hidden") return false;

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
      (activeTab === "youtube" && (v.platform === "youtube" || v.platform === "youtube_channel" || v.platform === "youtube_playlist" || v.join_url.includes("youtube"))) ||
      (activeTab === "video_file" && (v.platform === "video_file" || v.join_url.endsWith(".mp4"))) ||
      (activeTab === "channels" && (v.platform === "youtube_channel" || v.platform === "youtube_playlist" || v.join_url.includes("/@")));

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
    <DashboardLayout role="Student">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
        {/* Header Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-red-500/20 bg-gradient-to-br from-slate-900 via-red-950/40 to-slate-900 p-6 md:p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 font-black uppercase text-[10px] tracking-widest rounded-full gap-1 px-3 py-1">
                  <Tv className="w-3.5 h-3.5" /> Video Masterclasses & Channel Playlists
                </Badge>
                {userProfile?.center_name && (
                  <Badge className="bg-primary/20 text-primary border border-primary/30 font-black uppercase text-[10px] tracking-wider rounded-full px-3 py-1">
                    📍 {userProfile.center_name}
                  </Badge>
                )}
              </div>
              <h1 className="font-heading font-black text-3xl md:text-4xl text-white uppercase tracking-tight flex items-center gap-3">
                <Film className="w-8 h-8 text-amber-400" /> Recorded Video Classes
              </h1>
              <p className="text-slate-300 text-xs md:text-sm font-medium leading-relaxed">
                Access official YouTube channel series, course playlists, recorded live lectures, and subject-wise video masterclasses uploaded by your center faculty.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button
                onClick={() => fetchRecordedVideos()}
                variant="outline"
                className="rounded-2xl border-white/20 bg-slate-900/60 text-white hover:bg-white/10 gap-2 text-xs font-black uppercase tracking-wider px-5 py-3"
              >
                <Sparkles className="w-4 h-4 text-amber-400" /> Refresh Library
              </Button>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-card/80 backdrop-blur-xl border border-border p-4 rounded-3xl shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search topic, subject, or lecture..."
              className="pl-10 h-11 rounded-2xl border-border bg-background/50 font-bold text-xs"
            />
          </div>

          <div className="md:col-span-1">
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger className="rounded-2xl h-11 text-xs font-bold border-border bg-background/50">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  <SelectValue placeholder="All Courses" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
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
              <TabsList className="rounded-2xl bg-muted/60 p-1 w-full grid grid-cols-4 h-11 border border-border">
                <TabsTrigger value="all" className="rounded-xl text-[10px] font-black uppercase">
                  All
                </TabsTrigger>
                <TabsTrigger value="youtube" className="rounded-xl text-[10px] font-black uppercase">
                  YouTube
                </TabsTrigger>
                <TabsTrigger value="channels" className="rounded-xl text-[10px] font-black uppercase">
                  Channels
                </TabsTrigger>
                <TabsTrigger value="video_file" className="rounded-xl text-[10px] font-black uppercase">
                  MP4
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Video Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Loading video masterclasses...
            </p>
          </div>
        ) : filteredVideos.length === 0 ? (
          <Card className="rounded-3xl border-dashed border-2 border-border bg-card/40 py-16 text-center">
            <CardContent className="space-y-4">
              <Video className="w-12 h-12 text-muted-foreground/40 mx-auto" />
              <h3 className="text-lg font-black uppercase tracking-tight text-foreground">No Video Classes Found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No recorded course videos match your current search or category filter.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setSelectedCourse("all");
                  setActiveTab("all");
                }}
                className="rounded-2xl text-xs font-bold uppercase"
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVideos.map((vid) => {
              const ytId = extractYouTubeId(vid.join_url);
              const thumb = getThumbnail(vid);
              const isYouTube = vid.platform === "youtube" || vid.platform === "youtube_channel" || vid.platform === "youtube_playlist" || !!ytId;
              const isChannel = vid.platform === "youtube_channel" || vid.platform === "youtube_playlist" || vid.join_url.includes("/@");

              return (
                <Card
                  key={vid.id}
                  className="rounded-3xl border border-border/80 bg-card hover:border-red-500/50 transition-all duration-300 shadow-md hover:shadow-2xl hover:shadow-red-500/5 overflow-hidden flex flex-col justify-between group"
                >
                  <div>
                    {/* Thumbnail Preview Box */}
                    <div
                      className="relative aspect-video bg-slate-900 overflow-hidden cursor-pointer"
                      onClick={() => handleOpenPlayer(vid)}
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={vid.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-red-950 flex flex-col items-center justify-center">
                          <Film className="w-12 h-12 text-red-500/50 mb-1" />
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                            {isYouTube ? "YouTube Series" : "MP4 Recording"}
                          </span>
                        </div>
                      )}

                      {/* Play Overlay Button */}
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 fill-white ml-0.5" />
                        </div>
                      </div>

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
                        {isChannel ? (
                          <Badge className="bg-amber-500 text-slate-950 backdrop-blur rounded-full text-[9px] font-black uppercase tracking-wider gap-1 px-3 py-0.5">
                            <Radio className="w-3 h-3" /> YouTube Channel
                          </Badge>
                        ) : isYouTube ? (
                          <Badge className="bg-red-600/90 text-white backdrop-blur rounded-full text-[9px] font-black uppercase tracking-wider gap-1 px-3 py-0.5">
                            <Tv className="w-3 h-3" /> YouTube Video
                          </Badge>
                        ) : (
                          <Badge className="bg-indigo-600/90 text-white backdrop-blur rounded-full text-[9px] font-black uppercase tracking-wider gap-1 px-3 py-0.5">
                            <Video className="w-3 h-3" /> MP4 Lecture
                          </Badge>
                        )}
                      </div>

                      {/* Duration Tag */}
                      <div className="absolute bottom-3 right-3 bg-black/80 text-white text-[10px] font-mono px-2.5 py-1 rounded-full backdrop-blur flex items-center gap-1 border border-white/20">
                        <Clock className="w-3 h-3 text-amber-400" />
                        {vid.duration_minutes || 45} mins
                      </div>
                    </div>

                    {/* Card Body */}
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {vid.course_name && (
                          <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[9px] font-black uppercase tracking-wider">
                            {vid.course_name}
                          </span>
                        )}
                        {vid.subject_name && (
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                            • {vid.subject_name}
                          </span>
                        )}
                      </div>

                      <h3
                        onClick={() => handleOpenPlayer(vid)}
                        className="font-heading font-black text-base text-foreground line-clamp-2 hover:text-red-500 cursor-pointer leading-snug uppercase tracking-tight"
                      >
                        {vid.title}
                      </h3>

                      {vid.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed font-medium">
                          {vid.description}
                        </p>
                      )}
                    </CardContent>
                  </div>

                  {/* Card Footer */}
                  <div className="p-5 pt-0 border-t border-border/50 mt-3 flex items-center justify-between gap-3">
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono font-bold">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      {formatDate(vid.scheduled_at)}
                    </div>

                    <div className="flex items-center gap-2">
                      {!isYouTube && (
                        <Button
                          onClick={() => handleDownloadVideo(vid.join_url, vid.title)}
                          size="sm"
                          variant="outline"
                          className="rounded-2xl text-xs font-bold gap-1 h-9 px-3 border-border"
                          title="Download Video File"
                        >
                          <DownloadCloud className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        onClick={() => handleOpenPlayer(vid)}
                        size="sm"
                        className="rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider gap-1.5 h-9 px-4 shadow-md shadow-red-600/20"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" /> Watch Lecture
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Video Player Dialog Modal */}
        <Dialog open={isPlayerOpen} onOpenChange={setIsPlayerOpen}>
          <DialogContent className="max-w-4xl rounded-3xl p-0 overflow-hidden bg-slate-950 text-white border border-slate-800 shadow-2xl">
            {activeVideo && (
              <div>
                {/* Embedded Player Frame */}
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

                {/* Player Metadata Panel */}
                <div className="p-6 space-y-4 max-h-80 overflow-y-auto bg-slate-900 text-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-600 text-white rounded-full uppercase text-[10px] font-black px-3 py-1">
                        {activeVideo.platform === "youtube" || extractYouTubeId(activeVideo.join_url)
                          ? "📺 YouTube Lecture"
                          : "📼 Video Recording"}
                      </Badge>
                      {activeVideo.course_name && (
                        <Badge variant="outline" className="text-slate-300 border-slate-700 text-[10px] font-bold rounded-full px-3 py-1">
                          {activeVideo.course_name}
                        </Badge>
                      )}
                    </div>

                    <div className="text-xs text-slate-400 flex items-center gap-3 font-mono font-bold">
                      <span>⏱ {activeVideo.duration_minutes || 45} Mins</span>
                      <span>📅 {formatDate(activeVideo.scheduled_at)}</span>
                    </div>
                  </div>

                  <h2 className="text-lg md:text-xl font-black uppercase tracking-tight leading-tight text-white">
                    {activeVideo.title}
                  </h2>

                  {activeVideo.description && (
                    <p className="text-xs md:text-sm text-slate-300 leading-relaxed bg-slate-950/80 p-4 rounded-2xl border border-slate-800 font-medium">
                      {activeVideo.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs">
                    <div className="flex items-center gap-2 text-slate-300 font-semibold">
                      <User className="w-4 h-4 text-amber-400" />
                      <span>Instructor: {activeVideo.instructor_name || "Center Academic Faculty"}</span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(activeVideo.join_url, "_blank")}
                      className="rounded-2xl text-xs border-slate-700 text-white hover:bg-slate-800 gap-1.5 font-bold uppercase"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Direct Link
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
