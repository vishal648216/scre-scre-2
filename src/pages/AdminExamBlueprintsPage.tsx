import React, { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  Trash2,
  Pencil,
  Settings2,
  ClipboardList,
  Loader2,
  PlusCircle,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { useTimeSync, syncServerTime } from "@/lib/time";

interface CourseCategory {
  id: string;
  name: string;
  category_code: string;
}

interface Course {
  id: string;
  course_name: string;
  category_id: string;
}

interface Session {
  id: string;
  session_name: string;
  course_id: string;
}

interface Subject {
  id: string;
  subject_name: string;
}

interface QuestionBank {
  _id: string;
  name: string;
  question_count?: number;
  subject_id?: string;
}

interface BlueprintRule {
  marks: number;
  count: number;
  options_count?: number;
}

interface BlueprintComponentsPart {
  enabled: boolean;
  marks: number;
  min_marks: number;
}

interface SubjectBlueprintConfig {
  subject_id: string;
  default_question_bank_id: string;
  reappear_question_bank_id?: string;
  final_subject_total_marks: number;
  practical_component: BlueprintComponentsPart;
  assignment_component: BlueprintComponentsPart;
  final_exam_component: BlueprintComponentsPart;
  question_distribution: BlueprintRule[];
  advanced_settings?: any;
  instructions?: string;
  duration_minutes: number;
}

interface ExamBlueprint {
  _id?: string;
  name: string;
  category_id?: string;
  course_id: string;
  session_id?: string;
  subjects: SubjectBlueprintConfig[];
  duration_minutes: number;
  total_duration_minutes: number;
  max_attempts: number;
  instructions: string;
  // Legacy fields for backward compatibility
  bank_id?: string;
  reappear_bank_id?: string;
  total_marks?: number;
  minimum_marks?: number;
  mode?: "Strict" | "Flex";
  exam_mode?: string;
  practical_enabled?: boolean;
  assignment_enabled?: boolean;
  components?: any;
  allow_bank_override?: boolean;
  rules?: BlueprintRule[];
  sections?: any[];
  created_at?: string;
  default_blueprint?: boolean;
  exam_pattern?: string;
  term_number?: number;
}

const AdminExamBlueprintsPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [blueprints, setBlueprints] = useState<ExamBlueprint[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const isSynced = useTimeSync();
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const [form, setForm] = useState<ExamBlueprint>({
    name: "",
    category_id: "",
    course_id: "",
    session_id: "",
    subjects: [],
    duration_minutes: 60,
    total_duration_minutes: 0,
    max_attempts: 1,
    instructions: "",
    exam_pattern: "Semester",
    term_number: 1,
  });

  const [sameInstructionsForAll, setSameInstructionsForAll] = useState(false);
  const [sharedInstructions, setSharedInstructions] = useState("");
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"new" | "old">("new");

  // Helper functions for formatting
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours} h ${mins} min`;
    }
    return `${mins} min`;
  };

  const formatDate = (dateStr: any) => {
    console.log("formatDate called with:", dateStr);
    try {
      if (!dateStr) return "";

      let date;

      // If it's an object with $date
      if (typeof dateStr === "object" && dateStr.$date) {
        date = new Date(dateStr.$date);
      }
      // If it's an object with $numberLong
      else if (typeof dateStr === "object" && dateStr.$numberLong) {
        date = new Date(parseInt(dateStr.$numberLong));
      }
      // If it's just a string or number
      else {
        date = new Date(dateStr);
      }

      if (isNaN(date.getTime())) {
        return "";
      }

      return date.toLocaleDateString();
    } catch (e) {
      console.error("Error formatting date:", e);
      return "";
    }
  };

  const createEmptySubjectConfig = (subjectId: string, defaultInstructions?: string): SubjectBlueprintConfig => ({
    subject_id: subjectId,
    default_question_bank_id: undefined,
    reappear_question_bank_id: undefined,
    final_subject_total_marks: 100,
    practical_component: { enabled: false, marks: 0, min_marks: 0 },
    assignment_component: { enabled: false, marks: 0, min_marks: 0 },
    final_exam_component: { enabled: true, marks: 100, min_marks: 33 },
    question_distribution: [{ marks: 1, count: 100 }],
    advanced_settings: {},
    instructions: defaultInstructions || "",
    duration_minutes: 60,
  });

  const getSubjectConfig = (subjectId: string): SubjectBlueprintConfig => {
    const existing = form.subjects.find(s => s.subject_id === subjectId);
    if (existing) {
      return existing;
    }
    return createEmptySubjectConfig(subjectId);
  };

  const setSubjectConfig = (config: SubjectBlueprintConfig) => {
    setForm(prev => {
      let newSubjects = [...prev.subjects];
      const index = newSubjects.findIndex(s => s.subject_id === config.subject_id);

      // If same instructions for all is on and we're updating instructions, update all subjects
      if (sameInstructionsForAll && config.instructions !== undefined) {
        newSubjects = newSubjects.map(s => ({
          ...s,
          instructions: config.instructions,
        }));
        setSharedInstructions(config.instructions || "");
      } else if (index >= 0) {
        newSubjects[index] = config;
      } else {
        newSubjects.push(config);
      }

      // If same mode is on, ensure the new/updated subject has the shared instructions
      if (sameInstructionsForAll && index < 0) {
        const lastIndex = newSubjects.length - 1;
        newSubjects[lastIndex] = {
          ...newSubjects[lastIndex],
          instructions: sharedInstructions,
        };
      }

      return { ...prev, subjects: newSubjects };
    });
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        blueprintsRes,
        categoriesRes,
        coursesRes,
        sessionsRes,
        subjectsRes,
        banksRes,
      ] = await Promise.all([
        apiFetch("/api/exam/blueprints"),
        apiFetch("/api/admin/categories"),
        apiFetch("/api/courses"),
        apiFetch("/api/academic/sessions"),
        apiFetch("/api/admin/subjects"),
        apiFetch("/api/qb/banks"),
      ]);

      if (blueprintsRes.ok) {
        const data = await blueprintsRes.json();
        setBlueprints(
          data.map((bp: any) => ({
            ...bp,
            _id:
              typeof bp._id === "object" && bp._id ? bp._id.$oid : bp._id,
            category_id:
              typeof bp.category_id === "object" && bp.category_id
                ? bp.category_id.$oid
                : bp.category_id,
            course_id:
              typeof bp.course_id === "object" && bp.course_id
                ? bp.course_id.$oid
                : bp.course_id,
            session_id:
              typeof bp.session_id === "object" && bp.session_id
                ? bp.session_id.$oid
                : bp.session_id,
            bank_id:
              typeof bp.bank_id === "object" && bp.bank_id
                ? bp.bank_id.$oid
                : bp.bank_id,
            reappear_bank_id:
              typeof bp.reappear_bank_id === "object" && bp.reappear_bank_id
                ? bp.reappear_bank_id.$oid
                : bp.reappear_bank_id,
            subject_id:
              typeof bp.subject_id === "object" && bp.subject_id
                ? bp.subject_id.$oid
                : bp.subject_id,
            created_by:
              typeof bp.created_by === "object" && bp.created_by
                ? bp.created_by.$oid
                : bp.created_by,
            created_at:
              (typeof bp.created_at === "object" && bp.created_at?.$date) ||
              (typeof bp.created_at === "object" && bp.created_at?.$numberLong) ||
              bp.created_at,
            subjects:
              bp.subjects?.map((s: any) => ({
                ...s,
                subject_id:
                  typeof s.subject_id === "object" && s.subject_id
                    ? s.subject_id.$oid
                    : s.subject_id,
                default_question_bank_id:
                  typeof s.default_question_bank_id === "object" &&
                    s.default_question_bank_id
                    ? s.default_question_bank_id.$oid
                    : s.default_question_bank_id,
                reappear_question_bank_id:
                  s.reappear_question_bank_id &&
                    typeof s.reappear_question_bank_id === "object"
                    ? s.reappear_question_bank_id.$oid
                    : s.reappear_question_bank_id,
                practical_component: {
                  enabled: s.practical_component?.enabled ?? false,
                  marks: s.practical_component?.marks ?? 0,
                  min_marks: s.practical_component?.min_marks ?? 0,
                },
                assignment_component: {
                  enabled: s.assignment_component?.enabled ?? false,
                  marks: s.assignment_component?.marks ?? 0,
                  min_marks: s.assignment_component?.min_marks ?? 0,
                },
                final_exam_component: {
                  enabled: s.final_exam_component?.enabled ?? true,
                  marks: s.final_exam_component?.marks ?? 100,
                  min_marks: s.final_exam_component?.min_marks ?? 33,
                },
              })) || [],
          }))
        );
      }

      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setCategories(data.items || data);
      }

      if (coursesRes.ok) {
        const data = await coursesRes.json();
        setCourses(data);
      }

      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        setSessions(data);
      }

      if (subjectsRes.ok) {
        const data = await subjectsRes.json();
        setSubjects(data.items || data);
      }

      if (banksRes.ok) {
        const data = await banksRes.json();
        setBanks(
          data.map((b: any) => ({
            ...b,
            _id: typeof b._id === "object" ? b._id.$oid : b._id,
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchCourseSubjects = async (courseId: string) => {
    try {
      const res = await apiFetch(`/api/academic/course-subjects/${courseId}`);
      if (res.ok) {
        const courseSubjects = await res.json();
        // Get full subject details for each course subject
        const subjectIds = courseSubjects.map((cs: any) => cs.subject_id);
        const subjectDetails = subjects.filter((s) =>
          subjectIds.includes(s.id)
        );
        return subjectDetails;
      }
      return [];
    } catch (error) {
      console.error("Error fetching course subjects:", error);
      return [];
    }
  };

  const handleCategoryChange = async (categoryId: string) => {
    setForm((prev) => ({
      ...prev,
      category_id: categoryId,
      course_id: "",
      session_id: "",
      subjects: [],
    }));
    setSelectedSubjectId(null);
  };

  const handleCourseChange = async (courseId: string) => {
    setForm((prev) => ({
      ...prev,
      course_id: courseId,
      session_id: "",
      subjects: [],
    }));
    setSelectedSubjectId(null);

    if (courseId) {
      const courseSubjects = await fetchCourseSubjects(courseId);
    }
  };

  const handleFilterCategoryChange = (catId: string) => {
    setFilterCategory(catId);
    setFilterCourse("all");
  };

  // Get courses for filter (based on selected category)
  const getFilterCourses = () => {
    if (!filterCategory || filterCategory === "all") return [];
    return courses.filter((c) => c.category_id === filterCategory);
  };

  const handleSubjectSelect = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    // Ensure subject config exists in form
    if (!form.subjects.find(s => s.subject_id === subjectId)) {
      setForm(prev => ({
        ...prev,
        subjects: [...prev.subjects, createEmptySubjectConfig(subjectId, sameInstructionsForAll ? sharedInstructions : undefined)],
      }));
    }
  };

  useEffect(() => {
    if (sameInstructionsForAll && form.subjects.length > 0) {
      // Take instructions from first subject, or empty string if none
      const firstSubjectInstructions = form.subjects[0]?.instructions || "";
      setSharedInstructions(firstSubjectInstructions);
      // Update all subjects to have the same instructions
      setForm(prev => ({
        ...prev,
        subjects: prev.subjects.map(s => ({
          ...s,
          instructions: firstSubjectInstructions,
        })),
      }));
    }
  }, [sameInstructionsForAll]);

  const handleSave = async () => {
    if (!form.name || !form.category_id || !form.course_id) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (form.subjects.length === 0) {
      toast.error("Please configure at least one subject");
      return;
    }

    // Validate all subject configs
    for (const subject of form.subjects) {
      if (!subject.default_question_bank_id) {
        toast.error(
          `Please select a default question bank for subject ${subject.subject_id}`
        );
        return;
      }

      const calculated_exam_total = subject.question_distribution.reduce(
        (acc, r) => acc + r.marks * r.count,
        0
      );
      if (
        Math.abs(calculated_exam_total - subject.final_exam_component.marks) >
        0.01
      ) {
        toast.error(
          `Question distribution marks (${calculated_exam_total.toFixed(2)}) must match Final Exam marks (${subject.final_exam_component.marks.toFixed(2)}) for subject ${subject.subject_id}`
        );
        return;
      }

      const total_components =
        (subject.practical_component.enabled ? subject.practical_component.marks : 0) +
        (subject.assignment_component.enabled ? subject.assignment_component.marks : 0) +
        subject.final_exam_component.marks;
      if (
        Math.abs(total_components - subject.final_subject_total_marks) >
        0.01
      ) {
        toast.error(
          `Components total (${total_components.toFixed(2)}) must match Subject Total Marks (${subject.final_subject_total_marks.toFixed(2)}) for subject ${subject.subject_id}`
        );
        return;
      }
    }

    setSaving(true);
    try {
      const response = await apiFetch(
        `/api/exam/blueprints${form._id ? `/${form._id}` : ""}`,
        {
          method: form._id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      if (response.ok) {
        toast.success("Blueprint saved successfully");
        setIsAdding(false);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to save blueprint");
      }
    } catch (error) {
      toast.error("An error occurred while saving");
    } finally {
      setSaving(false);
    }
  };

  const getFilteredCourses = () => {
    if (!form.category_id) return [];
    return courses.filter((c) => c.category_id === form.category_id);
  };

  const getFilteredSessions = () => {
    if (!form.course_id) return [];
    return sessions.filter((s) => s.course_id === form.course_id);
  };

  const getCourseSubjects = () => {
    if (!form.course_id) return [];
    // In a real app, we'd fetch this, but for now, let's use all subjects
    return subjects;
  };

  // Helper function to get timestamp from any date format
  const getTimestamp = (dateVal: any) => {
    try {
      if (!dateVal) return 0;

      if (typeof dateVal === "object" && dateVal.$date) {
        return new Date(dateVal.$date).getTime();
      }
      if (typeof dateVal === "object" && dateVal.$numberLong) {
        return parseInt(dateVal.$numberLong);
      }
      if (typeof dateVal === "string" || typeof dateVal === "number") {
        const time = new Date(dateVal).getTime();
        return isNaN(time) ? 0 : time;
      }
      return 0;
    } catch (e) {
      return 0;
    }
  };

  // Filtered & sorted blueprints
  const filteredBlueprints = useMemo(() => {
    let filtered = [...blueprints];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((bp) =>
        bp.name.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (filterCategory && filterCategory !== "all") {
      filtered = filtered.filter((bp) => bp.category_id === filterCategory);
    }

    // Course filter
    if (filterCourse && filterCourse !== "all") {
      filtered = filtered.filter((bp) => bp.course_id === filterCourse);
    }

    // Sort
    if (sortOrder === "new") {
      // Newest first
      filtered.sort((a: any, b: any) => {
        const aTime = getTimestamp(a.created_at);
        const bTime = getTimestamp(b.created_at);
        return bTime - aTime;
      });
    } else {
      // Oldest first
      filtered.sort((a: any, b: any) => {
        const aTime = getTimestamp(a.created_at);
        const bTime = getTimestamp(b.created_at);
        return aTime - bTime;
      });
    }

    return filtered;
  }, [blueprints, searchQuery, filterCategory, filterCourse, sortOrder]);

  // Calculate total duration for current form
  const totalDuration = useMemo(() => {
    return form.subjects.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  }, [form.subjects]);

  useEffect(() => {
    const checkSync = async () => {
      if (!isSynced) {
        await syncServerTime();
      }
    };
    checkSync();
    fetchData();
  }, [isSynced]);

  return (
    <DashboardLayout role="superadmin">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-foreground flex items-center gap-3">
              <ClipboardList className="w-8 h-8 text-primary" />
              Exam Blueprints
            </h1>
            <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.2em] mt-1">
              Design dynamic rule-based exam structures
            </p>
          </div>
          <Button
            onClick={() => {
              setForm({
                name: "",
                category_id: "",
                course_id: "",
                session_id: "",
                subjects: [],
                duration_minutes: 60,
                total_duration_minutes: 0,
                max_attempts: 1,
                instructions: "",
                default_blueprint: false,
              });
              setSameInstructionsForAll(false);
              setSharedInstructions("");
              setSelectedSubjectId(null);
              setIsAdding(true);
            }}
            className="rounded-none font-black uppercase tracking-widest text-xs h-12 px-8"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Blueprint
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 p-6 bg-muted/30 border border-border rounded-none">
          {/* Search Bar */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest">Search</Label>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search blueprints..."
              className="rounded-none border-border"
            />
          </div>

          {/* Course Category Filter */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest">Course Category</Label>
            <Select value={filterCategory} onValueChange={handleFilterCategoryChange}>
              <SelectTrigger className="rounded-none border-border">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Course Filter */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest">Course</Label>
            <Select value={filterCourse} onValueChange={setFilterCourse}>
              <SelectTrigger className="rounded-none border-border">
                <SelectValue placeholder={filterCategory ? "All Courses" : "Select Category First"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {getFilterCourses().map((course) => (
                  <SelectItem key={course.id} value={course.id}>{course.course_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sort Filter */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest">Sort</Label>
            <Select value={sortOrder} onValueChange={(val: "new" | "old") => setSortOrder(val)}>
              <SelectTrigger className="rounded-none border-border">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New to Old</SelectItem>
                <SelectItem value="old">Old to New</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Loading Blueprints...
            </p>
          </div>
        ) : filteredBlueprints.length === 0 ? (
          <Card className="rounded-none border-dashed border-2 bg-muted/30">
            <CardContent className="py-20 text-center">
              <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">
                No blueprints found. Try adjusting your filters.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBlueprints.map((bp) => (
              <Card
                key={bp._id}
                className="rounded-none border-border shadow-md hover:border-primary/50 transition-all group"
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-black uppercase tracking-tight leading-none pr-4">
                      {bp.name}
                    </CardTitle>
                    <Settings2 className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </div>
                  <div className="space-y-1 mt-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      {courses.find((c) => c.id === bp.course_id)?.course_name ||
                        "Unknown Course"}
                    </p>
                    <p className="text-[10px] font-bold text-primary/70 uppercase tracking-widest">
                      {sessions.find((s) => s.id === bp.session_id)
                        ?.session_name || "No Session Selected"}
                      <span className="mx-2 opacity-30">|</span>
                      {bp.subjects.length} Subjects
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between pt-2 border-t border-border gap-2">
                    <div className="flex gap-2 flex-wrap items-center">
                      <span className="text-[9px] font-black uppercase text-primary bg-primary/10 px-2 py-1">
                        {formatDuration(bp.total_duration_minutes || 0)}
                      </span>
                      {bp.exam_pattern && (
                        <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1">
                          {bp.exam_pattern} {bp.term_number ? `• Term ${bp.term_number}` : ''}
                        </span>
                      )}
                      {bp.created_at && (
                        <span className="text-[9px] font-black uppercase text-muted-foreground bg-muted px-2 py-1">
                          {formatDate(bp.created_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setForm(bp);
                          setSameInstructionsForAll(false);
                          setSharedInstructions("");
                          setSelectedSubjectId(
                            bp.subjects.length > 0 ? bp.subjects[0].subject_id : null
                          );
                          setIsAdding(true);
                        }}
                        className="h-8 rounded-none font-black uppercase text-[10px] tracking-widest"
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            const res = await apiFetch(
                              `/api/exam/blueprints/${bp._id}/set-default`,
                              { method: "POST" }
                            );
                            if (res.ok) {
                              toast.success("Default blueprint set successfully");
                              fetchData();
                            }
                          } catch (error) {
                            toast.error("Failed to set default blueprint");
                          }
                        }}
                        className="h-8 rounded-none font-black uppercase text-[10px] tracking-widest"
                      >
                        {bp.default_blueprint ? "Default" : "Set as Default"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (
                            confirm("Are you sure you want to delete this blueprint?")
                          ) {
                            try {
                              const res = await apiFetch(
                                `/api/exam/blueprints/${bp._id}`,
                                { method: "DELETE" }
                              );
                              if (res.ok) {
                                toast.success("Blueprint deleted");
                                fetchData();
                              }
                            } catch (error) {
                              toast.error("Failed to delete");
                            }
                          }
                        }}
                        className="h-8 rounded-none font-black uppercase text-[10px] tracking-widest text-red-500"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-none border-primary">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                {form._id ? t("Edit Exam Blueprint") : t("Design Exam Blueprint")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-8 py-4">
              {/* Section 1: Basic Configuration */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b-2 border-primary/20">
                  <div className="w-2 h-6 bg-primary" />
                  <h3 className="font-black uppercase tracking-widest text-sm">
                    1. Basic Information
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6 bg-muted/30 border border-border">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">
                      {t("Exam Name")}
                    </Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder={t("e.g., ADCA Final Exam 2026")}
                      className="rounded-none border-border font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">
                      {t("Course Category")}
                    </Label>
                    <Select
                      value={form.category_id}
                      onValueChange={handleCategoryChange}
                    >
                      <SelectTrigger className="rounded-none border-border font-bold">
                        <SelectValue placeholder={t("Select Category")} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">
                      {t("Course")}
                    </Label>
                    <Select value={form.course_id} onValueChange={handleCourseChange}>
                      <SelectTrigger className="rounded-none border-border font-bold">
                        <SelectValue placeholder={t("Select Course")} />
                      </SelectTrigger>
                      <SelectContent>
                        {getFilteredCourses().map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.course_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">
                      {t("Session")}
                    </Label>
                    <Select
                      value={form.session_id}
                      onValueChange={(val) =>
                        setForm({ ...form, session_id: val })
                      }
                    >
                      <SelectTrigger className="rounded-none border-border font-bold">
                        <SelectValue placeholder={t("Select Session")} />
                      </SelectTrigger>
                      <SelectContent>
                        {getFilteredSessions().map((session) => (
                          <SelectItem key={session.id} value={session.id}>
                            {session.session_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.default_blueprint || false}
                        onChange={(e) => setForm({ ...form, default_blueprint: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <Label className="text-[10px] font-black uppercase tracking-widest">
                        Set as Default Blueprint
                      </Label>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest">
                        Exam Pattern
                      </Label>
                      <Select
                        value={form.exam_pattern || "Semester"}
                        onValueChange={(val) => setForm({ ...form, exam_pattern: val })}
                      >
                        <SelectTrigger className="rounded-none border-border font-bold">
                          <SelectValue placeholder="Select Pattern" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Semester">Semester Pattern</SelectItem>
                          <SelectItem value="Yearly">Yearly Pattern</SelectItem>
                          <SelectItem value="Monthly">Monthly Pattern</SelectItem>
                          <SelectItem value="Weekly">Weekly Pattern</SelectItem>
                          <SelectItem value="Days">Custom Days Pattern</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest">
                        Term / Sequence No.
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        value={form.term_number ?? 1}
                        onChange={(e) =>
                          setForm({ ...form, term_number: parseInt(e.target.value) || 1 })
                        }
                        className="rounded-none border-border font-bold"
                        placeholder="e.g. 1 (for Sem 1 or Year 1)"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {form.course_id && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Subjects List */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-1 border-b-2 border-primary/20">
                      <div className="w-2 h-6 bg-primary" />
                      <h3 className="font-black uppercase tracking-widest text-sm">
                        2. Subjects
                      </h3>
                    </div>
                    <div className="p-4 bg-muted/30 border border-border space-y-3">
                      {getCourseSubjects().map((subject) => {
                        const isSelected = selectedSubjectId === subject.id;
                        const isConfigured =
                          form.subjects.find((s) => s.subject_id === subject.id) !==
                          undefined;
                        return (
                          <Button
                            key={subject.id}
                            variant={isSelected ? "default" : "ghost"}
                            onClick={() => handleSubjectSelect(subject.id)}
                            className="w-full justify-start rounded-none text-left h-auto py-3"
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="flex-1 whitespace-normal break-words">{subject.subject_name}</span>
                              {isConfigured && (
                                <Settings2 className="w-4 h-4 text-green-500 flex-shrink-0 ml-2" />
                              )}
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Subject Configuration */}
                  <div className="lg:col-span-2 space-y-4">
                    {selectedSubjectId ? (
                      <>
                        <div className="flex items-center gap-2 pb-1 border-b-2 border-primary/20">
                          <div className="w-2 h-6 bg-primary" />
                          <h3 className="font-black uppercase tracking-widest text-sm">
                            3. Configure{" "}
                            {
                              subjects.find((s) => s.id === selectedSubjectId)
                                ?.subject_name
                            }
                          </h3>
                        </div>
                        <SubjectConfigForm
                          config={getSubjectConfig(selectedSubjectId)}
                          subjects={subjects}
                          banks={banks}
                          onChange={(config) => setSubjectConfig(config)}
                          sameInstructionsForAll={sameInstructionsForAll}
                          setSameInstructionsForAll={setSameInstructionsForAll}
                          sharedInstructions={sharedInstructions}
                          setSharedInstructions={setSharedInstructions}
                          form={form}
                          setForm={setForm}
                          totalDuration={totalDuration}
                          formatDuration={formatDuration}
                        />
                      </>
                    ) : (
                      <div className="p-8 text-center text-muted-foreground">
                        Select a subject to configure
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="border-t pt-4">
              <Button
                variant="outline"
                onClick={() => setIsAdding(false)}
                className="rounded-none font-black uppercase tracking-widest text-xs h-12 px-8"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="rounded-none font-black uppercase tracking-widest text-xs h-12 px-8"
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {form._id ? t("Update Blueprint") : t("Save Blueprint")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

// Subject Configuration Form Component
interface SubjectConfigFormProps {
  config: SubjectBlueprintConfig;
  subjects: Subject[];
  banks: QuestionBank[];
  onChange: (config: SubjectBlueprintConfig) => void;
  sameInstructionsForAll: boolean;
  setSameInstructionsForAll: (val: boolean) => void;
  sharedInstructions: string;
  setSharedInstructions: (val: string) => void;
  form: ExamBlueprint;
  setForm: React.Dispatch<React.SetStateAction<ExamBlueprint>>;
  totalDuration: number;
  formatDuration: (minutes: number) => string;
}

const SubjectConfigForm = ({
  config,
  subjects,
  banks,
  onChange,
  sameInstructionsForAll,
  setSameInstructionsForAll,
  sharedInstructions,
  setSharedInstructions,
  form,
  setForm,
  totalDuration,
  formatDuration,
}: SubjectConfigFormProps) => {
  const { t } = useTranslation();

  const updateConfig = (updates: Partial<SubjectBlueprintConfig>) => {
    onChange({ ...config, ...updates });
  };

  const distributionTotal = config.question_distribution.reduce(
    (acc, r) => acc + r.marks * r.count,
    0
  );
  const isDistributionMismatch =
    Math.abs(distributionTotal - config.final_exam_component.marks) > 0.01;

  // Auto-calculate Final Exam marks from rules
  useEffect(() => {
    const calculatedExamTotal = config.question_distribution.reduce(
      (acc, r) => acc + r.marks * r.count,
      0
    );
    if (Math.abs(config.final_exam_component.marks - calculatedExamTotal) > 0.01) {
      updateConfig({
        final_exam_component: {
          ...config.final_exam_component,
          marks: calculatedExamTotal,
        },
      });
    }
  }, [config.question_distribution]);

  // Auto-calculate Total Subject Marks when components change
  useEffect(() => {
    const total =
      (config.practical_component.enabled ? config.practical_component.marks : 0) +
      (config.assignment_component.enabled ? config.assignment_component.marks : 0) +
      config.final_exam_component.marks;
    if (Math.abs(config.final_subject_total_marks - total) > 0.01) {
      updateConfig({
        final_subject_total_marks: total,
      });
    }
  }, [
    config.practical_component.enabled,
    config.practical_component.marks,
    config.assignment_component.enabled,
    config.assignment_component.marks,
    config.final_exam_component.marks,
  ]);

  return (
    <div className="space-y-6">
      {/* Question Banks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-muted/30 border border-border">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest">
            {t("Default Question Bank")}
          </Label>
          <Select
            value={config.default_question_bank_id || ""}
            onValueChange={(val) =>
              updateConfig({ default_question_bank_id: val })
            }
          >
            <SelectTrigger className="rounded-none border-border font-bold bg-yellow-50/50">
              <SelectValue placeholder={t("Select Default Bank")} />
            </SelectTrigger>
            <SelectContent>
              {banks.map((bank) => (
                <SelectItem key={bank._id} value={bank._id}>
                  {bank.name} {bank.question_count !== undefined ? `(${bank.question_count} Qs)` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest">
            {t("Reappear Question Bank (Optional)")}
          </Label>
          <Select
            value={config.reappear_question_bank_id || "__use_default__"}
            onValueChange={(val) =>
              updateConfig({
                reappear_question_bank_id: val === "__use_default__" ? undefined : val,
              })
            }
          >
            <SelectTrigger className="rounded-none border-border font-bold bg-blue-50/30">
              <SelectValue placeholder={t("Same as Default")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__use_default__">{t("Use Default Bank")}</SelectItem>
              {banks.map((bank) => (
                <SelectItem key={bank._id} value={bank._id}>
                  {bank.name} {bank.question_count !== undefined ? `(${bank.question_count} Qs)` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Question Distribution */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-1 border-b-2 border-primary/20">
          <div className="w-2 h-6 bg-primary" />
          <h3 className="font-black uppercase tracking-widest text-sm">
            3. Question Distribution
          </h3>
        </div>
        <div className="p-6 bg-muted/30 border border-border space-y-4">
          {isDistributionMismatch && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 animate-pulse">
              <div className="flex items-center gap-3 text-red-700">
                <ShieldAlert className="w-5 h-5" />
                <p className="text-xs font-black uppercase tracking-widest">
                  {t("Distribution Total")} ({distributionTotal.toFixed(2)}){" "}
                  {t("must equal Final Exam Marks")} (
                  {config.final_exam_component.marks.toFixed(2)})
                </p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-12 gap-4 pb-2 border-b border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <div className="col-span-4">Marks per Question</div>
            <div className="col-span-4">Number of Questions</div>
            <div className="col-span-3 text-right">Sub-total</div>
            <div className="col-span-1"></div>
          </div>
          {config.question_distribution.map((rule, idx) => (
            <div
              key={idx}
              className="grid grid-cols-12 gap-4 items-center group"
            >
              <div className="col-span-4">
                <Input
                  type="number"
                  value={rule.marks}
                  onChange={(e) => {
                    const newRules = [...config.question_distribution];
                    newRules[idx].marks = parseFloat(e.target.value) || 0;
                    updateConfig({ question_distribution: newRules });
                  }}
                  className="rounded-none border-border font-bold h-10"
                />
              </div>
              <div className="col-span-4">
                <Input
                  type="number"
                  value={rule.count}
                  onChange={(e) => {
                    const newRules = [...config.question_distribution];
                    newRules[idx].count = parseInt(e.target.value) || 0;
                    updateConfig({ question_distribution: newRules });
                  }}
                  className="rounded-none border-border font-bold h-10"
                />
              </div>
              <div className="col-span-3 text-right">
                <span className="font-black text-primary">
                  {(rule.marks * rule.count).toFixed(2)}
                </span>
              </div>
              <div className="col-span-1 flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const newRules = [...config.question_distribution];
                    newRules.splice(idx, 1);
                    updateConfig({ question_distribution: newRules });
                  }}
                  className="h-10 w-10 text-red-500 hover:bg-red-50 rounded-none"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              updateConfig({
                question_distribution: [
                  ...config.question_distribution,
                  { marks: 1, count: 1 },
                ],
              })
            }
            className="w-full rounded-none border-dashed border-2 font-black uppercase text-[10px] tracking-widest h-12"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Add Rule
          </Button>
        </div>
      </div>

      {/* Subject Components */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-primary/5 border border-primary/20">
        <div className="space-y-3 p-4 bg-primary/10 border border-primary/20">
          <Label className="text-[10px] font-black uppercase tracking-widest">
            Final Exam (Auto)
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[8px] font-bold uppercase text-primary">
                Total Marks
              </Label>
              <Input
                type="number"
                readOnly
                value={config.final_exam_component.marks}
                className="rounded-none border-border font-black bg-muted text-primary h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[8px] font-bold uppercase text-red-600">
                Min. Passing
              </Label>
              <Input
                type="number"
                value={config.final_exam_component.min_marks}
                onChange={(e) =>
                  updateConfig({
                    final_exam_component: {
                      ...config.final_exam_component,
                      min_marks: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                className="rounded-none border-red-300 font-black h-8 text-xs bg-red-100/30 text-red-600"
              />
            </div>
          </div>
          <p className="text-[7px] font-bold text-muted-foreground uppercase tracking-tight">
            Exam marks derived from distribution rules
          </p>
        </div>

        <div className="space-y-3 p-4 bg-white/50 border border-border">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] font-black uppercase tracking-widest">
              Practical Component
            </Label>
            <input
              type="checkbox"
              checked={config.practical_component.enabled}
              onChange={(e) =>
                updateConfig({
                  practical_component: {
                    ...config.practical_component,
                    enabled: e.target.checked,
                  },
                })
              }
              className="h-4 w-4"
            />
          </div>
          {config.practical_component.enabled && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[8px] font-bold uppercase text-muted-foreground">
                  Total Marks
                </Label>
                <Input
                  type="number"
                  value={config.practical_component.marks}
                  onChange={(e) =>
                    updateConfig({
                      practical_component: {
                        ...config.practical_component,
                        marks: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="rounded-none border-border font-bold h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[8px] font-bold uppercase text-red-500">
                  Min. Passing
                </Label>
                <Input
                  type="number"
                  value={config.practical_component.min_marks}
                  onChange={(e) =>
                    updateConfig({
                      practical_component: {
                        ...config.practical_component,
                        min_marks: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="rounded-none border-red-200 font-bold h-8 text-xs bg-red-50/20"
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 p-4 bg-white/50 border border-border">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] font-black uppercase tracking-widest">
              Assignment Component
            </Label>
            <input
              type="checkbox"
              checked={config.assignment_component.enabled}
              onChange={(e) =>
                updateConfig({
                  assignment_component: {
                    ...config.assignment_component,
                    enabled: e.target.checked,
                  },
                })
              }
              className="h-4 w-4"
            />
          </div>
          {config.assignment_component.enabled && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[8px] font-bold uppercase text-muted-foreground">
                  Total Marks
                </Label>
                <Input
                  type="number"
                  value={config.assignment_component.marks}
                  onChange={(e) =>
                    updateConfig({
                      assignment_component: {
                        ...config.assignment_component,
                        marks: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="rounded-none border-border font-bold h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[8px] font-bold uppercase text-red-500">
                  Min. Passing
                </Label>
                <Input
                  type="number"
                  value={config.assignment_component.min_marks}
                  onChange={(e) =>
                    updateConfig({
                      assignment_component: {
                        ...config.assignment_component,
                        min_marks: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="rounded-none border-red-200 font-bold h-8 text-xs bg-red-50/20"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Marks and Duration Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-primary/5 border border-primary/20">
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest">
              {t("Final Subject Total Marks (Auto)")}
            </Label>
            <Input
              type="number"
              readOnly
              value={config.final_subject_total_marks}
              className="rounded-none border-border font-black text-lg text-primary bg-muted"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-primary">
              Complete Exam Duration (Auto)
            </Label>
            <Input
              type="text"
              readOnly
              value={formatDuration(totalDuration)}
              className="rounded-none border-border font-bold text-lg text-primary bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest">
              Subject Duration
            </Label>
            <Input
              type="number"
              value={config.duration_minutes}
              onChange={(e) =>
                updateConfig({ duration_minutes: parseInt(e.target.value) || 0 })
              }
              className="rounded-none border-border font-bold text-lg"
            />
            <p className="text-[7px] font-bold text-muted-foreground uppercase tracking-tight">
              Enter in minutes
            </p>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-1 border-b-2 border-primary/20">
          <div className="w-2 h-6 bg-primary" />
          <h3 className="font-black uppercase tracking-widest text-sm">
            4. Instructions
          </h3>
        </div>
        <div className="p-6 bg-muted/30 border border-border space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={sameInstructionsForAll}
              onChange={(e) => setSameInstructionsForAll(e.target.checked)}
              className="h-4 w-4"
              id="sameInstructions"
            />
            <Label htmlFor="sameInstructions" className="text-xs font-bold uppercase tracking-widest cursor-pointer">
              Same instructions for all selected subjects
            </Label>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest">Subject Instructions</Label>
            <Textarea
              value={sameInstructionsForAll ? sharedInstructions : (config.instructions || "")}
              onChange={(e) => {
                const newInstructions = e.target.value;
                if (sameInstructionsForAll) {
                  setSharedInstructions(newInstructions);
                  // Update all subjects when in same mode
                  setForm(prev => ({
                    ...prev,
                    subjects: prev.subjects.map(s => ({
                      ...s,
                      instructions: newInstructions,
                    })),
                  }));
                } else {
                  updateConfig({ instructions: newInstructions });
                }
              }}
              placeholder="Enter instructions for this subject..."
              className="rounded-none border-border font-bold min-h-[100px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminExamBlueprintsPage;
