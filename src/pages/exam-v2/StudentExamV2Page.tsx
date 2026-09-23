import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Loader2, Clock, CheckCircle2, PlayCircle, AlertCircle, Sparkles, Calendar, Award, Download, Ticket } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch, parseJsonArrayResponse } from "@/lib/api";
import { fetchV2Marksheets } from "@/lib/examV2Api";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { getServerNow, formatISTDate, formatISTTime, formatISTDateTime } from "@/lib/time";

export interface V2Paper {
  _id: string;
  exam_id: string;
  paper_template_id: string;
  status: string;
  total_obtained_marks: number;
  attempt_number: number;
  attendance_satisfied?: boolean;
  isV1?: boolean;
  v1Data?: any;
  v1_subject_duration?: number;
  v1_subject_total_marks?: number;
  v1_bp_name?: string;
  v1_max_attempts?: number;
}

export interface V2Exam {
  _id: string;
  name: string;
  start_at: string;
  end_at: string;
  exam_mode: string;
  require_attendance: boolean;
  isV1?: boolean;
}

const oid = (x: unknown) =>
  typeof x === "string" ? x : x && typeof x === "object" && "$oid" in (x as object) ? (x as { $oid: string }).$oid : "";

interface V2PaperTemplate {
  _id: string;
  name: string;
  duration_minutes: number;
  max_attempts: number;
  total_marks: number;
  isV1?: boolean;
  v1FromPaper?: boolean;
}

interface EligibleMock {
  mock_test_id: string;
  name: string;
  blueprint_name: string;
  duration_minutes: number;
  max_attempts: number;
  paper_id: string | null;
  paper_status: string | null;
  can_start_new: boolean;
}

type MsRow = {
  _id?: unknown;
  exam_id?: unknown;
  status?: string;
  pdf_path?: string;
  obtained_marks?: number;
  total_marks?: number;
};

const ExamCard = ({
  paper,
  exam,
  tpl,
  marksheet,
  mode,
  attendanceSatisfied,
  isOfflineStudent,
  downloadHallTicket,
}: {
  paper: V2Paper;
  exam?: V2Exam;
  tpl?: V2PaperTemplate;
  marksheet?: MsRow | null;
  mode: "upcoming" | "active" | "done";
  attendanceSatisfied?: boolean;
  isOfflineStudent?: boolean;
  downloadHallTicket?: () => void;
}) => {
  const parseDate = (d: any) => {
    if (!d) return 0;
    if (typeof d === "number") return d;
    if (typeof d === "string") return new Date(d).getTime();
    if (d && typeof d === "object" && "$date" in d) {
      return typeof d.$date === "string" ? new Date(d.$date).getTime() : d.$date;
    }
    return new Date(d).getTime();
  };

  const now = getServerNow().getTime();
  const start = exam ? parseDate(exam.start_at) : 0;
  const end = exam ? parseDate(exam.end_at) : Infinity;
  const st = paper.status.toLowerCase();
  const canEnter = st === "generated" || st === "in_progress";
  const inWindow = now >= start && now <= end;
  const canStart = canEnter && inWindow && (!exam?.require_attendance || attendanceSatisfied);

  const displayName = exam?.name || tpl?.name || "Exam";
  const displayDuration = paper.v1_subject_duration ?? tpl?.duration_minutes;
  const displayMarks = paper.v1_subject_total_marks ?? tpl?.total_marks;
  const displayMaxAttempts = paper.v1_max_attempts ?? tpl?.max_attempts ?? 1;

  return (
    <Card
      className={cn(
        "group border-slate-200/80 bg-white shadow-md overflow-hidden transition-all",
        mode === "upcoming" && "border-dashed border-indigo-200",
        mode === "active" && "ring-1 ring-indigo-200",
      )}
    >
      <div
        className={cn(
          "h-1 opacity-90",
          mode === "upcoming" && "bg-gradient-to-r from-slate-400 to-slate-500",
          mode === "active" && "bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500",
          mode === "done" && "bg-gradient-to-r from-emerald-500 to-teal-500",
        )}
      />
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-lg text-slate-900 truncate">{paper.v1_bp_name || displayName}</h3>
            {exam?.require_attendance && !paper.attendance_satisfied && mode !== "done" && (
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 mt-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Attendance required to start
              </p>
            )}
          </div>
          <span
            className={cn(
              "shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border",
              st === "generated" && "bg-blue-50 text-blue-700 border-blue-200",
              st === "in_progress" && "bg-amber-50 text-amber-800 border-amber-200",
              (st === "submitted" || st === "evaluated") && "bg-emerald-50 text-emerald-800 border-emerald-200",
            )}
          >
            {paper.status}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            {displayDuration ?? "—"} min
          </span>
          <span className="font-medium">{displayMarks ?? "—"} marks</span>
          <span className="font-medium">
            Attempt {paper.attempt_number} / {displayMaxAttempts}
          </span>
        </div>

        {exam && (
          <p className="text-[11px] text-slate-400 font-mono">
            {formatISTDateTime(exam.start_at)} — {formatISTTime(exam.end_at)}
          </p>
        )}

        <div className="pt-1">
          {mode === "done" ? (
            st === "generated" || st === "in_progress" ? (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                The scheduled window for this exam has ended. If you did not attempt it, contact your centre.
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Score</p>
                  <p className="text-2xl font-bold text-slate-900">{paper.total_obtained_marks}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/dashboard/student/exams/results/${oid(paper._id)}`}>
                    <Button variant="default" className="rounded-xl font-semibold">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Result
                    </Button>
                  </Link>
                  {marksheet?.pdf_path && (
                    <a href={marksheet.pdf_path} target="_blank" rel="noreferrer">
                      <Button variant="outline" className="rounded-xl font-semibold">
                        <Download className="w-4 h-4 mr-2" />
                        Marksheet PDF
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            )
          ) : canEnter ? (
            isOfflineStudent ? (
              <Button
                onClick={downloadHallTicket}
                className="w-full h-11 rounded-xl font-bold bg-white text-slate-700 border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all"
              >
                <Ticket className="w-4 h-4 mr-2" />
                Download Hall Ticket
              </Button>
            ) : canStart ? (
              <Link to={paper.isV1 ? `/dashboard/student/exams/take/${oid(paper._id)}` : `/dashboard/exam-v2/take/${oid(paper._id)}`}>
                <Button className="w-full h-11 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 shadow-md">
                  <PlayCircle className="w-4 h-4 mr-2" />
                  {st === "in_progress" ? "Resume Exam" : "Start Examination"}
                </Button>
              </Link>
            ) : (
              <Button disabled className="w-full h-11 rounded-xl bg-slate-100 text-slate-400 font-bold border border-slate-200">
                <Clock className="w-4 h-4 mr-2" />
                {!inWindow ? "Window Closed" : !attendanceSatisfied ? "Attendance Required" : "Locked"}
              </Button>
            )
          ) : null}
        </div>
      </div>
    </Card>
  );
};

const isOnlineExamMode = (mode?: string | null) => {
  if (!mode) return true; // Default to ONLINE if not set
  const lower = mode.toLowerCase();
  return lower.includes("online") || lower.includes("cbt");
};

const StudentExamV2Page = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [papers, setPapers] = useState<V2Paper[]>([]);
  const [exams, setExams] = useState<V2Exam[]>([]);
  const [paperTemplates, setPaperTemplates] = useState<V2PaperTemplate[]>([]);
  const [marksheets, setMarksheets] = useState<MsRow[]>([]);
  const [eligibleMocks, setEligibleMocks] = useState<EligibleMock[]>([]);
  const [startingMock, setStartingMock] = useState<string | null>(null);
  const [isOfflineStudent, setIsOfflineStudent] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Fetch current user first
      try {
        const res = await apiFetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            // Update sessionStorage with fresh user data
            const updatedUser = {
              ...JSON.parse(sessionStorage.getItem("user") || "{}"),
              ...data.user,
            };
            sessionStorage.setItem("user", JSON.stringify(updatedUser));
            setIsOfflineStudent(!isOnlineExamMode(data.user.exam_mode));
          }
        }
      } catch {
        // Fallback to sessionStorage
        const storedUser = sessionStorage.getItem("user");
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            setIsOfflineStudent(!isOnlineExamMode(parsed.exam_mode || parsed.examMode));
          } catch {
            setIsOfflineStudent(false);
          }
        }
      }
      fetchData();
    };
    init();
  }, []);

  const downloadHallTicket = async () => {
    try {
      const storedUser = sessionStorage.getItem("user");
      if (!storedUser) return;
      const parsed = JSON.parse(storedUser);
      const studentId = parsed._id || parsed.id || parsed.$oid;

      if (!studentId) {
        toast.error("Could not identify student ID");
        return;
      }

      const res = await apiFetch(`/api/exam/hall-ticket/${studentId}`);
      const data = await res.json();
      if (res.ok && data.pdf_url) {
        window.open(data.pdf_url, '_blank');
      } else {
        toast.error(data.message || "Failed to generate hall ticket");
      }
    } catch {
      toast.error("Failed to generate hall ticket");
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pr, er, tr, mockRes, msRes, v1PapersRes, v1BlueprintsRes] = await Promise.all([
        apiFetch("/api/exam-v2/papers"),
        apiFetch("/api/exam-v2/exams"),
        apiFetch("/api/exam-v2/paper-templates"),
        apiFetch("/api/exam/mock-tests/eligible"),
        fetchV2Marksheets().catch(() => []),
        apiFetch("/api/exam/papers"),
        apiFetch("/api/exam/blueprints"),
      ]);

      if (pr.ok) setPapers(await parseJsonArrayResponse(pr) as V2Paper[]);
      if (er.ok) setExams(await parseJsonArrayResponse(er) as V2Exam[]);
      if (tr.ok) setPaperTemplates(await parseJsonArrayResponse(tr) as V2PaperTemplate[]);
      if (mockRes.ok) setEligibleMocks(await parseJsonArrayResponse(mockRes) as EligibleMock[]);
      if (Array.isArray(msRes)) setMarksheets(msRes);

      if (v1PapersRes.ok && v1BlueprintsRes.ok) {
        const v1p = (await parseJsonArrayResponse(v1PapersRes)) as any[];
        const v1b = (await parseJsonArrayResponse(v1BlueprintsRes)) as any[];

        const mappedV1Papers: V2Paper[] = v1p.map((p: any) => {
          const subjSnap = p.subject_config_snapshot as any;
          const bpSnap = p.blueprint_snapshot as any;
          const blueprint = v1b.find((x: any) => oid(x._id) === oid(p.blueprint_id));

          const v1_subject_duration = subjSnap?.duration_minutes
            ?? bpSnap?.blueprint_duration_minutes
            ?? blueprint?.duration_minutes;
          const v1_subject_total_marks = subjSnap?.final_subject_total_marks
            ?? bpSnap?.blueprint_total_marks
            ?? blueprint?.total_marks;
          const v1_bp_name = bpSnap?.name || blueprint?.name;
          const v1_max_attempts = bpSnap?.max_attempts ?? blueprint?.max_attempts ?? 1;

          return {
            _id: oid(p._id),
            exam_id: "v1_" + oid(p.blueprint_id) + "_" + oid(p._id),
            paper_template_id: oid(p.blueprint_id),
            status: p.status,
            total_obtained_marks: p.total_obtained_marks || 0,
            attempt_number: p.attempt_number || 1,
            isV1: true,
            v1Data: p,
            v1_subject_duration,
            v1_subject_total_marks,
            v1_bp_name,
            v1_max_attempts,
          };
        });

        const mappedV1TemplatesMap: Record<string, V2PaperTemplate> = {};
        mappedV1Papers.forEach((pv) => {
          if (!mappedV1TemplatesMap[pv.paper_template_id]) {
            const b = v1b.find((x: any) => oid(x._id) === pv.paper_template_id);
            mappedV1TemplatesMap[pv.paper_template_id] = {
              _id: pv.paper_template_id,
              name: pv.v1_bp_name || (b as any)?.name || "Legacy Exam",
              duration_minutes: pv.v1_subject_duration ?? (b as any)?.duration_minutes,
              max_attempts: pv.v1_max_attempts ?? ((b as any)?.max_attempts || 1),
              total_marks: pv.v1_subject_total_marks ?? (b as any)?.total_marks,
              isV1: true,
              v1FromPaper: true,
            };
          }
        });
        const mappedV1Templates = Object.values(mappedV1TemplatesMap);

        setPaperTemplates(prev => [...prev, ...mappedV1Templates]);
        setPapers(prev => [...prev, ...mappedV1Papers]);

        const dummyV1Exams: V2Exam[] = mappedV1Papers.map((pv) => {
          const pd = pv.v1Data;
          return {
            _id: pv.exam_id,
            name: pv.v1_bp_name || "Legacy Exam",
            start_at: pd?.start_window || pd?.created_at,
            end_at: pd?.end_window || pd?.created_at,
            exam_mode: "online",
            require_attendance: false,
            isV1: true
          };
        });
        setExams(prev => [...prev, ...dummyV1Exams]);
      }
    } catch {
      toast.error("Failed to load exams");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const startMockAttempt = async (mockId: string) => {
    setStartingMock(mockId);
    try {
      const res = await apiFetch(`/api/exam/mock-tests/${mockId}/start`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.paper_id) {
        toast.success("Your mock test is ready");
        fetchData();
        navigate(`/dashboard/student/exams/take/${data.paper_id}`);
      } else {
        toast.error(data.message || "Could not start mock test");
      }
    } catch {
      toast.error("Could not start mock test");
    } finally {
      setStartingMock(null);
    }
  };

  const examOf = (p: V2Paper) => exams.find((e) => oid(e._id) === oid(p.exam_id));
  const tplOf = (p: V2Paper) => paperTemplates.find((b) => oid(b._id) === oid(p.paper_template_id));

  const { upcoming, active, completed } = useMemo(() => {
    const now = getServerNow().getTime();
    const up: V2Paper[] = [];
    const act: V2Paper[] = [];
    const done: V2Paper[] = [];

    for (const p of papers) {
      const st = p.status.toLowerCase();
      const ex = examOf(p);
      const start = ex ? new Date(ex.start_at).getTime() : 0;
      const end = ex ? new Date(ex.end_at).getTime() : Infinity;

      if (st === "submitted" || st === "evaluated") {
        done.push(p);
        continue;
      }
      if (st === "generated" || st === "in_progress") {
        if (now < start) {
          up.push(p);
        } else if (now <= end) {
          act.push(p);
        } else {
          done.push(p);
        }
      }
    }
    return { upcoming: up, active: act, completed: done };
  }, [papers, exams]);

  const marksheetForExam = (examId: string) =>
    marksheets.find((m) => oid(m.exam_id) === examId && (m.status === "ready" || m.pdf_path));

  const stats = useMemo(() => {
    const activeN = papers.filter((p) => {
      const st = p.status.toLowerCase();
      return st === "generated" || st === "in_progress";
    }).length;
    const doneN = papers.filter((p) => ["submitted", "evaluated"].includes(p.status.toLowerCase())).length;
    return { active: activeN, done: doneN, total: papers.length };
  }, [papers]);

  return (
    <DashboardLayout role="Student">
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50/80 to-white">
        <div className="max-w-5xl mx-auto px-4 py-8 md:py-10 space-y-10">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                <div className="p-2.5 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <FileText className="w-8 h-8 text-indigo-600" />
                </div>
                My Examinations
              </h1>
              <p className="text-slate-500 font-medium text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Manage and attempt your course assessments
              </p>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-4">
              {papers.length > 0 && (
                <Button
                  onClick={downloadHallTicket}
                  className="rounded-2xl font-bold bg-white text-slate-700 border-2 border-slate-100 hover:bg-slate-50 hover:border-slate-200 h-14 px-8 shadow-sm transition-all"
                >
                  <Ticket className="w-5 h-5 mr-3 text-indigo-600" />
                  Download Hall Ticket
                </Button>
              )}
              <div className="flex gap-3">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm text-center min-w-[5.5rem]">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Active</p>
                  <p className="text-xl font-bold text-indigo-700">{stats.active}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm text-center min-w-[5.5rem]">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Done</p>
                  <p className="text-xl font-bold text-emerald-700">{stats.done}</p>
                </div>
              </div>
            </div>
          </header>

          {eligibleMocks.length > 0 && (
            <section className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">Subject mock tests (classic engine)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {eligibleMocks.map((m) => {
                  const open =
                    m.paper_id &&
                    m.paper_status &&
                    (m.paper_status === "Generated" || m.paper_status === "InProgress");
                  return (
                    <Card key={m.mock_test_id} className="border-dashed border-indigo-200 bg-indigo-50/30 shadow-sm">
                      <CardContent className="p-5 space-y-3">
                        <div className="flex justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-slate-900">{m.name}</h3>
                            <p className="text-xs text-slate-500">{m.blueprint_name}</p>
                          </div>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">{m.duration_minutes} min</span>
                        </div>
                        {open ? (
                          <Link to={`/dashboard/student/exams/take/${m.paper_id}`}>
                            <Button className="w-full rounded-xl font-bold bg-indigo-600">
                              <PlayCircle className="w-4 h-4 mr-2" />
                              {m.paper_status === "InProgress" ? "Resume" : "Start"}
                            </Button>
                          </Link>
                        ) : m.can_start_new ? (
                          <Button
                            className="w-full rounded-xl font-bold bg-indigo-600"
                            disabled={startingMock === m.mock_test_id}
                            onClick={() => startMockAttempt(m.mock_test_id)}
                          >
                            {startingMock === m.mock_test_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <PlayCircle className="w-4 h-4 mr-2" /> New attempt
                              </>
                            )}
                          </Button>
                        ) : (
                          <p className="text-[11px] text-slate-500 text-center">No open attempt — check results or attempt limit.</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
            </div>
          ) : papers.length === 0 && eligibleMocks.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 bg-white/60 shadow-none">
              <CardContent className="py-20 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-slate-600 font-medium">No exam papers assigned yet</p>
                <p className="text-sm text-slate-400">Check back when your center schedules an assessment.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-10">
              {active.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <PlayCircle className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-lg font-bold text-slate-900">Active — in exam window</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {active.map((paper) => (
                      <ExamCard
                        key={oid(paper._id)}
                        paper={paper}
                        exam={examOf(paper)}
                        tpl={tplOf(paper)}
                        mode="active"
                        attendanceSatisfied={paper.attendance_satisfied}
                        isOfflineStudent={isOfflineStudent}
                        downloadHallTicket={downloadHallTicket}
                      />
                    ))}
                  </div>
                </section>
              )}

              {upcoming.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-slate-500" />
                    <h2 className="text-lg font-bold text-slate-900">Upcoming</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {upcoming.map((paper) => (
                      <ExamCard
                        key={oid(paper._id)}
                        paper={paper}
                        exam={examOf(paper)}
                        tpl={tplOf(paper)}
                        mode="upcoming"
                        isOfflineStudent={isOfflineStudent}
                        downloadHallTicket={downloadHallTicket}
                      />
                    ))}
                  </div>
                </section>
              )}

              {completed.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-emerald-600" />
                    <h2 className="text-lg font-bold text-slate-900">Completed — result & marksheet</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {completed.map((paper) => (
                      <ExamCard
                        key={oid(paper._id)}
                        paper={paper}
                        exam={examOf(paper)}
                        tpl={tplOf(paper)}
                        marksheet={marksheetForExam(oid(paper.exam_id))}
                        mode="done"
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentExamV2Page;
