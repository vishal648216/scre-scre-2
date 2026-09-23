import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileText, Download, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

const toId = (v: any): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "$oid" in v) return v.$oid;
  return String(v || "");
};

interface Certificate {
  _id: string;
  certificate_no: string;
  file_path?: string;
  status?: string;
  certificate_type?: "certificate" | "marksheet" | "Certificate" | "Marksheet";
  course?: string;
  attempt_number?: number;
  issued_on?: string;
}

const MarksheetPage = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [marksheets, setMarksheets] = useState<Certificate[]>([]);
  const [activeTab, setActiveTab] = useState("marksheets");

  const fetchDocuments = useCallback(async () => {
    if (!studentId) {
      toast.error("Student ID is missing.");
      navigate("/dashboard/student/exams");
      return;
    }

    setLoading(true);
    try {
      const certsRes = await apiFetch("/api/certificates");
      if (certsRes.ok) {
        const certs: Certificate[] = await certsRes.json();
        const approved = certs.filter(c => c.status === "approved" || c.status === "issued");
        
        const ms = approved.filter(c => 
          c.certificate_type?.toLowerCase() === "marksheet"
        ).sort((a, b) => new Date(b.issued_on || 0).getTime() - new Date(a.issued_on || 0).getTime());
        
        const cert = approved.filter(c => 
          c.certificate_type?.toLowerCase() === "certificate"
        ).sort((a, b) => new Date(b.issued_on || 0).getTime() - new Date(a.issued_on || 0).getTime());
        
        setMarksheets(ms);
        setCertificates(cert);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast.error("An error occurred while fetching documents.");
    } finally {
      setLoading(false);
    }
  }, [studentId, navigate]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleDownload = async (doc: Certificate, type: "certificate" | "marksheet") => {
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/certificates/download/${toId(doc._id)}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${type.charAt(0).toUpperCase() + type.slice(1)}_${doc.certificate_no}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        toast.error(`Failed to download ${type}.`);
      }
    } catch {
      toast.error("Download failed");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <Link to="/dashboard/student/exams">
            <Button
              variant="ghost"
              className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary flex items-center gap-2 px-0"
            >
              <ArrowLeft className="w-3 h-3" /> Back to Exams
            </Button>
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-800">My Documents</h1>

        <Tabs defaultValue="marksheets" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="marksheets">Marksheets</TabsTrigger>
            <TabsTrigger value="certificates">Certificates</TabsTrigger>
          </TabsList>
          
          <TabsContent value="marksheets" className="space-y-4 mt-6">
            {marksheets.length === 0 ? (
              <Card className="rounded-lg shadow-lg">
                <CardContent className="p-6">
                  <div className="text-center py-10">
                    <FileText className="w-24 h-24 mx-auto text-primary/40 mb-4" />
                    <p className="text-muted-foreground font-medium">
                      No marksheets generated yet. Please check back later.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              marksheets.map(ms => (
                <Card key={toId(ms._id)} className="rounded-lg shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-white p-6 rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl font-bold">
                        Academic Marksheet
                      </CardTitle>
                      <Button
                        onClick={() => handleDownload(ms, "marksheet")}
                        className="bg-white text-primary hover:bg-white/90 rounded-md font-bold flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" /> Download
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm">
                      <p>Certificate No: {ms.certificate_no}</p>
                      {ms.course && <p>Course: {ms.course}</p>}
                      {ms.attempt_number && <p>Attempt: {ms.attempt_number}</p>}
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="text-center py-6">
                      <FileText className="w-16 h-16 mx-auto text-primary/40 mb-2" />
                      <p className="text-muted-foreground font-medium">
                        Your marksheet has been generated successfully!
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
          
          <TabsContent value="certificates" className="space-y-4 mt-6">
            {certificates.length === 0 ? (
              <Card className="rounded-lg shadow-lg">
                <CardContent className="p-6">
                  <div className="text-center py-10">
                    <FileText className="w-24 h-24 mx-auto text-primary/40 mb-4" />
                    <p className="text-muted-foreground font-medium">
                      No certificates generated yet. Please check back later.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              certificates.map(cert => (
                <Card key={toId(cert._id)} className="rounded-lg shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-white p-6 rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl font-bold">
                        Academic Certificate
                      </CardTitle>
                      <Button
                        onClick={() => handleDownload(cert, "certificate")}
                        className="bg-white text-primary hover:bg-white/90 rounded-md font-bold flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" /> Download
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm">
                      <p>Certificate No: {cert.certificate_no}</p>
                      {cert.course && <p>Course: {cert.course}</p>}
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="text-center py-6">
                      <FileText className="w-16 h-16 mx-auto text-primary/40 mb-2" />
                      <p className="text-muted-foreground font-medium">
                        Your certificate has been generated successfully!
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default MarksheetPage;
