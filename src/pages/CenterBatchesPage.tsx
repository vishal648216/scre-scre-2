import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Plus,
  Clock,
  Calendar,
  Edit,
  CheckCircle2,
  XCircle,
  Loader2,
  Users2,
  Layers,
  AlertTriangle,
  Radio,
  Flame,
  ArrowRight,
  BookOpen,
  PlusCircle,
  Video,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { format, differenceInDays, isBefore, isAfter, parseISO } from "date-fns";

interface Session {
  id: string;
  _id?: string;
  course_id: string;
  session_name: string;
  status: string;
  start_date?: string;
  end_date?: string;
}

interface Course {
  id: string;
  _id?: string;
  course_name: string;
  course_code: string;
}

interface Batch {
  _id: string;
  name: string;
  session_id: string;
  time_slot: string;
  days: string[];
  max_capacity: number;
  current_count: number;
  status: string;
  start_date?: string;
  end_date?: string;
}

const toId = (v: any): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v.$oid) return v.$oid;
  return "";
};

const CenterBatchesPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    session_id: "",
    start_time: "10:00",
    end_time: "12:00",
    days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as string[],
    max_capacity: 30,
    status: "active",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: format(new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
  });

  const availableDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [batchesRes, sessionsRes, coursesRes] = await Promise.all([
        apiFetch("/api/batches"),
        apiFetch("/api/academic/sessions"),
        apiFetch("/api/courses/allot"),
      ]);

      if (batchesRes.ok) {
        const data = await batchesRes.json();
        const normalized: Batch[] = (Array.isArray(data) ? data : []).map((b: any) => ({
          _id: toId(b._id || b.id),
          name: b.name ?? "",
          session_id: toId(b.session_id),
          time_slot: b.time_slot ?? "",
          days: Array.isArray(b.days) ? b.days : [],
          max_capacity: Number(b.max_capacity ?? 0),
          current_count: Number(b.current_count ?? 0),
          status: b.status ?? "inactive",
          start_date: b.start_date ? b.start_date : undefined,
          end_date: b.end_date ? b.end_date : undefined,
        }));
        setBatches(normalized);
      }

      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        const normalized: Session[] = (Array.isArray(data) ? data : []).map((s: any) => ({
          id: toId(s.id || s._id),
          _id: toId(s._id || s.id) || undefined,
          course_id: toId(s.course_id),
          session_name: s.session_name ?? "",
          status: s.status ?? "inactive",
          start_date: s.start_date,
          end_date: s.end_date,
        }));
        setSessions(normalized);
      }

      if (coursesRes.ok) {
        const data = await coursesRes.json();
        const normalized: Course[] = (Array.isArray(data) ? data : []).map((c: any) => ({
          id: toId(c.id || c._id),
          _id: toId(c._id || c.id) || undefined,
          course_name: c.course_name ?? "",
          course_code: c.course_code ?? "",
        }));
        setCourses(normalized);
      }
    } catch {
      toast.error(t("Failed to load data"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!form.session_id) {
      toast.error(t("Please select an academic session"));
      return;
    }
    if (!form.name.trim()) {
      toast.error(t("Please enter batch name"));
      return;
    }

    setSaving(true);
    try {
      const url = editingBatch ? `/api/batches/${editingBatch._id}` : "/api/batches";
      const method = editingBatch ? "PUT" : "POST";
      const time_slot = `${form.start_time} - ${form.end_time}`;

      const payload = {
        ...form,
        time_slot,
        start_date: form.start_date ? new Date(form.start_date).toISOString() : undefined,
        end_date: form.end_date ? new Date(form.end_date).toISOString() : undefined,
      };

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingBatch ? t("Batch updated successfully") : t("Batch created successfully"));
        setDialogOpen(false);
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || t("Operation failed"));
      }
    } catch {
      toast.error(t("An error occurred"));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (batch: Batch) => {
    setEditingBatch(batch);

    let start = "10:00";
    let end = "12:00";
    if (batch.time_slot?.includes(" - ")) {
      const [s, e] = batch.time_slot.split(" - ");
      start = s || start;
      end = e || end;
    }

    const startDateStr = batch.start_date ? format(new Date(batch.start_date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
    const endDateStr = batch.end_date ? format(new Date(batch.end_date), "yyyy-MM-dd") : format(new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");

    setForm({
      name: batch.name,
      session_id: batch.session_id,
      start_time: start,
      end_time: end,
      days: batch.days,
      max_capacity: batch.max_capacity,
      status: batch.status,
      start_date: startDateStr,
      end_date: endDateStr,
    });

    setDialogOpen(true);
  };

  const openCreate = (sessionId?: string) => {
    setEditingBatch(null);

    const selectedSession = sessions.find((s) => s.id === sessionId || s._id === sessionId);
    const startDateStr = selectedSession?.start_date ? format(new Date(selectedSession.start_date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
    const endDateStr = selectedSession?.end_date ? format(new Date(selectedSession.end_date), "yyyy-MM-dd") : format(new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");

    setForm({
      name: "",
      session_id: sessionId || (sessions[0]?.id || sessions[0]?._id || ""),
      start_time: "10:00",
      end_time: "12:00",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      max_capacity: 30,
      status: "active",
      start_date: startDateStr,
      end_date: endDateStr,
    });
    setDialogOpen(true);
  };

  const getCourseName = (courseId: string) => {
    const c = courses.find((course) => course.id === courseId || course._id === courseId);
    return c ? c.course_name : t("Academic Course");
  };

  const getSessionLabel = (session: Session) => `${getCourseName(session.course_id)} • ${session.session_name}`;

  const activeSessions = useMemo(() => sessions.filter((s) => s.status === "active"), [sessions]);

  const groupedBatches = useMemo(() => {
    return activeSessions.map((session) => {
      const sid = session.id || session._id || "";
      return {
        session,
        batches: batches.filter((b) => b.session_id === sid),
      };
    });
  }, [activeSessions, batches]);

  // Overall Statistics
  const totalCapacity = useMemo(() => batches.reduce((acc, b) => acc + (b.max_capacity || 0), 0), [batches]);
  const totalStudents = useMemo(() => batches.reduce((acc, b) => acc + (b.current_count || 0), 0), [batches]);

  // Check if batch is ending within 7 days
  const getDaysRemainingInfo = (batch: Batch) => {
    if (!batch.end_date) return null;
    const endDate = new Date(batch.end_date);
    const today = new Date();
    const daysLeft = differenceInDays(endDate, today);

    if (daysLeft < 0) {
      return { daysLeft, label: t("Batch Completed"), isAlert: false, isEnded: true };
    } else if (daysLeft <= 7) {
      return { daysLeft, label: t("⚠️ Ending in {{count}} Days - Exam Readiness Alert!", { count: daysLeft }), isAlert: true, isEnded: false };
    } else {
      return { daysLeft, label: t("{{count}} Days Remaining", { count: daysLeft }), isAlert: false, isEnded: false };
    }
  };

  // Batches ending soon count
  const endingSoonCount = useMemo(() => {
    return batches.filter((b) => {
      const info = getDaysRemainingInfo(b);
      return info?.isAlert;
    }).length;
  }, [batches]);

  // Live class in-progress status
  const isClassLiveNow = (batch: Batch) => {
    if (!batch.time_slot || !batch.time_slot.includes(" - ")) return false;
    const now = new Date();
    const dayName = format(now, "EEE"); // Mon, Tue...
    if (!batch.days.includes(dayName)) return false;

    const [startStr, endStr] = batch.time_slot.split(" - ");
    if (!startStr || !endStr) return false;

    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const parseMinutes = (timeStr: string) => {
      const [h, m] = timeStr.trim().split(":").map(Number);
      if (isNaN(h)) return -1;
      return h * 60 + (isNaN(m) ? 0 : m);
    };

    const startMins = parseMinutes(startStr);
    const endMins = parseMinutes(endStr);

    if (startMins === -1 || endMins === -1) return false;
    return nowMinutes >= startMins && nowMinutes <= endMins;
  };

  const liveClassesCount = useMemo(() => batches.filter(isClassLiveNow).length, [batches]);

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500 pb-16 relative">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 border border-border/40 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-emerald-500 to-sky-500" />
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-inner">
              <Calendar className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-heading font-black text-2xl md:text-3xl text-foreground uppercase tracking-tight">
                  {t("Batch & Session Management")}
                </h1>
                {endingSoonCount > 0 && (
                  <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center gap-1.5 animate-pulse">
                    <AlertTriangle className="w-3 h-3" />
                    {t("{{count}} Batches Ending Soon", { count: endingSoonCount })}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground mt-1 text-xs md:text-sm font-medium">
                {t("Configure time slots, dates, seat capacity & exam readiness alerts for all academic sessions.")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              onClick={() => openCreate()}
              className="rounded-2xl bg-gradient-to-r from-primary via-indigo-600 to-primary-dark text-primary-foreground font-black uppercase tracking-widest text-xs h-12 px-8 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 hover:-translate-y-0.5 transition-all"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("Create New Batch")}
            </Button>
          </div>
        </div>

        {/* Stats Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Active Batches")}</span>
              <Layers className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-black text-foreground">{batches.length}</div>
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mt-1">{t("In {{count}} Sessions", { count: activeSessions.length })}</p>
          </Card>

          <Card className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Enrolled Students")}</span>
              <Users className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-foreground">{totalStudents} <span className="text-xs text-muted-foreground font-normal">/ {totalCapacity}</span></div>
            <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider mt-1">{totalCapacity - totalStudents} {t("Seats Free")}</p>
          </Card>

          <Card className="rounded-2xl border border-amber-500/30 bg-amber-500/5 backdrop-blur-md p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">{t("Exam Readiness Alerts")}</span>
              <AlertTriangle className="w-4 h-4 text-amber-500 animate-bounce" />
            </div>
            <div className="text-2xl font-black text-amber-600">{endingSoonCount}</div>
            <p className="text-[9px] text-amber-600/80 font-bold uppercase tracking-wider mt-1">{t("Ending within 7 Days")}</p>
          </Card>

          <Card className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-md p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{t("Live Classes Right Now")}</span>
              <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
            </div>
            <div className="text-2xl font-black text-emerald-600">{liveClassesCount}</div>
            <p className="text-[9px] text-emerald-600/80 font-bold uppercase tracking-wider mt-1">{t("Active Timing Slot")}</p>
          </Card>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{t("Synchronizing batch schedules & occupancy...")}</p>
          </div>
        ) : activeSessions.length === 0 ? (
          <Card className="rounded-3xl border-dashed border-2 border-border p-20 text-center bg-muted/5">
            <Layers className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t("No active sessions found.")}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {t("Academic sessions need to be created first under Academics → Sessions before batches can be added.")}
            </p>
          </Card>
        ) : (
          <div className="space-y-12">
            {groupedBatches.map(({ session, batches: sessionBatches }) => (
              <div key={session.id || session._id} className="space-y-4">
                {/* Session Header */}
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-primary/10 rounded-xl border border-primary/20 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-base font-black uppercase tracking-tight text-foreground">{session.session_name}</h2>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-muted rounded border border-border text-muted-foreground">
                          {getCourseName(session.course_id)}
                        </span>
                      </div>
                      {session.start_date && session.end_date && (
                        <p className="text-[10px] font-medium text-muted-foreground tracking-wider mt-0.5">
                          📅 {format(new Date(session.start_date), "dd MMM yyyy")} — {format(new Date(session.end_date), "dd MMM yyyy")}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openCreate(session.id || session._id)}
                    className="h-9 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 hover:text-primary border-primary/30"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> {t("Add Batch")}
                  </Button>
                </div>

                {sessionBatches.length === 0 ? (
                  <div className="py-10 px-6 border border-dashed border-border/60 rounded-2xl text-center bg-muted/5">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t("No batches configured for this session yet.")}</p>
                    <Button
                      size="sm"
                      onClick={() => openCreate(session.id || session._id)}
                      className="mt-3 rounded-xl text-[10px] font-black uppercase tracking-widest"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> {t("Create Batch Now")}
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sessionBatches.map((batch) => {
                      const daysInfo = getDaysRemainingInfo(batch);
                      const isLive = isClassLiveNow(batch);
                      const seatsFree = Math.max(0, batch.max_capacity - batch.current_count);

                      return (
                        <Card
                          key={batch._id}
                          className={cn(
                            "rounded-3xl border shadow-lg transition-all duration-300 overflow-hidden relative group hover:-translate-y-1",
                            daysInfo?.isAlert
                              ? "border-amber-500/50 bg-gradient-to-br from-amber-500/5 via-card to-card shadow-amber-500/10"
                              : isLive
                              ? "border-emerald-500/50 bg-gradient-to-br from-emerald-500/5 via-card to-card shadow-emerald-500/10"
                              : "border-border/80 bg-card hover:border-primary/50"
                          )}
                        >
                          {/* Banner Highlights */}
                          {daysInfo?.isAlert && (
                            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest flex items-center justify-between shadow-sm">
                              <span className="flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 animate-bounce" />
                                {t("Exam Readiness Alert!")}
                              </span>
                              <span>{t("Ending in {{count}} Days", { count: daysInfo.daysLeft })}</span>
                            </div>
                          )}

                          {isLive && !daysInfo?.isAlert && (
                            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-1.5 text-[10px] font-black uppercase tracking-widest flex items-center justify-between shadow-sm">
                              <span className="flex items-center gap-1.5">
                                <Radio className="w-3.5 h-3.5 animate-pulse" />
                                {t("Live Class In Progress Now")}
                              </span>
                              <span className="bg-white/20 px-2 py-0.5 rounded text-[9px]">{t("Active Slot")}</span>
                            </div>
                          )}

                          <CardHeader className="p-6 pb-4 bg-muted/20 border-b border-border/40 flex flex-row items-center justify-between">
                            <div>
                              <CardTitle className="text-sm font-black uppercase tracking-tight flex items-center gap-2 text-foreground">
                                <Users2 className="w-4 h-4 text-primary" />
                                {batch.name}
                              </CardTitle>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                                {getCourseName(session.course_id)}
                              </p>
                            </div>
                            <button
                              onClick={() => openEdit(batch)}
                              className="w-8 h-8 rounded-xl border border-border bg-card hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-center"
                              title={t("Edit Batch")}
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </CardHeader>

                          <CardContent className="p-6 space-y-5">
                            {/* Start & End Dates */}
                            {(batch.start_date || batch.end_date) && (
                              <div className="p-3 bg-muted/30 rounded-2xl border border-border/40 flex items-center justify-between text-[10px]">
                                <div>
                                  <span className="text-muted-foreground block font-bold uppercase">{t("Start Date")}</span>
                                  <span className="font-black text-foreground">{batch.start_date ? format(new Date(batch.start_date), "dd MMM yyyy") : "N/A"}</span>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                                <div className="text-right">
                                  <span className="text-muted-foreground block font-bold uppercase">{t("End Date")}</span>
                                  <span className="font-black text-foreground">{batch.end_date ? format(new Date(batch.end_date), "dd MMM yyyy") : "N/A"}</span>
                                </div>
                              </div>
                            )}

                            {/* Timing Slot */}
                            <div className="flex items-center justify-between text-xs p-3 bg-muted/20 rounded-2xl border border-border/40">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-primary" />
                                <span className="font-extrabold text-foreground">{batch.time_slot}</span>
                              </div>
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-primary/10 text-primary rounded border border-primary/20">
                                {t("Class Timing")}
                              </span>
                            </div>

                            {/* Days */}
                            <div className="space-y-1.5">
                              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">{t("Class Days")}</span>
                              <div className="flex flex-wrap gap-1.5">
                                {batch.days.map((d) => (
                                  <span key={d} className="text-[9px] font-black uppercase px-2 py-1 bg-muted rounded-lg border border-border text-foreground">
                                    {d}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Occupancy & Seats */}
                            <div className="space-y-2 pt-1">
                              <div className="flex justify-between items-end">
                                <div>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">{t("Capacity & Seats")}</span>
                                  <span className="text-xs font-black text-emerald-600 block">
                                    {seatsFree} {t("Seats Free")}
                                  </span>
                                </div>
                                <span className="text-xs font-black text-foreground">{batch.current_count} / {batch.max_capacity}</span>
                              </div>
                              <div className="h-2.5 bg-muted rounded-full overflow-hidden p-0.5 border border-border/60">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    (batch.current_count / Math.max(1, batch.max_capacity)) >= 1
                                      ? "bg-red-500"
                                      : (batch.current_count / Math.max(1, batch.max_capacity)) > 0.8
                                      ? "bg-orange-500"
                                      : "bg-emerald-500"
                                  )}
                                  style={{ width: `${Math.min(100, (batch.current_count / Math.max(1, batch.max_capacity)) * 100)}%` }}
                                />
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest h-9"
                                onClick={() => navigate(`/dashboard/center/batches/${batch._id}/students`)}
                              >
                                <Users className="w-3.5 h-3.5 mr-1 text-primary" />
                                {t("Manage Roster")}
                              </Button>

                              <Button
                                size="sm"
                                className="rounded-xl text-[10px] font-black uppercase tracking-widest h-9 bg-primary text-primary-foreground"
                                onClick={() => navigate(`/dashboard/live-classes/schedule`)}
                              >
                                <Video className="w-3.5 h-3.5 mr-1" />
                                {t("Class Schedule")}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-3xl border border-border/80 max-w-lg p-0 overflow-hidden bg-card text-foreground shadow-2xl">
          <DialogHeader className="p-6 bg-muted/40 border-b border-border/60">
            <DialogTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              {editingBatch ? t("Edit Batch Details") : t("Create New Batch")}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[75vh] overflow-y-auto p-6 space-y-5">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-primary" /> {t("Select Academic Session")} *
                </label>
                <select
                  value={form.session_id}
                  onChange={(e) => setForm({ ...form, session_id: e.target.value })}
                  className="w-full h-12 border border-border/80 bg-background px-4 rounded-2xl text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-primary appearance-none transition-all hover:border-primary/50"
                  disabled={!!editingBatch}
                >
                  <option value="">{t("Choose Session")}</option>
                  {activeSessions.map((s) => (
                    <option key={s.id || s._id} value={s.id || s._id}>
                      {getSessionLabel(s)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Users2 className="w-3.5 h-3.5 text-primary" /> {t("Batch Name")} *
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Morning Advanced ADCA"
                  className="rounded-2xl h-12 border-border/80 font-bold text-xs uppercase tracking-widest focus-visible:ring-primary/20"
                />
              </div>

              {/* Start & End Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary" /> {t("Batch Start Date")}
                  </label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="rounded-2xl h-12 border-border/80 font-bold text-xs focus-visible:ring-primary/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary" /> {t("Batch End Date")}
                  </label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="rounded-2xl h-12 border-border/80 font-bold text-xs focus-visible:ring-primary/20"
                  />
                </div>
              </div>

              {/* Timing */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" /> {t("Start Time")}
                  </label>
                  <Input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    className="rounded-2xl h-12 border-border/80 font-bold text-sm focus-visible:ring-primary/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" /> {t("End Time")}
                  </label>
                  <Input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    className="rounded-2xl h-12 border-border/80 font-bold text-sm focus-visible:ring-primary/20"
                  />
                </div>
              </div>

              {/* Capacity */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary" /> {t("Maximum Seat Capacity")}
                </label>
                <Input
                  type="number"
                  value={form.max_capacity}
                  onChange={(e) => setForm({ ...form, max_capacity: parseInt(e.target.value) || 0 })}
                  className="rounded-2xl h-12 border-border/80 font-bold text-sm focus-visible:ring-primary/20"
                />
              </div>

              {/* Operating Days */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Operating Days")}</label>
                <div className="flex flex-wrap gap-2">
                  {availableDays.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const newDays = form.days.includes(day) ? form.days.filter((d) => d !== day) : [...form.days, day];
                        setForm({ ...form, days: newDays });
                      }}
                      className={cn(
                        "px-3.5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all duration-200",
                        form.days.includes(day)
                          ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                          : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                      )}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Status")}</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full h-12 border border-border/80 bg-background px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-primary transition-all hover:border-primary/50"
                >
                  <option value="active">{t("Active")}</option>
                  <option value="inactive">{t("Inactive")}</option>
                </select>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 bg-muted/40 border-t border-border/60 gap-3">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="rounded-2xl border-border/80 text-[10px] font-black uppercase tracking-widest h-12 px-6 hover:bg-background"
            >
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name || !form.start_time || !form.end_time || !form.session_id}
              className="rounded-2xl text-[10px] font-black uppercase tracking-widest h-12 px-10 bg-primary text-primary-foreground shadow-lg shadow-primary/25"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingBatch ? t("Update Batch") : t("Create Batch")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CenterBatchesPage;