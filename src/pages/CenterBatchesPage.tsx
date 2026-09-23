import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Plus, Clock, Calendar, Edit, CheckCircle2, XCircle, Loader2, Users2, Layers } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

interface Session {
  id: string;
  _id?: string;
  course_id: string;
  session_name: string;
  status: string;
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
    days: [] as string[],
    max_capacity: 30,
    status: "active",
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
      toast.error(t("Please select a session"));
      return;
    }

    setSaving(true);
    try {
      const url = editingBatch ? `/api/batches/${editingBatch._id}` : "/api/batches";
      const method = editingBatch ? "PUT" : "POST";
      const time_slot = `${form.start_time} - ${form.end_time}`;

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, time_slot }),
      });

      if (res.ok) {
        toast.success(editingBatch ? t("Batch updated") : t("Batch created"));
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

    setForm({
      name: batch.name,
      session_id: batch.session_id,
      start_time: start,
      end_time: end,
      days: batch.days,
      max_capacity: batch.max_capacity,
      status: batch.status,
    });

    setDialogOpen(true);
  };

  const openCreate = (sessionId?: string) => {
    setEditingBatch(null);
    setForm({
      name: "",
      session_id: sessionId || "",
      start_time: "10:00",
      end_time: "12:00",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      max_capacity: 30,
      status: "active",
    });
    setDialogOpen(true);
  };

  const getCourseName = (courseId: string) => {
    const c = courses.find((course) => course.id === courseId || course._id === courseId);
    return c ? c.course_name : t("Unknown Course");
  };

  const getSessionLabel = (session: Session) => `${getCourseName(session.course_id)} • ${session.session_name}`;

  const activeSessions = sessions.filter((s) => s.status === "active");

  const groupedBatches = activeSessions.map((session) => {
    const sid = session.id || session._id || "";
    return {
      session,
      batches: batches.filter((b) => b.session_id === sid),
    };
  });

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">{t("Batch Management")}</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">{t("Manage time slots for your academic sessions.")}</p>
          </div>
          <Button onClick={() => openCreate()} className="rounded-none bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] h-12 px-6 shadow-lg hover:shadow-primary/25">
            <Plus className="w-4 h-4 mr-2" />
            {t("Create New Batch")}
          </Button>
        </div>

        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{t("Synchronizing batches...")}</p>
          </div>
        ) : activeSessions.length === 0 ? (
          <Card className="rounded-none border-dashed border-2 border-border p-20 text-center bg-muted/5">
            <Layers className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t("No active sessions found.")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("You need active sessions to create batches.")}</p>
          </Card>
        ) : (
          <div className="space-y-12">
            {groupedBatches.map(({ session, batches: sessionBatches }) => (
              <div key={session.id || session._id} className="space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-widest text-foreground">{session.session_name}</h2>
                      <p className="text-[9px] font-bold text-muted-foreground tracking-widest">{getCourseName(session.course_id)}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openCreate(session.id || session._id)} className="h-8 text-[9px] font-black uppercase tracking-widest hover:bg-primary/5 hover:text-primary">
                    <Plus className="w-3 h-3 mr-1" /> {t("Add Batch")}
                  </Button>
                </div>

                {sessionBatches.length === 0 ? (
                  <div className="py-8 px-4 border border-dashed rounded-none text-center bg-muted/5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("No batches created for this session.")}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sessionBatches.map((batch) => (
                      <Card key={batch._id} className="rounded-none border-border shadow-md group overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b border-border py-4 flex flex-row items-center justify-between">
                          <CardTitle className="text-xs font-black uppercase tracking-[0.1em] flex items-center gap-2">
                            <Users className="w-4 h-4 text-primary" />
                            {batch.name}
                          </CardTitle>
                          <button onClick={() => openEdit(batch)} className="p-1 border border-border hover:text-primary transition-colors" title={t("Edit Batch")}>
                            <Edit className="w-4 h-4" />
                          </button>
                        </CardHeader>

                        <CardContent className="p-6 space-y-4">
                          <div className="flex items-center gap-3 text-sm">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="font-bold text-foreground">{batch.time_slot}</span>
                          </div>

                          <div className="flex items-center gap-3 text-sm">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <div className="flex flex-wrap gap-1">
                              {batch.days.map((d) => (
                                <span key={d} className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-muted border border-border">
                                  {d}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="pt-2">
                            <div className="flex justify-between items-end mb-2">
                              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Occupancy")}</span>
                              <span className="text-xs font-black">{batch.current_count} / {batch.max_capacity}</span>
                            </div>
                            <div className="h-2 bg-muted border border-border rounded-none overflow-hidden">
                              <div
                                className={cn(
                                  "h-full transition-all duration-500",
                                  (batch.current_count / Math.max(1, batch.max_capacity)) >= 1
                                    ? "bg-red-500"
                                    : (batch.current_count / Math.max(1, batch.max_capacity)) > 0.8
                                    ? "bg-orange-500"
                                    : "bg-primary"
                                )}
                                style={{ width: `${Math.min(100, (batch.current_count / Math.max(1, batch.max_capacity)) * 100)}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 gap-2">
                            <div className={cn("flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase tracking-widest", batch.status === "active" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                              {batch.status === "active" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              {t(batch.status)}
                            </div>

                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-none text-[9px] font-black uppercase tracking-widest"
                              onClick={() => navigate(`/dashboard/center/batches/${batch._id}/students`)}
                            >
                              {t("Manage Students")}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-none border-border max-w-lg p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-muted/30 border-b border-border">
            <DialogTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              {editingBatch ? t("Edit Batch") : t("Create New Batch")}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-3 h-3" /> {t("Select Session")}
                </label>
                <select
                  value={form.session_id}
                  onChange={(e) => setForm({ ...form, session_id: e.target.value })}
                  className="w-full h-12 border border-border bg-background px-4 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-primary appearance-none transition-all hover:border-primary/50"
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

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Users2 className="w-3 h-3" /> {t("Batch Name")}
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Morning Advanced"
                  className="rounded-none h-12 border-border font-bold text-xs uppercase tracking-widest focus-visible:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Clock className="w-3 h-3" /> {t("Start Time")}
                  </label>
                  <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="rounded-none h-12 border-border font-bold text-sm focus-visible:ring-primary/20" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Clock className="w-3 h-3" /> {t("End Time")}
                  </label>
                  <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="rounded-none h-12 border-border font-bold text-sm focus-visible:ring-primary/20" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Users className="w-3 h-3" /> {t("Maximum Capacity")}
                </label>
                <Input type="number" value={form.max_capacity} onChange={(e) => setForm({ ...form, max_capacity: parseInt(e.target.value) || 0 })} className="rounded-none h-12 border-border font-bold text-sm focus-visible:ring-primary/20" />
              </div>

              <div className="space-y-3">
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
                        "px-3 py-2 text-[10px] font-black uppercase tracking-widest border transition-all duration-200",
                        form.days.includes(day) ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20" : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                      )}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Status")}</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full h-12 border border-border bg-background px-4 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-primary transition-all hover:border-primary/50"
                >
                  <option value="active">{t("Active")}</option>
                  <option value="inactive">{t("Inactive")}</option>
                </select>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 bg-muted/30 border-t border-border gap-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-none border-border text-[10px] font-black uppercase tracking-widest h-12 px-6 hover:bg-background">
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name || !form.start_time || !form.end_time || !form.session_id}
              className="rounded-none text-[10px] font-black uppercase tracking-widest h-12 px-10 shadow-lg shadow-primary/20"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
              {editingBatch ? t("Update Batch") : t("Create Batch")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CenterBatchesPage;