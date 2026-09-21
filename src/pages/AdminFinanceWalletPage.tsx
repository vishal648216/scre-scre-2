import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, IndianRupee, Loader2, TrendingUp, Building2 } from "lucide-react";
import { format } from "date-fns";

interface FeeRecord {
  _id: string;
  student_id: string;
  center_id: string;
  amount: number;
  payment_date: string;
  mode: string;
  receipt_no: string;
  remarks?: string;
}

interface Center {
  _id: string;
  user_id?: string;
  centerName?: string;
  name?: string;
}

const AdminFinanceWalletPage = () => {
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

  const totalCollected = fees.reduce((s, f) => s + (f.amount || 0), 0);
  const toId = (v: unknown): string => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && "$oid" in v) return (v as { $oid: string }).$oid;
    return "unknown";
  };
  const byCenter = fees.reduce<Record<string, number>>((acc, f) => {
    const cid = toId(f.center_id) || "unknown";
    acc[cid] = (acc[cid] || 0) + (f.amount || 0);
    return acc;
  }, {});
  const centerName = (id: string) =>
    centers.find((c) => c._id === id || c.user_id === id)?.name ||
    centers.find((c) => c._id === id || c.user_id === id)?.centerName ||
    id;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
            Wallet Management
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Overview of fee collection and center-wise revenue.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="rounded-none border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-none bg-primary/10 flex items-center justify-center">
                      <IndianRupee className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total Collected</p>
                      <p className="text-2xl font-bold text-foreground">₹{totalCollected.toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-none border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-none bg-muted flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Transactions</p>
                      <p className="text-2xl font-bold text-foreground">{fees.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-none border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-none bg-muted flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Active Centers</p>
                      <p className="text-2xl font-bold text-foreground">{Object.keys(byCenter).length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-none border-border overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Center-wise Collection
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {Object.keys(byCenter).length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">No fee data yet.</div>
                ) : (
                  <div className="divide-y divide-border">
                    {Object.entries(byCenter).map(([cid, amt]) => (
                      <div key={cid} className="flex items-center justify-between px-6 py-4">
                        <p className="font-medium text-foreground">{centerName(cid)}</p>
                        <p className="font-bold text-primary">₹{amt.toLocaleString("en-IN")}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-none border-border overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-tight">Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {fees.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">No transactions yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/20">
                          <th className="text-left px-6 py-3 text-[10px] font-black uppercase">Date</th>
                          <th className="text-left px-6 py-3 text-[10px] font-black uppercase">Center</th>
                          <th className="text-left px-6 py-3 text-[10px] font-black uppercase">Receipt</th>
                          <th className="text-right px-6 py-3 text-[10px] font-black uppercase">Amount</th>
                          <th className="text-left px-6 py-3 text-[10px] font-black uppercase">Mode</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...fees]
                          .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
                          .slice(0, 20)
                          .map((f, idx) => (
                            <tr key={toId(f._id) !== "unknown" ? toId(f._id) : (f.receipt_no || `fee-${idx}`)} className="border-b border-border hover:bg-muted/10">
                              <td className="px-6 py-3 text-sm">
                                {format(new Date(f.payment_date), "dd MMM yyyy")}
                              </td>
                              <td className="px-6 py-3 text-sm">{centerName(toId(f.center_id))}</td>
                              <td className="px-6 py-3 text-sm font-mono">{f.receipt_no}</td>
                              <td className="px-6 py-3 text-sm text-right font-bold">₹{f.amount?.toLocaleString("en-IN")}</td>
                              <td className="px-6 py-3 text-sm capitalize">{f.mode}</td>
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

export default AdminFinanceWalletPage;
