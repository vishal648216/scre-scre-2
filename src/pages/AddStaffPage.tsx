import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield, Briefcase, Mail, Phone, Lock, Loader2, Send, CheckSquare, Square, Building2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface StaffPermissions {
  can_manage_students: boolean;
  can_manage_attendance: boolean;
  can_manage_fees: boolean;
  can_manage_courses: boolean;
  can_manage_exams: boolean;
  can_view_reports: boolean;
  can_manage_staff: boolean;
  can_manage_enquiries: boolean;
  can_issue_certificates: boolean;
}

const defaultPermissionsByRole: Record<string, StaffPermissions> = {
  teacher: {
    can_manage_students: true,
    can_manage_attendance: true,
    can_manage_fees: false,
    can_manage_courses: true,
    can_manage_exams: true,
    can_view_reports: false,
    can_manage_staff: false,
    can_manage_enquiries: false,
    can_issue_certificates: false,
  },
  accountant: {
    can_manage_students: false,
    can_manage_attendance: false,
    can_manage_fees: true,
    can_manage_courses: false,
    can_manage_exams: false,
    can_view_reports: true,
    can_manage_staff: false,
    can_manage_enquiries: false,
    can_issue_certificates: false,
  },
  counselor: {
    can_manage_students: true,
    can_manage_attendance: false,
    can_manage_fees: false,
    can_manage_courses: true,
    can_manage_exams: false,
    can_view_reports: false,
    can_manage_staff: false,
    can_manage_enquiries: true,
    can_issue_certificates: false,
  },
  center_admin: {
    can_manage_students: true,
    can_manage_attendance: true,
    can_manage_fees: true,
    can_manage_courses: true,
    can_manage_exams: true,
    can_view_reports: true,
    can_manage_staff: true,
    can_manage_enquiries: true,
    can_issue_certificates: true,
  },
  peon: {
    can_manage_students: false,
    can_manage_attendance: false,
    can_manage_fees: false,
    can_manage_courses: false,
    can_manage_exams: false,
    can_view_reports: false,
    can_manage_staff: false,
    can_manage_enquiries: false,
    can_issue_certificates: false,
  },
  alternate_staff: {
    can_manage_students: false,
    can_manage_attendance: false,
    can_manage_fees: false,
    can_manage_courses: false,
    can_manage_exams: false,
    can_view_reports: false,
    can_manage_staff: false,
    can_manage_enquiries: false,
    can_issue_certificates: false,
  },
};

const permissionLabels: { key: keyof StaffPermissions; title: string; desc: string }[] = [
  { key: "can_manage_students", title: "Students & Admissions", desc: "View student lists and process course enrollments" },
  { key: "can_manage_attendance", title: "Attendance Tracking", desc: "Mark daily student and batch attendance records" },
  { key: "can_manage_fees", title: "Fees & Payment Slips", desc: "Collect payments, view dues, and issue official fee receipts" },
  { key: "can_manage_courses", title: "Courses & Study Material", desc: "Manage assigned syllabus modules and digital content" },
  { key: "can_manage_exams", title: "Examinations & Marks", desc: "Allot tests, enter marks, and evaluate practicals" },
  { key: "can_view_reports", title: "Analytics & Finance Reports", desc: "Access center revenue stats and performance metrics" },
  { key: "can_manage_staff", title: "Staff Delegation", desc: "Ability to register or assign tasks to subordinate staff" },
  { key: "can_manage_enquiries", title: "Enquiry Register & CRM", desc: "Log walk-in inquiries, follow-up calls, and conversion to admission" },
  { key: "can_issue_certificates", title: "Certificate Issuance", desc: "Generate and approve course & exam completion certificates" },
];

const AddStaffPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [centers, setCenters] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
    designation: "",
    role_type: "teacher",
    phone: "",
    email: "",
    center_id: "",
  });

  const [permissions, setPermissions] = useState<StaffPermissions>(
    defaultPermissionsByRole["teacher"]
  );

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const uStr = localStorage.getItem("user") || sessionStorage.getItem("user");
      if (uStr) {
        const parsed = JSON.parse(uStr);
        setCurrentUser(parsed);
      }

      const res = await apiFetch("/api/centers");
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : data.items || [];
        setCenters(items);
      }
    } catch (e) {
      console.error("Failed to load centers:", e);
    }
  };

  const isSuperAdmin = currentUser?.role?.toLowerCase() === "superadmin" || currentUser?.role?.toLowerCase() === "admin";

  const handleRoleChange = (role: string) => {
    setFormData({ ...formData, role_type: role });
    if (defaultPermissionsByRole[role]) {
      setPermissions(defaultPermissionsByRole[role]);
    }
  };

  const togglePermission = (key: keyof StaffPermissions) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        permissions,
        center_id: isSuperAdmin ? formData.center_id : undefined,
      };

      const res = await apiFetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Staff member onboarded successfully with assigned permissions");
        navigate("/dashboard/staff/list");
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to register staff");
      }
    } catch (error) {
      toast.error("Error connecting to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
        {/* Page Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" /> Personnel Onboarding Workspace
          </div>
          <h1 className="font-heading font-black text-3xl sm:text-4xl text-foreground uppercase tracking-tight">
            Register New Staff
          </h1>
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider max-w-xl mx-auto">
            Onboard operational personnel, instructors, and center counselors with customized RBAC role permissions
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Profile Card */}
            <Card className="rounded-3xl border border-border bg-card shadow-lg md:col-span-2 overflow-hidden">
              <CardHeader className="bg-muted/40 border-b border-border py-4">
                <CardTitle className="text-xs font-black uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-2 text-foreground">
                    <Users className="w-4 h-4 text-primary" /> Staff Profile & Role Assignment
                  </span>
                  {!isSuperAdmin && currentUser?.center_name && (
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] font-black uppercase">
                      📍 {currentUser.center_name}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                    Full Name *
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      required
                      type="text"
                      className="w-full pl-10 pr-4 py-3 bg-muted/20 border border-border rounded-2xl text-xs font-bold uppercase focus:outline-none focus:border-primary transition-all text-foreground"
                      placeholder="ENTER FULL NAME"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                    Designation / Title *
                  </label>
                  <div className="relative">
                    <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      required
                      type="text"
                      className="w-full pl-10 pr-4 py-3 bg-muted/20 border border-border rounded-2xl text-xs font-bold uppercase focus:outline-none focus:border-primary transition-all text-foreground"
                      placeholder="E.G. SENIOR TRAINER, ADMISSION COUNSELOR"
                      value={formData.designation}
                      onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                    Role Template
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <select
                      className="w-full pl-10 pr-4 py-3 bg-muted/20 border border-border rounded-2xl text-xs font-bold uppercase focus:outline-none focus:border-primary transition-all text-foreground"
                      value={formData.role_type}
                      onChange={(e) => handleRoleChange(e.target.value)}
                    >
                      <option value="teacher">TEACHER / TRAINER (STUDENTS, ATTENDANCE & EXAMS)</option>
                      <option value="accountant">ACCOUNTANT (FEES COLLECTION & RECEIPTS)</option>
                      <option value="counselor">COUNSELOR / FRONT DESK (ENQUIRIES & ADMISSIONS)</option>
                      <option value="center_admin">CENTER COORDINATOR / ADMIN (FULL CENTER ACCESS)</option>
                      <option value="peon">SUPPORT / HELPER (PRESENCE ONLY)</option>
                      <option value="alternate_staff">CUSTOM ROLE (MANUAL PERMISSIONS)</option>
                    </select>
                  </div>
                </div>

                {isSuperAdmin ? (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                      Assigned Center / Branch
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <select
                        className="w-full pl-10 pr-4 py-3 bg-muted/20 border border-border rounded-2xl text-xs font-bold uppercase focus:outline-none focus:border-primary transition-all text-foreground"
                        value={formData.center_id}
                        onChange={(e) => setFormData({ ...formData, center_id: e.target.value })}
                      >
                        <option value="">HQ GLOBAL / HEAD OFFICE STAFF (ALL CENTERS)</option>
                        {centers.map((c) => (
                          <option key={c._id || c.id} value={c.user_id || c._id || c.id}>
                            {c.center_name || c.name} ({c.code || "CENTER"})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="tel"
                        className="w-full pl-10 pr-4 py-3 bg-muted/20 border border-border rounded-2xl text-xs font-bold uppercase focus:outline-none focus:border-primary transition-all text-foreground"
                        placeholder="ENTER 10-DIGIT MOBILE NUMBER"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {isSuperAdmin && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="tel"
                        className="w-full pl-10 pr-4 py-3 bg-muted/20 border border-border rounded-2xl text-xs font-bold uppercase focus:outline-none focus:border-primary transition-all text-foreground"
                        placeholder="ENTER 10-DIGIT MOBILE NUMBER"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                    Email Address (Optional)
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      className="w-full pl-10 pr-4 py-3 bg-muted/20 border border-border rounded-2xl text-xs font-medium focus:outline-none focus:border-primary transition-all text-foreground"
                      placeholder="staff@screduc.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Granular Permissions Matrix */}
            <Card className="rounded-3xl border border-border bg-card shadow-lg md:col-span-2 overflow-hidden">
              <CardHeader className="bg-muted/40 border-b border-border py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-foreground">
                    <Shield className="w-4 h-4 text-primary" /> Role-Based Access Control (RBAC) Permissions
                  </CardTitle>
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-black uppercase rounded-full px-3 py-1">
                    Template: {formData.role_type.replace('_', ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-xs text-muted-foreground mb-4 font-medium">
                  Check or uncheck individual privileges to fine-tune access for this staff member:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {permissionLabels.map((perm) => {
                    const isChecked = permissions[perm.key];
                    return (
                      <div
                        key={perm.key}
                        onClick={() => togglePermission(perm.key)}
                        className={`p-4 rounded-2xl border cursor-pointer select-none transition-all flex flex-col justify-between ${
                          isChecked
                            ? "border-primary/50 bg-primary/10 text-foreground shadow-sm"
                            : "border-border bg-muted/20 text-muted-foreground hover:border-border/80"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-black uppercase tracking-tight">
                            {perm.title}
                          </span>
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed font-medium">
                          {perm.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Login Credentials */}
            <Card className="rounded-3xl border border-border bg-card shadow-lg md:col-span-2 overflow-hidden">
              <CardHeader className="bg-muted/40 border-b border-border py-4">
                <CardTitle className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-foreground">
                  <Lock className="w-4 h-4 text-primary" /> Account Login Credentials
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                    Staff Login Username *
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      required
                      type="text"
                      className="w-full pl-10 pr-4 py-3 bg-muted/20 border border-border rounded-2xl text-xs font-bold focus:outline-none focus:border-primary transition-all text-foreground"
                      placeholder="e.g. staff_rahul"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                    Staff Login Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      required
                      type="password"
                      className="w-full pl-10 pr-4 py-3 bg-muted/20 border border-border rounded-2xl text-xs font-bold focus:outline-none focus:border-primary transition-all text-foreground"
                      placeholder="••••••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center pt-4">
            <button
              disabled={loading}
              type="submit"
              className="flex items-center gap-3 px-10 py-4 bg-primary text-primary-foreground rounded-2xl text-xs font-black uppercase tracking-wider hover:opacity-90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              Finalize Staff Registration
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default AddStaffPage;
