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
  PlayCircle,
  FileText,
  ChevronRight,
  IndianRupee,
  QrCode,
  Trophy,
  ClipboardList,
  Keyboard,
  Zap,
  Target,
  GraduationCap,
  AlertTriangle,
  Ticket,
  Users,
  ExternalLink,
  X,
  Plus,
  ArrowUpRight,
  Library,
  Bell
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useNavigate, Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { apiFetch } from "@/lib/api";
import { getServerNow } from "@/lib/time";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { USE_EXAM_V2 } from "@/config/featureFlags";
import { V2Paper, V2Exam } from "./exam-v2/StudentExamV2Page"; // Import V2Paper and V2Exam interfaces
import { useTranslation } from "react-i18next";

interface StoredUser {
  username?: string;
  role?: string;
  _id?: string;
  id?: string;
  $oid?: string;
}

const oid = (x: any): string => {
  if (!x) return "";
  if (typeof x === "string") return x;
  if (typeof x === "object" && x.$oid) return x.$oid;
  return String(x);
};

import { StudentBirthdayBanner } from "@/components/BirthdayWidget";

const StudentDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [metrics, setMetrics] = useState({
    attendancePercentage: 0,
    courseProgress: 0,
    pendingAssignments: 0,
    currentGpa: 0,
    activeModules: 0,
    pendingExams: 0,
    evaluatedExams: 0,
    bestTypingWpm: 0,
    avgTypingAccuracy: 0
  });
  const [recentExams, setRecentExams] = useState<any[]>([]);
  const [typingHistory, setTypingHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [v2Papers, setV2Papers] = useState<V2Paper[]>([]);
  const [v2Exams, setV2Exams] = useState<V2Exam[]>([]);
  const [attendanceToday, setAttendanceToday] = useState<boolean>(false);
  const [v1Papers, setV1Papers] = useState<any[]>([]);
  const [v1Blueprints, setV1Blueprints] = useState<any[]>([]);
  const [referralStats, setReferralStats] = useState<any>(null);
  const [batchInfo, setBatchInfo] = useState<any>(null);
  const [approvedMarksheet, setApprovedMarksheet] = useState<any>(null);
  const [permissions, setPermissions] = useState<any>(null);

  const [quickLinks, setQuickLinks] = useState<{ label: string; href: string; iconName: string }[]>(() => {
    const saved = localStorage.getItem("dashboard_quick_links_student");
    return saved ? JSON.parse(saved) : [
      { label: t("My Course"), href: "/dashboard/student/courses", iconName: "BookOpen" },
      { label: t("My Attendance"), href: "/dashboard/student/attendance", iconName: "CheckCircle2" },
      { label: t("My Exams"), href: "/dashboard/student/exams", iconName: "FileText" },
    ];
  });

  useEffect(() => {
    localStorage.setItem("dashboard_quick_links_student", JSON.stringify(quickLinks));
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

  const examOf = (p: V2Paper) => v2Exams.find((e) => oid(e._id) === oid(p.exam_id));

  const downloadHallTicket = async () => {
    try {
      const storedUser = sessionStorage.getItem("user");
      if (!storedUser) return;
      const parsed = JSON.parse(storedUser);
      const studentId = parsed._id || parsed.id || parsed.$oid;

      if (!studentId) {
        toast.error("Could not identify student ID");
        return;
      }

      const res = await apiFetch(`/api/exam/hall-ticket/${studentId}`);
      const data = await res.json();
      if (res.ok && data.pdf_url) {
        window.open(data.pdf_url, '_blank');
      } else {
        toast.error(data.message || "Failed to generate hall ticket");
      }
    } catch {
      toast.error("Failed to generate hall ticket");
    }
  };

  const { activeStartableExam, isExamTime, restrictedByAttendance } = useMemo(() => {
    const now = Date.now();
    let activeStartableExam: any = null;
    let isExamTime = false;
    let restrictedByAttendance = false;

    // V2 Check
    for (const p of v2Papers) {
      const st = p.status.toLowerCase();
      const ex = examOf(p);
      if (!ex) continue;

      const start = new Date(ex.start_at).getTime();
      const end = new Date(ex.end_at).getTime();
      const inWindow = now >= start && now <= end;

      if (inWindow) isExamTime = true;

      const canEnter = st === "generated" || st === "in_progress";
      const attendanceSatisfied = p.attendance_satisfied || attendanceToday;

      if (canEnter && inWindow) {
        if (!ex.require_attendance || attendanceSatisfied) {
          activeStartableExam = { ...p, isV2: true };
          break;
        } else {
          restrictedByAttendance = true;
        }
      }
    }

    // V1 Check (if V2 not found or not restricted yet)
    if (!activeStartableExam) {
      for (const p of v1Papers) {
        const st = p.status;
        const start = p.start_window ? new Date(p.start_window).getTime() : 0;
        const end = p.end_window ? new Date(p.end_window).getTime() : Infinity;
        const inWindow = now >= start && now <= end;

        // If exam is for tomorrow (now < start), it shouldn't be startable or active
        if (st === "Generated" || st === "InProgress") {
          if (inWindow) {
            isExamTime = true;
            activeStartableExam = { ...p, isV1: true };
            break;
          } else if (st === "InProgress" && now > end) {
            // Expired but stuck in InProgress - don't show as active
            continue;
          }
        }
      }
    }

    return { activeStartableExam, isExamTime, restrictedByAttendance };
  }, [v2Papers, v2Exams, v1Papers, attendanceToday]);

  useEffect(() => {
    const storedUser = sessionStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));

    const fetchMetrics = async () => {
      try {
        const [metricsRes, examsRes, typingRes, v2ExamsRes, attendanceRes, blueprintsRes, batchesRes] = await Promise.all([
          apiFetch("/api/student/metrics"),
          apiFetch(USE_EXAM_V2 ? "/api/exam-v2/papers" : "/api/exam/papers"),
          apiFetch("/api/typing/history"),
          apiFetch("/api/exam-v2/exams"),
          apiFetch("/api/attendance"),
          apiFetch("/api/exam/blueprints"),
          apiFetch("/api/batches")
        ]);

        if (batchesRes.ok) {
          const batches = await batchesRes.json();
          // Find student's batch
          const storedUser = JSON.parse(sessionStorage.getItem("user") || "{}");
          const myBatch = Array.isArray(batches) ? batches.find((b: any) => b._id === storedUser.batch_id || b.id === storedUser.batch_id) : null;
          setBatchInfo(myBatch);
        }

        if (attendanceRes.ok) {
          const att = await attendanceRes.json();
          const today = format(new Date(), "yyyy-MM-dd");
          const presentToday = Array.isArray(att) && att.some((r: any) =>
            format(new Date(r.date), "yyyy-MM-dd") === today &&
            r.status.toLowerCase() === "present"
          );
          setAttendanceToday(presentToday);
        }

        if (metricsRes.ok) {
          const data = await metricsRes.json();
          setMetrics(prev => ({ ...prev, ...data }));
        }

        if (examsRes.ok) {
          const exams = await examsRes.json();
          if (USE_EXAM_V2) {
            setV2Papers(exams);
          } else {
            setV1Papers(exams);
          }
          const pending = USE_EXAM_V2
            ? exams.filter((e: any) => ["generated", "in_progress"].includes(String(e.status).toLowerCase()))
            : exams.filter((e: any) => {
              const isStatusMatch = e.status === "Generated" || e.status === "InProgress";
              if (!isStatusMatch) return false;

              // Also check window for V1
              const now = getServerNow().getTime();
              const start = e.start_window ? new Date(e.start_window).getTime() : 0;
              const end = e.end_window ? new Date(e.end_window).getTime() : Infinity;
              return now >= start && now <= end;
            });

          setRecentExams(pending.slice(0, 3));
          const evaluated = USE_EXAM_V2
            ? exams.filter((e: any) => ["submitted", "evaluated"].includes(String(e.status).toLowerCase()))
            : exams.filter((e: any) => e.status === "Evaluated");
          setMetrics(prev => ({
            ...prev,
            pendingExams: pending.length,
            evaluatedExams: evaluated.length
          }));
        }

        if (blueprintsRes.ok) {
          setV1Blueprints(await blueprintsRes.json());
        }

        if (typingRes.ok) {
          const history = await typingRes.json();
          setTypingHistory(history.slice(0, 3));
          if (history.length > 0) {
            const bestWpm = Math.max(...history.map((h: any) => h.wpm));
            const avgAcc = history.reduce((acc: number, h: any) => acc + h.accuracy, 0) / history.length;
            setMetrics(prev => ({
              ...prev,
              bestTypingWpm: bestWpm,
              avgTypingAccuracy: avgAcc
            }));
          }
        }

        if (v2ExamsRes && v2ExamsRes.ok) {
          const exams = await v2ExamsRes.json();
          setV2Exams(exams);
        }

        // Fetch approved marksheets
        const certsRes = await apiFetch("/api/certificates");
        if (certsRes.ok) {
          const certs = await certsRes.json();
          console.log("=== StudentDashboard.tsx: /api/certificates response ===", certs);
          console.log("=== StudentDashboard.tsx: Number of certificates ===", certs.length);
          const ms = certs.find((c: any) => c.status === "approved"); // The backend already filters for student's own and status=approved
          console.log("=== StudentDashboard.tsx: Approved marksheet found ===", ms);
          setApprovedMarksheet(ms);
        }
      } catch (error) {
        console.error("Error fetching student data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
    fetchReferralStats();
  }, []);

  useEffect(() => {
    // Check for ongoing or starting exams to auto-redirect
    const exams = USE_EXAM_V2 ? v2Papers : v1Papers;
    if (exams.length > 0) {
      const now = getServerNow().getTime();
      const activeOrPending = exams.find((p: any) => {
        const start = p.start_window ? new Date(p.start_window).getTime() : 0;
        const end = p.end_window ? new Date(p.end_window).getTime() : Infinity;
        const inWindow = now >= start && now <= end;

        // Auto-redirect if in progress OR if generated and window is open
        if (p.status === "InProgress") {
          return inWindow; // ONLY redirect if still in window
        }
        if (p.status === "Generated" && p.start_window) {
          return inWindow;
        }
        return false;
      });

      if (activeOrPending) {
        navigate(`/dashboard/student/exams/take/${oid(activeOrPending._id)}`);
      }
    }
  }, [v1Papers, v2Papers, navigate]);

  const stats = [
    { label: t("Attendance"), value: `${metrics.attendancePercentage.toFixed(1)}%`, sub: t("Last 30 days"), icon: Calendar, color: "text-blue-500", bg: "bg-blue-500/10", progress: metrics.attendancePercentage },
    { label: t("Typing Speed"), value: `${Math.round(metrics.bestTypingWpm)} WPM`, sub: t("Best Record"), icon: Keyboard, color: "text-amber-500", bg: "bg-amber-500/10", progress: 0 },
    { label: t("Course Progress"), value: `${metrics.courseProgress}%`, sub: t("Current Module"), icon: BookOpen, color: "text-green-500", bg: "bg-green-500/10", progress: metrics.courseProgress },
    { label: t("Evaluated"), value: metrics.evaluatedExams.toString().padStart(2, "0"), sub: t("Results Ready"), icon: Award, color: "text-purple-500", bg: "bg-purple-500/10", progress: 0 },
  ];

  return (
    <DashboardLayout role="Student">
      {restrictedByAttendance ? (
        <div className="max-w-4xl mx-auto py-20 px-6">
          <Card className="rounded-[2rem] border-2 border-dashed border-destructive/20 bg-destructive/5 overflow-hidden">
            <div className="p-12 flex flex-col items-center text-center space-y-6">
              <div className="w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center animate-pulse">
                <AlertTriangle className="w-12 h-12 text-destructive" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black uppercase tracking-tight text-foreground">{t("Access Restricted")}</h2>
                <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest">{t("Attendance Not Marked")}</p>
              </div>
              <div className="max-w-md bg-white p-6 rounded-2xl border border-border shadow-sm">
                <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                  {t("An examination is currently scheduled or active for today. Your dashboard access has been restricted because your attendance hasn't been marked present yet.")}
                </p>
                <div className="mt-6 p-4 bg-muted/50 rounded-xl flex items-start gap-3 text-left">
                  <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-[10px] font-bold uppercase tracking-wide leading-normal">
                    {t("Please contact your center administrator immediately to mark your attendance so you can proceed with your examination.")}
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8 py-6 bg-background border border-border hover:bg-muted transition-colors"
                >
                  {t("Check Status Again")}
                </button>
                <button
                  onClick={downloadHallTicket}
                  className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8 py-6 bg-primary text-white hover:bg-primary-dark transition-colors flex items-center gap-2"
                >
                  <Ticket className="w-4 h-4" />
                  {t("Download Hall Ticket")}
                </button>
              </div>
            </div>
          </Card>
        </div>
      ) : activeStartableExam ? (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4 text-center">
          <Zap className="w-20 h-20 text-primary mb-6 animate-pulse" />
          <h2 className="text-3xl font-bold text-foreground mb-3">{t("Exam in Progress!")}</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-md">
            {t("You have an active exam. Please click the button below to start or resume your assessment. All other dashboard features are temporarily disabled.")}
          </p>
          <div className="flex flex-col gap-4 w-full max-w-xs">
            <Link to={activeStartableExam.isV2 ? `/dashboard/student/exams/take-v2/${oid(activeStartableExam._id)}` : `/dashboard/student/exams/take/${oid(activeStartableExam._id)}`}>
              <button className="w-full h-14 text-lg rounded-xl font-bold bg-primary hover:bg-primary-dark text-white shadow-lg flex items-center justify-center">
                <PlayCircle className="w-6 h-6 mr-3" />
                {(activeStartableExam.status.toLowerCase() === "in_progress" || activeStartableExam.status === "InProgress") ? t("Resume Exam") : t("Start Exam")}
              </button>
            </Link>
            <button
              onClick={downloadHallTicket}
              className="w-full h-14 text-sm rounded-xl font-black uppercase tracking-widest border-2 border-primary/20 hover:bg-primary/5 text-primary transition-all flex items-center justify-center gap-2"
            >
              <Ticket className="w-5 h-5" />
              {t("Download Hall Ticket")}
            </button>
          </div>
        </div>
      ) : (
        <div className="dashboard-page">
          <StudentBirthdayBanner />
          {/* Header Section */}
          <div className="dashboard-hero">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-primary" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60">{t("Student Portal")}</span>
              </div>
              <h1 className="font-heading font-black text-4xl text-foreground tracking-tight text-balance md:text-5xl">
                {t("Welcome back,")}{" "}
                <span className="bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
                  {user?.username?.split(" ")[0] || t("Student")}
                </span>
                !
              </h1>
              <p className="text-muted-foreground mt-2 text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4 text-accent" /> {format(new Date(), "EEEE, dd MMMM yyyy")}
              </p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-gradient-to-br from-primary/8 via-white/60 to-accent/10 px-6 py-4 shadow-dashboard-soft backdrop-blur-md flex items-center gap-5 transition-all duration-300 ease-out hover:shadow-dashboard-soft-lg md:px-8">
              <div className="relative">
                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)]" />
                <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-500 animate-ping opacity-40" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">{t("Current Program")}</p>
                <p className="text-sm font-black text-primary uppercase tracking-tight mt-0.5">{t((user as any)?.course || "ADCA (Advanced Diploma)")}</p>
              </div>
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
                    Users, GraduationCap, BookOpen, Library, Calendar, FileText, Award, Trophy, Keyboard, Clock, Bell, MessageSquare, PlayCircle, Zap, CheckCircle2, ExternalLink
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

          {/* Learning Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading
              ? Array.from({ length: 4 }, (_, i) => <StudentStatCardSkeleton key={i} />)
              : stats.map((stat) => (
                <StudentMetricCard
                  key={stat.label}
                  title={stat.label}
                  value={stat.value}
                  icon={stat.icon}
                  color={stat.color}
                />
              ))}
          </div>

          {/* Marksheet Quick Access */}
          {user?._id && (
            <div className="mt-8">
              <Card className="rounded-[2rem] border-2 border-primary/10 bg-primary/5 p-8 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-primary/30 transition-all shadow-lg hover:shadow-primary/5 group">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-primary/20 flex items-center justify-center border border-primary/10 shadow-inner group-hover:scale-110 transition-transform">
                    <FileText className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight text-foreground">{t("Academic Marksheet")}</h3>
                    <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-1">
                      {approvedMarksheet
                        ? t("Your consolidated marksheet is ready for download")
                        : t("Generated after all subject examinations are completed")}
                    </p>
                  </div>
                </div>
                <Link to={`/dashboard/student/marksheet/${user._id}`}>
                  <Button
                    disabled={!approvedMarksheet}
                    className={cn(
                      "rounded-xl font-black uppercase text-[10px] tracking-[0.2em] h-14 px-10 transition-all shadow-md",
                      approvedMarksheet
                        ? "bg-primary text-white hover:bg-primary-dark shadow-primary/20"
                        : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                    )}
                  >
                    {approvedMarksheet ? t("View & Download") : t("Not Available Yet")}
                    <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </Card>
            </div>
          )}

          {/* Batch Information Section */}
          {batchInfo && (
            <Card variant="dashboard" className="border-l-4 border-l-primary overflow-hidden bg-gradient-to-br from-primary/5 via-white to-transparent hover-popup-subtle">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-[2rem] bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                      <Users className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-black uppercase tracking-tight text-foreground">{batchInfo.name}</h3>
                        <span className="px-3 py-1 bg-green-500/10 text-green-500 text-[10px] font-black uppercase tracking-widest border border-green-500/20 rounded-full">
                          {t("Active Batch")}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 mt-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="w-4 h-4 text-primary" />
                          <span className="text-xs font-bold uppercase tracking-wider">{batchInfo.time_slot}</span>
                        </div>
                        <div className="w-1 h-1 rounded-full bg-border" />
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="w-4 h-4 text-primary" />
                          <div className="flex gap-1">
                            {batchInfo.days.map((d: string) => (
                              <span key={d} className="text-[10px] font-black uppercase tracking-widest">{d}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="hidden md:block h-12 w-px bg-border/60" />
                  <div className="flex flex-col items-center md:items-end">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">{t("Batch Strength")}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-primary tracking-tighter">{batchInfo.current_count}</span>
                      <span className="text-sm font-bold text-muted-foreground uppercase">/ {batchInfo.max_capacity}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Refer & Earn Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card variant="dashboard" className="md:col-span-2 border-l-4 border-l-primary overflow-hidden bg-gradient-to-br from-primary/5 via-white to-transparent">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/40">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                    <Trophy className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-primary/80">
                      {t("Refer & Earn Rewards")}
                    </CardTitle>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                      {t("Invite friends and get discounts on your fees")}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-primary tracking-tight">₹{referralStats?.total_rewards || 0}</div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t("Earned")}</p>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="flex-1 w-full space-y-6">
                    <div className="p-6 bg-white rounded-[2rem] border-2 border-dashed border-primary/30 shadow-sm relative group transition-all hover:border-primary/50">
                      <div className="absolute -top-3 left-6 px-4 py-1 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-primary/20">
                        {t("Your Unique Code")}
                      </div>
                      <div className="flex items-center justify-between gap-6">
                        <div className="text-3xl font-black font-mono tracking-tighter text-foreground selection:bg-primary/20">
                          {referralStats?.referral_code || "---"}
                        </div>
                        <Button
                          onClick={copyReferralCode}
                          className="rounded-2xl font-black text-xs uppercase tracking-[0.2em] h-14 px-8 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-1 transition-all"
                        >
                          {t("Copy Code")}
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-around gap-4 p-4 bg-muted/30 rounded-2xl border border-border/40">
                      <div className="text-center">
                        <div className="text-xl font-black text-foreground">{referralStats?.total_referrals || 0}</div>
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{t("Friends Joined")}</p>
                      </div>
                      <div className="w-px h-10 bg-border/60" />
                      <div className="text-center">
                        <div className="text-xl font-black text-foreground">₹500</div>
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{t("Reward per Refer")}</p>
                      </div>
                    </div>
                  </div>
                  <div className="w-full md:w-48 flex flex-col items-center gap-3 p-6 bg-white rounded-[2rem] border border-border/40 shadow-sm">
                    <div className="p-3 bg-muted/30 rounded-2xl">
                      <QRCodeSVG
                        value={referralStats?.referral_code || ""}
                        size={100}
                        level="H"
                        includeMargin={false}
                      />
                    </div>
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest text-center leading-relaxed">
                      {t("Scan to Share")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card variant="dashboard" className="border-l-4 border-l-accent overflow-hidden bg-gradient-to-br from-accent/5 via-white to-transparent">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/40">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20 shadow-inner">
                    <CheckCircle2 className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-accent/80">
                      {t("Attendance Status")}
                    </CardTitle>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                      {t("Your presence record")}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-col gap-6">
                  <div className="text-center p-8 bg-accent/5 rounded-[2rem] border border-accent/10">
                    <div className="text-5xl font-black text-accent tracking-tighter">{metrics.attendancePercentage}%</div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-3">
                      {t("Current Month Average")}
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <span>{t("Progress to Goal")}</span>
                      <span className="text-accent">75% {t("Min Required")}</span>
                    </div>
                    <div className="w-full bg-accent/10 h-3 rounded-full overflow-hidden p-0.5 border border-accent/10">
                      <div
                        className="h-full bg-accent rounded-full shadow-sm shadow-accent/20 transition-all duration-1000"
                        style={{ width: `${metrics.attendancePercentage}%` }}
                      />
                    </div>
                    <p className="text-[9px] font-bold text-accent/80 uppercase tracking-widest flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {t("Last updated: Today, 09:30 AM")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Main Learning Content */}
            <div className="lg:col-span-2 space-y-8">
              <Card variant="dashboard">
                <CardHeader className="border-b border-border/40 px-8 py-6 flex flex-row items-center justify-between bg-gradient-to-r from-sky-50/40 to-transparent">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-foreground/80">
                      {t("Academic Progress")}
                    </CardTitle>
                  </div>
                  <Link to="/dashboard/student/courses" className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary-dark transition-colors px-4 py-2 bg-primary/5 rounded-full border border-primary/10">
                    {t("Detailed Report")}
                  </Link>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                  {[
                    { title: t("Advanced MS Office"), status: t("Completed"), progress: 100, icon: CheckCircle2, color: "emerald" },
                    { title: t("Web Technologies (HTML/CSS)"), status: t("In Progress"), progress: 65, icon: Clock, color: "primary" },
                    { title: t("Tally Prime & GST"), status: t("Upcoming"), progress: 0, icon: PlayCircle, color: "muted" },
                  ].map((module) => (
                    <div key={module.title} className="space-y-4 group">
                      <div className="flex justify-between items-end">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-all group-hover:scale-110",
                            module.status === t("Completed") ? "bg-emerald-50 text-emerald-500" :
                              module.status === t("In Progress") ? "bg-primary/5 text-primary" : "bg-muted text-muted-foreground/60"
                          )}>
                            <module.icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-foreground tracking-tight">{module.title}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">{module.status}</p>
                          </div>
                        </div>
                        <span className="text-sm font-black text-foreground/80">{module.progress}%</span>
                      </div>
                      <div className="w-full bg-muted/50 h-2.5 rounded-full overflow-hidden p-0.5 border border-border/30">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-1000 shadow-sm",
                            module.status === t("Completed") ? "bg-emerald-500" :
                              module.status === t("In Progress") ? "bg-gradient-to-r from-primary to-accent" : "bg-muted-foreground/20"
                          )}
                          style={{ width: `${module.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card variant="dashboard" className="group">
                  <CardHeader className="px-8 py-6 border-b border-border/40 bg-muted/5">
                    <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3 text-primary">
                      <PlayCircle className="w-4 h-4" />
                      {t("Latest Session")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 relative">
                      <div className="absolute inset-0 bg-primary/10 rounded-full animate-ping opacity-20" />
                      <PlayCircle className="w-10 h-10 text-primary z-10" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest text-foreground">{t("JavaScript Functions")}</p>
                    <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-tight">{t("Recorded 2 hours ago • 45 mins")}</p>
                    <button className="mt-6 w-full rounded-xl bg-primary hover:bg-primary-dark text-white shadow-md shadow-primary/20 font-bold uppercase text-[10px] tracking-widest py-6">
                      {t("Watch Now")}
                    </button>
                  </CardContent>
                </Card>

                <Card variant="dashboard" className="group">
                  <CardHeader className="px-8 py-6 border-b border-border/40 bg-muted/5">
                    <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3 text-emerald-500">
                      <Award className="w-4 h-4" />
                      {t("Certifications")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                      <Award className="w-10 h-10 text-emerald-500" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest text-foreground">{t("1 Professional Certificate")}</p>
                    <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-tight">{t("Verified & Ready for Download")}</p>
                    <Link to="/dashboard/student/certificates" className="mt-6 w-full">
                      <button className="w-full rounded-xl border border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 font-bold uppercase text-[10px] tracking-widest py-6">
                        {t("View Documents")}
                      </button>
                    </Link>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Schedule Sidebar */}
            <div className="space-y-8">
              <Card variant="dashboard">
                <CardHeader className="px-8 py-6 border-b border-border/40 bg-muted/5">
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-accent" />
                    {t("Weekly Schedule")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/40">
                    {[
                      { date: "26", month: t("Feb"), title: t("JavaScript Basics"), time: "10:30 AM", room: t("Lab 2"), type: t("Lecture") },
                      { date: "27", month: t("Feb"), title: t("Web Design Lab"), time: "02:00 PM", room: t("Lab 1"), type: t("Practical") },
                    ].map((cls, i) => (
                      <div key={i} className="p-6 flex gap-5 hover:bg-muted/20 transition-all group">
                        <div className="flex flex-col items-center justify-center bg-white w-14 h-14 rounded-2xl border border-border/60 shadow-sm group-hover:border-primary/40 group-hover:shadow-md transition-all shrink-0">
                          <span className="text-sm font-black text-foreground leading-none">{cls.date}</span>
                          <span className="text-[9px] uppercase font-black text-primary mt-1">{cls.month}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md",
                              cls.type === t("Lecture") ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                            )}>{cls.type}</span>
                          </div>
                          <p className="text-sm font-bold text-foreground tracking-tight">{cls.title}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{cls.time} • {cls.room}</p>
                        </div>
                        <button className="self-center p-2 text-muted-foreground/40 hover:text-primary transition-colors">
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[2rem] border border-white/15 bg-gradient-to-br from-primary via-primary to-primary-dark text-white shadow-dashboard-soft-lg backdrop-blur-xl overflow-hidden relative transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-dashboard-hover">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <ClipboardList className="w-24 h-24" />
                </div>
                <CardHeader className="bg-white/5 border-b border-white/10 px-8 py-6 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3">
                    <ClipboardList className="w-4 h-4" />
                    {t("Active Exams")}
                  </CardTitle>
                  <Link to="/dashboard/student/exams" className="text-[9px] font-black uppercase text-white/60 hover:text-white transition-colors bg-white/10 px-3 py-1.5 rounded-full">{t("All Exams")}</Link>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-white/10">
                    {recentExams.length > 0 ? recentExams.map((exam, i) => (
                      <div key={i} className="p-6 flex justify-between items-center hover:bg-white/5 transition-colors group">
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest">#{oid(exam._id).substring(oid(exam._id).length - 6)}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                            <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">{t(exam.status)}</p>
                          </div>
                        </div>
                        <Link to="/dashboard/student/exams">
                          <button className="h-10 rounded-xl px-6 text-[10px] font-black uppercase tracking-widest border border-white/20 hover:bg-white hover:text-primary transition-all text-white">
                            {t("Launch")}
                          </button>
                        </Link>
                      </div>
                    )) : (
                      <div className="p-10 text-center opacity-50 text-[10px] font-black uppercase tracking-[0.2em]">{t("No pending assessments")}</div>
                    )}
                  </div>

                  {recentExams.length > 0 && (
                    <div className="p-6 pt-0">
                      <button
                        onClick={downloadHallTicket}
                        className="w-full h-12 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all"
                      >
                        <Ticket className="w-4 h-4" />
                        {t("Download Hall Ticket")}
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card variant="dashboard" className="group">
                <CardHeader className="px-8 py-6 border-b border-border/40 bg-amber-50/30">
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3 text-amber-600">
                    <Keyboard className="w-4 h-4" />
                    {t("Typing Master")}
                  </CardTitle>
                  <Link to="/dashboard/student/typing" className="text-[9px] font-black uppercase text-amber-600/60 hover:text-amber-600 transition-colors bg-amber-500/10 px-3 py-1.5 rounded-full">{t("New Test")}</Link>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/40">
                    {typingHistory.length > 0 ? typingHistory.map((res, i) => (
                      <div key={i} className="p-6 flex justify-between items-center hover:bg-amber-50/20 transition-colors">
                        <div className="flex gap-6">
                          <div className="text-center">
                            <p className="text-lg font-black text-amber-600 leading-none">{Math.round(res.wpm)}</p>
                            <p className="text-[8px] font-black text-muted-foreground uppercase mt-1">{t("WPM")}</p>
                          </div>
                          <div className="w-px h-8 bg-border/60 self-center" />
                          <div className="text-center">
                            <p className="text-lg font-black text-foreground/80 leading-none">{Math.round(res.accuracy)}%</p>
                            <p className="text-[8px] font-black text-muted-foreground uppercase mt-1">{t("ACCURACY")}</p>
                          </div>
                        </div>
                        <Link to="/dashboard/typing/history">
                          <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all text-muted-foreground">
                            <TrendingUp className="w-4 h-4" />
                          </div>
                        </Link>
                      </div>
                    )) : (
                      <div className="p-10 text-center opacity-50 text-[10px] font-black uppercase tracking-[0.2em]">{t("No practice records")}</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

import type { ComponentType } from "react";

const StudentStatCardSkeleton = () => (
  <div className="dashboard-skeleton">
    <div className="flex justify-between mb-4">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <Skeleton className="h-3 w-16" />
    </div>
    <Skeleton className="h-3 w-24 mb-2" />
    <Skeleton className="h-8 w-24" />
  </div>
);

interface StudentMetricCardProps {
  title: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
}
const StudentMetricCard = ({ title, value, icon: Icon, color }: StudentMetricCardProps) => (
  <Card variant="dashboardStat" className="group">
    <CardContent className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/12 via-violet-500/10 to-accent/10 flex items-center justify-center border border-primary/15 shadow-inner group-hover:scale-105 transition-transform duration-300 ease-out motion-reduce:group-hover:scale-100">
          <Icon className={cn("w-5 h-5 drop-shadow-sm", color)} />
        </div>
      </div>
      <p className="text-[10px] font-heading font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">{title}</p>
      <h3 className="text-2xl font-heading font-black tabular-nums-dense tracking-tight text-foreground">{value}</h3>
    </CardContent>
  </Card>
);

export default StudentDashboard;
