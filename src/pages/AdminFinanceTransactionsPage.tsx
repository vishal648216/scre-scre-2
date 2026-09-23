import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { History, Loader2, Search } from "lucide-react";
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
  centerName?: string;
  name?: string;
}

const AdminFinanceTransactionsPage = () => {
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [search, setSearch] = useState("");

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
  const filtered = fees.filter(
    (f) =>
      !search ||
      f.receipt_no?.toLowerCase().includes(search.toLowerCase()) ||
      centerName(f.center_id).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
            Transactions
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            All fee collection transactions across centers.
          </p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by receipt or center..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-none"
          />
        </div>

        <Card className="rounded-none border-border overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
              <History className="w-4 h-4" />
              Transaction History ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No transactions found.</div>
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
                    {[...filtered]
                      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
                      .map((f) => (
                        <tr key={f._id} className="border-b border-border hover:bg-muted/10">
                          <td className="px-6 py-3 text-sm">{format(new Date(f.payment_date), "dd MMM yyyy HH:mm")}</td>
                          <td className="px-6 py-3 text-sm">{centerName(f.center_id)}</td>
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
      </div>
    </DashboardLayout>
  );
};

export default AdminFinanceTransactionsPage;
