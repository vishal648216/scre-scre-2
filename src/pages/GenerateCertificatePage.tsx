import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

const toId = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "$oid" in (v as Record<string, unknown>)) return (v as { $oid: string }).$oid;
  return String(v ?? "");
};

interface Student {
  _id?: { $oid?: string };
  full_name?: string;
  username?: string;
  course?: string;
}

interface Template {
  _id?: { $oid?: string };
  name: string;
  type: string;
}

interface SubjectRow {
  subject_name: string;
  max_marks: number;
  obtained_marks: number;
}

const GenerateMarksheetPage = () => {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [studentId, setStudentId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [subjects, setSubjects] = useState<SubjectRow[]>([
    { subject_name: "", max_marks: 100, obtained_marks: 0 },
  ]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [sRes, tRes] = await Promise.all([
          apiFetch("/api/students"),
          apiFetch("/api/attachments/templates?type=marksheet"),
        ]);
        const sData = await sRes.json();
        const tData = await tRes.json();
        if (Array.isArray(sData)) setStudents(sData);
        else if (sData.students) setStudents(sData.students);
        if (tData.success && tData.templates) setTemplates(tData.templates);
      } catch {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const addSubject = () => {
    setSubjects((p) => [...p, { subject_name: "", max_marks: 100, obtained_marks: 0 }]);
  };

  const removeSubject = (idx: number) => {
    setSubjects((p) => p.filter((_, i) => i !== idx));
  };

  const updateSubject = (idx: number, updates: Partial<SubjectRow>) => {
    setSubjects((p) => {
      const next = [...p];
      next[idx] = { ...next[idx], ...updates };
      return next;
    });
  };

  const handleGenerate = async () => {
    if (!studentId || !templateId) {
      toast.error("Select student and certificate");
      return;
    }
    const valid = subjects.filter((s) => s.subject_name.trim());
    if (valid.length === 0) {
      toast.error("Add at least one subject");
      return;
    }
    setGenerating(true);
    try {
      const res = await apiFetch("/api/attachments/generate/marksheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          template_id: templateId,
          subjects: valid,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "Generation failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "marksheet.pdf";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Marksheet downloaded");
    } catch {
      toast.error("Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">Generate Marksheet</h1>
        <Card>
          <CardHeader><CardTitle>Select Options</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Student</label>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2"
              >
                <option value="">Select student</option>
                {students.map((s) => (
                  <option key={toId(s._id)} value={toId(s._id)}>
                    {s.full_name || s.username} {s.course ? "(" + s.course + ")" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Template</label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2"
              >
                <option value="">Select template</option>
                {templates.map((t) => (
                  <option key={toId(t._id)} value={toId(t._id)}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Subjects</label>
                <Button type="button" variant="outline" size="sm" onClick={addSubject}>
                  <Plus className="w-3 h-3 mr-1" />Add
                </Button>
              </div>
              <div className="space-y-2 border rounded p-2">
                {subjects.map((s, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      placeholder="Subject"
                      value={s.subject_name}
                      onChange={(e) => updateSubject(i, { subject_name: e.target.value })}
                      className="flex-1 rounded border px-2 py-1 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={s.max_marks || ""}
                      onChange={(e) => updateSubject(i, { max_marks: Number(e.target.value) || 0 })}
                      className="w-16 rounded border px-2 py-1 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Obtained"
                      value={s.obtained_marks ?? ""}
                      onChange={(e) => updateSubject(i, { obtained_marks: Number(e.target.value) || 0 })}
                      className="w-20 rounded border px-2 py-1 text-sm"
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeSubject(i)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
              Generate and Download PDF
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default GenerateMarksheetPage;
