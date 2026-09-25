import { useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, ClipboardCheck, Search, Circle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface MarksRow {
  student_id: string;
  serial_number?: string;
  enrollment_number?: string;
  name: string;
  course_id: string;
  course_name: string;
  attempt: number;
  current_attempt: number;
  available_attempts: number[];
  marks_obtained?: number;
  percentage?: number;
  result?: string;
  is_reappear: boolean;
  marks_submitted: boolean;
  can_enter: boolean;
  change_request_status: string;
  has_pending_request: boolean;
}

interface SubjectMark {
  subject_id: string;
  exam_obtained: number;
  exam_total: number;
  min_exam_marks: number;
  practical_obtained: number;
  practical_total: number;
  min_practical_marks: number;
  practical_component_enabled?: boolean;
  assignment_obtained: number;
  assignment_total: number;
  min_assignment_marks: number;
  assignment_component_enabled?: boolean;
  obtained: number;
  total: number;
  subject_passed?: boolean;
  from_online_exam: boolean;
  exam_readonly: boolean;
}

const CenterExamMarksEntryPage = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MarksRow[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterCourse, setFilterCourse] = useState("all");
  const [studentType, setStudentType] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MarksRow | null>(null);
  const [formSubjects, setFormSubjects] = useState<SubjectMark[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestReason, setRequestReason] = useState("");
  const [requestTarget, setRequestTarget] = useState<MarksRow | null>(null);
  const [selectedAttempt, setSelectedAttempt] = useState(1);
  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [availableAttempts, setAvailableAttempts] = useState<number[]>([1]);
  const [isCurrentAttempt, setIsCurrentAttempt] = useState(true);

  const loadFormData = async (row: MarksRow, attempt: number, viewOnly = false) => {
    try {
      const res = await apiFetch(
        `/api/exam/marks-entry/${row.student_id}/${row.course_id}?attempt=${attempt}`
      );
      if (res.ok) {
        const data = await res.json();
        setFormSubjects((data.subjects || []).map((s: SubjectMark) => computeSubject(s)));
        setSelectedAttempt(data.attempt_number || attempt);
        setCurrentAttempt(data.current_attempt_number || row.current_attempt || attempt);
        setAvailableAttempts(data.available_attempts || row.available_attempts || [attempt]);
        setIsCurrentAttempt(data.is_current_attempt ?? attempt === (data.current_attempt_number || row.current_attempt));
        setReadOnly(viewOnly || data.read_only || !data.is_current_attempt);
      }
    } catch (e) {
      console.error("loadFormData error", e);
    }
  };

  const openForm = async (row: MarksRow, viewOnly = false) => {
    setSelected(row);
    const attempt = viewOnly || row.can_enter ? row.attempt : (row.current_attempt || row.attempt);
    setSelectedAttempt(attempt);
    await loadFormData(row, attempt, viewOnly);
  };

  const handleAttemptChange = async (attempt: number) => {
    if (!selected) return;
    setSelectedAttempt(attempt);
    await loadFormData(selected, attempt, false);
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory !== "all") params.set("category_id", filterCategory);
      if (filterCourse !== "all") params.set("course_id", filterCourse);
      if (studentType !== "all") params.set("student_type", studentType);
      if (search.trim()) params.set("search", search.trim());

      const [listRes, subRes, catRes, courseRes, teachersRes] = await Promise.all([
        apiFetch(`/api/exam/marks-entry/students?${params}`).catch(() => null),
        apiFetch("/api/admin/subjects").catch(() => null),
        apiFetch("/api/admin/categories?limit=100").catch(() => null),
        apiFetch("/api/courses/allot").catch(() => null),
        apiFetch("/api/cms/teachers").catch(() => null),
      ]);

      if (listRes && listRes.ok) {
        const data = await listRes.json();
        setRows(Array.isArray(data) ? data : []);
      }
      if (subRes && subRes.ok) {
        const s = await subRes.json();
        setSubjects(Array.isArray(s) ? s : (s?.items || []));
      }
      if (catRes && catRes.ok) {
        const c = await catRes.json();
        setCategories(Array.isArray(c) ? c : (c?.items || []));
      }
      if (courseRes && courseRes.ok) {
        const crs = await courseRes.json();
        setCourses(Array.isArray(crs) ? crs : []);
      }
      if (teachersRes && teachersRes.ok) {
        const tData = await teachersRes.json();
        setTeachers(Array.isArray(tData) ? tData : (tData?.items || []));
      }
    } catch (e) {
      console.error("fetchList error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [filterCategory, filterCourse, studentType]);

  const filteredCourses = useMemo(() => {
    if (!Array.isArray(courses)) return [];
    if (filterCategory === "all") return courses;
    return courses.filter((c: any) => (c.category_id || c.categoryId) === filterCategory);
  }, [courses, filterCategory]);

  const getFacultyForCourse = (courseId: string) => {
    if (!Array.isArray(courses)) return "Course Faculty Department";
    const courseObj = courses.find((c: any) => (c.id || c._id) === courseId);
    if (courseObj?.faculty_name || courseObj?.instructor || courseObj?.teacher_name) {
      return courseObj.faculty_name || courseObj.instructor || courseObj.teacher_name;
    }
    if (Array.isArray(teachers) && teachers.length > 0) {
      return teachers[0]?.name || teachers[0]?.title || "Academic Faculty Dept.";
    }
    return "Course Faculty Department";
  };

  const getSubjectName = (id: string) => {
    if (!Array.isArray(subjects)) return id;
    return subjects.find((s) => (s._id || s.id) === id)?.subject_name || id;
  };

  const computeSubject = (s: SubjectMark): SubjectMark => {
    const obtained = (Number(s.exam_obtained) || 0) + (Number(s.practical_obtained) || 0) + (Number(s.assignment_obtained) || 0);
    const total = (Number(s.exam_total) || 0) + (Number(s.practical_total) || 0) + (Number(s.assignment_total) || 0);
    
    const examPassed = Number(s.exam_obtained) >= Number(s.min_exam_marks || 0);
    const practicalPassed = s.practical_component_enabled 
      ? Number(s.practical_obtained) >= Number(s.min_practical_marks || 0) 
      : true;
    const assignmentPassed = s.assignment_component_enabled 
      ? Number(s.assignment_obtained) >= Number(s.min_assignment_marks || 0) 
      : true;
    
    const subjectPassed = total > 0 && examPassed && practicalPassed && assignmentPassed;
    return { ...s, obtained, total, subject_passed: subjectPassed };
  };

  const totals = useMemo(() => {
    if (!Array.isArray(formSubjects)) return { obtained: 0, total: 0, pct: 0, result: "Pending", anySubjectFail: false };
    const computed = formSubjects.map(computeSubject);
    const obtained = computed.reduce((s, x) => s + x.obtained, 0);
    const total = computed.reduce((s, x) => s + x.total, 0);
    const pct = total > 0 ? (obtained / total) * 100 : 0;
    const anySubjectFail = computed.some((x) => x.total > 0 && !x.subject_passed);
    const result = anySubjectFail ? "Fail" : "Pass";
    return { obtained, total, pct, result, anySubjectFail };
  }, [formSubjects]);

  const updateSubject = (idx: number, patch: Partial<SubjectMark>) => {
    setFormSubjects((prev) => {
      const next = [...prev];
      if (next[idx]) {
        next[idx] = computeSubject({ ...next[idx], ...patch });
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/exam/marks-entry/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: selected.student_id,
          course_id: selected.course_id,
          attempt_number: selectedAttempt,
          subjects: formSubjects.map((s) => ({
            subject_id: s.subject_id,
            exam_obtained: Number(s.exam_obtained) || 0,
            exam_total: Number(s.exam_total) || 0,
            practical_obtained: Number(s.practical_obtained) || 0,
            practical_total: Number(s.practical_total) || 0,
            assignment_obtained: Number(s.assignment_obtained) || 0,
            assignment_total: Number(s.assignment_total) || 0,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Marks submitted successfully");
        setSelected(null);
        fetchList();
      } else {
        toast.error(data.message || "Submit failed");
      }
    } catch {
      toast.error("Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const openRequestModal = (row: MarksRow) => {
    setRequestTarget(row);
    setRequestReason("");
    setRequestModalOpen(true);
  };

  const submitChangeRequest = async () => {
    if (!requestTarget || !requestReason.trim()) {
      toast.error("Reason is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/exam/marks-entry/request-changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: requestTarget.student_id,
          course_id: requestTarget.course_id,
          attempt_number: requestTarget.attempt,
          reason: requestReason.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Request submitted successfully");
        setRequestModalOpen(false);
        setRequestTarget(null);
        fetchList();
      } else {
        toast.error(data.message || "Request failed");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  const renderActions = (row: MarksRow) => {
    if (row.can_enter) {
      return <Button size="sm" onClick={() => openForm(row)} className="bg-blue-600 hover:bg-blue-500 font-bold text-xs">Enter Marks</Button>;
    }
    if (row.has_pending_request || row.change_request_status === "pending") {
      return (
        <div className="flex gap-1 justify-center">
          <Button size="sm" variant="outline" onClick={() => openForm(row, true)} className="border-slate-700 bg-slate-900 text-slate-300">View Marks</Button>
          <Button size="sm" variant="secondary" disabled className="bg-slate-800 text-slate-500">Request Sent</Button>
        </div>
      );
    }
    if (row.marks_submitted) {
      return (
        <div className="flex gap-1 justify-center">
          <Button size="sm" variant="outline" onClick={() => openForm(row, true)} className="border-slate-700 bg-slate-900 text-slate-300">View Marks</Button>
          <Button size="sm" variant="secondary" onClick={() => openRequestModal(row)} className="bg-amber-500/10 text-amber-400 border border-amber-500/20">Request Changes</Button>
        </div>
      );
    }
    return <Button size="sm" variant="outline" onClick={() => openForm(row, true)} className="border-slate-700 bg-slate-900 text-slate-300">View</Button>;
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-6 animate-in fade-in duration-500 relative">
        {/* Ambient Glow Effects */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/15 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/2 -right-24 w-96 h-96 bg-indigo-600/10 blur-[130px] rounded-full pointer-events-none" />

        {/* Hero Header Banner */}
        <div className="relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 bg-gradient-to-r from-slate-900/95 via-indigo-950/70 to-slate-900/95 border border-indigo-500/30 p-6 md:p-8 rounded-3xl shadow-2xl backdrop-blur-2xl">
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3.5 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl shadow-lg shadow-blue-500/25">
              <ClipboardCheck className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white">Examination Marks Entry</h1>
              <p className="text-xs md:text-sm font-semibold text-slate-300 mt-1">Course assessment & practical marks evaluation for candidate Marksheets</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-amber-300 bg-amber-400/10 px-4 py-2 rounded-2xl border border-amber-400/30 shadow-[0_0_12px_rgba(251,191,36,0.2)] shrink-0 relative z-10">
            <Circle className="w-3 h-3 fill-amber-400 text-amber-400 animate-pulse" />
            <span className="font-extrabold uppercase tracking-wider text-[11px]">Reappear Candidate Indicator</span>
          </div>
        </div>

        {/* Filter Card */}
        <div className="bg-slate-900/80 border border-slate-700/60 p-5 rounded-3xl shadow-xl backdrop-blur-xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Category</Label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-10 bg-slate-950/80 border-slate-800 rounded-xl text-xs font-semibold text-white focus:border-blue-500"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-2xl">
                <SelectItem value="all">All Categories</SelectItem>
                {Array.isArray(categories) && categories.map((c: any) => (
                  <SelectItem key={c.id || c._id} value={c.id || c._id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Course</Label>
            <Select value={filterCourse} onValueChange={setFilterCourse}>
              <SelectTrigger className="h-10 bg-slate-950/80 border-slate-800 rounded-xl text-xs font-semibold text-white focus:border-blue-500"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-2xl">
                <SelectItem value="all">All Courses</SelectItem>
                {filteredCourses.map((c: any) => (
                  <SelectItem key={c.id || c._id} value={c.id || c._id}>{c.course_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Student Type</Label>
            <Select value={studentType} onValueChange={setStudentType}>
              <SelectTrigger className="h-10 bg-slate-950/80 border-slate-800 rounded-xl text-xs font-semibold text-white focus:border-blue-500"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-2xl">
                <SelectItem value="all">All Students</SelectItem>
                <SelectItem value="regular">Regular Students</SelectItem>
                <SelectItem value="reappear">Reappear Students</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Search Student</Label>
              <Input
                placeholder="Enrollment, Name, or Roll No..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchList()}
                className="h-10 bg-slate-950/80 border-slate-800 rounded-xl text-xs font-semibold text-white placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>
            <Button onClick={fetchList} className="h-10 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 font-bold shadow-lg shadow-blue-600/25">
              <Search className="w-4 h-4 mr-1" /> Search
            </Button>
          </div>
        </div>

        {/* Student Table */}
        <div className="bg-slate-900/80 border border-slate-700/60 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 py-4 px-6 bg-slate-950/90">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-blue-400">Candidates Register ({rows.length})</h3>
              <p className="text-[11px] font-medium text-slate-400 mt-0.5">Select a student record to enter, update, or inspect examination marks</p>
            </div>
            {filterCourse !== "all" && (
              <div className="text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-3.5 py-1.5 font-bold rounded-2xl flex items-center gap-2 shadow-sm">
                <span>Faculty Instructor:</span>
                <span className="font-extrabold text-white">{getFacultyForCourse(filterCourse)}</span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center py-20 text-slate-400">
                <Loader2 className="w-9 h-9 animate-spin text-blue-500" />
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-950/90 border-b border-slate-800 text-slate-300 font-black uppercase tracking-widest text-[10px]">
                  <tr>
                    <th className="p-4 text-left pl-6">S.No</th>
                    <th className="p-4 text-left">Enrollment</th>
                    <th className="p-4 text-left">Student Name</th>
                    <th className="p-4 text-left">Course Title</th>
                    <th className="p-4 text-left">Attempt</th>
                    <th className="p-4 text-left">Obtained</th>
                    <th className="p-4 text-left">% Percentage</th>
                    <th className="p-4 text-left">Status</th>
                    <th className="p-4 text-center pr-6">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-semibold text-slate-200">
                  {rows.map((row, i) => (
                    <tr key={`${row.student_id}-${row.attempt}-${i}`} className="hover:bg-slate-900/50 transition-colors">
                      <td className="p-4 pl-6 font-mono text-slate-500">{row.serial_number || i + 1}</td>
                      <td className="p-4 font-mono text-slate-300">{row.enrollment_number || "—"}</td>
                      <td className="p-4 font-bold text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 font-black flex items-center justify-center text-xs border border-blue-500/30 shrink-0">
                            {row.name?.[0]?.toUpperCase() || "S"}
                          </div>
                          <span className="inline-flex items-center gap-2">
                            {row.is_reappear && <Circle className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0 animate-pulse" title="Reappear Candidate" />}
                            <span className="text-sm font-extrabold">{row.name}</span>
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-300 font-bold">{row.course_name}</td>
                      <td className="p-4 font-bold text-blue-400">Attempt #{row.current_attempt || row.attempt}</td>
                      <td className="p-4 font-mono text-slate-200 font-extrabold">{row.marks_obtained != null ? row.marks_obtained.toFixed(1) : "—"}</td>
                      <td className="p-4 font-mono text-slate-200 font-extrabold">{row.percentage != null ? `${row.percentage.toFixed(1)}%` : "—"}</td>
                      <td className="p-4">
                        <span className={cn(
                          "px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-full border shadow-sm",
                          row.result === "Pass" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]" :
                          row.result === "Fail" ? "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.3)]" :
                          "bg-slate-800 text-slate-400 border-slate-700"
                        )}>
                          {row.result || "Pending"}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-center">{renderActions(row)}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-16 text-center text-slate-400 font-bold uppercase tracking-wider">
                        No eligible student candidate found for marks entry
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Enter / View Marks Dialog */}
        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-950/95 border-indigo-500/30 text-slate-100 rounded-3xl backdrop-blur-2xl shadow-2xl p-6">
            <DialogHeader className="border-b border-slate-800 pb-4">
              <DialogTitle className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-xl">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                {readOnly ? "Inspection / View Marks" : "Enter Examination Marks"} — {selected?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 pt-4">
              <div className="flex items-end gap-3 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
                <div className="flex-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Evaluation Attempt</Label>
                  <Select
                    value={String(selectedAttempt)}
                    onValueChange={(v) => handleAttemptChange(parseInt(v, 10))}
                  >
                    <SelectTrigger className="h-10 bg-slate-950 border-slate-800 text-xs font-bold text-white rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-2xl">
                      {availableAttempts.map((a) => (
                        <SelectItem key={a} value={String(a)}>
                          Attempt {a}{a === currentAttempt ? " (Current Active)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!isCurrentAttempt && (
                  <span className="text-xs text-amber-400 font-extrabold pb-2.5">Read-only archived attempt</span>
                )}
              </div>

              {formSubjects.map((s, idx) => {
                const computed = computeSubject(s);
                const practicalEnabled = s.practical_component_enabled ?? false;
                const assignmentEnabled = s.assignment_component_enabled ?? false;
                return (
                  <div key={s.subject_id || idx} className="border border-slate-800 rounded-2xl p-4 bg-slate-900/60 space-y-3 shadow-lg">
                    <div className="text-sm font-bold flex items-center gap-2 text-white border-b border-slate-800/80 pb-2.5">
                      <span className="text-base font-black">{getSubjectName(s.subject_id)}</span>
                      {s.exam_readonly && (
                        <span className="text-xs text-cyan-400 font-semibold bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">(Online CBT Exam)</span>
                      )}
                      <span className={`ml-auto text-xs font-black uppercase px-3 py-1 rounded-full border shadow-sm ${
                        computed.subject_passed 
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" 
                          : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      }`}>
                        {computed.subject_passed ? "Pass" : "Fail"} ({computed.obtained.toFixed(1)} / {computed.total.toFixed(1)})
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-400">Theory Obtained</Label>
                        <Input type="number" value={s.exam_obtained} disabled={readOnly || s.exam_readonly}
                          onChange={(e) => updateSubject(idx, { exam_obtained: parseFloat(e.target.value) || 0 })}
                          className="h-10 bg-slate-950 border-slate-800 text-xs font-bold text-white rounded-xl" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-400">Theory Total</Label>
                        <Input type="number" value={s.exam_total} disabled={true} className="h-10 bg-slate-950/50 border-slate-800 text-xs font-bold text-slate-400 rounded-xl" />
                      </div>
                      <div />
                      {practicalEnabled && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-400">Practical Obtained</Label>
                            <Input type="number" value={s.practical_obtained} disabled={readOnly}
                              onChange={(e) => updateSubject(idx, { practical_obtained: parseFloat(e.target.value) || 0 })}
                              className="h-10 bg-slate-950 border-slate-800 text-xs font-bold text-white rounded-xl" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-400">Practical Total</Label>
                            <Input type="number" value={s.practical_total} disabled={true} className="h-10 bg-slate-950/50 border-slate-800 text-xs font-bold text-slate-400 rounded-xl" />
                          </div>
                          <div />
                        </>
                      )}
                      {assignmentEnabled && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-400">Assignment Obtained</Label>
                            <Input type="number" value={s.assignment_obtained} disabled={readOnly}
                              onChange={(e) => updateSubject(idx, { assignment_obtained: parseFloat(e.target.value) || 0 })}
                              className="h-10 bg-slate-950 border-slate-800 text-xs font-bold text-white rounded-xl" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-400">Assignment Total</Label>
                            <Input type="number" value={s.assignment_total} disabled={true} className="h-10 bg-slate-950/50 border-slate-800 text-xs font-bold text-slate-400 rounded-xl" />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-4 rounded-2xl border border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs shadow-inner">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Obtained</span>
                  <span className="font-black text-xl text-white">{totals.obtained.toFixed(1)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Max Total</span>
                  <span className="font-black text-xl text-white">{totals.total.toFixed(1)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Percentage</span>
                  <span className="font-black text-xl text-cyan-400">{totals.pct.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Final Result</span>
                  <span className={cn("font-black text-xl", totals.result === "Pass" ? "text-emerald-400" : "text-rose-400")}>
                    {totals.result}
                  </span>
                </div>
              </div>

              {!readOnly && isCurrentAttempt && (
                <Button onClick={handleSubmit} disabled={submitting} className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold rounded-2xl shadow-xl shadow-blue-500/25 uppercase tracking-wider text-xs">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Submit Marks & Lock Record"}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Change Request Modal */}
        <Dialog open={requestModalOpen} onOpenChange={setRequestModalOpen}>
          <DialogContent className="bg-slate-950 border-amber-500/30 text-slate-100 rounded-3xl backdrop-blur-2xl shadow-2xl p-6">
            <DialogHeader className="border-b border-slate-800 pb-3">
              <DialogTitle className="text-base font-extrabold text-white flex items-center gap-2">
                <Circle className="w-3 h-3 fill-amber-400 text-amber-400" />
                Request Marks Revision — {requestTarget?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-3">
              <Label className="text-xs font-bold uppercase text-slate-400">Reason for Revision Request (Required)</Label>
              <Textarea
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                rows={4}
                className="bg-slate-900 border-slate-800 text-xs text-white rounded-2xl focus:border-amber-500"
                placeholder="Detail why candidate marks need correction..."
              />
            </div>
            <DialogFooter className="gap-2 pt-3 border-t border-slate-800">
              <Button variant="outline" onClick={() => setRequestModalOpen(false)} className="rounded-xl border-slate-800 text-slate-300">Cancel</Button>
              <Button onClick={submitChangeRequest} disabled={submitting || !requestReason.trim()} className="rounded-xl bg-amber-500 text-slate-950 font-black hover:bg-amber-400">Submit Request</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default CenterExamMarksEntryPage;
