import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Rnd } from "react-rnd";
import DashboardLayout from "@/components/DashboardLayout";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronDown,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Upload,
  Save,
  Trash2,
  Type,
  Image as ImageIcon,
  QrCode,
  Settings,
  RefreshCcw,
  Layout,
  Layers,
  MousePointer2,
  Maximize,
  Undo2,
  Redo2,
  Eye,
  Download,
  Copy,
  Lock,
  Unlock,
  Plus,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Palette,
  Search,
  CheckCircle2,
  CloudUpload,
  FileText,
  Shapes,
  History,
  Grid,
  Monitor
} from "lucide-react";
import { toast } from "sonner";
import { cn, normalizeAssetUrl, toId } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const FIELD_GROUPS = [
  {
    title: "Student Information",
    fields: [
      { name: "student_name", label: "Student Name", type: "text" },
      { name: "father_name", label: "Father Name", type: "text" },
      { name: "mother_name", label: "Mother Name", type: "text" },
      { name: "dob", label: "DOB", type: "text" },
      { name: "photo", label: "Photo", type: "photo" },
    ],
  },
  {
    title: "Identity",
    fields: [
      { name: "registration_number", label: "Registration No.", type: "text" },
      { name: "enrollment_number", label: "Enrollment No.", type: "text" },
      { name: "national_id", label: "National ID", type: "text" },
      { name: "serial_number", label: "Serial Number", type: "text" },
    ],
  },
  {
    title: "Course Information",
    fields: [
      { name: "course", label: "Course", type: "text" },
      { name: "course_duration", label: "Course Duration", type: "text" },
      { name: "study_center", label: "Study Center", type: "text" },
      { name: "institute", label: "Institute", type: "text" },
    ],
  },
  {
    title: "Session",
    fields: [
      { name: "session_from", label: "Session From", type: "text" },
      { name: "session_to", label: "Session To", type: "text" },
    ],
  },
  {
    title: "Exam Results",
    fields: [
      { name: "exam_date", label: "Exam Date", type: "text" },
      { name: "result_date", label: "Result Date", type: "text" },
      { name: "obtained_marks", label: "Obtained Marks", type: "text" },
      { name: "total_marks", label: "Total Marks", type: "text" },
      { name: "grade", label: "Grade", type: "text" },
      { name: "result_percentage", label: "Result Percentage", type: "text" },
      { name: "result_status", label: "Result Status", type: "text" },
      { name: "overall_status", label: "Overall Status", type: "text" },
      { name: "marks_table", label: "Marks Table", type: "marks_table" },
      { name: "summary_box", label: "Summary Box", type: "marks_table" },
    ],
  },
  {
    title: "Center Details",
    fields: [
      { name: "study_center", label: "ASC Name", type: "text" },
      { name: "center_code", label: "Center Code", type: "text" },
      { name: "asc_code", label: "ASC Code", type: "text" },
      { name: "address", label: "ASC Address", type: "text" },
    ],
  },
  {
    title: "Authority",
    fields: [
      { name: "center_signature", label: "Center Signature", type: "photo" },
      { name: "center_stamp", label: "Center Stamp", type: "photo" },
      { name: "admin_signature", label: "Admin Signature", type: "photo" },
      { name: "admin_stamp", label: "Admin Stamp", type: "photo" },
    ],
  },
  {
    title: "Metadata",
    fields: [
      { name: "issue_date", label: "Issue Date", type: "text" },
      { name: "verification_url", label: "Verification URL", type: "text" },
      { name: "qr_code", label: "QR Code", type: "qr_code" },
    ],
  },
  {
    title: "Utility",
    fields: [{ name: "custom_text", label: "Custom Text", type: "custom_text" }],
  },
];

const ALL_FIELDS = FIELD_GROUPS.flatMap((g) => g.fields);

interface TemplateField {
  _id?: string;
  field_name: string;
  field_type: string;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  font_size?: number;
  font_family?: string;
  color?: string;
  text_align?: string;
  custom_text?: string;
  table_columns?: string[];
  z_index?: number;
}

interface Template {
  _id: string;
  template_name: string;
  page_size: string;
  orientation: string;
  background_image?: string;
  logo_left?: string;
  logo_right?: string;
  authority_signature?: string;
}

function templatePageDimensionsMm(t: Template): { w: number; h: number } {
  const ps = String(t.page_size || "a4").toLowerCase();
  const o = String(t.orientation || "portrait").toLowerCase();
  const land = o === "landscape";
  if (ps === "a3") return land ? { w: 420, h: 297 } : { w: 297, h: 420 };
  if (ps === "letter") return land ? { w: 279.4, h: 215.9 } : { w: 215.9, h: 279.4 };
  return land ? { w: 297, h: 210 } : { w: 210, h: 297 };
}

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<Template | null>(null);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.85);
  const [showGrid, setShowGrid] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activeSidebarTab, setActiveSidebarTab] = useState("elements");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const [history, setHistory] = useState<TemplateField[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isSaving, setIsSaving] = useState(false);
  const [dragGuides, setDragGuides] = useState<{ x?: number, y?: number }>({});
  const [searchTerm, setSearchTerm] = useState("");

  const bgInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(() => fields.find((f) => toId(f._id) === selectedId), [fields, selectedId]);

  // Undo/Redo System
  const addToHistory = useCallback((currentFields: TemplateField[]) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(currentFields)));
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      const prevFields = history[historyIndex - 1];
      setFields(JSON.parse(JSON.stringify(prevFields)));
      setHistoryIndex(historyIndex - 1);
      toast.info("Undo");
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextFields = history[historyIndex + 1];
      setFields(JSON.parse(JSON.stringify(nextFields)));
      setHistoryIndex(historyIndex + 1);
      toast.info("Redo");
    }
  };

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [tRes, fRes] = await Promise.all([
        apiFetch("/api/templates/" + id),
        apiFetch("/api/templates/" + id + "/fields"),
      ]);
      if (tRes.ok) {
        const tData = await tRes.json();
        setTemplate(typeof tData._id !== "undefined" ? tData : null);
      }
      if (fRes.ok) {
        const fData = await fRes.json();
        const initialFields = Array.isArray(fData) ? fData : [];
        setFields(initialFields);
        setHistory([JSON.parse(JSON.stringify(initialFields))]);
        setHistoryIndex(0);
      }
    } catch {
      toast.error("Failed to load template");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const updateTemplate = async (data: Partial<Template>) => {
    if (!id) return;
    try {
      const res = await apiFetch("/api/templates/" + id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setTemplate(prev => prev ? { ...prev, ...data } : null);
        toast.success("Settings updated");
        return true;
      }
      return false;
    } catch { return false; }
  };

  const saveAllChanges = async () => {
    if (!id) return;
    setIsSaving(true);
    try {
      // Save each field sequentially or in parallel
      const promises = fields.map(f =>
        apiFetch(`/api/templates/${id}/fields/${toId(f._id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(f),
        })
      );
      await Promise.all(promises);
      toast.success("Design saved successfully");
    } catch {
      toast.error("Failed to save some changes");
    } finally {
      setIsSaving(false);
    }
  };

  const updateFieldPosition = (field: TemplateField, x: number, y: number, w: number, h: number) => {
    const fid = toId(field._id);
    const newFields = fields.map((f) => toId(f._id) === fid ? { ...f, x_position: x, y_position: y, width: w, height: h } : f);
    setFields(newFields);
    addToHistory(newFields);
  };

  const updateFieldProperty = (fid: string, props: Partial<TemplateField>) => {
    const newFields = fields.map(f => toId(f._id) === fid ? { ...f, ...props } : f);
    setFields(newFields);
    addToHistory(newFields);
  };

  const alignSelected = (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (!selected) return;
    const fid = toId(selected._id);
    let newX = selected.x_position;
    let newY = selected.y_position;

    if (alignment === 'left') newX = 5;
    if (alignment === 'center') newX = (100 - selected.width) / 2;
    if (alignment === 'right') newX = 95 - selected.width;
    if (alignment === 'top') newY = 5;
    if (alignment === 'middle') newY = (100 - selected.height) / 2;
    if (alignment === 'bottom') newY = 95 - selected.height;

    updateFieldProperty(fid, { x_position: newX, y_position: newY });
  };

  const addField = async (opt: (typeof ALL_FIELDS)[0]) => {
    if (!id) return;
    const newField: Partial<TemplateField> = {
      field_name: opt.name,
      field_type: opt.type,
      x_position: 10,
      y_position: 10,
      width: opt.type === "photo" || opt.type === "qr_code" ? 15 : 40,
      height: opt.type === "photo" || opt.type === "qr_code" ? 15 : 5,
      font_size: 14,
      font_family: "serif",
      color: "#000000",
      text_align: "left",
      custom_text: opt.name === "custom_text" ? "New Text" : undefined,
    };
    try {
      const res = await apiFetch(`/api/templates/${id}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newField),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        load();
        setSelectedId(data.id);
        toast.success("Element added");
      }
    } catch { toast.error("Failed to add field"); }
  };

  const deleteSelectedField = async () => {
    if (!id || !selected?._id) return;
    const fid = toId(selected._id);
    if (!window.confirm("Delete this element?")) return;
    try {
      const res = await apiFetch(`/api/templates/${id}/fields/${fid}`, { method: "DELETE" });
      if (res.ok) {
        setFields(prev => prev.filter(f => toId(f._id) !== fid));
        setSelectedId(null);
        toast.success("Deleted");
      }
    } catch { toast.error("Delete failed"); }
  };

  if (loading || !template) {
    return (
      <DashboardLayout>
        <div className="h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <RefreshCcw className="h-10 w-10 animate-spin text-primary opacity-20" />
            <p className="text-xs font-black uppercase tracking-widest opacity-40">Initializing Canvas...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const { w: logicalW, h: logicalH } = templatePageDimensionsMm(template);
  const baseScale = 3.5;
  const canvasW = logicalW * baseScale;
  const canvasH = logicalH * baseScale;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#1e1e1e] text-white overflow-hidden select-none">

        {/* TOP TOOLBAR - Glassmorphism style */}
        <header className="h-14 bg-[#111111]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 z-50">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                <Layout className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black uppercase tracking-widest text-white/40 leading-none mb-1">Editor</span>
                <h1 className="text-sm font-bold truncate max-w-[200px] leading-none">{template.template_name}</h1>
              </div>
            </div>

            <Separator orientation="vertical" className="h-6 bg-white/10" />

            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 hover:bg-white/10 rounded-lg"
                      onClick={undo}
                      disabled={historyIndex <= 0}
                    >
                      <Undo2 className={cn("h-4 w-4", historyIndex <= 0 ? "opacity-20" : "opacity-70")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 hover:bg-white/10 rounded-lg"
                      onClick={redo}
                      disabled={historyIndex >= history.length - 1}
                    >
                      <Redo2 className={cn("h-4 w-4", historyIndex >= history.length - 1 ? "opacity-20" : "opacity-70")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl px-2">
              <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-white/10 rounded-lg" onClick={() => setZoom(z => Math.max(0.2, z - 0.1))}><Minus className="h-3.5 w-3.5" /></Button>
              <span className="text-[11px] font-black min-w-[45px] text-center">{Math.round(zoom * 100)}%</span>
              <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-white/10 rounded-lg" onClick={() => setZoom(z => Math.min(2, z + 0.1))}><Plus className="h-3.5 w-3.5" /></Button>
            </div>

            <Button
              size="sm"
              variant="ghost"
              className={cn("h-8 gap-2 rounded-xl px-3", showGrid ? "bg-primary/20 text-primary hover:bg-primary/30" : "hover:bg-white/10")}
              onClick={() => setShowGrid(!showGrid)}
            >
              <Grid className="h-4 w-4" />
              <span className="text-[11px] font-bold uppercase tracking-tight">Grid</span>
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="h-9 gap-2 rounded-xl hover:bg-white/10" onClick={() => window.open(`/dashboard/templates/preview/${id}`, "_blank")}>
              <Eye className="h-4 w-4" />
              <span className="text-[11px] font-bold uppercase">Preview</span>
            </Button>

            <Separator orientation="vertical" className="h-6 bg-white/10" />

            <Button
              size="sm"
              className={cn(
                "h-9 gap-2 rounded-xl bg-primary hover:bg-primary/90 px-4 shadow-lg shadow-primary/20 transition-all",
                isSaving && "opacity-70 cursor-not-allowed"
              )}
              onClick={saveAllChanges}
              disabled={isSaving}
            >
              {isSaving ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="text-[11px] font-bold uppercase">{isSaving ? "Saving..." : "Save Design"}</span>
            </Button>

            <Button size="sm" variant="outline" className="h-9 gap-2 rounded-xl border-white/10 bg-transparent hover:bg-white/5 px-4" onClick={() => window.open(`/api/certificates/test-template/${id}`, "_blank")}>
              <Download className="h-4 w-4" />
              <span className="text-[11px] font-bold uppercase">Export PDF</span>
            </Button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">

          {/* LEFT SIDEBAR - Canva style */}
          <aside className={cn("bg-[#1a1a1a] border-r border-white/5 flex flex-col transition-all duration-300 z-40", sidebarCollapsed ? "w-16" : "w-[280px]")}>
            <div className="flex-1 flex flex-col min-h-0">
              <Tabs value={activeSidebarTab} onValueChange={setActiveSidebarTab} className="flex-1 flex flex-col">
                <div className="flex border-b border-white/5 overflow-x-auto no-scrollbar">
                  <TabsList className="bg-transparent h-12 w-full justify-start rounded-none px-2 gap-1">
                    {[
                      { id: "elements", icon: Shapes, label: "Elements" },
                      { id: "fields", icon: FileText, label: "Fields" },
                      { id: "uploads", icon: CloudUpload, label: "Uploads" },
                      { id: "layers", icon: Layers, label: "Layers" },
                    ].map(tab => (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className="data-[state=active]:bg-white/5 data-[state=active]:text-primary rounded-lg text-white/40 h-9 px-3 transition-all"
                      >
                        <tab.icon className="h-4 w-4 mr-2" />
                        {!sidebarCollapsed && <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="p-4">
                      <TabsContent value="elements" className="m-0 space-y-6">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between px-1">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Basic Text</h3>
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            <button
                              onClick={() => addField({ name: "custom_text", label: "Heading", type: "custom_text" })}
                              className="w-full flex flex-col gap-1 p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all text-left group"
                            >
                              <span className="text-xl font-black text-white group-hover:text-primary transition-colors">Add Heading</span>
                              <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Customizable text element</span>
                            </button>
                            <button
                              onClick={() => addField({ name: "custom_text", label: "Subheading", type: "custom_text" })}
                              className="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all text-left group"
                            >
                              <span className="text-sm font-bold text-white group-hover:text-primary">Add Subheading</span>
                            </button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Static Elements</h3>
                          <div className="grid grid-cols-2 gap-2">
                            <button className="flex flex-col items-center gap-2 p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all group">
                              <ImageIcon className="h-5 w-5 text-white/40 group-hover:text-primary" />
                              <span className="text-[10px] font-bold uppercase tracking-tight">Image</span>
                            </button>
                            <button className="flex flex-col items-center gap-2 p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all group">
                              <Shapes className="h-5 w-5 text-white/40 group-hover:text-primary" />
                              <span className="text-[10px] font-bold uppercase tracking-tight">Shape</span>
                            </button>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="fields" className="m-0 space-y-6">
                        <div className="relative mb-4">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
                          <input
                            placeholder="Search student fields..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl h-10 pl-9 pr-4 text-xs focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-white/20"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                        {FIELD_GROUPS.map(group => {
                          const filteredFields = group.fields.filter(f =>
                            f.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            f.name.toLowerCase().includes(searchTerm.toLowerCase())
                          );
                          if (filteredFields.length === 0) return null;
                          return (
                            <div key={group.title} className="space-y-2 mb-6">
                              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 px-1">{group.title}</h3>
                              <div className="grid grid-cols-1 gap-1">
                                {filteredFields.map(f => (
                                  <button
                                    key={f.name}
                                    onClick={() => addField(f)}
                                    className="group flex items-center justify-between p-2.5 bg-white/5 hover:bg-primary/20 border border-white/5 hover:border-primary/30 rounded-xl transition-all text-left"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-7 h-7 bg-white/5 rounded-lg flex items-center justify-center group-hover:bg-white/10">
                                        {f.type === "photo" ? <ImageIcon className="h-3.5 w-3.5" /> : f.type === "qr_code" ? <QrCode className="h-3.5 w-3.5" /> : <Type className="h-3.5 w-3.5" />}
                                      </div>
                                      <span className="text-[11px] font-bold text-white/70 group-hover:text-white">{f.label}</span>
                                    </div>
                                    <Plus className="h-3 w-3 text-white/20 group-hover:text-primary" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </TabsContent>

                      <TabsContent value="layers" className="m-0 space-y-2">
                        {fields.length === 0 ? (
                          <div className="py-20 text-center space-y-4 opacity-20">
                            <Layers className="h-12 w-12 mx-auto" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em]">No elements found</p>
                          </div>
                        ) : (
                          fields.slice().reverse().map((f, idx) => {
                            const fid = toId(f._id);
                            const isSelected = selectedId === fid;
                            return (
                              <div
                                key={fid}
                                onClick={() => setSelectedId(fid)}
                                className={cn(
                                  "group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                                  isSelected ? "bg-primary/20 border-primary/40 shadow-[0_4px_12px_rgba(var(--primary),0.1)]" : "bg-white/5 border-transparent hover:border-white/10"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-black text-white/20">{fields.length - idx}</span>
                                  <div className="flex items-center gap-2">
                                    <div className={cn("w-6 h-6 rounded flex items-center justify-center bg-white/5 group-hover:bg-white/10", isSelected && "bg-primary/20")}>
                                      {f.field_type === "photo" ? <ImageIcon className="h-3 w-3" /> : <Type className="h-3 w-3" />}
                                    </div>
                                    <span className={cn("text-[11px] font-bold truncate max-w-[140px]", isSelected ? "text-white" : "text-white/60")}>
                                      {f.field_name === "custom_text" ? (f.custom_text || "Custom Text") : (ALL_FIELDS.find(o => o.name === f.field_name)?.label || f.field_name)}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7 hover:bg-white/10 rounded-lg"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            // Duplicate logic
                                            const newF = { ...f, _id: undefined, x_position: f.x_position + 2, y_position: f.y_position + 2 };
                                            addField(ALL_FIELDS.find(of => of.name === f.field_name) || { name: f.field_name, label: f.field_name, type: f.field_type });
                                          }}
                                        >
                                          <Copy className="h-3.5 w-3.5 text-white/40" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Duplicate</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg" onClick={(e) => { e.stopPropagation(); deleteSelectedField(); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </TabsContent>

                      <TabsContent value="uploads" className="m-0 space-y-6">
                        <div
                          className="aspect-video bg-white/5 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 hover:bg-white/10 hover:border-primary/40 transition-all cursor-pointer"
                          onClick={() => bgInputRef.current?.click()}
                        >
                          <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                            <CloudUpload className="h-5 w-5 text-primary" />
                          </div>
                          <div className="text-center">
                            <p className="text-[11px] font-black uppercase tracking-widest mb-1">Upload Media</p>
                            <p className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">JPG, PNG, WEBP (Max 5MB)</p>
                          </div>
                        </div>
                        <input ref={bgInputRef} type="file" className="hidden" accept="image/*" />

                        <div className="space-y-4">
                          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 px-1">Your Assets</h3>
                          <div className="grid grid-cols-2 gap-2">
                            {[template.logo_left, template.logo_right, template.authority_signature, template.background_image].filter(Boolean).map((url, i) => (
                              <div key={i} className="aspect-square bg-white/5 rounded-xl border border-white/5 p-2 group relative overflow-hidden">
                                <img src={normalizeAssetUrl(url)} className="w-full h-full object-contain transition-transform group-hover:scale-110" alt="Asset" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <Button size="icon" variant="ghost" className="h-7 w-7"><Maximize className="h-3 w-3" /></Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TabsContent>
                    </div>
                  </ScrollArea>
                </div>
              </Tabs>
            </div>
          </aside>

          {/* MAIN CANVAS - Figma style */}
          <main className="flex-1 relative overflow-hidden flex flex-col">
            {/* Contextual Selection Bar (floating) */}
            {selected && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 h-12 bg-[#2a2a2a] border border-white/10 rounded-2xl shadow-2xl z-40 flex items-center px-4 gap-4 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center gap-2 pr-4 border-r border-white/5">
                  <div className="w-6 h-6 bg-primary/20 rounded flex items-center justify-center">
                    {selected.field_type === "photo" ? <ImageIcon className="h-3.5 w-3.5 text-primary" /> : <Type className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-widest">{selected.field_name === "custom_text" ? "Text" : "Student Field"}</span>
                </div>

                <div className="flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className={cn("h-8 w-8 rounded-lg hover:bg-white/5", selected.text_align === 'left' && "bg-white/10")}
                          onClick={() => alignSelected('left')}
                        >
                          <AlignLeft className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Align Left</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className={cn("h-8 w-8 rounded-lg hover:bg-white/5", selected.text_align === 'center' && "bg-white/10")}
                          onClick={() => alignSelected('center')}
                        >
                          <AlignCenter className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Align Center</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className={cn("h-8 w-8 rounded-lg hover:bg-white/5", selected.text_align === 'right' && "bg-white/10")}
                          onClick={() => alignSelected('right')}
                        >
                          <AlignRight className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Align Right</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <Separator orientation="vertical" className="h-6 bg-white/10" />

                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-white/5"><Copy className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-white/5 text-destructive hover:bg-destructive/10" onClick={deleteSelectedField}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            )}

            <div className="flex-1 relative overflow-auto bg-[#121212] p-20 flex justify-center items-start scrollbar-thin scrollbar-thumb-white/10" onMouseDown={(e) => e.target === e.currentTarget && setSelectedId(null)}>
              <div
                className="origin-top transition-transform duration-200"
                style={{ transform: `scale(${zoom})`, width: canvasW, height: canvasH }}
              >
                <div
                  ref={canvasRef}
                  className="relative bg-white shadow-[0_30px_100px_rgba(0,0,0,0.5)] overflow-hidden"
                  style={{ width: canvasW, height: canvasH }}
                >
                  {/* Background */}
                  {template.background_image && (
                    <img src={normalizeAssetUrl(template.background_image)} className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none" alt="" />
                  )}

                  {/* Grid System */}
                  {showGrid && (
                    <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                  )}

                  {/* Rulers/Margins Visualization */}
                  <div className="absolute inset-[10mm] border border-primary/5 pointer-events-none border-dashed" />

                  {/* Alignment Guides */}
                  {dragGuides.x !== undefined && (
                    <div className="absolute top-0 bottom-0 border-l border-primary/50 z-50 pointer-events-none" style={{ left: (dragGuides.x / 100) * canvasW }} />
                  )}
                  {dragGuides.y !== undefined && (
                    <div className="absolute left-0 right-0 border-t border-primary/50 z-50 pointer-events-none" style={{ top: (dragGuides.y / 100) * canvasH }} />
                  )}

                  {/* Fixed Assets */}
                  {template.logo_left && <img src={normalizeAssetUrl(template.logo_left)} className="absolute left-[8%] top-[8%] w-[12%] h-auto object-contain" alt="" />}
                  {template.logo_right && <img src={normalizeAssetUrl(template.logo_right)} className="absolute right-[8%] top-[8%] w-[12%] h-auto object-contain" alt="" />}

                  {/* Fields */}
                  {fields.map(f => (
                    <Rnd
                      key={toId(f._id)}
                      size={{ width: (f.width / 100) * canvasW, height: (f.height / 100) * canvasH }}
                      position={{ x: (f.x_position / 100) * canvasW, y: (f.y_position / 100) * canvasH }}
                      onDrag={(e, d) => {
                        const x = (d.x / canvasW) * 100;
                        const y = (d.y / canvasH) * 100;
                        const guides: { x?: number, y?: number } = {};

                        // Snap to center
                        if (Math.abs(x - (100 - f.width) / 2) < 2) guides.x = 50;
                        if (Math.abs(y - (100 - f.height) / 2) < 2) guides.y = 50;

                        // Snap to margins (approx 10mm = 4.7%)
                        if (Math.abs(x - 4.7) < 1) guides.x = 4.7;
                        if (Math.abs(x - (95.3 - f.width)) < 1) guides.x = 95.3;

                        setDragGuides(guides);
                      }}
                      onDragStop={(e, d) => {
                        let x = (d.x / canvasW) * 100;
                        let y = (d.y / canvasH) * 100;

                        // Apply snapping logic
                        if (Math.abs(x - (100 - f.width) / 2) < 2) x = (100 - f.width) / 2;
                        if (Math.abs(y - (100 - f.height) / 2) < 2) y = (100 - f.height) / 2;

                        updateFieldPosition(f, x, y, f.width, f.height);
                        setDragGuides({});
                      }}
                      onResizeStop={(e, dir, ref, delta, pos) => updateFieldPosition(f, (pos.x / canvasW) * 100, (pos.y / canvasH) * 100, (ref.offsetWidth / canvasW) * 100, (ref.offsetHeight / canvasH) * 100)}
                      bounds="parent"
                      scale={zoom}
                      className={cn(
                        "group border-2 border-transparent hover:border-primary/40",
                        selectedId === toId(f._id) && "border-primary shadow-[0_0_20px_rgba(var(--primary),0.2)] z-50"
                      )}
                      onMouseDown={() => setSelectedId(toId(f._id))}
                    >
                      <div
                        className="w-full h-full flex items-center overflow-hidden p-1 cursor-move"
                        style={{
                          fontSize: (f.font_size || 14) * (baseScale / 2.5),
                          fontFamily: f.font_family || "serif",
                          color: f.color || "#000",
                          textAlign: (f.text_align as any) || "left",
                          fontWeight: f.field_name === "student_name" ? 900 : "normal"
                        }}
                      >
                        {f.field_type === "photo" ? (
                          <div className="w-full h-full bg-muted/10 border border-dashed border-black/10 flex items-center justify-center">
                            <ImageIcon className="h-6 w-6 opacity-20" />
                          </div>
                        ) : f.field_type === "qr_code" ? (
                          <div className="w-full h-full bg-muted/10 border border-dashed border-black/10 flex items-center justify-center">
                            <QrCode className="h-6 w-6 opacity-20" />
                          </div>
                        ) : (
                          <div className="w-full truncate">
                            {f.field_name === "custom_text" ? (f.custom_text || "Custom Text") : `{{${f.field_name}}}`}
                          </div>
                        )}
                      </div>
                    </Rnd>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Status Bar */}
            <div className="h-8 bg-[#111111] border-t border-white/5 flex items-center justify-between px-4">
              <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-white/30">
                <div className="flex items-center gap-1.5"><Monitor className="h-3 w-3" /> {logicalW}mm x {logicalH}mm</div>
                <div className="flex items-center gap-1.5"><Layers className="h-3 w-3" /> {fields.length} Elements</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Live Sync Enabled</span>
              </div>
            </div>
          </main>

          {/* RIGHT SETTINGS PANEL - Figma style */}
          <aside className="w-[320px] bg-[#1a1a1a] border-l border-white/5 flex flex-col z-40">
            <div className="h-12 border-b border-white/5 flex items-center px-4">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                {selected ? "Design Properties" : "Template Settings"}
              </h2>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-5">
                {selected ? (
                  <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                    {/* General Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Layout</Label>
                        <span className="text-[10px] font-bold text-white/20">ID: {toId(selected._id).slice(-6)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[9px] font-bold uppercase text-white/40">X Position %</Label>
                          <Input
                            type="number"
                            className="bg-white/5 border-white/10 rounded-xl h-9 text-xs focus:ring-primary"
                            value={Math.round(selected.x_position)}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 0;
                              updateFieldProperty(toId(selected._id), { x_position: v });
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[9px] font-bold uppercase text-white/40">Y Position %</Label>
                          <Input
                            type="number"
                            className="bg-white/5 border-white/10 rounded-xl h-9 text-xs focus:ring-primary"
                            value={Math.round(selected.y_position)}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 0;
                              updateFieldProperty(toId(selected._id), { y_position: v });
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[9px] font-bold uppercase text-white/40">Width %</Label>
                          <Input
                            type="number"
                            className="bg-white/5 border-white/10 rounded-xl h-9 text-xs focus:ring-primary"
                            value={Math.round(selected.width)}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 1;
                              updateFieldProperty(toId(selected._id), { width: v });
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[9px] font-bold uppercase text-white/40">Height %</Label>
                          <Input
                            type="number"
                            className="bg-white/5 border-white/10 rounded-xl h-9 text-xs focus:ring-primary"
                            value={Math.round(selected.height)}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 1;
                              updateFieldProperty(toId(selected._id), { height: v });
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Typography Section */}
                    {selected.field_type !== "photo" && selected.field_type !== "qr_code" && (
                      <div className="space-y-4 pt-6 border-t border-white/5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Typography</Label>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-[9px] font-bold uppercase text-white/40">Font Family</Label>
                            <Select
                              value={selected.font_family || "serif"}
                              onValueChange={(v) => updateFieldProperty(toId(selected._id), { font_family: v })}
                            >
                              <SelectTrigger className="bg-white/5 border-white/10 rounded-xl h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="serif">Times New Roman (Serif)</SelectItem>
                                <SelectItem value="sans-serif">Arial / Inter (Sans)</SelectItem>
                                <SelectItem value="monospace">Courier New (Mono)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-[9px] font-bold uppercase text-white/40">Font Size (pt)</Label>
                              <Input
                                type="number"
                                className="bg-white/5 border-white/10 rounded-xl h-9 text-xs focus:ring-primary"
                                value={selected.font_size || 14}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value) || 14;
                                  updateFieldProperty(toId(selected._id), { font_size: v });
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[9px] font-bold uppercase text-white/40">Color</Label>
                              <div className="flex gap-2">
                                <div
                                  className="w-9 h-9 rounded-xl border border-white/10 cursor-pointer"
                                  style={{ backgroundColor: selected.color || "#000000" }}
                                  onClick={() => document.getElementById("color-picker")?.click()}
                                />
                                <input
                                  id="color-picker"
                                  type="color"
                                  className="hidden"
                                  value={selected.color || "#000000"}
                                  onChange={(e) => updateFieldProperty(toId(selected._id), { color: e.target.value })}
                                />
                                <Input
                                  type="text"
                                  className="bg-white/5 border-white/10 rounded-xl h-9 text-[10px] font-mono uppercase focus:ring-primary flex-1"
                                  value={selected.color || "#000000"}
                                  onChange={(e) => updateFieldProperty(toId(selected._id), { color: e.target.value })}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[9px] font-bold uppercase text-white/40">Alignment</Label>
                            <div className="flex bg-white/5 p-1 rounded-xl gap-1">
                              {["left", "center", "right"].map(align => (
                                <Button
                                  key={align}
                                  size="icon"
                                  variant="ghost"
                                  className={cn("h-8 flex-1 rounded-lg transition-all", selected.text_align === align ? "bg-primary text-white shadow-lg" : "hover:bg-white/5 text-white/40")}
                                  onClick={() => updateFieldProperty(toId(selected._id), { text_align: align })}
                                >
                                  {align === "left" ? <AlignLeft className="h-4 w-4" /> : align === "center" ? <AlignCenter className="h-4 w-4" /> : <AlignRight className="h-4 w-4" />}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Content Section */}
                    {selected.field_name === "custom_text" && (
                      <div className="space-y-4 pt-6 border-t border-white/5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Content</Label>
                        <div className="space-y-2">
                          <Label className="text-[9px] font-bold uppercase text-white/40">Text Value</Label>
                          <textarea
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs min-h-[120px] focus:ring-1 focus:ring-primary outline-none transition-all"
                            value={selected.custom_text || ""}
                            onChange={(e) => updateFieldProperty(toId(selected._id), { custom_text: e.target.value })}
                            placeholder="Enter text..."
                          />
                        </div>
                      </div>
                    )}

                    <div className="pt-8 flex flex-col gap-3">
                      <Button className="w-full h-11 gap-2 rounded-2xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20" onClick={async () => {
                        if (!id || !selected._id) return;
                        try {
                          const res = await apiFetch(`/api/templates/${id}/fields/${toId(selected._id)}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(selected),
                          });
                          if (res.ok) toast.success("Changes saved");
                        } catch { toast.error("Failed to save"); }
                      }}>
                        <Save className="h-4 w-4" />
                        Apply Changes
                      </Button>
                      <Button variant="ghost" className="w-full h-11 gap-2 rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={deleteSelectedField}>
                        <Trash2 className="h-4 w-4" />
                        Remove Element
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8 animate-in fade-in duration-300">
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Document Specs</Label>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-[9px] font-bold uppercase text-white/40">Page Size</Label>
                            <Select value={template.page_size} onValueChange={(v) => updateTemplate({ page_size: v })}>
                              <SelectTrigger className="bg-white/5 border-white/10 rounded-xl h-10 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="a4">A4 Standard</SelectItem>
                                <SelectItem value="a3">A3 Large</SelectItem>
                                <SelectItem value="letter">Letter</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[9px] font-bold uppercase text-white/40">Orientation</Label>
                            <div className="flex bg-white/5 p-1 rounded-xl gap-1">
                              {["portrait", "landscape"].map(o => (
                                <Button
                                  key={o}
                                  variant="ghost"
                                  className={cn("h-9 flex-1 rounded-lg text-[10px] font-black uppercase transition-all", template.orientation === o ? "bg-white/10 text-white" : "text-white/30")}
                                  onClick={() => updateTemplate({ orientation: o })}
                                >
                                  {o}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 pt-6 border-t border-white/5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Background Asset</Label>
                        <div
                          className="group relative aspect-video bg-white/5 border border-dashed border-white/10 rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-2 hover:bg-white/10 hover:border-primary/40 transition-all cursor-pointer"
                          onClick={() => bgInputRef.current?.click()}
                        >
                          {template.background_image ? (
                            <>
                              <img src={normalizeAssetUrl(template.background_image)} className="w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity" alt="" />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="bg-primary px-3 py-1.5 rounded-lg text-[10px] font-black uppercase shadow-xl">Change Image</div>
                              </div>
                            </>
                          ) : (
                            <>
                              <CloudUpload className="h-6 w-6 text-white/20 group-hover:text-primary transition-colors" />
                              <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Add Border / Pattern</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="pt-6">
                        <Button variant="outline" className="w-full h-11 gap-2 rounded-2xl border-white/10 bg-transparent hover:bg-white/5 text-white/60" onClick={() => navigate(-1)}>
                          <RefreshCcw className="h-4 w-4" />
                          Exit Designer
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
