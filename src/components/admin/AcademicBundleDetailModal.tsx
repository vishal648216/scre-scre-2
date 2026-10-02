import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, 
  Layers, 
  IndianRupee, 
  Clock, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileText, 
  Calendar, 
  GraduationCap, 
  BookMarked,
  Check,
  X,
  Loader2,
  Sparkles,
  Link as LinkIcon,
  ShieldCheck,
  Award,
  Users,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  Hash
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { courseTypeLabel, formatCourseDuration, stripHtml } from "@/lib/courseDisplay";
import { cn } from "@/lib/utils";

interface AcademicBundleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: any;
  onApprove?: (courseId: string) => void;
  onReject?: (course: any) => void;
  isSuperAdmin?: boolean;
  isActionPending?: boolean;
}

const toId = (v: any): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v.$oid) return v.$oid;
  return String(v);
};

export function AcademicBundleDetailModal({
  isOpen,
  onClose,
  course,
  onApprove,
  onReject,
  isSuperAdmin = false,
  isActionPending = false,
}: AcademicBundleDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [mappedSubjects, setMappedSubjects] = useState<any[]>([]);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [batchStudentsMap, setBatchStudentsMap] = useState<Record<string, any[]>>({});
  const [courseStudents, setCourseStudents] = useState<any[]>([]);
  const [studyMaterials, setStudyMaterials] = useState<any[]>([]);
  const [categoryName, setCategoryName] = useState<string>("");
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});

  const courseId = course?.id || course?._id || "";

  useEffect(() => {
    if (isOpen && courseId) {
      fetchBundleDetails();
    }
  }, [isOpen, courseId]);

  const toggleBatchExpand = (bId: string) => {
    setExpandedBatches((prev) => ({ ...prev, [bId]: !prev[bId] }));
  };

  const fetchBundleDetails = async () => {
    setLoading(true);
    try {
      const [
        mappingsRes, 
        subjectsRes, 
        batchesRes, 
        sessionsRes, 
        studentsRes, 
        materialsRes, 
        categoriesRes
      ] = await Promise.all([
        apiFetch(`/api/academic/course-subjects/${courseId}`).catch(() => null),
        apiFetch("/api/admin/subjects").catch(() => null),
        apiFetch("/api/batches").catch(() => null),
        apiFetch("/api/academic/sessions").catch(() => null),
        apiFetch("/api/students").catch(() => null),
        apiFetch("/api/academic/study-materials").catch(() => null),
        apiFetch("/api/admin/categories").catch(() => null),
      ]);

      const mappingsData = mappingsRes && mappingsRes.ok ? await mappingsRes.json() : [];
      const subjectsData = subjectsRes && subjectsRes.ok ? await subjectsRes.json() : {};
      const batchesData = batchesRes && batchesRes.ok ? await batchesRes.json() : [];
      const sessionsData = sessionsRes && sessionsRes.ok ? await sessionsRes.json() : [];
      const studentsData = studentsRes && studentsRes.ok ? await studentsRes.json() : [];
      const materialsData = materialsRes && materialsRes.ok ? await materialsRes.json() : [];
      const categoriesData = categoriesRes && categoriesRes.ok ? await categoriesRes.json() : {};

      const subList = subjectsData.items || subjectsData || [];
      setAllSubjects(subList);

      // Resolve mapped subjects
      const mappedList = (Array.isArray(mappingsData) ? mappingsData : []).map((m: any) => {
        const sub = subList.find((s: any) => toId(s.id || s._id) === toId(m.subject_id));
        return {
          ...m,
          subject_name: sub?.subject_name || sub?.name || "Subject Module",
          subject_code: sub?.subject_code || sub?.code || "SUB",
          description: sub?.description || "",
        };
      }).sort((a: any, b: any) => (a.subject_order || 0) - (b.subject_order || 0));

      setMappedSubjects(mappedList);

      // Resolve Sessions & Matching Batch IDs
      const sessList = Array.isArray(sessionsData) ? sessionsData : [];
      setSessions(sessList);
      const targetCourseId = toId(courseId);
      const targetCourseName = (course?.course_name || course?.name || "").toLowerCase().trim();

      const matchingSessionIds = new Set(
        sessList
          .filter((s: any) => {
            const sCourseId = toId(s.course_id || s.course);
            const sCourseName = (s.course_name || "").toLowerCase().trim();
            return sCourseId === targetCourseId || (targetCourseName && sCourseName === targetCourseName);
          })
          .map((s: any) => toId(s.id || s._id))
      );

      // Filter batches for this course
      const rawBatches = Array.isArray(batchesData) ? batchesData : [];
      let courseBatches = rawBatches.filter((b: any) => {
        const bCourseId = toId(b.course_id || b.course);
        const bSessionId = toId(b.session_id);
        const bCourseName = (b.course_name || "").toLowerCase().trim();

        return (
          (bCourseId && bCourseId === targetCourseId) ||
          (bSessionId && matchingSessionIds.has(bSessionId)) ||
          (targetCourseName && bCourseName && bCourseName === targetCourseName)
        );
      });

      // Fallback: If no batch matched strictly but center owns batches
      if (courseBatches.length === 0 && course?.created_by_center_id) {
        const centerId = toId(course.created_by_center_id);
        courseBatches = rawBatches.filter((b: any) => toId(b.center_id) === centerId);
      }

      setBatches(courseBatches);

      // Process students
      const rawStudents = Array.isArray(studentsData) ? studentsData : (studentsData.items || []);
      const batchIdSet = new Set(courseBatches.map((b: any) => toId(b._id || b.id)));

      const courseStuds = rawStudents.filter((s: any) => {
        const sCourseId = toId(s.course_id || s.course);
        const sBatchId = toId(s.batch_id);
        return sCourseId === targetCourseId || batchIdSet.has(sBatchId);
      });
      setCourseStudents(courseStuds);

      // Build batch students mapping
      const bStudentsMap: Record<string, any[]> = {};
      const expandedMap: Record<string, boolean> = {};

      for (const b of courseBatches) {
        const bId = toId(b._id || b.id);
        expandedMap[bId] = true; // expanded by default
        const assigned = rawStudents.filter((s: any) => toId(s.batch_id) === bId);
        bStudentsMap[bId] = assigned;
      }
      setExpandedBatches(expandedMap);

      // Fetch batch-students link for each batch to combine any link collection records
      await Promise.all(
        courseBatches.map(async (b: any) => {
          const bId = toId(b._id || b.id);
          if (!bId) return;
          try {
            const res = await apiFetch(`/api/batch-students/batch/${bId}`);
            if (res.ok) {
              const links = await res.json();
              if (Array.isArray(links) && links.length > 0) {
                const linkStudentIds = new Set(links.map((l: any) => toId(l.student_id)));
                const linkedStuds = rawStudents.filter((s: any) => linkStudentIds.has(toId(s.id || s._id)));
                const existingMap = new Map((bStudentsMap[bId] || []).map((s: any) => [toId(s.id || s._id), s]));
                linkedStuds.forEach((s: any) => existingMap.set(toId(s.id || s._id), s));
                bStudentsMap[bId] = Array.from(existingMap.values());
              }
            }
          } catch (e) {
            // ignore network errors
          }
        })
      );

      setBatchStudentsMap(bStudentsMap);

      // Filter study materials for this course
      const courseMaterials = (Array.isArray(materialsData) ? materialsData : []).filter(
        (m: any) => toId(m.course_id || m.course) === targetCourseId
      );
      setStudyMaterials(courseMaterials);

      // Resolve category name
      const catList = categoriesData.items || categoriesData || [];
      const catId = toId(course.category_id || course.category);
      const cat = catList.find((c: any) => toId(c.id || c._id) === catId || c.name === catId);
      if (cat) {
        setCategoryName(`${cat.name}${cat.category_code ? ` [${cat.category_code}]` : ''}`);
      } else {
        setCategoryName(course.category || "General Stream");
      }
    } catch (err) {
      console.error("Error fetching course bundle details:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!course) return null;

  const getStatus = (): "pending" | "approved" | "rejected" => {
    if (course.approval_status === "approved" || course.approval_status === "rejected" || course.approval_status === "pending") {
      return course.approval_status;
    }
    if (course.status === "active") return "approved";
    if (course.status === "rejected") return "rejected";
    return "pending";
  };

  const status = getStatus();

  // Aggregate seat stats
  const totalCapacity = batches.reduce((acc, b) => acc + Number(b.max_capacity || b.capacity || 30), 0);
  const totalOccupied = batches.reduce((acc, b) => {
    const bId = toId(b._id || b.id);
    const enrolled = (batchStudentsMap[bId] || []).length;
    return acc + Math.max(Number(b.current_count || 0), enrolled);
  }, 0);
  const totalRemaining = Math.max(0, totalCapacity - totalOccupied);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-3xl border border-indigo-500/30 bg-slate-950/95 backdrop-blur-3xl text-slate-100 max-w-4xl max-h-[90vh] flex flex-col shadow-2xl p-6 sm:p-8 z-[100]">
        
        {/* Header */}
        <DialogHeader className="border-b border-slate-800/80 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="font-mono text-xs font-bold uppercase bg-indigo-500/10 text-indigo-300 border-indigo-500/30">
                  {course.course_code || course.code || "CRS-BUNDLE"}
                </Badge>
                {course.short_code && (
                  <Badge variant="secondary" className="font-mono text-xs bg-slate-800 text-slate-300">
                    [{course.short_code}]
                  </Badge>
                )}
                <Badge className="bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs capitalize">
                  {courseTypeLabel(course.course_type)}
                </Badge>
              </div>

              <DialogTitle className="font-heading font-black text-2xl text-white uppercase tracking-tight flex items-center gap-2 mt-1">
                <BookOpen className="w-6 h-6 text-indigo-400 shrink-0" />
                {course.course_name || course.name}
              </DialogTitle>
            </div>

            {/* Approval Status Badge */}
            <div className="shrink-0">
              {status === "pending" && (
                <span className="px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-lg">
                  <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                  Pending Approval
                </span>
              )}
              {status === "approved" && (
                <span className="px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shadow-lg">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Authorized & Live
                </span>
              )}
              {status === "rejected" && (
                <span className="px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 bg-rose-500/20 border border-rose-500/40 text-rose-300 shadow-lg">
                  <XCircle className="w-4 h-4 text-rose-400" />
                  Rejected Proposal
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto pr-2 py-4 space-y-6">
          
          {/* Franchise Proposer Banner */}
          <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-purple-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Proposing Franchise Partner</p>
                <h4 className="text-sm font-extrabold text-white">
                  {course.created_by_center_name || course.requested_by_center_name || "Franchise Partner"}
                </h4>
              </div>
            </div>
            {course.created_at && (
              <span className="text-xs font-mono text-slate-400 bg-slate-900/80 px-3 py-1 rounded-xl border border-slate-800">
                Submitted: {new Date(course.created_at || course.requested_at).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Rejection Reason Notice */}
          {status === "rejected" && course.rejection_reason && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 space-y-1">
              <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-rose-400">
                <AlertTriangle className="w-4 h-4" /> Rejection Feedback from Super Admin:
              </div>
              <p className="leading-relaxed pl-6">{course.rejection_reason}</p>
            </div>
          )}

          {/* 1. Basic Academic & Fee Structure */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 border-b border-slate-800/80 pb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              1. Course & Fee Breakdown
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Stream Category</span>
                <span className="font-bold text-xs text-slate-200 mt-1 block truncate">{categoryName}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Duration</span>
                <span className="font-bold text-xs text-slate-200 mt-1 block">{formatCourseDuration(course)}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Course Fee</span>
                <span className="font-extrabold text-sm text-emerald-400 mt-1 block">
                  ₹{(course.fees ?? course.total_fee ?? course.total_fees ?? 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Admission Fee</span>
                <span className="font-bold text-xs text-slate-200 mt-1 block">
                  ₹{(course.registration_fee ?? course.admission_fee ?? 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Exam Fee & Unit Structure Extra */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {course.exam_fees_applicable && (
                <div className="p-3 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Exam Fee Applicable:</span>
                  <span className="font-bold text-indigo-300">₹{(course.exam_fee_amount || 0).toLocaleString("en-IN")}</span>
                </div>
              )}
              {course.backlog_fees_applicable && (
                <div className="p-3 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Backlog Fee Amount:</span>
                  <span className="font-bold text-purple-300">₹{(course.backlog_fee_amount || 0).toLocaleString("en-IN")}</span>
                </div>
              )}
              {course.has_course_structure_units && (
                <div className="p-3 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center justify-between text-xs sm:col-span-2">
                  <span className="text-slate-400 font-medium">Program Units & Terms:</span>
                  <span className="font-bold text-indigo-300 uppercase">
                    {course.unit_count || 1} {course.unit_type || "Units"} ({course.custom_unit_name || course.unit_type})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 2. Mapped Subjects & Curriculum */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                2. Mapped Academic Subjects ({mappedSubjects.length})
              </h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Curriculum Modules</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-6 gap-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> Fetching linked subjects...
              </div>
            ) : mappedSubjects.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-center">
                <p className="text-xs text-slate-400 italic">No specific subjects mapped to this course yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mappedSubjects.map((m: any, idx: number) => (
                  <div key={m.id || idx} className="p-3.5 rounded-2xl bg-slate-900/90 border border-indigo-500/20 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      {m.subject_order || idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h5 className="font-extrabold text-xs text-white uppercase truncate">{m.subject_name}</h5>
                        <code className="text-[10px] font-mono font-bold bg-slate-950 px-2 py-0.5 rounded text-indigo-300 border border-slate-800">
                          {m.subject_code}
                        </code>
                      </div>
                      {m.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-1">{stripHtml(m.description)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Batches & Academic Sessions & Student Seats */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/80 pb-2 gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                3. Batches & Student Seats ({batches.length} Batches)
              </h3>
              {batches.length > 0 && (
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="text-slate-400">Total Seats:</span>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                    {totalOccupied} / {totalCapacity} Occupied
                  </Badge>
                  <Badge variant="outline" className="bg-indigo-500/10 text-indigo-300 border-indigo-500/30">
                    {totalRemaining} Free
                  </Badge>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-6 gap-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> Fetching batches and seat allocations...
              </div>
            ) : batches.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-center space-y-2">
                <Calendar className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No active batches created for this course yet.</p>
                <p className="text-[11px] text-slate-500">Batches can be created under Academic Sessions to allocate seat capacities and assign students.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {batches.map((b: any, idx: number) => {
                  const bId = toId(b._id || b.id);
                  const enrolledList = batchStudentsMap[bId] || [];
                  const capacity = Number(b.max_capacity || b.capacity || 30);
                  const occupiedCount = Math.max(Number(b.current_count || 0), enrolledList.length);
                  const freeSeats = Math.max(0, capacity - occupiedCount);
                  const fillPercentage = Math.min(100, Math.round((occupiedCount / Math.max(1, capacity)) * 100));
                  const isExpanded = expandedBatches[bId] ?? true;

                  // Find session name if present
                  const sess = sessions.find((s: any) => toId(s.id || s._id) === toId(b.session_id));
                  const sessionName = sess?.session_name || b.session_name || "Academic Session";

                  return (
                    <div key={bId || idx} className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-lg transition-all">
                      
                      {/* Batch Header */}
                      <div className="p-4 bg-slate-900/95 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-sm text-white uppercase flex items-center gap-2">
                              <Users className="w-4 h-4 text-emerald-400" />
                              {b.name || b.batch_name}
                            </h4>
                            <Badge variant="outline" className="text-[10px] font-mono bg-slate-950 text-indigo-300 border-slate-800">
                              {b.code || b.batch_code || "BATCH"}
                            </Badge>
                            <Badge className="bg-slate-800 text-slate-300 text-[10px]">
                              {sessionName}
                            </Badge>
                          </div>
                          {b.time_slot && (
                            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" /> Timing: {b.time_slot}
                              {Array.isArray(b.days) && b.days.length > 0 && (
                                <span className="text-slate-500 font-mono ml-2">({b.days.join(", ")})</span>
                              )}
                            </p>
                          )}
                        </div>

                        {/* Seat Occupancy Pill */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="text-xs font-black text-white">
                              {occupiedCount} / {capacity} <span className="text-[10px] font-bold text-slate-400">Seats</span>
                            </div>
                            <span className={cn(
                              "text-[10px] font-bold uppercase tracking-wider block",
                              freeSeats > 0 ? "text-emerald-400" : "text-rose-400"
                            )}>
                              {freeSeats > 0 ? `${freeSeats} Seats Free` : "Batch Full"}
                            </span>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleBatchExpand(bId)}
                            className="h-8 px-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-950 h-1.5 overflow-hidden">
                        <div 
                          className={cn(
                            "h-full transition-all duration-500",
                            fillPercentage >= 100 ? "bg-rose-500" : fillPercentage > 80 ? "bg-amber-500" : "bg-emerald-500"
                          )}
                          style={{ width: `${fillPercentage}%` }}
                        />
                      </div>

                      {/* Body: Enrolled Students List */}
                      {isExpanded && (
                        <div className="p-4 space-y-3 bg-slate-950/40">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                              Enrolled Students Roster ({enrolledList.length})
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              Capacity Filled: {fillPercentage}%
                            </span>
                          </div>

                          {enrolledList.length === 0 ? (
                            <div className="p-3.5 rounded-xl bg-slate-900/50 border border-dashed border-slate-800 text-center">
                              <p className="text-xs text-slate-400 italic">No students currently assigned to this batch.</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {enrolledList.map((s: any, sIdx: number) => {
                                const sName = s.full_name || s.name || s.username || "Student";
                                const sEnroll = s.enrollment_number || s.roll_number || s.student_id || `STD-${sIdx + 1}`;
                                const sEmail = s.email || "";
                                const sPhone = s.phone || "";

                                return (
                                  <div key={s.id || s._id || sIdx} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-extrabold text-xs flex items-center justify-center shrink-0 uppercase">
                                        {sName.substring(0, 2)}
                                      </div>
                                      <div className="min-w-0">
                                        <h6 className="font-extrabold text-xs text-white uppercase truncate">{sName}</h6>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                                          <span>Reg: {sEnroll}</span>
                                          {sPhone && <span className="truncate">| 📞 {sPhone}</span>}
                                        </div>
                                      </div>
                                    </div>
                                    <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] uppercase shrink-0">
                                      Active
                                    </Badge>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Eligibility & Overview */}
          {(course.eligibility || course.description || course.syllabus) && (
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 border-b border-slate-800/80 pb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                4. Overview, Eligibility & Syllabus
              </h3>

              {course.eligibility && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Student Eligibility Criteria</span>
                  <p className="text-xs text-slate-200 bg-slate-900/90 p-3 rounded-2xl border border-slate-800">
                    {course.eligibility}
                  </p>
                </div>
              )}

              {course.description && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Description</span>
                  <p className="text-xs text-slate-300 bg-slate-900/90 p-3 rounded-2xl border border-slate-800 leading-relaxed">
                    {stripHtml(course.description)}
                  </p>
                </div>
              )}

              {course.syllabus && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Detailed Syllabus (Markdown)</span>
                  <pre className="text-xs font-mono text-slate-300 bg-slate-950 p-3.5 rounded-2xl border border-slate-800 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {course.syllabus}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="border-t border-slate-800/80 pt-4 flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-2xl border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold w-full sm:w-auto"
          >
            Close Details
          </Button>

          {/* Super Admin Approval Action Buttons */}
          {isSuperAdmin && status === "pending" && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => onReject && onReject(course)}
                disabled={isActionPending}
                className="rounded-2xl border-rose-500/40 text-rose-400 hover:bg-rose-950/30 text-xs font-bold gap-1.5 flex-1 sm:flex-none"
              >
                <X className="w-4 h-4" />
                Reject Proposal
              </Button>
              <Button
                onClick={() => onApprove && onApprove(courseId)}
                disabled={isActionPending}
                className="rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1.5 shadow-lg flex-1 sm:flex-none"
              >
                <Check className="w-4 h-4" />
                {isActionPending ? "Approving..." : "Approve Course"}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

