import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet, Loader2, IndianRupee, Building2 } from "lucide-react";

interface FeeRecord {
  _id: string;
  center_id: string;
  amount: number;
}

interface Center {
  _id: string;
  centerName?: string;
  name?: string;
}

const COMMISSION_RATE = 0.1; // 10% - configurable

const AdminFinanceCommissionsPage = () => {
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = sessionStorage.getItem("token");
      const [feeRes, centerRes] = await Promise.all([
        fetch("/api/fees", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/centers", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const feeData = await feeRes.json();
      const centerData = await centerRes.json();
      if (feeRes.ok) setFees(Array.isArray(feeData) ? feeData : []);
      if (centerRes.ok) setCenters(Array.isArray(centerData) ? centerData : []);
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

  const totalCollected = Object.values(byCenter).reduce((a, b) => a + b, 0);
  const totalCommission = totalCollected * COMMISSION_RATE;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
            Commission Reports
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Commission calculated at {(COMMISSION_RATE * 100).toFixed(0)}% of fee collection.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="rounded-none border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <IndianRupee className="w-8 h-8 text-primary" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total Commission</p>
                      <p className="text-2xl font-bold text-primary">₹{totalCommission.toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-none border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total Collection</p>
                      <p className="text-2xl font-bold text-foreground">₹{totalCollected.toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-none border-border overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Center-wise Commission
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {Object.keys(byCenter).length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">No data yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/20">
                          <th className="text-left px-6 py-3 text-[10px] font-black uppercase">Center</th>
                          <th className="text-right px-6 py-3 text-[10px] font-black uppercase">Collected</th>
                          <th className="text-right px-6 py-3 text-[10px] font-black uppercase">Commission</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(byCenter).map(([cid, amt]) => (
                          <tr key={cid} className="border-b border-border hover:bg-muted/10">
                            <td className="px-6 py-3 font-medium">{centerName(cid)}</td>
                            <td className="px-6 py-3 text-right">₹{amt.toLocaleString("en-IN")}</td>
                            <td className="px-6 py-3 text-right font-bold text-primary">
                              ₹{(amt * COMMISSION_RATE).toLocaleString("en-IN")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

export default AdminFinanceCommissionsPage;
