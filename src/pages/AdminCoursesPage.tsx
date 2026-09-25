import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2, Pencil, Trash2, BookOpen, CheckCircle2, Clock, Code, AlertTriangle, ArrowRight, Upload, Image as ImageIcon, Star, Filter, Search, X, FileSpreadsheet } from "lucide-react";
import { BulkCsvUploadModal } from "@/components/BulkCsvUploadModal";
import { toast } from "sonner";
import { cn, normalizeAssetUrl } from "@/lib/utils";
import { apiFetch, parseJsonArrayResponse } from "@/lib/api";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CourseRichTextEditor } from "@/components/admin/CourseRichTextEditor";
import { COURSE_TYPE_OPTIONS, courseTypeLabel, formatCourseDuration, stripHtml } from "@/lib/courseDisplay";

interface Course {
  id: string;
  _id?: string;
  category_id: string;
  course_name: string;
  course_code: string;
  short_code: string;
  duration_months: number;
  duration_value?: number;
  duration_unit?: string;
  course_type?: string;
  description?: string;
  image_url?: string;
  og_image_url?: string;
  syllabus?: string;
  fees?: number;
  registration_fee?: number;
  exam_fees_applicable?: boolean;
  exam_fee_amount?: number;
  backlog_fees_applicable?: boolean;
  backlog_fee_amount?: number;
  has_course_structure_units?: boolean;
  unit_type?: string;
  unit_count?: number;
  custom_unit_name?: string;
  eligibility?: string;
  status: string;
  created_at: string;
  featured_on_home?: boolean;
  home_feature_order?: number;
  typing_tests_enabled?: boolean;
  mock_tests_enabled?: boolean;
  linked_typing_tests?: string[];
  linked_mock_tests?: string[];
}

interface Category {
  id: string;
  _id?: string;
  name: string;
}

const AdminCoursesPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showCategoryWarning, setShowCategoryWarning] = useState(false);
  const [warningSkipped, setWarningSkipped] = useState(false);
  const [typingLessons, setTypingLessons] = useState<{ _id: string; title: string; language_id: string }[]>([]);
  const [mockTests, setMockTests] = useState<{ id: string; title: string }[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  const [form, setForm] = useState({
    category_id: "",
    course_name: "",
    course_code: "",
    short_code: "",
    course_type: "diploma" as string,
    duration_value: "" as string | number,
    duration_unit: "months" as string,
    description: "",
    image_url: "",
    og_image_url: "",
    syllabus: "",
    fees: "" as string | number,
    registration_fee: "" as string | number,
    exam_fees_applicable: false,
    exam_fee_amount: "" as string | number,
    backlog_fees_applicable: false,
    backlog_fee_amount: "" as string | number,
    has_course_structure_units: false,
    unit_type: "",
    unit_count: "" as string | number,
    custom_unit_name: "",
    eligibility: "",
    status: "active",
    typing_tests_enabled: false,
    mock_tests_enabled: false,
    linked_typing_tests: [] as string[],
    linked_mock_tests: [] as string[],
  });

  const resetForm = () => {
    setForm({
      category_id: "",
      course_name: "",
      course_code: "",
      short_code: "",
      course_type: "diploma",
      duration_value: "",
      duration_unit: "months",
      description: "",
      image_url: "",
      og_image_url: "",
      syllabus: "",
      fees: "",
      registration_fee: "",
      exam_fees_applicable: false,
      exam_fee_amount: "",
      backlog_fees_applicable: false,
      backlog_fee_amount: "",
      has_course_structure_units: false,
      unit_type: "",
      unit_count: "",
      custom_unit_name: "",
      eligibility: "",
      status: "active",
      typing_tests_enabled: false,
      mock_tests_enabled: false,
      linked_typing_tests: [],
      linked_mock_tests: [],
    });
  };

  useEffect(() => {
    fetchData();
    void (async () => {
      const lessonsRes = await apiFetch("/api/typing/lessons?active=true");
      setTypingLessons((await parseJsonArrayResponse(lessonsRes)) as { _id: string; title: string; language_id: string }[]);

      const mockRes = await apiFetch("/api/exam/mock-tests");
      const mockData = await parseJsonArrayResponse(mockRes);
      setMockTests(Array.isArray(mockData) ? mockData.map((m: any) => ({ id: m.id || m._id, title: m.title })) : []);
    })();
  }, []);

  const uploadImageField = async (e: React.ChangeEvent<HTMLInputElement>, field: "image_url" | "og_image_url") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size must be less than 2MB");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await apiFetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (response.ok && data.url) {
        setForm((prev) => ({ ...prev, [field]: data.url }));
        toast.success(field === "og_image_url" ? "Social preview image uploaded" : "Course image uploaded");
      } else {
        toast.error(data.message || "Upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("An error occurred during upload");
    } finally {
      setUploading(false);
    }
    e.target.value = "";
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [coursesRes, catsRes] = await Promise.all([
        apiFetch("/api/courses"),
        apiFetch("/api/admin/categories")
      ]);

      const coursesData = await coursesRes.json();
      const catsData = await catsRes.json();

      if (coursesRes.ok) setCourses(coursesData);

      const fetchedCats = catsData.items || [];
      setCategories(fetchedCats);

      if (fetchedCats.length === 0 && !warningSkipped) {
        setShowCategoryWarning(true);
      }

    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category_id) {
      toast.error("Please select a category");
      return;
    }
    setSaving(true);
    try {
      const url = isEditing ? `/api/courses/${selectedCourse?.id || selectedCourse?._id}` : "/api/courses";
      const method = isEditing ? "PUT" : "POST";

      const response = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: form.category_id,
          course_name: form.course_name,
          course_code: form.course_code || undefined,
          short_code: form.short_code || undefined,
          course_type: form.course_type,
          duration_value: form.duration_value === "" ? 0 : Number(form.duration_value),
          duration_unit: form.duration_unit,
          description: form.description || undefined,
          image_url: form.image_url || undefined,
          og_image_url: form.og_image_url || undefined,
          syllabus: form.syllabus || undefined,
          fees: form.fees === "" ? 0 : Number(form.fees),
          registration_fee: form.registration_fee === "" ? 0 : Number(form.registration_fee),
          exam_fees_applicable: form.exam_fees_applicable,
          exam_fee_amount: form.exam_fees_applicable ? (form.exam_fee_amount === "" ? 0 : Number(form.exam_fee_amount)) : 0,
          backlog_fees_applicable: form.backlog_fees_applicable,
          backlog_fee_amount: form.backlog_fees_applicable ? (form.backlog_fee_amount === "" ? 0 : Number(form.backlog_fee_amount)) : 0,
          has_course_structure_units: form.has_course_structure_units,
          unit_type: form.has_course_structure_units && form.unit_type ? form.unit_type : undefined,
          unit_count:
            form.has_course_structure_units &&
            form.unit_count !== "" &&
            form.unit_count !== null &&
            form.unit_count !== undefined
              ? Number(form.unit_count)
              : undefined,
          custom_unit_name:
            form.has_course_structure_units &&
            form.unit_type === "custom" &&
            String(form.custom_unit_name || "").trim()
              ? String(form.custom_unit_name).trim()
              : undefined,
          eligibility: form.eligibility || undefined,
          status: form.status,
          typing_tests_enabled: form.typing_tests_enabled,
          mock_tests_enabled: form.mock_tests_enabled,
          linked_typing_tests: form.typing_tests_enabled ? form.linked_typing_tests : [],
          linked_mock_tests: form.mock_tests_enabled ? form.linked_mock_tests : [],
        })
      });

      if (response.ok) {
        toast.success(isEditing ? "Course updated" : "Course created");
        setIsAdding(false);
        setIsEditing(false);
        resetForm();
        fetchData();
      } else {
        const data = await response.json();
        toast.error(data.message || "Operation failed");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const featuredCount = courses.filter((c) => c.featured_on_home).length;
  const getCategoryName = (id: string) => categories.find(c => (c.id === id || c._id === id))?.name || "Unknown";

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      if (selectedCategoryFilter !== "all" && course.category_id !== selectedCategoryFilter) return false;
      if (selectedStatusFilter !== "all" && course.status !== selectedStatusFilter) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const categoryName = getCategoryName(course.category_id).toLowerCase();
        const inName = (course.course_name || "").toLowerCase().includes(query);
        const inCode = (course.course_code || "").toLowerCase().includes(query);
        const inShortCode = (course.short_code || "").toLowerCase().includes(query);
        const inCategory = categoryName.includes(query);
        if (!inName && !inCode && !inShortCode && !inCategory) return false;
      }

      return true;
    });
  }, [courses, selectedCategoryFilter, selectedStatusFilter, searchQuery, categories]);

  const toggleFeaturedHome = async (course: Course) => {
    const id = course.id || course._id;
    if (!id) return;
    const next = !course.featured_on_home;
    if (next && !course.featured_on_home && featuredCount >= 4) {
      toast.error("You can feature at most 4 courses on the home page.");
      return;
    }
    try {
      const order = next
        ? courses.filter((c) => c.featured_on_home).length
        : 0;
      const res = await apiFetch(`/api/courses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          featured_on_home: next,
          home_feature_order: order,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(next ? "Shown on home page" : "Removed from home page");
        fetchData();
      } else {
        toast.error((data as { message?: string }).message || "Update failed");
      }
    } catch {
      toast.error("Update failed");
    }
  };

  const handleEdit = (course: Course) => {
    setSelectedCourse(course);
    const dv = course.duration_value && course.duration_value > 0 ? course.duration_value : course.duration_months;
    const du = course.duration_value && course.duration_value > 0 ? (course.duration_unit || "months") : "months";
    setForm({
      category_id: course.category_id,
      course_name: course.course_name,
      course_code: course.course_code || "",
      short_code: course.short_code || "",
      course_type: course.course_type || "diploma",
      duration_value: dv,
      duration_unit: du,
      description: course.description || "",
      image_url: course.image_url || "",
      og_image_url: course.og_image_url || "",
      syllabus: course.syllabus || "",
      fees: course.fees || "",
      registration_fee: course.registration_fee || "",
      exam_fees_applicable: Boolean(course.exam_fees_applicable),
      exam_fee_amount: course.exam_fee_amount || "",
      backlog_fees_applicable: Boolean(course.backlog_fees_applicable),
      backlog_fee_amount: course.backlog_fee_amount || "",
      has_course_structure_units: Boolean(course.has_course_structure_units),
      unit_type: course.unit_type || "",
      unit_count: course.unit_count || "",
      custom_unit_name: course.custom_unit_name || "",
      eligibility: course.eligibility || "",
      status: course.status,
      typing_tests_enabled: Boolean(course.typing_tests_enabled),
      mock_tests_enabled: Boolean(course.mock_tests_enabled),
      linked_typing_tests: (course.linked_typing_tests || []).map(String),
      linked_mock_tests: (course.linked_mock_tests || []).map(String),
    });
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this course?")) return;
    try {
      const response = await apiFetch(`/api/courses/${id}`, { method: "DELETE" });
      if (response.ok) {
        toast.success("Course deleted");
        fetchData();
      } else {
        const data = await response.json();
        toast.error(data.message || "Delete failed");
      }
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16 relative">
        {/* Ambient background glows */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />

        {/* No Categories Warning Dialog */}
        <Dialog open={showCategoryWarning} onOpenChange={setShowCategoryWarning}>
          <DialogContent className="rounded-3xl border border-amber-500/30 bg-slate-950/95 backdrop-blur-3xl text-slate-100 max-w-md shadow-2xl p-6">
            <DialogHeader>
              <DialogTitle className="font-heading font-black text-xl text-amber-400 uppercase tracking-tight flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Category Required
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 py-2">
                You need to create a <strong>Course Category</strong> before creating courses. Categories organize programs by stream.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">Why is this required?</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Every course (e.g. ADCA, DCA, Tally) belongs under an academic stream for student roll numbers and center allotment.
                </p>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-col gap-2">
              <button
                onClick={() => navigate("/dashboard/academics/categories?from=courses")}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all"
              >
                Go to Categories <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setShowCategoryWarning(false);
                  setWarningSkipped(true);
                }}
                className="w-full py-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition-all"
              >
                Skip Warning
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Header */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-heading font-black text-2xl md:text-3xl text-white uppercase tracking-tight">
                  Academic Courses
                </h1>
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                  {courses.length} Active Courses
                </span>
              </div>
              <p className="text-slate-400 mt-1 text-xs md:text-sm font-medium">
                Manage diplomas, certifications, fees, and typing/mock-test allotments.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="px-5 py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg hover:border-indigo-500/40"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Bulk Import
            </button>
            <Dialog open={isAdding || isEditing} onOpenChange={(open) => {
              if (!open) {
                setIsAdding(false);
                setIsEditing(false);
                resetForm();
              }
            }}>
              <DialogTrigger asChild>
                <button
                  onClick={() => setIsAdding(true)}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all transform active:scale-95"
                >
                  <Plus className="w-4 h-4" /> Add Course
                </button>
              </DialogTrigger>
              <DialogContent className="rounded-3xl border border-indigo-500/30 bg-slate-950/95 backdrop-blur-3xl text-slate-100 max-w-4xl max-h-[90vh] flex flex-col shadow-2xl p-6 sm:p-8 z-[100]">
                <DialogHeader className="border-b border-slate-800/80 pb-4">
                  <DialogTitle className="font-heading font-black text-xl text-white uppercase tracking-tight flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-indigo-400" />
                    {isEditing ? "Edit Course Details" : "Add New Course"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-400">
                    Configurations propagate immediately across student portals, certificates, and exam engine.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="pt-2 flex flex-col flex-1 min-h-0">
                  <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                    <div className="grid lg:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-2">1. Basic Information</h3>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Course Category *</Label>
                            <select
                              required
                              value={form.category_id}
                              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                            >
                              <option value="">Select category</option>
                              {categories.map((c) => (
                                <option key={c._id || c.id} value={c._id || c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Course Type *</Label>
                            <select
                              required
                              value={form.course_type}
                              onChange={(e) => setForm({ ...form, course_type: e.target.value })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                            >
                              {COURSE_TYPE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Course Name *</Label>
                            <input
                              required
                              value={form.course_name}
                              onChange={(e) => setForm({ ...form, course_name: e.target.value })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                              placeholder="e.g. Advanced Diploma in Computer Applications"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Course Code</Label>
                            <input
                              value={form.course_code}
                              onChange={(e) => setForm({ ...form, course_code: e.target.value })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                              placeholder="e.g. CRSE-001"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Short Code (for Roll No generation)</Label>
                            <input
                              value={form.short_code}
                              onChange={(e) => setForm({ ...form, short_code: e.target.value })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                              placeholder="e.g. ADCA"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Duration value *</Label>
                            <input
                              type="number"
                              required
                              min={1}
                              value={form.duration_value}
                              onChange={(e) => setForm({ ...form, duration_value: e.target.value })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Duration unit</Label>
                            <select
                              value={form.duration_unit}
                              onChange={(e) => setForm({ ...form, duration_unit: e.target.value })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                            >
                              <option value="years">Years</option>
                              <option value="months">Months</option>
                              <option value="weeks">Weeks</option>
                              <option value="days">Days</option>
                              <option value="hours">Hours</option>
                            </select>
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Course Description</Label>
                            <CourseRichTextEditor
                              value={form.description}
                              onChange={(html) => setForm((f) => ({ ...f, description: html }))}
                              placeholder="Overview for website & dashboards..."
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Syllabus (Markdown)</Label>
                            <textarea
                              value={form.syllabus}
                              onChange={(e) => setForm({ ...form, syllabus: e.target.value })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all min-h-[90px]"
                              placeholder="Syllabus / modules in Markdown..."
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Eligibility</Label>
                            <input
                              value={form.eligibility}
                              onChange={(e) => setForm({ ...form, eligibility: e.target.value })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                              placeholder="e.g. 10+2 or equivalent"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Status</Label>
                            <select
                              value={form.status}
                              onChange={(e) => setForm({ ...form, status: e.target.value })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-2">2. Media & Branding</h3>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Course Image</Label>
                          <div className="w-full h-36 border-2 border-dashed border-slate-800 flex items-center justify-center bg-slate-900/50 relative group overflow-hidden rounded-2xl">
                            {form.image_url ? (
                              <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-center p-4">
                                <ImageIcon className="w-7 h-7 text-slate-500 mx-auto mb-1" />
                                <p className="text-[10px] font-bold text-slate-400 uppercase">No image uploaded</p>
                              </div>
                            )}
                            <label className="absolute inset-0 bg-indigo-950/80 backdrop-blur-sm flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                              <Upload className="w-5 h-5 text-white mb-1" />
                              <span className="text-[10px] font-bold text-white uppercase">Upload File</span>
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => void uploadImageField(e, "image_url")}
                                disabled={uploading}
                              />
                            </label>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Social Preview Image (OG)</Label>
                          <div className="w-full h-24 border-2 border-dashed border-slate-800 flex items-center justify-center bg-slate-900/50 relative group overflow-hidden rounded-2xl">
                            {form.og_image_url ? (
                              <img src={form.og_image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] text-slate-500 uppercase font-bold">Optional OG preview</span>
                            )}
                            <label className="absolute inset-0 bg-indigo-950/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs font-bold text-white uppercase">
                              Upload OG Image
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => void uploadImageField(e, "og_image_url")}
                                disabled={uploading}
                              />
                            </label>
                          </div>
                        </div>

                        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-2 pt-2">3. Fees & Structure</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Course Fees (INR)</Label>
                            <input
                              type="number"
                              min={0}
                              value={form.fees}
                              onChange={(e) => setForm({ ...form, fees: e.target.value })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Admission Fees (INR)</Label>
                            <input
                              type="number"
                              min={0}
                              value={form.registration_fee}
                              onChange={(e) => setForm({ ...form, registration_fee: e.target.value })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                          <div>
                            <Label className="text-xs font-bold text-slate-200">Exam fees applicable?</Label>
                            <p className="text-[10px] text-slate-400">Include exam fee itemization in receipts</p>
                          </div>
                          <Switch
                            checked={form.exam_fees_applicable}
                            onCheckedChange={(v) => setForm({ ...form, exam_fees_applicable: v })}
                          />
                        </div>
                        {form.exam_fees_applicable && (
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Exam Fee Amount (INR)</Label>
                            <input
                              type="number"
                              min={0}
                              value={form.exam_fee_amount}
                              onChange={(e) => setForm({ ...form, exam_fee_amount: e.target.value })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                              placeholder="0"
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
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
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Backlog Fee Amount (INR)</Label>
                            <input
                              type="number"
                              min={0}
                              value={form.backlog_fee_amount}
                              onChange={(e) => setForm({ ...form, backlog_fee_amount: e.target.value })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                              placeholder="0"
                            />
                          </div>
                        )}
                        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
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
                                  className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                                >
                                  <option value="">Select unit type</option>
                                  <option value="quarterly">Quarterly</option>
                                  <option value="semesters">Semesters</option>
                                  <option value="yearly">Yearly</option>
                                  <option value="custom">Custom</option>
                                </select>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Unit Count</Label>
                                <input
                                  type="number"
                                  min={1}
                                  value={form.unit_count}
                                  onChange={(e) => setForm({ ...form, unit_count: e.target.value })}
                                  className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                                  placeholder="e.g. 4"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 border-t border-slate-800 pt-4">
                      <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                        <div>
                          <Label className="text-xs font-bold text-slate-200">Enable typing practice for this course</Label>
                          <p className="text-[10px] text-slate-400">
                            Grants students access to typing speed & accuracy modules
                          </p>
                        </div>
                        <Switch
                          checked={form.typing_tests_enabled}
                          onCheckedChange={(v) =>
                            setForm((f) => ({
                              ...f,
                              typing_tests_enabled: v,
                              linked_typing_tests: v ? f.linked_typing_tests : [],
                            }))
                          }
                        />
                      </div>
                      {form.typing_tests_enabled && (
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                            Linked Typing Lessons
                          </Label>
                          <select
                            multiple
                            value={form.linked_typing_tests}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                linked_typing_tests: Array.from(e.target.selectedOptions, (o) => o.value),
                              })
                            }
                            className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 h-28 focus:outline-none focus:border-indigo-500 transition-all"
                          >
                            {typingLessons.map((lesson) => (
                              <option key={lesson._id} value={lesson._id}>
                                {lesson.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                        <div>
                          <Label className="text-xs font-bold text-slate-200">Enable mock test series</Label>
                          <p className="text-[10px] text-slate-400">
                            Allows students to attempt subject mock exams
                          </p>
                        </div>
                        <Switch
                          checked={form.mock_tests_enabled}
                          onCheckedChange={(v) =>
                            setForm((f) => ({
                              ...f,
                              mock_tests_enabled: v,
                              linked_mock_tests: v ? f.linked_mock_tests : [],
                            }))
                          }
                        />
                      </div>
                      {form.mock_tests_enabled && (
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                            Linked Mock Tests
                          </Label>
                          <select
                            multiple
                            value={form.linked_mock_tests}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                linked_mock_tests: Array.from(e.target.selectedOptions, (o) => o.value),
                              })
                            }
                            className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 h-28 focus:outline-none focus:border-indigo-500 transition-all"
                          >
                            {mockTests.map((test) => (
                              <option key={test.id} value={test.id}>
                                {test.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    {uploading && (
                      <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold">
                        <Loader2 className="w-4 h-4 animate-spin" /> Uploading image...
                      </div>
                    )}
                  </div>
                  <DialogFooter className="pt-4 border-t border-slate-800 mt-4">
                    <button
                      type="submit"
                      disabled={saving || uploading}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {isEditing ? "Update Course" : "Save Course"}
                    </button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-4 shadow-xl flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="SEARCH COURSES BY NAME, CODE OR CATEGORY..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-800 bg-slate-950/80 text-xs font-bold text-slate-100 placeholder-slate-500 uppercase tracking-wider focus:border-indigo-500 focus:outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="flex-1 flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 text-xs font-bold text-slate-100 px-4 py-3 uppercase tracking-wider focus:border-indigo-500 focus:outline-none transition-all"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id || cat._id} value={cat.id || cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 flex items-center gap-2">
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 text-xs font-bold text-slate-100 px-4 py-3 uppercase tracking-wider focus:border-indigo-500 focus:outline-none transition-all"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {(selectedCategoryFilter !== "all" || selectedStatusFilter !== "all" || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedCategoryFilter("all");
                  setSelectedStatusFilter("all");
                  setSearchQuery("");
                }}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider hover:bg-rose-500/20 transition-all shrink-0"
              >
                <X className="w-4 h-4" /> Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Courses Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Courses...</p>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl p-16 flex flex-col items-center text-center">
            <BookOpen className="w-12 h-12 text-slate-600 mb-4 opacity-40" />
            <h3 className="text-lg font-bold text-white uppercase tracking-tight">No Courses Found</h3>
            <p className="text-slate-400 text-xs max-w-sm mt-1 mb-6">
              {searchQuery || selectedCategoryFilter !== "all" || selectedStatusFilter !== "all"
                ? "No courses match your filter criteria."
                : "Start by creating your first academic course and program structure."}
            </p>
            <button
              onClick={() => setIsAdding(true)}
              className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Course
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => (
              <div
                key={course.id || course._id}
                className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 hover:border-indigo-500/50 rounded-3xl overflow-hidden shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 group flex flex-col"
              >
                {/* Image Banner */}
                <div className="h-44 relative overflow-hidden bg-slate-950">
                  <img
                    src={normalizeAssetUrl(course.image_url) || "/images/icc-3.jpg"}
                    alt={course.course_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
                  
                  {/* Category Chip Overlay */}
                  <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md border border-slate-700/60 text-indigo-300 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-xl shadow-lg">
                    {getCategoryName(course.category_id)}
                  </div>

                  {/* Status Indicator */}
                  <div className="absolute top-3 right-3">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border backdrop-blur-md shadow-lg",
                      course.status === "active"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                    )}>
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        course.status === "active" ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                      )} />
                      {course.status}
                    </span>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                        {courseTypeLabel(course.course_type)}
                      </span>
                      {course.short_code && (
                        <span className="text-[10px] font-mono text-slate-400 font-bold">
                          [{course.short_code}]
                        </span>
                      )}
                    </div>
                    <h3 className="font-heading font-black text-lg text-white group-hover:text-indigo-300 transition-colors uppercase tracking-tight line-clamp-2 mt-1">
                      {course.course_name}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-2 leading-relaxed">
                      {stripHtml(course.description) || "No description provided."}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs">
                      <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Code className="w-3 h-3 text-indigo-400" /> Code
                        </div>
                        <div className="font-mono font-bold text-slate-200 mt-0.5">{course.course_code || "N/A"}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3 text-purple-400" /> Duration
                        </div>
                        <div className="font-bold text-slate-200 mt-0.5">{formatCourseDuration(course)}</div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <span className="font-medium text-[11px] text-slate-400">
                        {course.created_at ? format(new Date(course.created_at), "dd MMM yyyy") : "N/A"}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          title={course.featured_on_home ? "Remove from homepage" : "Feature on homepage (max 4)"}
                          onClick={() => toggleFeaturedHome(course)}
                          className={cn(
                            "p-2 rounded-xl border transition-all",
                            course.featured_on_home
                              ? "bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-md"
                              : "bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-amber-400 hover:border-amber-500/30"
                          )}
                        >
                          <Star className={cn("w-3.5 h-3.5", course.featured_on_home && "fill-current")} />
                        </button>
                        <button
                          onClick={() => handleEdit(course)}
                          className="p-2 rounded-xl bg-slate-800/80 hover:bg-indigo-600/20 hover:text-indigo-300 border border-slate-700/60 hover:border-indigo-500/40 text-slate-300 transition-all"
                          title="Edit Course"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(course.id || course._id || "")}
                          className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-600/20 hover:text-rose-400 border border-slate-700/60 hover:border-rose-500/40 text-slate-300 transition-all"
                          title="Delete Course"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CSV Bulk Modal */}
        <BulkCsvUploadModal
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          title="Bulk Import Courses"
          description="Upload multiple courses at once using a CSV spreadsheet."
          uploadEndpoint="/api/courses/bulk"
          sampleFilename="courses_bulk_template.csv"
          onSuccess={fetchData}
          columns={[
            { key: "course_name", label: "Course Name", required: true },
            { key: "category_id", label: "Category ID", required: true },
            { key: "course_code", label: "Course Code" },
            { key: "short_code", label: "Short Code" },
            { key: "duration_value", label: "Duration Value" },
            { key: "duration_unit", label: "Duration Unit" },
            { key: "course_type", label: "Course Type" },
            { key: "fees", label: "Course Fees in INR" },
            { key: "registration_fee", label: "Admission Fee in INR" },
            { key: "eligibility", label: "Eligibility" },
            { key: "status", label: "Status" },
          ]}
          sampleData={[
            {
              course_name: "Advanced Diploma in Computer Applications ADCA",
              category_id: categories[0]?.id || (categories[0] as any)?._id || "",
              course_code: "ADCA-101",
              short_code: "ADCA",
              duration_value: "12",
              duration_unit: "months",
              course_type: "diploma",
              fees: "12000",
              registration_fee: "1000",
              eligibility: "10th Pass",
              status: "active",
            },
          ]}
        />
      </div>
    </DashboardLayout>
  );

};

export default AdminCoursesPage;
