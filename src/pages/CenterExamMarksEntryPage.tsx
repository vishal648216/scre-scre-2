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

      const [listRes, subRes, catRes, courseRes] = await Promise.all([
        apiFetch(`/api/exam/marks-entry/students?${params}`),
        apiFetch("/api/admin/subjects"),
        apiFetch("/api/admin/categories?limit=100"),
        apiFetch("/api/courses/allot"),
      ]);

      if (listRes.ok) setRows(await listRes.json());
      if (subRes.ok) {
        const s = await subRes.json();
        setSubjects(Array.isArray(s) ? s : s.items || []);
      }
      if (catRes.ok) {
        const c = await catRes.json();
        setCategories(c.items || c || []);
      }
      if (courseRes.ok) setCourses(await courseRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [filterCategory, filterCourse, studentType]);

  const filteredCourses = useMemo(() => {
    if (filterCategory === "all") return courses;
    return courses.filter((c: any) => (c.category_id || c.categoryId) === filterCategory);
  }, [courses, filterCategory]);

  const getSubjectName = (id: string) =>
    subjects.find((s) => (s._id || s.id) === id)?.subject_name || id;

  const computeSubject = (s: SubjectMark): SubjectMark => {
    const obtained = (Number(s.exam_obtained) || 0) + (Number(s.practical_obtained) || 0) + (Number(s.assignment_obtained) || 0);
    const total = (Number(s.exam_total) || 0) + (Number(s.practical_total) || 0) + (Number(s.assignment_total) || 0);
    
    // Check each component's min passing marks
    const examPassed = Number(s.exam_obtained) >= Number(s.min_exam_marks);
    const practicalPassed = s.practical_component_enabled 
      ? Number(s.practical_obtained) >= Number(s.min_practical_marks) 
      : true;
    const assignmentPassed = s.assignment_component_enabled 
      ? Number(s.assignment_obtained) >= Number(s.min_assignment_marks) 
      : true;
    
    const subjectPassed = total > 0 && examPassed && practicalPassed && assignmentPassed;
    return { ...s, obtained, total, subject_passed: subjectPassed };
  };

  const totals = useMemo(() => {
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
      next[idx] = computeSubject({ ...next[idx], ...patch });
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
        toast.success("Marks submitted");
        setSelected(null);
        fetchList();
      } else {
        toast.error(data.message || "Submit failed");
      }
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
        toast.success("Request submitted");
        setRequestModalOpen(false);
        setRequestTarget(null);
        fetchList();
      } else {
        toast.error(data.message || "Request failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderActions = (row: MarksRow) => {
    if (row.can_enter) {
      return <Button size="sm" onClick={() => openForm(row)}>Enter Marks</Button>;
    }
    if (row.has_pending_request || row.change_request_status === "pending") {
      return (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => openForm(row, true)}>View Marks</Button>
          <Button size="sm" variant="secondary" disabled>Request Sent</Button>
        </div>
      );
    }
    if (row.marks_submitted) {
      return (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => openForm(row, true)}>View Marks</Button>
          <Button size="sm" variant="secondary" onClick={() => openRequestModal(row)}>Request Changes</Button>
        </div>
      );
    }
    return <Button size="sm" variant="outline" onClick={() => openForm(row, true)}>View</Button>;
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Marks Entry</h1>
              <p className="text-sm text-muted-foreground">Course examination marks for eligible students</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Circle className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span>Reappear Student</span>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label className="text-xs font-bold uppercase">Category</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {categories.map((c: any) => (
                    <SelectItem key={c.id || c._id} value={c.id || c._id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold uppercase">Course</Label>
              <Select value={filterCourse} onValueChange={setFilterCourse}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {filteredCourses.map((c: any) => (
                    <SelectItem key={c.id || c._id} value={c.id || c._id}>{c.course_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold uppercase">Student Type</Label>
              <Select value={studentType} onValueChange={setStudentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="reappear">Reappear</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs font-bold uppercase">Search</Label>
                <Input
                  placeholder="Enrollment or Serial No"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchList()}
                />
              </div>
              <Button variant="outline" onClick={fetchList}><Search className="w-4 h-4" /></Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-bold uppercase">Students</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-3 text-left">S.No</th>
                    <th className="p-3 text-left">Enrollment</th>
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Course</th>
                    <th className="p-3 text-left">Attempt</th>
                    <th className="p-3 text-left">Marks</th>
                    <th className="p-3 text-left">%</th>
                    <th className="p-3 text-left">Result</th>
                    <th className="p-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={`${row.student_id}-${row.attempt}`} className="border-b">
                      <td className="p-3">{row.serial_number || i + 1}</td>
                      <td className="p-3">{row.enrollment_number || "—"}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1.5">
                          {row.is_reappear && <Circle className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400 shrink-0" />}
                          {row.name}
                        </span>
                      </td>
                      <td className="p-3">{row.course_name}</td>
                      <td className="p-3">{row.current_attempt || row.attempt}</td>
                      <td className="p-3">{row.marks_obtained?.toFixed(1) ?? "—"}</td>
                      <td className="p-3">{row.percentage != null ? `${row.percentage.toFixed(1)}%` : "—"}</td>
                      <td className="p-3 capitalize">{row.result || "—"}</td>
                      <td className="p-3">{renderActions(row)}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No eligible students</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {readOnly ? "View Marks" : "Enter Marks"} — {selected?.name} (Attempt {selectedAttempt})
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label className="text-xs font-bold uppercase">Attempt</Label>
                  <Select
                    value={String(selectedAttempt)}
                    onValueChange={(v) => handleAttemptChange(parseInt(v, 10))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availableAttempts.map((a) => (
                        <SelectItem key={a} value={String(a)}>
                          Attempt {a}{a === currentAttempt ? " (Current)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!isCurrentAttempt && (
                  <span className="text-xs text-muted-foreground pb-2">Read-only — previous attempt</span>
                )}
              </div>

              {formSubjects.map((s, idx) => {
                const computed = computeSubject(s);
                const practicalEnabled = s.practical_component_enabled ?? false;
                const assignmentEnabled = s.assignment_component_enabled ?? false;
                return (
                  <div key={s.subject_id} className="border rounded-lg p-4 space-y-3">
                    <div className="text-sm font-bold flex items-center gap-2">
                      {getSubjectName(s.subject_id)}
                      {s.exam_readonly && (
                        <span className="text-xs text-blue-600 font-normal">(online exam — read only)</span>
                      )}
                      <span className={`ml-auto text-xs ${computed.subject_passed ? "text-green-600" : "text-red-600"}`}>
                        {computed.subject_passed ? "Pass" : "Fail"} ({computed.obtained.toFixed(1)}/{computed.total.toFixed(1)})
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                    <Label className="text-xs font-bold">Exam Marks — Obtained</Label>
                    <Input type="number" value={s.exam_obtained} disabled={readOnly || s.exam_readonly}
                      onChange={(e) => updateSubject(idx, { exam_obtained: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Exam Marks — Total</Label>
                    <Input type="number" value={s.exam_total} disabled={true} />
                  </div>
                      <div />
                      {practicalEnabled && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs font-bold">Practical — Obtained</Label>
                            <Input type="number" value={s.practical_obtained} disabled={readOnly}
                              onChange={(e) => updateSubject(idx, { practical_obtained: parseFloat(e.target.value) || 0 })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-bold">Practical — Total</Label>
                            <Input type="number" value={s.practical_total} disabled={true} />
                          </div>
                          <div />
                        </>
                      )}
                      {assignmentEnabled && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs font-bold">Assignment — Obtained</Label>
                            <Input type="number" value={s.assignment_obtained} disabled={readOnly}
                              onChange={(e) => updateSubject(idx, { assignment_obtained: parseFloat(e.target.value) || 0 })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-bold">Assignment — Total</Label>
                            <Input type="number" value={s.assignment_total} disabled={true} />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="bg-muted/40 p-4 rounded-lg grid grid-cols-2 gap-2 text-sm">
                <span>Total Obtained: <strong>{totals.obtained.toFixed(1)}</strong></span>
                <span>Total Marks: <strong>{totals.total.toFixed(1)}</strong></span>
                <span>Percentage: <strong>{totals.pct.toFixed(1)}%</strong></span>
                <span>
                  Result: <strong className={totals.result === "Pass" ? "text-green-600" : "text-red-600"}>{totals.result}</strong>
                  {totals.anySubjectFail && <span className="text-xs text-red-500 ml-1">(subject fail)</span>}
                </span>
              </div>

              {!readOnly && isCurrentAttempt && (
                <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Marks"}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={requestModalOpen} onOpenChange={setRequestModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Changes — {requestTarget?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase">Reason (required)</Label>
              <Textarea
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                rows={4}
                placeholder="Explain why marks need to be changed..."
              />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setRequestModalOpen(false)}>Cancel</Button>
              <Button onClick={submitChangeRequest} disabled={submitting || !requestReason.trim()}>Submit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default CenterExamMarksEntryPage;
