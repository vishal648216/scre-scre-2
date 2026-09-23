import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle2, XCircle, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface StudentRow {
  _id?: { $oid: string } | string;
  id?: string;
  username: string;
  full_name?: string;
  course?: string;
  approval_status?: string;
}
const AdminStudentApprovalPage = () => {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch("/api/students", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
      }
    } catch {
      toast.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (id: string) => {
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/admin/students/${id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Approved. Empty certificate issued for center to add sign & stamp.");
        load();
      } else {
        toast.error("Failed to approve");
      }
    } catch {
      toast.error("Error approving");
    }
  };

  const reject = async (id: string) => {
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/admin/students/${id}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Rejected");
        load();
      } else {
        toast.error("Failed to reject");
      }
    } catch {
      toast.error("Error rejecting");
    }
  };

  const filtered = students.filter((s) =>
    (s.full_name || s.username || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Student Approvals</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Accept or reject students and auto-issue certificates.</p>
          </div>
        </div>

        <Card className="rounded-none border-border shadow-sm">
          <CardContent className="p-4 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name or username..."
                className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-muted/30 text-[10px] font-black uppercase tracking-widest focus:border-primary"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Students ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Loading</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/10 text-muted-foreground uppercase text-[10px] font-black tracking-widest">
                      <th className="py-4 pl-6">Name</th>
                      <th className="py-4">Username</th>
                      <th className="py-4">Course</th>
                      <th className="py-4">Status</th>
                      <th className="py-4 text-right pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr key={s._id?.$oid || s.id || s.username} className="border-b border-border last:border-0">
                        <td className="py-5 pl-6">{s.full_name || s.username}</td>
                        <td className="py-5">{s.username}</td>
                        <td className="py-5">{s.course || "-"}</td>
                        <td className="py-5">{s.approval_status || "accepted"}</td>
                        <td className="py-5 text-right pr-6">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => approve(s._id?.$oid || s.id)} className="p-2 border border-border hover:border-green-500 hover:text-green-500 transition-all rounded-none">
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => reject(s._id?.$oid || s.id)} className="p-2 border border-border hover:border-red-500 hover:text-red-500 transition-all rounded-none">
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
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

export default AdminStudentApprovalPage;
