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

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { IndianRupee, Loader2, Calendar, FileText, CreditCard, ShieldCheck, Eye, Filter, CheckCircle2, Clock, AlertCircle, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
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

interface Installment {
  installment_number: number;
  amount_due: number;
  due_date: string;
  payment_date?: string;
  amount_paid: number;
}

interface FeeSummary {
  student_id: string;
  total_fees: number;
  extra_charges_total: number;
  overall_total: number;
  total_paid: number;
  remaining_amount: number;
  payment_type?: string;
  installments?: Installment[];
}

const StudentFeeDetailsPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [summary, setSummary] = useState<FeeSummary | null>(null);
  const [filters, setFilters] = useState({ month: "", year: "" });
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<FeeReceiptData | null>(null);

  useEffect(() => {
    fetchFees();
  }, [filters]);

  const fetchFees = async () => {
    try {
      const token = sessionStorage.getItem("token");
      const userStr = sessionStorage.getItem("user");
      let currentUser = null;
      if (userStr) {
        currentUser = JSON.parse(userStr);
        setStudentInfo(currentUser);
      }

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
      }

      // Fetch summary if student ID is known
      const studentId = currentUser?._id || currentUser?.id;
      if (studentId) {
        const summaryRes = await fetch(`/api/fees/summary/${studentId}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setSummary(summaryData);
        }
      }
    } catch (error) {
      console.error("Error fetching fees:", error);
      toast.error(t("Failed to load fee details"));
    } finally {
      setLoading(false);
    }
  };

  const calculatedTotalPaid = fees.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalPaid = summary?.total_paid ?? calculatedTotalPaid;
  const totalCourseFee = summary?.overall_total || summary?.total_fees || totalPaid;
  const remainingDue = summary?.remaining_amount ?? Math.max(0, totalCourseFee - totalPaid);

  // Find next upcoming installment
  const nextInstallment = summary?.installments?.find(
    (inst) => (inst.amount_due - inst.amount_paid) > 0
  );

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
                {t("View course fee structure, payment history, remaining balance, and print receipts.")}
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

        {/* 4 Financial KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Total Course Fee */}
          <Card className="rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-card to-background p-6 shadow-lg relative overflow-hidden">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/30 shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">{t("Total Course Fee")}</p>
                <p className="text-2xl font-black text-foreground tracking-tight mt-0.5">₹{totalCourseFee.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </Card>

          {/* Card 2: Total Paid Amount */}
          <Card className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-background p-6 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/30 shrink-0">
                <IndianRupee className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">{t("Paid Amount")}</p>
                <p className="text-2xl font-black text-emerald-600 tracking-tight mt-0.5">₹{totalPaid.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </Card>

          {/* Card 3: Remaining Due */}
          <Card className={`rounded-3xl border ${remainingDue > 0 ? 'border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-background' : 'border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-background'} p-6 shadow-lg`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl ${remainingDue > 0 ? 'bg-amber-500 text-white shadow-amber-500/30' : 'bg-emerald-500 text-white shadow-emerald-500/30'} flex items-center justify-center shadow-md shrink-0`}>
                {remainingDue > 0 ? <AlertCircle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
              </div>
              <div>
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${remainingDue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{t("Remaining Due")}</p>
                <p className="text-2xl font-black tracking-tight mt-0.5">
                  ₹{remainingDue.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </Card>

          {/* Card 4: Next Payment / Status */}
          <Card className="rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-card to-background p-6 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500 text-white flex items-center justify-center shadow-md shadow-purple-500/30 shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-600">{t("Next Payment / Status")}</p>
                {nextInstallment ? (
                  <div>
                    <p className="text-base font-black text-foreground mt-0.5">
                      ₹{(nextInstallment.amount_due - nextInstallment.amount_paid).toLocaleString("en-IN")}
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground">
                      Due: {nextInstallment.due_date ? format(new Date(nextInstallment.due_date), "dd MMM yyyy") : "Pending"}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs font-black uppercase tracking-widest text-emerald-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t("All Dues Cleared")}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Installment Schedule Section (if available) */}
        {summary?.installments && summary.installments.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-foreground/80 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              {t("Installment Schedule & Due Dates")}
            </h2>
            <Card className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-lg p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 uppercase font-black text-[9px] tracking-wider text-muted-foreground border-b border-border">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Due Date</th>
                      <th className="p-3">Amount Due</th>
                      <th className="p-3">Amount Paid</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {summary.installments.map((inst, index) => {
                      const isPaid = inst.amount_paid >= inst.amount_due;
                      return (
                        <tr key={index} className="hover:bg-muted/10 transition-colors">
                          <td className="p-3 font-bold text-foreground">Inst {inst.installment_number || index + 1}</td>
                          <td className="p-3 font-medium text-muted-foreground">
                            {inst.due_date ? format(new Date(inst.due_date), "dd MMM yyyy") : "-"}
                          </td>
                          <td className="p-3 font-bold text-foreground">₹{inst.amount_due.toLocaleString("en-IN")}</td>
                          <td className="p-3 font-bold text-emerald-600">₹{inst.amount_paid.toLocaleString("en-IN")}</td>
                          <td className="p-3">
                            {isPaid ? (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Paid
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Pending
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

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

