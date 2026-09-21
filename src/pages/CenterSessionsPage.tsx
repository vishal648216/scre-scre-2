import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

interface AllottedCourse {
  course_id: string;
}

interface Course {
  _id: string;
  course_name: string;
}

interface Session {
  id: string;
  course_id: string;
  session_name: string;
  status: string;
}

const CenterSessionsPage = () => {
  const [loading, setLoading] = useState(true);
  const [allottedCourses, setAllottedCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [allottedRes, allCoursesRes, sessionsRes] = await Promise.all([
        apiFetch("/api/courses/allot"),
        apiFetch("/api/courses"),
        apiFetch("/api/academic/sessions")
      ]);

      const allottedData = await allottedRes.json();
      const allCoursesData = await allCoursesRes.json();
      const sessionsData = await sessionsRes.json();

      if (allottedRes.ok && allCoursesRes.ok && sessionsRes.ok) {
        const myCourseIds = allottedData.map((a: AllottedCourse) => a.course_id);
        const myCourses = allCoursesData.filter((c: Course) => myCourseIds.includes(c._id));
        setAllottedCourses(myCourses);
        setSessions(sessionsData.filter((s: Session) => myCourseIds.includes(s.course_id)));
      }
    } catch (error) {
      toast.error("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  const getCourseName = (id: string) => allottedCourses.find(c => c._id === id)?.course_name || "Unknown";

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Academic Sessions</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">View the current and upcoming academic sessions for your courses.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : allottedCourses.length === 0 ? (
          <Card className="rounded-none border-dashed border-2 border-border">
            <CardContent className="py-20 flex flex-col items-center text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-lg font-bold uppercase tracking-tight">No Allotted Courses</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2">
                You haven't been allotted any courses yet.
              </p>
            </CardContent>
          </Card>
        ) : sessions.length === 0 ? (
          <Card className="rounded-none border-dashed border-2 border-border">
            <CardContent className="py-20 flex flex-col items-center text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-lg font-bold uppercase tracking-tight">No Sessions Found</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2">
                No active academic sessions found for your allotted courses.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => (
              <Card key={session.id} className="rounded-none border-border group hover:border-primary transition-all">
                <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between py-4">
                  <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    {session.session_name}
                  </CardTitle>
                  <div className={cn(
                    "text-[8px] font-black uppercase px-2 py-1 tracking-widest",
                    session.status === "active" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                  )}>
                    {session.status}
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="mb-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Course</div>
                    <div className="text-sm font-bold uppercase tracking-tight">{getCourseName(session.course_id)}</div>
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

export default CenterSessionsPage;
