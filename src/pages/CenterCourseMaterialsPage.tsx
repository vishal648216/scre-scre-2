import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Loader2, FileText } from "lucide-react";

const CenterCourseMaterialsPage = () => {
  const [loading, setLoading] = useState(true);
  interface Course { _id: string; name?: string; course?: { name?: string } }
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    fetch("/api/courses/allot", { headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` } })
      .then((r) => r.json())
      .then((d) => setCourses(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
            Course Materials
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Study materials for allotted courses.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : courses.length === 0 ? (
          <Card className="rounded-none border-border">
            <CardContent className="py-12 text-center text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No allotted courses. Materials will appear here when courses are allotted.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {courses.map((c) => (
              <Card key={c._id} className="rounded-none border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-primary" />
                    <div>
                      <p className="font-bold">{c.course?.name || c.name || "Course"}</p>
                      <p className="text-sm text-muted-foreground">
                        Study material can be uploaded by Admin. Contact admin for syllabus and notes.
                      </p>
                    </div>
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

export default CenterCourseMaterialsPage;
