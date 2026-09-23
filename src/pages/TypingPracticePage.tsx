import { useState, useEffect, useRef, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Keyboard, Play, RefreshCw, Loader2, Languages, Clock, Zap, CheckCircle2, AlertTriangle, 
  BookOpen, Target, History, Award, RotateCcw, Pause, ChevronRight, XCircle, Trophy, BarChart3, Users,
  FileText, Printer, Globe, Sparkles, Search
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TypingAnalyticsDashboard from "@/components/TypingAnalyticsDashboard";
import TypingLeaderboard from "@/components/TypingLeaderboard";
import { TypingScorecardCertificateModal } from "@/components/TypingScorecardCertificateModal";
import VirtualKeyboard from "@/components/VirtualKeyboard";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";

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
}

const defaultSampleTexts: Record<string, string> = {
  hi: "सफलता का कोई शार्टकट नहीं होता। नियमित अभ्यास और एकाग्रता से ही गति और सटीकता प्राप्त की जा सकती है।",
  "hi-kruti": "vH;kl gh lQyrk dh dqath gSA fu;fer vH;kl ls vki viuh xfr c<+k ldrs gSaA",
  mr: "प्रयत्नांती परमेश्वर. सततच्या सरावाने टायपिंगचा वेग आणि अचूकता निश्चितपणे सुधारते.",
  pa: "ਮਿਹਨਤ ਸਫਲਤਾ ਦੀ ਕੁੰਜੀ ਹੈ। ਰੋਜ਼ਾਨਾ ਅਭਿਆਸ ਨਾਲ ਤੁਹਾਡੀ ਟਾਈਪਿੰਗ ਗਤੀ ਅਤੇ ਸ਼ੁੱਧਤਾ ਵਧੇਗੀ।",
  "pa-asees": "imhnq sPlqw dI kuMjI hY. rozwnw AiBAws nwl quhwfI twieipMg xqI vDyxI.",
  gu: "સતત અભ્યાસથી સફળતા મળે છે. નિયમિત ટાઈપિંગ તમારી ઝડપ અને ચોકસાઈ વધારે છે.",
  bn: "পরিশ্রম সৌভাগ্যের প্রসূতি। নিয়মিত অনুশীলনের মাধ্যমে টাইপিং গতি বৃদ্ধি পায়।",
  ta: "முயற்சியே வெற்றிக்கு வழிவகுக்கும். தொடர் பயிற்சி உங்கள் தட்டச்சு திறனை மேம்படுத்தும்.",
  te: "నిరంతర సాధనతో నైపుణ్యం పెరుగుతుంది. క్రమం తప్పకుండా టైపింగ్ చేయడం వేగాన్ని పెంచుతుంది.",
  ur: "محنت کامیابی کی کنجی ہے۔ روزانہ کی مشق سے رفتار اور درستگی بہتر ہوتی ہے۔",
  ar: "العمل الجاد هو مفتاح النجاح. التدريب المستمر يحسن سرعة الطباعة والدقة في لوحة المفاتيح.",
  fa: "تمرین مداوم کلید موفقیت است. تمرین روزانه سرعت و دقت تایپ شما را افزایش می‌دهد.",
  fr: "La pratique régulière est la clé du succès. Entraînez-vous chaque jour pour perfectionner votre vitesse et votre précision de frappe.",
  de: "Übung macht den Meister. Regelmäßiges Tippen verbessert Ihre Schreibgeschwindigkeit und Genauigkeit maßgeblich.",
  es: "La práctica constante es la clave del éxito. Escribir a diario mejora la velocidad y la precisión en el teclado.",
  ru: "Постоянная практика — залог успеха. Ежедневные упражнения развивают скорость печати и точность ввода текста.",
  zh: "坚持练习是成功的关键。每天进行打字练习能显著提升您的输入速度与准确率。",
  ja: "継続は力なり。毎日のタイピング練習が入力速度と正確性を劇的に向上させます。",
  ko: "꾸준한 연습이 성공의 열쇠입니다. 매일 타자 연습을 하면 속도와 정확도가 크게 향상됩니다.",
  pt: "A prática diária é o segredo do sucesso. Digitar com regularidade aperfeiçoa a sua agilidade e precisão.",
  it: "La pratica costante è la chiave del successo. Esercitarsi ogni giorno migliora la velocità di battitura.",
  tr: "Düzenli pratik başarının anahtarıdır. Günlük yazma egzersizleri klavye hızınızı ve doğruluğunuzu artırır.",
  vi: "Luyện tập thường xuyên là chìa khóa của thành công. Đánh máy mỗi ngày giúp tăng tốc độ và độ chính xác.",
  th: "การฝึกฝนอย่างสม่ำเสมอคือกุญแจสู่ความสำเร็จ การพิมพ์ทุกวันช่วยเพิ่มความเร็วและความแม่นยำ",
  en: "The quick brown fox jumps over the lazy dog. Continuous typing practice improves hand-eye coordination and boosts professional efficiency."
};

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
  
  // Level & Exam Rules
  const [examLevel, setExamLevel] = useState<"easy" | "medium" | "hard">("easy");
  const [timerLimitSec, setTimerLimitSec] = useState<number>(0); // 0 = unlimited
  const [soundAlert, setSoundAlert] = useState(true);
  const [hasErrorShake, setHasErrorShake] = useState(false);

  // Scorecard / Certificate Modal
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docModalMode, setDocModalMode] = useState<"scorecard" | "certificate">("scorecard");
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const autoStartedRef = useRef(false);

  const playBeepSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {
      // Audio context fallbacks
    }
  };

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
    fetchLanguages();
    
    // Anti-cheat: Disable context menu
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  // Handle URL search params on load
  useEffect(() => {
    if (languages.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const urlLangId = params.get("langId");
    const urlLessonId = params.get("lessonId");

    if (urlLangId && languages.some((l) => l._id === urlLangId)) {
      setSelectedLanguage(urlLangId);
    } else if (!selectedLanguage && languages.length > 0) {
      setSelectedLanguage(languages[0]._id);
    }
  }, [languages]);

  useEffect(() => {
    if (selectedLanguage) {
      fetchLessons(selectedLanguage);
    } else {
      setLessons([]);
      setSelectedLesson(null);
    }
  }, [selectedLanguage]);

  // If URL has lessonId, auto-start that lesson when lessons load (only once)
  useEffect(() => {
    if (autoStartedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const urlLessonId = params.get("lessonId");
    if (urlLessonId && lessons.length > 0) {
      const match = lessons.find((l) => l._id === urlLessonId);
      if (match) {
        autoStartedRef.current = true;
        startPractice(match);
      }
    }
  }, [lessons]);

  // Live Timer Ticker for WPM, Accuracy, and Time
  useEffect(() => {
    let interval: any;
    if (startTime && !isFinished && !endTime && selectedLesson) {
      interval = setInterval(() => {
        const elapsedSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
        
        // Auto finish if countdown timer limit reached
        if (timerLimitSec > 0 && elapsedSec >= timerLimitSec) {
          finishPractice(userInput);
          clearInterval(interval);
          return;
        }

        const timeTakenMin = elapsedSec / 60;
        const totalChars = userInput.length;
        const liveWpm = Math.round((totalChars / 5) / (timeTakenMin || 1/60));

        let correctChars = 0;
        const origContent = selectedLesson.content || "";
        for (let i = 0; i < userInput.length; i++) {
          if (userInput[i] === origContent[i]) correctChars++;
        }
        const liveAccuracy = totalChars > 0 ? Math.round((correctChars / totalChars) * 100) : 100;

        setStats({
          wpm: liveWpm,
          accuracy: liveAccuracy,
          time: timerLimitSec > 0 ? Math.max(0, timerLimitSec - elapsedSec) : elapsedSec,
        });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [startTime, isFinished, endTime, userInput, selectedLesson, timerLimitSec]);

  const fetchLanguages = async () => {
    try {
      const response = await apiFetch("/api/typing/languages");
      if (response.ok) {
        const raw = await response.json();
        const list = Array.isArray(raw) ? raw : [];
        setLanguages(list.map((l: any) => ({
          ...l,
          _id: normalizeId(l._id ?? l.id),
        })));
      }
    } catch (error) {
      console.error("Error fetching languages:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLessons = async (langId: string) => {
    try {
      const response = await apiFetch(`/api/typing/lessons?language_id=${langId}&active=true`);
      if (response.ok) {
        const raw = await response.json();
        const list = Array.isArray(raw) ? raw : [];
        setLessons(list.map((lesson: any) => ({
          ...lesson,
          _id: normalizeId(lesson._id ?? lesson.id),
          language_id: normalizeId(lesson.language_id),
        })));
      }
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
    setStats({ wpm: 0, accuracy: 0, time: timerLimitSec || 0 });
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const startDefaultPassagePractice = () => {
    if (!currentLanguage) return;
    const baseCode = (currentLanguage.code || "en").toLowerCase();
    const sample = defaultSampleTexts[baseCode] || 
                   defaultSampleTexts[baseCode.split("-")[0]] ||
                   `Welcome to ${currentLanguage.name} typing practice. Regular practice will quickly build muscle memory, speed, and accuracy using the ${currentLanguage.keyboard_layout || "standard"} keyboard layout.`;
    const quickLesson: Lesson = {
      _id: `quick-${currentLanguage._id || currentLanguage.code}`,
      language_id: currentLanguage._id,
      title: `${currentLanguage.name} Practice Passage`,
      content: sample,
      level: "beginner",
      min_wpm: 25,
      min_accuracy: 85,
    };
    startPractice(quickLesson);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isFinished || !selectedLesson) return;
    
    const val = e.target.value;
    
    // Hard level or strict mode backspace check: don't allow backspacing
    if (examLevel === "hard" && val.length < userInput.length) {
      toast.error("Backspace is disabled in Hard Exam Mode!", { duration: 1500 });
      return;
    }
    
    // Prevent pasting using event inputType so multi-byte scripts & IMEs work flawlessly
    const nativeEvent = e.nativeEvent as (InputEvent & { inputType?: string }) | undefined;
    if (nativeEvent?.inputType === "insertFromPaste") {
      toast.error("Pasting is not allowed! Please type directly.");
      return;
    }

    if (!startTime) setStartTime(Date.now());
    
    // Calculate mistakes if characters added
    if (val.length > userInput.length) {
      const added = val.slice(userInput.length);
      const targetSlice = selectedLesson.content.slice(userInput.length, val.length);
      if (added !== targetSlice) {
        setMistakes(prev => prev + 1);
        if (soundAlert) playBeepSound();
        setHasErrorShake(true);
        setTimeout(() => setHasErrorShake(false), 300);
      }
    }

    setUserInput(val);

    if (val.length >= selectedLesson.content.length) {
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
    const accuracy = totalChars > 0 ? Math.round((correctChars / totalChars) * 100) : 100;

    setStats({
      wpm,
      accuracy,
      time: durationSec
    });
    
    // Pass startTime! and end directly to avoid React stale closure issues
    submitResult(finalInput, wpm, accuracy, durationSec, correctChars, totalChars - correctChars, startTime!, end);
  };

  const submitResult = async (finalInput: string, wpm: number, accuracy: number, duration: number, correct: number, incorrect: number, startMs: number, endMs: number) => {
    setSubmitting(true);
    try {
      const response = await apiFetch("/api/typing/results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lesson_id: selectedLesson?._id?.startsWith("quick-") ? null : selectedLesson?._id,
          mode,
          start_time: new Date(startMs).toISOString(),
          end_time: new Date(endMs).toISOString(),
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
                <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-3 border border-border shadow-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-5 h-5 text-primary" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Language ({languages.length}):</span>
                    </div>
                    <select 
                      className="bg-muted/40 border border-border px-3 py-2 text-xs font-bold uppercase tracking-tight outline-none cursor-pointer min-w-[240px] max-w-sm focus:border-primary"
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                    >
                      <option value="">{t("CHOOSE LANGUAGE")}</option>
                      {filteredSelectLanguages.map(lang => (
                        <option key={lang._id} value={lang._id}>
                          {lang.name.toUpperCase()} {lang.keyboard_layout ? `— [${lang.keyboard_layout}]` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search world language..."
                      value={langSearch}
                      onChange={(e) => setLangSearch(e.target.value)}
                      className="w-full bg-muted/40 border border-border pl-9 pr-3 py-1.5 text-xs outline-none focus:border-primary"
                    />
                  </div>
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
                    <div className="col-span-full p-8 border border-primary/20 bg-primary/5 text-center space-y-4">
                      <Sparkles className="w-10 h-10 text-primary mx-auto animate-pulse" />
                      <div>
                        <h3 className="text-base font-black uppercase text-foreground">{currentLanguage?.name} Instant Typing Practice</h3>
                        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                          Ready to practice in {currentLanguage?.name} ({currentLanguage?.keyboard_layout || "Standard"} layout). Start immediately with our curated sample passage.
                        </p>
                      </div>
                      <button
                        onClick={startDefaultPassagePractice}
                        className="px-6 py-3 bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest hover:opacity-90 inline-flex items-center gap-2 shadow-lg transition-all"
                      >
                        <Play className="w-4 h-4" /> Start {currentLanguage?.name} Practice Now
                      </button>
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
                  <div className="bg-primary p-4 text-primary-foreground flex flex-wrap justify-between items-center gap-3">
                    <div className="flex items-center gap-3">
                      <BookOpen className="w-5 h-5" />
                      <div>
                        <h2 className="text-sm font-black uppercase tracking-widest">{t(selectedLesson.title)}</h2>
                        <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider">
                          Language: {currentLanguage?.name || "Standard"} • Layout: {currentLanguage?.keyboard_layout || "QWERTY"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      {/* Level Badges */}
                      <div className="flex items-center bg-black/20 p-1 border border-white/20 text-[9px] font-black uppercase">
                        <button
                          onClick={() => setExamLevel("easy")}
                          className={cn("px-2 py-0.5 transition-all", examLevel === "easy" ? "bg-white text-primary font-extrabold" : "opacity-70 hover:opacity-100")}
                        >
                          Easy
                        </button>
                        <button
                          onClick={() => setExamLevel("medium")}
                          className={cn("px-2 py-0.5 transition-all", examLevel === "medium" ? "bg-amber-400 text-black font-extrabold" : "opacity-70 hover:opacity-100")}
                        >
                          Medium
                        </button>
                        <button
                          onClick={() => setExamLevel("hard")}
                          className={cn("px-2 py-0.5 transition-all", examLevel === "hard" ? "bg-destructive text-white font-extrabold" : "opacity-70 hover:opacity-100")}
                        >
                          Hard
                        </button>
                      </div>

                      {/* Timer Limit Selector */}
                      <select
                        value={timerLimitSec}
                        onChange={(e) => setTimerLimitSec(Number(e.target.value))}
                        className="bg-black/30 text-white border border-white/20 text-[10px] font-black px-2 py-1 outline-none uppercase"
                      >
                        <option value={0} className="bg-slate-900 text-white">No Time Limit</option>
                        <option value={60} className="bg-slate-900 text-white">1 Min Test</option>
                        <option value={120} className="bg-slate-900 text-white">2 Min Test</option>
                        <option value={300} className="bg-slate-900 text-white">5 Min Test</option>
                        <option value={600} className="bg-slate-900 text-white">10 Min Test</option>
                      </select>

                      {/* Sound Toggle */}
                      <button
                        onClick={() => setSoundAlert(!soundAlert)}
                        className="text-[10px] font-black uppercase tracking-wider bg-black/20 px-2 py-1 border border-white/20 hover:bg-black/40 flex items-center gap-1"
                      >
                        {soundAlert ? "🔊 Sound On" : "🔇 Sound Off"}
                      </button>

                      <div className="flex items-center gap-2 border-l border-white/20 pl-3">
                        <Clock className="w-4 h-4 opacity-70" />
                        <span className="text-lg font-black font-mono">{stats.time}s</span>
                      </div>
                      <button onClick={() => setSelectedLesson(null)} className="opacity-70 hover:opacity-100"><XCircle className="w-5 h-5" /></button>
                    </div>
                  </div>
                  
                  <CardContent className="p-8 space-y-8">
                    {/* Live Stats Meter */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pb-6 border-b border-border/50">
                      <div className="text-center">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("Live Speed")}</p>
                        <p className="text-xl font-black text-primary">{Math.round(stats.wpm)} <span className="text-[8px]">{t("WPM")}</span></p>
                      </div>
                      <div className="text-center border-l border-border/50">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("Accuracy")}</p>
                        <p className="text-xl font-black text-emerald-600">{Math.round(stats.accuracy)} <span className="text-[8px]">%</span></p>
                      </div>
                      <div className="text-center border-l border-border/50">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("Mistakes")}</p>
                        <p className={cn("text-xl font-black transition-colors", mistakes > 0 ? "text-destructive" : "text-emerald-600")}>{mistakes}</p>
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
                      className={cn(
                        "bg-muted/30 p-8 border font-mono text-xl leading-relaxed select-none relative transition-all duration-150",
                        hasErrorShake ? "border-destructive bg-destructive/5 ring-2 ring-destructive/40" : "border-border/50",
                        isRtl && "text-right"
                      )}
                      dir={isRtl ? "rtl" : "ltr"}
                      style={{ fontFamily: activeFontFamily }}
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
                            i < userInput.length ? (userInput[i] === char ? "text-primary font-bold" : "text-destructive bg-destructive/20 font-black underline decoration-destructive") : 
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
                      dir={isRtl ? "rtl" : "ltr"}
                      style={{ fontFamily: activeFontFamily }}
                      className={cn(
                        "w-full h-32 p-6 bg-card border-2 rounded-none text-xl font-mono focus:border-primary outline-none transition-all resize-none shadow-inner",
                        hasErrorShake ? "border-destructive ring-2 ring-destructive/40" : "border-border",
                        isRtl && "text-right"
                      )}
                      placeholder={isRtl ? "ابدأ الكتابة هنا..." : t("Start typing the text above...")}
                    />

                    {/* Interactive Virtual Keyboard with Live Target Key Highlight */}
                    {!isFinished && (
                      <VirtualKeyboard
                        nextChar={selectedLesson.content[userInput.length]}
                        keyboardLayout={currentLanguage?.keyboard_layout || "QWERTY"}
                        fontFamily={activeFontFamily}
                        hideKeyHints={examLevel === "hard"}
                        onKeyPress={(char) => {
                          if (isFinished || !selectedLesson) return;
                          const fakeEvent = {
                            target: { value: userInput + char },
                            nativeEvent: { inputType: "insertText" }
                          } as any;
                          handleInputChange(fakeEvent);
                        }}
                      />
                    )}

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
    
                              {/* Scorecard & Certificate Action Buttons */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                <button
                                  onClick={() => {
                                    setDocModalMode("scorecard");
                                    setDocModalOpen(true);
                                  }}
                                  className="py-3 px-4 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                                >
                                  <FileText className="w-4 h-4" />
                                  <span>Download Scorecard PDF</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setDocModalMode("certificate");
                                    setDocModalOpen(true);
                                  }}
                                  className="py-3 px-4 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/30 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                                >
                                  <Award className="w-4 h-4" />
                                  <span>Official Certificate</span>
                                </button>
                              </div>

                              <div className="flex flex-col md:flex-row gap-4 pt-2">
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

          <TabsContent value="leaderboard" className="mt-0">
            <TypingLeaderboard />
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
