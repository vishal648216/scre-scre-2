import React, { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Award, Printer, Download, CheckCircle2, ShieldCheck, Keyboard, Clock, Target, AlertTriangle } from "lucide-react";
import { formatISTDateTimeLong } from "@/lib/time";

interface TypingScorecardCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "scorecard" | "certificate";
  stats: {
    wpm: number;
    accuracy: number;
    time: number;
    mistakes?: number;
    totalChars?: number;
  };
  lessonTitle: string;
  languageName: string;
}

export const TypingScorecardCertificateModal: React.FC<TypingScorecardCertificateModalProps> = ({
  isOpen,
  onClose,
  mode,
  stats,
  lessonTitle,
  languageName,
}) => {
  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  const studentName = user.name || user.username || "Candidate";
  const enrollmentNo = user.enrollment_no || user.enrollment_number || user.registration_no || "SCRE-TYP-" + Math.floor(100000 + Math.random() * 900000);
  const centerName = user.center_name || "SCRE Authorized Training Center";
  const currentDate = formatISTDateTimeLong(new Date().toISOString());
  const certId = "TYP-" + Math.floor(10000000 + Math.random() * 90000000);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 rounded-none border-2 border-border shadow-2xl">
        {/* Printable Container */}
        <div id="typing-printable-doc" className="p-6 md:p-10 bg-background text-foreground">
          {mode === "scorecard" ? (
            /* SCORECARD LAYOUT */
            <div className="space-y-6 border-4 border-double border-border p-6 md:p-8 bg-card">
              {/* Header */}
              <div className="flex flex-col md:flex-row items-center justify-between border-b-2 border-primary/20 pb-4 gap-4 text-center md:text-left">
                <div>
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <Keyboard className="w-8 h-8 text-primary" />
                    <span className="text-xl font-black uppercase tracking-widest text-primary">SCRE TYPING MASTER</span>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                    Official Candidate Speed & Accuracy Performance Scorecard
                  </p>
                </div>
                <div className="text-center md:text-right">
                  <span className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-black uppercase tracking-widest">
                    VERIFIED ASSESSMENT
                  </span>
                  <p className="text-[9px] font-bold text-muted-foreground mt-1">ID: {certId}</p>
                </div>
              </div>

              {/* Student Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/20 border border-border text-xs">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Candidate Name</p>
                  <p className="font-black uppercase text-foreground">{studentName}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Enrollment / Reg No.</p>
                  <p className="font-bold text-foreground">{enrollmentNo}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Language / Script</p>
                  <p className="font-bold uppercase text-foreground">{languageName || "English"}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Date of Evaluation</p>
                  <p className="font-bold text-foreground">{currentDate}</p>
                </div>
              </div>

              {/* Performance Metrics Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-widest text-foreground">Test Metrics Overview:</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-primary/5 border border-primary/20 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-primary">Net Speed (WPM)</p>
                    <p className="text-3xl font-black text-foreground mt-1">{stats.wpm}</p>
                    <p className="text-[8px] font-bold uppercase text-muted-foreground mt-1">Words Per Minute</p>
                  </div>
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Net Accuracy</p>
                    <p className="text-3xl font-black text-foreground mt-1">{stats.accuracy}%</p>
                    <p className="text-[8px] font-bold uppercase text-muted-foreground mt-1">Key Accuracy</p>
                  </div>
                  <div className="p-4 bg-amber-500/5 border border-amber-500/20 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">Key Mistakes</p>
                    <p className="text-3xl font-black text-foreground mt-1">{stats.mistakes ?? 0}</p>
                    <p className="text-[8px] font-bold uppercase text-muted-foreground mt-1">Incorrect Strokes</p>
                  </div>
                  <div className="p-4 bg-blue-500/5 border border-blue-500/20 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-600">Duration</p>
                    <p className="text-3xl font-black text-foreground mt-1">{stats.time}s</p>
                    <p className="text-[8px] font-bold uppercase text-muted-foreground mt-1">Total Test Time</p>
                  </div>
                </div>
              </div>

              {/* Assessment Breakdown */}
              <div className="border border-border p-4 bg-card space-y-3 text-xs">
                <div className="flex justify-between items-center border-b border-border pb-2">
                  <span className="font-bold text-muted-foreground uppercase">Evaluated Passage Title:</span>
                  <span className="font-black uppercase text-foreground">{lessonTitle}</span>
                </div>
                <div className="flex justify-between items-center border-b border-border pb-2">
                  <span className="font-bold text-muted-foreground uppercase">Total Characters Struck:</span>
                  <span className="font-black text-foreground">{stats.totalChars ?? stats.wpm * 5}</span>
                </div>
                <div className="flex justify-between items-center border-b border-border pb-2">
                  <span className="font-bold text-muted-foreground uppercase">Assessment Result:</span>
                  <span className="font-black uppercase text-emerald-600">
                    {stats.wpm >= 30 && stats.accuracy >= 90 ? "PRO QUALIFIED (A+)" : stats.wpm >= 25 ? "QUALIFIED (A)" : "COMPLETED"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-muted-foreground uppercase">Training Center:</span>
                  <span className="font-bold uppercase text-foreground">{centerName}</span>
                </div>
              </div>

              {/* Footer Signatures */}
              <div className="flex justify-between items-end pt-8 text-center text-xs">
                <div>
                  <div className="w-32 border-b border-border pb-1 mb-1" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Candidate Signature</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-primary/40 flex items-center justify-center p-2 mb-1">
                    <ShieldCheck className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-primary">SCRE DIGITAL SEAL</p>
                </div>
                <div>
                  <div className="w-32 border-b border-border pb-1 mb-1 font-bold text-primary italic">Verified Official</div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Authorized Examiner</p>
                </div>
              </div>
            </div>
          ) : (
            /* CERTIFICATE LAYOUT */
            <div className="border-8 border-double border-amber-600/40 p-8 md:p-12 bg-gradient-to-br from-amber-500/5 via-card to-amber-500/10 text-center space-y-6 relative overflow-hidden">
              {/* Background watermark */}
              <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
                <Award className="w-96 h-96 text-amber-500" />
              </div>

              {/* Top Banner */}
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Award className="w-10 h-10 text-amber-600" />
                </div>
                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-widest text-foreground font-serif">
                  CERTIFICATE OF PROFICIENCY
                </h2>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-600">
                  SCRE NATIONAL SKILL TESTING & CERTIFICATION
                </p>
              </div>

              <div className="w-32 h-1 bg-amber-600/40 mx-auto" />

              {/* Recipient */}
              <div className="space-y-2 py-2">
                <p className="text-xs font-serif italic text-muted-foreground">This is proudly presented to</p>
                <h3 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-primary font-serif underline decoration-amber-500/40 underline-offset-8">
                  {studentName}
                </h3>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Enrollment No: {enrollmentNo}
                </p>
              </div>

              {/* Text Body */}
              <div className="max-w-2xl mx-auto space-y-2 text-xs md:text-sm text-foreground leading-relaxed">
                <p>
                  for successfully qualifying in the <strong>{languageName || "English"} Typing Master Examination</strong>, demonstrating an exceptional net keyboard speed of:
                </p>
                <div className="flex items-center justify-center gap-6 py-4">
                  <div className="px-6 py-2 bg-amber-500/10 border-2 border-amber-500/30">
                    <span className="text-2xl md:text-3xl font-black text-amber-600">{stats.wpm}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">WPM Speed</span>
                  </div>
                  <div className="px-6 py-2 bg-emerald-500/10 border-2 border-emerald-500/30">
                    <span className="text-2xl md:text-3xl font-black text-emerald-600">{stats.accuracy}%</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Accuracy</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Conducted under standard computerized examination protocols with real-time keystroke precision verification.
                </p>
              </div>

              {/* Signatures & Seal */}
              <div className="flex justify-between items-end pt-8 text-xs border-t border-amber-500/20">
                <div className="text-left">
                  <p className="font-bold text-foreground">{currentDate}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Date of Issue</p>
                  <p className="text-[8px] font-bold text-muted-foreground">Cert ID: {certId}</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full border-4 border-double border-amber-600 flex items-center justify-center bg-amber-500/10 shadow-lg mb-1">
                    <Award className="w-10 h-10 text-amber-600" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-600">OFFICIAL CERTIFIED</span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary font-serif italic text-sm">Controller of Exams</p>
                  <div className="w-32 border-b border-border pb-1 mb-1 ml-auto" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Authorized Signatory</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <DialogFooter className="p-4 bg-muted/40 border-t border-border flex flex-row items-center justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-none font-black text-xs uppercase tracking-widest"
          >
            Close
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={handlePrint}
              className="rounded-none font-black text-xs uppercase tracking-widest gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
