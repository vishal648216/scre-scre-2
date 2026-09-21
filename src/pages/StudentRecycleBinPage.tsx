import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Search, Trash2, RotateCcw, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface DeletedStudent {
  _id: any;
  username: string;
  full_name?: string;
  fullName?: string;
  course?: string;
  deleted_at?: string;
}

const toId = (v: any): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "$oid" in v) return v.$oid;
  return String(v || "");
};

const StudentRecycleBinPage = () => {
  const [students, setStudents] = useState<DeletedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchDeletedStudents = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/students/bin");
      console.log("fetchDeletedStudents res.ok:", res.ok);
      if (res.ok) {
        const data = await res.json();
        console.log("fetchDeletedStudents data:", data);
        setStudents(Array.isArray(data) ? data : []);
      } else {
        console.error("fetchDeletedStudents error:", res.status);
      }
    } catch (error) {
      console.error("fetchDeletedStudents exception:", error);
      toast.error("Failed to load deleted students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletedStudents();
  }, []);

  const handleRestore = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await apiFetch(`/api/students/${id}/restore`, { method: "POST" });
      if (res.ok) {
        toast.success("Student account restored successfully");
        fetchDeletedStudents();
      } else {
        toast.error("Failed to restore student");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setActionLoading(null);
    }
  };

  const handleMoveToAdminBin = async (id: string) => {
    if (!window.confirm("This will remove the student from your bin and send it to the Admin for final deletion. Continue?")) return;
    setActionLoading(id);
    try {
      const res = await apiFetch(`/api/students/${id}/admin-bin`, { method: "POST" });
      if (res.ok) {
        toast.success("Student moved to Admin bin");
        fetchDeletedStudents();
      } else {
        toast.error("Failed to move to Admin bin");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredStudents = students.filter(s => 
    (s.full_name || s.fullName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight flex items-center gap-3">
              <Trash2 className="w-8 h-8 text-primary" />
              Student Recycle Bin
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium uppercase tracking-wider">Restore deleted student accounts and their associated records.</p>
          </div>
          
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Search deleted students..." 
              className="w-full pl-11 pr-4 py-3 bg-background border border-border rounded-none focus:outline-none focus:border-primary transition-all text-sm font-bold uppercase tracking-widest"
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
        ) : filteredStudents.length === 0 ? (
          <Card className="rounded-none border-dashed border-2 border-border bg-muted/20">
            <CardContent className="py-20 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-background border border-border flex items-center justify-center mb-6">
                <GraduationCap className="w-8 h-8 text-muted-foreground opacity-20" />
              </div>
              <h3 className="text-lg font-bold uppercase tracking-tight">Student Bin is Empty</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2 uppercase tracking-widest font-medium">
                Deleted student accounts will appear here for recovery.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredStudents.map((student) => {
              const id = toId(student._id);
              const name = student.full_name || student.fullName || "Unnamed Student";

              return (
                <Card key={id} className="rounded-none border-border hover:border-primary transition-all overflow-hidden group">
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row items-stretch">
                      <div className="p-6 flex-1 flex items-center gap-6">
                        <div className="w-12 h-12 bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                          <User className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-black uppercase tracking-widest text-foreground">{name}</h3>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight mt-1">
                            Username: {student.username} • Course: {student.course || "N/A"}
                          </p>
                          <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                            <Trash2 className="w-3 h-3" /> Deleted On: {student.deleted_at ? new Date(student.deleted_at).toLocaleDateString() : 'Unknown'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col md:flex-row items-stretch bg-border border-l border-border">
                        <button 
                          onClick={() => handleRestore(id)}
                          disabled={!!actionLoading}
                          className="px-8 py-6 bg-background hover:bg-emerald-500 hover:text-white text-emerald-500 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all disabled:opacity-50 border-b md:border-b-0 md:border-r border-border"
                        >
                          {actionLoading === id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                          Restore
                        </button>
                        <button 
                          onClick={() => handleMoveToAdminBin(id)}
                          disabled={!!actionLoading}
                          className="px-8 py-6 bg-background hover:bg-destructive hover:text-white text-destructive flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all disabled:opacity-50"
                        >
                          {actionLoading === id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          Move to Admin Bin
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentRecycleBinPage;
