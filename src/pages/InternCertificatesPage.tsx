
import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api";

const InternCertificatesPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [certificates, setCertificates] = useState<any[]>([]);

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/certificates/my");
      const data = await response.json();
      if (response.ok) {
        setCertificates(data);
      }
    } catch (error) {
      console.error("Error fetching certificates:", error);
      toast.error("Failed to load certificates");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">{t("My Certificates")}</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">{t("View and download your certificates.")}</p>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : certificates.length === 0 ? (
          <div className="p-12 text-center border border-border bg-card">
            <Award className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm font-medium text-muted-foreground">{t("No certificates issued yet.")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certificates.map((cert, index) => (
              <Card key={index} className="rounded-none border-border shadow-sm">
                <CardHeader className="bg-muted/30 border-b border-border py-4 px-6">
                  <div className="flex items-center gap-3">
                    <Award className="w-5 h-5 text-primary" />
                    <CardTitle className="text-sm font-black uppercase tracking-widest">{cert.certificate_name || t("Certificate")}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-2 text-sm">
                    {cert.certificate_no && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-bold">{t("Certificate No")}:</span>
                        <span>{cert.certificate_no}</span>
                      </div>
                    )}
                    {cert.issued_on && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-bold">{t("Issued On")}:</span>
                        <span>{new Date(cert.issued_on).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  {cert.download_url && (
                    <button className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all">
                      <Download className="w-4 h-4" />
                      {t("Download Certificate")}
                    </button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default InternCertificatesPage;
