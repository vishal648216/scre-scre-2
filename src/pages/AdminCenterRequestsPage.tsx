import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  CheckCircle2, XCircle, Clock, Eye, Loader2, ArrowRight,
  Building2, MapPin, Phone, User, FileText, Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface UpdateRequest {
  _id: string;
  center_id: string;
  old_data: any;
  new_data: any;
  status: string;
  requested_at: string;
  admin_notes?: string;
}

const AdminCenterRequestsPage = () => {
  const [requests, setRequests] = useState<UpdateRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<UpdateRequest | null>(null);
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/center-updates");
      if (res.ok) setRequests(await res.json());
    } catch {
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (status: "approved" | "rejected") => {
    if (!selected) return;
    setProcessing(true);
    try {
      const res = await apiFetch(`/api/center-updates/${selected._id}/process`, {
        method: "PATCH",
        body: JSON.stringify({ status, admin_notes: notes })
      });
      if (res.ok) {
        toast.success(`Request ${status} successfully`);
        setSelected(null);
        setNotes("");
        fetchRequests();
      } else {
        const d = await res.json();
        toast.error(d.message || "Failed to process request");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setProcessing(false);
    }
  };

  const getDiff = (oldData: any, newData: any) => {
    const changes: any = {};
    Object.keys(newData).forEach(key => {
      if (typeof newData[key] === 'object' && newData[key] !== null && !Array.isArray(newData[key])) {
        // Deep diff for location etc
        const nested = getDiff(oldData[key] || {}, newData[key]);
        if (Object.keys(nested).length > 0) changes[key] = nested;
      } else if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        changes[key] = { old: oldData[key], new: newData[key] };
      }
    });
    return changes;
  };

  return (
    <DashboardLayout role="Admin">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Center Update Approvals</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Review and approve center profile update requests.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
        ) : requests.length === 0 ? (
          <Card className="rounded-none border-dashed border-2 border-border p-20 text-center">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">No pending requests found</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {requests.map(r => (
              <Card key={r._id} className="rounded-none border-border group hover:border-primary/40 transition-all bg-card">
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-primary/10 flex items-center justify-center border border-primary/20">
                      <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-tight">{r.old_data.name}</h3>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Code: {r.old_data.code} • Requested: {new Date(r.requested_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={cn(
                      "px-3 py-1 text-[9px] font-black uppercase tracking-widest border",
                      r.status === "pending" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : 
                      r.status === "approved" ? "bg-green-500/10 text-green-600 border-green-500/20" : 
                      "bg-red-500/10 text-red-600 border-red-500/20"
                    )}>
                      {r.status}
                    </span>
                    <button 
                      onClick={() => setSelected(r)}
                      className="p-2 bg-muted hover:bg-primary hover:text-white transition-all rounded-none"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-none border-border">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Review Update Request</DialogTitle>
            </DialogHeader>
            
            {selected && (
              <div className="space-y-8 py-6">
                <div className="grid grid-cols-2 gap-8">
                  {/* Comparison Logic */}
                  {Object.entries(getDiff(selected.old_data, selected.new_data)).map(([key, value]: [string, any]) => (
                    <div key={key} className="col-span-2 space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{key.replace(/_/g, ' ')}</label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-red-500/5 border border-red-500/10 space-y-2">
                          <p className="text-[8px] font-black uppercase text-red-600">Old Value</p>
                          {key.includes('url') ? (
                            <img src={value.old} className="h-20 object-contain" alt="Old" />
                          ) : (
                            <p className="text-xs font-bold text-muted-foreground">{JSON.stringify(value.old) || 'Empty'}</p>
                          )}
                        </div>
                        <div className="p-4 bg-green-500/5 border border-green-500/10 space-y-2">
                          <p className="text-[8px] font-black uppercase text-green-600">New Value</p>
                          {key.includes('url') ? (
                            <img src={value.new} className="h-20 object-contain" alt="New" />
                          ) : (
                            <p className="text-xs font-bold text-foreground">{JSON.stringify(value.new) || 'Empty'}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-4 border-t border-border">
                  <label className="text-[10px] font-black uppercase tracking-widest">Admin Notes (Reason for approval/rejection)</label>
                  <textarea 
                    className="w-full p-4 border border-border bg-muted/20 text-sm font-bold resize-none" 
                    rows={3} 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter notes for the center..."
                  />
                </div>
              </div>
            )}

            <DialogFooter className="gap-3">
              <button
                disabled={processing}
                onClick={() => handleProcess("rejected")}
                className="flex-1 bg-red-600 text-white py-4 font-black uppercase text-[10px] tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" /> Reject Request
              </button>
              <button
                disabled={processing}
                onClick={() => handleProcess("approved")}
                className="flex-1 bg-green-600 text-white py-4 font-black uppercase text-[10px] tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Approve & Update
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminCenterRequestsPage;
