import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, Loader2, Search, Filter, Clock, User, CheckCircle2, Download, Printer, Eye } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface StudentPaper {
  _id: string;
  blueprint_id: string;
  student_id: string;
  status: string;
  total_obtained_marks: number;
  submit_time?: string;
}

interface Blueprint {
  _id: string;
  name: string;
  total_marks: number;
  passing_marks: number;
}

interface Student {
  _id: string;
  name: string;
  registration_number: string;
}

const AdminExamResultsPage = () => {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [papers, setPapers] = useState<StudentPaper[]>([]);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewFormat, setPreviewFormat] = useState<"marksheet" | "scorecard">("marksheet");

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
      const [papersRes, blueprintsRes, studentsRes, templatesRes, v2PapersRes, v2ExamsRes, v2TemplatesRes] = await Promise.all([
        apiFetch("/api/exam/papers"),
        apiFetch("/api/exam/blueprints"),
        apiFetch("/api/students"),
        apiFetch("/api/templates"),
        apiFetch("/api/exam-v2/papers"),
        apiFetch("/api/exam-v2/exams"),
        apiFetch("/api/exam-v2/paper-templates")
      ]);
      
      let allPapers: StudentPaper[] = [];
      let allBlueprints: Blueprint[] = [];

      if (papersRes.ok) {
        const raw: any[] = await papersRes.json();
        allPapers = raw.map(p => ({
          ...p,
          _id: toId(p._id),
          student_id: toId(p.student_id),
          blueprint_id: toId(p.blueprint_id)
        }));
      }

      if (blueprintsRes.ok) {
        const raw = await blueprintsRes.json();
        allBlueprints = raw.map((b: any) => ({ ...b, _id: toId(b._id) }));
      }

      if (v2PapersRes.ok && v2ExamsRes.ok && v2TemplatesRes.ok) {
        const v2PapersRaw: any[] = await v2PapersRes.json();
        const v2Exams: any[] = await v2ExamsRes.json();
        const v2Templates: any[] = await v2TemplatesRes.json();

        const v2PapersConverted: StudentPaper[] = v2PapersRaw.map(p => ({
          _id: toId(p._id),
          student_id: toId(p.student_id),
          blueprint_id: toId(p.paper_template_id), // V2 uses paper_template_id as blueprint_id for results display
          status: p.status,
          total_obtained_marks: p.total_obtained_marks,
          submit_time: p.submit_time
        }));

        const v2BlueprintsConverted: Blueprint[] = v2Templates.map(t => ({
          _id: toId(t._id),
          name: t.name,
          total_marks: t.exam_marks || t.total_marks || 0,
          passing_marks: t.passing_marks || ((t.exam_marks || t.total_marks || 0) * 0.4) // Fallback passing marks
        }));

        allPapers = [...allPapers, ...v2PapersConverted];
        allBlueprints = [...allBlueprints, ...v2BlueprintsConverted];
      }

      // Filter evaluated papers (case-insensitive)
      setPapers(allPapers.filter(p => p.status?.toLowerCase() === "evaluated"));
      setBlueprints(allBlueprints);

      if (studentsRes.ok) {
        const raw = await studentsRes.json();
        setStudents(raw.map((s: any) => ({ 
          ...s, 
          _id: toId(s._id),
          name: s.full_name || s.name || s.username || "Unknown",
          registration_number: s.username || s.registration_number || "N/A"
        })));
      }
      if (templatesRes.ok) setTemplates(await templatesRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load exam results");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMarksheet = async (studentId: string, mode: "single" | "consolidated" = "single", paperId?: string) => {
    const marksheetTemplate = templates.find(t => t.template_type === "Marksheet");
    if (!marksheetTemplate) {
      toast.error("No marksheet found. Please create one in Designer.");
      return;
    }

    setGenerating(paperId || studentId);
    try {
      const response = await apiFetch("/api/certificates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: marksheetTemplate._id,
          student_ids: [studentId],
          issue_date: format(new Date(), "yyyy-MM-dd"),
          mode
        })
      });

      if (response.ok) {
        toast.success(`${mode === "consolidated" ? "Consolidated " : ""}Marksheet generated successfully`);
      } else {
        toast.error("Failed to generate marksheet");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setGenerating(null);
    }
  };

  const filteredPapers = papers.filter(p => {
    const student = students.find(s => s._id === p.student_id);
    const blueprint = blueprints.find(b => b._id === p.blueprint_id);
    const searchLower = search.toLowerCase();
    
    const studentName = student?.name?.toLowerCase() || "";
    const regNo = student?.registration_number?.toLowerCase() || "";
    const blueprintName = blueprint?.name?.toLowerCase() || "";

    return (
      studentName.includes(searchLower) ||
      regNo.includes(searchLower) ||
      blueprintName.includes(searchLower)
    );
  });

  const exportResults = () => {
    // Basic CSV export
    const headers = ["Student Name", "Reg Number", "Exam Name", "Score", "Total Marks", "Percentage", "Result", "Date"];
    const rows = filteredPapers.map(p => {
      const s = students.find(st => st._id === p.student_id);
      const b = blueprints.find(bl => bl._id === p.blueprint_id);
      const percentage = b ? ((p.total_obtained_marks / b.total_marks) * 100).toFixed(1) : "0";
      const isPassed = b ? p.total_obtained_marks >= b.passing_marks : false;
      return [
        s?.name || "Unknown",
        s?.registration_number || "N/A",
        b?.name || "Unknown",
        p.total_obtained_marks,
        b?.total_marks || 0,
        `${percentage}%`,
        isPassed ? "PASS" : "FAIL",
        formatSafeDate(p.submit_time, "yyyy-MM-dd")
      ];
    });

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `exam_results_${format(new Date(), "yyyyMMdd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-foreground flex items-center gap-3">
              <Award className="w-8 h-8 text-primary" />
              Examination Results
            </h1>
            <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.2em] mt-1">
              Consolidated academic performance records
            </p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text"
                placeholder="SEARCH STUDENT OR EXAM..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-none text-[10px] font-black uppercase tracking-widest focus:border-primary outline-none transition-all"
              />
            </div>
            <Button 
              variant="outline" 
              onClick={() => setPreviewDialogOpen(true)}
              className="rounded-none font-black uppercase tracking-widest text-[10px] h-10 px-6 border-primary/40 text-primary hover:bg-primary/10"
            >
              <Eye className="w-3.5 h-3.5 mr-2" />
              Preview Result Format
            </Button>
            <Button 
              variant="outline" 
              onClick={exportResults}
              className="rounded-none font-black uppercase tracking-widest text-[10px] h-10 px-6"
            >
              <Download className="w-3.5 h-3.5 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filteredPapers.length === 0 ? (
          <Card className="rounded-none border-dashed border-2 bg-muted/30 py-16 text-center">
            <CardContent className="space-y-6">
              <div className="w-16 h-16 bg-muted border border-border mx-auto flex items-center justify-center">
                <Award className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-foreground font-black uppercase tracking-widest text-sm">No evaluated results found</p>
                <p className="text-muted-foreground text-xs">Evaluated student exam papers and generated marksheets will appear here automatically.</p>
              </div>
              <Button 
                onClick={() => setPreviewDialogOpen(true)}
                className="rounded-none font-black uppercase tracking-widest text-xs h-11 px-8 bg-primary hover:bg-primary/90"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Sample Result & Marksheet Format
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-card border border-border overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest">Student Details</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest">Examination</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center">Score</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center">Result</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center">Date</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPapers.map((paper) => {
                  const student = students.find(s => s._id === paper.student_id);
                  const blueprint = blueprints.find(b => b._id === paper.blueprint_id);
                  const isPassed = blueprint ? paper.total_obtained_marks >= (blueprint.passing_marks || 0) : false;
                  
                  return (
                    <tr key={paper._id} className="hover:bg-muted/30 transition-colors group">
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <p className="text-sm font-black uppercase tracking-tight">
                            {student?.name || (paper.student_id ? `ID: ${paper.student_id.slice(-6)}` : "Unknown")}
                          </p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">
                            Reg: {student?.registration_number || "N/A"}
                          </p>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-xs font-bold text-foreground">{blueprint?.name || "Deleted Exam"}</p>
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="text-sm font-black">{paper.total_obtained_marks}</span>
                          <span className="text-[8px] font-bold text-muted-foreground uppercase">out of {blueprint?.total_marks}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-widest px-2 py-1 border",
                          isPassed ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-red-500/10 text-red-600 border-red-500/20"
                        )}>
                          {isPassed ? "PASSED" : "FAILED"}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">
                          {formatSafeDate(paper.submit_time)}
                        </p>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={generating === paper._id || generating === paper.student_id}
                            onClick={() => handleGenerateMarksheet(paper.student_id, "single", paper._id)}
                            className="h-8 rounded-none font-black uppercase tracking-widest text-[9px] border-primary/20 hover:border-primary text-primary"
                          >
                            {generating === paper._id ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Printer className="w-3 h-3 mr-1.5" />}
                            Marksheet
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={generating === paper.student_id}
                            onClick={() => handleGenerateMarksheet(paper.student_id, "consolidated")}
                            className="h-8 rounded-none font-black uppercase tracking-widest text-[9px] border-orange-500/20 hover:border-orange-500 text-orange-600"
                          >
                            {generating === paper.student_id ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Award className="w-3 h-3 mr-1.5" />}
                            Consolidated
                          </Button>
                          <Link to={`/dashboard/exams/results/${paper._id}`}>
                            <Button variant="outline" size="sm" className="h-8 rounded-none font-black uppercase tracking-widest text-[9px]">
                              <Eye className="w-3 h-3 mr-1.5" /> View
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      {/* Result & Marksheet Format Preview Dialog */}
        <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
          <DialogContent className="max-w-4xl rounded-none border border-border bg-card p-6 max-h-[90vh] overflow-y-auto">
            <DialogHeader className="space-y-1 text-left border-b border-border pb-4">
              <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  Official Examination Result & Marksheet Format
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Preview how student marksheets and exam scorecards are generated and printed
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Format selector */}
              <div className="flex items-center gap-2 bg-muted p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setPreviewFormat("marksheet")}
                  className={cn(
                    "flex-1 py-2 text-xs font-black uppercase tracking-widest transition-all",
                    previewFormat === "marksheet" ? "bg-background text-primary shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Official Marksheet (Detailed)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFormat("scorecard")}
                  className={cn(
                    "flex-1 py-2 text-xs font-black uppercase tracking-widest transition-all",
                    previewFormat === "scorecard" ? "bg-background text-primary shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Online Exam Scorecard (Summary)
                </button>
              </div>

              {previewFormat === "marksheet" ? (
                /* Sample Marksheet Preview */
                <div className="border border-primary/30 p-8 bg-background shadow-md relative space-y-6">
                  <div className="border-4 border-double border-primary/40 p-6 space-y-6">
                    {/* Header */}
                    <div className="text-center space-y-2 border-b-2 border-primary/30 pb-4">
                      <div className="inline-block px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/30">
                        NATIONAL SKILL & COMPUTER EDUCATION ACADEMY
                      </div>
                      <h2 className="text-2xl font-black uppercase tracking-wider text-foreground">STATEMENT OF MARKS & EVALUATION</h2>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">ISO 9001:2015 CERTIFIED INSTITUTION • OFFICIAL ACADEMIC TRANSCRIPT</p>
                    </div>

                    {/* Student Info Grid */}
                    <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-muted/30 p-4 border border-border">
                      <div>
                        <p><span className="font-sans font-bold text-muted-foreground text-[10px] uppercase block">Student Name</span> <strong className="text-foreground text-sm font-sans uppercase font-black">RAHUL KUMAR SHARMA</strong></p>
                        <p className="mt-2"><span className="font-sans font-bold text-muted-foreground text-[10px] uppercase block">Enrollment No / Reg No</span> <span className="font-bold">STUD2026/DEL/0482</span></p>
                        <p className="mt-2"><span className="font-sans font-bold text-muted-foreground text-[10px] uppercase block">Course Program</span> <span className="font-bold uppercase">DCCA - Diploma in Computer Application</span></p>
                      </div>
                      <div>
                        <p><span className="font-sans font-bold text-muted-foreground text-[10px] uppercase block">Center Name & Code</span> <strong className="text-foreground font-sans font-bold uppercase">APEX IT SKILLS CENTER (CENT-019)</strong></p>
                        <p className="mt-2"><span className="font-sans font-bold text-muted-foreground text-[10px] uppercase block">Examination Session</span> <span className="font-bold">ANNUAL SESSION 2026-27</span></p>
                        <p className="mt-2"><span className="font-sans font-bold text-muted-foreground text-[10px] uppercase block">Issue Date</span> <span className="font-bold">23 SEP 2026</span></p>
                      </div>
                    </div>

                    {/* Marks Table */}
                    <table className="w-full text-left text-xs border-collapse border border-border">
                      <thead>
                        <tr className="bg-muted text-foreground border-b border-border">
                          <th className="p-3 font-black uppercase text-[10px] border-r border-border">Code</th>
                          <th className="p-3 font-black uppercase text-[10px] border-r border-border">Subject Title</th>
                          <th className="p-3 font-black uppercase text-[10px] text-center border-r border-border">Max Marks</th>
                          <th className="p-3 font-black uppercase text-[10px] text-center border-r border-border">Pass Marks</th>
                          <th className="p-3 font-black uppercase text-[10px] text-center">Marks Obtained</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        <tr>
                          <td className="p-3 font-mono border-r border-border">CS101</td>
                          <td className="p-3 font-bold border-r border-border">Computer Fundamentals & Windows OS</td>
                          <td className="p-3 text-center border-r border-border font-mono">100</td>
                          <td className="p-3 text-center border-r border-border font-mono">40</td>
                          <td className="p-3 text-center font-mono font-bold text-emerald-600">88</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-mono border-r border-border">CS102</td>
                          <td className="p-3 font-bold border-r border-border">MS Office & Document Automation</td>
                          <td className="p-3 text-center border-r border-border font-mono">100</td>
                          <td className="p-3 text-center border-r border-border font-mono">40</td>
                          <td className="p-3 text-center font-mono font-bold text-emerald-600">92</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-mono border-r border-border">CS103</td>
                          <td className="p-3 font-bold border-r border-border">Practical Typing & Speed Assessment (English/Hindi)</td>
                          <td className="p-3 text-center border-r border-border font-mono">100</td>
                          <td className="p-3 text-center border-r border-border font-mono">40</td>
                          <td className="p-3 text-center font-mono font-bold text-emerald-600">85</td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/60 font-black border-t-2 border-border">
                          <td colSpan={2} className="p-3 uppercase text-right border-r border-border">GRAND TOTAL</td>
                          <td className="p-3 text-center border-r border-border font-mono">300</td>
                          <td className="p-3 text-center border-r border-border font-mono">120</td>
                          <td className="p-3 text-center font-mono text-base text-primary">265 / 300</td>
                        </tr>
                      </tfoot>
                    </table>

                    {/* Result Footer */}
                    <div className="flex items-center justify-between bg-primary/5 p-4 border border-primary/20">
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">PERCENTAGE & DIVISION</p>
                        <p className="text-lg font-black text-foreground">88.33% — FIRST DIVISION WITH DISTINCTION</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">FINAL RESULT STATUS</p>
                        <span className="inline-block px-4 py-1.5 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest">
                          PASSED
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Sample Scorecard Preview */
                <div className="border border-border p-6 bg-background shadow-md space-y-6">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div>
                      <h3 className="text-lg font-black uppercase text-foreground">ONLINE EXAM SCORECARD</h3>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Instant Evaluation & Speed Analytics Report</p>
                    </div>
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-black uppercase">EVALUATED</span>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-muted/40 border border-border text-center">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Score</p>
                      <p className="text-2xl font-black text-primary mt-1">45 / 50</p>
                    </div>
                    <div className="p-4 bg-muted/40 border border-border text-center">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Accuracy Rate</p>
                      <p className="text-2xl font-black text-emerald-600 mt-1">90.0%</p>
                    </div>
                    <div className="p-4 bg-muted/40 border border-border text-center">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Time Spent</p>
                      <p className="text-2xl font-black text-foreground mt-1">18:45 Mins</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-foreground">Question Category Summary</h4>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center p-2 bg-muted/20 border border-border">
                        <span>Multiple Choice Questions (MCQ)</span>
                        <span className="font-mono font-bold text-emerald-600">25 / 25 Correct</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-muted/20 border border-border">
                        <span>True / False Questions</span>
                        <span className="font-mono font-bold text-emerald-600">10 / 10 Correct</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-muted/20 border border-border">
                        <span>Fill in the Blanks</span>
                        <span className="font-mono font-bold text-amber-600">10 / 15 Correct</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="border-t border-border pt-4">
              <Button 
                variant="outline" 
                onClick={() => setPreviewDialogOpen(false)}
                className="rounded-none font-black uppercase tracking-widest text-xs h-10 px-6"
              >
                Close Preview
              </Button>
              <Button 
                onClick={() => {
                  toast.success("Sample marksheets are dynamically rendered for all student results in the database");
                  setPreviewDialogOpen(false);
                }}
                className="rounded-none font-black uppercase tracking-widest text-xs h-10 px-6 bg-primary hover:bg-primary/90"
              >
                <Printer className="w-3.5 h-3.5 mr-2" />
                Print Sample Format
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminExamResultsPage;
