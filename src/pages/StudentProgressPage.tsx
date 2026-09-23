import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, BookOpen, CheckSquare, Award, Loader2 } from "lucide-react";

const StudentProgressPage = () => {
  const [loading, setLoading] = useState(true);
  interface AttRow { present?: boolean }
  interface FeeRow { _id?: string }
  const [attendance, setAttendance] = useState<AttRow[]>([]);
  const [fees, setFees] = useState<FeeRow[]>([]);

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    Promise.all([
      fetch("/api/attendance", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/fees", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([a, f]) => {
        setAttendance(Array.isArray(a) ? a : []);
        setFees(Array.isArray(f) ? f : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const presentDays = attendance.filter((x) => x.present).length;
  const totalDays = attendance.length;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
            Progress Summary
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Your learning progress overview.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="rounded-none border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckSquare className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground">Attendance</p>
                    <p className="text-2xl font-bold">{presentDays} / {totalDays || 1} days</p>
                    <p className="text-xs text-muted-foreground">{totalDays ? Math.round((presentDays / totalDays) * 100) : 0}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-none border-border">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground">Fee Payments</p>
                    <p className="text-2xl font-bold">{fees.length}</p>
                    <p className="text-xs text-muted-foreground">transactions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-none border-border">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Award className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground">Certificates</p>
                    <p className="text-2xl font-bold">-</p>
                    <p className="text-xs text-muted-foreground">View in Certificates</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentProgressPage;
