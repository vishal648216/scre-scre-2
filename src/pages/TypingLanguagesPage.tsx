import React, { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Languages, 
  Plus, 
  Loader2, 
  Save, 
  Trash2, 
  Globe, 
  Sparkles, 
  Search, 
  Keyboard, 
  CheckCircle2, 
  RefreshCw 
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

interface Language {
  _id: string;
  name: string;
  code: string;
  font_family?: string;
  keyboard_layout?: string;
  active: boolean;
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

const INDIAN_CODES = ["hi", "hi-kd", "pa", "pa-asees", "mr", "gu", "bn", "ta", "te", "kn", "ml", "or", "as", "sa", "ks", "sd", "kok", "mni", "ne", "ur"];
const EUROPEAN_CODES = ["en", "es", "fr", "de", "it", "pt", "ru", "nl", "pl", "sv", "no", "da", "fi", "el", "cs", "hu", "ro", "uk", "bg", "sk", "hr", "sr", "sl", "lt", "lv", "et", "ga", "is", "sq", "mt", "mk", "bs", "be", "eu", "ca", "gl", "eo", "la", "cy", "lb"];
const ASIAN_PACIFIC_CODES = ["zh-hans", "zh-hant", "ja", "ko", "vi", "th", "id", "ms", "fil", "my", "km", "lo", "mn", "kk", "uz", "az", "ka", "hy", "si", "bo", "jv", "su", "tg", "tk", "ky", "tt", "ceb", "haw", "mi", "sm", "fj", "to"];
const MIDEAST_AFRICA_CODES = ["ar", "fa", "he", "tr", "ps", "ku", "ug", "sw", "am", "yo", "ig", "ha", "zu", "xh", "af", "so", "om", "ti", "sn", "rw", "mg"];
const AMERICAS_CODES = ["en", "es", "pt", "fr", "ht", "qu", "gn"];

type RegionFilter = "all" | "european" | "asian_pacific" | "mideast_africa" | "americas" | "indian";

const TypingLanguagesPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<RegionFilter>("all");

  const [form, setForm] = useState({
    name: "",
    code: "",
    font_family: "",
    keyboard_layout: "QWERTY"
  });

  useEffect(() => {
    fetchLanguages();
  }, []);

  const fetchLanguages = async () => {
    try {
      setLoading(true);
      const response = await apiFetch("/api/typing/languages");
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setLanguages(data.map((l: any) => ({
          ...l,
          _id: normalizeId(l._id ?? l.id),
        })));
      }
    } catch (error) {
      console.error("Error fetching languages:", error);
      toast.error("Failed to load typing languages");
    } finally {
      setLoading(false);
    }
  };

  const handleSeedAllLanguages = async () => {
    setSeeding(true);
    try {
      const response = await apiFetch("/api/typing/languages/seed-default", {
        method: "POST"
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast.success(data.message || "All World & Indian Languages successfully populated!");
        await fetchLanguages();
      } else {
        toast.error(data.message || "Failed to populate languages");
      }
    } catch (err: any) {
      toast.error("Network error while seeding languages");
    } finally {
      setSeeding(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      const response = await apiFetch(`/api/typing/languages/${id}`, {
        method: "DELETE"
      });
      if (response.ok) {
        toast.success(`${name} removed successfully`);
        setLanguages(prev => prev.filter(l => l._id !== id));
      } else {
        toast.error("Failed to delete language");
      }
    } catch (err) {
      toast.error("Error deleting language");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await apiFetch("/api/typing/languages", {
        method: "POST",
        body: JSON.stringify(form)
      });

      if (response.ok) {
        toast.success("Language added successfully");
        setIsAdding(false);
        setForm({ name: "", code: "", font_family: "", keyboard_layout: "QWERTY" });
        fetchLanguages();
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to add language");
      }
    } catch (error) {
      toast.error("An error occurred while saving language");
    } finally {
      setSaving(false);
    }
  };

  const filteredLanguages = useMemo(() => {
    return languages.filter(lang => {
      const matchesSearch = 
        lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lang.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lang.keyboard_layout && lang.keyboard_layout.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      const codeLower = lang.code.toLowerCase();
      if (categoryFilter === "indian") return INDIAN_CODES.includes(codeLower);
      if (categoryFilter === "european") return EUROPEAN_CODES.includes(codeLower);
      if (categoryFilter === "asian_pacific") return ASIAN_PACIFIC_CODES.includes(codeLower);
      if (categoryFilter === "mideast_africa") return MIDEAST_AFRICA_CODES.includes(codeLower);
      if (categoryFilter === "americas") return AMERICAS_CODES.includes(codeLower);
      return true;
    });
  }, [languages, searchQuery, categoryFilter]);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div>
            <h1 className="font-heading font-black text-2xl md:text-3xl text-white uppercase tracking-tight flex items-center gap-3">
              <Globe className="w-7 h-7 text-blue-400" />
              Typing Languages ({languages.length})
            </h1>
            <p className="text-slate-400 mt-1 text-xs md:text-sm font-medium">
              Global multi-lingual typing engine supporting Indian regional scripts and international layouts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSeedAllLanguages}
              disabled={seeding}
              className="px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition flex items-center gap-2"
              title="Auto populate all world & Indian typing languages"
            >
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {seeding ? "Populating..." : "⚡ Populate All World Languages"}
            </button>

            <button
              onClick={() => setIsAdding(!isAdding)}
              className={cn(
                "px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg",
                isAdding ? "bg-slate-800 text-white" : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20"
              )}
            >
              {isAdding ? "Cancel" : <><Plus className="w-4 h-4" /> Add Custom Language</>}
            </button>
          </div>
        </div>

        {/* Add Language Card */}
        {isAdding && (
          <Card className="rounded-2xl border-blue-500/30 bg-slate-900 shadow-2xl overflow-hidden animate-in slide-in-from-top-4 duration-300">
            <CardHeader className="bg-blue-600/10 border-b border-blue-500/20 py-4">
              <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-blue-400">
                <Globe className="w-4 h-4" />
                Configure New Custom Language
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Language Name</label>
                  <input 
                    required 
                    placeholder="e.g. Sanskrit, Sinhala, Hebrew" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-medium focus:border-blue-500 outline-none" 
                    value={form.name}
                    onChange={(e) => setForm({...form, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Language Code (ISO)</label>
                  <input 
                    required 
                    placeholder="e.g. sa, si, he" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-medium focus:border-blue-500 outline-none" 
                    value={form.code}
                    onChange={(e) => setForm({...form, code: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Font Family (Optional)</label>
                  <input 
                    placeholder="e.g. 'Noto Sans', 'Mangal', sans-serif" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-medium focus:border-blue-500 outline-none" 
                    value={form.font_family}
                    onChange={(e) => setForm({...form, font_family: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Keyboard Layout</label>
                  <select 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-medium focus:border-blue-500 outline-none"
                    value={form.keyboard_layout}
                    onChange={(e) => setForm({...form, keyboard_layout: e.target.value})}
                  >
                    <option value="QWERTY">QWERTY</option>
                    <option value="Inscript">Inscript (Standard)</option>
                    <option value="Remington">Remington (Kruti Dev)</option>
                    <option value="Phonetic">Phonetic</option>
                    <option value="AZERTY">AZERTY (French)</option>
                    <option value="QWERTZ">QWERTZ (German)</option>
                    <option value="Arabic 101">Arabic 101</option>
                    <option value="JCUKEN Cyrillic">JCUKEN Cyrillic</option>
                    <option value="Pinyin">Pinyin (Chinese)</option>
                    <option value="Romaji / Kana">Romaji / Kana (Japanese)</option>
                    <option value="2-Set Hangul">2-Set Hangul (Korean)</option>
                  </select>
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-wider shadow-xl shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Language
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Filter and Search Bar */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <button
              onClick={() => setCategoryFilter("all")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition",
                categoryFilter === "all" ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "bg-slate-800 text-slate-300 hover:text-white"
              )}
            >
              All ({languages.length})
            </button>
            <button
              onClick={() => setCategoryFilter("european")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition",
                categoryFilter === "european" ? "bg-cyan-600 text-white shadow-md shadow-cyan-500/20" : "bg-slate-800 text-slate-300 hover:text-white"
              )}
            >
              European ({languages.filter(l => EUROPEAN_CODES.includes(l.code.toLowerCase())).length})
            </button>
            <button
              onClick={() => setCategoryFilter("asian_pacific")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition",
                categoryFilter === "asian_pacific" ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20" : "bg-slate-800 text-slate-300 hover:text-white"
              )}
            >
              Asian & Pacific ({languages.filter(l => ASIAN_PACIFIC_CODES.includes(l.code.toLowerCase())).length})
            </button>
            <button
              onClick={() => setCategoryFilter("mideast_africa")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition",
                categoryFilter === "mideast_africa" ? "bg-purple-600 text-white shadow-md shadow-purple-500/20" : "bg-slate-800 text-slate-300 hover:text-white"
              )}
            >
              Middle East & Africa ({languages.filter(l => MIDEAST_AFRICA_CODES.includes(l.code.toLowerCase())).length})
            </button>
            <button
              onClick={() => setCategoryFilter("americas")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition",
                categoryFilter === "americas" ? "bg-rose-600 text-white shadow-md shadow-rose-500/20" : "bg-slate-800 text-slate-300 hover:text-white"
              )}
            >
              Americas ({languages.filter(l => AMERICAS_CODES.includes(l.code.toLowerCase())).length})
            </button>
            <button
              onClick={() => setCategoryFilter("indian")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition",
                categoryFilter === "indian" ? "bg-amber-600 text-white shadow-md shadow-amber-500/20" : "bg-slate-800 text-slate-300 hover:text-white"
              )}
            >
              Indian Subcontinent ({languages.filter(l => INDIAN_CODES.includes(l.code.toLowerCase())).length})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search language or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Languages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            <div className="col-span-full py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="text-xs font-semibold">Loading Typing Languages...</span>
            </div>
          ) : filteredLanguages.length === 0 ? (
            <div className="col-span-full py-16 bg-slate-900 border border-slate-800 border-dashed rounded-2xl text-center p-8 space-y-4">
              <Languages className="w-12 h-12 text-slate-600 mx-auto" />
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Languages Found</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Click the button below to automatically populate all 25+ global and Indian typing languages with pre-built lessons!
                </p>
              </div>
              <button
                onClick={handleSeedAllLanguages}
                disabled={seeding}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition"
              >
                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Populate All Languages Now
              </button>
            </div>
          ) : (
            filteredLanguages.map(lang => {
              const isIndian = INDIAN_CODES.includes(lang.code.toLowerCase());
              return (
                <Card 
                  key={lang._id} 
                  className="rounded-2xl bg-slate-900 border border-slate-800 shadow-lg hover:border-blue-500/40 transition-all overflow-hidden group hover:shadow-xl hover:shadow-blue-500/5"
                >
                  <CardContent className="p-5 flex items-start justify-between">
                    <div className="flex items-start gap-3.5">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm shadow-md flex-shrink-0",
                        isIndian 
                          ? "bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-amber-500/20" 
                          : "bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-blue-500/20"
                      )}>
                        {lang.code.toUpperCase()}
                      </div>
                      <div className="space-y-1 min-w-0">
                        <h3 className="text-sm font-bold text-white tracking-tight truncate" title={lang.name}>
                          {lang.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                            <Keyboard className="w-3 h-3 text-blue-400" />
                            {lang.keyboard_layout || "QWERTY"}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Active
                          </span>
                        </div>
                        {lang.font_family && (
                          <p className="text-[10px] text-slate-500 truncate pt-0.5 font-mono" title={lang.font_family}>
                            Font: {lang.font_family}
                          </p>
                        )}
                      </div>
                    </div>

                    <button 
                      onClick={() => handleDelete(lang._id, lang.name)}
                      className="p-1.5 rounded-lg border border-slate-700 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 hover:border-rose-500/30 transition opacity-60 group-hover:opacity-100 flex-shrink-0 ml-2"
                      title="Delete Language"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TypingLanguagesPage;
