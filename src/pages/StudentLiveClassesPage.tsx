import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import LiveMeetingStudioModal from "@/components/LiveMeetingStudioModal";
import {
  Video,
  Calendar,
  Clock,
  ExternalLink,
  Loader2,
  Radio,
  UserCheck,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  Building2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface LiveClass {
  id: string;
  title: string;
  description?: string;
  platform: string;
  join_url: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  meeting_type?: string;
  target_audience?: string;
  joined_count?: number;
}

const MEETING_TYPES: Record<string, { label: string; icon: any; color: string }> = {
  academic_class: {
    label: "Academic Live Class",
    icon: GraduationCap,
    color: "bg-blue-600/10 text-blue-400 border-blue-500/30",
  },
  ptm_parent_meeting: {
    label: "PTM & Parent Connect",
    icon: UserCheck,
    color: "bg-emerald-600/10 text-emerald-400 border-emerald-500/30",
  },
  staff_director_meeting: {
    label: "Staff & Management",
    icon: Building2,
    color: "bg-purple-600/10 text-purple-400 border-purple-500/30",
  },
};

const PLATFORM_ICONS: Record<string, string> = {
  jitsi: "⚡",
  google_meet: "🎥",
  zoom: "📹",
  youtube: "📺",
  video_file: "📼",
  other: "🔗",
};

export default function StudentLiveClassesPage() {
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [history, setHistory] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "academic" | "ptm" | "history">("all");

  // Embedded Studio Modal state
  const [studioOpen, setStudioOpen] = useState(false);
  const [activeStudioMeeting, setActiveStudioMeeting] = useState<LiveClass | null>(null);
  const [studentName, setStudentName] = useState("Student Participant");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user") || sessionStorage.getItem("user");
      if (stored) {
        const u = JSON.parse(stored);
        setStudentName(u.username || u.name || u.full_name || "Student Participant");
      }
    } catch {}
  }, []);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const [activeRes, histRes] = await Promise.all([
        apiFetch("/api/live-classes"),
        apiFetch("/api/live-classes?status=completed"),
      ]);

      if (activeRes.ok) {
        const data = await activeRes.json();
        setClasses(data.classes || []);
      }
      if (histRes.ok) {
        const data = await histRes.json();
        setHistory(data.classes || []);
      }
    } catch {
      toast.error("Failed to load live sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
    const interval = setInterval(fetchClasses, 30000);
    return () => clearInterval(interval);
  }, [fetchClasses]);

  const handleJoinClass = async (cls: LiveClass) => {
    setJoiningId(cls.id);
    try {
      // Call join endpoint to mark student attendance automatically in database
      const res = await apiFetch(`/api/live-classes/${cls.id}/join`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("✅ Attendance Marked Present! Launching Live Studio...");
      }
      
      const targetMeeting = {
        ...cls,
        join_url: (data && data.join_url) ? data.join_url : cls.join_url,
      };

      setActiveStudioMeeting(targetMeeting);
      setStudioOpen(true);
    } catch {
      setActiveStudioMeeting(cls);
      setStudioOpen(true);
    } finally {
      setJoiningId(null);
    }
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const ongoingClasses = classes.filter((c) => c.status === "ongoing");
  const upcomingClasses = classes.filter((c) => c.status === "upcoming");
  
  let displayList = tab === "history" ? history : [...ongoingClasses, ...upcomingClasses];
  if (tab === "academic") {
    displayList = displayList.filter((c) => c.meeting_type !== "ptm_parent_meeting");
  } else if (tab === "ptm") {
    displayList = displayList.filter((c) => c.meeting_type === "ptm_parent_meeting");
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-10">
        {/* Header Banner */}
        <div className="bg-card/40 p-6 rounded-xl border border-border">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/20 text-primary border-primary/30 uppercase tracking-widest text-[10px] font-bold">
              Live Classroom & PTM Portal
            </Badge>
            <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
              ✓ Auto Attendance Enabled
            </Badge>
          </div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight mt-1">
            Live Classes & Meetings
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Join your live academic lectures & Parent-Teacher meetings. Attendance is automatically registered upon joining!
          </p>
        </div>

        {/* Live Now Alert */}
        {ongoingClasses.length > 0 && (
          <Card className="rounded-xl border-red-500/50 bg-red-500/5 shadow-lg shadow-red-500/5">
            <CardContent className="py-4 px-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  <span className="font-bold text-red-500 text-base">
                    {ongoingClasses.length} Live Session{ongoingClasses.length > 1 ? "s" : ""} Happening Now!
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {ongoingClasses.map((cls) => (
                    <Button
                      key={cls.id}
                      size="sm"
                      disabled={joiningId === cls.id}
                      className="rounded-lg gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold"
                      onClick={() => handleJoinClass(cls)}
                    >
                      {joiningId === cls.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Radio className="w-3.5 h-3.5" />
                      )}
                      Join Live: {cls.title}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border pb-1 overflow-x-auto">
          {[
            { key: "all", label: `All Upcoming (${upcomingClasses.length + ongoingClasses.length})` },
            { key: "academic", label: "Academic Classes" },
            { key: "ptm", label: "PTM Meetings" },
            { key: "history", label: `History (${history.length})` },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${
                tab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Classes Display */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : displayList.length === 0 ? (
          <Card className="rounded-xl border-border">
            <CardContent className="py-14 text-center text-muted-foreground">
              <Video className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p className="font-semibold text-lg">
                {tab === "history"
                  ? "No completed sessions found."
                  : "No live classes scheduled currently."}
              </p>
              <p className="text-sm mt-1">
                Your center will schedule live streams and PTM meetings here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {displayList.map((cls) => {
              const isOngoing = cls.status === "ongoing";
              const isCompleted = cls.status === "completed";
              const platformIcon = PLATFORM_ICONS[cls.platform] || "🔗";
              const meetingCfg = MEETING_TYPES[cls.meeting_type || "academic_class"] || MEETING_TYPES.academic_class;
              const MeetingIcon = meetingCfg.icon;

              return (
                <Card
                  key={cls.id}
                  className={`rounded-xl border-border transition-all hover:border-primary/40 ${
                    isOngoing ? "ring-2 ring-red-500/30 bg-red-500/5" : ""
                  }`}
                >
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-lg">{platformIcon}</span>
                          <h3 className="font-bold text-base text-foreground">{cls.title}</h3>
                          {isOngoing && (
                            <Badge className="bg-red-500 text-white text-xs animate-pulse">
                              🔴 Live Broadcast
                            </Badge>
                          )}
                          <Badge className={`text-[11px] border ${meetingCfg.color}`}>
                            <MeetingIcon className="w-3 h-3 mr-1 inline" />
                            {meetingCfg.label}
                          </Badge>
                          {isCompleted && (
                            <Badge variant="outline" className="text-xs">
                              Completed
                            </Badge>
                          )}
                        </div>
                        {cls.description && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {cls.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1 font-medium">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDateTime(cls.scheduled_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {cls.duration_minutes} mins
                          </span>
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Auto Attendance Logged
                          </span>
                        </div>
                      </div>

                      {!isCompleted && (
                        <Button
                          size="sm"
                          disabled={joiningId === cls.id}
                          variant={isOngoing ? "default" : "outline"}
                          className={`rounded-lg gap-1.5 shrink-0 font-bold ${
                            isOngoing ? "bg-red-600 hover:bg-red-700 text-white" : ""
                          }`}
                          onClick={() => handleJoinClass(cls)}
                        >
                          {joiningId === cls.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Zap className="w-3.5 h-3.5" />
                          )}
                          {isOngoing ? "Join Live Studio" : "Enter Room"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Embedded Live Studio Modal */}
      <LiveMeetingStudioModal
        open={studioOpen}
        onClose={() => setStudioOpen(false)}
        meeting={activeStudioMeeting}
        userDisplayName={studentName}
        isHost={false}
      />
    </DashboardLayout>
  );
}
