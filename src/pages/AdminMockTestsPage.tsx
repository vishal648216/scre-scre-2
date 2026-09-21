import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2, Pencil, Trash2, ClipboardList, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface MockRow {
  id: string;
  name: string;
  course_id: string;
  subject_id: string;
  blueprint_id: string;
  status: string;
  created_at: string;
}

interface Course {
  id: string;
  course_name: string;
}

interface Subject {
  id: string;
  subject_name: string;
}

interface Mapping {
  subject_id: string;
  subject_order: number;
}

interface Blueprint {
  _id: string;
  name: string;
  course_id: string;
}

const AdminMockTestsPage = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MockRow[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MockRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [formCourse, setFormCourse] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formBlueprint, setFormBlueprint] = useState("");
  const [formName, setFormName] = useState("");
  const [formStatus, setFormStatus] = useState("active");

  const loadAll = async () => {
    setLoading(true);
    try {
      const [mtRes, cRes, sRes, bpRes] = await Promise.all([
        apiFetch("/api/exam/mock-tests"),
        apiFetch("/api/courses"),
        apiFetch("/api/admin/subjects"),
        apiFetch("/api/exam/blueprints"),
      ]);
      if (mtRes.ok) setRows(await mtRes.json());
      if (cRes.ok) setCourses(await cRes.json());
      if (sRes.ok) {
        const d = await sRes.json();
        setSubjects(d.items || []);
      }
      if (bpRes.ok) setBlueprints(await bpRes.json());
    } catch {
      toast.error("Failed to load mock tests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (!formCourse) {
      setMappings([]);
      setFormSubject("");
      setFormBlueprint("");
      return;
    }
    void (async () => {
      const res = await apiFetch(`/api/academic/course-subjects/${formCourse}`);
      if (res.ok) {
        const data: Mapping[] = await res.json();
        setMappings(data.sort((a, b) => a.subject_order - b.subject_order));
      } else {
        setMappings([]);
      }
      setFormSubject("");
      setFormBlueprint("");
    })();
  }, [formCourse]);

  const subjectsForCourse = useMemo(() => {
    const ids = new Set(mappings.map((m) => m.subject_id));
    return subjects.filter((s) => ids.has(s.id));
  }, [mappings, subjects]);

  const blueprintsForCourse = useMemo(
    () => blueprints.filter((b) => b.course_id === formCourse),
    [blueprints, formCourse],
  );

  const openCreate = () => {
    setEditing(null);
    setFormCourse("");
    setFormSubject("");
    setFormBlueprint("");
    setFormName("");
    setFormStatus("active");
    setOpen(true);
  };

  const openEdit = (r: MockRow) => {
    setEditing(r);
    setFormCourse(r.course_id);
    setFormSubject(r.subject_id);
    setFormBlueprint(r.blueprint_id);
    setFormName(r.name);
    setFormStatus(r.status);
    setOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCourse || !formSubject || !formBlueprint || !formName.trim()) {
      toast.error("Fill course, subject, blueprint, and name");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const res = await apiFetch(`/api/exam/mock-tests/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            course_id: formCourse,
            subject_id: formSubject,
            blueprint_id: formBlueprint,
            status: formStatus,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          toast.success("Mock test updated");
          setOpen(false);
          loadAll();
        } else {
          toast.error((data as { message?: string }).message || "Update failed");
        }
      } else {
        const res = await apiFetch("/api/exam/mock-tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            course_id: formCourse,
            subject_id: formSubject,
            blueprint_id: formBlueprint,
            status: formStatus,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          toast.success("Mock test created");
          setOpen(false);
          loadAll();
        } else {
          toast.error((data as { message?: string }).message || "Create failed");
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this mock test mapping?")) return;
    const res = await apiFetch(`/api/exam/mock-tests/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success("Deleted");
      loadAll();
    } else {
      toast.error((data as { message?: string }).message || "Delete failed");
    }
  };

  const courseName = (id: string) => courses.find((c) => c.id === id)?.course_name || id;
  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.subject_name || id;
  const blueprintName = (id: string) => blueprints.find((b) => b._id === id)?.name || id;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight flex items-center gap-2">
              <ClipboardList className="w-8 h-8 text-primary" />
              Mock tests
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium max-w-2xl">
              Create named practice exams and map each to a <strong>course</strong> and <strong>subject</strong>. Students see a test only if that subject is on their course
              curriculum, the course has mock tests enabled, and the center’s mock-test window is active.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2">
            <button
              type="button"
              onClick={() => {
                openCreate();
                setOpen(true);
              }}
              className="bg-primary text-primary-foreground px-6 py-3 rounded-none font-heading font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:opacity-90 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> New mock test
            </button>
          </div>
        </div>

        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setEditing(null);
          }}
        >
          <DialogContent className="rounded-none border-border max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-heading font-bold uppercase tracking-tight">
                  {editing ? "Edit mock test" : "Create mock test"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Blueprint must belong to the same course. Add questions in the question bank for the blueprint’s rules first.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Display name</Label>
                  <input
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full border border-border bg-background px-4 py-3 text-sm"
                    placeholder="e.g. MS Word practice mock"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course</Label>
                  <select
                    required
                    value={formCourse}
                    onChange={(e) => setFormCourse(e.target.value)}
                    className="w-full border border-border bg-background px-4 py-3 text-sm"
                  >
                    <option value="">Select course</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.course_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subject (from curriculum)</Label>
                  <select
                    required
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    disabled={!formCourse || subjectsForCourse.length === 0}
                    className="w-full border border-border bg-background px-4 py-3 text-sm"
                  >
                    <option value="">
                      {!formCourse ? "Select a course first" : subjectsForCourse.length === 0 ? "Map subjects to course first" : "Select subject"}
                    </option>
                    {subjectsForCourse.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.subject_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Exam blueprint (v1)</Label>
                  <select
                    required
                    value={formBlueprint}
                    onChange={(e) => setFormBlueprint(e.target.value)}
                    disabled={!formCourse || blueprintsForCourse.length === 0}
                    className="w-full border border-border bg-background px-4 py-3 text-sm"
                  >
                    <option value="">
                      {!formCourse ? "Select a course first" : blueprintsForCourse.length === 0 ? "No blueprints for this course" : "Select blueprint"}
                    </option>
                    {blueprintsForCourse.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</Label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full border border-border bg-background px-4 py-3 text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <DialogFooter className="pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-primary text-primary-foreground py-4 font-heading font-black text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {editing ? "Save changes" : "Create"}
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
        </Dialog>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <Card className="rounded-none border-dashed border-2 border-border">
            <CardContent className="py-16 text-center text-muted-foreground text-sm">
              No mock tests yet. Create one and ensure the course has <strong>Mock tests</strong> turned on under Courses.
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-none border-border overflow-hidden">
            <CardHeader className="border-b bg-muted/30 py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-tight">All mappings</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <th className="text-left p-4">Name</th>
                      <th className="text-left p-4">Course</th>
                      <th className="text-left p-4">Subject</th>
                      <th className="text-left p-4">Blueprint</th>
                      <th className="text-left p-4">Status</th>
                      <th className="text-right p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-border hover:bg-muted/20">
                        <td className="p-4 font-bold">{r.name}</td>
                        <td className="p-4">{courseName(r.course_id)}</td>
                        <td className="p-4">{subjectName(r.subject_id)}</td>
                        <td className="p-4 text-muted-foreground">{blueprintName(r.blueprint_id)}</td>
                        <td className="p-4">
                          <span
                            className={
                              r.status === "active"
                                ? "text-[10px] font-black uppercase text-emerald-600"
                                : "text-[10px] font-black uppercase text-muted-foreground"
                            }
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => openEdit(r)}
                            className="inline-flex items-center gap-1 text-primary text-[10px] font-black uppercase"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(r.id)}
                            className="inline-flex items-center gap-1 text-destructive text-[10px] font-black uppercase"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminMockTestsPage;
