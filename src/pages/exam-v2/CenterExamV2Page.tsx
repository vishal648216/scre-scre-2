import { useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { postV2GeneratePaper } from "@/lib/examV2Api";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  ClipboardCheck,
  Upload,
  Users,
  Loader2,
  ExternalLink,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

const oid = (x: unknown) =>
  typeof x === "string" ? x : x && typeof x === "object" && "$oid" in (x as object) ? (x as { $oid: string }).$oid : "";

type PaperRow = {
  _id: string;
  status: string;
  exam_id: string;
  student_id: string;
  attempt_number: number;
};

type ExamRow = { _id: string; name: string; start_at?: string; end_at?: string };

const toUserId = (u: Record<string, unknown> | null): string => {
  if (!u) return "";
  const raw = u._id ?? u.id;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "$oid" in (raw as object)) return (raw as { $oid: string }).$oid;
  return "";
};

const CenterExamV2Page = () => {
  const [centerOid, setCenterOid] = useState(() => toUserId(JSON.parse(sessionStorage.getItem("user") || "{}")));
  const [genExamId, setGenExamId] = useState("");
  const [genStudentId, setGenStudentId] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const [paperId, setPaperId] = useState("");
  const [json, setJson] = useState(
    JSON.stringify(
      {
        responses: [{ question_id: "QUESTION_OID", response: "0" }],
        security_events: [],
      },
      null,
      2,
    ),
  );
  const [papers, setPapers] = useState<PaperRow[]>([]);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [pr, er] = await Promise.all([apiFetch("/api/exam-v2/papers"), apiFetch("/api/exam-v2/exams")]);
        if (!cancelled && pr.ok) setPapers(await pr.json());
        if (!cancelled && er.ok) setExams(await er.json());
      } catch {
        if (!cancelled) toast.error("Could not load exam data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const examName = useMemo(() => {
    const m = new Map<string, string>();
    exams.forEach((e) => m.set(oid(e._id), e.name));
    return (examId: string) => m.get(examId) || "—";
  }, [exams]);

  const generatePaper = async () => {
    const cid = centerOid.trim();
    if (!genExamId.trim() || !genStudentId.trim() || !cid) {
      toast.error("Enter exam ID, student ID, and ensure your center session is loaded");
      return;
    }
    setGenBusy(true);
    try {
      const res = await postV2GeneratePaper({
        exam_id: genExamId.trim(),
        student_id: genStudentId.trim(),
        center_id: cid,
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success((j as { message?: string }).message || "Paper generated — student will see it under My exams");
        const pr = await apiFetch("/api/exam-v2/papers");
        if (pr.ok) setPapers(await pr.json());
      } else {
        toast.error((j as { message?: string }).message || "Generation failed");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setGenBusy(false);
    }
  };

  const submitOffline = async () => {
    if (!paperId) return;
    try {
      const body = JSON.parse(json);
      const res = await apiFetch(`/api/exam-v2/offline/${paperId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) toast.success("Offline results uploaded");
      else toast.error("Upload failed");
    } catch {
      toast.error("Invalid JSON");
    }
  };

  const recent = useMemo(() => papers.slice(0, 12), [papers]);

  return (
    <DashboardLayout role="Center">
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-5xl mx-auto px-4 py-8 md:py-10 space-y-8">
          <header>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-indigo-600 mb-1">Center console</p>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Exam Engine V2</h1>
            <p className="text-slate-500 text-sm mt-2 max-w-2xl">
              Mark attendance before students start when your exam requires it. Upload offline bundles when the exam mode is offline.
            </p>
          </header>

          <Card className="border-indigo-200 shadow-md bg-indigo-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-slate-900">Issue exam paper to a student</CardTitle>
              <p className="text-sm text-slate-600 font-normal leading-relaxed mt-1">
                Required once per attempt: creates the immutable question snapshot. The student then sees the exam on{" "}
                <strong>My exams</strong> and can start within the exam window.
              </p>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div>
                <Label className="text-xs font-semibold text-slate-600">Your center ID (from session)</Label>
                <Input
                  value={centerOid}
                  onChange={(e) => setCenterOid(e.target.value)}
                  className="mt-1 rounded-xl font-mono text-xs"
                  placeholder="ObjectId hex"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600">Exam ID</Label>
                <Input
                  value={genExamId}
                  onChange={(e) => setGenExamId(e.target.value)}
                  className="mt-1 rounded-xl font-mono text-xs"
                  placeholder="exam_v2_exams._id"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600">Student ID</Label>
                <Input
                  value={genStudentId}
                  onChange={(e) => setGenStudentId(e.target.value)}
                  className="mt-1 rounded-xl font-mono text-xs"
                  placeholder="users._id (student)"
                />
              </div>
              <Button
                type="button"
                onClick={() => void generatePaper()}
                disabled={genBusy}
                className="rounded-xl font-semibold h-10"
              >
                {genBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate paper"}
              </Button>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-5">
            <Card className="border-slate-200 shadow-md shadow-slate-200/30 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 font-bold">
                  <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                  Attendance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Register daily attendance so students satisfy <strong>require attendance</strong> rules on exam day.
                </p>
                <Button asChild className="rounded-xl w-full sm:w-auto font-semibold">
                  <Link to="/dashboard/attendance/register">
                    <Users className="w-4 h-4 mr-2" />
                    Open attendance register
                    <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-60" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-md shadow-slate-200/30 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 font-bold">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  Results hub
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild variant="secondary" className="rounded-xl font-semibold">
                  <Link to="/dashboard/exams/results">View exam results</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-lg font-bold">Papers at this center</CardTitle>
              {loading && <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />}
            </CardHeader>
            <CardContent>
              {recent.length === 0 && !loading ? (
                <p className="text-sm text-slate-500 py-6 text-center">No papers yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="p-3 font-semibold">Paper</th>
                        <th className="p-3 font-semibold">Exam</th>
                        <th className="p-3 font-semibold">Student</th>
                        <th className="p-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((p) => (
                        <tr key={p._id} className="border-t border-slate-100 hover:bg-slate-50/80">
                          <td className="p-3 font-mono text-xs text-slate-700">{oid(p._id).slice(0, 10)}…</td>
                          <td className="p-3 text-slate-800 max-w-[180px] truncate">{examName(oid(p.exam_id))}</td>
                          <td className="p-3 font-mono text-xs">{oid(p.student_id).slice(0, 8)}…</td>
                          <td className="p-3">
                            <span
                              className={cn(
                                "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                                p.status === "in_progress" && "bg-amber-100 text-amber-800",
                                p.status === "generated" && "bg-blue-100 text-blue-800",
                                (p.status === "submitted" || p.status === "evaluated") && "bg-emerald-100 text-emerald-800",
                              )}
                            >
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-md">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Offline result upload
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Paper ID</Label>
                <Input
                  value={paperId}
                  onChange={(e) => setPaperId(e.target.value)}
                  placeholder="exam_v2_papers._id (hex)"
                  className="mt-1 rounded-xl font-mono text-sm"
                />
              </div>
              <div>
                <Label>Payload (JSON)</Label>
                <Textarea value={json} onChange={(e) => setJson(e.target.value)} rows={10} className="mt-1 font-mono text-xs rounded-xl" />
              </div>
              <Button onClick={submitOffline} className="rounded-xl w-full sm:w-auto font-semibold">
                Upload results
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CenterExamV2Page;
