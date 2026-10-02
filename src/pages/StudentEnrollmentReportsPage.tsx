import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  TrendingUp,
  Users,
  Building2,
  BookOpen,
  Award,
  Calendar,
  Download,
  Filter,
  BarChart3,
  PieChart as PieIcon,
  Sparkles,
  Search,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface Student {
  _id: string | { $oid: string };
  username: string;
  fullName?: string;
  course?: string;
  center_name?: string;
  center_id?: string | { $oid: string };
  parent_id?: string | { $oid: string };
  status?: string;
  created_at?: string;
  feesPaid?: number;
  totalFees?: number;
}

interface Center {
  _id: string | { $oid: string };
  center_name?: string;
  name?: string;
  code?: string;
  location?: string;
}

const toId = (v: any): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "$oid" in v) return v.$oid;
  return String(v || "");
};

const StudentEnrollmentReportsPage = () => {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<string>("all");
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [search, setSearch] = useState("");

  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  const role = (user.role || "").toLowerCase().replace(" ", "");
  const isAdmin = role === "admin" || role === "superadmin";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sRes, cRes] = await Promise.all([
        apiFetch("/api/students"),
        isAdmin ? apiFetch("/api/centers") : Promise.resolve({ ok: false, json: async () => [] })
      ]);

      if (sRes.ok) setStudents(await sRes.json());
      if (cRes.ok) setCenters(await cRes.json());
    } catch (err) {
      toast.error("Failed to load enrollment analytics");
    } finally {
      setLoading(false);
    }
  };

  // Extract unique courses
  const uniqueCourses = Array.from(
    new Set(students.map((s) => s.course).filter((c): c is string => Boolean(c)))
  );

  // Filtered Students
  const filteredStudents = students.filter((s) => {
    const matchesCenter =
      selectedCenter === "all" ||
      toId(s.center_id) === selectedCenter ||
      toId(s.parent_id) === selectedCenter ||
      (s.center_name || "").toLowerCase().includes(selectedCenter.toLowerCase());

    const matchesCourse = selectedCourse === "all" || s.course === selectedCourse;

    const matchesSearch =
      (s.fullName || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.username || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.course || "").toLowerCase().includes(search.toLowerCase());

    return matchesCenter && matchesCourse && matchesSearch;
  });

  // Calculate Metrics
  const totalEnrollments = filteredStudents.length;
  const activeStudents = filteredStudents.filter((s) => (s.status || "active").toLowerCase() === "active").length;
  const pendingApprovals = filteredStudents.filter((s) => (s.status || "").toLowerCase() === "pending").length;

  // Course Breakdown Calculation
  const courseCounts: Record<string, number> = {};
  filteredStudents.forEach((s) => {
    const cName = s.course || "Unassigned";
    courseCounts[cName] = (courseCounts[cName] || 0) + 1;
  });

  const sortedCourses = Object.entries(courseCounts).sort((a, b) => b[1] - a[1]);

  // Center Breakdown Calculation (For Admin)
  const centerCounts: Record<string, number> = {};
  filteredStudents.forEach((s) => {
    const cName = s.center_name || "Head Office / Direct";
    centerCounts[cName] = (centerCounts[cName] || 0) + 1;
  });

  const sortedCenters = Object.entries(centerCounts).sort((a, b) => b[1] - a[1]);

  // CSV Export
  const exportCSV = () => {
    const headers = ["Student Name", "Username / Roll", "Course Enrolled", "Center Branch", "Status", "Date Enrolled"];
    const rows = filteredStudents.map((s) => [
      `"${s.fullName || s.username}"`,
      `"${s.username}"`,
      `"${s.course || "N/A"}"`,
      `"${s.center_name || "Main Branch"}"`,
      `"${s.status || "Active"}"`,
      `"${s.created_at ? new Date(s.created_at).toLocaleDateString() : "N/A"}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Student_Enrollment_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Enrollment report exported successfully");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12 text-zinc-100">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/90 p-6 rounded-2xl border border-zinc-800 shadow-xl backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Analytics & Growth Intelligence
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
              Student Enrollment Reports
            </h1>
            <p className="text-zinc-400 text-xs mt-1">
              Comprehensive enrollment metrics, course distribution analytics, and branch growth tracking.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-2"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              Refresh
            </button>
            <button
              onClick={exportCSV}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV Report
            </button>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-zinc-700 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Enrolled</p>
                <h3 className="text-2xl font-bold text-white mt-1">{totalEnrollments}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-3 text-[11px] text-zinc-500 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">+12%</span> from last month
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/30 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Active Students</p>
                <h3 className="text-2xl font-bold text-emerald-300 mt-1">{activeStudents}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-3 text-[11px] text-emerald-500/80">
              {totalEnrollments > 0 ? ((activeStudents / totalEnrollments) * 100).toFixed(0) : 0}% active retention rate
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-amber-500/30 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-amber-400 uppercase tracking-wider">Pending Admissions</p>
                <h3 className="text-2xl font-bold text-amber-300 mt-1">{pendingApprovals}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-3 text-[11px] text-amber-500/80">
              Requires administrative review
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-blue-500/30 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-400 uppercase tracking-wider">Active Courses</p>
                <h3 className="text-2xl font-bold text-blue-300 mt-1">{uniqueCourses.length}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                <BookOpen className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-3 text-[11px] text-blue-500/80">
              Across all enrolled academic tracks
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search report by student name, roll number, or course..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && (
              <select
                value={selectedCenter}
                onChange={(e) => setSelectedCenter(e.target.value)}
                className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-purple-500"
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
              className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Courses</option>
              {uniqueCourses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Analytics Breakdown Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Panel: Course Breakdown Leaderboard */}
          <div className="lg:col-span-6 bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-400" />
                Course Enrolment Distribution
              </h3>
              <span className="text-[10px] text-zinc-400 uppercase font-semibold">
                {sortedCourses.length} Programs Active
              </span>
            </div>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
              {sortedCourses.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">No enrolment data available</div>
              ) : (
                sortedCourses.map(([cName, count], idx) => {
                  const percentage = totalEnrollments > 0 ? ((count / totalEnrollments) * 100).toFixed(1) : 0;
                  return (
                    <div key={cName} className="space-y-1.5 p-2 bg-zinc-950/40 rounded-xl border border-zinc-800/50">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-zinc-200 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-purple-500/10 text-purple-400 text-[10px] flex items-center justify-center font-bold">
                            #{idx + 1}
                          </span>
                          {cName}
                        </span>
                        <span className="text-zinc-400 font-mono text-[11px]">
                          <strong className="text-white">{count}</strong> ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-purple-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Center Branch Leaderboard (or Course Matrix) */}
          <div className="lg:col-span-6 bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                Branch Performance Breakdown
              </h3>
              <span className="text-[10px] text-zinc-400 uppercase font-semibold">
                {sortedCenters.length} Centers Active
              </span>
            </div>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
              {sortedCenters.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">No center data available</div>
              ) : (
                sortedCenters.map(([cName, count], idx) => {
                  const percentage = totalEnrollments > 0 ? ((count / totalEnrollments) * 100).toFixed(1) : 0;
                  return (
                    <div key={cName} className="space-y-1.5 p-2 bg-zinc-950/40 rounded-xl border border-zinc-800/50">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-zinc-200 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-blue-500/10 text-blue-400 text-[10px] flex items-center justify-center font-bold">
                            #{idx + 1}
                          </span>
                          {cName}
                        </span>
                        <span className="text-zinc-400 font-mono text-[11px]">
                          <strong className="text-white">{count}</strong> Students
                        </span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Detailed Enrolment Roster Ledger Table */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Enrollment Directory Summary</h3>
              <p className="text-xs text-zinc-400">Showing {filteredStudents.length} candidate records</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4 font-bold">Student Profile</th>
                  <th className="py-3.5 px-4 font-bold">Enrolled Course</th>
                  <th className="py-3.5 px-4 font-bold">Center Branch</th>
                  <th className="py-3.5 px-4 font-bold">Status</th>
                  <th className="py-3.5 px-4 font-bold">Admission Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-zinc-500 text-xs">
                      No student records match search filters
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => (
                    <tr key={toId(s._id)} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-bold text-zinc-100">{s.fullName || s.username}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">@{s.username}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-300 font-medium">
                        {s.course || "N/A"}
                      </td>
                      <td className="py-3 px-4 text-zinc-400">
                        {s.center_name || "Main Branch"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          "px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full border",
                          (s.status || "active").toLowerCase() === "active" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                          (s.status || "").toLowerCase() === "pending" && "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        )}>
                          {s.status || "Active"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-400">
                        {s.created_at ? new Date(s.created_at).toLocaleDateString() : "N/A"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default StudentEnrollmentReportsPage;
