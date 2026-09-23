import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { Loader2, Printer, ArrowLeft, Award, CheckCircle2, Zap, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import DashboardLayout from "@/components/DashboardLayout";

interface TypingCertificate {
  _id: string;
  certificate_no: string;
  student_id: string;
  wpm: number;
  accuracy: number;
  language: string;
  issued_on: string;
}

const TypingCertificatePage = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [cert, setCert] = useState<TypingCertificate | null>(null);

  useEffect(() => {
    fetchCertificate();
  }, [id]);

  const fetchCertificate = async () => {
    try {
      const res = await apiFetch(`/api/typing/certificates/${id}`);
      if (res.ok) {
        setCert(await res.json());
      }
    } catch (error) {
      console.error("Error fetching certificate:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!cert) return <div className="text-center py-20 font-black uppercase tracking-widest text-muted-foreground">Certificate not found</div>;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 p-6 print:p-0">
        <div className="flex items-center justify-between print:hidden">
          <Link to="/dashboard/typing/history" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary flex items-center gap-2">
            <ArrowLeft className="w-3 h-3" /> Back to History
          </Link>
          <Button onClick={() => window.print()} className="rounded-none font-black uppercase tracking-widest text-[10px] bg-primary text-white">
            <Printer className="w-3.5 h-3.5 mr-2" /> Print Certificate
          </Button>
        </div>

        {/* Certificate Layout */}
        <div className="bg-white border-[16px] border-double border-primary/20 p-12 relative overflow-hidden shadow-2xl min-h-[600px] flex flex-col items-center justify-center text-center space-y-8">
          {/* Watermark/Background Decoration */}
          <Award className="absolute -bottom-10 -right-10 w-64 h-64 text-primary/5 -rotate-12" />
          <div className="absolute top-0 left-0 w-32 h-32 border-t-8 border-l-8 border-primary/10" />
          <div className="absolute bottom-0 right-0 w-32 h-32 border-b-8 border-r-8 border-primary/10" />

          <div className="space-y-4 relative z-10">
            <Award className="w-20 h-20 text-primary mx-auto mb-6" />
            <h1 className="text-5xl font-black uppercase tracking-tighter text-foreground">Certificate of Excellence</h1>
            <p className="text-xl font-bold text-muted-foreground uppercase tracking-[0.3em]">Typing Proficiency Award</p>
          </div>

          <div className="space-y-6 relative z-10 max-w-2xl">
            <p className="text-lg font-medium italic text-muted-foreground">This is to certify that the student has successfully completed the typing assessment with the following performance metrics in</p>
            <p className="text-3xl font-black uppercase text-primary border-b-2 border-primary/20 inline-block px-8 pb-2">{cert.language} Language</p>
          </div>

          <div className="grid grid-cols-2 gap-12 py-10 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-primary">
                <Zap className="w-6 h-6" />
                <p className="text-3xl font-black">{Math.round(cert.wpm)} WPM</p>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Typing Speed</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-emerald-500">
                <Target className="w-6 h-6" />
                <p className="text-3xl font-black">{Math.round(cert.accuracy)}%</p>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Accuracy Level</p>
            </div>
          </div>

          <div className="pt-10 flex justify-between w-full max-w-3xl relative z-10 text-left">
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-widest text-foreground">Certificate No:</p>
              <p className="text-sm font-bold font-mono text-primary">{cert.certificate_no}</p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-xs font-black uppercase tracking-widest text-foreground">Date of Issue:</p>
              <p className="text-sm font-bold text-muted-foreground">{format(new Date(cert.issued_on), "dd MMMM yyyy")}</p>
            </div>
          </div>

          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 opacity-20 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <p className="text-[8px] font-black uppercase tracking-[0.4em]">Digitally Verified System Document</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TypingCertificatePage;
