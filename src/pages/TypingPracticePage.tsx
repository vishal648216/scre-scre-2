import { useState, useEffect, useRef, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Keyboard, Play, RefreshCw, Loader2, Languages, Clock, Zap, CheckCircle2, AlertTriangle, 
  BookOpen, Target, History, Award, RotateCcw, Pause, ChevronRight, XCircle, Trophy, BarChart3, Users,
  FileText, Printer, Globe, Sparkles, Search, ShieldAlert, Gamepad2, ArrowLeft, Delete
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TypingAnalyticsDashboard from "@/components/TypingAnalyticsDashboard";
import { TypingScorecardCertificateModal } from "@/components/TypingScorecardCertificateModal";
import VirtualKeyboard from "@/components/VirtualKeyboard";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { useSearchParams, useNavigate } from "react-router-dom";

interface Language {
  _id: string;
  name: string;
  code: string;
  font_family?: string;
  keyboard_layout?: string;
  script?: string;
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

// Gaming Analog Speedometer Component
const SpeedometerGauge = ({ wpm }: { wpm: number }) => {
  const clampWpm = Math.min(120, Math.max(0, wpm));
  // Angle maps 0 WPM -> -120deg, 120 WPM -> +120deg
  const angle = -120 + (clampWpm / 120) * 240;

  // Determine color theme based on speed zone
  let themeColor = "#ef4444"; // Red
  let zoneLabel = "SLOW";
  if (wpm >= 85) {
    themeColor = "#a855f7"; // Neon Purple
    zoneLabel = "SUPERSONIC";
  } else if (wpm >= 65) {
    themeColor = "#10b981"; // Emerald
    zoneLabel = "FAST";
  } else if (wpm >= 45) {
    themeColor = "#06b6d4"; // Cyan
    zoneLabel = "GOOD";
  } else if (wpm >= 25) {
    themeColor = "#f59e0b"; // Amber
    zoneLabel = "MODERATE";
  }

  return (
    <div className="flex flex-col items-center justify-center p-3 bg-slate-950/80 border border-slate-800 rounded-2xl shadow-xl relative overflow-hidden">
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
        <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
        Live Speedometer
      </div>

      <div className="relative w-44 h-32 flex items-center justify-center">
        {/* SVG Dial */}
        <svg viewBox="0 0 200 150" className="w-full h-full">
          {/* Outer Dial Arc */}
          <path
            d="M 30 130 A 75 75 0 1 1 170 130"
            fill="none"
            stroke="#1e293b"
            strokeWidth="14"
            strokeLinecap="round"
          />
          {/* Active Speed Arc */}
          <path
            d="M 30 130 A 75 75 0 1 1 170 130"
            fill="none"
            stroke={themeColor}
            strokeWidth="12"
            strokeDasharray="314"
            strokeDashoffset={314 - (clampWpm / 120) * 314}
            strokeLinecap="round"
            className="transition-all duration-300 ease-out"
          />

          {/* Speedometer Ticks */}
          {[0, 20, 40, 60, 80, 100, 120].map((val) => {
            const tickAngle = -120 + (val / 120) * 240;
            const rad = (tickAngle * Math.PI) / 180;
            const x1 = 100 + 60 * Math.sin(rad);
            const y1 = 100 - 60 * Math.cos(rad);
            const x2 = 100 + 70 * Math.sin(rad);
            const y2 = 100 - 70 * Math.cos(rad);
            return (
              <g key={val}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#475569" strokeWidth="2" />
              </g>
            );
          })}

          {/* Dial Needle */}
          <g transform={`rotate(${angle} 100 100)`} className="transition-transform duration-300 ease-out">
            <polygon points="97,100 103,100 100,30" fill={themeColor} />
            <circle cx="100" cy="100" r="8" fill="#f8fafc" stroke={themeColor} strokeWidth="3" />
          </g>
        </svg>

        {/* Numeric Speed Display */}
        <div className="absolute bottom-2 text-center">
          <div className="text-2xl font-black text-white font-mono tracking-tight" style={{ color: themeColor }}>
            {wpm}
          </div>
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">WPM</div>
        </div>
      </div>

      <div className="mt-1 px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest" style={{ backgroundColor: `${themeColor}20`, color: themeColor }}>
        {zoneLabel}
      </div>
    </div>
  );
};

const TypingPracticePage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlLessonId = searchParams.get("lessonId");
  const urlMode = (searchParams.get("mode") as "beginning" | "medium" | "hard") || "medium";

  const [loading, setLoading] = useState(true);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  
  // Practice & Test parameters
  const [difficultyMode, setDifficultyMode] = useState<"beginning" | "medium" | "hard">(urlMode);
  
  // Practice state
  const [userInput, setUserInput] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [stats, setStats] = useState({ wpm: 0, cpm: 0, rpm: 0, accuracy: 0, time: 0 });
  const [submitting, setSubmitting] = useState(false);
  
  // Detailed Keystroke Analytics
  const [mistakes, setMistakes] = useState(0);
  const [backspaceCount, setBackspaceCount] = useState(0);
  const [keyPressLog, setKeyPressLog] = useState<Record<string, number>>({});
  
  // Scorecard / Certificate Modal
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docModalMode, setDocModalMode] = useState<"scorecard" | "certificate">("scorecard");
  
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentLanguage = languages.find(l => l._id === selectedLanguage);
  const isRtl = ["ar", "ur", "fa", "he"].includes((currentLanguage?.code || "").toLowerCase());
  const activeFontFamily = currentLanguage?.font_family || "inherit";

  const [langSearch, setLangSearch] = useState("");
  const filteredSelectLanguages = useMemo(() => {
    if (!langSearch.trim()) return languages;
    const q = langSearch.toLowerCase();
    return languages.filter(l => 
      l.name.toLowerCase().includes(q) || 
      l.code.toLowerCase().includes(q) || 
      (l.keyboard_layout && l.keyboard_layout.toLowerCase().includes(q))
    );
  }, [languages, langSearch]);

  useEffect(() => {
    fetchLanguagesAndLessons();
    
    // Anti-cheat: Disable context menu
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  const fetchLanguagesAndLessons = async () => {
    try {
      setLoading(true);
      const [langRes, lessonRes] = await Promise.all([
        apiFetch("/api/typing/languages"),
        apiFetch("/api/typing/lessons")
      ]);
      
      let fetchedLangs: Language[] = [];
      let fetchedLessons: Lesson[] = [];

      if (langRes.ok) {
        const raw = await langRes.json();
        const list = Array.isArray(raw) ? raw : [];
        fetchedLangs = list.map((l: any) => ({
          ...l,
          _id: normalizeId(l._id ?? l.id),
        }));
        setLanguages(fetchedLangs);
      }

      if (lessonRes.ok) {
        const raw = await lessonRes.json();
        const list = Array.isArray(raw) ? raw : [];
        fetchedLessons = list.map((lesson: any) => ({
          ...lesson,
          _id: normalizeId(lesson._id ?? lesson.id),
          language_id: normalizeId(lesson.language_id),
        }));
        setLessons(fetchedLessons);
      }

      // Auto start lesson if passed in URL query parameter
      if (urlLessonId && fetchedLessons.length > 0) {
        const targetLesson = fetchedLessons.find(l => l._id === urlLessonId);
        if (targetLesson) {
          setSelectedLanguage(targetLesson.language_id);
          startPractice(targetLesson, urlMode);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const startPractice = (lesson: Lesson, mode: "beginning" | "medium" | "hard" = difficultyMode) => {
    setSelectedLesson(lesson);
    setDifficultyMode(mode);
    setUserInput("");
    setStartTime(null);
    setEndTime(null);
    setIsFinished(false);
    setMistakes(0);
    setBackspaceCount(0);
    setKeyPressLog({});
    setStats({ wpm: 0, cpm: 0, rpm: 0, accuracy: 0, time: 0 });
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Live Timer Interval
  useEffect(() => {
    if (!startTime || isFinished || !selectedLesson) return;
    const timer = setInterval(() => {
      const now = Date.now();
      const diffMs = Math.max(1000, now - startTime);
      const elapsedSec = Math.max(1, Math.round(diffMs / 1000));
      const elapsedMin = Math.max(0.08, diffMs / 60000); // Smooth minimum time denominator

      let correct = 0;
      for (let i = 0; i < userInput.length; i++) {
        if (userInput[i] === selectedLesson.content[i]) correct++;
      }

      const liveNetWpm = Math.max(0, Math.round((correct / 5) / elapsedMin));
      const liveCpm = Math.max(0, Math.round(correct / elapsedMin));
      const liveAcc = userInput.length > 0 ? Math.max(0, Math.min(100, Math.round((correct / userInput.length) * 100))) : 100;

      setStats({
        wpm: liveNetWpm,
        cpm: liveCpm,
        rpm: liveNetWpm,
        accuracy: liveAcc,
        time: elapsedSec
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime, isFinished, userInput, selectedLesson]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isFinished) return;
    if (e.key === "Backspace") {
      setBackspaceCount(prev => prev + 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isFinished || !selectedLesson) return;
    
    const val = e.target.value;
    
    // Prevent pasting using native event inputType
    const nativeEvent = e.nativeEvent as (InputEvent & { inputType?: string }) | undefined;
    if (nativeEvent?.inputType === "insertFromPaste") {
      toast.error("Pasting is strictly forbidden during typing tests!");
      return;
    }

    let currentStartTime = startTime;
    if (!currentStartTime) {
      currentStartTime = Date.now();
      setStartTime(currentStartTime);
    }
    
    const now = Date.now();
    const diffMs = Math.max(1000, now - currentStartTime);
    const elapsedSec = Math.max(1, Math.round(diffMs / 1000));
    const elapsedMin = Math.max(0.08, diffMs / 60000);

    // Record character mis-presses
    let currentMistakes = mistakes;
    if (val.length > userInput.length) {
      const added = val.slice(userInput.length);
      const expected = selectedLesson.content.slice(userInput.length, val.length);
      if (added !== expected) {
        currentMistakes = mistakes + 1;
        setMistakes(currentMistakes);
        const errKey = expected[0] || "unknown";
        setKeyPressLog(prev => ({ ...prev, [errKey]: (prev[errKey] || 0) + 1 }));
      }
    }

    setUserInput(val);

    // Calculate correct characters for Net WPM & CPM
    let correct = 0;
    for (let i = 0; i < val.length; i++) {
      if (val[i] === selectedLesson.content[i]) correct++;
    }

    const liveNetWpm = Math.max(0, Math.round((correct / 5) / elapsedMin));
    const liveCpm = Math.max(0, Math.round(correct / elapsedMin));
    const liveAcc = val.length > 0 ? Math.max(0, Math.min(100, Math.round((correct / val.length) * 100))) : 100;

    setStats({
      wpm: liveNetWpm,
      cpm: liveCpm,
      rpm: liveNetWpm,
      accuracy: liveAcc,
      time: elapsedSec
    });

    if (val.length >= selectedLesson.content.length) {
      finishPractice(val, liveNetWpm, liveAcc, elapsedSec, correct, val.length - correct);
    }
  };

  const finishPractice = (
    finalInput: string, 
    finalWpm: number, 
    finalAcc: number, 
    finalDuration: number, 
    correct: number, 
    incorrect: number
  ) => {
    const end = Date.now();
    setEndTime(end);
    setIsFinished(true);

    submitResult(finalInput, finalWpm, finalAcc, finalDuration, correct, incorrect);
  };

  const submitResult = async (
    finalInput: string, 
    wpm: number, 
    accuracy: number, 
    duration: number, 
    correct: number, 
    incorrect: number
  ) => {
    setSubmitting(true);
    try {
      const response = await apiFetch("/api/typing/results", {
        method: "POST",
        body: JSON.stringify({
          lesson_id: selectedLesson?._id,
          mode: difficultyMode,
          start_time: new Date(startTime!).toISOString(),
          end_time: new Date(endTime!).toISOString(),
          total_chars: finalInput.length,
          correct_chars: correct,
          incorrect_chars: incorrect,
          extra_chars: backspaceCount,
        })
      });
      
      if (response.ok) {
        toast.success("Practice test scorecard successfully saved!");
      }
    } catch (error) {
      console.error("Error saving result:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const nextChar = useMemo(() => {
    if (!selectedLesson || isFinished) return "";
    return selectedLesson.content[userInput.length] || "";
  }, [selectedLesson, userInput, isFinished]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-black text-2xl md:text-3xl text-foreground uppercase tracking-tight flex items-center gap-3">
              <Keyboard className="w-8 h-8 text-primary" />
              {t("Typing Master Test & Practice Engine")}
            </h1>
            <p className="text-muted-foreground mt-1 text-xs md:text-sm font-medium">
              Multi-lingual interactive typing lab with live speedometer gauge, keyboard guidance, and detailed error tracking.
            </p>
          </div>
        </div>

        <Tabs defaultValue="lessons" className="w-full">
          <TabsList className="w-full justify-start rounded-xl border border-border bg-slate-900 p-1 mb-8">
            <TabsTrigger 
              value="lessons" 
              className="rounded-lg px-6 py-2.5 font-black text-xs uppercase tracking-wider data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all"
            >
              <BookOpen className="w-4 h-4 mr-2" /> {t("Lessons & Tests")}
            </TabsTrigger>
            <TabsTrigger 
              value="analytics" 
              className="rounded-lg px-6 py-2.5 font-black text-xs uppercase tracking-wider data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all"
            >
              <BarChart3 className="w-4 h-4 mr-2" /> {t("Personal Analytics")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lessons" className="mt-0">
            {!selectedLesson ? (
              <div className="space-y-6">
                {/* Language Picker Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-4 border border-slate-800 rounded-2xl shadow-xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-5 h-5 text-blue-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Select Language ({languages.length}):</span>
                    </div>
                    <select 
                      className="bg-slate-950 border border-slate-700 px-4 py-2.5 text-xs font-bold text-white uppercase tracking-tight outline-none rounded-xl cursor-pointer min-w-[240px] focus:border-blue-500"
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                    >
                      <option value="">{t("CHOOSE TYPING LANGUAGE")}</option>
                      {filteredSelectLanguages.map(lang => (
                        <option key={lang._id} value={lang._id}>
                          {lang.name.toUpperCase()} [{lang.keyboard_layout || "QWERTY"}]
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search language..."
                      value={langSearch}
                      onChange={(e) => setLangSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Lessons Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {loading ? (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                      <span className="text-xs font-semibold">Loading Typing Practice...</span>
                    </div>
                  ) : !selectedLanguage ? (
                    <Card className="col-span-full rounded-2xl bg-slate-900 border-slate-800 border-dashed p-16 text-center text-slate-400 space-y-3">
                      <Keyboard className="w-12 h-12 text-slate-600 mx-auto" />
                      <p className="text-xs font-bold uppercase tracking-wider text-white">Select a language above to view lessons & practice tests</p>
                    </Card>
                  ) : lessons.filter(l => l.language_id === selectedLanguage).length === 0 ? (
                    <div className="col-span-full p-10 border border-slate-800 bg-slate-900 rounded-2xl text-center space-y-4">
                      <BookOpen className="w-10 h-10 text-slate-500 mx-auto" />
                      <h3 className="text-sm font-bold uppercase text-white">No custom lessons created for this language yet</h3>
                    </div>
                  ) : (
                    lessons.filter(l => l.language_id === selectedLanguage).map(lesson => (
                      <Card key={lesson._id} className="rounded-2xl bg-slate-900 border border-slate-800 shadow-lg hover:border-blue-500/40 transition-all overflow-hidden group flex flex-col justify-between p-5">
                        <div className="space-y-4">
                          <div className="flex justify-between items-start">
                            <div className="w-10 h-10 bg-blue-600/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
                              <Play className="w-5 h-5 text-blue-400 fill-blue-400/20" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-slate-800 text-slate-300">
                              {lesson.level}
                            </span>
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-white tracking-tight line-clamp-1">{lesson.title}</h3>
                            <div className="flex items-center gap-3 mt-1 text-[11px]">
                              <span className="font-bold text-amber-400 flex items-center gap-1">
                                <Zap className="w-3 h-3" /> Min {lesson.min_wpm || 30} WPM
                              </span>
                              <span className="font-bold text-emerald-400 flex items-center gap-1">
                                <Target className="w-3 h-3" /> Min {lesson.min_accuracy || 90}%
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Mode Selection Buttons */}
                        <div className="pt-4 border-t border-slate-800/60 mt-4 space-y-2">
                          <button 
                            onClick={() => startPractice(lesson, "beginning")}
                            className="w-full py-2 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 text-emerald-400 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
                          >
                            <Sparkles className="w-3.5 h-3.5" /> Start Beginning Mode (Tutorial)
                          </button>
                          <button 
                            onClick={() => startPractice(lesson, "medium")}
                            className="w-full py-2 bg-blue-950/40 hover:bg-blue-900/50 border border-blue-500/30 text-blue-400 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
                          >
                            <Gamepad2 className="w-3.5 h-3.5" /> Start Medium Mode (Standard)
                          </button>
                          <button 
                            onClick={() => startPractice(lesson, "hard")}
                            className="w-full py-2 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 text-rose-400 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" /> Start Hard Mode (Exam Mode)
                          </button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            ) : (
              /* Active Typing Test Interface */
              <div className="max-w-5xl mx-auto space-y-6">
                {/* Mode Top Bar */}
                <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                  <button 
                    onClick={() => setSelectedLesson(null)}
                    className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition"
                  >
                    <ArrowLeft className="w-4 h-4" /> Exit Test
                  </button>

                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "px-3 py-1 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 border",
                      difficultyMode === "beginning" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                      difficultyMode === "medium" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                      "bg-rose-500/10 text-rose-400 border-rose-500/30"
                    )}>
                      {difficultyMode === "beginning" && <Sparkles className="w-3.5 h-3.5" />}
                      {difficultyMode === "medium" && <Gamepad2 className="w-3.5 h-3.5" />}
                      {difficultyMode === "hard" && <ShieldAlert className="w-3.5 h-3.5" />}
                      {difficultyMode.toUpperCase()} MODE
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      Layout: <strong>{currentLanguage?.keyboard_layout || "QWERTY"}</strong>
                    </span>
                  </div>
                </div>

                <Card className="rounded-2xl border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
                  <CardContent className="p-6 md:p-8 space-y-6">
                    {/* Speedometer & Live Dashboard */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
                      {/* Speedometer Gauge */}
                      <SpeedometerGauge wpm={stats.wpm} />

                      {/* Live Metrics Cards */}
                      <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">CPM (Chars/min)</p>
                          <p className="text-xl font-black text-blue-400 font-mono mt-0.5">{stats.cpm}</p>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Accuracy</p>
                          <p className="text-xl font-black text-emerald-400 font-mono mt-0.5">{stats.accuracy}%</p>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Backspaces</p>
                          <p className="text-xl font-black text-amber-400 font-mono mt-0.5">{backspaceCount}</p>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Timer</p>
                          <p className="text-xl font-black text-white font-mono mt-0.5">{stats.time}s</p>
                        </div>
                      </div>
                    </div>

                    {/* Passage Display Box */}
                    <div 
                      className={cn(
                        "bg-slate-950 p-6 rounded-2xl border border-slate-800 font-mono text-lg leading-relaxed select-none relative max-h-48 overflow-y-auto",
                        isRtl && "text-right"
                      )}
                      dir={isRtl ? "rtl" : "ltr"}
                      style={{ fontFamily: activeFontFamily }}
                    >
                      {selectedLesson.content.split("").map((char, i) => (
                        <span 
                          key={i} 
                          className={cn(
                            "transition-colors",
                            i < userInput.length ? (userInput[i] === char ? "text-emerald-400 font-bold" : "text-rose-400 bg-rose-950/40") : 
                            i === userInput.length ? "bg-blue-500/30 border-b-2 border-blue-400 animate-pulse text-white font-bold" : "text-slate-600"
                          )}
                        >
                          {char}
                        </span>
                      ))}
                    </div>

                    {/* Typing Textarea Input */}
                    <div className="space-y-2">
                      <textarea
                        ref={inputRef}
                        autoFocus
                        disabled={isFinished}
                        value={userInput}
                        onKeyDown={handleKeyDown}
                        onChange={handleInputChange}
                        dir={isRtl ? "rtl" : "ltr"}
                        style={{ fontFamily: activeFontFamily }}
                        className={cn(
                          "w-full h-32 p-5 bg-slate-950 border-2 border-slate-800 rounded-2xl text-lg font-mono text-white focus:border-blue-500 outline-none transition-all resize-none shadow-inner",
                          isRtl && "text-right"
                        )}
                        placeholder={isRtl ? "ابدأ الكتابة هنا..." : t("Type the passage directly here...")}
                      />
                    </div>

                    {/* Virtual Keyboard (Visible in Beginning & Medium Mode) */}
                    {difficultyMode !== "hard" && (
                      <VirtualKeyboard
                        nextChar={nextChar}
                        keyboardLayout={currentLanguage?.keyboard_layout || "QWERTY"}
                        fontFamily={activeFontFamily}
                        hideKeyHints={difficultyMode === "hard"}
                      />
                    )}

                    {/* Scorecard Results Modal */}
                    {isFinished && (
                      <div className="bg-slate-950 p-6 rounded-2xl border border-blue-500/30 space-y-6 animate-in zoom-in duration-300">
                        {(() => {
                          const isPassed = (selectedLesson.min_wpm ? stats.wpm >= selectedLesson.min_wpm : true) && 
                                           (selectedLesson.min_accuracy ? stats.accuracy >= selectedLesson.min_accuracy : true);
                          return (
                            <>
                              <div className="text-center space-y-2">
                                <div className={cn(
                                  "w-16 h-16 mx-auto rounded-full flex items-center justify-center border-4",
                                  isPassed ? "bg-emerald-500/10 text-emerald-400 border-emerald-500" : "bg-rose-500/10 text-rose-400 border-rose-500"
                                )}>
                                  {isPassed ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
                                </div>
                                <h2 className="text-xl font-black uppercase text-white">{isPassed ? "TEST PASSED!" : "TEST REQUIREMENTS NOT MET"}</h2>
                                <p className="text-xs text-slate-400">
                                  {isPassed ? "Congratulations! Your performance metrics have been certified." : "Practice more to improve your speed and accuracy."}
                                </p>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">Net WPM</p>
                                  <p className="text-2xl font-black text-blue-400">{stats.wpm}</p>
                                </div>
                                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">Accuracy</p>
                                  <p className="text-2xl font-black text-emerald-400">{stats.accuracy}%</p>
                                </div>
                                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">Backspaces</p>
                                  <p className="text-2xl font-black text-amber-400">{backspaceCount}</p>
                                </div>
                                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">Mistakes</p>
                                  <p className="text-2xl font-black text-rose-400">{mistakes}</p>
                                </div>
                              </div>

                              {/* Document Action Buttons */}
                              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <button
                                  onClick={() => {
                                    setDocModalMode("scorecard");
                                    setDocModalOpen(true);
                                  }}
                                  className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2"
                                >
                                  <FileText className="w-4 h-4" /> Download Official Scorecard PDF
                                </button>
                                <button
                                  onClick={() => startPractice(selectedLesson, difficultyMode)}
                                  className="py-3 px-6 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2"
                                >
                                  <RotateCcw className="w-4 h-4" /> Retake Test
                                </button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Scorecard & Certificate Modal */}
                {selectedLesson && (
                  <TypingScorecardCertificateModal
                    isOpen={docModalOpen}
                    onClose={() => setDocModalOpen(false)}
                    mode={docModalMode}
                    stats={{
                      wpm: stats.wpm,
                      accuracy: stats.accuracy,
                      time: stats.time,
                      mistakes: mistakes,
                      totalChars: userInput.length,
                    }}
                    lessonTitle={selectedLesson.title}
                    languageName={languages.find((l) => l._id === selectedLanguage)?.name || "English"}
                  />
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="mt-0">
            <TypingAnalyticsDashboard role="student" />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default TypingPracticePage;
