import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Send,
  User,
  Search,
  FileText,
  Loader2,
  Award,
  Clock,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Filter,
  ShieldCheck,
  Building2,
  Sparkles,
  Inbox,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface Student {
  _id: string | { $oid: string };
  username: string;
  fullName?: string;
  course?: string;
  rollNo?: string;
  center_name?: string;
}

interface DocumentRequest {
  _id: string | { $oid: string };
  student_id: string | { $oid: string };
  document_type: string;
  student_name: string;
  course_name: string;
  notes?: string;
  status: string;
  created_at: string;
}

const toId = (v: any): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "$oid" in v) return v.$oid;
  return String(v || "");
};

const CenterDocumentRequestPage = () => {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [requestType, setDocumentType] = useState<string>("certificate");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [docTypeFilter, setDocTypeFilter] = useState<string>("all");

  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  const role = (user.role || "").toLowerCase().replace(" ", "");
  const isAdmin = role === "admin" || role === "superadmin";

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        const rRes = await apiFetch("/api/document-requests");
        if (rRes.ok) setRequests(await rRes.json());
      } else {
        const [sRes, rRes] = await Promise.all([
          apiFetch("/api/students"),
          apiFetch("/api/document-requests")
        ]);
        
        if (sRes.ok) setStudents(await sRes.json());
        if (rRes.ok) setRequests(await rRes.json());
      }
    } catch (error) {
      toast.error("Failed to load document requests data");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await apiFetch(`/api/document-requests/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        toast.success(`Request marked as ${newStatus}`);
        fetchInitialData();
      } else {
        toast.error("Failed to update request status");
      }
    } catch (error) {
      toast.error("An error occurred while updating status");
    }
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      toast.error("Please select a student first");
      return;
    }

    setSending(true);
    try {
      const res = await apiFetch("/api/document-requests", {
        method: "POST",
        body: JSON.stringify({
          student_id: toId(selectedStudent._id),
          document_type: requestType,
          notes: notes || undefined
        })
      });

      if (res.ok) {
        toast.success("Document request dispatched to Head Office successfully");
        setNotes("");
        setSelectedStudent(null);
        fetchInitialData();
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to submit document request");
      }
    } catch (error) {
      toast.error("An error occurred while submitting request");
    } finally {
      setSending(false);
    }
  };

  const filteredStudents = students.filter(s =>
    (s.fullName || "").toLowerCase().includes(search.toLowerCase()) ||
    s.username.toLowerCase().includes(search.toLowerCase()) ||
    (s.course || "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredRequests = requests.filter(r => {
    const matchesStatus = statusFilter === "all" || r.status.toLowerCase() === statusFilter;
    const matchesDocType = docTypeFilter === "all" || r.document_type.toLowerCase() === docTypeFilter;
    const matchesSearch =
      (r.student_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.course_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.document_type || "").toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesDocType && matchesSearch;
  });

  const totalRequests = requests.length;
  const pendingCount = requests.filter(r => r.status.toLowerCase() === "pending").length;
  const approvedCount = requests.filter(r => r.status.toLowerCase() === "approved").length;
  const rejectedCount = requests.filter(r => r.status.toLowerCase() === "rejected").length;

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12 text-zinc-100">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/90 p-6 rounded-2xl border border-zinc-800 shadow-xl backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                Document Dispatch Gateway
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
              Document Requests & Verification
            </h1>
            <p className="text-zinc-400 text-xs mt-1">
              {isAdmin
                ? "Review, approve, and process official document requests submitted by center branches."
                : "Submit official requests for certificates, marksheets, and student identity documents."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchInitialData}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-2"
            >
              <Clock className="w-3.5 h-3.5" />
              Refresh Status
            </button>
          </div>
        </div>

        {/* Top KPI Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-zinc-700 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Requests</p>
                <h3 className="text-2xl font-bold text-white mt-1">{totalRequests}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-3 text-[11px] text-zinc-500 flex items-center gap-1.5">
              <span>All active & archived document requests</span>
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-amber-500/30 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-amber-400 uppercase tracking-wider">Pending Review</p>
                <h3 className="text-2xl font-bold text-amber-300 mt-1">{pendingCount}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
            </div>
            <div className="mt-3 text-[11px] text-amber-500/80 flex items-center gap-1.5">
              <span>Awaiting Head Office verification</span>
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/30 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Approved & Ready</p>
                <h3 className="text-2xl font-bold text-emerald-300 mt-1">{approvedCount}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-3 text-[11px] text-emerald-500/80 flex items-center gap-1.5">
              <span>Verified & generated by Admin</span>
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-rose-500/30 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-rose-400 uppercase tracking-wider">Rejected</p>
                <h3 className="text-2xl font-bold text-rose-300 mt-1">{rejectedCount}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
                <XCircle className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-3 text-[11px] text-rose-500/80 flex items-center gap-1.5">
              <span>Requires correction or re-submission</span>
            </div>
          </div>
        </div>

        {/* Workspace Layout Grid */}
        <div className={cn("grid gap-6", isAdmin ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-12")}>
          
          {/* Left Column: Student Selection & Request Generator (Center View Only) */}
          {!isAdmin && (
            <div className="lg:col-span-4 space-y-6">
              <Card className="bg-zinc-900/90 border-zinc-800 text-zinc-100 rounded-2xl shadow-xl overflow-hidden">
                <CardHeader className="bg-zinc-950/60 border-b border-zinc-800/80 py-4 px-5">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Send className="w-4 h-4 text-emerald-400" />
                      1. Select Student
                    </span>
                    <span className="text-[10px] text-zinc-500 normal-case font-normal">Step 1 of 2</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search student by name or roll..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                    {loading ? (
                      <div className="py-8 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                        Loading enrolled students...
                      </div>
                    ) : filteredStudents.length === 0 ? (
                      <div className="py-8 text-center text-xs text-zinc-500">
                        No students match search filter
                      </div>
                    ) : (
                      filteredStudents.map((s) => {
                        const isSelected = selectedStudent && toId(selectedStudent._id) === toId(s._id);
                        return (
                          <div
                            key={toId(s._id)}
                            onClick={() => setSelectedStudent(s)}
                            className={cn(
                              "p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between",
                              isSelected
                                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-200 shadow-md"
                                : "bg-zinc-950/50 border-zinc-800/80 hover:border-zinc-700 text-zinc-300"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold",
                                isSelected ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-300"
                              )}>
                                <User className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-zinc-100">{s.fullName || s.username}</p>
                                <p className="text-[10px] text-zinc-400">{s.course || "General Enrolment"}</p>
                              </div>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Form Card */}
              <Card className="bg-zinc-900/90 border-zinc-800 text-zinc-100 rounded-2xl shadow-xl overflow-hidden">
                <CardHeader className="bg-zinc-950/60 border-b border-zinc-800/80 py-4 px-5">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                    2. Request Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  {!selectedStudent ? (
                    <div className="py-8 text-center space-y-2">
                      <Inbox className="w-8 h-8 text-zinc-600 mx-auto" />
                      <p className="text-xs text-zinc-400 font-medium">Select a student above to construct request</p>
                    </div>
                  ) : (
                    <form onSubmit={handleSendRequest} className="space-y-4">
                      <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-1">
                        <span className="text-[10px] uppercase font-bold text-zinc-500">Selected Candidate</span>
                        <p className="text-xs font-semibold text-emerald-400">{selectedStudent.fullName || selectedStudent.username}</p>
                        <p className="text-[10px] text-zinc-400">Course: {selectedStudent.course || "N/A"}</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-300">Document Type</label>
                        <select
                          value={requestType}
                          onChange={(e) => setDocumentType(e.target.value)}
                          className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="certificate">Course Completion Certificate</option>
                          <option value="marksheet">Official Grade Marksheet</option>
                          <option value="id_card">Student Identity Card</option>
                          <option value="transcript">Academic Transcript</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-300">Notes / Priority Reason</label>
                        <textarea
                          rows={3}
                          placeholder="Provide details or reasons for fast-track processing..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 placeholder-zinc-600 resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={sending}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Submit Request to Head Office
                      </button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Right Column: Filterable Document Requests Ledger */}
          <div className={cn("space-y-4", isAdmin ? "w-full" : "lg:col-span-8")}>
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
              {/* Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
                <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                      statusFilter === "all" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    All ({totalRequests})
                  </button>
                  <button
                    onClick={() => setStatusFilter("pending")}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
                      statusFilter === "pending" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    Pending ({pendingCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter("approved")}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
                      statusFilter === "approved" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    Approved ({approvedCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter("rejected")}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
                      statusFilter === "rejected" ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" : "text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    Rejected ({rejectedCount})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={docTypeFilter}
                    onChange={(e) => setDocTypeFilter(e.target.value)}
                    className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-zinc-700"
                  >
                    <option value="all">All Document Types</option>
                    <option value="certificate">Certificate</option>
                    <option value="marksheet">Marksheet</option>
                    <option value="id_card">ID Card</option>
                    <option value="transcript">Transcript</option>
                  </select>
                </div>
              </div>

              {/* Document Requests Table / List */}
              <div className="space-y-3">
                {loading ? (
                  <div className="py-12 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                    Fetching document request ledger...
                  </div>
                ) : filteredRequests.length === 0 ? (
                  <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/40">
                    <FileText className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-zinc-400">No document requests found matching current criteria</p>
                    <p className="text-[11px] text-zinc-500 mt-1">Try resetting the status tab or search filter</p>
                  </div>
                ) : (
                  filteredRequests.map((r) => {
                    const isPending = r.status.toLowerCase() === "pending";
                    const isApproved = r.status.toLowerCase() === "approved";
                    const isRejected = r.status.toLowerCase() === "rejected";

                    return (
                      <div
                        key={toId(r._id)}
                        className="bg-zinc-950/60 border border-zinc-800/90 hover:border-zinc-700 rounded-2xl p-4 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
                      >
                        <div className="flex items-start gap-3.5">
                          <div className={cn(
                            "w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5",
                            r.document_type.toLowerCase() === "certificate" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                            r.document_type.toLowerCase() === "marksheet" ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                            "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          )}>
                            {r.document_type.toLowerCase() === "certificate" ? <Award className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-zinc-100">{r.student_name}</h4>
                              <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-300 rounded-md">
                                {r.document_type}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              Course: <span className="text-zinc-300 font-medium">{r.course_name}</span>
                            </p>
                            <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-2">
                              <span>Requested: {new Date(r.created_at).toLocaleDateString()}</span>
                              {r.notes && (
                                <span className="text-zinc-400 italic bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                                  "{r.notes}"
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge & Actions */}
                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                          <span className={cn(
                            "px-3 py-1 text-xs font-semibold rounded-full border flex items-center gap-1.5",
                            isPending && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                            isApproved && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                            isRejected && "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          )}>
                            {isPending && <Clock className="w-3 h-3" />}
                            {isApproved && <CheckCircle2 className="w-3 h-3" />}
                            {isRejected && <XCircle className="w-3 h-3" />}
                            {r.status.toUpperCase()}
                          </span>

                          {isAdmin && isPending && (
                            <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-800">
                              <button
                                onClick={() => handleUpdateStatus(toId(r._id), "approved")}
                                className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-xl text-xs font-semibold transition-all flex items-center gap-1"
                                title="Approve Request"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Approve
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(toId(r._id), "rejected")}
                                className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl text-xs font-semibold transition-all flex items-center gap-1"
                                title="Reject Request"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
};

export default CenterDocumentRequestPage;

