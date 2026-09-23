import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, Loader2, IndianRupee, CheckSquare } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

const CenterActivityPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  interface Fee {
    payment_date: string;
    amount: number;
    receipt_no: string;
  }
  interface Attendance {
    date: string;
    present?: boolean;
  }
  const [fees, setFees] = useState<Fee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    Promise.all([
      fetch("/api/fees", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/attendance", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([f, a]) => {
        setFees(Array.isArray(f) ? f : []);
        setAttendance(Array.isArray(a) ? a : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const feeActivities = fees.slice(0, 10).map((x) => ({
    type: "fee",
    date: x.payment_date,
    text: t("Fee collected: ₹{{amount}} ({{receipt}})", { amount: x.amount?.toLocaleString("en-IN"), receipt: x.receipt_no }),
  }));
  const attActivities = attendance.slice(0, 10).map((x) => ({
    type: "attendance",
    date: x.date,
    text: x.present ? t("Attendance marked") : t("Absent recorded"),
  }));
  const combined = [...feeActivities, ...attActivities]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
            {t("Recent Activity")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            {t("Latest fee collections and attendance.")}
          </p>
        </div>

        <Card className="rounded-none border-border overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
              <History className="w-4 h-4" />
              {t("Activity Feed")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : combined.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">{t("No recent activity.")}</div>
            ) : (
              <div className="divide-y divide-border">
                {combined.map((a, i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-3">
                    {a.type === "fee" ? (
                      <IndianRupee className="w-5 h-5 text-primary" />
                    ) : (
                      <CheckSquare className="w-5 h-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{a.text}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(a.date), "dd MMM yyyy HH:mm")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CenterActivityPage;
