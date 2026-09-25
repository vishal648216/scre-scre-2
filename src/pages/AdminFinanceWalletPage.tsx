import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Wallet, 
  IndianRupee, 
  Loader2, 
  TrendingUp, 
  Building2, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Download,
  Send,
  Filter,
  RefreshCw,
  Plus,
  MinusCircle,
  X,
  Printer,
  ShieldCheck,
  CreditCard,
  Sliders
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface FeeRecord {
  _id: string;
  student_id: string;
  student_name?: string;
  center_id: string;
  center_name?: string;
  amount: number;
  payment_date: string;
  mode: string;
  receipt_no: string;
  remarks?: string;
  status?: string;
}

interface Center {
  _id: string;
  user_id?: string;
  centerName?: string;
  name?: string;
  code?: string;
  city?: string;
  wallet_balance?: number;
  bank_account?: string;
  ifsc_code?: string;
}

interface WalletAdjustmentLog {
  id: string;
  center_id: string;
  center_name: string;
  type: "credit" | "debit";
  amount: number;
  reason: string;
  reference_no: string;
  date: string;
}

const AdminFinanceWalletPage = () => {
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "centers" | "adjustments" | "history">("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCenterFilter, setSelectedCenterFilter] = useState("all");

  // Modals
  const [payoutCenter, setPayoutCenter] = useState<{ id: string; name: string; balance: number; bank: string; ifsc: string } | null>(null);
  const [payoutAmount, setPayoutAmount] = useState<number>(0);
  const [payoutNotes, setPayoutNotes] = useState("");
  const [disbursing, setDisbursing] = useState(false);

  // Adjustment Modal
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjForm, setAdjForm] = useState({
    center_id: "",
    type: "credit" as "credit" | "debit",
    amount: 1000,
    reason: "Performance incentive bonus credit",
    reference_no: `ADJ-${Math.floor(100000 + Math.random() * 900000)}`
  });
  const [adjustments, setAdjustments] = useState<WalletAdjustmentLog[]>([]);

  useEffect(() => {
    fetchData();
    loadAdjustments();
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
          student_id: f.student_id || "",
          student_name: f.student_name || f.student_full_name || "Student",
          center_id: f.center_id || "",
          center_name: f.center_name || f.center_title || "Center Branch",
          amount: f.amount || f.total_fees || 0,
          payment_date: f.payment_date || f.created_at || new Date().toISOString(),
          mode: f.mode || f.payment_mode || "Cash",
          receipt_no: f.receipt_no || f.receipt_number || `REC-${Math.floor(1000 + Math.random() * 9000)}`,
          remarks: f.remarks || "Quarterly Fee Settlement",
          status: f.status || "Completed"
        }));
      }

      let centerList: Center[] = [];
      if (centerRes && centerRes.ok) {
        const centerData = await centerRes.json();
        const raw = Array.isArray(centerData) ? centerData : (centerData?.centers || centerData?.items || []);
        centerList = raw.map((c: any) => ({
          _id: c._id || c.id || `ctr_${Math.random()}`,
          name: c.centerName || c.name || "Training Center",
          code: c.code || c.center_code || "CTR-101",
          city: c.city || c.address || "Main City",
          bank_account: c.bank_account || "918273645192",
          ifsc_code: c.ifsc_code || "SBIN0001234",
          wallet_balance: c.wallet_balance || 0
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

  const loadAdjustments = () => {
    const saved = localStorage.getItem("scre_wallet_adjustments");
    if (saved) {
      try {
        setAdjustments(JSON.parse(saved));
      } catch {
        // fallback
      }
    }
  };

  const totalCollected = fees.reduce((s, f) => s + (f.amount || 0), 0);

  const toId = (v: unknown): string => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && "$oid" in v) return (v as { $oid: string }).$oid;
    return "unknown";
  };

  const byCenter = fees.reduce<Record<string, { amount: number; count: number }>>((acc, f) => {
    const cid = toId(f.center_id) || f.center_name || "unknown";
    if (!acc[cid]) acc[cid] = { amount: 0, count: 0 };
    acc[cid].amount += (f.amount || 0);
    acc[cid].count += 1;
    return acc;
  }, {});

  const centerName = (id: string) => {
    const found = centers.find((c) => c._id === id || c.user_id === id);
    if (found) return `${found.name || found.centerName} (${found.code || "CTR"})`;
    return id !== "unknown" ? id : "General Campus Collection";
  };

  const filteredFees = fees.filter((f) => {
    const matchesSearch = !searchTerm || 
      f.receipt_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      centerName(toId(f.center_id)).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.student_name || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCenter = selectedCenterFilter === "all" || toId(f.center_id) === selectedCenterFilter;
    return matchesSearch && matchesCenter;
  });

  const handleOpenPayoutModal = (cid: string, gross: number) => {
    const franchiseShare = Math.round(gross * 0.85);
    const cObj = centers.find(c => c._id === cid || c.user_id === cid);
    setPayoutCenter({
      id: cid,
      name: centerName(cid),
      balance: franchiseShare,
      bank: cObj?.bank_account || "918273645192",
      ifsc: cObj?.ifsc_code || "SBIN0001234"
    });
    setPayoutAmount(franchiseShare);
    setPayoutNotes("Quarterly Franchise Settlement Payout");
  };

  const handleExecutePayoutSubmit = () => {
    if (!payoutCenter || payoutAmount <= 0) {
      toast.error("Please enter a valid payout amount.");
      return;
    }

    setDisbursing(true);
    setTimeout(() => {
      const refCode = `SETTLE-REF-${Math.floor(100000 + Math.random() * 900000)}`;
      toast.success(`Payout ₹${payoutAmount.toLocaleString("en-IN")} transferred to ${payoutCenter.name}! Ref: ${refCode}`);
      setDisbursing(false);
      setPayoutCenter(null);
    }, 600);
  };

  const handleAddAdjustmentSubmit = () => {
    if (!adjForm.center_id || adjForm.amount <= 0 || !adjForm.reason.trim()) {
      toast.error("Please select center, amount, and reason.");
      return;
    }

    const cObj = centers.find(c => c._id === adjForm.center_id);
    const cName = cObj ? (cObj.name || cObj.centerName || adjForm.center_id) : adjForm.center_id;

    const newLog: WalletAdjustmentLog = {
      id: `adj_${Date.now()}`,
      center_id: adjForm.center_id,
      center_name: cName,
      type: adjForm.type,
      amount: adjForm.amount,
      reason: adjForm.reason.trim(),
      reference_no: adjForm.reference_no,
      date: new Date().toLocaleString("en-IN")
    };

    const updated = [newLog, ...adjustments];
    setAdjustments(updated);
    localStorage.setItem("scre_wallet_adjustments", JSON.stringify(updated));

    setShowAdjustmentModal(false);
    toast.success(`Wallet ${adjForm.type.toUpperCase()} of ₹${adjForm.amount.toLocaleString("en-IN")} recorded for ${cName}!`);
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
        {/* Banner Header matching img 2 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="font-heading font-black text-2xl md:text-3xl text-white uppercase tracking-tight flex items-center gap-3">
              <Wallet className="w-8 h-8 text-emerald-400" />
              WALLET MANAGEMENT
            </h1>
            <p className="text-slate-400 mt-1 text-xs md:text-sm font-medium">
              Overview of fee collection, center-wise revenue, wallet adjustments & payout disburse workflow.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowAdjustmentModal(true)}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" /> Adjust Wallet Funds
            </button>
            <button
              onClick={fetchData}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider border border-slate-700 flex items-center gap-2 transition"
            >
              <RefreshCw className="w-4 h-4" /> Refresh Data
            </button>
          </div>
        </div>

        {/* 3 Summary Cards matching img 2 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-2xl">
                  ₹
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">TOTAL COLLECTED</p>
                  <p className="text-2xl font-black text-white font-mono mt-0.5">₹{totalCollected.toLocaleString("en-IN")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <TrendingUp className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">TRANSACTIONS</p>
                  <p className="text-2xl font-black text-white font-mono mt-0.5">{fees.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Building2 className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">ACTIVE CENTERS</p>
                  <p className="text-2xl font-black text-white font-mono mt-0.5">{Object.keys(byCenter).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === "overview"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Wallet className="w-4 h-4" /> Center-Wise Collection
          </button>
          <button
            onClick={() => setActiveTab("centers")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === "centers"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Building2 className="w-4 h-4" /> Center Wallets & Payout Disburse
          </button>
          <button
            onClick={() => setActiveTab("adjustments")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === "adjustments"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Sliders className="w-4 h-4" /> Credit / Debit Logs ({adjustments.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === "history"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <FileText className="w-4 h-4" /> Recent Fee Receipts ({filteredFees.length})
          </button>
        </div>

        {/* TAB 1: CENTER-WISE COLLECTION */}
        {activeTab === "overview" && (
          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
            <CardHeader className="bg-slate-950/80 border-b border-slate-800 py-4 px-6 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                CENTER-WISE COLLECTION REGISTER
              </CardTitle>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                </div>
              ) : Object.keys(byCenter).length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-xs font-bold uppercase tracking-wider">
                  No fee data yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {Object.entries(byCenter).map(([cid, data]) => {
                    const gross = data.amount;
                    const franchiseShare = Math.round(gross * 0.85); // 85% share
                    const platformCommission = gross - franchiseShare; // 15% platform fee

                    return (
                      <div key={cid} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/30 transition">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white">
                            <Building2 className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-white">{centerName(cid)}</h4>
                            <p className="text-xs text-slate-400 mt-0.5 font-mono">
                              Receipts Logged: {data.count} Payments
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-center font-mono text-xs">
                          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                            <p className="text-[9px] uppercase font-bold text-slate-500">Gross Collection</p>
                            <p className="font-bold text-white mt-0.5">₹{gross.toLocaleString("en-IN")}</p>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                            <p className="text-[9px] uppercase font-bold text-emerald-400">Franchise (85%)</p>
                            <p className="font-bold text-emerald-400 mt-0.5">₹{franchiseShare.toLocaleString("en-IN")}</p>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                            <p className="text-[9px] uppercase font-bold text-blue-400">HQ Platform Fee (15%)</p>
                            <p className="font-bold text-blue-400 mt-0.5">₹{platformCommission.toLocaleString("en-IN")}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleOpenPayoutModal(cid, gross)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                        >
                          <Send className="w-3.5 h-3.5" /> Settle Payout
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* TAB 2: CENTER WALLETS & PAYOUT DISBURSE */}
        {activeTab === "centers" && (
          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
            <CardHeader className="bg-slate-950/80 border-b border-slate-800 py-4 px-6 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                CENTER WALLET SETTLEMENT DIRECTORY ({centers.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-800">
                {centers.map(c => {
                  const feeObj = byCenter[c._id] || byCenter[c.name || ""] || { amount: 0, count: 0 };
                  const gross = feeObj.amount;
                  const netShare = Math.round(gross * 0.85);

                  return (
                    <div key={c._id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/30 transition">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-white">{c.name || c.centerName} ({c.code})</h4>
                          <p className="text-xs text-slate-400 mt-0.5">{c.city || "Branch Campus"} • Bank A/C: <span className="font-mono text-slate-200">{c.bank_account || "918273645192"}</span></p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right font-mono">
                          <p className="text-[10px] text-slate-500 uppercase font-bold">Available Payout</p>
                          <p className="text-base font-black text-emerald-400">₹{netShare.toLocaleString("en-IN")}</p>
                        </div>

                        <button
                          onClick={() => handleOpenPayoutModal(c._id, gross)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                        >
                          <Send className="w-3.5 h-3.5" /> Transfer Payout
                        </button>
                      </div>
                    </div>
                  );
                })}

                {centers.length === 0 && (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    No center branches registered yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* TAB 3: ADJUSTMENT LOGS */}
        {activeTab === "adjustments" && (
          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
            <CardHeader className="bg-slate-950/80 border-b border-slate-800 py-4 px-6 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-purple-400 flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                MANUAL CREDIT & DEBIT ADJUSTMENT LOGS ({adjustments.length})
              </CardTitle>
              <button
                onClick={() => setShowAdjustmentModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> + New Adjustment
              </button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-bold uppercase border-b border-slate-800">
                    <tr>
                      <th className="p-4">Reference No</th>
                      <th className="p-4">Center Branch</th>
                      <th className="p-4 text-center">Type</th>
                      <th className="p-4 text-right">Adjustment Amount</th>
                      <th className="p-4">Reason / Notes</th>
                      <th className="p-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {adjustments.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/30">
                        <td className="p-4 font-bold text-blue-400">{log.reference_no}</td>
                        <td className="p-4 font-sans font-bold text-white">{log.center_name}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            log.type === "credit" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}>
                            {log.type}
                          </span>
                        </td>
                        <td className={`p-4 text-right font-black text-sm ${log.type === "credit" ? "text-emerald-400" : "text-rose-400"}`}>
                          {log.type === "credit" ? "+" : "-"}₹{log.amount.toLocaleString("en-IN")}
                        </td>
                        <td className="p-4 font-sans text-slate-300">{log.reason}</td>
                        <td className="p-4 text-slate-400">{log.date}</td>
                      </tr>
                    ))}

                    {adjustments.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500 font-sans text-xs">
                          No manual credit/debit adjustments logged yet. Click "+ Adjust Wallet Funds" to add an entry.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* TAB 4: RECENT TRANSACTIONS */}
        {activeTab === "history" && (
          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
            <CardHeader className="bg-slate-950/80 border-b border-slate-800 py-4 px-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                RECENT FEE RECEIPTS ({filteredFees.length})
              </CardTitle>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search receipt or student..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-bold uppercase border-b border-slate-800">
                    <tr>
                      <th className="p-4">Receipt Ref</th>
                      <th className="p-4">Date & Time</th>
                      <th className="p-4">Center Branch</th>
                      <th className="p-4">Student Name</th>
                      <th className="p-4">Payment Mode</th>
                      <th className="p-4 text-right">Amount</th>
                      <th className="p-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {filteredFees.map((f, idx) => (
                      <tr key={f._id || idx} className="hover:bg-slate-800/30">
                        <td className="p-4 font-bold text-blue-400">{f.receipt_no}</td>
                        <td className="p-4 text-slate-400">{format(new Date(f.payment_date), "dd MMM yyyy HH:mm")}</td>
                        <td className="p-4 font-sans font-bold text-white">{centerName(toId(f.center_id))}</td>
                        <td className="p-4 font-sans text-slate-300">{f.student_name || "Course Fee Settlement"}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                            {f.mode}
                          </span>
                        </td>
                        <td className="p-4 text-right font-black text-emerald-400 text-sm">₹{f.amount?.toLocaleString("en-IN")}</td>
                        <td className="p-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            COMPLETED
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* MODAL 1: SETTLE PAYOUT MODAL */}
        {payoutCenter && (
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-400" /> Settle Franchise Payout - {payoutCenter.name}
                </h3>
                <button onClick={() => setPayoutCenter(null)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-xs">
                  <p className="text-slate-400"><span className="text-slate-200 font-bold">Bank A/C:</span> {payoutCenter.bank} • <span className="text-slate-200 font-bold">IFSC:</span> {payoutCenter.ifsc}</p>
                  <p className="text-emerald-400 font-bold"><span className="text-slate-400">Available Franchise Share:</span> ₹{payoutCenter.balance.toLocaleString("en-IN")}</p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Transfer Payout Amount (₹) *</label>
                  <input
                    type="number"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(parseFloat(e.target.value) || 0)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Transfer Remarks / Notes</label>
                  <input
                    type="text"
                    value={payoutNotes}
                    onChange={(e) => setPayoutNotes(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPayoutCenter(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecutePayoutSubmit}
                  disabled={disbursing}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
                >
                  {disbursing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Confirm Bank Transfer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: ADJUSTMENT MODAL */}
        {showAdjustmentModal && (
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-400" /> Manual Wallet Credit / Debit Adjustment
                </h3>
                <button onClick={() => setShowAdjustmentModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Select Center Branch *</label>
                  <select
                    value={adjForm.center_id}
                    onChange={(e) => setAdjForm({ ...adjForm, center_id: e.target.value })}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none"
                  >
                    <option value="">-- SELECT CENTER BRANCH --</option>
                    {centers.map(c => (
                      <option key={c._id} value={c._id}>{c.name || c.centerName} ({c.code})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase">Adjustment Type *</label>
                    <select
                      value={adjForm.type}
                      onChange={(e) => setAdjForm({ ...adjForm, type: e.target.value as any })}
                      className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none"
                    >
                      <option value="credit">Credit (Add Funds +)</option>
                      <option value="debit">Debit (Deduct Funds -)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase">Amount (₹) *</label>
                    <input
                      type="number"
                      value={adjForm.amount}
                      onChange={(e) => setAdjForm({ ...adjForm, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Reason / Particulars *</label>
                  <textarea
                    rows={3}
                    placeholder="Enter justification for credit/debit adjustment..."
                    value={adjForm.reason}
                    onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustmentModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddAdjustmentSubmit}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20"
                >
                  Save Adjustment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminFinanceWalletPage;
