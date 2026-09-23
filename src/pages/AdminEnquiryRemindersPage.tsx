import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface EnquiryItem {
  id: string;
  name: string;
  phone: string;
  course: string;
  status: string;
  next_follow_up_at?: string;
}

const AdminEnquiryRemindersPage = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<EnquiryItem[]>([]);
  const [due, setDue] = useState("today");

  useEffect(() => {
    fetchData();
  }, [due]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const params = new URLSearchParams();
      params.set("due", due);
      params.set("limit", "100");
      const res = await fetch(`/api/admin/enquiries?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token || ""}` },
      });
      const data = await res.json();
      if (res.ok) {
        setItems((data.items || []) as EnquiryItem[]);
      } else {
        toast.error(data.message || "Failed to load reminders");
      }
    } catch {
      toast.error("Failed to load reminders");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-10">
        <div className="flex items-center justify-between">
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">CRM Reminders</h1>
        </div>

        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <div className="flex items-center gap-3">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">Follow-ups</CardTitle>
              <select value={due} onChange={(e) => setDue(e.target.value)} className="px-3 py-2 border border-border bg-background text-xs font-bold uppercase">
                <option value="today">Due Today</option>
                <option value="overdue">Overdue</option>
                <option value="upcoming">Upcoming</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Name</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Phone</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Course</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Follow-up</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((e) => (
                      <tr key={e.id} className="border-b border-border hover:bg-muted/10">
                        <td className="px-4 py-3 text-sm font-bold">{e.name}</td>
                        <td className="px-4 py-3 text-xs">{e.phone}</td>
                        <td className="px-4 py-3 text-xs">{e.course}</td>
                        <td className="px-4 py-3 text-xs">
                          {e.next_follow_up_at ? (
                            <span className={new Date(e.next_follow_up_at).getTime() < Date.now() ? "text-red-500 font-bold" : ""}>
                              {new Date(e.next_follow_up_at).toLocaleString()}
                            </span>
                          ) : "-"}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <Link to={`/dashboard/crm/enquiries/${encodeURIComponent(e.id)}`} className="px-2 py-1 border border-border">Open</Link>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-10 text-center text-xs text-muted-foreground">No reminders</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminEnquiryRemindersPage;
