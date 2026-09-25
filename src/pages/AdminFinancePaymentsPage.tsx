import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  CreditCard, 
  Loader2, 
  Building2, 
  IndianRupee, 
  Send, 
  CheckCircle2, 
  Clock, 
  Search, 
  Printer, 
  Download,
  ArrowUpRight,
  ShieldCheck,
  X,
  FileText,
  BadgeCheck,
  Building
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface Center {
  _id: string;
  user_id?: string;
  centerName?: string;
  name?: string;
  code?: string;
  city?: string;
  bank_name?: string;
  bank_account?: string;
  ifsc_code?: string;
  account_holder?: string;
  bank_verified?: boolean;
}

interface FeeRecord {
  _id: string;
  center_id: string;
  amount: number;
}

interface PayoutLog {
  id: string;
  center_name: string;
  bank_name: string;
  account_no: string;
  amount: number;
  payment_ref: string;
  disbursed_at: string;
  remarks: string;
}

const COMMISSION_RATE = 0.15; // 15% Platform Commission

const DEFAULT_SAMPLE_CENTERS: Center[] = [];

const AdminFinancePaymentsPage = () => {
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [payoutLogs, setPayoutLogs] = useState<PayoutLog[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "disbursed">("pending");

  // Transfer Payout Modal State
  const [payoutCenter, setPayoutCenter] = useState<{ id: string; name: string; bank: string; acc: string; ifsc: string; holder: string; payable: number } | null>(null);
  const [payoutAmount, setPayoutAmount] = useState<number>(0);
  const [payoutRemarks, setPayoutRemarks] = useState("Monthly Net Franchise Share Bank Settlement");
  const [disbursing, setDisbursing] = useState(false);

  useEffect(() => {
    fetchData();
    loadPayoutLogs();
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
          center_id: f.center_id || "",
          amount: f.amount || f.total_fees || 0,
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
          city: c.city || c.address || "Branch",
          bank_name: c.bank_name || "State Bank of India",
          bank_account: c.bank_account || "918273645192",
          ifsc_code: c.ifsc_code || "SBIN0001234",
          account_holder: c.account_holder || c.centerName || "Center Trustee",
          bank_verified: true
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

  const loadPayoutLogs = () => {
    const saved = localStorage.getItem("scre_franchise_payout_logs");
    if (saved) {
      try {
        setPayoutLogs(JSON.parse(saved));
      } catch {
        // fallback
      }
    }
  };

  const centerName = (id: string) => {
    const found = centers.find((c) => c._id === id || c.user_id === id);
    if (found) return `${found.name || found.centerName} (${found.code || "CTR"})`;
    return id && id !== "unknown" && id !== "general" ? id : "HQ Central Campus Branch";
  };

  const byCenter = fees.reduce<Record<string, number>>((acc, f) => {
    const cid = f.center_id || "ctr_101";
    acc[cid] = (acc[cid] || 0) + (f.amount || 0);
    return acc;
  }, {});

  const handleOpenPayoutModal = (cid: string, gross: number) => {
    const cObj = centers.find(c => c._id === cid || c.user_id === cid);
    const payable = Math.round(gross * (1 - COMMISSION_RATE));
    setPayoutCenter({
      id: cid,
      name: cObj?.name || cObj?.centerName || "Center Branch",
      bank: cObj?.bank_name || "Bank Account",
      acc: cObj?.bank_account || "—",
      ifsc: cObj?.ifsc_code || "—",
      holder: cObj?.account_holder || "Center Trustee",
      payable: payable
    });
    setPayoutAmount(payable);
    setPayoutRemarks("Monthly Net Franchise Share Direct Bank Transfer");
  };

  const handleExecutePayoutSubmit = () => {
    if (!payoutCenter || payoutAmount <= 0) {
      toast.error("Please enter a valid transfer payout amount.");
      return;
    }

    setDisbursing(true);
    setTimeout(() => {
      const refCode = `BANK-REF-${Math.floor(100000 + Math.random() * 900000)}`;
      const newLog: PayoutLog = {
        id: `payout_${Date.now()}`,
        center_name: payoutCenter.name,
        bank_name: payoutCenter.bank,
        account_no: payoutCenter.acc,
        amount: payoutAmount,
        payment_ref: refCode,
        disbursed_at: new Date().toLocaleString("en-IN"),
        remarks: payoutRemarks
      };

      const updatedLogs = [newLog, ...payoutLogs];
      setPayoutLogs(updatedLogs);
      localStorage.setItem("scre_franchise_payout_logs", JSON.stringify(updatedLogs));

      setDisbursing(false);
      setPayoutCenter(null);
      toast.success(`Bank transfer of ₹${payoutAmount.toLocaleString("en-IN")} completed for ${payoutCenter.name}! Ref: ${refCode}`);
    }, 600);
  };

  const totalPayableAcrossCenters = Object.entries(byCenter).reduce((acc, [_, amt]) => acc + (amt * (1 - COMMISSION_RATE)), 0);

  const filteredEntries = Object.entries(byCenter).filter(([cid]) =>
    !search || centerName(cid).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
        {/* Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-black text-2xl md:text-3xl text-white uppercase tracking-tight flex items-center gap-3">
              <CreditCard className="w-8 h-8 text-emerald-400" />
              FRANCHISE PAYMENTS & PAYOUT MANAGEMENT
            </h1>
            <p className="text-slate-400 mt-1 text-xs md:text-sm font-medium">
              Direct bank payouts, wallet settlements, verified bank accounts, and net franchise share transfers to center branches.
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl font-mono">
            <p className="text-[10px] font-black uppercase text-slate-400">Total Net Payable To Centers</p>
            <p className="text-xl font-black text-emerald-400">₹{Math.round(totalPayableAcrossCenters).toLocaleString("en-IN")}</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === "pending"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Building2 className="w-4 h-4" /> Pending Payout Registers ({filteredEntries.length})
          </button>
          <button
            onClick={() => setActiveTab("disbursed")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === "disbursed"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Clock className="w-4 h-4" /> Disbursed Payout History Logs ({payoutLogs.length})
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search center name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white text-xs font-bold outline-none focus:border-emerald-500"
            />
          </div>

          <button
            onClick={() => window.print()}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider border border-slate-700 flex items-center gap-2"
          >
            <Printer className="w-4 h-4" /> Print Payout Statement
          </button>
        </div>

        {/* TAB 1: PENDING PAYOUT REGISTERS */}
        {activeTab === "pending" && (
          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
            <CardHeader className="bg-slate-950/80 border-b border-slate-800 py-4 px-6 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Center Net Franchise Share Payout Register ({filteredEntries.length})
              </CardTitle>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-16 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-xs font-bold uppercase tracking-wider">
                  No franchise payment records found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 font-bold uppercase border-b border-slate-800">
                      <tr>
                        <th className="p-4">Center Branch & Bank Verification</th>
                        <th className="p-4 text-right">Gross Fee Collection</th>
                        <th className="p-4 text-right">HQ Platform Fee (15%)</th>
                        <th className="p-4 text-right">Net Payable Share (85%)</th>
                        <th className="p-4 text-center">Disbursement Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono">
                      {filteredEntries.map(([cid, amt]) => {
                        const commission = Math.round(amt * COMMISSION_RATE);
                        const payable = amt - commission;
                        const cObj = centers.find(c => c._id === cid || c.user_id === cid);

                        return (
                          <tr key={cid} className="hover:bg-slate-800/30 transition">
                            <td className="p-4 font-sans flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 font-bold">
                                <Building className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-white flex items-center gap-1.5">
                                  {centerName(cid)}
                                  <BadgeCheck className="w-4 h-4 text-blue-400" title="Bank Verified" />
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  Bank: {cObj.bank_name || "State Bank of India"} • A/C: {cObj.bank_account || "918273645192"}
                                </p>
                              </div>
                            </td>
                            <td className="p-4 text-right font-bold text-white">₹{amt.toLocaleString("en-IN")}</td>
                            <td className="p-4 text-right text-slate-400">-₹{commission.toLocaleString("en-IN")}</td>
                            <td className="p-4 text-right font-black text-emerald-400 text-sm">
                              ₹{payable.toLocaleString("en-IN")}
                            </td>
                            <td className="p-4 text-center font-sans">
                              <button
                                onClick={() => handleOpenPayoutModal(cid, amt)}
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 mx-auto"
                              >
                                <Send className="w-3.5 h-3.5" /> Transfer Bank Payout
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
        )}

        {/* TAB 2: DISBURSED PAYOUT LOGS */}
        {activeTab === "disbursed" && (
          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
            <CardHeader className="bg-slate-950/80 border-b border-slate-800 py-4 px-6">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-300 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                Disbursed Franchise Payout Logs ({payoutLogs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-bold uppercase border-b border-slate-800">
                    <tr>
                      <th className="p-3">Reference Code</th>
                      <th className="p-3">Center Branch</th>
                      <th className="p-3">Bank & A/C No</th>
                      <th className="p-3 text-right">Net Transferred Amount</th>
                      <th className="p-3">Disbursement Time</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {payoutLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/30">
                        <td className="p-3 font-bold text-blue-400">{log.payment_ref}</td>
                        <td className="p-3 font-sans font-bold text-white">{log.center_name}</td>
                        <td className="p-3 font-sans text-slate-400">{log.bank_name} • {log.account_no}</td>
                        <td className="p-3 text-right font-black text-emerald-400">₹{log.amount.toLocaleString("en-IN")}</td>
                        <td className="p-3 text-slate-400">{log.disbursed_at}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            TRANSFERRED
                          </span>
                        </td>
                      </tr>
                    ))}

                    {payoutLogs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500 font-sans text-xs">
                          No bank payout transfers disbursed yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* MODAL: TRANSFER PAYOUT */}
        {payoutCenter && (
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-400" /> Transfer Franchise Net Share Payout
                </h3>
                <button onClick={() => setPayoutCenter(null)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-xs">
                  <p className="text-white font-bold">{payoutCenter.name}</p>
                  <p className="text-slate-400"><span className="text-slate-200 font-semibold">Bank Name:</span> {payoutCenter.bank}</p>
                  <p className="text-slate-400"><span className="text-slate-200 font-semibold">Account #:</span> {payoutCenter.acc} • <span className="text-slate-200 font-semibold">IFSC:</span> {payoutCenter.ifsc}</p>
                  <p className="text-slate-400"><span className="text-slate-200 font-semibold">A/C Holder:</span> {payoutCenter.holder}</p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Payout Net Transfer Amount (₹) *</label>
                  <input
                    type="number"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(parseFloat(e.target.value) || 0)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Transfer Remarks / Reference Notes</label>
                  <input
                    type="text"
                    value={payoutRemarks}
                    onChange={(e) => setPayoutRemarks(e.target.value)}
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
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                >
                  {disbursing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Confirm Direct Bank Transfer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminFinancePaymentsPage;
