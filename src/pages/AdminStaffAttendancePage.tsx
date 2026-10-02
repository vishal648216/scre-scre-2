import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CalendarCheck,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Save,
  Search,
  Calendar as CalendarIcon,
  Lock,
  ShieldAlert,
  Building2,
  Sparkles,
  UserCheck,
  CheckSquare,
  Square,
  CheckCheck,
  Download
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

interface StaffMember {
  _id: string;
  name: string;
  email: string;
  designation?: string;
  center_name?: string;
  center_id?: string;
  attendanceStatus?: "present" | "absent" | "leave" | "late";
  checkInTime?: string;
}

interface Center {
  _id: string | { $oid: string };
  center_name?: string;
  name?: string;
  code?: string;
}

const toId = (v: any): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "$oid" in v) return v.$oid;
  return String(v || "");
};

const AdminStaffAttendancePage = () => {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  const role = (user.role || "").toLowerCase().replace(" ", "");
  const isAdmin = role === "admin" || role === "superadmin";

  useEffect(() => {
    fetchStaffAttendance();
  }, [selectedDate, selectedCenter]);

  const fetchStaffAttendance = async () => {
    try {
      setLoading(true);
      setIsLocked(false);

      const [attRes, centerRes, staffRes] = await Promise.all([
        apiFetch(`/api/staff/attendance?date=${selectedDate}`),
        isAdmin ? apiFetch("/api/centers") : Promise.resolve({ ok: false, json: async () => [] }),
        apiFetch("/api/staff").catch(() => null)
      ]);

      if (centerRes.ok) setCenters(await centerRes.json());

      let baseStaffList: StaffMember[] = [];
      if (staffRes && staffRes.ok) {
        const rawStaff = await staffRes.json();
        const arrayStaff = Array.isArray(rawStaff) ? rawStaff : (rawStaff?.staff || []);
        baseStaffList = arrayStaff.map((s: any) => ({
          _id: toId(s._id || s.id || s.user_id),
          name: s.name || s.full_name || s.username || "Staff Member",
          email: s.email || "staff@scre.edu",
          designation: s.designation || s.role_type || "Instructor",
          center_name: s.center_name || s.center || "Head Office",
          center_id: toId(s.center_id || s.parent_id),
          attendanceStatus: "present",
          checkInTime: "09:30 AM"
        }));
      }

      let dateIsLocked = false;
      const statusMap: Record<string, "present" | "absent" | "leave" | "late"> = {};

      if (attRes && attRes.ok) {
        const data = await attRes.json();
        if (data && typeof data === "object" && "is_locked" in data) {
          dateIsLocked = Boolean(data.is_locked);
          const records = data.records || [];
          records.forEach((r: any) => {
            const stfId = toId(r.staff_id || r.user_id);
            if (stfId) statusMap[stfId] = r.status as any;
          });
        }
      }

      setIsLocked(dateIsLocked);

      const mergedList = baseStaffList.map((s) => ({
        ...s,
        attendanceStatus: statusMap[toId(s._id)] || s.attendanceStatus || "present"
      }));

      setStaff(mergedList);
    } catch {
      toast.error("Failed to load staff attendance register");
    } finally {
      setLoading(false);
    }
  };

  const setStatus = (id: string, status: "present" | "absent" | "leave" | "late") => {
    if (isLocked) {
      toast.error(`Attendance for ${selectedDate} is locked!`);
      return;
    }
    setStaff(prev => prev.map(s => (s._id === id || (s as any).id === id) ? { ...s, attendanceStatus: status } : s));
  };

  // Multi-Select Logic
  const toggleSelectStaff = (id: string) => {
    setSelectedStaffIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedStaffIds.size === filteredStaff.length && filteredStaff.length > 0) {
      setSelectedStaffIds(new Set());
    } else {
      setSelectedStaffIds(new Set(filteredStaff.map((s) => s._id)));
    }
  };

  const applyBulkStatus = (targetStatus: "present" | "absent" | "leave" | "late") => {
    if (isLocked) {
      toast.error(`Attendance for ${selectedDate} is locked!`);
      return;
    }

    const idsToUpdate = selectedStaffIds.size > 0 ? Array.from(selectedStaffIds) : filteredStaff.map((s) => s._id);
    if (idsToUpdate.length === 0) return;

    setStaff((prev) =>
      prev.map((s) => (idsToUpdate.includes(s._id) ? { ...s, attendanceStatus: targetStatus } : s))
    );

    toast.success(`Marked ${idsToUpdate.length} staff member(s) as ${targetStatus.toUpperCase()}`);
    setSelectedStaffIds(new Set());
  };

  const handleSaveAttendance = async () => {
    if (isLocked) {
      toast.error(`Attendance for ${selectedDate} is already locked!`);
      return;
    }

    setSubmitting(true);
    try {
      const records = staff.map((s) => ({
        staff_id: toId(s._id),
        date: selectedDate,
        status: s.attendanceStatus || "present",
        check_in: s.checkInTime || "09:30 AM",
        center_id: s.center_id
      }));

      const res = await apiFetch("/api/staff/attendance", {
        method: "POST",
        body: JSON.stringify({ date: selectedDate, records })
      });

      if (res && res.ok) {
        setIsLocked(true);
        toast.success(`Staff attendance for ${selectedDate} saved & locked successfully`);
      } else {
        const err = await res?.json().catch(() => ({}));
        toast.error(err.message || "Failed to save staff attendance");
      }
    } catch {
      toast.error("An error occurred while saving attendance");
    } finally {
      setSubmitting(false);
    }
  };

  const exportStaffCSV = () => {
    const headers = ["Staff Name", "Designation", "Email", "Center Branch", `Status (${selectedDate})`];
    const rows = filteredStaff.map((s) => [
      `"${s.name}"`,
      `"${s.designation || "Staff"}"`,
      `"${s.email}"`,
      `"${s.center_name || "Head Office"}"`,
      `"${(s.attendanceStatus || "present").toUpperCase()}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Staff_Attendance_Register_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Staff attendance register exported to CSV");
  };

  const filteredStaff = staff.filter(s => {
    const matchesCenter =
      selectedCenter === "all" ||
      toId(s.center_id) === selectedCenter ||
      (s.center_name || "").toLowerCase().includes(selectedCenter.toLowerCase());

    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.designation || "").toLowerCase().includes(search.toLowerCase());

    return matchesCenter && matchesSearch;
  });

  const totalPresent = filteredStaff.filter(s => (s.attendanceStatus || "present") === "present").length;
  const totalAbsent = filteredStaff.filter(s => s.attendanceStatus === "absent").length;
  const totalLate = filteredStaff.filter(s => s.attendanceStatus === "late").length;
  const totalLeave = filteredStaff.filter(s => s.attendanceStatus === "leave").length;

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12 text-zinc-100">
        {/* Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/90 p-6 rounded-2xl border border-zinc-800 shadow-xl backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Staff & Instructor Register
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
              Staff Attendance Register
            </h1>
            <p className="text-zinc-400 text-xs mt-1">
              Track check-in times, leave allocations, and daily staff attendance across all center branches.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-zinc-950 px-3 py-2 rounded-xl border border-zinc-800">
              <CalendarIcon className="w-4 h-4 text-blue-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-zinc-200 outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={exportStaffCSV}
              className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              Export CSV
            </button>

            {isLocked ? (
              <div className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Locked
              </div>
            ) : (
              <button
                onClick={handleSaveAttendance}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save & Lock Attendance
              </button>
            )}
          </div>
        </div>

        {/* Lock Warning */}
        {isLocked && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3 text-amber-300 text-xs font-medium">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              Attendance record for {selectedDate} is locked. Further modifications are restricted.
            </span>
          </div>
        )}

        {/* Summary Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">Present Staff</p>
              <h3 className="text-2xl font-bold text-emerald-300 mt-0.5">{totalPresent}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-rose-400 uppercase tracking-wider">Absent Staff</p>
              <h3 className="text-2xl font-bold text-rose-300 mt-0.5">{totalAbsent}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <XCircle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">Late Check-ins</p>
              <h3 className="text-2xl font-bold text-amber-300 mt-0.5">{totalLate}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-purple-400 uppercase tracking-wider">On Leave</p>
              <h3 className="text-2xl font-bold text-purple-300 mt-0.5">{totalLeave}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Toolbar & Bulk Action Bar */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search staff member by name, designation, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            {isAdmin && (
              <select
                value={selectedCenter}
                onChange={(e) => setSelectedCenter(e.target.value)}
                className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Network Centers</option>
                {centers.map((c) => (
                  <option key={toId(c._id)} value={toId(c._id)}>
                    {c.center_name || c.name} {c.code ? `(${c.code})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Multi-Select & Bulk Marking Action Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-zinc-800/80 pt-3 text-xs">
            <div className="flex items-center gap-2">
              <button
                disabled={isLocked}
                onClick={toggleSelectAll}
                className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {selectedStaffIds.size === filteredStaff.length && filteredStaff.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-blue-400" />
                ) : (
                  <Square className="w-4 h-4 text-zinc-500" />
                )}
                {selectedStaffIds.size > 0 ? `Selected ${selectedStaffIds.size}/${filteredStaff.length}` : "Select All Staff"}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-zinc-500">Apply Action to {selectedStaffIds.size > 0 ? "Selected" : "All"}:</span>
              
              <button
                disabled={isLocked}
                onClick={() => applyBulkStatus("present")}
                className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-xl font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Present
              </button>

              <button
                disabled={isLocked}
                onClick={() => applyBulkStatus("absent")}
                className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                Absent
              </button>

              <button
                disabled={isLocked}
                onClick={() => applyBulkStatus("leave")}
                className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 rounded-xl font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Users className="w-3.5 h-3.5" />
                Leave
              </button>

              <button
                disabled={isLocked}
                onClick={() => applyBulkStatus("late")}
                className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/30 rounded-xl font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Clock className="w-3.5 h-3.5" />
                Late
              </button>
            </div>
          </div>
        </div>

        {/* Staff Table Card */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4 font-bold w-10 text-center">
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={selectedStaffIds.size === filteredStaff.length && filteredStaff.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-0 cursor-pointer disabled:opacity-50"
                    />
                  </th>
                  <th className="py-3.5 px-4 font-bold">Staff Profile</th>
                  <th className="py-3.5 px-4 font-bold">Designation & Email</th>
                  <th className="py-3.5 px-4 font-bold">Center Branch</th>
                  <th className="py-3.5 px-4 font-bold text-center">Attendance Action Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-zinc-500">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-400 mx-auto mb-2" />
                      Loading staff roster...
                    </td>
                  </tr>
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-zinc-500">
                      No staff members found matching current filters
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((s) => {
                    const status = s.attendanceStatus || "present";
                    const isSelected = selectedStaffIds.has(s._id);

                    return (
                      <tr key={s._id} className={cn("transition-colors", isSelected ? "bg-blue-500/10" : "hover:bg-zinc-800/30")}>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            disabled={isLocked}
                            checked={isSelected}
                            onChange={() => toggleSelectStaff(s._id)}
                            className="rounded border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-0 cursor-pointer disabled:opacity-50"
                          />
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                              {s.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-zinc-100">{s.name}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <p className="font-medium text-zinc-200">{s.designation || "Instructor"}</p>
                          <p className="text-[10px] text-zinc-400">{s.email}</p>
                        </td>

                        <td className="py-3 px-4 text-zinc-400">
                          {s.center_name || "Main Branch"}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              disabled={isLocked}
                              onClick={() => setStatus(s._id, "present")}
                              className={cn(
                                "px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 border",
                                status === "present"
                                  ? "bg-emerald-600 text-white border-emerald-500 shadow-md"
                                  : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-emerald-500/40"
                              )}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Present
                            </button>

                            <button
                              disabled={isLocked}
                              onClick={() => setStatus(s._id, "late")}
                              className={cn(
                                "px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 border",
                                status === "late"
                                  ? "bg-amber-600 text-white border-amber-500 shadow-md"
                                  : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-amber-500/40"
                              )}
                            >
                              <Clock className="w-3.5 h-3.5" />
                              Late
                            </button>

                            <button
                              disabled={isLocked}
                              onClick={() => setStatus(s._id, "leave")}
                              className={cn(
                                "px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 border",
                                status === "leave"
                                  ? "bg-purple-600 text-white border-purple-500 shadow-md"
                                  : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-purple-500/40"
                              )}
                            >
                              <Users className="w-3.5 h-3.5" />
                              Leave
                            </button>

                            <button
                              disabled={isLocked}
                              onClick={() => setStatus(s._id, "absent")}
                              className={cn(
                                "px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 border",
                                status === "absent"
                                  ? "bg-rose-600 text-white border-rose-500 shadow-md"
                                  : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-rose-500/40"
                              )}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Absent
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

      </div>
    </DashboardLayout>
  );
};

export default AdminStaffAttendancePage;
