import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Calendar as CalendarIcon,
  Loader2,
  Download,
  Filter,
  User,
  Building2,
  BookOpen,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { apiFetch } from "@/lib/api";

interface Student {
  _id: string | { $oid: string };
  username: string;
  fullName?: string;
  course?: string;
  center_name?: string;
  center_id?: string | { $oid: string };
  parent_id?: string | { $oid: string };
}

interface Center {
  _id: string | { $oid: string };
  center_name?: string;
  name?: string;
  code?: string;
}

interface StaffMember {
  _id: string | { $oid: string };
  name: string;
  designation?: string;
  center_name?: string;
  center_id?: string | { $oid: string };
}

interface AttendanceRecord {
  student_id?: string | { $oid: string };
  staff_id?: string | { $oid: string };
  user_id?: string | { $oid: string };
  status: string;
  date?: string;
  date_str?: string;
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

const getEntityId = (obj: any): string => {
  if (!obj) return "";
  return toId(obj._id || obj.id || obj.user_id || obj.student_id || obj.staff_id);
};

const AttendanceReportPage = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"student" | "staff">("student");
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [selectedCenter, setSelectedCenter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  const role = (user.role || "").toLowerCase().replace(" ", "");
  const isAdmin = role === "admin" || role === "superadmin";

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  useEffect(() => {
    fetchData();
  }, [currentMonth, selectedCenter, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const centerParam = selectedCenter !== "all" ? `&center_id=${selectedCenter}` : "";
      const startStr = format(monthStart, "yyyy-MM-dd");
      const endStr = format(monthEnd, "yyyy-MM-dd");

      if (activeTab === "student") {
        const [studentRes, centerRes, attendanceRes] = await Promise.all([
          apiFetch("/api/students"),
          isAdmin ? apiFetch("/api/centers") : Promise.resolve({ ok: false, json: async () => [] }),
          apiFetch(`/api/attendance?start_date=${startStr}&end_date=${endStr}${centerParam}`)
        ]);

        if (studentRes.ok) setStudents(await studentRes.json());
        if (centerRes.ok) setCenters(await centerRes.json());
        if (attendanceRes.ok) {
          const raw = await attendanceRes.json();
          setRecords(Array.isArray(raw) ? raw : (raw.records || []));
        }
      } else {
        const [staffRes, centerRes, attendanceRes] = await Promise.all([
          apiFetch("/api/staff"),
          isAdmin ? apiFetch("/api/centers") : Promise.resolve({ ok: false, json: async () => [] }),
          apiFetch(`/api/staff/attendance?start_date=${startStr}&end_date=${endStr}${centerParam}`)
        ]);

        if (staffRes.ok) {
          const rawStaff = await staffRes.json();
          const list = Array.isArray(rawStaff) ? rawStaff : (rawStaff.staff || []);
          setStaff(list.map((s: any) => ({
            _id: toId(s._id || s.id || s.user_id),
            name: s.name || s.full_name || s.username || "Staff Member",
            designation: s.designation || s.role_type || "Instructor",
            center_name: s.center_name || s.center || "Head Office",
            center_id: toId(s.center_id || s.parent_id)
          })));
        }

        if (centerRes.ok) setCenters(await centerRes.json());

        if (attendanceRes.ok) {
          const raw = await attendanceRes.json();
          setRecords(Array.isArray(raw) ? raw : (raw.records || []));
        }
      }
    } catch (error) {
      console.error("Error fetching report data:", error);
      toast.error("Failed to load monthly attendance report data");
    } finally {
      setLoading(false);
    }
  };

  const getStatus = (entityId: string, day: Date) => {
    const targetDayStr = format(day, "yyyy-MM-dd");
    const record = records.find((r) => {
      const recEntityId = toId(r.student_id || r.staff_id || r.user_id);
      let rDateStr = "";
      if ((r as any).date_str) {
        rDateStr = (r as any).date_str;
      } else if (typeof r.date === "string") {
        rDateStr = r.date.split("T")[0];
      } else if (r.date && typeof r.date === "object" && "$date" in (r.date as any)) {
        const rawDate = (r.date as any).$date;
        if (typeof rawDate === "string") rDateStr = rawDate.split("T")[0];
        else if (typeof rawDate === "number") rDateStr = format(new Date(rawDate), "yyyy-MM-dd");
      }
      return recEntityId === entityId && rDateStr === targetDayStr;
    });
    return record?.status?.toLowerCase();
  };

  const getStatusCell = (status: string | undefined) => {
    switch (status) {
      case "present":
        return <div className="w-full h-8 bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px]">P</div>;
      case "absent":
        return <div className="w-full h-8 bg-rose-500/20 text-rose-400 font-bold flex items-center justify-center text-[10px]">A</div>;
      case "late":
        return <div className="w-full h-8 bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[10px]">L</div>;
      case "leave":
        return <div className="w-full h-8 bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center text-[10px]">LV</div>;
      default:
        return <div className="w-full h-8 bg-zinc-950/40 text-zinc-700 flex items-center justify-center text-[10px]">-</div>;
    }
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentMonth(newDate);
  };

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

  const filteredStaff = staff.filter((s) => {
    const matchesCenter =
      selectedCenter === "all" ||
      toId(s.center_id) === selectedCenter ||
      (s.center_name || "").toLowerCase().includes(selectedCenter.toLowerCase());
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.designation || "").toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCenter && matchesSearch;
  });

  const exportCSV = () => {
    const isStudentView = activeTab === "student";
    const headerRow = [
      isStudentView ? "Student Name" : "Staff Name",
      isStudentView ? "Username / Roll" : "Designation",
      isStudentView ? "Course" : "Center",
      isStudentView ? "Center" : "Branch",
      ...daysInMonth.map((d) => format(d, "dd-MMM")),
      "Total Present %"
    ];

    const currentList = isStudentView ? filteredStudents : filteredStaff;

    const rows = currentList.map((item: any) => {
      const eId = toId(item._id);
      let pCount = 0;
      const dayStatuses = daysInMonth.map((day) => {
        const st = getStatus(eId, day);
        if (st === "present") pCount++;
        return st ? st.toUpperCase() : "-";
      });
      const pct = daysInMonth.length > 0 ? ((pCount / daysInMonth.length) * 100).toFixed(0) + "%" : "0%";
      return [
        `"${item.fullName || item.name || item.username}"`,
        `"${item.username || item.designation || "Staff"}"`,
        `"${item.course || item.center_name || "Main Branch"}"`,
        `"${item.center_name || "Main Branch"}"`,
        ...dayStatuses,
        `"${pct}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headerRow.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Monthly_${isStudentView ? "Student" : "Staff"}_Attendance_Report_${format(currentMonth, "MMM_yyyy")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Monthly attendance report exported to CSV");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12 text-zinc-100">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/90 p-6 rounded-2xl border border-zinc-800 shadow-xl backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Monthly Attendance Ledger Matrix
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
              Monthly Attendance Report
            </h1>
            <p className="text-zinc-400 text-xs mt-1">
              Detailed 30/31-day attendance breakdown for {format(currentMonth, "MMMM yyyy")} across courses and centers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Tab Switcher */}
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
              <button
                onClick={() => setActiveTab("student")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  activeTab === "student"
                    ? "bg-emerald-600 text-white shadow-md"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                )}
              >
                Students Ledger
              </button>
              <button
                onClick={() => setActiveTab("staff")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  activeTab === "staff"
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                )}
              >
                Staff Ledger
              </button>
            </div>

            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
              <button
                onClick={() => changeMonth(-1)}
                className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs font-bold text-zinc-200">
                {format(currentMonth, "MMMM yyyy")}
              </span>
              <button
                onClick={() => changeMonth(1)}
                className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={exportCSV}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV Report
            </button>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder={activeTab === "student" ? "Filter report by student name or roll..." : "Filter report by staff member or designation..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
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

            {activeTab === "student" && (
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Academic Programs</option>
                {uniqueCourses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Monthly Attendance Grid Table */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
          {loading ? (
            <div className="p-20 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
              Generating {activeTab === "student" ? "student" : "staff"} monthly attendance matrix...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead>
                  <tr className="bg-zinc-950/90 border-b border-zinc-800 text-zinc-400 text-[10px] uppercase font-bold">
                    <th className="px-4 py-3.5 sticky left-0 bg-zinc-950 z-20 border-r border-zinc-800 min-w-[200px]">
                      {activeTab === "student" ? "Student Profile" : "Staff Member Profile"}
                    </th>
                    {daysInMonth.map((day) => (
                      <th
                        key={day.toISOString()}
                        className="px-1 py-2 text-center text-[9px] border-r border-zinc-800/60 min-w-[28px]"
                      >
                        <div>{format(day, "d")}</div>
                        <div className="text-[8px] text-zinc-500 font-normal">{format(day, "eee").charAt(0)}</div>
                      </th>
                    ))}
                    <th className="px-4 py-3.5 text-center sticky right-0 bg-zinc-950 z-20 border-l border-zinc-800 min-w-[70px]">
                      Present
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {activeTab === "student" ? (
                    filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={daysInMonth.length + 2} className="py-12 text-center text-zinc-500 text-xs">
                          No student records match search filters
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((s) => {
                        const sId = getEntityId(s);
                        let presentDays = 0;
                        daysInMonth.forEach((day) => {
                          if (getStatus(sId, day) === "present") presentDays++;
                        });

                        return (
                          <tr key={sId} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="px-4 py-2 sticky left-0 bg-zinc-900 z-10 border-r border-zinc-800">
                              <div className="flex items-center gap-2">
                                <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                <div>
                                  <p className="text-xs font-bold text-zinc-100">{s.fullName || s.username}</p>
                                  <p className="text-[10px] text-zinc-400">{s.course || "N/A"}</p>
                                </div>
                              </div>
                            </td>

                            {daysInMonth.map((day) => {
                              const status = getStatus(sId, day);
                              return (
                                <td key={day.toISOString()} className="p-0 border-r border-zinc-800/40 text-center">
                                  {getStatusCell(status)}
                                </td>
                              );
                            })}

                            <td className="px-4 py-2 text-center sticky right-0 bg-zinc-900 z-10 border-l border-zinc-800 font-mono font-bold text-xs text-emerald-400">
                              {presentDays} / {daysInMonth.length}
                            </td>
                          </tr>
                        );
                      })
                    )
                  ) : filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={daysInMonth.length + 2} className="py-12 text-center text-zinc-500 text-xs">
                        No staff records match search filters
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((st) => {
                      const stId = getEntityId(st);
                      let presentDays = 0;
                      daysInMonth.forEach((day) => {
                        if (getStatus(stId, day) === "present") presentDays++;
                      });

                      return (
                        <tr key={stId} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-2 sticky left-0 bg-zinc-900 z-10 border-r border-zinc-800">
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <div>
                                <p className="text-xs font-bold text-zinc-100">{st.name}</p>
                                <p className="text-[10px] text-zinc-400">{st.designation || "Instructor"}</p>
                              </div>
                            </div>
                          </td>

                          {daysInMonth.map((day) => {
                            const status = getStatus(stId, day);
                            return (
                              <td key={day.toISOString()} className="p-0 border-r border-zinc-800/40 text-center">
                                {getStatusCell(status)}
                              </td>
                            );
                          })}

                          <td className="px-4 py-2 text-center sticky right-0 bg-zinc-900 z-10 border-l border-zinc-800 font-mono font-bold text-xs text-blue-400">
                            {presentDays} / {daysInMonth.length}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 border border-zinc-800 bg-zinc-900/90 rounded-2xl text-xs">
          <span className="font-semibold text-zinc-400">Status Indicator Legend:</span>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 bg-emerald-500/20 text-emerald-400 font-bold rounded flex items-center justify-center text-[10px]">P</span>
              <span className="text-zinc-300">Present</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 bg-rose-500/20 text-rose-400 font-bold rounded flex items-center justify-center text-[10px]">A</span>
              <span className="text-zinc-300">Absent</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 bg-amber-500/20 text-amber-400 font-bold rounded flex items-center justify-center text-[10px]">L</span>
              <span className="text-zinc-300">Late</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 bg-purple-500/20 text-purple-400 font-bold rounded flex items-center justify-center text-[10px]">LV</span>
              <span className="text-zinc-300">Leave</span>
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default AttendanceReportPage;
