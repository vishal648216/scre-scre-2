
import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, Loader2, Info, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api";

interface AttendanceRecord {
  status: string;
  date: string;
}

const InternAttendancePage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  useEffect(() => {
    fetchAttendance();
  }, [currentMonth]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/intern-attendance");
      const data = await response.json();
      if (response.ok) {
        const inMonth = (data as AttendanceRecord[]).filter((r) => {
          const d = new Date(r.date);
          return d >= monthStart && d <= monthEnd;
        });
        setRecords(inMonth);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
      toast.error("Failed to load attendance");
    } finally {
      setLoading(false);
    }
  };

  const getDayStatus = (day: Date) => {
    return records.find(r => isSameDay(new Date(r.date), day))?.status;
  };

  const getStatusIcon = (status: string | undefined) => {
    switch (status) {
      case "present": return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case "absent": return <XCircle className="w-5 h-5 text-destructive" />;
      case "late": return <Clock className="w-5 h-5 text-amber-500" />;
      case "leave": return <Info className="w-5 h-5 text-blue-500" />;
      default: return <div className="w-5 h-5 rounded-full border border-dashed border-muted-foreground/30" />;
    }
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentMonth(newDate);
  };

  const presentCount = records.filter(r => r.status === "present").length;
  const absentCount = records.filter(r => r.status === "absent").length;
  const attendancePercentage = daysInMonth.length > 0 ? (presentCount / daysInMonth.length) * 100 : 0;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">{t("My Attendance")}</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">{t("Track your attendance records for")} {format(currentMonth, "MMMM yyyy")}.</p>
          </div>
          <div className="flex items-center gap-2 bg-card p-1 border border-border shadow-sm">
            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-muted transition-colors">&larr;</button>
            <span className="px-4 font-bold text-xs uppercase tracking-widest">{format(currentMonth, "MMM yyyy")}</span>
            <button onClick={() => changeMonth(1)} className="p-2 hover:bg-muted transition-colors">&rarr;</button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title={t("Present Days")} value={presentCount} color="text-emerald-500" />
          <StatCard title={t("Absent Days")} value={absentCount} color="text-destructive" />
          <StatCard title={t("Attendance %")} value={`${attendancePercentage.toFixed(1)}%`} color="text-primary" />
        </div>

        {/* Calendar View */}
        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4 flex flex-row items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-primary" />
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">{t("Attendance Calendar")}</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {loading ? (
              <div className="py-20 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                  <div key={day} className="text-center py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/30">
                    {t(day)}
                  </div>
                ))}
                {/* Empty slots for first week */}
                {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-20 bg-muted/5 border border-border/10 opacity-30" />
                ))}
                {daysInMonth.map(day => {
                  const status = getDayStatus(day);
                  return (
                    <div 
                      key={day.toISOString()} 
                      className={cn(
                        "h-20 border border-border p-2 flex flex-col justify-between hover:border-primary/40 transition-all",
                        isSameDay(day, new Date()) && "bg-primary/5 border-primary shadow-inner"
                      )}
                    >
                      <span className="text-[10px] font-black">{format(day, "d")}</span>
                      <div className="flex justify-center mb-2">
                        {getStatusIcon(status)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex flex-wrap gap-6 p-4 border border-border bg-card">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Present")}</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-destructive" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Absent")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Late")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Leave")}</span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  color: string;
}
const StatCard = ({ title, value, color }: StatCardProps) => (
  <Card className="rounded-none border-border shadow-sm overflow-hidden border-l-4 border-l-primary">
    <CardContent className="p-6">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{title}</p>
      <h3 className={cn("text-3xl font-black tracking-tight", color)}>{value}</h3>
    </CardContent>
  </Card>
);

export default InternAttendancePage;
