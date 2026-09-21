import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { postV2GeneratePaper } from "@/lib/examV2Api";
import { toast } from "sonner";
import { Loader2, FileDown, GraduationCap, Layers, FileQuestion, Award, CheckCircle2, Clock, Trash2, Zap } from "lucide-react";

const AdminExamV2Hub = () => {
  const [loading, setLoading] = useState(true);
  const [paperTemplates, setPaperTemplates] = useState<unknown[]>([]);
  const [exams, setExams] = useState<unknown[]>([]);
  const [marksheets, setMarksheets] = useState<{ _id: string; exam_id: string; status: string; pdf_path?: string }[]>([]);
  const [eligibleStudents, setEligibleStudents] = useState<any[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [scheduleTime, setScheduleTime] = useState("");
  const [msTemplateId, setMsTemplateId] = useState("");
  const [simulating, setSimulating] = useState(false);

  const [paperTplForm, setPaperTplForm] = useState({
    name: "",
    question_bank_id: "",
    subject_id: "",
    total_marks: 100,
    passing_marks: 35,
    duration_minutes: 60,
    max_attempts: 1,
    instructions: "",
    sections: [{ name: "Section 1", marks: 1, count: 10, negative_marks: 0 }],
    practical_enabled: false,
    practical_marks: 0,
    assignment_enabled: false,
    assignment_marks: 0,
    exam_marks: 100,
  });

  const [examForm, setExamForm] = useState({
    name: "",
    course_id: "",
    session_id: "",
    paper_id: "",
    exam_mode: "online",
    result_mode: "instant",
    start_at: "",
    end_at: "",
    attendance_date: "",
    require_attendance: true,
  });

  const [courses, setCourses] = useState<{ id: string; course_name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; subject_name: string }[]>([]);
  const [sessions, setSessions] = useState<{ id: string; session_name: string; status: string }[]>([]);

  const refresh = async () => {
    setLoading(true);
    try {
      const [t, e, m, c, s, sess, el, tpls] = await Promise.all([
        apiFetch("/api/exam-v2/paper-templates"),
        apiFetch("/api/exam-v2/exams"),
        apiFetch("/api/exam-v2/marksheets"),
        apiFetch("/api/courses"),
        apiFetch("/api/admin/subjects"),
        apiFetch("/api/academic/sessions"),
        apiFetch("/api/admin/marksheets/eligible"),
        apiFetch("/api/templates"),
      ]);
      if (t.ok) setPaperTemplates(await t.json());
      if (e.ok) setExams(await e.json());
      if (m.ok) setMarksheets(await m.json());
      if (c.ok) setCourses(await c.json());
      if (s.ok) {
        const sj = await s.json();
        setSubjects(sj.items || []);
      }
      if (sess.ok) setSessions(await sess.json());
      if (el.ok) setEligibleStudents(await el.json());
      if (tpls.ok) {
          const allTpls = await tpls.json();
          const msTpl = allTpls.find((t: any) => t.template_type === "marksheet");
          if (msTpl) setMsTemplateId(msTpl._id || msTpl.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const approveAndSchedule = async () => {
    if (selectedStudents.length === 0 || !scheduleTime || !msTemplateId) {
        toast.error("Select students, a template, and a schedule time");
        return;
    }
    try {
        const res = await apiFetch("/api/admin/marksheets/approve-schedule", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                student_ids: selectedStudents,
                template_id: msTemplateId,
                scheduled_at: new Date(scheduleTime).toISOString(),
            }),
        });
        if (res.ok) {
            toast.success("Marksheets scheduled successfully");
            setSelectedStudents([]);
            refresh();
        } else {
            const err = await res.json().catch(() => ({}));
            toast.error((err as { message?: string }).message || "Failed");
        }
    } catch {
        toast.error("Network error");
    }
  };

  const runSimulation = async () => {
      if (!window.confirm("This will REMOVE all existing students and simulate a new exam flow. Continue?")) return;
      setSimulating(true);
      try {
          const res = await apiFetch("/api/admin/maintenance/simulate-exam-flow", { method: "POST" });
          const data = await res.json();
          if (res.ok) {
              toast.success(data.message);
              refresh();
          } else {
              toast.error(data.message || "Simulation failed");
          }
      } catch {
          toast.error("Simulation request failed");
      } finally {
          setSimulating(false);
      }
  };

  useEffect(() => {
    refresh();
  }, []);

  const [msExam, setMsExam] = useState("");
  const [msStudent, setMsStudent] = useState("");
  const [zipExam, setZipExam] = useState("");
  const [genExamId, setGenExamId] = useState("");
  const [genStudentId, setGenStudentId] = useState("");
  const [genCenterId, setGenCenterId] = useState("");
  const [genBusy, setGenBusy] = useState(false);

  const createPaperTemplate = async () => {
    try {
      const res = await apiFetch("/api/exam-v2/paper-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paperTplForm),
      });
      if (res.ok) {
        toast.success("Paper template saved");
        refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error((err as { message?: string }).message || "Failed");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const addSection = () => {
    setPaperTplForm(prev => ({
      ...prev,
      sections: [...prev.sections, { name: `Section ${prev.sections.length + 1}`, marks: 1, count: 10, negative_marks: 0 }]
    }));
  };

  const removeSection = (idx: number) => {
    setPaperTplForm(prev => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== idx)
    }));
  };

  const updateSection = (idx: number, field: string, value: any) => {
    setPaperTplForm(prev => {
      const next = [...prev.sections];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, sections: next };
    });
  };

  const runMigrate = async () => {
    const res = await apiFetch("/api/exam-v2/migrate", { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (res.ok) toast.success((j as { message?: string }).message || "Migration completed");
    else toast.error((j as { message?: string }).message || "Migration failed");
    refresh();
  };

  const createExam = async () => {
    const start = new Date(examForm.start_at).toISOString();
    const end = new Date(examForm.end_at).toISOString();
    const att = new Date(examForm.attendance_date || examForm.start_at).toISOString();
    const res = await apiFetch("/api/exam-v2/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: examForm.name,
        course_id: examForm.course_id,
        session_id: examForm.session_id,
        paper_id: examForm.paper_id,
        center_ids: [],
        exam_mode: examForm.exam_mode,
        result_mode: examForm.result_mode,
        start_at: start,
        end_at: end,
        lock_ui_at: null,
        attendance_date: att,
        require_attendance: examForm.require_attendance,
        status: "scheduled",
      }),
    });
    if (res.ok) {
      toast.success("Exam created");
      refresh();
    } else toast.error("Failed — check ObjectId hex strings and datetime fields");
  };

  const genMarksheet = async () => {
    const res = await apiFetch("/api/exam-v2/marksheets/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exam_id: msExam, student_id: msStudent }),
    });
    if (res.ok) {
      toast.success("Marksheet row created — render PDF next");
      refresh();
    } else toast.error("Failed");
  };

  const renderPdf = async (id: string) => {
    const res = await apiFetch(`/api/exam-v2/marksheets/render-pdf/${id}`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (res.ok) toast.success((j as { message?: string }).message || "PDF ready");
    else toast.error((j as { message?: string }).message || "PDF failed");
    refresh();
  };

  const generateStudentPaper = async () => {
    if (!genExamId.trim() || !genStudentId.trim() || !genCenterId.trim()) {
      toast.error("Enter exam ID, student ID, and center ID");
      return;
    }
    setGenBusy(true);
    try {
      const res = await postV2GeneratePaper({
        exam_id: genExamId.trim(),
        student_id: genStudentId.trim(),
        center_id: genCenterId.trim(),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success((j as { message?: string }).message || "Paper generated");
        refresh();
      } else {
        toast.error((j as { message?: string }).message || "Failed");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setGenBusy(false);
    }
  };

  const downloadZip = async () => {
    if (!zipExam) return;
    const res = await apiFetch(`/api/exam-v2/marksheets/bulk-zip?exam_id=${encodeURIComponent(zipExam)}`);
    if (!res.ok) {
      toast.error("ZIP failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marksheets-${zipExam}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout role="Admin">
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-5xl mx-auto px-4 py-8 md:py-10 space-y-8">
          <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white p-6 md:p-8 shadow-xl shadow-indigo-900/10">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/15 border border-white/20">
                <GraduationCap className="h-8 w-8" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-200">Admin · Exam Engine V2</p>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-1">Paper templates, exams & marksheets</h1>
                <p className="text-sm text-indigo-100/90 mt-2 max-w-2xl leading-relaxed">
                  Architecture: question bank → paper template (sections: marks × count) → scheduled exam → attempt. Enable{" "}
                  <code className="rounded bg-black/20 px-1">VITE_USE_EXAM_V2=true</code> for student cutover.
                </p>
              </div>
            </div>
          </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin w-10 h-10 text-indigo-600" />
          </div>
        ) : (
          <Tabs defaultValue="bp" className="space-y-6">
            <TabsList className="flex flex-wrap h-auto gap-2 p-1.5 bg-slate-100/80 rounded-xl border border-slate-200">
              <TabsTrigger value="bp" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2">
                <Layers className="w-4 h-4" /> Paper templates
              </TabsTrigger>
              <TabsTrigger value="ex" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2">
                <GraduationCap className="w-4 h-4" /> Exams
              </TabsTrigger>
              <TabsTrigger value="ms" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2">
                <Award className="w-4 h-4" /> Marksheets
              </TabsTrigger>
              <TabsTrigger value="approve" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2">
                <CheckCircle2 className="w-4 h-4" /> Approve Marksheets
              </TabsTrigger>
            </TabsList>

            <TabsContent value="approve" className="space-y-4 focus-visible:outline-none">
              <Card className="rounded-2xl border-slate-200 shadow-md">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Approve & Schedule Marksheets</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">Select students who have completed all subject exams.</p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={runSimulation} disabled={simulating} className="gap-2">
                    {simulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    Simulate Exam Flow
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="space-y-2">
                      <Label>Schedule Generation Time</Label>
                      <Input type="datetime-local" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                    </div>
                    <Button onClick={approveAndSchedule} className="bg-indigo-600 hover:bg-indigo-700 h-10 gap-2">
                      <Clock className="w-4 h-4" /> Approve & Schedule for {selectedStudents.length} Students
                    </Button>
                  </div>

                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="p-3 text-left w-10">
                            <input 
                              type="checkbox" 
                              checked={selectedStudents.length === eligibleStudents.length && eligibleStudents.length > 0} 
                              onChange={(e) => {
                                if (e.target.checked) setSelectedStudents(eligibleStudents.map(s => s.student_id));
                                else setSelectedStudents([]);
                              }}
                            />
                          </th>
                          <th className="p-3 text-left font-bold">Student Name</th>
                          <th className="p-3 text-left font-bold">Registration No</th>
                          <th className="p-3 text-left font-bold">Course</th>
                          <th className="p-3 text-left font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {eligibleStudents.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-muted-foreground italic">No students eligible for marksheet approval.</td>
                          </tr>
                        ) : (
                          eligibleStudents.map((s) => (
                            <tr key={s.student_id} className="hover:bg-slate-50/50">
                              <td className="p-3">
                                <input 
                                  type="checkbox" 
                                  checked={selectedStudents.includes(s.student_id)} 
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedStudents([...selectedStudents, s.student_id]);
                                    else setSelectedStudents(selectedStudents.filter(id => id !== s.student_id));
                                  }}
                                />
                              </td>
                              <td className="p-3 font-medium">{s.student_name}</td>
                              <td className="p-3 font-mono text-xs">{s.registration_number}</td>
                              <td className="p-3">{s.course}</td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">Ready</span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bp" className="space-y-4 focus-visible:outline-none">
              <Card className="rounded-2xl border-slate-200 shadow-md overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
                <CardHeader>
                  <CardTitle className="text-lg">Create paper template</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Template name</Label>
                      <Input value={paperTplForm.name} onChange={(e) => setPaperTplForm({ ...paperTplForm, name: e.target.value })} placeholder="e.g. Final Exam Paper" />
                    </div>
                    <div className="space-y-2">
                      <Label>Question Bank (REMOVED)</Label>
                      <div className="h-10 border border-border rounded-md bg-muted/50 flex items-center px-3 text-xs italic text-muted-foreground">
                        Reconstruction in progress
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Subject</Label>
                      <Select value={paperTplForm.subject_id} onValueChange={(val) => setPaperTplForm({ ...paperTplForm, subject_id: val })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjects.map((sub: any) => (
                            <SelectItem key={sub.id} value={sub.id}>{sub.subject_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Total Marks (Validation Sum)</Label>
                      <Input type="number" value={paperTplForm.total_marks} onChange={(e) => setPaperTplForm({ ...paperTplForm, total_marks: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Passing Marks</Label>
                      <Input type="number" value={paperTplForm.passing_marks} onChange={(e) => setPaperTplForm({ ...paperTplForm, passing_marks: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Duration (min)</Label>
                      <Input type="number" value={paperTplForm.duration_minutes} onChange={(e) => setPaperTplForm({ ...paperTplForm, duration_minutes: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Max attempts</Label>
                      <Input type="number" value={paperTplForm.max_attempts} onChange={(e) => setPaperTplForm({ ...paperTplForm, max_attempts: parseInt(e.target.value) || 1 })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label>Exam Marks (Theory)</Label>
                      <Input type="number" value={paperTplForm.exam_marks} onChange={(e) => setPaperTplForm({ ...paperTplForm, exam_marks: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Label>Practical</Label>
                        <input type="checkbox" checked={paperTplForm.practical_enabled} onChange={(e) => setPaperTplForm({ ...paperTplForm, practical_enabled: e.target.checked })} />
                      </div>
                      <Input type="number" disabled={!paperTplForm.practical_enabled} value={paperTplForm.practical_marks} onChange={(e) => setPaperTplForm({ ...paperTplForm, practical_marks: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Label>Assignment</Label>
                        <input type="checkbox" checked={paperTplForm.assignment_enabled} onChange={(e) => setPaperTplForm({ ...paperTplForm, assignment_enabled: e.target.checked })} />
                      </div>
                      <Input type="number" disabled={!paperTplForm.assignment_enabled} value={paperTplForm.assignment_marks} onChange={(e) => setPaperTplForm({ ...paperTplForm, assignment_marks: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-t pt-4">
                      <h4 className="text-sm font-bold uppercase tracking-widest">Sections</h4>
                      <Button type="button" variant="outline" size="sm" onClick={addSection}>Add Section</Button>
                    </div>
                    {paperTplForm.sections.map((sec, idx) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl relative">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold">Name</Label>
                          <Input value={sec.name} onChange={(e) => updateSection(idx, "name", e.target.value)} className="h-8" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold">Marks/Q</Label>
                          <Input type="number" value={sec.marks} onChange={(e) => updateSection(idx, "marks", parseFloat(e.target.value) || 0)} className="h-8" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold">Count</Label>
                          <Input type="number" value={sec.count} onChange={(e) => updateSection(idx, "count", parseInt(e.target.value) || 0)} className="h-8" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold">Neg Marks</Label>
                          <Input type="number" value={sec.negative_marks} onChange={(e) => updateSection(idx, "negative_marks", parseFloat(e.target.value) || 0)} className="h-8" />
                        </div>
                        <div className="flex items-end justify-end">
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeSection(idx)} className="text-red-500 h-8">Remove</Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label>Instructions</Label>
                    <Textarea value={paperTplForm.instructions} onChange={(e) => setPaperTplForm({ ...paperTplForm, instructions: e.target.value })} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={createPaperTemplate} className="rounded-xl font-semibold">
                      Save paper template
                    </Button>
                    <Button type="button" variant="outline" onClick={runMigrate} className="rounded-xl font-semibold">
                      Run legacy migration
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Paper templates ({paperTemplates.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs overflow-auto max-h-56 rounded-xl bg-slate-50 border border-slate-100 p-4">{JSON.stringify(paperTemplates, null, 2)}</pre>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ex" className="space-y-4 focus-visible:outline-none">
              <Card className="rounded-2xl border-slate-200 shadow-md overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
                <CardHeader>
                  <CardTitle className="text-lg">Schedule exam</CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Name</Label>
                    <Input value={examForm.name} onChange={(e) => setExamForm((s) => ({ ...s, name: e.target.value }))} className="rounded-xl" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Select Course</Label>
                      <Select value={examForm.course_id} onValueChange={v => setExamForm(s => ({ ...s, course_id: v }))}>
                        <SelectTrigger className="rounded-xl"><SelectValue placeholder="Course..." /></SelectTrigger>
                        <SelectContent>
                          {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.course_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Select Academic Session</Label>
                      <Select value={examForm.session_id} onValueChange={v => setExamForm(s => ({ ...s, session_id: v }))}>
                        <SelectTrigger className="rounded-xl"><SelectValue placeholder="Session..." /></SelectTrigger>
                        <SelectContent>
                          {sessions.map(s => <SelectItem key={s.id} value={s.id}>{s.session_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Paper template ID</Label>
                    <Input
                      value={examForm.paper_id}
                      onChange={(e) => setExamForm((s) => ({ ...s, paper_id: e.target.value }))}
                      className="rounded-xl"
                      placeholder="exam_v2_paper_templates _id"
                    />
                  </div>
                  <div>
                    <Label>Mode</Label>
                    <Input
                      value={examForm.exam_mode}
                      onChange={(e) => setExamForm((s) => ({ ...s, exam_mode: e.target.value }))}
                      className="rounded-xl"
                    />
                  </div>
                  <div>
                    <Label>Result</Label>
                    <Input
                      value={examForm.result_mode}
                      onChange={(e) => setExamForm((s) => ({ ...s, result_mode: e.target.value }))}
                      className="rounded-xl"
                    />
                  </div>
                  <div>
                    <Label>Start (local)</Label>
                    <Input type="datetime-local" value={examForm.start_at} onChange={(e) => setExamForm((s) => ({ ...s, start_at: e.target.value }))} className="rounded-xl" />
                  </div>
                  <div>
                    <Label>End (local)</Label>
                    <Input type="datetime-local" value={examForm.end_at} onChange={(e) => setExamForm((s) => ({ ...s, end_at: e.target.value }))} className="rounded-xl" />
                  </div>
                  <div>
                    <Label>Attendance date</Label>
                    <Input type="datetime-local" value={examForm.attendance_date} onChange={(e) => setExamForm((s) => ({ ...s, attendance_date: e.target.value }))} className="rounded-xl" />
                  </div>
                  <div className="flex items-center gap-2 mt-6">
                    <input
                      type="checkbox"
                      checked={examForm.require_attendance}
                      onChange={(e) => setExamForm((s) => ({ ...s, require_attendance: e.target.checked }))}
                    />
                    <Label>Require attendance</Label>
                  </div>
                  <Button onClick={createExam} className="rounded-xl md:col-span-2 font-semibold">
                    Create exam
                  </Button>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-slate-200 border-dashed">
                <CardHeader>
                  <CardTitle className="text-base">Generate student paper (admin)</CardTitle>
                  <p className="text-xs text-muted-foreground font-normal">
                    After scheduling, create the attempt record so the student sees the exam. Centers can do the same from Center → Exam V2.
                  </p>
                </CardHeader>
                <CardContent className="grid md:grid-cols-4 gap-3 items-end">
                  <div>
                    <Label>Exam ID</Label>
                    <Input value={genExamId} onChange={(e) => setGenExamId(e.target.value)} className="rounded-xl font-mono text-xs" />
                  </div>
                  <div>
                    <Label>Student ID</Label>
                    <Input value={genStudentId} onChange={(e) => setGenStudentId(e.target.value)} className="rounded-xl font-mono text-xs" />
                  </div>
                  <div>
                    <Label>Center ID</Label>
                    <Input value={genCenterId} onChange={(e) => setGenCenterId(e.target.value)} className="rounded-xl font-mono text-xs" />
                  </div>
                  <Button type="button" variant="secondary" onClick={generateStudentPaper} disabled={genBusy} className="rounded-xl">
                    {genBusy ? "…" : "Generate paper"}
                  </Button>
                </CardContent>
              </Card>
              <pre className="text-xs overflow-auto max-h-48 rounded-xl border border-slate-200 bg-slate-50 p-4">{JSON.stringify(exams, null, 2)}</pre>
            </TabsContent>

            <TabsContent value="ms" className="space-y-4 focus-visible:outline-none">
              <Card className="rounded-2xl border-slate-200 shadow-md overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500" />
                <CardHeader>
                  <CardTitle className="text-lg">Generate & PDF</CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Exam ID</Label>
                    <Input value={msExam} onChange={(e) => setMsExam(e.target.value)} className="rounded-xl" />
                  </div>
                  <div>
                    <Label>Student ID</Label>
                    <Input value={msStudent} onChange={(e) => setMsStudent(e.target.value)} className="rounded-xl" />
                  </div>
                  <Button onClick={genMarksheet} className="rounded-xl md:col-span-2 font-semibold">
                    Create marksheet row
                  </Button>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Bulk ZIP</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-2">
                  <Input value={zipExam} onChange={(e) => setZipExam(e.target.value)} placeholder="exam_id" className="rounded-xl flex-1" />
                  <Button variant="outline" onClick={downloadZip} className="rounded-xl shrink-0">
                    <FileDown className="w-4 h-4 mr-2" /> Download ZIP
                  </Button>
                </CardContent>
              </Card>
              <div className="space-y-2">
                {marksheets.map((m) => (
                  <div key={String(m._id)} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
                    <span className="font-mono text-xs">{String(m._id)}</span>
                    <span className="text-xs font-semibold text-slate-600">{m.status}</span>
                    <Button size="sm" variant="secondary" className="rounded-lg" onClick={() => renderPdf(String(m._id))}>
                      Render PDF
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminExamV2Hub;
