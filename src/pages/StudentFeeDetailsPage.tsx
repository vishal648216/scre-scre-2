import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { IndianRupee, Loader2, Calendar, FileText, CreditCard, ShieldCheck, Eye, Printer, Filter, Sparkles, ChevronRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { FeeReceiptModal, FeeReceiptData } from "@/components/FeeReceiptModal";
import { useTranslation } from "react-i18next";

interface FeeRecord {
  _id: string;
  amount: number;
  payment_date: string;
  mode: string;
  receipt_no: string;
  remarks?: string;
  student_id: string;
}

const StudentFeeDetailsPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [filters, setFilters] = useState({ month: "", year: "" });
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<FeeReceiptData | null>(null);

  useEffect(() => {
    fetchFees();
  }, [filters]);

  const fetchFees = async () => {
    try {
      const token = sessionStorage.getItem("token");
      let feeUrl = "/api/fees";
      const params = new URLSearchParams();
      if (filters.month) params.set("month", filters.month);
      if (filters.year) params.set("year", filters.year);
      if (params.toString()) feeUrl += `?${params.toString()}`;

      const response = await fetch(feeUrl, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setFees(Array.isArray(data) ? data : []);
        const userStr = sessionStorage.getItem("user");
        if (userStr) {
          setStudentInfo(JSON.parse(userStr));
        }
      }
    } catch (error) {
      console.error("Error fetching fees:", error);
      toast.error(t("Failed to load fee details"));
    } finally {
      setLoading(false);
    }
  };

  const totalPaid = fees.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const handlePreviewFeeSlip = () => {
    if (fees.length > 0) {
      const latest = fees[0];
      setSelectedReceipt({
        receipt_no: latest.receipt_no,
        payment_date: latest.payment_date,
        amount: latest.amount,
        mode: latest.mode,
        remarks: latest.remarks,
        student_name: studentInfo?.name || studentInfo?.fullName || studentInfo?.username,
        enrollment_no: studentInfo?.enrollment_no || studentInfo?.enrollment_number,
      });
    } else {
      toast.error(t("No fee records available to preview"));
    }
  };

  const handlePrintFeeSlip = () => {
    handlePreviewFeeSlip();
  };

  const getYears = () => {
    const years = new Set<string>();
    fees.forEach(f => {
      if (f.payment_date) {
        years.add(new Date(f.payment_date).getFullYear().toString());
      }
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  };

  return (
    <DashboardLayout role="Student">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
        {/* Header Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-8 shadow-xl backdrop-blur-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <IndianRupee className="w-5 h-5 text-emerald-500" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600">
                  {t("Fee Ledger")}
                </span>
              </div>
              <h1 className="font-heading font-black text-3xl md:text-4xl text-foreground tracking-tight">
                {t("Fee Details & Receipts")}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm font-medium">
                {t("View your complete transaction history, paid fee vouchers, and download receipts.")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-card border border-border shadow-sm">
                <Filter className="w-4 h-4 text-muted-foreground ml-2" />
                <select
                  value={filters.year}
                  onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                  className="px-3 py-2 bg-transparent text-xs font-bold uppercase tracking-wider focus:outline-none"
                >
                  <option value="">{t("All Years")}</option>
                  {getYears().map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <select
                  value={filters.month}
                  onChange={(e) => setFilters({ ...filters, month: e.target.value })}
                  className="px-3 py-2 bg-transparent text-xs font-bold uppercase tracking-wider focus:outline-none border-l border-border"
                >
                  <option value="">{t("All Months")}</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month.toString()}>
                      {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handlePreviewFeeSlip}
                className="px-5 py-3.5 rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-widest hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                <span>{t("Preview Slip")}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Total Paid KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-background p-6 shadow-lg">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
                <IndianRupee className="w-7 h-7" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">{t("Total Paid Amount")}</p>
                <p className="text-3xl font-black text-foreground tracking-tight mt-0.5">₹{totalPaid.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </Card>

          <Card className="rounded-3xl border border-border/80 bg-card p-6 shadow-lg flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{t("Total Fee Receipts")}</p>
              <p className="text-3xl font-black text-foreground tracking-tight mt-0.5">{fees.length}</p>
            </div>
          </Card>

          <Card className="rounded-3xl border border-border/80 bg-card p-6 shadow-lg flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-7 h-7 text-accent" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{t("Verification Status")}</p>
              <p className="text-xs font-black uppercase tracking-widest text-emerald-600 mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {t("Audited & Verified")}
              </p>
            </div>
          </Card>
        </div>

        {/* Payment History Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-foreground/80 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              {t("Payment Transactions History")}
            </h2>
            <span className="text-[10px] font-bold text-muted-foreground uppercase">{fees.length} {t("records found")}</span>
          </div>

          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{t("Loading fee records...")}</p>
            </div>
          ) : fees.length === 0 ? (
            <Card className="rounded-3xl border-dashed border-2 border-border p-16 text-center bg-card/40">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{t("No payment records found for the selected filter.")}</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {fees.map(fee => (
                <Card key={fee._id} className="rounded-3xl border border-border/80 bg-card hover:border-primary/40 transition-all duration-300 shadow-sm hover:shadow-xl overflow-hidden group">
                  <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0 group-hover:scale-105 transition-transform">
                        <IndianRupee className="w-7 h-7 text-emerald-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-black text-foreground">₹{(fee.amount || 0).toLocaleString("en-IN")}</span>
                          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-wider border border-emerald-500/20">
                            {t("Paid")}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-muted-foreground font-semibold">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-primary" />
                            {fee.payment_date ? format(new Date(fee.payment_date), "dd MMM yyyy") : "-"}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span className="flex items-center gap-1 uppercase">
                            <CreditCard className="w-3.5 h-3.5 text-primary" />
                            {fee.mode}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col md:items-end gap-3 pt-4 md:pt-0 border-t md:border-t-0 border-border">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-primary px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20">
                          {fee.receipt_no}
                        </span>
                        <button
                          onClick={() =>
                            setSelectedReceipt({
                              receipt_no: fee.receipt_no,
                              payment_date: fee.payment_date,
                              amount: fee.amount,
                              mode: fee.mode,
                              remarks: fee.remarks,
                              student_name: studentInfo?.name || studentInfo?.fullName || studentInfo?.username,
                              enrollment_no: studentInfo?.enrollment_no || studentInfo?.enrollment_number,
                            })
                          }
                          className="px-4 py-2 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:bg-primary-dark transition-all flex items-center gap-1.5 shadow-md shadow-primary/10"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{t("View Slip")}</span>
                        </button>
                      </div>
                      {fee.remarks && (
                        <p className="text-[11px] font-medium text-muted-foreground italic max-w-xs text-right">
                          "{fee.remarks}"
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Fee Receipt Printable Modal */}
        <FeeReceiptModal
          isOpen={!!selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          receipt={selectedReceipt}
        />
      </div>
    </DashboardLayout>
  );
};

export default StudentFeeDetailsPage;
