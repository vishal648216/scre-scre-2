import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { USE_EXAM_V2 } from "@/config/featureFlags";
import { fetchStudentExamContext } from "@/lib/examV2Api";
import { Button } from "@/components/ui/button";
import { PlayCircle, Shield, Clock, ClipboardCheck } from "lucide-react";

/** Pre-exam lock (T−10 min default): full-screen takeover; hides normal dashboard until exam starts or window ends. */
export function ExamLockRoot({ children }: { children: React.ReactNode }) {
  const [lock, setLock] = useState<{
    exam_name: string;
    paper_id: string;
    start_at_ms: number;
    lock_at_ms: number;
    end_at_ms: number;
  } | null>(null);
  const [ready, setReady] = useState(!USE_EXAM_V2);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!USE_EXAM_V2) return;
    let user: { role?: string } = {};
    try {
      const s = sessionStorage.getItem("user");
      if (s) user = JSON.parse(s);
    } catch {
      /* ignore */
    }
    if (user.role?.toLowerCase() !== "student") {
      setReady(true);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const ctx = await fetchStudentExamContext();
        if (cancelled) return;
        if (ctx.exam_lock) {
          setLock({
            exam_name: ctx.exam_lock.exam_name,
            paper_id: ctx.exam_lock.paper_id,
            start_at_ms: ctx.exam_lock.start_at_ms,
            lock_at_ms: ctx.exam_lock.lock_at_ms,
            end_at_ms: ctx.exam_lock.end_at_ms,
          });
        } else {
          setLock(null);
        }
      } catch {
        setLock(null);
      } finally {
        setReady(true);
      }
    };
    void tick();
    const id = setInterval(tick, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const countdown = useMemo(() => {
    if (!lock) return null;
    const sec = Math.max(0, Math.floor((lock.start_at_ms - nowMs) / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [lock, nowMs]);

  if (!USE_EXAM_V2) return <>{children}</>;
  if (!ready) return <>{children}</>;

  if (lock) {
    return (
      <div className="min-h-[70vh] bg-gradient-to-br from-[#0c1222] via-[#111827] to-[#0f172a] text-white flex flex-col items-center justify-center p-6 rounded-[1.5rem] border border-white/10">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-400/30">
              <Shield className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-amber-400/90">Exam focus mode</p>
              <h1 className="text-xl font-bold tracking-tight leading-tight">{lock.exam_name}</h1>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-300 text-sm">
              <Clock className="w-4 h-4 text-amber-400" />
              Starts in
            </div>
            <span className="font-mono text-2xl font-bold tabular-nums text-amber-300">{countdown}</span>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3 text-sm text-slate-300 leading-relaxed">
            <p className="font-semibold text-white">Before you enter</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Complete centre attendance for today if your exam requires it (check My exams → Start rules).</li>
              <li>Use a stable connection; answers autosave after you start.</li>
              <li>Timer is enforced on the server — do not rely only on your device clock.</li>
            </ul>
          </div>

          <Button
            asChild
            variant="outline"
            className="w-full h-11 rounded-xl border-white/20 text-slate-200 hover:bg-white/10"
          >
            <Link to="/dashboard/student/attendance">
              <ClipboardCheck className="w-4 h-4 mr-2" />
              Open attendance
            </Link>
          </Button>

          <Button
            asChild
            className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold shadow-lg shadow-indigo-950/50"
          >
            <Link to={`/dashboard/student/exams/take/${lock.paper_id}`}>
              <PlayCircle className="w-5 h-5 mr-2" />
              Enter exam hall
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
