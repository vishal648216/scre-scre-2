import React, { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Award,
  CheckCircle2,
  Download,
  Printer,
  ShieldCheck,
  Building,
  Calendar,
  Sparkles,
} from "lucide-react";

interface InternshipCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: {
    id?: string;
    internship_title?: string;
    company_name?: string;
    student_name?: string;
    enrollment_no?: string;
    certificate_id?: string;
    applied_at?: string;
    updated_at?: string;
    domain?: string;
    duration_months?: number;
  } | null;
}

export const InternshipCertificateModal: React.FC<InternshipCertificateModalProps> = ({
  isOpen,
  onClose,
  application,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!application) return null;

  const handlePrint = () => {
    window.print();
  };

  const certId =
    application.certificate_id ||
    `INT-${(application.id || "CERT").slice(-6).toUpperCase()}-${new Date().getFullYear()}`;

  const completionDate = application.updated_at
    ? new Date(application.updated_at).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 rounded-none bg-card border-border">
        {/* Controls Bar */}
        <div className="p-4 bg-muted/40 border-b border-border flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-widest rounded-none">
              Official Credential
            </Badge>
            <span className="text-xs font-bold text-muted-foreground">ID: {certId}</span>
          </div>
          <div className="flex items-center gap-2 pr-6">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="rounded-none text-xs font-black uppercase tracking-wider h-8"
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              Print / Save PDF
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="rounded-none text-xs font-black uppercase tracking-wider h-8 bg-primary text-primary-foreground"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Download
            </Button>
          </div>
        </div>

        {/* Printable Certificate Canvas */}
        <div className="p-8 md:p-12 bg-white text-slate-900 overflow-x-auto" ref={printRef}>
          <div className="border-8 border-double border-amber-600/40 p-8 md:p-12 relative bg-amber-50/10 min-w-[650px]">
            {/* Corner Decorative Ornaments */}
            <div className="absolute top-2 left-2 w-8 h-8 border-t-2 border-l-2 border-amber-600"></div>
            <div className="absolute top-2 right-2 w-8 h-8 border-t-2 border-r-2 border-amber-600"></div>
            <div className="absolute bottom-2 left-2 w-8 h-8 border-b-2 border-l-2 border-amber-600"></div>
            <div className="absolute bottom-2 right-2 w-8 h-8 border-b-2 border-r-2 border-amber-600"></div>

            {/* Header / Seal */}
            <div className="text-center space-y-2 mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 text-amber-700 mb-2 border-2 border-amber-600/50 shadow-inner">
                <Award className="w-9 h-9" />
              </div>
              <h2 className="text-sm font-black uppercase tracking-[0.3em] text-amber-700">
                Sir Chhotu Ram Education Council
              </h2>
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-slate-900 font-serif">
                Certificate of Internship
              </h1>
              <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
                Professional Practical Apprenticeship Program
              </p>
            </div>

            {/* Body Text */}
            <div className="text-center space-y-6 max-w-2xl mx-auto my-8 leading-relaxed">
              <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
                This is proudly presented to
              </p>
              <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-primary font-serif border-b-2 border-slate-300 pb-2 inline-block px-8">
                {application.student_name || "Candidate Name"}
              </h3>
              {application.enrollment_no && (
                <p className="text-xs font-mono text-slate-600 font-bold">
                  Enrollment No: {application.enrollment_no}
                </p>
              )}

              <p className="text-sm text-slate-700 font-medium">
                For successfully fulfilling and completing the hands-on professional internship program in the domain of{" "}
                <span className="font-bold text-slate-900 underline underline-offset-4">
                  {application.internship_title || "Software & Academic Development"}
                </span>{" "}
                at{" "}
                <span className="font-bold text-slate-900">
                  {application.company_name || "SCREduc Innovation Lab"}
                </span>
                . During the tenure, the candidate demonstrated commendable diligence, technical competence, and ethical dedication.
              </p>
            </div>

            {/* Signatures & Seal Block */}
            <div className="grid grid-cols-3 gap-6 pt-10 mt-10 border-t border-slate-300 text-center items-end">
              <div className="space-y-1">
                <p className="text-xs font-mono font-semibold text-slate-500">{completionDate}</p>
                <div className="h-0.5 bg-slate-400 w-28 mx-auto"></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  Date of Issue
                </p>
              </div>

              {/* Digital Hologram Seal */}
              <div className="flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-full border-4 border-double border-amber-600 flex flex-col items-center justify-center text-center p-1 bg-amber-50">
                  <ShieldCheck className="w-5 h-5 text-amber-700" />
                  <span className="text-[7px] font-black uppercase tracking-tighter text-amber-800">
                    Verified Digital
                  </span>
                  <span className="text-[6px] font-mono text-amber-700">SCRE-INT-SEAL</span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-serif font-black italic text-slate-800">Authorized Signature</p>
                <div className="h-0.5 bg-slate-400 w-28 mx-auto"></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  Director / Supervisor
                </p>
              </div>
            </div>

            {/* Verification Footer */}
            <div className="mt-8 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[9px] text-slate-500 font-mono">
              <span>Verification ID: {certId}</span>
              <span>Verify Online: https://screduc.com/verify-internship</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
