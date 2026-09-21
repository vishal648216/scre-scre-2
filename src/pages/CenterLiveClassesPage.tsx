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
  CheckCircle2,
  XCircle,
  Radio,
  Users,
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
}

interface Course {
  id: string;
  course_name: string;
}

const PLATFORM_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  google_meet: { label: "Google Meet", color: "bg-blue-500", icon: "🎥" },
  zoom: { label: "Zoom", color: "bg-sky-500", icon: "📹" },
  other: { label: "Other", color: "bg-purple-500", icon: "🔗" },
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
    platform: "google_meet",
    join_url: "",
    course_id: "",
    scheduled_at: "",
    duration_minutes: "60",
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
      toast.error("Failed to load live classes");
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

  const openCreate = () => {
    setEditing(null);
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    // Format to local datetime-local input
    const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setForm({
      title: "",
      description: "",
      platform: "google_meet",
      join_url: "",
      course_id: "",
      scheduled_at: localISO,
      duration_minutes: "60",
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
      platform: cls.platform,
      join_url: cls.join_url,
      course_id: cls.course_id || "",
      scheduled_at: localISO,
      duration_minutes: String(cls.duration_minutes),
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    if (!form.join_url.trim()) return toast.error("Join URL is required");
    if (!form.scheduled_at) return toast.error("Schedule date/time is required");

    setSaving(true);
    try {
      // Convert local datetime to ISO 8601 with timezone
      const localDate = new Date(form.scheduled_at);
      const isoString = localDate.toISOString();

      const payload = {
        title: form.title,
        description: form.description || null,
        platform: form.platform,
        join_url: form.join_url,
        course_id: form.course_id || null,
        scheduled_at: isoString,
        duration_minutes: parseInt(form.duration_minutes) || 60,
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
        toast.success(editing ? "Live class updated!" : "Live class scheduled!");
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
        toast.success("Class cancelled");
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
  const upcomingCount = classes.filter((c) => c.status === "upcoming").length;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-10">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
              Live Classes
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              Schedule Google Meet / Zoom sessions for your students.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="rounded-none"
            >
              {showAll ? "Show Active" : "Show All"}
            </Button>
            <Button onClick={openCreate} className="rounded-none gap-2">
              <Plus className="w-4 h-4" />
              Schedule Class
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Radio, label: "Live Now", value: liveCount, color: "text-red-500" },
            { icon: Calendar, label: "Upcoming", value: upcomingCount, color: "text-blue-500" },
            { icon: Users, label: "Total Scheduled", value: classes.length, color: "text-primary" },
          ].map(({ icon: Icon, label, value, color }) => (
            <Card key={label} className="rounded-none border-border">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <Icon className={`w-8 h-8 ${color}`} />
                  <div>
                    <p className="text-2xl font-black">{value}</p>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Classes list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : classes.length === 0 ? (
          <Card className="rounded-none border-border">
            <CardContent className="py-14 text-center text-muted-foreground">
              <Video className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p className="font-semibold">No live classes scheduled yet.</p>
              <p className="text-sm mt-1">Click "Schedule Class" to create your first session.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {classes.map((cls) => {
              const platform = PLATFORM_LABELS[cls.platform] || PLATFORM_LABELS.other;
              const statusCfg = STATUS_CONFIG[cls.status] || STATUS_CONFIG.upcoming;
              const isOngoing = cls.status === "ongoing";
              const isCancelled = cls.status === "cancelled";
              const courseName = courses.find((c) => c.id === cls.course_id)?.course_name;

              return (
                <Card
                  key={cls.id}
                  className={`rounded-none border-border transition-all ${isOngoing ? "ring-2 ring-red-500/40 bg-red-500/5" : ""}`}
                >
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-base">{platform.icon}</span>
                          <h3 className="font-bold text-base truncate">{cls.title}</h3>
                          <Badge variant={statusCfg.variant} className="text-xs">
                            {statusCfg.label}
                          </Badge>
                          {courseName && (
                            <Badge variant="outline" className="text-xs">{courseName}</Badge>
                          )}
                        </div>
                        {cls.description && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-1">{cls.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDateTime(cls.scheduled_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {cls.duration_minutes} mins
                          </span>
                          <span className="font-medium">{platform.label}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isCancelled && (
                          <Button
                            size="sm"
                            variant={isOngoing ? "default" : "outline"}
                            className="rounded-none gap-1.5"
                            onClick={() => window.open(cls.join_url, "_blank")}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {isOngoing ? "Join Now" : "Open Link"}
                          </Button>
                        )}
                        {!isCancelled && cls.status !== "completed" && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-none"
                              onClick={() => openEdit(cls)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-none text-destructive hover:text-destructive"
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
        <DialogContent className="max-w-lg rounded-none">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold uppercase tracking-wide">
              {editing ? "Edit Live Class" : "Schedule Live Class"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Chapter 5 – Introduction to Computers"
                className="rounded-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional: topic details, what students should prepare"
                className="rounded-none resize-none"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Platform</Label>
                <Select
                  value={form.platform}
                  onValueChange={(v) => setForm({ ...form, platform: v })}
                >
                  <SelectTrigger className="rounded-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google_meet">🎥 Google Meet</SelectItem>
                    <SelectItem value="zoom">📹 Zoom</SelectItem>
                    <SelectItem value="other">🔗 Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  min="15"
                  max="480"
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                  className="rounded-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Meet / Zoom Link *</Label>
              <Input
                value={form.join_url}
                onChange={(e) => setForm({ ...form, join_url: e.target.value })}
                placeholder="https://meet.google.com/xxx-xxxx-xxx"
                className="rounded-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Scheduled Date & Time *</Label>
              <Input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                className="rounded-none"
              />
            </div>

            {courses.length > 0 && (
              <div className="space-y-1.5">
                <Label>Course (Optional)</Label>
                <Select
                  value={form.course_id || "none"}
                  onValueChange={(v) => setForm({ ...form, course_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger className="rounded-none">
                    <SelectValue placeholder="All students" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All students</SelectItem>
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
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-none">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-none gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editing ? "Update Class" : "Schedule Class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
