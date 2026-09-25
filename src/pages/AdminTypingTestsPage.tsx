import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BookCheck, 
  Loader2, 
  Languages, 
  BookOpen, 
  Eye, 
  Play, 
  X, 
  ShieldAlert, 
  Gamepad2,
  Award,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useNavigate } from "react-router-dom";

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
  min_wpm?: number;
  min_accuracy?: number;
  duration_minutes?: number;
}

type DifficultyMode = "beginning" | "medium" | "hard";

const AdminTypingTestsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  // Modals state
  const [viewingLesson, setViewingLesson] = useState<Lesson | null>(null);
  const [testLesson, setTestLesson] = useState<Lesson | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyMode>("beginning");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
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

  // Lock background scroll when any modal is active
  useEffect(() => {
    if (viewingLesson || testLesson) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [viewingLesson, testLesson]);

  const handleLaunchTest = () => {
    if (!testLesson) return;
    navigate(`/dashboard/typing/practice?lessonId=${testLesson._id}&mode=${selectedDifficulty}`);
  };

  const lessonsByLanguage = languages.map((lang) => ({
    ...lang,
    lessons: lessons.filter((l) => l.language_id === lang._id),
  }));

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
        {/* Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-black text-2xl md:text-3xl text-white uppercase tracking-tight flex items-center gap-3">
              <BookCheck className="w-8 h-8 text-blue-400" />
              Practice Tests & Allotments
            </h1>
            <p className="text-slate-400 mt-1 text-xs md:text-sm font-medium">
              View lesson specifications or launch interactive typing speed tests with Beginning, Medium, and Hard difficulty modes.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="text-xs font-semibold">Loading Test Catalogue...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {lessonsByLanguage.map((lang) => (
              <Card key={lang._id} className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
                <CardHeader className="bg-slate-950/80 border-b border-slate-800 py-4 px-6">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-blue-400 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Languages className="w-4 h-4 text-blue-400" />
                      {lang.name} ({lang.lessons.length} lessons available)
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">
                      Code: {lang.code.toUpperCase()}
                    </span>
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-0">
                  {lang.lessons.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 text-xs font-medium italic">
                      No practice lessons configured for {lang.name} yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/60">
                      {lang.lessons.map((lesson) => (
                        <div
                          key={lesson._id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-slate-800/30 transition-colors gap-4"
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-11 h-11 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <BookOpen className="w-5 h-5 text-blue-400" />
                            </div>
                            <div className="space-y-1">
                              <h3 className="font-bold text-sm text-white tracking-tight">{lesson.title}</h3>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                                <span className="capitalize font-semibold text-slate-300">Level: {lesson.level}</span>
                                <span>•</span>
                                <span>{lesson.content?.length || 0} Chars</span>
                                <span>•</span>
                                <span className="text-amber-400 font-medium">Target: {lesson.min_wpm || 30} WPM</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons: View Lesson & Run Test */}
                          <div className="flex items-center gap-2.5 flex-shrink-0">
                            <button
                              onClick={() => setViewingLesson(lesson)}
                              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-2 border border-slate-700 hover:text-white"
                            >
                              <Eye className="w-4 h-4 text-blue-400" />
                              View Lesson
                            </button>

                            <button
                              onClick={() => {
                                setTestLesson(lesson);
                                setSelectedDifficulty("beginning");
                              }}
                              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-blue-500/20 active:scale-95 transition flex items-center gap-2"
                            >
                              <Play className="w-4 h-4 fill-white" />
                              Run Test
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {languages.length === 0 && (
              <Card className="rounded-2xl bg-slate-900 border border-slate-800">
                <CardContent className="py-16 text-center text-slate-400 space-y-3">
                  <BookCheck className="w-12 h-12 mx-auto text-slate-600" />
                  <p className="text-sm font-bold text-white uppercase tracking-wider">No Languages Configured</p>
                  <p className="text-xs">Add typing languages and lessons in the admin panel to create tests.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* 1. View Lesson Details Modal (Portal attached directly to document.body for perfect 1-screen centering) */}
        {viewingLesson && createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-hidden">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl p-6 animate-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between border-b border-slate-800 pb-4 flex-shrink-0">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {languages.find(l => l._id === viewingLesson.language_id)?.name || "Typing Test"}
                  </span>
                  <h2 className="text-xl font-black text-white mt-2">{viewingLesson.title}</h2>
                </div>
                <button 
                  onClick={() => setViewingLesson(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto space-y-5 my-4 pr-1">
                <div className="grid grid-cols-3 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Difficulty</p>
                    <p className="text-xs font-black text-white capitalize mt-0.5">{viewingLesson.level}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Min Speed</p>
                    <p className="text-xs font-black text-amber-400 mt-0.5">{viewingLesson.min_wpm || 30} WPM</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Min Accuracy</p>
                    <p className="text-xs font-black text-emerald-400 mt-0.5">{viewingLesson.min_accuracy || 90}%</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lesson Passage Content Preview:</label>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 max-h-48 overflow-y-auto text-sm text-white leading-relaxed font-sans">
                    {viewingLesson.content}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800 flex-shrink-0">
                <button
                  onClick={() => setViewingLesson(null)}
                  className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider transition"
                >
                  Close Preview
                </button>
                <button
                  onClick={() => {
                    const l = viewingLesson;
                    setViewingLesson(null);
                    setTestLesson(l);
                  }}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition"
                >
                  <Play className="w-4 h-4 fill-white" /> Start Test Now
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* 2. Run Test Modal: Difficulty Mode Selector (Portal attached directly to document.body) */}
        {testLesson && createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-hidden">
            <div className="bg-slate-900 border border-blue-500/40 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl p-6 animate-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between border-b border-slate-800 pb-4 flex-shrink-0">
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <Gamepad2 className="w-6 h-6 text-blue-400" />
                    Select Test Difficulty Mode
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Lesson: <strong className="text-white">{testLesson.title}</strong>
                  </p>
                </div>
                <button 
                  onClick={() => setTestLesson(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto space-y-3 my-4 pr-1">
                {/* Beginning Mode */}
                <div 
                  onClick={() => setSelectedDifficulty("beginning")}
                  className={cn(
                    "p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-4",
                    selectedDifficulty === "beginning"
                      ? "bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-500/10"
                      : "bg-slate-950 border-slate-800 hover:border-slate-700"
                  )}
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-1">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-white">BEGINNING MODE (Trial & Tutor)</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Easy</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Includes step-by-step tutorial hints, full virtual keyboard layout suggestion on screen, low strictness rules, and free practice.
                    </p>
                  </div>
                </div>

                {/* Medium Mode */}
                <div 
                  onClick={() => setSelectedDifficulty("medium")}
                  className={cn(
                    "p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-4",
                    selectedDifficulty === "medium"
                      ? "bg-amber-950/40 border-amber-500 shadow-lg shadow-amber-500/10"
                      : "bg-slate-950 border-slate-800 hover:border-slate-700"
                  )}
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center flex-shrink-0 mt-1">
                    <Award className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-white">MEDIUM MODE (Standard Test)</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">Moderate</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Reduced tutor hints, standard timer and speed meter, optional keyboard guidance, regular backspace penalties.
                    </p>
                  </div>
                </div>

                {/* Hard Mode */}
                <div 
                  onClick={() => setSelectedDifficulty("hard")}
                  className={cn(
                    "p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-4",
                    selectedDifficulty === "hard"
                      ? "bg-rose-950/40 border-rose-500 shadow-lg shadow-rose-500/10"
                      : "bg-slate-950 border-slate-800 hover:border-slate-700"
                  )}
                >
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center flex-shrink-0 mt-1">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-white">HARD MODE (Strict Exam Mode)</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400">Strict</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Zero tutorial hints, NO keyboard visual suggestions on screen, strict backspace and wrong key tracking, exam speed meter.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800 flex-shrink-0">
                <button
                  onClick={() => setTestLesson(null)}
                  className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLaunchTest}
                  className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-500/25 active:scale-95 flex items-center gap-2 transition"
                >
                  <Play className="w-4 h-4 fill-white" /> Launch Test Session
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminTypingTestsPage;
