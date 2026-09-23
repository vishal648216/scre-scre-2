import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { 
  ShieldCheck, 
  User, 
  Building2, 
  GraduationCap, 
  Settings, 
  Plus, 
  Edit3, 
  Trash2, 
  Loader2, 
  Users, 
  KeyRound,
  Sparkles,
  Search
} from "lucide-react";

interface ActionPermissions {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
}

interface ModulePermissions {
  centers: ActionPermissions;
  students: ActionPermissions;
  finance: ActionPermissions;
  courses: ActionPermissions;
  exams: ActionPermissions;
  staff: ActionPermissions;
  leads: ActionPermissions;
  cms: ActionPermissions;
  settings: ActionPermissions;
}

interface SubAdminRole {
  _id?: string;
  id?: string;
  name: string;
  description: string;
  permissions: ModulePermissions;
  is_system?: boolean;
}

interface AdminUser {
  id?: string;
  _id?: string;
  username: string;
  full_name?: string;
  email?: string;
  role: string;
  sub_admin_role_name?: string;
  sub_admin_role_id?: string;
}

const MODULES: { key: keyof ModulePermissions; label: string; description: string }[] = [
  { key: "centers", label: "Centers & Franchises", description: "Manage approved centers, requests, and center wallets" },
  { key: "students", label: "Students & Enrolments", description: "Manage admissions, approvals, ID cards, and marksheets" },
  { key: "finance", label: "Finance & Accounts", description: "Collect fees, view transactions, commissions, and revenue" },
  { key: "courses", label: "Courses & Academics", description: "Manage courses, subjects, batches, sessions, and materials" },
  { key: "exams", label: "Exams & Results", description: "Allot exams, reschedule dates, evaluate papers, and approvals" },
  { key: "staff", label: "Staff Management", description: "Onboard and manage branch staff, teachers, and operators" },
  { key: "leads", label: "Leads & Enquiries", description: "Manage CRM pipeline, student enquiries, and followups" },
  { key: "cms", label: "CMS & Website Content", description: "Update sliders, gallery, notices, news, and blogs" },
  { key: "settings", label: "System Settings", description: "General settings, referral payout rules, and configurations" },
];

const DEFAULT_ACTION_PERMS: ActionPermissions = { view: false, add: false, edit: false, delete: false };

const DEFAULT_MODULE_PERMS: ModulePermissions = {
  centers: { ...DEFAULT_ACTION_PERMS },
  students: { ...DEFAULT_ACTION_PERMS },
  finance: { ...DEFAULT_ACTION_PERMS },
  courses: { ...DEFAULT_ACTION_PERMS },
  exams: { ...DEFAULT_ACTION_PERMS },
  staff: { ...DEFAULT_ACTION_PERMS },
  leads: { ...DEFAULT_ACTION_PERMS },
  cms: { ...DEFAULT_ACTION_PERMS },
  settings: { ...DEFAULT_ACTION_PERMS },
};

const SYSTEM_ROLES = [
  { id: "superadmin", name: "Super Admin", icon: Settings, desc: "Full root access to all system features, configuration, and data.", is_system: true },
  { id: "admin", name: "Admin", icon: User, desc: "Standard administrative authority across centers, students, academics, and finances.", is_system: true },
  { id: "center", name: "Center / Franchise", icon: Building2, desc: "Center owner portal to manage their students, admissions, and exam requests.", is_system: true },
  { id: "student", name: "Student", icon: GraduationCap, desc: "Student portal to view enrolled courses, take exams, and download certificates.", is_system: true },
];

export const AdminRolePermissionsPage = () => {
  const [roles, setRoles] = useState<SubAdminRole[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Create / Edit Role Modal
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<SubAdminRole | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [rolePerms, setRolePerms] = useState<ModulePermissions>(DEFAULT_MODULE_PERMS);
  const [savingRole, setSavingRole] = useState(false);

  // Assign Role Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, usersRes] = await Promise.all([
        apiFetch("/api/admin/roles"),
        apiFetch("/api/admin/users")
      ]);

      if (rolesRes.ok) {
        const data = await rolesRes.json();
        setRoles(Array.isArray(data) ? data : []);
      }
      if (usersRes.ok) {
        const users = await usersRes.json();
        const adminList = (Array.isArray(users) ? users : []).filter(
          (u: any) => u.role === "admin" || u.role === "superadmin"
        );
        setAdmins(adminList);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load roles and staff data");
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingRole(null);
    setRoleName("");
    setRoleDesc("");
    setRolePerms(JSON.parse(JSON.stringify(DEFAULT_MODULE_PERMS)));
    setIsRoleModalOpen(true);
  };

  const openEditModal = (role: SubAdminRole) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDesc(role.description || "");
    const perms: ModulePermissions = JSON.parse(JSON.stringify(DEFAULT_MODULE_PERMS));
    if (role.permissions) {
      for (const m of MODULES) {
        if (role.permissions[m.key]) {
          perms[m.key] = { ...role.permissions[m.key] };
        }
      }
    }
    setRolePerms(perms);
    setIsRoleModalOpen(true);
  };

  const handleTogglePerm = (module: keyof ModulePermissions, action: keyof ActionPermissions) => {
    setRolePerms(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: !prev[module][action]
      }
    }));
  };

  const handleToggleRow = (module: keyof ModulePermissions, enableAll: boolean) => {
    setRolePerms(prev => ({
      ...prev,
      [module]: {
        view: enableAll,
        add: enableAll,
        edit: enableAll,
        delete: enableAll
      }
    }));
  };

  const handleSaveRole = async () => {
    if (!roleName.trim()) {
      toast.error("Please enter a role name");
      return;
    }

    setSavingRole(true);
    try {
      const payload = {
        name: roleName.trim(),
        description: roleDesc.trim(),
        permissions: rolePerms
      };

      const roleId = editingRole?._id || editingRole?.id;
      const url = roleId ? `/api/admin/roles/${roleId}` : "/api/admin/roles";
      const method = roleId ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success(roleId ? "Role updated successfully" : "New role created successfully");
        setIsRoleModalOpen(false);
        fetchData();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.message || "Failed to save role");
      }
    } catch {
      toast.error("Network error while saving role");
    } finally {
      setSavingRole(false);
    }
  };

  const handleDeleteRole = async (role: SubAdminRole) => {
    const roleId = role._id || role.id;
    if (!roleId) return;
    if (!confirm(`Are you sure you want to delete the role "${role.name}"?`)) return;

    try {
      const res = await apiFetch(`/api/admin/roles/${roleId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Role deleted successfully");
        fetchData();
      } else {
        toast.error("Failed to delete role");
      }
    } catch {
      toast.error("Error deleting role");
    }
  };

  const openAssignModal = (admin: AdminUser) => {
    setSelectedAdmin(admin);
    setSelectedRoleId(admin.sub_admin_role_id || "");
    setIsAssignModalOpen(true);
  };

  const handleAssignRole = async () => {
    if (!selectedAdmin) return;
    const adminId = selectedAdmin.id || selectedAdmin._id;
    if (!adminId) return;

    setAssigning(true);
    try {
      const targetRole = roles.find(r => (r._id || r.id) === selectedRoleId);
      const payload = {
        role_id: selectedRoleId || null,
        role_name: targetRole ? targetRole.name : null,
        permissions: targetRole ? targetRole.permissions : null
      };

      const res = await apiFetch(`/api/admin/users/${adminId}/permissions`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success(`Permissions updated for ${selectedAdmin.username}`);
        setIsAssignModalOpen(false);
        fetchData();
      } else {
        toast.error("Failed to assign role");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="w-6 h-6" />
              </span>
              <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
                Role & Permissions Matrix (RBAC)
              </h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              Super Admin control to define custom sub-admin roles and assign granular module permissions (View, Add, Edit, Delete).
            </p>
          </div>

          <Button onClick={openCreateModal} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" />
            Create Sub-Admin Role
          </Button>
        </div>

        {/* Section 1: Custom Sub-Admin Roles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Custom Sub-Admin Roles ({roles.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Define specialized responsibilities (e.g., Accountant, Center Coordinator, Support)
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : roles.length === 0 ? (
            <Card className="border-dashed border-2 p-8 text-center bg-muted/10">
              <KeyRound className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="font-bold text-base text-foreground">No Sub-Admin Roles Created Yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                Create your first custom sub-admin role and choose which menus and data actions each sub-admin can access.
              </p>
              <Button onClick={openCreateModal} variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                Create Role Now
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {roles.map((role) => {
                const roleId = role._id || role.id;
                const activePermCount = role.permissions
                  ? Object.values(role.permissions).reduce((acc, m) => {
                      return acc + (m.view ? 1 : 0) + (m.add ? 1 : 0) + (m.edit ? 1 : 0) + (m.delete ? 1 : 0);
                    }, 0)
                  : 0;

                return (
                  <Card key={roleId} className="border-border hover:shadow-md transition-all flex flex-col justify-between">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                            {role.name}
                          </CardTitle>
                          <CardDescription className="text-xs line-clamp-2 mt-1">
                            {role.description || "No description provided"}
                          </CardDescription>
                        </div>
                        <Badge variant="secondary" className="shrink-0 text-[10px] font-bold uppercase">
                          {activePermCount} Actions
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4 pt-0">
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
                        {MODULES.filter(m => role.permissions?.[m.key]?.view).map(m => (
                          <span key={m.key} className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                            {m.label.split(" ")[0]}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => openEditModal(role)}
                          className="h-8 gap-1.5 text-xs"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit Permissions
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteRole(role)}
                          className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Sub-Admin Users & Role Assignment */}
        <div className="space-y-4 pt-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Admin Accounts & Role Assignment ({admins.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Assign defined custom roles to individual admin users
              </p>
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search admin users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          <Card className="overflow-hidden border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/30 border-b border-border text-[11px] font-black uppercase text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3">Admin User</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">System Role</th>
                    <th className="px-6 py-3">Assigned Sub-Admin Role</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {admins
                    .filter(a => 
                      (a.username || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (a.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (a.email || "").toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((admin) => {
                      const adminId = admin.id || admin._id;
                      const isSuper = admin.role === "superadmin";

                      return (
                        <tr key={adminId} className="hover:bg-muted/10 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-foreground">{admin.full_name || admin.username}</div>
                            <div className="text-xs text-muted-foreground font-mono">@{admin.username}</div>
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-muted-foreground">
                            {admin.email || "—"}
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={isSuper ? "default" : "outline"} className="capitalize font-bold text-[10px]">
                              {admin.role}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            {isSuper ? (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px] font-bold">
                                Full System Super Admin
                              </Badge>
                            ) : admin.sub_admin_role_name ? (
                              <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] font-bold">
                                {admin.sub_admin_role_name}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                General Admin (Unrestricted)
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {!isSuper && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openAssignModal(admin)}
                                className="h-8 text-xs font-semibold"
                              >
                                Assign Role
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Section 3: Built-in Core System Roles Reference */}
        <div className="space-y-4 pt-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-muted-foreground" />
            Core System Role Definitions
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {SYSTEM_ROLES.map((r) => (
              <Card key={r.id} className="p-4 border-border bg-muted/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <r.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground">{r.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{r.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Modal: Create / Edit Role Permissions Matrix */}
        <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                {editingRole ? `Edit Role: ${editingRole.name}` : "Create Sub-Admin Role"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configure module access rights (View, Add, Edit, Delete) for this role.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role-name" className="text-xs font-bold uppercase">Role Name *</Label>
                  <Input
                    id="role-name"
                    placeholder="e.g., Center Operations Lead, Accountant"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role-desc" className="text-xs font-bold uppercase">Description</Label>
                  <Input
                    id="role-desc"
                    placeholder="e.g., Handles fee verification and wallet approvals"
                    value={roleDesc}
                    onChange={(e) => setRoleDesc(e.target.value)}
                  />
                </div>
              </div>

              {/* Permissions Matrix Table */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/40 px-4 py-2.5 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-foreground">
                    Module Permissions Matrix
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const full: any = {};
                        MODULES.forEach(m => {
                          full[m.key] = { view: true, add: true, edit: true, delete: true };
                        });
                        setRolePerms(full);
                      }}
                      className="h-7 text-[11px] font-bold text-primary"
                    >
                      Select All
                    </Button>
                    <span className="text-muted-foreground text-xs">•</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setRolePerms(JSON.parse(JSON.stringify(DEFAULT_MODULE_PERMS)))}
                      className="h-7 text-[11px] font-bold text-muted-foreground"
                    >
                      Clear All
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/20 border-b border-border text-[10px] font-bold uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5 w-1/3">Module</th>
                        <th className="px-4 py-2.5 text-center">View</th>
                        <th className="px-4 py-2.5 text-center">Add / Create</th>
                        <th className="px-4 py-2.5 text-center">Edit / Update</th>
                        <th className="px-4 py-2.5 text-center">Delete</th>
                        <th className="px-4 py-2.5 text-right">Quick Toggle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {MODULES.map((m) => {
                        const current = rolePerms[m.key] || DEFAULT_ACTION_PERMS;
                        const isAllChecked = current.view && current.add && current.edit && current.delete;

                        return (
                          <tr key={m.key} className="hover:bg-muted/10">
                            <td className="px-4 py-3">
                              <div className="font-bold text-foreground">{m.label}</div>
                              <div className="text-[11px] text-muted-foreground">{m.description}</div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={current.view}
                                onChange={() => handleTogglePerm(m.key, "view")}
                                className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={current.add}
                                onChange={() => handleTogglePerm(m.key, "add")}
                                className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={current.edit}
                                onChange={() => handleTogglePerm(m.key, "edit")}
                                className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={current.delete}
                                onChange={() => handleTogglePerm(m.key, "delete")}
                                className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleRow(m.key, !isAllChecked)}
                                className="h-6 text-[10px] font-semibold"
                              >
                                {isAllChecked ? "Clear" : "All"}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRoleModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveRole} disabled={savingRole}>
                {savingRole ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingRole ? "Save Changes" : "Create Role"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Assign Role to Admin */}
        <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">
                Assign Sub-Admin Role
              </DialogTitle>
              <DialogDescription className="text-xs">
                Select a custom role to assign to {selectedAdmin?.full_name || selectedAdmin?.username}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase">Select Role</Label>
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className="w-full p-2.5 text-sm border rounded-md bg-background focus:ring-2 focus:ring-primary"
                >
                  <option value="">General Admin (Unrestricted Full Access)</option>
                  {roles.map(r => (
                    <option key={r._id || r.id} value={r._id || r.id}>
                      {r.name} {r.description ? `(${r.description})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignRole} disabled={assigning}>
                {assigning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Update Assignment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminRolePermissionsPage;
