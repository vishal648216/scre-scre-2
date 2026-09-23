import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BadgeCheck, Loader2, Search, UserCheck, Save, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Student {
  _id: any;
  student_name: string;
  registration_number: string;
  course?: string;
}

interface Template {
  _id: any;
  title: string;
}

const AttachmentCreateIdCardPage = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [sRes, tRes] = await Promise.all([
          apiFetch("/api/students"),
          apiFetch("/api/cms?category=idcard_template&active_only=true")
        ]);
        const sData = await sRes.json();
        const tData = await tRes.json();
        if (Array.isArray(sData)) setStudents(sData);
        if (Array.isArray(tData)) setTemplates(tData);
      } catch {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleToggleStudent = (id: string) => {
    setSelectedStudents(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleApply = async () => {
    if (selectedStudents.length === 0 || !selectedTemplate) {
      toast.error("Please select students and a template");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/api/id-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_ids: selectedStudents,
          template_id: selectedTemplate
        })
      });
      if (res.ok) {
        toast.success("Applications submitted successfully");
        setSelectedStudents([]);
      }
    } catch {
      toast.error("Failed to submit applications");
    } finally {
      setSaving(false);
    }
  };

  const toId = (id: any) => id?.$oid || id;

  const filtered = students.filter(s => 
    s.student_name.toLowerCase().includes(search.toLowerCase()) ||
    s.registration_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 flex items-center justify-center border border-primary/20 rounded-none">
              <BadgeCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-xl text-foreground uppercase tracking-tight">Apply for ID Cards</h1>
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-widest">Select students to request identity cards</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 rounded-none border-border">
            <CardHeader className="border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-black uppercase tracking-widest">Select Students ({selectedStudents.length})</CardTitle>
                <div className="relative w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input 
                    placeholder="Search..." 
                    className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-none text-xs focus:outline-none focus:border-primary"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-white border-b border-border z-10">
                      <tr className="bg-muted/30">
                        <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest">Select</th>
                        <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest">Student</th>
                        <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest">Enrollment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(s => {
                        const sid = toId(s._id);
                        const isSelected = selectedStudents.includes(sid);
                        return (
                          <tr 
                            key={sid} 
                            onClick={() => handleToggleStudent(sid)}
                            className={cn("border-b border-border/50 cursor-pointer transition-colors", isSelected ? "bg-primary/5" : "hover:bg-muted/10")}
                          >
                            <td className="py-3 px-4">
                              <div className={cn("w-4 h-4 border border-border flex items-center justify-center transition-colors", isSelected && "bg-primary border-primary")}>
                                {isSelected && <UserCheck className="w-3 h-3 text-white" />}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-bold text-xs uppercase">{s.student_name}</td>
                            <td className="py-3 px-4 text-[10px] font-mono">{s.registration_number || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-none border-border h-fit">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-sm font-black uppercase tracking-widest">Issuance Details</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Template</label>
                <select 
                  className="w-full p-3 bg-background border border-border rounded-none text-xs font-bold uppercase focus:outline-none focus:border-primary"
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                >
                  <option value="">Choose a template...</option>
                  {templates.map(t => (
                    <option key={toId(t._id)} value={toId(t._id)}>{t.title}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-border">
                <button 
                  onClick={handleApply}
                  disabled={saving || selectedStudents.length === 0 || !selectedTemplate}
                  className="w-full py-4 bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-[0.2em] rounded-none hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Submit Applications
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AttachmentCreateIdCardPage;

