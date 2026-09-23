import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet, Loader2, CheckSquare } from "lucide-react";
import { format } from "date-fns";

const StudentAttendanceReportPage = () => {
  const [loading, setLoading] = useState(true);
  interface AttRow { date: string; present?: boolean }
  const [attendance, setAttendance] = useState<AttRow[]>([]);

  useEffect(() => {
    fetch("/api/attendance", { headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` } })
      .then((r) => r.json())
      .then((d) => setAttendance(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const present = attendance.filter((x) => x.present).length;
  const percent = attendance.length ? Math.round((present / attendance.length) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
            Attendance Report
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Your attendance summary.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-none border border-border">
              <CheckSquare className="w-8 h-8 text-primary" />
              <div>
                <p className="font-bold text-2xl">{present} / {attendance.length} days ({percent}%)</p>
                <p className="text-sm text-muted-foreground">Present days</p>
              </div>
            </div>

            <Card className="rounded-none border-border overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {attendance.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">No attendance records.</div>
                ) : (
                  <div className="divide-y divide-border">
                    {[...attendance]
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((a, i) => (
                        <div key={i} className="flex items-center justify-between px-6 py-3">
                          <span>{format(new Date(a.date), "dd MMM yyyy")}</span>
                          <span className={a.present ? "text-primary font-bold" : "text-muted-foreground"}>
                            {a.present ? "Present" : "Absent"}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentAttendanceReportPage;
