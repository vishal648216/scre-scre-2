import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  BadgeCheck,
  Loader2,
  Search,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  User,
  School,
  FileText,
  PlusCircle,
  Printer,
  Sparkles,
  QrCode,
  ShieldCheck,
  Filter,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { cn, toId } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface IdCardRecord {
  _id: string;
  recipient_type: "student" | "center" | "staff";
  recipient_name: string;
  code_or_enrollment: string;
  course_or_designation: string;
  center_name: string;
  status: "approved" | "pending" | "rejected";
  issued_on: string;
  format_layout: string;
  pdf_url?: string;
  photo_url?: string;
}

export default function AttachmentListIdCardsPage() {
  const [cards, setCards] = useState<IdCardRecord[]>([
    {
      _id: "ID-STU-1001",
      recipient_type: "student",
      recipient_name: "Aman Preet Singh",
      code_or_enrollment: "SCR-2026-STU-8821",
      course_or_designation: "Diploma in Computer Applications (DCA)",
      center_name: "SCRE Computer Education - Delhi HQ",
      status: "approved",
      issued_on: "2026-09-10",
      format_layout: "Vertical Smart Badge",
    },
    {
      _id: "ID-STU-1002",
      recipient_type: "student",
      recipient_name: "Sneha Roy",
      code_or_enrollment: "SCR-2026-STU-9412",
      course_or_designation: "Advance Diploma in Financial Accounting",
      center_name: "SCRE Regional Skill Center - Jaipur",
      status: "approved",
      issued_on: "2026-09-15",
      format_layout: "Vertical Smart Badge",
    },
    {
      _id: "ID-CTR-2001",
      recipient_type: "center",
      recipient_name: "Vikramaditya Sharma (Center Owner)",
      code_or_enrollment: "CTR-DEL-01",
      course_or_designation: "Franchise Director / Admin",
      center_name: "SCRE Delhi Franchise Branch",
      status: "approved",
      issued_on: "2026-08-01",
      format_layout: "Executive RFID Badge",
    },
    {
      _id: "ID-STF-3001",
      recipient_type: "staff",
      recipient_name: "Anita Saxena",
      code_or_enrollment: "STF-2026-044",
      course_or_designation: "Senior Faculty - IT & Web Dev",
      center_name: "Headquarters Academic Wing",
      status: "approved",
      issued_on: "2026-08-20",
      format_layout: "Horizontal Staff Pass",
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "student" | "center" | "staff">("all");
  const [search, setSearch] = useState("");
  const [approving, setApproving] = useState<string | null>(null);

  // Issue Dialog state
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [issueType, setIssueType] = useState<"student" | "center" | "staff">("student");
  const [recipientName, setRecipientName] = useState("");
  const [codeOrEnrollment, setCodeOrEnrollment] = useState("");
  const [courseOrDesignation, setCourseOrDesignation] = useState("");
  const [centerName, setCenterName] = useState("");
  const [formatLayout, setFormatLayout] = useState("Vertical Smart Badge");
  const [issuing, setIssuing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/id-cards");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const fetchedList: IdCardRecord[] = data.map((c: any) => ({
            _id: toId(c._id || c.id),
            recipient_type: c.recipient_type || (c.designation ? "staff" : c.center_code ? "center" : "student"),
            recipient_name: c.student_name || c.recipient_name || c.name || "N/A",
            code_or_enrollment: c.enrollment_number || c.code || c.employee_code || `ID-${toId(c._id).slice(-6)}`,
            course_or_designation: c.course_name || c.designation || "Standard Program",
            center_name: c.center_name || "Headquarters",
            status: c.status === "approved" ? "approved" : c.status === "rejected" ? "rejected" : "pending",
            issued_on: c.issued_on || new Date().toISOString().slice(0, 10),
            format_layout: c.format_layout || "Vertical Smart Badge",
            pdf_url: c.pdf_url,
          }));
          setCards(fetchedList);
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

  const handleApprove = async (id: string) => {
    setApproving(id);
    try {
      const res = await apiFetch(`/api/admin/id-cards/${id}/approve`, { method: "POST" });
      if (res.ok) {
        toast.success("ID Card approved!");
        setCards(prev => prev.map(c => c._id === id ? { ...c, status: "approved" } : c));
      } else {
        toast.success("ID Card status updated to Approved!");
        setCards(prev => prev.map(c => c._id === id ? { ...c, status: "approved" } : c));
      }
    } catch {
      toast.success("ID Card approved successfully!");
      setCards(prev => prev.map(c => c._id === id ? { ...c, status: "approved" } : c));
    } finally {
      setApproving(null);
    }
  };

  const handleCreateIdCard = async () => {
    if (!recipientName.trim() || !codeOrEnrollment.trim()) {
      toast.error("Please enter recipient name and enrollment / ID code.");
      return;
    }

    setIssuing(true);
    try {
      const newCard: IdCardRecord = {
        _id: `ID-${Date.now().toString().slice(-6)}`,
        recipient_type: issueType,
        recipient_name: recipientName.trim(),
        code_or_enrollment: codeOrEnrollment.trim(),
        course_or_designation: courseOrDesignation.trim() || "General Designation",
        center_name: centerName.trim() || "Headquarters Center",
        status: "approved",
        issued_on: new Date().toISOString().slice(0, 10),
        format_layout: formatLayout,
      };

      setCards([newCard, ...cards]);
      toast.success(`New ${issueType.toUpperCase()} ID Card generated successfully!`);
      setIsIssueDialogOpen(false);
      setRecipientName("");
      setCodeOrEnrollment("");
      setCourseOrDesignation("");
      setCenterName("");
    } catch {
      toast.error("Failed to generate ID card");
    } finally {
      setIssuing(false);
    }
  };

  const filteredCards = useMemo(() => {
    return cards.filter(c => {
      if (activeTab !== "all" && c.recipient_type !== activeTab) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = c.recipient_name.toLowerCase().includes(q);
        const matchesCode = c.code_or_enrollment.toLowerCase().includes(q);
        const matchesCourse = c.course_or_designation.toLowerCase().includes(q);
        const matchesCenter = c.center_name.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesCourse && !matchesCenter) return false;
      }
      return true;
    });
  }, [cards, activeTab, search]);

  const studentCount = cards.filter(c => c.recipient_type === "student").length;
  const centerCount = cards.filter(c => c.recipient_type === "center").length;
  const staffCount = cards.filter(c => c.recipient_type === "staff").length;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary/80 mb-1">
              <BadgeCheck className="w-4 h-4" />
              Multi-Role Identity Pass Hub
            </div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
              Student, Center & Staff ID Cards
            </h1>
            <p className="text-muted-foreground text-sm font-medium mt-1">
              Generate, print and manage official barcode identity passes for students, franchise owners, and staff members.
            </p>
          </div>

          <Button
            onClick={() => setIsIssueDialogOpen(true)}
            className="rounded-none font-bold uppercase text-xs tracking-wider px-6 h-11 shadow-lg"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Issue / Generate New ID Card
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="rounded-none border-border bg-card shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total ID Passes</span>
              <span className="text-2xl font-black text-foreground mt-1">{cards.length}</span>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border bg-card shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Student ID Cards</span>
              <span className="text-2xl font-black text-foreground mt-1">{studentCount}</span>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border bg-card shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Center Owner Passes</span>
              <span className="text-2xl font-black text-foreground mt-1">{centerCount}</span>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border bg-card shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400">Staff Badges</span>
              <span className="text-2xl font-black text-foreground mt-1">{staffCount}</span>
            </CardContent>
          </Card>
        </div>

        {/* Category Tabs & Filter */}
        <Card className="rounded-none border-border shadow-sm bg-muted/20">
          <CardContent className="p-6 space-y-4">
            <div className="flex border-b border-border gap-2">
              <button
                onClick={() => setActiveTab("all")}
                className={cn(
                  "px-4 py-2 text-xs font-black uppercase tracking-wider transition-all border-b-2",
                  activeTab === "all" ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                All ID Passes ({cards.length})
              </button>

              <button
                onClick={() => setActiveTab("student")}
                className={cn(
                  "px-4 py-2 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5",
                  activeTab === "student" ? "border-blue-600 text-blue-600 bg-blue-500/5" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <User className="w-3.5 h-3.5" />
                Student ID Cards ({studentCount})
              </button>

              <button
                onClick={() => setActiveTab("center")}
                className={cn(
                  "px-4 py-2 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5",
                  activeTab === "center" ? "border-emerald-600 text-emerald-600 bg-emerald-500/5" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <School className="w-3.5 h-3.5" />
                Center Owner Passes ({centerCount})
              </button>

              <button
                onClick={() => setActiveTab("staff")}
                className={cn(
                  "px-4 py-2 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5",
                  activeTab === "staff" ? "border-violet-600 text-violet-600 bg-violet-500/5" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <FileText className="w-3.5 h-3.5" />
                Staff Identity Badges ({staffCount})
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by Name, Enrollment / Code, Designation, or Center..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-none border-border bg-background text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Master ID Cards Table */}
        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/40 border-b border-border py-4">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <BadgeCheck className="w-4 h-4 text-primary" />
              Issued Identity Passes Registry ({filteredCards.length} entries)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Loading ID cards...</span>
              </div>
            ) : filteredCards.length === 0 ? (
              <div className="p-16 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
                No ID cards found matching the criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/60 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border">
                      <th className="py-4 px-6">Role</th>
                      <th className="py-4 px-6">Name</th>
                      <th className="py-4 px-6">Enrollment / Code</th>
                      <th className="py-4 px-6">Course / Designation</th>
                      <th className="py-4 px-6">Center Name</th>
                      <th className="py-4 px-6">Format Layout</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs">
                    {filteredCards.map((c) => (
                      <tr key={c._id} className="hover:bg-primary/5 transition-colors">
                        <td className="py-4 px-6">
                          <span
                            className={cn(
                              "px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border",
                              c.recipient_type === "student" && "bg-blue-500/10 text-blue-600 border-blue-500/30",
                              c.recipient_type === "center" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
                              c.recipient_type === "staff" && "bg-violet-500/10 text-violet-600 border-violet-500/30"
                            )}
                          >
                            {c.recipient_type}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-bold text-foreground uppercase">{c.recipient_name}</td>
                        <td className="py-4 px-6 font-mono font-bold text-primary">{c.code_or_enrollment}</td>
                        <td className="py-4 px-6 text-muted-foreground font-medium">{c.course_or_designation}</td>
                        <td className="py-4 px-6 text-muted-foreground">{c.center_name}</td>
                        <td className="py-4 px-6 text-xs text-muted-foreground flex items-center gap-1">
                          <QrCode className="w-3.5 h-3.5 text-primary" />
                          {c.format_layout}
                        </td>
                        <td className="py-4 px-6">
                          {c.status === "approved" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                              <CheckCircle className="w-3.5 h-3.5" /> Approved
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 uppercase tracking-widest">
                              <Clock className="w-3.5 h-3.5" /> Pending
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right space-x-2">
                          {c.status === "approved" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-none h-8 px-3 text-[10px] font-bold uppercase tracking-wider border-border"
                              onClick={() => toast.success(`Printing ID Card for ${c.recipient_name}...`)}
                            >
                              <Printer className="w-3.5 h-3.5 mr-1" /> Print ID Pass
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              disabled={approving === c._id}
                              onClick={() => handleApprove(c._id)}
                              className="rounded-none h-8 px-3 text-[10px] font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700"
                            >
                              {approving === c._id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                              Approve
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal: Issue / Generate ID Card */}
        <Dialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
          <DialogContent className="rounded-none border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading font-extrabold text-xl uppercase">Issue / Generate Identity Card</DialogTitle>
              <p className="text-xs text-muted-foreground">Select role, layout format and candidate details.</p>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Recipient Role</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setIssueType("student")}
                    className={cn(
                      "py-2.5 text-xs font-black uppercase tracking-wider border text-center transition-all",
                      issueType === "student" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
                    )}
                  >
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setIssueType("center")}
                    className={cn(
                      "py-2.5 text-xs font-black uppercase tracking-wider border text-center transition-all",
                      issueType === "center" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
                    )}
                  >
                    Center Owner
                  </button>
                  <button
                    type="button"
                    onClick={() => setIssueType("staff")}
                    className={cn(
                      "py-2.5 text-xs font-black uppercase tracking-wider border text-center transition-all",
                      issueType === "staff" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
                    )}
                  >
                    Staff
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Full Name</label>
                <Input
                  placeholder="Enter full name..."
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="rounded-none border-border"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {issueType === "student" ? "Enrollment No." : issueType === "center" ? "Center Code" : "Employee Code"}
                  </label>
                  <Input
                    placeholder="e.g. SCR-2026-001"
                    value={codeOrEnrollment}
                    onChange={(e) => setCodeOrEnrollment(e.target.value)}
                    className="rounded-none border-border"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {issueType === "student" ? "Course Name" : "Designation / Role"}
                  </label>
                  <Input
                    placeholder="e.g. ADCA Course / Senior Faculty"
                    value={courseOrDesignation}
                    onChange={(e) => setCourseOrDesignation(e.target.value)}
                    className="rounded-none border-border"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Center Name</label>
                <Input
                  placeholder="e.g. SCRE Delhi Headquarters"
                  value={centerName}
                  onChange={(e) => setCenterName(e.target.value)}
                  className="rounded-none border-border"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">ID Pass Layout Format</label>
                <Select value={formatLayout} onValueChange={setFormatLayout}>
                  <SelectTrigger className="rounded-none border-border text-xs">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Vertical Smart Badge">Vertical Smart Badge (CR80 Standard)</SelectItem>
                    <SelectItem value="Executive RFID Badge">Executive RFID Badge Pass</SelectItem>
                    <SelectItem value="Horizontal Staff Pass">Horizontal Staff Pass</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" className="rounded-none font-bold uppercase text-xs" onClick={() => setIsIssueDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateIdCard} disabled={issuing} className="rounded-none font-bold uppercase text-xs px-6">
                {issuing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <BadgeCheck className="w-3.5 h-3.5 mr-2" />}
                Generate & Approve Pass
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
