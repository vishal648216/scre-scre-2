import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2, Pencil, Trash2, ClipboardList, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { BulkCsvUploadModal } from "@/components/BulkCsvUploadModal";
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
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

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
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16 relative">
        {/* Ambient background glows */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />

        {/* Page Header Banner */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <ClipboardList className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-heading font-black text-2xl md:text-3xl text-white uppercase tracking-tight">
                  Mock Tests
                </h1>
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                  {rows.length} Tests
                </span>
              </div>
              <p className="text-slate-400 mt-1 text-xs md:text-sm font-medium max-w-2xl">
                Create named practice exams mapped to course curriculum subjects and blueprints for student evaluations.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              className="px-5 py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg hover:border-indigo-500/40"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Bulk Import
            </button>
            <button
              type="button"
              onClick={() => {
                openCreate();
                setOpen(true);
              }}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all transform active:scale-95"
            >
              <Plus className="w-4 h-4" /> New Mock Test
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
          <DialogContent className="rounded-3xl border border-indigo-500/30 bg-slate-950/95 backdrop-blur-3xl text-slate-100 shadow-2xl p-6 sm:p-8 max-w-lg">
            <DialogHeader className="border-b border-slate-800/80 pb-4">
              <DialogTitle className="font-heading font-black text-xl text-white uppercase tracking-tight flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-400" />
                {editing ? "Edit Mock Test" : "Create Mock Test"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Blueprint must belong to the selected course. Ensure question banks exist for blueprint rules.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Display Name *</label>
                <input
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                  placeholder="e.g. MS Word Practice Mock"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Course *</label>
                <select
                  required
                  value={formCourse}
                  onChange={(e) => setFormCourse(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
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
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Subject (from curriculum) *</label>
                <select
                  required
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  disabled={!formCourse || subjectsForCourse.length === 0}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
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
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Exam Blueprint *</label>
                <select
                  required
                  value={formBlueprint}
                  onChange={(e) => setFormBlueprint(e.target.value)}
                  disabled={!formCourse || blueprintsForCourse.length === 0}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
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
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <DialogFooter className="pt-4 border-t border-slate-800/80">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {editing ? "Save Changes" : "Create Test"}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Mock Tests...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl p-16 flex flex-col items-center text-center">
            <ClipboardList className="w-12 h-12 text-slate-600 mb-4 opacity-40" />
            <h3 className="text-lg font-bold text-white uppercase tracking-tight">No Mock Tests Found</h3>
            <p className="text-slate-400 text-xs max-w-sm mt-1 mb-6">
              No mock tests defined yet. Click "New mock test" and ensure mock tests are enabled for your courses.
            </p>
            <button
              type="button"
              onClick={() => {
                openCreate();
                setOpen(true);
              }}
              className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create First Mock Test
            </button>
          </div>
        ) : (
          <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
              <h3 className="font-heading font-black text-sm text-white uppercase tracking-tight">All Mock Test Mappings ({rows.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-950/90 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="text-left p-4 pl-6">Test Name</th>
                    <th className="text-left p-4">Course</th>
                    <th className="text-left p-4">Subject</th>
                    <th className="text-left p-4">Blueprint</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-right p-4 pr-6">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-200 font-semibold">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 pl-6 font-bold text-white uppercase tracking-tight">{r.name}</td>
                      <td className="p-4 text-slate-300 uppercase">{courseName(r.course_id)}</td>
                      <td className="p-4 text-slate-300 uppercase">{subjectName(r.subject_id)}</td>
                      <td className="p-4 text-indigo-400 font-mono">{blueprintName(r.blueprint_id)}</td>
                      <td className="p-4">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 w-fit border backdrop-blur-md",
                          r.status === "active"
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                        )}>
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            r.status === "active" ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                          )} />
                          {r.status}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-indigo-600/20 hover:text-indigo-300 border border-slate-700/60 text-indigo-400 font-bold text-[11px] uppercase tracking-wider transition-all"
                        >
                          <Pencil className="w-3 h-3 inline mr-1" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(r.id)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600/20 hover:text-rose-400 border border-slate-700/60 text-rose-400 font-bold text-[11px] uppercase tracking-wider transition-all"
                        >
                          <Trash2 className="w-3 h-3 inline mr-1" /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <BulkCsvUploadModal
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          title="Bulk Import Mock Tests"
          description="Upload multiple mock test definitions using a CSV file."
          uploadEndpoint="/api/exam/mock-tests/bulk"
          sampleFilename="mock_tests_template.csv"
          onSuccess={loadAll}
          columns={[
            { key: "name", label: "Mock Test Name", required: true },
            { key: "course_id", label: "Course ID", required: true },
            { key: "subject_id", label: "Subject ID", required: true },
            { key: "blueprint_id", label: "Blueprint ID", required: true },
            { key: "status", label: "Status (active/inactive)" },
          ]}
          sampleData={[
            {
              name: "MS Office Midterm Mock",
              course_id: courses[0]?.id || "",
              subject_id: subjects[0]?.id || "",
              blueprint_id: blueprints[0]?._id || "",
              status: "active",
            },
          ]}
        />
      </div>
    </DashboardLayout>
  );
};

export default AdminMockTestsPage;
