import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, BookOpen, Layers } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Link } from "react-router-dom";

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
      // Get student's enrolled course from /api/courses/allot
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
    } catch (error) {
      toast.error("Failed to load course subjects");
    } finally {
      setLoading(false);
    }
  };

  const getSubject = (id: string) => subjects.find(s => s._id === id);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">My Subjects</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">View the curriculum and subjects for your enrolled course.</p>
          </div>
          
          {enrolledCourse && (
            <div className="flex flex-col items-end">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Enrolled Course</div>
                <div className="text-sm font-bold uppercase tracking-tight text-primary">{enrolledCourse.course_name}</div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : !enrolledCourse ? (
          <Card className="rounded-none border-dashed border-2 border-border">
            <CardContent className="py-20 flex flex-col items-center text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-lg font-bold uppercase tracking-tight">Not Enrolled</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2">
                You are not enrolled in any course yet. Please contact your center.
              </p>
            </CardContent>
          </Card>
        ) : mappings.length === 0 ? (
          <Card className="rounded-none border-dashed border-2 border-border">
            <CardContent className="py-20 flex flex-col items-center text-center">
              <Layers className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-lg font-bold uppercase tracking-tight">Curriculum Not Defined</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2">
                The curriculum for your course has not been defined yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mappings.map((m) => {
              const sub = getSubject(m.subject_id);
              const subjectMocks = eligibleMocks.filter((x) => x.subject_id === m.subject_id);
              return (
                <Card key={m.subject_id} className="rounded-none border-border group hover:border-primary transition-all">
                  <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between py-4">
                    <div className="w-8 h-8 bg-primary/10 text-primary flex items-center justify-center font-heading font-black text-xs border border-primary/20">
                        {m.subject_order}
                    </div>
                    <code className="text-[10px] font-mono text-muted-foreground">{sub?.subject_code || "N/A"}</code>
                  </CardHeader>
                  <CardContent className="p-6">
                    <h3 className="font-bold text-sm uppercase tracking-tight mb-2">{sub?.subject_name || "Unknown Subject"}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-3 min-h-[48px]">
                      {sub?.description || "No description provided."}
                    </p>
                    {subjectMocks.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border space-y-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-primary">Mock tests</p>
                        <ul className="space-y-1">
                          {subjectMocks.map((mk) => (
                            <li key={mk.mock_test_id} className="text-[11px] text-muted-foreground flex justify-between gap-2">
                              <span className="font-semibold text-foreground">{mk.name}</span>
                              <Link
                                to="/dashboard/student/exams"
                                className="shrink-0 text-primary font-bold uppercase text-[9px] underline"
                              >
                                Open exams
                              </Link>
                            </li>
                          ))}
                        </ul>
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
