import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  FileSpreadsheet, 
  Loader2, 
  IndianRupee, 
  Building2, 
  Percent, 
  Search, 
  Printer, 
  Download,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  Send,
  X,
  PieChart
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface FeeRecord {
  _id: string;
  center_id: string;
  amount: number;
  payment_date?: string;
  mode?: string;
}

interface Center {
  _id: string;
  centerName?: string;
  name?: string;
  code?: string;
  city?: string;
}

interface CommissionReleaseLog {
  id: string;
  center_name: string;
  gross_amount: number;
  commission_amount: number;
  ref_code: string;
  released_at: string;
}

const DEFAULT_COMMISSION_RATE = 0.15; // 15% Platform Commission Fee

const AdminFinanceCommissionsPage = () => {
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [payoutLogs, setPayoutLogs] = useState<CommissionReleaseLog[]>([]);
  const [search, setSearch] = useState("");
  const [commissionRate, setCommissionRate] = useState(DEFAULT_COMMISSION_RATE);

  // Release Modal
  const [releaseCenter, setReleaseCenter] = useState<{ id: string; name: string; gross: number; commission: number } | null>(null);
  const [releasing, setReleasing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [feeRes, centerRes] = await Promise.all([
        apiFetch("/api/fees").catch(() => null),
        apiFetch("/api/centers").catch(() => null),
      ]);

      let feeList: FeeRecord[] = [];
      if (feeRes && feeRes.ok) {
        const feeData = await feeRes.json();
        const raw = Array.isArray(feeData) ? feeData : (feeData?.fees || feeData?.items || []);
        feeList = raw.map((f: any) => ({
          _id: f._id || f.id || `fee_${Math.random()}`,
          center_id: f.center_id || "general",
          amount: f.amount || f.total_fees || 0,
          payment_date: f.payment_date || f.created_at || new Date().toISOString(),
          mode: f.mode || f.payment_mode || "Online"
        }));
      }

      let centerList: Center[] = [];
      if (centerRes && centerRes.ok) {
        const centerData = await centerRes.json();
        const raw = Array.isArray(centerData) ? centerData : (centerData?.centers || centerData?.items || []);
        centerList = raw.map((c: any) => ({
          _id: c._id || c.id || `ctr_${Math.random()}`,
          name: c.centerName || c.name || "Training Center Branch",
          code: c.code || c.center_code || "CTR-101",
          city: c.city || c.address || "Branch"
        }));
      }

      setFees(feeList);
      setCenters(centerList);
    } catch {
      setFees([]);
      setCenters([]);
    } finally {
      setLoading(false);
    }
  };

  const centerName = (id: string) => {
    const found = centers.find((c) => c._id === id);
    if (found) return `${found.name || found.centerName} (${found.code || "CTR"})`;
    return id && id !== "unknown" && id !== "general" ? id : "HQ Central Campus Branch";
  };

  const byCenter = fees.reduce<Record<string, { total: number; count: number }>>((acc, f) => {
    const cid = f.center_id || "general";
    if (!acc[cid]) acc[cid] = { total: 0, count: 0 };
    acc[cid].total += (f.amount || 0);
    acc[cid].count += 1;
    return acc;
  }, {});

  const totalCollected = Object.values(byCenter).reduce((a, b) => a + b.total, 0);
  const totalCommission = totalCollected * commissionRate;
  const totalFranchisePayout = totalCollected - totalCommission;

  const handleOpenReleaseModal = (cid: string, gross: number) => {
    const cName = centerName(cid);
    const comm = gross * commissionRate;
    setReleaseCenter({
      id: cid,
      name: cName,
      gross: gross,
      commission: comm
    });
  };

  const handleConfirmReleaseSubmit = () => {
    if (!releaseCenter) return;
    setReleasing(true);
    setTimeout(() => {
      const refCode = `HQ-COMM-REF-${Math.floor(100000 + Math.random() * 900000)}`;
      const newLog: CommissionReleaseLog = {
        id: `comm_${Date.now()}`,
        center_name: releaseCenter.name,
        gross_amount: releaseCenter.gross,
        commission_amount: releaseCenter.commission,
        ref_code: refCode,
        released_at: new Date().toLocaleString("en-IN")
      };

      const updated = [newLog, ...payoutLogs];
      setPayoutLogs(updated);
      setReleasing(false);
      setReleaseCenter(null);
      toast.success(`HQ Commission of ₹${releaseCenter.commission.toLocaleString("en-IN")} released for ${releaseCenter.name}! Ref: ${refCode}`);
    }, 600);
  };

  const filteredCenters = Object.entries(byCenter).filter(([cid]) => 
    !search || centerName(cid).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
        {/* Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-black text-2xl md:text-3xl text-white uppercase tracking-tight flex items-center gap-3">
              <FileSpreadsheet className="w-8 h-8 text-blue-400" />
              PLATFORM COMMISSION REPORTS
            </h1>
            <p className="text-slate-400 mt-1 text-xs md:text-sm font-medium">
              HQ platform fee calculated at {(commissionRate * 100).toFixed(0)}% of total fee collection across center branches.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider border border-slate-700 flex items-center gap-2"
            >
              <Printer className="w-4 h-4" /> Print Commission Voucher
            </button>
          </div>
        </div>

        {/* 3 Metric Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-black text-2xl">
                  ₹
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total HQ Commission (15%)</p>
                  <p className="text-2xl font-black text-blue-400 font-mono mt-0.5">₹{totalCommission.toLocaleString("en-IN")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-2xl">
                  ₹
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gross Fee Collection</p>
                  <p className="text-2xl font-black text-emerald-400 font-mono mt-0.5">₹{totalCollected.toLocaleString("en-IN")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-black text-2xl">
                  ₹
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Franchise Share (85%)</p>
                  <p className="text-2xl font-black text-purple-400 font-mono mt-0.5">₹{totalFranchisePayout.toLocaleString("en-IN")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search center branch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white text-xs font-bold outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-bold uppercase">Platform Commission Rate:</span>
            <select
              value={commissionRate}
              onChange={(e) => setCommissionRate(parseFloat(e.target.value))}
              className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900 text-white text-xs font-bold font-mono outline-none"
            >
              <option value={0.10}>10% Platform Fee</option>
              <option value={0.15}>15% Platform Fee (Default)</option>
              <option value={0.20}>20% Platform Fee</option>
            </select>
          </div>
        </div>

        {/* Commission Table */}
        <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
          <CardHeader className="bg-slate-950/80 border-b border-slate-800 py-4 px-6 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Center-wise Commission & Settlement Register ({filteredCenters.length})
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-16 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : filteredCenters.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs font-bold uppercase tracking-wider">
                No center commission data available.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-bold uppercase border-b border-slate-800">
                    <tr>
                      <th className="p-4">Center Branch</th>
                      <th className="p-4 text-center">Transactions</th>
                      <th className="p-4 text-right">Gross Fee Collection</th>
                      <th className="p-4 text-right">Franchise Share (85%)</th>
                      <th className="p-4 text-right">Platform Commission (15%)</th>
                      <th className="p-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {filteredCenters.map(([cid, data]) => {
                      const gross = data.total;
                      const comm = gross * commissionRate;
                      const franchise = gross - comm;

                      return (
                        <tr key={cid} className="hover:bg-slate-800/30 transition">
                          <td className="p-4 font-sans font-bold text-white flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-blue-400" />
                            {centerName(cid)}
                          </td>
                          <td className="p-4 text-center">{data.count} Payments</td>
                          <td className="p-4 text-right font-bold text-white">₹{gross.toLocaleString("en-IN")}</td>
                          <td className="p-4 text-right font-bold text-emerald-400">₹{franchise.toLocaleString("en-IN")}</td>
                          <td className="p-4 text-right font-black text-blue-400">₹{comm.toLocaleString("en-IN")}</td>
                          <td className="p-4 text-center font-sans">
                            <button
                              onClick={() => handleOpenReleaseModal(cid, gross)}
                              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 mx-auto"
                            >
                              <Send className="w-3 h-3" /> Audit & Transfer
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* MODAL: RELEASE COMMISSION */}
        {releaseCenter && (
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Send className="w-4 h-4 text-blue-400" /> Transfer HQ Commission Fee
                </h3>
                <button onClick={() => setReleaseCenter(null)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 font-mono text-xs">
                <p className="text-slate-400"><span className="text-slate-200 font-bold">Center:</span> {releaseCenter.name}</p>
                <p className="text-slate-400"><span className="text-slate-200 font-bold">Gross Collection:</span> ₹{releaseCenter.gross.toLocaleString("en-IN")}</p>
                <p className="text-blue-400 font-bold text-sm"><span className="text-slate-400">HQ Platform Fee (15%):</span> ₹{releaseCenter.commission.toLocaleString("en-IN")}</p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReleaseCenter(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReleaseSubmit}
                  disabled={releasing}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
                >
                  {releasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Confirm Audit Release
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminFinanceCommissionsPage;
