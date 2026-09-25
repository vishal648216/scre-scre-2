import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Loader2, Search, Filter, AlertCircle, CheckCircle, Trash2, ExternalLink, AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
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
  status?: string;
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
  const [statusFilter, setStatusFilter] = useState("all");

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

  const handleResolve = (id: string, newStatus: string) => {
    setFeedback(prev => prev.map(f => f._id === id ? { ...f, status: newStatus } : f));
    toast.success(`Feedback status updated to ${newStatus}`);
  };

  const stats = useMemo(() => {
    const total = feedback.length;
    const pending = feedback.filter(f => !f.status || f.status === "pending").length;
    const resolved = feedback.filter(f => f.status === "resolved").length;
    const errors = feedback.filter(f => f.feedback_type?.toLowerCase() === "error").length;
    return { total, pending, resolved, errors };
  }, [feedback]);

  const filteredFeedback = useMemo(() => {
    return feedback.filter(f => {
      const question = questions.find(q => q._id === f.question_id);
      const student = students.find(s => s._id === f.student_id);
      const searchLower = search.toLowerCase();

      if (statusFilter === "pending" && f.status === "resolved") return false;
      if (statusFilter === "resolved" && f.status !== "resolved") return false;
      if (statusFilter === "error" && f.feedback_type?.toLowerCase() !== "error") return false;

      return (
        question?.question_text?.toLowerCase().includes(searchLower) ||
        student?.full_name?.toLowerCase().includes(searchLower) ||
        student?.username?.toLowerCase().includes(searchLower) ||
        f.comment?.toLowerCase().includes(searchLower) ||
        f.feedback_type?.toLowerCase().includes(searchLower)
      );
    });
  }, [feedback, questions, students, search, statusFilter]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16 relative">
        {/* Ambient background glows */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />

        {/* Page Header Banner */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <MessageSquare className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-heading font-black text-2xl md:text-3xl text-white uppercase tracking-tight">
                  Question Feedback Desk
                </h1>
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                  {feedback.length} Reports
                </span>
              </div>
              <p className="text-slate-400 mt-1 text-xs md:text-sm font-medium">
                Review &amp; resolve question error reports submitted by candidates during live examinations.
              </p>
            </div>
          </div>

          <div className="relative w-full md:w-80 shrink-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search feedback reports..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs font-semibold text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-5 shadow-2xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Reports</p>
            <p className="text-3xl font-black text-white mt-1">{stats.total}</p>
          </div>
          <div className="bg-slate-900/80 backdrop-blur-2xl border border-amber-500/30 rounded-3xl p-5 shadow-2xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Pending Action</p>
            <p className="text-3xl font-black text-amber-300 mt-1">{stats.pending}</p>
          </div>
          <div className="bg-slate-900/80 backdrop-blur-2xl border border-emerald-500/30 rounded-3xl p-5 shadow-2xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Resolved</p>
            <p className="text-3xl font-black text-emerald-300 mt-1">{stats.resolved}</p>
          </div>
          <div className="bg-slate-900/80 backdrop-blur-2xl border border-rose-500/30 rounded-3xl p-5 shadow-2xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400">Question Errors</p>
            <p className="text-3xl font-black text-rose-300 mt-1">{stats.errors}</p>
          </div>
        </div>

        {/* Filter Tabs Toolbar */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-2 shadow-2xl flex gap-2 overflow-x-auto">
          {[
            { id: "all", label: "All Reports" },
            { id: "pending", label: "Pending" },
            { id: "resolved", label: "Resolved" },
            { id: "error", label: "Factual Errors" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                "px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all",
                statusFilter === tab.id
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Feedback Reports...</p>
          </div>
        ) : filteredFeedback.length === 0 ? (
          <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl p-16 flex flex-col items-center text-center">
            <CheckCircle className="w-12 h-12 text-emerald-400 mb-4 opacity-60" />
            <h3 className="text-lg font-bold text-white uppercase tracking-tight">No Reports Found</h3>
            <p className="text-slate-400 text-xs max-w-sm mt-1">
              No student feedback reports matched your current filter criteria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredFeedback.map((f) => {
              const question = questions.find(q => q._id === f.question_id);
              const student = students.find(s => s._id === f.student_id);
              const isResolved = f.status === "resolved";

              return (
                <div
                  key={f._id}
                  className={cn(
                    "bg-slate-900/80 backdrop-blur-2xl border rounded-3xl p-6 shadow-2xl transition-all duration-300",
                    isResolved ? "border-emerald-500/30" : "border-indigo-500/20 hover:border-indigo-500/40"
                  )}
                >
                  <div className="flex flex-col md:flex-row gap-6 justify-between">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border backdrop-blur-md",
                          f.feedback_type === "Error" ? "bg-rose-500/10 border-rose-500/30 text-rose-400" : 
                          f.feedback_type === "Typos" ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : 
                          "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                        )}>
                          {f.feedback_type}
                        </span>

                        {isResolved ? (
                          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 animate-pulse" /> Pending Review
                          </span>
                        )}

                        <span className="text-xs font-medium text-slate-400">
                          Reported {format(new Date(f.created_at), "dd MMM yyyy, hh:mm a")}
                        </span>

                        <span className="text-xs font-bold text-indigo-300">
                          By {student?.full_name || student?.username}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Student Issue Description</p>
                        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-sm font-semibold text-slate-200 italic">
                          "{f.comment}"
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Target Question Content</p>
                        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs font-mono text-slate-300">
                          {question?.question_text || <span className="text-rose-400 italic">[Question Removed from Question Bank]</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex md:flex-col gap-3 justify-center shrink-0">
                      {!isResolved ? (
                        <button
                          onClick={() => handleResolve(f._id, "resolved")}
                          className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Mark Resolved
                        </button>
                      ) : (
                        <button
                          onClick={() => handleResolve(f._id, "pending")}
                          className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs uppercase tracking-wider transition-all"
                        >
                          Re-open Case
                        </button>
                      )}
                      <Link to="/dashboard/academics/question-bank">
                        <button className="w-full px-5 py-3 rounded-2xl bg-slate-800/80 hover:bg-indigo-600/20 text-indigo-300 border border-slate-700/60 hover:border-indigo-500/40 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all">
                          <ExternalLink className="w-4 h-4" /> Open Bank
                        </button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminQuestionFeedbackPage;

