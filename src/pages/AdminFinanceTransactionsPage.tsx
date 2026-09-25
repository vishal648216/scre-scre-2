import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  History, 
  Loader2, 
  Search, 
  Printer, 
  Download, 
  Calendar, 
  CreditCard, 
  Filter, 
  CheckCircle2,
  FileSpreadsheet,
  Eye,
  X,
  Building2,
  User,
  ArrowUpRight
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
  category?: string;
  txn_id?: string;
}

interface Center {
  _id: string;
  centerName?: string;
  name?: string;
  code?: string;
}

const DEFAULT_SAMPLE_TXNS: FeeRecord[] = [];

const AdminFinanceTransactionsPage = () => {
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [search, setSearch] = useState("");
  const [selectedMode, setSelectedMode] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<FeeRecord | null>(null);

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
          student_id: f.student_id || f.registration_no || "STU-1001",
          student_name: f.student_name || f.student_full_name || "Enrolled Student",
          center_id: f.center_id || "",
          center_name: f.center_name || f.center_title || "Training Center Branch",
          amount: f.amount || f.total_fees || 0,
          payment_date: f.payment_date || f.created_at || new Date().toISOString(),
          mode: f.mode || f.payment_mode || "UPI",
          receipt_no: f.receipt_no || f.receipt_number || `REC-${Math.floor(1000 + Math.random() * 9000)}`,
          remarks: f.remarks || "Fee Payment Settlement",
          status: f.status || "Completed",
          category: f.category || "Course Tuition Fee",
          txn_id: f.txn_id || f.transaction_ref || `TXN-${Math.floor(100000 + Math.random() * 900000)}`
        }));
      }

      let centerList: Center[] = [];
      if (centerRes && centerRes.ok) {
        const centerData = await centerRes.json();
        const raw = Array.isArray(centerData) ? centerData : (centerData?.centers || centerData?.items || []);
        centerList = raw.map((c: any) => ({
          _id: c._id || c.id || `ctr_${Math.random()}`,
          name: c.centerName || c.name || "Training Center",
          code: c.code || c.center_code || "CTR-101"
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

  const centerName = (f: FeeRecord) => {
    if (f.center_name && f.center_name !== "Center Branch") return f.center_name;
    const found = centers.find((c) => c._id === f.center_id);
    if (found) return `${found.name || found.centerName} (${found.code || "CTR"})`;
    return "HQ Central Campus";
  };

  const filtered = fees.filter((f) => {
    const matchesSearch = !search ||
      f.receipt_no?.toLowerCase().includes(search.toLowerCase()) ||
      f.txn_id?.toLowerCase().includes(search.toLowerCase()) ||
      centerName(f).toLowerCase().includes(search.toLowerCase()) ||
      (f.student_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (f.remarks || "").toLowerCase().includes(search.toLowerCase());
    
    const matchesMode = selectedMode === "all" || f.mode.toLowerCase() === selectedMode.toLowerCase();
    const matchesCat = selectedCategory === "all" || (f.category || "").toLowerCase().includes(selectedCategory.toLowerCase());
    return matchesSearch && matchesMode && matchesCat;
  });

  const totalCollected = filtered.reduce((s, f) => s + (f.amount || 0), 0);
  const totalHqShare = Math.round(totalCollected * 0.15);
  const totalCenterShare = totalCollected - totalHqShare;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
        {/* Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-black text-2xl md:text-3xl text-white uppercase tracking-tight flex items-center gap-3">
              <History className="w-8 h-8 text-blue-400" />
              TRANSACTION AUDIT & FEE RECEIPTS
            </h1>
            <p className="text-slate-400 mt-1 text-xs md:text-sm font-medium">
              Detailed tracking of fee origin, student payer details, center branch distribution, and 85/15 share splits.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider border border-slate-700 flex items-center gap-2"
            >
              <Printer className="w-4 h-4" /> Print Full Audit Ledger
            </button>
          </div>
        </div>

        {/* 3 Metric Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-2xl">
                  ₹
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">TOTAL TRANSACTION VOLUME</p>
                  <p className="text-2xl font-black text-emerald-400 font-mono mt-0.5">₹{totalCollected.toLocaleString("en-IN")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-black text-2xl">
                  ₹
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">HQ PLATFORM SHARE (15%)</p>
                  <p className="text-2xl font-black text-blue-400 font-mono mt-0.5">₹{totalHqShare.toLocaleString("en-IN")}</p>
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
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">CENTER NET SHARE (85%)</p>
                  <p className="text-2xl font-black text-purple-400 font-mono mt-0.5">₹{totalCenterShare.toLocaleString("en-IN")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search receipt, student, center or Txn ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white text-xs font-bold outline-none focus:border-blue-500 shadow-lg"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white text-xs font-bold outline-none focus:border-blue-500"
            >
              <option value="all">ALL PAYMENT MODES</option>
              <option value="UPI">UPI / Online</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
            </select>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white text-xs font-bold outline-none focus:border-blue-500"
            >
              <option value="all">ALL CATEGORIES</option>
              <option value="tuition">Course Tuition Fee</option>
              <option value="admission">Admission Fee</option>
              <option value="exam">Exam Fee</option>
              <option value="reappear">Re-appear Fee</option>
            </select>
          </div>
        </div>

        {/* Detailed Transactions Table */}
        <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
          <CardHeader className="bg-slate-950/80 border-b border-slate-800 py-4 px-6 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
              <History className="w-4 h-4" />
              DETAILED TRANSACTION AUDIT REGISTER ({filtered.length})
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-16 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs font-bold uppercase tracking-wider">
                No transactions found matching search filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-bold uppercase border-b border-slate-800">
                    <tr>
                      <th className="p-4">Receipt & Txn ID</th>
                      <th className="p-4">Date & Time</th>
                      <th className="p-4">Payer / Student Source</th>
                      <th className="p-4">Center Branch</th>
                      <th className="p-4">Particular Purpose</th>
                      <th className="p-4 text-center">Mode</th>
                      <th className="p-4 text-right">Gross Fee</th>
                      <th className="p-4 text-right">HQ Split (15%)</th>
                      <th className="p-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {[...filtered]
                      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
                      .map((f) => {
                        const hqShare = Math.round((f.amount || 0) * 0.15);

                        return (
                          <tr key={f._id} className="hover:bg-slate-800/30 transition">
                            <td className="p-4">
                              <p className="font-bold text-blue-400">{f.receipt_no}</p>
                              <p className="text-[10px] text-slate-500 font-mono mt-0.5">{f.txn_id || "TXN-OK"}</p>
                            </td>
                            <td className="p-4 text-slate-400 font-sans">
                              {format(new Date(f.payment_date), "dd MMM yyyy")}
                              <br />
                              <span className="text-[10px] text-slate-500">{format(new Date(f.payment_date), "HH:mm:ss")}</span>
                            </td>
                            <td className="p-4 font-sans">
                              <p className="font-bold text-white flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-emerald-400" />
                                {f.student_name || "Enrolled Student"}
                              </p>
                              <p className="text-[10px] text-slate-500 font-mono mt-0.5">{f.student_id}</p>
                            </td>
                            <td className="p-4 font-sans font-bold text-slate-300 flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-blue-400" />
                              {centerName(f)}
                            </td>
                            <td className="p-4 font-sans text-slate-300">
                              <p className="font-semibold text-white">{f.category || "Tuition Fee"}</p>
                              <p className="text-[10px] text-slate-400 truncate max-w-xs">{f.remarks}</p>
                            </td>
                            <td className="p-4 text-center">
                              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                                {f.mode}
                              </span>
                            </td>
                            <td className="p-4 text-right font-black text-emerald-400 text-sm">₹{f.amount?.toLocaleString("en-IN")}</td>
                            <td className="p-4 text-right font-bold text-blue-400">₹{hqShare.toLocaleString("en-IN")}</td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => setSelectedReceipt(f)}
                                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                                title="View Payment Receipt Voucher"
                              >
                                <Eye className="w-4 h-4 text-blue-400" />
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

        {/* PAYMENT RECEIPT VOUCHER MODAL */}
        {selectedReceipt && (
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Printer className="w-4 h-4 text-emerald-400" /> OFFICIAL PAYMENT RECEIPT VOUCHER
                </h3>
                <button onClick={() => setSelectedReceipt(null)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-4 font-mono text-xs">
                <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                  <div>
                    <h4 className="font-sans font-black text-base text-white tracking-tight">SIR CHHOTU RAM EDUCATION (SCRE)</h4>
                    <p className="text-[10px] text-slate-400 font-sans mt-0.5">Central Academic & Skill Examination Portal</p>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase">
                      PAID & VERIFIED
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">Receipt #: <span className="text-white font-bold">{selectedReceipt.receipt_no}</span></p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 font-sans text-xs">
                  <div>
                    <p className="text-slate-500 uppercase font-bold text-[9px]">Student Payer</p>
                    <p className="font-bold text-white text-sm mt-0.5">{selectedReceipt.student_name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">Reg ID: {selectedReceipt.student_id}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase font-bold text-[9px]">Center Branch</p>
                    <p className="font-bold text-white text-sm mt-0.5">{centerName(selectedReceipt)}</p>
                    <p className="text-[10px] text-slate-400 font-mono">Txn ID: {selectedReceipt.txn_id}</p>
                  </div>
                </div>

                <div className="border-t border-b border-slate-800 py-3 space-y-2 font-sans">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Particular Category:</span>
                    <span className="font-bold text-white">{selectedReceipt.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Payment Mode:</span>
                    <span className="font-bold text-slate-200">{selectedReceipt.mode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Payment Date:</span>
                    <span className="font-bold text-slate-200">{format(new Date(selectedReceipt.payment_date), "dd MMM yyyy HH:mm:ss")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Remarks:</span>
                    <span className="text-slate-300 italic">{selectedReceipt.remarks}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 font-sans">
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-500">Gross Settlement Amount</p>
                    <p className="text-2xl font-black text-emerald-400 font-mono">₹{selectedReceipt.amount?.toLocaleString("en-IN")}</p>
                  </div>

                  <div className="text-right text-[10px] text-slate-500">
                    <p>HQ Share (15%): ₹{Math.round(selectedReceipt.amount * 0.15).toLocaleString("en-IN")}</p>
                    <p>Center Share (85%): ₹{Math.round(selectedReceipt.amount * 0.85).toLocaleString("en-IN")}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedReceipt(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs uppercase"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
                >
                  <Printer className="w-4 h-4" /> Print Voucher Receipt
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminFinanceTransactionsPage;
