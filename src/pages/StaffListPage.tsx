import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  Search,
  Loader2,
  PlusCircle,
  Shield,
  Mail,
  Phone,
  Briefcase,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  CheckSquare,
  Square,
  X,
  Lock,
  ArrowRightLeft,
  Building2,
  Download,
  Eye,
  EyeOff,
  Key,
  FileSpreadsheet,
  Award,
  DollarSign,
  Layers,
  Sparkles,
  MapPin,
  Calendar,
  CheckCircle2,
  Filter
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface StaffPermissions {
  can_manage_students: boolean;
  can_manage_attendance: boolean;
  can_manage_fees: boolean;
  can_manage_courses: boolean;
  can_manage_exams: boolean;
  can_view_reports: boolean;
  can_manage_staff: boolean;
  can_manage_enquiries?: boolean;
  can_issue_certificates?: boolean;
}

interface StaffMember {
  _id: string;
  user_id?: string;
  parent_id?: string;
  name: string;
  username: string;
  designation: string;
  role_type: string;
  email?: string;
  phone?: string;
  status: string;
  password?: string;
  raw_password?: string;
  basic_salary?: number;
  allowances?: number;
  deductions?: number;
  assigned_centers?: string[];
  assigned_subjects?: string[];
  permissions?: StaffPermissions;
  created_at?: string;
}

interface Center {
  _id: string;
  name?: string;
  centerName?: string;
  code?: string;
  city?: string;
}

const permissionLabels: { key: keyof StaffPermissions; title: string }[] = [
  { key: "can_manage_students", title: "Students & Admissions" },
  { key: "can_manage_attendance", title: "Attendance & Leaves" },
  { key: "can_manage_fees", title: "Fees & Receipts" },
  { key: "can_manage_courses", title: "Courses & Materials" },
  { key: "can_manage_exams", title: "Exams & Marks" },
  { key: "can_view_reports", title: "Reports & Analytics" },
  { key: "can_manage_staff", title: "Manage Staff" },
  { key: "can_manage_enquiries", title: "Enquiry CRM" },
  { key: "can_issue_certificates", title: "Certificates" },
];

const StaffListPage = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [studentsCount, setStudentsCount] = useState<number>(0);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [centerFilter, setCenterFilter] = useState("all");

  // Transfer Staff Modal State
  const [transferMember, setTransferMember] = useState<StaffMember | null>(null);
  const [targetCenterId, setTargetCenterId] = useState("");
  const [targetCenterName, setTargetCenterName] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferring, setTransferring] = useState(false);

  // View Staff Profile Modal State
  const [viewMember, setViewMember] = useState<StaffMember | null>(null);

  // Edit Modal State
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    designation: "",
    role_type: "",
    phone: "",
    email: "",
    status: "active",
    password: "",
    basic_salary: 0,
    assigned_center: ""
  });
  const [editPermissions, setEditPermissions] = useState<StaffPermissions>({
    can_manage_students: false,
    can_manage_attendance: false,
    can_manage_fees: false,
    can_manage_courses: false,
    can_manage_exams: false,
    can_view_reports: false,
    can_manage_staff: false,
    can_manage_enquiries: false,
    can_issue_certificates: false,
  });
  const [updating, setUpdating] = useState(false);

  const toId = (v: any): string => {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (typeof v === "object" && "$oid" in v) return String(v.$oid || "");
    return String(v || "");
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [staffRes, centersRes, studentsRes] = await Promise.all([
        apiFetch("/api/staff").catch(() => null),
        apiFetch("/api/centers").catch(() => null),
        apiFetch("/api/students").catch(() => null)
      ]);

      if (staffRes && staffRes.ok) {
        const data = await staffRes.json();
        const raw = Array.isArray(data) ? data : (data?.staff || []);
        setStaff(raw.map((s: any) => ({
          ...s,
          _id: toId(s._id || s.id),
          user_id: toId(s.user_id),
          parent_id: toId(s.parent_id),
          name: s.name || s.username || s.full_name || "Staff Member",
          designation: s.designation || (s.role_type ? s.role_type.toUpperCase() : "Staff"),
          role_type: s.role_type || "teacher",
          status: s.status || "active",
          password: s.password || s.raw_password,
          raw_password: s.raw_password || s.password,
          email: s.email || (s.username ? `${s.username}@scre.in` : "staff@scre.in"),
          phone: s.phone || s.mobile || "N/A",
          basic_salary: Number(s.basic_salary ?? s.salary ?? 35000),
          allowances: Number(s.allowances ?? 2500),
          deductions: Number(s.deductions ?? 1000),
          assigned_centers: Array.isArray(s.assigned_centers) ? s.assigned_centers : (s.assigned_centers ? [String(s.assigned_centers)] : []),
          permissions: s.permissions || {}
        })));
      }

      if (centersRes && centersRes.ok) {
        const cData = await centersRes.json();
        const rawC = Array.isArray(cData) ? cData : (cData?.centers || cData?.items || []);
        setCenters(rawC.map((c: any) => ({ ...c, _id: toId(c._id || c.id) })));
      }

      if (studentsRes && studentsRes.ok) {
        const stData = await studentsRes.json();
        const rawSt = Array.isArray(stData) ? stData : (stData?.students || []);
        setStudents(rawSt);
        setStudentsCount(rawSt.length);
      }
    } catch (error) {
      toast.error("Failed to load staff management data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const openTransferModal = (member: StaffMember) => {
    setTransferMember(member);
    setTransferReason("SuperAdmin Administrative Re-allotment");
    if (centers.length > 0) {
      const c = centers[0];
      setTargetCenterId(c._id);
      setTargetCenterName(c.name || c.centerName || "Branch Center");
    } else {
      setTargetCenterId("hq_direct");
      setTargetCenterName("HQ Direct (All Centers)");
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferMember || !targetCenterId) return;
    setTransferring(true);

    try {
      const targetId = transferMember._id || transferMember.user_id || (transferMember as any).id || transferMember.username;
      const res = await apiFetch(`/api/staff/${targetId}/transfer`, {
        method: "POST",
        body: JSON.stringify({
          target_center_id: targetCenterId,
          target_center_name: targetCenterName,
          transfer_reason: transferReason
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        toast.success(data.message || `Staff member transferred to ${targetCenterName} successfully!`);
        setTransferMember(null);
        fetchAllData();
      } else {
        toast.error(data.message || "Failed to execute staff transfer");
      }
    } catch {
      toast.error("Network error executing staff transfer");
    } finally {
      setTransferring(false);
    }
  };

  const openEditModal = (member: StaffMember) => {
    setEditingMember(member);
    setEditFormData({
      name: member.name || "",
      designation: member.designation || "",
      role_type: member.role_type || "alternate_staff",
      phone: member.phone || "",
      email: member.email || "",
      status: member.status || "active",
      password: "",
      basic_salary: member.basic_salary || 35000,
      assigned_center: member.assigned_centers?.[0] || ""
    });
    setEditPermissions({
      can_manage_students: !!member.permissions?.can_manage_students,
      can_manage_attendance: !!member.permissions?.can_manage_attendance,
      can_manage_fees: !!member.permissions?.can_manage_fees,
      can_manage_courses: !!member.permissions?.can_manage_courses,
      can_manage_exams: !!member.permissions?.can_manage_exams,
      can_view_reports: !!member.permissions?.can_view_reports,
      can_manage_staff: !!member.permissions?.can_manage_staff,
      can_manage_enquiries: !!member.permissions?.can_manage_enquiries,
      can_issue_certificates: !!member.permissions?.can_issue_certificates,
    });
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setUpdating(true);
    try {
      const payload: any = {
        ...editFormData,
        permissions: editPermissions,
        assigned_centers: editFormData.assigned_center ? [editFormData.assigned_center] : undefined
      };
      if (!payload.password.trim()) {
        delete payload.password;
      }

      const res = await apiFetch(`/api/staff/${editingMember._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Staff details & permissions updated successfully");
        setEditingMember(null);
        fetchAllData();
      } else {
        const d = await res.json();
        toast.error(d.message || "Failed to update staff");
      }
    } catch {
      toast.error("Error connecting to server");
    } finally {
      setUpdating(false);
    }
  };

  const toggleStatus = async (member: StaffMember) => {
    const nextStatus = member.status === "active" ? "inactive" : "active";
    try {
      const res = await apiFetch(`/api/staff/${member._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        toast.success(`Staff marked as ${nextStatus}`);
        setStaff(prev =>
          prev.map(s => (s._id === member._id ? { ...s, status: nextStatus } : s))
        );
      } else {
        toast.error("Failed to change status");
      }
    } catch {
      toast.error("Error updating status");
    }
  };

  const handleDelete = async (member: StaffMember) => {
    if (!window.confirm(`Are you sure you want to terminate/delete staff member "${member.name}"?`)) {
      return;
    }
    try {
      const res = await apiFetch(`/api/staff/${member._id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Staff member removed successfully");
        setStaff(prev => prev.filter(s => s._id !== member._id));
      } else {
        const d = await res.json();
        toast.error(d.message || "Failed to delete staff");
      }
    } catch {
      toast.error("Error deleting staff");
    }
  };

  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      const matchesQuery =
        (s.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.username || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.designation || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.assigned_centers && s.assigned_centers.some(c => c.toLowerCase().includes(searchQuery.toLowerCase())));

      const matchesRole =
        roleFilter === "all" || (s.role_type || "").toLowerCase() === roleFilter.toLowerCase();

      const matchesCenter =
        centerFilter === "all" ||
        (s.assigned_centers && s.assigned_centers.some(c => c.toLowerCase().includes(centerFilter.toLowerCase())));

      return matchesQuery && matchesRole && matchesCenter;
    });
  }, [staff, searchQuery, roleFilter, centerFilter]);

  const stats = useMemo(() => {
    const total = staff.length;
    const active = staff.filter(s => (s.status || "active").toLowerCase() === "active").length;
    const totalPayroll = staff.reduce((acc, s) => acc + (s.basic_salary || 35000), 0);
    const totalCenters = centers.length;
    return { total, active, totalPayroll, totalCenters };
  }, [staff, centers]);

  const exportStaffExcelCSV = () => {
    if (staff.length === 0) {
      toast.error("No staff records to export");
      return;
    }
    const headers = ["Staff ID", "Name", "Username", "Designation", "Role Type", "Assigned Center", "Phone", "Email", "Monthly Salary", "Status"];
    const rows = filteredStaff.map(s => [
      `"${s._id}"`,
      `"${s.name || ""}"`,
      `"${s.username || ""}"`,
      `"${s.designation || ""}"`,
      `"${s.role_type || ""}"`,
      `"${s.assigned_centers?.[0] || "HQ Direct"}"`,
      `"${s.phone || ""}"`,
      `"${s.email || ""}"`,
      `"${s.basic_salary || 35000}"`,
      `"${s.status || "active"}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SCRE_Staff_Directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Staff Directory Excel CSV exported successfully!");
  };

  const exportCenterWiseReportCSV = () => {
    const headers = ["Center Code", "Center Name", "City", "Assigned Staff Count", "Active Students Count"];
    const rows = centers.map(c => {
      const cName = c.name || c.centerName || "";
      const cCode = c.code || "";
      const staffInCenter = staff.filter(s => s.assigned_centers && s.assigned_centers.some(sc => sc.includes(cName) || sc.includes(cCode))).length;
      const stInCenter = students.filter(st => toId(st.center_id) === c._id || st.center_code === cCode).length;
      return [
        `"${cCode}"`,
        `"${cName}"`,
        `"${c.city || "Gujarat"}"`,
        `"${staffInCenter}"`,
        `"${stInCenter}"`
      ];
    });

    // Add HQ Direct Row
    const hqStaffCount = staff.filter(s => !s.assigned_centers || s.assigned_centers.length === 0 || s.assigned_centers.some(sc => sc.includes("HQ"))).length;
    rows.push([`"HQ-000"`, `"HQ Central Management Direct"`, `"Central"`, `"${hqStaffCount}"`, `"${studentsCount}"`]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SCRE_Center_Wise_Staff_Student_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Center-wise Staff & Student Excel CSV report exported!");
  };

  const getRoleBadge = (role: string) => {
    switch (role?.toLowerCase()) {
      case "teacher":
        return { label: "Teacher / Faculty", color: "text-blue-400 bg-blue-500/10 border-blue-500/30" };
      case "accountant":
        return { label: "Accountant", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
      case "counselor":
        return { label: "Counselor / CRM", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" };
      case "center_admin":
        return { label: "Center Coordinator", color: "text-purple-400 bg-purple-500/10 border-purple-500/30" };
      case "peon":
        return { label: "Support / Helper", color: "text-slate-400 bg-slate-800 border-slate-700" };
      default:
        return { label: "Staff", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30" };
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16 relative">
        {/* Ambient glows */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />

        {/* Page Banner Header */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-heading font-black text-2xl md:text-3xl text-white uppercase tracking-tight">
                  Staff Management &amp; Center Transfer Hub
                </h1>
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                  {staff.length} Personnel
                </span>
              </div>
              <p className="text-slate-400 mt-1 text-xs md:text-sm font-medium">
                SuperAdmin enterprise directory, RBAC privilege matrix, center-wise staff transfers, and payroll records.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={exportStaffExcelCSV}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export Excel CSV
            </button>
            <button
              onClick={exportCenterWiseReportCSV}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <Building2 className="w-4 h-4 text-purple-400" /> Center Report
            </button>
            <Link to="/dashboard/staff/add">
              <button className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all cursor-pointer">
                <PlusCircle className="w-4 h-4" /> Add New Staff
              </button>
            </Link>
          </div>
        </div>

        {/* Analytics Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-5 shadow-2xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Staff Members</p>
            <p className="text-3xl font-black text-white mt-1">{stats.total}</p>
          </div>
          <div className="bg-slate-900/80 backdrop-blur-2xl border border-emerald-500/30 rounded-3xl p-5 shadow-2xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Active Personnel</p>
            <p className="text-3xl font-black text-emerald-300 mt-1">{stats.active}</p>
          </div>
          <div className="bg-slate-900/80 backdrop-blur-2xl border border-purple-500/30 rounded-3xl p-5 shadow-2xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Active Centers</p>
            <p className="text-3xl font-black text-purple-300 mt-1">{stats.totalCenters}</p>
          </div>
          <div className="bg-slate-900/80 backdrop-blur-2xl border border-amber-500/30 rounded-3xl p-5 shadow-2xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Monthly Payroll Cost</p>
            <p className="text-3xl font-black text-amber-300 mt-1">₹{stats.totalPayroll.toLocaleString("en-IN")}</p>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-4 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold uppercase text-slate-400">Role:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Roles</option>
                <option value="teacher">Teacher / Faculty</option>
                <option value="accountant">Accountant</option>
                <option value="counselor">Counselor</option>
                <option value="center_admin">Center Coordinator</option>
                <option value="peon">Support Staff</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold uppercase text-slate-400">Center:</span>
              <select
                value={centerFilter}
                onChange={(e) => setCenterFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Centers</option>
                {centers.map(c => (
                  <option key={c._id} value={c.name || c.centerName || c.code}>
                    {c.name || c.centerName} ({c.code || "CTR"})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff name, designation, username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-semibold text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Staff Records...</p>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl p-16 flex flex-col items-center text-center">
            <Users className="w-12 h-12 text-slate-500 mb-4 opacity-60" />
            <h3 className="text-lg font-bold text-white uppercase tracking-tight">No Staff Members Found</h3>
            <p className="text-slate-400 text-xs max-w-sm mt-1">
              No staff records matched your search query or role filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStaff.map((member) => {
              const badge = getRoleBadge(member.role_type);
              const perms = member.permissions || ({} as StaffPermissions);
              const enabledPermCount = Object.values(perms).filter(Boolean).length;
              const assignedCenter = member.assigned_centers?.[0] || "Scre Central Academy Ahmedabad";

              return (
                <div
                  key={member._id}
                  className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-6 shadow-2xl hover:border-indigo-500/40 transition-all duration-300 flex flex-col justify-between group"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold group-hover:scale-105 transition-transform">
                        <Users className="w-6 h-6" />
                      </div>
                      <button
                        onClick={() => toggleStatus(member)}
                        className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border cursor-pointer transition-all",
                          member.status === "active"
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                            : "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
                        )}
                      >
                        {member.status === "active" ? "● Active" : "○ Inactive"}
                      </button>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-lg font-black text-white uppercase tracking-tight group-hover:text-indigo-300 transition-colors">
                        {member.name}
                      </h3>
                      <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                        {member.designation}
                      </p>
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border", badge.color)}>
                          {badge.label}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-950 border border-slate-800 text-slate-400 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-purple-400" />
                          {assignedCenter}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500 font-medium">Username:</span>
                        <span className="font-mono font-bold text-indigo-300">@{member.username}</span>
                      </div>
                      {member.phone && (
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-500 font-medium">Phone:</span>
                          <span className="font-semibold">{member.phone}</span>
                        </div>
                      )}
                      {member.email && (
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-500 font-medium">Email:</span>
                          <span className="font-medium text-slate-400 truncate max-w-[180px]">{member.email}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800/60">
                        <span className="text-slate-500 font-medium">Basic Salary:</span>
                        <span className="font-bold text-amber-400">₹{(member.basic_salary || 35000).toLocaleString("en-IN")}/mo</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Privileges:</span>
                      <span className="text-xs font-bold text-indigo-400">{enabledPermCount} Granted</span>
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => setViewMember(member)}
                        title="View Profile"
                        className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs uppercase flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openEditModal(member)}
                        title="Edit & Permissions"
                        className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs uppercase flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openTransferModal(member)}
                        title="SuperAdmin Staff Transfer"
                        className="py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 font-bold text-xs uppercase flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(member)}
                        title="Delete Staff"
                        className="py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs uppercase flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VIEW STAFF PROFILE MODAL */}
        {viewMember && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">{viewMember.name}</h2>
                  <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mt-0.5">{viewMember.designation}</p>
                </div>
                <button onClick={() => setViewMember(null)} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs font-medium text-slate-300">
                <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Username</span>
                    <span className="font-bold text-white">@{viewMember.username}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Assigned Center</span>
                    <span className="font-bold text-purple-300">{viewMember.assigned_centers?.[0] || "HQ Direct"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Contact Phone</span>
                    <span className="font-bold text-slate-200">{viewMember.phone || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Email Address</span>
                    <span className="font-bold text-slate-200">{viewMember.email || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Monthly Salary</span>
                    <span className="font-bold text-amber-400">₹{(viewMember.basic_salary || 35000).toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Status</span>
                    <span className="font-bold text-emerald-400 uppercase">{viewMember.status || "active"}</span>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-800">
                    <span className="text-amber-400 text-[10px] uppercase font-bold flex items-center gap-1">
                      <Key className="w-3.5 h-3.5" /> Account Password
                    </span>
                    <div className="flex items-center justify-between mt-1 bg-slate-900/90 px-3 py-2 rounded-xl border border-amber-500/20">
                      <span className="font-mono font-bold text-white tracking-wider">
                        {showStaffPassword ? (viewMember.raw_password || viewMember.password || "No plain password saved") : "••••••••••••"}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowStaffPassword(!showStaffPassword)}
                          className="text-slate-400 hover:text-white"
                          title="Toggle View Password"
                        >
                          {showStaffPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        {(viewMember.raw_password || viewMember.password) && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(viewMember.raw_password || viewMember.password || "");
                              toast.success("Staff password copied to clipboard!");
                            }}
                            className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[9px] font-bold uppercase"
                          >
                            Copy
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">System Privileges Granted:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {permissionLabels.map((p) => {
                      const granted = viewMember.permissions?.[p.key];
                      return (
                        <div key={p.key} className={cn("p-2.5 rounded-xl border text-xs flex items-center justify-between", granted ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300" : "bg-slate-950/60 border-slate-800 text-slate-500")}>
                          <span>{p.title}</span>
                          {granted ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-slate-600" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button onClick={() => setViewMember(null)} className="px-6 py-2.5 rounded-2xl bg-slate-800 text-slate-200 font-bold text-xs uppercase tracking-wider">
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUPERADMIN STAFF TRANSFER MODAL */}
        {transferMember && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-purple-500/40 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 relative overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white uppercase tracking-tight">SuperAdmin Staff Transfer</h2>
                    <p className="text-xs text-slate-400">Re-assign {transferMember.name} to another center branch</p>
                  </div>
                </div>
                <button onClick={() => setTransferMember(null)} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <p className="text-slate-400 font-bold uppercase text-[10px]">Staff Member:</p>
                  <p className="text-sm font-black text-white">{transferMember.name} (@{transferMember.username})</p>
                  <p className="text-slate-400">Current Center: <span className="text-indigo-300 font-semibold">{transferMember.assigned_centers?.[0] || "HQ Direct"}</span></p>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Target Center Branch *</label>
                  <select
                    required
                    value={targetCenterId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setTargetCenterId(selectedId);
                      const found = centers.find(c => c._id === selectedId);
                      setTargetCenterName(found ? (found.name || found.centerName || "") : "HQ Direct (All Centers)");
                    }}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-bold text-slate-100 focus:outline-none focus:border-purple-500"
                  >
                    {centers.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.name || c.centerName} ({c.code || "CTR"})
                      </option>
                    ))}
                    <option value="hq_direct">HQ Direct (All Centers)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Transfer Notes &amp; Reason</label>
                  <textarea
                    rows={3}
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    placeholder="Enter transfer justification or administrative notes..."
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setTransferMember(null)} className="px-5 py-2.5 rounded-2xl bg-slate-800 text-slate-300 font-bold text-xs uppercase tracking-wider">
                    Cancel
                  </button>
                  <button type="submit" disabled={transferring} className="px-6 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-purple-500/25">
                    {transferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                    Confirm Transfer
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* EDIT STAFF & PERMISSIONS MODAL */}
        {editingMember && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">Edit Staff &amp; Privileges</h2>
                  <p className="text-xs text-slate-400">@{editingMember.username} • {editingMember.name}</p>
                </div>
                <button onClick={() => setEditingMember(null)} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateSubmit} className="space-y-6 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Full Name</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-bold text-white focus:border-indigo-500 outline-none"
                      value={editFormData.name}
                      onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Designation</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-bold text-white focus:border-indigo-500 outline-none"
                      value={editFormData.designation}
                      onChange={e => setEditFormData({ ...editFormData, designation: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Role Template</label>
                    <select
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-bold text-white focus:border-indigo-500 outline-none"
                      value={editFormData.role_type}
                      onChange={e => setEditFormData({ ...editFormData, role_type: e.target.value })}
                    >
                      <option value="teacher">TEACHER / FACULTY</option>
                      <option value="accountant">ACCOUNTANT</option>
                      <option value="counselor">COUNSELOR / CRM</option>
                      <option value="center_admin">CENTER COORDINATOR</option>
                      <option value="peon">SUPPORT STAFF</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Monthly Salary (₹)</label>
                    <input
                      type="number"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-bold text-white focus:border-indigo-500 outline-none"
                      value={editFormData.basic_salary}
                      onChange={e => setEditFormData({ ...editFormData, basic_salary: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                {/* Permissions Grid */}
                <div className="border-t border-slate-800 pt-4 space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">RBAC Privileges Matrix</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {permissionLabels.map((p) => {
                      const isChecked = editPermissions[p.key];
                      return (
                        <div
                          key={p.key}
                          onClick={() => setEditPermissions(prev => ({ ...prev, [p.key]: !prev[p.key] }))}
                          className={cn("p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-2", isChecked ? "bg-indigo-600/20 border-indigo-500 text-indigo-200 font-bold" : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white")}
                        >
                          <span className="text-xs">{p.title}</span>
                          {isChecked ? <CheckCircle2 className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4 text-slate-600" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                  <button type="button" onClick={() => setEditingMember(null)} className="px-5 py-2.5 rounded-2xl bg-slate-800 text-slate-300 font-bold text-xs uppercase tracking-wider">
                    Cancel
                  </button>
                  <button disabled={updating} type="submit" className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-500/25">
                    {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Save Staff Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StaffListPage;
