import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2, Pencil, Trash2, BookOpen, CheckCircle2, Clock, Code, AlertTriangle, ArrowRight, Upload, Image as ImageIcon, Star, Filter, Search, X } from "lucide-react";
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
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        {/* No Categories Warning Dialog */}
        <Dialog open={showCategoryWarning} onOpenChange={setShowCategoryWarning}>
          <DialogContent className="rounded-none border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading font-bold uppercase tracking-tight flex items-center gap-2 text-amber-500">
                <AlertTriangle className="w-5 h-5" /> Action Required
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-foreground py-2">
                You need to create a <strong>Course Category</strong> before you can create any courses. Categories help organize your programs (e.g., Computer Application, Vocational Training).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-muted/30 p-4 border border-border">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Why is this needed?</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A course cannot exist without a category. For example, a "DCA" course would belong to the "Computer Application" category.
                </p>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-col gap-2">
              <button
                onClick={() => navigate("/dashboard/academics/categories?from=courses")}
                className="w-full bg-primary text-primary-foreground py-4 font-heading font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                Go to Categories <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setShowCategoryWarning(false);
                  setWarningSkipped(true);
                }}
                className="w-full bg-background border border-border py-4 font-heading font-black text-[10px] uppercase tracking-widest hover:bg-muted/30 transition-all"
              >
                Skip (Manual Entry)
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Courses</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Manage your academic courses and programs.</p>
          </div>
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
                className="bg-primary text-primary-foreground px-6 py-3 rounded-none font-heading font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:opacity-90 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add New Course
              </button>
            </DialogTrigger>
            <DialogContent className="rounded-none border-border max-w-4xl max-h-[90vh] flex flex-col z-[100]">
              <DialogHeader>
                <DialogTitle className="font-heading font-bold uppercase tracking-tight">
                  {isEditing ? "Edit Course" : "Add New Course"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Data is stored in the database and shown on the public site and in center/student dashboards via the same APIs.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="pt-2 flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                  <div className="grid lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-primary border-b border-border pb-2">1. Basic information</h3>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2 sm:col-span-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course category *</Label>
                          <select
                            required
                            value={form.category_id}
                            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                            className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
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
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course type *</Label>
                          <select
                            required
                            value={form.course_type}
                            onChange={(e) => setForm({ ...form, course_type: e.target.value })}
                            className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                          >
                            {COURSE_TYPE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course name *</Label>
                          <input
                            required
                            value={form.course_name}
                            onChange={(e) => setForm({ ...form, course_name: e.target.value })}
                            className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                            placeholder="e.g. Advanced Diploma in Computer Applications"
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course Code</Label>
                          <input
                            value={form.course_code}
                            onChange={(e) => setForm({ ...form, course_code: e.target.value })}
                            className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                            placeholder="e.g. CRSE-001"
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Short Code (for Roll No generation)</Label>
                          <input
                            value={form.short_code}
                            onChange={(e) => setForm({ ...form, short_code: e.target.value })}
                            className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                            placeholder="e.g. ADCA"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Duration value *</Label>
                          <input
                            type="number"
                            required
                            min={1}
                            value={form.duration_value}
                            onChange={(e) => setForm({ ...form, duration_value: e.target.value })}
                            className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Duration unit</Label>
                          <select
                            value={form.duration_unit}
                            onChange={(e) => setForm({ ...form, duration_unit: e.target.value })}
                            className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                          >
                            <option value="years">Years</option>
                            <option value="months">Months</option>
                            <option value="weeks">Weeks</option>
                            <option value="days">Days</option>
                            <option value="hours">Hours</option>
                          </select>
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course description (HTML)</Label>
                          <CourseRichTextEditor
                            value={form.description}
                            onChange={(html) => setForm((f) => ({ ...f, description: html }))}
                            placeholder="Overview for website & dashboards. Use toolbar for bold, lists, links…"
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Syllabus (Markdown)</Label>
                          <textarea
                            value={form.syllabus}
                            onChange={(e) => setForm({ ...form, syllabus: e.target.value })}
                            className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary min-h-[100px]"
                            placeholder="Syllabus / modules in Markdown…"
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Eligibility</Label>
                          <input
                            value={form.eligibility}
                            onChange={(e) => setForm({ ...form, eligibility: e.target.value })}
                            className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                            placeholder="e.g. 10+2 or equivalent"
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</Label>
                          <select
                            value={form.status}
                            onChange={(e) => setForm({ ...form, status: e.target.value })}
                            className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-primary border-b border-border pb-2">2. Media</h3>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course image</Label>
                        <div className="w-full h-36 border-2 border-dashed border-border flex items-center justify-center bg-muted/20 relative group overflow-hidden rounded-md">
                          {form.image_url ? (
                            <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-center p-4">
                              <ImageIcon className="w-7 h-7 text-muted-foreground mx-auto mb-1" />
                              <p className="text-[9px] font-bold text-muted-foreground uppercase">No image</p>
                            </div>
                          )}
                          <label className="absolute inset-0 bg-primary/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <Upload className="w-5 h-5 text-white mb-1" />
                            <span className="text-[10px] font-black text-white uppercase">Upload</span>
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
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Social / SEO preview image</Label>
                        <div className="w-full h-28 border-2 border-dashed border-border flex items-center justify-center bg-muted/20 relative group overflow-hidden rounded-md">
                          {form.og_image_url ? (
                            <img src={form.og_image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[9px] text-muted-foreground uppercase font-bold">Optional OG image</span>
                          )}
                          <label className="absolute inset-0 bg-primary/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[10px] font-black text-white uppercase">
                            Upload
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

                      <h3 className="text-[10px] font-black uppercase tracking-widest text-primary border-b border-border pb-2 pt-2">3. Fees &amp; structure</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course fees (INR)</Label>
                          <input
                            type="number"
                            min={0}
                            value={form.fees}
                            onChange={(e) => setForm({ ...form, fees: e.target.value })}
                            className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                            placeholder="Enter course fee"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Admission fees (INR)</Label>
                          <input
                            type="number"
                            min={0}
                            value={form.registration_fee}
                            onChange={(e) => setForm({ ...form, registration_fee: e.target.value })}
                            className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                            placeholder="Enter admission fee"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
                        <div>
                          <Label className="text-xs font-semibold">Exam fees applicable?</Label>
                          <p className="text-[10px] text-muted-foreground">Show exam fee on public &amp; dashboards</p>
                        </div>
                        <Switch
                          checked={form.exam_fees_applicable}
                          onCheckedChange={(v) => setForm({ ...form, exam_fees_applicable: v })}
                        />
                      </div>
                      {form.exam_fees_applicable && (
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Exam fee amount (INR)</Label>
                          <input
                            type="number"
                            min={0}
                            value={form.exam_fee_amount}
                            onChange={(e) => setForm({ ...form, exam_fee_amount: e.target.value })}
                            className="w-full border border-border bg-background px-4 py-3 text-sm"
                            placeholder="Enter exam fee"
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
                        <div>
                          <Label className="text-xs font-semibold">Backlog fees applicable?</Label>
                          <p className="text-[10px] text-muted-foreground">Optional backlog / repeat paper fee</p>
                        </div>
                        <Switch
                          checked={form.backlog_fees_applicable}
                          onCheckedChange={(v) => setForm({ ...form, backlog_fees_applicable: v })}
                        />
                      </div>
                      {form.backlog_fees_applicable && (
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Backlog fee amount (INR)</Label>
                          <input
                            type="number"
                            min={0}
                            value={form.backlog_fee_amount}
                            onChange={(e) => setForm({ ...form, backlog_fee_amount: e.target.value })}
                            className="w-full border border-border bg-background px-4 py-3 text-sm"
                            placeholder="Enter backlog fee"
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course structure</Label>
                        <p className="text-[10px] text-muted-foreground mb-1">Does this course have units (semester / yearly)?</p>
                        <RadioGroup
                          value={form.has_course_structure_units ? "yes" : "no"}
                          onValueChange={(v) => setForm({ ...form, has_course_structure_units: v === "yes" })}
                          className="flex gap-6"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="yes" id="units-yes" />
                            <Label htmlFor="units-yes" className="font-normal cursor-pointer">
                              Yes
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="no" id="units-no" />
                            <Label htmlFor="units-no" className="font-normal cursor-pointer">
                              No
                            </Label>
                          </div>
                        </RadioGroup>
                        {form.has_course_structure_units && (
                          <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Unit Type</Label>
                              <select
                                value={form.unit_type}
                                onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
                                className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                              >
                                <option value="">Select unit type</option>
                                <option value="quarterly">Quarterly</option>
                                <option value="semesters">Semesters</option>
                                <option value="yearly">Yearly</option>
                                <option value="custom">Custom</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Unit Count (Total)</Label>
                              <input
                                type="number"
                                min={1}
                                value={form.unit_count}
                                onChange={(e) => setForm({ ...form, unit_count: e.target.value })}
                                className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                                placeholder="Example: 4 for 4 Semesters"
                              />
                            </div>
                            {form.unit_type === "custom" && (
                              <div className="space-y-2 col-span-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Custom Unit Name</Label>
                                <input
                                  value={form.custom_unit_name}
                                  onChange={(e) => setForm({ ...form, custom_unit_name: e.target.value })}
                                  className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                                  placeholder="Example: Trimester"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-border pt-4">
                    <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
                      <div>
                        <Label className="text-xs font-semibold">Enable typing practice for this course</Label>
                        <p className="text-[10px] text-muted-foreground">
                          Students see only selected lessons (or languages from Typing allotment). Turn off to hide all typing tests.
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
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Linked typing lessons (optional)
                        </Label>
                        <p className="text-[10px] text-muted-foreground">
                          Hold Ctrl/Cmd to select multiple. If none selected, lessons follow <strong>Typing → Tests &amp; Allotment</strong> language mapping for this course.
                        </p>
                        <select
                          multiple
                          value={form.linked_typing_tests}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              linked_typing_tests: Array.from(e.target.selectedOptions, (o) => o.value),
                            })
                          }
                          className="w-full border border-border bg-background px-4 py-3 text-sm h-32"
                        >
                          {typingLessons.map((lesson) => (
                            <option key={lesson._id} value={lesson._id}>
                              {lesson.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
                      <div>
                        <Label className="text-xs font-semibold">Enable subject mock tests</Label>
                        <p className="text-[10px] text-muted-foreground">
                          When on, students can open mocks you define per subject under{" "}
                          <button
                            type="button"
                            className="underline font-bold text-primary p-0 h-auto align-baseline"
                            onClick={() => navigate("/dashboard/academics/mock-tests")}
                          >
                            Mock tests
                          </button>
                          . Center mock-test dates must allow attempts.
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
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Linked mock tests (optional)
                        </Label>
                        <p className="text-[10px] text-muted-foreground">
                          Hold Ctrl/Cmd to select multiple. If none selected, students see all mock tests based on their course subjects.
                        </p>
                        <select
                          multiple
                          value={form.linked_mock_tests}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              linked_mock_tests: Array.from(e.target.selectedOptions, (o) => o.value),
                            })
                          }
                          className="w-full border border-border bg-background px-4 py-3 text-sm h-32"
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
                    <div className="flex items-center gap-2 text-primary text-xs font-bold">
                      <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
                    </div>
                  )}
                </div>
                <DialogFooter className="pt-6 mt-4 border-t border-border">
                  <button
                    type="submit"
                    disabled={saving || uploading}
                    className="w-full bg-primary text-primary-foreground py-4 font-heading font-black text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {isEditing ? "Update Course" : "Create Course"}
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="rounded-none border-border shadow-sm">
          <CardContent className="p-4 flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="SEARCH COURSES..."
                className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-muted/30 text-[10px] font-black uppercase tracking-widest focus:border-primary focus:outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="flex-1 flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="w-full border border-border bg-muted/10 dark:bg-neutral-900 text-foreground [&_option]:text-foreground [&_option]:bg-white dark:[&_option]:bg-neutral-900 px-4 py-2 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-primary"
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
                  className="w-full border border-border bg-muted/10 dark:bg-neutral-900 text-foreground [&_option]:text-foreground [&_option]:bg-white dark:[&_option]:bg-neutral-900 px-4 py-2 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-primary"
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
                  className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-all"
                >
                  <X className="w-4 h-4" /> Reset
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : filteredCourses.length === 0 ? (
          <Card className="rounded-none border-dashed border-2 border-border">
            <CardContent className="py-20 flex flex-col items-center text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-lg font-bold uppercase tracking-tight">No Courses Found</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2">
                {searchQuery || selectedCategoryFilter !== "all" || selectedStatusFilter !== "all"
                  ? "No courses match your filter criteria."
                  : "Start by creating your first course and program."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => (
              <Card key={course.id || course._id} className="rounded-none border-border group hover:border-primary transition-all overflow-hidden">
                <div className="h-36 overflow-hidden">
                  <img
                    src={normalizeAssetUrl(course.image_url) || "/images/icc-3.jpg"}
                    alt={course.course_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between py-4">
                  <div className="space-y-1">
                    <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-primary" />
                      {course.course_name}
                    </CardTitle>
                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      {getCategoryName(course.category_id)}
                    </div>
                  </div>
                  <div className={cn(
                    "text-[8px] font-black uppercase px-2 py-1 tracking-widest",
                    course.status === "active" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                  )}>
                    {course.status}
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="space-y-1">
                      <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                        <Code className="w-3 h-3" /> Code
                      </div>
                      <div className="text-xs font-mono font-bold">{course.course_code}</div>
                    </div>
                    <div className="space-y-1 text-right">
                      <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" /> Duration
                      </div>
                      <div className="text-xs font-bold">{formatCourseDuration(course)}</div>
                    </div>
                  </div>
                  <div className="text-[9px] font-black uppercase text-primary/80 mb-1">{courseTypeLabel(course.course_type)}</div>
                  <p className="text-sm text-muted-foreground line-clamp-3 min-h-[60px]">
                    {stripHtml(course.description) || "No description provided."}
                  </p>
                  <div className="mt-6 pt-6 border-t border-border flex items-center justify-between">
                    <div className="text-[10px] text-muted-foreground font-medium">
                      Created: {course.created_at ? format(new Date(course.created_at), "dd MMM yyyy") : "N/A"}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title={course.featured_on_home ? "Remove from home page" : "Feature on home page (max 4)"}
                        onClick={() => toggleFeaturedHome(course)}
                        className={cn(
                          "p-2 border transition-all",
                          course.featured_on_home
                            ? "border-amber-500 text-amber-600 bg-amber-500/10"
                            : "border-border hover:border-amber-500/50 hover:text-amber-600",
                        )}
                      >
                        <Star className={cn("w-3.5 h-3.5", course.featured_on_home && "fill-current")} />
                      </button>
                      <button
                        onClick={() => handleEdit(course)}
                        className="p-2 border border-border hover:border-primary hover:text-primary transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(course.id || course._id || "")}
                        className="p-2 border border-border hover:border-red-500 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminCoursesPage;
