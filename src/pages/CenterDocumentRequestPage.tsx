import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, User, Search, FileText, Loader2, Award, Clock, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface Student {
  _id: string | { $oid: string };
  username: string;
  fullName?: string;
  course?: string;
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
  const [requestType, setDocumentType] = useState<"certificate" | "marksheet">("certificate");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);

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
      toast.error("Failed to load data");
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
        toast.success(`Request ${newStatus} successfully`);
        fetchInitialData();
      } else {
        toast.error("Failed to update status");
      }
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      toast.error("Please select a student");
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
        toast.success("Request sent to Admin successfully");
        setNotes("");
        fetchInitialData(); // Refresh list
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to send request");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setSending(false);
    }
  };

  const filteredStudents = students.filter(s =>
    (s.fullName || "").toLowerCase().includes(search.toLowerCase()) ||
    s.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Document Requests</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              {isAdmin ? "Manage document requests from centers." : "Request certificates or marksheets from the Admin."}
            </p>
          </div>
          {!isAdmin && (
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                placeholder="Search students..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-none text-xs font-bold uppercase tracking-widest focus:border-primary outline-none"
              />
            </div>
          )}
        </div>

        <div className={cn("grid gap-8", isAdmin ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-3")}>
          {/* Student Selection (Center Only) */}
          {!isAdmin && (
            <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {loading ? (
                <div className="flex justify-center py-10 text-xs text-muted-foreground">Loading students...</div>
              ) : filteredStudents.length === 0 ? (
                <p className="text-center py-10 text-xs font-bold uppercase tracking-widest text-muted-foreground">No students found</p>
              ) : (
                filteredStudents.map(s => (
                  <button
                    key={toId(s._id)}
                    onClick={() => setSelectedStudent(s)}
                    className={cn("w-full p-4 border text-left transition-all rounded-none group",
                      selectedStudent && toId(selectedStudent._id) === toId(s._id)
                        ? "bg-primary border-transparent shadow-lg"
                        : "bg-card border-border hover:border-primary/50")}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 flex items-center justify-center border transition-all",
                        selectedStudent && toId(selectedStudent._id) === toId(s._id) ? "bg-white/10 border-white/20" : "bg-primary/5 border-primary/10"
                      )}>
                        <User className={cn("w-5 h-5", selectedStudent && toId(selectedStudent._id) === toId(s._id) ? "text-white" : "text-primary")} />
                      </div>
                      <div>
                        <p className={cn("text-xs font-black uppercase tracking-tight", selectedStudent && toId(selectedStudent._id) === toId(s._id) ? "text-white" : "text-foreground")}>
                          {s.fullName || s.username}
                        </p>
                        <p className={cn("text-[9px] font-bold", selectedStudent && toId(selectedStudent._id) === toId(s._id) ? "text-white/70" : "text-muted-foreground")}>
                          {s.course || "No Course"}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Request Form & History */}
          <div className={cn("space-y-8", isAdmin ? "" : "lg:col-span-2")}>
            {/* Form (Center Only) */}
            {!isAdmin && (
              <Card className="rounded-none border-border shadow-md overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                    <Send className="w-4 h-4 text-primary" />
                    New Document Request
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {!selectedStudent ? (
                    <div className="text-center py-8 opacity-60">
                      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Please select a student from the list</p>
                    </div>
                  ) : (
                    <form onSubmit={handleSendRequest} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest ml-1">Document Type</label>
                          <select
                            className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none"
                            value={requestType}
                            onChange={(e) => setDocumentType(e.target.value as any)}
                          >
                            <option value="certificate">Certificate</option>
                            <option value="marksheet">Marksheet</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest ml-1">Student</label>
                          <div className="px-4 py-3 border border-border bg-muted/20 text-sm font-bold text-muted-foreground">
                            {selectedStudent.fullName || selectedStudent.username}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Special Notes / Reason</label>
                        <textarea
                          className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none min-h-[100px]"
                          placeholder="Explain why you are requesting this document (e.g., special case, correction, etc.)"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={sending}
                          className="bg-primary text-primary-foreground px-10 py-4 rounded-none font-heading font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all flex items-center gap-3 disabled:opacity-50"
                        >
                          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Send Request to Admin
                        </button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Request History / List */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {isAdmin ? "All Document Requests" : "Recent Request History"}
              </h3>
              <div className="space-y-3">
                {loading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : requests.length === 0 ? (
                  <p className="text-center py-10 border border-border border-dashed text-xs font-bold uppercase tracking-widest text-muted-foreground bg-muted/5">
                    No requests found
                  </p>
                ) : (
                  requests.map(r => (
                    <div key={toId(r._id)} className="bg-card border border-border p-4 flex items-center justify-between group hover:border-primary/40 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/10 flex items-center justify-center border border-primary/20">
                          {r.document_type === "certificate" ? <Award className="w-5 h-5 text-primary" /> : <FileText className="w-5 h-5 text-primary" />}
                        </div>
                        <div>
                          <p className="text-sm font-black text-foreground">{r.student_name}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                            {r.document_type} | {r.course_name} | {new Date(r.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "px-3 py-1 text-[9px] font-black uppercase tracking-widest flex items-center gap-1",
                            r.status === "pending" && "bg-amber-500/10 text-amber-600 border border-amber-500/20",
                            r.status === "approved" && "bg-green-500/10 text-green-600 border border-green-500/20",
                            r.status === "rejected" && "bg-red-500/10 text-red-600 border border-red-500/20"
                          )}>
                            {r.status === "pending" && <Clock className="w-3 h-3" />}
                            {r.status === "approved" && <CheckCircle2 className="w-3 h-3" />}
                            {r.status === "rejected" && <XCircle className="w-3 h-3" />}
                            {r.status}
                          </div>
                          {isAdmin && r.status === "pending" && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleUpdateStatus(toId(r._id), "approved")}
                                className="p-1 text-green-600 hover:bg-green-50 transition-colors"
                                title="Approve"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(toId(r._id), "rejected")}
                                className="p-1 text-red-600 hover:bg-red-50 transition-colors"
                                title="Reject"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                        {r.notes && <p className="text-[9px] text-muted-foreground italic max-w-[200px] truncate">"{r.notes}"</p>}
                      </div>
                    </div>
                  ))
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
