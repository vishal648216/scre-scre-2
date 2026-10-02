import React, { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Info,
  Calendar,
  Sparkles,
  Search,
  Filter,
  Check,
  X,
  FileCheck,
  Award,
  Building2,
  UserCheck,
  Percent,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO, isSameMonth } from "date-fns";
import { apiFetch, flattenBson } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AttRow {
  _id?: string;
  id?: string;
  date: any;
  date_str?: string;
  status?: string;
  remarks?: string;
  center_id?: string;
}

interface RealExamPaper {
  id?: string;
  _id?: string;
  blueprint_id?: string;
  subject_id?: string;
  subject_name?: string;
  status?: string; // 'Generated', 'InProgress', 'Submitted', 'Evaluated'
  start_window?: string;
  end_window?: string;
  total_marks?: number;
  total_obtained_marks?: number;
  mode?: string;
  exam_mode?: string;
  remarks?: string;
}

export default function StudentAttendanceReportPage() {
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<AttRow[]>([]);
  const [examPapers, setExamPapers] = useState<RealExamPaper[]>([]);
  const [subjectsMap, setSubjectsMap] = useState<Record<string, string>>({});
  const [userProfile, setUserProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("monthly");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [attRes, userRes, papersRes, subsRes] = await Promise.all([
        apiFetch("/api/attendance"),
        apiFetch("/api/users/me"),
        apiFetch("/api/exam/papers"),
        apiFetch("/api/admin/subjects"),
      ]);

      if (attRes.ok) {
        const raw = await attRes.json();
        const data = flattenBson(Array.isArray(raw) ? raw : raw.records || []);
        setAttendance(data);
      }

      if (userRes.ok) {
        const u = await userRes.json();
        setUserProfile(u);
      }

      if (papersRes.ok) {
        const pData = await papersRes.json();
        setExamPapers(Array.isArray(pData) ? pData : []);
      }

      if (subsRes.ok) {
        const sData = await subsRes.json();
        const items = Array.isArray(sData) ? sData : sData.items || [];
        const sMap: Record<string, string> = {};
        items.forEach((s: any) => {
          sMap[String(s.id || s._id)] = s.subject_name;
        });
        setSubjectsMap(sMap);
      }
    } catch (e) {
      console.error("Failed to load attendance report data:", e);
    } finally {
      setLoading(false);
    }
  };

  const parseRowDate = (x: AttRow): Date | null => {
    if (x.date_str) {
      const [y, m, d] = x.date_str.split("-").map(Number);
      if (y && m && d) return new Date(y, m - 1, d);
    }
    if (x.date) {
      const d = new Date(x.date);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  // Group Attendance Records by Month (e.g. "October 2026")
  const monthlyReports = useMemo(() => {
    const map = new Map<
      string,
      {
        monthLabel: string;
        monthKey: string;
        dateObj: Date;
        present: number;
        absent: number;
        late: number;
        leave: number;
        total: number;
        percentage: number;
        records: AttRow[];
      }
    >();

    attendance.forEach((r) => {
      const d = parseRowDate(r);
      if (!d) return;

      const monthKey = format(d, "yyyy-MM");
      const monthLabel = format(d, "MMMM yyyy");

      if (!map.has(monthKey)) {
        map.set(monthKey, {
          monthLabel,
          monthKey,
          dateObj: d,
          present: 0,
          absent: 0,
          late: 0,
          leave: 0,
          total: 0,
          percentage: 0,
          records: [],
        });
      }

      const item = map.get(monthKey)!;
      item.records.push(r);
      item.total += 1;

      const st = r.status?.toLowerCase();
      if (st === "present") item.present += 1;
      else if (st === "absent") item.absent += 1;
      else if (st === "late") item.late += 1;
      else if (st === "leave") item.leave += 1;
    });

    const result = Array.from(map.values()).map((m) => {
      const markedCount = m.present + m.late;
      m.percentage = m.total > 0 ? Math.round((markedCount / m.total) * 100) : 0;
      return m;
    });

    // Sort by latest month first
    return result.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
  }, [attendance]);

  // Overall Stats
  const overallPresent = attendance.filter(
    (x) => x.status?.toLowerCase() === "present"
  ).length;
  const overallAbsent = attendance.filter(
    (x) => x.status?.toLowerCase() === "absent"
  ).length;
  const overallLate = attendance.filter(
    (x) => x.status?.toLowerCase() === "late"
  ).length;
  const overallLeave = attendance.filter(
    (x) => x.status?.toLowerCase() === "leave"
  ).length;

  const totalLogs = attendance.length;
  const overallPercentage = totalLogs
    ? Math.round(((overallPresent + overallLate) / totalLogs) * 100)
    : 0;

  // Filtered Daily Logs
  const filteredDailyLogs = useMemo(() => {
    return attendance
      .filter((x) => {
        const st = x.status?.toLowerCase() || "unmarked";
        if (filterStatus !== "all" && st !== filterStatus) return false;

        const d = parseRowDate(x);
        if (selectedMonthKey && d) {
          if (format(d, "yyyy-MM") !== selectedMonthKey) return false;
        }

        const formattedDate = d ? format(d, "dd MMM yyyy, EEEE") : "";
        const matchSearch =
          formattedDate.toLowerCase().includes(search.toLowerCase()) ||
          (x.remarks || "").toLowerCase().includes(search.toLowerCase());

        return matchSearch;
      })
      .sort((a, b) => {
        const da = parseRowDate(a)?.getTime() || 0;
        const db = parseRowDate(b)?.getTime() || 0;
        return db - da;
      });
  }, [attendance, filterStatus, search, selectedMonthKey]);

  const getStatusBadge = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "present":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase text-[10px] font-black rounded-full px-3 py-1 gap-1">
            <Check className="w-3 h-3" /> Present
          </Badge>
        );
      case "absent":
        return (
          <Badge className="bg-rose-500/10 text-rose-500 border border-rose-500/20 uppercase text-[10px] font-black rounded-full px-3 py-1 gap-1">
            <X className="w-3 h-3" /> Absent
          </Badge>
        );
      case "late":
        return (
          <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase text-[10px] font-black rounded-full px-3 py-1 gap-1">
            <Clock className="w-3 h-3" /> Late Check-in
          </Badge>
        );
      case "leave":
        return (
          <Badge className="bg-purple-500/10 text-purple-500 border border-purple-500/20 uppercase text-[10px] font-black rounded-full px-3 py-1 gap-1">
            <Info className="w-3 h-3" /> Leave
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="uppercase text-[10px] font-black rounded-full px-3 py-1">
            Unmarked
          </Badge>
        );
    }
  };

  return (
    <DashboardLayout role="Student">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
        {/* Banner */}
        <div className="p-8 bg-gradient-to-br from-slate-900 via-emerald-950/30 to-slate-900 border border-emerald-500/20 rounded-3xl shadow-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase font-black text-[10px] tracking-widest rounded-full px-3 py-1 gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Official Candidate Register
            </Badge>
            {userProfile?.center_name && (
              <Badge className="bg-primary/20 text-primary border border-primary/30 uppercase font-black text-[10px] tracking-wider rounded-full px-3 py-1">
                📍 Center: {userProfile.center_name}
              </Badge>
            )}
          </div>
          <h1 className="font-heading font-black text-3xl md:text-4xl text-white uppercase tracking-tight flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-emerald-400" /> Attendance & Exam Performance Report
          </h1>
          <p className="text-slate-300 text-xs md:text-sm font-medium max-w-2xl leading-relaxed">
            Complete monthly attendance breakdown, exam hall attendance verification, and daily center check-in records.
          </p>
        </div>

        {/* Analytics Top Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="rounded-3xl border border-emerald-500/30 bg-card p-6 shadow-md flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Total Days Present</p>
              <h3 className="text-3xl font-black text-foreground mt-1">{overallPresent} Days</h3>
              <p className="text-[10px] text-muted-foreground font-semibold mt-1">Confirmed Presence</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </Card>

          <Card className="rounded-3xl border border-rose-500/30 bg-card p-6 shadow-md flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Total Absences</p>
              <h3 className="text-3xl font-black text-foreground mt-1">{overallAbsent} Days</h3>
              <p className="text-[10px] text-muted-foreground font-semibold mt-1">Unexcused Missed Sessions</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <XCircle className="w-6 h-6" />
            </div>
          </Card>

          <Card className="rounded-3xl border border-amber-500/30 bg-card p-6 shadow-md flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Late Check-Ins</p>
              <h3 className="text-3xl font-black text-foreground mt-1">{overallLate} Days</h3>
              <p className="text-[10px] text-muted-foreground font-semibold mt-1">Late Arrivals Recorded</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Clock className="w-6 h-6" />
            </div>
          </Card>

          <Card className="rounded-3xl border border-primary/30 bg-card p-6 shadow-md flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-primary uppercase tracking-widest">Overall Attendance Rate</p>
              <h3 className="text-3xl font-black text-foreground mt-1">{overallPercentage}%</h3>
              <p className="text-[10px] text-muted-foreground font-semibold mt-1">{totalLogs} Total Marked Days</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Percent className="w-6 h-6" />
            </div>
          </Card>
        </div>

        {/* Main Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card border border-border p-1.5 rounded-2xl grid grid-cols-3 w-full max-w-xl">
            <TabsTrigger
              value="monthly"
              className="rounded-xl font-black text-xs uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              📅 Monthly Reports
            </TabsTrigger>
            <TabsTrigger
              value="exam"
              className="rounded-xl font-black text-xs uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              📝 Exam Attendance
            </TabsTrigger>
            <TabsTrigger
              value="daily"
              className="rounded-xl font-black text-xs uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              📋 Daily Session Logs
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: MONTHLY REPORTS BREAKDOWN */}
          <TabsContent value="monthly" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-heading font-black text-foreground uppercase tracking-tight">
                  Academic Session Monthly Breakdown
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  Month-by-month attendance statistics and working days record.
                </p>
              </div>

              {selectedMonthKey && (
                <Button
                  onClick={() => setSelectedMonthKey(null)}
                  variant="outline"
                  size="sm"
                  className="rounded-2xl text-xs font-bold uppercase"
                >
                  Clear Month Filter
                </Button>
              )}
            </div>

            {loading ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  Calculating monthly reports...
                </p>
              </div>
            ) : monthlyReports.length === 0 ? (
              <Card className="rounded-3xl border border-dashed border-2 bg-muted/20 py-16 text-center">
                <CardContent className="space-y-3">
                  <Calendar className="w-12 h-12 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                    No monthly attendance records found yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {monthlyReports.map((m) => {
                  const isSelected = selectedMonthKey === m.monthKey;
                  return (
                    <Card
                      key={m.monthKey}
                      className={`rounded-3xl border transition-all duration-300 shadow-md flex flex-col justify-between overflow-hidden ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                          : "border-border/80 bg-card hover:border-primary/50"
                      }`}
                    >
                      <CardContent className="p-6 space-y-4">
                        {/* Month Header */}
                        <div className="flex items-center justify-between border-b border-border pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <span className="font-heading font-black text-base uppercase text-foreground">
                              {m.monthLabel}
                            </span>
                          </div>
                          <Badge
                            className={`rounded-full px-3 py-1 font-black text-[10px] uppercase ${
                              m.percentage >= 75
                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                : m.percentage >= 50
                                ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                            }`}
                          >
                            {m.percentage}% Attendance
                          </Badge>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[11px] font-bold text-muted-foreground">
                            <span>Monthly Performance</span>
                            <span>{m.present + m.late} / {m.total} Days</span>
                          </div>
                          <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${
                                m.percentage >= 75 ? "bg-emerald-500" : m.percentage >= 50 ? "bg-amber-500" : "bg-rose-500"
                              }`}
                              style={{ width: `${m.percentage}%` }}
                            />
                          </div>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-4 gap-2 text-center pt-2">
                          <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                            <p className="text-lg font-black text-emerald-500">{m.present}</p>
                            <p className="text-[8px] font-black uppercase tracking-widest text-emerald-600">Present</p>
                          </div>
                          <div className="p-2.5 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                            <p className="text-lg font-black text-rose-500">{m.absent}</p>
                            <p className="text-[8px] font-black uppercase tracking-widest text-rose-600">Absent</p>
                          </div>
                          <div className="p-2.5 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                            <p className="text-lg font-black text-amber-500">{m.late}</p>
                            <p className="text-[8px] font-black uppercase tracking-widest text-amber-600">Late</p>
                          </div>
                          <div className="p-2.5 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                            <p className="text-lg font-black text-purple-500">{m.leave}</p>
                            <p className="text-[8px] font-black uppercase tracking-widest text-purple-600">Leave</p>
                          </div>
                        </div>

                        {/* View Daily Logs Button */}
                        <Button
                          onClick={() => {
                            setSelectedMonthKey(m.monthKey);
                            setActiveTab("daily");
                          }}
                          className="w-full rounded-2xl font-black text-xs uppercase tracking-wider h-10 gap-2 mt-2 bg-primary text-white hover:bg-primary/90"
                        >
                          View {m.monthLabel} Daily Logs <ChevronRight className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: EXAM & PRACTICAL ATTENDANCE REGISTER */}
          <TabsContent value="exam" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-heading font-black text-foreground uppercase tracking-tight flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-emerald-500" /> Exam Center Seat & Hall Attendance Register
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  Verified attendance logs for allotted course examinations, practical labs, and viva voce sessions.
                </p>
              </div>

              <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase text-[10px] font-black rounded-full px-3 py-1">
                Course Exam Synchronized
              </Badge>
            </div>

            {loading ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  Fetching course exam records...
                </p>
              </div>
            ) : examPapers.length === 0 ? (
              <Card className="rounded-3xl border border-dashed border-2 border-border bg-muted/20 py-16 text-center">
                <CardContent className="max-w-md mx-auto space-y-4">
                  <div className="w-14 h-14 rounded-3xl bg-muted border border-border flex items-center justify-center mx-auto text-muted-foreground">
                    <ShieldCheck className="w-7 h-7 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-heading font-black text-base uppercase text-foreground">
                      No Course Examinations Scheduled
                    </h4>
                    <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                      Official exam hall seat allotment numbers and examination attendance registers will appear here automatically as soon as your center or administrator schedules exams for your enrolled course.
                    </p>
                  </div>
                  {(userProfile?.course_name || userProfile?.course) && (
                    <Badge variant="outline" className="rounded-full text-[10px] font-black uppercase tracking-wider">
                      Enrolled Course: {userProfile.course_name || userProfile.course}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {examPapers.map((paper, idx) => {
                  const subjectTitle =
                    (paper.subject_id && subjectsMap[paper.subject_id]) ||
                    paper.subject_name ||
                    userProfile?.course_name ||
                    userProfile?.course ||
                    "Course Examination";

                  const isSubmitted =
                    paper.status === "Submitted" || paper.status === "Evaluated";
                  const isInProgress = paper.status === "InProgress";

                  const examDate = paper.start_window
                    ? new Date(paper.start_window)
                    : null;

                  return (
                    <Card
                      key={paper.id || paper._id || idx}
                      className="rounded-3xl border border-border bg-card shadow-md overflow-hidden hover:border-primary/40 transition-all"
                    >
                      <CardContent className="p-6 space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className="bg-primary/10 text-primary border border-primary/20 uppercase font-black text-[9px] tracking-widest rounded-full px-2.5 py-0.5">
                                {paper.mode || paper.exam_mode || "Course Examination"}
                              </Badge>
                              {userProfile?.roll_number && (
                                <span className="text-xs font-mono font-bold text-muted-foreground">
                                  Roll No: {userProfile.roll_number}
                                </span>
                              )}
                            </div>
                            <h4 className="font-heading font-black text-base text-foreground uppercase tracking-tight">
                              {subjectTitle}
                            </h4>
                          </div>

                          {isSubmitted ? (
                            <Badge className="bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 uppercase text-[11px] font-black rounded-full px-3 py-1 gap-1.5 shrink-0 self-start md:self-auto">
                              <CheckCircle2 className="w-4 h-4" /> Verified Present
                            </Badge>
                          ) : isInProgress ? (
                            <Badge className="bg-amber-500/20 text-amber-500 border border-amber-500/30 uppercase text-[11px] font-black rounded-full px-3 py-1 gap-1.5 shrink-0 self-start md:self-auto">
                              <Clock className="w-4 h-4" /> Exam In Progress
                            </Badge>
                          ) : (
                            <Badge className="bg-primary/20 text-primary border border-primary/30 uppercase text-[11px] font-black rounded-full px-3 py-1 gap-1.5 shrink-0 self-start md:self-auto">
                              <Calendar className="w-4 h-4" /> Allotted & Scheduled
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-medium">
                          <div className="p-3.5 bg-muted/40 rounded-2xl border border-border space-y-1">
                            <p className="text-[10px] font-black uppercase text-muted-foreground">Exam Date & Schedule</p>
                            <p className="font-mono font-black text-foreground">
                              {examDate && !isNaN(examDate.getTime())
                                ? format(examDate, "dd MMMM yyyy, hh:mm a")
                                : "Schedule Window Open"}
                            </p>
                          </div>

                          <div className="p-3.5 bg-muted/40 rounded-2xl border border-border space-y-1">
                            <p className="text-[10px] font-black uppercase text-muted-foreground">Assigned Center</p>
                            <p className="font-black text-foreground line-clamp-1">
                              {userProfile?.center_name || "Official Examination Center"}
                            </p>
                          </div>

                          <div className="p-3.5 bg-muted/40 rounded-2xl border border-border space-y-1">
                            <p className="text-[10px] font-black uppercase text-muted-foreground">Marks Status</p>
                            <p className="font-mono font-black text-primary">
                              {paper.total_obtained_marks !== undefined
                                ? `${paper.total_obtained_marks} / ${paper.total_marks || 100} Marks`
                                : `Total Marks: ${paper.total_marks || 100}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 p-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <ShieldCheck className="w-4 h-4 shrink-0" />
                          <span>
                            {isSubmitted
                              ? "Exam Attendance Verified: Student has completed paper submission."
                              : "Exam Allotment Verified: Hall seat and examination window confirmed by Center Administrator."}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* TAB 3: DAILY SESSION LOGS */}
          <TabsContent value="daily" className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search date, day, remarks..."
                  className="pl-11 h-12 rounded-2xl border-border bg-card/80 font-bold text-xs"
                />
              </div>

              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                {["all", "present", "absent", "late", "leave"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border ${
                      filterStatus === st
                        ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                        : "bg-card text-muted-foreground hover:bg-muted border-border"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <Card className="rounded-3xl border border-border bg-card/80 backdrop-blur-xl shadow-lg overflow-hidden">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  <h3 className="font-heading font-black uppercase tracking-tight text-sm text-foreground">
                    Attendance Session Logs ({filteredDailyLogs.length})
                  </h3>
                </div>

                {selectedMonthKey && (
                  <Badge className="bg-primary/10 text-primary border border-primary/20 uppercase font-black text-[10px] rounded-full">
                    Filtered Month: {selectedMonthKey}
                  </Badge>
                )}
              </div>

              <CardContent className="p-0">
                {loading ? (
                  <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                      Loading attendance records...
                    </p>
                  </div>
                ) : filteredDailyLogs.length === 0 ? (
                  <div className="py-16 text-center text-xs font-black uppercase tracking-widest text-muted-foreground">
                    No attendance logs found matching your criteria.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredDailyLogs.map((row, idx) => {
                      const d = parseRowDate(row);
                      return (
                        <div
                          key={row._id || row.id || idx}
                          className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-muted border border-border flex items-center justify-center text-muted-foreground">
                              <Calendar className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-mono font-black text-sm text-foreground">
                                {d ? format(d, "dd MMMM yyyy, EEEE") : row.date_str || "Date N/A"}
                              </p>
                              <p className="text-[11px] text-muted-foreground font-medium">
                                {row.remarks || "Center Register Session Record"}
                              </p>
                            </div>
                          </div>

                          <div>{getStatusBadge(row.status)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}


