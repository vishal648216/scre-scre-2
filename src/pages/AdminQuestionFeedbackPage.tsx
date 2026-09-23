import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Loader2, Search, Filter, AlertCircle, CheckCircle, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface Feedback {
  _id: string;
  question_id: string;
  student_id: string;
  feedback_type: string;
  comment: string;
  created_at: string;
}

interface Question {
  _id: string;
  question_text: string;
  subject_id: string;
}

interface Student {
  _id: string;
  full_name?: string;
  username: string;
}

const AdminQuestionFeedbackPage = () => {
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [feedbackRes, questionsRes, studentsRes] = await Promise.all([
        apiFetch("/api/exam/questions/feedback"),
        apiFetch("/api/exam/questions"),
        apiFetch("/api/students")
      ]);
      
      if (feedbackRes.ok) setFeedback(await feedbackRes.json());
      if (questionsRes.ok) setQuestions(await questionsRes.json());
      if (studentsRes.ok) setStudents(await studentsRes.json());
    } catch (error) {
      toast.error("Failed to load feedback data");
    } finally {
      setLoading(false);
    }
  };

  const filteredFeedback = feedback.filter(f => {
    const question = questions.find(q => q._id === f.question_id);
    const student = students.find(s => s._id === f.student_id);
    const searchLower = search.toLowerCase();
    return (
      question?.question_text.toLowerCase().includes(searchLower) ||
      student?.full_name?.toLowerCase().includes(searchLower) ||
      student?.username.toLowerCase().includes(searchLower) ||
      f.comment.toLowerCase().includes(searchLower) ||
      f.feedback_type.toLowerCase().includes(searchLower)
    );
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-foreground flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-primary" />
              Question Feedback
            </h1>
            <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.2em] mt-1">
              Issues reported by students during exams
            </p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="SEARCH FEEDBACK..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-none text-[10px] font-black uppercase tracking-widest focus:border-primary outline-none transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filteredFeedback.length === 0 ? (
          <Card className="rounded-none border-dashed border-2 bg-muted/30 py-20 text-center">
            <CardContent className="space-y-4">
              <div className="w-16 h-16 bg-muted border border-border mx-auto flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">No feedback reports found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredFeedback.map((f) => {
              const question = questions.find(q => q._id === f.question_id);
              const student = students.find(s => s._id === f.student_id);
              
              return (
                <Card key={f._id} className="rounded-none border-border shadow-sm hover:border-primary/40 transition-all">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border",
                            f.feedback_type === "Error" ? "bg-red-500/10 text-red-600 border-red-500/20" : 
                            f.feedback_type === "Typos" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : 
                            "bg-blue-500/10 text-blue-600 border-blue-500/20"
                          )}>
                            {f.feedback_type}
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">
                            Reported on {format(new Date(f.created_at), "dd MMM yyyy, hh:mm a")}
                          </span>
                          <span className="text-[10px] font-bold text-primary uppercase">
                            By {student?.full_name || student?.username}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Reported Comment</p>
                          <p className="text-sm font-bold text-foreground bg-muted/30 p-4 border border-border italic">
                            "{f.comment}"
                          </p>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Original Question</p>
                          <p className="text-sm font-medium text-foreground line-clamp-2">
                            {question?.question_text || <span className="text-red-500">[Question Deleted]</span>}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex md:flex-col gap-2 justify-end">
                        <Link to="/dashboard/academics/question-bank">
                          <Button variant="outline" size="sm" className="h-9 rounded-none font-black uppercase tracking-widest text-[9px] w-full">
                            <ExternalLink className="w-3.5 h-3.5 mr-2" />
                            Fix Question
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminQuestionFeedbackPage;
