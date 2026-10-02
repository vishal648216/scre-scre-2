import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, BookOpen, Layers, Award, Sparkles, ChevronRight, PlayCircle, Code } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface Course {
  _id: string;
  course_name: string;
}

interface Subject {
  _id: string;
  subject_name: string;
  subject_code: string;
  description?: string;
}

interface Mapping {
  course_id: string;
  subject_id: string;
  subject_order: number;
}

interface EligibleMock {
  mock_test_id: string;
  name: string;
  subject_id: string;
  blueprint_name: string;
}

const StudentSubjectsPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [enrolledCourse, setEnrolledCourse] = useState<Course | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [eligibleMocks, setEligibleMocks] = useState<EligibleMock[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const resAllot = await apiFetch("/api/courses/allot");
      const allotData = await resAllot.json();
      
      if (resAllot.ok && allotData.length > 0) {
        const course = allotData[0];
        const courseId = course._id;
        
        const [mappingsRes, allSubsRes, mocksRes] = await Promise.all([
          apiFetch(`/api/academic/course-subjects/${courseId}`),
          apiFetch("/api/admin/subjects"),
          apiFetch("/api/exam/mock-tests/eligible"),
        ]);
        
        const mappingsData = await mappingsRes.json();
        const allSubsData = await allSubsRes.json();
        
        setEnrolledCourse(course);
        
        if (mappingsRes.ok && allSubsRes.ok) {
          setMappings(mappingsData.sort((a: Mapping, b: Mapping) => a.subject_order - b.subject_order));
          const items = Array.isArray(allSubsData) ? allSubsData : (allSubsData.items || []);
          setSubjects(items.map((s: any) => ({
            ...s,
            _id: String(s._id || s.id)
          })));
        }
        if (mocksRes.ok) {
          const raw = await mocksRes.json();
          setEligibleMocks(
            (raw as EligibleMock[]).map((x) => ({
              mock_test_id: x.mock_test_id,
              name: x.name,
              subject_id: x.subject_id,
              blueprint_name: x.blueprint_name,
            })),
          );
        }
      }
    } catch {
      toast.error(t("Failed to load course subjects"));
    } finally {
      setLoading(false);
    }
  };

  const getSubject = (id: string) => subjects.find(s => s._id === id);

  return (
    <DashboardLayout role="Student">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
        {/* Header Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-8 shadow-xl backdrop-blur-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">
                  {t("Course Curriculum")}
                </span>
              </div>
              <h1 className="font-heading font-black text-3xl md:text-4xl text-foreground tracking-tight">
                {t("My Subjects")}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm font-medium">
                {t("View subjects, curriculum breakdown, and subject mock tests.")}
              </p>
            </div>

            {enrolledCourse && (
              <div className="flex items-center gap-4 bg-white/70 dark:bg-card/70 backdrop-blur-md px-6 py-4 rounded-2xl border border-border shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Award className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Enrolled Course")}</p>
                  <p className="text-sm font-black uppercase tracking-tight text-primary">{enrolledCourse.course_name}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{t("Loading subjects...")}</p>
          </div>
        ) : !enrolledCourse ? (
          <Card className="rounded-3xl border-dashed border-2 border-border bg-card/50">
            <CardContent className="py-20 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8 text-muted-foreground opacity-40" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-foreground">{t("Not Enrolled")}</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2 font-medium">
                {t("You are not enrolled in any course yet. Please contact your center administrator.")}
              </p>
            </CardContent>
          </Card>
        ) : mappings.length === 0 ? (
          <Card className="rounded-3xl border-dashed border-2 border-border bg-card/50">
            <CardContent className="py-20 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Layers className="w-8 h-8 text-muted-foreground opacity-40" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-foreground">{t("Curriculum Not Defined")}</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2 font-medium">
                {t("The curriculum for your course has not been configured yet.")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mappings.map((m) => {
              const sub = getSubject(m.subject_id);
              const subjectMocks = eligibleMocks.filter((x) => x.subject_id === m.subject_id);
              return (
                <Card
                  key={m.subject_id}
                  className="rounded-3xl border border-border/80 bg-card hover:border-primary/50 transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-primary/5 flex flex-col justify-between overflow-hidden group"
                >
                  <CardHeader className="bg-muted/30 border-b border-border/60 flex flex-row items-center justify-between p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center font-heading font-black text-sm shadow-md shadow-primary/20">
                        #{m.subject_order}
                      </div>
                      <span className="text-xs font-black uppercase tracking-widest text-primary/80">
                        {t("Subject Unit")}
                      </span>
                    </div>
                    {sub?.subject_code && (
                      <span className="text-[10px] font-mono font-bold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {sub.subject_code}
                      </span>
                    )}
                  </CardHeader>

                  <CardContent className="p-6 space-y-6 flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
                      <h3 className="font-black text-xl uppercase tracking-tight text-foreground group-hover:text-primary transition-colors">
                        {t(sub?.subject_name || "Unknown Subject")}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 font-medium">
                        {t(sub?.description || "Comprehensive subject module with theory and practical sessions.")}
                      </p>
                    </div>

                    {subjectMocks.length > 0 ? (
                      <div className="pt-4 border-t border-border/60 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            {t("Available Mock Tests")}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                            {subjectMocks.length}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {subjectMocks.map((mk) => (
                            <div
                              key={mk.mock_test_id}
                              className="p-3 rounded-2xl bg-muted/40 border border-border/50 flex items-center justify-between gap-3 hover:bg-muted transition-colors"
                            >
                              <span className="text-xs font-bold text-foreground line-clamp-1">{mk.name}</span>
                              <Link
                                to="/dashboard/student/exams"
                                className="shrink-0 text-primary font-black uppercase text-[10px] hover:underline flex items-center gap-1"
                              >
                                <span>{t("Take")}</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="pt-4 border-t border-border/60 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                          {t("Curriculum Assessment")}
                        </span>
                        <Link
                          to="/dashboard/student/exams"
                          className="text-primary font-black uppercase text-[10px] hover:underline flex items-center gap-1"
                        >
                          <span>{t("Check Exams")}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    )}
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

export default StudentSubjectsPage;
