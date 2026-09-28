import { useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, Search, Download, ShieldAlert, ShieldCheck, Filter, FileText, School, User, RefreshCw, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, apiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface IssuedDocument {
  _id: string;
  certificate_no: string;
  document_type?: string;
  recipient_type?: "student" | "center" | "staff";
  recipient_name?: string;
  course?: string;
  center_name?: string;
  issued_on?: string;
  status?: string; // "issued" | "revoked"
  verification_code?: string;
  student_id?: any;
}

const toId = (v: any): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "$oid" in v) return v.$oid;
  return String(v || "");
};

const AttachmentListCertificatesPage = () => {
  const [documents, setDocuments] = useState<IssuedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "student" | "center" | "staff">("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "issued" | "revoked">("all");
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch("/api/certificates", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        const normalized: IssuedDocument[] = list.map((item: any) => ({
          _id: toId(item._id || item.id),
          certificate_no: item.certificate_no || item.certificate_number || `DOC-${toId(item._id).slice(-6)}`,
          document_type: item.document_type || (item.course ? "Course Completion Certificate" : "Franchise Authorization"),
          recipient_type: item.recipient_type || (item.staff_id ? "staff" : item.course ? "student" : "center"),
          recipient_name: item.student_name || item.recipient_name || item.name || "N/A",
          course: item.course || "—",
          center_name: item.center_name || "Headquarters",
          issued_on: item.issued_on || item.created_at || new Date().toISOString(),
          status: item.status === "revoked" || item.is_revoked ? "revoked" : "issued",
          verification_code: item.verification_code || item.certificate_no || toId(item._id),
        }));
        setDocuments(normalized);
      } else {
        toast.error("Failed to load issued documents");
      }
    } catch {
      toast.error("Network error while loading documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      if (activeTab !== "all" && doc.recipient_type !== activeTab) return false;
      if (statusFilter !== "all" && doc.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesNo = doc.certificate_no.toLowerCase().includes(q);
        const matchesName = (doc.recipient_name || "").toLowerCase().includes(q);
        const matchesCourse = (doc.course || "").toLowerCase().includes(q);
        const matchesCenter = (doc.center_name || "").toLowerCase().includes(q);
        if (!matchesNo && !matchesName && !matchesCourse && !matchesCenter) return false;
      }
      return true;
    });
  }, [documents, activeTab, statusFilter, search]);

  const toggleRevoke = async (docId: string, currentStatus: string) => {
    setRevokingId(docId);
    const newStatus = currentStatus === "revoked" ? "issued" : "revoked";
    try {
      const res = await apiFetch(`/api/certificates/${docId}/toggle-revoke`, {
        method: "POST",
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        toast.success(`Document ${newStatus === "revoked" ? "revoked / invalidated" : "reactivated"} successfully!`);
        setDocuments(prev => prev.map(d => d._id === docId ? { ...d, status: newStatus } : d));
      } else {
        toast.error("Failed to update status");
      }
    } catch {
      toast.error("Error updating document status");
    } finally {
      setRevokingId(null);
    }
  };

  const handleDownload = async (docId: string, certNo: string) => {
    setDownloadingId(docId);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(apiUrl(`/certificates/download/${docId}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Document_${certNo}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success("Download started");
      } else {
        toast.error("Failed to download PDF document");
      }
    } catch {
      toast.error("Error downloading document");
    } finally {
      setDownloadingId(null);
    }
  };

  const totalCount = documents.length;
  const studentCount = documents.filter(d => d.recipient_type === "student").length;
  const centerCount = documents.filter(d => d.recipient_type === "center").length;
  const staffCount = documents.filter(d => d.recipient_type === "staff").length;
  const revokedCount = documents.filter(d => d.status === "revoked").length;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary/80 mb-1">
              <Award className="w-4 h-4" />
              Attachments & Document Registry
            </div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
              Master Issued Documents Log
            </h1>
            <p className="text-muted-foreground text-sm font-medium mt-1">
              Central audit repository of all generated certificates, marksheets, center licenses, and staff letters.
            </p>
          </div>
          <Button onClick={loadData} variant="outline" className="rounded-none border-border font-bold uppercase text-xs tracking-wider">
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            Refresh Log
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="rounded-none border-border bg-card shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Issued</span>
              <span className="text-2xl font-black text-foreground mt-1">{totalCount}</span>
            </CardContent>
          </Card>
          <Card className="rounded-none border-border bg-card shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Student Docs</span>
              <span className="text-2xl font-black text-foreground mt-1">{studentCount}</span>
            </CardContent>
          </Card>
          <Card className="rounded-none border-border bg-card shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Center Certs</span>
              <span className="text-2xl font-black text-foreground mt-1">{centerCount}</span>
            </CardContent>
          </Card>
          <Card className="rounded-none border-border bg-card shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400">Staff Letters</span>
              <span className="text-2xl font-black text-foreground mt-1">{staffCount}</span>
            </CardContent>
          </Card>
          <Card className="rounded-none border-border bg-card shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">Revoked / Invalid</span>
              <span className="text-2xl font-black text-rose-600 mt-1">{revokedCount}</span>
            </CardContent>
          </Card>
        </div>

        {/* Tab & Filters */}
        <Card className="rounded-none border-border shadow-sm bg-muted/20">
          <CardContent className="p-6 space-y-4">
            
            {/* Category Tabs */}
            <div className="flex border-b border-border gap-2">
              <button
                onClick={() => setActiveTab("all")}
                className={cn(
                  "px-4 py-2 text-xs font-black uppercase tracking-wider transition-all border-b-2",
                  activeTab === "all" ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                All Documents ({totalCount})
              </button>
              <button
                onClick={() => setActiveTab("student")}
                className={cn(
                  "px-4 py-2 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5",
                  activeTab === "student" ? "border-blue-600 text-blue-600 bg-blue-500/5" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <User className="w-3.5 h-3.5" />
                Student Documents
              </button>
              <button
                onClick={() => setActiveTab("center")}
                className={cn(
                  "px-4 py-2 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5",
                  activeTab === "center" ? "border-emerald-600 text-emerald-600 bg-emerald-500/5" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <School className="w-3.5 h-3.5" />
                Center Certificates
              </button>
              <button
                onClick={() => setActiveTab("staff")}
                className={cn(
                  "px-4 py-2 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5",
                  activeTab === "staff" ? "border-violet-600 text-violet-600 bg-violet-500/5" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <FileText className="w-3.5 h-3.5" />
                Staff Letters & Payslips
              </button>
            </div>

            {/* Search & Status Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Search Registry</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search Document No, Student/Staff Name, Course, Center..."
                    className="pl-10 rounded-none border-border bg-background text-sm"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status Filter</label>
                <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                  <SelectTrigger className="rounded-none border-border bg-background text-xs">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Documents</SelectItem>
                    <SelectItem value="issued">Active / Valid</SelectItem>
                    <SelectItem value="revoked">Revoked / Invalid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Audit Log Table */}
        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/40 border-b border-border py-4">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" />
              Document Master Log ({filteredDocs.length} entries)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted/60">
                    <th className="px-6 py-3 border-b border-border">S.No.</th>
                    <th className="px-6 py-3 border-b border-border">Document No</th>
                    <th className="px-6 py-3 border-b border-border">Recipient</th>
                    <th className="px-6 py-3 border-b border-border">Type / Course</th>
                    <th className="px-6 py-3 border-b border-border">Center</th>
                    <th className="px-6 py-3 border-b border-border">Issued On</th>
                    <th className="px-6 py-3 border-b border-border">Status</th>
                    <th className="px-6 py-3 border-b border-border text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Loading audit log...</span>
                      </td>
                    </tr>
                  ) : filteredDocs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        No documents found matching the criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredDocs.map((doc, idx) => (
                      <tr key={doc._id || idx} className={cn("hover:bg-primary/5 transition-colors", doc.status === "revoked" && "bg-rose-500/5")}>
                        <td className="px-6 py-4 font-mono text-muted-foreground">{idx + 1}</td>
                        <td className="px-6 py-4 font-mono font-bold text-primary">{doc.certificate_no}</td>
                        <td className="px-6 py-4 font-bold text-foreground">{doc.recipient_name}</td>
                        <td className="px-6 py-4 font-medium text-muted-foreground">{doc.course}</td>
                        <td className="px-6 py-4 text-muted-foreground">{doc.center_name}</td>
                        <td className="px-6 py-4 text-muted-foreground font-mono">
                          {new Date(doc.issued_on || "").toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          {doc.status === "revoked" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-600 border border-rose-500/30">
                              <XCircle className="w-3 h-3" />
                              Revoked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-600 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-none h-8 px-3 text-[10px] font-bold uppercase tracking-wider border-border"
                            onClick={() => handleDownload(doc._id, doc.certificate_no)}
                            disabled={downloadingId === doc._id}
                          >
                            {downloadingId === doc._id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Download className="w-3 h-3 mr-1" />}
                            PDF
                          </Button>
                          <Button
                            size="sm"
                            variant={doc.status === "revoked" ? "default" : "destructive"}
                            className="rounded-none h-8 px-3 text-[10px] font-bold uppercase tracking-wider"
                            onClick={() => toggleRevoke(doc._id, doc.status || "issued")}
                            disabled={revokingId === doc._id}
                          >
                            {revokingId === doc._id ? (
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            ) : doc.status === "revoked" ? (
                              <ShieldCheck className="w-3 h-3 mr-1" />
                            ) : (
                              <ShieldAlert className="w-3 h-3 mr-1" />
                            )}
                            {doc.status === "revoked" ? "Reactivate" : "Revoke"}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AttachmentListCertificatesPage;
