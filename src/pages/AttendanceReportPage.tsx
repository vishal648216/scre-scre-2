import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, Loader2, Download, Filter, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";

interface Student {
  _id: string;
  username: string;
  fullName?: string;
}

interface AttendanceRecord {
  student_id: string;
  status: string;
  date: string;
}

const AttendanceReportPage = () => {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  useEffect(() => {
    fetchData();
  }, [currentMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      
      // Fetch students
      const studentRes = await fetch("/api/students", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const studentData = await studentRes.json();
      
      // Fetch attendance for the month
      const attendanceRes = await fetch(
        `/api/attendance?start_date=${monthStart.toISOString()}&end_date=${monthEnd.toISOString()}`,
        { headers: { "Authorization": `Bearer ${token}` } }
      );
      const attendanceData = await attendanceRes.json();

      if (studentRes.ok && attendanceRes.ok) {
        setStudents(studentData);
        setRecords(attendanceData);
      }
    } catch (error) {
      console.error("Error fetching report data:", error);
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  const getStatus = (studentId: string, day: Date) => {
    const record = records.find(r => 
      r.student_id === studentId && isSameDay(new Date(r.date), day)
    );
    return record?.status;
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case "present": return "bg-emerald-500 text-white";
      case "absent": return "bg-destructive text-white";
      case "late": return "bg-amber-500 text-white";
      case "leave": return "bg-blue-500 text-white";
      default: return "bg-muted/30 text-muted-foreground/30";
    }
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentMonth(newDate);
  };

  return (
    <DashboardLayout>
      <div className="max-w-[100vw] space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Monthly Attendance Report</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Detailed overview of student attendance for {format(currentMonth, "MMMM yyyy")}.</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => changeMonth(-1)}
              className="p-2 border border-border bg-card hover:bg-muted transition-colors"
            >
              &larr;
            </button>
            <div className="px-4 py-2 border border-border bg-card font-bold text-xs uppercase tracking-widest">
              {format(currentMonth, "MMM yyyy")}
            </div>
            <button 
              onClick={() => changeMonth(1)}
              className="p-2 border border-border bg-card hover:bg-muted transition-colors"
            >
              &rarr;
            </button>
            <button className="ml-4 bg-primary text-primary-foreground px-4 py-2 rounded-none font-heading font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:opacity-90 transition-all flex items-center gap-2">
              <Download className="w-3 h-3" />
              Export PDF
            </button>
          </div>
        </div>

        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-20 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1200px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground sticky left-0 bg-muted/20 z-10 border-r border-border min-w-[200px]">Student Name</th>
                      {daysInMonth.map(day => (
                        <th key={day.toISOString()} className="px-1 py-4 text-[8px] font-black uppercase tracking-tight text-center text-muted-foreground min-w-[30px] border-r border-border/50">
                          {format(day, "d")}
                          <br />
                          {format(day, "eee").charAt(0)}
                        </th>
                      ))}
                      <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-center text-muted-foreground bg-muted/20 sticky right-0 z-10 border-l border-border min-w-[60px]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => {
                      const presentCount = daysInMonth.filter(day => getStatus(student._id, day) === "present").length;
                      return (
                        <tr key={student._id} className="border-b border-border hover:bg-muted/5 transition-colors">
                          <td className="px-4 py-3 sticky left-0 bg-background z-10 border-r border-border">
                            <div className="flex items-center gap-2">
                              <User className="w-3 h-3 text-primary/60" />
                              <span className="text-xs font-bold text-foreground truncate">{student.fullName || student.username}</span>
                            </div>
                          </td>
                          {daysInMonth.map(day => {
                            const status = getStatus(student._id, day);
                            return (
                              <td key={day.toISOString()} className="p-0 border-r border-border/30">
                                <div className={cn(
                                  "w-full h-8 flex items-center justify-center text-[10px] font-black",
                                  getStatusColor(status)
                                )}>
                                  {status ? status.charAt(0).toUpperCase() : ""}
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-center sticky right-0 bg-background z-10 border-l border-border font-black text-xs">
                            {presentCount}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex flex-wrap gap-6 p-4 border border-border bg-card">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Present</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-destructive" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Absent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Late</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Leave</span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AttendanceReportPage;
