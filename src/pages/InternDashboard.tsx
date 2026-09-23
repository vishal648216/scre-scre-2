
import { useState, useEffect, useMemo } from "react";
import DashboardLayout, { getDashboardMenuItems } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BookOpen,
  Award,
  Calendar,
  MessageSquare,
  TrendingUp,
  CheckCircle2,
  Clock,
  FileText,
  ChevronRight,
  Users,
  ExternalLink,
  Plus,
  ArrowUpRight,
  Library,
  Bell,
  Briefcase,
  List
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface StoredUser {
  username?: string;
  role?: string;
  _id?: string;
  id?: string;
  $oid?: string;
}

interface Task {
  _id: any;
  status: string;
}

interface AttendanceRecord {
  _id: any;
  present: boolean;
}

const oid = (x: any): string => {
  if (!x) return "";
  if (typeof x === "string") return x;
  if (typeof x === "object" && x.$oid) return x.$oid;
  return String(x);
};

const InternDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [metrics, setMetrics] = useState({
    attendancePercentage: 0,
    pendingTasks: 0,
    completedTasks: 0,
    totalTasks: 0,
    internshipDays: 0
  });
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<any>(null);

  const [quickLinks, setQuickLinks] = useState<{ label: string; href: string; iconName: string }[]>(() => {
    const saved = localStorage.getItem("dashboard_quick_links_intern");
    return saved ? JSON.parse(saved) : [
      { label: t("My Attendance"), href: "/dashboard/intern/attendance", iconName: "CheckCircle2" },
      { label: t("My Tasks"), href: "/dashboard/intern/tasks", iconName: "List" },
      { label: t("My Certificates"), href: "/dashboard/intern/certificates", iconName: "Award" },
    ];
  });

  useEffect(() => {
    localStorage.setItem("dashboard_quick_links_intern", JSON.stringify(quickLinks));
  }, [quickLinks]);

  const menuItems = useMemo(() => {
    if (!user) return [];
    const role = user.role.toLowerCase().replace(/\s+/g, "");
    return getDashboardMenuItems(role, permissions, (user as any)?._id || (user as any)?.id);
  }, [user, permissions]);

  const allAvailableLinks = useMemo(() => {
    const links: { label: string; href: string; iconName: string; icon: any }[] = [];
    menuItems.forEach(item => {
      if (item.subItems) {
        item.subItems.forEach(sub => {
          if (sub.href) {
            links.push({
              label: t(sub.label),
              href: sub.href,
              iconName: sub.icon?.displayName || sub.icon?.name || "ExternalLink",
              icon: sub.icon
            });
          }
        });
      } else if (item.href) {
        links.push({
          label: t(item.label),
          href: item.href,
          iconName: item.icon?.displayName || item.icon?.name || "ExternalLink",
          icon: item.icon
        });
      }
    });
    return links;
  }, [menuItems, t]);

  const addQuickLink = (link: { label: string; href: string; iconName: string }) => {
    if (!quickLinks.find(ql => ql.href === link.href)) {
      setQuickLinks(prev => [...prev, link]);
    }
  };

  const removeQuickLink = (href: string) => {
    setQuickLinks(prev => prev.filter(ql => ql.href !== href));
  };

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      // Fetch tasks
      const tasksRes = await apiFetch("/api/intern-tasks");
      let tasks: Task[] = [];
      if (tasksRes.ok) {
        tasks = await tasksRes.json();
      }

      // Fetch attendance
      const attendanceRes = await apiFetch("/api/intern-attendance");
      let attendance: AttendanceRecord[] = [];
      if (attendanceRes.ok) {
        attendance = await attendanceRes.json();
      }

      const pendingTasks = tasks.filter(t => t.status === "pending").length;
      const completedTasks = tasks.filter(t => t.status === "completed").length;
      const totalTasks = tasks.length;

      // Calculate attendance percentage
      let attendancePercentage = 0;
      if (attendance.length > 0) {
        const presentDays = attendance.filter(a => a.present).length;
        attendancePercentage = Math.round((presentDays / attendance.length) * 100);
      }

      // Calculate internship days (simplified)
      const internshipDays = attendance.length;

      setMetrics({
        attendancePercentage,
        pendingTasks,
        completedTasks,
        totalTasks,
        internshipDays
      });
    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const storedUser = sessionStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    fetchMetrics();
  }, []);

  const iconMap: Record<string, any> = {
    BookOpen,
    Award,
    Calendar,
    MessageSquare,
    TrendingUp,
    CheckCircle2,
    Clock,
    FileText,
    Users,
    ExternalLink,
    Library,
    Bell,
    Briefcase,
    List
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
              {t("Intern Dashboard")}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              {t("Welcome to your internship dashboard")}
            </p>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-border shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("Attendance")}</p>
                  <p className="text-2xl font-black text-foreground">
                    {loading ? <Skeleton className="w-16 h-8" /> : `${metrics.attendancePercentage}%`}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("Pending Tasks")}</p>
                  <p className="text-2xl font-black text-foreground">
                    {loading ? <Skeleton className="w-16 h-8" /> : metrics.pendingTasks}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("Completed Tasks")}</p>
                  <p className="text-2xl font-black text-foreground">
                    {loading ? <Skeleton className="w-16 h-8" /> : metrics.completedTasks}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("Internship Days")}</p>
                  <p className="text-2xl font-black text-foreground">
                    {loading ? <Skeleton className="w-16 h-8" /> : metrics.internshipDays}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <Card className="rounded-2xl border-border shadow-md">
          <CardHeader className="bg-muted/30 border-b border-border py-4 px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-primary" />
                {t("Quick Access")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {quickLinks.map((link, index) => {
                const Icon = iconMap[link.iconName] || Briefcase;
                return (
                  <Link
                    key={index}
                    to={link.href}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted/20 hover:bg-muted/40 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-all">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-center">{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default InternDashboard;
