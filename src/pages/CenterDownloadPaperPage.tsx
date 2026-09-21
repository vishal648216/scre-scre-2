import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Filter, Calendar, Download, Eye, X, BookOpen } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// Types
interface StudentPaper {
  _id: string;
  blueprint_id: string;
  student_id: string;
  center_id: string;
  status: string;
  start_window: string | null;
  end_window: string | null;
  subject_id: string | null;
  created_at: string;
}

interface Student {
  _id: string;
  full_name?: string;
  name?: string;
}

interface Blueprint {
  _id: string;
  name: string;
  course_id: string;
}

interface Course {
  _id: string;
  course_name: string;
  category_id?: string;
}

interface Category {
  _id: string;
  name: string;
}

interface Subject {
  _id: string;
  subject_name: string;
  course_id: string;
}

const MONTHS = [
  "All", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const CenterDownloadPaperPage = () => {
  // Helper function to handle MongoDB ObjectID format
  const toId = (v: any): string => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && "$oid" in v) return v.$oid;
    return String(v || "");
  };

  // Normalize an object to get its ID (supports _id and id)
  const getNormalizedId = (obj: any): string => {
    return toId(obj?.id || obj?._id);
  };

  // State
  const [loading, setLoading] = useState(true);
  const [papers, setPapers] = useState<StudentPaper[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [allotmentBatches, setAllotmentBatches] = useState<any[]>([]);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("All");

  // UI State
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  // Fetch data — prefer allotment batches (same paper for all students)
  const fetchData = async () => {
    setLoading(true);
    try {
      const [batchesRes, papersRes, studentsRes, blueprintsRes, coursesRes, categoriesRes, subjectsRes] = await Promise.all([
        apiFetch("/api/exam/allotment-batches"),
        apiFetch("/api/exam/papers"),
        apiFetch("/api/students"),
        apiFetch("/api/exam/blueprints"),
        apiFetch("/api/courses"),
        apiFetch("/api/admin/categories?limit=100"),
        apiFetch("/api/admin/subjects")
      ]);

      console.log("Raw papers response:", papersRes);
      console.log("Raw students response:", studentsRes);
      console.log("Raw blueprints response:", blueprintsRes);
      console.log("Raw courses response:", coursesRes);
      console.log("Raw categories response:", categoriesRes);
      console.log("Raw subjects response:", subjectsRes);

      if (batchesRes.ok) {
        const raw = await batchesRes.json();
        setAllotmentBatches(Array.isArray(raw) ? raw : []);
      }
      if (papersRes.ok) {
        const raw = await papersRes.json();
        console.log("Raw papers data:", raw);
        const normalized = Array.isArray(raw) ? raw.map((p: any) => ({
          ...p,
          _id: getNormalizedId(p),
          student_id: toId(p.student_id),
          blueprint_id: toId(p.blueprint_id),
          subject_id: toId(p.subject_id),
          center_id: toId(p.center_id),
        })) : [];
        setPapers(normalized);
        console.log("Fetched papers:", normalized);
      }
      if (studentsRes.ok) {
        const raw = await studentsRes.json();
        console.log("Raw students data:", raw);
        const normalized = Array.isArray(raw) ? raw.map((s: any) => ({
          ...s,
          _id: getNormalizedId(s),
        })) : [];
        setStudents(normalized);
        console.log("Fetched students:", normalized);
      }
      if (blueprintsRes.ok) {
        const raw = await blueprintsRes.json();
        console.log("Raw blueprints data:", raw);
        const normalized = Array.isArray(raw) ? raw.map((b: any) => ({
          ...b,
          _id: getNormalizedId(b),
          course_id: toId(b.course_id),
        })) : [];
        setBlueprints(normalized);
        console.log("Fetched blueprints:", normalized);
      }
      if (coursesRes.ok) {
        const data = await coursesRes.json();
        console.log("Raw courses data:", data);
        const normalized = (Array.isArray(data) ? data : (data.items || []))
          .map((c: any) => ({
            ...c,
            _id: getNormalizedId(c),
            category_id: toId(c.category_id),
          }))
          .filter((c: Course) => c._id); // filter out courses with no id
        setCourses(normalized);
        console.log("Fetched courses:", normalized);
      }
      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        console.log("Raw categories data:", data);
        const normalized = (Array.isArray(data) ? data : (data.items || []))
          .map((cat: any) => ({
            ...cat,
            _id: getNormalizedId(cat),
          }))
          .filter((cat: Category) => cat._id); // filter out categories with no id
        setCategories(normalized);
        console.log("Fetched categories:", normalized);
      }
      if (subjectsRes.ok) {
        const data = await subjectsRes.json();
        console.log("Raw subjects data:", data);
        const normalized = (Array.isArray(data) ? data : (data.items || []))
          .map((sub: any) => ({
            ...sub,
            _id: getNormalizedId(sub),
            course_id: toId(sub.course_id),
          }))
          .filter((sub: Subject) => sub._id); // filter out subjects with no id
        setSubjects(normalized);
        console.log("Fetched subjects:", normalized);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper functions
  const getCourseIdFromBlueprint = (blueprintId: string) => {
    const blueprint = blueprints.find(b => b._id === blueprintId);
    console.log("getCourseIdFromBlueprint called with blueprintId:", blueprintId, "found blueprint:", blueprint, "course_id:", blueprint?.course_id);
    return blueprint?.course_id || "";
  };

  const getCourseName = (courseId: string) => {
    console.log("getCourseName called with courseId:", courseId, "available courses:", courses);
    const course = courses.find(c => c._id === courseId);
    console.log("Found course:", course);
    return course?.course_name || "Unknown Course";
  };

  const getSubjectName = (subjectId: string) => {
    const subject = subjects.find(s => s._id === subjectId);
    return subject?.subject_name || "Unknown Subject";
  };

  const getCategoryIdFromCourse = (courseId: string) => {
    const course = courses.find(c => c._id === courseId);
    return course?.category_id || "";
  };

  // Prefer allotment batches (canonical shared papers)
  const batchGroups = useMemo(() => {
    return allotmentBatches.map((batch) => ({
      batch,
      courseId: batch.course_id,
      subjects: batch.subjects || [],
    }));
  }, [allotmentBatches]);

  const filteredBatchGroups = useMemo(() => {
    return batchGroups.filter(({ courseId, batch }) => {
      if (selectedCategory !== "all") {
        const catId = getCategoryIdFromCourse(courseId);
        if (catId !== selectedCategory) return false;
      }
      if (selectedCourse !== "all" && courseId !== selectedCourse) return false;
      if (selectedMonth !== "All") {
        const hasMonth = (batch.subjects || []).some((s: any) => {
          if (!s.start_window) return false;
          const d = new Date(s.start_window);
          return MONTHS[d.getMonth() + 1] === selectedMonth;
        });
        if (!hasMonth) return false;
      }
      return true;
    });
  }, [batchGroups, selectedCategory, selectedCourse, selectedMonth]);

  const handleDownloadBatchSubject = async (batchId: string, subjectId: string) => {
    const res = await apiFetch(`/api/exam/allotment-batches/${batchId}/subjects/${subjectId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.sample_paper_id) {
        window.open(`/dashboard/exams/print/${data.sample_paper_id}`, "_blank");
      } else {
        toast.error("No paper found for this allotment");
      }
    } else {
      toast.error("Failed to load paper");
    }
  };

  // Legacy fallback: group papers by course
  const groupedPapers = useMemo(() => {
    const groups: { [key: string]: StudentPaper[] } = {};
    papers.forEach(paper => {
      const courseId = getCourseIdFromBlueprint(paper.blueprint_id);
      if (!courseId) return;
      if (!groups[courseId]) {
        groups[courseId] = [];
      }
      groups[courseId].push(paper);
    });
    console.log("Grouped papers:", groups);
    return groups;
  }, [papers, blueprints]);

  // Filter groups
  const filteredGroups = useMemo(() => {
    const result = Object.entries(groupedPapers).filter(([courseId, coursePapers]) => {
      // Filter by category
      if (selectedCategory !== "all") {
        const catId = getCategoryIdFromCourse(courseId);
        console.log(`Checking category for course ${courseId}: ${catId} vs selected ${selectedCategory}`);
        if (catId !== selectedCategory) return false;
      }

      // Filter by course
      if (selectedCourse !== "all" && courseId !== selectedCourse) return false;

      // Filter by month
      if (selectedMonth !== "All") {
        const hasPaperInMonth = coursePapers.some(paper => {
          if (!paper.start_window) return false;
          const date = new Date(paper.start_window);
          const monthName = MONTHS[date.getMonth() + 1]; // MONTHS[0] is "All"
          return monthName === selectedMonth;
        });
        if (!hasPaperInMonth) return false;
      }

      return true;
    });
    console.log("Filtered groups:", result);
    return result;
  }, [groupedPapers, selectedCategory, selectedCourse, selectedMonth]);

  // Download handler (for now, let's redirect to print page)
  const handleDownload = (paperId: string) => {
    window.open(`/dashboard/exams/print/${paperId}`, "_blank");
  };

  // Filter courses for filter dropdown (only categories that have courses in groups)
  const filteredCategoriesForFilter = useMemo(() => {
    const usedCategoryIds = new Set<string>();
    filteredGroups.forEach(([courseId]) => {
      const catId = getCategoryIdFromCourse(courseId);
      if (catId) usedCategoryIds.add(catId);
    });
    return categories.filter(cat => {
      if (!cat._id) return false;
      return usedCategoryIds.has(cat._id) || selectedCategory === cat._id || selectedCategory === "all";
    });
  }, [categories, filteredGroups, selectedCategory]);

  const filteredCoursesForFilter = useMemo(() => {
    const usedCourseIds = new Set(filteredGroups.map(([courseId]) => courseId));
    return courses.filter(course => {
      if (!course._id) return false;
      if (selectedCategory !== "all" && course.category_id !== selectedCategory) return false;
      return usedCourseIds.has(course._id) || selectedCourse === course._id || selectedCourse === "all";
    });
  }, [courses, selectedCategory, selectedCourse, filteredGroups]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
              Download Question Papers
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              Download and print allotted question papers
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card className="rounded-none border-border shadow-sm">
          <CardContent className="p-4 flex flex-col lg:flex-row gap-4 items-start">
            <div className="flex-1 min-w-[200px] space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest">Course Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="rounded-none border-border">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {filteredCategoriesForFilter.map(cat => (
                    <SelectItem key={cat._id} value={cat._id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[200px] space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest">Course</Label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger className="rounded-none border-border">
                  <SelectValue placeholder="All Courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {filteredCoursesForFilter.map(course => (
                    <SelectItem key={course._id} value={course._id}>{course.course_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[200px] space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest">Exam Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="rounded-none border-border">
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(month => (
                    <SelectItem key={month} value={month}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(selectedCategory !== "all" || selectedCourse !== "all" || selectedMonth !== "All") && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedCategory("all");
                  setSelectedCourse("all");
                  setSelectedMonth("All");
                }}
                className="h-auto px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 self-end"
              >
                <X className="w-4 h-4 mr-1" />
                Reset
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Course List */}
        <div className="grid gap-6">
          {filteredBatchGroups.length > 0 ? (
            filteredBatchGroups.map(({ batch, courseId, subjects: batchSubjects }) => (
              <Card key={batch.batch_id} className="rounded-none border-border">
                <CardHeader className="bg-muted/30 border-b py-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    {getCourseName(courseId)}
                    {batch.for_reappear && (
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Reappear</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {batchSubjects.map((s: any) => (
                    <Card key={s.subject_id} className="rounded-none border-border">
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm font-bold">{getSubjectName(s.subject_id)}</CardTitle>
                        {s.start_window && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(s.start_window).toLocaleString()}
                          </p>
                        )}
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <Button
                          onClick={() => handleDownloadBatchSubject(batch.batch_id, s.subject_id)}
                          className="w-full rounded-none text-[10px] font-black uppercase"
                        >
                          <Download className="w-3.5 h-3.5 mr-1" />
                          Download Paper
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            ))
          ) : filteredGroups.length === 0 ? (
            <Card className="rounded-none border-dashed border-2 border-border">
              <CardContent className="py-20 flex flex-col items-center text-center">
                <Calendar className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                <h3 className="text-lg font-bold uppercase tracking-tight">No Papers Found</h3>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2">
                  No allotted question papers match your filter criteria
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredGroups.map(([courseId, coursePapers]) => {
              // Count unique subjects for this course's papers
              const uniqueSubjectIds = new Set(coursePapers.map(p => p.subject_id).filter(Boolean));
              const isExpanded = expandedCourse === courseId;

              return (
                <Card key={courseId} className="rounded-none border-border">
                  <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between py-4">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-primary" />
                      {getCourseName(courseId)}
                    </CardTitle>
                    <div className="flex items-center gap-4">
                      <div className="text-xs text-muted-foreground">
                        <span className="font-black">{uniqueSubjectIds.size}</span> Subject{uniqueSubjectIds.size !== 1 ? "s" : ""}
                      </div>
                      <Button
                        onClick={() => setExpandedCourse(isExpanded ? null : courseId)}
                        variant="secondary"
                        className="rounded-none text-[10px] font-black uppercase tracking-widest"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        {isExpanded ? "Hide" : "View"} Papers
                      </Button>
                    </div>
                  </CardHeader>

                  {/* Expanded content */}
                  {isExpanded && (
                    <CardContent className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* For each unique subject in this course, show a card */}
                        {Array.from(uniqueSubjectIds).map(subjectId => {
                          if (!subjectId) return null;
                          const papersForSubject = coursePapers.filter(p => p.subject_id === subjectId);
                          const samplePaper = papersForSubject[0];

                          return (
                            <Card key={subjectId} className="rounded-none border-border">
                              <CardHeader className="py-3">
                                <CardTitle className="text-sm font-bold">{getSubjectName(subjectId)}</CardTitle>
                                {samplePaper.start_window && (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(samplePaper.start_window).toLocaleString()}
                                  </div>
                                )}
                              </CardHeader>
                              <CardContent className="p-4 pt-0">
                                <div className="text-xs text-muted-foreground mb-3">
                                  {papersForSubject.length} Student{papersForSubject.length !== 1 ? "s" : ""} allotted
                                </div>
                                <Button
                                  onClick={() => handleDownload(samplePaper._id)}
                                  className="w-full rounded-none text-[10px] font-black uppercase tracking-widest"
                                >
                                  <Download className="w-3.5 h-3.5 mr-1" />
                                  Download Paper
                                </Button>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CenterDownloadPaperPage;
