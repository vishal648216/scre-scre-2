import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Building2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Center {
  _id: string;
  name?: string;
  user_id?: string;
}

interface FeeRecord {
  center_id: string;
  amount: number;
}

const toId = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "$oid" in v) return (v as { $oid: string }).$oid;
  return "unknown";
};

const AdminCenterStatsPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState<Center[]>([]);
  const [fees, setFees] = useState<FeeRecord[]>([]);

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    Promise.all([
      fetch("/api/centers", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/fees", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([c, f]) => {
        setCenters(Array.isArray(c) ? c : []);
        setFees(Array.isArray(f) ? f : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const centerName = (id: string) => centers.find((c) => c._id === id || c.user_id === id)?.name || id;
  const byCenter = fees.reduce<Record<string, number>>((acc, f) => {
    const cid = toId(f.center_id) || "unknown";
    acc[cid] = (acc[cid] || 0) + (f.amount || 0);
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
            {t("Center Statistics")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            {t("Fee collection and activity by center.")}
          </p>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Card className="rounded-none border-border overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                {t("Center-wise Collection")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {Object.keys(byCenter).length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">{t("No data yet.")}</div>
              ) : (
                <div className="divide-y divide-border">
                  {Object.entries(byCenter).map(([cid, amt]) => (
                    <div key={cid} className="flex items-center justify-between px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{t(centerName(cid))}</span>
                      </div>
                      <span className="font-bold text-primary">₹{amt.toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminCenterStatsPage;
