import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import DashboardLayout, { useDashboardSidebar } from "@/components/DashboardLayout";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Type,
  Palette,
  ArrowLeft,
  Save,
  RefreshCcw,
  Bold,
  Italic,
  Underline,
  Trash2,
  Maximize2,
  Minimize2,
  Sparkles,
  Award,
  BadgeCheck,
  FileText,
  ShieldCheck,
  Image as ImageIcon,
} from "lucide-react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import { apiFetch, parseJsonArrayResponse } from "@/lib/api";
import { toast } from "sonner";
import { Rnd } from "react-rnd";
import { toId } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const A4_PORTRAIT_WIDTH = 816; // 8.5in * 96dpi
const A4_PORTRAIT_HEIGHT = 1056; // 11in * 96dpi

interface TemplateField {
  _id?: string;
  field_name: string;
  field_type: string;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  font_size: number;
  font_family: string;
  color: string;
  text_align: string;
  custom_text?: string;
  table_columns?: string[];
}

interface Category {
  id: string;
  _id?: string;
  name: string;
}

interface Course {
  id: string;
  _id?: string;
  category_id: string;
  course_name: string;
}

interface Template {
  _id: string;
  template_name: string;
  template_type: string;
  page_size: string;
  orientation: string;
  background_image?: string;
  admin_signature?: string;
  admin_stamp?: string;
  course_category_id?: string;
  course_id?: string;
  default_design?: boolean;
}

const AVAILABLE_PLACEHOLDERS = [
  { key: "admission_mode", label: "Admission Mode" },
  { key: "admin_sign", label: "Admin Signature" },
  { key: "admin_stamp", label: "Admin Stamp" },
  { key: "center_address", label: "Center Address" },
  { key: "center_code", label: "Center Code" },
  { key: "center_name", label: "Center Name" },
  { key: "center_sign", label: "Center Signature" },
  { key: "center_stamp", label: "Center Stamp" },
  { key: "course_name", label: "Course Name" },
  { key: "dob", label: "Date of Birth" },
  { key: "duration", label: "Duration" },
  { key: "exam_date", label: "Exam Date" },
  { key: "exam_mode", label: "Exam Mode" },
  { key: "student_father", label: "Father's Name" },
  { key: "student_gender", label: "Gender" },
  { key: "grade", label: "Grade" },
  { key: "issue_date", label: "Issue Date" },
  { key: "student_enrollment", label: "Enrollment No." },
  { key: "student_mother", label: "Mother's Name" },
  { key: "national_id", label: "National ID" },
  { key: "overall_status", label: "Overall Status" },
  { key: "qr_code", label: "QR Code" },
  { key: "result_date", label: "Result Date" },
  { key: "result_percentage", label: "Result Percentage" },
  { key: "result_table", label: "Result Table" },
  { key: "serial_num", label: "Serial Number" },
  { key: "session", label: "Session" },
  { key: "student_name", label: "Student Name" },
];

const FRAME_THEMES = [
  { id: "gold", name: "ISO Gold Honor Border", color: "#b45309", type: "certificate" },
  { id: "blue", name: "Academic Blue Double Border", color: "#1d4ed8", type: "marksheet" },
  { id: "idbadge", name: "CR80 ID Badge Frame", color: "#0284c7", type: "id_card" },
  { id: "letterhead", name: "Official Letterhead Header", color: "#0f172a", type: "letter" },
  { id: "rose", name: "Franchise License Emblem", color: "#be123c", type: "certificate" },
];

const CertificateDesignerCanvasContent: React.FC<{ id: string | undefined }> = ({ id }) => {
  const navigate = useNavigate();
  const { isSidebarHidden, setSidebarState } = useDashboardSidebar();
  const [template, setTemplate] = useState<Template | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [selectedFrameTheme, setSelectedFrameTheme] = useState<string>("gold");
  const [adminSignature, setAdminSignature] = useState<string | null>(null);
  const [adminStamp, setAdminStamp] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredPlaceholders = AVAILABLE_PLACEHOLDERS.filter((ph) => {
    const lowerSearch = searchTerm.toLowerCase();
    return (
      ph.label.toLowerCase().includes(lowerSearch) ||
      ph.key.toLowerCase().includes(lowerSearch)
    );
  }).sort((a, b) => a.label.localeCompare(b.label));

  const filteredCourses = useMemo(() => {
    if (!selectedCategory) return [];
    return courses.filter(course => course.category_id === selectedCategory);
  }, [courses, selectedCategory]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await apiFetch("/api/public/categories");
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.items || []);
        setCategories(
          items.map((c: any) => ({
            id: c._id || c.id,
            _id: c._id || c.id,
            name: c.name
          }))
        );
      }
    } catch {
      // ignore
    }
  }, []);

  const loadCourses = useCallback(async () => {
    try {
      const res = await apiFetch("/api/public/courses");
      if (res.ok) {
        const data = await parseJsonArrayResponse(res);
        setCourses(
          data.map((c: any) => ({
            id: c._id || c.id,
            _id: c._id || c.id,
            category_id: c.category_id,
            course_name: c.course_name
          }))
        );
      }
    } catch {
      // ignore
    }
  }, []);

  const isLandscape = template?.orientation === "landscape";
  const canvasWidth = isLandscape ? A4_PORTRAIT_HEIGHT : A4_PORTRAIT_WIDTH;
  const canvasHeight = isLandscape ? A4_PORTRAIT_WIDTH : A4_PORTRAIT_HEIGHT;

  const percentToPixels = (percent: number, isWidth: boolean) => {
    const dimension = isWidth ? canvasWidth : canvasHeight;
    return (percent / 100) * dimension;
  };

  const pixelsToPercent = (pixels: number, isWidth: boolean) => {
    const dimension = isWidth ? canvasWidth : canvasHeight;
    return (pixels / dimension) * 100;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [templateRes, fieldsRes] = await Promise.all([
        apiFetch(`/api/templates/${id}`),
        apiFetch(`/api/templates/${id}/fields`),
      ]);

      if (templateRes.ok) {
        const data = await templateRes.json();
        setTemplate(data);
        if (data.background_image) setBackgroundImage(data.background_image);
        if (data.admin_signature) setAdminSignature(data.admin_signature);
        if (data.admin_stamp) setAdminStamp(data.admin_stamp);
        if (data.course_category_id) setSelectedCategory(data.course_category_id);
        else setSelectedCategory(null);
        if (data.course_id) setSelectedCourse(data.course_id);
        else setSelectedCourse(null);

        // Auto select frame theme based on type
        if (data.template_type === "marksheet") setSelectedFrameTheme("blue");
        else if (data.template_type === "id_card") setSelectedFrameTheme("idbadge");
        else if (data.template_type === "letter") setSelectedFrameTheme("letterhead");
        else setSelectedFrameTheme("gold");
      }

      if (fieldsRes.ok) {
        const data = await fieldsRes.json();
        setFields(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Failed to load template:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
    loadCourses();
    loadData();
  }, [id, loadCategories, loadCourses]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (template?._id) {
        const body: any = {
          template_name: template.template_name,
          background_image: backgroundImage,
          admin_signature: adminSignature,
          admin_stamp: adminStamp,
        };
        if (selectedCategory) {
          body.course_category_id = selectedCategory;
        } else {
          body.course_category_id = null;
        }
        if (selectedCourse) {
          body.course_id = selectedCourse;
        } else {
          body.course_id = null;
        }
        await apiFetch(`/api/templates/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      const promises = fields.map((field) => {
        const fieldId = toId(field._id);
        if (fieldId) {
          return apiFetch(`/api/templates/${id}/fields/${fieldId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(field),
          });
        }
        return Promise.resolve();
      });

      await Promise.all(promises);
      toast.success("Certificate design saved!");
    } catch (error) {
      console.error("Failed to save:", error);
      toast.error("Failed to save design");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setBackgroundImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addField = async (placeholderKey: string, placeholderLabel: string) => {
    try {
      let fieldType = "text";
      let width = 30;
      let height = 5;

      if (placeholderKey === "qr_code" || placeholderKey === "center_stamp" || placeholderKey === "admin_stamp") {
        fieldType = placeholderKey;
        width = 15;
        height = 15;
      } else if (placeholderKey === "center_sign" || placeholderKey === "admin_sign") {
        fieldType = placeholderKey;
        width = 20;
        height = 5;
      } else if (placeholderKey === "result_table") {
        fieldType = placeholderKey;
        width = 50;
        height = 30;
      }

      const newField = {
        field_name: placeholderKey,
        field_type: fieldType,
        x_position: 10,
        y_position: 10,
        width,
        height,
        font_size: 24,
        font_family: "Arial",
        color: "#000000",
        text_align: "left",
      };

      const res = await apiFetch(`/api/templates/${id}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newField),
      });

      if (res.ok) {
        const data = await res.json();
        const createdField = {
          ...newField,
          _id: data.id
        };
        setFields([...fields, createdField]);
        setSelectedFieldId(data.id);
        toast.success("Element added!");
      }
    } catch (e) {
      console.error("Failed to add field:", e);
      toast.error("Failed to add element");
    }
  };

  const updateField = (fieldId: string, updates: Partial<TemplateField>) => {
    setFields(fields.map((field) =>
      toId(field._id) === fieldId ? { ...field, ...updates } : field
    ));
  };

  const deleteField = async (fieldId: string) => {
    try {
      const res = await apiFetch(`/api/templates/${id}/fields/${fieldId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setFields(fields.filter((field) => toId(field._id) !== fieldId));
        if (toId(selectedFieldId) === fieldId) {
          setSelectedFieldId(null);
        }
        toast.success("Element deleted!");
      }
    } catch (e) {
      console.error("Failed to delete field:", e);
      toast.error("Failed to delete element");
    }
  };

  const selectedField = fields.find((field) => toId(field._id) === toId(selectedFieldId));

  if (loading) {
    return (
      <div className="h-[calc(100vh-80px)] flex items-center justify-center">
        <div className="text-muted-foreground font-bold uppercase tracking-widest text-xs">Loading certificate design...</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(220vh-80px)] flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Top Action Bar */}
      <div className="p-4 border-b bg-white dark:bg-gray-800 flex items-center justify-between shrink-0">
        <Button
          variant="outline"
          onClick={() => navigate("/dashboard/attachments/certificate-designer")}
          className="rounded-none gap-2 font-bold uppercase text-xs tracking-wider"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Presets
        </Button>
        <h1 className="font-heading font-black text-lg uppercase tracking-tight text-foreground flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          Certificate Design — {template?.template_name || id}
        </h1>
        <div className="flex gap-2">
          <Button
            className="rounded-none gap-2"
            variant="outline"
            onClick={() => isSidebarHidden ? setSidebarState('normal') : setSidebarState('hidden')}
            title={isSidebarHidden ? "Minimize View" : "Full View"}
          >
            {isSidebarHidden ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          <Button
            className="rounded-none gap-2 font-bold uppercase text-xs"
            variant="outline"
            onClick={loadData}
            disabled={isSaving}
          >
            <RefreshCcw className="w-4 h-4" />
            Reload
          </Button>
          <Button
            className="rounded-none gap-2 font-bold uppercase text-xs px-6 shadow-md"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Design"}
          </Button>
        </div>
      </div>

      {/* Selected Element Property Toolbar */}
      {selectedField && (
        <div className="p-4 border-b bg-muted/40 dark:bg-gray-800 flex items-center gap-6 flex-wrap shrink-0">
          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-primary">
            <Type className="w-4 h-4" />
            <span>
              {AVAILABLE_PLACEHOLDERS.find((p) => p.key === selectedField.field_name)?.label ||
                selectedField.field_name}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground font-medium">
              Font Size: {selectedField.font_size}px
            </label>
            <div className="w-44">
              <Slider
                value={[selectedField.font_size]}
                min={8}
                max={120}
                step={1}
                onValueChange={(vals) =>
                  updateField(toId(selectedField._id), { font_size: vals[0] })
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground font-medium">Color</label>
            <input
              type="color"
              value={selectedField.color}
              onChange={(e) =>
                updateField(toId(selectedField._id), { color: e.target.value })
              }
              className="h-9 w-16 rounded-none cursor-pointer border border-border"
            />
          </div>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteField(toId(selectedField._id))}
            className="rounded-none ml-auto text-xs font-bold uppercase tracking-wider"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete Element
          </Button>
        </div>
      )}

      {/* Main Workspace Panels */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <PanelGroup direction="horizontal" className="h-full min-h-0 w-full">
          
          {/* Left Controls Panel */}
          <Panel defaultSize={25} minSize={18} maxSize={40} className="bg-white dark:bg-gray-800 flex flex-col min-h-0 border-r border-border">
            <div className="p-4 flex-1 overflow-y-auto space-y-6">
              
              {/* Frame Theme Preset Switcher */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-2 text-primary">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Visual Background Frame Theme
                </h3>
                <div className="space-y-2">
                  {FRAME_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => {
                        setSelectedFrameTheme(theme.id);
                        setBackgroundImage(null);
                        toast.success(`Applied "${theme.name}" background frame!`);
                      }}
                      className={cn(
                        "w-full text-left p-3 border text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-between",
                        selectedFrameTheme === theme.id && !backgroundImage ? "bg-primary/10 border-primary text-primary" : "bg-card border-border hover:bg-muted"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.color }} />
                        <span>{theme.name}</span>
                      </div>
                      {selectedFrameTheme === theme.id && !backgroundImage && (
                        <span className="text-[9px] font-black text-emerald-600 bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/30">Active</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Elements List */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-2 text-foreground">
                  <Type className="w-4 h-4" />
                  Available Placeholders
                </h3>
                <Input
                  placeholder="Search elements..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mb-3 rounded-none text-xs"
                />
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {filteredPlaceholders.map((ph) => (
                    <button
                      key={ph.key}
                      type="button"
                      onClick={() => addField(ph.key, ph.label)}
                      className="w-full text-left px-3 py-2 border rounded-none border-border/60 hover:bg-primary/5 hover:border-primary transition-all text-xs flex items-center justify-between group"
                    >
                      <span className="font-bold text-foreground group-hover:text-primary">{ph.label}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{`{${ph.key}}`}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Background Upload */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-2 text-foreground">
                  <ImageIcon className="w-4 h-4" />
                  Custom Background Image
                </h3>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleBackgroundUpload}
                  className="rounded-none text-xs"
                />
                {backgroundImage && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setBackgroundImage(null)}
                    className="w-full mt-2 rounded-none text-xs font-bold uppercase tracking-wider"
                  >
                    Remove Custom Image
                  </Button>
                )}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 bg-border hover:bg-primary cursor-col-resize" />

          {/* Main Visual Canvas Area */}
          <Panel className="min-h-0">
            <div className="h-full min-h-0 w-full overflow-auto p-8 bg-slate-900 flex items-center justify-center">
              <div className="w-fit h-fit shadow-2xl relative border-4 border-amber-500/20">
                
                {/* Visual Canvas Card */}
                <div
                  className="relative bg-white shadow-2xl overflow-hidden transition-all"
                  style={{
                    width: canvasWidth,
                    height: canvasHeight,
                    backgroundImage: backgroundImage ? `url(${backgroundImage})` : "none",
                    backgroundSize: "100% 100%",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }}
                >
                  {/* PRE-LOADED ELEGANT SVG CERTIFICATE & DOCUMENT FRAME BACKGROUND (Rendered if no custom image uploaded) */}
                  {!backgroundImage && (
                    <div className="absolute inset-0 pointer-events-none p-8 flex flex-col justify-between select-none">
                      {/* Outer Frame Border */}
                      <div className="w-full h-full border-[10px] border-double border-amber-600/80 p-6 flex flex-col justify-between relative bg-gradient-to-b from-amber-500/5 via-white to-amber-500/5">
                        
                        {/* Top Header Banner */}
                        <div className="text-center pt-4 space-y-1">
                          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-700">
                            SIR CHHOTU RAM EDUCATION PVT. LTD.
                          </div>
                          <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                            GOVT. ACT REGISTERED & ISO 9001:2015 CERTIFIED INSTITUTION
                          </div>
                          <div className="w-32 h-0.5 bg-amber-600 mx-auto mt-2"></div>
                        </div>

                        {/* Center Watermark Crest */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-5">
                          <Award className="w-96 h-96 text-amber-900" />
                        </div>

                        {/* Bottom Footer Authority Line */}
                        <div className="flex justify-between items-end pb-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-t border-amber-600/20 pt-4">
                          <div>DIRECTOR & CONTROLLER</div>
                          <div>VERIFIED OFFICIAL SEAL</div>
                          <div>REGISTRATION DESK</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dynamic Draggable Placeholders */}
                  {fields.map((field) => {
                    const isImageField = field.field_type === "qr_code" ||
                      field.field_type === "center_sign" ||
                      field.field_type === "center_stamp" ||
                      field.field_type === "admin_sign" ||
                      field.field_type === "admin_stamp" ||
                      field.field_type === "result_table";

                    const x = percentToPixels(field.x_position, true);
                    const y = percentToPixels(field.y_position, false);

                    return (
                      <Rnd
                        key={toId(field._id)}
                        size={{
                          width: isImageField ? percentToPixels(field.width, true) : "auto",
                          height: isImageField ? percentToPixels(field.height, false) : "auto",
                        }}
                        position={{ x, y }}
                        onDragStop={(e, d) => {
                          updateField(toId(field._id), {
                            x_position: pixelsToPercent(d.x, true),
                            y_position: pixelsToPercent(d.y, false),
                          });
                        }}
                        onResizeStop={(e, direction, ref, delta, position) => {
                          if (isImageField) {
                            updateField(toId(field._id), {
                              x_position: pixelsToPercent(position.x, true),
                              y_position: pixelsToPercent(position.y, false),
                              width: pixelsToPercent(parseInt(ref.style.width), true),
                              height: pixelsToPercent(parseInt(ref.style.height), false),
                            });
                          }
                        }}
                        enableResizing={isImageField ? {
                          top: true, right: true, bottom: true, left: true,
                          topRight: true, bottomRight: true, bottomLeft: true, topLeft: true,
                        } : false}
                        bounds="parent"
                      >
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFieldId(toId(field._id));
                          }}
                          className={`cursor-move p-1 flex items-center justify-center ${
                            toId(selectedFieldId) === toId(field._id)
                              ? "ring-2 ring-primary ring-offset-2 bg-primary/10"
                              : "hover:ring-1 hover:ring-amber-400"
                          }`}
                          style={{
                            width: "100%",
                            height: "100%",
                            fontSize: `${field.font_size}px`,
                            fontFamily: field.font_family,
                            color: field.color,
                            textAlign: field.text_align as any,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {field.field_type === "qr_code" && (
                            <div className="w-full h-full border-2 border-dashed border-amber-600 bg-amber-500/10 flex flex-col items-center justify-center text-[10px] font-bold uppercase tracking-wider text-amber-700">
                              <QrCode className="w-6 h-6 mb-1" /> QR Code
                            </div>
                          )}
                          {field.field_type === "center_sign" && (
                            <div className="w-full h-full border-2 border-dashed border-slate-400 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">
                              Center Signature
                            </div>
                          )}
                          {field.field_type === "admin_sign" && (
                            <div className="w-full h-full border-2 border-dashed border-slate-400 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">
                              Admin Signature
                            </div>
                          )}
                          {field.field_type === "center_stamp" && (
                            <div className="w-full h-full border-2 border-dashed border-amber-600 rounded-full flex items-center justify-center text-[9px] font-bold text-amber-700 uppercase">
                              Official Seal
                            </div>
                          )}
                          {field.field_type === "result_table" && (
                            <div className="w-full h-full border-2 border-dashed border-blue-400 bg-blue-50/50 p-2 flex flex-col justify-center text-xs font-bold text-blue-700">
                              <div>Subject Marks Breakdown Table</div>
                              <div className="text-[9px] font-normal text-slate-500 mt-1">[Sub 1 | Sub 2 | Total | Grade]</div>
                            </div>
                          )}
                          {field.field_type === "text" && (
                            <span>{field.custom_text || `{${field.field_name}}`}</span>
                          )}
                        </div>
                      </Rnd>
                    );
                  })}
                </div>
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
};

export default function CertificateDesignerCanvasPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <DashboardLayout>
      <CertificateDesignerCanvasContent id={id} />
    </DashboardLayout>
  );
}
