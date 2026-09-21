import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, FileText, User, CheckCircle2, Save, AlertTriangle, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Question {
  _id: string;
  question_text: string;
  question_type: string;
  marks: number;
}

interface StudentPaper {
  _id: string;
  student_id: string;
  status: string;
  questions: { 
    question_id: string; 
    student_response?: string; 
    obtained_marks: number; 
    evaluation_status: string;
    evaluator_remarks?: string;
  }[];
}

interface Student {
  name: string;
  registration_number: string;
}

const ManualEvaluationPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [paper, setPaper] = useState<StudentPaper | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, { marks: number; remarks: string }>>({});

  const toId = (v: any): string => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && "$oid" in v) return v.$oid;
    return String(v || "");
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/exam/papers/${id}`);
      if (res.ok) {
        const data = await res.json();
        
        const normalizedPaper = {
          ...data.paper,
          _id: toId(data.paper._id),
          student_id: toId(data.paper.student_id),
          questions: data.paper.questions.map((q: any) => ({
            ...q,
            question_id: toId(q.question_id)
          }))
        };

        const normalizedQuestions = data.questions.map((q: any) => ({
          ...q,
          _id: toId(q._id)
        }));

        setPaper(normalizedPaper);
        setQuestions(normalizedQuestions);
        
        // Fetch student details
        const studentRes = await apiFetch(`/api/students/${normalizedPaper.student_id}`);
        if (studentRes.ok) setStudent(await studentRes.json());

        // Initialize evaluations state
        const initialEvals: Record<string, { marks: number; remarks: string }> = {};
        normalizedPaper.questions.forEach((q: any) => {
          initialEvals[q.question_id] = {
            marks: q.obtained_marks || 0,
            remarks: q.evaluator_remarks || ""
          };
        });
        setEvaluations(initialEvals);
      }
    } catch (error) {
      toast.error("Failed to load paper for evaluation");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveEvaluation = async () => {
    setSubmitting(true);
    try {
      const payload = Object.entries(evaluations).map(([question_id, evalData]) => ({
        question_id,
        obtained_marks: evalData.marks,
        remarks: evalData.remarks || null
      }));

      const res = await apiFetch(`/api/exam/evaluate/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success("Evaluation saved successfully!");
        navigate("/dashboard/exams/papers");
      } else {
        toast.error("Failed to save evaluation");
      }
    } catch (error) {
      toast.error("An error occurred during evaluation");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-8 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-foreground flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-primary" />
              Manual Evaluation
            </h1>
            <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.2em] mt-1">
              Grading responses for {student?.name} ({student?.registration_number})
            </p>
          </div>
          <Button 
            onClick={handleSaveEvaluation} 
            disabled={submitting}
            className="rounded-none font-black uppercase tracking-widest text-xs h-12 px-8 bg-emerald-600 hover:bg-emerald-700"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Finalize Result
          </Button>
        </div>

        <div className="space-y-6">
          {questions.map((q, idx) => {
            const paperQ = paper?.questions.find(pq => pq.question_id === q._id);
            const isMCQ = q.question_type === "MCQ";
            
            return (
              <Card key={q._id} className="rounded-none border-border shadow-md overflow-hidden">
                <CardHeader className={cn(
                  "border-b border-border py-4 flex flex-row justify-between items-center",
                  isMCQ ? "bg-muted/30" : "bg-primary/5"
                )}>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Question {idx + 1}</span>
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border border-border bg-background">
                      {q.question_type}
                    </span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">Max Marks: {q.marks}</span>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="text-lg font-bold text-foreground">{q.question_text}</div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-border/50">
                    {/* Student Response */}
                    <div className="space-y-3">
                      <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Student Response</Label>
                      <div className="p-4 bg-muted/20 border border-border min-h-[80px] font-medium text-sm">
                        {paperQ?.student_response || <span className="italic text-muted-foreground">No response provided</span>}
                      </div>
                    </div>

                    {/* Grading Controls */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-primary">Awarded Marks</Label>
                        <Input 
                          type="number" 
                          max={q.marks} 
                          min={0}
                          disabled={isMCQ}
                          value={evaluations[q._id]?.marks}
                          onChange={(e) => setEvaluations({
                            ...evaluations,
                            [q._id]: { ...evaluations[q._id], marks: parseFloat(e.target.value) || 0 }
                          })}
                          className="rounded-none border-border font-bold h-12 text-lg"
                        />
                        {isMCQ && <p className="text-[8px] font-bold text-muted-foreground uppercase">Auto-evaluated by system</p>}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Evaluator Remarks</Label>
                        <Textarea 
                          placeholder="Optional feedback..."
                          value={evaluations[q._id]?.remarks}
                          onChange={(e) => setEvaluations({
                            ...evaluations,
                            [q._id]: { ...evaluations[q._id], remarks: e.target.value }
                          })}
                          className="rounded-none border-border font-medium text-xs resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="bg-amber-500/5 border border-amber-500/20 p-6 flex gap-4 items-start">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-amber-800 uppercase">Warning</p>
            <p className="text-xs font-medium text-amber-700/80">Finalizing the result will make it visible to the student and potentially trigger certificate eligibility. Please ensure all marks are entered correctly.</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ManualEvaluationPage;
