import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Filter, Calendar, Download, Eye, X, BookOpen, FileText, Printer, Clock, Award, CheckCircle2, Sparkles, Layers } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StudentPaper {
  _id: string;
  blueprint_id: string;
  student_id: string;
  center_id: string;
  status: string;
  start_window: string | null;
  end_window: string | null;
  subject_id: string | null;
  created_at: string;
}

interface Blueprint {
  _id: string;
  name: string;
  course_id: string;
  total_marks?: number;
  duration_minutes?: number;
}

interface Course {
  _id: string;
  course_name: string;
  category_id?: string;
}

interface Category {
  _id: string;
  name: string;
}

const MONTHS = [
  "All", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DEFAULT_COURSES = [
  { _id: "c_dca", course_name: "Diploma in Computer Applications (DCA)", category_id: "cat_comp", duration: 180, marks: 100, code: "DCA-101" },
  { _id: "c_adca", course_name: "Advanced Diploma in Computer Applications (ADCA)", category_id: "cat_comp", duration: 180, marks: 100, code: "ADCA-201" },
  { _id: "c_tally", course_name: "Tally Prime with GST & Accounting", category_id: "cat_fin", duration: 120, marks: 100, code: "TALLY-GST" },
  { _id: "c_web", course_name: "Certificate in Web Development & HTML/CSS", category_id: "cat_comp", duration: 180, marks: 100, code: "WEB-DEV" }
];

const CenterDownloadPaperPage = () => {
  const toId = (v: any): string => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && "$oid" in v) return v.$oid;
    return String(v || "");
  };

  const [loading, setLoading] = useState(true);
  const [papers, setPapers] = useState<StudentPaper[]>([]);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allotmentBatches, setAllotmentBatches] = useState<any[]>([]);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("All");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [batchesRes, papersRes, blueprintsRes, coursesRes, categoriesRes] = await Promise.all([
        apiFetch("/api/exam/allotment-batches"),
        apiFetch("/api/exam/papers"),
        apiFetch("/api/exam/blueprints"),
        apiFetch("/api/courses"),
        apiFetch("/api/admin/categories?limit=100")
      ]);

      if (batchesRes.ok) {
        const raw = await batchesRes.json();
        setAllotmentBatches(Array.isArray(raw) ? raw : []);
      }
      if (papersRes.ok) {
        const raw = await papersRes.json();
        const normalized = Array.isArray(raw) ? raw.map((p: any) => ({
          ...p,
          _id: toId(p._id),
          blueprint_id: toId(p.blueprint_id)
        })) : [];
        setPapers(normalized);
      }
      if (blueprintsRes.ok) {
        const raw = await blueprintsRes.json();
        setBlueprints(Array.isArray(raw) ? raw.map((b: any) => ({ ...b, _id: toId(b._id) })) : []);
      }
      if (coursesRes.ok) {
        const data = await coursesRes.json();
        const normalized = (Array.isArray(data) ? data : (data.items || []))
          .map((c: any) => ({ ...c, _id: toId(c._id || c.id) }))
          .filter((c: Course) => c._id);
        setCourses(normalized);
      } else {
        setCourses([]);
      }
      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        const normalized = (Array.isArray(data) ? data : (data.items || []))
          .map((cat: any) => ({ ...cat, _id: toId(cat._id || cat.id) }));
        setCategories(normalized);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePrintPaper = (courseName: string, paperId?: string) => {
    if (paperId) {
      window.open(`/dashboard/exams/print/${paperId}`, "_blank");
    } else {
      window.open(`/dashboard/exams/papers`, "_blank");
    }
  };

  const filteredCourseList = useMemo(() => {
    return courses.filter((c: any) => {
      if (selectedCategory !== "all" && c.category_id !== selectedCategory) return false;
      if (selectedCourse !== "all" && c._id !== selectedCourse) return false;
      return true;
    });
  }, [courses, selectedCategory, selectedCourse]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                Download Examination Papers
              </h1>
              <p className="text-xs font-semibold text-slate-400 mt-1">
                Access, download, and print official question paper sets for allotted course examinations
              </p>
            </div>
          </div>

          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-mono text-xs px-3 py-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            A4 Official Printable Format Ready
          </Badge>
        </div>

        {/* Filter Section */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl backdrop-blur-xl grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 block">Course Category</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl h-10">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat._id} value={cat._id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 block">Course Selection</Label>
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl h-10">
                <SelectValue placeholder="All Courses" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                <SelectItem value="all">All Courses</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c._id} value={c._id}>{c.course_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 block">Exam Session Month</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl h-10">
                <SelectValue placeholder="All Months" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                {MONTHS.map((month) => (
                  <SelectItem key={month} value={month}>{month}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Question Papers List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : filteredCourseList.length === 0 ? (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-16 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-800/80 border border-slate-700/80 rounded-2xl mx-auto flex items-center justify-center text-slate-400">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <p className="text-slate-200 font-bold text-base">No Downloadable Exam Papers Found</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">No courses match your filter or no exams have been allotted yet.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredCourseList.map((course: any) => {
              const matchedBp = blueprints.find(b => b.course_id === course._id);
              
              return (
                <div key={course._id} className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl hover:border-blue-500/50 transition-all overflow-hidden flex flex-col justify-between group p-6 space-y-5">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {course.code || "SCRE-EXAM"}
                      </span>
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                        <BookOpen className="w-5 h-5" />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-black text-white group-hover:text-blue-400 transition-colors leading-snug">
                        {course.course_name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">Official Final Examination Question Paper Set</p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs font-mono">
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase font-bold">Duration</span>
                        <span className="font-bold text-slate-200">{matchedBp?.duration_minutes || course.duration || 180} Mins</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase font-bold">Total Marks</span>
                        <span className="font-bold text-amber-400">{matchedBp?.total_marks || course.marks || 100} Marks</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase font-bold">Paper Sets</span>
                        <span className="font-bold text-emerald-400">Set A, B, C</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center gap-3">
                    <Button 
                      onClick={() => handlePrintPaper(course.course_name)}
                      className="flex-1 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 h-10 flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download & Print Paper Set
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => handlePrintPaper(course.course_name)}
                      className="rounded-xl border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 h-10 px-3 flex items-center gap-1.5 font-bold text-xs"
                    >
                      <Printer className="w-4 h-4 text-blue-400" />
                      Print
                    </Button>
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

export default CenterDownloadPaperPage;
