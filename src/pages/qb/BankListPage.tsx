import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Plus, Loader2, Search, ArrowRight, FolderPlus, Trash2, Edit, Eye } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, parseJsonArrayResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface QuestionBank {
  _id?: string;
  name: string;
  created_at: string;
  question_count?: number;
  target_question_count?: number;
  category_id?: string;
  course_id?: string;
  subject_id?: string;
}

interface Category {
  id: string;
  name: string;
}

interface Course {
  id?: string;
  _id?: string;
  course_name: string;
  category_id?: string;
}

interface Subject {
  id?: string;
  _id?: string;
  subject_name: string;
}

const BankListPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courseSubjectMappings, setCourseSubjectMappings] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<string>("new");

  // Create Dialog
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    target_question_count: 0,
    category_id: "",
    course_id: "",
    subject_id: ""
  });

  // Edit Dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<QuestionBank | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    target_question_count: 0,
    category_id: "",
    course_id: "",
    subject_id: ""
  });

  // Delete
  const [deleting, setDeleting] = useState<string | null>(null);

  // Read more state per bank
  const [expandedNames, setExpandedNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [banksRes, categoriesRes, coursesRes, subjectsRes, mappingsRes] = await Promise.all([
        apiFetch("/api/qb/banks"),
        apiFetch("/api/admin/categories"),
        apiFetch("/api/courses"),
        apiFetch("/api/admin/subjects"),
        apiFetch("/api/academic/course-subjects/all")
      ]);

      const banksData = await parseJsonArrayResponse(banksRes);
      const categoriesData = await categoriesRes.json();
      const coursesData = await coursesRes.json();
      const subjectsData = await subjectsRes.json();
      const mappingsData = await mappingsRes.json();

      setBanks(banksData as QuestionBank[]);
      setCategories(categoriesData.items || []);
      setCourses(coursesData || []);
      setSubjects(subjectsData.items || []);
      setCourseSubjectMappings(mappingsData || []);
    } catch (error) {
      toast.error(t("Failed to load data"));
    } finally {
      setLoading(false);
    }
  };

  // Filter courses for create/edit form
  const getFilteredCourses = (catId: string) => {
    if (!catId) return [];
    return courses.filter(course => (course as any).category_id === catId);
  };

  // Filter subjects for create/edit form
  const getFilteredSubjects = (courseId: string) => {
    if (!courseId) return [];
    const subjectIdsInCourse = new Set<string>();
    courseSubjectMappings.forEach((mapping) => {
      if (mapping.course_id === courseId) {
        subjectIdsInCourse.add(mapping.subject_id);
      }
    });
    return subjects.filter((subject) => subjectIdsInCourse.has(subject.id || subject._id));
  };

  // For filters (top section)
  const filterCourses = useMemo(() => {
    if (filterCategory === "all") return [];
    return courses.filter(course => (course as any).category_id === filterCategory);
  }, [courses, filterCategory]);

  const filterSubjects = useMemo(() => {
    if (filterCourse === "all") return [];
    const subjectIdsInCourse = new Set<string>();
    courseSubjectMappings.forEach((mapping) => {
      if (mapping.course_id === filterCourse) {
        subjectIdsInCourse.add(mapping.subject_id);
      }
    });
    return subjects.filter((subject) => subjectIdsInCourse.has(subject.id || subject._id));
  }, [subjects, courseSubjectMappings, filterCourse]);

  // Filtered and sorted banks
  const filteredBanks = useMemo(() => {
    let filtered = [...banks];

    // Search filter
    if (search) {
      filtered = filtered.filter((bank) => bank.name.toLowerCase().includes(search.toLowerCase()));
    }

    // Category filter
    if (filterCategory !== "all") {
      filtered = filtered.filter((bank) => bank.category_id === filterCategory);
    }

    // Course filter
    if (filterCourse !== "all") {
      const subjectIdsInCourse = new Set<string>();
      courseSubjectMappings.forEach((mapping) => {
        if (mapping.course_id === filterCourse) {
          subjectIdsInCourse.add(mapping.subject_id);
        }
      });
      filtered = filtered.filter((bank) => subjectIdsInCourse.has(bank.subject_id || ""));
    }

    // Subject filter
    if (filterSubject !== "all") {
      filtered = filtered.filter((bank) => bank.subject_id === filterSubject);
    }

    // Sort
    filtered.sort((a, b) => {
      const aDate = new Date(a.created_at).getTime();
      const bDate = new Date(b.created_at).getTime();
      if (sortOrder === "new") {
        return bDate - aDate;
      } else {
        return aDate - bDate;
      }
    });

    return filtered;
  }, [banks, search, filterCategory, filterCourse, filterSubject, sortOrder, courseSubjectMappings]);

  const handleCreateBank = async () => {
    if (!createForm.name.trim()) {
      toast.error(t("Bank name is required"));
      return;
    }

    try {
      const payload: any = {
        name: createForm.name
      };
      if (createForm.target_question_count > 0) {
        payload.target_question_count = createForm.target_question_count;
      }
      if (createForm.category_id) {
        payload.category_id = createForm.category_id;
      }
      if (createForm.course_id) {
        payload.course_id = createForm.course_id;
      }
      if (createForm.subject_id) {
        payload.subject_id = createForm.subject_id;
      }

      const res = await apiFetch("/api/qb/banks", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(t("Question bank created successfully"));
        setIsCreateDialogOpen(false);
        resetCreateForm();
        fetchAllData();
      } else {
        const err = await res.json();
        toast.error(t(err.message || "Failed to create bank"));
      }
    } catch (error) {
      toast.error(t("An error occurred"));
    }
  };

  const handleEditBank = async () => {
    if (!editingBank?._id) return;
    if (!editForm.name.trim()) {
      toast.error(t("Bank name is required"));
      return;
    }

    try {
      const payload: any = {
        name: editForm.name
      };
      if (editForm.target_question_count > 0) {
        payload.target_question_count = editForm.target_question_count;
      }
      payload.category_id = editForm.category_id || null;
      payload.course_id = editForm.course_id || null;
      payload.subject_id = editForm.subject_id || null;

      const res = await apiFetch(`/api/qb/banks/${editingBank._id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(t("Question bank updated successfully"));
        setIsEditDialogOpen(false);
        setEditingBank(null);
        fetchAllData();
      } else {
        const err = await res.json();
        toast.error(t(err.message || "Failed to update bank"));
      }
    } catch (error) {
      toast.error(t("An error occurred"));
    }
  };

  const handleDeleteBank = async (id: string) => {
    setDeleting(id);
    try {
      const res = await apiFetch(`/api/qb/banks/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success(t("Question bank deleted successfully"));
        fetchAllData();
      } else {
        const err = await res.json();
        toast.error(t(err.message || "Failed to delete bank"));
      }
    } catch (error) {
      toast.error(t("An error occurred"));
    } finally {
      setDeleting(null);
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      name: "",
      target_question_count: 0,
      category_id: "",
      course_id: "",
      subject_id: ""
    });
  };

  const openEditDialog = (bank: QuestionBank) => {
    setEditingBank(bank);
    setEditForm({
      name: bank.name,
      target_question_count: bank.target_question_count || 0,
      category_id: bank.category_id || "",
      course_id: bank.course_id || "",
      subject_id: bank.subject_id || ""
    });
    setIsEditDialogOpen(true);
  };

  const toggleNameExpansion = (bankId: string) => {
    const newExpanded = new Set(expandedNames);
    if (newExpanded.has(bankId)) {
      newExpanded.delete(bankId);
    } else {
      newExpanded.add(bankId);
    }
    setExpandedNames(newExpanded);
  };

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
                  {t("Question Bank Repository")}
                </h1>
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                  {banks.length} Repositories
                </span>
              </div>
              <p className="text-slate-400 mt-1 text-xs md:text-sm font-medium">
                {t("Manage your collections of subject question banks, MCQs, and exam papers.")}
              </p>
            </div>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) resetCreateForm();
          }}>
            <DialogTrigger asChild>
              <button
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all transform active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" /> Create Bank
              </button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl border border-indigo-500/30 bg-slate-950/95 backdrop-blur-3xl text-slate-100 shadow-2xl p-6 sm:p-8 max-h-[85vh] flex flex-col">
              <DialogHeader className="border-b border-slate-800/80 pb-4">
                <DialogTitle className="font-heading font-black text-xl text-white uppercase tracking-tight flex items-center gap-2">
                  <FolderPlus className="w-5 h-5 text-indigo-400" />
                  New Question Bank
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Create a new structured collection for your examination questions.
                </DialogDescription>
              </DialogHeader>
              <div className="p-1 space-y-4 overflow-y-auto flex-1 py-4">
                <div className="space-y-2">
                  <Label htmlFor="create-name" className="text-xs font-bold uppercase tracking-wider text-slate-300">Bank Name *</Label>
                  <Input
                    id="create-name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Computer Fundamentals & IT Tools"
                    className="rounded-xl border-slate-800 bg-slate-900/90 text-sm text-slate-100 focus-visible:ring-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-category" className="text-xs font-bold uppercase tracking-wider text-slate-300">Course Category</Label>
                  <Select value={createForm.category_id} onValueChange={(val) => {
                    setCreateForm(prev => ({ ...prev, category_id: val, course_id: "", subject_id: "" }));
                  }}>
                    <SelectTrigger id="create-category" className="rounded-xl border-slate-800 bg-slate-900/90 text-slate-100">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-800 bg-slate-950 text-slate-100">
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id} className="text-xs font-bold uppercase">
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-course" className="text-xs font-bold uppercase tracking-wider text-slate-300">Course</Label>
                  <Select
                    value={createForm.course_id}
                    onValueChange={(val) => setCreateForm(prev => ({ ...prev, course_id: val, subject_id: "" }))}
                    disabled={!createForm.category_id}
                  >
                    <SelectTrigger id="create-course" className="rounded-xl border-slate-800 bg-slate-900/90 text-slate-100">
                      <SelectValue placeholder="Select course" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-800 bg-slate-950 text-slate-100">
                      {getFilteredCourses(createForm.category_id).map((course) => (
                        <SelectItem key={course.id || course._id} value={course.id || course._id || ""} className="text-xs font-bold uppercase">
                          {course.course_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-subject" className="text-xs font-bold uppercase tracking-wider text-slate-300">Subject</Label>
                  <Select
                    value={createForm.subject_id}
                    onValueChange={(val) => setCreateForm(prev => ({ ...prev, subject_id: val }))}
                    disabled={!createForm.course_id}
                  >
                    <SelectTrigger id="create-subject" className="rounded-xl border-slate-800 bg-slate-900/90 text-slate-100">
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-800 bg-slate-950 text-slate-100">
                      {getFilteredSubjects(createForm.course_id).map((subject) => (
                        <SelectItem key={subject.id || subject._id} value={subject.id || subject._id || ""} className="text-xs font-bold uppercase">
                          {subject.subject_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-target" className="text-xs font-bold uppercase tracking-wider text-slate-300">Target Number of Questions</Label>
                  <Input
                    id="create-target"
                    type="number"
                    min="0"
                    value={createForm.target_question_count}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, target_question_count: Number(e.target.value) }))}
                    placeholder="e.g. 50"
                    className="rounded-xl border-slate-800 bg-slate-900/90 text-sm text-slate-100 focus-visible:ring-indigo-500"
                  />
                </div>
              </div>
              <DialogFooter className="pt-4 border-t border-slate-800/80">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  className="rounded-2xl border-slate-800 text-slate-300 hover:bg-slate-800 font-bold uppercase text-xs"
                >
                  Cancel
                </Button>
                <button
                  onClick={handleCreateBank}
                  className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 transition-all"
                >
                  Create Bank
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-4 shadow-xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search Bar */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Search</Label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search banks..."
                className="rounded-2xl border-slate-800 bg-slate-950/80 pl-10 text-xs font-bold text-slate-100"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Category</Label>
            <Select value={filterCategory} onValueChange={(val) => {
              setFilterCategory(val);
              setFilterCourse("all");
              setFilterSubject("all");
            }}>
              <SelectTrigger className="rounded-2xl border-slate-800 bg-slate-950/80 text-xs font-bold text-slate-100">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-800 bg-slate-950 text-slate-100">
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Course Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Course</Label>
            <Select value={filterCourse} onValueChange={(val) => {
              setFilterCourse(val);
              setFilterSubject("all");
            }} disabled={filterCategory === "all"}>
              <SelectTrigger className="rounded-2xl border-slate-800 bg-slate-950/80 text-xs font-bold text-slate-100">
                <SelectValue placeholder={filterCategory !== "all" ? "All Courses" : "Select Category First"} />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-800 bg-slate-950 text-slate-100">
                <SelectItem value="all">All Courses</SelectItem>
                {filterCourses.map((course) => (
                  <SelectItem key={course.id || course._id} value={course.id || course._id || ""}>{course.course_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Subject</Label>
            <Select value={filterSubject} onValueChange={setFilterSubject} disabled={filterCourse === "all"}>
              <SelectTrigger className="rounded-2xl border-slate-800 bg-slate-950/80 text-xs font-bold text-slate-100">
                <SelectValue placeholder={filterCourse !== "all" ? "All Subjects" : "Select Course First"} />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-800 bg-slate-950 text-slate-100">
                <SelectItem value="all">All Subjects</SelectItem>
                {filterSubjects.map((subject) => (
                  <SelectItem key={subject.id || subject._id} value={subject.id || subject._id || ""}>{subject.subject_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sort Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Sort Order</Label>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="rounded-2xl border-slate-800 bg-slate-950/80 text-xs font-bold text-slate-100">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-800 bg-slate-950 text-slate-100">
                <SelectItem value="new">New to Old</SelectItem>
                <SelectItem value="old">Old to New</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bank List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Question Banks...</p>
          </div>
        ) : filteredBanks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBanks.map((bank) => (
              <div
                key={bank._id}
                className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 hover:border-indigo-500/50 rounded-3xl overflow-hidden shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 group flex flex-col justify-between"
              >
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditDialog(bank)}
                        className="p-2 rounded-xl bg-slate-800/80 hover:bg-indigo-600/20 hover:text-indigo-300 border border-slate-700/60 text-slate-300 transition-all"
                        title="Edit Bank"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-600/20 hover:text-rose-400 border border-slate-700/60 text-slate-300 transition-all"
                            title="Delete Bank"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-3xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl p-6">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="font-bold text-lg text-white uppercase">{t("Are you sure?")}</AlertDialogTitle>
                            <AlertDialogDescription className="text-xs text-slate-400">
                              {t("This will permanently delete this question bank and all contained questions.")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="mt-4 gap-2">
                            <AlertDialogCancel className="rounded-2xl border-slate-800 text-slate-300 hover:bg-slate-900">{t("Cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => bank._id && handleDeleteBank(bank._id)}
                              className="rounded-2xl bg-rose-600 text-white hover:bg-rose-500 font-bold text-xs uppercase"
                            >
                              {deleting === bank._id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                              {t("Delete Bank")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-heading font-black text-lg text-white group-hover:text-indigo-300 transition-colors uppercase tracking-tight line-clamp-2">
                      {expandedNames.has(bank._id || "") ? bank.name : (
                        <>
                          {bank.name.length > 45 ? `${bank.name.slice(0, 45)}...` : bank.name}
                        </>
                      )}
                    </h3>
                    {bank.name.length > 45 && (
                      <button
                        onClick={() => toggleNameExpansion(bank._id || "")}
                        className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        {expandedNames.has(bank._id || "") ? "Show Less" : "Read More"}
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Created: {new Date(bank.created_at).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-2.5 py-0.5 rounded-full">
                      {bank.question_count ?? 0} Questions
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/60 border-t border-slate-800/80">
                  <Link
                    to={`/dashboard/academics/question-bank/${bank._id}`}
                    className="w-full py-3 rounded-2xl bg-slate-800/80 hover:bg-indigo-600 hover:text-white border border-slate-700/60 text-slate-200 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md group-hover:border-indigo-500/40"
                  >
                    <Eye className="w-4 h-4" />
                    Manage Questions ({bank.question_count ?? 0})
                    <ArrowRight className="w-4 h-4 ml-auto opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl p-16 flex flex-col items-center text-center">
            <BookOpen className="w-12 h-12 text-slate-600 mb-4 opacity-40" />
            <h3 className="text-lg font-bold text-white uppercase tracking-tight">No Question Banks Found</h3>
            <p className="text-slate-400 text-xs max-w-sm mt-1 mb-6">
              Start by creating your first question bank to populate examination papers.
            </p>
            <button
              onClick={() => setIsCreateDialogOpen(true)}
              className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create First Bank
            </button>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="rounded-3xl border border-indigo-500/30 bg-slate-950/95 backdrop-blur-3xl text-slate-100 shadow-2xl p-6 sm:p-8 max-h-[85vh] flex flex-col">
            <DialogHeader className="border-b border-slate-800/80 pb-4">
              <DialogTitle className="font-heading font-black text-xl text-white uppercase tracking-tight flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-400" />
                Edit Question Bank
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Update details for this question bank collection.
              </DialogDescription>
            </DialogHeader>
            <div className="p-1 space-y-4 overflow-y-auto flex-1 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-xs font-bold uppercase tracking-wider text-slate-300">Bank Name *</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Mathematics & Logic"
                  className="rounded-xl border-slate-800 bg-slate-900/90 text-sm text-slate-100 focus-visible:ring-indigo-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category" className="text-xs font-bold uppercase tracking-wider text-slate-300">Course Category</Label>
                <Select value={editForm.category_id} onValueChange={(val) => {
                  setEditForm(prev => ({ ...prev, category_id: val, course_id: "", subject_id: "" }));
                }}>
                  <SelectTrigger id="edit-category" className="rounded-xl border-slate-800 bg-slate-900/90 text-slate-100">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-800 bg-slate-950 text-slate-100">
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id} className="text-xs font-bold uppercase">
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-course" className="text-xs font-bold uppercase tracking-wider text-slate-300">Course</Label>
                <Select
                  value={editForm.course_id}
                  onValueChange={(val) => setEditForm(prev => ({ ...prev, course_id: val, subject_id: "" }))}
                  disabled={!editForm.category_id}
                >
                  <SelectTrigger id="edit-course" className="rounded-xl border-slate-800 bg-slate-900/90 text-slate-100">
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-800 bg-slate-950 text-slate-100">
                    {getFilteredCourses(editForm.category_id).map((course) => (
                      <SelectItem key={course.id || course._id} value={course.id || course._id || ""} className="text-xs font-bold uppercase">
                        {course.course_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-subject" className="text-xs font-bold uppercase tracking-wider text-slate-300">Subject</Label>
                <Select
                  value={editForm.subject_id}
                  onValueChange={(val) => setEditForm(prev => ({ ...prev, subject_id: val }))}
                  disabled={!editForm.course_id}
                >
                  <SelectTrigger id="edit-subject" className="rounded-xl border-slate-800 bg-slate-900/90 text-slate-100">
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-800 bg-slate-950 text-slate-100">
                    {getFilteredSubjects(editForm.course_id).map((subject) => (
                      <SelectItem key={subject.id || subject._id} value={subject.id || subject._id || ""} className="text-xs font-bold uppercase">
                        {subject.subject_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-target" className="text-xs font-bold uppercase tracking-wider text-slate-300">Target Number of Questions</Label>
                <Input
                  id="edit-target"
                  type="number"
                  min="0"
                  value={editForm.target_question_count}
                  onChange={(e) => setEditForm(prev => ({ ...prev, target_question_count: Number(e.target.value) }))}
                  placeholder="e.g. 50"
                  className="rounded-xl border-slate-800 bg-slate-900/90 text-sm text-slate-100 focus-visible:ring-indigo-500"
                />
              </div>
            </div>
            <DialogFooter className="pt-4 border-t border-slate-800/80">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                className="rounded-2xl border-slate-800 text-slate-300 hover:bg-slate-800 font-bold uppercase text-xs"
              >
                Cancel
              </Button>
              <button
                onClick={handleEditBank}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 transition-all"
              >
                Update Bank
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default BankListPage;
