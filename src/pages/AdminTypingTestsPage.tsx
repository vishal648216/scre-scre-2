import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookCheck, Loader2, Languages, BookOpen, Play, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

import { apiFetch } from "@/lib/api";

const normalizeId = (v: any): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    if (typeof v.$oid === "string") return v.$oid;
    if (typeof v.id === "string") return v.id;
    if (typeof v._id === "string") return v._id;
  }
  return String(v);
};

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
  const [previewLesson, setPreviewLesson] = useState<Lesson | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [langRes, lessonRes] = await Promise.all([
        apiFetch("/api/typing/languages"),
        apiFetch("/api/typing/lessons"),
      ]);
      const langData = await langRes.json();
      const lessonData = await lessonRes.json();
      if (langRes.ok && Array.isArray(langData)) {
        setLanguages(langData.map((l: any) => ({
          ...l,
          _id: normalizeId(l._id ?? l.id),
        })));
      } else {
        setLanguages([]);
      }
      if (lessonRes.ok && Array.isArray(lessonData)) {
        setLessons(lessonData.map((l: any) => ({
          ...l,
          _id: normalizeId(l._id ?? l.id),
          language_id: normalizeId(l.language_id),
        })));
      } else {
        setLessons([]);
      }
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
            Lessons available for typing practice tests. Click "Start Test" on any lesson to launch typing practice immediately.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {lessonsByLanguage.map((lang) => (
              <Card key={lang._id} className="rounded-none border-border overflow-hidden shadow-sm">
                <CardHeader className="bg-muted/30 border-b py-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
                    <Languages className="w-4 h-4 text-primary" />
                    {lang.name} ({lang.lessons.length} lessons)
                  </CardTitle>
                  {lang.lessons.length > 0 && (
                    <Link
                      to={`/dashboard/typing/practice?langId=${lang._id}`}
                      className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1"
                    >
                      <Play className="w-3 h-3" /> Practice Language
                    </Link>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  {lang.lessons.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                      <p>No custom lessons for this language yet.</p>
                      <Link
                        to={`/dashboard/typing/practice?langId=${lang._id}`}
                        className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 text-xs font-bold uppercase tracking-wider hover:bg-primary/20 transition-all flex items-center gap-2"
                      >
                        <Play className="w-3.5 h-3.5" /> Start Instant Practice Passage
                      </Link>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {lang.lessons.map((lesson) => (
                        <div
                          key={lesson._id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors gap-4"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-none bg-primary/10 flex items-center justify-center shrink-0">
                              <BookOpen className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-bold text-foreground">{lesson.title}</p>
                              <p className="text-xs text-muted-foreground capitalize">
                                Level: <span className="font-semibold text-foreground">{lesson.level}</span> • {lesson.content?.length || 0} characters
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setPreviewLesson(lesson)}
                              className="px-3 py-2 border border-border text-muted-foreground hover:text-foreground text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" /> View
                            </button>
                            <Link
                              to={`/dashboard/typing/practice?lessonId=${lesson._id}&langId=${lang._id}`}
                              className="px-5 py-2 bg-primary text-primary-foreground font-heading font-black text-[10px] uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2 shadow-sm"
                            >
                              <Play className="w-3.5 h-3.5" /> Start Test
                            </Link>
                          </div>
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

        {/* Quick Lesson Preview Modal */}
        {previewLesson && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="max-w-xl w-full rounded-none border-primary shadow-2xl animate-in zoom-in-95 duration-200">
              <CardHeader className="bg-primary text-primary-foreground flex flex-row items-center justify-between py-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  {previewLesson.title}
                </CardTitle>
                <button
                  type="button"
                  onClick={() => setPreviewLesson(null)}
                  className="text-xs font-bold uppercase tracking-widest opacity-80 hover:opacity-100"
                >
                  ✕ Close
                </button>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Difficulty: <span className="text-foreground">{previewLesson.level}</span>
                </div>
                <div className="bg-muted/40 p-4 border border-border font-mono text-sm leading-relaxed max-h-60 overflow-y-auto">
                  "{previewLesson.content}"
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setPreviewLesson(null)}
                    className="px-4 py-2 border border-border text-xs font-black uppercase tracking-widest"
                  >
                    Close
                  </button>
                  <Link
                    to={`/dashboard/typing/practice?lessonId=${previewLesson._id}&langId=${previewLesson.language_id}`}
                    onClick={() => setPreviewLesson(null)}
                    className="px-6 py-2 bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg"
                  >
                    <Play className="w-4 h-4" /> Start Practice Test Now
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminTypingTestsPage;
