import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, XCircle, CheckCircle2, Loader2, User, BookOpen, Calendar, Award } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";

/**
 * Public verification page: /verify/:registration_number or /verify-certificate/:id
 * QR codes on certificates link here for verification.
 */
export default function VerifyCertificatePage() {
  const { t } = useTranslation();
  const { registration_number, id } = useParams<{ registration_number?: string; id?: string }>();
  const [cert, setCert] = useState<any>(null);
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verify = async () => {
      if (!registration_number && !id) return;
      try {
        let endpoint: string;
        if (id) {
          endpoint = `/api/public/verify-certificate/${id}`;
        } else if (registration_number) {
          endpoint = `/api/public/verify/${registration_number}`;
        } else {
          return;
        }
        const res = await apiFetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          if (data.certificate) {
            setCert(data.certificate);
            setStudent(data.student);
          } else {
            setCert(data);
          }
        } else if (res.status === 404) {
          setError(t("Certificate not found or not yet approved."));
        } else {
          setError(t("Verification service currently unavailable."));
        }
      } catch (err) {
        setError(t("Failed to connect to verification server."));
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, [registration_number, id, t]);

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
      <Card className="rounded-none border-border max-w-lg w-full shadow-2xl overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground py-6 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-white/20 rounded-full flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="font-heading font-black text-xl uppercase tracking-widest">
            {t("SCRE Verification")}
          </CardTitle>
        </CardHeader>

        <CardContent className="p-8">
          {loading ? (
            <div className="text-center py-10 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                {t("Authenticating Credentials...")}
              </p>
            </div>
          ) : error ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground uppercase tracking-tight">{t("Verification Failed")}</h2>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed">
                {t("Please ensure the registration number is correct or contact your study center for assistance.")}
              </p>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-100 text-green-800">
                <CheckCircle2 className="w-6 h-6 shrink-0" />
                <div>
                  <p className="text-xs font-black uppercase tracking-widest">{t("Status: Verified")}</p>
                  <p className="text-[10px] opacity-80">{t("This document is authentic and registered in our database.")}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <Award className="w-3 h-3" /> {t("Certificate No.")}
                  </p>
                  <p className="text-sm font-bold uppercase">{cert.certificate_no}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <User className="w-3 h-3" /> {t("Student Name")}
                  </p>
                  <p className="text-sm font-bold uppercase">{student ? student.full_name || student.username : (cert.student_name || "Official Candidate")}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <User className="w-3 h-3" /> {t("Father Name")}
                  </p>
                  <p className="text-sm font-bold uppercase">{student ? (student.father_name || "-") : "-"}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {t("Date of Birth")}
                  </p>
                  <p className="text-sm font-bold uppercase">
                    {student && student.dob
                      ? new Date(student.dob).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
                      : "-"}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <BookOpen className="w-3 h-3" /> {t("Course")}
                  </p>
                  <p className="text-sm font-bold uppercase">{t(cert.course)}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {t("Issued On")}
                  </p>
                  <p className="text-sm font-bold uppercase">
                    {new Date(cert.issued_on).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <User className="w-3 h-3" /> {t("Enrollment Number")}
                  </p>
                  <p className="text-sm font-bold uppercase">{student ? student.enrollment_number || "-" : "-"}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <User className="w-3 h-3" /> {t("Serial Number")}
                  </p>
                  <p className="text-sm font-bold uppercase">{student ? (student.serial_number || "-") : "-"}</p>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <User className="w-3 h-3" /> {t("Registration Number")}
                  </p>
                  <p className="text-sm font-bold uppercase">{student ? student.username : "-"}</p>
                </div>
              </div>

              <div className="pt-6 border-t border-border text-center">
                <p className="text-[9px] text-muted-foreground font-medium leading-relaxed">
                  © {new Date().getFullYear()} {t("SIR CHHOTU RAM EDUCATION PVT. LTD.")}<br />
                  {t("AN ISO 9001-2015 CERTIFIED ORGANIZATION")}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
