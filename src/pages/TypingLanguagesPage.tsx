import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Languages, Plus, Loader2, Save, Trash2, Globe } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Language {
  _id: string;
  name: string;
  code: string;
  font_family?: string;
  keyboard_layout?: string;
  active: boolean;
}

const TypingLanguagesPage = () => {
  const [loading, setLoading] = useState(true);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);

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
      const token = sessionStorage.getItem("token");
      const response = await fetch("/api/typing/languages", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setLanguages(data);
      }
    } catch (error) {
      console.error("Error fetching languages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = sessionStorage.getItem("token");
      const response = await fetch("/api/typing/languages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      if (response.ok) {
        toast.success("Language added successfully");
        setIsAdding(false);
        setForm({ name: "", code: "" });
        fetchLanguages();
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to add language");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Typing Languages</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Manage available languages for typing lessons.</p>
          </div>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className={cn(
              "px-6 py-3 rounded-none font-heading font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center gap-2",
              isAdding ? "bg-muted text-foreground" : "bg-primary text-primary-foreground shadow-lg hover:opacity-90"
            )}
          >
            {isAdding ? "Cancel" : <><Plus className="w-4 h-4" /> Add Language</>}
          </button>
        </div>

        {isAdding && (
          <Card className="rounded-none border-primary shadow-xl overflow-hidden animate-in slide-in-from-top-4 duration-500">
            <CardHeader className="bg-primary/5 border-b border-primary/10">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-primary">
                <Globe className="w-4 h-4" />
                New Language Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest">Language Name</label>
                  <input 
                    required 
                    placeholder="e.g. English, Hindi, Marathi" 
                    className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none" 
                    value={form.name}
                    onChange={(e) => setForm({...form, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest">Language Code</label>
                  <input 
                    required 
                    placeholder="e.g. en, hi, mr" 
                    className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none" 
                    value={form.code}
                    onChange={(e) => setForm({...form, code: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest">Font Family (Optional)</label>
                  <input 
                    placeholder="e.g. 'Kruti Dev 010', 'Mangal', sans-serif" 
                    className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none" 
                    value={form.font_family}
                    onChange={(e) => setForm({...form, font_family: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest">Keyboard Layout</label>
                  <select 
                    className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none"
                    value={form.keyboard_layout}
                    onChange={(e) => setForm({...form, keyboard_layout: e.target.value})}
                  >
                    <option value="QWERTY">QWERTY</option>
                    <option value="Remington">Remington (Kruti Dev)</option>
                    <option value="Inscript">Inscript</option>
                    <option value="Phonetic">Phonetic</option>
                  </select>
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-primary text-primary-foreground px-8 py-3 rounded-none font-heading font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all flex items-center gap-3 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Language
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loading ? (
            <div className="col-span-full py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : languages.length === 0 ? (
            <div className="col-span-full py-20 border border-border border-dashed text-center opacity-60">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">No languages added yet</p>
            </div>
          ) : (
            languages.map(lang => (
              <Card key={lang._id} className="rounded-none border-border shadow-md hover:border-primary/40 transition-all overflow-hidden group">
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/5 flex items-center justify-center border border-primary/10">
                      <Languages className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-tight text-foreground">{lang.name}</h3>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{lang.code}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 border border-border text-destructive hover:bg-destructive hover:text-white transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TypingLanguagesPage;
