import { useState, useEffect, useCallback } from "react";
import { USE_EXAM_V2 } from "@/config/featureFlags";
import { useParams, Link, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, CheckCircle2, XCircle, Award, Printer, ArrowLeft, BarChart3, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface Question {
  _id: string;
  subject_id?: string;
  question_text: string;
  question_type: string;
  marks: number;
  options?: string[];
  correct_option_index?: number;
  options_pool?: { id: string; text: string; image_url?: string }[];
  correct_option_id?: string;
  image_url?: string;
}

interface StudentPaper {
  _id: string;
  status: string;
  total_obtained_marks: number;
  section_wise_marks: Record<string, number>;
  submit_time?: string;
  security_log?: string[];
  questions: { 
    question_id: string; 
    student_response?: string; 
    obtained_marks: number; 
    evaluation_status: string;
    evaluator_remarks?: string;
  }[];
}

interface Blueprint {
  name: string;
  total_marks: number;
  passing_marks?: number;
  minimum_marks?: number;
}

const ExamResultPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    paper: StudentPaper;
    blueprint: Blueprint;
    questions: Question[];
    class_average?: number;
  } | null>(null);

  const [applyingReappear, setApplyingReappear] = useState(false);

  const formatSafeDate = (dateStr: any, formatStr: string = "dd MMM yyyy, hh:mm a") => {
    try {
      if (!dateStr || dateStr === "undefined" || dateStr === "null") return "N/A";
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "N/A";
      return format(d, formatStr);
    } catch (e) {
      return "N/A";
    }
  };

  const fetchData = useCallback(async () => {
    try {
      let res = await apiFetch(`/api/exam/papers/${id}`);
      if (!res.ok) {
        // Always try V2 if V1 fails for result pages to ensure compatibility
        res = await apiFetch(`/api/exam-v2/papers/${id}`);
      }
      if (res.ok) {
        const raw = await res.json();
        // Handle V2 response structure regardless of USE_EXAM_V2 flag for results
        if (raw.paper_template && !raw.blueprint) {
          const pt = raw.paper_template as { name: string; total_marks: number; passing_marks?: number };
          raw.blueprint = {
            name: pt.name,
            total_marks: pt.total_marks,
            passing_marks: pt.passing_marks || Math.ceil(pt.total_marks * 0.35),
          };
        } else if (raw.blueprint && !("total_marks" in raw.blueprint)) {
          const bp = raw.blueprint as { sections?: { rules: { marks_per_question: number; total_questions_to_pick: number }[] }[] };
          const total = (bp.sections || []).reduce(
            (acc, s) => acc + (s.rules || []).reduce((a, r) => a + r.marks_per_question * r.total_questions_to_pick, 0),
            0
          );
          raw.blueprint = { 
            ...raw.blueprint, 
            total_marks: total || 1, 
            passing_marks: (raw.blueprint as any).minimum_marks || (raw.blueprint as any).passing_marks || Math.ceil((total || 1) * 0.35) 
          };
        }
        setData(raw);
      } else {
        // Redirect if not found or unauthorized
        navigate("/dashboard/student/exams");
      }
    } catch (error) {
      toast.error("Failed to load result");
      navigate("/dashboard/student/exams");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading || !data) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Helper to get ID string from either hex string or {$oid: "..."}
  const getIdStr = (id: any) => {
    if (!id) return "";
    if (typeof id === "string") return id;
    if (id.$oid) return id.$oid;
    return id.toString();
  };

  const { paper, questions, class_average } = data;
  let blueprint = data.blueprint;

  // Fallback for missing blueprint data
  if (!blueprint && questions) {
    const totalMarks = questions.reduce((acc, q) => acc + (q.marks || 0), 0);
    const tm = totalMarks || paper.total_obtained_marks || 100;
    blueprint = {
      name: "Examination Result",
      total_marks: tm,
      passing_marks: Math.ceil(tm * 0.35),
    };
  }

  if (!blueprint) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 mx-auto text-yellow-500" />
          <h2 className="text-xl font-bold">Exam Result Data Missing</h2>
          <p className="text-muted-foreground">The system couldn't find the original exam structure. Please contact support.</p>
          <Link to="/dashboard/student/exams">
            <Button>Return to Exams</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const passingMarks = blueprint.passing_marks ?? blueprint.minimum_marks ?? 0;
  const percentage = (paper.total_obtained_marks / (blueprint.total_marks || 1)) * 100;
  const isPassed = paper.total_obtained_marks >= passingMarks;

  const handleReappear = async () => {
    if (!window.confirm("Are you sure you want to apply for a reappear? A fee of ₹500 will be applicable.")) return;
    
    setApplyingReappear(true);
    try {
      // Mock Razorpay Payment for now
      const paymentId = "PAY_" + Math.random().toString(36).substring(7).toUpperCase();
      
      const res = await apiFetch("/api/exam-v2/reappear/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_id: questions[0]?.subject_id || "", // Fallback
          session_id: (paper as any).session_id || "",
          payment_id: paymentId,
          amount: 500.0,
        }),
      });

      if (res.ok) {
        toast.success("Reappear applied and approved! You can now start your second attempt.");
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error(j.message || "Failed to apply reappear");
      }
    } finally {
      setApplyingReappear(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <Link to="/dashboard/student/exams">
            <Button 
              variant="ghost" 
              className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary flex items-center gap-2 px-0"
            >
              <ArrowLeft className="w-3 h-3" /> Back to Dashboard
            </Button>
          </Link>
          <div className="flex gap-4">
            {!isPassed && (
              <Button 
                onClick={handleReappear} 
                disabled={applyingReappear}
                className="bg-red-600 hover:bg-red-700 text-white rounded-none font-black uppercase tracking-widest text-[10px]"
              >
                {applyingReappear ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <AlertTriangle className="w-3.5 h-3.5 mr-2" />}
                Apply Reappear (₹500)
              </Button>
            )}
          </div>
        </div>

        {/* Sticky Marks Bar */}
        <div className="sticky top-0 z-10 bg-primary text-white p-4 shadow-lg flex justify-between items-center border-b-4 border-primary-foreground/20">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Obtained Marks</p>
            <p className="text-2xl font-black leading-none mt-1">{paper.total_obtained_marks} / {blueprint.total_marks}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Result Status</p>
            <p className={cn(
              "text-2xl font-black leading-none mt-1",
              isPassed ? "text-white" : "text-red-200"
            )}>{isPassed ? "PASSED" : "FAILED"}</p>
          </div>
        </div>

        {/* Result Header Card (Hidden in Review Mode if desired, but we keep it for context or modify it) */}
        <Card className={cn(
          "rounded-none border-2 overflow-hidden shadow-xl",
          isPassed ? "border-emerald-500" : "border-red-500"
        )}>
          <CardHeader className={cn(
            "py-12 text-center space-y-4",
            isPassed ? "bg-emerald-500/10" : "bg-red-500/10"
          )}>
            <div className="flex justify-center">
              {isPassed ? (
                <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg">
                  <Award className="w-10 h-10" />
                </div>
              ) : (
                <div className="w-20 h-20 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg">
                  <XCircle className="w-10 h-10" />
                </div>
              )}
            </div>
            <div>
              <h1 className="text-4xl font-black uppercase tracking-tight text-foreground">{isPassed ? "CONGRATULATIONS!" : "EXAMINATION FAILED"}</h1>
              <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm mt-2">{blueprint.name}</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border">
              <div className="p-8 text-center space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Obtained Score</p>
                <p className="text-3xl font-black">{paper.total_obtained_marks} / {blueprint.total_marks}</p>
                <p className="text-[10px] font-bold text-muted-foreground mt-2">Passing Marks: {passingMarks}</p>
              </div>
              <div className="p-8 text-center space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Percentage</p>
                <p className="text-3xl font-black text-primary">{percentage.toFixed(1)}%</p>
              </div>
              <div className="p-8 text-center space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Class Average</p>
                <p className="text-3xl font-black text-orange-500">{class_average ? class_average.toFixed(1) : "N/A"}</p>
              </div>
              <div className="p-8 text-center space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</p>
                <p className={cn(
                  "text-3xl font-black uppercase",
                  isPassed ? "text-emerald-600" : "text-red-600"
                )}>{isPassed ? "PASSED" : "FAILED"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="rounded-none border-border shadow-md">
            <CardHeader className="bg-muted/30 border-b border-border py-4">
              <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" /> Section-wise Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {Object.entries(paper.section_wise_marks || {}).map(([sectionId, marks]) => (
                <div key={sectionId} className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                    <span>{sectionId}</span>
                    <span>{marks} Marks</span>
                  </div>
                  <div className="h-2 bg-muted border border-border overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${(marks / blueprint.total_marks) * 100}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-none border-border shadow-md">
            <CardHeader className="bg-muted/30 border-b border-border py-4">
              <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Attempt Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Submitted On</span>
                <span className="text-xs font-black">{formatSafeDate(paper.submit_time)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Passing Threshold</span>
                <span className="text-xs font-black">{blueprint.passing_marks} Marks</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Total Questions</span>
                <span className="text-xs font-black">{questions.length}</span>
              </div>
              {paper.security_log && paper.security_log.length > 0 && (
                <div className="pt-2">
                  <span className="text-[10px] font-bold uppercase text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Security Warnings: {paper.security_log.length}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between border-b-2 border-primary/10 pb-4">
            <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" /> Question-wise Review
            </h2>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500" />
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Correct</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500" />
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Incorrect</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-8">
            {questions.map((q, idx) => {
              const isMCQ = q.question_type === "MCQ";
              const paperQ = paper.questions.find(pq => getIdStr(pq.question_id) === getIdStr(q._id));
              const earned = paperQ?.obtained_marks || 0;
              const hasResponse = paperQ?.student_response && paperQ.student_response !== "";
              
              // Correctness check for V1 and V2
              const isCorrect = isMCQ && hasResponse && (
                (q.correct_option_index !== undefined && parseInt(paperQ?.student_response || "-1") === q.correct_option_index) ||
                (q.correct_option_id !== undefined && paperQ?.student_response === q.correct_option_id) ||
                (earned > 0) // Fallback for mixed data
              );
              
              return (
                <Card key={q._id} className={cn(
                  "rounded-none border shadow-sm overflow-hidden",
                  earned > 0 ? "border-emerald-500/20" : hasResponse ? "border-red-500/20" : "border-border"
                )}>
                  <CardHeader className="bg-muted/30 border-b border-border py-3 flex flex-row justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "w-6 h-6 flex items-center justify-center font-black text-[10px] border",
                        earned > 0 ? "bg-emerald-500 text-white border-emerald-500" : "bg-muted text-muted-foreground border-border"
                      )}>
                        {idx + 1}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{q.question_type}</span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Marks: {earned} / {q.marks}</span>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="text-sm font-bold text-foreground leading-relaxed">
                      {q.question_text}
                    </div>
                    
                    {q.image_url && (
                      <div className="p-1 border border-border bg-muted/10 inline-block max-w-full">
                        <img src={q.image_url} alt="Question attachment" className="max-h-[200px] w-auto object-contain" />
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                      <div className="space-y-2">
                        <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Your Response</p>
                        {isMCQ ? (
                          <div className={cn(
                            "p-3 text-xs font-bold border",
                            !hasResponse ? "bg-muted/20 border-border italic text-muted-foreground" :
                            isCorrect ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" : 
                            "bg-red-500/10 border-red-500/20 text-red-700"
                          )}>
                            {(() => {
                              const response = paperQ?.student_response;
                              if (q.options_pool) {
                                // Try finding by ID
                                const selected = q.options_pool.find(o => o.id === response);
                                if (selected) return selected.text;
                                
                                // Resilience fallback: maybe response IS the text
                                if (response && response !== "") return response;
                                
                                return "Not Answered";
                              }
                              const idx = parseInt(response || "-1");
                              return q.options && q.options[idx] ? q.options[idx] : (response || "Not Answered");
                            })()}
                          </div>
                        ) : (
                          <div className="p-3 text-xs font-medium border bg-muted/10 border-border max-h-40 overflow-y-auto">
                            {paperQ?.student_response || <span className="italic text-muted-foreground">No response provided</span>}
                            {!paperQ?.student_response && earned === 0 && <span className="italic text-red-600"> (Skipped)</span>}
                            {paperQ?.student_response && earned === 0 && <span className="italic text-red-600"> (Incorrect)</span>}
                          </div>
                        )}
                      </div>

                      {isMCQ && (q.correct_option_index !== undefined || q.correct_option_id !== undefined) && (
                        <div className="space-y-2">
                          <p className="text-[8px] font-black uppercase tracking-widest text-emerald-600">Correct Answer</p>
                          <div className="p-3 text-xs font-bold border bg-emerald-500/10 border-emerald-500/20 text-emerald-700">
                            {(() => {
                              if (q.correct_option_id && q.options_pool) {
                                const correct = q.options_pool.find(o => o.id === q.correct_option_id);
                                return correct ? correct.text : "Unknown";
                              }
                              if (q.correct_option_index !== undefined && q.options) {
                                return q.options[q.correct_option_index] || "Unknown";
                              }
                              return "Unknown";
                            })()}
                          </div>
                        </div>
                      )}
                      
                      {!isMCQ && paperQ?.evaluator_remarks && (
                        <div className="space-y-2">
                          <p className="text-[8px] font-black uppercase tracking-widest text-primary">Evaluator Remarks</p>
                          <div className="p-3 text-xs font-medium border bg-primary/5 border-primary/20 text-primary">
                            {paperQ.evaluator_remarks}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ExamResultPage;
