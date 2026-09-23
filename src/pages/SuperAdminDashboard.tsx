import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, School, GraduationCap, TrendingUp, Activity, FileText, Clock, UserCheck, UserMinus, Search, HardDrive, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";

const SuperAdminDashboard = () => {
  const { t } = useTranslation();
  interface Metrics {
    totalCenters?: number;
    totalStudents?: number;
    totalRevenue?: number;
    activeAnnouncements?: number;
    user_stats?: { active?: number };
  }

  interface SystemStats {
    total_capacity_gb: number;
    used_capacity_gb: number;
    database_size_gb: number;
    media_assets_gb: number;
    student_docs_gb: number;
    course_materials_gb: number;
    profile_images_gb: number;
    system_logs_gb: number;
  }

  interface UserRow {
    username: string;
    role: string;
    joined?: string;
    status?: "Active" | "Inactive";
  }

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metricsRes, usersRes, systemRes] = await Promise.all([
          apiFetch("/api/admin/metrics"),
          apiFetch("/api/admin/users"),
          apiFetch("/api/system/stats")
        ]);

        if (metricsRes.ok && usersRes.ok && systemRes.ok) {
          const mData = await metricsRes.json();
          const uData = await usersRes.json();
          const sData = await systemRes.json();
          setMetrics(mData);
          // superadmin is "god" and should not be visible in any lists
          setUsers((uData || []).filter((u: any) => u.role?.toLowerCase() !== "superadmin"));
          setSystemStats(sData);
        }
      } catch (error) {
        console.error("Dashboard fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const stats = [
    { label: t("Total Admins"), value: users.filter(u => u.role.toLowerCase() === "admin").length.toString(), icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: t("Active Centers"), value: metrics?.totalCenters?.toString() || "0", icon: School, color: "text-green-500", bg: "bg-green-500/10" },
    { label: t("Total Students"), value: metrics?.totalStudents?.toString() || "0", icon: GraduationCap, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: t("Revenue"), value: `₹${((metrics?.totalRevenue || 0) / 100000).toFixed(1)}L`, icon: TrendingUp, color: "text-orange-500", bg: "bg-orange-500/10" },
  ];

  const liveTracking = [
    {
      label: t("Active Centers"),
      value: metrics?.totalCenters || 0,
      sub: t("Operational"),
      color: "text-green-500",
      percent: metrics?.totalCenters ? Math.min(100, Math.round((metrics.totalCenters / 50) * 100)) : 0,
    },
    {
      label: t("Active Students"),
      value: metrics?.totalStudents || 0,
      sub: t("Registered"),
      color: "text-blue-500",
      percent: metrics?.totalStudents ? Math.min(100, Math.round((metrics.totalStudents / 500) * 100)) : 0,
    },
    {
      label: t("Active Announcements"),
      value: metrics?.activeAnnouncements || 0,
      sub: t("Live notices"),
      color: "text-purple-500",
      percent: metrics?.activeAnnouncements ? Math.min(100, Math.round((metrics.activeAnnouncements / 20) * 100)) : 0,
    },
    {
      label: t("Uptime"),
      value: "99.9%",
      sub: t("System Healthy"),
      color: "text-orange-500",
      percent: 99.9,
    },
  ];

  return (
    <DashboardLayout role={t("Super Admin")}>
      <div className="space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground">{t("Super Admin Overview")}</h1>
            <p className="text-muted-foreground mt-1">{t("Global system activity and live performance metrics.")}</p>
          </div>
          <div className="flex items-center gap-2 bg-card border border-border px-4 py-2 rounded-xl shadow-sm">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-bold text-foreground">{t("System Live: 99.9% Uptime")}</span>
          </div>
        </div>

        {/* Live User Tracking */}
        <div className="space-y-4">
          <h2 className="font-heading font-bold text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            {t("Live User Activity")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {liveTracking.map((track) => (
              <Card key={track.label} className="border-border shadow-sm overflow-hidden group">
                <CardContent className="p-6">
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">{track.label}</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className={cn("text-3xl font-black", track.color)}>{track.value}</span>
                    <span className="text-[10px] font-bold text-muted-foreground">{t("users")}</span>
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground mt-1">{track.sub}</p>
                  <div className="mt-4 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full transition-all duration-700 rounded-full", track.color.replace("text", "bg"))}
                      style={{ width: `${track.percent}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <Card key={stat.label} className="border-border shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                  {stat.label}
                </CardTitle>
                <div className={`${stat.bg} p-2 rounded-lg`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-heading font-black">{stat.value}</div>
                <p className="text-xs text-green-500 font-bold mt-1 flex items-center gap-1">
                  <Activity className="w-3 h-3" /> {t("System Active")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* All Users List */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-heading font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  {t("All System Users")}
                </CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder={t("Search users...")}
                    className="pl-9 pr-4 py-1.5 bg-muted/50 rounded-lg border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary w-48"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground uppercase text-[10px] font-black tracking-widest">
                        <th className="pb-4 pl-2">{t("User")}</th>
                        <th className="pb-4">{t("Role")}</th>
                        <th className="pb-4">{t("Joined")}</th>
                        <th className="pb-4">{t("Status")}</th>
                        <th className="pb-4 text-right pr-2">{t("Action")}</th>
                      </tr>
                    </thead>
                    <tbody className="font-medium">
                       {users.map((u, i) => (
                         <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                           <td className="py-4 pl-2 font-bold">{u.username}</td>
                           <td className="py-4">
                             <span className="px-2 py-0.5 bg-primary/5 text-primary text-[10px] font-bold uppercase rounded border border-primary/10">{t(u.role)}</span>
                           </td>
                           <td className="py-4 text-muted-foreground text-xs">{u.joined}</td>
                           <td className="py-4">
                             <div className="flex items-center gap-1.5">
                               {u.status === "Active" ? (
                                 <UserCheck className="w-3.5 h-3.5 text-green-500" />
                               ) : (
                                 <UserMinus className="w-3.5 h-3.5 text-red-500" />
                               )}
                               <span className={cn("text-[10px] font-black uppercase", u.status === "Active" ? "text-green-500" : "text-red-500")}>{t(u.status || "Inactive")}</span>
                             </div>
                           </td>
                           <td className="py-4 text-right pr-2">
                             <button className="text-muted-foreground hover:text-primary transition-colors">
                               <Settings className="w-4 h-4" />
                             </button>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Alerts & Performance */}
          <div className="space-y-6">
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading font-bold flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-primary" />
                  {t("Disk Usage")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span>{t("Database")}</span>
                    <span>{systemStats?.database_size_gb.toFixed(2)} GB / {systemStats?.total_capacity_gb.toFixed(0)} GB</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className="bg-primary h-full transition-all duration-1000" 
                      style={{ width: `${((systemStats?.database_size_gb || 0) / (systemStats?.total_capacity_gb || 1)) * 100}%` }} 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span>{t("Media Assets")}</span>
                    <span>{systemStats?.media_assets_gb.toFixed(2)} GB / {systemStats?.total_capacity_gb.toFixed(0)} GB</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className="bg-secondary h-full transition-all duration-1000" 
                      style={{ width: `${((systemStats?.media_assets_gb || 0) / (systemStats?.total_capacity_gb || 1)) * 100}%` }} 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm bg-primary/5 border-primary/10">
              <CardHeader>
                <CardTitle className="font-heading font-bold text-primary">{t("System Alerts")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-card rounded-lg border border-border flex gap-3 items-start">
                  <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                  <p className="text-xs font-semibold">{t("Database backup pending for over 24 hours.")}</p>
                </div>
                <div className="p-3 bg-card rounded-lg border border-border flex gap-3 items-start">
                  <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                  <p className="text-xs font-semibold">{t("3 Centers subscriptions expiring this week.")}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SuperAdminDashboard;
