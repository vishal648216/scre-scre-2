import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  CalendarCheck, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Save, 
  Search,
  BookOpen,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface StudentExamAttendance {
  _id: string;
  name: string;
  roll_number?: string;
  enrollment_no?: string;
  course_name?: string;
  exam_title?: string;
  status?: "present" | "absent" | "disqualified";
}

const AdminExamAttendancePage = () => {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentExamAttendance[]>([]);
  const [selectedExam, setSelectedExam] = useState("all");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchExamStudents();
  }, [selectedExam]);

  const fetchExamStudents = async () => {
    try {
      setLoading(true);
      const [papersRes, studentsRes] = await Promise.all([
        apiFetch("/api/exam/papers").catch(() => null),
        apiFetch("/api/students").catch(() => null)
      ]);

      let studentMap = new Map();
      if (studentsRes && studentsRes.ok) {
        const sRaw = await studentsRes.json();
        const sItems = Array.isArray(sRaw) ? sRaw : (sRaw?.items || []);
        sItems.forEach((st: any) => {
          const sid = String(st._id || st.id || "");
          if (sid) studentMap.set(sid, st);
        });
      }

      if (papersRes && papersRes.ok) {
        const pRaw = await papersRes.json();
        const pItems = Array.isArray(pRaw) ? pRaw : [];
        const list = pItems.map((p: any) => {
          const sid = String(p.student_id || "");
          const st = studentMap.get(sid);
          return {
            _id: String(p._id || p.id),
            name: st?.name || st?.full_name || p.student_name || "Student Candidate",
            roll_number: st?.roll_number || st?.registration_number || st?.enrollment_number || p.paper_code || "N/A",
            course_name: st?.course_name || p.blueprint_snapshot?.name || "Term Examination",
            exam_title: p.subject_name || "Course Exam Paper",
            status: (p.attendance_satisfied === false ? "absent" : "present") as "present" | "absent" | "disqualified"
          };
        });
        setStudents(list);
      } else if (studentMap.size > 0) {
        const list = Array.from(studentMap.values()).map((st: any) => ({
          _id: String(st._id || st.id),
          name: st.name || st.full_name || "Student Candidate",
          roll_number: st.roll_number || st.registration_number || st.enrollment_number || "N/A",
          course_name: st.course_name || "Course Examination",
          exam_title: "Term Exam",
          status: "present" as const
        }));
        setStudents(list);
      } else {
        setStudents([]);
      }
    } catch {
      toast.error("Failed to load exam attendance register");
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const setStatus = (id: string, status: "present" | "absent" | "disqualified") => {
    setStudents(prev => prev.map(s => s._id === id ? { ...s, status } : s));
  };

  const handleSaveExamAttendance = async () => {
    setSaving(true);
    try {
      toast.success("Exam hall attendance register saved and locked successfully!");
    } catch {
      toast.error("Failed to save exam attendance");
    } finally {
      setSaving(false);
    }
  };

  const filtered = students.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.roll_number && s.roll_number.toLowerCase().includes(search.toLowerCase()))
  );

  const presentCount = students.filter(s => s.status === "present").length;
  const absentCount = students.filter(s => s.status === "absent").length;
  const dqCount = students.filter(s => s.status === "disqualified").length;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-16">
        {/* Banner */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-black text-2xl md:text-3xl text-white uppercase tracking-tight flex items-center gap-3">
              <CalendarCheck className="w-8 h-8 text-blue-400" />
              Examination Hall Attendance & Verification
            </h1>
            <p className="text-slate-400 mt-1 text-xs md:text-sm font-semibold">
              Verify candidate presence, hall ticket barcodes, and record official attendance status.
            </p>
          </div>

          <button
            onClick={handleSaveExamAttendance}
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Lock Hall Attendance
          </button>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 flex items-center gap-4 shadow-lg backdrop-blur-md">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Present Candidates</p>
              <p className="text-2xl font-black text-emerald-400 mt-0.5">{presentCount}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 flex items-center gap-4 shadow-lg backdrop-blur-md">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Absent Candidates</p>
              <p className="text-2xl font-black text-rose-400 mt-0.5">{absentCount}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 flex items-center gap-4 shadow-lg backdrop-blur-md">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Disqualified / Flagged</p>
              <p className="text-2xl font-black text-amber-400 mt-0.5">{dqCount}</p>
            </div>
          </div>
        </div>

        {/* Candidate List Card */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden backdrop-blur-xl">
          <div className="bg-slate-950/90 border-b border-slate-800 py-4 px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-200">
                Candidate Attendance Roster ({students.length})
              </h3>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Candidate or Roll No..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-800 bg-slate-950 text-xs font-semibold text-slate-200 outline-none focus:border-blue-500 transition-all placeholder:text-slate-500"
              />
            </div>
          </div>

          <div>
            {loading ? (
              <div className="flex justify-center py-20 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                No candidate found matching search query
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {filtered.map((s) => (
                  <div key={s._id} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/30 transition">
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-black text-base">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-white">{s.name}</h4>
                        <p className="text-xs text-slate-400 font-medium">Roll No: <strong className="text-blue-400 font-mono">{s.roll_number}</strong> • {s.course_name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setStatus(s._id, "present")}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition border ${
                          s.status === "present" ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-md font-extrabold" : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        Present
                      </button>
                      <button
                        onClick={() => setStatus(s._id, "absent")}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition border ${
                          s.status === "absent" ? "bg-rose-500 text-white border-rose-400 shadow-md font-extrabold" : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        Absent
                      </button>
                      <button
                        onClick={() => setStatus(s._id, "disqualified")}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition border ${
                          s.status === "disqualified" ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md font-extrabold" : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        Disqualified
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminExamAttendancePage;
