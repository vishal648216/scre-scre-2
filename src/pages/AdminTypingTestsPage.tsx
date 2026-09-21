import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookCheck, Loader2, Languages, BookOpen, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Language {
  _id: string;
  name: string;
  code: string;
}

interface Lesson {
  _id: string;
  language_id: string;
  title: string;
  content: string;
  level: string;
}

const AdminTypingTestsPage = () => {
  const [loading, setLoading] = useState(true);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = sessionStorage.getItem("token");
      const [langRes, lessonRes] = await Promise.all([
        fetch("/api/typing/languages", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/typing/lessons", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const langData = await langRes.json();
      const lessonData = await lessonRes.json();
      if (langRes.ok && Array.isArray(langData)) setLanguages(langData);
      else setLanguages([]);
      if (lessonRes.ok && Array.isArray(lessonData)) setLessons(lessonData);
      else setLessons([]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const lessonsByLanguage = languages.map((lang) => ({
    ...lang,
    lessons: lessons.filter((l) => l.language_id === lang._id),
  }));

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
            Practice Tests
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Lessons available for typing practice tests. Students use these in the Typing Practice section.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {lessonsByLanguage.map((lang) => (
              <Card key={lang._id} className="rounded-none border-border overflow-hidden">
                <CardHeader className="bg-muted/30 border-b py-4">
                  <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
                    <Languages className="w-4 h-4" />
                    {lang.name} ({lang.lessons.length} lessons)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {lang.lessons.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                      No lessons yet. Add lessons in the Typing Lessons section.
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {lang.lessons.map((lesson) => (
                        <div
                          key={lesson._id}
                          className="flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-none bg-primary/10 flex items-center justify-center">
                              <BookOpen className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-bold text-foreground">{lesson.title}</p>
                              <p className="text-xs text-muted-foreground capitalize">
                                Level: {lesson.level} • {lesson.content?.length || 0} chars
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-primary/10 text-primary rounded-none">
                            Test Ready
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {languages.length === 0 && (
              <Card className="rounded-none border-border">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <BookCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Add languages and lessons in Typing Master to create practice tests.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminTypingTestsPage;
