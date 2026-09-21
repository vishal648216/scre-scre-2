import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Plus, Loader2, Search, ArrowRight, FolderPlus, Trash2, Edit } from "lucide-react";
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
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-foreground flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-primary" />
              {t("Question Bank")}
            </h1>
            <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.2em] mt-1">
              {t("Manage your collections of questions and answers")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
              setIsCreateDialogOpen(open);
              if (!open) resetCreateForm();
            }}>
              <DialogTrigger asChild>
                <Button className="rounded-none bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-[10px] px-6 h-10 border-2 border-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Create Bank
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-none border-2 border-border p-0 overflow-hidden sm:max-w-[425px] max-h-[80vh] flex flex-col">
                <div className="bg-primary p-6 border-b-2 border-border">
                  <DialogTitle className="text-primary-foreground font-black uppercase tracking-widest flex items-center gap-2">
                    <FolderPlus className="w-5 h-5" />
                    New Question Bank
                  </DialogTitle>
                  <DialogDescription className="text-primary-foreground/70 font-bold uppercase text-[8px] tracking-[0.2em] mt-1">
                    Create a new category for your questions
                  </DialogDescription>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                  <div className="space-y-2">
                    <Label htmlFor="create-name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bank Name</Label>
                    <Input
                      id="create-name"
                      value={createForm.name}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Mathematics - Grade 10"
                      className="rounded-none border-border font-bold uppercase text-xs focus-visible:ring-0 focus-visible:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-category" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course Category</Label>
                    <Select value={createForm.category_id} onValueChange={(val) => {
                      setCreateForm(prev => ({ ...prev, category_id: val, course_id: "", subject_id: "" }));
                    }}>
                      <SelectTrigger id="create-category" className="rounded-none border-border font-bold uppercase text-xs focus-visible:ring-0 focus-visible:border-primary">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-border">
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id} className="font-bold uppercase text-xs">
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-course" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course</Label>
                    <Select
                      value={createForm.course_id}
                      onValueChange={(val) => setCreateForm(prev => ({ ...prev, course_id: val, subject_id: "" }))}
                      disabled={!createForm.category_id}
                    >
                      <SelectTrigger id="create-course" className="rounded-none border-border font-bold uppercase text-xs focus-visible:ring-0 focus-visible:border-primary">
                        <SelectValue placeholder="Select course" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-border">
                        {getFilteredCourses(createForm.category_id).map((course) => (
                          <SelectItem key={course.id || course._id} value={course.id || course._id || ""} className="font-bold uppercase text-xs">
                            {course.course_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-subject" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subject</Label>
                    <Select
                      value={createForm.subject_id}
                      onValueChange={(val) => setCreateForm(prev => ({ ...prev, subject_id: val }))}
                      disabled={!createForm.course_id}
                    >
                      <SelectTrigger id="create-subject" className="rounded-none border-border font-bold uppercase text-xs focus-visible:ring-0 focus-visible:border-primary">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-border">
                        {getFilteredSubjects(createForm.course_id).map((subject) => (
                          <SelectItem key={subject.id || subject._id} value={subject.id || subject._id || ""} className="font-bold uppercase text-xs">
                            {subject.subject_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-target" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Number of Questions</Label>
                    <Input
                      id="create-target"
                      type="number"
                      min="0"
                      value={createForm.target_question_count}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, target_question_count: Number(e.target.value) }))}
                      placeholder="e.g., 10"
                      className="rounded-none border-border font-bold uppercase text-xs focus-visible:ring-0 focus-visible:border-primary"
                    />
                  </div>
                </div>
                <DialogFooter className="p-6 bg-muted/50 border-t-2 border-border sm:justify-end gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    className="rounded-none border-2 border-border font-black uppercase tracking-widest text-[10px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateBank}
                    className="rounded-none bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] border-2 border-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                  >
                    Create Bank
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-6 p-6 bg-muted/30 border border-border rounded-none">
          {/* Search Bar */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search banks..."
                className="rounded-none border-border pl-10"
              />
            </div>
          </div>

          {/* Course Category Filter */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest">Course Category</Label>
            <Select value={filterCategory} onValueChange={(val) => {
              setFilterCategory(val);
              setFilterCourse("all");
              setFilterSubject("all");
            }}>
              <SelectTrigger className="rounded-none border-border">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Course Filter */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest">Course</Label>
            <Select value={filterCourse} onValueChange={(val) => {
              setFilterCourse(val);
              setFilterSubject("all");
            }} disabled={filterCategory === "all"}>
              <SelectTrigger className="rounded-none border-border">
                <SelectValue placeholder={filterCategory !== "all" ? "All Courses" : "Select Category First"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {filterCourses.map((course) => (
                  <SelectItem key={course.id || course._id} value={course.id || course._id || ""}>{course.course_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject & Sort Filters combined? Wait no, let's do Subject first, then Sort in last col */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest">Subject</Label>
            <Select value={filterSubject} onValueChange={setFilterSubject} disabled={filterCourse === "all"}>
              <SelectTrigger className="rounded-none border-border">
                <SelectValue placeholder={filterCourse !== "all" ? "All Subjects" : "Select Course First"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {filterSubjects.map((subject) => (
                  <SelectItem key={subject.id || subject._id} value={subject.id || subject._id || ""}>{subject.subject_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sort Filter */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest">Sort</Label>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="rounded-none border-border">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New to Old</SelectItem>
                <SelectItem value="old">Old to New</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bank List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">
              Loading Question Banks...
            </p>
          </div>
        ) : filteredBanks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredBanks.map((bank) => (
              <Card key={bank._id} className="rounded-none border-2 border-border bg-card hover:border-primary transition-all group hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(var(--primary-rgb),0.1)] relative overflow-hidden">
                <CardHeader className="p-6 border-b-2 border-border group-hover:bg-muted/30 transition-colors space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="p-3 bg-primary/10 rounded-none border-2 border-primary/20 group-hover:bg-primary group-hover:border-primary transition-all">
                      <BookOpen className="w-6 h-6 text-primary group-hover:text-primary-foreground transition-colors" />
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openEditDialog(bank)}
                        className="rounded-none border-2 border-border text-foreground hover:bg-muted transition-all h-9 w-9"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="rounded-none border-2 border-destructive/20 text-destructive hover:bg-destructive hover:text-white transition-all h-9 w-9"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-none border-2 border-border">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="font-black uppercase tracking-widest text-lg">{t("Are you sure?")}</AlertDialogTitle>
                            <AlertDialogDescription className="font-bold text-muted-foreground uppercase text-[10px] tracking-widest">
                              {t("This action cannot be undone. This will permanently delete the question bank and all its questions.")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="sm:justify-end gap-2 mt-4">
                            <AlertDialogCancel className="rounded-none border-2 border-border font-black uppercase tracking-widest text-[10px]">{t("Cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => bank._id && handleDeleteBank(bank._id)}
                              className="rounded-none bg-destructive text-destructive-foreground hover:bg-destructive/90 border-2 border-destructive font-black uppercase tracking-widest text-[10px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                            >
                              {deleting === bank._id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                              {t("Delete Bank")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="text-xl font-black uppercase tracking-tight leading-snug">
                      {expandedNames.has(bank._id || "") ? bank.name : (
                        <>
                          {bank.name.length > 40 ? `${bank.name.slice(0, 40)}...` : bank.name}
                        </>
                      )}
                    </CardTitle>
                    {bank.name.length > 40 && (
                      <button
                        onClick={() => toggleNameExpansion(bank._id || "")}
                        className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
                      >
                        {expandedNames.has(bank._id || "") ? "Show Less" : "Read More"}
                      </button>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                        Created: {new Date(bank.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5 border border-primary/30 bg-primary/5 px-2 py-0.5">
                        {bank.question_count ?? 0} Questions
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 bg-muted/5">
                  <div className="flex justify-center">
                    <Button asChild className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 font-black uppercase tracking-widest text-[11px] border-2 border-primary shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all h-12 px-8">
                      <Link to={`/dashboard/academics/question-bank/${bank._id}`} className="flex items-center justify-center gap-2">
                        Open Bank
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border bg-muted/20">
            <div className="w-16 h-16 rounded-none bg-muted border-2 border-border flex items-center justify-center mb-6">
              <BookOpen className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight text-foreground">No Banks Found</h3>
            <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.2em] mt-1 mb-8">
              Start by creating your first question bank
            </p>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="rounded-none bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] px-8 py-6 border-2 border-primary shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Bank
            </Button>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="rounded-none border-2 border-border p-0 overflow-hidden sm:max-w-[425px] max-h-[80vh] flex flex-col">
            <div className="bg-primary p-6 border-b-2 border-border">
              <DialogTitle className="text-primary-foreground font-black uppercase tracking-widest flex items-center gap-2">
                <Edit className="w-5 h-5" />
                Edit Question Bank
              </DialogTitle>
              <DialogDescription className="text-primary-foreground/70 font-bold uppercase text-[8px] tracking-[0.2em] mt-1">
                Update the question bank details
              </DialogDescription>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bank Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Mathematics - Grade 10"
                  className="rounded-none border-border font-bold uppercase text-xs focus-visible:ring-0 focus-visible:border-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course Category</Label>
                <Select value={editForm.category_id} onValueChange={(val) => {
                  setEditForm(prev => ({ ...prev, category_id: val, course_id: "", subject_id: "" }));
                }}>
                  <SelectTrigger id="edit-category" className="rounded-none border-border font-bold uppercase text-xs focus-visible:ring-0 focus-visible:border-primary">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-border">
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id} className="font-bold uppercase text-xs">
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-course" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course</Label>
                <Select
                  value={editForm.course_id}
                  onValueChange={(val) => setEditForm(prev => ({ ...prev, course_id: val, subject_id: "" }))}
                  disabled={!editForm.category_id}
                >
                  <SelectTrigger id="edit-course" className="rounded-none border-border font-bold uppercase text-xs focus-visible:ring-0 focus-visible:border-primary">
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-border">
                    {getFilteredCourses(editForm.category_id).map((course) => (
                      <SelectItem key={course.id || course._id} value={course.id || course._id || ""} className="font-bold uppercase text-xs">
                        {course.course_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-subject" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subject</Label>
                <Select
                  value={editForm.subject_id}
                  onValueChange={(val) => setEditForm(prev => ({ ...prev, subject_id: val }))}
                  disabled={!editForm.course_id}
                >
                  <SelectTrigger id="edit-subject" className="rounded-none border-border font-bold uppercase text-xs focus-visible:ring-0 focus-visible:border-primary">
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-border">
                    {getFilteredSubjects(editForm.course_id).map((subject) => (
                      <SelectItem key={subject.id || subject._id} value={subject.id || subject._id || ""} className="font-bold uppercase text-xs">
                        {subject.subject_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-target" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Number of Questions</Label>
                <Input
                  id="edit-target"
                  type="number"
                  min="0"
                  value={editForm.target_question_count}
                  onChange={(e) => setEditForm(prev => ({ ...prev, target_question_count: Number(e.target.value) }))}
                  placeholder="e.g., 10"
                  className="rounded-none border-border font-bold uppercase text-xs focus-visible:ring-0 focus-visible:border-primary"
                />
              </div>
            </div>
            <DialogFooter className="p-6 bg-muted/50 border-t-2 border-border sm:justify-end gap-2 flex-shrink-0">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                className="rounded-none border-2 border-border font-black uppercase tracking-widest text-[10px]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditBank}
                className="rounded-none bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] border-2 border-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              >
                Update Bank
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default BankListPage;
