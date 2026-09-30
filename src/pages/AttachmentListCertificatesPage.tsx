import { useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Award,
  Search,
  Download,
  ShieldAlert,
  ShieldCheck,
  Filter,
  FileText,
  School,
  User,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Send,
  PlusCircle,
  Clock,
  Archive,
  FileQuestion,
  BellRing,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, apiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn, toId } from "@/lib/utils";

interface VaultDocument {
  _id: string;
  certificate_no: string;
  document_name: string;
  recipient_type: "student" | "center" | "staff";
  recipient_name: string;
  center_name: string;
  submitted_date: string;
  borrowed_date?: string;
  expected_return_date?: string;
  status: "in_vault" | "borrowed_pending_return" | "overdue" | "missing_requested";
  notes?: string;
}

export default function AttachmentListCertificatesPage() {
  const [documents, setDocuments] = useState<VaultDocument[]>([
    {
      _id: "DOC-VLT-101",
      certificate_no: "DOC-2026-001",
      document_name: "Original 10th & 12th Marksheet",
      recipient_type: "student",
      recipient_name: "Amitabh Roy",
      center_name: "SCRE Delhi HQ Center",
      submitted_date: "2026-08-10",
      borrowed_date: "2026-09-18",
      expected_return_date: "2026-09-25",
      status: "overdue",
      notes: "Taken for government verification clearance.",
    },
    {
      _id: "DOC-VLT-102",
      certificate_no: "DOC-2026-002",
      document_name: "Franchise Premises Lease Agreement",
      recipient_type: "center",
      recipient_name: "SCRE Jaipur Branch (Rakesh Verma)",
      center_name: "SCRE Jaipur Skill Center",
      submitted_date: "2026-07-01",
      status: "in_vault",
      notes: "Original notarized agreement safe in central vault.",
    },
    {
      _id: "DOC-VLT-103",
      certificate_no: "DOC-2026-003",
      document_name: "B.Tech Graduation Certificate",
      recipient_type: "staff",
      recipient_name: "Sunita Deshmukh (Faculty)",
      center_name: "Headquarters Academic Division",
      submitted_date: "2026-08-01",
      borrowed_date: "2026-09-20",
      expected_return_date: "2026-10-05",
      status: "borrowed_pending_return",
      notes: "Borrowed for university audit inspection.",
    },
    {
      _id: "DOC-VLT-104",
      certificate_no: "DOC-2026-004",
      document_name: "Aadhar & PAN Verification Document",
      recipient_type: "student",
      recipient_name: "Mohit Choudhary",
      center_name: "SCRE Delhi HQ Center",
      submitted_date: "2026-09-01",
      status: "missing_requested",
      notes: "Pending resubmission. Request notice dispatched.",
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "student" | "center" | "staff">("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [centerFilter, setCenterFilter] = useState<string>("all");

  // Request Document Dialog
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [requestRecipientType, setRequestRecipientType] = useState<"student" | "center" | "staff">("student");
  const [requestRecipientName, setRequestRecipientName] = useState("");
  const [requestCenterName, setRequestCenterName] = useState("");
  const [requestDocName, setRequestDocName] = useState("");
  const [returnDeadline, setReturnDeadline] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch("/api/certificates", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const apiDocs: VaultDocument[] = data.map((item: any) => ({
            _id: toId(item._id || item.id),
            certificate_no: item.certificate_no || item.certificate_number || `DOC-${toId(item._id).slice(-6)}`,
            document_name: item.document_name || item.course || "Course Certificate / Document",
            recipient_type: item.recipient_type || (item.staff_id ? "staff" : item.course ? "student" : "center"),
            recipient_name: item.student_name || item.recipient_name || item.name || "N/A",
            center_name: item.center_name || "Headquarters",
            submitted_date: item.issued_on || item.created_at || new Date().toISOString().slice(0, 10),
            status: item.is_borrowed ? "borrowed_pending_return" : item.status === "revoked" ? "missing_requested" : "in_vault",
            notes: item.notes || "Official document registry record",
          }));
          setDocuments(apiDocs);
        }
      }
    } catch {
      // keep fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSendRequestNotice = async () => {
    if (!requestRecipientName.trim() || !requestDocName.trim()) {
      toast.error("Please enter recipient name and document name.");
      return;
    }

    setSubmittingRequest(true);
    try {
      const newDoc: VaultDocument = {
        _id: `DOC-REQ-${Date.now().toString().slice(-6)}`,
        certificate_no: `REQ-${Math.floor(1000 + Math.random() * 9000)}`,
        document_name: requestDocName.trim(),
        recipient_type: requestRecipientType,
        recipient_name: requestRecipientName.trim(),
        center_name: requestCenterName.trim() || "Headquarters Center",
        submitted_date: new Date().toISOString().slice(0, 10),
        expected_return_date: returnDeadline || undefined,
        status: "missing_requested",
        notes: requestNotes.trim() || "Document return / submission requested by admin.",
      };

      setDocuments([newDoc, ...documents]);
      toast.success(`Document request notice dispatched to ${requestRecipientName}!`);
      setIsRequestDialogOpen(false);
      setRequestRecipientName("");
      setRequestDocName("");
      setRequestCenterName("");
      setReturnDeadline("");
      setRequestNotes("");
    } catch {
      toast.error("Failed to dispatch document request");
    } finally {
      setSubmittingRequest(false);
    }
  };

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      if (activeTab !== "all" && doc.recipient_type !== activeTab) return false;
      if (statusFilter !== "all" && doc.status !== statusFilter) return false;
      if (centerFilter !== "all" && !doc.center_name.toLowerCase().includes(centerFilter.toLowerCase())) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesNo = doc.certificate_no.toLowerCase().includes(q);
        const matchesName = doc.recipient_name.toLowerCase().includes(q);
        const matchesDoc = doc.document_name.toLowerCase().includes(q);
        const matchesCenter = doc.center_name.toLowerCase().includes(q);
        if (!matchesNo && !matchesName && !matchesDoc && !matchesCenter) return false;
      }
      return true;
    });
  }, [documents, activeTab, statusFilter, centerFilter, search]);

  const inVaultCount = documents.filter(d => d.status === "in_vault").length;
  const borrowedCount = documents.filter(d => d.status === "borrowed_pending_return").length;
  const overdueCount = documents.filter(d => d.status === "overdue").length;
  const missingCount = documents.filter(d => d.status === "missing_requested").length;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary/80 mb-1">
              <Archive className="w-4 h-4" />
              Document Vault & Physical Inventory Tracking Hub
            </div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
              Center, Student & Staff Document Tracker
            </h1>
            <p className="text-muted-foreground text-sm font-medium mt-1">
              Track submitted documents in central vault, manage borrowed original certificates, and send return request notices.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={loadData} variant="outline" className="rounded-none border-border font-bold uppercase text-xs tracking-wider h-11">
              <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button
              onClick={() => setIsRequestDialogOpen(true)}
              className="rounded-none font-bold uppercase text-xs tracking-wider px-6 h-11 shadow-lg"
            >
              <Send className="w-4 h-4 mr-2" />
              Request Document / Send Return Notice
            </Button>
          </div>
        </div>

        {/* Stats Summary Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="rounded-none border-border bg-card shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">In Central Vault</span>
              <span className="text-2xl font-black text-foreground mt-1">{inVaultCount}</span>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border bg-card shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Issued / Taken (Borrowed)</span>
              <span className="text-2xl font-black text-foreground mt-1">{borrowedCount}</span>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border bg-card shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">Overdue Returns</span>
              <span className="text-2xl font-black text-rose-600 mt-1">{overdueCount}</span>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border bg-card shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Missing / Requested</span>
              <span className="text-2xl font-black text-foreground mt-1">{missingCount}</span>
            </CardContent>
          </Card>
        </div>

        {/* Filters Bar */}
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
                All Vault Records ({documents.length})
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
                Center Agreements & Licenses
              </button>
              <button
                onClick={() => setActiveTab("staff")}
                className={cn(
                  "px-4 py-2 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5",
                  activeTab === "staff" ? "border-violet-600 text-violet-600 bg-violet-500/5" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <FileText className="w-3.5 h-3.5" />
                Staff Qualification Docs
              </button>
            </div>

            {/* Search & Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search Document Name, Recipient Name, Center, or Ref No..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 rounded-none border-border bg-background text-sm"
                />
              </div>

              <div className="space-y-1">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="rounded-none border-border bg-background text-xs h-10">
                    <SelectValue placeholder="Filter Vault Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vault Statuses</SelectItem>
                    <SelectItem value="in_vault">In Vault / Submitted</SelectItem>
                    <SelectItem value="borrowed_pending_return">Borrowed / Taken Away</SelectItem>
                    <SelectItem value="overdue">Overdue Return</SelectItem>
                    <SelectItem value="missing_requested">Missing / Request Sent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Master Table */}
        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/40 border-b border-border py-4">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <Archive className="w-4 h-4 text-primary" />
              Document Vault & Return Tracking Log ({filteredDocs.length} entries)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/60 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border">
                    <th className="py-4 px-6">Doc Ref</th>
                    <th className="py-4 px-6">Document Title</th>
                    <th className="py-4 px-6">Recipient Name</th>
                    <th className="py-4 px-6">Center Name</th>
                    <th className="py-4 px-6">Submitted Date</th>
                    <th className="py-4 px-6">Return Deadline</th>
                    <th className="py-4 px-6">Vault Status</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Loading vault logs...</span>
                      </td>
                    </tr>
                  ) : filteredDocs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        No vault document records found.
                      </td>
                    </tr>
                  ) : (
                    filteredDocs.map((doc) => (
                      <tr key={doc._id} className="hover:bg-primary/5 transition-colors">
                        <td className="py-4 px-6 font-mono font-bold text-primary">{doc.certificate_no}</td>
                        <td className="py-4 px-6 font-bold text-foreground">{doc.document_name}</td>
                        <td className="py-4 px-6 font-bold text-foreground uppercase">{doc.recipient_name}</td>
                        <td className="py-4 px-6 text-muted-foreground">{doc.center_name}</td>
                        <td className="py-4 px-6 font-mono text-muted-foreground">{doc.submitted_date}</td>
                        <td className="py-4 px-6 font-mono font-bold text-amber-600">
                          {doc.expected_return_date || "N/A (Vault)"}
                        </td>
                        <td className="py-4 px-6">
                          {doc.status === "in_vault" && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 px-2.5 py-1">
                              <ShieldCheck className="w-3 h-3" /> In Vault
                            </span>
                          )}
                          {doc.status === "borrowed_pending_return" && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-600 border border-blue-500/30 px-2.5 py-1">
                              <Clock className="w-3 h-3" /> Borrowed / Taken
                            </span>
                          )}
                          {doc.status === "overdue" && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-rose-500/20 text-rose-600 border border-rose-500/40 px-2.5 py-1">
                              <AlertTriangle className="w-3 h-3" /> Overdue Return
                            </span>
                          )}
                          {doc.status === "missing_requested" && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-600 border border-amber-500/30 px-2.5 py-1">
                              <BellRing className="w-3 h-3" /> Notice Dispatched
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-none h-8 px-3 text-[10px] font-bold uppercase tracking-wider border-border"
                            onClick={() => {
                              toast.success(`Return reminder notice sent to ${doc.recipient_name}!`);
                              setDocuments(prev => prev.map(d => d._id === doc._id ? { ...d, status: "missing_requested" } : d));
                            }}
                          >
                            <Send className="w-3 h-3 mr-1" /> Send Return Reminder
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

        {/* Modal: Request Document / Send Return Notice */}
        <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
          <DialogContent className="rounded-none border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading font-extrabold text-xl uppercase">Request Document / Send Return Notice</DialogTitle>
              <p className="text-xs text-muted-foreground">Notify student, staff or center to submit or return borrowed physical documents.</p>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Recipient Role</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRequestRecipientType("student")}
                    className={cn(
                      "py-2.5 text-xs font-black uppercase tracking-wider border text-center transition-all",
                      requestRecipientType === "student" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
                    )}
                  >
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestRecipientType("center")}
                    className={cn(
                      "py-2.5 text-xs font-black uppercase tracking-wider border text-center transition-all",
                      requestRecipientType === "center" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
                    )}
                  >
                    Center
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestRecipientType("staff")}
                    className={cn(
                      "py-2.5 text-xs font-black uppercase tracking-wider border text-center transition-all",
                      requestRecipientType === "staff" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
                    )}
                  >
                    Staff
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Recipient Name</label>
                <Input
                  placeholder="Enter full name of student/staff/center..."
                  value={requestRecipientName}
                  onChange={(e) => setRequestRecipientName(e.target.value)}
                  className="rounded-none border-border"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Document Title Requested</label>
                <Input
                  placeholder="e.g. Original 10th Marksheet, Aadhar Copy, Lease Agreement"
                  value={requestDocName}
                  onChange={(e) => setRequestDocName(e.target.value)}
                  className="rounded-none border-border"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Associated Center</label>
                  <Input
                    placeholder="e.g. SCRE Delhi HQ"
                    value={requestCenterName}
                    onChange={(e) => setRequestCenterName(e.target.value)}
                    className="rounded-none border-border"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Return / Submission Deadline</label>
                  <Input
                    type="date"
                    value={returnDeadline}
                    onChange={(e) => setReturnDeadline(e.target.value)}
                    className="rounded-none border-border"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Request Note / Remarks</label>
                <Input
                  placeholder="e.g. Please submit original documents for verification before exam date."
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  className="rounded-none border-border"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" className="rounded-none font-bold uppercase text-xs" onClick={() => setIsRequestDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendRequestNotice} disabled={submittingRequest} className="rounded-none font-bold uppercase text-xs px-6">
                {submittingRequest ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Send className="w-3.5 h-3.5 mr-2" />}
                Dispatch Request Notice
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
