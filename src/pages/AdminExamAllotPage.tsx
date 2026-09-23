import { useState, useEffect, useMemo, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar as CalendarIcon, Clock, Plus, Loader2, UserCheck, Search, Filter, ClipboardList, CheckCircle2, User, BookOpen, CalendarCheck, Ticket, ExternalLink, Sparkles, ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { getServerNow, useTimeSync, syncServerTime } from "@/lib/time";
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
  const loadedAutoExamSettingsRef = useRef<AutoExamSettings | null>(null);

  // Edit mode — supports single-paper (legacy) or full allotment batch
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


  const isSynced = useTimeSync();

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

  const toIso = (v: any): string => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object") {
      if ("$date" in v) {
        if (typeof v.$date === "number") return new Date(v.$date).toISOString();
        if (typeof v.$date === "string") return v.$date;
        if (v.$date && typeof v.$date === "object" && "$numberLong" in v.$date) {
          return new Date(parseInt(v.$date.$numberLong)).toISOString();
        }
      }
    }
    return String(v || "");
  };

  // Helper to get IST time parts (HH:mm) from a UTC Date
  const getISTTimeParts = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata'
    };
    return new Intl.DateTimeFormat('en-US', options).format(date);
  };

  // Helper to format Date to ISO string with Z
  const formatLocalDateTime = (date: Date) => {
    return date.toISOString();
  };

  // Display formatter that shows time as Local (Server Machine Time set to IST)
  const formatDisplayTime = (val: any) => {
    const iso = toIso(val);
    if (!iso || iso === "undefined" || iso === "null") return "";

    // 1. Ensure the input string has the IST offset if it's missing or is Z
    let normalized = iso;
    if (iso.endsWith('Z')) {
      // It's UTC, which is fine, but we'll format it as IST
    } else if (!iso.includes('+')) {
      // It's local, which is risky, so we'll append IST offset to be sure
      normalized = iso + "+05:30";
    }

    const d = new Date(normalized);
    // Format: April 9th, 2026 11:22 AM
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata' // Strictly use IST
    };
    return d.toLocaleString('en-US', options) + " (SERVER TIME)";
  };

  useEffect(() => {
    if (selectedCourse === "all") {
      setEligibleStudents({ eligible: 0, total: 0 });
      return;
    }
    const params = new URLSearchParams({
      course_id: selectedCourse,
      for_reappear: String(forReappearStudents),
    });
    if (selectedCenterIds.length > 0) {
      params.set("center_ids", selectedCenterIds.join(","));
    }

    apiFetch(`/api/exam/eligible-students?${params}`)
      .then((r) => r.json())
      .then((data: Array<{ eligible: boolean }>) => {
        if (Array.isArray(data)) {
          setEligibleStudents({
            total: data.length,
            eligible: data.filter((d) => d.eligible).length,
          });
        }
      })
      .catch((err) => {
        console.error(err);
        setEligibleStudents({ eligible: 0, total: 0 });
      });
  }, [selectedCourse, forReappearStudents, selectedCenterIds]);

  // Drop inactive/suspended centers from selection (they must not affect allotment)
  useEffect(() => {
    if (centers.length === 0 || selectedCenterIds.length === 0) return;
    const activeSelected = selectedCenterIds.filter((id) => {
      const center = centers.find((c) => c._id === id);
      return center?.active;
    });
    if (activeSelected.length !== selectedCenterIds.length) {
      setSelectedCenterIds(activeSelected);
    }
  }, [centers, selectedCenterIds]);

  // Pre-fill edit mode data when allotment batch or single paper is loaded
  useEffect(() => {
    if (!blueprints.length || !courses.length) return;

    if (editAllotment) {
      const { courseId, categoryId, papers: batchPapers } = editAllotment;
      if (categoryId) setSelectedCategory(categoryId);
      setSelectedCourse(courseId);

      // One representative paper per subject
      const bySubject: Record<string, StudentPaper> = {};
      (batchPapers as StudentPaper[]).forEach((p) => {
        const sid = toId(p.subject_id);
        if (sid && !bySubject[sid]) bySubject[sid] = p;
      });

      const initialData: Record<string, {
        blueprint_id: string;
        start_window: string;
        end_window: string;
        bank_id_override?: string;
        selected: boolean;
      }> = {};

      Object.entries(bySubject).forEach(([subjectId, paper]) => {
        initialData[subjectId] = {
          blueprint_id: toId(paper.blueprint_id),
          start_window: toIso(paper.start_window),
          end_window: toIso(paper.end_window),
          selected: true,
        };
      });

      if (Object.keys(initialData).length > 0) {
        setAllotmentData(initialData);
      }
      return;
    }

    if (editPaper) {
      const bp = blueprints.find(b => b._id === editPaper.blueprint_id);
      if (bp) {
        const course = courses.find(c => c.id === bp.course_id);
        if (course) {
          if (course.category_id) setSelectedCategory(course.category_id);
          setSelectedCourse(course.id);

          setTimeout(() => {
            const initialData: Record<string, {
              blueprint_id: string;
              start_window: string;
              end_window: string;
              selected: boolean;
            }> = {};
            if (editPaper.subject_id) {
              initialData[editPaper.subject_id] = {
                blueprint_id: editPaper.blueprint_id,
                start_window: toIso(editPaper.start_window),
                end_window: toIso(editPaper.end_window),
                selected: true,
              };
              setAllotmentData(initialData);
            }
          }, 100);
        }
      }
    }
  }, [editAllotment, editPaper, blueprints, courses]);

  const allCourses = useMemo(() => {
    // 1. Get courses from the API result
    const base = [...courses];

    // 2. Add courses from blueprints that might be missing
    blueprints.forEach(bp => {
      const cid = toId(bp.course_id);
      if (cid && !base.find(c => c.id === cid)) {
        base.push({ id: cid, course_name: `Course (ID: ${cid})` });
      }
    });

    // 3. Add courses from students that might be missing
    students.forEach(s => {
      const cid = toId(s.course_id);
      if (cid && !base.find(c => c.id === cid)) {
        base.push({ id: cid, course_name: s.course || `Course (ID: ${cid})` });
      }
    });

    // Remove duplicates by ID and sort by name
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
    // Use subjects from selected blueprint if available
    if (selectedBlueprintData && selectedBlueprintData.subjects) {
      const subjectIds = selectedBlueprintData.subjects.map(s => s.subject_id);
      return subjects.filter(s => subjectIds.includes(s._id));
    }
    // Fallback to old behavior
    if (selectedCourse === "all") return [];

    // First, try to filter by subject's own course_id (legacy)
    const byId = subjects.filter(s => s.course_id === selectedCourse);
    if (byId.length > 0) return byId;

    // Then, filter by mappings (new mapping system)
    const mappedIds = new Set(mappings.map(m => m.subject_id));
    return subjects.filter(s => mappedIds.has(s._id));
  }, [subjects, selectedCourse, mappings, selectedBlueprintData]);

  useEffect(() => {
    if (selectedCourse !== "all") {
      apiFetch(`/api/academic/course-subjects/${selectedCourse}`)
        .then(res => res.json())
        .then(data => setMappings(data || []))
        .catch(() => setMappings([]));
    } else {
      setMappings([]);
    }
  }, [selectedCourse]);

  // Initialize allotment data when subjects change (skip in edit mode)
  useEffect(() => {
    if (isEditMode) return;
    if (filteredSubjects.length > 0 && selectedBlueprintData) {
      const initialData: Record<string, { blueprint_id: string; start_window: string; end_window: string; selected: boolean }> = {};

      const now = getServerNow();
      const istOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Kolkata'
      };
      const istParts = new Intl.DateTimeFormat('en-US', istOptions).formatToParts(now);
      const getPart = (type: string) => istParts.find(p => p.type === type)?.value || "";
      const baseIST = `${getPart('year')}-${getPart('month')}-${getPart('day')}T09:00:00+05:30`;

      let currentStart = new Date(baseIST);
      const buffer = 30 * 60000;
      if (currentStart.getTime() < now.getTime() + buffer) {
        currentStart = new Date(now.getTime() + buffer);
        currentStart.setSeconds(0, 0);
        const mins = currentStart.getMinutes();
        currentStart.setMinutes(Math.ceil(mins / 10) * 10);
      }

      filteredSubjects.forEach((s) => {
        // Keep existing selection if it exists and is valid
        const existing = allotmentData[s._id];
        if (existing && existing.blueprint_id === selectedBlueprint) {
          initialData[s._id] = existing;
          return;
        }

        // Get subject-specific duration
        const subjectConfig = selectedBlueprintData.subjects?.find(sc => sc.subject_id === s._id);
        const dur = subjectConfig?.duration_minutes || selectedBlueprintData.duration_minutes || 60;

        const startIso = currentStart.toISOString();
        const endIso = new Date(currentStart.getTime() + dur * 60000).toISOString();

        initialData[s._id] = {
          blueprint_id: selectedBlueprint,
          start_window: startIso,
          end_window: endIso,
          selected: true
        };

        currentStart = new Date(new Date(endIso).getTime() + 20 * 60000);
      });

      setAllotmentData(initialData);
    } else if (filteredSubjects.length > 0) {
      // Fallback to old behavior if no blueprint selected
      const initialData: Record<string, { blueprint_id: string; start_window: string; end_window: string; selected: boolean }> = {};

      const now = getServerNow();
      const istOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Kolkata'
      };
      const istParts = new Intl.DateTimeFormat('en-US', istOptions).formatToParts(now);
      const getPart = (type: string) => istParts.find(p => p.type === type)?.value || "";
      const baseIST = `${getPart('year')}-${getPart('month')}-${getPart('day')}T09:00:00+05:30`;

      let currentStart = new Date(baseIST);
      const buffer = 30 * 60000;
      if (currentStart.getTime() < now.getTime() + buffer) {
        currentStart = new Date(now.getTime() + buffer);
        currentStart.setSeconds(0, 0);
        const mins = currentStart.getMinutes();
        currentStart.setMinutes(Math.ceil(mins / 10) * 10);
      }

      const fallbackBlueprints = blueprints.filter(bp => toId(bp.course_id) === selectedCourse);
      const bestBp = fallbackBlueprints[0];

      filteredSubjects.forEach((s) => {
        // Keep existing selection if it exists and is valid
        const existing = allotmentData[s._id];
        if (existing && existing.blueprint_id && blueprints.some(b => b._id === existing.blueprint_id)) {
          initialData[s._id] = existing;
          return;
        }

        // Get subject-specific duration if possible
        let dur = 60;
        if (bestBp) {
          const subjectConfig = bestBp.subjects?.find(sc => sc.subject_id === s._id);
          dur = subjectConfig?.duration_minutes || bestBp.duration_minutes || 60;
        }

        const startIso = currentStart.toISOString();
        const endIso = new Date(currentStart.getTime() + dur * 60000).toISOString();

        initialData[s._id] = {
          blueprint_id: bestBp?._id || "",
          start_window: startIso,
          end_window: endIso,
          selected: true
        };

        currentStart = new Date(new Date(endIso).getTime() + 20 * 60000);
      });

      setAllotmentData(initialData);
    }
  }, [filteredSubjects, selectedBlueprintData, selectedCourse, isEditMode, blueprints]);

  const updateSubjectAllotment = (subjectId: string, field: string, value: any) => {
    setAllotmentData(prev => {
      const updatedData = { ...prev };
      const current = { ...updatedData[subjectId], [field]: value };

      // Auto-calculate end window for current
      if (field === 'blueprint_id' || field === 'start_window') {
        const bp = blueprints.find(b => b._id === current.blueprint_id);
        if (bp && current.start_window) {
          const s = new Date(current.start_window);
          // Get subject-specific duration
          const subjectConfig = bp.subjects?.find(sc => sc.subject_id === subjectId);
          const dur = subjectConfig?.duration_minutes || bp.duration_minutes || 60;
          current.end_window = formatLocalDateTime(new Date(s.getTime() + dur * 60000));
        }
      }
      updatedData[subjectId] = current;

      // PROPAGATION LOGIC:
      // If it's the FIRST subject and the user changed the start window,
      // propagate the schedule to all subsequent subjects with a 20-minute break.
      const index = filteredSubjects.findIndex(s => s._id === subjectId);
      if (index === 0 && field === 'start_window') {
        let lastEnd = new Date(current.end_window);

        for (let i = 1; i < filteredSubjects.length; i++) {
          const sub = filteredSubjects[i];
          const nextData = { ...updatedData[sub._id] };

          // Next start = last end + 20 mins
          const nextStart = new Date(lastEnd.getTime() + 20 * 60000);
          nextData.start_window = nextStart.toISOString();

          // Recalculate next end using subject-specific duration
          const nextBp = blueprints.find(b => b._id === nextData.blueprint_id);
          let nextDur = 60;
          if (nextBp) {
            const nextSubjectConfig = nextBp.subjects?.find(sc => sc.subject_id === sub._id);
            nextDur = nextSubjectConfig?.duration_minutes || nextBp.duration_minutes || 60;
          }
          const nextEnd = new Date(nextStart.getTime() + nextDur * 60000);
          nextData.end_window = nextEnd.toISOString();

          updatedData[sub._id] = nextData;
          lastEnd = nextEnd;
        }
      }

      return updatedData;
    });
  };

  const checkTimeClashes = () => {
    const activeSubjects = Object.entries(allotmentData);
    const timeSlots: { id: string; name: string; start: number; end: number }[] = [];

    for (const [id, data] of activeSubjects) {
      if (!data.start_window || !data.end_window) continue;
      const start = new Date(data.start_window).getTime();
      const end = new Date(data.end_window).getTime();
      const name = subjects.find(s => s._id === id)?.subject_name || "Unknown";

      // Check against existing slots
      for (const slot of timeSlots) {
        const hasClash = (start >= slot.start && start < slot.end) ||
          (end > slot.start && end <= slot.end) ||
          (start <= slot.start && end >= slot.end);

        if (hasClash) {
          return { clashed: true, sub1: slot.name, sub2: name };
        }
      }
      timeSlots.push({ id, name, start, end });
    }
    return { clashed: false };
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Determine course API based on role
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
        const mappedCenters = sortedCenters.map((c: any) => ({
          ...c,
          _id: toId(c.id ?? c._id),
          user_id: toId(c.user_id ?? c.userId),
        }));
        setCenters(mappedCenters);
      }
      if (studentsRes.ok) {
        const raw = await studentsRes.json();
        const processedStudents = raw.map((s: any) => ({
          ...s,
          id: toId(s.id ?? s._id),
          _id: toId(s._id ?? s.id),
          name: s.fullName ?? s.full_name ?? s.name,
          registration_number: s.enrollmentNumber ?? s.enrollment_number ?? s.registration_number,
          course_id: toId(s.courseId ?? s.course_id),
          course: s.course,
          parent_id: toId(s.parentId ?? s.parent_id),
          session_end_date: s.sessionEndDate ?? s.session_end_date,
        }));
        setStudents(processedStudents);
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
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // Fetch auto exam settings from system settings API
  const normalizeAutoExamSettings = (value?: Partial<AutoExamSettings>): AutoExamSettings => {
    const now = getServerNow();
    const today = now.getDate();
    const allotmentDay = Math.min(31, Math.max(1, value?.auto_exam_allotment_day || today));
    const examDay = Math.min(31, Math.max(1, value?.auto_exam_day || allotmentDay));
    return {
      auto_exam_enabled: value?.auto_exam_enabled ?? false,
      auto_exam_allotment_day: allotmentDay,
      auto_exam_day: examDay,
      auto_exam_time: value?.auto_exam_time || "09:00",
      auto_exam_subject_gap_minutes: Math.max(0, value?.auto_exam_subject_gap_minutes || 0),
    };
  };

  const fetchAutoExamSettings = async () => {
    setLoadingAutoExamSettings(true);
    try {
      const res = await apiFetch("/api/system/settings");
      if (res.ok) {
        const data = await res.json();
        const normalized = normalizeAutoExamSettings({
          auto_exam_enabled: data.auto_exam_enabled,
          auto_exam_allotment_day: data.auto_exam_allotment_day,
          auto_exam_day: data.auto_exam_day,
          auto_exam_time: data.auto_exam_time,
          auto_exam_subject_gap_minutes: data.auto_exam_subject_gap_minutes,
        });
        setAutoExamSettings(normalized);
        loadedAutoExamSettingsRef.current = { ...normalized };
      } else {
        const fallback = normalizeAutoExamSettings();
        setAutoExamSettings(fallback);
        loadedAutoExamSettingsRef.current = { ...fallback };
      }
    } catch (error) {
      console.error("Error fetching auto exam settings:", error);
      const fallback = normalizeAutoExamSettings();
      setAutoExamSettings(fallback);
      loadedAutoExamSettingsRef.current = { ...fallback };
      toast.error("Failed to load auto exam settings");
    } finally {
      setLoadingAutoExamSettings(false);
    }
  };

  // Save auto exam settings. If auto_exam_enabled is toggled ON during this save,
  // the backend automatically spawns the allotment cycle in a background task.
  const saveAutoExamSettings = async () => {
    const wasEnabled = !!(autoExamSettings.auto_exam_enabled);
    const loadedSnapshot = loadedAutoExamSettingsRef.current;
    const originallyEnabled = !!(loadedSnapshot?.auto_exam_enabled);
    const willEnable = wasEnabled && !originallyEnabled;

    setSavingAutoExamSettings(true);
    try {
      const payload = normalizeAutoExamSettings(autoExamSettings);
      const res = await apiFetch("/api/system/settings/auto-exam", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setAutoExamSettings(payload);
        loadedAutoExamSettingsRef.current = { ...payload };
        if (willEnable) {
          toast.success("Auto exam enabled! Exam allotment cycle has started in the background. Refresh the Allotted Exams page after ~1 minute.");
        } else if (wasEnabled) {
          toast.success("Auto exam settings saved successfully!");
        } else {
          toast.success("Auto exam disabled and settings saved.");
        }
        setAutoExamDialogOpen(false);
        if (willEnable) {
          setTimeout(() => fetchInitialData(), 3000);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || "Failed to save auto exam settings");
      }
    } catch (error) {
      console.error("Error saving auto exam settings:", error);
      toast.error("Failed to save auto exam settings");
    } finally {
      setSavingAutoExamSettings(false);
    }
  };



  // Load data when component mounts
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch auto exam settings when dialog opens
  useEffect(() => {
    if (autoExamDialogOpen) {
      fetchAutoExamSettings();
    }
  }, [autoExamDialogOpen]);

  const handleUpdate = async () => {
    const batchPapers: StudentPaper[] = editAllotment
      ? (editAllotment.papers as StudentPaper[])
      : editPaper
        ? [editPaper]
        : [];

    if (batchPapers.length === 0) return;

    setSubmitting(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const storedUser = sessionStorage.getItem("user");
      const u = storedUser ? JSON.parse(storedUser) : null;

      for (const [subjectId, subjectData] of Object.entries(allotmentData)) {
        if (!subjectData.start_window || !subjectData.end_window) continue;

        const papersForSubject = batchPapers.filter(
          (p) => toId(p.subject_id) === subjectId
        );
        if (papersForSubject.length === 0) continue;

        const templatePaper = papersForSubject[0];
        const blueprintChanged = toId(templatePaper.blueprint_id) !== subjectData.blueprint_id;

        if (blueprintChanged && subjectData.blueprint_id) {
          // Blueprint changed — delete old papers and regenerate for each student
          for (const paper of papersForSubject) {
            const delRes = await apiFetch(`/api/exam/papers/${toId(paper._id)}`, { method: "DELETE" });
            if (!delRes.ok) { failCount++; continue; }
          }

          const uniqueStudentIds = [...new Set(papersForSubject.map((p) => toId(p.student_id)))];
          for (const studentId of uniqueStudentIds) {
            const refPaper = papersForSubject.find((p) => toId(p.student_id) === studentId);
            const centerId = refPaper ? toId(refPaper.center_id) : (u?.role === "center" ? u._id : "");

            const response = await apiFetch("/api/exam/generate-paper", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                blueprint_id: subjectData.blueprint_id,
                student_id: studentId,
                center_id: centerId,
                start_window: subjectData.start_window,
                end_window: subjectData.end_window,
                subject_id: subjectId,
                force: true,
                bank_id_override: subjectData.bank_id_override,
              }),
            });

            if (response.ok) successCount++;
            else failCount++;
          }
        } else {
          // Schedule-only update for all student papers in this subject
          for (const paper of papersForSubject) {
            const response = await apiFetch(`/api/exam/papers/${toId(paper._id)}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                start_window: subjectData.start_window,
                end_window: subjectData.end_window,
              }),
            });

            if (response.ok) successCount++;
            else failCount++;
          }
        }
      }

      if (failCount === 0) {
        toast.success(`Exam updated successfully (${successCount} paper${successCount !== 1 ? "s" : ""})`);
        navigate("/dashboard/exams/alloted");
      } else {
        toast.error(`Update partially failed: ${successCount} updated, ${failCount} failed`);
      }
    } catch (error) {
      console.error("Error updating exam:", error);
      toast.error("An error occurred while updating");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAllot = async () => {
    if (selectedCourse === "all") {
      toast.error("Please select a course");
      return;
    }

    const subjectsToAllot = Object.entries(allotmentData);
    if (subjectsToAllot.length === 0) {
      toast.error("No subjects found for allotment");
      return;
    }

    if (eligibleStudents.eligible === 0) {
      toast.error(forReappearStudents
        ? "No eligible reappear students found for this course"
        : "No eligible first-attempt students found for this course");
      return;
    }

    const now = getServerNow();
    const leeway = 5 * 60000;

    for (const [subId, data] of subjectsToAllot) {
      const subName = subjects.find(s => s._id === subId)?.subject_name;
      if (!data.blueprint_id) {
        toast.error(`Please select a blueprint for ${subName}`);
        return;
      }
      if (!data.start_window || !data.end_window) {
        toast.error(`Please select a start time for ${subName}`);
        return;
      }
      if (new Date(data.start_window).getTime() < now.getTime() - leeway) {
        toast.error(`Start window for ${subName} cannot be in the past`);
        return;
      }
    }

    const clash = checkTimeClashes();
    if (clash.clashed) {
      toast.error(`Time Clash Detected: "${clash.sub1}" and "${clash.sub2}" have overlapping exam times.`);
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
          subjects: subjectsToAllot.map(([subjectId, data]) => ({
            subject_id: subjectId,
            blueprint_id: data.blueprint_id,
            start_window: data.start_window,
            end_window: data.end_window,
            bank_id_override: data.bank_id_override,
          })),
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        toast.success(result.message || `Allotted ${result.allotted_count} student(s)`);
        if (result.skipped?.length > 0) {
          console.warn("Skipped students:", result.skipped);
        }
        setIsAllotted(true);
        apiFetch("/api/exam/papers")
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) {
              setPapers(data.map((p: any) => ({
                ...p,
                _id: toId(p._id),
                student_id: toId(p.student_id),
                blueprint_id: toId(p.blueprint_id),
                subject_id: toId(p.subject_id),
              })));
            }
          })
          .catch(console.error);
      } else {
        toast.error(result.message || "Allotment failed");
      }
    } catch (error) {
      toast.error("An error occurred during allotment");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCoursesList = useMemo(() => {
    if (selectedCategory === "all") return [];
    return allCourses.filter(c => c.category_id === selectedCategory);
  }, [allCourses, selectedCategory]);

  const filteredStudents = students.filter(s => {
    // Exclude students from inactive/suspended/deleted centers
    const studentCenter = findCenterForStudent(toId(s.parent_id), centers);
    if (!studentCenter || !studentCenter.active) {
      return false;
    }

    // First check course filter
    let matchesCourse = false;
    if (selectedCourse === "all") {
      if (selectedCategory === "all") {
        matchesCourse = true;
      } else {
        // Filter students by category if course is "all"
        const course = allCourses.find(c => c.id === s.course_id || (c.course_name === s.course));
        matchesCourse = course?.category_id === selectedCategory;
      }
    } else {
      // Match by course_id (ID) or course name (string)
      const course = allCourses.find(c => c.id === selectedCourse);
      matchesCourse = s.course_id === selectedCourse || (course && s.course === course.course_name);
    }

    if (!matchesCourse) {
      return false;
    }

    // Check center filter if any centers are selected
    if (selectedCenterIds.length > 0) {
      const validParentIds = getValidParentIdsForCenters(selectedCenterIds, centers);
      const studentParentId = toId(s.parent_id);
      if (!studentParentId || !validParentIds.has(studentParentId)) {
        return false;
      }
    }

    // Now check if course is completed (session_end_date has passed or is today)
    if (!s.session_end_date) {
      return true;
    }

    // Parse session_end_date (handle various formats)
    try {
      let endDate: Date;
      const sessionEndDate = s.session_end_date as any;

      // If session_end_date is a MongoDB Date object with $date
      if (sessionEndDate && typeof sessionEndDate === "object" && sessionEndDate.$date) {
        endDate = new Date(sessionEndDate.$date);
      } else if (typeof sessionEndDate === "string") {
        endDate = new Date(sessionEndDate);
      } else {
        // Fallback
        endDate = new Date(sessionEndDate);
      }

      const today = getServerNow(); // Use server-synced time!
      // Set time to 00:00:00 to compare dates only (using UTC to avoid timezone issues)
      const endDateUTC = new Date(Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()));
      const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

      return endDateUTC <= todayUTC;
    } catch (e) {
      console.error("[AdminExamAllotPage] Error parsing session_end_date:", e, "session_end_date value:", s.session_end_date);
      return false;
    }
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-8 max-w-5xl mx-auto">
        {loading && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">{t("Loading Allotment Data...")}</p>
          </div>
        )}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {isEditMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/dashboard/exams/alloted")}
                className="rounded-none border-primary/20 text-primary"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight text-foreground flex items-center gap-3">
                <ClipboardList className="w-8 h-8 text-primary" />
                {isEditMode ? "Edit Alloted Exam" : t("Exam Allotment")}
              </h1>
              <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.2em] mt-1">
                {isEditMode
                  ? "Update exam schedule and settings for this course allotment"
                  : t("Generate and assign exam papers to students based on blueprints")}
              </p>
            </div>
          </div>
          {!isEditMode && (
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setAutoExamDialogOpen(true)}
                variant="default"
                size="sm"
                className="rounded-none font-black uppercase tracking-widest text-[10px] h-10"
              >
                Automate Exam
              </Button>
              <Button
                onClick={fetchInitialData}
                variant="outline"
                size="sm"
                className="rounded-none font-black uppercase tracking-widest text-[10px] h-10 border-primary/20 text-primary"
              >
                <Loader2 className={cn("w-3 h-3 mr-2", loading && "animate-spin")} />
                {t("Refresh All Data")}
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Selection Form */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="rounded-none border-border shadow-md">
              <CardHeader className="bg-muted/30 border-b border-border">
                <CardTitle className="text-xs font-black uppercase tracking-widest">{t("Filter Students")}</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">1. {t("Select Category")}</Label>
                  <Select value={selectedCategory} onValueChange={(v) => {
                    if (isEditMode) return;
                    setSelectedCategory(v);
                    setSelectedCourse("all");
                  }} disabled={isEditMode}>
                    <SelectTrigger className="rounded-none border-border font-bold">
                      <SelectValue placeholder={t("Select Category")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("All Categories")}</SelectItem>
                      {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>


                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">2. {t("Select Course")}</Label>
                  <Select value={selectedCourse} onValueChange={(v) => {
                    if (isEditMode) return;
                    setSelectedCourse(v);
                    setSelectedBlueprint("");
                  }} disabled={isEditMode}>
                    <SelectTrigger className="rounded-none border-border font-bold">
                      <SelectValue placeholder={t("Select Course")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("All Courses")}</SelectItem>
                      {filteredCoursesList.map(c => <SelectItem key={c.id} value={c.id}>{c.course_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCourse !== "all" && (
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">3. {t("Select Exam Blueprint")}</Label>
                    <Select value={selectedBlueprint} onValueChange={(v) => {
                      if (isEditMode) return;
                      setSelectedBlueprint(v);
                    }} disabled={isEditMode}>
                      <SelectTrigger className="rounded-none border-border font-bold">
                        <SelectValue placeholder={t("Select Exam Blueprint")} />
                      </SelectTrigger>
                      <SelectContent>
                        {courseBlueprints.length === 0 ? (
                          <SelectItem value="none" disabled className="text-[10px] font-bold">
                            {t("No blueprints found for this course")}
                          </SelectItem>
                        ) : (
                          courseBlueprints.map(bp => (
                            <SelectItem key={bp._id} value={bp._id || "none"} className="text-[10px] font-bold">
                              {bp.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">{t("Target Student(s)")}</Label>
                  <div className="p-3 bg-primary/5 border border-primary/20 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-primary">
                      {t("ALL STUDENTS IN COURSE")}
                    </span>
                    <UserCheck className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-[9px] text-muted-foreground font-bold uppercase">{t("Targeting {{count}} students matching the selected filters", { count: filteredStudents.length })}</p>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/10 p-4 space-y-2">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    {t("Help Note")}
                  </p>
                  <p className="text-[9px] font-bold text-amber-700/70 uppercase leading-relaxed">
                    {t("To allot exams, select a course, then pick blueprints and dates for each subject in the table on the right.")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Preview/Summary */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-none border-border shadow-md">
              <CardHeader className="bg-muted/30 border-b border-border py-3 px-4">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center justify-between">
                  <span>{t("Subject-wise Allotment Table")}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-[9px] text-primary font-black uppercase">{t("All Subjects Mandatory")}</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {selectedCourse === "all" ? (
                  <div className="p-12 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center border border-border">
                      <Search className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">{t("Waiting for course selection")}</p>
                      <p className="text-[10px] text-muted-foreground/60 font-bold uppercase mt-1">{t("Select a course to see subjects")}</p>
                    </div>
                  </div>
                ) : filteredSubjects.length === 0 ? (
                  <div className="p-12 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center border border-border">
                      <Filter className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">{t("No subjects found")}</p>
                      <p className="text-[10px] text-muted-foreground/60 font-bold uppercase mt-1">{t("This course has no subjects mapped to it")}</p>
                    </div>
                  </div>
                ) : (
                  <Table className="border-none">
                    <TableHeader className="bg-muted/50 border-b border-border">
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-3 pl-6">{t("Subject")}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-3">{t("Question Bank")}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-3">{t("Date & Time")}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-3">{t("End (Auto)")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSubjects.map(subject => {
                        const data = allotmentData[subject._id] || { blueprint_id: selectedBlueprint, start_window: "", end_window: "", selected: true };
                        return (
                          <TableRow key={subject._id} className={cn("border-b border-border/50 bg-primary/5")}>
                            <TableCell className="py-2 pl-6">
                              <p className="text-xs font-bold uppercase tracking-tight">{subject.subject_name}</p>
                            </TableCell>
                            <TableCell className="py-2">
                              {(() => {
                                const blueprint = selectedBlueprintData;
                                if (!blueprint) return <span className="text-[8px] font-bold text-muted-foreground uppercase px-2 italic">-</span>;

                                // Find the subject config in the blueprint
                                const subjectConfig = blueprint.subjects?.find(s => s.subject_id === subject._id);

                                // Determine which bank to show
                                let bankId: string | undefined;
                                if (subjectConfig) {
                                  bankId = forReappearStudents
                                    ? (subjectConfig.reappear_question_bank_id || subjectConfig.default_question_bank_id)
                                    : subjectConfig.default_question_bank_id;
                                } else {
                                  // Fallback to old blueprint fields for backward compatibility
                                  bankId = forReappearStudents
                                    ? (blueprint.reappear_bank_id || blueprint.bank_id)
                                    : blueprint.bank_id;
                                }

                                const bankName = banks.find(b => b._id === bankId)?.name || "Unknown Bank";

                                if (blueprint.allow_bank_override) {
                                  return (
                                    <Select
                                      value={data.bank_id_override || "default"}
                                      onValueChange={(val) => updateSubjectAllotment(subject._id, "bank_id_override", val === "default" ? undefined : val)}
                                    >
                                      <SelectTrigger className="h-8 rounded-none border-border font-bold text-[9px] px-2 bg-yellow-50/30">
                                        <SelectValue placeholder={bankName} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="default" className="text-[10px]">{bankName} (Default)</SelectItem>
                                        {banks.map(bank => (
                                          <SelectItem key={bank._id} value={bank._id} className="text-[10px]">{bank.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  );
                                } else {
                                  return (
                                    <span className="text-[8px] font-bold text-muted-foreground uppercase px-2 italic">{bankName} (Fixed)</span>
                                  );
                                }
                              })()}
                            </TableCell>
                            <TableCell className="py-2">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "h-8 w-full justify-start text-left font-bold rounded-none border-border text-[9px] px-2",
                                      !data.start_window && "text-muted-foreground"
                                    )}
                                  >
                                    <CalendarIcon className="mr-1 h-3 w-3" />
                                    {data.start_window ? formatDisplayTime(data.start_window).replace(" (SERVER TIME)", "") : <span>{t("Pick date & time")}</span>}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 rounded-none border-primary" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={data.start_window ? new Date(data.start_window) : undefined}
                                    onSelect={(date) => {
                                      if (!date) return;
                                      const current = data.start_window ? new Date(data.start_window) : getServerNow();
                                      const istOptions: Intl.DateTimeFormatOptions = {
                                        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata'
                                      };
                                      const istParts = new Intl.DateTimeFormat('en-US', istOptions).formatToParts(current);
                                      const getISTPart = (type: string) => istParts.find(p => p.type === type)?.value || "00";
                                      const y = date.getFullYear();
                                      const m = String(date.getMonth() + 1).padStart(2, '0');
                                      const d = String(date.getDate()).padStart(2, '0');
                                      const isoIST = `${y}-${m}-${d}T${getISTPart('hour')}:${getISTPart('minute')}:00+05:30`;
                                      updateSubjectAllotment(subject._id, "start_window", new Date(isoIST).toISOString());
                                    }}
                                  />
                                  <div className="p-3 border-t border-border flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <Input
                                      type="time"
                                      value={data.start_window ? getISTTimeParts(new Date(data.start_window)) : "00:00"}
                                      onChange={(e) => {
                                        const [hrs, mins] = e.target.value.split(":").map(Number);
                                        const current = data.start_window ? new Date(data.start_window) : getServerNow();
                                        const options: Intl.DateTimeFormatOptions = {
                                          year: 'numeric', month: '2-digit', day: '2-digit',
                                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                                          hour12: false, timeZone: 'Asia/Kolkata'
                                        };
                                        const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(current);
                                        const getPart = (type: string) => parts.find(p => p.type === type)?.value || "";
                                        const isoIST = `${getPart('year')}-${getPart('month')}-${getPart('day')}T${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
                                        updateSubjectAllotment(subject._id, "start_window", new Date(isoIST + "+05:30").toISOString());
                                      }}
                                      className="h-8 rounded-none border-border font-bold text-xs"
                                    />
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            <TableCell className="py-2">
                              <p className="text-[9px] font-bold text-muted-foreground">
                                {data.end_window ? formatDisplayTime(data.end_window).split(", ")[1].replace(" (SERVER TIME)", "") : "---"}
                              </p>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-none border-border shadow-md">
              <CardHeader className="bg-muted/30 border-b border-border py-3 px-4">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-primary" />
                  {t("Selection Summary")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {selectedCourse === "all" ? (
                  <div className="text-center py-4">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{t("SELECT A COURSE TO SEE SUMMARY")}</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <UserCheck className="w-8 h-8 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">{t("Target Students")}</p>
                        <h2 className="text-2xl font-black uppercase tracking-tight">{filteredStudents.length} Students</h2>
                        <p className="text-xs font-bold text-muted-foreground">Course: {allCourses.find(c => c.id === selectedCourse)?.course_name}</p>
                        <p className="text-[10px] font-bold text-emerald-600 mt-1">
                          {eligibleStudents.eligible} eligible / {eligibleStudents.total} in course
                          {forReappearStudents ? " (Reappear mode)" : " (First attempt)"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-amber-500/5 border border-amber-500/20 rounded-none">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">For Reappear Students</p>
                        <p className="text-[9px] text-amber-600/80 font-bold mt-0.5">Off = first attempt only. On = reappear-approved failed students only.</p>
                      </div>
                      <Switch
                        checked={forReappearStudents}
                        onCheckedChange={setForReappearStudents}
                        disabled={isEditMode}
                      />
                    </div>

                    {/* Center Selection */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest">Select Centers</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between rounded-none border-border font-bold bg-white/50"
                            disabled={isEditMode}
                          >
                            {selectedCenterIds.length === 0
                              ? "Select centers..."
                              : `${selectedCenterIds.length} center${selectedCenterIds.length > 1 ? "s" : ""} selected`}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search centers..." />
                            <CommandList>
                              <CommandEmpty>No centers found.</CommandEmpty>
                              <CommandGroup>
                                {centers.map((center) => {
                                  const isSelected = selectedCenterIds.includes(center._id);
                                  const isInactive = !center.active;
                                  return (
                                    <CommandItem
                                      key={center._id}
                                      value={center._id}
                                      keywords={[center.name, isInactive ? "suspended" : ""]}
                                      disabled={isInactive}
                                      onSelect={() => {
                                        if (isInactive) return;
                                        if (isSelected) {
                                          setSelectedCenterIds(selectedCenterIds.filter((id) => id !== center._id));
                                        } else {
                                          setSelectedCenterIds([...selectedCenterIds, center._id]);
                                        }
                                      }}
                                    >
                                      <CheckCircle2
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          isSelected ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {center.name}
                                      {isInactive && (
                                        <span className="ml-2 text-[9px] font-black uppercase text-amber-600">(Suspended)</span>
                                      )}
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <div className="flex flex-wrap gap-2">
                        {selectedCenterIds.map((id) => {
                          const center = centers.find((c) => c._id === id);
                          return (
                            <span
                              key={id}
                              className="flex items-center gap-1 bg-primary/10 border border-primary/20 text-primary px-2 py-1 text-[9px] font-black uppercase tracking-widest"
                            >
                              {center?.name}
                              {!isEditMode && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedCenterIds(selectedCenterIds.filter((cid) => cid !== id))}
                                  className="text-xs hover:text-red-500"
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          );
                        })}
                      </div>
                      {selectedCenterIds.length === 0 && (
                        <p className="text-[9px] text-muted-foreground font-bold uppercase">No centers selected - all eligible students</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted/50 border border-border text-left">
                        <div className="flex items-center gap-2 mb-2">
                          <BookOpen className="w-4 h-4 text-primary" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Selected Subjects</p>
                        </div>
                        <p className="text-sm font-bold">{Object.values(allotmentData).filter(d => d.selected).length} / {filteredSubjects.length}</p>
                      </div>
                      <div className="p-4 bg-muted/50 border border-border text-left">
                        <div className="flex items-center gap-2 mb-2">
                          <CalendarCheck className="w-4 h-4 text-emerald-500" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ready for Allotment</p>
                        </div>
                        <p className="text-sm font-bold">{Object.values(allotmentData).filter(d => d.selected && d.blueprint_id && d.start_window).length} Subjects</p>
                      </div>
                    </div>

                    {!isEditMode && (
                      <div className="bg-primary/5 border border-primary/10 p-4 text-[10px] font-bold text-primary text-left uppercase leading-relaxed">
                        NOTICE: CONFIRMING THIS ALLOTMENT WILL ASSIGN THE SELECTED EXAM BLUEPRINT TO ALL ELIGIBLE STUDENTS USING THE CONFIGURED QUESTION BANKS. THIS ACTION CANNOT BE UNDONE.
                      </div>
                    )}

                    {!isEditMode && (
                      <div className="flex items-center space-x-2 p-4 bg-amber-500/5 border border-amber-500/10">
                        <Checkbox
                          id="force-allot"
                          checked={forceAllot}
                          onCheckedChange={(v) => setForceAllot(v === true)}
                          className="rounded-none"
                        />
                        <Label htmlFor="force-allot" className="text-[10px] font-black uppercase tracking-widest text-amber-600 cursor-pointer select-none">
                          {t("Force Allot (Cancel existing active attempts)")}
                        </Label>
                      </div>
                    )}

                    {!isEditMode && isAllotted && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-emerald-600">
                          <CheckCircle2 className="w-5 h-5" />
                          <p className="text-xs font-black uppercase tracking-widest">Allotment Successful!</p>
                        </div>
                        <p className="text-[10px] font-bold text-emerald-700/70 uppercase">
                          Exams have been successfully alloted to all students in this course. Hall tickets are now available for download.
                        </p>
                        <Link to="/dashboard/exams/papers" className="block">
                          <Button variant="outline" className="w-full rounded-none border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 font-black uppercase text-[10px] tracking-widest h-10">
                            <Ticket className="w-4 h-4 mr-2" />
                            View & Download Hall Tickets
                          </Button>
                        </Link>
                      </div>
                    )}

                    {isEditMode ? (
                      <Button
                        onClick={handleUpdate}
                        disabled={submitting}
                        className="w-full rounded-none font-black uppercase tracking-widest text-xs h-12"
                      >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserCheck className="w-4 h-4 mr-2" />}
                        Update Alloted Exam
                      </Button>
                    ) : (
                      <Button
                        onClick={handleAllot}
                        disabled={submitting || Object.values(allotmentData).filter(d => d.selected).length === 0 || selectedCourse === "all"}
                        className="w-full rounded-none font-black uppercase tracking-widest text-xs h-12"
                      >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserCheck className="w-4 h-4 mr-2" />}
                        {isAllotted ? "Re-allot Exams" : "Confirm Allotment"}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>


          </div>
        </div>

        {/* Auto Exam Scheduling Dialog */}
        <Dialog open={autoExamDialogOpen} onOpenChange={setAutoExamDialogOpen}>
          <DialogContent className="rounded-none border-border shadow-lg">
            <DialogHeader>
              <DialogTitle className="font-black uppercase tracking-widest">
                Auto Exam Scheduling
              </DialogTitle>
              <DialogDescription className="text-xs font-medium">
                Configure automatic exam allotment for all eligible students.
              </DialogDescription>
            </DialogHeader>

            {loadingAutoExamSettings ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Enable Auto Exam */}
                <div className="flex items-center justify-between p-4 bg-muted/20 border border-border">
                  <div className="space-y-1">
                    <Label className="text-xs font-black uppercase tracking-widest">
                      Enable Auto Exam
                    </Label>
                    <p className="text-[10px] text-muted-foreground uppercase">
                      Enable automatic exam allotment every month on the scheduled day.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoExamSettings({ ...autoExamSettings, auto_exam_enabled: !(autoExamSettings.auto_exam_enabled || false) })}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      autoExamSettings.auto_exam_enabled ? "bg-primary" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        autoExamSettings.auto_exam_enabled ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>

                {/* Exam Allotment Day */}
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest">
                    Exam Allotment Day
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={autoExamSettings.auto_exam_allotment_day || 1}
                    onChange={(e) =>
                      setAutoExamSettings({
                        ...autoExamSettings,
                        auto_exam_allotment_day: Math.min(31, Math.max(1, parseInt(e.target.value) || 1)),
                      })
                    }
                    className="h-10 rounded-none border-border font-bold text-sm"
                  />
                </div>

                {/* Exam Day */}
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest">
                    Exam Day
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={autoExamSettings.auto_exam_day || 1}
                    onChange={(e) =>
                      setAutoExamSettings({
                        ...autoExamSettings,
                        auto_exam_day: Math.min(31, Math.max(1, parseInt(e.target.value) || 1)),
                      })
                    }
                    className="h-10 rounded-none border-border font-bold text-sm"
                  />
                </div>

                {/* Exam Time */}
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest">
                    Exam Time (IST)
                  </Label>
                  <Input
                    type="time"
                    value={autoExamSettings.auto_exam_time || "09:00"}
                    onChange={(e) => setAutoExamSettings({ ...autoExamSettings, auto_exam_time: e.target.value })}
                    className="h-10 rounded-none border-border font-bold text-sm"
                  />
                </div>

                {/* Subject Gap */}
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest">
                    Subject Gap (Minutes)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={autoExamSettings.auto_exam_subject_gap_minutes || 0}
                    onChange={(e) =>
                      setAutoExamSettings({
                        ...autoExamSettings,
                        auto_exam_subject_gap_minutes: Math.max(0, parseInt(e.target.value) || 0),
                      })
                    }
                    className="h-10 rounded-none border-border font-bold text-sm"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <DialogClose asChild>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto rounded-none border-border font-black uppercase tracking-widest text-xs h-10"
                >
                  Cancel
                </Button>
              </DialogClose>

              <Button
                onClick={saveAutoExamSettings}
                disabled={savingAutoExamSettings || loadingAutoExamSettings}
                className="w-full sm:w-auto rounded-none font-black uppercase tracking-widest text-xs h-10"
              >
                {savingAutoExamSettings ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="w-3 h-3 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminExamAllotPage;
