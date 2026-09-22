import { useState, useEffect, useMemo } from "react";
import DashboardLayout, { getDashboardMenuItems } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TodayBirthdaysCard } from "@/components/BirthdayWidget";
import {
  School,
  GraduationCap,
  PlusCircle,
  TrendingUp,
  IndianRupee,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Calendar,
  Mail,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ClipboardList,
  PenTool,
  BarChart3,
  PieChart as PieChartIcon,
  MapPin,
  Plus,
  X,
  ExternalLink,
  Users,
  LayoutDashboard,
  History,
  Filter,
  Bell,
  MessageSquare,
  Handshake,
  Image,
  Download,
  ShieldCheck,
  Layers,
  BookOpen,
  Library,
  FlaskConical,
  Database,
  Zap,
  Video,
  List,
  Trash2,
  Award,
  Send,
  Paperclip,
  IdCard,
  Settings,
  ShoppingBag,
  Globe,
  Trophy,
  Star,
  CheckSquare,
  HardDrive,
  FileSpreadsheet,
  UserCheck,
  Languages,
  BookCheck,
  Upload,
  CreditCard,
  Stamp
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { useTranslation } from "react-i18next";

const AdminDashboard = () => {
  const { t } = useTranslation();
  const [examData, setExamData] = useState<any[]>([]);
  const [passFailData, setPieData] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({
    totalCenters: 0,
    totalStudents: 0,
    totalRevenue: 0,
    activeAnnouncements: 0,
    activeExams: 0,
    pendingEvaluations: 0,
    totalEvaluated: 0
  });
  const [crmMetrics, setCrmMetrics] = useState({
    total: 0,
    new_count: 0,
    contacted_count: 0,
    followup_count: 0,
    converted_count: 0,
    lost_count: 0,
    due_today: 0,
    overdue: 0,
    upcoming: 0
  });
  const [centers, setCenters] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [permissions, setPermissions] = useState<any>(null);

  const [quickLinks, setQuickLinks] = useState<{ label: string; href: string; iconName: string }[]>(() => {
    const saved = localStorage.getItem("dashboard_quick_links");
    return saved ? JSON.parse(saved) : [
      { label: t("All Students"), href: "/dashboard/students", iconName: "Users" },
      { label: t("All Centers"), href: "/dashboard/centers", iconName: "School" },
      { label: t("Transactions"), href: "/dashboard/finance/transactions", iconName: "IndianRupee" },
    ];
  });

  useEffect(() => {
    const storedUser = sessionStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("dashboard_quick_links", JSON.stringify(quickLinks));
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

  const { data: dashboardData, isLoading: dashboardLoading, isError } = useQuery({
    queryKey: ["admin-dashboard-data"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/dashboard-data");
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      return res.json();
    },
    staleTime: 60000, // 1 minute cache
  });

  useEffect(() => {
    if (dashboardData) {
      if (dashboardData.metrics) setMetrics(dashboardData.metrics);
      
      const crmData = dashboardData.crmMetrics || dashboardData.crm_metrics;
      if (crmData) setCrmMetrics(crmData);
      
      const centersData = dashboardData.recentCenters || dashboardData.recent_centers;
      if (centersData) setCenters(centersData);
      
      const logsData = dashboardData.recentLogs || dashboardData.recent_logs;
      if (logsData) setLogs(logsData);
      
      setLoading(false);
    } else if (isError) {
      setLoading(false);
      toast.error("Failed to load critical dashboard data. Some widgets may be empty.");
    }
  }, [dashboardData, isError]);

  const fetchExamMetrics = async () => {
    try {
      const [papersRes, blueprintsRes] = await Promise.all([
        apiFetch("/api/exam/papers"),
        apiFetch("/api/exam/blueprints")
      ]);

      if (papersRes.ok && blueprintsRes.ok) {
        const papers: any[] = await papersRes.json();
        const blueprints: any[] = await blueprintsRes.json();

        setMetrics(prev => ({
          ...prev,
          activeExams: papers.filter(p => p.status === "InProgress").length,
          pendingEvaluations: papers.filter(p => p.status === "Submitted").length,
          totalEvaluated: papers.filter(p => p.status === "Evaluated").length
        }));

        const evaluated = papers.filter(p => p.status === "Evaluated");
        let passed = 0;
        let failed = 0;

        evaluated.forEach(p => {
          const bp = blueprints.find(b => b._id === p.blueprint_id);
          if (bp && p.total_obtained_marks >= bp.passing_marks) passed++;
          else failed++;
        });

        setPieData([
          { name: t('Passed'), value: passed, color: '#10b981' },
          { name: t('Failed'), value: failed, color: '#ef4444' }
        ]);

        const bpPerformance = blueprints.map(bp => {
          const bpPapers = evaluated.filter(p => p.blueprint_id === bp._id);
          const avgScore = bpPapers.length > 0
            ? bpPapers.reduce((acc, curr) => acc + curr.total_obtained_marks, 0) / bpPapers.length
            : 0;
          return {
            name: bp.name.substring(0, 15),
            average: Math.round(avgScore),
            total: bp.total_marks
          };
        }).filter(b => b.average > 0).slice(0, 5);

        setExamData(bpPerformance);
      }
    } catch (error) {
      console.error("Error fetching exam metrics:", error);
    }
  };

  const fetchMetrics = async () => {
    try {
      const response = await apiFetch("/api/admin/metrics");
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
    }
  };

  const fetchCrmMetrics = async () => {
    try {
      const response = await apiFetch("/api/admin/enquiries/metrics");
      if (response.ok) {
        const data = await response.json();
        setCrmMetrics(data);
      }
    } catch (error) {
      console.error("Error fetching CRM metrics:", error);
    }
  };

  const toId = (v: any): string => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && "$oid" in v) return v.$oid;
    return String(v || "");
  };

  const fetchCenters = async () => {
    try {
      const response = await apiFetch("/api/centers");
      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data) ? data : [];
        const normalized = list.map((c: any) => ({
          ...c,
          _id: toId(c?._id),
        }));
        setCenters(normalized.slice(0, 5));
      }
    } catch (error) {
      console.error("Error fetching centers:", error);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await apiFetch("/api/admin/logs?limit=4");
      if (response.ok) {
        const data = await response.json();
        setLogs(data.items);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  };

  return (
    <DashboardLayout role="Admin">
      <div className="dashboard-page">
        <div className="dashboard-hero">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity className="w-4 h-4 text-primary" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60">{t("System Overview")}</span>
            </div>
            <h1 className="font-heading font-black text-4xl text-foreground tracking-tight text-balance md:text-5xl">{t("Admin")} <span className="bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">{t("Console")}</span></h1>
            <p className="text-muted-foreground mt-2 text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-accent" /> {format(new Date(), "EEEE, dd MMMM yyyy")}
            </p>
          </div>
          <Link to="/dashboard/centers/add" className="flex items-center gap-4 bg-gradient-to-br from-primary to-primary-dark text-primary-foreground px-10 py-5 rounded-2xl font-heading font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 hover:-translate-y-1 transition-all duration-300 ease-out group active:scale-[0.98] motion-reduce:hover:translate-y-0">
            <PlusCircle className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            {t("Create New Center")}
          </Link>
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
                  Users, School, IndianRupee, LayoutDashboard, TrendingUp, BarChart3, History, Mail, Filter, Bell, MessageSquare, Handshake, FileText, Image, Download, ShieldCheck, Layers, BookOpen, Library, Calendar, ClipboardList, FlaskConical, Database, Zap, Video, PlusCircle, List, Trash2, Award, Send, Paperclip, IdCard, Settings, ShoppingBag, Globe, MapPin, AlertTriangle, Trophy, Star, PenTool, CheckSquare, HardDrive, FileSpreadsheet, UserCheck, Languages, BookCheck, Upload, CreditCard, Stamp
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            Array.from({ length: 4 }, (_, i) => <AdminStatCardSkeleton key={i} />)
          ) : (
            <>
              <MetricCard
                title={t("Total Centers")}
                value={metrics.totalCenters}
                icon={School}
                trend={t("{{count}} Active", { count: metrics.totalCenters })}
                trendUp={true}
                color="text-blue-500"
              />
              <MetricCard
                title={t("Total Students")}
                value={metrics.totalStudents}
                icon={GraduationCap}
                trend={t("{{count}} Enrolled", { count: metrics.totalStudents })}
                trendUp={true}
                color="text-emerald-500"
              />
              <MetricCard
                title={t("Total Revenue")}
                value={`₹${(metrics.totalRevenue || 0).toLocaleString()}`}
                icon={IndianRupee}
                trend={t("Current Period")}
                trendUp={true}
                color="text-amber-500"
              />
              <MetricCard
                title={t("System Load")}
                value={t("Optimal")}
                icon={Activity}
                trend={t("99.9% Uptime")}
                trendUp={true}
                color="text-purple-500"
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
          {loading ? (
            Array.from({ length: 4 }, (_, i) => <AdminStatCardSkeleton key={`crm-${i}`} />)
          ) : (
            <>
              <MetricCard
                title={t("New Leads")}
                value={crmMetrics.new_count}
                icon={Mail}
                trend={t("Total {{count}}", { count: crmMetrics.total })}
                trendUp={true}
                color="text-sky-500"
              />
              <MetricCard
                title={t("Due Today")}
                value={crmMetrics.due_today}
                icon={Clock}
                trend={t("Follow-ups")}
                trendUp={true}
                color="text-amber-500"
              />
              <MetricCard
                title={t("Overdue")}
                value={crmMetrics.overdue}
                icon={AlertTriangle}
                trend={t("Needs action")}
                trendUp={false}
                color="text-red-500"
              />
              <MetricCard
                title={t("Converted")}
                value={crmMetrics.converted_count}
                icon={CheckCircle2}
                trend={t("Follow-up {{count}}", { count: crmMetrics.followup_count })}
                trendUp={true}
                color="text-emerald-500"
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-10">
          <Card variant="dashboard">
            <CardHeader className="border-b border-border/40 px-8 py-6 bg-gradient-to-r from-slate-50/80 to-violet-50/30">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center shadow-inner border border-violet-500/20">
                  <BarChart3 className="w-5 h-5 text-violet-600" />
                </div>
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-foreground/80">
                  {t("Blueprint Performance")}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-8 h-[400px]">
              {examData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={examData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                    />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="average" fill="url(#barGradient)" radius={[8, 8, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center flex-col gap-4 text-muted-foreground">
                  <BarChart3 className="w-12 h-12 opacity-10" />
                  <p className="text-[10px] font-black uppercase tracking-widest">{t("No evaluation data found")}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card variant="dashboard">
            <CardHeader className="border-b border-border/40 px-8 py-6 bg-gradient-to-r from-emerald-50/50 to-transparent">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <PieChartIcon className="w-5 h-5 text-white" />
                </div>
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-foreground/80">
                  {t("Pass/Fail Ratio")}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-8 h-[400px]">
              {passFailData.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={passFailData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {passFailData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                    <Legend
                      verticalAlign="bottom"
                      height={40}
                      iconType="circle"
                      formatter={(value) => <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">{t(value)}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center flex-col gap-4 text-muted-foreground">
                  <PieChartIcon className="w-12 h-12 opacity-10" />
                  <p className="text-[10px] font-black uppercase tracking-widest">{t("Awaiting result data")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mt-10">
          <Card variant="dashboard" className="lg:col-span-2">
            <CardHeader className="border-b border-border/40 px-8 py-6 bg-muted/5 flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <School className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-foreground/80">
                  {t("Regional Center Performance")}
                </CardTitle>
              </div>
              <Link to="/dashboard/centers" className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/5 px-4 py-2 rounded-full border border-primary/10 hover:bg-primary/10 transition-colors">
                {t("View All Centers")}
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/5 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                      <th className="px-8 py-5">{t("Center Details")}</th>
                      <th className="px-8 py-5">{t("Location")}</th>
                      <th className="px-8 py-5">{t("Operational Status")}</th>
                      <th className="px-8 py-5 text-right">{t("Branding")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {centers.length > 0 ? (
                      centers.map((center, i) => (
                        <tr key={i} className="hover:bg-muted/10 transition-colors group">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-black text-slate-400">
                                {center.code?.slice(-2)}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-foreground text-sm tracking-tight">{t(center.name)}</span>
                                <span className="text-[10px] text-primary font-black uppercase tracking-widest mt-1">{center.code}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">{t(center.city)}, {t(center.state)}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <span className={cn(
                              "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-2",
                              center.active
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                : "bg-red-50 text-red-600 border border-red-100"
                            )}>
                              <div className={cn("w-1.5 h-1.5 rounded-full", center.active ? "bg-emerald-500" : "bg-red-500")} />
                              {center.active ? t("Active") : t("Disabled")}
                            </span>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <span className={cn(
                              "text-[9px] font-black uppercase tracking-widest",
                              center.branding_media?.banner_image_url ? "text-primary" : "text-slate-300"
                            )}>
                              {center.branding_media?.banner_image_url ? t("Fully Branded") : t("Awaiting Assets")}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">
                          {t("No center records found in database")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-8">
            <TodayBirthdaysCard />
            <Card variant="dashboard">
              <CardHeader className="px-8 py-6 border-b border-border/40 bg-gradient-to-r from-sky-50/40 to-transparent">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3">
                  <Activity className="w-4 h-4 text-primary" />
                  {t("Live Activity")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                {logs.length > 0 ? (
                  logs.map((log, i) => (
                    <div key={i} className="flex gap-5 group">
                      <div className="relative flex flex-col items-center">
                        <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center border border-border/60 group-hover:bg-primary group-hover:border-primary transition-all duration-300">
                          <Clock className="w-4 h-4 text-slate-400 group-hover:text-white" />
                        </div>
                        {i !== logs.length - 1 && <div className="w-px flex-1 bg-border/60 my-2" />}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">
                          {log.created_at ? format(new Date(log.created_at), "HH:mm") : "--:--"} • {t(log.entity_type)}
                        </p>
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-tight leading-relaxed">
                          {t(log.action)}: <span className="text-slate-400">{t(log.details || log.id.slice(-6))}</span>
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 flex flex-col items-center gap-4 opacity-30">
                    <Activity className="w-10 h-10" />
                    <p className="text-[10px] font-black uppercase tracking-widest">{t("Quiet on the logs")}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border border-white/10 bg-slate-900/95 text-white shadow-dashboard-soft-lg backdrop-blur-xl overflow-hidden relative transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-dashboard-hover hover:border-white/15">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-slate-900/40 to-accent/20 opacity-80" />
              <CardContent className="p-10 relative z-10 space-y-6">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight leading-tight mb-2">{t("Network")}<br />{t("Growth")}</h3>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-widest leading-relaxed">
                    {t("Currently managing")} <span className="text-white">{metrics.totalCenters}</span> {t("active centers across the region.")}
                  </p>
                </div>
                <Link to="/dashboard/revenue" className="block w-full py-5 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-100 transition-all text-center shadow-lg active:scale-95">
                  {t("Financial Analytics")}
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

import type { ComponentType } from "react";

const AdminStatCardSkeleton = () => (
  <div className="dashboard-skeleton">
    <div className="flex justify-between items-start mb-4">
      <Skeleton className="h-12 w-12 rounded-xl" />
      <Skeleton className="h-4 w-14 rounded-full" />
    </div>
    <Skeleton className="h-3 w-28 mb-3" />
    <Skeleton className="h-9 w-24" />
  </div>
);

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  trend: string;
  trendUp: boolean;
  color: string;
}
const MetricCard = ({ title, value, icon: Icon, trend, trendUp, color }: MetricCardProps) => (
  <Card variant="dashboardStat" className="group">
    <CardContent className="p-6">
      <div className="flex justify-between items-start mb-4">
        <div className={cn(
          "w-12 h-12 flex items-center justify-center rounded-xl border transition-all duration-300 ease-out",
          "bg-gradient-to-br from-primary/12 via-sky-500/8 to-violet-500/10 border-primary/15 shadow-inner group-hover:scale-105 motion-reduce:group-hover:scale-100"
        )}>
          <Icon className={cn("w-6 h-6 drop-shadow-sm", color)} />
        </div>
        <div className={cn("flex items-center gap-1 text-[9px] font-heading font-black uppercase tracking-wide", trendUp ? "text-emerald-600" : "text-red-600")}>
          {trendUp ? <ArrowUpRight className="w-3 h-3 transition-transform duration-300 group-hover:-translate-y-px group-hover:translate-x-px" /> : <ArrowDownRight className="w-3 h-3 transition-transform duration-300 group-hover:translate-y-px group-hover:translate-x-px" />}
          {trend}
        </div>
      </div>
      <p className="text-[10px] font-heading font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">{title}</p>
      <h3 className="text-3xl font-heading font-black tabular-nums-dense tracking-tight text-foreground">{value}</h3>
    </CardContent>
  </Card>
);

export default AdminDashboard;
