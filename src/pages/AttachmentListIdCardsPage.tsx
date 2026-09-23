import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BadgeCheck, Loader2, Search, Download, CheckCircle, XCircle, Clock } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface IdCard {
  _id: any;
  student_name: string;
  enrollment_number: string;
  course_name: string;
  status: string;
  pdf_url?: string;
  issued_on: string;
}

const AttachmentListIdCardsPage = () => {
  const [cards, setCards] = useState<IdCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [approving, setApproving] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/id-cards");
      const data = await res.json();
      if (Array.isArray(data)) setCards(data);
    } catch {
      toast.error("Failed to load ID cards");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (id: string) => {
    setApproving(id);
    try {
      const res = await apiFetch(`/api/admin/id-cards/${id}/approve`, { method: "POST" });
      if (res.ok) {
        toast.success("ID Card approved");
        fetchData();
      }
    } catch {
      toast.error("Approval failed");
    } finally {
      setApproving(null);
    }
  };

  const filtered = cards.filter(c => 
    c.student_name.toLowerCase().includes(search.toLowerCase()) ||
    c.enrollment_number.toLowerCase().includes(search.toLowerCase())
  );

  const toId = (id: any) => id?.$oid || id;

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case "approved": return <div className="flex items-center gap-1.5 text-green-600 font-bold text-[10px] uppercase tracking-widest"><CheckCircle className="w-3.5 h-3.5" /> Approved</div>;
      case "rejected": return <div className="flex items-center gap-1.5 text-red-600 font-bold text-[10px] uppercase tracking-widest"><XCircle className="w-3.5 h-3.5" /> Rejected</div>;
      default: return <div className="flex items-center gap-1.5 text-orange-500 font-bold text-[10px] uppercase tracking-widest"><Clock className="w-3.5 h-3.5" /> Pending</div>;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 flex items-center justify-center border border-primary/20 rounded-none">
              <BadgeCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-xl text-foreground uppercase tracking-tight">Student ID Cards</h1>
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-widest">View and manage all ID cards</p>
            </div>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              placeholder="Search student..." 
              className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-none text-sm focus:outline-none focus:border-primary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Card className="rounded-none border-border shadow-sm">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground uppercase text-[10px] font-black tracking-widest">No ID cards found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border">
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Student Name</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Enrollment</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                      <th className="py-4 px-6 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => {
                      const cid = toId(c._id);
                      return (
                        <tr key={cid} className="border-b border-border/50 hover:bg-muted/10 transition-colors group">
                          <td className="py-4 px-6 font-bold text-sm uppercase">{c.student_name}</td>
                          <td className="py-4 px-6 text-xs font-mono">{c.enrollment_number}</td>
                          <td className="py-4 px-6 text-xs font-medium">{c.course_name}</td>
                          <td className="py-4 px-6"><StatusBadge status={c.status} /></td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {c.status === "approved" ? (
                                <a 
                                  href={c.pdf_url} 
                                  target="_blank" 
                                  className="p-2 bg-primary text-primary-foreground rounded-none hover:opacity-90"
                                  title="Download"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                              ) : (
                                <button 
                                  onClick={() => handleApprove(cid)}
                                  disabled={approving === cid}
                                  className="px-4 py-2 bg-green-600 text-white text-[10px] font-black uppercase tracking-widest rounded-none hover:bg-green-700 disabled:opacity-50"
                                >
                                  {approving === cid ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Approve"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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

export default AttachmentListIdCardsPage;

