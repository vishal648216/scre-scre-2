import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle2, XCircle, Search, Loader2, Filter, MessageSquare, Building2, MapPin, ArrowRight, IndianRupee, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

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
  total_fees?: number;
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

  // Instruction & Fee Refund Modal State
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "refund" | null>(null);
  const [adminInstruction, setAdminInstruction] = useState("");
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, cRes] = await Promise.all([
        apiFetch("/api/students"),
        apiFetch("/api/centers"),
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

  const openActionDialog = (student: StudentRow, type: "approve" | "reject" | "refund") => {
    setSelectedStudent(student);
    setActionType(type);
    setAdminInstruction("");
    setRefundAmount(student.total_fees || 500);
    setRefundReason("Registration Fee Refund");
  };

  const handleConfirmAction = async () => {
    if (!selectedStudent || !actionType) return;
    const sid = toId(selectedStudent._id || selectedStudent.id);
    setProcessing(true);

    try {
      let endpoint = "";
      let reqBody: any = {};

      if (actionType === "approve") {
        endpoint = `/api/admin/students/${sid}/approve`;
        reqBody = { instructions: adminInstruction, student_id: sid };
      } else if (actionType === "reject") {
        endpoint = `/api/admin/students/${sid}/reject`;
        reqBody = { instructions: adminInstruction, student_id: sid };
      } else if (actionType === "refund") {
        endpoint = `/api/admin/students/${sid}/fee-refund`;
        reqBody = {
          refund_amount: Number(refundAmount),
          reason: refundReason,
          remarks: adminInstruction,
        };
      }

      const res = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(reqBody),
      });

      if (res.ok) {
        if (actionType === "approve") {
          toast.success(`Student approved & assigned to Center. Certificate template initialized!`);
        } else if (actionType === "reject") {
          toast.success(`Request rejected. Shifting to next priority center option if applicable.`);
        } else {
          toast.success(`Registration Fee Refund of ₹${refundAmount} processed successfully!`);
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

  const pendingCount = students.filter((s) => {
    const st = (s.approval_status || s.status || "pending").toLowerCase();
    return !st.includes("accept") && !st.includes("approve") && st !== "active" && !st.includes("reject");
  }).length;

  const acceptedCount = students.filter((s) => {
    const st = (s.approval_status || s.status || "").toLowerCase();
    return st.includes("accept") || st.includes("approve") || st === "active";
  }).length;

  const rejectedCount = students.filter((s) => (s.approval_status || s.status || "").toLowerCase().includes("reject")).length;

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-12 max-w-7xl mx-auto animate-in fade-in duration-500">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-heading font-extrabold text-2xl md:text-3xl text-zinc-100 uppercase tracking-tight">
                Student Registration & Center Approvals
              </h1>
              <p className="text-zinc-400 text-xs font-medium">
                Review 3-priority center registrations, approve/reject student allotments, and issue administrative instructions.
              </p>
            </div>
          </div>
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900/90 border border-amber-500/30 p-5 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Pending Approvals</p>
              <h3 className="text-2xl font-black text-amber-300 mt-1">{pendingCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-emerald-500/30 p-5 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Accepted List</p>
              <h3 className="text-2xl font-black text-emerald-300 mt-1">{acceptedCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-rose-500/30 p-5 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400">Rejected List</p>
              <h3 className="text-2xl font-black text-rose-300 mt-1">{rejectedCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <XCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Total Applications</p>
              <h3 className="text-2xl font-black text-zinc-100 mt-1">{students.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
              <Building2 className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filter Navigation Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-zinc-900/90 p-4 border border-zinc-800 rounded-2xl shadow-xl">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => setStatusFilter("pending")}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                statusFilter === "pending"
                  ? "bg-amber-500 text-slate-950 border-amber-500 shadow-lg shadow-amber-500/10"
                  : "bg-zinc-950 text-zinc-400 hover:text-zinc-100 border-zinc-800"
              }`}
            >
              Pending Requests ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter("accepted")}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                statusFilter === "accepted"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-500/10"
                  : "bg-zinc-950 text-zinc-400 hover:text-zinc-100 border-zinc-800"
              }`}
            >
              Accepted List ({acceptedCount})
            </button>
            <button
              onClick={() => setStatusFilter("rejected")}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                statusFilter === "rejected"
                  ? "bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-500/10"
                  : "bg-zinc-950 text-zinc-400 hover:text-zinc-100 border-zinc-800"
              }`}
            >
              Rejected List ({rejectedCount})
            </button>
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                statusFilter === "all"
                  ? "bg-zinc-100 text-zinc-950 border-zinc-100 shadow-lg"
                  : "bg-zinc-950 text-zinc-400 hover:text-zinc-100 border-zinc-800"
              }`}
            >
              All Requests ({students.length})
            </button>
          </div>

          {/* Search & Center Select */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search student name..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-xs font-bold text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              value={centerFilter}
              onChange={(e) => setCenterFilter(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-bold text-amber-400 uppercase tracking-widest outline-none focus:border-amber-500"
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
        <Card className="rounded-2xl border-zinc-800 bg-zinc-900/90 shadow-xl overflow-hidden">
          <CardHeader className="bg-zinc-900/80 border-b border-zinc-800 p-5">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center justify-between text-zinc-200">
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400" />
                Center Approval Queue ({filtered.length})
              </span>
              <span className="text-[10px] text-zinc-400 font-medium">
                Showing {statusFilter.toUpperCase()} requests
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Loading Approval Records...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-16 text-center text-xs font-bold uppercase tracking-widest text-zinc-400 space-y-2">
                <p>No student requests match the selected filter criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/50 text-zinc-400 uppercase text-[10px] font-black tracking-widest">
                      <th className="py-4 px-6">Student Profile</th>
                      <th className="py-4 px-6">Course Enrolled</th>
                      <th className="py-4 px-6">Center & Priority Allocation</th>
                      <th className="py-4 px-6">Admin Instructions</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6 text-right">Approval Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-zinc-200">
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
                        <tr key={sid} className="hover:bg-zinc-800/40 transition-colors">
                          <td className="py-4 px-6 font-bold">
                            <div className="font-extrabold text-sm uppercase text-zinc-100">{name}</div>
                            <span className="text-[10px] text-amber-400 font-mono">@{s.username}</span>
                          </td>

                          <td className="py-4 px-6 font-bold uppercase text-amber-300">
                            {s.course || "No Course Specified"}
                          </td>

                          <td className="py-4 px-6 space-y-1.5">
                            <div className="font-bold flex items-center gap-1.5 text-amber-400">
                              <Building2 className="w-3.5 h-3.5" />
                              {s.center_name || p1Name}
                            </div>
                            {/* 3-Center Priority Indicator */}
                            <div className="flex items-center gap-1 text-[9px] font-bold">
                              <span
                                className={`px-2 py-0.5 rounded-md border ${
                                  curPriority === 1
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-extrabold"
                                    : "bg-zinc-950 text-zinc-500 border-zinc-800"
                                }`}
                              >
                                P1: {p1Name}
                              </span>
                              <ArrowRight className="w-2.5 h-2.5 text-zinc-600" />
                              <span
                                className={`px-2 py-0.5 rounded-md border ${
                                  curPriority === 2
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-extrabold"
                                    : "bg-zinc-950 text-zinc-500 border-zinc-800"
                                }`}
                              >
                                P2: {p2Name}
                              </span>
                              <ArrowRight className="w-2.5 h-2.5 text-zinc-600" />
                              <span
                                className={`px-2 py-0.5 rounded-md border ${
                                  curPriority === 3
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-extrabold"
                                    : "bg-zinc-950 text-zinc-500 border-zinc-800"
                                }`}
                              >
                                P3: {p3Name}
                              </span>
                            </div>
                          </td>

                          <td className="py-4 px-6">
                            {s.admin_instructions ? (
                              <p className="text-[10px] text-zinc-300 bg-zinc-950 p-2 rounded-lg border border-zinc-800 line-clamp-2 italic">
                                "{s.admin_instructions}"
                              </p>
                            ) : (
                              <span className="text-zinc-500 italic text-[10px]">No special instructions given</span>
                            )}
                          </td>

                          <td className="py-4 px-6">
                            <span
                              className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border ${
                                isAccepted
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : isRejected
                                  ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                  : "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse"
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
                                className="rounded-xl font-black text-[10px] uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white gap-1 shadow-lg shadow-emerald-600/10"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Accept & Allot
                              </Button>
                            )}
                            {!isRejected && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openActionDialog(s, "reject")}
                                className="rounded-xl font-black text-[10px] uppercase tracking-wider border-rose-500/40 text-rose-400 hover:bg-rose-500/20 gap-1 bg-zinc-950"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Reject Request
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openActionDialog(s, "refund")}
                              className="rounded-xl font-black text-[10px] uppercase tracking-wider border-amber-500/40 text-amber-400 hover:bg-amber-500/20 gap-1 bg-zinc-950"
                            >
                              Refund Fee
                            </Button>
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

        {/* Action Confirmation & Instruction / Fee Refund Modal */}
        {selectedStudent && actionType && (
          <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
            <DialogContent className="max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-100 shadow-2xl p-6">
              <DialogHeader className="border-b border-zinc-800 pb-3">
                <DialogTitle className="font-black uppercase tracking-tight text-lg flex items-center gap-2 text-zinc-100">
                  <MessageSquare className="w-5 h-5 text-amber-400" />
                  {actionType === "approve"
                    ? "Approve Student Center Allotment"
                    : actionType === "reject"
                    ? "Reject Registration Request"
                    : "Process Registration Fee Refund"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-3">
                <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-1 text-xs font-bold">
                  <p className="text-zinc-200">
                    Student: <span className="text-amber-400">{selectedStudent.full_name || selectedStudent.fullName || selectedStudent.username}</span>
                  </p>
                  <p className="text-zinc-400">Course: {selectedStudent.course || "General"}</p>
                </div>

                {actionType === "refund" && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                        Refund Amount (₹):
                      </label>
                      <input
                        type="number"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(Number(e.target.value))}
                        className="w-full p-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-xs font-bold text-zinc-100 focus:border-amber-500 outline-none"
                        placeholder="Enter refund amount..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                        Refund Reason:
                      </label>
                      <input
                        type="text"
                        value={refundReason}
                        onChange={(e) => setRefundReason(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-xs font-medium text-zinc-100 focus:border-amber-500 outline-none"
                        placeholder="Enter reason for refund..."
                      />
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    Admin Instructions / Remarks:
                  </label>
                  <textarea
                    rows={3}
                    value={adminInstruction}
                    onChange={(e) => setAdminInstruction(e.target.value)}
                    placeholder="Enter instructions (e.g., 'Verify 10th DMC original on joining', 'Shift to Priority 2 center')..."
                    className="w-full p-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-xs font-medium text-zinc-100 focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <DialogFooter className="border-t border-zinc-800 pt-3 gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedStudent(null)}
                  className="rounded-xl font-bold text-xs uppercase tracking-widest border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-800"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmAction}
                  disabled={processing}
                  className={`rounded-xl font-black text-xs uppercase tracking-widest gap-2 text-white ${
                    actionType === "approve"
                      ? "bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/10"
                      : actionType === "reject"
                      ? "bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/10"
                      : "bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-600/10"
                  }`}
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : actionType === "approve" ? (
                    "Confirm Accept"
                  ) : actionType === "reject" ? (
                    "Confirm Reject"
                  ) : (
                    "Confirm Fee Refund"
                  )}
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

