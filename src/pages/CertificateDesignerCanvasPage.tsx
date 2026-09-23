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

const A4_PORTRAIT_WIDTH = 816; // 8.5in * 96dpi
const A4_PORTRAIT_HEIGHT = 1056; // 11in * 96dpi

interface TemplateField {
  _id?: string;
  field_name: string;
  field_type: string;
  x_position: number; // percentage (0-100)
  y_position: number; // percentage (0-100)
  width: number; // percentage (0-100)
  height: number; // percentage (0-100)
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

const CertificateDesignerCanvasContent: React.FC<{ id: string | undefined }> = ({ id }) => {
  const navigate = useNavigate();
  const { isSidebarHidden, setSidebarState } = useDashboardSidebar();
  const [template, setTemplate] = useState<Template | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [adminSignature, setAdminSignature] = useState<string | null>(null);
  const [adminStamp, setAdminStamp] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Filter and sort placeholders
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
      // Save background image if changed
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

      // Save all fields
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

  const handleAdminSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAdminSignature(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdminStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAdminStamp(event.target?.result as string);
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
        // Add the new field to local state instead of reloading everything
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
        <div className="text-muted-foreground">Loading certificate design...</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(220vh-80px)] flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <div className="p-4 border-b bg-white dark:bg-gray-800 flex items-center justify-between shrink-0">
        <Button
          variant="outline"
          onClick={() => navigate("/dashboard/attachments/certificate-designer")}
          className="rounded-none gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <h1 className="font-heading font-bold text-lg uppercase tracking-tight">
          Certificate Design - {template?.template_name || id}
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
            className="rounded-none gap-2"
            variant="outline"
            onClick={loadData}
            disabled={isSaving}
          >
            <RefreshCcw className="w-4 h-4" />
            Reload
          </Button>
          <Button
            className="rounded-none gap-2"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* New Header Row for Element Properties */}
      {selectedField && (
        <div className="p-4 border-b bg-white dark:bg-gray-800 flex items-center gap-6 flex-wrap shrink-0">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4" />
            <span className="font-medium">
              {AVAILABLE_PLACEHOLDERS.find((p) => p.key === selectedField.field_name)?.label ||
                selectedField.field_name}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground">
              Font Size: {selectedField.font_size}px
            </label>
            <div className="w-48">
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

          <div className="flex gap-2">
            <Button
              variant={selectedField.font_family === "Arial Bold" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                updateField(toId(selectedField._id), {
                  font_family:
                    selectedField.font_family === "Arial Bold" ? "Arial" : "Arial Bold",
                })
              }
              className="rounded-none"
            >
              <Bold className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-none"
            >
              <Italic className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-none"
            >
              <Underline className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground">Color</label>
            <input
              type="color"
              value={selectedField.color}
              onChange={(e) =>
                updateField(toId(selectedField._id), { color: e.target.value })
              }
              className="h-10 w-20 rounded-none"
            />
          </div>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteField(toId(selectedField._id))}
            className="rounded-none ml-auto"
          >
            <Trash2 className="w-4 h-4 mr-1" />
          </Button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden min-h-0">
        <PanelGroup direction="horizontal" className="h-full min-h-0 w-full">
          {/* Left Panel - Elements List */}
          <Panel defaultSize={25} minSize={15} maxSize={40} className="bg-white dark:bg-gray-800 flex flex-col min-h-0">
            <div className="p-4 flex-1 overflow-y-auto space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Type className="w-4 h-4" />
                  Available Elements
                </h3>
                <Input
                  placeholder="Search elements..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mb-3"
                />
                <div className="space-y-2">
                  {filteredPlaceholders.length > 0 ? (
                    filteredPlaceholders.map((ph) => (
                      <button
                        key={ph.key}
                        type="button"
                        onClick={() => addField(ph.key, ph.label)}
                        className="w-full text-left px-3 py-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                      >
                        <div className="font-medium">{ph.label}</div>
                        <div className="text-xs text-gray-500">{`{${ph.key}}`}</div>
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No matching elements found
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Type className="w-4 h-4" />
                  Admin Assets
                </h3>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Admin Signature</label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleAdminSignatureUpload}
                      className="mt-1"
                    />
                  </div>
                  {adminSignature && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setAdminSignature(null)}
                      className="w-full rounded-none"
                    >
                      Remove Admin Signature
                    </Button>
                  )}
                  <div className="mt-3">
                    <label className="text-xs text-muted-foreground">Admin Stamp</label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleAdminStampUpload}
                      className="mt-1"
                    />
                  </div>
                  {adminStamp && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setAdminStamp(null)}
                      className="w-full rounded-none"
                    >
                      Remove Admin Stamp
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Type className="w-4 h-4" />
                  Certificate Details
                </h3>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Template Name</label>
                    <Input
                      value={template?.template_name || ""}
                      onChange={(e) => setTemplate(template ? { ...template, template_name: e.target.value } : null)}
                      className="rounded-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Course Category</label>
                    <Select
                      value={selectedCategory || ""}
                      onValueChange={(val) => {
                        setSelectedCategory(val || null);
                        setSelectedCourse(null);
                      }}
                    >
                      <SelectTrigger className="rounded-none">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Course</label>
                    <Select
                      value={selectedCourse || ""}
                      onValueChange={(val) => setSelectedCourse(val || null)}
                      disabled={!selectedCategory}
                    >
                      <SelectTrigger className="rounded-none">
                        <SelectValue placeholder="Select Course" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCourses.map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.course_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Background
                </h3>
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleBackgroundUpload}
                  />
                </div>
                {backgroundImage && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setBackgroundImage(null)}
                    className="w-full mt-2 rounded-none"
                  >
                    Remove Background
                  </Button>
                )}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-col-resize" />

          {/* Main Canvas Area — scroll must be on an inner div; Panel sets overflow:hidden inline */}
          <Panel className="min-h-0">
            <div className="h-full min-h-0 w-full overflow-auto p-4 bg-gray-100 dark:bg-gray-900">
              <div className="w-fit h-fit">
                <div
                  className="relative bg-white shadow-2xl overflow-hidden"
                  style={{
                    width: canvasWidth,
                    height: canvasHeight,
                    backgroundImage: backgroundImage ? `url(${backgroundImage})` : "none",
                    backgroundSize: "100% 100%",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }}
                >
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
                        position={{
                          x: x,
                          y: y,
                        }}
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
                          top: true,
                          right: true,
                          bottom: true,
                          left: true,
                          topRight: true,
                          bottomRight: true,
                          bottomLeft: true,
                          topLeft: true,
                        } : false}
                        bounds="parent"
                      >
                        <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFieldId(toId(field._id));
                      }}
                      className={`cursor-move p-1 flex items-center justify-center ${toId(selectedFieldId) === toId(field._id)
                        ? "ring-2 ring-blue-500 ring-offset-1"
                        : "hover:ring-1 hover:ring-gray-300"
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
                        <div className="w-full h-full border-2 border-dashed border-gray-400 flex items-center justify-center text-xs text-gray-500">
                          QR Code
                        </div>
                      )}
                      {field.field_type === "center_sign" && (
                        <div className="w-full h-full border-2 border-dashed border-gray-400 flex items-center justify-center text-xs text-gray-500">
                          Center Signature
                        </div>
                      )}
                      {field.field_type === "center_stamp" && (
                        <div className="w-full h-full border-2 border-dashed border-gray-400 rounded-full flex items-center justify-center text-xs text-gray-500">
                          Center Stamp
                        </div>
                      )}
                      {field.field_type === "admin_sign" && (
                        <div className="w-full h-full border-2 border-dashed border-gray-400 flex items-center justify-center text-xs text-gray-500">
                          Admin Signature
                        </div>
                      )}
                      {field.field_type === "admin_stamp" && (
                        <div className="w-full h-full border-2 border-dashed border-gray-400 rounded-full flex items-center justify-center text-xs text-gray-500">
                          Admin Stamp
                        </div>
                      )}
                      {field.field_type === "result_table" && (
                        <div className="w-full h-full border-2 border-dashed border-gray-400 flex items-center justify-center text-xs text-gray-500">
                          Result Table
                        </div>
                      )}
                      {!isImageField && (
                        `{${field.field_name}}`
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

const CertificateDesignerCanvasPage: React.FC = () => {
  const { id } = useParams();

  return (
    <DashboardLayout>
      <CertificateDesignerCanvasContent id={id} />
    </DashboardLayout>
  );
};

export default CertificateDesignerCanvasPage;
