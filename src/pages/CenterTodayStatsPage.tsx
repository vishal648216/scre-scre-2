import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Users, IndianRupee, CheckSquare, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

const CenterTodayStatsPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  interface Fee { payment_date: string; amount: number }
  interface Attendance { date: string }
  interface Student { _id: string }
  const [fees, setFees] = useState<Fee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    const today = format(new Date(), "yyyy-MM-dd");
    Promise.all([
      fetch("/api/fees", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/attendance", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/students", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([f, a, s]) => {
        setFees(Array.isArray(f) ? f : []);
        setAttendance(Array.isArray(a) ? a : []);
        setStudents(Array.isArray(s) ? s : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const todayFees = fees.filter((x) => x.payment_date && format(new Date(x.payment_date), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"));
  const todayAmount = todayFees.reduce((s, x) => s + (x.amount || 0), 0);
  const todayAttendance = attendance.filter((x) => x.date && format(new Date(x.date), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"));

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
            {t("Today's Stats")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            {format(new Date(), "EEEE, d MMMM yyyy")}
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
                  <IndianRupee className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground">{t("Today's Collection")}</p>
                    <p className="text-2xl font-bold">₹{todayAmount.toLocaleString("en-IN")}</p>
                    <p className="text-xs text-muted-foreground">{todayFees.length} {t("transactions")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-none border-border">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckSquare className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground">{t("Today's Attendance")}</p>
                    <p className="text-2xl font-bold">{todayAttendance.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-none border-border">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground">{t("Total Students")}</p>
                    <p className="text-2xl font-bold">{students.length}</p>
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

export default CenterTodayStatsPage;
