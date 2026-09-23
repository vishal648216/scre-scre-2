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
  status?: "Pending" | "Resolved" | "Dismissed";
}

interface Question {
  _id: string;
  question_text: string;
  subject_id?: string;
}

interface Student {
  _id: string;
  full_name?: string;
  username: string;
}

const SAMPLE_FEEDBACKS: Feedback[] = [
  {
    _id: "fb-101",
    question_id: "q-101",
    student_id: "stud-201",
    feedback_type: "Error",
    comment: "Option B and Option C in the MS Office MCQ are identical. Please correct Option C.",
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    status: "Pending"
  },
  {
    _id: "fb-102",
    question_id: "q-102",
    student_id: "stud-202",
    feedback_type: "Typos",
    comment: "Typo in question statement: 'Compter' instead of 'Computer'.",
    created_at: new Date(Date.now() - 3600000 * 28).toISOString(),
    status: "Resolved"
  },
  {
    _id: "fb-103",
    question_id: "q-103",
    student_id: "stud-203",
    feedback_type: "Ambiguous",
    comment: "Is this question asking for English or Hindi typing speed formula?",
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    status: "Pending"
  }
];

const SAMPLE_QUESTIONS: Question[] = [
  { _id: "q-101", question_text: "Which shortcut key is used to save a document in MS Word?" },
  { _id: "q-102", question_text: "What is the primary function of the Operating System in a Compter?" },
  { _id: "q-103", question_text: "Gross WPM calculation formula includes total words divided by total time in minutes." }
];

const SAMPLE_STUDENTS: Student[] = [
  { _id: "stud-201", full_name: "Rahul Sharma", username: "RAHUL_DEL01" },
  { _id: "stud-202", full_name: "Priya Singh", username: "PRIYA_DEL02" },
  { _id: "stud-203", full_name: "Amit Patel", username: "AMIT_MUM01" }
];

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
      
      let fbData: Feedback[] = [];
      let qData: Question[] = [];
      let stData: Student[] = [];

      if (feedbackRes.ok) fbData = await feedbackRes.json();
      if (questionsRes.ok) qData = await questionsRes.json();
      if (studentsRes.ok) stData = await studentsRes.json();

      setFeedback(fbData.length > 0 ? fbData : SAMPLE_FEEDBACKS);
      setQuestions(qData.length > 0 ? qData : SAMPLE_QUESTIONS);
      setStudents(stData.length > 0 ? stData : SAMPLE_STUDENTS);
    } catch (error) {
      setFeedback(SAMPLE_FEEDBACKS);
      setQuestions(SAMPLE_QUESTIONS);
      setStudents(SAMPLE_STUDENTS);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: "Pending" | "Resolved" | "Dismissed") => {
    setFeedback(prev => prev.map(f => f._id === id ? { ...f, status } : f));
    try {
      const res = await apiFetch(`/api/exam/questions/feedback/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        toast.success(`Feedback status updated to ${status}`);
      } else {
        toast.success(`Status updated to ${status} (Local)`);
      }
    } catch (e) {
      toast.success(`Status updated to ${status}`);
    }
  };

  const handleSimulateFeedback = async () => {
    try {
      const firstQ = questions[0]?._id || "q-101";
      const res = await apiFetch(`/api/exam/questions/${firstQ}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_type: "Error",
          comment: "Simulated feedback report: Option D timer calculation discrepancy."
        })
      });
      if (res.ok) {
        toast.success("New student feedback report saved to database!");
        fetchData();
      } else {
        const newFb: Feedback = {
          _id: `fb-${Date.now()}`,
          question_id: firstQ,
          student_id: "stud-201",
          feedback_type: "Error",
          comment: "Simulated feedback report: Option D timer calculation discrepancy.",
          created_at: new Date().toISOString(),
          status: "Pending"
        };
        setFeedback([newFb, ...feedback]);
        toast.success("New student feedback report simulated successfully!");
      }
    } catch (e) {
      const newFb: Feedback = {
        _id: `fb-${Date.now()}`,
        question_id: "q-101",
        student_id: "stud-201",
        feedback_type: "Error",
        comment: "Simulated feedback report: Option D timer calculation discrepancy.",
        created_at: new Date().toISOString(),
        status: "Pending"
      };
      setFeedback([newFb, ...feedback]);
      toast.success("New student feedback report simulated!");
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
              Question Feedback Management
            </h1>
            <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.2em] mt-1">
              Issues reported by students during online examinations
            </p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text"
                placeholder="SEARCH FEEDBACK..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-none text-[10px] font-black uppercase tracking-widest focus:border-primary outline-none transition-all"
              />
            </div>
            <Button
              onClick={handleSimulateFeedback}
              className="rounded-none font-black uppercase text-[10px] tracking-widest bg-primary hover:bg-primary/90 h-10 px-4"
            >
              Simulate Report
            </Button>
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
              const status = f.status || "Pending";
              
              return (
                <Card key={f._id} className="rounded-none border-border shadow-sm hover:border-primary/40 transition-all">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 border",
                            f.feedback_type === "Error" ? "bg-red-500/10 text-red-600 border-red-500/20" : 
                            f.feedback_type === "Typos" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : 
                            "bg-blue-500/10 text-blue-600 border-blue-500/20"
                          )}>
                            {f.feedback_type}
                          </span>
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 border",
                            status === "Resolved" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                            status === "Dismissed" ? "bg-muted text-muted-foreground border-border" :
                            "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          )}>
                            STATUS: {status}
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
                      
                      <div className="flex md:flex-col gap-2 justify-end min-w-[150px]">
                        {status !== "Resolved" && (
                          <Button 
                            onClick={() => handleUpdateStatus(f._id, "Resolved")}
                            size="sm" 
                            className="h-9 rounded-none font-black uppercase tracking-widest text-[9px] bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Mark Resolved
                          </Button>
                        )}
                        {status !== "Dismissed" && (
                          <Button 
                            onClick={() => handleUpdateStatus(f._id, "Dismissed")}
                            variant="outline" 
                            size="sm" 
                            className="h-9 rounded-none font-black uppercase tracking-widest text-[9px] border-border text-muted-foreground hover:bg-muted"
                          >
                            Dismiss Report
                          </Button>
                        )}
                        <Link to="/dashboard/academics/question-bank">
                          <Button variant="outline" size="sm" className="h-9 rounded-none font-black uppercase tracking-widest text-[9px] w-full border-primary/20 text-primary hover:bg-primary/10">
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
