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

  // Filter courses based on selected category
  const filteredCourses = useMemo(() => {
    if (!selectedCategoryId) {
      return [];
    }
    return courses.filter(course => (course as any).category_id === selectedCategoryId);
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
        setCourses(coursesData);
      }
      if (subsRes.ok) {
        setSubjects(subsData.items || []);
        if (subsData.items?.length > 0) setSelectedSubjectId(subsData.items[0].id || subsData.items[0]._id);
      }
      if (catRes.ok) {
        setCategories(catData.items || []);
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
        const sorted = (data || []).sort((a: Mapping, b: Mapping) => a.subject_order - b.subject_order);
        setMappings(sorted);
        // Pre-select items that are NOT in the mapping for easier adding
        // Or actually, we should show which ones are ALREADY mapped.
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
        setMappings(data || []);
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
        setMappings(data || []);
      }
    } catch (error) {
      toast.error("Failed to load all mappings");
    } finally {
      setLoading(false);
    }
  };

  const isAlreadyMapped = (itemId: string) => {
    if (mode === 'course-to-subject') {
      return mappings.some(m => m.subject_id === itemId);
    } else if (mode === 'subject-to-course') {
      return mappings.some(m => m.course_id === itemId);
    }
    return false;
  };

  const toggleItemSelection = (id: string) => {
    if (isAlreadyMapped(id)) {
      toast.error("This item is already linked");
      return;
    }
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
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
            course_id: selectedCourseId,
            subject_ids: selectedItems
          })
        });
      } else {
        response = await apiFetch("/api/academic/course-subjects/bulk-courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject_id: selectedSubjectId,
            course_ids: selectedItems
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

  const getSubjectName = (id: string) => subjects.find(s => (s.id || (s as any)._id) === id)?.subject_name || "Unknown";
  const getCourseName = (id: string) => courses.find(c => (c.id || (c as any)._id) === id)?.course_name || "Unknown";

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
              <ArrowRightLeft className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-heading font-black text-2xl md:text-3xl text-white uppercase tracking-tight">
                  Course Subject Mapping
                </h1>
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                  {mappings.length} Active Links
                </span>
              </div>
              <p className="text-slate-400 mt-1 text-xs md:text-sm font-medium">
                Establish curriculum mappings between courses and academic subjects.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 shadow-lg">
            <button
              onClick={() => { setMode('course-to-subject'); setSelectedItems([]); }}
              className={cn(
                "px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                mode === 'course-to-subject'
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              Course Mode
            </button>
            <button
              onClick={() => { setMode('subject-to-course'); setSelectedItems([]); }}
              className={cn(
                "px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                mode === 'subject-to-course'
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              Subject Mode
            </button>
            <button
              onClick={() => { setMode('overview'); setSelectedItems([]); }}
              className={cn(
                "px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                mode === 'overview'
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              Overview
            </button>
          </div>
        </div>

        {mode !== 'overview' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT COLUMN: Selection & Bulk Mapping */}
            <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-6 shadow-2xl lg:col-span-1 h-fit sticky top-24 space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  {mode === 'course-to-subject' ? <Layers className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    {mode === 'course-to-subject' ? "Select Course" : "Select Subject"}
                  </h3>
                  <p className="text-[10px] text-slate-400">Choose primary anchor for linkage</p>
                </div>
              </div>

              <div className="space-y-4">
                {mode === 'course-to-subject' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Course Category
                    </label>
                    <select
                      value={selectedCategoryId}
                      onChange={(e) => {
                        setSelectedCategoryId(e.target.value);
                        setSelectedCourseId("");
                      }}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                    >
                      <option value="">Select Category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    {mode === 'course-to-subject' ? "Primary Course" : "Primary Subject"}
                  </label>
                  {mode === 'course-to-subject' ? (
                    <select
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                      disabled={!selectedCategoryId}
                    >
                      <option value="">Select Course</option>
                      {filteredCourses.map(c => <option key={c.id || (c as any)._id} value={c.id || (c as any)._id}>{c.course_name}</option>)}
                    </select>
                  ) : (
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                    >
                      {subjects.map(s => <option key={s.id || (s as any)._id} value={s.id || (s as any)._id}>{s.subject_name}</option>)}
                    </select>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <label className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 block">
                    {mode === 'course-to-subject' ? "Add Multiple Subjects" : "Add Multiple Courses"}
                  </label>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {mode === 'course-to-subject' ? (
                      subjects.map(s => (
                        <button
                          key={s.id || (s as any)._id}
                          type="button"
                          onClick={() => toggleItemSelection(s.id || (s as any)._id)}
                          className={cn(
                            "w-full flex items-center justify-between p-3 rounded-xl text-left text-xs font-bold uppercase tracking-wider border transition-all",
                            isAlreadyMapped(s.id || (s as any)._id)
                              ? "bg-slate-950/40 border-slate-800/50 text-slate-500 opacity-50 cursor-not-allowed"
                              : selectedItems.includes(s.id || (s as any)._id)
                                ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                                : "bg-slate-950/80 border-slate-800/80 text-slate-300 hover:border-slate-700"
                          )}
                        >
                          <span>{s.subject_name}</span>
                          {isAlreadyMapped(s.id || (s as any)._id) ? (
                            <CheckCircle2 className="w-4 h-4 text-slate-500" />
                          ) : selectedItems.includes(s.id || (s as any)._id) ? (
                            <Check className="w-4 h-4 text-indigo-400" />
                          ) : (
                            <Plus className="w-4 h-4 opacity-40" />
                          )}
                        </button>
                      ))
                    ) : (
                      courses.map(c => (
                        <button
                          key={c.id || (c as any)._id}
                          type="button"
                          onClick={() => toggleItemSelection(c.id || (c as any)._id)}
                          className={cn(
                            "w-full flex items-center justify-between p-3 rounded-xl text-left text-xs font-bold uppercase tracking-wider border transition-all",
                            isAlreadyMapped(c.id || (c as any)._id)
                              ? "bg-slate-950/40 border-slate-800/50 text-slate-500 opacity-50 cursor-not-allowed"
                              : selectedItems.includes(c.id || (c as any)._id)
                                ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                                : "bg-slate-950/80 border-slate-800/80 text-slate-300 hover:border-slate-700"
                          )}
                        >
                          <span>{c.course_name}</span>
                          {isAlreadyMapped(c.id || (c as any)._id) ? (
                            <CheckCircle2 className="w-4 h-4 text-slate-500" />
                          ) : selectedItems.includes(c.id || (c as any)._id) ? (
                            <Check className="w-4 h-4 text-indigo-400" />
                          ) : (
                            <Plus className="w-4 h-4 opacity-40" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <button
                  disabled={saving || selectedItems.length === 0}
                  onClick={handleBulkSave}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                  {mode === 'course-to-subject' ? `Link ${selectedItems.length} Subjects` : `Link ${selectedItems.length} Courses`}
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: Current Mappings */}
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-2">
                {mode === 'course-to-subject' ? <Layers className="w-5 h-5 text-indigo-400" /> : <BookOpen className="w-5 h-5 text-indigo-400" />}
                {mode === 'course-to-subject' ? `Subjects Mapped in ${getCourseName(selectedCourseId)}` : `Courses Mapped with ${getSubjectName(selectedSubjectId)}`}
              </h2>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Mappings...</p>
                </div>
              ) : mappings.length === 0 ? (
                <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl p-16 flex flex-col items-center text-center">
                  <X className="w-12 h-12 text-slate-600 mb-4 opacity-40" />
                  <h3 className="text-lg font-bold text-white uppercase tracking-tight">No Mappings Found</h3>
                  <p className="text-slate-400 text-xs max-w-sm mt-1">
                    Select items from the panel on the left to establish links.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mappings.map((m) => (
                    <div
                      key={m.id || (m as any)._id}
                      className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 hover:border-indigo-500/50 rounded-2xl p-4 flex items-center justify-between shadow-xl transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-xs">
                          {m.subject_order}
                        </div>
                        <div className="font-bold text-xs text-white uppercase tracking-tight group-hover:text-indigo-300 transition-colors">
                          {mode === 'course-to-subject' ? getSubjectName(m.subject_id) : getCourseName(m.course_id)}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(m.id || (m as any)._id)}
                        className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-600/20 hover:text-rose-400 border border-slate-700/60 hover:border-rose-500/40 text-slate-400 transition-all"
                        title="Remove link"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex items-center justify-center gap-3 mb-8">
              <button
                onClick={() => setOverviewMode('by-course')}
                className={cn(
                  "px-6 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all border",
                  overviewMode === 'by-course'
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/25"
                    : "bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white"
                )}
              >
                Group By Course
              </button>
              <button
                onClick={() => setOverviewMode('by-subject')}
                className={cn(
                  "px-6 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all border",
                  overviewMode === 'by-subject'
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/25"
                    : "bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white"
                )}
              >
                Group By Subject
              </button>
            </div>

            {overviewMode === 'by-course' ? (
              <div className="space-y-12">
                {categories.map(cat => {
                  const catCourses = courses.filter(c => (c as any).category_id === cat.id);
                  if (catCourses.length === 0) return null;
                  return (
                    <div key={cat.id} className="space-y-6">
                      <h3 className="text-sm font-black uppercase tracking-wider text-indigo-400 border-l-4 border-indigo-500 pl-4">
                        {cat.name}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {catCourses.map(course => {
                          const courseMappings = mappings.filter(m => m.course_id === (course.id || (course as any)._id));
                          return (
                            <div
                              key={course.id || (course as any)._id}
                              className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 hover:border-indigo-500/50 rounded-3xl overflow-hidden shadow-2xl transition-all group flex flex-col justify-between"
                            >
                              <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                                <h4 className="text-xs font-bold text-white uppercase tracking-tight group-hover:text-indigo-300 transition-colors">
                                  {course.course_name}
                                </h4>
                                <span className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                                  {courseMappings.length} Subjects
                                </span>
                              </div>
                              <div className="p-4 space-y-2 flex-1">
                                {courseMappings.length === 0 ? (
                                  <p className="text-xs text-slate-500 italic py-2">No subjects mapped yet</p>
                                ) : (
                                  <div className="space-y-2">
                                    {courseMappings.sort((a, b) => a.subject_order - b.subject_order).map(m => (
                                      <div key={m.id || (m as any)._id} className="flex items-center justify-between group/item text-xs text-slate-300 p-2 rounded-xl bg-slate-950/40 border border-slate-800/60">
                                        <div className="flex items-center gap-2 font-semibold uppercase tracking-tight">
                                          <span className="w-5 h-5 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-[10px] font-bold">{m.subject_order}</span>
                                          {getSubjectName(m.subject_id)}
                                        </div>
                                        <button
                                          onClick={() => handleDelete(m.id || (m as any)._id)}
                                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                                          title="Remove link"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
                                <button
                                  onClick={() => {
                                    setSelectedCourseId(course.id || (course as any)._id);
                                    setMode('course-to-subject');
                                    toast.info(`Redirected to manage ${course.course_name}`);
                                  }}
                                  className="w-full py-2 rounded-xl bg-slate-800/80 hover:bg-indigo-600/20 hover:text-indigo-300 border border-slate-700/60 text-[10px] font-bold uppercase tracking-wider text-slate-300 transition-all flex items-center justify-center gap-1.5"
                                >
                                  <Plus className="w-3.5 h-3.5" /> Manage Subjects
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {subjects.map(subject => {
                  const subjectMappings = mappings.filter(m => m.subject_id === (subject.id || (subject as any)._id));
                  return (
                    <div
                      key={subject.id || (subject as any)._id}
                      className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 hover:border-indigo-500/50 rounded-3xl overflow-hidden shadow-2xl transition-all group flex flex-col justify-between"
                    >
                      <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-white uppercase tracking-tight group-hover:text-indigo-300 transition-colors">
                          {subject.subject_name}
                        </h4>
                        <span className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                          {subjectMappings.length} Courses
                        </span>
                      </div>
                      <div className="p-4 space-y-2 flex-1">
                        {subjectMappings.length === 0 ? (
                          <p className="text-xs text-slate-500 italic py-2">Not linked to any course</p>
                        ) : (
                          <div className="space-y-2">
                            {subjectMappings.map(m => (
                              <div key={m.id || (m as any)._id} className="flex items-center justify-between text-xs text-slate-300 p-2 rounded-xl bg-slate-950/40 border border-slate-800/60">
                                <div className="flex items-center gap-2 font-semibold uppercase tracking-tight">
                                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                                  {getCourseName(m.course_id)}
                                </div>
                                <button
                                  onClick={() => handleDelete(m.id || (m as any)._id)}
                                  className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                                  title="Remove link"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
                        <button
                          onClick={() => {
                            setSelectedSubjectId(subject.id || (subject as any)._id);
                            setMode('subject-to-course');
                            toast.info(`Redirected to manage ${subject.subject_name}`);
                          }}
                          className="w-full py-2 rounded-xl bg-slate-800/80 hover:bg-indigo-600/20 hover:text-indigo-300 border border-slate-700/60 text-[10px] font-bold uppercase tracking-wider text-slate-300 transition-all flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" /> Manage Courses
                        </button>
                      </div>
                    </div>
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
