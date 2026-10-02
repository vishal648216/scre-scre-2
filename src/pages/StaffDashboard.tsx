import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  UserCheck,
  Clock,
  ShieldCheck,
  GraduationCap,
  School,
  TrendingUp,
  BookOpen,
  CheckSquare,
  IndianRupee,
  Loader2,
  Sparkles,
  ArrowRight,
  Activity,
  CheckCircle2,
  Calendar,
  Zap,
  Lock,
  User
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

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
        <div className="flex flex-col items-center justify-center min-h-[65vh] space-y-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Sparkles className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground animate-pulse">
            Loading Staff Workspace...
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const authorizedModules = [
    {
      label: "Student Records",
      icon: GraduationCap,
      active: permissions?.can_manage_students ?? true,
      gradient: "from-blue-600 to-cyan-500",
      shadow: "shadow-blue-500/20",
      badgeColor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      href: "/dashboard/students",
      description: "Manage student profiles, enrollments & academic status",
    },
    {
      label: "Attendance Hub",
      icon: CheckSquare,
      active: permissions?.can_manage_attendance ?? true,
      gradient: "from-emerald-600 to-teal-500",
      shadow: "shadow-emerald-500/20",
      badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      href: "/dashboard/attendance/register",
      description: "Mark daily student attendance & view registers",
    },
    {
      label: "Fee Collection",
      icon: IndianRupee,
      active: permissions?.can_manage_fees ?? true,
      gradient: "from-amber-500 to-orange-600",
      shadow: "shadow-amber-500/20",
      badgeColor: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      href: "/dashboard/students/fees",
      description: "Process fee receipts & inspect balance ledgers",
    },
    {
      label: "Academic Courses",
      icon: BookOpen,
      active: permissions?.can_manage_courses ?? true,
      gradient: "from-purple-600 to-pink-500",
      shadow: "shadow-purple-500/20",
      badgeColor: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      href: "/dashboard/academics/courses",
      description: "Syllabus units, study notes & course materials",
    },
    {
      label: "Exam Allotment",
      icon: School,
      active: permissions?.can_manage_exams ?? true,
      gradient: "from-rose-600 to-red-500",
      shadow: "shadow-rose-500/20",
      badgeColor: "bg-rose-500/10 text-rose-500 border-rose-500/20",
      href: "/dashboard/exams/allot",
      description: "Allot blueprints & issue student hall tickets",
    },
    {
      label: "Reports & Analytics",
      icon: TrendingUp,
      active: permissions?.can_view_reports ?? true,
      gradient: "from-indigo-600 to-violet-500",
      shadow: "shadow-indigo-500/20",
      badgeColor: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
      href: "/dashboard/students/reports",
      description: "System enrollment stats & performance metrics",
    },
    {
      label: "Staff Directory",
      icon: Users,
      active: permissions?.can_manage_staff ?? false,
      gradient: "from-yellow-500 to-amber-600",
      shadow: "shadow-yellow-500/20",
      badgeColor: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      href: "/dashboard/staff/list",
      description: "View staff list & internal operational roles",
    },
  ].filter((m) => m.active);

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500 pb-12">
        {/* Premium Banner Hero Header */}
        <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-r from-primary/10 via-purple-500/5 to-background p-8 md:p-10 shadow-xl">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-16 w-48 h-48 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center text-white shadow-lg shadow-primary/25 border border-white/20">
                  <User className="w-8 h-8" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    Staff Operations Workspace
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-primary" />
                    {currentDate}
                  </span>
                </div>
                <h1 className="font-heading font-extrabold text-3xl md:text-4xl text-foreground uppercase tracking-tight mt-1.5">
                  Welcome back, <span className="text-primary">{user?.fullName || user?.username || "Staff Member"}</span>
                </h1>
                <p className="text-muted-foreground text-xs font-semibold mt-1">
                  Access your authorized staff tools, student records, and operational tasks.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-card/80 backdrop-blur-md border border-border/80 px-4 py-2.5 rounded-2xl shadow-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Session Security</p>
                  <p className="text-xs font-black text-emerald-500 uppercase">Verified Staff</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Authorized Workspace Modules */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Authorized Modules & Quick Access
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                Tools enabled specifically for your staff role profile
              </p>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-muted border border-border text-muted-foreground">
              {authorizedModules.length} Modules Active
            </span>
          </div>

          {authorizedModules.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {authorizedModules.map((module) => (
                <Link key={module.label} to={module.href} className="block group">
                  <Card className="rounded-3xl border border-border/60 bg-card shadow-lg hover:shadow-2xl hover:border-primary/50 transition-all duration-300 cursor-pointer h-full overflow-hidden group-hover:-translate-y-1">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${module.gradient} ${module.shadow} flex items-center justify-center text-white border border-white/20 group-hover:scale-110 transition-transform duration-300`}>
                          <module.icon className="w-7 h-7" />
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${module.badgeColor}`}>
                          Active
                        </span>
                      </div>

                      <div className="mt-5 space-y-1.5">
                        <h3 className="text-lg font-black text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                          <span>{module.label}</span>
                          <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                        </h3>
                        <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                          {module.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="rounded-3xl border border-amber-500/30 bg-amber-500/5 shadow-xl">
              <CardContent className="p-10 text-center space-y-4">
                <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/20">
                  <Lock className="w-8 h-8 text-amber-500" />
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h2 className="text-lg font-black uppercase tracking-tight text-foreground">Restricted Module Access</h2>
                  <p className="text-xs font-medium text-muted-foreground">
                    Your staff account currently has no active module permissions. Please contact your center administrator to assign role privileges.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Activity & Operational Status Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
          <Card className="rounded-3xl border border-border/60 bg-card shadow-lg overflow-hidden">
            <CardHeader className="bg-muted/40 border-b border-border/60 py-4 px-6">
              <CardTitle className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-foreground">
                <Activity className="w-4 h-4 text-primary" />
                Recent System Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center border border-border text-muted-foreground">
                  <Clock className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-muted-foreground">No recent system logs recorded for your current login session.</p>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  Ready for operations
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-border/60 bg-card shadow-lg overflow-hidden">
            <CardHeader className="bg-muted/40 border-b border-border/60 py-4 px-6">
              <CardTitle className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-foreground">
                <UserCheck className="w-4 h-4 text-primary" />
                Staff Operational Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <span className="text-xs font-bold text-muted-foreground">Account Status</span>
                <span className="text-[10px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" />
                  Active Operational
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <span className="text-xs font-bold text-muted-foreground">Role Hierarchy</span>
                <span className="text-xs font-black uppercase text-foreground bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                  Staff Member
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <span className="text-xs font-bold text-muted-foreground">Center Link</span>
                <span className="text-xs font-black uppercase text-foreground">
                  {user?.center_name || user?.centerName || "Assigned Center"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">Session Token Validity</span>
                <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  24 Hours Standard Access
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StaffDashboard;

