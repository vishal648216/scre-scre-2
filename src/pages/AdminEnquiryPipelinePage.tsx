import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowRight, Eye } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type Status = "new" | "contacted" | "followup" | "converted" | "lost";

interface EnquiryItem {
  id: string;
  name: string;
  phone: string;
  course: string;
  status: Status;
  assigned_to?: string;
  next_follow_up_at?: string;
}

interface AdminUser {
  id: string;
  username: string;
  role: string;
}

const statusOrder: Status[] = ["new", "contacted", "followup", "converted", "lost"];

const AdminEnquiryPipelinePage = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<EnquiryItem[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  const isAdmin = user.role?.toLowerCase() === "admin" || user.role?.toLowerCase() === "superadmin";

  useEffect(() => {
    fetchData();
    fetchAdmins();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      // For centers, the backend already filters by center_id
      const res = await fetch("/api/admin/enquiries?limit=200&page=1", {
        headers: { Authorization: `Bearer ${token || ""}` },
      });
      const data = await res.json();
      if (res.ok) {
        setItems((data.items || []) as EnquiryItem[]);
      } else {
        toast.error(data.message || "Failed to load enquiries");
      }
    } catch {
      toast.error("Failed to load enquiries");
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      if (!isAdmin) return; // Only fetch admins for admin/superadmin roles

      const token = sessionStorage.getItem("token");
      const res = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token || ""}` } });
      const data = await res.json();
      if (res.ok) {
        const list = (data || []).filter((u: AdminUser) => {
          const role = (u.role || "").toLowerCase();
          // superadmin is "god" and should not be visible in any lists for assignment
          return role === "admin";
        });
        setAdmins(list);
      }
    } catch {
      toast.error("Failed to load admins");
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<Status, EnquiryItem[]>();
    statusOrder.forEach((s) => map.set(s, []));
    items.forEach((i) => map.get(i.status)?.push(i));
    return map;
  }, [items]);

  const moveTo = async (id: string, next: Status) => {
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

  const assignTo = async (id: string, assignee: string) => {
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/admin/enquiries/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
        body: JSON.stringify({ assigned_to: assignee }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Assigned");
        fetchData();
      } else {
        toast.error(data.message || "Assignment failed");
      }
    } catch {
      toast.error("Assignment failed");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 pb-10">
        <div className="flex items-center justify-between">
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">CRM Pipeline</h1>
        </div>

        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {statusOrder.map((status) => (
              <Card key={status} className="rounded-none border-border shadow-md overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border py-3">
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">{status}</CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-3">
                  {(grouped.get(status) || []).map((e) => (
                    <div key={e.id} className="border border-border p-3 space-y-2">
                      <div className="text-xs font-black">{e.name}</div>
                      <div className="text-[10px] text-muted-foreground">{e.phone}</div>
                      <div className="text-[10px] uppercase">{e.course}</div>
                      {isAdmin && (
                        <div className="text-[10px]">
                          <select
                            value={e.assigned_to || ""}
                            onChange={(ev) => assignTo(e.id, ev.target.value)}
                            className="w-full px-2 py-1 border border-border bg-background text-[10px]"
                          >
                            <option value="">Unassigned</option>
                            {admins.map((a) => (
                              <option key={a.id} value={a.id}>{a.username}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="text-[10px]">
                        {e.next_follow_up_at ? (
                          <span className={new Date(e.next_follow_up_at).getTime() < Date.now() ? "text-red-500 font-bold" : ""}>
                            {new Date(e.next_follow_up_at).toLocaleString()}
                          </span>
                        ) : "No follow-up"}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link to={`/dashboard/crm/enquiries/${encodeURIComponent(e.id)}`} className="px-2 py-1 border border-border text-[10px] flex items-center gap-1">
                          <Eye className="w-3 h-3" /> View
                        </Link>
                        {statusOrder.filter((s) => s !== status).map((s) => (
                          <button key={s} onClick={() => moveTo(e.id, s)} className="px-2 py-1 border border-border text-[10px] flex items-center gap-1">
                            <ArrowRight className="w-3 h-3" /> {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {(grouped.get(status) || []).length === 0 && (
                    <div className="text-xs text-muted-foreground">No leads</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminEnquiryPipelinePage;
