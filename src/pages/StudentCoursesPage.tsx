import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Loader2, Clock, Award, Code, Info, IndianRupee, Sparkles, CheckCircle2, ChevronRight, GraduationCap } from "lucide-react";
import { courseTypeLabel, formatCourseDuration, stripHtml } from "@/lib/courseDisplay";
import { useTranslation } from "react-i18next";
import { normalizeAssetUrl } from "@/lib/utils";
import { Link } from "react-router-dom";

interface CourseDetails {
  _id: string;
  course_name: string;
  course_code: string;
  course_type?: string;
  description?: string;
  image_url?: string;
  duration_months: number;
  duration_value?: number;
  duration_unit?: string;
  fees?: number;
  registration_fee?: number;
  exam_fees_applicable?: boolean;
  exam_fee_amount?: number;
  eligibility?: string;
  status: string;
}

const StudentCoursesPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseDetails[]>([]);

  useEffect(() => {
    fetch("/api/courses/allot", {
      headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
    })
      .then((r) => r.json())
      .then((d) => setCourses(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout role="Student">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        {/* Header Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-8 shadow-xl backdrop-blur-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <GraduationCap className="w-5 h-5 text-primary" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">
                  {t("Academic Enrollment")}
                </span>
              </div>
              <h1 className="font-heading font-black text-3xl md:text-4xl text-foreground tracking-tight">
                {t("My Enrolled Courses")}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm font-medium">
                {t("Explore your registered curriculum, subject breakdown, and course modules.")}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/dashboard/student/subjects"
                className="px-6 py-3.5 rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-widest hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 flex items-center gap-2 group"
              >
                <span>{t("View Subjects")}</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{t("Loading course details...")}</p>
          </div>
        ) : courses.length === 0 ? (
          <Card className="rounded-3xl border-dashed border-2 border-border bg-card/50">
            <CardContent className="py-20 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8 text-muted-foreground opacity-40" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-foreground">{t("No Courses Allotted Yet")}</h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto mt-2 font-medium">
                {t("You are not currently enrolled in any course. Please contact your center administrator for course assignment.")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {courses.map((course) => (
              <Card
                key={course._id}
                className="rounded-3xl border border-border/80 bg-card hover:border-primary/50 transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-primary/5 overflow-hidden flex flex-col group"
              >
                {/* Image & Status Badge Header */}
                <div className="relative h-56 overflow-hidden bg-muted">
                  {course.image_url ? (
                    <img
                      src={normalizeAssetUrl(course.image_url) || "/images/icc-1.jpg"}
                      alt={course.course_name}
                      className="w-full h-full object-cover transition duration-700 group-hover:scale-105"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.dataset.fallbackApplied) {
                          target.dataset.fallbackApplied = "true";
                          target.src = "/images/icc-1.jpg";
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                      <BookOpen className="w-16 h-16 text-primary/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 backdrop-blur-md px-3.5 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {t("Enrolled")}
                    </span>
                    {course.course_code && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[10px] font-mono font-bold text-white border border-white/20">
                        <Code className="w-3 h-3 text-primary" /> {course.course_code}
                      </span>
                    )}
                  </div>

                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-1 block">
                      {t(courseTypeLabel(course.course_type))}
                    </span>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight line-clamp-1 drop-shadow-md">
                      {t(course.course_name)}
                    </h3>
                  </div>
                </div>

                <CardContent className="p-6 space-y-6 flex-1 flex flex-col justify-between">
                  <div className="space-y-6">
                    {/* Key Attributes Bar */}
                    <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-muted/40 border border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Clock className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("Duration")}</p>
                          <p className="text-xs font-bold text-foreground">{formatCourseDuration(course)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <IndianRupee className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("Course Fee")}</p>
                          <p className="text-xs font-bold text-emerald-600">₹{(course.fees ?? 0).toLocaleString("en-IN")}</p>
                        </div>
                      </div>
                    </div>

                    {/* Course Overview */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5" /> {t("Course Description")}
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4 font-medium">
                        {t(stripHtml(course.description)) || t("Comprehensive vocational course curriculum focused on practical skill development.")}
                      </p>
                    </div>

                    {/* Eligibility details */}
                    {course.eligibility && (
                      <div className="pt-4 border-t border-border/60">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Eligibility Criteria")}</h4>
                        <p className="text-xs font-bold text-foreground mt-1">{t(course.eligibility)}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-6 border-t border-border/60 flex items-center justify-between gap-4">
                    <Link
                      to="/dashboard/student/subjects"
                      className="w-full py-3.5 rounded-2xl bg-muted hover:bg-primary/10 hover:text-primary border border-border text-center font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 group/btn"
                    >
                      <span>{t("Browse Subjects")}</span>
                      <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Link>
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

export default StudentCoursesPage;
