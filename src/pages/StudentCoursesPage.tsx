import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Loader2, Clock, Award, Code, Info, IndianRupee } from "lucide-react";
import { courseTypeLabel, formatCourseDuration, stripHtml } from "@/lib/courseDisplay";
import { useTranslation } from "react-i18next";

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
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
              {t("My Enrolled Courses")}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              {t("View details of the courses you are currently enrolled in.")}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : courses.length === 0 ? (
          <Card className="rounded-none border-dashed border-2 border-border">
            <CardContent className="py-20 flex flex-col items-center text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-lg font-bold uppercase tracking-tight">{t("No Courses Allotted Yet")}</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2">
                {t("You are not enrolled in any course yet. Please contact your center for enrollment.")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {courses.map((course) => (
              <Card key={course._id} className="rounded-none border-border group hover:border-primary transition-all overflow-hidden bg-card flex flex-col">
                <div className="relative h-48 overflow-hidden">
                  {course.image_url ? (
                    <img
                      src={course.image_url}
                      alt={course.course_name}
                      className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted/40 flex items-center justify-center">
                      <BookOpen className="w-12 h-12 text-muted-foreground opacity-20" />
                    </div>
                  )}
                  <div className="absolute top-4 left-4">
                    <span className="inline-flex items-center rounded-none bg-primary px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-lg">
                      {t("Enrolled")}
                    </span>
                  </div>
                </div>

                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2">
                      <Award className="w-5 h-5 text-primary" />
                      {t(course.course_name)}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1">
                        <Code className="w-3 h-3" /> {course.course_code}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatCourseDuration(course)}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-primary/80 uppercase tracking-wide">{t(courseTypeLabel(course.course_type))}</p>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-6 flex-1">
                  <div className="flex flex-wrap gap-4 text-xs font-bold text-foreground">
                    <span className="inline-flex items-center gap-1">
                      <IndianRupee className="w-3.5 h-3.5" /> {t("Course")}: ₹{(course.fees ?? 0).toLocaleString("en-IN")}
                    </span>
                    {course.registration_fee != null && course.registration_fee > 0 ? (
                      <span>{t("Admission")}: ₹{course.registration_fee.toLocaleString("en-IN")}</span>
                    ) : null}
                    {course.exam_fees_applicable ? (
                      <span>{t("Exam")}: ₹{(course.exam_fee_amount ?? 0).toLocaleString("en-IN")}</span>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
                      <Info className="w-3 h-3" /> {t("Course Description")}
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t(stripHtml(course.description)) || t("No description available for this course.")}
                    </p>
                  </div>

                  {course.eligibility && (
                    <div className="pt-4 border-t border-border">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Eligibility")}</h4>
                      <p className="text-xs font-bold text-foreground mt-1">{t(course.eligibility)}</p>
                    </div>
                  )}
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
