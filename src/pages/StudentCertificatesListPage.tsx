import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Award, Loader2, Eye, Download, Clock, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const toId = (v: any): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "$oid" in v) return v.$oid;
  return String(v || "");
};

const StatusBadge = ({ status }: { status?: string }) => {
  const { t } = useTranslation();
  const s = (status || "").toLowerCase();
  if (s === 'approved' || s === 'issued') {
    return (
      <div className="flex items-center gap-1.5 text-green-600">
        <CheckCircle className="w-3.5 h-3.5" />
        <p className="text-[10px] uppercase font-bold tracking-widest">{t("Issued")}</p>
      </div>
    );
  }
  if (s === 'scheduled') {
    return (
      <div className="flex items-center gap-1.5 text-amber-600">
        <Clock className="w-3.5 h-3.5" />
        <p className="text-[10px] uppercase font-bold tracking-widest">{t("Scheduled")}</p>
      </div>
    );
  }
  if (s === 'pending_approval') {
    return (
      <div className="flex items-center gap-1.5 text-gray-500">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <p className="text-[10px] uppercase font-bold tracking-widest">{t("Pending Approval")}</p>
      </div>
    );
  }
  return null;
};


const StudentCertificatesListPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  interface Cert {
    _id: string;
    course_name?: string;
    course?: string;
    issued_on?: string;
    issued_at?: string;
    status?: string;
    certificate_no?: string;
  }
  const [certs, setCerts] = useState<Cert[]>([]);
  const [selected, setSelected] = useState<Cert | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [search, setSearch] = useState("");

  const handleDownload = async (certId: string, certNo: string) => {
    setDownloading(certId);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/certificates/download/${certId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${certNo}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        toast.error("Download failed. The file may not be ready or an error occurred.");
      }
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloading(null);
    }
  };

  useEffect(() => {
    fetch("/api/certificates", { headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` } })
      .then((r) => r.json())
      .then((d) => setCerts(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredCerts = certs.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.course_name || c.course || "").toLowerCase().includes(q) ||
      (c.certificate_no || "").toLowerCase().includes(q)
    );
  });

  const handleDownloadAll = async () => {
    const issued = filteredCerts.filter(
      (c) => (c.status || "").toLowerCase() === "approved" || (c.status || "").toLowerCase() === "issued"
    );
    if (issued.length === 0) {
      toast.error("No issued certificates to download.");
      return;
    }
    setBulkDownloading(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch("/api/certificates/download-bulk", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          certificate_ids: issued.map((c) => toId(c._id)),
        }),
      });
      if (!res.ok) {
        toast.error("Download failed. The file may not be ready or an error occurred.");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `My_Certificates_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      toast.error("Download failed");
    } finally {
      setBulkDownloading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
              {t("My Certificates")}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              {t("Certificates issued to you.")}
            </p>
          </div>
          {certs.length > 0 && (
            <div className="flex flex-col md:flex-row gap-2 md:items-center">
              <div className="relative">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("Search by course or certificate no...")}
                  className="w-full md:w-64 px-3 py-2 border border-border bg-background rounded-none text-xs font-bold uppercase tracking-widest focus:border-primary outline-none"
                />
              </div>
              <button
                onClick={handleDownloadAll}
                disabled={bulkDownloading || filteredCerts.length === 0}
                className="px-4 py-2 rounded-none bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {bulkDownloading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Download className="w-3 h-3" />
                )}
                {t("Download All (Single PDF)")}
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredCerts.length === 0 ? (
          <Card className="rounded-none border-border">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Award className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t("No certificates issued yet.")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredCerts.map((c) => (
              <Card key={toId(c._id)} className="rounded-none border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Award className="w-8 h-8 text-primary" />
                      <div>
                        <p className="font-bold">{t(c.course_name || c.course || "Certificate")}</p>
                        <p className="text-sm text-muted-foreground">
                          {c.issued_on
                            ? new Date(c.issued_on).toLocaleDateString()
                            : c.issued_at
                            ? new Date(c.issued_at).toLocaleDateString()
                            : ""}
                        </p>
                        <div className="mt-2">
                          <StatusBadge status={c.status} />
                        </div>
                      </div>
                    </div>
                    <button
                      className="p-2 rounded-none hover:bg-muted text-xs font-bold uppercase tracking-widest flex items-center gap-1"
                      onClick={() => {
                        if (c.status === 'approved' || c.status === 'issued') {
                          handleDownload(toId(c._id), c.certificate_no || 'certificate');
                        } else {
                          setSelected(c);
                        }
                      }}
                      disabled={downloading === toId(c._id)}
                    >
                      {downloading === toId(c._id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : c.status === 'approved' || c.status === 'issued' ? (
                        <>
                          <Download className="w-4 h-4" />
                          {t("Download")}
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" />
                          {t("View")}
                        </>
                      )}
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-background max-w-2xl w-full mx-4 rounded-none border border-border shadow-2xl">
            <div className="border-b border-border px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight">
                  {t("Certificate Preview")}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t("View-only preview. Final printing is handled by the admin.")}
                </p>
              </div>
              <button
                className="text-xs font-black uppercase tracking-widest px-3 py-1 border border-border hover:bg-muted"
                onClick={() => setSelected(null)}
              >
                {t("Close")}
              </button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm">
                <span className="font-bold">{t("Course")}:</span> {t(selected.course_name || selected.course || "Certificate")}
              </p>
              <p className="text-sm">
                <span className="font-bold">{t("Certificate No")}:</span> {selected.certificate_no || "N/A"}
              </p>
              <p className="text-sm">
                <span className="font-bold">{t("Issued On")}:</span>{" "}
                {selected.issued_on
                  ? new Date(selected.issued_on).toLocaleDateString()
                  : selected.issued_at
                  ? new Date(selected.issued_at).toLocaleDateString()
                  : "N/A"}
              </p>
              {selected.status && (
                <p className="text-sm">
                  <span className="font-bold">{t("Status")}:</span> {t(selected.status)}
                </p>
              )}
              <p className="text-xs text-muted-foreground pt-2">
                {t("Note: This is a digital preview. Signed/stamped certificates are printed and provided by the admin. Students cannot download directly from here.")}
              </p>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default StudentCertificatesListPage;
