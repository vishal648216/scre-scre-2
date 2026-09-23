import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Loader2,
  Clock,
  Send,
  ChevronLeft,
  ChevronRight,
  Shield,
  Wifi,
  Bookmark,
  AlertTriangle,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  fetchV2AttemptState,
  patchV2Autosave,
  postV2Start,
  postV2Submit,
} from "@/lib/examV2Api";
import { ExamV2Palette, paletteStatus } from "@/components/exam-v2/ExamV2Palette";
import { useExamV2Security } from "@/hooks/useExamV2Security";

interface Q {
  _id: string;
  question_text: string;
  question_type: string;
  marks: number;
  options_pool?: { id: string; text: string; image_url?: string }[];
  image_url?: string;
}

function qidHex(q: Q) {
  const raw = q._id as unknown;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "$oid" in (raw as object)) return (raw as { $oid: string }).$oid;
  return String(q._id);
}

type PaperDetail = {
  paper: {
    _id: string;
    status: string;
    questions: { question_id: unknown; student_response?: string }[];
  };
  exam: {
    require_attendance?: boolean;
    name?: string;
    start_at?: string;
    end_at?: string;
    result_mode?: string;
  } | null;
  paper_template: { name: string; duration_minutes: number; instructions?: string | null };
  questions: Q[];
  /** Server: present on student fetch when exam requires attendance */
  attendance_satisfied?: boolean | null;
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const TakeExamV2Page = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [detail, setDetail] = useState<PaperDetail | null>(null);
  const [idx, setIdx] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [review, setReview] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const skewMs = useRef(0);
  const autoSubmitted = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaveJson = useRef("");

  const st = detail?.paper.status.toLowerCase() || "";
  const inProgress = st === "in_progress";
  const { securityEvents } = useExamV2Security(inProgress);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await apiFetch(`/api/exam-v2/papers/${id}`);
    if (!res.ok) {
      toast.error("Failed to load exam");
      navigate("/dashboard/student/exams");
      return;
    }
    const data = (await res.json()) as PaperDetail;
    setDetail(data);
    const map: Record<string, string> = {};
    data.paper?.questions?.forEach((m: { question_id: unknown; student_response?: string }) => {
      const pq =
        typeof m.question_id === "string"
          ? m.question_id
          : m.question_id && typeof m.question_id === "object" && "$oid" in (m.question_id as object)
            ? (m.question_id as { $oid: string }).$oid
            : String(m.question_id);
      if (m.student_response) map[pq] = m.student_response;
    });
    setResponses(map);
  }, [id, navigate]);

  useEffect(() => {
    autoSubmitted.current = false;
  }, [id]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  useEffect(() => {
    if (!detail?.paper || !id) return;
    const ps = detail.paper.status.toLowerCase();
    if (ps === "submitted" || ps === "evaluated") {
      navigate(`/dashboard/student/exams/results/${id}`, { replace: true });
    }
  }, [detail?.paper?.status, id, navigate]);

  const pollState = useCallback(async () => {
    if (!id) return;
    try {
      const stRes = await fetchV2AttemptState(id);
      skewMs.current = stRes.server_now_ms - Date.now();
      if (stRes.deadline_ms != null) {
        const left = Math.max(0, Math.floor((stRes.deadline_ms - (Date.now() + skewMs.current)) / 1000));
        setTimeLeft(left);
      } else {
        setTimeLeft(null);
      }
      if (stRes.status === "submitted" || stRes.status === "evaluated") {
        toast.success("Exam submitted");
        navigate(`/dashboard/student/exams/results/${id}`);
      }
    } catch {
      /* offline — keep local timer */
    }
  }, [id, navigate]);

  useEffect(() => {
    if (!detail || !inProgress) return;
    void pollState();
    const t = setInterval(pollState, 5000);
    return () => clearInterval(t);
  }, [detail?.paper.status, inProgress, pollState]);

  useEffect(() => {
    if (!inProgress) return;
    if (timeLeft === null || timeLeft <= 0) return;
    const iv = setInterval(() => setTimeLeft((s) => (s === null ? s : Math.max(0, s - 1))), 1000);
    return () => clearInterval(iv);
  }, [inProgress, timeLeft]);

  const buildPayload = useCallback(() => {
    return Object.entries(responses).map(([question_id, response]) => ({ question_id, response }));
  }, [responses]);

  const runAutosave = useCallback(async () => {
    if (!id || !inProgress) return;
    const payload = buildPayload();
    const json = JSON.stringify(payload);
    if (json === lastSaveJson.current) return;
    lastSaveJson.current = json;
    await patchV2Autosave(id, payload);
  }, [id, inProgress, buildPayload]);

  const doSubmit = useCallback(async () => {
    if (!id || submitting) return;
    setSubmitting(true);
    try {
      await runAutosave();
      const payload = {
        responses: buildPayload(),
        security_events: securityEvents.length ? securityEvents : undefined,
      };
      const res = await postV2Submit(id, payload);
      if (res.ok) {
        toast.success("Submitted successfully");
        navigate(`/dashboard/student/exams/results/${id}`);
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error((j as { message?: string }).message || "Submit failed");
      }
    } catch {
      toast.error("Submit error");
    } finally {
      setSubmitting(false);
    }
  }, [id, submitting, runAutosave, buildPayload, securityEvents, navigate]);

  useEffect(() => {
    if (!inProgress || timeLeft !== 0 || autoSubmitted.current) return;
    autoSubmitted.current = true;
    void doSubmit();
  }, [timeLeft, inProgress, doSubmit]);

  useEffect(() => {
    if (!inProgress) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void runAutosave();
    }, 2500);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [responses, inProgress, runAutosave]);

  useEffect(() => {
    if (!id || !inProgress) return;
    const t = setInterval(() => void runAutosave(), 30000);
    return () => clearInterval(t);
  }, [id, inProgress, runAutosave]);

  const handleStart = async () => {
    if (!id) return;
    setStarting(true);
    try {
      const res = await postV2Start(id);
      if (res.ok) {
        toast.success("Exam started — timer is live");
        await load();
        await pollState();
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error((j as { message?: string }).message || "Cannot start");
      }
    } finally {
      setStarting(false);
    }
  };

  const questions = detail?.questions ?? [];
  const current = questions[idx];
  const curId = current ? qidHex(current) : "";

  const answered = useCallback(
    (qid: string) => {
      const v = responses[qid];
      return v !== undefined && v !== null && String(v).trim() !== "";
    },
    [responses],
  );

  const getPaletteStatus = useCallback(
    (i: number) => {
      const q = questions[i];
      if (!q) return "empty" as const;
      const qid = qidHex(q);
      return paletteStatus({
        index: i,
        currentIdx: idx,
        hasAnswer: answered(qid),
        markedReview: !!review[qid],
      });
    },
    [questions, idx, answered, review],
  );

  if (loading || !detail) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
        <p className="mt-4 text-sm font-medium text-slate-600">Preparing your session…</p>
      </div>
    );
  }

  const { paper, paper_template: tplRaw, exam, attendance_satisfied } = detail;
  const tpl = tplRaw ?? { name: "Exam", duration_minutes: 60, instructions: undefined as string | undefined };
  const attendanceOk = !exam?.require_attendance || attendance_satisfied === true;

  /* ——— Pre-start: generated ——— */
  if (st === "generated") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-2xl p-8 md:p-10 space-y-8">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-500/20 border border-indigo-400/30">
              <BookOpen className="h-7 w-7 text-indigo-300" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-indigo-300/90">Computer-based test</p>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">{tpl.name}</h1>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Duration</p>
              <p className="text-lg font-bold tabular-nums">{tpl.duration_minutes} min</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Questions</p>
              <p className="text-lg font-bold tabular-nums">{questions.length}</p>
            </div>
          </div>

          {exam?.require_attendance && (
            <div
              className={cn(
                "flex gap-3 rounded-xl border p-4 text-sm",
                attendanceOk
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-100",
              )}
            >
              {attendanceOk ? (
                <Shield className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
              )}
              <div className="leading-relaxed">
                <p className="font-semibold">{attendanceOk ? "Attendance OK" : "Attendance required"}</p>
                <p className="opacity-90 mt-1">
                  {attendanceOk
                    ? "You are marked present for the required date. You can start when the exam window is open."
                    : "Your centre must mark you present for the attendance date. Open Attendance below, then return here."}
                </p>
                {!attendanceOk && (
                  <Button asChild variant="outline" size="sm" className="mt-3 border-white/20 text-white hover:bg-white/10">
                    <Link to="/dashboard/student/attendance">Open attendance</Link>
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Instructions</p>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
              {tpl.instructions?.trim() ||
                `• Do not refresh or close this window during the exam.\n• Answers autosave while you navigate.\n• Timer is enforced on the server.\n• Use “Mark for review” to revisit questions later.`}
            </div>
          </div>

          <Button
            size="lg"
            disabled={starting || !attendanceOk}
            onClick={() => void handleStart()}
            className="w-full h-14 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-base font-bold shadow-lg shadow-indigo-900/40 disabled:opacity-50"
          >
            {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : attendanceOk ? "Start exam" : "Cannot start — attendance"}
          </Button>

          <Button variant="ghost" asChild className="w-full text-slate-400 hover:text-white">
            <Link to="/dashboard/student/exams">← Back to exams</Link>
          </Button>
        </div>
      </div>
    );
  }

  /* ——— Active attempt ——— */
  if (st === "in_progress" && current) {
    const timerUrgent = timeLeft !== null && timeLeft < 300;

    return (
      <div
        className="min-h-screen bg-slate-100 flex flex-col"
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
      >
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <Shield className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 truncate">{tpl.name}</p>
              <p className="text-sm font-semibold text-slate-900 truncate">
                Q{idx + 1} of {questions.length}
              </p>
            </div>
          </div>

          <div
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2 font-mono text-xl font-bold tabular-nums",
              timerUrgent
                ? "border-red-300 bg-red-50 text-red-700 animate-pulse"
                : "border-slate-200 bg-slate-50 text-slate-900",
            )}
          >
            <Clock className="h-5 w-5 opacity-70" />
            {timeLeft !== null ? formatTime(timeLeft) : "—"}
          </div>

          <div className="flex items-center gap-2 text-[10px] text-emerald-700">
            <Wifi className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Autosave on</span>
          </div>
        </header>

        <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
          {/* Left palette */}
          <aside className="w-full shrink-0 border-b border-slate-200 bg-white lg:w-56 lg:border-b-0 lg:border-r overflow-y-auto max-h-[40vh] lg:max-h-none p-4">
            <ExamV2Palette
              total={questions.length}
              currentIdx={idx}
              getStatus={(i) => getPaletteStatus(i)}
              onPick={setIdx}
              cols={5}
            />
          </aside>

          {/* Center */}
          <main className="flex-1 min-w-0 overflow-y-auto p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/50">
              <div className="border-b border-slate-100 px-6 py-4 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-indigo-600">Marks: {current.marks}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  {current.question_type}
                </span>
              </div>
              <div className="p-6 space-y-6">
                <div className="text-base md:text-lg font-medium text-slate-900 leading-relaxed">{current.question_text}</div>
                {current.image_url && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 inline-block max-w-full">
                    <img src={current.image_url} alt="" className="max-h-72 w-auto object-contain" />
                  </div>
                )}

                {current.question_type === "MCQ" && current.options_pool && (
                  <div className="space-y-2">
                    {current.options_pool.map((opt, i) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setResponses((r) => ({ ...r, [curId]: opt.id }))}
                        className={cn(
                          "w-full flex items-start gap-3 rounded-xl border p-4 text-left transition-all",
                          responses[curId] === opt.id
                            ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500/30"
                            : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                            responses[curId] === opt.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {String.fromCharCode(65 + i)}
                        </span>
                        <div className="flex-1 space-y-2 pt-0.5">
                          <span className="text-sm text-slate-800">{opt.text}</span>
                          {opt.image_url && (
                            <img src={opt.image_url} alt="" className="max-h-32 w-auto object-contain rounded-md border" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {current.question_type !== "MCQ" && (
                  <div>
                    <Label className="text-xs font-semibold text-slate-600">Your answer</Label>
                    <Textarea
                      value={responses[curId] || ""}
                      onChange={(e) => setResponses((r) => ({ ...r, [curId]: e.target.value }))}
                      onPaste={(e) => e.preventDefault()}
                      rows={10}
                      className="mt-2 rounded-xl border-slate-200 font-normal"
                    />
                    <p className="mt-1 text-[10px] text-slate-400">Paste is disabled during this exam.</p>
                  </div>
                )}

                <div className="flex flex-wrap justify-between gap-3 pt-2">
                  <Button
                    variant="outline"
                    disabled={idx === 0}
                    onClick={() => setIdx((i) => i - 1)}
                    className="rounded-xl"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setReview((r) => ({ ...r, [curId]: !r[curId] }))}
                    className={cn("rounded-xl", review[curId] && "border-amber-400 bg-amber-50 text-amber-900")}
                  >
                    <Bookmark className={cn("w-4 h-4 mr-2", review[curId] && "fill-amber-500 text-amber-600")} />
                    {review[curId] ? "Marked for review" : "Mark for review"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={idx >= questions.length - 1}
                    onClick={() => setIdx((i) => i + 1)}
                    className="rounded-xl"
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </main>

          {/* Right rail */}
          <aside className="w-full shrink-0 border-t border-slate-200 bg-white lg:w-52 lg:border-t-0 lg:border-l p-4 space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Finish</p>
            <Button
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 h-12 font-bold shadow-md"
              disabled={submitting}
              onClick={() => {
                const totalQuestions = questions.length;
                const answeredCount = questions.filter((q) => answered(qidHex(q))).length;
                const unansweredCount = totalQuestions - answeredCount;

                let message = "Submit the exam? You cannot change answers after submit.";
                if (unansweredCount > 0) {
                  message = `You have ${unansweredCount} unanswered questions. ${message}`;
                }
                if (window.confirm(message)) void doSubmit();
              }}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Submit test
            </Button>
            <p className="text-[10px] leading-relaxed text-slate-500">
              Answers save automatically. Closing the tab may end your attempt — use Submit when done.
            </p>
          </aside>
        </div>
      </div>
    );
  }

  /* Submitted / other — usually redirected to results; fallback if navigation blocked */
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
      <p className="text-slate-600 font-medium">This paper is {paper.status}.</p>
      <div className="flex flex-wrap gap-2 mt-4 justify-center">
        <Button asChild className="rounded-xl" variant="default">
          <Link to={`/dashboard/student/exams/results/${id}`}>View result</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/dashboard/student/exams">Back to exams</Link>
        </Button>
      </div>
    </div>
  );
};

export default TakeExamV2Page;
