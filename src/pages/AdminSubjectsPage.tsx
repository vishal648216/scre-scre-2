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
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Subjects</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Manage individual subjects that can be mapped to multiple courses.</p>
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
                className="bg-primary text-primary-foreground px-6 py-3 rounded-none font-heading font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:opacity-90 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add New Subject
              </button>
            </DialogTrigger>
            <DialogContent className="rounded-none border-border">
              <DialogHeader>
                <DialogTitle className="font-heading font-bold uppercase tracking-tight">
                  {isEditing ? "Edit Subject" : "Add New Subject"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Provide the name and description for the {isEditing ? "subject update" : "new subject"}.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subject Name</label>
                  <input
                    required
                    value={form.subject_name}
                    onChange={(e) => setForm({ ...form, subject_name: e.target.value })}
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                    placeholder="e.g. MS Word"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subject Code</label>
                  <input
                    value={form.subject_code}
                    onChange={(e) => setForm({ ...form, subject_code: e.target.value })}
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                    placeholder="e.g. MSW-101"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary min-h-[100px]"
                    placeholder="Enter subject description..."
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
                    {isEditing ? "Update Subject" : "Create Subject"}
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="rounded-none border-border shadow-sm">
          <CardContent className="p-4 flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="SEARCH SUBJECTS..."
                className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-muted/30 text-[10px] font-black uppercase tracking-widest focus:border-primary focus:outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 lg:w-[280px]">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "name_asc" | "name_desc" | "created_newest" | "created_oldest")}
                className="w-full border border-border bg-muted/10 dark:bg-neutral-900 text-foreground [&_option]:text-foreground [&_option]:bg-white dark:[&_option]:bg-neutral-900 px-4 py-2 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-primary"
              >
                <option value="name_asc">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
                <option value="created_newest">Newest First</option>
                <option value="created_oldest">Oldest First</option>
              </select>
            </div>
            <div className="flex items-center gap-2 lg:w-[280px]">
              <div className="w-4 h-4 flex items-center justify-center text-muted-foreground shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </div>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full border border-border bg-muted/10 dark:bg-neutral-900 text-foreground [&_option]:text-foreground [&_option]:bg-white dark:[&_option]:bg-neutral-900 px-4 py-2 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-primary"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : filteredSubjects.length === 0 ? (
          <Card className="rounded-none border-dashed border-2 border-border">
            <CardContent className="py-20 flex flex-col items-center text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-lg font-bold uppercase tracking-tight">No Subjects Found</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2">
                {searchQuery
                  ? "No subjects match your search."
                  : "Create subjects that can be shared across multiple courses."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto border border-border">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subject Name</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Code</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Created</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSubjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-muted/30 transition-all group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-sm uppercase tracking-tight">{sub.subject_name}</div>
                      <div className="text-[10px] text-muted-foreground line-clamp-1">{sub.description || "No description"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-[10px] bg-muted px-2 py-1 font-mono">{sub.subject_code}</code>
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        "inline-flex items-center px-2 py-1 text-[8px] font-black uppercase tracking-widest",
                        sub.status === "active" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                      )}>
                        {sub.status}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[10px] text-muted-foreground font-medium">
                      {format(new Date(sub.created_at), "dd MMM yyyy")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(sub)}
                          className="p-2 border border-border hover:border-primary hover:text-primary transition-all"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(sub.id)}
                          className="p-2 border border-border hover:border-red-500 hover:text-red-500 transition-all"
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
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminSubjectsPage;
