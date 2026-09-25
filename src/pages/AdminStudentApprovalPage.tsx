import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle2, XCircle, Search, Loader2, Filter, MessageSquare, Building2, MapPin, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface StudentRow {
  _id?: { $oid: string } | string;
  id?: string;
  username: string;
  full_name?: string;
  fullName?: string;
  course?: string;
  approval_status?: string;
  status?: string;
  parent_id?: string;
  center_name?: string;
  priority_centers?: string[];
  current_priority?: number;
  admin_instructions?: string;
  registration_date?: string;
}

interface Center {
  _id?: string;
  id?: string;
  name?: string;
  center_name?: string;
}

const toId = (v: any): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "$oid" in v) return v.$oid;
  return String(v || "");
};

const AdminStudentApprovalPage = () => {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "accepted" | "rejected">("pending");
  const [centerFilter, setCenterFilter] = useState("all");

  // Instruction Modal State
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [adminInstruction, setAdminInstruction] = useState("");
  const [processing, setProcessing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const [sRes, cRes] = await Promise.all([
        fetch("/api/students", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/centers", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (sRes.ok) {
        const data = await sRes.json();
        setStudents(Array.isArray(data) ? data : []);
      }
      if (cRes.ok) {
        const cData = await cRes.json();
        setCenters(Array.isArray(cData) ? cData : []);
      }
    } catch {
      toast.error("Failed to load registration approval requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openActionDialog = (student: StudentRow, type: "approve" | "reject") => {
    setSelectedStudent(student);
    setActionType(type);
    setAdminInstruction("");
  };

  const handleConfirmAction = async () => {
    if (!selectedStudent || !actionType) return;
    const sid = toId(selectedStudent._id || selectedStudent.id);
    setProcessing(true);

    try {
      const token = sessionStorage.getItem("token");
      const endpoint = actionType === "approve"
        ? `/api/admin/students/${sid}/approve`
        : `/api/admin/students/${sid}/reject`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          instructions: adminInstruction,
          student_id: sid,
        }),
      });

      if (res.ok) {
        if (actionType === "approve") {
          toast.success(`Student approved & assigned to Center. Certificate template initialized!`);
        } else {
          toast.success(`Request rejected. Shifting to next priority center option if applicable.`);
        }
        setSelectedStudent(null);
        setActionType(null);
        load();
      } else {
        toast.error(`Failed to process ${actionType} request`);
      }
    } catch {
      toast.error("Error processing request");
    } finally {
      setProcessing(false);
    }
  };

  const filtered = students.filter((s) => {
    const name = s.full_name || s.fullName || s.username || "";
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());

    const rawStatus = (s.approval_status || s.status || "pending").toLowerCase();
    const isAccepted = rawStatus.includes("accept") || rawStatus.includes("approve") || rawStatus === "active";
    const isRejected = rawStatus.includes("reject");
    const isPending = !isAccepted && !isRejected;

    let matchesStatus = true;
    if (statusFilter === "pending") matchesStatus = isPending;
    else if (statusFilter === "accepted") matchesStatus = isAccepted;
    else if (statusFilter === "rejected") matchesStatus = isRejected;

    const matchesCenter = centerFilter === "all" || s.parent_id === centerFilter || s.center_name === centerFilter;

    return matchesSearch && matchesStatus && matchesCenter;
  });

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-10 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />
              Student Registration & Center Approvals
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              Review 3-priority center registrations, approve/reject student center allotments, and issue instructions.
            </p>
          </div>
        </div>

        {/* Filter Navigation Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card p-4 border border-border">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => setStatusFilter("pending")}
              className={`px-4 py-2 text-xs font-black uppercase tracking-wider transition-all border ${
                statusFilter === "pending"
                  ? "bg-amber-500 text-slate-950 border-amber-500 shadow"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted border-border"
              }`}
            >
              Pending Requests ({students.filter(s => {
                const st = (s.approval_status || s.status || "pending").toLowerCase();
                return !st.includes("accept") && !st.includes("approve") && st !== "active" && !st.includes("reject");
              }).length})
            </button>
            <button
              onClick={() => setStatusFilter("accepted")}
              className={`px-4 py-2 text-xs font-black uppercase tracking-wider transition-all border ${
                statusFilter === "accepted"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted border-border"
              }`}
            >
              Accepted List ({students.filter(s => {
                const st = (s.approval_status || s.status || "").toLowerCase();
                return st.includes("accept") || st.includes("approve") || st === "active";
              }).length})
            </button>
            <button
              onClick={() => setStatusFilter("rejected")}
              className={`px-4 py-2 text-xs font-black uppercase tracking-wider transition-all border ${
                statusFilter === "rejected"
                  ? "bg-rose-600 text-white border-rose-600 shadow"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted border-border"
              }`}
            >
              Rejected List ({students.filter(s => (s.approval_status || s.status || "").toLowerCase().includes("reject")).length})
            </button>
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-4 py-2 text-xs font-black uppercase tracking-wider transition-all border ${
                statusFilter === "all"
                  ? "bg-primary text-primary-foreground border-primary shadow"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted border-border"
              }`}
            >
              All Requests ({students.length})
            </button>
          </div>

          {/* Search & Center Select */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search student name..."
                className="w-full pl-9 pr-4 py-2 rounded-none border border-border bg-background text-xs font-bold uppercase tracking-widest focus:border-primary outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              value={centerFilter}
              onChange={(e) => setCenterFilter(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 bg-background border border-border rounded-none text-xs font-bold uppercase tracking-widest outline-none focus:border-primary"
            >
              <option value="all">All Centers</option>
              {centers.map((c) => (
                <option key={c._id || c.id} value={c._id || c.id || c.name || ""}>
                  {c.name || c.center_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Requests Table */}
        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Center Approval Queue ({filtered.length})
              </span>
              <span className="text-[10px] text-muted-foreground font-medium">
                Showing {statusFilter.toUpperCase()} requests
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Loading Approval Records...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-16 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground space-y-2">
                <p>No student requests match the selected filter criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/20 text-muted-foreground uppercase text-[10px] font-black tracking-widest">
                      <th className="py-4 px-6">Student Profile</th>
                      <th className="py-4 px-6">Course Enrolled</th>
                      <th className="py-4 px-6">Center & Priority Allocation</th>
                      <th className="py-4 px-6">Admin Instructions</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6 text-right">Approval Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((s) => {
                      const sid = toId(s._id || s.id);
                      const name = s.full_name || s.fullName || s.username;
                      const rawStatus = (s.approval_status || s.status || "pending").toLowerCase();
                      const isAccepted = rawStatus.includes("accept") || rawStatus.includes("approve") || rawStatus === "active";
                      const isRejected = rawStatus.includes("reject");
                      const curPriority = s.current_priority || 1;

                      const getCenterNameById = (idStr?: string) => {
                        if (!idStr) return null;
                        const match = centers.find((c) => (c._id || c.id) === idStr || c.name === idStr);
                        return match?.name || match?.center_name || idStr;
                      };

                      const p1Name = getCenterNameById(s.priority_centers?.[0]) || s.center_name || "Center 1";
                      const p2Name = getCenterNameById(s.priority_centers?.[1]) || "Center 2";
                      const p3Name = getCenterNameById(s.priority_centers?.[2]) || "Center 3";

                      return (
                        <tr key={sid} className="hover:bg-muted/10 transition-colors">
                          <td className="py-4 px-6 font-bold">
                            <div className="font-black text-sm uppercase text-foreground">{name}</div>
                            <span className="text-[10px] text-muted-foreground font-mono">@{s.username}</span>
                          </td>

                          <td className="py-4 px-6 font-bold uppercase text-primary">
                            {s.course || "No Course Specified"}
                          </td>

                          <td className="py-4 px-6 space-y-1">
                            <div className="font-bold flex items-center gap-1 text-amber-600">
                              <Building2 className="w-3.5 h-3.5" />
                              {s.center_name || p1Name}
                            </div>
                            {/* 3-Center Priority Indicator */}
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground">
                              <span className={`px-1.5 py-0.5 border ${curPriority === 1 ? "bg-amber-500/20 text-amber-700 border-amber-500/30 font-extrabold" : "bg-muted text-muted-foreground border-transparent"}`}>
                                P1: {p1Name}
                              </span>
                              <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                              <span className={`px-1.5 py-0.5 border ${curPriority === 2 ? "bg-amber-500/20 text-amber-700 border-amber-500/30 font-extrabold" : "bg-muted text-muted-foreground border-transparent"}`}>
                                P2: {p2Name}
                              </span>
                              <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                              <span className={`px-1.5 py-0.5 border ${curPriority === 3 ? "bg-amber-500/20 text-amber-700 border-amber-500/30 font-extrabold" : "bg-muted text-muted-foreground border-transparent"}`}>
                                P3: {p3Name}
                              </span>
                            </div>
                          </td>

                          <td className="py-4 px-6">
                            {s.admin_instructions ? (
                              <p className="text-[10px] text-slate-300 bg-slate-900 p-2 border border-slate-800 line-clamp-2 italic">
                                "{s.admin_instructions}"
                              </p>
                            ) : (
                              <span className="text-slate-500 italic text-[10px]">No special instructions given</span>
                            )}
                          </td>

                          <td className="py-4 px-6">
                            <span
                              className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border ${
                                isAccepted
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                  : isRejected
                                  ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                                  : "bg-amber-500/10 text-amber-600 border-amber-500/30 animate-pulse"
                              }`}
                            >
                              {isAccepted ? "Accepted" : isRejected ? "Rejected" : "Pending Approval"}
                            </span>
                          </td>

                          <td className="py-4 px-6 text-right space-x-2">
                            {!isAccepted && (
                              <Button
                                size="sm"
                                onClick={() => openActionDialog(s, "approve")}
                                className="rounded-none font-black text-[10px] uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Accept & Allot
                              </Button>
                            )}
                            {!isRejected && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openActionDialog(s, "reject")}
                                className="rounded-none font-black text-[10px] uppercase tracking-wider border-rose-500/40 text-rose-600 hover:bg-rose-500/10 gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Reject Request
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Confirmation & Instruction Modal */}
        {selectedStudent && actionType && (
          <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
            <DialogContent className="max-w-md rounded-none border-2 border-slate-900 shadow-2xl p-6">
              <DialogHeader className="border-b border-border pb-3">
                <DialogTitle className="font-black uppercase tracking-tight text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  {actionType === "approve" ? "Approve Student Center Allotment" : "Reject Registration Request"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-3">
                <div className="bg-muted/40 p-3 border border-border space-y-1 text-xs font-bold">
                  <p className="text-foreground">Student: <span className="text-primary">{selectedStudent.full_name || selectedStudent.fullName || selectedStudent.username}</span></p>
                  <p className="text-muted-foreground">Course: {selectedStudent.course || "General"}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Admin Instructions / Notes for Center & Student:
                  </label>
                  <textarea
                    rows={3}
                    value={adminInstruction}
                    onChange={(e) => setAdminInstruction(e.target.value)}
                    placeholder="Enter instructions (e.g., 'Verify 10th DMC original on joining', 'Shift to Priority 2 center')..."
                    className="w-full p-2.5 rounded-none border border-border bg-background text-xs font-medium focus:border-primary outline-none"
                  />
                </div>
              </div>

              <DialogFooter className="border-t border-border pt-3 gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedStudent(null)}
                  className="rounded-none font-bold text-xs uppercase tracking-widest"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmAction}
                  disabled={processing}
                  className={`rounded-none font-black text-xs uppercase tracking-widest gap-2 text-white ${
                    actionType === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : actionType === "approve" ? "Confirm Accept" : "Confirm Reject"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminStudentApprovalPage;
