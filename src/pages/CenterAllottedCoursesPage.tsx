import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  BookOpen, 
  Loader2, 
  Calendar, 
  IndianRupee, 
  Clock, 
  Award, 
  ShieldCheck, 
  Download, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock3, 
  AlertTriangle, 
  Sparkles, 
  Layers, 
  Info, 
  FileText, 
  Building2, 
  X,
  Check
} from "lucide-react";
import { toast } from "sonner";
import { cn, normalizeAssetUrl } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { courseTypeLabel, formatCourseDuration, stripHtml, COURSE_TYPE_OPTIONS } from "@/lib/courseDisplay";
import { AcademicBundleDetailModal } from "@/components/admin/AcademicBundleDetailModal";

interface Course {
  _id?: string;
  id?: string;
  name?: string;
  course_name?: string;
  code?: string;
  course_code?: string;
  category?: string;
  category_id?: string;
  course_type?: string;
  duration_months: number;
  duration_value?: number;
  duration_unit?: string;
  total_fees?: number;
  fees?: number;
  registration_fee?: number;
  exam_fees_applicable?: boolean;
  exam_fee_amount?: number;
  description?: string;
  eligibility?: string;
  image_url?: string;
  syllabus?: string;
  approval_status?: string;
  status?: string;
  rejection_reason?: string;
  created_by_center_id?: string;
  created_by_center_name?: string;
}

interface Category {
  id: string;
  _id?: string;
  name: string;
  category_code?: string;
}

export default function CenterAllottedCoursesPage() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Proposal Modal State
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    category_id: "",
    course_name: "",
    course_code: "",
    short_code: "",
    course_type: "diploma",
    duration_value: "12",
    duration_unit: "months",
    fees: "",
    registration_fee: "",
    exam_fees_applicable: false,
    exam_fee_amount: "",
    backlog_fees_applicable: false,
    backlog_fee_amount: "",
    has_course_structure_units: false,
    unit_type: "semesters",
    unit_count: "2",
    eligibility: "",
    description: "",
    syllabus: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const [allotRes, myCoursesRes, catsRes] = await Promise.all([
        fetch("/api/courses/allot", { headers: { Authorization: `Bearer ${token}` } }),
        apiFetch("/api/courses"),
        apiFetch("/api/admin/categories")
      ]);

      const allotData = allotRes.ok ? await allotRes.json() : [];
      const myCoursesData = myCoursesRes.ok ? await myCoursesRes.json() : [];
      const catsData = catsRes.ok ? await catsRes.json() : {};

      const combined: Course[] = Array.isArray(allotData) ? [...allotData] : [];
      const myCoursesList = Array.isArray(myCoursesData) ? myCoursesData : [];
      
      // Merge unique custom proposed courses from myCoursesData
      myCoursesList.forEach((mc: Course) => {
        const id = mc._id || mc.id;
        const exists = combined.some(c => (c._id || c.id) === id);
        if (!exists) {
          combined.push(mc);
        }
      });

      setCourses(combined);
      setAllCourses(myCoursesList);
      setCategories(catsData.items || []);
    } catch (error) {
      console.error("Error fetching allotted courses:", error);
      toast.error("Failed to load allotted courses");
    } finally {
      setLoading(false);
    }
  };

  const handleProposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category_id) {
      toast.error("Please select a course category");
      return;
    }
    if (!form.course_name.trim()) {
      toast.error("Please enter a course name");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: form.category_id,
          course_name: form.course_name.trim(),
          course_code: form.course_code.trim() || undefined,
          short_code: form.short_code.trim() || undefined,
          course_type: form.course_type,
          duration_value: Number(form.duration_value) || 12,
          duration_unit: form.duration_unit,
          fees: Number(form.fees) || 0,
          total_fee: Number(form.fees) || 0,
          registration_fee: Number(form.registration_fee) || 0,
          admission_fee: Number(form.registration_fee) || 0,
          exam_fees_applicable: form.exam_fees_applicable,
          exam_fee_amount: form.exam_fees_applicable ? (Number(form.exam_fee_amount) || 0) : undefined,
          backlog_fees_applicable: form.backlog_fees_applicable,
          backlog_fee_amount: form.backlog_fees_applicable ? (Number(form.backlog_fee_amount) || 0) : undefined,
          has_course_structure_units: form.has_course_structure_units,
          unit_type: form.has_course_structure_units ? form.unit_type : undefined,
          unit_count: form.has_course_structure_units ? (Number(form.unit_count) || undefined) : undefined,
          eligibility: form.eligibility.trim() || undefined,
          description: form.description.trim() || undefined,
          syllabus: form.syllabus.trim() || undefined,
        })
      });

      const data = await res.json();
      if (res.ok || res.status === 201) {
        toast.success(data.message || "Course proposal submitted to Super Admin!");
        setIsProposalModalOpen(false);
        setForm({
          category_id: "",
          course_name: "",
          course_code: "",
          short_code: "",
          course_type: "diploma",
          duration_value: "12",
          duration_unit: "months",
          fees: "",
          registration_fee: "",
          exam_fees_applicable: false,
          exam_fee_amount: "",
          backlog_fees_applicable: false,
          backlog_fee_amount: "",
          has_course_structure_units: false,
          unit_type: "semesters",
          unit_count: "2",
          eligibility: "",
          description: "",
          syllabus: "",
        });
        fetchData();
      } else {
        toast.error(data.message || "Failed to submit course proposal");
      }
    } catch (err: any) {
      toast.error(err.message || "Error submitting proposal");
    } finally {
      setSubmitting(false);
    }
  };

  const getCourseStatus = (course: Course) => {
    if (course.approval_status === "pending" || course.status === "pending_approval") return "pending";
    if (course.approval_status === "rejected" || course.status === "rejected") return "rejected";
    return "approved";
  };

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const cName = course.name || course.course_name || "";
      const cCode = course.code || course.course_code || "";
      const matchesSearch = 
        cName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cCode.toLowerCase().includes(searchTerm.toLowerCase());

      const status = getCourseStatus(course);
      const matchesStatus = statusFilter === "all" || status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [courses, searchTerm, statusFilter]);

  const totalAllotted = courses.filter(c => getCourseStatus(c) === "approved").length;
  const totalPending = courses.filter(c => getCourseStatus(c) === "pending").length;
  const totalRejected = courses.filter(c => getCourseStatus(c) === "rejected").length;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16 relative">
        {/* Glowing Background Ambiance */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />

        {/* Hero Header Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 p-6 md:p-8 text-white border border-indigo-500/20 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-indigo-500 to-purple-500" />
          <div className="relative z-10 space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold backdrop-blur-md border border-white/10 text-amber-300">
              <Sparkles className="h-4 w-4" />
              <span>Center Academic Hub</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight uppercase font-heading">
              Allotted & Authorized Courses
            </h1>
            <p className="text-slate-300 text-xs md:text-sm font-medium leading-relaxed">
              View authorized academic programs for your center, or propose custom courses for Super Admin approval to expand your course offerings.
            </p>
          </div>

          <div className="relative z-10 shrink-0">
            <Button
              onClick={() => setIsProposalModalOpen(true)}
              className="rounded-2xl bg-gradient-to-r from-amber-500 via-indigo-600 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 px-6 py-6 flex items-center gap-2 transition-all transform active:scale-95"
            >
              <Plus className="h-5 w-5" />
              Propose Custom Course
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="rounded-2xl border border-emerald-500/30 bg-slate-900/80 backdrop-blur-md p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Authorized Live Courses</p>
                <h3 className="text-3xl font-black text-emerald-400 mt-1">{totalAllotted}</h3>
              </div>
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <ShieldCheck className="h-6 w-6" />
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl border border-amber-500/30 bg-slate-900/80 backdrop-blur-md p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Approvals</p>
                <h3 className="text-3xl font-black text-amber-400 mt-1">{totalPending}</h3>
              </div>
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 animate-pulse">
                <Clock3 className="h-6 w-6" />
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl border border-rose-500/30 bg-slate-900/80 backdrop-blur-md p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rejected Proposals</p>
                <h3 className="text-3xl font-black text-rose-400 mt-1">{totalRejected}</h3>
              </div>
              <div className="h-12 w-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
          </Card>
        </div>

        {/* Toolbar & Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-3xl border border-indigo-500/20 backdrop-blur-2xl shadow-xl">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search course name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 rounded-2xl border-slate-800 bg-slate-950/80 text-xs font-bold uppercase tracking-wider text-slate-100 placeholder-slate-500"
            />
          </div>

          <div className="flex items-center gap-2 p-1 bg-slate-950/80 rounded-2xl border border-slate-800 w-full sm:w-auto overflow-x-auto">
            {[
              { key: "all", label: "All Programs" },
              { key: "approved", label: `Authorized (${totalAllotted})` },
              { key: "pending", label: `Pending (${totalPending})` },
              { key: "rejected", label: `Rejected (${totalRejected})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                  statusFilter === tab.key
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white hover:bg-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Course Cards Grid */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Authorized Courses...</p>
          </div>
        ) : filteredCourses.length === 0 ? (
          <Card className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/60 p-16 text-center shadow-xl">
            <div className="mx-auto h-16 w-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
              <BookOpen className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-white uppercase tracking-tight">No Courses Found</h3>
            <p className="text-slate-400 text-xs max-w-md mx-auto mt-2 mb-6">
              {searchTerm || statusFilter !== "all"
                ? "No course matching your search or filter criteria."
                : "No courses have been allotted to your center yet. You can submit a custom course proposal to Super Admin."}
            </p>
            <Button
              onClick={() => setIsProposalModalOpen(true)}
              className="rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg px-6"
            >
              <Plus className="h-4 w-4 mr-2" /> Propose Custom Course
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => {
              const cId = course._id || course.id;
              const cName = course.name || course.course_name || "Untitled Course";
              const cCode = course.code || course.course_code || "CRS-CODE";
              const cFee = course.total_fees ?? course.fees ?? 0;
              const status = getCourseStatus(course);

              return (
                <Card 
                  key={cId} 
                  className="rounded-3xl border border-indigo-500/20 bg-slate-900/80 backdrop-blur-2xl shadow-2xl hover:border-indigo-500/50 transition-all duration-300 overflow-hidden flex flex-col justify-between group"
                >
                  {/* Card Banner Image */}
                  <div className="h-44 relative overflow-hidden bg-slate-950">
                    <img
                      src={normalizeAssetUrl(course.image_url) || "/images/icc-3.jpg"}
                      alt={cName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                    {/* Category Overlay */}
                    {course.category && (
                      <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md border border-slate-700/60 text-indigo-300 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-xl shadow-lg">
                        {course.category}
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="absolute top-3 right-3">
                      {status === "approved" && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border backdrop-blur-md shadow-lg bg-emerald-500/20 border-emerald-500/40 text-emerald-300">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          Authorized Live
                        </span>
                      )}
                      {status === "pending" && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border backdrop-blur-md shadow-lg bg-amber-500/20 border-amber-500/40 text-amber-300">
                          <Clock3 className="w-3 h-3 text-amber-400 animate-pulse" />
                          Pending Review
                        </span>
                      )}
                      {status === "rejected" && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border backdrop-blur-md shadow-lg bg-rose-500/20 border-rose-500/40 text-rose-300">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          Rejected
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <Badge variant="outline" className="font-mono text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-400 border-indigo-500/30">
                          {cCode}
                        </Badge>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {courseTypeLabel(course.course_type)}
                        </span>
                      </div>
                      <h3 className="font-heading font-black text-lg text-white group-hover:text-indigo-300 transition-colors uppercase tracking-tight line-clamp-2 leading-snug">
                        {cName}
                      </h3>
                      {course.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 mt-2 leading-relaxed italic">
                          "{stripHtml(course.description)}"
                        </p>
                      )}
                    </div>

                    {/* Rejection Reason Notice if Rejected */}
                    {status === "rejected" && course.rejection_reason && (
                      <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-1">
                        <strong className="block text-[10px] uppercase font-bold text-rose-400">Rejection Feedback:</strong>
                        <p className="text-xs italic">{course.rejection_reason}</p>
                      </div>
                    )}

                    {/* Key Course Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Duration</span>
                        <div className="flex items-center gap-1.5 text-slate-200 font-bold mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{formatCourseDuration(course)}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Course Fee</span>
                        <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold mt-0.5">
                          <IndianRupee className="w-3.5 h-3.5 text-emerald-400" />
                          <span>₹{cFee.toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    </div>

                    {(course.registration_fee ?? 0) > 0 || course.eligibility ? (
                      <div className="text-[11px] text-slate-400 space-y-1 pt-1 border-t border-slate-800/80">
                        {(course.registration_fee ?? 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Admission Fee:</span>
                            <span className="font-bold text-slate-200">₹{(course.registration_fee ?? 0).toLocaleString("en-IN")}</span>
                          </div>
                        )}
                        {course.eligibility && (
                          <div className="flex justify-between">
                            <span>Eligibility:</span>
                            <span className="font-bold text-slate-200 truncate max-w-[150px]">{course.eligibility}</span>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* Actions Footer */}
                  <div className="p-4 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCourse(course);
                        setIsDetailModalOpen(true);
                      }}
                      className="rounded-xl border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold gap-1.5 flex-1"
                    >
                      <Info className="w-3.5 h-3.5 text-indigo-400" />
                      View Details
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Modal 1: Propose Custom Course */}
        <Dialog open={isProposalModalOpen} onOpenChange={setIsProposalModalOpen}>
          <DialogContent className="rounded-3xl border border-indigo-500/30 bg-slate-950/95 backdrop-blur-3xl text-slate-100 max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8">
            <DialogHeader className="border-b border-slate-800 pb-4">
              <DialogTitle className="font-heading font-black text-xl text-white uppercase tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Propose Custom Course to Super Admin
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Submit a custom course proposal for your franchise center. It will be reviewed by Super Admin before going live.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleProposeSubmit} className="space-y-6 py-4">
              {/* Section 1: Academic Identity & Category */}
              <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  1. Academic Identity & Category
                </h3>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Course Category *</Label>
                  <select
                    required
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id || cat._id} value={cat.id || cat._id}>
                        {cat.name} {cat.category_code ? `[${cat.category_code}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Course Type *</Label>
                    <select
                      value={form.course_type}
                      onChange={(e) => setForm({ ...form, course_type: e.target.value })}
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                    >
                      {COURSE_TYPE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Course Name *</Label>
                    <Input
                      required
                      placeholder="e.g. Advanced Diploma in Web Development"
                      value={form.course_name}
                      onChange={(e) => setForm({ ...form, course_name: e.target.value })}
                      className="rounded-2xl border-slate-800 bg-slate-950 text-sm text-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Course Code (Optional)</Label>
                    <Input
                      placeholder="e.g. ADWD-101"
                      value={form.course_code}
                      onChange={(e) => setForm({ ...form, course_code: e.target.value })}
                      className="rounded-2xl border-slate-800 bg-slate-950 text-sm text-slate-100 font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Short Code (for Roll No generation)</Label>
                    <Input
                      placeholder="e.g. ADWD"
                      value={form.short_code}
                      onChange={(e) => setForm({ ...form, short_code: e.target.value })}
                      className="rounded-2xl border-slate-800 bg-slate-950 text-sm text-slate-100 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Duration & Fee Structure */}
              <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                  <IndianRupee className="w-4 h-4 text-emerald-400" />
                  2. Program Duration & Fee Structure
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Duration Value *</Label>
                    <Input
                      type="number"
                      min={1}
                      required
                      value={form.duration_value}
                      onChange={(e) => setForm({ ...form, duration_value: e.target.value })}
                      className="rounded-2xl border-slate-800 bg-slate-950 text-sm text-slate-100 font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Duration Unit</Label>
                    <select
                      value={form.duration_unit}
                      onChange={(e) => setForm({ ...form, duration_unit: e.target.value })}
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="months">Months</option>
                      <option value="years">Years</option>
                      <option value="weeks">Weeks</option>
                      <option value="days">Days</option>
                      <option value="hours">Hours</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Total Course Fee (₹) *</Label>
                    <Input
                      type="number"
                      min={0}
                      required
                      placeholder="e.g. 15000"
                      value={form.fees}
                      onChange={(e) => setForm({ ...form, fees: e.target.value })}
                      className="rounded-2xl border-slate-800 bg-slate-950 text-sm text-slate-100 font-mono font-bold text-emerald-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Admission Fee (₹)</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="e.g. 1000"
                      value={form.registration_fee}
                      onChange={(e) => setForm({ ...form, registration_fee: e.target.value })}
                      className="rounded-2xl border-slate-800 bg-slate-950 text-sm text-slate-100 font-mono"
                    />
                  </div>
                </div>

                {/* Exam Fee Toggle */}
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-3.5">
                  <div>
                    <Label className="text-xs font-bold text-slate-200">Exam fees applicable?</Label>
                    <p className="text-[10px] text-slate-400">Include exam fee itemization for students</p>
                  </div>
                  <Switch
                    checked={form.exam_fees_applicable}
                    onCheckedChange={(v) => setForm({ ...form, exam_fees_applicable: v })}
                  />
                </div>
                {form.exam_fees_applicable && (
                  <div className="space-y-2 pl-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Exam Fee Amount (₹)</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="e.g. 500"
                      value={form.exam_fee_amount}
                      onChange={(e) => setForm({ ...form, exam_fee_amount: e.target.value })}
                      className="rounded-2xl border-slate-800 bg-slate-950 text-sm text-slate-100 font-mono"
                    />
                  </div>
                )}

                {/* Backlog Fee Toggle */}
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-3.5">
                  <div>
                    <Label className="text-xs font-bold text-slate-200">Backlog fees applicable?</Label>
                    <p className="text-[10px] text-slate-400">Optional backlog/re-paper fee structure</p>
                  </div>
                  <Switch
                    checked={form.backlog_fees_applicable}
                    onCheckedChange={(v) => setForm({ ...form, backlog_fees_applicable: v })}
                  />
                </div>
                {form.backlog_fees_applicable && (
                  <div className="space-y-2 pl-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Backlog Fee Amount (₹)</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="e.g. 300"
                      value={form.backlog_fee_amount}
                      onChange={(e) => setForm({ ...form, backlog_fee_amount: e.target.value })}
                      className="rounded-2xl border-slate-800 bg-slate-950 text-sm text-slate-100 font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Section 3: Course Structure & Units */}
              <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  3. Academic Structure & Units
                </h3>

                <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-3.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Course Structure Units</Label>
                  <RadioGroup
                    value={form.has_course_structure_units ? "yes" : "no"}
                    onValueChange={(v) => setForm({ ...form, has_course_structure_units: v === "yes" })}
                    className="flex gap-6"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="yes" id="units-yes" />
                      <Label htmlFor="units-yes" className="font-semibold text-xs text-slate-200 cursor-pointer">
                        Yes (Semesters/Years)
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="no" id="units-no" />
                      <Label htmlFor="units-no" className="font-semibold text-xs text-slate-200 cursor-pointer">
                        No (Single Term)
                      </Label>
                    </div>
                  </RadioGroup>

                  {form.has_course_structure_units && (
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Unit Type</Label>
                        <select
                          value={form.unit_type}
                          onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
                          className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="semesters">Semesters</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="yearly">Yearly</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Unit Count</Label>
                        <Input
                          type="number"
                          min={1}
                          placeholder="e.g. 2"
                          value={form.unit_count}
                          onChange={(e) => setForm({ ...form, unit_count: e.target.value })}
                          className="rounded-2xl border-slate-800 bg-slate-900 text-sm text-slate-100 font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Eligibility Criteria</Label>
                  <Input
                    placeholder="e.g. 10th Pass / 12th Pass / Basic Computer Knowledge"
                    value={form.eligibility}
                    onChange={(e) => setForm({ ...form, eligibility: e.target.value })}
                    className="rounded-2xl border-slate-800 bg-slate-950 text-sm text-slate-100"
                  />
                </div>
              </div>

              {/* Section 4: Overview & Syllabus */}
              <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  4. Overview & Syllabus
                </h3>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Course Description & Overview</Label>
                  <textarea
                    placeholder="Brief description of the course, goals, and target audience..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 min-h-[90px] focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Detailed Syllabus & Modules (Markdown)</Label>
                  <textarea
                    placeholder="Module 1: Fundamentals of Programming&#10;Module 2: Database Management System&#10;Module 3: Project & Internship Work"
                    value={form.syllabus}
                    onChange={(e) => setForm({ ...form, syllabus: e.target.value })}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 font-mono min-h-[100px] focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              <DialogFooter className="pt-4 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsProposalModalOpen(false)}
                  className="rounded-2xl border-slate-800 hover:bg-slate-900"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 px-6 gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
                  {submitting ? "Submitting Proposal..." : "Submit Proposal to Super Admin"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal 2: View Full Academic Bundle Details */}
        <AcademicBundleDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          course={selectedCourse}
          isSuperAdmin={false}
        />
      </div>
    </DashboardLayout>
  );
}

