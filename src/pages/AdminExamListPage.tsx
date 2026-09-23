import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Loader2, Search, Filter, Clock, User, CheckCircle2, AlertCircle, Eye, RotateCcw, Trash2, Printer, Ticket } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface StudentPaper {
  _id: string;
  blueprint_id: string;
  student_id: string;
  status: string;
  total_obtained_marks: number;
  created_at: string;
  submit_time?: string;
}

interface Blueprint {
  _id: string;
  name: string;
}

interface Student {
  _id: string;
  name?: string;
  full_name?: string;
  registration_number?: string;
  enrollment_number?: string;
  roll_number?: string;
}

const AdminExamListPage = () => {
  const [loading, setLoading] = useState(true);
  const [papers, setPapers] = useState<StudentPaper[]>([]);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");

  const toId = (v: any): string => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && "$oid" in v) return v.$oid;
    return String(v || "");
  };

  const formatSafeDate = (dateStr: any, formatStr: string = "dd MMM yyyy") => {
    try {
      if (!dateStr || dateStr === "undefined" || dateStr === "null") return "N/A";
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "N/A";
      return format(d, formatStr);
    } catch (e) {
      return "N/A";
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [papersRes, blueprintsRes, studentsRes] = await Promise.all([
        apiFetch("/api/exam/papers"),
        apiFetch("/api/exam/blueprints"),
        apiFetch("/api/students")
      ]);
      
      if (papersRes.ok) {
        const raw = await papersRes.json();
        setPapers(raw.map((p: any) => ({
          ...p,
          _id: toId(p._id),
          student_id: toId(p.student_id),
          blueprint_id: toId(p.blueprint_id)
        })));
      }
      if (blueprintsRes.ok) {
        const raw = await blueprintsRes.json();
        setBlueprints(raw.map((b: any) => ({ ...b, _id: toId(b._id) })));
      }
      if (studentsRes.ok) {
        const raw = await studentsRes.json();
        setStudents(raw.map((s: any) => ({ ...s, _id: toId(s._id) })));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load exam papers");
    } finally {
      setLoading(false);
    }
  };

  const filteredPapers = papers.filter(p => {
    const student = students.find(s => s._id === p.student_id);
    const blueprint = blueprints.find(b => b._id === p.blueprint_id);
    const searchLower = search.toLowerCase();
    
    const studentName = (student?.full_name || student?.name || "").toLowerCase();
    const regNo = (student?.enrollment_number || student?.registration_number || "").toLowerCase();
    const blueprintName = (blueprint?.name || "").toLowerCase();

    return (
      studentName.includes(searchLower) ||
      regNo.includes(searchLower) ||
      blueprintName.includes(searchLower)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Generated": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "InProgress": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "Submitted": return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "Evaluated": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const handleReset = async (id: string) => {
    if (!confirm("Are you sure you want to reset this attempt? All student responses for this attempt will be permanently deleted.")) return;
    try {
      const res = await apiFetch(`/api/exam/papers/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Exam attempt reset successfully");
        fetchData();
      }
    } catch (error) {
      toast.error("Failed to reset attempt");
    }
  };

  const printPaper = async (paperId: string) => {
    window.open(`/dashboard/exams/print/${paperId}`, '_blank');
  };

  const downloadHallTicket = async (studentId: string) => {
    try {
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

  return (
    <DashboardLayout>
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-foreground flex items-center gap-3">
              <FileText className="w-8 h-8 text-primary" />
              Allotted Exams
            </h1>
            <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.2em] mt-1">
              Monitor and manage student examination attempts
            </p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="SEARCH STUDENT OR EXAM..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-none text-[10px] font-black uppercase tracking-widest focus:border-primary outline-none transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filteredPapers.length === 0 ? (
          <Card className="rounded-none border-dashed border-2 bg-muted/30 py-20 text-center">
            <CardContent className="space-y-4">
              <div className="w-16 h-16 bg-muted border border-border mx-auto flex items-center justify-center">
                <Filter className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">No exam papers found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPapers.map((paper) => {
              const student = students.find(s => s._id === paper.student_id);
              const blueprint = blueprints.find(b => b._id === paper.blueprint_id);
              
              return (
                <Card key={paper._id} className="rounded-none border-border shadow-md hover:border-primary/40 transition-all group overflow-hidden">
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="w-12 h-12 bg-primary/5 border border-primary/10 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-2 py-1 border",
                        getStatusColor(paper.status)
                      )}>
                        {paper.status}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-lg font-black uppercase tracking-tight text-foreground truncate">
                        {blueprint?.name || "Unknown Exam"}
                      </h3>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">
                          {student?.full_name || student?.name || "Unknown Student"}
                        </span>
                      </div>
                      <p className="text-[9px] font-bold text-muted-foreground/60 uppercase">
                        ID: {student?.enrollment_number || student?.roll_number || student?.registration_number || "N/A"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Generated On</p>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3 text-primary/60" />
                          <span className="text-xs font-bold text-foreground">
                            {formatSafeDate(paper.created_at)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Score</p>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600/60" />
                          <span className="text-xs font-bold text-foreground">
                            {paper.status === "Evaluated" ? paper.total_obtained_marks : "Pending"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      {paper.status === "Submitted" ? (
                        <Link to={`/dashboard/exams/evaluate/${paper._id}`} className="flex-1">
                          <Button className="w-full rounded-none font-black uppercase tracking-widest text-[10px] bg-amber-500 hover:bg-amber-600 text-white">
                            <Eye className="w-3.5 h-3.5 mr-2" />
                            Evaluate
                          </Button>
                        </Link>
                      ) : (
                        <Link to={`/dashboard/exams/results/${paper._id}`} className="flex-1">
                          <Button variant="outline" className="w-full rounded-none font-black uppercase tracking-widest text-[10px]">
                            <Eye className="w-3.5 h-3.5 mr-2" />
                            Details
                          </Button>
                        </Link>
                      )}
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => downloadHallTicket(paper.student_id)}
                        title="Download Hall Ticket"
                        className="rounded-none border-border text-muted-foreground hover:text-primary"
                      >
                        <Ticket className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => printPaper(paper._id)}
                        className="rounded-none border-border text-muted-foreground hover:text-primary"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => handleReset(paper._id)}
                        className="rounded-none border-destructive/20 text-destructive hover:bg-destructive hover:text-white"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
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
};

export default AdminExamListPage;
