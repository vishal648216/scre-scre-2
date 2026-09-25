import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2, Calendar, CheckCircle2, Edit, Trash2, Filter, Search, X, FileSpreadsheet } from "lucide-react";
import { BulkCsvUploadModal } from "@/components/BulkCsvUploadModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";

interface Course {
  id: string;
  course_name: string;
  category_id: string;
}

interface Category {
  id: string;
  name: string;
}

interface Session {
  id: string;
  course_id: string;
  session_name: string;
  status: string;
  course?: Course;
}

const AdminSessionsPage = () => {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [form, setForm] = useState({
    course_id: "",
    session_name: "",
    status: "active"
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [coursesRes, sessionsRes, categoriesRes] = await Promise.all([
        apiFetch("/api/courses"),
        apiFetch("/api/academic/sessions"),
        apiFetch("/api/admin/categories")
      ]);

      const coursesData = await coursesRes.json();
      const sessionsData = await sessionsRes.json();
      const categoriesData = await categoriesRes.json();

      if (coursesRes.ok) setCourses(Array.isArray(coursesData) ? coursesData : (coursesData.items || []));
      if (sessionsRes.ok) setSessions(Array.isArray(sessionsData) ? sessionsData : (sessionsData.items || []));
      if (categoriesRes.ok) setCategories(Array.isArray(categoriesData) ? categoriesData : (categoriesData.items || []));

    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.course_id) {
      toast.error("Please select a course");
      return;
    }
    setSaving(true);
    try {
      const url = isEditing ? `/api/academic/sessions/${editingId}` : "/api/academic/sessions";
      const method = isEditing ? "PUT" : "POST";

      const response = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
        })
      });

      if (response.ok) {
        toast.success(isEditing ? "Session updated successfully" : "Sessions created successfully");
        setIsAdding(false);
        setIsEditing(false);
        setEditingId(null);
        setForm({ course_id: "", session_name: "", status: "active" });
        fetchData();
      } else {
        const data = await response.json();
        toast.error(data.message || "Operation failed");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (session: Session) => {
    setForm({
      course_id: session.course_id,
      session_name: session.session_name,
      status: session.status
    });
    setEditingId(session.id);
    setIsEditing(true);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this session?")) return;
    try {
      const response = await apiFetch(`/api/academic/sessions/${id}`, {
        method: "DELETE"
      });
      if (response.ok) {
        toast.success("Session deleted successfully");
        fetchData();
      } else {
        toast.error("Failed to delete session");
      }
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  const getCourseName = (id: string) => courses.find(c => (c.id === id || (c as any)._id === id))?.course_name || "Unknown";

  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      const course = courses.find(c => (c.id === session.course_id || (c as any)._id === session.course_id));

      // Category Filter
      if (selectedCategory !== "all" && course?.category_id !== selectedCategory) return false;

      // Course Filter
      if (selectedCourse !== "all" && (course?.id !== selectedCourse && (course as any)?._id !== selectedCourse)) return false;

      // Search Query
      if (searchQuery.trim() && !session.session_name.toLowerCase().includes(searchQuery.toLowerCase()) && !course?.course_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;

      return true;
    });
  }, [sessions, courses, selectedCategory, selectedCourse, searchQuery]);

  const filteredCoursesForFilter = useMemo(() => {
    if (selectedCategory === "all") return courses;
    return courses.filter(c => c.category_id === selectedCategory);
  }, [courses, selectedCategory]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16 relative">
        {/* Ambient background glows */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />

        {/* Page Header Banner */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Calendar className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-heading font-black text-2xl md:text-3xl text-white uppercase tracking-tight">
                  Academic Sessions
                </h1>
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                  {sessions.length} Sessions
                </span>
              </div>
              <p className="text-slate-400 mt-1 text-xs md:text-sm font-medium">
                Create and manage time-bound academic sessions and batches for courses.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="px-5 py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg hover:border-indigo-500/40"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Bulk Import
            </button>
            <Dialog open={isAdding} onOpenChange={(open) => {
              setIsAdding(open);
              if (!open) {
                setIsEditing(false);
                setEditingId(null);
                setForm({ course_id: "", session_name: "", status: "active" });
              }
            }}>
              <DialogTrigger asChild>
                <button
                  onClick={() => setIsAdding(true)}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all transform active:scale-95"
                >
                  <Plus className="w-4 h-4" /> Create Session
                </button>
              </DialogTrigger>
              <DialogContent className="rounded-3xl border border-indigo-500/30 bg-slate-950/95 backdrop-blur-3xl text-slate-100 shadow-2xl p-6 sm:p-8 sm:max-w-[500px]">
                <DialogHeader className="border-b border-slate-800/80 pb-4">
                  <DialogTitle className="font-heading font-black text-xl text-white uppercase tracking-tight flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-400" />
                    {isEditing ? "Edit Session" : "Create New Session"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-400">
                    {isEditing ? "Update existing session parameters." : "Register a new time-bound academic batch for student admissions."}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Select Course *</label>
                    <select
                      required
                      value={form.course_id}
                      onChange={(e) => setForm({ ...form, course_id: e.target.value })}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                    >
                      <option value="">Select Course</option>
                      {courses.map(c => <option key={c.id || (c as any)._id} value={c.id || (c as any)._id}>{c.course_name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Session Name *</label>
                    <input
                      required
                      value={form.session_name}
                      onChange={(e) => setForm({ ...form, session_name: e.target.value })}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                      placeholder="e.g. DCA - Jan 2026, ADCA - Batch A"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                    >
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <DialogFooter className="pt-4 border-t border-slate-800/80">
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {isEditing ? "Update Session" : "Save Session"}
                    </button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filter Toolbar Card */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-5 shadow-2xl flex flex-col lg:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search sessions or course titles..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-800 bg-slate-950/80 text-sm font-medium text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedCourse("all");
                }}
                className="rounded-2xl border border-slate-800 bg-slate-950/80 text-slate-200 px-4 py-3 text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="rounded-2xl border border-slate-800 bg-slate-950/80 text-slate-200 px-4 py-3 text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Courses</option>
                {filteredCoursesForFilter.map(c => <option key={c.id || (c as any)._id} value={c.id || (c as any)._id}>{c.course_name}</option>)}
              </select>
            </div>

            {(selectedCategory !== "all" || selectedCourse !== "all" || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedCategory("all");
                  setSelectedCourse("all");
                  setSearchQuery("");
                }}
                className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold uppercase tracking-wider hover:bg-rose-500/20 transition-all"
              >
                <X className="w-4 h-4" /> Reset
              </button>
            )}
          </div>
        </div>

        {/* Sessions Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Sessions...</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl p-16 flex flex-col items-center text-center">
            <Calendar className="w-12 h-12 text-slate-600 mb-4 opacity-40" />
            <h3 className="text-lg font-bold text-white uppercase tracking-tight">No Sessions Found</h3>
            <p className="text-slate-400 text-xs max-w-sm mt-1 mb-6">
              {searchQuery || selectedCategory !== "all" || selectedCourse !== "all"
                ? "No sessions match your search filter criteria."
                : "Define academic sessions to enroll candidates and track batch performance."}
            </p>
            <button
              onClick={() => setIsAdding(true)}
              className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create First Session
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 hover:border-indigo-500/50 rounded-3xl p-6 shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 group flex flex-col justify-between space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-heading font-black text-base text-white group-hover:text-indigo-300 transition-colors uppercase tracking-tight">
                          {session.session_name}
                        </h3>
                        <p className="text-[11px] font-mono text-indigo-400 font-bold mt-0.5">
                          ID: {session.id.slice(0, 12)}
                        </p>
                      </div>
                    </div>

                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border backdrop-blur-md shrink-0",
                      session.status === "active"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                    )}>
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        session.status === "active" ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                      )} />
                      {session.status}
                    </span>
                  </div>

                  <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Associated Course</p>
                    <p className="text-xs font-black text-slate-100 uppercase tracking-tight">
                      {getCourseName(session.course_id)}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(session)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800/80 hover:bg-indigo-600/20 hover:text-indigo-300 border border-slate-700/60 hover:border-indigo-500/40 text-slate-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(session.id)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800/80 hover:bg-rose-600/20 hover:text-rose-400 border border-slate-700/60 hover:border-rose-500/40 text-slate-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <BulkCsvUploadModal
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          title="Bulk Import Academic Sessions"
          description="Upload multiple course sessions at once using a CSV spreadsheet."
          uploadEndpoint="/api/academic/sessions/bulk"
          sampleFilename="academic_sessions_template.csv"
          onSuccess={fetchData}
          columns={[
            { key: "session_name", label: "Session Name", required: true },
            { key: "course_id", label: "Course ID", required: true },
            { key: "status", label: "Status (active/archived/inactive)" },
          ]}
          sampleData={[
            {
              session_name: "ADCA - Jan 2026",
              course_id: courses[0]?.id || (courses[0] as any)?._id || "",
              status: "active",
            },
            {
              session_name: "DCA - Feb 2026",
              course_id: courses[0]?.id || (courses[0] as any)?._id || "",
              status: "active",
            },
          ]}
        />
      </div>
    </DashboardLayout>
  );
};

export default AdminSessionsPage;
