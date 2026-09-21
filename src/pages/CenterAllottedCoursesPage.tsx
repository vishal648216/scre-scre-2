import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Loader2, Calendar, IndianRupee, Clock, Award, ShieldCheck, Download } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { courseTypeLabel, formatCourseDuration, stripHtml } from "@/lib/courseDisplay";

interface Course {
  _id: string;
  name: string;
  code: string;
  category: string;
  course_type?: string;
  duration_months: number;
  duration_value?: number;
  duration_unit?: string;
  total_fees: number;
  registration_fee?: number;
  exam_fees_applicable?: boolean;
  exam_fee_amount?: number;
  description?: string;
  eligibility?: string;
  image_url?: string;
  syllabus?: string;
}

const CenterAllottedCoursesPage = () => {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    fetchAllottedCourses();
  }, []);

  const fetchAllottedCourses = async () => {
    try {
      const token = sessionStorage.getItem("token");
      const response = await fetch("/api/courses/allot", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setCourses(data);
      }
    } catch (error) {
      console.error("Error fetching allotted courses:", error);
      toast.error("Failed to load allotted courses");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Allotted Courses</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">View and manage courses authorized for your center.</p>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : courses.length === 0 ? (
          <Card className="rounded-none border-border border-dashed p-20 text-center opacity-60">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">No courses have been allotted to your center yet</p>
            <p className="text-[10px] font-bold text-muted-foreground mt-2">Please contact the administrator for course allotment.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map(course => (
              <Card key={course._id} className="rounded-none border-border shadow-md hover:border-primary/40 transition-all overflow-hidden group flex flex-col">
                <div className="p-6 space-y-4 flex-1">
                  <div className="flex justify-between items-start">
                    <div className="w-16 h-16 bg-primary/5 flex items-center justify-center border border-primary/10 overflow-hidden">
                      {course.image_url ? (
                        <img src={course.image_url} alt={course.name} className="w-full h-full object-cover" />
                      ) : (
                        <BookOpen className="w-8 h-8 text-primary" />
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 px-2 py-1">{course.code}</span>
                      <div className="flex items-center gap-1 text-[8px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-500/5 px-2 py-0.5 border border-emerald-500/10">
                        <ShieldCheck className="w-2 h-2" /> Authorized
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-foreground line-clamp-2 min-h-[3.5rem]">{course.name}</h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      {course.category} · {courseTypeLabel(course.course_type)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Duration</p>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-primary/60" />
                        <span className="text-xs font-bold text-foreground">{formatCourseDuration(course)}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Course fee</p>
                      <div className="flex items-center gap-2">
                        <IndianRupee className="w-3 h-3 text-emerald-600/60" />
                        <span className="text-xs font-bold text-emerald-600">₹{course.total_fees.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  {(course.registration_fee ?? 0) > 0 || course.exam_fees_applicable ? (
                    <div className="text-[10px] font-bold text-muted-foreground space-y-1">
                      {(course.registration_fee ?? 0) > 0 ? <p>Admission: ₹{course.registration_fee!.toLocaleString("en-IN")}</p> : null}
                      {course.exam_fees_applicable ? <p>Exam: ₹{(course.exam_fee_amount ?? 0).toLocaleString("en-IN")}</p> : null}
                    </div>
                  ) : null}
                  {course.eligibility && (
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Eligibility</p>
                      <div className="flex items-center gap-2">
                        <Award className="w-3 h-3 text-primary/60" />
                        <span className="text-[10px] font-bold text-foreground">{course.eligibility}</span>
                      </div>
                    </div>
                  )}
                  {course.description && (
                    <p className="text-[10px] text-muted-foreground font-medium leading-relaxed italic border-l-2 border-primary/20 pl-3 line-clamp-3">
                      {stripHtml(course.description)}
                    </p>
                  )}
                </div>
                <div className="bg-muted/30 border-t border-border p-4 flex gap-2">
                  <button className="flex-1 bg-background border border-border px-4 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-muted transition-all flex items-center justify-center gap-2 group">
                    <Download className="w-3 h-3 group-hover:translate-y-0.5 transition-transform" /> Syllabi
                  </button>
                  <button className="flex-1 bg-background border border-border px-4 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-muted transition-all flex items-center justify-center gap-2 group">
                    <Award className="w-3 h-3" /> Sample Cert
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CenterAllottedCoursesPage;
