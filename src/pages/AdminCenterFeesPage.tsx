import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndianRupee, Loader2, Building2 } from "lucide-react";

interface Center {
  _id: string;
  centerName?: string;
  name?: string;
}

interface FeeRecord {
  center_id: string;
  amount: number;
}

const AdminCenterFeesPage = () => {
  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState<Center[]>([]);
  const [fees, setFees] = useState<FeeRecord[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = sessionStorage.getItem("token");
      const [centerRes, feeRes] = await Promise.all([
        fetch("/api/centers", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/fees", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const centerData = await centerRes.json();
      const feeData = await feeRes.json();
      if (centerRes.ok) setCenters(Array.isArray(centerData) ? centerData : []);
      if (feeRes.ok) setFees(Array.isArray(feeData) ? feeData : []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const centerName = (id: string) => centers.find((c) => c._id === id)?.centerName || centers.find((c) => c._id === id)?.name || id;
  const byCenter = fees.reduce<Record<string, number>>((acc, f) => {
    const cid = f.center_id || "unknown";
    acc[cid] = (acc[cid] || 0) + (f.amount || 0);
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
            Franchise Fees
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Fee collection summary by franchise center.
          </p>
        </div>

        <Card className="rounded-none border-border overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
              <IndianRupee className="w-4 h-4" />
              Center-wise Fees
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : Object.keys(byCenter).length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No fee data yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {Object.entries(byCenter).map(([cid, amt]) => (
                  <div key={cid} className="flex items-center justify-between px-6 py-4 hover:bg-muted/20">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-muted-foreground" />
                      <p className="font-bold">{centerName(cid)}</p>
                    </div>
                    <p className="font-bold text-primary">₹{amt.toLocaleString("en-IN")}</p>
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

export default AdminCenterFeesPage;
