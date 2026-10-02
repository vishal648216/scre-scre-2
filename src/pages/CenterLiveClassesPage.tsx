import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Plus,
  Calendar,
  Clock,
  ExternalLink,
  Trash2,
  Pencil,
  Loader2,
  Radio,
  Users,
  Sparkles,
  UserCheck,
  Building2,
  GraduationCap,
  ShieldCheck,
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
  course_id?: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  meeting_type?: string;
  target_audience?: string;
  is_instant?: bool;
  joined_count?: number;
}

interface Course {
  id: string;
  course_name: string;
}

const MEETING_TYPES: Record<string, { label: string; icon: any; color: string; desc: string }> = {
  academic_class: {
    label: "Academic Live Class",
    icon: GraduationCap,
    color: "bg-blue-600/10 text-blue-500 border-blue-500/30",
    desc: "Interactive course lecture for enrolled students",
  },
  ptm_parent_meeting: {
    label: "PTM & Parent Connect",
    icon: UserCheck,
    color: "bg-emerald-600/10 text-emerald-500 border-emerald-500/30",
    desc: "Parent-Teacher meeting for student performance discuss",
  },
  staff_director_meeting: {
    label: "Staff & Director Meet",
    icon: Building2,
    color: "bg-purple-600/10 text-purple-500 border-purple-500/30",
    desc: "Internal center operations & staff briefing",
  },
};

const AUDIENCE_OPTIONS: Record<string, string> = {
  all_students: "All Center Students",
  course_students: "Specific Course Batch",
  parents_students: "Parents & Students (PTM)",
  center_staff: "Center Staff & Faculty",
  all_center_directors: "Franchise Directors",
};

const PLATFORM_LABELS: Record<string, { label: string; icon: string }> = {
  jitsi: { label: "SCRE Instant HD Room (Auto)", icon: "⚡" },
  google_meet: { label: "Google Meet", icon: "🎥" },
  zoom: { label: "Zoom Meeting", icon: "📹" },
  youtube: { label: "YouTube Stream / Channel", icon: "📺" },
  video_file: { label: "Recorded MP4 Video", icon: "📼" },
  other: { label: "Custom Link", icon: "🔗" },
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  upcoming: { label: "Upcoming", variant: "secondary" },
  ongoing: { label: "🔴 Live Now", variant: "default" },
  completed: { label: "Completed", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

export default function CenterLiveClassesPage() {
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // Dialog state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LiveClass | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    meeting_type: "academic_class",
    target_audience: "course_students",
    platform: "jitsi",
    join_url: "",
    course_id: "",
    scheduled_at: "",
    duration_minutes: "60",
    is_instant: false,
  });

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = showAll ? "all" : undefined;
      const url = statusParam
        ? `/api/live-classes?status=${statusParam}`
        : "/api/live-classes";
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        setClasses(data.classes || []);
      }
    } catch {
      toast.error("Failed to load live meetings");
    } finally {
      setLoading(false);
    }
  }, [showAll]);

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
    fetchClasses();
    fetchCourses();
  }, [fetchClasses, fetchCourses]);

  const openCreateWithPreset = (mType: string) => {
    setEditing(null);
    const now = new Date();
    const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    let defaultTitle = "Academic Live Lecture";
    let defaultAudience = "course_students";
    if (mType === "ptm_parent_meeting") {
      defaultTitle = "Monthly Parent-Teacher Meeting (PTM)";
      defaultAudience = "parents_students";
    } else if (mType === "staff_director_meeting") {
      defaultTitle = "Center Staff & Operational Sync";
      defaultAudience = "center_staff";
    }

    setForm({
      title: defaultTitle,
      description: "",
      meeting_type: mType,
      target_audience: defaultAudience,
      platform: "jitsi",
      join_url: "",
      course_id: "",
      scheduled_at: localISO,
      duration_minutes: "60",
      is_instant: false,
    });
    setOpen(true);
  };

  const openEdit = (cls: LiveClass) => {
    setEditing(cls);
    const local = new Date(cls.scheduled_at);
    const localISO = new Date(local.getTime() - local.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setForm({
      title: cls.title,
      description: cls.description || "",
      meeting_type: cls.meeting_type || "academic_class",
      target_audience: cls.target_audience || "course_students",
      platform: cls.platform,
      join_url: cls.join_url,
      course_id: cls.course_id || "",
      scheduled_at: localISO,
      duration_minutes: String(cls.duration_minutes),
      is_instant: cls.is_instant || false,
    });
    setOpen(true);
  };

  const handleQuickInstantHost = async (mType: string) => {
    setSaving(true);
    try {
      let title = "Instant Academic Class";
      let target_audience = "all_students";
      if (mType === "ptm_parent_meeting") {
        title = "Instant Parent Connect (PTM)";
        target_audience = "parents_students";
      } else if (mType === "staff_director_meeting") {
        title = "Instant Staff & Director Sync";
        target_audience = "center_staff";
      }

      const payload = {
        title,
        description: "Instant meeting hosted by Center Administrator",
        meeting_type: mType,
        target_audience,
        platform: "jitsi",
        join_url: null, // Backend auto-generates Jitsi URL
        is_instant: true,
        duration_minutes: 60,
      };

      const res = await apiFetch("/api/live-classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("⚡ Instant meeting created & live room ready!");
        fetchClasses();
      } else {
        toast.error(data.message || "Failed to start meeting");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error("Title is required");

    setSaving(true);
    try {
      const localDate = form.scheduled_at ? new Date(form.scheduled_at) : new Date();
      const isoString = localDate.toISOString();

      const payload = {
        title: form.title,
        description: form.description || null,
        meeting_type: form.meeting_type,
        target_audience: form.target_audience,
        platform: form.platform,
        join_url: form.join_url || null, // Auto-generated if empty
        course_id: form.course_id || null,
        scheduled_at: isoString,
        duration_minutes: parseInt(form.duration_minutes) || 60,
        is_instant: form.is_instant,
      };

      let res;
      if (editing) {
        res = await apiFetch(`/api/live-classes/${editing.id}`, {
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
      if (res.ok && data.success) {
        toast.success(editing ? "Meeting updated!" : "Live meeting broadcasted!");
        setOpen(false);
        fetchClasses();
      } else {
        toast.error(data.message || "Failed to save");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (cls: LiveClass) => {
    if (!confirm(`Cancel "${cls.title}"?`)) return;
    try {
      const res = await apiFetch(`/api/live-classes/${cls.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Meeting cancelled");
        fetchClasses();
      }
    } catch {
      toast.error("Failed to cancel");
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

  const liveCount = classes.filter((c) => c.status === "ongoing").length;
  const ptmCount = classes.filter((c) => c.meeting_type === "ptm_parent_meeting").length;
  const staffCount = classes.filter((c) => c.meeting_type === "staff_director_meeting").length;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-10">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4 bg-card/40 p-6 rounded-xl border border-border">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/20 text-primary border-primary/30 uppercase tracking-widest text-[10px] font-bold">
                Universal Live Studio
              </Badge>
              <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
                ⚡ Auto-Room Engine Enabled
              </Badge>
            </div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight mt-1">
              Live Classes & Meetings Studio
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              Host Academic Classes, PTM Parent Connect & Franchise Staff Meetings with zero link creation hassle.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="rounded-lg"
            >
              {showAll ? "Show Active" : "Show All"}
            </Button>
            <Button onClick={() => openCreateWithPreset("academic_class")} className="rounded-lg gap-2 bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4" />
              Schedule New Meeting
            </Button>
          </div>
        </div>

        {/* Quick Action Meeting Launchers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-xl border-border bg-gradient-to-br from-blue-950/20 to-card hover:border-blue-500/40 transition-all">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <Badge variant="outline" className="text-xs text-blue-400 border-blue-500/30">Course Batch</Badge>
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground">Course Live Class</h3>
                <p className="text-xs text-muted-foreground mt-1">Academic lectures with student live attendance auto-logging.</p>
              </div>
              <div className="pt-2 flex gap-2">
                <Button size="sm" onClick={() => handleQuickInstantHost("academic_class")} disabled={saving} className="w-full rounded-lg gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                  <Zap className="w-3.5 h-3.5" />
                  Instant Host
                </Button>
                <Button size="sm" variant="outline" onClick={() => openCreateWithPreset("academic_class")} className="rounded-lg">
                  Schedule
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border bg-gradient-to-br from-emerald-950/20 to-card hover:border-emerald-500/40 transition-all">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <UserCheck className="w-6 h-6" />
                </div>
                <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30">PTM Connect</Badge>
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground">Parent-Teacher Meeting</h3>
                <p className="text-xs text-muted-foreground mt-1">Direct video conference with parents and student guardians.</p>
              </div>
              <div className="pt-2 flex gap-2">
                <Button size="sm" onClick={() => handleQuickInstantHost("ptm_parent_meeting")} disabled={saving} className="w-full rounded-lg gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Zap className="w-3.5 h-3.5" />
                  Instant Host
                </Button>
                <Button size="sm" variant="outline" onClick={() => openCreateWithPreset("ptm_parent_meeting")} className="rounded-lg">
                  Schedule
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border bg-gradient-to-br from-purple-950/20 to-card hover:border-purple-500/40 transition-all">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Building2 className="w-6 h-6" />
                </div>
                <Badge variant="outline" className="text-xs text-purple-400 border-purple-500/30">Staff & Franchise</Badge>
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground">Staff & Director Sync</h3>
                <p className="text-xs text-muted-foreground mt-1">Private room for teachers, staff & center management.</p>
              </div>
              <div className="pt-2 flex gap-2">
                <Button size="sm" onClick={() => handleQuickInstantHost("staff_director_meeting")} disabled={saving} className="w-full rounded-lg gap-1.5 bg-purple-600 hover:bg-purple-700 text-white">
                  <Zap className="w-3.5 h-3.5" />
                  Instant Host
                </Button>
                <Button size="sm" variant="outline" onClick={() => openCreateWithPreset("staff_director_meeting")} className="rounded-lg">
                  Schedule
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { icon: Radio, label: "Live Broadcasts", value: liveCount, color: "text-red-500" },
            { icon: GraduationCap, label: "Academic Classes", value: classes.length - ptmCount - staffCount, color: "text-blue-500" },
            { icon: UserCheck, label: "PTM Meetings", value: ptmCount, color: "text-emerald-500" },
            { icon: Building2, label: "Staff Meetings", value: staffCount, color: "text-purple-500" },
          ].map(({ icon: Icon, label, value, color }) => (
            <Card key={label} className="rounded-xl border-border">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <Icon className={`w-7 h-7 ${color}`} />
                  <div>
                    <p className="text-xl font-black">{value}</p>
                    <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">{label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Classes List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : classes.length === 0 ? (
          <Card className="rounded-xl border-border">
            <CardContent className="py-14 text-center text-muted-foreground">
              <Video className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p className="font-semibold text-lg">No live classes or meetings scheduled.</p>
              <p className="text-sm mt-1">Use the quick action buttons above to launch instant meetings or schedule future sessions.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {classes.map((cls) => {
              const platform = PLATFORM_LABELS[cls.platform] || PLATFORM_LABELS.other;
              const statusCfg = STATUS_CONFIG[cls.status] || STATUS_CONFIG.upcoming;
              const meetingCfg = MEETING_TYPES[cls.meeting_type || "academic_class"] || MEETING_TYPES.academic_class;
              const MeetingIcon = meetingCfg.icon;
              const isOngoing = cls.status === "ongoing";
              const isCancelled = cls.status === "cancelled";
              const courseName = courses.find((c) => c.id === cls.course_id)?.course_name;
              const audienceLabel = AUDIENCE_OPTIONS[cls.target_audience || "course_students"] || "Target Audience";

              return (
                <Card
                  key={cls.id}
                  className={`rounded-xl border-border transition-all hover:shadow-md ${isOngoing ? "ring-2 ring-red-500/40 bg-red-500/5" : ""}`}
                >
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-lg">{platform.icon}</span>
                          <h3 className="font-bold text-base truncate text-foreground">{cls.title}</h3>
                          <Badge variant={statusCfg.variant} className="text-xs">
                            {statusCfg.label}
                          </Badge>
                          <Badge className={`text-[11px] border ${meetingCfg.color}`}>
                            <MeetingIcon className="w-3 h-3 mr-1 inline" />
                            {meetingCfg.label}
                          </Badge>
                          {courseName && (
                            <Badge variant="outline" className="text-xs">{courseName}</Badge>
                          )}
                        </div>
                        {cls.description && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-1">{cls.description}</p>
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
                          <span className="font-medium text-foreground">{platform.label}</span>
                          <span className="text-primary font-semibold">👥 Audience: {audienceLabel}</span>
                          {cls.joined_count !== undefined && (
                            <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              ✓ {cls.joined_count} Joined
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isCancelled && (
                          <Button
                            size="sm"
                            variant={isOngoing ? "default" : "outline"}
                            className="rounded-lg gap-1.5 font-bold"
                            onClick={() => window.open(cls.join_url, "_blank")}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {isOngoing ? "Enter Room (Host)" : "Open Room Link"}
                          </Button>
                        )}
                        {!isCancelled && cls.status !== "completed" && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-lg"
                              onClick={() => openEdit(cls)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-lg text-destructive hover:text-destructive"
                              onClick={() => handleCancel(cls)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Schedule / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold uppercase tracking-wide">
              {editing ? "Edit Meeting" : "Schedule Multi-Audience Meeting"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Meeting Type</Label>
              <Select
                value={form.meeting_type}
                onValueChange={(v) => setForm({ ...form, meeting_type: v })}
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="academic_class">🎓 Academic Live Class</SelectItem>
                  <SelectItem value="ptm_parent_meeting">👨‍👩‍👧 PTM & Parent Connect</SelectItem>
                  <SelectItem value="staff_director_meeting">💼 Staff & Franchise Director Meeting</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Q3 Parent Teacher Interactive Sync"
                className="rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description / Agenda</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Details for attendees..."
                className="rounded-lg resize-none"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Target Audience</Label>
                <Select
                  value={form.target_audience}
                  onValueChange={(v) => setForm({ ...form, target_audience: v })}
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_students">All Center Students</SelectItem>
                    <SelectItem value="course_students">Course Batch Only</SelectItem>
                    <SelectItem value="parents_students">Parents & Students (PTM)</SelectItem>
                    <SelectItem value="center_staff">Center Staff & Faculty</SelectItem>
                    <SelectItem value="all_center_directors">Franchise Directors</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Video Platform</Label>
                <Select
                  value={form.platform}
                  onValueChange={(v) => setForm({ ...form, platform: v })}
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jitsi">⚡ Auto Generated HD Room (Recommended)</SelectItem>
                    <SelectItem value="google_meet">🎥 Google Meet</SelectItem>
                    <SelectItem value="zoom">📹 Zoom</SelectItem>
                    <SelectItem value="youtube">📺 YouTube Live / Video</SelectItem>
                    <SelectItem value="video_file">📼 MP4 Video URL</SelectItem>
                    <SelectItem value="other">🔗 Custom Link</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.platform !== "jitsi" && (
              <div className="space-y-1.5">
                <Label>Meeting / Video Link</Label>
                <Input
                  value={form.join_url}
                  onChange={(e) => setForm({ ...form, join_url: e.target.value })}
                  placeholder="https://meet.google.com/xxx-xxxx-xxx or YouTube link"
                  className="rounded-lg"
                />
              </div>
            )}

            {form.platform === "jitsi" && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Zero configuration required! Room URL will be auto-generated securely upon creation.</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Scheduled Date & Time *</Label>
                <Input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                  className="rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Duration (Minutes)</Label>
                <Input
                  type="number"
                  min="15"
                  max="480"
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                  className="rounded-lg"
                />
              </div>
            </div>

            {courses.length > 0 && form.target_audience === "course_students" && (
              <div className="space-y-1.5">
                <Label>Select Course Batch</Label>
                <Select
                  value={form.course_id || "none"}
                  onValueChange={(v) => setForm({ ...form, course_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="All courses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All Courses</SelectItem>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.course_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-lg">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-lg gap-2 bg-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editing ? "Update Meeting" : "Broadcast Meeting"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
