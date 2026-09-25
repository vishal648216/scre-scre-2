import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2, Pencil, Trash2, BookOpen, CheckCircle2, Search, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";

interface Subject {
  id: string;
  subject_name: string;
  subject_code: string;
  description?: string;
  status: string;
  created_at: string;
}

const AdminSubjectsPage = () => {
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [courseSubjectMappings, setCourseSubjectMappings] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "created_newest" | "created_oldest">("name_asc");

  const [form, setForm] = useState({
    subject_name: "",
    subject_code: "",
    description: "",
    status: "active"
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      const [subjectsRes, categoriesRes, coursesRes, mappingsRes] = await Promise.all([
        apiFetch("/api/admin/subjects"),
        apiFetch("/api/admin/categories"),
        apiFetch("/api/courses"),
        apiFetch("/api/academic/course-subjects/all")
      ]);

      const subjectsData = await subjectsRes.json();
      const categoriesData = await categoriesRes.json();
      const coursesData = await coursesRes.json();
      const mappingsData = await mappingsRes.json();

      if (subjectsRes.ok) setSubjects(subjectsData.items || []);
      if (categoriesRes.ok) setCategories(categoriesData.items || []);
      if (coursesRes.ok) setCourses(coursesData);
      if (mappingsRes.ok) setCourseSubjectMappings(mappingsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = isEditing ? `/api/admin/subjects/${selectedSubject?.id}` : "/api/admin/subjects";
      const method = isEditing ? "PUT" : "POST";

      const response = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      if (response.ok) {
        toast.success(isEditing ? "Subject updated" : "Subject created");
        setIsAdding(false);
        setIsEditing(false);
        setForm({ subject_name: "", description: "", status: "active" });
        fetchSubjects();
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

  const handleEdit = (sub: Subject) => {
    setSelectedSubject(sub);
    setForm({
      subject_name: sub.subject_name,
      subject_code: sub.subject_code || "",
      description: sub.description || "",
      status: sub.status
    });
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this subject?")) return;
    try {
      const response = await apiFetch(`/api/admin/subjects/${id}`, { method: "DELETE" });
      if (response.ok) {
        toast.success("Subject deleted");
        fetchSubjects();
      } else {
        const data = await response.json();
        toast.error(data.message || "Delete failed");
      }
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  const filteredSubjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let filtered = subjects.filter((subject) => {
      if (!query) return true;
      return (
        (subject.subject_name || "").toLowerCase().includes(query) ||
        (subject.subject_code || "").toLowerCase().includes(query) ||
        (subject.description || "").toLowerCase().includes(query)
      );
    });

    if (selectedCategoryId && selectedCategoryId !== "all") {
      // Get all courses in this category
      const categoryCourses = courses.filter(
        (course) => (course.id || course._id) && (course as any).category_id === selectedCategoryId
      );
      const categoryCourseIds = categoryCourses.map((course) => course.id || course._id);

      // Get all subjects linked to any of these courses via mappings
      const subjectIdsInCategory = new Set<string>();
      courseSubjectMappings.forEach((mapping) => {
        if (categoryCourseIds.includes(mapping.course_id)) {
          subjectIdsInCategory.add(mapping.subject_id);
        }
      });

      filtered = filtered.filter((subject) => subjectIdsInCategory.has(subject.id));
    }

    return [...filtered].sort((a, b) => {
      if (sortBy === "name_asc") return a.subject_name.localeCompare(b.subject_name);
      if (sortBy === "name_desc") return b.subject_name.localeCompare(a.subject_name);
      if (sortBy === "created_oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [subjects, searchQuery, sortBy, selectedCategoryId, courses, courseSubjectMappings]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16 relative">
        {/* Ambient background glows */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />

        {/* Page Header */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-heading font-black text-2xl md:text-3xl text-white uppercase tracking-tight">
                  Academic Subjects
                </h1>
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                  {subjects.length} Subjects
                </span>
              </div>
              <p className="text-slate-400 mt-1 text-xs md:text-sm font-medium">
                Manage individual modules & subjects mapped to diploma courses.
              </p>
            </div>
          </div>

          <Dialog open={isAdding || isEditing} onOpenChange={(open) => {
            if (!open) {
              setIsAdding(false);
              setIsEditing(false);
              setForm({ subject_name: "", subject_code: "", description: "", status: "active" });
            }
          }}>
            <DialogTrigger asChild>
              <button
                onClick={() => setIsAdding(true)}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all transform active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" /> Add Subject
              </button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl border border-indigo-500/30 bg-slate-950/95 backdrop-blur-3xl text-slate-100 shadow-2xl p-6 sm:p-8">
              <DialogHeader className="border-b border-slate-800/80 pb-4">
                <DialogTitle className="font-heading font-black text-xl text-white uppercase tracking-tight flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                  {isEditing ? "Edit Subject" : "Create New Subject"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Provide details for {isEditing ? "updating this subject" : "creating a new subject"}.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Subject Name *</label>
                  <input
                    required
                    value={form.subject_name}
                    onChange={(e) => setForm({ ...form, subject_name: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                    placeholder="e.g. MS Word & Office Automation"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Subject Code</label>
                  <input
                    value={form.subject_code}
                    onChange={(e) => setForm({ ...form, subject_code: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                    placeholder="e.g. MSW-101"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all min-h-[90px]"
                    placeholder="Enter syllabus details or subject scope..."
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
                    {isEditing ? "Update Subject" : "Save Subject"}
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filter Bar */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-4 shadow-xl flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="SEARCH SUBJECTS BY NAME OR CODE..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-800 bg-slate-950/80 text-xs font-bold text-slate-100 placeholder-slate-500 uppercase tracking-wider focus:border-indigo-500 focus:outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 lg:w-[500px]">
            <div className="flex-1 flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "name_asc" | "name_desc" | "created_newest" | "created_oldest")}
                className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 text-xs font-bold text-slate-100 px-4 py-3 uppercase tracking-wider focus:border-indigo-500 focus:outline-none transition-all"
              >
                <option value="name_asc">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
                <option value="created_newest">Newest First</option>
                <option value="created_oldest">Oldest First</option>
              </select>
            </div>

            <div className="flex-1 flex items-center gap-2">
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 text-xs font-bold text-slate-100 px-4 py-3 uppercase tracking-wider focus:border-indigo-500 focus:outline-none transition-all"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table / List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Subjects...</p>
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl p-16 flex flex-col items-center text-center">
            <BookOpen className="w-12 h-12 text-slate-600 mb-4 opacity-40" />
            <h3 className="text-lg font-bold text-white uppercase tracking-tight">No Subjects Found</h3>
            <p className="text-slate-400 text-xs max-w-sm mt-1 mb-6">
              {searchQuery
                ? "No subjects match your current search criteria."
                : "Create subjects to map into your course structures."}
            </p>
            <button
              onClick={() => setIsAdding(true)}
              className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Subject
            </button>
          </div>
        ) : (
          <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Subject Title</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Code</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Created</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs text-slate-300">
                  {filteredSubjects.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-800/40 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-sm text-white uppercase tracking-tight group-hover:text-indigo-300 transition-colors">
                          {sub.subject_name}
                        </div>
                        <div className="text-slate-400 text-[11px] line-clamp-1 mt-0.5">
                          {sub.description || "No description provided."}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-[11px] font-mono font-bold bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-indigo-300">
                          {sub.subject_code || "N/A"}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 border",
                          sub.status === "active"
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                        )}>
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            sub.status === "active" ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                          )} />
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-400">
                        {format(new Date(sub.created_at), "dd MMM yyyy")}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(sub)}
                            className="p-2 rounded-xl bg-slate-800/80 hover:bg-indigo-600/20 hover:text-indigo-300 border border-slate-700/60 hover:border-indigo-500/40 text-slate-300 transition-all"
                            title="Edit Subject"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(sub.id)}
                            className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-600/20 hover:text-rose-400 border border-slate-700/60 hover:border-rose-500/40 text-slate-300 transition-all"
                            title="Delete Subject"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminSubjectsPage;

