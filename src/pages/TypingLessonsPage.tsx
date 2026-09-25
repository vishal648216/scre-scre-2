import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BookOpen, 
  Plus, 
  Loader2, 
  Save, 
  Trash2, 
  Languages, 
  Power, 
  PowerOff, 
  Target, 
  Zap,
  Sparkles,
  Eye,
  Edit3,
  X,
  AlertTriangle,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

interface Language {
  _id: string;
  name: string;
  code: string;
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
  active: boolean;
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

const TypingLessonsPage = () => {
  const [loading, setLoading] = useState(true);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [viewingLesson, setViewingLesson] = useState<Lesson | null>(null);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLangFilter, setSelectedLangFilter] = useState<string>("all");

  const [form, setForm] = useState({
    language_id: "",
    title: "",
    content: "",
    level: "beginner",
    min_wpm: 30,
    min_accuracy: 90,
    duration_minutes: 5,
    active: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [langRes, lessonRes] = await Promise.all([
        apiFetch("/api/typing/languages"),
        apiFetch("/api/typing/lessons")
      ]);
      
      if (langRes.ok) {
        const raw = await langRes.json();
        const list = Array.isArray(raw) ? raw : [];
        setLanguages(
          list.map((l: any) => ({
            ...l,
            _id: normalizeId(l._id ?? l.id),
          }))
        );
      }
      if (lessonRes.ok) {
        const raw = await lessonRes.json();
        const list = Array.isArray(raw) ? raw : [];
        setLessons(
          list.map((lesson: any) => ({
            ...lesson,
            _id: normalizeId(lesson._id ?? lesson.id),
            language_id: normalizeId(lesson.language_id),
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching typing lesson data:", error);
      toast.error("Failed to load lesson data");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoTranslate = async () => {
    if (!form.content.trim()) {
      toast.error("Please enter English text in the content box first!");
      return;
    }
    if (!form.language_id) {
      toast.error("Please select a target language first!");
      return;
    }

    const selectedLang = languages.find(l => l._id === form.language_id);
    if (!selectedLang) {
      toast.error("Invalid language selection");
      return;
    }

    if (selectedLang.code.toLowerCase() === "en") {
      toast.info("Target language is English. No translation needed.");
      return;
    }

    setTranslating(true);
    try {
      let translatedText = "";
      
      // 1. Try backend translation endpoint
      try {
        const res = await apiFetch("/api/translate", {
          method: "POST",
          body: JSON.stringify({
            text: form.content,
            target: selectedLang.code
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.translated && data.translated !== form.content) {
            translatedText = data.translated;
          }
        }
      } catch (e) {
        console.warn("Backend translate route fallback:", e);
      }

      // 2. Direct client fallback via Google Translate Free Web API
      if (!translatedText) {
        try {
          const clientRes = await fetch(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(selectedLang.code)}&dt=t&q=${encodeURIComponent(form.content)}`
          );
          if (clientRes.ok) {
            const json = await clientRes.json();
            if (Array.isArray(json) && Array.isArray(json[0])) {
              translatedText = json[0].map((item: any) => item[0]).join("");
            }
          }
        } catch (clientErr) {
          console.error("Client translation error:", clientErr);
        }
      }

      if (translatedText) {
        setForm(prev => ({ ...prev, content: translatedText }));
        toast.success(`Successfully translated lesson text to ${selectedLang.name}!`);
      } else {
        toast.warning(`Could not auto-translate to ${selectedLang.name}. Please enter native text manually.`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to translate content. Please check connection.");
    } finally {
      setTranslating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const isEdit = Boolean(editingLesson);
      const url = isEdit ? `/api/typing/lessons/${editingLesson?._id}` : "/api/typing/lessons";
      const method = isEdit ? "PUT" : "POST";

      const response = await apiFetch(url, {
        method,
        body: JSON.stringify(form)
      });

      if (response.ok) {
        toast.success(isEdit ? "Lesson updated successfully" : "Lesson added successfully");
        setIsAdding(false);
        setEditingLesson(null);
        setForm({ 
          language_id: "", 
          title: "", 
          content: "", 
          level: "beginner", 
          min_wpm: 30, 
          min_accuracy: 90, 
          duration_minutes: 5,
          active: true 
        });
        fetchData();
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to save lesson");
      }
    } catch (error) {
      toast.error("An error occurred while saving");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setForm({
      language_id: lesson.language_id,
      title: lesson.title,
      content: lesson.content,
      level: lesson.level || "beginner",
      min_wpm: lesson.min_wpm || 30,
      min_accuracy: lesson.min_accuracy || 90,
      duration_minutes: lesson.duration_minutes || 5,
      active: lesson.active
    });
    setIsAdding(true);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete lesson "${title}"?`)) return;
    try {
      const res = await apiFetch(`/api/typing/lessons/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Lesson deleted successfully");
        fetchData();
      } else {
        toast.error("Failed to delete lesson");
      }
    } catch {
      toast.error("Error deleting lesson");
    }
  };

  const toggleStatus = async (id: string, currentActive: boolean) => {
    try {
      const res = await apiFetch(`/api/typing/lessons/${id}`, { 
        method: "PATCH",
        body: JSON.stringify({ active: !currentActive })
      });
      if (res.ok) {
        toast.success(currentActive ? "Lesson Disabled" : "Lesson Activated");
        fetchData();
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  const filteredLessons = useMemo(() => {
    return lessons.filter(l => {
      const matchesSearch = 
        l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.content.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesLang = selectedLangFilter === "all" || l.language_id === selectedLangFilter;
      return matchesSearch && matchesLang;
    });
  }, [lessons, searchQuery, selectedLangFilter]);

  // Check if content might be in English while language is non-English script
  const isLanguageScriptMismatch = useMemo(() => {
    if (!form.language_id || !form.content) return false;
    const lang = languages.find(l => l._id === form.language_id);
    if (!lang || lang.code.toLowerCase() === "en") return false;
    
    // Simple heuristic: If language is Hindi/Marathi/Gujarati/etc and string is mostly ASCII letters
    const asciiChars = form.content.replace(/[^a-zA-Z]/g, "").length;
    return asciiChars / Math.max(1, form.content.length) > 0.6;
  }, [form.language_id, form.content, languages]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div>
            <h1 className="font-heading font-black text-2xl md:text-3xl text-white uppercase tracking-tight flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-blue-400" />
              Typing Lessons Management ({lessons.length})
            </h1>
            <p className="text-slate-400 mt-1 text-xs md:text-sm font-medium">
              Create, translate, and configure multi-lingual typing lessons for students across all centers.
            </p>
          </div>

          <button
            onClick={() => {
              if (isAdding) {
                setIsAdding(false);
                setEditingLesson(null);
              } else {
                setEditingLesson(null);
                setForm({
                  language_id: languages[0]?._id || "",
                  title: "",
                  content: "",
                  level: "beginner",
                  min_wpm: 30,
                  min_accuracy: 90,
                  duration_minutes: 5,
                  active: true
                });
                setIsAdding(true);
              }
            }}
            className={cn(
              "px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg",
              isAdding ? "bg-slate-800 text-white" : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25 active:scale-95"
            )}
          >
            {isAdding ? "Cancel Form" : <><Plus className="w-4 h-4" /> Add New Lesson</>}
          </button>
        </div>

        {/* Lesson Composer Modal (Portal attached to document.body) */}
        {isAdding && createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-hidden">
            <Card className="rounded-2xl border-blue-500/30 bg-slate-900 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col w-full max-w-3xl animate-in zoom-in-95 duration-200">
              <CardHeader className="bg-blue-600/10 border-b border-blue-500/20 py-4 flex flex-row items-center justify-between flex-shrink-0">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-blue-400">
                  <BookOpen className="w-4 h-4" />
                  {editingLesson ? "Edit Typing Lesson" : "Multi-Lingual Lesson Composer"}
                </CardTitle>
                <button 
                  onClick={() => { setIsAdding(false); setEditingLesson(null); }}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </CardHeader>

              <CardContent className="p-6 overflow-y-auto">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Target Language Picker */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <Languages className="w-3.5 h-3.5 text-blue-400" />
                        Target Language & Script *
                      </label>
                      <select 
                        required 
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-semibold focus:border-blue-500 outline-none"
                        value={form.language_id}
                        onChange={(e) => setForm({...form, language_id: e.target.value})}
                      >
                        <option value="">-- SELECT TARGET LANGUAGE --</option>
                        {languages.map(lang => (
                          <option key={lang._id} value={lang._id}>
                            {lang.name} ({lang.code.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Lesson Title */}
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Lesson Title *
                      </label>
                      <input 
                        required 
                        placeholder="e.g. Primary Keys Practice, Home Row Master, Paragraph Speed Test" 
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-medium focus:border-blue-500 outline-none" 
                        value={form.title}
                        onChange={(e) => setForm({...form, title: e.target.value})}
                      />
                    </div>

                    {/* Difficulty Level */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Difficulty Level
                      </label>
                      <select 
                        required 
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold focus:border-blue-500 outline-none"
                        value={form.level}
                        onChange={(e) => setForm({...form, level: e.target.value})}
                      >
                        <option value="beginner">BEGINNER (With Guidance)</option>
                        <option value="intermediate">INTERMEDIATE (Standard)</option>
                        <option value="advanced">ADVANCED (Strict / Exam Mode)</option>
                      </select>
                    </div>

                    {/* Min Speed WPM */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5" /> Min Speed (WPM)
                      </label>
                      <input 
                        type="number" 
                        min={5}
                        max={150}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold focus:border-blue-500 outline-none" 
                        value={form.min_wpm}
                        onChange={(e) => setForm({...form, min_wpm: parseInt(e.target.value) || 0})}
                      />
                    </div>

                    {/* Min Accuracy */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                        <Target className="w-3.5 h-3.5" /> Min Accuracy (%)
                      </label>
                      <input 
                        type="number" 
                        min={50}
                        max={100}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold focus:border-blue-500 outline-none" 
                        value={form.min_accuracy}
                        onChange={(e) => setForm({...form, min_accuracy: parseInt(e.target.value) || 0})}
                      />
                    </div>
                  </div>

                    {/* Lesson Content Box + Auto-Translate Toolbar */}
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-blue-400" />
                          Lesson Content (Native Script Text) *
                        </label>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Type text in English or native script. Click <strong>✨ Auto-Translate</strong> to automatically convert English text to target language script.
                        </p>
                      </div>

                      {/* Auto Translate Button */}
                      <button
                        type="button"
                        onClick={handleAutoTranslate}
                        disabled={translating || !form.content.trim() || !form.language_id}
                        className="px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-500/20 active:scale-95 transition flex items-center gap-2 disabled:opacity-40 flex-shrink-0"
                      >
                        {translating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                        {translating ? "Translating..." : `✨ Auto-Translate to ${languages.find(l => l._id === form.language_id)?.name || "Target"}`}
                      </button>
                    </div>

                    {/* Script Mismatch Warning */}
                    {isLanguageScriptMismatch && (
                      <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 flex items-center justify-between gap-3 text-amber-300 text-xs font-medium">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          <span>The target language is non-English script, but content is typed in Latin text.</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleAutoTranslate}
                          disabled={translating}
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-bold text-[11px] whitespace-nowrap"
                        >
                          Convert Now
                        </button>
                      </div>
                    )}

                    <textarea 
                      required 
                      rows={5}
                      placeholder="Enter or paste text students will type in this session..." 
                      className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-medium focus:border-blue-500 outline-none resize-y" 
                      value={form.content}
                      onChange={(e) => setForm({...form, content: e.target.value})}
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => { setIsAdding(false); setEditingLesson(null); }}
                      className="px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider border border-slate-700 text-slate-300 hover:bg-slate-800 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {editingLesson ? "Update Lesson" : "Save Lesson"}
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>,
          document.body
        )}

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Filter Language:</span>
            <select
              value={selectedLangFilter}
              onChange={(e) => setSelectedLangFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-white text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:border-blue-500 w-full sm:w-60"
            >
              <option value="all">ALL LANGUAGES ({lessons.length})</option>
              {languages.map(lang => (
                <option key={lang._id} value={lang._id}>
                  {lang.name} ({lessons.filter(l => l.language_id === lang._id).length})
                </option>
              ))}
            </select>
          </div>

          <input
            type="text"
            placeholder="Search lessons by title or text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-72 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Lessons Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="text-xs font-semibold">Loading Typing Lessons...</span>
            </div>
          ) : filteredLessons.length === 0 ? (
            <div className="col-span-full py-16 bg-slate-900 border border-slate-800 border-dashed rounded-2xl text-center p-8 space-y-3">
              <BookOpen className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Lessons Found</h3>
              <p className="text-xs text-slate-400">Create a new lesson above to get started.</p>
            </div>
          ) : (
            filteredLessons.map(lesson => {
              const lang = languages.find(l => l._id === lesson.language_id);
              return (
                <Card key={lesson._id} className="rounded-2xl bg-slate-900 border border-slate-800 shadow-lg hover:border-blue-500/40 transition-all overflow-hidden group flex flex-col justify-between">
                  <div className="p-5 space-y-4">
                    {/* Header Level & Language Tag */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5">
                        <Languages className="w-3 h-3" />
                        {lang?.name || "Unknown Language"}
                      </span>
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border",
                        lesson.level === "beginner" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
                        lesson.level === "intermediate" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : 
                        "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      )}>
                        {lesson.level || "beginner"}
                      </span>
                    </div>

                    {/* Title & Speed Target */}
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight line-clamp-1" title={lesson.title}>
                        {lesson.title}
                      </h3>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 font-medium">
                        <span className="flex items-center gap-1 text-amber-400">
                          <Zap className="w-3 h-3" /> Min {lesson.min_wpm || 30} WPM
                        </span>
                        <span className="flex items-center gap-1 text-emerald-400">
                          <Target className="w-3 h-3" /> Min {lesson.min_accuracy || 90}% Acc
                        </span>
                      </div>
                    </div>

                    {/* Lesson Snippet */}
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
                      <p className="text-xs text-slate-300 font-medium italic line-clamp-3 leading-relaxed font-sans">
                        "{lesson.content}"
                      </p>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="px-5 pb-5 pt-0 flex items-center gap-2 border-t border-slate-800/50 pt-4">
                    <button 
                      onClick={() => setViewingLesson(lesson)}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5"
                      title="View Full Lesson"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-400" /> View
                    </button>

                    <button 
                      onClick={() => startEdit(lesson)}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5"
                      title="Edit Lesson"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-400" /> Edit
                    </button>

                    <button 
                      onClick={() => toggleStatus(lesson._id, lesson.active)}
                      className={cn(
                        "flex-1 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border",
                        lesson.active ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/30 hover:bg-emerald-900/50" : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                      )}
                    >
                      {lesson.active ? <Power className="w-3.5 h-3.5 text-emerald-400" /> : <PowerOff className="w-3.5 h-3.5" />}
                      {lesson.active ? "Active" : "Disabled"}
                    </button>

                    <button 
                      onClick={() => handleDelete(lesson._id, lesson.title)}
                      className="p-2 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-400 hover:bg-rose-900/60 transition"
                      title="Delete Lesson"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* View Lesson Details Modal (Portal attached to document.body) */}
        {viewingLesson && createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-hidden">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl p-6 animate-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between border-b border-slate-800 pb-4 flex-shrink-0">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {languages.find(l => l._id === viewingLesson.language_id)?.name || "Language"}
                  </span>
                  <h2 className="text-xl font-black text-white mt-2">{viewingLesson.title}</h2>
                </div>
                <button 
                  onClick={() => setViewingLesson(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto space-y-6 my-4 pr-1">
                <div className="grid grid-cols-3 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Level</p>
                    <p className="text-xs font-black text-white capitalize mt-0.5">{viewingLesson.level}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Target Speed</p>
                    <p className="text-xs font-black text-amber-400 mt-0.5">{viewingLesson.min_wpm || 30} WPM</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Target Accuracy</p>
                    <p className="text-xs font-black text-emerald-400 mt-0.5">{viewingLesson.min_accuracy || 90}%</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lesson Content Preview:</label>
                  <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 max-h-56 overflow-y-auto text-sm text-white leading-relaxed font-sans">
                    {viewingLesson.content}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-800 flex-shrink-0">
                <button
                  onClick={() => setViewingLesson(null)}
                  className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider"
                >
                  Close Details
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

export default TypingLessonsPage;
