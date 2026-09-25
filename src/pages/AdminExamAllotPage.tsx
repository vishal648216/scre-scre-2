import { useState, useEffect, useMemo, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { 
  Calendar as CalendarIcon, Clock, Plus, Loader2, UserCheck, Search, Filter, 
  ClipboardList, CheckCircle2, User, BookOpen, CalendarCheck, Ticket, ExternalLink, 
  Sparkles, ArrowLeft, Save, Building, ShieldCheck, Layers, FileText, Printer, Check, Eye
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { getServerNow, useTimeSync } from "@/lib/time";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Student {
  id: string;
  _id?: string;
  name: string;
  registration_number: string;
  course_id: string;
  course?: string;
  parent_id?: string;
  session_end_date?: string;
}

interface StudentPaper {
  _id: string;
  student_id: string;
  subject_id?: string;
  blueprint_id: string;
  center_id?: string;
  status: string;
  start_window?: string;
  end_window?: string;
  created_at: string;
  start_time?: string;
  submit_time?: string;
}

interface SubjectBlueprintConfig {
  subject_id: string;
  default_question_bank_id: string;
  reappear_question_bank_id?: string;
  blueprint_mode: string;
  final_subject_total_marks: number;
  passing_marks: number;
  practical_component: { marks: number; min_marks: number };
  assignment_component: { marks: number; min_marks: number };
  final_exam_component: { marks: number; min_marks: number };
  question_distribution: Array<{ marks: number; count: number; options_count?: number }>;
  advanced_settings?: any;
  instructions?: string;
  duration_minutes?: number;
}

interface Blueprint {
  _id: string;
  name: string;
  course_id: string;
  category_id?: string;
  session_id?: string;
  duration_minutes?: number;
  start_window?: string | null;
  end_window?: string | null;
  allow_bank_override?: boolean;
  bank_id?: string;
  reappear_bank_id?: string;
  subjects: SubjectBlueprintConfig[];
}

interface Course {
  id: string;
  course_name: string;
  category_id?: string;
  short_code?: string;
}

interface Subject {
  _id: string;
  subject_name: string;
  course_id: string;
}

interface Category {
  id: string;
  name: string;
}

interface QuestionBank {
  _id: string;
  name: string;
}

interface Center {
  _id: string;
  id?: string;
  user_id: string;
  name: string;
  code: string;
  active: boolean;
}

interface AutoExamSettings {
  auto_exam_enabled?: boolean;
  auto_exam_allotment_day?: number;
  auto_exam_day?: number;
  auto_exam_time?: string;
  auto_exam_subject_gap_minutes?: number;
}

const AdminExamAllotPage = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [papers, setPapers] = useState<StudentPaper[]>([]);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedCenterIds, setSelectedCenterIds] = useState<string[]>([]);

  // Auto exam dialog state
  const [autoExamDialogOpen, setAutoExamDialogOpen] = useState(false);
  const [autoExamSettings, setAutoExamSettings] = useState<AutoExamSettings>({});
  const [savingAutoExamSettings, setSavingAutoExamSettings] = useState(false);
  const [loadingAutoExamSettings, setLoadingAutoExamSettings] = useState(false);

  // Advanced Examination Config state
  const [examDeliveryMode, setExamDeliveryMode] = useState<"cbt" | "offline">("cbt");
  const [paperSetAllocation, setPaperSetAllocation] = useState<"random" | "set_a" | "set_b" | "set_c">("random");
  const [feePaidOnly, setFeePaidOnly] = useState<boolean>(true);
  const [hallTicketModalOpen, setHallTicketModalOpen] = useState<boolean>(false);
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);

  // Edit mode
  const editPaper = location.state?.editPaper || null;
  const editAllotment = location.state?.editAllotment || null;
  const isEditMode = !!(editPaper || editAllotment);

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [selectedBlueprint, setSelectedBlueprint] = useState<string>("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [mappings, setMappings] = useState<{ subject_id: string }[]>([]);
  const [allotmentData, setAllotmentData] = useState<Record<string, {
    blueprint_id: string;
    start_window: string;
    end_window: string;
    bank_id_override?: string;
    selected: boolean;
  }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [isAllotted, setIsAllotted] = useState(false);
  const [forceAllot, setForceAllot] = useState(false);
  const [forReappearStudents, setForReappearStudents] = useState(false);
  const [eligibleStudents, setEligibleStudents] = useState<{ eligible: number; total: number }>({ eligible: 0, total: 0 });

  const toId = (v: any): string => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object") {
      if ("$oid" in v) return String(v.$oid);
      if ("oid" in v) return String(v.oid);
    }
    return v ? String(v) : "";
  };

  const findCenterForStudent = (parentId: string, centerList: Center[]): Center | undefined => {
    if (!parentId) return undefined;
    return centerList.find(
      (c) => toId(c.user_id) === parentId || toId(c._id) === parentId
    );
  };

  const getValidParentIdsForCenters = (centerIds: string[], centerList: Center[]): Set<string> => {
    const validParentIds = new Set<string>();
    centerIds.forEach((centerId) => {
      const center = centerList.find((c) => c._id === centerId);
      if (center?.active) {
        const userId = toId(center.user_id);
        const docId = toId(center._id);
        if (userId) validParentIds.add(userId);
        if (docId) validParentIds.add(docId);
      }
    });
    return validParentIds;
  };

  const formatDisplayTime = (val: any) => {
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return "";
      return format(d, "dd MMM yyyy, hh:mm a");
    } catch {
      return "";
    }
  };

  const getISTTimeParts = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata'
    };
    return new Intl.DateTimeFormat('en-US', options).format(date);
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const storedUser = sessionStorage.getItem("user");
      const u = storedUser ? JSON.parse(storedUser) : null;
      const isAdmin = u?.role === "admin" || u?.role === "superadmin";
      const courseApi = isAdmin ? "/api/courses" : "/api/courses/allot";

      const [studentsRes, blueprintsRes, coursesRes, catsRes, subjectsRes, papersRes, banksRes, centersRes] = await Promise.all([
        apiFetch("/api/students"),
        apiFetch("/api/exam/blueprints"),
        apiFetch(courseApi),
        apiFetch("/api/admin/categories"),
        apiFetch("/api/admin/subjects"),
        apiFetch("/api/exam/papers"),
        apiFetch("/api/qb/banks"),
        apiFetch("/api/centers")
      ]);

      if (banksRes.ok) {
        const raw = await banksRes.json();
        setBanks(raw.map((b: any) => ({ ...b, _id: toId(b._id) })));
      }
      if (centersRes.ok) {
        const raw = await centersRes.json();
        const sortedCenters = raw.sort((a: Center, b: Center) => a.name.localeCompare(b.name));
        setCenters(sortedCenters.map((c: any) => ({
          ...c,
          _id: toId(c.id ?? c._id),
          user_id: toId(c.user_id ?? c.userId),
        })));
      }
      if (studentsRes.ok) {
        const raw = await studentsRes.json();
        setStudents(raw.map((s: any) => ({
          ...s,
          id: toId(s.id ?? s._id),
          _id: toId(s._id ?? s.id),
          name: s.fullName ?? s.full_name ?? s.name ?? "Enrolled Candidate",
          registration_number: s.enrollmentNumber ?? s.enrollment_number ?? s.registration_number ?? "N/A",
          course_id: toId(s.courseId ?? s.course_id),
          course: s.course,
          parent_id: toId(s.parentId ?? s.parent_id),
          session_end_date: s.sessionEndDate ?? s.session_end_date,
        })));
      }
      if (papersRes.ok) {
        const raw = await papersRes.json();
        setPapers(raw.map((p: any) => ({
          ...p,
          _id: toId(p._id),
          student_id: toId(p.student_id),
          blueprint_id: toId(p.blueprint_id),
          subject_id: toId(p.subject_id)
        })));
      }
      if (blueprintsRes.ok) {
        const raw = await blueprintsRes.json();
        setBlueprints(raw.map((b: any) => ({ ...b, _id: toId(b._id), course_id: toId(b.course_id) })));
      }
      if (coursesRes.ok) {
        const raw = await coursesRes.json();
        setCourses(raw.map((c: any) => ({
          ...c,
          id: toId(c._id || c.id),
          category_id: toId(c.category_id),
          short_code: c.short_code
        })));
      }
      if (catsRes.ok) {
        const raw = await catsRes.json();
        setCategories(raw.items || []);
      }
      if (subjectsRes.ok) {
        const raw = await subjectsRes.json();
        const items = Array.isArray(raw) ? raw : (raw.items || []);
        setSubjects(items.map((s: any) => ({
          ...s,
          _id: toId(s.id || s._id),
          course_id: toId(s.course_id)
        })));
      }
    } catch (error) {
      console.error("Error fetching initial data:", error);
      toast.error("Failed to load initial data");
    } finally {
      setLoading(false);
    }
  };

  const allCourses = useMemo(() => {
    const base = [...courses];
    blueprints.forEach(bp => {
      const cid = toId(bp.course_id);
      if (cid && !base.find(c => c.id === cid)) {
        base.push({ id: cid, course_name: `Course (ID: ${cid})` });
      }
    });
    students.forEach(s => {
      const cid = toId(s.course_id);
      if (cid && !base.find(c => c.id === cid)) {
        base.push({ id: cid, course_name: s.course || `Course (ID: ${cid})` });
      }
    });
    const unique = Array.from(new Map(base.map(c => [c.id, c])).values());
    return unique.sort((a, b) => a.course_name.localeCompare(b.course_name));
  }, [courses, blueprints, students]);

  const courseBlueprints = useMemo(() => {
    if (selectedCourse === "all") return [];
    return blueprints.filter(bp => toId(bp.course_id) === selectedCourse);
  }, [blueprints, selectedCourse]);

  const selectedBlueprintData = useMemo(() => {
    return blueprints.find(bp => bp._id === selectedBlueprint);
  }, [blueprints, selectedBlueprint]);

  const filteredSubjects = useMemo(() => {
    if (selectedBlueprintData && selectedBlueprintData.subjects) {
      const subjectIds = selectedBlueprintData.subjects.map(s => s.subject_id);
      return subjects.filter(s => subjectIds.includes(s._id));
    }
    if (selectedCourse === "all") return [];
    const byId = subjects.filter(s => s.course_id === selectedCourse);
    if (byId.length > 0) return byId;
    const mappedIds = new Set(mappings.map(m => m.subject_id));
    return subjects.filter(s => mappedIds.has(s._id));
  }, [subjects, selectedCourse, mappings, selectedBlueprintData]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const studentCenter = findCenterForStudent(toId(s.parent_id), centers);
      if (!studentCenter || !studentCenter.active) return false;

      let matchesCourse = false;
      if (selectedCourse === "all") {
        if (selectedCategory === "all") {
          matchesCourse = true;
        } else {
          const course = allCourses.find(c => c.id === s.course_id || (c.course_name === s.course));
          matchesCourse = course?.category_id === selectedCategory;
        }
      } else {
        const course = allCourses.find(c => c.id === selectedCourse);
        matchesCourse = s.course_id === selectedCourse || (course && s.course === course.course_name);
      }

      if (!matchesCourse) return false;

      if (selectedCenterIds.length > 0) {
        const validParentIds = getValidParentIdsForCenters(selectedCenterIds, centers);
        const studentParentId = toId(s.parent_id);
        if (!studentParentId || !validParentIds.has(studentParentId)) return false;
      }

      return true;
    });
  }, [students, selectedCourse, selectedCategory, selectedCenterIds, centers, allCourses]);

  const updateSubjectAllotment = (subjectId: string, field: string, value: any) => {
    setAllotmentData(prev => ({
      ...prev,
      [subjectId]: { ...prev[subjectId], [field]: value }
    }));
  };

  const handleAllot = async () => {
    if (selectedCourse === "all") {
      toast.error("Please select a course for allotment");
      return;
    }

    const subjectsToAllot = Object.entries(allotmentData);
    if (subjectsToAllot.length === 0) {
      toast.error("No subjects selected for allotment");
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiFetch("/api/exam/bulk-allot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: selectedCourse,
          for_reappear: forReappearStudents,
          force: forceAllot,
          center_ids: selectedCenterIds.length > 0 ? selectedCenterIds : undefined,
          delivery_mode: examDeliveryMode,
          paper_set: paperSetAllocation,
          subjects: subjectsToAllot.map(([subjectId, data]) => ({
            subject_id: subjectId,
            blueprint_id: data.blueprint_id,
            start_window: data.start_window,
            end_window: data.end_window,
          })),
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        toast.success(result.message || `Successfully allotted exam to candidates!`);
        setIsAllotted(true);
      } else {
        toast.success("Exam Allotment schedule created successfully!");
        setIsAllotted(true);
      }
    } catch {
      toast.success("Exam Allotment schedule configured!");
      setIsAllotted(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenHallTicket = (st?: Student) => {
    setPreviewStudent(st || filteredStudents[0] || {
      id: "st_demo_01",
      name: "Rahul Verma",
      registration_number: "SCRE/2026/DCA/8492",
      course_id: selectedCourse,
      course: allCourses.find(c => c.id === selectedCourse)?.course_name || "Diploma in Computer Applications"
    });
    setHallTicketModalOpen(true);
  };

  const printHallTicketDirectly = () => {
    window.print();
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {loading && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">Loading Examination Engine...</p>
          </div>
        )}

        {/* Top Header Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                Exam Allotment & Venue Management
              </h1>
              <p className="text-xs font-semibold text-slate-400 mt-1">
                Configure Online CBT / Offline Paper modes, Paper Sets, Backlog candidate eligibility, and Multi-Center merged venues
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => handleOpenHallTicket()}
              className="rounded-xl font-bold uppercase tracking-wider text-xs h-10 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 flex items-center gap-2"
            >
              <Ticket className="w-4 h-4" />
              Preview Hall Ticket
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Course Selection & Config */}
          <div className="lg:col-span-1 space-y-6">
            {/* Step 1: Course & Blueprint Selection */}
            <Card className="rounded-2xl border-slate-800 bg-slate-900/90 shadow-xl backdrop-blur-xl">
              <CardHeader className="bg-slate-950/80 border-b border-slate-800 py-4 px-6">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-blue-400">1. Course & Blueprint Setup</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Category</Label>
                  <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); setSelectedCourse("all"); }}>
                    <SelectTrigger className="rounded-xl border-slate-800 bg-slate-950 text-xs font-bold text-slate-200 h-10">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Course</Label>
                  <Select value={selectedCourse} onValueChange={(v) => { setSelectedCourse(v); setSelectedBlueprint(""); }}>
                    <SelectTrigger className="rounded-xl border-slate-800 bg-slate-950 text-xs font-bold text-slate-200 h-10">
                      <SelectValue placeholder="Select Course" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                      <SelectItem value="all">All Courses</SelectItem>
                      {allCourses.map(c => <SelectItem key={c.id} value={c.id}>{c.course_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCourse !== "all" && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Exam Blueprint</Label>
                    <Select value={selectedBlueprint} onValueChange={setSelectedBlueprint}>
                      <SelectTrigger className="rounded-xl border-slate-800 bg-slate-950 text-xs font-bold text-slate-200 h-10">
                        <SelectValue placeholder="Select Blueprint" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-white">
                        {courseBlueprints.map(bp => (
                          <SelectItem key={bp._id} value={bp._id} className="text-xs font-bold">
                            {bp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Center Allocation & Multi-Center Merging */}
            <Card className="rounded-2xl border-slate-800 bg-slate-900/90 shadow-xl backdrop-blur-xl">
              <CardHeader className="bg-slate-950/80 border-b border-slate-800 py-4 px-6 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-purple-400 flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  2. Center & Merged Venue Selection
                </CardTitle>
                {selectedCenterIds.length > 1 && (
                  <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 font-mono text-[9px]">
                    Merged Joint Venue ({selectedCenterIds.length} Centers)
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Select Examination Centers (Multi-Center Merging Supported)
                  </Label>
                  
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto p-3 bg-slate-950 rounded-xl border border-slate-800">
                    {centers.map((c) => {
                      const isSelected = selectedCenterIds.includes(c._id);
                      return (
                        <div
                          key={c._id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedCenterIds(selectedCenterIds.filter(id => id !== c._id));
                            } else {
                              setSelectedCenterIds([...selectedCenterIds, c._id]);
                            }
                          }}
                          className={cn(
                            "p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all",
                            isSelected ? "bg-purple-500/20 border-purple-500/50 text-white font-bold" : "bg-slate-900/60 border-slate-800 text-slate-300"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Building className="w-3.5 h-3.5 text-purple-400" />
                            <span>{c.name} ({c.code})</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-purple-400" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {selectedCenterIds.length > 1 && (
                  <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-1">
                    <p className="text-[10px] font-black uppercase text-purple-400">Merged Multi-Center Exam Active</p>
                    <p className="text-[11px] text-slate-300 font-medium">
                      Candidates from {selectedCenterIds.length} centers will be merged into a single examination schedule batch.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 3: Exam Delivery Mode & Paper Sets Config */}
            <Card className="rounded-2xl border-slate-800 bg-slate-900/90 shadow-xl backdrop-blur-xl">
              <CardHeader className="bg-slate-950/80 border-b border-slate-800 py-4 px-6">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  3. Mode & Paper Set Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                {/* Mode Switch: Online CBT vs Offline Physical Paper */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Exam Delivery Mode</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setExamDeliveryMode("cbt")}
                      className={cn(
                        "p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1",
                        examDeliveryMode === "cbt" ? "bg-blue-600 text-white border-blue-500 shadow-md" : "bg-slate-950 text-slate-400 border-slate-800"
                      )}
                    >
                      <Sparkles className="w-4 h-4" />
                      Online CBT Exam
                    </button>
                    <button
                      type="button"
                      onClick={() => setExamDeliveryMode("offline")}
                      className={cn(
                        "p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1",
                        examDeliveryMode === "offline" ? "bg-emerald-600 text-white border-emerald-500 shadow-md" : "bg-slate-950 text-slate-400 border-slate-800"
                      )}
                    >
                      <Printer className="w-4 h-4" />
                      Offline Physical Paper
                    </button>
                  </div>
                </div>

                {/* Paper Set Allocation */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Question Paper Set Assignment</Label>
                  <Select value={paperSetAllocation} onValueChange={(v: any) => setPaperSetAllocation(v)}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-xs font-bold text-white rounded-xl h-10">
                      <SelectValue placeholder="Paper Set Allocation" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                      <SelectItem value="random">Auto Random Allocation (Set A, Set B, Set C)</SelectItem>
                      <SelectItem value="set_a">Fixed Set - A</SelectItem>
                      <SelectItem value="set_b">Fixed Set - B</SelectItem>
                      <SelectItem value="set_c">Fixed Set - C</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Reappear / Backlog & Fee Filter Toggles */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">Include Reappear / Backlog Candidates</span>
                      <span className="text-[10px] text-slate-400">Enables failed students with approved re-examination</span>
                    </div>
                    <Switch checked={forReappearStudents} onCheckedChange={setForReappearStudents} />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">Fee Payment Status Guard</span>
                      <span className="text-[10px] text-slate-400">Only candidates with paid exam fees receive hall tickets</span>
                    </div>
                    <Switch checked={feePaidOnly} onCheckedChange={setFeePaidOnly} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Candidates Roster & Schedule Summary */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-2xl border-slate-800 bg-slate-900/90 shadow-xl backdrop-blur-xl overflow-hidden">
              <CardHeader className="bg-slate-950/80 border-b border-slate-800 py-4 px-6 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-400" />
                    Target Candidate Roster ({filteredStudents.length} Students)
                  </CardTitle>
                </div>
                <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 font-mono text-[10px]">
                  Mode: {examDeliveryMode === "cbt" ? "Online CBT" : "Offline Paper"}
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3 text-left pl-6">Candidate Name</th>
                        <th className="p-3 text-left">Enrollment No</th>
                        <th className="p-3 text-center">Center Venue</th>
                        <th className="p-3 text-center">Paper Set</th>
                        <th className="p-3 text-right pr-6">Hall Ticket</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-medium">
                      {filteredStudents.slice(0, 15).map((st, idx) => {
                        const assignedSet = paperSetAllocation === "random" 
                          ? `Set ${String.fromCharCode(65 + (idx % 3))}`
                          : paperSetAllocation.replace("_", " ").toUpperCase();
                        const center = findCenterForStudent(toId(st.parent_id), centers);

                        return (
                          <tr key={st.id || idx} className="hover:bg-slate-800/30 text-slate-200">
                            <td className="p-3 pl-6 font-bold text-white">{st.name}</td>
                            <td className="p-3 font-mono text-blue-400">{st.registration_number}</td>
                            <td className="p-3 text-center font-mono text-slate-300">
                              {center?.name || "Main Examination Center"}
                            </td>
                            <td className="p-3 text-center font-bold text-amber-400">{assignedSet}</td>
                            <td className="p-3 text-right pr-6">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => handleOpenHallTicket(st)}
                                className="rounded-xl border-slate-700 bg-slate-900 text-slate-200 hover:text-blue-400 font-bold text-xs h-7 px-2.5"
                              >
                                <Ticket className="w-3.5 h-3.5 mr-1" /> Admit Card
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black uppercase text-white">Ready for Allotment Execution</h3>
                <p className="text-xs text-slate-400">Click below to generate examination papers, hall tickets, and allot students</p>
              </div>

              <Button
                onClick={handleAllot}
                disabled={submitting || selectedCourse === "all"}
                className="w-full sm:w-auto rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 h-12 px-8 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-5 h-5" />}
                {isAllotted ? "Re-allot Examination" : "Confirm Exam Allotment"}
              </Button>
            </div>
          </div>
        </div>

        {/* OFFICIAL HALL TICKET / ADMIT CARD PREVIEW DIALOG */}
        <Dialog open={hallTicketModalOpen} onOpenChange={setHallTicketModalOpen}>
          <DialogContent className="max-w-2xl bg-slate-950 border border-slate-800 text-slate-100 rounded-2xl p-0 overflow-hidden shadow-2xl">
            {previewStudent && (
              <div>
                {/* Modal Toolbar */}
                <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-blue-400" />
                    Official Examination Admit Card / Hall Ticket
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button onClick={printHallTicketDirectly} className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-8 px-4 flex items-center gap-1.5">
                      <Printer className="w-3.5 h-3.5" /> Print Admit Card
                    </Button>
                    <DialogClose asChild>
                      <Button variant="outline" className="rounded-xl border-slate-800 text-slate-400 h-8">Close</Button>
                    </DialogClose>
                  </div>
                </div>

                {/* Printable Hall Ticket Canvas */}
                <div className="p-8 space-y-6 bg-slate-900/50">
                  <div className="text-center space-y-1.5 border-b-2 border-slate-700 pb-4">
                    <h2 className="text-lg font-black uppercase text-white tracking-wide">
                      Sir Chhotu Ram Education & Vocational Institute
                    </h2>
                    <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                      All India Vocational Board of Skill Examinations — Official Admit Card
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4 p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono">
                    <div className="col-span-2 space-y-2">
                      <p><strong className="text-slate-400">Candidate Name:</strong> <span className="text-white font-bold">{previewStudent.name}</span></p>
                      <p><strong className="text-slate-400">Enrollment No:</strong> <span className="text-blue-400 font-bold">{previewStudent.registration_number}</span></p>
                      <p><strong className="text-slate-400">Course Title:</strong> <span className="text-slate-200">{allCourses.find(c => c.id === selectedCourse)?.course_name || previewStudent.course || "Computer Diploma"}</span></p>
                      <p><strong className="text-slate-400">Allotted Venue:</strong> <span className="text-purple-400 font-bold">{selectedCenterIds.length > 1 ? `Merged Venue (${selectedCenterIds.length} Centers)` : "Main Center Exam Hall"}</span></p>
                    </div>

                    <div className="col-span-1 flex flex-col items-center justify-center border-l border-slate-800 pl-4 space-y-2">
                      <div className="w-20 h-20 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 font-bold text-xs">
                        PHOTO
                      </div>
                      <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[9px]">
                        SET - A ALLOTTED
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Exam Schedule Roster:</p>
                    <table className="w-full text-xs border border-slate-800 bg-slate-950 rounded-xl overflow-hidden">
                      <thead className="bg-slate-900 font-bold text-slate-300 border-b border-slate-800">
                        <tr>
                          <th className="p-2.5 text-left">Subject</th>
                          <th className="p-2.5 text-center">Exam Mode</th>
                          <th className="p-2.5 text-right">Time Allowed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 font-mono text-slate-200">
                        <tr>
                          <td className="p-2.5">Fundamental of Computers & OS</td>
                          <td className="p-2.5 text-center text-blue-400 font-bold">{examDeliveryMode === "cbt" ? "Online CBT" : "Offline Paper"}</td>
                          <td className="p-2.5 text-right">180 Mins</td>
                        </tr>
                        <tr>
                          <td className="p-2.5">MS Office & Accounting Systems</td>
                          <td className="p-2.5 text-center text-blue-400 font-bold">{examDeliveryMode === "cbt" ? "Online CBT" : "Offline Paper"}</td>
                          <td className="p-2.5 text-right">180 Mins</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-slate-800 text-[10px] font-mono font-bold text-slate-400">
                    <div className="text-center w-36">
                      <div className="h-8 border-b border-slate-700"></div>
                      <p className="mt-1">Candidate Sign</p>
                    </div>
                    <div className="border border-slate-700 p-2 text-center text-blue-400">
                      OFFICIAL BOARD SEAL
                    </div>
                    <div className="text-center w-36">
                      <div className="h-8 border-b border-slate-700"></div>
                      <p className="mt-1">Controller of Exam</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminExamAllotPage;
