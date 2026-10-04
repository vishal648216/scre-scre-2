import { useState, useEffect, useCallback } from "react";
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
  Download,
  Calendar,
  Clock,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Wrench,
  Laptop,
  BookOpen,
  Award,
  Upload,
  AlertCircle,
  FileText,
  UserCheck,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface Practical {
  id: string;
  title: string;
  experiment_code: string;
  subject_name: string;
  course_name?: string;
  instructor_name?: string;
  practical_mode: "physical_lab" | "computer_it" | "hybrid" | string;
  total_marks: number;
  exp_marks: number;
  journal_marks: number;
  viva_marks: number;
  due_date: string;
  pdf_manual_url?: string;
  allow_in_person_signoff?: boolean;
}

interface Submission {
  id: string;
  practical_id: string;
  practical_title?: string;
  experiment_code?: string;
  submission_type: string;
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

const MODE_CONFIG: Record<string, { label: string; icon: any; bg: string }> = {
  physical_lab: {
    label: "Physical Hardware / Workshop Lab",
    icon: Wrench,
    bg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  computer_it: {
    label: "Computer / IT Software Lab",
    icon: Laptop,
    bg: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  },
  hybrid: {
    label: "Theory + Skill Hybrid Lab",
    icon: BookOpen,
    bg: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  },
};

export default function StudentPracticalsPage() {
  const [practicals, setPracticals] = useState<Practical[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"assigned" | "scorecard" | "manuals">("assigned");

  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [activePrac, setActivePrac] = useState<Practical | null>(null);
  const [subForm, setSubForm] = useState({
    submission_type: "file_upload",
    file_url: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploadingStudentFile, setUploadingStudentFile] = useState(false);

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

  const handleStudentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingStudentFile(true);
    toast.info("Uploading file from your device...");
    try {
      const url = await uploadFileToServer(file);
      if (url) {
        setSubForm((prev) => ({ ...prev, file_url: url }));
        toast.success("✅ File uploaded successfully!");
      } else {
        toast.error("Failed to upload file");
      }
    } catch {
      toast.error("Error uploading file");
    } finally {
      setUploadingStudentFile(false);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pracRes, subRes] = await Promise.all([
        apiFetch("/api/practicals"),
        apiFetch("/api/practicals/submissions"),
      ]);

      if (pracRes.ok) {
        const d = await pracRes.json();
        setPracticals(d.practicals || []);
      }
      if (subRes.ok) {
        const d = await subRes.json();
        setSubmissions(d.submissions || []);
      }
    } catch {
      toast.error("Failed to load practical assignments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Submit Modal
  const openSubmitModal = (prac: Practical) => {
    setActivePrac(prac);
    const existing = submissions.find((s) => s.practical_id === prac.id);
    setSubForm({
      submission_type: existing?.submission_type || "file_upload",
      file_url: existing?.file_urls?.[0] || "",
      notes: existing?.student_notes || "",
    });
    setSubmitModalOpen(true);
  };

  // Submit Practical Task
  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePrac) return;

    if (subForm.submission_type !== "in_person_signoff" && !subForm.file_url.trim()) {
      toast.error("Please enter a valid File URL or Photo Proof Link!");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        submission_type: subForm.submission_type,
        file_urls: subForm.file_url ? [subForm.file_url.trim()] : [],
        student_notes: subForm.notes,
      };

      const res = await apiFetch(`/api/practicals/${activePrac.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("✅ Practical Submitted for Instructor Evaluation!");
        setSubmitModalOpen(false);
        fetchData();
      } else {
        toast.error(data.message || "Failed to submit work");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
        {/* Banner */}
        <div className="bg-card/40 p-6 rounded-xl border border-border">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/20 text-primary border-primary/30 uppercase tracking-widest text-[10px] font-bold">
              Student Lab & Skill Portal
            </Badge>
            <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
              ✓ Direct Faculty Evaluation
            </Badge>
          </div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight mt-1">
            Practical Assignments & Skill Scorecard
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            View assigned lab practicals, upload digital files/photo proof, or request in-person center signoffs.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-border pb-1 overflow-x-auto">
          {[
            { key: "assigned", label: `Assigned Practicals (${practicals.length})` },
            { key: "scorecard", label: `My Scorecard & Feedback (${submissions.length})` },
            { key: "manuals", label: "Lab Manuals Vault" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${
                activeTab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB 1: ASSIGNED PRACTICALS */}
        {activeTab === "assigned" && (
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : practicals.length === 0 ? (
              <Card className="rounded-xl border-border">
                <CardContent className="py-14 text-center text-muted-foreground">
                  <FlaskConical className="w-12 h-12 mx-auto mb-4 opacity-40" />
                  <p className="font-semibold text-lg">No assigned practicals currently.</p>
                  <p className="text-sm mt-1">Your center instructors will publish new lab tasks here.</p>
                </CardContent>
              </Card>
            ) : (
              practicals.map((prac) => {
                const modeCfg = MODE_CONFIG[prac.practical_mode] || MODE_CONFIG.physical_lab;
                const ModeIcon = modeCfg.icon;
                const existingSub = submissions.find((s) => s.practical_id === prac.id);

                return (
                  <Card key={prac.id} className="rounded-xl border-border transition-all hover:border-primary/40">
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
                            {prac.instructor_name && (
                              <span className="text-amber-400 font-medium">Instructor: {prac.instructor_name}</span>
                            )}
                            <span className="flex items-center gap-1 font-medium">
                              <Calendar className="w-3.5 h-3.5" />
                              Due: {new Date(prac.due_date).toLocaleDateString("en-IN")}
                            </span>
                          </div>

                          {/* Marks Rubric Breakdown */}
                          <div className="flex items-center gap-2 text-[11px] flex-wrap pt-1">
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
                              Total Weightage: {prac.total_marks} Marks
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {prac.pdf_manual_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(prac.pdf_manual_url, "_blank")}
                              className="rounded-lg gap-1 text-xs"
                            >
                              <Download className="w-3.5 h-3.5" /> Manual PDF
                            </Button>
                          )}

                          <Button
                            size="sm"
                            onClick={() => openSubmitModal(prac)}
                            className={`rounded-lg gap-1.5 font-bold ${
                              existingSub ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-primary hover:bg-primary/90"
                            }`}
                          >
                            <Upload className="w-3.5 h-3.5" />
                            {existingSub ? "Update Submission" : "Submit Work"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: MY SCORECARD & TEACHER FEEDBACK */}
        {activeTab === "scorecard" && (
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : submissions.length === 0 ? (
              <Card className="rounded-xl border-border">
                <CardContent className="py-14 text-center text-muted-foreground">
                  <Award className="w-12 h-12 mx-auto mb-4 opacity-40" />
                  <p className="font-semibold text-lg">No graded scorecard yet.</p>
                  <p className="text-sm mt-1">Once your instructor evaluates your lab submissions, your grades & feedback will appear here.</p>
                </CardContent>
              </Card>
            ) : (
              submissions.map((sub) => {
                const isApproved = sub.status === "approved";

                return (
                  <Card key={sub.id} className="rounded-xl border-border transition-all hover:shadow-md">
                    <CardContent className="py-5 px-6 space-y-3">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
                              #{sub.experiment_code || "EXP"}
                            </Badge>
                            <h3 className="font-bold text-base text-foreground">{sub.practical_title}</h3>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Submitted on: {new Date(sub.submitted_at).toLocaleString("en-IN")} • Mode: <span className="uppercase font-bold">{sub.submission_type}</span>
                          </p>
                        </div>

                        <div>
                          {isApproved ? (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs py-1 px-3 font-bold">
                              ✓ Passed & Approved
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              ⏳ Pending Faculty Evaluation
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Marks Breakdown Grid */}
                      {isApproved && sub.total_marks_obtained !== undefined && (
                        <div className="p-3 bg-card/60 rounded-xl border border-border space-y-2">
                          <div className="flex items-center justify-between text-xs border-b border-border/60 pb-2">
                            <span className="font-black text-amber-400 uppercase tracking-wide">360° Scorecard Breakdown</span>
                            <span className="font-mono font-extrabold text-emerald-400 text-sm">
                              Total: {sub.total_marks_obtained} Marks
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                            <div className="p-2 bg-blue-500/5 rounded border border-blue-500/20 text-center">
                              <p className="text-[10px] text-muted-foreground">Experiment Skill</p>
                              <p className="font-bold text-blue-400">{sub.exp_marks_obtained} Marks</p>
                            </div>
                            <div className="p-2 bg-amber-500/5 rounded border border-amber-500/20 text-center">
                              <p className="text-[10px] text-muted-foreground">Journal Quality</p>
                              <p className="font-bold text-amber-400">{sub.journal_marks_obtained} Marks</p>
                            </div>
                            <div className="p-2 bg-purple-500/5 rounded border border-purple-500/20 text-center">
                              <p className="text-[10px] text-muted-foreground">Viva Voce Q&A</p>
                              <p className="font-bold text-purple-400">{sub.viva_marks_obtained} Marks</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Teacher Feedback Comment */}
                      {sub.instructor_review_remarks && (
                        <div className="p-3 bg-card/40 rounded-xl border border-border space-y-1 text-xs">
                          <p className="font-bold text-amber-400 flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5" /> Faculty Instructor Review & Feedback:
                          </p>
                          <p className="text-muted-foreground italic pl-4">
                            "{sub.instructor_review_remarks}"
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* TAB 3: LAB MANUALS VAULT */}
        {activeTab === "manuals" && (
          <div className="space-y-3">
            {practicals.filter((p) => p.pdf_manual_url).length === 0 ? (
              <Card className="rounded-xl border-border">
                <CardContent className="py-14 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-40" />
                  <p className="font-semibold text-lg">No downloadable manuals available.</p>
                </CardContent>
              </Card>
            ) : (
              practicals
                .filter((p) => p.pdf_manual_url)
                .map((prac) => (
                  <Card key={prac.id} className="rounded-xl border-border">
                    <CardContent className="py-4 px-5 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-base text-foreground">{prac.title} (Manual PDF)</h4>
                        <p className="text-xs text-muted-foreground">Subject: {prac.subject_name}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(prac.pdf_manual_url, "_blank")}
                        className="rounded-lg gap-1.5 text-xs text-primary border-primary/30"
                      >
                        <Download className="w-3.5 h-3.5" /> Download Manual
                      </Button>
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        )}
      </div>

      {/* SUBMIT WORK MODAL */}
      <Dialog open={submitModalOpen} onOpenChange={setSubmitModalOpen}>
        <DialogContent className="max-w-md bg-card text-card-foreground rounded-2xl border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold flex items-center gap-2 text-primary">
              <Upload className="w-5 h-5" />
              Submit Practical Work / Request Signoff
            </DialogTitle>
          </DialogHeader>

          {activePrac && (
            <form onSubmit={handleSubmitWork} className="space-y-4 pt-2">
              <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-1">
                <p className="font-bold text-sm">{activePrac.title}</p>
                <p className="text-xs text-muted-foreground">
                  Exp Code: #{activePrac.experiment_code} • Subject: {activePrac.subject_name}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase">Submission Method</Label>
                <Select
                  value={subForm.submission_type}
                  onValueChange={(v) => setSubForm({ ...subForm, submission_type: v })}
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="file_upload">📁 Upload Digital Project / PDF File</SelectItem>
                    <SelectItem value="photo_proof">📸 Upload Physical Hardware Photo/Video Proof</SelectItem>
                    <SelectItem value="in_person_signoff">🏬 Request In-Person Center Lab Evaluation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {subForm.submission_type !== "in_person_signoff" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase">Project File / Photo Proof *</Label>
                    <label className="text-[11px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingStudentFile ? "Uploading..." : "📁 Browse Device File"}
                      <input
                        type="file"
                        accept="image/*,video/*,.pdf,.zip,.doc,.docx,.txt"
                        onChange={handleStudentFileUpload}
                        className="hidden"
                        disabled={uploadingStudentFile}
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="https://drive.google.com/file... or upload device file above"
                      value={subForm.file_url}
                      onChange={(e) => setSubForm({ ...subForm, file_url: e.target.value })}
                      required
                    />
                    {uploadingStudentFile && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Upload file directly from your phone/computer or paste Google Drive/PDF link.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase">Student Notes (Optional)</Label>
                <Textarea
                  placeholder="Enter any comments or execution details for your instructor..."
                  value={subForm.notes}
                  onChange={(e) => setSubForm({ ...subForm, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setSubmitModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="bg-primary hover:bg-primary/90 font-bold">
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Submit Work to Instructor
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
