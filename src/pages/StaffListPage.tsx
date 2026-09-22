import { useState, useEffect } from "react";
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
  name: string;
  username: string;
  designation: string;
  role_type: string;
  email?: string;
  phone?: string;
  status: string;
  permissions?: StaffPermissions;
  created_at?: string;
}

const permissionLabels: { key: keyof StaffPermissions; title: string }[] = [
  { key: "can_manage_students", title: "Students & Admissions" },
  { key: "can_manage_attendance", title: "Attendance" },
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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

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

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/staff");
      if (res.ok) {
        const data = await res.json();
        setStaff(data);
      }
    } catch (error) {
      toast.error("Failed to load staff list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

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
        fetchStaff();
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

  const filteredStaff = staff.filter(s => {
    const matchesQuery =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole =
      roleFilter === "all" || s.role_type.toLowerCase() === roleFilter.toLowerCase();

    return matchesQuery && matchesRole;
  });

  const getRoleBadge = (role: string) => {
    switch (role?.toLowerCase()) {
      case "teacher":
        return { label: "Teacher / Trainer", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" };
      case "accountant":
        return { label: "Accountant", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" };
      case "counselor":
        return { label: "Counselor / Front Desk", color: "text-amber-600 bg-amber-500/10 border-amber-500/20" };
      case "center_admin":
        return { label: "Center Coordinator", color: "text-primary bg-primary/10 border-primary/20" };
      case "peon":
        return { label: "Support / Helper", color: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20" };
      default:
        return { label: "Staff", color: "text-muted-foreground bg-muted border-border" };
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
              Staff Management & RBAC Directory
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium uppercase tracking-widest font-black text-[10px]">
              Manage operational personnel, role privileges, and system access
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard/staff/add"
              className="px-4 py-2.5 bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-90 shadow-md transition-all"
            >
              <PlusCircle className="w-4 h-4" /> Add New Staff
            </Link>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/20 p-4 border border-border">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Filter Role:
            </span>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="px-3 py-2 bg-background border border-border text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-primary"
            >
              <option value="all">All Roles</option>
              <option value="teacher">Teacher / Trainer</option>
              <option value="accountant">Accountant</option>
              <option value="counselor">Counselor</option>
              <option value="center_admin">Center Coordinator</option>
              <option value="peon">Support / Helper</option>
            </select>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="SEARCH BY NAME, DESIGNATION, USER..."
              className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-none text-xs font-bold uppercase focus:outline-none focus:border-primary transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStaff.map(member => {
              const badge = getRoleBadge(member.role_type);
              const perms = member.permissions || ({} as StaffPermissions);
              const enabledPermCount = Object.values(perms).filter(Boolean).length;

              return (
                <Card
                  key={member._id}
                  className="rounded-none border-border shadow-md hover:border-primary/20 transition-all group overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div
                      className={cn(
                        "h-1.5 w-full",
                        member.role_type === "center_admin"
                          ? "bg-primary"
                          : member.role_type === "teacher"
                          ? "bg-blue-500"
                          : member.role_type === "accountant"
                          ? "bg-emerald-500"
                          : member.role_type === "counselor"
                          ? "bg-amber-500"
                          : "bg-muted"
                      )}
                    />
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-muted flex items-center justify-center rounded-none group-hover:scale-110 transition-transform">
                          <Users className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleStatus(member)}
                            className={cn(
                              "text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 border transition-all cursor-pointer",
                              member.status === "active"
                                ? "text-green-600 border-green-600/20 bg-green-600/5 hover:bg-green-600/15"
                                : "text-destructive border-destructive/20 bg-destructive/5 hover:bg-destructive/15"
                            )}
                            title="Click to toggle status"
                          >
                            {member.status === "active" ? (
                              <span className="flex items-center gap-1">
                                <CheckCircle className="w-2.5 h-2.5" /> ACTIVE
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <XCircle className="w-2.5 h-2.5" /> INACTIVE
                              </span>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-lg uppercase tracking-tight leading-none">
                            {member.name}
                          </h3>
                        </div>
                        <p className="text-[10px] font-black text-foreground uppercase tracking-widest">
                          {member.designation}
                        </p>
                        <span
                          className={cn(
                            "inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 border mt-1",
                            badge.color
                          )}
                        >
                          {badge.label}
                        </span>
                      </div>

                      {/* Contact and Login Info */}
                      <div className="mt-5 space-y-2 border-t border-border/50 pt-3">
                        <div className="flex items-center gap-2.5 text-muted-foreground">
                          <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-[11px] font-bold tracking-tight text-foreground">
                            @{member.username}
                          </span>
                        </div>
                        {member.email && (
                          <div className="flex items-center gap-2.5 text-muted-foreground">
                            <Mail className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[11px] font-medium lowercase truncate">
                              {member.email}
                            </span>
                          </div>
                        )}
                        {member.phone && (
                          <div className="flex items-center gap-2.5 text-muted-foreground">
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[11px] font-medium tracking-tight">
                              {member.phone}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Active Permissions Summary */}
                      <div className="mt-4 pt-3 border-t border-border/50">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                          Privileges: {enabledPermCount} Granted
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {permissionLabels
                            .filter(p => perms[p.key])
                            .slice(0, 3)
                            .map(p => (
                              <span
                                key={p.key}
                                className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-muted border border-border text-foreground"
                              >
                                {p.title}
                              </span>
                            ))}
                          {enabledPermCount > 3 && (
                            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20">
                              +{enabledPermCount - 3} MORE
                            </span>
                          )}
                          {enabledPermCount === 0 && (
                            <span className="text-[8px] font-medium italic text-muted-foreground">
                              View Only
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </div>

                  {/* Actions Bar */}
                  <div className="p-6 pt-0">
                    <div className="flex gap-2 border-t border-border pt-4">
                      <button
                        onClick={() => openEditModal(member)}
                        className="flex-1 py-2 text-[9px] font-black uppercase tracking-widest bg-muted hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-1.5"
                      >
                        <Edit2 className="w-3 h-3" /> Edit / RBAC
                      </button>
                      <button
                        onClick={() => handleDelete(member)}
                        className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-destructive hover:bg-destructive hover:text-white transition-all border border-destructive/20 flex items-center justify-center gap-1"
                        title="Delete staff"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}

            {filteredStaff.length === 0 && (
              <div className="col-span-full py-20 text-center border-2 border-dashed border-border">
                <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  No staff members found matching criteria
                </p>
              </div>
            )}
          </div>
        )}

        {/* Edit Staff & Permissions Modal */}
        {editingMember && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-background border-2 border-border max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-border bg-muted/20">
                <div>
                  <h2 className="font-heading font-extrabold text-xl uppercase tracking-tight">
                    Edit Staff & Privileges
                  </h2>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    @{editingMember.username} • {editingMember.name}
                  </p>
                </div>
                <button
                  onClick={() => setEditingMember(null)}
                  className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                      Full Name
                    </label>
                    <input
                      required
                      type="text"
                      className="w-full px-3 py-2 bg-background border border-border text-xs font-bold uppercase focus:border-primary outline-none"
                      value={editFormData.name}
                      onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                      Designation
                    </label>
                    <input
                      required
                      type="text"
                      className="w-full px-3 py-2 bg-background border border-border text-xs font-bold uppercase focus:border-primary outline-none"
                      value={editFormData.designation}
                      onChange={e =>
                        setEditFormData({ ...editFormData, designation: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                      Role Template
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-background border border-border text-xs font-bold uppercase focus:border-primary outline-none"
                      value={editFormData.role_type}
                      onChange={e =>
                        setEditFormData({ ...editFormData, role_type: e.target.value })
                      }
                    >
                      <option value="teacher">TEACHER / TRAINER</option>
                      <option value="accountant">ACCOUNTANT</option>
                      <option value="counselor">COUNSELOR / FRONT DESK</option>
                      <option value="center_admin">CENTER COORDINATOR</option>
                      <option value="peon">SUPPORT / HELPER</option>
                      <option value="alternate_staff">CUSTOM ROLE</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                      Account Status
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-background border border-border text-xs font-bold uppercase focus:border-primary outline-none"
                      value={editFormData.status}
                      onChange={e => setEditFormData({ ...editFormData, status: e.target.value })}
                    >
                      <option value="active">ACTIVE</option>
                      <option value="inactive">INACTIVE / SUSPENDED</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      className="w-full px-3 py-2 bg-background border border-border text-xs font-bold uppercase focus:border-primary outline-none"
                      value={editFormData.phone}
                      onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      className="w-full px-3 py-2 bg-background border border-border text-xs font-medium focus:border-primary outline-none"
                      value={editFormData.email}
                      onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                      Reset Password (leave empty to keep current)
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="password"
                        placeholder="ENTER NEW PASSWORD"
                        className="w-full pl-10 pr-3 py-2 bg-background border border-border text-xs font-bold focus:border-primary outline-none"
                        value={editFormData.password}
                        onChange={e =>
                          setEditFormData({ ...editFormData, password: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Granular Permissions Editor */}
                <div className="border-t border-border pt-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3">
                    RBAC Privileges Matrix
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {permissionLabels.map(p => {
                      const isChecked = editPermissions[p.key];
                      return (
                        <div
                          key={p.key}
                          onClick={() =>
                            setEditPermissions(prev => ({
                              ...prev,
                              [p.key]: !prev[p.key],
                            }))
                          }
                          className={`p-3 border cursor-pointer select-none transition-all flex items-center justify-between gap-2 ${
                            isChecked
                              ? "border-primary bg-primary/10 text-foreground font-bold"
                              : "border-border bg-card/40 text-muted-foreground hover:border-border/80"
                          }`}
                        >
                          <span className="text-xs">{p.title}</span>
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingMember(null)}
                    className="px-5 py-2.5 border border-border text-xs font-bold uppercase tracking-wider hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={updating}
                    type="submit"
                    className="px-6 py-2.5 bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
                  >
                    {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Save Changes
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
