import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Plus, Loader2, Save, Trash2, Languages, Clock, Power, PowerOff, Target, Zap, Edit2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

interface Language {
  _id: string;
  name: string;
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
}

const TypingLessonsPage = () => {
  const [loading, setLoading] = useState(true);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [form, setForm] = useState({
    language_id: "",
    title: "",
    content: "",
    level: "beginner",
    min_wpm: 30,
    min_accuracy: 90
  });

  useEffect(() => {
    fetchData();
  }, []);

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

  const fetchData = async () => {
    try {
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
          })),
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
          })),
        );
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await apiFetch("/api/typing/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      if (response.ok) {
        toast.success("Lesson added successfully");
        setIsAdding(false);
        setForm({ language_id: "", title: "", content: "", level: "beginner", min_wpm: 30, min_accuracy: 90 });
        fetchData();
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to add lesson");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLesson) return;
    setSaving(true);
    try {
      const response = await apiFetch(`/api/typing/lessons/${editingLesson._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingLesson.title,
          language_id: editingLesson.language_id,
          content: editingLesson.content,
          level: editingLesson.level,
          min_wpm: editingLesson.min_wpm,
          min_accuracy: editingLesson.min_accuracy,
        })
      });

      if (response.ok) {
        toast.success("Lesson updated successfully");
        setEditingLesson(null);
        fetchData();
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to update lesson");
      }
    } catch (error) {
      toast.error("Error updating lesson");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this lesson?")) return;
    try {
      const res = await apiFetch(`/api/typing/lessons/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Lesson deleted successfully");
        fetchData();
      } else {
        toast.error("Failed to delete lesson");
      }
    } catch {
      toast.error("Failed to delete lesson");
    }
  };

  const toggleStatus = async (id: string) => {
    try {
      const res = await apiFetch(`/api/typing/lessons/${id}`, { method: "PATCH" });
      if (res.ok) {
        toast.success("Status updated");
        fetchData();
      } else {
        toast.error("Failed to update status");
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  const filteredLessons = lessons.filter((lesson) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const langName = languages.find((l) => l._id === lesson.language_id)?.name || "";
    return lesson.title.toLowerCase().includes(q) || langName.toLowerCase().includes(q) || lesson.content.toLowerCase().includes(q);
  });

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Typing Lessons</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Create, edit, and manage lessons for student typing practice.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search lessons or language..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background border border-border pl-9 pr-3 py-2 text-xs font-bold outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={() => setIsAdding(!isAdding)}
              className={cn(
                "px-6 py-3 rounded-none font-heading font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center gap-2 shrink-0",
                isAdding ? "bg-muted text-foreground" : "bg-primary text-primary-foreground shadow-lg hover:opacity-90"
              )}
            >
              {isAdding ? "Cancel" : <><Plus className="w-4 h-4" /> New Lesson</>}
            </button>
          </div>
        </div>

        {isAdding && (
          <Card className="rounded-none border-primary shadow-xl overflow-hidden animate-in slide-in-from-top-4 duration-500">
            <CardHeader className="bg-primary/5 border-b border-primary/10">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-primary">
                <BookOpen className="w-4 h-4" />
                Lesson Composer
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest">Language</label>
                    <select 
                      required 
                      className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none appearance-none"
                      value={form.language_id}
                      onChange={(e) => setForm({...form, language_id: e.target.value})}
                    >
                      <option value="">SELECT LANGUAGE</option>
                      {languages.map(lang => (
                        <option key={lang._id} value={lang._id}>{lang.name.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest">Lesson Title</label>
                    <input 
                      required 
                      placeholder="e.g. Home Row Practice, Number Keys" 
                      className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none" 
                      value={form.title}
                      onChange={(e) => setForm({...form, title: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest">Difficulty Level</label>
                    <select 
                      required 
                      className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none appearance-none"
                      value={form.level}
                      onChange={(e) => setForm({...form, level: e.target.value})}
                    >
                      <option value="beginner">BEGINNER</option>
                      <option value="intermediate">INTERMEDIATE</option>
                      <option value="advanced">ADVANCED</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <Zap className="w-3 h-3" /> Min Speed (WPM)
                    </label>
                    <input 
                      type="number" 
                      placeholder="e.g. 30" 
                      className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none" 
                      value={form.min_wpm}
                      onChange={(e) => setForm({...form, min_wpm: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                      <Target className="w-3 h-3" /> Min Accuracy (%)
                    </label>
                    <input 
                      type="number" 
                      placeholder="e.g. 90" 
                      className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none" 
                      value={form.min_accuracy}
                      onChange={(e) => setForm({...form, min_accuracy: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest">Lesson Content</label>
                  <textarea 
                    required 
                    rows={6}
                    placeholder="Enter the text students will type..." 
                    className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none resize-none" 
                    value={form.content}
                    onChange={(e) => setForm({...form, content: e.target.value})}
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-primary text-primary-foreground px-10 py-4 rounded-none font-heading font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all flex items-center gap-3 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Lesson
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : filteredLessons.length === 0 ? (
            <div className="col-span-full py-20 border border-border border-dashed text-center opacity-60">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">No lessons found matching criteria</p>
            </div>
          ) : (
            filteredLessons.map(lesson => (
              <Card key={lesson._id} className="rounded-none border-border shadow-md hover:border-primary/40 transition-all overflow-hidden group">
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-12 bg-primary/5 flex items-center justify-center border border-primary/10">
                      <BookOpen className="w-6 h-6 text-primary" />
                    </div>
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-widest px-2 py-1 border",
                      lesson.level === "beginner" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : 
                      lesson.level === "intermediate" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : 
                      "bg-destructive/10 text-destructive border-destructive/20"
                    )}>
                      {lesson.level}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-foreground truncate">{lesson.title}</h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mt-1">
                      <Languages className="w-3 h-3" />
                      {languages.find(l => l._id === lesson.language_id)?.name || "Unknown Language"}
                    </p>
                  </div>
                  <div className="bg-muted/30 p-4 border border-border/50">
                    <p className="text-[10px] text-muted-foreground font-medium italic line-clamp-3">
                      "{lesson.content}"
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground">
                    {lesson.min_wpm && (
                      <span className="flex items-center gap-1 text-primary"><Zap className="w-3 h-3" /> {lesson.min_wpm} WPM</span>
                    )}
                    {lesson.min_accuracy && (
                      <span className="flex items-center gap-1 text-emerald-600"><Target className="w-3 h-3" /> {lesson.min_accuracy}%</span>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={() => toggleStatus(lesson._id)}
                      className={cn(
                        "flex-1 px-3 py-2 border text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5",
                        lesson.active ? "border-emerald-500/20 text-emerald-600 hover:bg-emerald-50" : "border-red-500/20 text-red-600 hover:bg-red-50"
                      )}
                    >
                      {lesson.active ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                      {lesson.active ? "Active" : "Disabled"}
                    </button>
                    <button 
                      onClick={() => setEditingLesson(lesson)}
                      className="px-3 py-2 border border-border text-foreground hover:border-primary hover:text-primary transition-all flex items-center justify-center"
                      title="Edit Lesson"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(lesson._id)}
                      className="px-3 py-2 border border-border text-destructive hover:bg-destructive hover:text-white transition-all flex items-center justify-center"
                      title="Delete Lesson"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Edit Lesson Modal */}
        {editingLesson && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="max-w-2xl w-full rounded-none border-primary shadow-2xl animate-in zoom-in-95 duration-200">
              <CardHeader className="bg-primary text-primary-foreground flex flex-row items-center justify-between py-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <Edit2 className="w-4 h-4" /> Edit Lesson
                </CardTitle>
                <button
                  type="button"
                  onClick={() => setEditingLesson(null)}
                  className="text-xs font-bold uppercase tracking-widest opacity-80 hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleUpdate} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest">Language</label>
                      <select 
                        required 
                        className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none appearance-none"
                        value={editingLesson.language_id}
                        onChange={(e) => setEditingLesson({...editingLesson, language_id: e.target.value})}
                      >
                        <option value="">SELECT LANGUAGE</option>
                        {languages.map(lang => (
                          <option key={lang._id} value={lang._id}>{lang.name.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest">Lesson Title</label>
                      <input 
                        required 
                        className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none" 
                        value={editingLesson.title}
                        onChange={(e) => setEditingLesson({...editingLesson, title: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest">Difficulty Level</label>
                      <select 
                        required 
                        className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none appearance-none"
                        value={editingLesson.level}
                        onChange={(e) => setEditingLesson({...editingLesson, level: e.target.value})}
                      >
                        <option value="beginner">BEGINNER</option>
                        <option value="intermediate">INTERMEDIATE</option>
                        <option value="advanced">ADVANCED</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <Zap className="w-3 h-3" /> Min Speed (WPM)
                      </label>
                      <input 
                        type="number" 
                        className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none" 
                        value={editingLesson.min_wpm || 0}
                        onChange={(e) => setEditingLesson({...editingLesson, min_wpm: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                        <Target className="w-3 h-3" /> Min Accuracy (%)
                      </label>
                      <input 
                        type="number" 
                        className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none" 
                        value={editingLesson.min_accuracy || 0}
                        onChange={(e) => setEditingLesson({...editingLesson, min_accuracy: parseInt(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest">Lesson Content</label>
                    <textarea 
                      required 
                      rows={6}
                      className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none resize-none" 
                      value={editingLesson.content}
                      onChange={(e) => setEditingLesson({...editingLesson, content: e.target.value})}
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingLesson(null)}
                      className="px-6 py-3 border border-border text-xs font-black uppercase tracking-widest"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="bg-primary text-primary-foreground px-8 py-3 rounded-none font-heading font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Update Lesson
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TypingLessonsPage;
