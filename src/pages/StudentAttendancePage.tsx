import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar as CalendarIcon,
  Loader2,
  Info,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Building2,
  GraduationCap,
  Percent,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { useTranslation } from "react-i18next";
import { apiFetch, flattenBson } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AttendanceRecord {
  _id?: string;
  id?: string;
  student_id: string;
  center_id?: string;
  status: string; // 'present', 'absent', 'late', 'leave'
  date: any;
  date_str?: string;
  remarks?: string;
}

const StudentAttendancePage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const fetchUserProfile = useCallback(async () => {
    try {
      const res = await apiFetch("/api/users/me");
      if (res.ok) {
        const u = await res.json();
        setUserProfile(u);
      }
    } catch {}
  }, []);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`/api/attendance`);
      if (response.ok) {
        const raw = await response.json();
        const data = flattenBson(Array.isArray(raw) ? raw : (raw.records || []));
        setRecords(data);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
      toast.error("Failed to load your attendance record");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserProfile();
    fetchAttendance();
  }, [fetchUserProfile, fetchAttendance]);

  const parseRecordDate = (r: AttendanceRecord): Date | null => {
    if (r.date_str) {
      const [y, m, d] = r.date_str.split("-").map(Number);
      if (y && m && d) return new Date(y, m - 1, d);
    }
    if (r.date) {
      const d = new Date(r.date);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  const getDayRecord = (day: Date) => {
    return records.find((r) => {
      const rd = parseRecordDate(r);
      return rd ? isSameDay(rd, day) : false;
    });
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentMonth(newDate);
  };

  // Filter records for the selected month
  const monthRecords = records.filter((r) => {
    const rd = parseRecordDate(r);
    return rd ? rd >= monthStart && rd <= monthEnd : false;
  });

  const presentCount = monthRecords.filter((r) => r.status?.toLowerCase() === "present").length;
  const absentCount = monthRecords.filter((r) => r.status?.toLowerCase() === "absent").length;
  const lateCount = monthRecords.filter((r) => r.status?.toLowerCase() === "late").length;
  const leaveCount = monthRecords.filter((r) => r.status?.toLowerCase() === "leave").length;
  const totalMarkedDays = monthRecords.length;
  const attendancePercentage = totalMarkedDays > 0 ? ((presentCount + lateCount) / totalMarkedDays) * 100 : 0;

  const getStatusBadge = (status: string | undefined) => {
    switch (status?.toLowerCase()) {
      case "present":
        return (
          <div className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <Check className="w-3 h-3" /> Present
          </div>
        );
      case "absent":
        return (
          <div className="flex items-center gap-1 text-[10px] font-black uppercase text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
            <X className="w-3 h-3" /> Absent
          </div>
        );
      case "late":
        return (
          <div className="flex items-center gap-1 text-[10px] font-black uppercase text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
            <Clock className="w-3 h-3" /> Late
          </div>
        );
      case "leave":
        return (
          <div className="flex items-center gap-1 text-[10px] font-black uppercase text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
            <Info className="w-3 h-3" /> Leave
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <DashboardLayout role="Student">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
        {/* Header Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-slate-900 via-emerald-950/30 to-slate-900 p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black uppercase text-[10px] tracking-widest rounded-full gap-1 px-3 py-1">
                  <Sparkles className="w-3.5 h-3.5" /> Center Attendance Register
                </Badge>
                {userProfile?.center_name && (
                  <Badge className="bg-primary/20 text-primary border border-primary/30 font-black uppercase text-[10px] tracking-wider rounded-full px-3 py-1">
                    📍 Center: {userProfile.center_name}
                  </Badge>
                )}
                {userProfile?.course_name && (
                  <Badge className="bg-slate-800 text-slate-200 border border-slate-700 font-black uppercase text-[10px] tracking-wider rounded-full px-3 py-1">
                    🎓 {userProfile.course_name}
                  </Badge>
                )}
              </div>
              <h1 className="font-heading font-black text-3xl md:text-4xl text-white uppercase tracking-tight flex items-center gap-3">
                <UserCheck className="w-8 h-8 text-emerald-400" /> My Attendance Record
              </h1>
              <p className="text-slate-300 text-xs md:text-sm font-medium leading-relaxed">
                Real-time synchronized attendance record marked by your assigned Center Administrator and Academic Faculty.
              </p>
            </div>

            {/* Month Control */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 bg-slate-950/80 p-2 rounded-2xl border border-slate-800 backdrop-blur-md">
                <Button
                  onClick={() => changeMonth(-1)}
                  variant="ghost"
                  size="icon"
                  className="w-9 h-9 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="px-3 text-xs font-black text-white uppercase tracking-wider font-mono">
                  {format(currentMonth, "MMMM yyyy")}
                </span>
                <Button
                  onClick={() => changeMonth(1)}
                  variant="ghost"
                  size="icon"
                  className="w-9 h-9 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <Button
                onClick={() => fetchAttendance()}
                variant="outline"
                size="icon"
                className="w-11 h-11 rounded-2xl border-white/20 bg-slate-900/60 text-white hover:bg-white/10"
                title="Refresh Attendance Log"
              >
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </Button>

              <Link to="/dashboard/student/attendance/report">
                <Button className="h-11 px-4 rounded-2xl font-black text-xs uppercase tracking-wider gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/20">
                  <FileSpreadsheet className="w-4 h-4" /> Monthly & Exam Report
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="rounded-3xl border border-emerald-500/30 bg-card hover:border-emerald-500/60 transition-all duration-300 shadow-md">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Days Present</p>
                <h3 className="text-3xl font-black text-foreground mt-1">{presentCount}</h3>
                <p className="text-[10px] text-muted-foreground font-semibold mt-1">Confirmed Center Attendance</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-inner">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-rose-500/30 bg-card hover:border-rose-500/60 transition-all duration-300 shadow-md">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Days Absent</p>
                <h3 className="text-3xl font-black text-foreground mt-1">{absentCount}</h3>
                <p className="text-[10px] text-muted-foreground font-semibold mt-1">Unexcused Absences</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-inner">
                <XCircle className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-amber-500/30 bg-card hover:border-amber-500/60 transition-all duration-300 shadow-md">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Late Check-Ins</p>
                <h3 className="text-3xl font-black text-foreground mt-1">{lateCount}</h3>
                <p className="text-[10px] text-muted-foreground font-semibold mt-1">Late Arrival Entries</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
                <Clock className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-primary/30 bg-card hover:border-primary/60 transition-all duration-300 shadow-md">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Attendance Rate</p>
                <h3 className="text-3xl font-black text-foreground mt-1">{attendancePercentage.toFixed(1)}%</h3>
                <p className="text-[10px] text-muted-foreground font-semibold mt-1">{totalMarkedDays} Days Marked in Month</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
                <Percent className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Calendar View Card */}
        <Card className="rounded-3xl border border-border bg-card/80 backdrop-blur-xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CalendarIcon className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground uppercase tracking-tight">
                  Attendance Calendar - {format(currentMonth, "MMMM yyyy")}
                </h3>
                <p className="text-[11px] text-muted-foreground font-medium">
                  Center Marked Daily Attendance Matrix
                </p>
              </div>
            </div>

            <Badge variant="outline" className="rounded-full text-[10px] font-mono font-bold">
              Synced with Center Register
            </Badge>
          </div>

          <CardContent className="p-6">
            {loading ? (
              <div className="py-24 text-center text-xs font-black uppercase tracking-widest text-muted-foreground flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                Loading center attendance register...
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-3">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div
                    key={day}
                    className="text-center py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/80"
                  >
                    {day}
                  </div>
                ))}

                {/* Blank Padding for Start of Month */}
                {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-20 bg-muted/20 rounded-2xl border border-border/30 opacity-40" />
                ))}

                {/* Days of Month */}
                {daysInMonth.map((day) => {
                  const rec = getDayRecord(day);
                  const status = rec?.status;
                  const isToday = isSameDay(day, new Date());
                  const dayNum = format(day, "d");

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "h-20 rounded-2xl p-3 flex flex-col justify-between transition-all border relative group",
                        isToday
                          ? "bg-primary/10 border-primary ring-2 ring-primary/20"
                          : status?.toLowerCase() === "present"
                          ? "bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500"
                          : status?.toLowerCase() === "absent"
                          ? "bg-rose-500/5 border-rose-500/30 hover:border-rose-500"
                          : status?.toLowerCase() === "late"
                          ? "bg-amber-500/5 border-amber-500/30 hover:border-amber-500"
                          : status?.toLowerCase() === "leave"
                          ? "bg-purple-500/5 border-purple-500/30 hover:border-purple-500"
                          : "bg-muted/30 border-border/60 hover:border-border"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            "text-xs font-black font-mono",
                            isToday ? "text-primary" : "text-foreground"
                          )}
                        >
                          {dayNum}
                        </span>
                        {isToday && (
                          <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md bg-primary text-white">
                            Today
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-center">
                        {getStatusBadge(status) || (
                          <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                            Unmarked
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="bg-card/80 backdrop-blur-xl border border-border p-4 rounded-3xl shadow-sm flex flex-wrap items-center justify-between gap-4 text-xs font-bold">
          <span className="text-muted-foreground uppercase text-[10px] tracking-widest font-black">
            Attendance Indicator Legend:
          </span>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-foreground">Present</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-500" />
              <span className="text-foreground">Absent</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-foreground">Late Check-in</span>
            </div>
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-purple-500" />
              <span className="text-foreground">On Leave</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentAttendancePage;

