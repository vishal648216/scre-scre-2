import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { USE_EXAM_V2 } from "@/config/featureFlags";
import StudentExamV2Page from "@/pages/exam-v2/StudentExamV2Page";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Loader2, Clock, CheckCircle2, PlayCircle, AlertCircle, RotateCcw, Ticket, Calendar } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch, parseJsonArrayResponse } from "@/lib/api";
import { formatISTDate, formatISTTime, formatISTDateTime, formatISTDateTimeLong } from "@/lib/time";
import { getServerNow } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

import { useTranslation } from "react-i18next";

interface SubjectConfigSnapshot {
  subject_id?: string;
  duration_minutes?: number;
  final_subject_total_marks?: number;
  default_question_bank_id?: string;
  reappear_question_bank_id?: string;
  practical_component?: any;
  assignment_component?: any;
  final_exam_component?: any;
  question_distribution?: any[];
  instructions?: string;
}

interface BlueprintSnapshot {
  name?: string;
  max_attempts?: number;
  blueprint_total_marks?: number;
  blueprint_duration_minutes?: number;
}

interface StudentPaper {
  _id: string;
  blueprint_id: string;
  subject_id?: string;
  subject_name?: string;
  status: string;
  total_obtained_marks: number;
  created_at: string;
  start_window?: string;
  end_window?: string;
  start_time?: string;
  submit_time?: string;
  attempt_number: number;
  subject_config_snapshot?: SubjectConfigSnapshot | null;
  blueprint_snapshot?: BlueprintSnapshot | null;
}

interface Blueprint {
  _id: string;
  name: string;
  course_id: string;
  duration_minutes: number;
  total_marks: number;
  max_attempts: number;
  exam_mode?: string; // "Computer Based Test (CBT)" | "Offline" | etc.
  exam_pattern?: string;
  term_number?: number;
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

function LegacyStudentExamListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [papers, setPapers] = useState<StudentPaper[]>([]);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [eligibleMocks, setEligibleMocks] = useState<EligibleMock[]>([]);
  const [courseSubjects, setCourseSubjects] = useState<any[]>([]);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [startingMock, setStartingMock] = useState<string | null>(null);
  const [allottingSubject, setAllottingSubject] = useState<string | null>(null);
  const [isOfflineStudent, setIsOfflineStudent] = useState(false);

  const isOnlineExamMode = (mode?: string | null) => {
    if (!mode) return true; // Default to ONLINE if not set
    const lower = mode.toLowerCase();
    return lower.includes("online") || lower.includes("cbt");
  };

  const toId = (v: any): string => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && "$oid" in v) return v.$oid;
    return String(v || "");
  };

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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [papersRes, blueprintsRes, mocksRes, courseAllotRes, allSubsRes] = await Promise.all([
        apiFetch("/api/exam/papers"),
        apiFetch("/api/exam/blueprints"),
        apiFetch("/api/exam/mock-tests/eligible"),
        apiFetch("/api/courses/allot"),
        apiFetch("/api/admin/subjects"),
      ]);

      let rawSubs: any[] = [];
      if (allSubsRes.ok) {
        const subData = await allSubsRes.json();
        const items = Array.isArray(subData) ? subData : (subData.items || []);
        rawSubs = items.map((s: any) => ({
          ...s,
          _id: toId(s._id || s.id)
        }));
        setAllSubjects(rawSubs);
      }

      if (blueprintsRes.ok) {
        const raw = await parseJsonArrayResponse(blueprintsRes);
        setBlueprints(raw.map((b: any) => ({
          ...b,
          _id: toId(b._id),
          course_id: toId(b.course_id)
        })));
      }

      if (mocksRes.ok) {
        setEligibleMocks(await parseJsonArrayResponse(mocksRes) as EligibleMock[]);
      }

      if (courseAllotRes.ok) {
        const rawAllot = await parseJsonArrayResponse(courseAllotRes);
        // Map course subjects and attach subject names if available
        setCourseSubjects(rawAllot.map((cs: any) => {
          const sId = toId(cs.subject_id);
          const subject = rawSubs.find((s: any) => toId(s._id) === sId);
          return {
            ...cs,
            _id: toId(cs._id),
            subject_id: sId,
            subject_name: subject?.subject_name || "Unknown Subject"
          };
        }));
      }

      if (papersRes.ok) {
        const raw = await parseJsonArrayResponse(papersRes);
        setPapers(raw.map((p: any) => {
          const sId = toId(p.subject_id);
          const subject = rawSubs.find((s: any) => toId(s._id) === sId);
          return {
            ...p,
            _id: toId(p._id),
            blueprint_id: toId(p.blueprint_id),
            subject_id: sId,
            subject_name: subject?.subject_name || "Unknown Subject",
            subject_config_snapshot: p.subject_config_snapshot || null,
            blueprint_snapshot: p.blueprint_snapshot || null,
          };
        }));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load your exams");
    } finally {
      setLoading(false);
    }
  };

  const autoAllotExam = async (subjectId: string) => {
    setAllottingSubject(subjectId);
    try {
      const subject = allSubjects.find(s => toId(s._id) === subjectId);
      const mapping = courseSubjects.find(cs => toId(cs.subject_id) === subjectId);
      const courseId = mapping ? toId(mapping.course_id) : null;

      // Find a matching blueprint for this subject and course
      const blueprint = blueprints.find(b =>
        (courseId ? toId(b.course_id) === courseId : true) &&
        b.name.toLowerCase().includes(subject?.subject_name.toLowerCase() || "")
      );

      if (!blueprint) {
        toast.error("No exam blueprint found for this subject. Please contact your center.");
        return;
      }

      const storedUser = JSON.parse(sessionStorage.getItem("user") || "{}");
      const studentId = storedUser._id || storedUser.id;
      const centerId = storedUser.parent_id || "65a1234567890abcdef12345"; // Fallback

      const res = await apiFetch("/api/exam/generate-paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blueprint_id: blueprint._id,
          student_id: studentId,
          center_id: centerId,
          subject_id: subjectId,
          start_window: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // Starts in 5 minutes
          end_window: new Date(Date.now() + 86400000).toISOString(), // 24h window
        })
      });

      if (res.ok) {
        toast.success("Exam allotted successfully");
        await fetchData();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "Failed to allot exam");
      }
    } catch {
      toast.error("Failed to allot exam");
    } finally {
      setAllottingSubject(null);
    }
  };

  const downloadHallTicket = async () => {
    try {
      const storedUser = sessionStorage.getItem("user");
      if (!storedUser) return;
      const parsed = JSON.parse(storedUser);
      // Try multiple possible ID fields from the parsed user object
      const studentId = parsed.user_id || parsed._id || parsed.id || (parsed.$oid ? (typeof parsed.$oid === 'string' ? parsed.$oid : parsed.$oid.toString()) : null);

      if (!studentId) {
        console.error("Student data in session:", parsed);
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

  const startMockAttempt = async (mockId: string) => {
    setStartingMock(mockId);
    try {
      const res = await apiFetch(`/api/exam/mock-tests/${mockId}/start`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.paper_id) {
        toast.success("Your mock test is ready");
        await fetchData();
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

  return (
    <DashboardLayout role="Student">
      <div className="p-6 space-y-8 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-foreground flex items-center gap-3">
              <FileText className="w-8 h-8 text-primary" />
              {t("My Examinations")}
            </h1>
            <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.2em] mt-1">
              {t("View and attempt your allotted course assessments")}
            </p>
          </div>
          {papers.length > 0 && (
            <Button
              onClick={downloadHallTicket}
              className="rounded-none font-black uppercase tracking-widest text-xs h-11 px-6 shadow-lg shadow-primary/20"
            >
              <Ticket className="w-4 h-4 mr-2" />
              {t("Download Hall Ticket")}
            </Button>
          )}
        </div>

        {/* Removed Available Subjects (Auto-allotment) as per user request */}

        {eligibleMocks.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-black uppercase tracking-tight text-foreground">{t("Subject mock tests")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {eligibleMocks.map((m) => {
                const open =
                  m.paper_id &&
                  m.paper_status &&
                  (m.paper_status === "Generated" || m.paper_status === "InProgress");
                return (
                  <Card key={m.mock_test_id} className="rounded-none border-border border-dashed">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary">{t("Mock")}</p>
                          <h3 className="font-black uppercase tracking-tight">{t(m.name)}</h3>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase">{t(m.blueprint_name)}</p>
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                          {m.duration_minutes} {t("min")} · {m.max_attempts} {t("attempts max")}
                        </span>
                      </div>
                      {open ? (
                        <Link to={`/dashboard/student/exams/take/${m.paper_id}`}>
                          <Button className="w-full rounded-none font-black uppercase tracking-widest text-xs h-11">
                            <PlayCircle className="w-4 h-4 mr-2" />
                            {m.paper_status === "InProgress" ? t("Resume mock") : t("Start mock")}
                          </Button>
                        </Link>
                      ) : m.can_start_new ? (
                        <Button
                          className="w-full rounded-none font-black uppercase tracking-widest text-xs h-11"
                          disabled={startingMock === m.mock_test_id}
                          onClick={() => startMockAttempt(m.mock_test_id)}
                        >
                          {startingMock === m.mock_test_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <PlayCircle className="w-4 h-4 mr-2" /> {t("New attempt")}
                            </>
                          )}
                        </Button>
                      ) : (
                        <p className="text-[10px] font-bold uppercase text-muted-foreground text-center py-2">
                          {t("Max attempts reached or result pending — check below")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {!loading && papers.length === 0 && eligibleMocks.length === 0 && courseSubjects.length === 0 ? (
          <Card className="rounded-none border-dashed border-2 bg-muted/30 py-20 text-center">
            <CardContent className="space-y-4">
              <div className="w-16 h-16 bg-muted border border-border mx-auto flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">{t("No exams or subjects allotted yet")}</p>
              <p className="text-[10px] text-muted-foreground/60 font-bold uppercase mt-1">{t("Please contact your center if you expect an exam")}</p>
            </CardContent>
          </Card>
        ) : null}

        {!loading && papers.some(p => {
          const startWindow = p.start_window ? new Date(p.start_window) : null;
          const now = getServerNow();
          return startWindow && startWindow > now;
        }) && (
            <div className="space-y-4 mb-8">
              <h2 className="text-lg font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                {t("Upcoming Examinations")}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {papers
                  .filter(p => {
                    const startWindow = p.start_window ? new Date(p.start_window) : null;
                    const now = getServerNow();
                    return startWindow && startWindow > now;
                  })
                  .map(p => {
                    const blueprint = blueprints.find(b => b._id === p.blueprint_id);
                    const snapName = p.blueprint_snapshot?.name;
                    const bpName = snapName || blueprint?.name || "Exam";
                    return (
                      <Card key={p._id} className="rounded-none border-border bg-primary/5">
                        <CardContent className="p-5 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-primary">{t("Scheduled")}</p>
                              <h3 className="font-black uppercase tracking-tight">{t(p.subject_name || bpName)}</h3>
                              <p className="text-[10px] text-muted-foreground font-bold uppercase">
                                {formatISTDateTimeLong(p.start_window)}
                              </p>
                            </div>
                            <div className="w-10 h-10 bg-background border border-border flex items-center justify-center">
                              <Clock className="w-5 h-5 text-muted-foreground" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>
          )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : papers.length === 0 && eligibleMocks.length === 0 ? (
          null
        ) : papers.length === 0 ? null : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {papers
              .filter(p => {
                const startWindow = p.start_window ? new Date(p.start_window) : null;
                const now = getServerNow();
                return !startWindow || startWindow <= now;
              })
              .map((paper) => {
                const blueprint = blueprints.find(b => b._id === paper.blueprint_id);

                const snapDuration = paper.subject_config_snapshot?.duration_minutes;
                const snapTotalMarks = paper.subject_config_snapshot?.final_subject_total_marks;
                const snapName = paper.blueprint_snapshot?.name;
                const snapMaxAttempts = paper.blueprint_snapshot?.max_attempts;

                const subjectDuration = snapDuration ?? blueprint?.duration_minutes;
                const subjectTotalMarks = snapTotalMarks ?? blueprint?.total_marks;
                const bpDisplay = snapName || blueprint?.name;
                const maxAttempts = snapMaxAttempts ?? blueprint?.max_attempts ?? 1;

                const now = getServerNow();
                const startWindow = paper.start_window ? new Date(paper.start_window) : null;
                const endWindow = paper.end_window ? new Date(paper.end_window) : null;

                const isTooEarly = startWindow && now < startWindow;
                const isTooLate = endWindow && now > endWindow;
                const canStart = (paper.status === "Generated" || paper.status === "InProgress") && !isTooEarly && !isTooLate;

                return (
                  <Card key={paper._id} className="rounded-none border-border shadow-md hover:border-primary/40 transition-all group overflow-hidden">
                    <div className="p-6 space-y-6">
                      <div className="flex justify-between items-start">
                        <div className="w-12 h-12 bg-primary/5 border border-primary/10 flex items-center justify-center">
                          <FileText className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            {blueprint?.exam_pattern && (
                              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 border bg-indigo-500/10 text-indigo-600 border-indigo-500/20">
                                {blueprint.exam_pattern} {blueprint.term_number ? `• Term ${blueprint.term_number}` : ''}
                              </span>
                            )}
                            {blueprint?.exam_mode && blueprint.exam_mode.toLowerCase().includes("offline") && (
                              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 border bg-amber-500/10 text-amber-600 border-amber-500/20">
                                📝 Offline Exam
                              </span>
                            )}
                            <span className={cn(
                              "text-[9px] font-black uppercase tracking-widest px-2 py-1 border",
                              paper.status === "Generated" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                                paper.status === "InProgress" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                                  paper.status === "Submitted" ? "bg-purple-500/10 text-purple-600 border-purple-500/20" :
                                    "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            )}>
                              {paper.status === "Generated" ? t("Available") : t(paper.status)}
                            </span>
                          </div>
                          {isTooEarly && startWindow && !isNaN(startWindow.getTime()) && (
                            <span className="text-[8px] font-bold text-amber-600 uppercase">
                              {t("Starts")} {formatISTDateTime(paper.start_window)}
                            </span>
                          )}
                          {isTooLate && <span className="text-[8px] font-bold text-destructive uppercase">{t("Expired")}</span>}
                        </div>
                      </div>


                      <div className="space-y-2">
                        <h3 className="text-xl font-black uppercase tracking-tight text-foreground">
                          {t(paper.subject_name || bpDisplay || "Course Examination")}
                        </h3>
                        {paper.subject_name && bpDisplay && paper.subject_name !== bpDisplay && (
                          <p className="text-[10px] font-bold text-muted-foreground uppercase -mt-1">{t(bpDisplay)}</p>
                        )}
                        <div className="flex flex-wrap gap-4">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">
                              {subjectDuration ?? "--"} {t("Minutes")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">
                              {subjectTotalMarks ?? "--"} {t("Total Marks")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">
                              {t("Attempt")} {paper.attempt_number} {t("of")} {maxAttempts}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-border">
                        {isOfflineStudent && (paper.status === "Generated" || paper.status === "InProgress") ? (
                          <Button
                            onClick={downloadHallTicket}
                            className="w-full rounded-none font-black uppercase tracking-widest text-xs h-12"
                          >
                            <Ticket className="w-4 h-4 mr-2" />
                            {t("Download Hall Ticket")}
                          </Button>
                        ) : paper.status === "Generated" || paper.status === "InProgress" ? (
                          <Link to={canStart ? `/dashboard/student/exams/take/${paper._id}` : "#"} className={cn(!canStart && "cursor-not-allowed")}>
                            <Button disabled={!canStart} className="w-full rounded-none font-black uppercase tracking-widest text-xs h-12">
                              <PlayCircle className="w-4 h-4 mr-2" />
                              {isTooEarly ? t("Wait for window") : isTooLate ? t("Window Expired") : paper.status === "InProgress" ? t("Resume Exam") : t("Start Examination")}
                            </Button>
                          </Link>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("Obtained Marks")}</p>
                              <p className="text-lg font-black text-foreground">
                                {paper.status === "Evaluated" ? paper.total_obtained_marks : t("Awaiting Result")}
                              </p>
                            </div>
                            <Link to={`/dashboard/student/exams/results/${paper._id}`}>
                              <Button variant="outline" className="rounded-none font-black uppercase tracking-widest text-[10px]">
                                {t("View Details")}
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function StudentExamListPage() {
  return USE_EXAM_V2 ? <StudentExamV2Page /> : <LegacyStudentExamListPage />;
}
