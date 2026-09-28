import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, UserCheck, UserMinus, Search, Shield, ShieldOff, Clock, Filter, 
  Loader2, Trash2, Edit, Eye, EyeOff, Download, Key, Mail, Phone, CheckCircle2, XCircle, X
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface AdminUser {
  _id?: string;
  id?: string;
  username: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  role: string;
  status?: string;
  active?: boolean;
  joined?: string;
  created_at?: string;
  raw_password?: string;
}

const AdminListPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  // State
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  
  // Modals state
  const [viewingAdmin, setViewingAdmin] = useState<AdminUser | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [adminToDelete, setAdminToDelete] = useState<AdminUser | null>(null);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  
  // Form edit state
  const [editForm, setEditForm] = useState({
    username: "",
    full_name: "",
    email: "",
    phone: "",
    role: "admin",
    active: true,
    new_password: "",
  });
  
  // Loading states
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch Administrators
  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/admin/users");
      if (response.ok) {
        const data = await response.json();
        // Filter administrators (role admin, superadmin, or subadmin)
        const adminList = (data as AdminUser[]).filter(
          (u) => 
            u.role?.toLowerCase() === "admin" || 
            u.role?.toLowerCase() === "superadmin" || 
            u.role?.toLowerCase() === "subadmin"
        );
        setAdmins(adminList.length > 0 ? adminList : (data as AdminUser[]));
      } else {
        toast.error(t("Failed to load admin directory"));
      }
    } catch (error) {
      console.error("Failed to fetch admins:", error);
      toast.error(t("Failed to load admin directory"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  // 1. Enable / Disable Toggle Handler
  const handleToggleStatus = async (admin: AdminUser) => {
    const targetId = admin.id || admin._id;
    if (!targetId) return;

    const currentActive = admin.active !== undefined ? admin.active : admin.status === "Active";
    const nextActive = !currentActive;

    setTogglingId(targetId);
    try {
      const res = await apiFetch(`/api/admin/users/${targetId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        toast.success(
          nextActive 
            ? t("Admin account enabled successfully") 
            : t("Admin account disabled successfully")
        );
        // Optimistic UI update
        setAdmins((prev) =>
          prev.map((a) => {
            const aId = a.id || a._id;
            if (aId === targetId) {
              return {
                ...a,
                active: nextActive,
                status: nextActive ? "Active" : "Inactive",
              };
            }
            return a;
          })
        );
      } else {
        toast.error(data.message || t("Failed to toggle admin status"));
      }
    } catch (e) {
      toast.error(t("Error updating admin status"));
    } finally {
      setTogglingId(null);
    }
  };

  // 2. Open Edit Modal
  const openEditModal = (admin: AdminUser) => {
    setEditingAdmin(admin);
    const isAct = admin.active !== undefined ? admin.active : admin.status === "Active";
    const existingName = admin.full_name || `${admin.first_name || ""} ${admin.last_name || ""}`.trim();
    setEditForm({
      username: admin.username || "",
      full_name: existingName || admin.username || "",
      email: admin.email || "",
      phone: admin.phone || "",
      role: admin.role?.toLowerCase() || "admin",
      active: isAct,
      new_password: "",
    });
  };

  // 3. Save Edit Admin
  const handleSaveEdit = async () => {
    if (!editingAdmin) return;
    const targetId = editingAdmin.id || editingAdmin._id;
    if (!targetId) return;

    if (!editForm.username.trim()) {
      toast.error(t("Username is required"));
      return;
    }

    setSavingEdit(true);
    try {
      const payload: any = {
        username: editForm.username.trim(),
        full_name: editForm.full_name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        role: editForm.role,
        active: editForm.active,
        status: editForm.active ? "Active" : "Inactive",
      };

      if (editForm.new_password.trim()) {
        payload.password = editForm.new_password.trim();
      }

      const res = await apiFetch(`/api/admin/users/${targetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        toast.success(t("Admin updated successfully"));
        setEditingAdmin(null);
        fetchAdmins();
      } else {
        toast.error(data.message || t("Failed to update admin"));
      }
    } catch (e) {
      toast.error(t("Error saving admin changes"));
    } finally {
      setSavingEdit(false);
    }
  };

  // 4. Download Report Handler (CSV)
  const handleDownloadReport = () => {
    if (admins.length === 0) {
      toast.error(t("No administrator records to export"));
      return;
    }

    const headers = ["UID", "Username", "Full Name", "Email", "Phone", "Access Role", "Status", "Creation Date"];
    const rows = filteredAdmins.map((u) => [
      `"${u.id || u._id || ""}"`,
      `"${u.username || ""}"`,
      `"${u.full_name || u.first_name || ""}"`,
      `"${u.email || "N/A"}"`,
      `"${u.phone || "N/A"}"`,
      `"${(u.role || "ADMIN").toUpperCase()}"`,
      `"${(u.active !== undefined ? (u.active ? "ENABLED" : "DISABLED") : (u.status || "ENABLED")).toUpperCase()}"`,
      `"${u.joined || u.created_at || "N/A"}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `admin_directory_report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(t("Admin Directory Report downloaded successfully"));
  };

  // Delete Confirm
  const confirmDelete = async () => {
    if (!adminToDelete) return;
    const targetId = adminToDelete.id || adminToDelete._id;
    if (!targetId) {
      toast.error(t("Invalid admin ID"));
      return;
    }

    setDeleting(true);
    try {
      const res = await apiFetch(`/api/admin/users/${targetId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        toast.success(t("Admin deleted successfully"));
        setAdminToDelete(null);
        fetchAdmins();
      } else {
        toast.error(data.message || t("Failed to delete admin"));
      }
    } catch (e) {
      toast.error(t("An error occurred while deleting admin"));
    } finally {
      setDeleting(false);
    }
  };

  // Filtered List
  const filteredAdmins = admins.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery = 
      u.username.toLowerCase().includes(q) ||
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.phone && u.phone.includes(q));

    const matchesRole = roleFilter === "all" || u.role?.toLowerCase() === roleFilter.toLowerCase();
    return matchesQuery && matchesRole;
  });

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500 pb-12">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
                  {t("Admin Directory")}
                </h1>
                <p className="text-muted-foreground text-xs font-medium mt-0.5">
                  {t("Manage regional administrators, access privileges, security credentials, and status.")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Download Report Button */}
            <button
              onClick={handleDownloadReport}
              className="bg-card border border-border text-foreground px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-muted transition-all flex items-center gap-2 shadow-sm"
            >
              <Download className="w-4 h-4 text-emerald-500" />
              {t("Download Report")}
            </button>

            {/* Add New Admin Button */}
            <button
              onClick={() => navigate("/dashboard/admins/add")}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-extrabold text-xs uppercase tracking-wider shadow-lg hover:opacity-90 transition-all flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              {t("Add New Admin")}
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <Card className="rounded-xl border border-border/60 shadow-sm bg-card">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={t("SEARCH BY USERNAME, NAME, EMAIL OR PHONE...")}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-muted/20 text-xs font-semibold focus:border-primary focus:outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Filter className="w-4 h-4 text-muted-foreground hidden sm:block" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-4 py-2.5 border border-border rounded-lg bg-background text-xs font-bold uppercase tracking-wider focus:outline-none"
              >
                <option value="all">{t("All Roles")}</option>
                <option value="superadmin">{t("Super Admin")}</option>
                <option value="admin">{t("Admin")}</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Admins Table Card */}
        <Card className="rounded-xl border border-border/60 shadow-md overflow-hidden bg-card">
          <CardHeader className="bg-muted/20 border-b border-border py-4 px-6 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-extrabold uppercase tracking-widest flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              {t("System Administrators Directory")} ({filteredAdmins.length})
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {t("Loading System Administrators...")}
                </p>
              </div>
            ) : filteredAdmins.length === 0 ? (
              <div className="p-20 text-center space-y-3">
                <ShieldOff className="w-12 h-12 text-muted-foreground/40 mx-auto" />
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                  {t("No administrators found matching criteria.")}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground uppercase text-[10px] font-black tracking-widest">
                      <th className="py-4 pl-6">{t("Admin Identity")}</th>
                      <th className="py-4">{t("Contact Details")}</th>
                      <th className="py-4">{t("Access Role")}</th>
                      <th className="py-4">{t("Created Date")}</th>
                      <th className="py-4 text-center">{t("Status")}</th>
                      <th className="py-4 text-right pr-6">{t("Actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredAdmins.map((u) => {
                      const uid = u.id || u._id || "";
                      const isActive = u.active !== undefined ? u.active : u.status === "Active";
                      const isToggling = togglingId === uid;

                      return (
                        <tr key={uid} className="hover:bg-muted/30 transition-colors group">
                          {/* Identity */}
                          <td className="py-4 pl-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 font-black text-primary text-sm uppercase">
                                {u.username.substring(0, 2)}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-extrabold text-foreground text-sm tracking-tight flex items-center gap-2">
                                  {u.username}
                                  {u.role?.toLowerCase() === "superadmin" && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-500/10 text-purple-500 border border-purple-500/20 uppercase tracking-widest">
                                      SUPER
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] font-medium text-muted-foreground">
                                  {u.full_name || `${u.first_name || ""} ${u.last_name || ""}`.trim() || "System Admin"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Contact Details */}
                          <td className="py-4">
                            <div className="flex flex-col gap-1 text-xs">
                              <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                                <Mail className="w-3 h-3 text-primary" /> {u.email || "N/A"}
                              </span>
                              {u.phone && (
                                <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                                  <Phone className="w-3 h-3 text-emerald-500" /> {u.phone}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Access Role */}
                          <td className="py-4">
                            <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-500 border border-blue-500/20">
                              {(u.role || "ADMIN").toUpperCase()}
                            </span>
                          </td>

                          {/* Joined Date */}
                          <td className="py-4">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                              <Clock className="w-3.5 h-3.5 text-primary/70" />
                              {u.joined || u.created_at?.split("T")[0] || "N/A"}
                            </div>
                          </td>

                          {/* Status Badge & Direct Enable/Disable */}
                          <td className="py-4 text-center">
                            <button
                              onClick={() => handleToggleStatus(u)}
                              disabled={isToggling}
                              title={t("Click to Toggle Enable/Disable")}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                              {isToggling ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                              ) : isActive ? (
                                <div className="flex items-center gap-1.5 text-green-500 bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 rounded-full">
                                  <UserCheck className="w-3 h-3" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">{t("ENABLED")}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-red-500 bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 rounded-full">
                                  <UserMinus className="w-3 h-3" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">{t("DISABLED")}</span>
                                </div>
                              )}
                            </button>
                          </td>

                          {/* Management Actions */}
                          <td className="py-4 text-right pr-6">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* 1. View Admin Details */}
                              <button
                                onClick={() => setViewingAdmin(u)}
                                className="p-2 rounded-lg border border-border hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all text-muted-foreground"
                                title={t("View Admin Details")}
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* 2. Edit Admin */}
                              <button
                                onClick={() => openEditModal(u)}
                                className="p-2 rounded-lg border border-border hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/30 transition-all text-muted-foreground"
                                title={t("Edit Admin Profile")}
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              {/* 3. Delete Admin */}
                              <button
                                onClick={() => setAdminToDelete(u)}
                                className="p-2 rounded-lg border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all text-muted-foreground"
                                title={t("Delete Admin Account")}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ========================================== */}
      {/* 1. VIEW ADMIN MODAL                        */}
      {/* ========================================== */}
      <Dialog open={!!viewingAdmin} onOpenChange={(open) => !open && setViewingAdmin(null)}>
        <DialogContent className="max-w-xl rounded-xl border border-border bg-card shadow-2xl">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-lg text-foreground uppercase tracking-tight">
                    {t("Admin Account Profile")}
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium">
                    UID: {viewingAdmin?.id || viewingAdmin?._id || "N/A"}
                  </p>
                </div>
              </div>

              {/* Status Pill */}
              {(viewingAdmin?.active !== undefined ? viewingAdmin.active : viewingAdmin?.status === "Active") ? (
                <span className="px-3 py-1 rounded-full text-xs font-black bg-green-500/10 text-green-500 border border-green-500/20 uppercase tracking-widest flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {t("ENABLED")}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-black bg-red-500/10 text-red-500 border border-red-500/20 uppercase tracking-widest flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> {t("DISABLED")}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {viewingAdmin && (
            <div className="space-y-6 py-4 text-sm">
              {/* Top Banner Info */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("Username")}</span>
                  <p className="font-black text-lg text-foreground tracking-tight">{viewingAdmin.username}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("Access Level")}</span>
                  <p className="font-extrabold text-primary uppercase tracking-widest">{viewingAdmin.role}</p>
                </div>
              </div>

              {/* Profile Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block">{t("Full Name")}</span>
                  <span className="font-bold text-foreground text-sm">
                    {viewingAdmin.full_name || `${viewingAdmin.first_name || ""} ${viewingAdmin.last_name || ""}`.trim() || "N/A"}
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block">{t("Email Address")}</span>
                  <span className="font-semibold text-foreground text-xs flex items-center gap-1 mt-0.5">
                    <Mail className="w-3.5 h-3.5 text-primary" /> {viewingAdmin.email || "N/A"}
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block">{t("Phone Number")}</span>
                  <span className="font-semibold text-foreground text-xs flex items-center gap-1 mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-500" /> {viewingAdmin.phone || "N/A"}
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block">{t("Creation Date")}</span>
                  <span className="font-semibold text-foreground text-xs flex items-center gap-1 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-primary" /> {viewingAdmin.joined || viewingAdmin.created_at?.split("T")[0] || "N/A"}
                  </span>
                </div>

                {/* Password Reveal for Admin */}
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Key className="w-3.5 h-3.5" /> {t("Account Password")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 hover:underline"
                    >
                      {showAdminPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {showAdminPassword ? t("Hide") : t("Show Password")}
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-mono font-bold text-foreground text-sm tracking-wider">
                      {showAdminPassword ? (viewingAdmin.raw_password || viewingAdmin.password || "No plain password saved") : "••••••••••••"}
                    </span>
                    {(viewingAdmin.raw_password || viewingAdmin.password) && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(viewingAdmin.raw_password || viewingAdmin.password || "");
                          toast.success(t("Password copied to clipboard"));
                        }}
                        className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500/30 transition-all"
                      >
                        {t("Copy")}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* System Privileges Badges */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                  {t("System Access & Privileges")}
                </h4>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    ✓ User & Admin Management
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    ✓ Center Approval & Management
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-purple-500/10 text-purple-500 border border-purple-500/20">
                    ✓ Exam & Marksheet Engine
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    ✓ Financial & Referral Commission Audit
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="border-t border-border pt-4 flex gap-2">
            <button
              onClick={() => {
                const a = viewingAdmin;
                setViewingAdmin(null);
                if (a) openEditModal(a);
              }}
              className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-extrabold text-xs uppercase tracking-wider hover:opacity-90 transition-all flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              {t("Edit Profile")}
            </button>
            <button
              onClick={() => setViewingAdmin(null)}
              className="px-5 py-2.5 rounded-lg border border-border bg-card hover:bg-muted font-extrabold text-xs uppercase tracking-wider transition-all"
            >
              {t("Close")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================== */}
      {/* 2. EDIT ADMIN MODAL                        */}
      {/* ========================================== */}
      <Dialog open={!!editingAdmin} onOpenChange={(open) => !open && setEditingAdmin(null)}>
        <DialogContent className="max-w-lg rounded-xl border border-border bg-card shadow-2xl">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <Edit className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-heading font-extrabold text-lg text-foreground uppercase tracking-tight">
                  {t("Edit Admin Profile")}
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  {t("Update administrator credentials, role and status.")}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                {t("Username")} *
              </label>
              <input
                type="text"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                className="w-full px-3.5 py-2 rounded-lg border border-border bg-background text-xs font-bold focus:border-primary focus:outline-none"
              />
            </div>

            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                {t("Full Name")}
              </label>
              <input
                type="text"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                className="w-full px-3.5 py-2 rounded-lg border border-border bg-background text-xs font-bold focus:border-primary focus:outline-none"
              />
            </div>

            {/* Email & Phone Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  {t("Email Address")}
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-lg border border-border bg-background text-xs font-bold focus:border-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  {t("Phone Number")}
                </label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-lg border border-border bg-background text-xs font-bold focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Role & Status Row */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  {t("Access Role")}
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-lg border border-border bg-background text-xs font-bold uppercase tracking-wider focus:outline-none"
                >
                  <option value="admin">{t("Admin")}</option>
                  <option value="superadmin">{t("Super Admin")}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  {t("Account Status")}
                </label>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, active: true })}
                    className={`flex-1 py-1.5 rounded-lg font-black text-xs uppercase tracking-wider border transition-all ${
                      editForm.active
                        ? "bg-green-500/20 border-green-500 text-green-500"
                        : "bg-muted/40 border-border text-muted-foreground"
                    }`}
                  >
                    {t("ENABLED")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, active: false })}
                    className={`flex-1 py-1.5 rounded-lg font-black text-xs uppercase tracking-wider border transition-all ${
                      !editForm.active
                        ? "bg-red-500/20 border-red-500 text-red-500"
                        : "bg-muted/40 border-border text-muted-foreground"
                    }`}
                  >
                    {t("DISABLED")}
                  </button>
                </div>
              </div>
            </div>

            {/* Password Reset Field */}
            <div className="space-y-1.5 pt-2 border-t border-border">
              <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Key className="w-3.5 h-3.5 text-amber-500" />
                {t("Reset Password (Optional)")}
              </label>
              <input
                type="password"
                placeholder={t("Leave blank to keep existing password...")}
                value={editForm.new_password}
                onChange={(e) => setEditForm({ ...editForm, new_password: e.target.value })}
                className="w-full px-3.5 py-2 rounded-lg border border-border bg-background text-xs font-bold focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-4 flex gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={savingEdit}
              className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-extrabold text-xs uppercase tracking-wider hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              {t("Save Changes")}
            </button>
            <button
              onClick={() => setEditingAdmin(null)}
              disabled={savingEdit}
              className="px-5 py-2.5 rounded-lg border border-border bg-card hover:bg-muted font-extrabold text-xs uppercase tracking-wider transition-all"
            >
              {t("Cancel")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================== */}
      {/* 3. DELETE CONFIRMATION ALERT               */}
      {/* ========================================== */}
      <AlertDialog open={!!adminToDelete} onOpenChange={(open) => !open && setAdminToDelete(null)}>
        <AlertDialogContent className="rounded-xl border border-border bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase tracking-widest text-lg text-foreground">
              {t("Delete Admin Account")}
            </AlertDialogTitle>
            <AlertDialogDescription className="font-medium text-muted-foreground text-xs">
              {t("Are you sure you want to delete")} <strong className="text-foreground uppercase">{adminToDelete?.username}</strong>? {t("This action cannot be undone and will revoke all administrative access.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-end gap-2 mt-4">
            <AlertDialogCancel 
              disabled={deleting}
              className="rounded-lg border border-border font-black uppercase tracking-widest text-xs"
            >
              {t("Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 font-black uppercase tracking-widest text-xs"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  {t("Deleting...")}
                </>
              ) : (
                t("Confirm Delete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AdminListPage;
