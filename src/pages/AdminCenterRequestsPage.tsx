import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  CheckCircle2, XCircle, Clock, Eye, Loader2, ArrowRight,
  Building2, MapPin, Phone, User, FileText, Users, MessageSquare, Filter
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CenterRegRequest {
  id: string;
  name: string;
  code: string;
  owner_name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  active: boolean;
  approval_status?: string;
}

interface UpdateRequest {
  _id: string;
  center_id: string;
  old_data: any;
  new_data: any;
  status: string;
  requested_at: string;
  admin_notes?: string;
}

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
}

const toId = (v: any): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "$oid" in v) return v.$oid;
  return String(v || "");
};

const AdminCenterRequestsPage = () => {
  const [activeTab, setActiveTab] = useState<"centers" | "students" | "updates">("centers");

  // Centers Data
  const [centerRequests, setCenterRequests] = useState<CenterRegRequest[]>([]);
  const [loadingCenters, setLoadingCenters] = useState(true);

  // Updates Data
  const [updateRequests, setUpdateRequests] = useState<UpdateRequest[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(true);
  const [selectedUpdate, setSelectedUpdate] = useState<UpdateRequest | null>(null);
  const [updateNotes, setUpdateNotes] = useState("");

  // Students Data
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [studentActionType, setStudentActionType] = useState<"approve" | "reject" | null>(null);
  const [adminInstruction, setAdminInstruction] = useState("");

  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchCenterRequests();
    fetchUpdateRequests();
    fetchStudentRequests();
  }, []);

  const fetchCenterRequests = async () => {
    setLoadingCenters(true);
    try {
      const res = await apiFetch("/api/admin/centers/pending");
      if (res.ok) {
        const j = await res.json();
        setCenterRequests(j.data || []);
      }
    } catch {
      toast.error("Failed to load center requests");
    } finally {
      setLoadingCenters(false);
    }
  };

  const fetchUpdateRequests = async () => {
    setLoadingUpdates(true);
    try {
      const res = await apiFetch("/api/center-updates");
      if (res.ok) setUpdateRequests(await res.json());
    } catch {
      toast.error("Failed to load center updates");
    } finally {
      setLoadingUpdates(false);
    }
  };

  const fetchStudentRequests = async () => {
    setLoadingStudents(true);
    try {
      const res = await apiFetch("/api/students");
      if (res.ok) {
        const data = await res.json();
        setStudents(Array.isArray(data) ? data : []);
      }
    } catch {
      toast.error("Failed to load student requests");
    } finally {
      setLoadingStudents(false);
    }
  };

  // Center Approval Handlers
  const handleProcessCenter = async (centerId: string, action: "approve" | "reject") => {
    setProcessing(true);
    try {
      const endpoint = action === "approve" 
        ? `/api/admin/centers/${centerId}/approve-registration` 
        : `/api/admin/centers/${centerId}/reject-registration`;

      const res = await apiFetch(endpoint, { method: "POST" });
      if (res.ok) {
        toast.success(`Center ${action === "approve" ? "approved & setup completed" : "rejected"}`);
        fetchCenterRequests();
      } else {
        toast.error("Failed to process center action");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setProcessing(false);
    }
  };

  // Profile Update Processing Handler
  const handleProcessUpdate = async (status: "approved" | "rejected") => {
    if (!selectedUpdate) return;
    setProcessing(true);
    try {
      const res = await apiFetch(`/api/center-updates/${selectedUpdate._id}/process`, {
        method: "PATCH",
        body: JSON.stringify({ status, admin_notes: updateNotes })
      });
      if (res.ok) {
        toast.success(`Update request ${status} successfully`);
        setSelectedUpdate(null);
        setUpdateNotes("");
        fetchUpdateRequests();
      } else {
        const d = await res.json();
        toast.error(d.message || "Failed to process request");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setProcessing(false);
    }
  };

  // Student Action Handler
  const handleProcessStudent = async () => {
    if (!selectedStudent || !studentActionType) return;
    const sid = toId(selectedStudent._id || selectedStudent.id);
    setProcessing(true);
    try {
      const endpoint = studentActionType === "approve"
        ? `/api/admin/students/${sid}/approve`
        : `/api/admin/students/${sid}/reject`;

      const res = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          instructions: adminInstruction,
          student_id: sid,
        }),
      });

      if (res.ok) {
        toast.success(studentActionType === "approve" ? "Student approved & assigned to center" : "Student request rejected");
        setSelectedStudent(null);
        setStudentActionType(null);
        fetchStudentRequests();
      } else {
        toast.error("Failed to process student request");
      }
    } catch {
      toast.error("Error processing request");
    } finally {
      setProcessing(false);
    }
  };

  const getDiff = (oldData: any, newData: any) => {
    const changes: any = {};
    if (!oldData || !newData) return changes;
    Object.keys(newData).forEach(key => {
      if (typeof newData[key] === 'object' && newData[key] !== null && !Array.isArray(newData[key])) {
        const nested = getDiff(oldData[key] || {}, newData[key]);
        if (Object.keys(nested).length > 0) changes[key] = nested;
      } else if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        changes[key] = { old: oldData[key], new: newData[key] };
      }
    });
    return changes;
  };

  const pendingStudents = students.filter(s => {
    const st = (s.approval_status || s.status || "pending").toLowerCase();
    return !st.includes("accept") && !st.includes("approve") && st !== "active" && !st.includes("reject");
  });

  const pendingCentersCount = centerRequests.filter(c => !c.active).length;
  const pendingStudentsCount = pendingStudents.length;
  const pendingUpdatesCount = updateRequests.filter(u => u.status === "pending").length;

  return (
    <DashboardLayout role="Admin">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight flex items-center gap-3">
            <Building2 className="w-8 h-8 text-primary" />
            Requests & Approvals Desk
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Review and approve new center registrations, student admission requests, and center profile updates.
          </p>
        </div>

        {/* Executive KPI Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="rounded-2xl border-zinc-800 bg-zinc-900/90 shadow-xl backdrop-blur-xl hover:border-zinc-700 transition-all">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Pending Center Registrations</p>
                <h3 className="text-2xl font-black text-amber-400 mt-1">{pendingCentersCount}</h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">Awaiting initial approval</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Building2 className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-zinc-800 bg-zinc-900/90 shadow-xl backdrop-blur-xl hover:border-zinc-700 transition-all">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Pending Student Admissions</p>
                <h3 className="text-2xl font-black text-sky-400 mt-1">{pendingStudentsCount}</h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">Center allocation requests</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Users className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-zinc-800 bg-zinc-900/90 shadow-xl backdrop-blur-xl hover:border-zinc-700 transition-all">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Center Profile Updates</p>
                <h3 className="text-2xl font-black text-violet-400 mt-1">{pendingUpdatesCount}</h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">Franchise modification requests</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                <FileText className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-zinc-900/90 border border-zinc-800 p-1.5 shadow-xl backdrop-blur-xl">
          <button
            onClick={() => setActiveTab("centers")}
            className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-all rounded-xl flex items-center gap-2.5 ${
              activeTab === "centers"
                ? "bg-primary text-primary-foreground font-black shadow-lg shadow-primary/20"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60"
            }`}
          >
            <Building2 className="w-4 h-4" />
            New Center Registrations ({pendingCentersCount})
          </button>
          
          <button
            onClick={() => setActiveTab("students")}
            className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-all rounded-xl flex items-center gap-2.5 ${
              activeTab === "students"
                ? "bg-primary text-primary-foreground font-black shadow-lg shadow-primary/20"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60"
            }`}
          >
            <Users className="w-4 h-4" />
            Student Admission Requests ({pendingStudentsCount})
          </button>

          <button
            onClick={() => setActiveTab("updates")}
            className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-all rounded-xl flex items-center gap-2.5 ${
              activeTab === "updates"
                ? "bg-primary text-primary-foreground font-black shadow-lg shadow-primary/20"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60"
            }`}
          >
            <FileText className="w-4 h-4" />
            Center Profile Updates ({pendingUpdatesCount})
          </button>
        </div>

        {/* TAB 1: NEW CENTER REGISTRATIONS */}
        {activeTab === "centers" && (
          <div className="space-y-4">
            {loadingCenters ? (
              <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
            ) : centerRequests.length === 0 ? (
              <Card className="rounded-2xl border-dashed border-2 border-zinc-800 bg-zinc-900/40 p-20 text-center">
                <Clock className="w-12 h-12 text-zinc-500 mx-auto mb-4 opacity-30" />
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">No center registration requests found</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {centerRequests.map(c => (
                  <Card key={c.id} className="rounded-2xl border-zinc-800 bg-zinc-900/90 shadow-xl backdrop-blur-xl hover:border-zinc-700 transition-all">
                    <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0 mt-1 text-primary">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-base font-bold tracking-tight text-zinc-100">{c.name}</h3>
                            <span className={cn(
                              "px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border",
                              c.active ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            )}>
                              {c.active ? "ACTIVE CENTER" : "PENDING APPROVAL"}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400">
                            Code: <span className="text-zinc-200 font-semibold">{c.code}</span> • Owner: <span className="text-zinc-200 font-semibold">{c.owner_name}</span>
                          </p>
                          <p className="text-xs text-zinc-400 flex items-center gap-4 mt-1">
                            <span><Phone className="w-3.5 h-3.5 inline mr-1 text-zinc-500" />{c.phone}</span>
                            <span><MapPin className="w-3.5 h-3.5 inline mr-1 text-primary" />{c.city}, {c.state}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full md:w-auto">
                        {!c.active && (
                          <Button
                            disabled={processing}
                            onClick={() => handleProcessCenter(c.id, "approve")}
                            className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider gap-2 shadow-lg shadow-emerald-600/20"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Approve & Setup
                          </Button>
                        )}
                        <Button
                          disabled={processing}
                          variant="outline"
                          onClick={() => handleProcessCenter(c.id, "reject")}
                          className="flex-1 md:flex-none border-rose-500/40 text-rose-400 bg-rose-500/10 hover:bg-rose-600 hover:text-white rounded-xl font-bold text-xs uppercase tracking-wider gap-2"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: STUDENT ADMISSION REQUESTS */}
        {activeTab === "students" && (
          <div className="space-y-4">
            {loadingStudents ? (
              <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
            ) : pendingStudents.length === 0 ? (
              <Card className="rounded-2xl border-dashed border-2 border-zinc-800 bg-zinc-900/40 p-20 text-center">
                <Users className="w-12 h-12 text-zinc-500 mx-auto mb-4 opacity-30" />
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">No pending student admission requests</p>
              </Card>
            ) : (
              <Card className="rounded-2xl border-zinc-800 bg-zinc-900/90 shadow-xl overflow-hidden backdrop-blur-xl">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-950/80 text-zinc-400 uppercase text-[11px] font-bold tracking-wider">
                          <th className="py-4 px-6">Student Details</th>
                          <th className="py-4 px-6">Course Enrolled</th>
                          <th className="py-4 px-6">Priority Center Choices</th>
                          <th className="py-4 px-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {pendingStudents.map(s => {
                          const sid = toId(s._id || s.id);
                          const name = s.full_name || s.fullName || s.username;
                          const p1Name = s.priority_centers?.[0] || s.center_name || "Center 1";
                          const p2Name = s.priority_centers?.[1] || "Center 2";
                          const p3Name = s.priority_centers?.[2] || "Center 3";
                          const curP = s.current_priority || 1;

                          return (
                            <tr key={sid} className="hover:bg-zinc-800/40 transition-colors">
                              <td className="py-4 px-6 font-medium">
                                <div className="font-bold text-sm text-zinc-100">{name}</div>
                                <span className="text-[10px] text-zinc-400 font-mono">@{s.username}</span>
                              </td>
                              <td className="py-4 px-6 font-bold uppercase text-primary">
                                {s.course || "General"}
                              </td>
                              <td className="py-4 px-6 space-y-1">
                                <div className="flex items-center gap-1.5 text-[10px] font-semibold">
                                  <span className={`px-2.5 py-1 rounded-md border ${curP === 1 ? "bg-amber-500/15 text-amber-300 border-amber-500/30 font-bold" : "bg-zinc-950/60 text-zinc-400 border-zinc-800"}`}>
                                    P1: {p1Name}
                                  </span>
                                  <ArrowRight className="w-3 h-3 text-zinc-600" />
                                  <span className={`px-2.5 py-1 rounded-md border ${curP === 2 ? "bg-amber-500/15 text-amber-300 border-amber-500/30 font-bold" : "bg-zinc-950/60 text-zinc-400 border-zinc-800"}`}>
                                    P2: {p2Name}
                                  </span>
                                  <ArrowRight className="w-3 h-3 text-zinc-600" />
                                  <span className={`px-2.5 py-1 rounded-md border ${curP === 3 ? "bg-amber-500/15 text-amber-300 border-amber-500/30 font-bold" : "bg-zinc-950/60 text-zinc-400 border-zinc-800"}`}>
                                    P3: {p3Name}
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-6 text-right space-x-2">
                                <Button
                                  size="sm"
                                  onClick={() => { setSelectedStudent(s); setStudentActionType("approve"); setAdminInstruction(""); }}
                                  className="rounded-xl font-bold text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-md shadow-emerald-600/20"
                                >
                                  <CheckCircle2 className="w-4 h-4" /> Accept & Allot
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setSelectedStudent(s); setStudentActionType("reject"); setAdminInstruction(""); }}
                                  className="rounded-xl font-bold text-xs uppercase tracking-wider border-rose-500/40 text-rose-400 bg-rose-500/10 hover:bg-rose-600 hover:text-white gap-1.5"
                                >
                                  <XCircle className="w-4 h-4" /> Reject
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* TAB 3: PROFILE UPDATES */}
        {activeTab === "updates" && (
          <div className="space-y-4">
            {loadingUpdates ? (
              <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
            ) : updateRequests.length === 0 ? (
              <Card className="rounded-2xl border-dashed border-2 border-zinc-800 bg-zinc-900/40 p-20 text-center">
                <Clock className="w-12 h-12 text-zinc-500 mx-auto mb-4 opacity-30" />
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">No profile update requests found</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {updateRequests.map(r => (
                  <Card key={r._id} className="rounded-2xl border-zinc-800 bg-zinc-900/90 shadow-xl backdrop-blur-xl hover:border-zinc-700 transition-all">
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 bg-primary/10 flex items-center justify-center border border-primary/20 rounded-xl text-primary">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-zinc-100">{r.old_data?.name || "Center"}</h3>
                          <p className="text-xs font-medium text-zinc-400 mt-0.5">
                            Code: <span className="text-zinc-200">{r.old_data?.code || "—"}</span> • Requested: {new Date(r.requested_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={cn(
                          "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border",
                          r.status === "pending" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : 
                          r.status === "approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : 
                          "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        )}>
                          {r.status}
                        </span>
                        <button 
                          onClick={() => setSelectedUpdate(r)}
                          className="p-2.5 bg-zinc-950/60 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-all rounded-xl"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Profile Update Review Dialog */}
        <Dialog open={!!selectedUpdate} onOpenChange={() => setSelectedUpdate(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-none border-border">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Review Profile Update Request</DialogTitle>
            </DialogHeader>
            
            {selectedUpdate && (
              <div className="space-y-8 py-6">
                <div className="grid grid-cols-2 gap-8">
                  {Object.entries(getDiff(selectedUpdate.old_data, selectedUpdate.new_data)).map(([key, value]: [string, any]) => (
                    <div key={key} className="col-span-2 space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{key.replace(/_/g, ' ')}</label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-rose-500/5 border border-rose-500/10 space-y-2">
                          <p className="text-[8px] font-black uppercase text-rose-600">Old Value</p>
                          {key.includes('url') ? (
                            <img src={value.old} className="h-20 object-contain" alt="Old" />
                          ) : (
                            <p className="text-xs font-bold text-muted-foreground">{JSON.stringify(value.old) || 'Empty'}</p>
                          )}
                        </div>
                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 space-y-2">
                          <p className="text-[8px] font-black uppercase text-emerald-600">New Value</p>
                          {key.includes('url') ? (
                            <img src={value.new} className="h-20 object-contain" alt="New" />
                          ) : (
                            <p className="text-xs font-bold text-foreground">{JSON.stringify(value.new) || 'Empty'}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-4 border-t border-border">
                  <label className="text-[10px] font-black uppercase tracking-widest">Admin Notes (Reason for approval/rejection)</label>
                  <textarea 
                    className="w-full p-4 border border-border bg-muted/20 text-sm font-bold resize-none outline-none focus:border-primary" 
                    rows={3} 
                    value={updateNotes}
                    onChange={(e) => setUpdateNotes(e.target.value)}
                    placeholder="Enter notes for the center..."
                  />
                </div>
              </div>
            )}

            <DialogFooter className="gap-3">
              <Button
                disabled={processing}
                variant="outline"
                onClick={() => handleProcessUpdate("rejected")}
                className="flex-1 border-rose-500/40 text-rose-600 hover:bg-rose-500/10 py-4 font-black uppercase text-[10px] tracking-widest gap-2 rounded-none"
              >
                <XCircle className="w-4 h-4" /> Reject Request
              </Button>
              <Button
                disabled={processing}
                onClick={() => handleProcessUpdate("approved")}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-4 font-black uppercase text-[10px] tracking-widest gap-2 rounded-none"
              >
                <CheckCircle2 className="w-4 h-4" /> Approve & Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Student Action Modal */}
        {selectedStudent && studentActionType && (
          <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
            <DialogContent className="max-w-md rounded-none border-2 border-border p-6">
              <DialogHeader className="border-b border-border pb-3">
                <DialogTitle className="font-black uppercase tracking-tight text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  {studentActionType === "approve" ? "Approve Student Center Allotment" : "Reject Registration Request"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-3">
                <div className="bg-muted/40 p-3 border border-border space-y-1 text-xs font-bold">
                  <p className="text-foreground">Student: <span className="text-primary">{selectedStudent.full_name || selectedStudent.fullName || selectedStudent.username}</span></p>
                  <p className="text-muted-foreground">Course: {selectedStudent.course || "General"}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Admin Instructions / Notes:
                  </label>
                  <textarea
                    rows={3}
                    value={adminInstruction}
                    onChange={(e) => setAdminInstruction(e.target.value)}
                    placeholder="Enter instructions (e.g. 'Verify original marksheets at center')..."
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
                  onClick={handleProcessStudent}
                  disabled={processing}
                  className={`rounded-none font-black text-xs uppercase tracking-widest gap-2 text-white ${
                    studentActionType === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : studentActionType === "approve" ? "Confirm Accept" : "Confirm Reject"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminCenterRequestsPage;
