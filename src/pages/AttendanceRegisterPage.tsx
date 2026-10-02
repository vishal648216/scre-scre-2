import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Calendar as CalendarIcon,
  User,
  Search,
  Loader2,
  Save,
  Lock,
  ShieldAlert,
  Building2,
  BookOpen,
  Sparkles,
  Users,
  Upload,
  Download,
  FileSpreadsheet,
  CheckSquare,
  Square,
  X
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { getServerNow } from "@/lib/time";
import { apiFetch } from "@/lib/api";

type AttendanceStatus = "present" | "absent" | "late" | "leave";

interface Student {
  _id: string | { $oid: string };
  username: string;
  fullName?: string;
  course?: string;
  center_name?: string;
  center_id?: string | { $oid: string };
  parent_id?: string | { $oid: string };
  rollNo?: string;
}

interface Center {
  _id: string | { $oid: string };
  center_name?: string;
  name?: string;
  code?: string;
}

const toId = (v: any): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    if ("$oid" in v) return String(v.$oid);
    if ("_id" in v) return toId(v._id);
    if ("id" in v) return toId(v.id);
  }
  return String(v || "");
};

const getStudentId = (s: Student): string => {
  return toId((s as any)._id || (s as any).id || (s as any).user_id);
};

const AttendanceRegisterPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(format(getServerNow(), "yyyy-MM-dd"));
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [selectedCenter, setSelectedCenter] = useState<string>("all");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<{ username: string; status: AttendanceStatus; matchedName?: string }[]>([]);
  const [isLocked, setIsLocked] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  const role = (user.role || "").toLowerCase().replace(" ", "");
  const isAdmin = role === "admin" || role === "superadmin";

  useEffect(() => {
    fetchInitialData();
  }, [selectedDate, selectedCenter]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [studentRes, centerRes] = await Promise.all([
        apiFetch("/api/students"),
        isAdmin ? apiFetch("/api/centers") : Promise.resolve({ ok: false, json: async () => [] })
      ]);

      if (studentRes.ok) setStudents(await studentRes.json());
      if (centerRes.ok) setCenters(await centerRes.json());

      await fetchExistingAttendance();
    } catch (error) {
      console.error("Error fetching attendance register data:", error);
      toast.error("Failed to load attendance register data");
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingAttendance = async () => {
    try {
      setIsLocked(false);
      setAttendance({});

      const centerParam = selectedCenter !== "all" ? `&center_id=${selectedCenter}` : "";
      const response = await apiFetch(
        `/api/attendance?date=${selectedDate}${centerParam}`
      );

      const attendanceMap: Record<string, AttendanceStatus> = {};

      if (response && response.ok) {
        const data = await response.json();
        if (data && typeof data === "object" && "is_locked" in data) {
          setIsLocked(Boolean(data.is_locked));
          const records = data.records || [];
          records.forEach((record: any) => {
            const sId = toId(record.student_id);
            if (sId) attendanceMap[sId] = record.status as AttendanceStatus;
          });
        } else if (Array.isArray(data)) {
          setIsLocked(false);
          data.forEach((record: any) => {
            const sId = toId(record.student_id);
            if (sId) attendanceMap[sId] = record.status as AttendanceStatus;
          });
        }
      }

      setAttendance(attendanceMap);
    } catch (error) {
      console.error("Error fetching existing attendance:", error);
    }
  };

  // Instant Row Status Change (Single Candidate)
  const handleStatusChange = async (studentId: string, status: AttendanceStatus) => {
    if (isLocked) {
      toast.error(`Attendance for ${selectedDate} is locked! Contact SuperAdmin to edit.`);
      return;
    }

    // 1. Update state & local snapshot immediately
    setAttendance((prev) => {
      const nextMap = { ...prev, [studentId]: status };
      localStorage.setItem(`scre_student_attendance_${selectedDate}`, JSON.stringify(nextMap));
      return nextMap;
    });

    // 2. Silent background sync to API
    try {
      const s = students.find((st) => toId(st._id) === studentId);
      const record = {
        student_id: studentId,
        status,
        date: selectedDate,
        center_id: s ? toId(s.center_id || s.parent_id) : (selectedCenter !== "all" ? selectedCenter : undefined)
      };

      await apiFetch("/api/attendance/bulk", {
        method: "POST",
        body: JSON.stringify({ records: [record] })
      }).catch(() => null);
    } catch {
      // Do NOT revert local state on background sync error to prevent button resets
    }
  };

  // Checkbox Selection Logic
  const toggleSelectStudent = (sId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(sId)) {
        next.delete(sId);
      } else {
        next.add(sId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedStudentIds.size === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(filteredStudents.map((s) => toId(s._id))));
    }
  };

  // Bulk Action on Selected Candidates
  const applyBulkStatus = async (targetStatus: AttendanceStatus) => {
    if (isLocked) {
      toast.error(`Attendance for ${selectedDate} is locked! Contact SuperAdmin to edit.`);
      return;
    }

    if (selectedStudentIds.size === 0) {
      toast.error("Please select candidate(s) using the checkboxes first.");
      return;
    }

    const idsToUpdate = Array.from(selectedStudentIds);
    setSaving(true);
    try {
      let newAttendanceMap: Record<string, AttendanceStatus> = {};
      setAttendance((prev) => {
        newAttendanceMap = { ...prev };
        idsToUpdate.forEach((sId) => {
          newAttendanceMap[sId] = targetStatus;
        });
        localStorage.setItem(`scre_student_attendance_${selectedDate}`, JSON.stringify(newAttendanceMap));
        return newAttendanceMap;
      });

      const recordsToPost = idsToUpdate.map((sId) => {
        const s = students.find((st) => toId(st._id) === sId);
        return {
          student_id: sId,
          status: targetStatus,
          date: selectedDate,
          center_id: s ? toId(s.center_id || s.parent_id) : undefined
        };
      });

      await apiFetch("/api/attendance/bulk", {
        method: "POST",
        body: JSON.stringify({ records: recordsToPost })
      }).catch(() => null);

      toast.success(`Marked ${idsToUpdate.length} candidate(s) as ${targetStatus.toUpperCase()}`);
      setSelectedStudentIds(new Set());
    } catch {
      toast.error("An error occurred during bulk operation");
    } finally {
      setSaving(false);
    }
  };

  // Save & Lock Daily Register in MongoDB
  const handleSaveAttendance = async () => {
    if (isLocked) {
      toast.error(`Attendance for ${selectedDate} is already locked!`);
      return;
    }

    setSaving(true);
    try {
      const recordsToPost = students.map((s) => {
        const sId = getStudentId(s);
        const st = attendance[sId] || "present";
        return {
          student_id: sId,
          status: st,
          date: selectedDate,
          center_id: toId(s.center_id || s.parent_id) || undefined
        };
      });

      let res = await apiFetch("/api/attendance", {
        method: "POST",
        body: JSON.stringify({
          date: selectedDate,
          center_id: selectedCenter !== "all" ? selectedCenter : undefined,
          records: recordsToPost
        })
      }).catch((e) => {
        console.error("apiFetch /api/attendance failed:", e);
        return null;
      });

      let errMessage = "";
      if (res && !res.ok) {
        const errJson = await res.json().catch(() => ({}));
        errMessage = errJson.message || errJson.error || "";
      }

      if (!res || !res.ok) {
        const bulkRes = await apiFetch("/api/attendance/bulk", {
          method: "POST",
          body: JSON.stringify({ records: recordsToPost })
        }).catch(() => null);

        if (bulkRes && bulkRes.ok) {
          res = bulkRes;
        } else if (bulkRes) {
          const bulkErrJson = await bulkRes.json().catch(() => ({}));
          errMessage = bulkErrJson.message || bulkErrJson.error || errMessage;
        }
      }

      if (res && res.ok) {
        setIsLocked(true);
        localStorage.setItem(`scre_student_attendance_${selectedDate}`, JSON.stringify(attendance));
        toast.success(`Student attendance for ${selectedDate} saved & locked successfully!`);
      } else {
        toast.error(errMessage || "Failed to save student attendance to database");
      }
    } catch (error) {
      console.error("Error in handleSaveAttendance:", error);
      toast.error("Network error while saving attendance");
    } finally {
      setSaving(false);
    }
  };

  // CSV / Excel File Importer Parser
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/);
      const parsedRows: { username: string; status: AttendanceStatus; matchedName?: string }[] = [];

      lines.forEach((line) => {
        if (!line.trim()) return;
        const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^["']|["']$/g, ""));
        if (parts.length < 2) return;

        const identifier = parts[0].toLowerCase();
        let rawStatus = parts[1].toLowerCase();

        if (identifier === "username" || identifier === "student_id" || identifier === "roll" || identifier === "roll_no") return;

        let status: AttendanceStatus = "present";
        if (rawStatus === "p" || rawStatus === "present") status = "present";
        else if (rawStatus === "a" || rawStatus === "absent") status = "absent";
        else if (rawStatus === "l" || rawStatus === "late") status = "late";
        else if (rawStatus === "lv" || rawStatus === "leave") status = "leave";

        const matched = students.find(
          (s) =>
            s.username.toLowerCase() === identifier ||
            (s.rollNo || "").toLowerCase() === identifier ||
            (s.fullName || "").toLowerCase() === identifier
        );

        if (matched) {
          parsedRows.push({
            username: matched.username,
            status,
            matchedName: matched.fullName || matched.username
          });
        }
      });

      if (parsedRows.length === 0) {
        toast.error("No matching candidate usernames/rolls found in uploaded file");
      } else {
        setImportPreview(parsedRows);
        toast.success(`Parsed ${parsedRows.length} valid attendance records from file`);
      }
    };
    reader.readAsText(file);
  };

  const confirmImportData = async () => {
    if (importPreview.length === 0) return;
    setSaving(true);
    try {
      const newAttendanceMap = { ...attendance };
      const recordsToPost: any[] = [];

      importPreview.forEach((item) => {
        const candidate = students.find((s) => s.username.toLowerCase() === item.username.toLowerCase());
        if (candidate) {
          const sId = toId(candidate._id);
          newAttendanceMap[sId] = item.status;
          recordsToPost.push({
            student_id: sId,
            status: item.status,
            date: selectedDate,
            center_id: toId(candidate.center_id || candidate.parent_id)
          });
        }
      });

      setAttendance(newAttendanceMap);
      localStorage.setItem(`scre_student_attendance_${selectedDate}`, JSON.stringify(newAttendanceMap));

      const res = await apiFetch("/api/attendance/bulk", {
        method: "POST",
        body: JSON.stringify({ records: recordsToPost })
      });

      if (res && res.ok) {
        toast.success(`Imported ${recordsToPost.length} attendance records successfully!`);
        setIsImportModalOpen(false);
        setImportPreview([]);
      } else {
        toast.error("Failed to save imported attendance");
      }
    } catch {
      toast.error("Error saving imported records");
    } finally {
      setSaving(false);
    }
  };

  // Download CSV Register
  const exportRegisterCSV = () => {
    const headers = ["Student Name", "Username / Roll", "Course", "Center Branch", `Status (${selectedDate})`];
    const rows = filteredStudents.map((s) => {
      const st = attendance[toId(s._id)] || "Unmarked";
      return [
        `"${s.fullName || s.username}"`,
        `"${s.username}"`,
        `"${s.course || "N/A"}"`,
        `"${s.center_name || "Main Branch"}"`,
        `"${st.toUpperCase()}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Daily_Student_Attendance_Register_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Attendance register exported to CSV");
  };

  // Download Sample Import Template
  const downloadSampleTemplate = () => {
    const sampleRows = [
      "username,status",
      "student_1,P",
      "student_2,A",
      "student_3,L",
      "student_4,LV"
    ];
    const csvContent = "data:text/csv;charset=utf-8," + sampleRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Sample_Student_Attendance_Import_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter Unique Courses
  const uniqueCourses = Array.from(
    new Set(students.map((s) => s.course).filter((c): c is string => Boolean(c)))
  );

  const filteredStudents = students.filter((s) => {
    const matchesCourse = selectedCourse === "all" || s.course === selectedCourse;
    const matchesCenter =
      selectedCenter === "all" ||
      toId(s.center_id) === selectedCenter ||
      toId(s.parent_id) === selectedCenter ||
      (s.center_name || "").toLowerCase().includes(selectedCenter.toLowerCase());
    const matchesSearch =
      (s.fullName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.course || "").toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCourse && matchesCenter && matchesSearch;
  });

  // Calculate Metrics
  const totalCount = filteredStudents.length;
  const presentCount = filteredStudents.filter((s) => attendance[toId(s._id)] === "present").length;
  const absentCount = filteredStudents.filter((s) => attendance[toId(s._id)] === "absent").length;
  const lateCount = filteredStudents.filter((s) => attendance[toId(s._id)] === "late").length;
  const leaveCount = filteredStudents.filter((s) => attendance[toId(s._id)] === "leave").length;

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12 text-zinc-100">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/90 p-6 rounded-2xl border border-zinc-800 shadow-xl backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Daily Student Attendance Register & Importer
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
              Student Attendance Register
            </h1>
            <p className="text-zinc-400 text-xs mt-1">
              Mark individual, multi-select, or bulk attendance for students, or import via CSV/Excel sheet.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-zinc-950 px-3 py-2 rounded-xl border border-zinc-800">
              <CalendarIcon className="w-4 h-4 text-emerald-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-zinc-200 outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={() => setIsImportModalOpen(true)}
              disabled={isLocked}
              className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 border border-zinc-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-2"
            >
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              Import CSV / Excel
            </button>

            <button
              onClick={exportRegisterCSV}
              className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              Export Register
            </button>

            <button
              onClick={handleSaveAttendance}
              disabled={saving || isLocked}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-lg flex items-center gap-2",
                isLocked
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              )}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isLocked ? (
                <Lock className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isLocked ? "Register Locked" : "Save & Lock Register"}
            </button>
          </div>
        </div>

        {/* Lock Status Warning Banner */}
        {isLocked && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-4 rounded-2xl flex items-center justify-between shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Attendance Register Locked</h4>
                <p className="text-xs text-amber-400/80">Attendance for {selectedDate} has been saved and locked. Contact SuperAdmin to unlock registers for edits.</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-xs font-bold rounded-xl border border-amber-500/30 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" /> Locked & Verified
            </span>
          </div>
        )}

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Total Roster</p>
              <h3 className="text-2xl font-bold text-white mt-0.5">{totalCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">Present</p>
              <h3 className="text-2xl font-bold text-emerald-300 mt-0.5">{presentCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-rose-400 uppercase tracking-wider">Absent</p>
              <h3 className="text-2xl font-bold text-rose-300 mt-0.5">{absentCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <XCircle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">Late</p>
              <h3 className="text-2xl font-bold text-amber-300 mt-0.5">{lateCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-purple-400 uppercase tracking-wider">On Leave</p>
              <h3 className="text-2xl font-bold text-purple-300 mt-0.5">{leaveCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <CalendarIcon className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Toolbar & Multi-Select Action Bar */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search candidate by name, roll number, or username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isAdmin && (
                <select
                  value={selectedCenter}
                  onChange={(e) => setSelectedCenter(e.target.value)}
                  className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">All Network Centers</option>
                  {centers.map((c) => (
                    <option key={toId(c._id)} value={toId(c._id)}>
                      {c.center_name || c.name} {c.code ? `(${c.code})` : ""}
                    </option>
                  ))}
                </select>
              )}

              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Academic Programs</option>
                {uniqueCourses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Flexible Multi-Select / Bulk Actions Control Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-zinc-800/80 pt-3 text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectAll}
                className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl font-semibold transition-all flex items-center gap-1.5"
              >
                {selectedStudentIds.size === filteredStudents.length && filteredStudents.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-zinc-500" />
                )}
                {selectedStudentIds.size > 0 ? `Selected ${selectedStudentIds.size}/${filteredStudents.length}` : "Select All Candidates"}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-zinc-500">Apply Action to Checked ({selectedStudentIds.size}):</span>
              
              <button
                onClick={() => applyBulkStatus("present")}
                disabled={saving || filteredStudents.length === 0 || isLocked}
                className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Present
              </button>

              <button
                onClick={() => applyBulkStatus("absent")}
                disabled={saving || filteredStudents.length === 0 || isLocked}
                className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                Absent
              </button>

              <button
                onClick={() => applyBulkStatus("leave")}
                disabled={saving || filteredStudents.length === 0 || isLocked}
                className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                Leave
              </button>

              <button
                onClick={() => applyBulkStatus("late")}
                disabled={saving || filteredStudents.length === 0 || isLocked}
                className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/30 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" />
                Late
              </button>
            </div>
          </div>
        </div>

        {/* Student Register Table */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4 font-bold w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.size === filteredStudents.length && filteredStudents.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="py-3.5 px-4 font-bold">Candidate Profile</th>
                  <th className="py-3.5 px-4 font-bold">Username / Roll</th>
                  <th className="py-3.5 px-4 font-bold">Enrolled Course</th>
                  <th className="py-3.5 px-4 font-bold">Center Branch</th>
                  <th className="py-3.5 px-4 font-bold text-center">Single Marking Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-zinc-500">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mx-auto mb-2" />
                      Loading candidate attendance roster...
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-zinc-500">
                      No candidate records found matching current date and filters
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => {
                    const sId = toId(s._id);
                    const currentStatus = attendance[sId];
                    const isSelected = selectedStudentIds.has(sId);

                    return (
                      <tr key={sId} className={cn("transition-colors", isSelected ? "bg-emerald-500/10" : "hover:bg-zinc-800/30")}>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectStudent(sId)}
                            className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0 cursor-pointer"
                          />
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300 font-bold">
                              <User className="w-4 h-4" />
                            </div>
                            <span className="font-bold text-zinc-100">{s.fullName || s.username}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-zinc-400 font-mono">
                          @{s.username}
                        </td>

                        <td className="py-3 px-4 text-zinc-300 font-medium">
                          {s.course || "General Enrolment"}
                        </td>

                        <td className="py-3 px-4 text-zinc-400">
                          {s.center_name || "Main Branch"}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleStatusChange(sId, "present")}
                              disabled={isLocked}
                              className={cn(
                                "px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 border",
                                currentStatus === "present"
                                  ? "bg-emerald-600 text-white border-emerald-500 shadow-md scale-105"
                                  : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-emerald-500/40 hover:text-emerald-400"
                              )}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              P (Present)
                            </button>

                            <button
                              onClick={() => handleStatusChange(sId, "absent")}
                              disabled={isLocked}
                              className={cn(
                                "px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 border",
                                currentStatus === "absent"
                                  ? "bg-rose-600 text-white border-rose-500 shadow-md scale-105"
                                  : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-rose-500/40 hover:text-rose-400"
                              )}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              A (Absent)
                            </button>

                            <button
                              onClick={() => handleStatusChange(sId, "late")}
                              disabled={isLocked}
                              className={cn(
                                "px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 border",
                                currentStatus === "late"
                                  ? "bg-amber-600 text-white border-amber-500 shadow-md scale-105"
                                  : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-amber-500/40 hover:text-amber-400"
                              )}
                            >
                              <Clock className="w-3.5 h-3.5" />
                              L (Late)
                            </button>

                            <button
                              onClick={() => handleStatusChange(sId, "leave")}
                              disabled={isLocked}
                              className={cn(
                                "px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 border",
                                currentStatus === "leave"
                                  ? "bg-purple-600 text-white border-purple-500 shadow-md scale-105"
                                  : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-purple-500/40 hover:text-purple-400"
                              )}
                            >
                              <CalendarIcon className="w-3.5 h-3.5" />
                              LV (Leave)
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* CSV / Excel Import Modal */}
        {isImportModalOpen && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-2xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
              <div className="p-5 border-b border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-blue-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Bulk Import Attendance Sheet (CSV / Excel)</h3>
                </div>
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-zinc-300">Choose CSV File from Computer</p>
                    <button
                      onClick={downloadSampleTemplate}
                      className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> Download CSV Format Template
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt,.tsv"
                    onChange={handleFileUpload}
                    className="w-full text-xs text-zinc-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                  />
                  <p className="text-[10px] text-zinc-500">File columns format: `username, status` (e.g. `student_1, P` or `student_2, absent`)</p>
                </div>

                {importPreview.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-emerald-400">Parsed Preview ({importPreview.length} Candidates):</p>
                    <div className="max-h-48 overflow-y-auto border border-zinc-800 rounded-xl bg-zinc-950 p-2 divide-y divide-zinc-800/60 custom-scrollbar">
                      {importPreview.map((row, idx) => (
                        <div key={idx} className="py-1.5 px-2 flex items-center justify-between text-xs">
                          <span className="font-semibold text-zinc-200">{row.matchedName} (@{row.username})</span>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                            row.status === "present" && "bg-emerald-500/20 text-emerald-400",
                            row.status === "absent" && "bg-rose-500/20 text-rose-400",
                            row.status === "late" && "bg-amber-500/20 text-amber-400",
                            row.status === "leave" && "bg-purple-500/20 text-purple-400"
                          )}>
                            {row.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-zinc-800 bg-zinc-950/60 flex justify-end gap-3">
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmImportData}
                  disabled={saving || importPreview.length === 0}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm & Sync Attendance
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

export default AttendanceRegisterPage;
