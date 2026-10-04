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
  FileText,
  Building,
  Layers,
  ChevronRight,
  ListVideo,
  Award,
  Folder,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

export interface MasterclassTrackItem {
  id: string;
  title: string;
  description?: string;
  platform: string;
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
  mode?: string;
  chapter_title?: string;
  sequence_order?: number;
  keyword?: string;
  pdf_attachment_url?: string;
  visibility_state?: string;
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

const FALLBACK_MASTERCLASSES: MasterclassTrackItem[] = [
  {
    id: "m1",
    title: "DCA Module 1: Introduction to Computer Architecture & Hardware",
    description: "Detailed video lecture explaining CPU components, RAM vs ROM, motherboard architecture, and input/output peripherals.",
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
    scheduled_at: new Date().toISOString(),
    duration_minutes: 45,
    status: "completed",
    is_hidden: false,
    pdf_attachment_url: "https://example.com/notes/dca_chapter1.pdf",
  },
  {
    id: "m2",
    title: "Tally Prime Masterclass: GST Ledger Creation & Voucher Entry",
    description: "Complete guide on setting up Tally Prime, creating CGST/SGST/IGST tax ledgers, and recording sales/purchase invoices.",
    platform: "youtube_channel",
    join_url: "https://www.youtube.com/watch?v=Ke90Tje7VS0",
    course_id: "c3",
    course_name: "Master Tally Prime & GST Accounting",
    subject_name: "Tally Accounting",
    chapter_title: "Chapter 2: GST Ledger Setup",
    sequence_order: 2,
    mode: "youtube_channel_sync",
    keyword: "Tally GST",
    visibility_state: "published",
    instructor_name: "CA Ankit Agarwal",
    scheduled_at: new Date().toISOString(),
    duration_minutes: 60,
    status: "completed",
    is_hidden: false,
  },
  {
    id: "m3",
    title: "ADCA Photoshop Design: Social Media Poster & Banner Creation",
    description: "Learn layer blending modes, masking techniques, clipping paths, typography, and image color correction in Photoshop CC.",
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
    scheduled_at: new Date().toISOString(),
    duration_minutes: 55,
    status: "completed",
    is_hidden: false,
  },
  {
    id: "m4",
    title: "MERN Fullstack Web Dev: HTML5, CSS3 & Responsive UI Masterclass",
    description: "Learn HTML5 semantics, CSS grid, flexbox layout, and modern JavaScript ES6+ features for web applications.",
    platform: "youtube_channel",
    join_url: "https://www.youtube.com/@SCRE_Education",
    course_id: "c5",
    course_name: "Web Development & MERN Stack",
    subject_name: "Web Architecture",
    chapter_title: "Chapter 1: HTML5 & CSS3 Fundamentals",
    sequence_order: 1,
    mode: "youtube_channel_sync",
    visibility_state: "published",
    instructor_name: "Er. Rahul Verma",
    scheduled_at: new Date().toISOString(),
    duration_minutes: 90,
    status: "completed",
    is_hidden: false,
  },
  {
    id: "m5",
    title: "Python Programming: Data Structures, Loops & Functions Studio",
    description: "Complete practical tutorial covering Python lists, tuples, dictionaries, functions, OOP concepts, and file handling.",
    platform: "youtube",
    join_url: "https://www.youtube.com/watch?v=_uQrJ0TkZlc",
    course_id: "c6",
    course_name: "Python Programming & Data Science",
    subject_name: "Python Basics",
    chapter_title: "Chapter 1: Data Structures",
    sequence_order: 1,
    mode: "mp4_chapter_vault",
    visibility_state: "published",
    instructor_name: "Academic Faculty",
    scheduled_at: new Date().toISOString(),
    duration_minutes: 75,
    status: "completed",
    is_hidden: false,
  },
];

export default function StudentRecordedClassesPage() {
  const [tracks, setTracks] = useState<MasterclassTrackItem[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>(DEFAULT_COURSES);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  // Cinema Theater Active Track & Player
  const [activeTrack, setActiveTrack] = useState<MasterclassTrackItem | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  // YouTube ID Extractor
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

  const fetchTracks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/live-classes?status=all");
      if (res.ok) {
        const data = await res.json();
        const raw: MasterclassTrackItem[] = data.classes || [];

        // STRICT VISIBILITY GUARD: Filter out any hidden tracks for Students!
        const visible = raw.filter((t) => !t.is_hidden && t.status !== "hidden" && t.visibility_state !== "hidden");

        if (visible.length > 0) {
          const mapped = visible.map((t) => ({
            ...t,
            course_name: t.course_name || "Enrolled Course",
            subject_name: t.subject_name || "Subject Lecture",
            chapter_title: t.chapter_title || "Chapter 1: Masterclass",
          }));
          setTracks(mapped);
          setActiveTrack(mapped[0]);
        } else {
          setTracks(FALLBACK_MASTERCLASSES);
          setActiveTrack(FALLBACK_MASTERCLASSES[0]);
        }
      } else {
        setTracks(FALLBACK_MASTERCLASSES);
        setActiveTrack(FALLBACK_MASTERCLASSES[0]);
      }
    } catch {
      setTracks(FALLBACK_MASTERCLASSES);
      setActiveTrack(FALLBACK_MASTERCLASSES[0]);
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
  }, [fetchUserProfile, fetchTracks, fetchCourses]);

  const handleOpenCinema = (track: MasterclassTrackItem) => {
    setActiveTrack(track);
    setIsPlayerOpen(true);
  };

  const handleDownloadAttachment = (url?: string, title?: string) => {
    if (!url) return toast.info("No study notes PDF attached for this lecture.");
    toast.success(`Downloading PDF Notes: ${title || "Lecture Material"}`);
    window.open(url, "_blank");
  };

  const filteredTracks = tracks.filter((t) => {
    if (t.is_hidden || t.status === "hidden" || t.visibility_state === "hidden") return false;

    const matchesSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(search.toLowerCase())) ||
      (t.chapter_title && t.chapter_title.toLowerCase().includes(search.toLowerCase())) ||
      (t.subject_name && t.subject_name.toLowerCase().includes(search.toLowerCase()));

    const matchesCourse =
      selectedCourse === "all" || t.course_id === selectedCourse || t.course_name === selectedCourse;

    const matchesTab =
      activeTab === "all" ||
      (activeTab === "youtube_sync" && (t.mode === "youtube_channel_sync" || t.join_url.includes("youtube"))) ||
      (activeTab === "mp4_vault" && (t.mode === "mp4_chapter_vault" || t.join_url.endsWith(".mp4"))) ||
      (activeTab === "center_exclusive" && (t.mode === "center_broadcast" || t.visibility_state === "center_scoped"));

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
        {/* Header Cinema Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-red-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-red-950 p-6 md:p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-red-600 text-white font-black uppercase text-[10px] tracking-widest rounded-full gap-1 px-3 py-1">
                  <Tv className="w-3.5 h-3.5" /> Cinema Masterclass Video Academy (Plan B)
                </Badge>
                {userProfile?.center_name && (
                  <Badge className="bg-primary/20 text-primary border border-primary/30 font-black uppercase text-[10px] tracking-wider rounded-full px-3 py-1">
                    📍 {userProfile.center_name}
                  </Badge>
                )}
              </div>
              <h1 className="font-heading font-black text-3xl md:text-4xl text-white uppercase tracking-tight flex items-center gap-3">
                <Film className="w-8 h-8 text-amber-400" /> Recorded Course Masterclasses
              </h1>
              <p className="text-slate-300 text-xs md:text-sm font-medium leading-relaxed">
                Stream sequential chapter masterclasses, channel keyword sync series, and center-exclusive lectures with attached PDF study notes.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button
                onClick={() => fetchTracks()}
                variant="outline"
                className="rounded-2xl border-white/20 bg-slate-900/60 text-white hover:bg-white/10 gap-2 text-xs font-black uppercase tracking-wider px-5 py-3"
              >
                <Sparkles className="w-4 h-4 text-amber-400" /> Refresh Cinema Hub
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
              placeholder="Search chapter, topic, or instructor..."
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
                <TabsTrigger value="youtube_sync" className="rounded-xl text-[10px] font-black uppercase">
                  YouTube Sync
                </TabsTrigger>
                <TabsTrigger value="mp4_vault" className="rounded-xl text-[10px] font-black uppercase">
                  MP4 Vault
                </TabsTrigger>
                <TabsTrigger value="center_exclusive" className="rounded-xl text-[10px] font-black uppercase">
                  Center Exclusive
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Cinema Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Loading Cinema Masterclass Hub...
            </p>
          </div>
        ) : filteredTracks.length === 0 ? (
          <Card className="rounded-3xl border-dashed border-2 border-border bg-card/40 py-16 text-center">
            <CardContent className="space-y-4">
              <Video className="w-12 h-12 text-muted-foreground/40 mx-auto" />
              <h3 className="text-lg font-black uppercase tracking-tight text-foreground">No Video Classes Found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No recorded course masterclasses match your current search or category filter.
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
            {filteredTracks.map((track) => {
              const ytId = extractYouTubeId(track.join_url);
              const thumb = getThumbnail(track);

              return (
                <Card
                  key={track.id}
                  className="rounded-3xl border border-border/80 bg-card hover:border-red-500/50 transition-all duration-300 shadow-md hover:shadow-2xl hover:shadow-red-500/5 overflow-hidden flex flex-col justify-between group"
                >
                  <div>
                    {/* Thumbnail Frame */}
                    <div
                      className="relative aspect-video bg-slate-900 overflow-hidden cursor-pointer"
                      onClick={() => handleOpenCinema(track)}
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={track.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-red-950 flex flex-col items-center justify-center">
                          <Film className="w-12 h-12 text-red-500/50 mb-1" />
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                            Cinema Masterclass
                          </span>
                        </div>
                      )}

                      {/* Play Overlay */}
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 fill-white ml-0.5" />
                        </div>
                      </div>

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
                        {track.mode === "youtube_channel_sync" ? (
                          <Badge className="bg-amber-500 text-slate-950 backdrop-blur rounded-full text-[9px] font-black uppercase tracking-wider gap-1 px-3 py-0.5">
                            <Radio className="w-3 h-3" /> YouTube Channel Sync
                          </Badge>
                        ) : track.mode === "center_broadcast" ? (
                          <Badge className="bg-indigo-600 text-white backdrop-blur rounded-full text-[9px] font-black uppercase tracking-wider gap-1 px-3 py-0.5">
                            <Building className="w-3 h-3" /> Center Exclusive
                          </Badge>
                        ) : (
                          <Badge className="bg-red-600 text-white backdrop-blur rounded-full text-[9px] font-black uppercase tracking-wider gap-1 px-3 py-0.5">
                            <Folder className="w-3 h-3" /> MP4 Chapter Vault
                          </Badge>
                        )}
                      </div>

                      {/* Duration Tag */}
                      <div className="absolute bottom-3 right-3 bg-black/80 text-white text-[10px] font-mono px-2.5 py-1 rounded-full backdrop-blur flex items-center gap-1 border border-white/20">
                        <Clock className="w-3 h-3 text-amber-400" />
                        {track.duration_minutes || 45} mins
                      </div>
                    </div>

                    {/* Card Body */}
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {track.course_name && (
                          <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[9px] font-black uppercase tracking-wider">
                            {track.course_name}
                          </span>
                        )}
                        {track.chapter_title && (
                          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                            • {track.chapter_title}
                          </span>
                        )}
                      </div>

                      <h3
                        onClick={() => handleOpenCinema(track)}
                        className="font-heading font-black text-base text-foreground line-clamp-2 hover:text-red-500 cursor-pointer leading-snug uppercase tracking-tight"
                      >
                        {track.title}
                      </h3>

                      {track.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed font-medium">
                          {track.description}
                        </p>
                      )}
                    </CardContent>
                  </div>

                  {/* Card Footer */}
                  <div className="p-5 pt-0 border-t border-border/50 mt-3 flex items-center justify-between gap-3">
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono font-bold">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      {formatDate(track.scheduled_at)}
                    </div>

                    <div className="flex items-center gap-2">
                      {track.pdf_attachment_url && (
                        <Button
                          onClick={() => handleDownloadAttachment(track.pdf_attachment_url, track.title)}
                          size="sm"
                          variant="outline"
                          className="rounded-2xl text-xs font-bold gap-1 h-9 px-3 border-border text-emerald-400"
                          title="Download PDF Study Notes"
                        >
                          <FileText className="w-3.5 h-3.5" /> PDF
                        </Button>
                      )}
                      <Button
                        onClick={() => handleOpenCinema(track)}
                        size="sm"
                        className="rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider gap-1.5 h-9 px-4 shadow-md shadow-red-600/20"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" /> Cinema Theater
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Cinema Theater Player Modal */}
        <Dialog open={isPlayerOpen} onOpenChange={setIsPlayerOpen}>
          <DialogContent className="max-w-5xl rounded-3xl p-0 overflow-hidden bg-slate-950 text-white border border-slate-800 shadow-2xl">
            {activeTrack && (
              <div className="grid grid-cols-1 lg:grid-cols-3">
                {/* Main Video Frame (Left 2 cols) */}
                <div className="lg:col-span-2 bg-black flex flex-col justify-between">
                  <div className="relative aspect-video w-full">
                    {extractYouTubeId(activeTrack.join_url) ? (
                      <iframe
                        src={`https://www.youtube.com/embed/${extractYouTubeId(activeTrack.join_url)}?autoplay=1&rel=0&modestbranding=1`}
                        title={activeTrack.title}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <video
                        controls
                        autoPlay
                        src={activeTrack.join_url}
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>

                  {/* Player Info Footer */}
                  <div className="p-5 space-y-3 bg-slate-900 border-t border-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge className="bg-red-600 text-white rounded-full uppercase text-[10px] font-black px-3 py-1">
                        {activeTrack.mode === "youtube_channel_sync" ? "📺 YouTube Sync" : "📼 MP4 Vault"}
                      </Badge>
                      <span className="text-xs text-slate-400 font-mono">Duration: {activeTrack.duration_minutes || 45} Mins</span>
                    </div>

                    <h2 className="text-lg font-black uppercase text-white tracking-tight leading-snug">
                      {activeTrack.title}
                    </h2>

                    {activeTrack.description && (
                      <p className="text-xs text-slate-300 leading-relaxed font-medium bg-slate-950 p-3 rounded-2xl border border-slate-800">
                        {activeTrack.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
                      <span>Faculty: {activeTrack.instructor_name || "Academic Faculty"}</span>

                      {activeTrack.pdf_attachment_url && (
                        <Button
                          onClick={() => handleDownloadAttachment(activeTrack.pdf_attachment_url, activeTrack.title)}
                          size="sm"
                          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 h-8 px-3"
                        >
                          <DownloadCloud className="w-3.5 h-3.5" /> Download PDF Notes
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Chapter Accordion Sidebar (Right 1 col) */}
                <div className="lg:col-span-1 bg-slate-900/90 border-l border-slate-800 p-5 space-y-4 max-h-[600px] overflow-y-auto">
                  <div className="space-y-1">
                    <p className="text-[10px] text-amber-400 font-black uppercase tracking-widest flex items-center gap-1">
                      <ListVideo className="w-3.5 h-3.5" /> Course Playlist Track
                    </p>
                    <h3 className="font-bold text-sm text-white uppercase tracking-tight">
                      {activeTrack.course_name}
                    </h3>
                  </div>

                  {/* Playlist Lectures List */}
                  <div className="space-y-2.5">
                    {tracks
                      .filter((t) => t.course_id === activeTrack.course_id || t.course_name === activeTrack.course_name)
                      .map((t, idx) => {
                        const isActive = t.id === activeTrack.id;
                        return (
                          <div
                            key={t.id}
                            onClick={() => setActiveTrack(t)}
                            className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                              isActive
                                ? "bg-red-600/20 border-red-500 text-white"
                                : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300"
                            }`}
                          >
                            <div className={`p-2 rounded-xl text-xs font-mono font-bold shrink-0 ${isActive ? "bg-red-600 text-white" : "bg-slate-800 text-slate-400"}`}>
                              #{idx + 1}
                            </div>
                            <div className="space-y-1 overflow-hidden">
                              <p className="text-xs font-bold uppercase line-clamp-2 leading-tight">
                                {t.title}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono">
                                ⏱ {t.duration_minutes || 45} mins • {t.chapter_title || "Chapter Module"}
                              </p>
                            </div>
                          </div>
                        );
                      })}
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
