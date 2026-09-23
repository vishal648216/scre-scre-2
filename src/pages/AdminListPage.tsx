import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, UserMinus, Search, Shield, ShieldOff, Clock, Filter, Loader2, Trash2, Edit } from "lucide-react";
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

interface AdminUser {
  _id?: string;
  username: string;
  role: string;
  id?: string;
  joined?: string;
  status?: string;
}

const AdminListPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingRole, setPendingRole] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [adminToDelete, setAdminToDelete] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/admin/users");
      if (response.ok) {
        const data = await response.json();
        setAdmins((data as AdminUser[]).filter((u) => u.role === "admin" || u.role === "sub_admin" || u.role === "subadmin"));
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
  }, [t]);

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

  const toggleStatus = async (id: string, currentActive: boolean) => {
    // Optimistic UI update
    setAdmins(prev =>
      prev.map(u => {
        const uid = u.id || u._id || "";
        if (uid === id) {
          return { ...u, status: currentActive ? "Inactive" : "Active" };
        }
        return u;
      })
    );

    try {
      const res = await apiFetch(`/api/admin/users/${id}/toggle-active`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        toast.success(data.message || t("Status updated successfully"));
      } else {
        // Revert on error
        setAdmins(prev =>
          prev.map(u => {
            const uid = u.id || u._id || "";
            if (uid === id) {
              return { ...u, status: currentActive ? "Active" : "Inactive" };
            }
            return u;
          })
        );
        toast.error(data.message || t("Failed to update status"));
      }
    } catch (e) {
      setAdmins(prev =>
        prev.map(u => {
          const uid = u.id || u._id || "";
          if (uid === id) {
            return { ...u, status: currentActive ? "Active" : "Inactive" };
          }
          return u;
        })
      );
      toast.error(t("An error occurred while toggling status"));
    }
  };

  const onRoleChange = (id: string, role: string) => {
    setPendingRole(prev => ({ ...prev, [id]: role }));
  };

  const saveRole = async (id: string) => {
    const role = pendingRole[id];
    if (!role) return;
    try {
      setSaving(prev => ({ ...prev, [id]: true }));
      const res = await apiFetch(`/api/admin/users/${id}/role`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        toast.success(data.message || t("Role updated successfully"));
        setPendingRole(prev => {
          const n = { ...prev };
          delete n[id];
          return n;
        });
        fetchAdmins();
      } else {
        toast.error(data.message || t("Failed to update role"));
      }
    } catch {
      toast.error(t("Failed to update role"));
    } finally {
      setSaving(prev => ({ ...prev, [id]: false }));
    }
  };

  const filteredAdmins = admins.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">{t("Admin Directory")}</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">{t("Manage regional administrators and their system access privileges.")}</p>
          </div>
          <button
            onClick={() => navigate("/dashboard/admins/add")}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-none font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:opacity-90 transition-all flex items-center gap-2 w-fit"
          >
            <Users className="w-4 h-4" />
            {t("Add New Admin")}
          </button>
        </div>

        {/* Filters */}
        <Card className="rounded-none border-border shadow-sm">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={t("SEARCH BY USERNAME...")}
                className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-muted/30 text-[10px] font-black uppercase tracking-widest focus:border-primary focus:outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="flex items-center gap-2 px-6 py-2.5 border border-border bg-card text-[10px] font-black uppercase tracking-[0.2em] hover:bg-muted transition-all">
              <Filter className="w-3.5 h-3.5" />
              {t("Filter Results")}
            </button>
          </CardContent>
        </Card>

        {/* Admins Table */}
        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              {t("System Administrators")} ({filteredAdmins.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{t("Retrieving Secure Data...")}</p>
              </div>
            ) : filteredAdmins.length === 0 ? (
              <div className="p-20 text-center">
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t("No administrators found.")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/10 text-muted-foreground uppercase text-[10px] font-black tracking-widest">
                      <th className="py-4 pl-6">{t("Admin Identity")}</th>
                      <th className="py-4">{t("Access Level")}</th>
                      <th className="py-4">{t("Creation Date")}</th>
                      <th className="py-4 text-center">{t("Status")}</th>
                      <th className="py-4 text-right pr-6">{t("Management")}</th>
                    </tr>
                  </thead>
                  <tbody className="font-medium">
                    {filteredAdmins.map((u) => {
                      const uid = u.id || u._id || "";
                      return (
                        <tr key={uid} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
                          <td className="py-5 pl-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-primary/5 flex items-center justify-center border border-primary/10">
                                <Shield className="w-5 h-5 text-primary" />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-black text-foreground uppercase tracking-tight">{u.username}</span>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">UID: {uid.substring(0, 8)}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-5">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-primary/5 border border-primary/10 text-primary text-[10px] font-black uppercase rounded-none tracking-widest">SYSTEM_{u.role}</span>
                              <select
                                value={pendingRole[uid] ?? u.role?.toLowerCase?.() ?? "admin"}
                                onChange={e => onRoleChange(uid, e.target.value)}
                                className="px-2 py-1 border border-border bg-background text-[10px] uppercase tracking-widest"
                              >
                                <option value="admin">{t("admin")}</option>
                                <option value="sub_admin">{t("sub_admin")}</option>
                                <option value="center">{t("center")}</option>
                                <option value="student">{t("student")}</option>
                              </select>
                              <button
                                onClick={() => saveRole(uid)}
                                disabled={!pendingRole[uid] || saving[uid]}
                                className="px-2 py-1 border border-border text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                              >
                                {saving[uid] ? t("Saving…") : t("Save")}
                              </button>
                            </div>
                          </td>
                          <td className="py-5">
                            <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                              <Clock className="w-3.5 h-3.5" /> {u.joined}
                            </div>
                          </td>
                          <td className="py-5">
                            <div className="flex items-center justify-center">
                              {u.status === "Active" ? (
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/5 border border-green-500/20 text-green-500 rounded-none">
                                  <UserCheck className="w-3 h-3" />
                                  <span className="text-[9px] font-black uppercase tracking-widest">{t("Enabled")}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/5 border border-red-500/20 text-red-500 rounded-none">
                                  <UserMinus className="w-3 h-3" />
                                  <span className="text-[9px] font-black uppercase tracking-widest">{t("Disabled")}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-5 text-right pr-6">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => toggleStatus(uid, u.status === "Active")}
                                className="p-2 border border-border hover:border-orange-500 hover:text-orange-500 transition-all rounded-none"
                                title={t("Toggle Status")}
                              >
                                {u.status === "Active" ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => setAdminToDelete(u)}
                                className="p-2 border border-border hover:border-destructive hover:text-destructive transition-all rounded-none"
                                title={t("Delete Admin")}
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

      <AlertDialog open={!!adminToDelete} onOpenChange={(open) => !open && setAdminToDelete(null)}>
        <AlertDialogContent className="rounded-none border-2 border-border bg-background">
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
              className="rounded-none border-2 border-border font-black uppercase tracking-widest text-[10px]"
            >
              {t("Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="rounded-none bg-destructive text-destructive-foreground hover:bg-destructive/90 font-black uppercase tracking-widest text-[10px]"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
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
