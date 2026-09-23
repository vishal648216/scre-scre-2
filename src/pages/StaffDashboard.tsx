import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, Clock, ShieldCheck, GraduationCap, School, TrendingUp, BookOpen, CheckSquare, IndianRupee, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

const StaffDashboard = () => {
  const [permissions, setPermissions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = JSON.parse(sessionStorage.getItem("user") || "{}");
    setUser(userData);

    const fetchPermissions = async () => {
      try {
        const res = await apiFetch("/api/staff/permissions");
        if (res.ok) {
          const data = await res.json();
          setPermissions(data);
        }
      } catch (error) {
        console.error("Failed to fetch permissions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const authorizedModules = [
    { label: "Students", icon: GraduationCap, active: permissions?.can_manage_students, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Attendance", icon: CheckSquare, active: permissions?.can_manage_attendance, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Finance", icon: IndianRupee, active: permissions?.can_manage_fees, color: "text-orange-500", bg: "bg-orange-500/10" },
    { label: "Academics", icon: BookOpen, active: permissions?.can_manage_courses, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Reports", icon: TrendingUp, active: permissions?.can_view_reports, color: "text-pink-500", bg: "bg-pink-500/10" },
    { label: "Staff Management", icon: Users, active: permissions?.can_manage_staff, color: "text-cyan-500", bg: "bg-cyan-500/10" },
  ].filter(m => m.active);

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Staff Workspace</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium uppercase tracking-widest font-black text-[10px]">
              Welcome back, {user?.username} • Operational Access
            </p>
          </div>
          <div className="flex items-center gap-2 bg-primary/5 border border-primary/10 px-4 py-2 rounded-none">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Authenticated Staff</span>
          </div>
        </div>

        {authorizedModules.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {authorizedModules.map((module) => (
              <Card key={module.label} className="rounded-none border-border shadow-md hover:border-primary/20 transition-all group">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 ${module.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <module.icon className={`w-6 h-6 ${module.color}`} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Authorized Access</p>
                      <p className="text-xl font-black text-foreground">{module.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="rounded-none border-orange-500/20 bg-orange-500/5">
            <CardContent className="p-10 text-center space-y-4">
              <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck className="w-8 h-8 text-orange-500" />
              </div>
              <div className="max-w-md mx-auto">
                <h2 className="text-lg font-black uppercase tracking-tight">Restricted Access</h2>
                <p className="text-sm font-medium text-muted-foreground mt-2">
                  Your staff account currently has no active module permissions. Please contact your center administrator or system admin to enable specific dashboard tools.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10">
          <Card className="rounded-none border-border shadow-md">
            <CardHeader className="bg-muted/30 border-b border-border py-4">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Your Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-xs font-medium text-muted-foreground italic">No recent system activity found for your profile.</p>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border shadow-md">
            <CardHeader className="bg-muted/30 border-b border-border py-4">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary" />
                Staff Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Account Status</span>
                <span className="text-[10px] font-black uppercase text-green-600 bg-green-500/10 px-2 py-0.5">Active</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Role Hierarchy</span>
                <span className="text-[10px] font-black uppercase">Staff Member</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Session Expires</span>
                <span className="text-[10px] font-black uppercase">24 Hours</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StaffDashboard;
