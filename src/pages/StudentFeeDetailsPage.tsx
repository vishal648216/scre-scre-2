import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndianRupee, Loader2, Calendar, FileText, CreditCard, ShieldCheck, Eye, Printer, Filter } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { FeeReceiptModal, FeeReceiptData } from "@/components/FeeReceiptModal";

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
        setFees(data);
        // Get student info from session storage
        const userStr = sessionStorage.getItem("user");
        if (userStr) {
          setStudentInfo(JSON.parse(userStr));
        }
      }
    } catch (error) {
      console.error("Error fetching fees:", error);
      toast.error("Failed to load fee details");
    } finally {
      setLoading(false);
    }
  };

  const totalPaid = fees.reduce((acc, curr) => acc + curr.amount, 0);

  const handlePreviewFeeSlip = () => {
    if (fees.length > 0) {
      const latest = fees[0];
      setSelectedReceipt({
        receipt_no: latest.receipt_no,
        payment_date: latest.payment_date,
        amount: latest.amount,
        mode: latest.mode,
        remarks: latest.remarks,
        student_name: studentInfo?.name || studentInfo?.fullName,
        enrollment_no: studentInfo?.enrollment_no || studentInfo?.enrollment_number,
      });
    } else {
      toast.error("No fee records available to preview");
    }
  };

  const handlePrintFeeSlip = () => {
    handlePreviewFeeSlip();
  };

  const getYears = () => {
    const years = new Set<string>();
    fees.forEach(f => {
      years.add(new Date(f.payment_date).getFullYear().toString());
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Fee Details</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">View your payment history and fee status.</p>
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                value={filters.year}
                onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                className="px-3 py-2 bg-card border border-border rounded-none text-xs font-bold uppercase tracking-widest focus:border-primary outline-none"
              >
                <option value="">All Years</option>
                {getYears().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <select
                value={filters.month}
                onChange={(e) => setFilters({ ...filters, month: e.target.value })}
                className="px-3 py-2 bg-card border border-border rounded-none text-xs font-bold uppercase tracking-widest focus:border-primary outline-none"
              >
                <option value="">All Months</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                  <option key={month} value={month.toString()}>
                    {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handlePreviewFeeSlip}
              className="px-6 py-3 bg-blue-600 text-white rounded-none font-heading font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:opacity-90 transition-all flex items-center gap-2"
            >
              <Eye className="w-4 h-4" /> Preview
            </button>
            <button
              onClick={handlePrintFeeSlip}
              className="px-6 py-3 bg-purple-600 text-white rounded-none font-heading font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:opacity-90 transition-all flex items-center gap-2"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card className="rounded-none border-emerald-600 bg-emerald-500/5 border-l-4">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-500 flex items-center justify-center border border-white/20">
                <IndianRupee className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">Total Paid Amount</p>
                <p className="text-2xl font-black text-emerald-600 tracking-tight">₹{totalPaid.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Payment History
          </h2>

          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : fees.length === 0 ? (
            <Card className="rounded-none border-border border-dashed p-12 text-center opacity-60">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">No payments recorded yet</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {fees.map(fee => (
                <Card key={fee._id} className="rounded-none border-border shadow-md hover:border-primary/40 transition-all overflow-hidden group">
                  <div className="flex flex-col md:flex-row">
                    <div className="md:w-1/4 bg-muted/30 p-6 flex flex-col justify-center items-center md:items-start border-b md:border-b-0 md:border-r border-border">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Receipt No.</p>
                      <p className="text-sm font-black text-primary tracking-widest">{fee.receipt_no}</p>
                    </div>
                    <div className="flex-1 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/5 flex items-center justify-center border border-primary/10">
                          <IndianRupee className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="text-xl font-black text-foreground">₹{fee.amount.toLocaleString()}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight flex items-center gap-2">
                            <Calendar className="w-3 h-3" /> {format(new Date(fee.payment_date), "dd MMM yyyy")}
                            <span className="mx-1">•</span>
                            <CreditCard className="w-3 h-3" /> {fee.mode.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setSelectedReceipt({
                                receipt_no: fee.receipt_no,
                                payment_date: fee.payment_date,
                                amount: fee.amount,
                                mode: fee.mode,
                                remarks: fee.remarks,
                                student_name: studentInfo?.name || studentInfo?.fullName,
                                enrollment_no: studentInfo?.enrollment_no || studentInfo?.enrollment_number,
                              })
                            }
                            className="px-2.5 py-1 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                          >
                            <FileText className="w-3 h-3" /> View Slip
                          </button>
                          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Verified</span>
                          </div>
                        </div>
                        {fee.remarks && (
                          <p className="text-[9px] font-bold text-muted-foreground italic truncate max-w-[200px]">
                            "{fee.remarks}"
                          </p>
                        )}
                      </div>
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
