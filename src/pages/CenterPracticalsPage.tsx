import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FlaskConical,
  PlusCircle,
  Download,
  List,
  Calendar,
  Clock,
  ExternalLink,
  Trash2,
  Pencil,
  Loader2,
  CheckCircle2,
  Search,
  Wrench,
  Laptop,
  BookOpen,
  UserCheck,
  FileText,
  Building,
  Upload,
  Sparkles,
  Award,
  AlertCircle,
  Eye,
  Check,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface Practical {
  id: string;
  title: string;
  experiment_code: string;
  course_id?: string;
  course_name?: string;
  subject_name: string;
  center_name?: string;
  batch_name?: string;
  instructor_name?: string;
  practical_mode: "physical_lab" | "computer_it" | "hybrid" | string;
  total_marks: number;
  exp_marks: number;
  journal_marks: number;
  viva_marks: number;
  scheduled_at: string;
  due_date: string;
  pdf_manual_url?: string;
  starter_code_url?: string;
  allow_in_person_signoff?: bool;
  allow_photo_proof?: bool;
  status: string;
}

interface Submission {
  id: string;
  practical_id: string;
  practical_title?: string;
  experiment_code?: string;
  student_id: string;
  student_name?: string;
  roll_no?: string;
  center_name?: string;
  submission_type: "file_upload" | "photo_proof" | "in_person_signoff" | string;
  file_urls: string[];
  student_notes?: string;
  submitted_at: string;
  evaluator_name?: string;
  exp_marks_obtained?: number;
  journal_marks_obtained?: number;
  viva_marks_obtained?: number;
  total_marks_obtained?: number;
  instructor_review_remarks?: string;
  status: "submitted" | "approved" | "revision_requested" | "in_person_pending" | string;
}

interface Course {
  id: string;
  course_name: string;
}

const MODE_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  physical_lab: {
    label: "Physical Hardware / Workshop Lab",
    icon: Wrench,
    color: "text-amber-400 border-amber-500/30",
    bg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  computer_it: {
    label: "Computer / IT Software Lab",
    icon: Laptop,
    color: "text-blue-400 border-blue-500/30",
    bg: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  },
  hybrid: {
    label: "Theory + Skill Hybrid Lab",
    icon: BookOpen,
    color: "text-purple-400 border-purple-500/30",
    bg: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  },
};

export default function CenterPracticalsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active view tab from route
  const getTabFromPath = () => {
    if (location.pathname.includes("/create")) return "create";
    if (location.pathname.includes("/submissions")) return "submissions";
    return "all";
  };

  const [activeTab, setActiveTab] = useState<"all" | "create" | "submissions">(getTabFromPath());
  useEffect(() => {
    setActiveTab(getTabFromPath());
  }, [location.pathname]);

  const [practicals, setPracticals] = useState<Practical[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [selectedMode, setSelectedMode] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Evaluation Drawer / Modal State
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [evalSub, setEvalSub] = useState<Submission | null>(null);
  const [evalForm, setEvalForm] = useState({
    exp_marks: "20",
    journal_marks: "10",
    viva_marks: "20",
    remarks: "",
    status: "approved",
  });
  const [evaluating, setEvaluating] = useState(false);

  // User details & role
  const [userRole, setUserRole] = useState("center");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user") || sessionStorage.getItem("user");
      if (stored) {
        const u = JSON.parse(stored);
        if (u.role) setUserRole(String(u.role).toLowerCase());
      }
    } catch {}
  }, []);

  // Form State for Creating Practical
  const [saving, setSaving] = useState(false);
  const [subjects, setSubjects] = useState<{ id: string; subject_name: string; subject_code?: string }[]>([]);
  const [courseSpecificSubjects, setCourseSpecificSubjects] = useState<{ id: string; subject_name: string; subject_code?: string }[]>([]);
  const [batches, setBatches] = useState<{ id: string; batch_name?: string; session_name?: string; name?: string }[]>([]);
  const [staffList, setStaffList] = useState<{ id: string; full_name?: string; first_name?: string; username?: string; designation?: string }[]>([]);
  const [centersList, setCentersList] = useState<{ id: string; center_name: string; center_code?: string }[]>([]);

  // File Upload States & Handlers
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingStarter, setUploadingStarter] = useState(false);

  const uploadFileToServer = async (file: File): Promise<string | null> => {
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);
    try {
      const res = await apiFetch("/api/uploads", {
        method: "POST",
        body: formDataUpload,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) return data.url as string;
      return null;
    } catch {
      return null;
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    toast.info("Uploading PDF Lab Manual...");
    try {
      const url = await uploadFileToServer(file);
      if (url) {
        setCreateForm((prev) => ({ ...prev, pdf_manual_url: url }));
        toast.success("✅ PDF Lab Manual uploaded successfully!");
      } else {
        toast.error("Failed to upload PDF");
      }
    } catch {
      toast.error("Error uploading PDF");
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    toast.info("Uploading Demo Video...");
    try {
      const url = await uploadFileToServer(file);
      if (url) {
        setCreateForm((prev) => ({ ...prev, video_demo_url: url }));
        toast.success("✅ Demo Video uploaded successfully!");
      } else {
        toast.error("Failed to upload video");
      }
    } catch {
      toast.error("Error uploading video");
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleStarterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingStarter(true);
    toast.info("Uploading Starter Code / Resource Zip...");
    try {
      const url = await uploadFileToServer(file);
      if (url) {
        setCreateForm((prev) => ({ ...prev, starter_code_url: url }));
        toast.success("✅ Starter Code uploaded successfully!");
      } else {
        toast.error("Failed to upload file");
      }
    } catch {
      toast.error("Error uploading file");
    } finally {
      setUploadingStarter(false);
    }
  };

  // Viva / Practice Prep Questions List
  const [vivaQuestions, setVivaQuestions] = useState<string[]>([
    "What is the main objective and theoretical principle of this experiment?",
    "Explain the key parameters observed and safety precautions taken.",
  ]);

  const addVivaQuestion = () => {
    setVivaQuestions((prev) => [...prev, ""]);
  };

  const removeVivaQuestion = (index: number) => {
    setVivaQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateVivaQuestion = (index: number, val: string) => {
    setVivaQuestions((prev) => {
      const updated = [...prev];
      updated[index] = val;
      return updated;
    });
  };

  const [createForm, setCreateForm] = useState({
    title: "",
    experiment_code: "",
    course_id: "all",
    subject_name: "",
    batch_name: "All Center Batches",
    instructor_name: "Course Faculty",
    center_id: "all",
    practical_mode: "physical_lab",
    delivery_mode: "offline_center",
    exp_marks: "20",
    journal_marks: "10",
    viva_marks: "20",
    passing_marks: "20",
    scheduled_at: "",
    due_date: "",
    pdf_manual_url: "",
    video_demo_url: "",
    starter_code_url: "",
    description: "",
    allow_in_person_signoff: true,
    allow_photo_proof: true,
  });

  const extractArray = (data: any, keys: string[]): any[] => {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== "object") return [];
    for (const key of keys) {
      if (Array.isArray(data[key])) return data[key];
    }
    return [];
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pracRes, subRes, crsRes, subjRes, batchRes, staffRes, ctrRes] = await Promise.all([
        apiFetch("/api/practicals"),
        apiFetch("/api/practicals/submissions"),
        apiFetch("/api/courses").then((r) => (r.ok ? r : apiFetch("/api/courses/allot"))),
        apiFetch("/api/admin/subjects?limit=200"),
        apiFetch("/api/batches").then((r) => (r.ok ? r : apiFetch("/api/public/batches"))),
        apiFetch("/api/staff"),
        apiFetch("/api/centers").then((r) => (r.ok ? r : apiFetch("/api/public/centers"))),
      ]);

      if (pracRes.ok) {
        const d = await pracRes.json();
        setPracticals(extractArray(d, ["practicals", "items", "data"]));
      }
      if (subRes.ok) {
        const d = await subRes.json();
        setSubmissions(extractArray(d, ["submissions", "items", "data"]));
      }
      if (crsRes.ok) {
        const d = await crsRes.json();
        setCourses(extractArray(d, ["courses", "items", "data"]));
      }
      if (subjRes.ok) {
        const d = await subjRes.json();
        setSubjects(extractArray(d, ["items", "subjects", "data"]));
      }
      if (batchRes.ok) {
        const d = await batchRes.json();
        setBatches(extractArray(d, ["batches", "sessions", "items", "data"]));
      }
      if (staffRes.ok) {
        const d = await staffRes.json();
        setStaffList(extractArray(d, ["staff", "items", "users", "data"]));
      }
      if (ctrRes.ok) {
        const d = await ctrRes.json();
        setCentersList(extractArray(d, ["centers", "items", "data"]));
      }
    } catch {
      toast.error("Failed to load practical lab data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Course Change & fetch mapped subjects
  const handleCourseChange = async (courseId: string) => {
    setCreateForm((prev) => ({ ...prev, course_id: courseId }));
    if (courseId && courseId !== "all" && courseId !== "none") {
      try {
        const res = await apiFetch(`/api/academic/course-subjects/${courseId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.subjects && data.subjects.length > 0) {
            setCourseSpecificSubjects(data.subjects);
            return;
          }
        }
      } catch {}
    }
    setCourseSpecificSubjects([]);
  };

  // Handle Practical Creation
  const handleCreatePractical = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title || !createForm.experiment_code || !createForm.subject_name) {
      toast.error("Please fill Title, Experiment Code, and Subject!");
      return;
    }

    setSaving(true);
    try {
      const exp = parseInt(createForm.exp_marks) || 0;
      const jnl = parseInt(createForm.journal_marks) || 0;
      const viva = parseInt(createForm.viva_marks) || 0;
      const totalMarks = exp + jnl + viva;
      const passMarks = parseInt(createForm.passing_marks) || Math.round(totalMarks * 0.4);

      const selectedCrs = courses.find((c) => c.id === createForm.course_id);

      const payload = {
        title: createForm.title,
        experiment_code: createForm.experiment_code,
        course_id: createForm.course_id !== "all" ? createForm.course_id : undefined,
        course_name: selectedCrs?.course_name,
        subject_name: createForm.subject_name,
        batch_name: createForm.batch_name,
        instructor_name: createForm.instructor_name,
        center_id: createForm.center_id !== "all" ? createForm.center_id : undefined,
        practical_mode: createForm.practical_mode,
        delivery_mode: createForm.delivery_mode,
        exp_marks: exp,
        journal_marks: jnl,
        viva_marks: viva,
        total_marks: totalMarks,
        passing_marks: passMarks,
        scheduled_at: createForm.scheduled_at || new Date().toISOString(),
        due_date: createForm.due_date || new Date(Date.now() + 7 * 86400000).toISOString(),
        pdf_manual_url: createForm.pdf_manual_url,
        video_demo_url: createForm.video_demo_url,
        starter_code_url: createForm.starter_code_url,
        description: createForm.description,
        viva_questions: vivaQuestions.filter((q) => q.trim().length > 0),
        allow_in_person_signoff: createForm.allow_in_person_signoff,
        allow_photo_proof: createForm.allow_photo_proof,
      };

      const res = await apiFetch("/api/practicals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("✅ Practical Lab Experiment Published Successfully!");
        setCreateForm({
          title: "",
          experiment_code: "",
          course_id: "all",
          subject_name: "",
          batch_name: "All Center Batches",
          instructor_name: "Course Faculty",
          center_id: "all",
          practical_mode: "physical_lab",
          delivery_mode: "offline_center",
          exp_marks: "20",
          journal_marks: "10",
          viva_marks: "20",
          passing_marks: "20",
          scheduled_at: "",
          due_date: "",
          pdf_manual_url: "",
          video_demo_url: "",
          starter_code_url: "",
          description: "",
          allow_in_person_signoff: true,
          allow_photo_proof: true,
        });
        setVivaQuestions([
          "What is the main objective and theoretical principle of this experiment?",
          "Explain the key parameters observed and safety precautions taken.",
        ]);
        fetchData();
        navigate("/dashboard/practicals");
      } else {
        toast.error(data.message || "Failed to publish practical task");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  // Open Evaluation Modal for a submission
  const openEvaluation = (sub: Submission) => {
    setEvalSub(sub);
    setEvalForm({
      exp_marks: String(sub.exp_marks_obtained ?? 20),
      journal_marks: String(sub.journal_marks_obtained ?? 10),
      viva_marks: String(sub.viva_marks_obtained ?? 20),
      remarks: sub.instructor_review_remarks || "",
      status: sub.status === "submitted" ? "approved" : sub.status,
    });
    setEvalModalOpen(true);
  };

  // Submit Evaluation
  const handleSaveEvaluation = async () => {
    if (!evalSub) return;
    setEvaluating(true);
    try {
      const exp = parseInt(evalForm.exp_marks) || 0;
      const jnl = parseInt(evalForm.journal_marks) || 0;
      const viva = parseInt(evalForm.viva_marks) || 0;

      const payload = {
        exp_marks_obtained: exp,
        journal_marks_obtained: jnl,
        viva_marks_obtained: viva,
        instructor_review_remarks: evalForm.remarks,
        status: evalForm.status,
      };

      const res = await apiFetch(`/api/practicals/submissions/${evalSub.id}/evaluate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("✅ 360° Evaluation & Review Remarks Published!");
        setEvalModalOpen(false);
        fetchData();
      } else {
        toast.error(data.message || "Failed to save evaluation");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setEvaluating(false);
    }
  };

  // Delete Practical
  const handleDeletePractical = async (id?: string) => {
    const targetId = id && id !== "undefined" ? id : "purge";
    if (!confirm("Are you sure you want to delete this practical task?")) return;
    try {
      const res = await apiFetch(`/api/practicals/${targetId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        toast.success("✅ Practical task deleted successfully!");
        fetchData();
      } else {
        toast.error(data.message || "Failed to delete practical task");
      }
    } catch {
      toast.error("Failed to delete practical task");
    }
  };

  // Purge All Practicals & Submissions
  const handlePurgeAllPracticals = async () => {
    if (!confirm("⚠️ Are you sure you want to DELETE ALL practical tasks and submissions? This action cannot be undone!")) return;
    try {
      setPracticals([]);
      setSubmissions([]);
      let res = await apiFetch("/api/practicals/purge", { method: "POST" });
      if (!res.ok) {
        res = await apiFetch("/api/practicals/purge", { method: "DELETE" });
      }
      if (!res.ok) {
        res = await apiFetch("/api/practicals/all", { method: "DELETE" });
      }
      toast.success("✅ All practical tasks & submissions deleted successfully!");
      fetchData();
    } catch {
      toast.error("Network error");
    }
  };

  // Filtered Practicals List
  const filteredPracticals = practicals.filter((p) => {
    if (selectedCourse !== "all" && p.course_id !== selectedCourse) return false;
    if (selectedMode !== "all" && p.practical_mode !== selectedMode) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.experiment_code.toLowerCase().includes(q) ||
        p.subject_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
        {/* Top Header */}
        <div className="flex items-start justify-between flex-wrap gap-4 bg-card/40 p-6 rounded-xl border border-border">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/20 text-primary border-primary/30 uppercase tracking-widest text-[10px] font-bold">
                Universal Skill Lab Engine
              </Badge>
              <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
                ⚡ 360° Instructor Evaluation
              </Badge>
            </div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight mt-1">
              Practicals & Skill Assessment Studio
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              Manage Physical Hardware/Vocational Labs, Computer IT Software Practicals, & Student Journal Evaluation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handlePurgeAllPracticals}
              className="rounded-lg gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-bold"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
              Clear / Delete All Practicals
            </Button>
            <Button
              onClick={() => {
                setActiveTab("create");
                navigate("/dashboard/practicals/create");
              }}
              className="rounded-lg gap-2 bg-primary hover:bg-primary/90"
            >
              <PlusCircle className="w-4 h-4" />
              Create Practical Task
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            onClick={() => {
              setActiveTab("all");
              navigate("/dashboard/practicals");
            }}
            className={`rounded-xl border cursor-pointer transition-all ${
              activeTab === "all"
                ? "border-primary bg-primary/5 shadow-md"
                : "border-border hover:border-primary/40"
            }`}
          >
            <CardContent className="p-5 flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <List className="w-6 h-6" />
              </div>
              <div>
                <p className="font-black text-foreground">All Practicals ({practicals.length})</p>
                <p className="text-xs text-muted-foreground">View all assigned lab experiments & manuals</p>
              </div>
            </CardContent>
          </Card>

          <Card
            onClick={() => {
              setActiveTab("create");
              navigate("/dashboard/practicals/create");
            }}
            className={`rounded-xl border cursor-pointer transition-all ${
              activeTab === "create"
                ? "border-primary bg-primary/5 shadow-md"
                : "border-border hover:border-primary/40"
            }`}
          >
            <CardContent className="p-5 flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <PlusCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="font-black text-foreground">Create Practical Task</p>
                <p className="text-xs text-muted-foreground">Publish Physical / IT lab tasks with rubrics</p>
              </div>
            </CardContent>
          </Card>

          <Card
            onClick={() => {
              setActiveTab("submissions");
              navigate("/dashboard/practicals/submissions");
            }}
            className={`rounded-xl border cursor-pointer transition-all ${
              activeTab === "submissions"
                ? "border-primary bg-primary/5 shadow-md"
                : "border-border hover:border-primary/40"
            }`}
          >
            <CardContent className="p-5 flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <p className="font-black text-foreground">
                  Submissions Studio ({submissions.filter((s) => s.status === "submitted").length} Pending)
                </p>
                <p className="text-xs text-muted-foreground">Evaluate student lab reports, Viva & signoffs</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* TAB 1: ALL PRACTICALS */}
        {activeTab === "all" && (
          <div className="space-y-4">
            {/* Filter Controls */}
            <div className="flex items-center gap-3 flex-wrap bg-card/30 p-4 rounded-xl border border-border">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Search by Title, Experiment Code or Subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-lg"
                />
              </div>

              <Select value={selectedMode} onValueChange={setSelectedMode}>
                <SelectTrigger className="w-[200px] rounded-lg">
                  <SelectValue placeholder="Skill Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Skill Modes</SelectItem>
                  <SelectItem value="physical_lab">🛠️ Physical Hardware Lab</SelectItem>
                  <SelectItem value="computer_it">💻 Computer / IT Lab</SelectItem>
                  <SelectItem value="hybrid">📖 Theory + Skill Hybrid</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger className="w-[200px] rounded-lg">
                  <SelectValue placeholder="All Courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.course_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* List Display */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredPracticals.length === 0 ? (
              <Card className="rounded-xl border-border">
                <CardContent className="py-14 text-center text-muted-foreground">
                  <FlaskConical className="w-12 h-12 mx-auto mb-4 opacity-40" />
                  <p className="font-semibold text-lg">No practical tasks found.</p>
                  <p className="text-sm mt-1">Use the "Create Practical Task" tab to publish new lab assignments.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredPracticals.map((prac) => {
                  const modeCfg = MODE_CONFIG[prac.practical_mode] || MODE_CONFIG.physical_lab;
                  const ModeIcon = modeCfg.icon;
                  const submittedCount = submissions.filter((s) => s.practical_id === prac.id).length;

                  return (
                    <Card key={prac.id} className="rounded-xl border-border transition-all hover:shadow-md">
                      <CardContent className="py-4 px-5">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={`text-[11px] border ${modeCfg.bg}`}>
                                <ModeIcon className="w-3.5 h-3.5 mr-1 inline" />
                                {modeCfg.label}
                              </Badge>
                              <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
                                #{prac.experiment_code}
                              </Badge>
                              <h3 className="font-bold text-base text-foreground truncate">{prac.title}</h3>
                            </div>

                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                              <span className="font-semibold text-foreground">Subject: {prac.subject_name}</span>
                              {prac.course_name && <span>Course: {prac.course_name}</span>}
                              {prac.instructor_name && (
                                <span className="text-amber-400 font-medium">Instructor: {prac.instructor_name}</span>
                              )}
                              <span className="flex items-center gap-1 font-medium">
                                <Calendar className="w-3.5 h-3.5" />
                                Due: {new Date(prac.due_date).toLocaleDateString("en-IN")}
                              </span>
                            </div>

                            {/* Rubric Breakdown Pills */}
                            <div className="flex items-center gap-2 text-[11px] flex-wrap pt-1">
                              <span className="font-bold text-slate-300">Marks Rubric:</span>
                              <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-mono">
                                Exp: {prac.exp_marks}
                              </span>
                              <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 font-mono">
                                Journal: {prac.journal_marks}
                              </span>
                              <span className="bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20 font-mono">
                                Viva: {prac.viva_marks}
                              </span>
                              <span className="bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                                Total: {prac.total_marks} Marks
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {prac.pdf_manual_url && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg gap-1 text-xs"
                                onClick={() => window.open(prac.pdf_manual_url, "_blank")}
                              >
                                <Download className="w-3.5 h-3.5" /> Manual PDF
                              </Button>
                            )}

                            <Button
                              size="sm"
                              className="rounded-lg gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                              onClick={() => {
                                setActiveTab("submissions");
                                navigate("/dashboard/practicals/submissions");
                              }}
                            >
                              <Eye className="w-3.5 h-3.5" /> Submissions ({submittedCount})
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-lg text-destructive hover:text-destructive"
                              onClick={() => handleDeletePractical(prac.id || (prac as any)._id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CREATE PRACTICAL TASK */}
        {activeTab === "create" && (
          <Card className="rounded-xl border-border max-w-3xl mx-auto">
            <CardHeader className="border-b border-border py-4">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-amber-400" />
                Publish Practical Lab Assignment & Rubric
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <form onSubmit={handleCreatePractical} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase">Practical Task Title *</Label>
                    <Input
                      placeholder="e.g. Electrical Circuit Wiring & Soldering"
                      value={createForm.title}
                      onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase">Experiment Code *</Label>
                    <Input
                      placeholder="e.g. EXP-HARDWARE-01"
                      value={createForm.experiment_code}
                      onChange={(e) => setCreateForm({ ...createForm, experiment_code: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase">Skill Mode *</Label>
                    <Select
                      value={createForm.practical_mode}
                      onValueChange={(v) => setCreateForm({ ...createForm, practical_mode: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="physical_lab">🛠️ Physical Hardware Lab</SelectItem>
                        <SelectItem value="computer_it">💻 Computer / IT Software</SelectItem>
                        <SelectItem value="hybrid">📖 Theory + Skill Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase">Target Course *</Label>
                    <Select
                      value={createForm.course_id}
                      onValueChange={(v) => handleCourseChange(v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Course" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">🌐 All Courses / General</SelectItem>
                        {courses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.course_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase">Subject *</Label>
                    <Select
                      value={createForm.subject_name}
                      onValueChange={(v) => setCreateForm({ ...createForm, subject_name: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {(courseSpecificSubjects.length > 0 ? courseSpecificSubjects : subjects).map((s) => (
                          <SelectItem key={s.id || s.subject_name} value={s.subject_name}>
                            {s.subject_name} {s.subject_code ? `(${s.subject_code})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase">Target Batch *</Label>
                    <Select
                      value={createForm.batch_name}
                      onValueChange={(v) => setCreateForm({ ...createForm, batch_name: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Batch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All Center Batches">👥 All Center Batches</SelectItem>
                        {batches.map((b) => {
                          const bName = b.batch_name || b.session_name || b.name || `Batch ${b.id}`;
                          return (
                            <SelectItem key={b.id || bName} value={bName}>
                              {bName}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase">Assigned Instructor / Teacher *</Label>
                    <Select
                      value={createForm.instructor_name}
                      onValueChange={(v) => setCreateForm({ ...createForm, instructor_name: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Instructor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Course Faculty">👨‍🏫 Lead Course Faculty</SelectItem>
                        {staffList.map((st) => {
                          const sName = st.full_name || st.first_name || st.username || "Staff Member";
                          const desig = st.designation ? ` (${st.designation})` : "";
                          return (
                            <SelectItem key={st.id || sName} value={sName}>
                              {sName} {desig}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {(userRole === "superadmin" || userRole === "admin") ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase">Target Center (SuperAdmin)</Label>
                      <Select
                        value={createForm.center_id}
                        onValueChange={(v) => setCreateForm({ ...createForm, center_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Centers" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">🏢 All Franchise Centers</SelectItem>
                          {centersList.map((ctr: any) => {
                            const cName = ctr.center_name || ctr.name || ctr.institute_name || ctr.owner_name || "Franchise Center";
                            const cCode = ctr.center_code || ctr.code || "";
                            const cId = ctr.id || ctr._id;
                            return (
                              <SelectItem key={cId} value={cId}>
                                {cName} {cCode ? `(${cCode})` : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase">Center Scope</Label>
                      <Input value="Own Franchise Center" disabled className="bg-muted text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Rubric Breakdown & Passing Cutoff Setup */}
                <div className="p-4 bg-card/60 rounded-xl border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5">
                      <Award className="w-4 h-4" /> 360° Evaluation Rubric Split & Passing Cutoff
                    </Label>
                    <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 font-mono">
                      Passing Score: {createForm.passing_marks} Marks
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground font-bold">Experiment Skill</Label>
                      <Input
                        type="number"
                        value={createForm.exp_marks}
                        onChange={(e) => setCreateForm({ ...createForm, exp_marks: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground font-bold">Journal / Report</Label>
                      <Input
                        type="number"
                        value={createForm.journal_marks}
                        onChange={(e) => setCreateForm({ ...createForm, journal_marks: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground font-bold">Viva-Voce Oral</Label>
                      <Input
                        type="number"
                        value={createForm.viva_marks}
                        onChange={(e) => setCreateForm({ ...createForm, viva_marks: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-amber-400 font-bold">Passing Cutoff *</Label>
                      <Input
                        type="number"
                        value={createForm.passing_marks}
                        onChange={(e) => setCreateForm({ ...createForm, passing_marks: e.target.value })}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-right font-mono font-bold text-emerald-400">
                    Total Weightage: {(parseInt(createForm.exp_marks) || 0) + (parseInt(createForm.journal_marks) || 0) + (parseInt(createForm.viva_marks) || 0)} Marks
                  </p>
                </div>

                {/* Delivery Mode & Multi-Media Attachments Vault */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase">Delivery / Lab Execution Mode</Label>
                    <Select
                      value={createForm.delivery_mode}
                      onValueChange={(v) => setCreateForm({ ...createForm, delivery_mode: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="offline_center">🏬 Offline Physical Center Lab</SelectItem>
                        <SelectItem value="online_remote">🌐 Online / Remote Submission</SelectItem>
                        <SelectItem value="hybrid">🔄 Hybrid (Both Remote & Center)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase">PDF Lab Manual</Label>
                      <label className="text-[11px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-1">
                        <Upload className="w-3 h-3" />
                        {uploadingPdf ? "Uploading..." : "📁 Browse File"}
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handlePdfUpload}
                          className="hidden"
                          disabled={uploadingPdf}
                        />
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="https://cloud.com/manual.pdf or upload file"
                        value={createForm.pdf_manual_url}
                        onChange={(e) => setCreateForm({ ...createForm, pdf_manual_url: e.target.value })}
                        className="text-xs"
                      />
                      {uploadingPdf && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase">Demo Video / MP4</Label>
                      <label className="text-[11px] font-bold text-amber-400 hover:underline cursor-pointer flex items-center gap-1">
                        <Upload className="w-3 h-3" />
                        {uploadingVideo ? "Uploading..." : "🎥 Browse Video"}
                        <input
                          type="file"
                          accept="video/*"
                          onChange={handleVideoUpload}
                          className="hidden"
                          disabled={uploadingVideo}
                        />
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="https://youtube.com/watch?v=xxx or upload MP4"
                        value={createForm.video_demo_url}
                        onChange={(e) => setCreateForm({ ...createForm, video_demo_url: e.target.value })}
                        className="text-xs"
                      />
                      {uploadingVideo && <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />}
                    </div>
                  </div>
                </div>

                {/* Starter Code Zip Attachment Row */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase">Starter Code / Resource Zip File (Optional)</Label>
                    <label className="text-[11px] font-bold text-purple-400 hover:underline cursor-pointer flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      {uploadingStarter ? "Uploading..." : "📦 Browse Zip / Code File"}
                      <input
                        type="file"
                        accept=".zip,.rar,.tar,.gz,.py,.java,.js,.cpp,.txt,.pdf"
                        onChange={handleStarterUpload}
                        className="hidden"
                        disabled={uploadingStarter}
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="https://cloud.com/starter.zip or upload resource file from computer"
                      value={createForm.starter_code_url}
                      onChange={(e) => setCreateForm({ ...createForm, starter_code_url: e.target.value })}
                      className="text-xs"
                    />
                    {uploadingStarter && <Loader2 className="w-4 h-4 animate-spin text-purple-400 shrink-0" />}
                  </div>
                </div>

                {/* Detailed Objective & Description */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase">Detailed Lab Description & Objectives</Label>
                  <Textarea
                    placeholder="Write detailed experiment procedure, required tools, safety precautions, and expected student output..."
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    rows={4}
                    className="resize-none"
                  />
                </div>

                {/* Dynamic Viva & Practice Questions Section */}
                <div className="p-4 bg-card/60 rounded-xl border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" /> Viva-Voce & Practice Preparation Questions
                    </Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addVivaQuestion}
                      className="h-7 text-xs font-bold gap-1 border-amber-500/30 text-amber-400"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Add Question
                    </Button>
                  </div>
                  
                  {vivaQuestions.map((q, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground w-6">Q{idx + 1}.</span>
                      <Input
                        placeholder={`Enter Viva Question ${idx + 1}...`}
                        value={q}
                        onChange={(e) => updateVivaQuestion(idx, e.target.value)}
                        className="flex-1 text-xs"
                      />
                      {vivaQuestions.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeVivaQuestion(idx)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setActiveTab("all")}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 font-bold px-6">
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Publish Practical Task
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* TAB 3: SUBMISSIONS & 360° EVALUATION STUDIO */}
        {activeTab === "submissions" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <Card className="rounded-xl border-border">
                <CardContent className="py-4">
                  <p className="text-2xl font-black">{submissions.length}</p>
                  <p className="text-xs text-muted-foreground font-bold uppercase">Total Submissions</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-amber-500/30 bg-amber-500/5">
                <CardContent className="py-4">
                  <p className="text-2xl font-black text-amber-400">
                    {submissions.filter((s) => s.status === "submitted").length}
                  </p>
                  <p className="text-xs text-amber-400 font-bold uppercase">Pending Instructor Review</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-emerald-500/30 bg-emerald-500/5">
                <CardContent className="py-4">
                  <p className="text-2xl font-black text-emerald-400">
                    {submissions.filter((s) => s.status === "approved").length}
                  </p>
                  <p className="text-xs text-emerald-400 font-bold uppercase">Passed & Approved</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-purple-500/30 bg-purple-500/5">
                <CardContent className="py-4">
                  <p className="text-2xl font-black text-purple-400">
                    {submissions.filter((s) => s.status === "in_person_pending").length}
                  </p>
                  <p className="text-xs text-purple-400 font-bold uppercase">Physical Signoff Pending</p>
                </CardContent>
              </Card>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : submissions.length === 0 ? (
              <Card className="rounded-xl border-border">
                <CardContent className="py-14 text-center text-muted-foreground">
                  <Download className="w-12 h-12 mx-auto mb-4 opacity-40" />
                  <p className="font-semibold text-lg">No student submissions received yet.</p>
                  <p className="text-sm mt-1">When students submit digital files, photo proof, or signoff requests, they will appear here.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {submissions.map((sub) => {
                  const isPending = sub.status === "submitted";
                  const isApproved = sub.status === "approved";

                  return (
                    <Card key={sub.id} className="rounded-xl border-border transition-all hover:shadow-md">
                      <CardContent className="py-4 px-5">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
                                {sub.student_name || "Student"} ({sub.roll_no || "N/A"})
                              </Badge>
                              <Badge variant="outline" className="font-mono text-xs">
                                #{sub.experiment_code || "EXP"}
                              </Badge>
                              <h4 className="font-bold text-base text-foreground">{sub.practical_title}</h4>
                            </div>

                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                              <span>Submitted: {new Date(sub.submitted_at).toLocaleString("en-IN")}</span>
                              <span>Type: <strong className="text-foreground uppercase">{sub.submission_type}</strong></span>
                              {sub.evaluator_name && (
                                <span className="text-emerald-400 font-medium">Evaluated By: {sub.evaluator_name}</span>
                              )}
                            </div>

                            {/* Instructor Feedback Snippet */}
                            {sub.instructor_review_remarks && (
                              <p className="text-xs bg-card/60 p-2 rounded border border-border text-muted-foreground italic">
                                "{sub.instructor_review_remarks}"
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isApproved && sub.total_marks_obtained !== undefined && (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs py-1 px-3 font-mono font-bold">
                                ✓ Graded: {sub.total_marks_obtained} Marks
                              </Badge>
                            )}

                            <Button
                              size="sm"
                              variant={isPending ? "default" : "outline"}
                              className={`rounded-lg gap-1.5 font-bold ${
                                isPending ? "bg-amber-600 hover:bg-amber-700 text-white" : ""
                              }`}
                              onClick={() => openEvaluation(sub)}
                            >
                              <Award className="w-3.5 h-3.5" />
                              {isPending ? "Evaluate Submissions (360°)" : "View / Edit Grade"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 360° INSTRUCTOR EVALUATION MODAL */}
      <Dialog open={evalModalOpen} onOpenChange={setEvalModalOpen}>
        <DialogContent className="max-w-xl bg-card text-card-foreground rounded-2xl border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold flex items-center gap-2 text-amber-400">
              <Award className="w-5 h-5" />
              360° Practical Evaluation & Instructor Review
            </DialogTitle>
          </DialogHeader>

          {evalSub && (
            <div className="space-y-4 pt-2">
              <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-1">
                <p className="font-bold text-sm text-foreground">{evalSub.practical_title}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span>Student: <strong className="text-foreground">{evalSub.student_name}</strong></span>
                  <span>Roll: {evalSub.roll_no || "N/A"}</span>
                  <span>Center: {evalSub.center_name || "N/A"}</span>
                </div>
              </div>

              {/* Student Uploaded File Link */}
              {evalSub.file_urls && evalSub.file_urls.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase">Student Submitted File Proof</Label>
                  <div className="flex gap-2 flex-wrap">
                    {evalSub.file_urls.map((url, idx) => (
                      <Button
                        key={idx}
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(url, "_blank")}
                        className="rounded-lg gap-1.5 text-xs text-primary border-primary/30"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Open File #{idx + 1}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Rubric Marks Input */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-card/60 rounded-xl border border-border">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Execution Marks</Label>
                  <Input
                    type="number"
                    value={evalForm.exp_marks}
                    onChange={(e) => setEvalForm({ ...evalForm, exp_marks: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Journal Marks</Label>
                  <Input
                    type="number"
                    value={evalForm.journal_marks}
                    onChange={(e) => setEvalForm({ ...evalForm, journal_marks: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Viva Marks</Label>
                  <Input
                    type="number"
                    value={evalForm.viva_marks}
                    onChange={(e) => setEvalForm({ ...evalForm, viva_marks: e.target.value })}
                  />
                </div>
              </div>

              {/* Remarks */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase">Instructor Review Remarks & Feedback</Label>
                <Textarea
                  placeholder="Enter detailed review comments on student's practical performance, viva Q&A, and journal documentation..."
                  value={evalForm.remarks}
                  onChange={(e) => setEvalForm({ ...evalForm, remarks: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Status Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase">Evaluation Status</Label>
                <Select
                  value={evalForm.status}
                  onValueChange={(v) => setEvalForm({ ...evalForm, status: v })}
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">🟢 Pass & Approve Practical</SelectItem>
                    <SelectItem value="revision_requested">🟡 Request Revision / Resubmit</SelectItem>
                    <SelectItem value="in_person_pending">🔵 Require In-Person Lab Demo Check</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEvalModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEvaluation}
                  disabled={evaluating}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {evaluating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save 360° Evaluation & Marks
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
