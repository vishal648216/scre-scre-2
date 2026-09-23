import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Trash2, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

const AdminMaintenancePage = () => {
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handlePurgeStudents = async () => {
    if (confirmText !== "PURGE") {
      toast.error("Please type PURGE to confirm");
      return;
    }

    if (!window.confirm("ARE YOU ABSOLUTELY SURE? This will delete all student accounts and their certificates/marksheets forever!")) {
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/purge/students", {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        setConfirmText("");
      } else {
        toast.error(data.message || "Failed to purge students");
      }
    } catch (error) {
      toast.error("An error occurred during purge");
    } finally {
      setLoading(true);
      // Reload page after a delay to reflect changes
      setTimeout(() => window.location.reload(), 2000);
    }
  };

  return (
    <DashboardLayout role="Admin">
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between border-b border-border pb-6">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-destructive" />
              System Maintenance
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium uppercase tracking-wider">Dangerous operations for system reset and cleanup.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          <Card className="rounded-none border-destructive/30 shadow-md overflow-hidden border-t-4 border-t-destructive">
            <CardHeader className="bg-destructive/5 border-b border-destructive/10 py-4">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-destructive">
                <Trash2 className="w-4 h-4" />
                Purge Student Database
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="bg-destructive/10 border border-destructive/20 p-4 flex gap-4 items-start">
                <AlertTriangle className="w-6 h-6 text-destructive shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-tight text-destructive">Warning: Destructive Operation</p>
                  <p className="text-xs font-bold text-foreground/80 uppercase tracking-tight leading-relaxed">
                    This will permanently delete ALL student accounts, their exam results, issued certificates, and marksheets. 
                    This action CANNOT be undone. Centers will need to re-enroll students.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">Type "PURGE" to confirm</label>
                  <input 
                    type="text" 
                    placeholder="Type PURGE here" 
                    className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-destructive focus:outline-none transition-all uppercase"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                  />
                </div>

                <button
                  onClick={handlePurgeStudents}
                  disabled={loading || confirmText !== "PURGE"}
                  className="w-full bg-destructive text-destructive-foreground py-6 rounded-none font-heading font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Execute Student Purge
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminMaintenancePage;
