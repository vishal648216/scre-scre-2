import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, ShieldCheck, Receipt, Building2, CheckCircle2 } from "lucide-react";
import { formatISTDate, formatISTDateTimeLong } from "@/lib/time";

export interface FeeReceiptData {
  receipt_no: string;
  payment_date: string;
  amount: number;
  mode: string;
  remarks?: string;
  student_name?: string;
  enrollment_no?: string;
  course_name?: string;
  center_name?: string;
  payment_type?: string;
  reference_number?: string;
}

interface FeeReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: FeeReceiptData | null;
}

export const FeeReceiptModal: React.FC<FeeReceiptModalProps> = ({
  isOpen,
  onClose,
  receipt,
}) => {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const storedUser = JSON.parse(sessionStorage.getItem("user") || "{}");
  const studentName = receipt.student_name || storedUser.name || storedUser.fullName || storedUser.username || "Candidate";
  const enrollmentNo = receipt.enrollment_no || storedUser.enrollment_no || storedUser.enrollment_number || storedUser.registration_no || "SCRE-REG-PENDING";
  const courseName = receipt.course_name || storedUser.course_name || "Certified Vocational Course";
  const centerName = receipt.center_name || storedUser.center_name || "SCRE Authorized Training Center";

  // Financial Breakdown (approx GST & base fee)
  const totalAmount = receipt.amount || 0;
  const baseAmount = Math.round((totalAmount / 1.18) * 100) / 100;
  const gstAmount = Math.round((totalAmount - baseAmount) * 100) / 100;
  const cgst = Math.round((gstAmount / 2) * 100) / 100;
  const sgst = Math.round((gstAmount / 2) * 100) / 100;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0 rounded-none border-2 border-border shadow-2xl">
        <div id="fee-receipt-printable" className="p-6 md:p-8 bg-background text-foreground space-y-6">
          {/* Top Receipt Box */}
          <div className="border-4 border-double border-border p-6 bg-card space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between border-b-2 border-primary/20 pb-4 gap-3 text-center sm:text-left">
              <div>
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <Receipt className="w-7 h-7 text-primary" />
                  <span className="text-xl font-black uppercase tracking-widest text-primary">
                    SCRE OFFICIAL RECEIPT
                  </span>
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                  National Council for Skill Development & Educational Research
                </p>
              </div>
              <div className="text-center sm:text-right">
                <span className="inline-block px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest">
                  PAID & VERIFIED
                </span>
                <p className="text-[10px] font-black tracking-wider text-foreground mt-1">
                  NO: {receipt.receipt_no}
                </p>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/20 border border-border text-xs">
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Receipt Date</p>
                <p className="font-bold text-foreground">
                  {receipt.payment_date ? formatISTDate(receipt.payment_date) : formatISTDate(new Date().toISOString())}
                </p>
              </div>
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Payment Mode</p>
                <p className="font-bold uppercase text-foreground">{receipt.mode || "ONLINE"}</p>
              </div>
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Payment Type</p>
                <p className="font-bold uppercase text-foreground">{receipt.payment_type || "Tuition Fee"}</p>
              </div>
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Txn / Ref ID</p>
                <p className="font-bold text-foreground truncate">{receipt.reference_number || receipt.receipt_no}</p>
              </div>
            </div>

            {/* Student & Center Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs border border-border p-3">
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-primary">Student Details:</p>
                <p className="font-black uppercase text-foreground">{studentName}</p>
                <p className="text-muted-foreground font-bold">Enrollment No: {enrollmentNo}</p>
                <p className="text-muted-foreground font-bold">Course: {courseName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-primary">Issued By / Center:</p>
                <p className="font-black uppercase text-foreground flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  {centerName}
                </p>
                <p className="text-muted-foreground font-bold">GST Status: Registered Tax Invoice</p>
                <p className="text-muted-foreground font-bold">Status: Completed & Reconciled</p>
              </div>
            </div>

            {/* Amount Table */}
            <div className="space-y-2">
              <table className="w-full text-left text-xs border border-border">
                <thead className="bg-muted/40 uppercase font-black text-[9px] tracking-wider border-b border-border">
                  <tr>
                    <th className="p-2.5">Description</th>
                    <th className="p-2.5 text-right">Taxable Amt</th>
                    <th className="p-2.5 text-right">CGST (9%)</th>
                    <th className="p-2.5 text-right">SGST (9%)</th>
                    <th className="p-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="p-2.5 font-bold uppercase">
                      {receipt.payment_type || "Course Tuition & Assessment Fee"}
                    </td>
                    <td className="p-2.5 text-right font-bold">₹{baseAmount.toLocaleString()}</td>
                    <td className="p-2.5 text-right font-bold text-muted-foreground">₹{cgst.toLocaleString()}</td>
                    <td className="p-2.5 text-right font-bold text-muted-foreground">₹{sgst.toLocaleString()}</td>
                    <td className="p-2.5 text-right font-black text-foreground">₹{totalAmount.toLocaleString()}</td>
                  </tr>
                </tbody>
                <tfoot className="bg-primary/5 font-black text-xs border-t-2 border-primary/20">
                  <tr>
                    <td colSpan={4} className="p-2.5 text-right uppercase tracking-wider text-muted-foreground">
                      Net Total Paid:
                    </td>
                    <td className="p-2.5 text-right text-primary text-base font-black">
                      ₹{totalAmount.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Remarks if any */}
            {receipt.remarks && (
              <p className="text-[10px] text-muted-foreground font-bold italic">
                Note / Remarks: {receipt.remarks}
              </p>
            )}

            {/* Signatures */}
            <div className="flex justify-between items-end pt-6 text-xs">
              <div>
                <p className="text-[8px] font-bold text-muted-foreground">Computer-generated receipt.</p>
                <p className="text-[8px] font-bold text-muted-foreground">No physical signature required.</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full border border-dashed border-primary/50 flex items-center justify-center mb-1">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
                <p className="text-[8px] font-black uppercase tracking-widest text-primary">SCRE DIGITAL SEAL</p>
              </div>
              <div className="text-right">
                <div className="w-28 border-b border-border pb-1 mb-1 font-bold text-primary italic text-xs">
                  Accounts Dept.
                </div>
                <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                  Authorized Signatory
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Controls */}
        <DialogFooter className="p-4 bg-muted/40 border-t border-border flex flex-row items-center justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-none font-black text-xs uppercase tracking-widest"
          >
            Close
          </Button>
          <Button
            onClick={handlePrint}
            className="rounded-none font-black text-xs uppercase tracking-widest gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Printer className="w-4 h-4" />
            Print / Save Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
