import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Circle, Eye, CheckCircle2, XCircle, Download, FileCheck, Building, User, Search, Filter, MessageSquare, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RequestRow {
  id: string;
  center_name: string;
  student_name: string;
  enrollment_number?: string;
  course_name: string;
  request_date: string;
  status: string;
  is_new: boolean;
  student_id: string;
  course_id: string;
  attempt_number: number;
}

const AdminExamCenterRequestsPage = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await apiFetch(`/api/exam/center-requests?${params}`);
      if (res.ok) setRows(await res.json());
    } catch {
      toast.error("Failed to load center requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [statusFilter]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setAdminNotes("");
    try {
      const res = await apiFetch(`/api/exam/center-requests/${id}`);
      if (res.ok) {
        setDetail(await res.json());
        fetchList();
      } else {
        toast.error("Failed to load request details");
      }
    } catch {
      toast.error("Failed to load request details");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRespond = async (action: "approve" | "disapprove") => {
    if (!selectedId) return;
    setProcessing(true);
    try {
      const res = await apiFetch(`/api/exam/center-requests/${selectedId}/respond`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, admin_response: adminNotes || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || `Request ${action === "approve" ? "Approved" : "Disapproved"} successfully`);
        setSelectedId(null);
        setDetail(null);
        fetchList();
      } else {
        toast.error(data.message || "Failed to update request");
      }
    } catch {
      toast.error("Error responding to request");
    } finally {
      setProcessing(false);
    }
  };

  const downloadRegistration = async (studentId: string) => {
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/students/${studentId}/enrollment-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `registration_${studentId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.success("Student registration PDF downloaded");
      } else {
        toast.error("Failed to download registration form");
      }
    } catch {
      toast.error("Download failed");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                Center Examination Requests
              </h1>
              <p className="text-xs font-semibold text-slate-400 mt-1">
                Review and approve mark corrections, re-evaluations, and special requests from affiliated centers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 font-mono text-xs px-3 py-1 flex items-center gap-1.5">
              <Circle className="w-2.5 h-2.5 fill-rose-500 text-rose-500 animate-pulse" />
              Red Dot = New Unread Request
            </Badge>
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl backdrop-blur-xl grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 block">Search Query</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search Center, Student Name, Enrollment No..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchList()}
                className="pl-10 bg-slate-950 border-slate-800 text-xs text-white rounded-xl h-10 placeholder:text-slate-500"
              />
            </div>
          </div>

          <div>
            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 block">Status Filter</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl h-10">
                <SelectValue placeholder="All Requests" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                <SelectItem value="all">All Requests</SelectItem>
                <SelectItem value="new">New Requests</SelectItem>
                <SelectItem value="not_responded">Pending Response</SelectItem>
                <SelectItem value="responded">Responded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button onClick={fetchList} className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl h-10 font-bold text-xs flex items-center justify-center gap-2">
              <Filter className="w-4 h-4" />
              Apply Filter
            </Button>
          </div>
        </div>

        {/* Requests Table */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-blue-400" />
              Center Request Roster ({rows.length})
            </h3>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <th className="p-4 text-left w-8"></th>
                    <th className="p-4 text-left">Request ID</th>
                    <th className="p-4 text-left">Examination Center</th>
                    <th className="p-4 text-left">Student Name</th>
                    <th className="p-4 text-left">Enrollment No</th>
                    <th className="p-4 text-left">Course</th>
                    <th className="p-4 text-center">Request Date</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-medium">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-800/30 transition-colors text-slate-200">
                      <td className="p-4 text-center">
                        {row.is_new && <Circle className="w-2.5 h-2.5 fill-rose-500 text-rose-500" />}
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-400">{row.id.slice(-8)}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-white font-extrabold">
                          <Building className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span>{row.center_name}</span>
                        </div>
                      </td>
                      <td className="p-4 font-bold text-white">{row.student_name}</td>
                      <td className="p-4 font-mono text-blue-400">{row.enrollment_number || "N/A"}</td>
                      <td className="p-4 text-slate-300">{row.course_name}</td>
                      <td className="p-4 text-center font-mono text-slate-400">
                        {new Date(row.request_date).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-center">
                        <Badge className={cn(
                          "font-bold text-[10px] uppercase tracking-wider px-2.5 py-0.5 border",
                          row.status === "approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          row.status === "disapproved" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                          "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        )}>
                          {row.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <Button size="sm" variant="outline" onClick={() => openDetail(row.id)} className="rounded-xl border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 font-bold text-xs h-8 px-3">
                          <Eye className="w-3.5 h-3.5 mr-1.5 text-blue-400" /> View Detail
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-12 text-center">
                        <div className="space-y-2">
                          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto opacity-80" />
                          <p className="text-slate-200 font-bold text-sm">No Center Requests Found</p>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto">There are no pending or history requests submitted by examination centers.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Request Detail Modal */}
        <Dialog open={!!selectedId} onOpenChange={(o) => !o && (setSelectedId(null), setDetail(null))}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-950 border border-slate-800 text-slate-100 rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-400" />
                Center Request Details
              </DialogTitle>
            </DialogHeader>

            {detailLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
              </div>
            ) : detail ? (
              <div className="space-y-6 text-xs">
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-900 border border-slate-800 rounded-xl">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Examination Center</p>
                    <p className="font-extrabold text-white text-sm mt-0.5">{detail.center?.name || "—"}</p>
                    <p className="text-[11px] font-mono text-slate-400">Code: {detail.center?.code || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Candidate Student</p>
                    <p className="font-extrabold text-white text-sm mt-0.5">{detail.student?.full_name || detail.student?.username || "N/A"}</p>
                    <p className="text-[11px] font-mono text-blue-400">Enrollment: {detail.student?.enrollment_number || "N/A"}</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Center Request Reason & Remarks</p>
                  <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 leading-relaxed font-medium">
                    {detail.request?.reason || "No detailed reason specified."}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => downloadRegistration(detail.student?._id || detail.student?.id)} className="rounded-xl border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800 font-bold text-xs h-9">
                    <Download className="w-3.5 h-3.5 mr-1.5 text-blue-400" /> Download Candidate Registration Form
                  </Button>
                </div>

                {detail.marks && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase text-slate-400">
                      Existing Marks Entry (Attempt #{detail.request?.attempt_number || 1})
                    </p>
                    <div className="border border-slate-800 bg-slate-900/60 rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-950 font-bold text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="p-2.5 text-left">Subject ID</th>
                            <th className="p-2.5 text-right">Obtained</th>
                            <th className="p-2.5 text-right">Total</th>
                            <th className="p-2.5 text-right">Passed</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80">
                          {(detail.marks.subject_marks || []).map((sm: any, i: number) => (
                            <tr key={i}>
                              <td className="p-2.5 font-mono text-slate-300">{typeof sm.subject_id === "object" ? sm.subject_id.$oid : sm.subject_id}</td>
                              <td className="p-2.5 text-right font-bold text-white">{sm.obtained?.toFixed?.(1) ?? sm.obtained}</td>
                              <td className="p-2.5 text-right text-slate-400">{sm.total?.toFixed?.(1) ?? sm.total}</td>
                              <td className="p-2.5 text-right font-bold">{sm.subject_passed ? <span className="text-emerald-400">Yes</span> : <span className="text-rose-400">No</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="p-3 bg-slate-950 grid grid-cols-3 gap-2 text-xs font-bold text-slate-300">
                        <span>Total: {detail.marks.total_obtained?.toFixed?.(1)} / {detail.marks.total_marks?.toFixed?.(1)}</span>
                        <span>Percentage: {detail.marks.percentage?.toFixed?.(1)}%</span>
                        <span className="capitalize">Result: {detail.marks.overall_result}</span>
                      </div>
                    </div>
                  </div>
                )}

                {detail.request?.status === "pending" && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Admin Response / Feedback Note (Optional)</Label>
                    <Textarea 
                      value={adminNotes} 
                      onChange={(e) => setAdminNotes(e.target.value)} 
                      rows={3} 
                      placeholder="Add response note for center..."
                      className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl"
                    />
                  </div>
                )}
              </div>
            ) : null}

            {detail?.request?.status === "pending" && (
              <DialogFooter className="gap-2 pt-4">
                <Button variant="outline" disabled={processing} onClick={() => handleRespond("disapprove")} className="rounded-xl border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 font-bold text-xs h-10">
                  <XCircle className="w-4 h-4 mr-1.5" /> Disapprove Request
                </Button>
                <Button disabled={processing} onClick={() => handleRespond("approve")} className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-10 shadow-lg shadow-emerald-600/20">
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve Request
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminExamCenterRequestsPage;
