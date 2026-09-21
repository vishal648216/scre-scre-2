import { useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, CheckCircle2, Search, Loader2, Stamp, Filter, Calendar, School, UserCheck, Clock, Download } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Certificate {
  _id: string;
  student_id: string | { $oid: string };
  center_id: string | { $oid: string };
  course: string;
  certificate_no: string;
  issued_on: string;
  status?: string;
  signature_url?: string;
  stamp_url?: string;
  center_name?: string;
  template_id?: string | { $oid: string };
}

interface Template {
  _id: string | { $oid: string };
  template_name: string;
  template_type: string;
}

interface Center {
  _id: string | { $oid: string };
  name: string;
  code: string;
}

const toId = (v: any): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "$oid" in v) return v.$oid;
  return String(v || "");
};

const AdminCertificateApprovalPage = () => {
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState("");
  const [centerFilter, setCenterFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [issueMode, setIssueMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [processing, setProcessing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const [cRes, tRes, ctrRes] = await Promise.all([
        fetch("/api/certificates", { headers: { Authorization: `Bearer ${token}` } }),
        apiFetch("/api/templates"),
        apiFetch("/api/centers")
      ]);
      
      if (cRes.ok) {
        const data = await cRes.json();
        setCerts(Array.isArray(data) ? data : []);
      }
      if (tRes.ok) {
        const data = await tRes.json();
        setTemplates(Array.isArray(data) ? data : []);
      }
      if (ctrRes.ok) {
        const data = await ctrRes.json();
        setCenters(Array.isArray(data) ? data : []);
      }
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    return certs.filter((c) => {
      const isPending = (c.status || "").toLowerCase() === "pending_approval";
      if (!isPending) return false;

      const matchesSearch = 
        (c.certificate_no || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.course || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.center_name || "").toLowerCase().includes(search.toLowerCase());
      
      const matchesCenter = centerFilter === "all" || toId(c.center_id) === centerFilter;
      
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const certDate = new Date(c.issued_on);
        if (dateFrom && certDate < new Date(dateFrom)) matchesDate = false;
        if (dateTo && certDate > new Date(dateTo)) matchesDate = false;
      }

      return matchesSearch && matchesCenter && matchesDate;
    });
  }, [certs, search, centerFilter, dateFrom, dateTo]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAll = () => {
    if (selectedIds.length === filtered.length) setSelectedIds([]);
    else setSelectedIds(filtered.map(c => c._id));
  };

  const handleIssue = async () => {
    if (!selectedTemplate) {
      toast.error("Please select a certificate");
      return;
    }
    if (issueMode === "later" && !scheduledAt) {
      toast.error("Please select a date and time");
      return;
    }

    setProcessing(true);
    try {
      // Find students associated with selected certificates
      const studentIds = certs
        .filter(c => selectedIds.includes(c._id))
        .map(c => toId(c.student_id));

      const res = await apiFetch("/api/generate-certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: selectedTemplate,
          student_ids: studentIds,
          scheduled_at: issueMode === "later" ? scheduledAt : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(data.message || "Certificates processed");
        setIsIssueDialogOpen(false);
        setSelectedIds([]);
        loadData();
      } else {
        toast.error(data.message || "Failed to process certificates");
      }
    } catch {
      toast.error("Error processing certificates");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
              Certificate Approvals
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              Manage and approve certificates applied by centers.
            </p>
          </div>
          <Button 
            className="rounded-none font-bold uppercase tracking-widest px-8 py-6 shadow-xl"
            disabled={selectedIds.length === 0}
            onClick={() => setIsIssueDialogOpen(true)}
          >
            <UserCheck className="w-4 h-4 mr-2" />
            Issue {selectedIds.length > 0 ? `(${selectedIds.length})` : ""} Certificates
          </Button>
        </div>

        {/* Filters */}
        <Card className="rounded-none border-border shadow-sm bg-muted/20">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Cert No, Course, Center..." 
                    className="pl-10 rounded-none border-border bg-background"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Filter by Center</Label>
                <div className="relative">
                  <School className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                  <Select value={centerFilter} onValueChange={setCenterFilter}>
                    <SelectTrigger className="pl-10 rounded-none border-border bg-background">
                      <SelectValue placeholder="All Centers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Centers</SelectItem>
                      {centers.map(c => (
                        <SelectItem key={toId(c._id)} value={toId(c._id)}>{c.name} ({c.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Applied Date Range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground z-10" />
                    <Input 
                      type="date" 
                      className="pl-9 rounded-none border-border bg-background text-xs h-10" 
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground z-10" />
                    <Input 
                      type="date" 
                      className="pl-9 rounded-none border-border bg-background text-xs h-10" 
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Stamp className="w-4 h-4 text-primary" />
                Pending Approval ({filtered.length})
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-none text-[10px] font-black uppercase tracking-widest h-8"
                onClick={selectAll}
              >
                {filtered.length > 0 && selectedIds.length === filtered.length ? "Deselect All" : "Select All Filtered"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Loading</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-20 text-center">
                <Award className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  No certificates pending approval
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((c) => (
                  <div
                    key={c._id}
                    className={cn(
                      "p-6 flex items-center justify-between hover:bg-muted/20 transition-colors cursor-pointer",
                      selectedIds.includes(c._id) && "bg-primary/5 border-l-4 border-l-primary"
                    )}
                    onClick={() => toggleSelect(c._id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                        <Award className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-foreground">{c.certificate_no}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                          {c.course}
                        </p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          {c.center_name || "Center"} • {new Date(c.issued_on).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c._id)}
                        onChange={(e) => { e.stopPropagation(); toggleSelect(c._id); }}
                        className="w-5 h-5 accent-primary"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Issue Dialog */}
        <Dialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
          <DialogContent className="rounded-none border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading font-extrabold text-xl uppercase tracking-tight">Issue {selectedIds.length} Certificates</DialogTitle>
              <p className="text-sm text-muted-foreground font-medium">Select a certificate and issuance schedule.</p>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Certificate</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="rounded-none border-border h-12">
                    <SelectValue placeholder="Choose a certificate..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.filter(t => t.template_type !== 'marksheet').map((t) => (
                      <SelectItem key={toId(t._id)} value={toId(t._id)}>
                        {t.template_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4 pt-2 border-t border-border">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Issuance Options</Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => { setIssueMode("now"); setScheduledAt(""); }}
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 border text-[10px] font-black uppercase tracking-widest transition-all",
                      issueMode === "now" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
                    )}
                  >
                    <UserCheck className="w-4 h-4" />
                    Issue Now
                  </button>
                  <button
                    onClick={() => setIssueMode("later")}
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 border text-[10px] font-black uppercase tracking-widest transition-all",
                      issueMode === "later" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
                    )}
                  >
                    <Calendar className="w-4 h-4" />
                    Issue Later
                  </button>
                </div>

                {issueMode === "later" && (
                  <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Scheduled Date & Time</Label>
                    <Input
                      type="datetime-local"
                      className="rounded-none border-border h-12"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="flex flex-row gap-2 sm:justify-end">
              <Button variant="outline" className="rounded-none font-bold uppercase tracking-widest text-[10px]" onClick={() => setIsIssueDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                className="rounded-none font-bold uppercase tracking-widest text-[10px] px-8" 
                disabled={!selectedTemplate || processing || (issueMode === 'later' && !scheduledAt)}
                onClick={handleIssue}
              >
                {processing ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : (issueMode === 'now' ? <UserCheck className="w-3 h-3 mr-2" /> : <Clock className="w-3 h-3 mr-2" />)}
                {issueMode === 'now' ? 'Issue Now' : 'Schedule Issuance'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminCertificateApprovalPage;
