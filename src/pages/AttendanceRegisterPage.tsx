import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Clock, Calendar as CalendarIcon, User, Search, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { getServerNow } from "@/lib/time";

type AttendanceStatus = "present" | "absent" | "late" | "leave";

interface Student {
  _id: string;
  username: string;
  fullName?: string;
}

interface AttendanceRecord {
  student_id: string;
  status: AttendanceStatus;
  remarks?: string;
}

const AttendanceRegisterPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(format(getServerNow(), "yyyy-MM-dd"));
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchStudents();
    fetchExistingAttendance();
  }, [selectedDate]);

  const fetchStudents = async () => {
    try {
      const token = sessionStorage.getItem("token");
      const response = await fetch("/api/students", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setStudents(data);
      }
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingAttendance = async () => {
    try {
      const token = sessionStorage.getItem("token");
      const response = await fetch(`/api/attendance?start_date=${selectedDate}T00:00:00Z&end_date=${selectedDate}T23:59:59Z`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        const attendanceMap: Record<string, AttendanceStatus> = {};
        (data as AttendanceRecord[]).forEach((record) => {
          attendanceMap[record.student_id] = record.status as AttendanceStatus;
        });
        setAttendance(attendanceMap);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
    }
  };

  const handleStatusChange = async (studentId: string, status: AttendanceStatus) => {
    // Update local state first for immediate feedback
    setAttendance(prev => ({ ...prev, [studentId]: status }));
    
    // Immediately save to server
    try {
      const token = sessionStorage.getItem("token");
      const record = { 
        student_id: studentId, 
        status, 
        date: `${selectedDate}T12:00:00Z` 
      };
      
      const response = await fetch("/api/attendance/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ records: [record] })
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.message || "Failed to save attendance");
        // Revert local state if failed? Maybe better to just refresh
        fetchExistingAttendance();
      }
    } catch (error) {
      console.error("Error saving attendance:", error);
      toast.error("Failed to save attendance");
      fetchExistingAttendance();
    }
  };

  const filteredStudents = students.filter(s => 
    s.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { t } = useTranslation();
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">{t("Attendance Register")}</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">{t("Mark and manage student attendance for your center.")}</p>
          </div>
          <div className="flex items-center gap-4 bg-card p-2 border border-border shadow-sm">
            <CalendarIcon className="w-5 h-5 text-primary ml-2" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-sm font-bold uppercase tracking-tight"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Card className="rounded-none border-border shadow-md overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border py-4 flex flex-row items-center justify-between">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  placeholder={t("Search students...")} 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-none text-xs font-bold uppercase tracking-widest focus:border-primary outline-none"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-20 flex justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{t("Student Name")}</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{t("ID / Username")}</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-center text-muted-foreground">{t("Status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-6 py-10 text-center text-muted-foreground text-xs font-bold uppercase tracking-widest">
                            {t("No students found")}
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((student) => (
                          <tr key={student._id} className="border-b border-border hover:bg-muted/10 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-primary/10 flex items-center justify-center border border-primary/20">
                                  <User className="w-4 h-4 text-primary" />
                                </div>
                                <span className="text-sm font-bold text-foreground">{student.fullName || "Not Provided"}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-mono text-muted-foreground">{student.username}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center gap-2">
                                <StatusButton 
                                  active={attendance[student._id] === "present"} 
                                  onClick={() => handleStatusChange(student._id, "present")}
                                  icon={CheckCircle2}
                                  label="P"
                                  color="bg-emerald-500"
                                />
                                <StatusButton 
                                  active={attendance[student._id] === "absent"} 
                                  onClick={() => handleStatusChange(student._id, "absent")}
                                  icon={XCircle}
                                  label="A"
                                  color="bg-destructive"
                                />
                                <StatusButton 
                                  active={attendance[student._id] === "late"} 
                                  onClick={() => handleStatusChange(student._id, "late")}
                                  icon={Clock}
                                  label="L"
                                  color="bg-amber-500"
                                />
                                <StatusButton 
                                  active={attendance[student._id] === "leave"} 
                                  onClick={() => handleStatusChange(student._id, "leave")}
                                  icon={CalendarIcon}
                                  label="LV"
                                  color="bg-indigo-500"
                                />
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

import type { ComponentType } from "react";
interface StatusButtonProps {
  active: boolean;
  onClick: () => void;
  icon: ComponentType<{ className?: string }>;
  label: string;
  color: string;
}
const StatusButton = ({ active, onClick, icon: Icon, label, color }: StatusButtonProps) => (
  <button
    onClick={onClick}
    className={cn(
      "w-10 h-10 flex flex-col items-center justify-center border border-border transition-all group",
      active ? cn(color, "text-white border-transparent shadow-md scale-110 z-10") : "bg-card hover:bg-muted"
    )}
  >
    <Icon className={cn("w-4 h-4", active ? "text-white" : "text-muted-foreground group-hover:text-foreground")} />
    <span className={cn("text-[8px] font-black mt-0.5", active ? "text-white/80" : "text-muted-foreground")}>{label}</span>
  </button>
);

export default AttendanceRegisterPage;
