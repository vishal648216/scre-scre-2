import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Search, Trash2, RotateCcw, Loader2, User, AlertTriangle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

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
      if (res.ok) {
        const data = await res.json();
        setStudents(Array.isArray(data) ? data : []);
      }
    } catch {
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
    } catch {
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
    } catch {
      toast.error("An error occurred");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!window.confirm("PERMANENT DELETE WARNING: This action cannot be undone and will permanently delete all student data and records. Continue?")) return;
    setActionLoading(id);
    try {
      const res = await apiFetch(`/api/students/${id}/permanent`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Student account permanently deleted");
        fetchDeletedStudents();
      } else {
        toast.error("Failed to permanently delete student");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      (s.full_name || s.fullName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-heading font-extrabold text-2xl md:text-3xl text-zinc-100 uppercase tracking-tight">
                Student Recycle Bin
              </h1>
              <p className="text-zinc-400 text-xs font-medium">Restore deleted student accounts or perform permanent cleanup.</p>
            </div>
          </div>

          <div className="relative w-full md:w-80 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-amber-400 transition-colors" />
            <input
              type="text"
              placeholder="Search deleted students..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:border-amber-500 transition-all text-xs font-bold text-zinc-100 placeholder:text-zinc-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Top Summary Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-zinc-900/90 border border-zinc-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Deleted Records in Bin</p>
              <h3 className="text-2xl font-black text-rose-400 mt-1">{students.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Trash2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Restorable Accounts</p>
              <h3 className="text-2xl font-black text-emerald-400 mt-1">{students.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <RotateCcw className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Permanent Action</p>
              <h3 className="text-xs font-bold text-amber-400 mt-1">Requires Admin Clearance</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
            <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Loading bin contents...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-2 border-zinc-800 bg-zinc-900/40">
            <CardContent className="py-20 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center mb-4 text-zinc-600">
                <GraduationCap className="w-8 h-8" />
              </div>
              <h3 className="text-base font-extrabold uppercase tracking-tight text-zinc-200">Student Bin is Empty</h3>
              <p className="text-zinc-400 text-xs max-w-xs mx-auto mt-1 font-medium">
                Deleted student accounts will appear here for recovery or permanent removal.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredStudents.map((student) => {
              const id = toId(student._id);
              const name = student.full_name || student.fullName || "Unnamed Student";

              return (
                <Card key={id} className="rounded-2xl border-zinc-800 bg-zinc-900/90 hover:border-zinc-700 transition-all overflow-hidden shadow-xl group">
                  <CardContent className="p-0">
                    <div className="flex flex-col lg:flex-row items-stretch">
                      <div className="p-6 flex-1 flex items-center gap-5">
                        <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                          <User className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-base font-extrabold uppercase text-zinc-100">{name}</h3>
                            <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/30 text-[9px] font-black uppercase tracking-wider">
                              In Bin
                            </Badge>
                          </div>
                          <p className="text-xs font-bold text-zinc-400 mt-1">
                            Username: <span className="text-amber-400">@{student.username}</span> • Course: {student.course || "N/A"}
                          </p>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-2 flex items-center gap-1.5">
                            <Trash2 className="w-3 h-3 text-rose-400" /> Deleted On: {student.deleted_at ? new Date(student.deleted_at).toLocaleDateString() : "Recent"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch border-t lg:border-t-0 lg:border-l border-zinc-800 bg-zinc-950/60">
                        <button
                          onClick={() => handleRestore(id)}
                          disabled={!!actionLoading}
                          className="px-6 py-5 bg-transparent hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 border-b sm:border-b-0 sm:border-r border-zinc-800"
                        >
                          {actionLoading === id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                          Restore Student
                        </button>

                        <button
                          onClick={() => handleMoveToAdminBin(id)}
                          disabled={!!actionLoading}
                          className="px-6 py-5 bg-transparent hover:bg-amber-500/20 text-amber-400 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 border-b sm:border-b-0 sm:border-r border-zinc-800"
                        >
                          {actionLoading === id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          Move to Admin Bin
                        </button>

                        <button
                          onClick={() => handlePermanentDelete(id)}
                          disabled={!!actionLoading}
                          className="px-6 py-5 bg-transparent hover:bg-rose-500/20 text-rose-400 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40"
                        >
                          {actionLoading === id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          Permanent Delete
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

