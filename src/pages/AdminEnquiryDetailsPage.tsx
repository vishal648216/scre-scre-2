import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

interface NoteItem {
  id?: string;
  text: string;
  created_by: string;
  created_at: string;
}

interface EnquiryDetail {
  id: string;
  name: string;
  phone: string;
  email?: string;
  course: string;
  message?: string;
  status: string;
  notes?: string;
  assigned_to?: string;
  next_follow_up_at?: string;
  notes_history: NoteItem[];
  created_at: string;
  updated_at: string;
}

interface AdminUser {
  id: string;
  username: string;
  role: string;
}

const AdminEnquiryDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<EnquiryDetail | null>(null);
  const [status, setStatus] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [noteText, setNoteText] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  const isAdmin = user.role?.toLowerCase() === "admin" || user.role?.toLowerCase() === "superadmin";

  useEffect(() => {
    fetchDetail();
  }, [id]);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/admin/enquiries/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token || ""}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDetail(data);
        setStatus(data.status);
        setAssignedTo(data.assigned_to || "");
        setNextFollowUp(data.next_follow_up_at ? new Date(data.next_follow_up_at).toISOString().slice(0, 16) : "");
      } else {
        toast.error("Failed to load enquiry");
      }
    } catch {
      toast.error("Failed to load enquiry");
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const user = JSON.parse(sessionStorage.getItem("user") || "{}");
      if (user.role?.toLowerCase() === "center") return; // Center role doesn't need admin list

      const token = sessionStorage.getItem("token");
      const res = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token || ""}` } });
      const data = await res.json();
      if (res.ok) {
        const allUsers = (data || []) as AdminUser[];
        const adminsList = allUsers.filter((u) => {
          const role = (u.role || "").toLowerCase();
          // superadmin is "god" and should not be visible in any lists for assignment
          return role === "admin";
        });
        setAdmins(adminsList);
      }
    } catch {
      toast.error("Failed to load admins");
    }
  };

  const saveUpdates = async () => {
    if (!id) return;
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/admin/enquiries/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
        body: JSON.stringify({ status, assigned_to: assignedTo || null, next_follow_up_at: nextFollowUp ? new Date(nextFollowUp).toISOString() : null }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Enquiry updated");
        fetchDetail();
      } else {
        toast.error(data.message || "Update failed");
      }
    } catch {
      toast.error("Update failed");
    }
  };

  const addNote = async () => {
    if (!id || !noteText.trim()) return;
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/admin/enquiries/${encodeURIComponent(id)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
        body: JSON.stringify({ text: noteText.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Note added");
        setNoteText("");
        fetchDetail();
      } else {
        toast.error(data.message || "Add note failed");
      }
    } catch {
      toast.error("Add note failed");
    }
  };

  const deleteEnquiry = async () => {
    if (!id || !window.confirm("Are you sure you want to delete this enquiry?")) return;
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/admin/enquiries/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token || ""}` },
      });
      if (res.ok) {
        toast.success("Deleted");
        navigate("/dashboard/crm/enquiries");
      } else {
        const data = await res.json();
        toast.error(data.message || "Delete failed");
      }
    } catch {
      toast.error("Delete failed");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }

  if (!detail) {
    return (
      <DashboardLayout>
        <div className="p-10 text-sm text-muted-foreground">Enquiry not found</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8 pb-10">
        <div className="flex items-center justify-between">
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Enquiry Details</h1>
          <div className="flex gap-3">
            <button onClick={deleteEnquiry} className="px-3 py-2 border border-red-200 text-red-500 hover:bg-red-50 text-xs font-bold uppercase flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
            <button onClick={() => navigate(-1)} className="px-3 py-2 border border-border text-xs font-bold uppercase">Back</button>
          </div>
        </div>

        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">Lead Information</CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="text-sm"><span className="text-muted-foreground">Name:</span> {detail.name}</div>
            <div className="text-sm"><span className="text-muted-foreground">Phone:</span> {detail.phone}</div>
            <div className="text-sm"><span className="text-muted-foreground">Email:</span> {detail.email || "-"}</div>
            <div className="text-sm"><span className="text-muted-foreground">Course:</span> {detail.course}</div>
            <div className="text-sm md:col-span-2"><span className="text-muted-foreground">Message:</span> {detail.message || "-"}</div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm">
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="followup">Follow-up</option>
                  <option value="converted">Converted</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
              {isAdmin && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Assigned To (Admin ID)</label>
                  <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm">
                    <option value="">Unassigned</option>
                    {admins.map((a) => (
                      <option key={a.id} value={a.id}>{a.username}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Next Follow-up</label>
                <input type="datetime-local" value={nextFollowUp} onChange={(e) => setNextFollowUp(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm" />
              </div>
            </div>
            <button onClick={saveUpdates} className="px-4 py-2 border border-border text-xs font-bold uppercase">Save Changes</button>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Add Note</label>
              <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={4} className="w-full px-3 py-2 border border-border bg-background text-sm" />
              <button onClick={addNote} className="mt-2 px-4 py-2 border border-border text-xs font-bold uppercase">Add Note</button>
            </div>
            <div className="space-y-3">
              {detail.notes_history?.length ? detail.notes_history.map((n, idx) => (
                <div key={`${n.created_at}-${idx}`} className="border border-border p-3">
                  <div className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
                  <div className="text-sm">{n.text}</div>
                </div>
              )) : (
                <div className="text-xs text-muted-foreground">No notes yet</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminEnquiryDetailsPage;
