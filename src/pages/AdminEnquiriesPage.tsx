import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  Search,
  Eye,
  Trash2,
  Download,
  PlusCircle,
  UserPlus,
  ArrowUpRight,
  PhoneCall,
  MapPin,
  Calendar,
  X,
  Send,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface EnquiryItem {
  id: string;
  name: string;
  phone: string;
  email?: string;
  course: string;
  center_id?: string;
  center_name?: string;
  message?: string;
  status: string;
  assigned_to?: string;
  next_follow_up_at?: string;
  source?: string;
  priority?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

const AdminEnquiriesPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<EnquiryItem[]>([]);
  const [status, setStatus] = useState("all");
  const [due, setDue] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  const isAdmin = user.role?.toLowerCase() === "admin" || user.role?.toLowerCase() === "superadmin";

  // Modal State for New Walk-in / Phone Lead
  const [showAddModal, setShowAddModal] = useState(false);
  const [submittingLead, setSubmittingLead] = useState(false);
  const [newLead, setNewLead] = useState({
    name: "",
    phone: "",
    email: "",
    course: "",
    source: "Walk-in Center",
    priority: "Medium",
    notes: "",
    next_follow_up_at: "",
  });

  useEffect(() => {
    fetchData();
  }, [status, due, search, page, limit]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      if (due !== "all") params.set("due", due);
      params.set("page", String(page));
      params.set("limit", String(limit));
      const res = await fetch(`/api/admin/enquiries?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token || ""}` },
      });
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setTotal(data.total || 0);
      } else {
        toast.error(data.message || "Failed to load enquiries");
      }
    } catch {
      toast.error("Failed to load enquiries");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingLead(true);
    try {
      const payload: any = {
        name: newLead.name.trim(),
        phone: newLead.phone.trim(),
        course: newLead.course.trim(),
        source: newLead.source,
        priority: newLead.priority,
        enquiry_type: "student",
      };
      if (newLead.email?.trim()) payload.email = newLead.email.trim();
      if (newLead.notes?.trim()) payload.notes = newLead.notes.trim();
      if (newLead.next_follow_up_at) {
        payload.next_follow_up_at = new Date(newLead.next_follow_up_at).toISOString();
      }

      const res = await apiFetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("New lead registered in Enquiry Register!");
        setShowAddModal(false);
        setNewLead({
          name: "",
          phone: "",
          email: "",
          course: "",
          source: "Walk-in Center",
          priority: "Medium",
          notes: "",
          next_follow_up_at: "",
        });
        fetchData();
        queryClient.invalidateQueries(["admin-dashboard-data"]);
      } else {
        const d = await res.json();
        toast.error(d.message || "Failed to register lead");
      }
    } catch {
      toast.error("Error registering enquiry");
    } finally {
      setSubmittingLead(false);
    }
  };

  const updateStatus = async (id: string, next: string) => {
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/admin/enquiries/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Enquiry marked as ${next}`);
        fetchData();
        queryClient.invalidateQueries(["admin-dashboard-data"]);
      } else {
        toast.error(data.message || "Update failed");
      }
    } catch {
      toast.error("Update failed");
    }
  };

  const handleConvertToAdmission = async (enquiry: EnquiryItem) => {
    try {
      await updateStatus(enquiry.id, "converted");
    } catch {}

    const params = new URLSearchParams();
    if (enquiry.name) params.set("name", enquiry.name);
    if (enquiry.phone) params.set("phone", enquiry.phone);
    if (enquiry.email) params.set("email", enquiry.email);
    if (enquiry.course) params.set("course", enquiry.course);

    window.open(`/admission?${params.toString()}`, "_blank");
    toast.success("Redirected to admission form with pre-filled lead details!");
  };

  const deleteEnquiry = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this enquiry?")) return;
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/admin/enquiries/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token || ""}` },
      });
      if (res.ok) {
        toast.success("Deleted");
        fetchData();
        queryClient.invalidateQueries(["admin-dashboard-data"]);
      } else {
        const data = await res.json();
        toast.error(data.message || "Delete failed");
      }
    } catch {
      toast.error("Delete failed");
    }
  };

  const exportCSV = async () => {
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch("/api/admin/enquiries/export", {
        headers: { Authorization: `Bearer ${token || ""}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `enquiries_${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        toast.error("Export failed");
      }
    } catch {
      toast.error("Export failed");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
              Digital Enquiry Register & CRM
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium uppercase tracking-widest font-black text-[10px]">
              Track walk-in inquiries, scheduled counseling, and direct admission conversion
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-90 shadow-md transition-all"
            >
              <PlusCircle className="w-4 h-4" /> Register Walk-in / Phone Lead
            </button>
          </div>
        </div>

        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">
                Lead Pipeline & Records
              </CardTitle>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="px-3 py-2 border border-border bg-background text-xs font-bold uppercase"
                >
                  <option value="all">All Statuses</option>
                  <option value="new">New Lead</option>
                  <option value="contacted">Contacted</option>
                  <option value="followup">Follow-up</option>
                  <option value="converted">Converted to Admission</option>
                  <option value="lost">Lost / Not Interested</option>
                </select>
                <select
                  value={due}
                  onChange={e => setDue(e.target.value)}
                  className="px-3 py-2 border border-border bg-background text-xs font-bold uppercase"
                >
                  <option value="all">All Follow-ups</option>
                  <option value="today">Due Today</option>
                  <option value="overdue">Overdue</option>
                  <option value="upcoming">Upcoming</option>
                </select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="SEARCH LEAD / PHONE..."
                    className="pl-10 pr-3 py-2 border border-border bg-background text-xs font-bold uppercase"
                  />
                </div>
                <button
                  onClick={exportCSV}
                  className="px-3 py-2 border border-border bg-background text-xs font-bold uppercase flex items-center gap-2 hover:bg-muted/50"
                  title="Export CSV"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-10 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">
                        Candidate
                      </th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">
                        Contact Info
                      </th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">
                        Course & Source
                      </th>
                      {isAdmin && (
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">
                          Center
                        </th>
                      )}
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">
                        Stage Status
                      </th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">
                        Next Follow-up
                      </th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-right">
                        Pipeline Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(e => {
                      const isConverted = e.status?.toLowerCase() === "converted";
                      return (
                        <tr key={e.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-sm font-bold uppercase text-foreground">{e.name}</p>
                            {e.notes && (
                              <p className="text-[10px] text-muted-foreground italic truncate max-w-[180px]">
                                "{e.notes}"
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <p className="font-bold tracking-tight text-foreground">{e.phone}</p>
                            {e.email && <p className="text-[10px] text-muted-foreground">{e.email}</p>}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <p className="font-bold text-foreground">{e.course}</p>
                            <span className="inline-block px-1.5 py-0.5 bg-muted text-muted-foreground border border-border text-[9px] font-bold uppercase mt-0.5">
                              {e.source || "Direct Form"}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-xs font-medium text-primary">
                              {e.center_name || "Head Office"}
                            </td>
                          )}
                          <td className="px-4 py-3 text-xs">
                            <span
                              className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border ${
                                isConverted
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                  : e.status === "contacted"
                                  ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                  : e.status === "followup"
                                  ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                  : e.status === "lost"
                                  ? "bg-destructive/10 text-destructive border-destructive/20"
                                  : "bg-muted text-foreground border-border"
                              }`}
                            >
                              {e.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {e.next_follow_up_at ? (
                              <span
                                className={
                                  new Date(e.next_follow_up_at).getTime() < Date.now()
                                    ? "text-red-500 font-bold"
                                    : "text-foreground"
                                }
                              >
                                {new Date(e.next_follow_up_at).toLocaleDateString()}{" "}
                                {new Date(e.next_follow_up_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* 1-Click Convert to Admission */}
                              {!isConverted ? (
                                <button
                                  onClick={() => handleConvertToAdmission(e)}
                                  className="px-2.5 py-1 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1 hover:bg-emerald-700 transition-all shadow-sm"
                                  title="1-Click Direct Conversion to Admission"
                                >
                                  <UserPlus className="w-3 h-3" /> Convert
                                </button>
                              ) : (
                                <span className="px-2 py-1 bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3" /> Enrolled
                                </span>
                              )}

                              <Link
                                to={`/dashboard/crm/enquiries/${encodeURIComponent(e.id)}`}
                                className="px-2 py-1 border border-border hover:bg-muted text-[9px] font-bold uppercase flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" /> Details
                              </Link>

                              <button
                                onClick={() => updateStatus(e.id, "contacted")}
                                className="px-2 py-1 border border-border hover:bg-muted text-[9px] font-bold uppercase"
                              >
                                Contacted
                              </button>
                              <button
                                onClick={() => updateStatus(e.id, "followup")}
                                className="px-2 py-1 border border-border hover:bg-muted text-[9px] font-bold uppercase"
                              >
                                Follow-up
                              </button>
                              <button
                                onClick={() => deleteEnquiry(e.id)}
                                className="px-2 py-1 border border-red-200 text-red-500 hover:bg-red-50"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-xs text-muted-foreground">
                          No enquiries found matching filters
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-muted-foreground">Total Inquiries: {total}</div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1 border border-border text-xs disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-xs font-bold">
              Page {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 border border-border text-xs disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        {/* Modal: Register Walk-in / Phone Lead */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-background border-2 border-border max-w-xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-border bg-muted/20">
                <div>
                  <h2 className="font-heading font-extrabold text-xl uppercase tracking-tight">
                    Register Walk-in / Phone Lead
                  </h2>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Record new candidate enquiry into center CRM register
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateLead} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                      Candidate Full Name *
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="ENTER NAME"
                      className="w-full px-3 py-2 bg-background border border-border text-xs font-bold uppercase focus:border-primary outline-none"
                      value={newLead.name}
                      onChange={e => setNewLead({ ...newLead, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                      Mobile Number *
                    </label>
                    <input
                      required
                      type="tel"
                      placeholder="10 DIGIT NUMBER"
                      className="w-full px-3 py-2 bg-background border border-border text-xs font-bold uppercase focus:border-primary outline-none"
                      value={newLead.phone}
                      onChange={e => setNewLead({ ...newLead, phone: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="candidate@gmail.com"
                      className="w-full px-3 py-2 bg-background border border-border text-xs font-medium focus:border-primary outline-none"
                      value={newLead.email}
                      onChange={e => setNewLead({ ...newLead, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                      Course of Interest *
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="E.G. DCA, PGDCA, PYTHON"
                      className="w-full px-3 py-2 bg-background border border-border text-xs font-bold uppercase focus:border-primary outline-none"
                      value={newLead.course}
                      onChange={e => setNewLead({ ...newLead, course: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                      Lead Source
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-background border border-border text-xs font-bold uppercase focus:border-primary outline-none"
                      value={newLead.source}
                      onChange={e => setNewLead({ ...newLead, source: e.target.value })}
                    >
                      <option value="Walk-in Center">Walk-in Center</option>
                      <option value="Phone Call Inquiry">Phone Call Inquiry</option>
                      <option value="Website Portal">Website Portal</option>
                      <option value="Social Media">Social Media / Ad</option>
                      <option value="Campus Drive">Campus / Seminar Drive</option>
                      <option value="Student Referral">Student Referral</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                      Priority Level
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-background border border-border text-xs font-bold uppercase focus:border-primary outline-none"
                      value={newLead.priority}
                      onChange={e => setNewLead({ ...newLead, priority: e.target.value })}
                    >
                      <option value="High">High (Ready to Enroll)</option>
                      <option value="Medium">Medium (Needs Demo/Counseling)</option>
                      <option value="Low">Low (General Inquiry)</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                      Next Follow-up Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full px-3 py-2 bg-background border border-border text-xs font-bold focus:border-primary outline-none"
                      value={newLead.next_follow_up_at}
                      onChange={e => setNewLead({ ...newLead, next_follow_up_at: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                      Counselor Discussion Notes
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Details about candidate requirement, counseling discussion, fee concession asked..."
                      className="w-full px-3 py-2 bg-background border border-border text-xs focus:border-primary outline-none"
                      value={newLead.notes}
                      onChange={e => setNewLead({ ...newLead, notes: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-5 py-2.5 border border-border text-xs font-bold uppercase tracking-wider hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={submittingLead}
                    type="submit"
                    className="px-6 py-2.5 bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
                  >
                    {submittingLead ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Register Lead
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminEnquiriesPage;
