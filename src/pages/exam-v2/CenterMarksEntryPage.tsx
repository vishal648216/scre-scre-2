import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, ClipboardCheck, User, BookOpen } from "lucide-react";

const CenterMarksEntryPage = () => {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  
  const [form, setForm] = useState({
    student_id: "",
    subject_id: "",
    session_id: "",
    marks_type: "practical",
    marks: 0,
    max_marks: 20,
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [st, su, se] = await Promise.all([
          apiFetch("/api/students"),
          apiFetch("/api/admin/subjects"),
          apiFetch("/api/academic/sessions"),
        ]);
        if (st.ok) setStudents(await st.json());
        if (su.ok) {
            const sj = await su.json();
            setSubjects(sj.items || []);
        }
        if (se.ok) setSessions(await se.json());
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.student_id || !form.subject_id || !form.session_id) return toast.error("Please fill all fields");
    
    setSaving(true);
    try {
      const res = await apiFetch("/api/exam-v2/marks/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success("Marks submitted for approval");
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error(j.message || "Failed");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout role="Center">
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl text-primary">
            <ClipboardCheck className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Internal Marks Entry</h1>
            <p className="text-sm text-muted-foreground">Submit Practical and Assignment marks for students.</p>
          </div>
        </div>

        <Card className="rounded-2xl border-border shadow-xl">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-sm font-black uppercase tracking-widest">Entry Form</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
            ) : (
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><User className="w-4 h-4" /> Select Student</Label>
                  <Select value={form.student_id} onValueChange={v => setForm({ ...form, student_id: v })}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Search student..." />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map(s => (
                        <SelectItem key={s._id} value={s._id}>{s.full_name} ({s.username})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> Select Subject</Label>
                  <Select value={form.subject_id} onValueChange={v => setForm({ ...form, subject_id: v })}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Subject..." />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.subject_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Academic Session</Label>
                  <Select value={form.session_id} onValueChange={v => setForm({ ...form, session_id: v })}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Session..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.session_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Marks Type</Label>
                  <Select value={form.marks_type} onValueChange={v => setForm({ ...form, marks_type: v })}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="practical">Practical</SelectItem>
                      <SelectItem value="assignment">Assignment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Obtained Marks</Label>
                  <Input 
                    type="number" 
                    value={form.marks} 
                    onChange={e => setForm({ ...form, marks: parseFloat(e.target.value) || 0 })}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Marks</Label>
                  <Input 
                    type="number" 
                    value={form.max_marks} 
                    onChange={e => setForm({ ...form, max_marks: parseFloat(e.target.value) || 0 })}
                    className="rounded-xl"
                  />
                </div>

                <div className="md:col-span-2 pt-4">
                  <Button type="submit" disabled={saving} className="w-full rounded-xl h-12 text-lg font-bold uppercase tracking-widest">
                    {saving ? <Loader2 className="animate-spin mr-2" /> : <ClipboardCheck className="mr-2" />}
                    Submit Marks
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CenterMarksEntryPage;
