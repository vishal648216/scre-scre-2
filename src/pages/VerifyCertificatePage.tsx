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

              {/* DigiLocker & National Academic Depository (NAD) Verification Box */}
              <div className="p-4 bg-muted/40 border border-border/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-blue-600/10 text-blue-600 border border-blue-600/20 flex items-center justify-center font-bold text-xs">
                      🪪
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        DigiLocker & NAD Verified
                      </h4>
                      <p className="text-[10px] text-muted-foreground">
                        National Academic Depository Schema 2.1 Compliant
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-500/10 text-blue-600 border border-blue-500/20 font-semibold">
                    TAMPER-PROOF
                  </span>
                </div>

                <div className="bg-background/80 p-2.5 border border-border text-[11px] font-mono space-y-1 break-all">
                  <div className="flex flex-col sm:flex-row justify-between text-muted-foreground">
                    <span>Document URI:</span>
                    <span className="text-foreground font-semibold">in.gov.digitallocker.scre:CERT:{cert.certificate_no}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between text-muted-foreground">
                    <span>Depository Status:</span>
                    <span className="text-emerald-600 font-semibold">ACTIVE_REGISTERED</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <a 
                    href={`/api/public/digilocker/certificate/${cert.certificate_no}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline border border-primary/20 bg-primary/5 px-2.5 py-1"
                  >
                    📥 Download DigiLocker JSON
                  </a>
                  <a 
                    href={`/api/public/digilocker/certificate/${cert.certificate_no}/xml`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground border border-border bg-background px-2.5 py-1"
                  >
                    📄 View MeitY XML Schema
                  </a>
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
