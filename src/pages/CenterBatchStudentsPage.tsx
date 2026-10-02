import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2,
  Users,
  Plus,
  Search,
  CheckCircle2,
  UserMinus,
  ArrowLeftRight,
  BookOpen,
  Calendar,
  Building2,
  Sparkles,
  ArrowLeft,
  Check,
  X,
  UserCheck,
  UserPlus,
  Filter,
  Layers,
  GraduationCap
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Batch {
  _id?: any;
  id?: any;
  name: string;
  code?: string;
  batch_code?: string;
  session_id?: any;
  session_name?: string;
  course_id?: any;
  course_name?: string;
  max_capacity: number;
  current_count: number;
}

interface Student {
  id: string;
  username: string;
  full_name?: string;
  email?: string;
  phone?: string;
  center_id?: string;
  session_id?: string;
  course_id?: string;
  course_name?: string;
}

interface LinkRow {
  _id?: any;
  id?: any;
  student_id: string;
  batch_id: string;
  status: string;
}

const toId = (v: any): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v.$oid) return v.$oid;
  return "";
};

const CenterBatchStudentsPage = () => {
  const { batch_id } = useParams<{ batch_id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const [batch, setBatch] = useState<Batch | null>(null);
  const [allBatches, setAllBatches] = useState<Batch[]>([]);
  const [coursesMap, setCoursesMap] = useState<Record<string, string>>({});

  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [unassigned, setUnassigned] = useState<Student[]>([]);
  const [assignedLinks, setAssignedLinks] = useState<LinkRow[]>([]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchUnassigned, setSearchUnassigned] = useState("");
  const [searchAssigned, setSearchAssigned] = useState("");
  const [filterStrictCourse, setFilterStrictCourse] = useState(false);

  // Reassign (edit batch) dialog state
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignStudent, setReassignStudent] = useState<Student | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState("");
  const [reassignSaving, setReassignSaving] = useState(false);

  const fetchData = async () => {
    if (!batch_id) return;
    setLoading(true);
    try {
      const [batchesRes, unassignedRes, assignedRes, studentsRes, coursesRes] = await Promise.all([
        apiFetch("/api/batches"),
        apiFetch("/api/batch-students/unassigned"),
        apiFetch(`/api/batch-students/batch/${batch_id}`),
        apiFetch("/api/students"),
        apiFetch("/api/courses").catch(() => null),
      ]);

      // Map course IDs to course names
      const cMap: Record<string, string> = {};
      if (coursesRes && coursesRes.ok) {
        const cData = await coursesRes.json().catch(() => []);
        (Array.isArray(cData) ? cData : []).forEach((c: any) => {
          const cid = toId(c._id || c.id);
          if (cid) cMap[cid] = c.course_name || c.name || "";
        });
      }
      setCoursesMap(cMap);

      if (batchesRes.ok) {
        const data = await batchesRes.json();
        const normalized: Batch[] = (Array.isArray(data) ? data : []).map((b: any) => ({
          _id: toId(b._id || b.id),
          name: b.name ?? b.batch_name ?? "",
          code: b.batch_code || b.code || "",
          session_id: toId(b.session_id),
          session_name: b.session_name || "",
          course_id: toId(b.course_id),
          course_name: b.course_name || cMap[toId(b.course_id)] || "",
          max_capacity: Number(b.max_capacity ?? 30),
          current_count: Number(b.current_count ?? 0),
        }));
        setAllBatches(normalized);

        const found = normalized.find((b) => b._id === batch_id);
        setBatch(found || null);
      }

      let unassignedRows: Student[] = [];
      if (unassignedRes.ok) {
        const data = await unassignedRes.json();
        unassignedRows = (Array.isArray(data) ? data : []).map((s: any) => ({
          id: toId(s.id || s._id),
          username: s.username ?? s.roll_number ?? "",
          full_name: s.full_name || s.name || s.username || "Student",
          email: s.email,
          phone: s.phone || s.mobile,
          center_id: toId(s.center_id || s.parent_id),
          session_id: toId(s.session_id),
          course_id: toId(s.course_id),
          course_name: s.course_name || cMap[toId(s.course_id)] || s.course || "",
        }));
      }
      setUnassigned(unassignedRows);

      if (assignedRes.ok) {
        const data = await assignedRes.json();
        const links = (Array.isArray(data) ? data : []).map((r: any) => ({
          _id: toId(r._id || r.id),
          id: toId(r.id || r._id),
          student_id: toId(r.student_id),
          batch_id: toId(r.batch_id),
          status: r.status || "active",
        }));
        setAssignedLinks(links);
      } else {
        setAssignedLinks([]);
      }

      if (studentsRes.ok) {
        const data = await studentsRes.json();
        const rows = (Array.isArray(data) ? data : []).map((u: any) => ({
          id: toId(u._id || u.id),
          username: u.username ?? u.roll_number ?? "",
          full_name: u.full_name || u.name || u.username || "Student",
          email: u.email,
          phone: u.phone || u.mobile,
          center_id: toId(u.parent_id || u.center_id),
          session_id: toId(u.session_id),
          course_id: toId(u.course_id),
          course_name: u.course_name || cMap[toId(u.course_id)] || u.course || "",
        }));
        setAllStudents(rows);
      } else {
        setAllStudents([]);
      }
    } catch {
      toast.error("Failed to load batch students data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [batch_id]);

  const assignedStudents = useMemo(() => {
    const mapById = new Map(allStudents.map((s) => [s.id, s]));
    const q = searchAssigned.trim().toLowerCase();
    const rows = assignedLinks
      .map((l) => mapById.get(l.student_id))
      .filter(Boolean) as Student[];

    if (!q) return rows;
    return rows.filter((s) =>
      `${s.full_name || ""} ${s.username} ${s.email || ""} ${s.phone || ""} ${s.course_name || ""}`.toLowerCase().includes(q)
    );
  }, [assignedLinks, allStudents, searchAssigned]);

  const eligibleStudents = useMemo(() => {
    const q = searchUnassigned.trim().toLowerCase();

    // Use unassigned list from backend as primary baseline, fallback to allStudents not in assignedLinks
    const assignedSet = new Set(assignedLinks.map((l) => l.student_id));
    const baseList = unassigned.length > 0 ? unassigned : allStudents.filter((s) => !assignedSet.has(s.id));

    return baseList.filter((s) => {
      if (filterStrictCourse && batch?.course_id && s.course_id && s.course_id !== batch.course_id) {
        return false;
      }
      if (!q) return true;
      return `${s.full_name || ""} ${s.username} ${s.email || ""} ${s.phone || ""} ${s.course_name || ""}`.toLowerCase().includes(q);
    });
  }, [unassigned, allStudents, assignedLinks, batch, searchUnassigned, filterStrictCourse]);

  const reassignOptions = useMemo(() => {
    if (!reassignStudent) return [];
    return allBatches.filter((b) => b._id !== batch_id);
  }, [allBatches, reassignStudent, batch_id]);

  const toggleSelect = (studentId: string) => {
    const next = new Set(selected);
    if (next.has(studentId)) next.delete(studentId);
    else next.add(studentId);
    setSelected(next);
  };

  const selectAllVisible = () => {
    const next = new Set(selected);
    eligibleStudents.forEach((s) => next.add(s.id));
    setSelected(next);
  };

  const clearSelection = () => setSelected(new Set());

  const assignSingleStudent = async (student_id: string) => {
    if (!batch_id) return;
    setAssigning(true);
    try {
      const res = await apiFetch("/api/batch-students/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id, batch_id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to assign student");
      }
      toast.success("Student assigned to batch successfully!");
      fetchData();
    } catch (e: any) {
      toast.error(e?.message || "Assign failed");
    } finally {
      setAssigning(false);
    }
  };

  const bulkAssign = async () => {
    if (!batch_id) return;
    if (selected.size === 0) return toast.error("Select at least one student");

    setAssigning(true);
    try {
      const ids = Array.from(selected);
      let count = 0;
      for (const student_id of ids) {
        const res = await apiFetch("/api/batch-students/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_id, batch_id }),
        });
        if (res.ok) {
          count++;
        }
      }
      toast.success(`Assigned ${count} student(s) to ${batch?.name || "batch"}`);
      setSelected(new Set());
      fetchData();
    } catch (e: any) {
      toast.error(e?.message || "Bulk assign failed");
    } finally {
      setAssigning(false);
    }
  };

  const unassignStudent = async (student_id: string) => {
    const next = new Set(removingIds);
    next.add(student_id);
    setRemovingIds(next);

    try {
      const res = await apiFetch("/api/batch-students/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id, batch_id: null }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to remove student");
      }

      toast.success("Student removed from batch");
      fetchData();
    } catch (e: any) {
      toast.error(e?.message || "Remove failed");
    } finally {
      const done = new Set(removingIds);
      done.delete(student_id);
      setRemovingIds(done);
    }
  };

  const openReassign = (student: Student) => {
    setReassignStudent(student);
    setReassignTargetId("");
    setReassignOpen(true);
  };

  const closeReassign = () => {
    setReassignOpen(false);
    setReassignStudent(null);
    setReassignTargetId("");
  };

  const submitReassign = async () => {
    if (!reassignStudent) return;
    if (!reassignTargetId) {
      toast.error("Select a batch to move the student into");
      return;
    }

    setReassignSaving(true);
    try {
      const res = await apiFetch("/api/batch-students/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: reassignStudent.id,
          batch_id: reassignTargetId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to update student's batch");
      }

      toast.success("Student moved to target batch");
      closeReassign();
      fetchData();
    } catch (e: any) {
      toast.error(e?.message || "Batch update failed");
    } finally {
      setReassignSaving(false);
    }
  };

  const capacityPct = batch?.max_capacity ? Math.min(100, Math.round(((assignedStudents.length) / batch.max_capacity) * 100)) : 0;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16 relative">
        {/* Ambient Glows */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />

        {/* Back Link & Hero Header */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden space-y-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/dashboard/center/batches")}
                className="w-12 h-12 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 flex items-center justify-center transition-all shadow-lg shrink-0"
                title="Back to Batches"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="font-heading font-black text-2xl md:text-3xl text-white uppercase tracking-tight">
                    {batch ? batch.name : "Batch Student Allocation"}
                  </h1>
                  {batch?.code && (
                    <Badge variant="outline" className="font-mono text-xs font-bold uppercase bg-indigo-500/10 text-indigo-300 border-indigo-500/30">
                      [{batch.code}]
                    </Badge>
                  )}
                </div>
                <p className="text-slate-400 mt-1 text-xs md:text-sm font-medium flex items-center gap-2 flex-wrap">
                  <span>Course: <strong className="text-slate-200">{batch?.course_name || "General Course"}</strong></span>
                  <span>•</span>
                  <span>Session: <strong className="text-slate-200">{batch?.session_name || "Current Session"}</strong></span>
                </p>
              </div>
            </div>

            {/* Capacity Progress Counter */}
            <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80 shrink-0 space-y-2 min-w-[220px]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-slate-400">Batch Capacity</span>
                <span className="font-mono font-extrabold text-indigo-400">
                  {assignedStudents.length} / {batch?.max_capacity || 30} Seats
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-500 rounded-full",
                    capacityPct >= 90 ? "bg-rose-500" : capacityPct >= 70 ? "bg-amber-500" : "bg-gradient-to-r from-indigo-500 to-emerald-400"
                  )}
                  style={{ width: `${capacityPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-800/80">
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Assigned Students</span>
              <span className="text-xl font-extrabold text-emerald-400 mt-0.5 block">{assignedStudents.length}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Unassigned Franchise Students</span>
              <span className="text-xl font-extrabold text-indigo-400 mt-0.5 block">{eligibleStudents.length}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Max Capacity</span>
              <span className="text-xl font-extrabold text-slate-200 mt-0.5 block">{batch?.max_capacity || 30}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Available Seats</span>
              <span className="text-xl font-extrabold text-purple-400 mt-0.5 block">
                {Math.max(0, (batch?.max_capacity || 30) - assignedStudents.length)}
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Batch Student Allocation...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* LEFT PANEL: Enrolled Students in Batch */}
            <div className="space-y-4">
              <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    Enrolled Batch Students ({assignedStudents.length})
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    Active Members
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchAssigned}
                    onChange={(e) => setSearchAssigned(e.target.value)}
                    placeholder="SEARCH ENROLLED STUDENTS BY NAME, ROLL NO OR EMAIL..."
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-800 bg-slate-950/80 text-xs font-bold text-slate-100 placeholder-slate-500 uppercase tracking-wider focus:border-indigo-500 focus:outline-none transition-all"
                  />
                </div>

                {assignedStudents.length === 0 ? (
                  <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl p-10 flex flex-col items-center text-center">
                    <Users className="w-10 h-10 text-slate-600 mb-3 opacity-40" />
                    <h4 className="text-sm font-bold text-white uppercase tracking-tight">No Students Enrolled Yet</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs">
                      Select unassigned students from the right panel to enroll them into <strong>{batch?.name}</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                    {assignedStudents.map((s) => (
                      <div
                        key={s.id}
                        className="bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-indigo-500/30 rounded-2xl p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-black text-sm flex items-center justify-center shrink-0 shadow-inner">
                            {(s.full_name || s.username || "S").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white uppercase tracking-tight group-hover:text-indigo-300 transition-colors">
                              {s.full_name || s.username}
                            </h4>
                            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 mt-0.5">
                              <code className="font-mono text-[10px] text-indigo-300 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                {s.username || "ROLL-N/A"}
                              </code>
                              {s.phone && <span className="text-[11px] font-mono">{s.phone}</span>}
                            </div>
                            {s.course_name && (
                              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block mt-1">
                                Course: {s.course_name}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 border-t sm:border-t-0 border-slate-800 pt-2 sm:pt-0">
                          <button
                            onClick={() => openReassign(s)}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-indigo-600/20 hover:text-indigo-300 border border-slate-800 hover:border-indigo-500/40 text-slate-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
                            title="Transfer student to another batch"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-400" />
                            Move
                          </button>
                          <button
                            disabled={removingIds.has(s.id)}
                            onClick={() => unassignStudent(s.id)}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-600/20 hover:text-rose-400 border border-slate-800 hover:border-rose-500/40 text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all disabled:opacity-50"
                            title="Remove student from batch"
                          >
                            {removingIds.has(s.id) ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserMinus className="w-3.5 h-3.5 text-rose-400" />
                            )}
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT PANEL: Unassigned Franchise Students */}
            <div className="space-y-4">
              <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-indigo-400" />
                    Unassigned Franchise Students ({eligibleStudents.length})
                  </h3>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFilterStrictCourse(!filterStrictCourse)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5",
                        filterStrictCourse 
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/25"
                          : "bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white"
                      )}
                    >
                      <Filter className="w-3 h-3" />
                      {filterStrictCourse ? "Matching Course Only" : "All Franchise Students"}
                    </button>
                  </div>
                </div>

                {/* Search & Bulk Toolbar */}
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchUnassigned}
                      onChange={(e) => setSearchUnassigned(e.target.value)}
                      placeholder="SEARCH UNASSIGNED STUDENTS BY NAME, ROLL NO OR PHONE..."
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-800 bg-slate-950/80 text-xs font-bold text-slate-100 placeholder-slate-500 uppercase tracking-wider focus:border-indigo-500 focus:outline-none transition-all"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-950/80 p-2.5 rounded-2xl border border-slate-800">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={selectAllVisible}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[10px] font-bold uppercase tracking-wider transition-all"
                      >
                        Select Visible ({eligibleStudents.length})
                      </button>
                      {selected.size > 0 && (
                        <button
                          onClick={clearSelection}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-wider transition-all"
                        >
                          Clear ({selected.size})
                        </button>
                      )}
                    </div>

                    <button
                      disabled={assigning || selected.size === 0}
                      onClick={bulkAssign}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                      {assigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Bulk Enroll ({selected.size})
                    </button>
                  </div>
                </div>

                {eligibleStudents.length === 0 ? (
                  <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl p-10 flex flex-col items-center text-center">
                    <GraduationCap className="w-10 h-10 text-slate-600 mb-3 opacity-40" />
                    <h4 className="text-sm font-bold text-white uppercase tracking-tight">No Unassigned Students Found</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs">
                      {filterStrictCourse 
                        ? "Try toggling off 'Matching Course Only' to view all registered students of your center."
                        : "All registered students in your franchise center are already assigned to active batches."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {eligibleStudents.map((s) => {
                      const checked = selected.has(s.id);
                      return (
                        <div
                          key={s.id}
                          className={cn(
                            "p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group cursor-pointer",
                            checked
                              ? "bg-indigo-600/15 border-indigo-500/60 shadow-lg shadow-indigo-500/10"
                              : "bg-slate-950/70 hover:bg-slate-950 border-slate-800 hover:border-slate-700"
                          )}
                          onClick={() => toggleSelect(s.id)}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSelect(s.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded border-slate-700 accent-indigo-600 cursor-pointer"
                            />
                            <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 font-black text-sm flex items-center justify-center shrink-0">
                              {(s.full_name || s.username || "S").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white uppercase tracking-tight group-hover:text-indigo-300 transition-colors">
                                {s.full_name || s.username}
                              </h4>
                              <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 mt-0.5">
                                <code className="font-mono text-[10px] text-slate-400 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                  {s.username || "ROLL-N/A"}
                                </code>
                                {s.phone && <span className="text-[11px] font-mono">{s.phone}</span>}
                              </div>
                              {s.course_name && (
                                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mt-1">
                                  Enrolled: {s.course_name}
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              assignSingleStudent(s.id);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider shadow-md flex items-center gap-1.5 shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Enroll
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Reassign / Edit Student's Batch Dialog */}
      <Dialog open={reassignOpen} onOpenChange={(open) => (open ? setReassignOpen(true) : closeReassign())}>
        <DialogContent className="rounded-3xl border border-indigo-500/30 bg-slate-950/95 backdrop-blur-3xl text-slate-100 max-w-md shadow-2xl p-6 sm:p-8">
          <DialogHeader className="border-b border-slate-800 pb-4">
            <DialogTitle className="font-heading font-black text-xl text-white uppercase tracking-tight flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-indigo-400" />
              Transfer Student to Target Batch
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Reassign student's active batch linkage across attendance records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Selected Student</span>
              <p className="text-sm font-extrabold text-white">{reassignStudent?.full_name || reassignStudent?.username}</p>
              <p className="text-[11px] text-slate-400">Current Batch: <strong className="text-indigo-400">{batch?.name}</strong></p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Target Franchise Batch *
              </label>
              <select
                value={reassignTargetId}
                onChange={(e) => setReassignTargetId(e.target.value)}
                className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-slate-100 outline-none focus:border-indigo-500 transition-all"
              >
                <option value="">Select Target Batch</option>
                {reassignOptions.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} ({b.current_count}/{b.max_capacity} Seats) {b.code ? `[${b.code}]` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={closeReassign}
              className="rounded-2xl border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={submitReassign}
              disabled={reassignSaving || !reassignTargetId}
              className="rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 px-6 gap-2 w-full sm:w-auto"
            >
              {reassignSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
              Confirm Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CenterBatchStudentsPage;