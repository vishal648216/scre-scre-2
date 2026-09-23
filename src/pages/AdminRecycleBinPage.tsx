import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { School, Search, Trash2, RotateCcw, Timer, X, AlertTriangle, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface DeletedCenter {
  _id: any;
  name: string;
  code: string;
  city: string;
  state: string;
  deleted_at?: string;
  permanent_delete_at?: string;
  type: "center";
}

interface DeletedStudent {
  _id: any;
  username: string;
  full_name?: string;
  fullName?: string;
  course?: string;
  deleted_at?: string;
  type: "student";
}

const toId = (v: any): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "$oid" in v) return v.$oid;
  return String(v || "");
};

const AdminRecycleBinPage = () => {
  const [centers, setCenters] = useState<DeletedCenter[]>([]);
  const [students, setStudents] = useState<DeletedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [centersRes, studentsRes] = await Promise.all([
        apiFetch("/api/admin/bin/centers"),
        apiFetch("/api/students/bin")
      ]);

      console.log("Centers res ok:", centersRes.ok);
      console.log("Students res ok:", studentsRes.ok);

      if (centersRes.ok) {
        const data = await centersRes.json();
        console.log("Centers data:", data);
        setCenters(Array.isArray(data) ? data.map(c => ({ ...c, type: "center" as const })) : []);
      }
      if (studentsRes.ok) {
        const data = await studentsRes.json();
        console.log("Students data:", data);
        setStudents(Array.isArray(data) ? data.map(s => ({ ...s, type: "student" as const })) : []);
      }
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Failed to load recycle bin");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 30000); // Refresh every 30s for timer updates
    return () => clearInterval(timer);
  }, []);

  // Center handlers
  const handleRestoreCenter = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await apiFetch(`/api/admin/bin/centers/${id}/restore`, { method: "POST" });
      if (res.ok) {
        toast.success("Center and all accounts restored successfully");
        fetchData();
      } else {
        toast.error("Failed to restore center");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setActionLoading(null);
    }
  };

  const initiatePermanentDeleteCenter = async (id: string) => {
    // 3-step confirmation
    if (!window.confirm("STEP 1/3: Are you absolutely sure you want to permanently delete this center? This cannot be undone.")) return;
    if (!window.confirm("STEP 2/3: This will permanently erase all center data, student records, and account information. Continue?")) return;
    if (!window.confirm("STEP 3/3: FINAL WARNING. This is your last chance to turn back. Start 10-minute deletion timer?")) return;

    setActionLoading(id);
    try {
      const res = await apiFetch(`/api/admin/bin/centers/${id}/initiate-delete`, { method: "POST" });
      if (res.ok) {
        toast.info("10-minute deletion timer started. You can cancel during this time.");
        fetchData();
      } else {
        toast.error("Failed to initiate permanent deletion");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setActionLoading(null);
    }
  };

  const cancelPermanentDeleteCenter = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await apiFetch(`/api/admin/bin/centers/${id}/cancel-delete`, { method: "POST" });
      if (res.ok) {
        toast.success("Permanent deletion cancelled");
        fetchData();
      } else {
        toast.error("Failed to cancel deletion");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setActionLoading(null);
    }
  };

  const finalizePermanentDeleteCenter = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await apiFetch(`/api/admin/bin/centers/${id}/permanent`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Center permanently deleted from system");
        fetchData();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "Failed to finalize deletion");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setActionLoading(null);
    }
  };

  // Student handlers
  const handleRestoreStudent = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await apiFetch(`/api/students/${id}/restore`, { method: "POST" });
      if (res.ok) {
        toast.success("Student restored successfully");
        fetchData();
      } else {
        toast.error("Failed to restore student");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDeleteStudent = async (id: string) => {
    if (!window.confirm("Are you absolutely sure you want to permanently delete this student? This cannot be undone.")) return;

    setActionLoading(id);
    try {
      const res = await apiFetch(`/api/students/${id}/permanent`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Student permanently deleted from system");
        fetchData();
      } else {
        toast.error("Failed to permanently delete student");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setActionLoading(null);
    }
  };

  const getRemainingTime = (deleteAt?: string) => {
    if (!deleteAt) return null;
    const remaining = new Date(deleteAt).getTime() - new Date().getTime();
    if (remaining <= 0) return "Ready for final deletion";
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}m ${seconds}s remaining`;
  };

  const allItems = [...centers, ...students];
  const filteredItems = allItems.filter(item => {
    const q = searchQuery.toLowerCase();
    if (item.type === "center") {
      const c = item as DeletedCenter;
      return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
    } else {
      const s = item as DeletedStudent;
      const name = s.full_name || s.fullName || "";
      return name.toLowerCase().includes(q) || s.username.toLowerCase().includes(q);
    }
  });

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight flex items-center gap-3">
              <Trash2 className="w-8 h-8 text-primary" />
              Recycle Bin
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Manage deleted centers and students.</p>
          </div>

          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search deleted centers and students..."
              className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-none focus:outline-none focus:border-primary transition-all text-sm font-bold uppercase tracking-widest"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Loading bin contents...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <Card className="rounded-none border-dashed border-2 border-border bg-muted/20">
            <CardContent className="py-20 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-background border border-border flex items-center justify-center mb-6">
                <Trash2 className="w-8 h-8 text-muted-foreground opacity-20" />
              </div>
              <h3 className="text-lg font-bold uppercase tracking-tight">Recycle Bin is Empty</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2 uppercase tracking-widest font-medium">
                Deleted centers and students will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredItems.map((item) => {
              const id = toId(item._id);

              if (item.type === "center") {
                const center = item as DeletedCenter;
                const isDeleting = center.permanent_delete_at;
                const timerText = getRemainingTime(center.permanent_delete_at);
                const isReady = timerText === "Ready for final deletion";

                return (
                  <Card key={id} className={cn(
                    "rounded-none border-border transition-all overflow-hidden",
                    isDeleting ? "border-red-500 bg-red-50/10" : "hover:border-primary"
                  )}>
                    <CardContent className="p-0">
                      <div className="flex flex-col md:flex-row items-stretch">
                        <div className={cn(
                          "p-6 flex-1 flex items-center gap-6",
                          isDeleting && "bg-red-500/5"
                        )}>
                          <div className="w-12 h-12 bg-muted border border-border flex items-center justify-center">
                            <School className="w-6 h-6 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[9px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">Center</span>
                              <span className="text-xs font-bold text-muted-foreground">{center.code}</span>
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-foreground">{center.name}</h3>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight mt-1">
                              {center.city}, {center.state} • Deleted: {center.deleted_at ? new Date(center.deleted_at).toLocaleDateString() : 'N/A'}
                            </p>
                          </div>

                          {isDeleting && (
                            <div className="px-4 py-2 bg-red-500 text-white flex items-center gap-3 animate-pulse">
                              <Timer className="w-4 h-4" />
                              <span className="text-[10px] font-black uppercase tracking-widest">{timerText}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-px bg-border border-l border-border">
                          {!isDeleting ? (
                            <>
                              <button
                                onClick={() => handleRestoreCenter(id)}
                                disabled={!!actionLoading}
                                className="flex-1 md:flex-none px-8 py-6 bg-background hover:bg-green-50 text-green-600 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                              >
                                {actionLoading === id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                                Restore
                              </button>
                              <button
                                onClick={() => initiatePermanentDeleteCenter(id)}
                                disabled={!!actionLoading}
                                className="flex-1 md:flex-none px-8 py-6 bg-background hover:bg-red-50 text-red-600 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                              >
                                <Trash2 className="w-4 h-4" />
                                Permanent Delete
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => cancelPermanentDeleteCenter(id)}
                                disabled={!!actionLoading}
                                className="flex-1 md:flex-none px-8 py-6 bg-background hover:bg-blue-50 text-blue-600 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                              >
                                {actionLoading === id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                                Stop Deletion
                              </button>
                              {isReady && (
                                <button
                                  onClick={() => finalizePermanentDeleteCenter(id)}
                                  disabled={!!actionLoading}
                                  className="flex-1 md:flex-none px-8 py-6 bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                >
                                  {actionLoading === id ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                                  Confirm Final Delete
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              } else {
                const student = item as DeletedStudent;
                const name = student.full_name || student.fullName || "Unnamed Student";

                return (
                  <Card key={id} className="rounded-none border-border hover:border-primary transition-all overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex flex-col md:flex-row items-stretch">
                        <div className="p-6 flex-1 flex items-center gap-6">
                          <div className="w-12 h-12 bg-primary/10 border border-primary/20 flex items-center justify-center">
                            <User className="w-6 h-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[9px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">Student</span>
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-foreground">{name}</h3>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight mt-1">
                              Username: {student.username} • Course: {student.course || "N/A"} • Deleted: {student.deleted_at ? new Date(student.deleted_at).toLocaleDateString() : 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-px bg-border border-l border-border">
                          <button
                            onClick={() => handleRestoreStudent(id)}
                            disabled={!!actionLoading}
                            className="flex-1 md:flex-none px-8 py-6 bg-background hover:bg-green-50 text-green-600 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                          >
                            {actionLoading === id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                            Restore
                          </button>
                          <button
                            onClick={() => handlePermanentDeleteStudent(id)}
                            disabled={!!actionLoading}
                            className="flex-1 md:flex-none px-8 py-6 bg-background hover:bg-red-50 text-red-600 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                          >
                            {actionLoading === id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Permanent Delete
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminRecycleBinPage;
