import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, CheckCircle, Clock, Search, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const AdminMarksApprovalPage = () => {
  const [loading, setLoading] = useState(true);
  const [marks, setMarks] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchMarks = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/exam-v2/marks/list");
      if (res.ok) setMarks(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarks();
  }, []);

  const approve = async (id: string) => {
    setBusy(id);
    try {
      const res = await apiFetch(`/api/exam-v2/marks/${id}/approve`, { method: "POST" });
      if (res.ok) {
        toast.success("Marks approved");
        fetchMarks();
      } else {
        toast.error("Approval failed");
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <DashboardLayout role="Admin">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-xl text-white">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Internal Marks Approval</h1>
              <p className="text-sm text-muted-foreground">Review and approve Practical/Assignment marks submitted by centers.</p>
            </div>
          </div>
        </div>

        <Card className="rounded-2xl border-border shadow-xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b py-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-20 flex justify-center"><Loader2 className="animate-spin w-10 h-10 text-indigo-600" /></div>
            ) : marks.length === 0 ? (
              <div className="p-20 text-center text-muted-foreground font-medium italic">No pending marks for approval.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <th className="px-6 py-4">Student</th>
                      <th className="px-6 py-4">Subject</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Marks</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {marks.map((m: any) => (
                      <tr key={m._id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-sm">{m.student_id}</div>
                          <div className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">Student ID</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-sm">{m.subject_id}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest",
                            m.marks_type === "practical" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-indigo-700"
                          )}>
                            {m.marks_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-black text-sm">
                          {m.marks} / {m.max_marks}
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest",
                            m.status === "approved" ? "text-emerald-500" : "text-amber-500 animate-pulse"
                          )}>
                            {m.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {m.status === "pending" && (
                            <Button 
                              onClick={() => approve(m._id)}
                              disabled={busy === m._id}
                              className="rounded-lg h-8 px-4 text-[10px] font-black uppercase tracking-widest"
                            >
                              {busy === m._id ? <Loader2 className="animate-spin w-3 h-3" /> : <CheckCircle className="w-3 h-3 mr-2" />}
                              Approve
                            </Button>
                          )}
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

export default AdminMarksApprovalPage;
