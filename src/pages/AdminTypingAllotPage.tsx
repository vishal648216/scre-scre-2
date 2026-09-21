import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BookOpen, Loader2, Save, Languages, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Course {
  _id: string;
  name: string;
  code: string;
}

interface Language {
  _id: string;
  name: string;
  code: string;
}

const AdminTypingAllotPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [allotments, setAllotments] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = sessionStorage.getItem("token");
      const [courseRes, langRes] = await Promise.all([
        fetch("/api/courses", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/typing/languages", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const courseData = await courseRes.json();
      const langData = await langRes.json();
      if (courseRes.ok) setCourses(courseData);
      if (langRes.ok) setLanguages(langData);

      const allotMap: Record<string, string[]> = {};
      for (const c of courseData) {
        const res = await fetch(`/api/admin/courses/${c._id}/typing`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.language_ids) {
          allotMap[c._id] = data.language_ids;
        } else {
          allotMap[c._id] = [];
        }
      }
      setAllotments(allotMap);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const toggleAllot = (courseId: string, langId: string) => {
    setAllotments((prev) => {
      const current = prev[courseId] || [];
      const has = current.includes(langId);
      return {
        ...prev,
        [courseId]: has ? current.filter((id) => id !== langId) : [...current, langId],
      };
    });
  };

  const saveAllotment = async (courseId: string) => {
    setSaving(courseId);
    try {
      const token = sessionStorage.getItem("token");
      const response = await fetch(`/api/admin/courses/${courseId}/typing`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          language_ids: allotments[courseId] || [],
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast.success("Allotment saved");
      } else {
        toast.error(data.message || "Failed to save");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
            Allot Typing to Course
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Assign typing languages to courses. Students enrolled in a course will have access to the allotted typing practice.
          </p>
        </div>

        <Card className="rounded-none border-border overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-sm font-bold uppercase tracking-tight">
              Course × Typing Languages
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {courses.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No courses found. Add courses in Academics → Courses.
              </div>
            ) : languages.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No typing languages found. Add languages in Typing Master → Languages.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Course
                    </th>
                    {languages.map((lang) => (
                      <th key={lang._id} className="px-4 py-4 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground min-w-[120px]">
                        {lang.name}
                      </th>
                    ))}
                    <th className="px-4 py-4 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground w-24">
                      Save
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course._id} className="border-b border-border hover:bg-muted/20">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-primary" />
                          <div>
                            <p className="font-bold text-foreground">{course.name}</p>
                            <p className="text-xs text-muted-foreground">{course.code}</p>
                          </div>
                        </div>
                      </td>
                      {languages.map((lang) => (
                        <td key={lang._id} className="px-4 py-4 text-center">
                          <Checkbox
                            checked={(allotments[course._id] || []).includes(lang._id)}
                            onCheckedChange={() => toggleAllot(course._id, lang._id)}
                            className="rounded-none"
                          />
                        </td>
                      ))}
                      <td className="px-4 py-4 text-center">
                        <Button
                          size="sm"
                          onClick={() => saveAllotment(course._id)}
                          disabled={saving === course._id}
                          className="rounded-none"
                        >
                          {saving === course._id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminTypingAllotPage;
