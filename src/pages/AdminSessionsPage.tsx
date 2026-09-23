import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2, Calendar, CheckCircle2, Edit, Trash2, Filter, Search, X } from "lucide-react";
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

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [form, setForm] = useState({
    course_id: "",
    session_name: "",
    status: "active"
  });

  const toId = (val: any): string => {
    if (!val) return "";
    if (typeof val === "string") return val;
    if (typeof val === "object") {
      if (val.$oid) return String(val.$oid);
      if (val._id) return toId(val._id);
    }
    return String(val);
  };

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

      if (coursesRes.ok) {
        const raw = Array.isArray(coursesData) ? coursesData : (coursesData.items || []);
        setCourses(raw.map((c: any) => ({
          ...c,
          id: toId(c._id || c.id),
          category_id: toId(c.category_id)
        })));
      }
      if (sessionsRes.ok) {
        const raw = Array.isArray(sessionsData) ? sessionsData : (sessionsData.items || []);
        setSessions(raw.map((s: any) => ({
          ...s,
          id: toId(s._id || s.id),
          course_id: toId(s.course_id)
        })));
      }
      if (categoriesRes.ok) {
        const raw = Array.isArray(categoriesData) ? categoriesData : (categoriesData.items || []);
        setCategories(raw.map((c: any) => ({
          ...c,
          id: toId(c._id || c.id),
          name: c.name || c.category_name || "Category"
        })));
      }

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
          course_id: toId(form.course_id)
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
      course_id: toId(session.course_id),
      session_name: session.session_name,
      status: session.status
    });
    setEditingId(toId(session.id));
    setIsEditing(true);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this session?")) return;
    try {
      const response = await apiFetch(`/api/academic/sessions/${toId(id)}`, {
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

  const getCourseName = (id: string) => {
    const cleanId = toId(id);
    return courses.find(c => toId(c.id) === cleanId)?.course_name || "Unknown Course";
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      const course = courses.find(c => toId(c.id) === toId(session.course_id));

      // Category Filter
      if (selectedCategory !== "all" && toId(course?.category_id) !== toId(selectedCategory)) return false;

      // Course Filter
      if (selectedCourse !== "all" && toId(course?.id) !== toId(selectedCourse)) return false;

      // Search Query
      if (searchQuery.trim() && !session.session_name.toLowerCase().includes(searchQuery.toLowerCase()) && !course?.course_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;

      return true;
    });
  }, [sessions, courses, selectedCategory, selectedCourse, searchQuery]);

  const filteredCoursesForFilter = useMemo(() => {
    if (selectedCategory === "all") return courses;
    return courses.filter(c => toId(c.category_id) === toId(selectedCategory));
  }, [courses, selectedCategory]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Academic Sessions</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Create and manage time-bound sessions for each course.</p>
          </div>
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
                className="bg-primary text-primary-foreground px-6 py-3 rounded-none font-heading font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:opacity-90 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Create New Session
              </button>
            </DialogTrigger>
            <DialogContent className="rounded-none border-border sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="font-heading font-bold uppercase tracking-tight">
                  {isEditing ? "Edit Session" : "Create Session"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {isEditing ? "Update existing session details." : "Create a new time-bound academic session for the selected course."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Course</label>
                  <select
                    required
                    value={form.course_id}
                    onChange={(e) => setForm({ ...form, course_id: e.target.value })}
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="">Select Course</option>
                    {courses.map(c => <option key={c.id || (c as any)._id} value={c.id || (c as any)._id}>{c.course_name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Session Name</label>
                  <input
                    required
                    value={form.session_name}
                    onChange={(e) => setForm({ ...form, session_name: e.target.value })}
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                    placeholder="e.g. DCA - Jan 2026, DCA - Feb 2026"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <DialogFooter className="pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-primary text-primary-foreground py-4 font-heading font-black text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {isEditing ? "Update Session" : "Create Session"}
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card className="rounded-none border-border shadow-sm">
          <CardContent className="p-4 flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="SEARCH SESSIONS..."
                className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-muted/30 text-[10px] font-black uppercase tracking-widest focus:border-primary focus:outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="flex-1 flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setSelectedCourse("all");
                  }}
                  className="w-full border border-border bg-muted/10 dark:bg-neutral-900 text-foreground [&_option]:text-foreground [&_option]:bg-white dark:[&_option]:bg-neutral-900 px-4 py-2 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-primary"
                >
                  <option value="all">All Categories</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>

              <div className="flex-1 flex items-center gap-2">
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="w-full border border-border bg-muted/10 dark:bg-neutral-900 text-foreground [&_option]:text-foreground [&_option]:bg-white dark:[&_option]:bg-neutral-900 px-4 py-2 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-primary"
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
                  className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-all"
                >
                  <X className="w-4 h-4" /> Reset
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : filteredSessions.length === 0 ? (
          <Card className="rounded-none border-dashed border-2 border-border">
            <CardContent className="py-20 flex flex-col items-center text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-lg font-bold uppercase tracking-tight">No Sessions Found</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2">
                {searchQuery || selectedCategory !== "all" || selectedCourse !== "all"
                  ? "No sessions match your filter criteria."
                  : "Define academic sessions to enroll students and schedule exams."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSessions.map((session) => (
              <Card key={session.id} className="rounded-none border-border group hover:border-primary transition-all relative overflow-hidden">
                <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between py-4">
                  <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center gap-2 pr-12">
                    <Calendar className="w-4 h-4 text-primary" />
                    {session.session_name}
                  </CardTitle>
                  <div className="flex items-center gap-2 absolute right-4">
                    <div className={cn(
                      "text-[8px] font-black uppercase px-2 py-1 tracking-widest",
                      session.status === "active" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                    )}>
                      {session.status}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="mb-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Course</div>
                    <div className="text-sm font-bold uppercase tracking-tight">{getCourseName(session.course_id)}</div>
                  </div>

                  <div className="flex items-center gap-2 mt-6 pt-6 border-t border-border">
                    <button
                      onClick={() => handleEdit(session)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-muted/50 hover:bg-primary/10 text-muted-foreground hover:text-primary text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(session.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-muted/50 hover:bg-red-50 text-muted-foreground hover:text-red-500 text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
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

export default AdminSessionsPage;
