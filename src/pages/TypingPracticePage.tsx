import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Keyboard, Play, RefreshCw, Loader2, Languages, Clock, Zap, CheckCircle2, AlertTriangle, 
  BookOpen, Target, History, Award, RotateCcw, Pause, ChevronRight, XCircle, Trophy, BarChart3, Users 
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TypingAnalyticsDashboard from "@/components/TypingAnalyticsDashboard";
import TypingLeaderboard from "@/components/TypingLeaderboard";

import { useTranslation } from "react-i18next";

interface Language {
  _id: string;
  name: string;
  font_family?: string;
}

interface Lesson {
  _id: string;
  language_id: string;
  title: string;
  content: string;
  level: string;
  min_wpm?: number;
  min_accuracy?: number;
}

const TypingPracticePage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [mode, setMode] = useState<"practice" | "exam">("practice");
  
  // Practice state
  const [userInput, setUserInput] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [stats, setStats] = useState({ wpm: 0, accuracy: 0, time: 0 });
  const [submitting, setSubmitting] = useState(false);
  
  // Anti-cheat / Detailed tracking
  const [mistakes, setMistakes] = useState(0);
  const [extraChars, setExtraChars] = useState(0);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchLanguages();
    
    // Anti-cheat: Disable context menu
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  useEffect(() => {
    if (selectedLanguage) {
      fetchLessons(selectedLanguage);
    } else {
      setLessons([]);
      setSelectedLesson(null);
    }
  }, [selectedLanguage]);

  const fetchLanguages = async () => {
    try {
      const response = await fetch("/api/typing/languages", {
        headers: { "Authorization": `Bearer ${sessionStorage.getItem("token")}` }
      });
      const data = await response.json();
      if (response.ok) setLanguages(data);
    } catch (error) {
      console.error("Error fetching languages:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLessons = async (langId: string) => {
    try {
      const response = await fetch(`/api/typing/lessons?language_id=${langId}&active=true`, {
        headers: { "Authorization": `Bearer ${sessionStorage.getItem("token")}` }
      });
      const data = await response.json();
      if (response.ok) setLessons(data);
    } catch (error) {
      console.error("Error fetching lessons:", error);
    }
  };

  const startPractice = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setUserInput("");
    setStartTime(null);
    setEndTime(null);
    setIsFinished(false);
    setMistakes(0);
    setExtraChars(0);
    setStats({ wpm: 0, accuracy: 0, time: 0 });
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isFinished || !selectedLesson) return;
    
    const val = e.target.value;
    
    // Prevent pasting
    if (val.length - userInput.length > 1) {
      toast.error("Pasting is not allowed!");
      return;
    }

    if (!startTime) setStartTime(Date.now());
    
    // Calculate mistakes if backspacing or typing
    if (val.length > userInput.length) {
      const lastChar = val[val.length - 1];
      const targetChar = selectedLesson.content[val.length - 1];
      if (lastChar !== targetChar) {
        setMistakes(prev => prev + 1);
      }
    }

    setUserInput(val);

    if (val.length === selectedLesson.content.length) {
      finishPractice(val);
    }
  };

  const finishPractice = (finalInput: string) => {
    const end = Date.now();
    setEndTime(end);
    setIsFinished(true);

    const durationSec = Math.round((end - (startTime || end)) / 1000);
    const timeTakenMin = durationSec / 60;
    
    // Standard WPM: (total chars / 5) / time in minutes
    const totalChars = finalInput.length;
    const wpm = Math.round((totalChars / 5) / (timeTakenMin || 1/60));
    
    // Accuracy
    let correctChars = 0;
    const originalContent = selectedLesson?.content || "";
    for (let i = 0; i < originalContent.length; i++) {
      if (finalInput[i] === originalContent[i]) correctChars++;
    }
    const accuracy = Math.round((correctChars / totalChars) * 100);

    setStats({
      wpm,
      accuracy,
      time: durationSec
    });
    
    submitResult(finalInput, wpm, accuracy, durationSec, correctChars, totalChars - correctChars);
  };

  const submitResult = async (finalInput: string, wpm: number, accuracy: number, duration: number, correct: number, incorrect: number) => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/typing/results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionStorage.getItem("token")}`
        },
        body: JSON.stringify({
          lesson_id: selectedLesson?._id,
          mode,
          start_time: new Date(startTime!).toISOString(),
          end_time: new Date(endTime!).toISOString(),
          total_chars: finalInput.length,
          correct_chars: correct,
          incorrect_chars: incorrect,
          extra_chars: extraChars,
        })
      });
      
      if (response.ok) {
        toast.success("Practice result saved!");
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to save result");
      }
    } catch (error) {
      console.error("Error saving result:", error);
      toast.error("Network error saving result");
    } finally {
      setSubmitting(false);
    }
  };

  const resetPractice = () => {
    if (selectedLesson) startPractice(selectedLesson);
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight flex items-center gap-3">
              <Keyboard className="w-8 h-8 text-primary" />
              {t("Typing Master")}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">{t("Improve your typing speed and accuracy with guided lessons.")}</p>
          </div>
        </div>

        <Tabs defaultValue="lessons" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b-2 bg-transparent p-0 mb-8">
            <TabsTrigger 
              value="lessons" 
              className="rounded-none border-b-2 border-transparent px-8 py-3 font-black text-[10px] uppercase tracking-[0.2em] data-[state=active]:border-primary data-[state=active]:bg-muted/50 transition-all"
            >
              <BookOpen className="w-4 h-4 mr-2" /> {t("Lessons & Tests")}
            </TabsTrigger>
            <TabsTrigger 
              value="leaderboard" 
              className="rounded-none border-b-2 border-transparent px-8 py-3 font-black text-[10px] uppercase tracking-[0.2em] data-[state=active]:border-primary data-[state=active]:bg-muted/50 transition-all"
            >
              <Trophy className="w-4 h-4 mr-2" /> {t("Competition Leaderboard")}
            </TabsTrigger>
            <TabsTrigger 
              value="analytics" 
              className="rounded-none border-b-2 border-transparent px-8 py-3 font-black text-[10px] uppercase tracking-[0.2em] data-[state=active]:border-primary data-[state=active]:bg-muted/50 transition-all"
            >
              <BarChart3 className="w-4 h-4 mr-2" /> {t("Personal Analytics")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lessons" className="mt-0">
            {!selectedLesson ? (
              <div className="space-y-6">
                <div className="flex items-center gap-4 bg-card p-2 border border-border shadow-sm w-fit">
                  <Languages className="w-5 h-5 text-primary ml-2" />
                  <select 
                    className="bg-transparent border-none focus:ring-0 text-sm font-bold uppercase tracking-tight outline-none"
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                  >
                    <option value="">{t("CHOOSE LANGUAGE")}</option>
                    {languages.map(lang => (
                      <option key={lang._id} value={lang._id}>{t(lang.name.toUpperCase())}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {loading ? (
                    <div className="col-span-full py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                  ) : !selectedLanguage ? (
                    <Card className="col-span-full rounded-none border-border border-dashed p-20 text-center opacity-60">
                      <Keyboard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{t("Select a language to see lessons")}</p>
                    </Card>
                  ) : lessons.length === 0 ? (
                    <div className="col-span-full py-20 border border-border border-dashed text-center opacity-60">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{t("No lessons found for this language")}</p>
                    </div>
                  ) : (
                    lessons.map(lesson => (
                      <Card key={lesson._id} className="rounded-none border-border shadow-md hover:border-primary/40 transition-all overflow-hidden group">
                        <div className="p-6 space-y-4">
                          <div className="flex justify-between items-start">
                            <div className="w-12 h-12 bg-primary/5 flex items-center justify-center border border-primary/10">
                              <Play className="w-6 h-6 text-primary" />
                            </div>
                            <span className={cn(
                              "text-[8px] font-black uppercase tracking-widest px-2 py-1 border",
                              lesson.level === "beginner" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : 
                              lesson.level === "intermediate" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : 
                              "bg-destructive/10 text-destructive border-destructive/20"
                            )}>
                              {t(lesson.level)}
                            </span>
                          </div>
                          <div>
                            <h3 className="text-lg font-black uppercase tracking-tight text-foreground truncate">{t(lesson.title)}</h3>
                            <div className="flex items-center gap-3 mt-1">
                              {lesson.min_wpm && (
                                <span className="text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-1">
                                  <Zap className="w-3 h-3" /> {lesson.min_wpm} {t("WPM")}
                                </span>
                              )}
                              {lesson.min_accuracy && (
                                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                                  <Target className="w-3 h-3" /> {lesson.min_accuracy}%
                                </span>
                              )}
                            </div>
                          </div>
                          <button 
                            onClick={() => startPractice(lesson)}
                            className="w-full py-3 bg-muted group-hover:bg-primary group-hover:text-primary-foreground text-foreground font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                          >
                            <Play className="w-4 h-4" /> {t("Start Practice")}
                          </button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto">
                <Card className="rounded-none border-primary shadow-2xl overflow-hidden">
                  <div className="bg-primary p-4 text-primary-foreground flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <BookOpen className="w-5 h-5" />
                      <h2 className="text-sm font-black uppercase tracking-widest">{t(selectedLesson.title)}</h2>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 opacity-70" />
                        <span className="text-lg font-black font-mono">{stats.time}s</span>
                      </div>
                      <button onClick={() => setSelectedLesson(null)} className="opacity-70 hover:opacity-100"><XCircle className="w-5 h-5" /></button>
                    </div>
                  </div>
                  
                  <CardContent className="p-8 space-y-8">
                    {/* Live Stats Meter */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-6 border-b border-border/50">
                      <div className="text-center">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("Live Speed")}</p>
                        <p className="text-xl font-black text-primary">{Math.round(stats.wpm)} <span className="text-[8px]">{t("WPM")}</span></p>
                      </div>
                      <div className="text-center border-l border-border/50">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("Accuracy")}</p>
                        <p className="text-xl font-black text-emerald-600">{Math.round(stats.accuracy)} <span className="text-[8px]">%</span></p>
                      </div>
                      <div className="text-center border-l border-border/50">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("Characters")}</p>
                        <p className="text-xl font-black">{userInput.length}</p>
                      </div>
                      <div className="text-center border-l border-border/50">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("Target")}</p>
                        <p className="text-xl font-black text-amber-600">{selectedLesson.min_wpm || "--"} <span className="text-[8px]">{t("WPM")}</span></p>
                      </div>
                    </div>

                    {/* Content Display */}
                    <div 
                      className="bg-muted/30 p-8 border border-border/50 font-mono text-xl leading-relaxed select-none relative"
                      style={{ fontFamily: languages.find(l => l._id === selectedLesson.language_id)?.font_family || "inherit" }}
                    >
                      <div className="absolute top-0 left-0 w-full h-1 bg-primary/20">
                        <div 
                          className="h-full bg-primary transition-all duration-300" 
                          style={{ width: `${(userInput.length / selectedLesson.content.length) * 100}%` }}
                        />
                      </div>
                      
                      {selectedLesson.content.split("").map((char, i) => (
                        <span 
                          key={i} 
                          className={cn(
                            "transition-colors",
                            i < userInput.length ? (userInput[i] === char ? "text-primary font-bold" : "text-destructive bg-destructive/10") : 
                            i === userInput.length ? "bg-primary/20 border-b-2 border-primary animate-pulse" : "text-muted-foreground/40"
                          )}
                        >
                          {char}
                        </span>
                      ))}
                    </div>

                    <textarea
                      ref={inputRef}
                      autoFocus
                      disabled={isFinished}
                      value={userInput}
                      onChange={handleInputChange}
                      className="w-full h-32 p-6 bg-card border-2 border-border rounded-none text-xl font-mono focus:border-primary outline-none transition-all resize-none shadow-inner"
                      placeholder={t("Start typing the text above...")}
                    />

                    <div className="flex justify-between items-center pt-4">
                      <div className="flex gap-2">
                        {!isFinished && (
                          <button 
                            onClick={() => inputRef.current?.focus()}
                            className="px-6 py-2 bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-widest shadow-lg"
                          >
                            {t("Click here to Type")}
                          </button>
                        )}
                      </div>
                      <button onClick={resetPractice} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-2">
                        <RotateCcw className="w-3 h-3" /> {t("Reset Session")}
                      </button>
                    </div>

                    {/* Results Overlay */}
                    {isFinished && (
                      <div className="space-y-8 animate-in zoom-in duration-500 pt-8 border-t border-border">
                        {(() => {
                          const isPassed = (selectedLesson.min_wpm ? stats.wpm >= selectedLesson.min_wpm : true) && 
                                           (selectedLesson.min_accuracy ? stats.accuracy >= selectedLesson.min_accuracy : true);
                          return (
                            <>
                              <div className="text-center space-y-2">
                                <div className={cn(
                                  "w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 border-4",
                                  isPassed ? "bg-emerald-500/10 text-emerald-600 border-emerald-500" : "bg-destructive/10 text-destructive border-destructive"
                                )}>
                                  {isPassed ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
                                </div>
                                <h2 className="text-2xl font-black uppercase tracking-tight">{isPassed ? t("Session Completed!") : t("Requirements Not Met")}</h2>
                                <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">
                                  {isPassed ? t("Excellent performance. Your results have been saved.") : t("You did not meet the minimum speed or accuracy for this lesson.")}
                                </p>
                              </div>
    
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <ResultCard label={t("Net Speed")} value={`${stats.wpm} ${t("WPM")}`} icon={Zap} color="text-primary" />
                                <ResultCard label={t("Accuracy")} value={`${stats.accuracy}%`} icon={Target} color="text-emerald-500" />
                                <ResultCard label={t("Duration")} value={`${stats.time}s`} icon={Clock} color="text-amber-500" />
                                <ResultCard label={t("Total Chars")} value={`${userInput.length}`} icon={Keyboard} color="text-blue-500" />
                              </div>
    
                              {(selectedLesson.min_wpm || selectedLesson.min_accuracy) && (
                                <div className="bg-muted/30 p-4 border border-border/50 text-center">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">{t("Required Thresholds")}</p>
                                  <div className="flex justify-center gap-6">
                                    <span className="text-xs font-bold uppercase tracking-tight flex items-center gap-2">
                                      <Zap className="w-3 h-3 text-primary" /> {t("Speed")}: {selectedLesson.min_wpm || 0} {t("WPM")}
                                    </span>
                                    <span className="text-xs font-bold uppercase tracking-tight flex items-center gap-2">
                                      <Target className="w-3 h-3 text-emerald-500" /> {t("Accuracy")}: {selectedLesson.min_accuracy || 0}%
                                    </span>
                                  </div>
                                </div>
                              )}
    
                              <div className="flex flex-col md:flex-row gap-4 pt-4">
                                <button 
                                  onClick={resetPractice}
                                  disabled={submitting}
                                  className="flex-1 py-4 bg-muted text-foreground font-black text-xs uppercase tracking-[0.2em] border border-border hover:bg-muted/80 transition-all flex items-center justify-center gap-2"
                                >
                                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                  <span className="text-[10px] font-black uppercase tracking-widest">{submitting ? t("Saving...") : t("Try Again")}</span>
                                </button>
                                <button 
                                  onClick={() => setSelectedLesson(null)}
                                  className="flex-1 py-4 bg-muted text-foreground font-black text-xs uppercase tracking-[0.2em] border border-border hover:bg-muted/80 transition-all"
                                >
                                  {t("Back to Lessons")}
                                </button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-0">
            <Card className="rounded-none border-border shadow-xl">
              <CardContent className="p-8 text-center">
                <Trophy className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-lg font-black uppercase tracking-tight">{t("Leaderboard Coming Soon")}</h3>
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-2">{t("Compete with other typists to reach the top of the rankings.")}</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="mt-0">
            <TypingAnalyticsDashboard role="student" />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

import type { ComponentType } from "react";
interface ResultCardProps {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
}
const ResultCard = ({ label, value, icon: Icon, color }: ResultCardProps) => (
  <div className="bg-muted/30 border border-border p-6 text-center space-y-2">
    <Icon className={cn("w-6 h-6 mx-auto", color)} />
    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
    <p className="text-2xl font-black text-foreground">{value}</p>
  </div>
);

export default TypingPracticePage;
