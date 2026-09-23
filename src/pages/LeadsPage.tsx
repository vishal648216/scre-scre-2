import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, Eye, Trash2, Download, MessageSquare, UserPlus, Mail, Phone, Calendar, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

const LEAD_STATUSES = [
  { value: "new", label: "New", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { value: "called", label: "Called", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  { value: "interested", label: "Interested", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  { value: "not_interested", label: "Not Interested", color: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
  { value: "converted", label: "Converted", color: "bg-green-500/10 text-green-600 border-green-500/20" },
];

interface Enquiry {
  id: string;
  name: string;
  phone: string;
  email?: string;
  course: string;
  message?: string;
  status: string;
  enquiry_type?: string;
  created_at: string;
}

const LeadsPage = () => {
  const { type } = useParams<{ type: string }>(); // franchise, student, general
  const [loading, setLoading] = useState(true);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchEnquiries();
  }, [type]);

  const fetchEnquiries = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/enquiries?enquiry_type=${type}`);
      if (res.ok) {
        const data = await res.json();
        setEnquiries(data.items || []);
      }
    } catch (error) {
      toast.error("Failed to load inquiries");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    setUpdating(id);
    try {
      const res = await apiFetch(`/api/admin/enquiries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        toast.success("Status updated");
        setEnquiries(prev => prev.map(e => e.id === id ? { ...e, status } : e));
      }
    } catch {
      toast.error("Update failed");
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this inquiry?")) return;
    try {
      const res = await apiFetch(`/api/admin/enquiries/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Inquiry deleted");
        fetchEnquiries();
      }
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const filtered = enquiries.filter(e => 
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.phone.includes(search) ||
    (e.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const getTitle = () => {
    switch(type) {
      case 'franchise': return "Franchise Leads";
      case 'student': return "Student Leads";
      default: return "General Inquiries";
    }
  };

  const getIcon = () => {
    switch(type) {
      case 'franchise': return <MessageSquare className="w-6 h-6 text-primary" />;
      case 'student': return <UserPlus className="w-6 h-6 text-primary" />;
      default: return <Mail className="w-6 h-6 text-primary" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 border border-primary/20">
              {getIcon()}
            </div>
            <div>
              <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">{getTitle()}</h1>
              <p className="text-muted-foreground mt-1 text-sm font-medium">Manage incoming {type} inquiries.</p>
            </div>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-none text-xs font-bold uppercase tracking-widest focus:border-primary outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Fetching Leads...</p>
          </div>
        ) : filtered.length === 0 ? (
          <Card className="rounded-none border-dashed border-2 border-border">
            <CardContent className="py-20 flex flex-col items-center text-center">
              <Mail className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-lg font-bold uppercase tracking-tight">No Leads Found</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2">
                There are currently no {type} inquiries in the system.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map((e) => (
              <Card key={e.id} className="rounded-none border-border group hover:border-primary transition-all overflow-hidden bg-card flex flex-col">
                <CardHeader className="bg-muted/30 border-b border-border py-4 flex flex-row items-center justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground">
                      {e.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <select 
                        className={cn(
                          "px-2 py-0.5 text-[8px] font-black uppercase tracking-widest border rounded-none outline-none cursor-pointer",
                          LEAD_STATUSES.find(s => s.value === e.status)?.color || "bg-muted text-muted-foreground"
                        )}
                        value={e.status}
                        onChange={(ev) => handleUpdateStatus(e.id, ev.target.value)}
                        disabled={updating === e.id}
                      >
                        {LEAD_STATUSES.map(s => (
                          <option key={s.value} value={s.value} className="bg-background text-foreground font-bold">{s.label}</option>
                        ))}
                      </select>
                      {updating === e.id && <Loader2 className="w-2.5 h-2.5 animate-spin text-primary" />}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDelete(e.id)}
                    className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </CardHeader>
                <CardContent className="p-6 space-y-4 flex-1">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-xs font-bold">
                      <Phone className="w-3.5 h-3.5 text-primary" />
                      {e.phone}
                    </div>
                    {e.email && (
                      <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground truncate">
                        <Mail className="w-3.5 h-3.5 text-primary" />
                        {e.email}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      {new Date(e.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">Message / Details</p>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4 italic">
                      {e.message || "No message provided."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default LeadsPage;

