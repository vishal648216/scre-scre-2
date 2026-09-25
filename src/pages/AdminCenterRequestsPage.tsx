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
      const token = sessionStorage.getItem("token");
      const res = await fetch("/api/students", { headers: { Authorization: `Bearer ${token}` } });
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
      const token = sessionStorage.getItem("token");
      const endpoint = studentActionType === "approve"
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

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          <button
            onClick={() => setActiveTab("centers")}
            className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border flex items-center gap-2 ${
              activeTab === "centers"
                ? "bg-primary text-primary-foreground border-primary shadow"
                : "bg-muted/40 text-muted-foreground hover:bg-muted border-border"
            }`}
          >
            <Building2 className="w-4 h-4" />
            New Center Registrations ({centerRequests.filter(c => !c.active).length})
          </button>
          
          <button
            onClick={() => setActiveTab("students")}
            className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border flex items-center gap-2 ${
              activeTab === "students"
                ? "bg-primary text-primary-foreground border-primary shadow"
                : "bg-muted/40 text-muted-foreground hover:bg-muted border-border"
            }`}
          >
            <Users className="w-4 h-4" />
            Student Admission Requests ({pendingStudents.length})
          </button>

          <button
            onClick={() => setActiveTab("updates")}
            className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border flex items-center gap-2 ${
              activeTab === "updates"
                ? "bg-primary text-primary-foreground border-primary shadow"
                : "bg-muted/40 text-muted-foreground hover:bg-muted border-border"
            }`}
          >
            <FileText className="w-4 h-4" />
            Center Profile Updates ({updateRequests.filter(u => u.status === "pending").length})
          </button>
        </div>

        {/* TAB 1: NEW CENTER REGISTRATIONS */}
        {activeTab === "centers" && (
          <div className="space-y-4">
            {loadingCenters ? (
              <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
            ) : centerRequests.length === 0 ? (
              <Card className="rounded-none border-dashed border-2 border-border p-20 text-center">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">No center registration requests found</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {centerRequests.map(c => (
                  <Card key={c.id} className="rounded-none border-border hover:border-primary/40 transition-all bg-card">
                    <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0 mt-1">
                          <Building2 className="w-6 h-6 text-primary" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-base font-black uppercase tracking-tight text-foreground">{c.name}</h3>
                            <span className={cn(
                              "px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest border",
                              c.active ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            )}>
                              {c.active ? "ACTIVE CENTER" : "PENDING APPROVAL"}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-muted-foreground">
                            Code: <span className="text-foreground">{c.code}</span> • Owner: <span className="text-foreground">{c.owner_name}</span>
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-4">
                            <span><Phone className="w-3 h-3 inline mr-1" />{c.phone}</span>
                            <span><MapPin className="w-3 h-3 inline mr-1" />{c.city}, {c.state}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full md:w-auto">
                        {!c.active && (
                          <Button
                            disabled={processing}
                            onClick={() => handleProcessCenter(c.id, "approve")}
                            className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white rounded-none font-black text-xs uppercase tracking-wider gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Approve & Setup
                          </Button>
                        )}
                        <Button
                          disabled={processing}
                          variant="outline"
                          onClick={() => handleProcessCenter(c.id, "reject")}
                          className="flex-1 md:flex-none border-rose-500/40 text-rose-600 hover:bg-rose-500/10 rounded-none font-black text-xs uppercase tracking-wider gap-2"
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
              <Card className="rounded-none border-dashed border-2 border-border p-20 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">No pending student admission requests</p>
              </Card>
            ) : (
              <Card className="rounded-none border-border overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-muted/20 text-muted-foreground uppercase text-[10px] font-black tracking-widest">
                          <th className="py-4 px-6">Student Details</th>
                          <th className="py-4 px-6">Course Enrolled</th>
                          <th className="py-4 px-6">Priority Center Choices</th>
                          <th className="py-4 px-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {pendingStudents.map(s => {
                          const sid = toId(s._id || s.id);
                          const name = s.full_name || s.fullName || s.username;
                          const p1Name = s.priority_centers?.[0] || s.center_name || "Center 1";
                          const p2Name = s.priority_centers?.[1] || "Center 2";
                          const p3Name = s.priority_centers?.[2] || "Center 3";
                          const curP = s.current_priority || 1;

                          return (
                            <tr key={sid} className="hover:bg-muted/10 transition-colors">
                              <td className="py-4 px-6 font-bold">
                                <div className="font-black text-sm uppercase text-foreground">{name}</div>
                                <span className="text-[10px] text-muted-foreground font-mono">@{s.username}</span>
                              </td>
                              <td className="py-4 px-6 font-bold uppercase text-primary">
                                {s.course || "General"}
                              </td>
                              <td className="py-4 px-6 space-y-1">
                                <div className="flex items-center gap-1.5 text-[9px] font-bold">
                                  <span className={`px-2 py-0.5 border ${curP === 1 ? "bg-amber-500/20 text-amber-700 border-amber-500/30 font-extrabold" : "bg-muted text-muted-foreground border-transparent"}`}>
                                    P1: {p1Name}
                                  </span>
                                  <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                                  <span className={`px-2 py-0.5 border ${curP === 2 ? "bg-amber-500/20 text-amber-700 border-amber-500/30 font-extrabold" : "bg-muted text-muted-foreground border-transparent"}`}>
                                    P2: {p2Name}
                                  </span>
                                  <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                                  <span className={`px-2 py-0.5 border ${curP === 3 ? "bg-amber-500/20 text-amber-700 border-amber-500/30 font-extrabold" : "bg-muted text-muted-foreground border-transparent"}`}>
                                    P3: {p3Name}
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-6 text-right space-x-2">
                                <Button
                                  size="sm"
                                  onClick={() => { setSelectedStudent(s); setStudentActionType("approve"); setAdminInstruction(""); }}
                                  className="rounded-none font-black text-[10px] uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Accept & Allot
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setSelectedStudent(s); setStudentActionType("reject"); setAdminInstruction(""); }}
                                  className="rounded-none font-black text-[10px] uppercase tracking-wider border-rose-500/40 text-rose-600 hover:bg-rose-500/10 gap-1"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Reject
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
              <Card className="rounded-none border-dashed border-2 border-border p-20 text-center">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">No profile update requests found</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {updateRequests.map(r => (
                  <Card key={r._id} className="rounded-none border-border group hover:border-primary/40 transition-all bg-card">
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 bg-primary/10 flex items-center justify-center border border-primary/20">
                          <Building2 className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black uppercase tracking-tight">{r.old_data?.name || "Center"}</h3>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            Code: {r.old_data?.code || "—"} • Requested: {new Date(r.requested_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={cn(
                          "px-3 py-1 text-[9px] font-black uppercase tracking-widest border",
                          r.status === "pending" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : 
                          r.status === "approved" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : 
                          "bg-rose-500/10 text-rose-600 border-rose-500/20"
                        )}>
                          {r.status}
                        </span>
                        <button 
                          onClick={() => setSelectedUpdate(r)}
                          className="p-2 bg-muted hover:bg-primary hover:text-white transition-all rounded-none"
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
