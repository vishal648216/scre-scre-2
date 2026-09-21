import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, UserMinus, Search, MoreVertical, Shield, ShieldOff, Mail, Clock, Filter, Loader2, Key } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";

interface UserManagementPageProps {
  type: "active" | "inactive" | "all";
}

interface UserRow {
  id: string;
  username: string;
  password?: string;
  role: string;
  joined?: string;
  status?: "Active" | "Inactive";
}
const UserManagementPage = ({ type }: UserManagementPageProps) => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const token = sessionStorage.getItem("token");
        const response = await fetch("/api/admin/users", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          // Filter based on type
          const arr: UserRow[] = Array.isArray(data) ? data : [];
          // superadmin is "god" and should not be visible to anyone
          const visibleUsers = arr.filter(u => u.role?.toLowerCase() !== "superadmin");
          
          if (type === "active") {
            setUsers(visibleUsers.filter((u) => u.status === "Active"));
          } else if (type === "inactive") {
            setUsers(visibleUsers.filter((u) => u.status === "Inactive"));
          } else {
            setUsers(visibleUsers);
          }
        }
      } catch (error) {
        console.error("Failed to fetch users:", error);
        toast.error(t("Failed to load user data"));
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [type, t]);

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return;
    setResetting(true);
    try {
      const token = sessionStorage.getItem("token");
      const response = await fetch(`/api/admin/users/${selectedUser.id}/reset-password`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ new_password: newPassword })
      });
      
      if (response.ok) {
        toast.success(t("Password for {{username}} reset successfully", { username: selectedUser.username }));
        setResetDialogOpen(false);
        setNewPassword("");
      } else {
        const err = await response.json();
        toast.error(err.message || t("Failed to reset password"));
      }
    } catch (error) {
      toast.error(t("An error occurred"));
    } finally {
      setResetting(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTitle = () => {
    if (type === "active") return t("Active System Users");
    if (type === "inactive") return t("Inactive System Users");
    return t("All System Users");
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">{getTitle()}</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">{t("Manage user accounts, roles, and access status across the entire platform.")}</p>
        </div>

        {/* Filters */}
        <Card className="rounded-none border-border shadow-sm">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder={t("SEARCH BY USERNAME OR ROLE...")}
                className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-muted/30 text-xs font-bold uppercase tracking-wider focus:border-primary focus:outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2.5 border border-border bg-card text-[10px] font-black uppercase tracking-[0.2em] hover:bg-muted transition-all">
              <Filter className="w-3.5 h-3.5" />
              {t("Export List")}
            </button>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              {t("User Directory")} ({filteredUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{t("Synchronizing data...")}</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-20 text-center">
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t("No users found in this category.")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/10 text-muted-foreground uppercase text-[10px] font-black tracking-widest">
                      <th className="py-4 pl-6">{t("Account Information")}</th>
                      <th className="py-4">{t("Password")}</th>
                      <th className="py-4">{t("Access Level")}</th>
                      <th className="py-4">{t("Joined Date")}</th>
                      <th className="py-4 text-center">{t("Current Status")}</th>
                      <th className="py-4 text-right pr-6">{t("Action")}</th>
                    </tr>
                  </thead>
                  <tbody className="font-medium">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
                        <td className="py-5 pl-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/5 flex items-center justify-center border border-primary/10">
                              <Users className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-black text-foreground uppercase tracking-tight">{u.username}</span>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("ID")}: {u.id.substring(0, 8)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-5">
                          <div className="flex items-center gap-2">
                            <Key className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-mono text-xs font-bold text-primary">
                              {u.password || "********"}
                            </span>
                          </div>
                        </td>
                        <td className="py-5">
                          <span className="px-2 py-1 bg-primary/5 border border-primary/10 text-primary text-[10px] font-black uppercase rounded-none">{t(u.role)}</span>
                        </td>
                        <td className="py-5">
                          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase">
                            <Clock className="w-3.5 h-3.5" /> {u.joined}
                          </div>
                        </td>
                        <td className="py-5">
                          <div className="flex items-center justify-center">
                            {u.status === "Active" ? (
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/5 border border-green-500/20 text-green-500 rounded-none">
                                <UserCheck className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase tracking-widest">{t("Active")}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/5 border border-red-500/20 text-red-500 rounded-none">
                                <UserMinus className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase tracking-widest">{t("Inactive")}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-5 text-right pr-6 space-x-2">
                          <button 
                            className="p-2 border border-border hover:border-primary hover:text-primary transition-all"
                            onClick={() => {
                              setSelectedUser(u);
                              setResetDialogOpen(true);
                            }}
                            title={t("Reset Password")}
                          >
                            <Key className="w-4 h-4" />
                          </button>
                          <button className="p-2 border border-border hover:border-primary hover:text-primary transition-all">
                            {u.status === "Active" ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="rounded-none border-border">
          <DialogHeader>
            <DialogTitle className="text-xs font-black uppercase tracking-[0.2em]">{t("Reset Password")}: {selectedUser?.username}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">{t("New Password")}</label>
            <Input 
              type="password" 
              placeholder={t("ENTER NEW PASSWORD...")}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="rounded-none border-border bg-muted/30 font-mono"
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setResetDialogOpen(false)}
              className="rounded-none border-border text-[10px] font-black uppercase tracking-widest"
            >
              {t("Cancel")}
            </Button>
            <Button 
              onClick={handleResetPassword}
              disabled={resetting || !newPassword}
              className="rounded-none text-[10px] font-black uppercase tracking-widest"
            >
              {resetting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
              {t("Confirm Reset")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default UserManagementPage;
