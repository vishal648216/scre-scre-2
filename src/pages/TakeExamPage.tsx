import { useState, useEffect, useCallback, useMemo } from "react";
import { USE_EXAM_V2 } from "@/config/featureFlags";
import TakeExamV2Page from "@/pages/exam-v2/TakeExamV2Page";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { 
  Loader2, 
  Clock, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  Send, 
  AlertTriangle, 
  Bookmark, 
  BookmarkCheck, 
  Flag, 
  FileText,
  User as UserIcon,
  Timer,
  LayoutDashboard,
  CheckCircle,
  XCircle,
  Info,
  ClipboardList
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { getServerNow, syncServerTime } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, FileUp, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";

interface Question {
  _id: string;
  question_text: string;
  options?: string[];
  question_type: string;
  marks: number;
  image_url?: string;
  correct_option_index?: number;
}

interface StudentPaper {
  _id: string;
  status: string;
  start_time?: string;
  submit_time?: string;
  total_obtained_marks?: number;
  questions: { 
    question_id: string; 
    student_response?: string;
    obtained_marks?: number;
    evaluation_status?: string;
  }[];
}

interface Blueprint {
  name: string;
  duration_minutes: number;
  instructions?: string;
  total_marks: number;
}

function LegacyTakeExamPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  
  const userStr = sessionStorage.getItem("user");
  const user = useMemo(() => {
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }, [userStr]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [paper, setPaper] = useState<StudentPaper | null>(null);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [warningCount, setWarningCount] = useState(0);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState("Error");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);

  // Status for waiting screen
  const [isWaiting, setIsWaiting] = useState(false);
  const [secondsUntilStart, setSecondsUntilStart] = useState(0);

  const toId = (v: any): string => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && "$oid" in v) return v.$oid;
    return String(v || "");
  };

  const handleFeedback = async () => {
    if (!feedbackComment || !currentQuestion) return;
    const qid = toId(currentQuestion._id);
    setSendingFeedback(true);
    try {
      const res = await apiFetch(`/api/exam/questions/${qid}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: qid,
          feedback_type: feedbackType,
          comment: feedbackComment
        })
      });
      if (res.ok) {
        toast.success("Feedback submitted. Thank you!");
        setIsFeedbackOpen(false);
        setFeedbackComment("");
      }
    } catch {
      toast.error("Failed to submit feedback");
    } finally {
      setSendingFeedback(false);
    }
  };

  const fetchPaper = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/exam/papers/${id}`);
      if (res.ok) {
        const data = await res.json();
        const paperData = data.paper;
        const blueprintData = data.blueprint;

        // --- EXAM ACCESS LOGIC ---
        let now = Date.now();
        try {
          const sNow = getServerNow();
          if (!isNaN(sNow.getTime())) {
            now = sNow.getTime();
          }
        } catch (e) {
          console.warn("Server time sync failed, using local time", e);
        }

        const startWindow = paperData.start_window ? new Date(paperData.start_window).getTime() : 0;
        const endWindow = paperData.end_window ? new Date(paperData.end_window).getTime() : 0;

        // 1. Early Login -> Waiting Screen (only if within 1 hour, otherwise back to dashboard)
        if (startWindow > now) {
          const diffMs = startWindow - now;
          if (diffMs > 3600000) { // More than 1 hour early
            toast.error("This exam is scheduled for a later time.");
            navigate("/dashboard/student/exams");
            return;
          }
          setIsWaiting(true);
          setSecondsUntilStart(Math.ceil(diffMs / 1000));
          setLoading(false);
          return;
        }

        // 2. Window Expired -> Error (Apply to both Generated and InProgress)
        if (endWindow > 0 && now > endWindow) {
          toast.error("This exam window has expired.");
          navigate("/dashboard/student/exams");
          return;
        }

        // 3. Attendance Check (Now handled by backend auto-marking)
        // We removed the frontend check to prevent redirection loops and multiple toast errors.
        // The backend marks attendance automatically when the student accesses this page.

        const normalizedPaper = {
          ...paperData,
          _id: toId(paperData._id),
          questions: paperData.questions.map((q: any) => ({
            ...q,
            question_id: toId(q.question_id)
          }))
        };

        // If exam is already submitted or evaluated, redirect back to dashboard
        // This ensures the "exam window" stays closed as per user request
        const status = (normalizedPaper.status || "").toLowerCase();
        if (status === "submitted" || status === "evaluated") {
          navigate("/dashboard/student/exams");
          return;
        }

        const normalizedQuestions = (data.questions || []).map((q: any) => ({
          ...q,
          _id: toId(q._id)
        }));

        setPaper(normalizedPaper);
        setBlueprint(blueprintData);
        setQuestions(normalizedQuestions);
        
        const existingResponses: Record<string, string> = {};
        normalizedPaper.questions.forEach((q: any) => {
          if (q.student_response) existingResponses[q.question_id] = q.student_response;
        });
        setResponses(existingResponses);

        // --- TIMER LOGIC (SYNCED WITH BACKEND) ---
        if (normalizedPaper.status === "InProgress" && normalizedPaper.start_time) {
          const startTime = new Date(normalizedPaper.start_time).getTime();
          const durationMs = blueprintData.duration_minutes * 60 * 1000;
          const elapsed = now - startTime;
          const remaining = Math.max(0, Math.floor((durationMs - elapsed) / 1000));
          
          if (remaining <= 0) {
            handleSubmit(); // Auto-submit if time's up on load
          } else {
            setTimeLeft(remaining);
          }
        } else {
          setTimeLeft(blueprintData.duration_minutes * 60);
        }

        setIsWaiting(false);
      } else {
        toast.error("Failed to load exam paper");
        navigate("/dashboard/student/exams");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchPaper();
  }, [fetchPaper]);

  // Countdown timer for waiting screen
  useEffect(() => {
    if (!isWaiting || secondsUntilStart <= 0) {
      if (isWaiting && secondsUntilStart <= 0) {
        fetchPaper(); // Trigger start when countdown hits zero
      }
      return;
    }
    const timer = setInterval(() => setSecondsUntilStart(s => s - 1), 1000);
    return () => clearInterval(timer);
  }, [isWaiting, secondsUntilStart, fetchPaper]);

  // Lockdown & Security
  useEffect(() => {
    if (paper?.status !== "InProgress") return;

    // Prevent navigation away
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        const event = { event_type: "TabSwitch", timestamp: getServerNow().toISOString() };
        setSecurityEvents(prev => [...prev, event]);
        setWarningCount(prev => {
          const newCount = prev + 1;
          if (newCount >= 3) {
            handleSubmit();
          } else {
            toast.warning(`WARNING (${newCount}/3): TAB SWITCH DETECTED.`);
          }
          return newCount;
        });
      }
    };

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [paper?.status]);

  // Exam Timer
  useEffect(() => {
    if (timeLeft <= 0 || paper?.status !== "InProgress") return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, paper?.status]);

  const handleStart = async () => {
    try {
      const res = await apiFetch(`/api/exam/attempt/${id}/start`, { method: "POST" });
      if (res.ok) {
        setPaper(prev => prev ? { ...prev, status: "InProgress" } : null);
        try {
          if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
        } catch {}
      }
    } catch (error) {
      toast.error("Failed to start exam");
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        responses: Object.entries(responses).map(([question_id, response]) => ({
          question_id,
          response
        })),
        security_events: securityEvents
      };
      
      const res = await apiFetch(`/api/exam/attempt/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success("Exam submitted successfully!");
        if (document.fullscreenElement) document.exitFullscreen();
        // Redirect to the result page so they see the Thank You and Review flow immediately
        navigate(`/dashboard/student/exams/results/${id}`);
      } else {
        toast.error("Failed to submit exam");
      }
    } catch (error) {
      toast.error("An error occurred during submission");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ":" : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-background"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  // --- WAITING SCREEN ---
  if (isWaiting) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-8 bg-card p-10 border-2 border-primary shadow-2xl">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto border-4 border-primary animate-pulse">
            <Timer className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black uppercase tracking-tight">Waiting for Exam</h1>
            <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.2em]">{blueprint?.name}</p>
          </div>
          <div className="py-10 bg-primary text-primary-foreground">
            <p className="text-sm font-black uppercase tracking-widest mb-2 opacity-70">Starting In</p>
            <p className="text-6xl font-black tracking-tighter tabular-nums">{formatTime(secondsUntilStart)}</p>
          </div>
          <p className="text-xs font-medium text-muted-foreground italic">Your exam will automatically start when the timer hits zero. Please stay on this page.</p>
        </div>
      </div>
    );
  }

  // Check for empty questions array early to prevent "1/0" display
  if (questions.length === 0) {
    return (
      <div className="h-screen bg-muted/30 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-6 bg-card p-10 border-2 border-destructive shadow-2xl">
          <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto border-4 border-destructive">
            <AlertTriangle className="w-10 h-10 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black uppercase tracking-tight">No Questions Found</h1>
            <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.2em]">The exam paper is empty or failed to load questions.</p>
          </div>
          <Button onClick={() => navigate("/dashboard/student/exams")} className="w-full h-12 rounded-none font-black uppercase tracking-widest text-xs">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // --- RESULT SCREEN ---
  if (paper?.status === "Submitted" || paper?.status === "Evaluated") {
    const totalQuestions = questions.length;
    const answeredCount = Object.keys(responses).length;
    const isEvaluated = paper.status === "Evaluated";

    return (
      <div className="min-h-screen bg-muted/30 flex flex-col">
        <header className="h-20 bg-card border-b-4 border-primary px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-primary/10 flex items-center justify-center border border-primary/20">
              <CheckCircle className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight">Exam Completed</h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{blueprint?.name}</p>
            </div>
          </div>
          <Button onClick={() => navigate("/dashboard/student/exams")} className="rounded-none font-black uppercase tracking-widest text-xs h-12 px-8">
            <LayoutDashboard className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
        </header>

        <main className="flex-1 p-8 max-w-5xl mx-auto w-full space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="rounded-none border-border shadow-sm">
              <CardContent className="p-6 text-center space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Your Score</p>
                <p className="text-4xl font-black text-primary">
                  {isEvaluated ? `${paper.total_obtained_marks} / ${blueprint?.total_marks}` : "Pending"}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-none border-border shadow-sm">
              <CardContent className="p-6 text-center space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Answered</p>
                <p className="text-4xl font-black">{answeredCount} / {totalQuestions}</p>
              </CardContent>
            </Card>
            <Card className="rounded-none border-border shadow-sm">
              <CardContent className="p-6 text-center space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Result Status</p>
                <p className={cn("text-4xl font-black", isEvaluated ? "text-emerald-600" : "text-amber-600")}>
                  {isEvaluated ? "GRADED" : "SUBMITTED"}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
              <ClipboardList className="w-6 h-6 text-primary" />
              Question Review
            </h2>
            <div className="space-y-4">
              {questions.map((q, idx) => {
                const response = responses[q._id];
                const isCorrect = isEvaluated && q.question_type === "MCQ" && response === q.options?.[q.correct_option_index || 0];
                const isWrong = isEvaluated && q.question_type === "MCQ" && response && !isCorrect;
                
                return (
                  <Card key={q._id} className={cn(
                    "rounded-none border-2",
                    isCorrect ? "border-emerald-500 bg-emerald-50/10" : 
                    isWrong ? "border-red-500 bg-red-50/10" : "border-border"
                  )}>
                    <CardContent className="p-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Question {idx + 1}</span>
                        {isEvaluated && (
                          <div className={cn(
                            "px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full",
                            isCorrect ? "bg-emerald-500 text-white" : isWrong ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"
                          )}>
                            {isCorrect ? "Correct" : isWrong ? "Wrong" : "Not Evaluated"}
                          </div>
                        )}
                      </div>
                      <p className="text-lg font-bold">{q.question_text}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 bg-muted/50 border border-border">
                          <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">Your Response</p>
                          <p className="font-bold text-sm">{response || "No Response"}</p>
                        </div>
                        {isEvaluated && q.question_type === "MCQ" && (
                          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20">
                            <p className="text-[8px] font-black uppercase tracking-widest text-emerald-700 mb-1">Correct Answer</p>
                            <p className="font-bold text-sm text-emerald-800">{q.options?.[q.correct_option_index || 0]}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // --- EXAM START SCREEN ---
  if (paper?.status === "Generated") {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Card className="max-w-2xl w-full rounded-none border-primary shadow-2xl">
          <CardHeader className="bg-primary/5 border-b border-primary/10 py-8">
            <CardTitle className="text-3xl font-black uppercase tracking-tight text-center">Exam Instructions</CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="p-4 bg-muted/50 border border-border">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Duration</p>
                <p className="text-xl font-black">{blueprint?.duration_minutes} Minutes</p>
              </div>
              <div className="p-4 bg-muted/50 border border-border">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Questions</p>
                <p className="text-xl font-black">{questions.length}</p>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">Rules & Regulations</p>
              <ul className="space-y-3 text-sm font-medium text-muted-foreground">
                <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> Ensure a stable internet connection throughout the attempt.</li>
                <li className="flex gap-3"><AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" /> Do not minimize or switch tabs during the exam.</li>
                <li className="flex gap-3"><XCircle className="w-5 h-5 text-red-500 shrink-0" /> Tab switching or refreshing will terminate your exam.</li>
                <li className="flex gap-3"><Clock className="w-5 h-5 text-primary shrink-0" /> Exam will auto-submit when the timer hits zero.</li>
              </ul>
            </div>
            {blueprint?.instructions && (
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Instructions</p>
                <div className="text-sm font-medium text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 p-4 border border-border">
                  {blueprint.instructions}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="p-8 pt-0">
            <Button onClick={handleStart} className="w-full h-14 rounded-none font-black uppercase tracking-widest text-sm">
              Begin Attempt Now
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // --- EXAM WINDOW UI ---
  const currentQuestion = questions[currentQuestionIndex];

  // Fix: Handle case where currentQuestion is missing but questions might not be empty (e.g. index out of bounds)
  if (!currentQuestion && !loading && !isWaiting) {
     return <div className="h-screen flex items-center justify-center bg-background"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  return (
    <div className="h-screen bg-muted/30 flex flex-col overflow-hidden">
      {/* PROFESSIONAL TOP BAR */}
      <header className="h-20 bg-card border-b-4 border-primary px-8 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 bg-primary/10 flex items-center justify-center border border-primary/20">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight">{blueprint?.name}</h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Question {currentQuestionIndex + 1} of {questions.length}</p>
          </div>
        </div>

        {/* SYNCED TIMER */}
        <div className={cn(
          "px-8 py-3 border-2 flex items-center gap-4 font-black shadow-lg",
          timeLeft < 300 ? "bg-red-500 border-red-600 text-white animate-pulse" : "bg-primary border-primary text-white"
        )}>
          <Timer className="w-6 h-6" />
          <span className="text-3xl tracking-tighter tabular-nums leading-none">{formatTime(timeLeft)}</span>
        </div>

        {/* STUDENT INFO */}
        <div className="flex items-center gap-4 bg-muted/50 p-2 pl-4 border border-border">
          <div className="text-right">
            <p className="text-xs font-black uppercase leading-tight">{user?.full_name}</p>
            <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">{user?.username}</p>
          </div>
          <div className="w-10 h-10 bg-background border border-border flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* MAIN QUESTION AREA */}
        <main className="flex-1 flex flex-col p-8 overflow-y-auto">
          <Card className="rounded-none border-2 border-border shadow-2xl flex-1 flex flex-col">
            <CardHeader className="bg-muted/30 border-b border-border flex flex-row justify-between items-center py-4">
              <div className="flex items-center gap-6">
                <span className="px-3 py-1 bg-primary/10 text-[10px] font-black uppercase tracking-widest text-primary border border-primary/20">Marks: {currentQuestion?.marks}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{currentQuestion?.question_type}</span>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsFeedbackOpen(true)}
                  className="h-8 rounded-none font-black uppercase tracking-widest text-[9px] text-muted-foreground hover:text-red-600"
                >
                  <Flag className="w-3.5 h-3.5 mr-1.5" /> Report Issue
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setFlags({ ...flags, [currentQuestion?._id]: !flags[currentQuestion?._id] })}
                  className={cn(
                    "h-8 rounded-none font-black uppercase tracking-widest text-[9px] border",
                    currentQuestion?._id && flags[currentQuestion._id] ? "text-amber-600 bg-amber-50 border-amber-200" : "text-muted-foreground border-transparent"
                  )}
                >
                  {currentQuestion?._id && flags[currentQuestion._id] ? <BookmarkCheck className="w-3.5 h-3.5 mr-1.5 fill-amber-600" /> : <Bookmark className="w-3.5 h-3.5 mr-1.5" />}
                  {currentQuestion?._id && flags[currentQuestion._id] ? "Marked for Review" : "Mark for Review"}
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="p-10 space-y-10">
              <div className="space-y-6">
                <div className="text-2xl font-bold text-foreground leading-relaxed">
                  {currentQuestion?.question_text}
                </div>
                {currentQuestion?.image_url && (
                  <div className="flex justify-center bg-muted/20 p-6 border-2 border-dashed border-border">
                    <img src={currentQuestion.image_url} alt="Question" className="max-h-[300px] object-contain shadow-md" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {currentQuestion?.options?.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => currentQuestion?._id && setResponses({ ...responses, [currentQuestion._id]: option })}
                    className={cn(
                      "group p-6 text-left border-2 transition-all duration-200 flex items-center gap-5",
                      currentQuestion?._id && responses[currentQuestion._id] === option
                        ? "bg-primary text-primary-foreground border-primary shadow-lg scale-[1.02]"
                        : "bg-background hover:bg-muted/50 border-border hover:border-primary/40"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 shrink-0 flex items-center justify-center font-black text-sm border-2",
                      currentQuestion?._id && responses[currentQuestion._id] === option
                        ? "bg-white text-primary border-white"
                        : "bg-muted text-muted-foreground border-border group-hover:border-primary/40 group-hover:text-primary"
                    )}>
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <span className="font-bold text-lg">{option}</span>
                  </button>
                ))}
              </div>
            </CardContent>

            <CardFooter className="bg-muted/30 border-t border-border p-6 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="rounded-none font-black uppercase tracking-widest text-xs h-12 px-6 border-2"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" /> Previous
                </Button>
                <div className="flex items-center gap-1.5 px-4">
                  {questions.map((_, idx) => (
                    <div 
                      key={idx} 
                      className={cn(
                        "w-2 h-2 rounded-full",
                        idx === currentQuestionIndex ? "bg-primary w-6" : 
                        responses[questions[idx]._id] ? "bg-emerald-500" : "bg-border"
                      )} 
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4">
                {currentQuestionIndex < questions.length - 1 ? (
                  <Button
                    onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                    className="rounded-none font-black uppercase tracking-widest text-xs h-12 px-10 shadow-lg"
                  >
                    Next Question <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="rounded-none font-black uppercase tracking-widest text-xs h-12 px-10 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    Submit Examination
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>
        </main>

        {/* SIDEBAR NAVIGATION */}
        <aside className="w-80 bg-card border-l-4 border-border p-6 flex flex-col gap-6 overflow-y-auto z-10">
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <ClipboardList className="w-4 h-4" /> Exam Progress
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => (
                <button
                  key={q._id}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={cn(
                    "h-12 w-full flex items-center justify-center font-black text-xs border-2 transition-all",
                    currentQuestionIndex === idx ? "border-primary bg-primary text-primary-foreground scale-110 shadow-md" :
                    flags[q._id] ? "border-amber-500 bg-amber-50 text-amber-600" :
                    responses[q._id] ? "border-emerald-500 bg-emerald-50 text-emerald-600" :
                    "border-border bg-muted/20 text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto space-y-4 pt-6 border-t border-border">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
              <span className="text-muted-foreground">Answered</span>
              <span className="text-emerald-600">{Object.keys(responses).length} / {questions.length}</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-500" 
                style={{ width: `${(Object.keys(responses).length / questions.length) * 100}%` }}
              />
            </div>
          </div>
        </aside>
      </div>

      {/* FEEDBACK DIALOG */}
      <Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
        <DialogContent className="rounded-none border-4 border-primary">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Report Question Issue</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">Issue Type</Label>
              <Select value={feedbackType} onValueChange={setFeedbackType}>
                <SelectTrigger className="rounded-none h-12 font-bold border-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Error">Typo or Error</SelectItem>
                  <SelectItem value="Suggestion">Suggestion</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">Your Comments</Label>
              <Textarea 
                placeholder="Explain the issue briefly..." 
                className="rounded-none min-h-[120px] font-bold border-2 resize-none"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFeedbackOpen(false)} className="rounded-none font-black uppercase tracking-widest text-xs h-12">Cancel</Button>
            <Button onClick={handleFeedback} disabled={sendingFeedback} className="rounded-none font-black uppercase tracking-widest text-xs h-12 px-8">
              {sendingFeedback ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />} Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TakeExamPage() {
  return USE_EXAM_V2 ? <TakeExamV2Page /> : <LegacyTakeExamPage />;
}
