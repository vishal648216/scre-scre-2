import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2, Trash2, BookOpen, Layers, ArrowRightLeft, Check, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Course {
  id: string;
  course_name: string;
}

interface Subject {
  id: string;
  subject_name: string;
}

interface Mapping {
  id: string;
  course_id: string;
  subject_id: string;
  subject_order: number;
}

const AdminCourseSubjectMappingPage = () => {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);

  // View Modes: 'course-to-subject' | 'subject-to-course' | 'overview'
  const [mode, setMode] = useState<'course-to-subject' | 'subject-to-course' | 'overview'>('course-to-subject');
  const [overviewMode, setOverviewMode] = useState<'by-course' | 'by-subject'>('by-course');

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");

  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  // Bulk selection
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // All mappings for overview
  const [allMappings, setAllMappings] = useState<Mapping[]>([]);
  const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);

  const toId = (val: any): string => {
    if (!val) return "";
    if (typeof val === "string") return val;
    if (typeof val === "object") {
      if (val.$oid) return String(val.$oid);
      if (val._id) return toId(val._id);
    }
    return String(val);
  };

  // Filter courses based on selected category (or return all if no category selected)
  const filteredCourses = useMemo(() => {
    if (!selectedCategoryId) {
      return courses;
    }
    return courses.filter(course => toId((course as any).category_id) === toId(selectedCategoryId));
  }, [courses, selectedCategoryId]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (mode === 'course-to-subject' && selectedCourseId) {
      fetchMappings(selectedCourseId);
    } else if (mode === 'subject-to-course' && selectedSubjectId) {
      fetchSubjectMappings(selectedSubjectId);
    } else if (mode === 'overview') {
      fetchAllMappings();
    }
  }, [selectedCourseId, mode, selectedSubjectId]);

  const fetchInitialData = async () => {
    try {
      const [coursesRes, subsRes, catRes] = await Promise.all([
        apiFetch("/api/courses"),
        apiFetch("/api/admin/subjects"),
        apiFetch("/api/admin/categories")
      ]);

      const coursesData = await coursesRes.json();
      const subsData = await subsRes.json();
      const catData = await catRes.json();

      if (coursesRes.ok) {
        const rawCourses = Array.isArray(coursesData) ? coursesData : (coursesData.items || []);
        const normCourses = rawCourses.map((c: any) => ({
          ...c,
          id: toId(c._id || c.id),
          category_id: toId(c.category_id)
        }));
        setCourses(normCourses);
        if (normCourses.length > 0 && !selectedCourseId) {
          setSelectedCourseId(normCourses[0].id);
        }
      }
      if (subsRes.ok) {
        const rawSubs = Array.isArray(subsData) ? subsData : (subsData.items || []);
        const normSubs = rawSubs.map((s: any) => ({
          ...s,
          id: toId(s._id || s.id)
        }));
        setSubjects(normSubs);
        if (normSubs.length > 0 && !selectedSubjectId) {
          setSelectedSubjectId(normSubs[0].id);
        }
      }
      if (catRes.ok) {
        const rawCats = Array.isArray(catData) ? catData : (catData.items || []);
        const normCats = rawCats.map((c: any) => ({
          ...c,
          id: toId(c._id || c.id),
          name: c.name || c.category_name || "Category"
        }));
        setCategories(normCats);
      }

    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchMappings = async (courseId: string) => {
    try {
      const response = await apiFetch(`/api/academic/course-subjects/${courseId}`);
      const data = await response.json();
      if (response.ok) {
        const norm = (data || []).map((m: any) => ({
          ...m,
          id: toId(m._id || m.id),
          course_id: toId(m.course_id),
          subject_id: toId(m.subject_id)
        }));
        const sorted = norm.sort((a: Mapping, b: Mapping) => a.subject_order - b.subject_order);
        setMappings(sorted);
      }
    } catch (error) {
      toast.error("Failed to load mappings");
    }
  };

  const fetchSubjectMappings = async (subjectId: string) => {
    try {
      const response = await apiFetch(`/api/academic/course-subjects/subject/${subjectId}`);
      const data = await response.json();
      if (response.ok) {
        const norm = (data || []).map((m: any) => ({
          ...m,
          id: toId(m._id || m.id),
          course_id: toId(m.course_id),
          subject_id: toId(m.subject_id)
        }));
        setMappings(norm);
      }
    } catch (error) {
      toast.error("Failed to load mappings");
    }
  };

  const fetchAllMappings = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/academic/course-subjects/all");
      const data = await response.json();
      if (response.ok) {
        const norm = (data || []).map((m: any) => ({
          ...m,
          id: toId(m._id || m.id),
          course_id: toId(m.course_id),
          subject_id: toId(m.subject_id)
        }));
        setMappings(norm);
      }
    } catch (error) {
      toast.error("Failed to load all mappings");
    } finally {
      setLoading(false);
    }
  };

  const isAlreadyMapped = (itemId: string) => {
    const cleanId = toId(itemId);
    if (mode === 'course-to-subject') {
      return mappings.some(m => toId(m.subject_id) === cleanId);
    } else if (mode === 'subject-to-course') {
      return mappings.some(m => toId(m.course_id) === cleanId);
    }
    return false;
  };

  const toggleItemSelection = (id: string) => {
    if (isAlreadyMapped(id)) {
      toast.error("This item is already linked");
      return;
    }
    const cleanId = toId(id);
    setSelectedItems(prev =>
      prev.includes(cleanId) ? prev.filter(i => i !== cleanId) : [...prev, cleanId]
    );
  };

  const handleBulkSave = async () => {
    if (selectedItems.length === 0) {
      toast.error("Please select at least one item");
      return;
    }

    setSaving(true);
    try {
      let response;
      if (mode === 'course-to-subject') {
        response = await apiFetch("/api/academic/course-subjects/bulk-subjects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_id: toId(selectedCourseId),
            subject_ids: selectedItems.map(toId)
          })
        });
      } else {
        response = await apiFetch("/api/academic/course-subjects/bulk-courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject_id: toId(selectedSubjectId),
            course_ids: selectedItems.map(toId)
          })
        });
      }

      if (response.ok) {
        toast.success("Mapping updated successfully");
        setIsAdding(false);
        setSelectedItems([]);
        if (mode === 'course-to-subject') fetchMappings(selectedCourseId);
        else if (mode === 'subject-to-course') fetchSubjectMappings(selectedSubjectId);
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

  const handleDelete = async (mappingId: string) => {
    if (!confirm("Remove this mapping?")) return;
    try {
      const response = await apiFetch(`/api/academic/course-subjects/mapping/${mappingId}`, { method: "DELETE" });
      if (response.ok) {
        toast.success("Mapping removed");
        if (mode === 'course-to-subject') fetchMappings(selectedCourseId);
        else if (mode === 'subject-to-course') fetchSubjectMappings(selectedSubjectId);
        else if (mode === 'overview') fetchAllMappings();
      } else {
        toast.error("Failed to remove mapping");
      }
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  const getSubjectName = (id: string) => {
    const cleanId = toId(id);
    return subjects.find(s => toId(s.id) === cleanId)?.subject_name || "Unknown";
  };
  const getCourseName = (id: string) => {
    const cleanId = toId(id);
    return courses.find(c => toId(c.id) === cleanId)?.course_name || "Unknown";
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Subject Mapping</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Link subjects and courses together efficiently.</p>
          </div>

          <div className="flex items-center gap-2 bg-muted p-1 rounded-none border border-border">
            <button
              onClick={() => { setMode('course-to-subject'); setSelectedItems([]); }}
              className={cn(
                "px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                mode === 'course-to-subject' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Course Mode
            </button>
            <button
              onClick={() => { setMode('subject-to-course'); setSelectedItems([]); }}
              className={cn(
                "px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                mode === 'subject-to-course' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Subject Mode
            </button>
            <button
              onClick={() => { setMode('overview'); setSelectedItems([]); }}
              className={cn(
                "px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                mode === 'overview' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Overview
            </button>
          </div>
        </div>

        {mode !== 'overview' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT COLUMN: Selection & Bulk Mapping */}
            <Card className="rounded-none border-border lg:col-span-1 h-fit sticky top-24">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
                  {mode === 'course-to-subject' ? <Layers className="w-4 h-4 text-primary" /> : <BookOpen className="w-4 h-4 text-primary" />}
                  {mode === 'course-to-subject' ? "Select Course" : "Select Subject"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {mode === 'course-to-subject' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Course Category
                    </label>
                    <select
                      value={selectedCategoryId}
                      onChange={(e) => {
                        setSelectedCategoryId(e.target.value);
                        setSelectedCourseId(""); // Reset selected course when category changes
                      }}
                      className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                    >
                      <option value="">Select Category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {mode === 'course-to-subject' ? "Primary Course" : "Primary Subject"}
                  </label>
                  {mode === 'course-to-subject' ? (
                    <select
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                      disabled={!selectedCategoryId}
                    >
                      <option value="">Select Course</option>
                      {filteredCourses.map(c => <option key={c.id || (c as any)._id} value={c.id || (c as any)._id}>{c.course_name}</option>)}
                    </select>
                  ) : (
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                      className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
                    >
                      {subjects.map(s => <option key={s.id || (s as any)._id} value={s.id || (s as any)._id}>{s.subject_name}</option>)}
                    </select>
                  )}
                </div>

                <div className="pt-4 border-t border-border">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4 block">
                    {mode === 'course-to-subject' ? "Add Multiple Subjects" : "Add Multiple Courses"}
                  </label>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {mode === 'course-to-subject' ? (
                      subjects.map(s => (
                        <button
                          key={s.id || (s as any)._id}
                          type="button"
                          onClick={() => toggleItemSelection(s.id || (s as any)._id)}
                          className={cn(
                            "w-full flex items-center justify-between p-3 text-left text-xs font-bold uppercase tracking-tight border transition-all",
                            isAlreadyMapped(s.id || (s as any)._id) ? "bg-muted border-border/50 text-muted-foreground opacity-50 cursor-not-allowed" :
                              selectedItems.includes(s.id || (s as any)._id) ? "bg-primary/10 border-primary text-primary" : "border-border hover:bg-muted"
                          )}
                        >
                          {s.subject_name}
                          {isAlreadyMapped(s.id || (s as any)._id) ? <CheckCircle2 className="w-4 h-4 text-muted-foreground" /> :
                            selectedItems.includes(s.id || (s as any)._id) ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4 opacity-30" />}
                        </button>
                      ))
                    ) : (
                      courses.map(c => (
                        <button
                          key={c.id || (c as any)._id}
                          type="button"
                          onClick={() => toggleItemSelection(c.id || (c as any)._id)}
                          className={cn(
                            "w-full flex items-center justify-between p-3 text-left text-xs font-bold uppercase tracking-tight border transition-all",
                            isAlreadyMapped(c.id || (c as any)._id) ? "bg-muted border-border/50 text-muted-foreground opacity-50 cursor-not-allowed" :
                              selectedItems.includes(c.id || (c as any)._id) ? "bg-primary/10 border-primary text-primary" : "border-border hover:bg-muted"
                          )}
                        >
                          {c.course_name}
                          {isAlreadyMapped(c.id || (c as any)._id) ? <CheckCircle2 className="w-4 h-4 text-muted-foreground" /> :
                            selectedItems.includes(c.id || (c as any)._id) ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4 opacity-30" />}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <button
                  disabled={saving || selectedItems.length === 0}
                  onClick={handleBulkSave}
                  className="w-full bg-primary text-primary-foreground py-4 font-heading font-black text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                  {mode === 'course-to-subject' ? `Link ${selectedItems.length} Subjects` : `Link ${selectedItems.length} Courses`}
                </button>
              </CardContent>
            </Card>

            {/* RIGHT COLUMN: Current Mappings */}
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-lg font-bold uppercase tracking-tight flex items-center gap-2">
                {mode === 'course-to-subject' ? <Layers className="w-5 h-5 text-primary" /> : <BookOpen className="w-5 h-5 text-primary" />}
                {mode === 'course-to-subject' ? `Subjects in ${getCourseName(selectedCourseId)}` : `Courses with ${getSubjectName(selectedSubjectId)}`}
              </h2>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                </div>
              ) : (
                mappings.length === 0 ? (
                  <Card className="rounded-none border-dashed border-2 border-border">
                    <CardContent className="py-20 flex flex-col items-center text-center">
                      <X className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                      <h3 className="text-lg font-bold uppercase tracking-tight">No Mappings Found</h3>
                      <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2">
                        Use the panel on the left to create linkages.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {mappings.map((m) => (
                      <Card key={m.id || (m as any)._id} className="rounded-none border-border group hover:border-primary transition-all">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-muted text-muted-foreground flex items-center justify-center font-black text-[10px] border border-border group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                              {m.subject_order}
                            </div>
                            <div className="font-bold text-xs uppercase tracking-tight">
                              {mode === 'course-to-subject' ? getSubjectName(m.subject_id) : getCourseName(m.course_id)}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDelete(m.id || (m as any)._id)}
                            className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex items-center justify-center gap-4 mb-8">
              <button
                onClick={() => setOverviewMode('by-course')}
                className={cn(
                  "px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all border",
                  overviewMode === 'by-course' ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:text-foreground"
                )}
              >
                By Course
              </button>
              <button
                onClick={() => setOverviewMode('by-subject')}
                className={cn(
                  "px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all border",
                  overviewMode === 'by-subject' ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:text-foreground"
                )}
              >
                By Subject
              </button>
            </div>

            {overviewMode === 'by-course' ? (
              <div className="space-y-12">
                {categories.map(cat => {
                  const catCourses = courses.filter(c => (c as any).category_id === cat.id);
                  if (catCourses.length === 0) return null;
                  return (
                    <div key={cat.id} className="space-y-6">
                      <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary border-l-4 border-primary pl-4">{cat.name}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {catCourses.map(course => {
                          const courseMappings = mappings.filter(m => m.course_id === (course.id || (course as any)._id));
                          return (
                            <Card key={course.id || (course as any)._id} className="rounded-none border-border overflow-hidden group hover:border-primary transition-all">
                              <CardHeader className="bg-muted/50 border-b py-3 group-hover:bg-primary/5 transition-all">
                                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center justify-between">
                                  {course.course_name}
                                  <span className="bg-primary text-primary-foreground px-2 py-0.5 text-[8px]">{courseMappings.length}</span>
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="p-4">
                                {courseMappings.length === 0 ? (
                                  <p className="text-[10px] text-muted-foreground italic">No subjects mapped</p>
                                ) : (
                                  <div className="space-y-2">
                                    {courseMappings.sort((a, b) => a.subject_order - b.subject_order).map(m => (
                                      <div key={m.id || (m as any)._id} className="flex items-center justify-between group/item">
                                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-tight text-foreground/80">
                                          <div className="w-4 h-4 bg-muted flex items-center justify-center text-[7px] border border-border group-hover:border-primary/30 transition-all">{m.subject_order}</div>
                                          {getSubjectName(m.subject_id)}
                                        </div>
                                        <button
                                          onClick={() => handleDelete(m.id || (m as any)._id)}
                                          className="p-1 text-muted-foreground hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-all"
                                          title="Remove link"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="mt-4 pt-3 border-t border-dashed border-border">
                                  <button
                                    onClick={() => {
                                      setSelectedCourseId(course.id || (course as any)._id);
                                      setMode('course-to-subject');
                                      toast.info(`Redirected to manage ${course.course_name}`);
                                    }}
                                    className="w-full py-2 text-[8px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-1"
                                  >
                                    <Plus className="w-3 h-3" /> Add Subjects
                                  </button>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                {/* Courses without category if any */}
                {(() => {
                  const uncategorizedCourses = courses.filter(c => !categories.some(cat => cat.id === (c as any).category_id));
                  if (uncategorizedCourses.length === 0) return null;
                  return (
                    <div className="space-y-6">
                      <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground border-l-4 border-muted-foreground pl-4">Uncategorized Courses</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {uncategorizedCourses.map(course => {
                          const courseMappings = mappings.filter(m => m.course_id === (course.id || (course as any)._id));
                          return (
                            <Card key={course.id || (course as any)._id} className="rounded-none border-border overflow-hidden">
                              <CardHeader className="bg-muted/50 border-b py-3">
                                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center justify-between">
                                  {course.course_name}
                                  <span className="bg-primary text-primary-foreground px-2 py-0.5 text-[8px]">{courseMappings.length}</span>
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="p-4">
                                {courseMappings.length === 0 ? (
                                  <p className="text-[10px] text-muted-foreground italic">No subjects mapped</p>
                                ) : (
                                  <div className="space-y-2">
                                    {courseMappings.sort((a, b) => a.subject_order - b.subject_order).map(m => (
                                      <div key={m.id || (m as any)._id} className="flex items-center justify-between group/item">
                                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-tight text-foreground/80">
                                          <div className="w-4 h-4 bg-muted flex items-center justify-center text-[7px] border border-border">{m.subject_order}</div>
                                          {getSubjectName(m.subject_id)}
                                        </div>
                                        <button
                                          onClick={() => handleDelete(m.id || (m as any)._id)}
                                          className="p-1 text-muted-foreground hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-all"
                                          title="Remove link"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="mt-4 pt-3 border-t border-dashed border-border">
                                  <button
                                    onClick={() => {
                                      setSelectedCourseId(course.id || (course as any)._id);
                                      setMode('course-to-subject');
                                      toast.info(`Redirected to manage ${course.course_name}`);
                                    }}
                                    className="w-full py-2 text-[8px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-1"
                                  >
                                    <Plus className="w-3 h-3" /> Add Subjects
                                  </button>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {subjects.map(subject => {
                  const subjectMappings = mappings.filter(m => m.subject_id === (subject.id || (subject as any)._id));
                  return (
                    <Card key={subject.id || (subject as any)._id} className="rounded-none border-border overflow-hidden group hover:border-primary transition-all">
                      <CardHeader className="bg-muted/50 border-b py-3 group-hover:bg-primary/5 transition-all">
                        <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center justify-between">
                          {subject.subject_name}
                          <span className="bg-primary text-primary-foreground px-2 py-0.5 text-[8px]">{subjectMappings.length}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        {subjectMappings.length === 0 ? (
                          <p className="text-[10px] text-muted-foreground italic">Not linked to any course</p>
                        ) : (
                          <div className="space-y-2">
                            {subjectMappings.map(m => (
                              <div key={m.id || (m as any)._id} className="flex items-center justify-between group/item">
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-tight text-foreground/80">
                                  <Layers className="w-3 h-3 text-primary opacity-50" />
                                  {getCourseName(m.course_id)}
                                </div>
                                <button
                                  onClick={() => handleDelete(m.id || (m as any)._id)}
                                  className="p-1 text-muted-foreground hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-all"
                                  title="Remove link"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-4 pt-3 border-t border-dashed border-border">
                          <button
                            onClick={() => {
                              setSelectedSubjectId(subject.id || (subject as any)._id);
                              setMode('subject-to-course');
                              toast.info(`Redirected to manage ${subject.subject_name}`);
                            }}
                            className="w-full py-2 text-[8px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add Courses
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminCourseSubjectMappingPage;
