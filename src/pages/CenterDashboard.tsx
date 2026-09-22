import { useState, useEffect, useMemo } from "react";
import DashboardLayout, { getDashboardMenuItems } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TodayBirthdaysCard } from "@/components/BirthdayWidget";
import {
  GraduationCap,
  BookOpen,
  Clock,
  Trophy,
  Users,
  PlusCircle,
  IndianRupee,
  ArrowUpRight,
  CheckSquare,
  Calendar,
  Bell,
  School,
  ExternalLink,
  X,
  Plus,
  CheckCircle2,
  Library,
  ClipboardList,
  Mail,
  MessageSquare,
  Award,
  CreditCard,
  Wallet,
  FileText,
  Image,
  Download,
  ShieldCheck,
  Layers,
  PenTool,
  Handshake,
  BarChart3,
  TrendingUp,
  History,
  Filter,
  Zap,
  Video,
  FlaskConical,
  Database,
  List,
  Trash2,
  Send,
  Paperclip,
  IdCard,
  Settings,
  ShoppingBag,
  Globe,
  MapPin,
  AlertTriangle,
  Star,
  HardDrive,
  FileSpreadsheet,
  UserCheck,
  Languages,
  BookCheck,
  Upload,
  Stamp
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface StoredUser {
  username?: string;
  role?: string;
}
const CenterDashboard = () => {
  const { t } = useTranslation();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [permissions, setPermissions] = useState<any>(null);

  const [quickLinks, setQuickLinks] = useState<{ label: string; href: string; iconName: string }[]>(() => {
    const saved = localStorage.getItem("dashboard_quick_links_center");
    return saved ? JSON.parse(saved) : [
      { label: t("All Students"), href: "/dashboard/students", iconName: "Users" },
      { label: t("Attendance Register"), href: "/dashboard/attendance/register", iconName: "CheckSquare" },
      { label: t("Allotted Courses"), href: "/dashboard/courses/allotted", iconName: "BookOpen" },
    ];
  });

  useEffect(() => {
    localStorage.setItem("dashboard_quick_links_center", JSON.stringify(quickLinks));
  }, [quickLinks]);

  const menuItems = useMemo(() => {
    if (!user) return [];
    const role = user.role.toLowerCase().replace(/\s+/g, "");
    return getDashboardMenuItems(role, permissions);
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

  const [metrics, setMetrics] = useState({
    totalStudents: 0,
    activeCourses: 0,
    totalEarnings: 0,
    pendingLeads: 0,
    activeExams: 0,
    pendingEvaluations: 0
  });
  const [wallet, setWallet] = useState<{ balance: number } | null>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [marksheets, setMarksheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [referralStats, setReferralStats] = useState<any>(null);

  const fetchReferralStats = async () => {
    try {
      const res = await apiFetch("/api/referrals/stats");
      if (res.ok) setReferralStats(await res.json());
    } catch { }
  };

  const copyReferralCode = () => {
    if (referralStats?.referral_code) {
      navigator.clipboard.writeText(referralStats.referral_code);
      toast.success(t("Referral code copied!"));
    }
  };

  useEffect(() => {
    const storedUser = sessionStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));

    const fetchData = async () => {
      setLoading(true);
      try {
        const [mRes, wRes, aRes, msRes, examsRes] = await Promise.all([
          apiFetch("/api/center/metrics"),
          apiFetch("/api/center/wallet"),
          apiFetch("/api/announcements"),
          apiFetch("/api/marksheets"),
          apiFetch("/api/exam/papers")
        ]);

        if (mRes.ok) {
          const m = await mRes.json();
          setMetrics((prev) => ({ ...prev, ...m }));
        }
        if (wRes.ok) setWallet(await wRes.json());
        if (aRes.ok) setAnnouncements(await aRes.json());
        if (msRes.ok) {
          const data = await msRes.json();
          const sorted = Array.isArray(data) ? data.sort((a, b) => (b.percentage || 0) - (a.percentage || 0)).slice(0, 3) : [];
          setMarksheets(sorted);
        }
        if (examsRes.ok) {
          const exams: any[] = await examsRes.json();
          setMetrics(prev => ({
            ...prev,
            activeExams: exams.filter(e => e.status === "InProgress").length,
            pendingEvaluations: exams.filter(e => e.status === "Submitted").length
          }));
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    fetchReferralStats();
  }, []);

  const stats = [
    { label: t("Total Students"), value: metrics.totalStudents.toString(), icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: t("Active Courses"), value: metrics.activeCourses.toString(), icon: BookOpen, color: "text-green-500", bg: "bg-green-500/10" },
    { label: t("Total Earnings"), value: `₹${metrics.totalEarnings.toLocaleString()}`, icon: IndianRupee, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: t("Pending Leads"), value: metrics.pendingLeads.toString().padStart(2, "0"), icon: Clock, color: "text-orange-500", bg: "bg-orange-500/10" },
  ];

  return (
    <DashboardLayout role="Center">
      <div className="dashboard-page">
        {/* Header Section */}
        <div className="dashboard-hero">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <School className="w-4 h-4 text-primary" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60">{t("Center Management")}</span>
            </div>
            <h1 className="font-heading font-black text-3xl text-foreground tracking-tight text-balance md:text-3xl">{t("Center")} <span className="bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">{t("Dashboard")}</span></h1>
            <p className="text-muted-foreground mt-2 text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-accent" /> {format(new Date(), "EEEE, dd MMMM yyyy")}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full md:w-auto">
            <Link to="/dashboard/students/add" className="flex items-center justify-center gap-4 bg-gradient-to-br from-primary to-primary-dark text-primary-foreground px-4 py-2 rounded-2xl font-heading font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 hover:-translate-y-1 transition-all duration-300 ease-out group active:scale-[0.98] motion-reduce:hover:translate-y-0">
              <PlusCircle className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              {t("Enroll Student")}
            </Link>
            <Link to="/dashboard/attendance/register" className="flex items-center justify-center gap-4 border border-border bg-card text-foreground px-4 py-2 rounded-2xl font-heading font-bold text-xs uppercase tracking-widest shadow-dashboard-soft backdrop-blur-md hover:bg-muted/50 hover:shadow-dashboard-soft-lg hover:-translate-y-0.5 transition-all duration-300 ease-out active:scale-[0.98] motion-reduce:hover:translate-y-0">
              <CheckSquare className="w-5 h-5 text-primary" />
              {t("Attendance")}
            </Link>
            <Link to="/dashboard/center/batches" className="flex items-center justify-center gap-4 border border-border bg-card text-foreground px-4 py-2 rounded-2xl font-heading font-bold text-xs uppercase tracking-widest shadow-dashboard-soft backdrop-blur-md hover:bg-muted/50 hover:shadow-dashboard-soft-lg hover:-translate-y-0.5 transition-all duration-300 ease-out active:scale-[0.98] motion-reduce:hover:translate-y-0">
              <Users className="w-5 h-5 text-accent" />
              {t("Batches")}
            </Link>
          </div>
        </div>

        <div className="space-y-4 mb-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-foreground/80">{t("Quick Access")}</h2>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/50 dark:bg-white/5 border border-border/40 hover:bg-white dark:hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary group">
                  <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" />
                  {t("Manage Links")}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 max-h-[400px] overflow-y-auto rounded-2xl border-border/60 bg-white dark:bg-card p-2 shadow-2xl backdrop-blur-xl">
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-4 py-3">
                  {t("Available Pages")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="mx-2 bg-border/60" />
                {allAvailableLinks.map((link) => {
                  const isAdded = quickLinks.find(ql => ql.href === link.href);
                  return (
                    <DropdownMenuItem
                      key={link.href}
                      onClick={() => isAdded ? removeQuickLink(link.href) : addQuickLink({ label: link.label, href: link.href, iconName: link.iconName })}
                      className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-primary/5 rounded-xl transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        {link.icon && <link.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />}
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground/80 group-hover:text-primary">{t(link.label)}</span>
                      </div>
                      {isAdded && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {quickLinks.map((link) => {
              const Icon = (() => {
                const iconMap: Record<string, any> = {
                  Users, School, IndianRupee, GraduationCap, BookOpen, Library, Calendar, ClipboardList, CheckSquare, PlusCircle, Clock, Bell, Mail, MessageSquare, Trophy, Award, CreditCard, Wallet, FileText, Image, Download, ShieldCheck, Layers, PenTool, Handshake, BarChart3, TrendingUp, History, Filter, Zap, Video, FlaskConical, Database, List, Trash2, Send, Paperclip, IdCard, Settings, ShoppingBag, Globe, MapPin, AlertTriangle, Star, HardDrive, FileSpreadsheet, UserCheck, Languages, BookCheck, Upload, Stamp, ExternalLink
                };
                return iconMap[link.iconName] || ExternalLink;
              })();

              return (
                <div key={link.href} className="group relative">
                  <Link
                    to={link.href}
                    className="flex flex-col items-center justify-center gap-4 p-6 rounded-3xl bg-white/50 dark:bg-white/5 border border-white dark:border-white/10 shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:bg-white dark:hover:bg-white/10 hover:-translate-y-1 transition-all duration-300 aspect-square text-center"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center group-hover:bg-primary group-hover:scale-110 transition-all duration-300 group-hover:rotate-6 shadow-inner">
                      <Icon className="w-6 h-6 text-primary group-hover:text-white transition-colors" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors line-clamp-2 px-2">
                      {t(link.label)}
                    </span>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      removeQuickLink(link.href);
                    }}
                    className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 shadow-lg z-10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading
            ? Array.from({ length: 4 }, (_, i) => <CenterStatCardSkeleton key={i} />)
            : stats.map((stat) => (
              <CenterMetricCard
                key={stat.label}
                title={stat.label}
                value={stat.value}
                icon={stat.icon}
                color={stat.color}
                trend={stat.label === t("Pending Leads") && metrics.pendingLeads > 0 ? t("Action Required") : t("Live Status")}
              />
            ))}
        </div>

        {/* Refer & Earn Section */}
        <Card variant="dashboard" className="border-l-4 border-l-primary overflow-hidden bg-gradient-to-br from-primary/5 via-white to-transparent mb-10">
          <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/40 px-8 py-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-primary/80">
                  {t("Center Referral Program")}
                </CardTitle>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                  {t("Refer other centers and earn cash rewards or royalty discounts")}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-primary tracking-tight">₹{referralStats?.total_rewards || 0}</div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t("Rewards Earned")}</p>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="flex-1 w-full space-y-8">
                <div className="p-8 bg-white rounded-[2.5rem] border-2 border-dashed border-primary/30 shadow-sm relative group transition-all hover:border-primary/50">
                  <div className="absolute -top-3 left-8 px-5 py-1.5 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-primary/20">
                    {t("Your Center Referral Code")}
                  </div>
                  <div className="flex items-center justify-between gap-8">
                    <div className="text-4xl font-black font-mono tracking-tighter text-foreground dark:text-black selection:bg-primary/20">
                      {referralStats?.referral_code || "---"}
                    </div>
                    <Button
                      onClick={copyReferralCode}
                      className="rounded-2xl font-black text-xs uppercase tracking-[0.2em] h-16 px-10 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-1 transition-all"
                    >
                      {t("Copy Code")}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 bg-muted/30 rounded-2xl border border-border/40 text-center">
                    <div className="text-2xl font-black text-foreground">{referralStats?.total_referrals || 0}</div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">{t("Centers Joined")}</p>
                  </div>
                  <div className="p-6 bg-muted/30 rounded-2xl border border-border/40 text-center">
                    <div className="text-2xl font-black text-foreground">₹1000</div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">{t("Reward per Center")}</p>
                  </div>
                </div>
              </div>
              <div className="w-full md:w-64 flex flex-col items-center gap-4 p-8 bg-white rounded-[2.5rem] border border-border/40 shadow-sm">
                <div className="p-4 bg-muted/30 rounded-3xl">
                  <QRCodeSVG
                    value={referralStats?.referral_code || ""}
                    size={140}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-relaxed">
                    {t("Scan & Share with other Educators")}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main Feed */}
          <div className="lg:col-span-2 space-y-8">
            <Card variant="dashboard">
              <CardHeader className="border-b border-border/40 px-8 py-6 bg-gradient-to-r from-sky-50/50 to-transparent flex flex-row items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/15 shadow-inner">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-foreground/80">
                    {t("Operations Checklist")}
                  </CardTitle>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-primary/60 bg-primary/5 px-4 py-2 rounded-full border border-primary/10">{t("Active Session")}</span>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/40">
                  <ChecklistItem
                    title={t("Student Registrations")}
                    subtitle={t("{{count}} total students enrolled", { count: metrics.totalStudents })}
                    time={t("Active")}
                    status="completed"
                  />
                  <ChecklistItem
                    title={t("Course Management")}
                    subtitle={t("{{count}} active courses authorized", { count: metrics.activeCourses })}
                    time={t("Online")}
                    status="completed"
                  />
                  <ChecklistItem
                    title={t("Pending Enquiries")}
                    subtitle={t("{{count}} new leads need follow-up", { count: metrics.pendingLeads })}
                    time={metrics.pendingLeads > 0 ? t("Action Required") : t("Up to date")}
                    status={metrics.pendingLeads > 0 ? "urgent" : "completed"}
                  />
                  <ChecklistItem
                    title={t("Examination Grading")}
                    subtitle={t("{{count}} submitted exams need grading", { count: metrics.pendingEvaluations })}
                    time={metrics.pendingEvaluations > 0 ? t("Evaluate Now") : t("All Graded")}
                    status={metrics.pendingEvaluations > 0 ? "urgent" : "completed"}
                  />
                  <ChecklistItem
                    title={t("Live Exam Monitoring")}
                    subtitle={t("{{count}} students currently taking exams", { count: metrics.activeExams })}
                    time={t("Real-time")}
                    status="completed"
                  />
                </div>
              </CardContent>
            </Card>

            <Card variant="dashboard">
              <CardHeader className="px-8 py-6 border-b border-border/40 bg-amber-50/30">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <Trophy className="w-5 h-5 text-white" />
                  </div>
                  <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-amber-700">
                    {t("Academic Excellence")}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {marksheets.length > 0 ? (
                    marksheets.map((ms, i) => (
                      <div key={ms._id} className="flex flex-col items-center text-center space-y-4 p-6 rounded-3xl border border-border/60 bg-muted/5 group hover:bg-white hover:border-amber-500/30 hover:shadow-xl transition-all duration-300">
                        <div className="relative">
                          <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-border/40 group-hover:scale-110 transition-transform duration-500">
                            <Users className="w-10 h-10 text-slate-400 group-hover:text-amber-500" />
                          </div>
                          <div className="absolute -top-3 -right-3 w-8 h-8 bg-amber-500 text-white text-xs font-black flex items-center justify-center rounded-xl border-4 border-white shadow-lg">
                            #{i + 1}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground tracking-tight truncate w-32 uppercase">{ms.student_name || t("N/A")}</p>
                          <div className="flex items-center justify-center gap-2 mt-2">
                            <span className="text-[10px] font-black bg-amber-50 text-amber-600 px-2 py-1 rounded-md border border-amber-100 uppercase tracking-widest">{t(ms.grade || "Score")}</span>
                            <span className="text-sm font-black text-slate-700">{ms.percentage?.toFixed(1) || 0}%</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-3 py-10 text-center flex flex-col items-center gap-4 opacity-30">
                      <Trophy className="w-12 h-12" />
                      <p className="text-[10px] font-black uppercase tracking-widest">{t("No recent records found")}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Side Panel */}
          <div className="space-y-8">
            <TodayBirthdaysCard />
            <Card className="rounded-[2rem] border border-white/10 bg-slate-900/95 text-white shadow-dashboard-soft-lg backdrop-blur-xl overflow-hidden relative transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-dashboard-hover hover:border-white/15">
              <div className="absolute top-0 right-0 p-10 opacity-10">
                <Bell className="w-24 h-24" />
              </div>
              <CardContent className="p-10 relative z-10 space-y-8">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
                  <Bell className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight leading-tight mb-3">{t("Admin")}<br />{t("Notices")}</h3>
                  <div className="space-y-4">
                    {announcements.length > 0 ? (
                      announcements.slice(0, 1).map((ann) => (
                        <div key={ann.id} className="bg-white/5 p-4 rounded-xl border border-white/10">
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2 italic">{t(ann.title)}</p>
                          <p className="text-xs font-medium text-slate-400 uppercase tracking-widest leading-relaxed line-clamp-3">
                            {t(ann.content)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-widest leading-relaxed">
                        {t("No new updates from the regional headquarters.")}
                      </p>
                    )}
                  </div>
                </div>
                <Link to="/dashboard/announcements" className="block w-full py-5 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-100 transition-all text-center shadow-lg active:scale-95">
                  {t("View Bulletins")}
                </Link>
              </CardContent>
            </Card>

            <Card variant="dashboard">
              <CardHeader className="px-8 py-6 border-b border-border/40 bg-gradient-to-r from-emerald-50/40 to-transparent">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                    <IndianRupee className="w-5 h-5 text-emerald-600" />
                  </div>
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                    {t("Wallet Summary")}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-10 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">{t("Available Credit")}</p>
                <h4 className="text-5xl font-black text-slate-900 tracking-tighter mb-10">
                  ₹{wallet?.balance?.toLocaleString() || "0"}
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  <Link to="/dashboard/wallet/withdraw" className="py-5 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-dark transition-all shadow-lg shadow-primary/20">{t("Withdraw Funds")}</Link>
                  <Link to="/dashboard/wallet/add" className="py-5 bg-slate-50 border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all">{t("Add Credits")}</Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

import type { ComponentType } from "react";

const CenterStatCardSkeleton = () => (
  <div className="dashboard-skeleton">
    <div className="flex justify-between mb-4">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <Skeleton className="h-3 w-20" />
    </div>
    <Skeleton className="h-3 w-24 mb-2" />
    <Skeleton className="h-8 w-28" />
  </div>
);

interface CenterMetricCardProps {
  title: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  trend: string;
}
const CenterMetricCard = ({ title, value, icon: Icon, color, trend }: CenterMetricCardProps) => (
  <Card variant="dashboardStat" className="group">
    <CardContent className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/12 via-sky-500/8 to-violet-500/10 flex items-center justify-center border border-primary/15 shadow-inner group-hover:scale-105 transition-transform duration-300 ease-out motion-reduce:group-hover:scale-100">
          <Icon className={cn("w-5 h-5 drop-shadow-sm", color)} />
        </div>
        <span className="text-[9px] font-heading font-black uppercase text-emerald-600 tracking-widest">{trend}</span>
      </div>
      <p className="text-[10px] font-heading font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">{title}</p>
      <h3 className="text-2xl font-heading font-black tabular-nums-dense tracking-tight text-foreground">{value}</h3>
    </CardContent>
  </Card>
);

interface ChecklistItemProps {
  title: string;
  subtitle: string;
  time: string;
  status: "pending" | "urgent" | "completed";
}
const ChecklistItem = ({ title, subtitle, time, status }: ChecklistItemProps) => (
  <div className="p-4 flex items-center justify-between group hover:bg-muted/30 transition-colors">
    <div className="flex items-center gap-4">
      <div className={cn(
        "w-8 h-8 flex items-center justify-center border transition-all",
        status === "completed" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" :
          status === "urgent" ? "bg-destructive/10 border-destructive/20 text-destructive animate-pulse" :
            "bg-muted border-border text-muted-foreground"
      )}>
        {status === "completed" ? <CheckSquare className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
      </div>
      <div>
        <p className={cn("text-xs font-bold uppercase tracking-tight", status === "completed" ? "text-muted-foreground line-through" : "text-foreground")}>{title}</p>
        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">{subtitle}</p>
      </div>
    </div>
    <span className={cn("text-[9px] font-black uppercase tracking-widest", status === "urgent" ? "text-destructive" : "text-muted-foreground")}>{time}</span>
  </div>
);

export default CenterDashboard;
