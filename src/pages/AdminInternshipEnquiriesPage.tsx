import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, Eye, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface EnquiryItem {
  id: string;
  name: string;
  phone: string;
  email?: string;
  course: string;
  center_id?: string;
  center_name?: string;
  message?: string;
  college?: string;
  status: string;
  assigned_to?: string;
  next_follow_up_at?: string;
  created_at: string;
  updated_at: string;
}

const AdminInternshipEnquiriesPage = () => {
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
      params.set("enquiry_type", "internship");
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
        toast.error(data.message || "Failed to load internship enquiries");
      }
    } catch {
      toast.error("Failed to load internship enquiries");
    } finally {
      setLoading(false);
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
        toast.success("Updated");
        fetchData();
      } else {
        toast.error(data.message || "Update failed");
      }
    } catch {
      toast.error("Update failed");
    }
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
        a.download = `internship-enquiries_${new Date().toISOString().split("T")[0]}.csv`;
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
        <div className="flex items-center justify-between">
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Internship Enquiries</h1>
        </div>

        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">Internship Lead Pipeline</CardTitle>
              <div className="flex items-center gap-3">
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 border border-border bg-background text-xs font-bold uppercase">
                  <option value="all">All</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="followup">Follow-up</option>
                  <option value="converted">Converted</option>
                  <option value="lost">Lost</option>
                </select>
                <select value={due} onChange={(e) => setDue(e.target.value)} className="px-3 py-2 border border-border bg-background text-xs font-bold uppercase">
                  <option value="all">All Due</option>
                  <option value="today">Due Today</option>
                  <option value="overdue">Overdue</option>
                  <option value="upcoming">Upcoming</option>
                </select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="pl-10 pr-3 py-2 border border-border bg-background text-xs font-bold uppercase"
                  />
                </div>
                <button 
                  onClick={exportCSV}
                  className="px-3 py-2 border border-border bg-background text-xs font-bold uppercase flex items-center gap-2 hover:bg-muted/50"
                  title="Export CSV"
                >
                  <Download className="w-4 h-4" /> Export
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
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Name</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Phone</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Course</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">College</th>
                      {isAdmin && <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Center</th>}
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Status</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Follow-up</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((e) => (
                      <tr key={e.id} className="border-b border-border hover:bg-muted/10">
                        <td className="px-4 py-3 text-sm font-bold">{e.name}</td>
                        <td className="px-4 py-3 text-xs">{e.phone}</td>
                        <td className="px-4 py-3 text-xs">{e.course}</td>
                        <td className="px-4 py-3 text-xs">{e.college || "-"}</td>
                        {isAdmin && <td className="px-4 py-3 text-xs font-medium text-primary">{e.center_name || "Admin"}</td>}
                        <td className="px-4 py-3 text-xs uppercase">{e.status}</td>
                        <td className="px-4 py-3 text-xs">
                          {e.next_follow_up_at ? (
                            <span className={new Date(e.next_follow_up_at).getTime() < Date.now() ? "text-red-500 font-bold" : ""}>
                              {new Date(e.next_follow_up_at).toLocaleString()}
                            </span>
                          ) : "-"}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="flex gap-2">
                            <Link to={`/dashboard/crm/enquiries/${encodeURIComponent(e.id)}`} className="px-2 py-1 border border-border flex items-center gap-1">
                              <Eye className="w-3 h-3" /> View
                            </Link>
                            <button onClick={() => updateStatus(e.id, "contacted")} className="px-2 py-1 border border-border">Contacted</button>
                            <button onClick={() => updateStatus(e.id, "followup")} className="px-2 py-1 border border-border">Follow-up</button>
                            <button onClick={() => updateStatus(e.id, "converted")} className="px-2 py-1 border border-border">Converted</button>
                            <button onClick={() => updateStatus(e.id, "lost")} className="px-2 py-1 border border-border">Lost</button>
                            <button onClick={() => deleteEnquiry(e.id)} className="px-2 py-1 border border-red-200 text-red-500 hover:bg-red-50" title="Delete">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-10 text-center text-xs text-muted-foreground">No internship enquiries</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">Total: {total}</div>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-1 border border-border text-xs">Prev</button>
            <span className="text-xs">Page {page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border border-border text-xs">Next</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminInternshipEnquiriesPage;
