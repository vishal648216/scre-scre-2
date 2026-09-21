import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Circle, Eye, CheckCircle2, XCircle, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

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
        toast.error("Failed to load request");
      }
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
        toast.success(data.message || "Updated");
        setSelectedId(null);
        setDetail(null);
        fetchList();
      } else {
        toast.error(data.message || "Failed");
      }
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
        <div>
          <h1 className="text-2xl font-bold">Center Requests</h1>
          <p className="text-sm text-muted-foreground">Marks change requests from examination centers</p>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Circle className="w-3 h-3 fill-red-500 text-red-500" />
          <span>Red Dot = New Request</span>
        </div>

        <Card>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Label className="text-xs font-bold uppercase">Search</Label>
              <Input
                placeholder="Center, student, enrollment, request ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchList()}
              />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase">Filter</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="not_responded">Not Responded</SelectItem>
                  <SelectItem value="responded">Responded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={fetchList} className="w-full">Search</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-bold uppercase">Requests</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-3 text-left w-8"></th>
                    <th className="p-3 text-left">Request ID</th>
                    <th className="p-3 text-left">Center Name</th>
                    <th className="p-3 text-left">Student Name</th>
                    <th className="p-3 text-left">Enrollment No</th>
                    <th className="p-3 text-left">Course</th>
                    <th className="p-3 text-left">Request Date</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b">
                      <td className="p-3">
                        {row.is_new && <Circle className="w-2.5 h-2.5 fill-red-500 text-red-500" />}
                      </td>
                      <td className="p-3 font-mono text-xs">{row.id.slice(-8)}</td>
                      <td className="p-3">{row.center_name}</td>
                      <td className="p-3">{row.student_name}</td>
                      <td className="p-3">{row.enrollment_number || "—"}</td>
                      <td className="p-3">{row.course_name}</td>
                      <td className="p-3">{new Date(row.request_date).toLocaleDateString()}</td>
                      <td className="p-3 capitalize">{row.status}</td>
                      <td className="p-3">
                        <Button size="sm" variant="outline" onClick={() => openDetail(row.id)}>
                          <Eye className="w-4 h-4 mr-1" /> View
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No requests found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedId} onOpenChange={(o) => !o && (setSelectedId(null), setDetail(null))}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Request Details</DialogTitle>
            </DialogHeader>
            {detailLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
            ) : detail ? (
              <div className="space-y-6 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground">Center</p>
                    <p className="font-medium">{detail.center?.name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{detail.center?.code}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground">Student</p>
                    <p className="font-medium">{detail.student?.full_name || detail.student?.username}</p>
                    <p className="text-xs">{detail.student?.enrollment_number}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Request Reason</p>
                  <p className="p-3 bg-muted/40 rounded border">{detail.request?.reason}</p>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => downloadRegistration(detail.student?._id || detail.student?.id)}>
                    <Download className="w-4 h-4 mr-1" /> Download Registration Form
                  </Button>
                </div>

                {detail.marks && (
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground mb-2">
                      Marks (Attempt {detail.request?.attempt_number})
                    </p>
                    <div className="border rounded overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="p-2 text-left">Subject</th>
                            <th className="p-2 text-right">Obtained</th>
                            <th className="p-2 text-right">Total</th>
                            <th className="p-2 text-right">Passed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(detail.marks.subject_marks || []).map((sm: any, i: number) => (
                            <tr key={i} className="border-t">
                              <td className="p-2 font-mono">{typeof sm.subject_id === "object" ? sm.subject_id.$oid : sm.subject_id}</td>
                              <td className="p-2 text-right">{sm.obtained?.toFixed?.(1) ?? sm.obtained}</td>
                              <td className="p-2 text-right">{sm.total?.toFixed?.(1) ?? sm.total}</td>
                              <td className="p-2 text-right">{sm.subject_passed ? "Yes" : "No"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="p-3 bg-muted/30 grid grid-cols-3 gap-2 text-xs">
                        <span>Total: {detail.marks.total_obtained?.toFixed?.(1)} / {detail.marks.total_marks?.toFixed?.(1)}</span>
                        <span>%: {detail.marks.percentage?.toFixed?.(1)}%</span>
                        <span className="capitalize">Result: {detail.marks.overall_result}</span>
                      </div>
                    </div>
                  </div>
                )}

                {detail.attempt_history?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Attempt History</p>
                    <div className="space-y-2">
                      {detail.attempt_history.map((a: any) => (
                        <div key={a.attempt_number} className="p-2 border rounded text-xs flex justify-between">
                          <span>Attempt {a.attempt_number}</span>
                          <span className="capitalize">{a.overall_result || "pending"}</span>
                          <span>{a.marks_submitted ? "Submitted" : "Open"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detail.request?.status === "pending" && (
                  <div>
                    <Label className="text-xs">Admin Response (optional)</Label>
                    <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2} />
                  </div>
                )}
              </div>
            ) : null}

            {detail?.request?.status === "pending" && (
              <DialogFooter className="gap-2">
                <Button variant="destructive" disabled={processing} onClick={() => handleRespond("disapprove")}>
                  <XCircle className="w-4 h-4 mr-1" /> Disapprove
                </Button>
                <Button disabled={processing} onClick={() => handleRespond("approve")}>
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
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
