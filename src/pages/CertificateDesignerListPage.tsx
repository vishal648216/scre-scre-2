import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PlusCircle,
  PenTool,
  Layers,
  Trash2,
  MonitorSmartphone,
  Monitor,
  Search,
  Filter,
  Star,
  Edit,
  Settings,
  Sparkles,
  Award,
  FileCheck2,
  BadgeCheck,
  FileText,
  Building2,
  GraduationCap,
  Copy,
  CheckCircle2,
  Loader2,
  Eye,
  ArrowRight,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { apiFetch, parseJsonArrayResponse } from "@/lib/api";
import { toast } from "sonner";
import { toId } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Template {
  id: string;
  template_name: string;
  template_type: string;
  page_size: string;
  orientation: string;
  background_image?: string;
  course_category_id?: string;
  course_id?: string;
  default_design?: boolean;
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

interface PresetField {
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
}

interface MasterPreset {
  id: string;
  name: string;
  type: "certificate" | "marksheet" | "id_card" | "letter";
  category: string;
  orientation: "landscape" | "portrait";
  pageSize: "a4" | "letter" | "a3";
  tag: string;
  badgeBg: string;
  badgeText: string;
  description: string;
  icon: any;
  previewBg: string;
  fields: PresetField[];
}

const MASTER_PRESETS: MasterPreset[] = [
  {
    id: "preset-gold-cert",
    name: "ISO Gold Honor Course Certificate",
    type: "certificate",
    category: "Student Academic Certificate",
    orientation: "landscape",
    pageSize: "a4",
    tag: "Most Popular",
    badgeBg: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
    badgeText: "Gold Standard",
    description: "Luxurious gold-framed diploma with official watermark, QR validation, student name, and center signature.",
    icon: Award,
    previewBg: "from-amber-500/10 via-background to-amber-500/5",
    fields: [
      { field_name: "course_name", field_type: "text", x_position: 20, y_position: 22, width: 60, height: 6, font_size: 32, font_family: "Arial Bold", color: "#1e293b", text_align: "center" },
      { field_name: "student_name", field_type: "text", x_position: 15, y_position: 38, width: 70, height: 8, font_size: 38, font_family: "Arial Bold", color: "#b45309", text_align: "center" },
      { field_name: "student_enrollment", field_type: "text", x_position: 10, y_position: 78, width: 25, height: 4, font_size: 14, font_family: "Arial", color: "#475569", text_align: "left" },
      { field_name: "issue_date", field_type: "text", x_position: 40, y_position: 78, width: 20, height: 4, font_size: 14, font_family: "Arial", color: "#475569", text_align: "center" },
      { field_name: "qr_code", field_type: "qr_code", x_position: 80, y_position: 72, width: 12, height: 12, font_size: 14, font_family: "Arial", color: "#000000", text_align: "center" },
      { field_name: "admin_sign", field_type: "admin_sign", x_position: 10, y_position: 85, width: 20, height: 6, font_size: 14, font_family: "Arial", color: "#000000", text_align: "left" },
      { field_name: "center_stamp", field_type: "center_stamp", x_position: 44, y_position: 82, width: 12, height: 12, font_size: 14, font_family: "Arial", color: "#000000", text_align: "center" },
    ]
  },
  {
    id: "preset-marksheet-tabular",
    name: "Standard Semester Grade Marksheet",
    type: "marksheet",
    category: "Academic Marksheet",
    orientation: "portrait",
    pageSize: "a4",
    tag: "Official Grade Sheet",
    badgeBg: "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400",
    badgeText: "Subject Breakdown",
    description: "Structured grade sheet format with subject-wise marks breakdown, total percentage, division, and controller stamp.",
    icon: FileCheck2,
    previewBg: "from-blue-500/10 via-background to-blue-500/5",
    fields: [
      { field_name: "student_name", field_type: "text", x_position: 15, y_position: 14, width: 45, height: 5, font_size: 24, font_family: "Arial Bold", color: "#0f172a", text_align: "left" },
      { field_name: "course_name", field_type: "text", x_position: 15, y_position: 20, width: 45, height: 4, font_size: 18, font_family: "Arial", color: "#334155", text_align: "left" },
      { field_name: "result_table", field_type: "result_table", x_position: 10, y_position: 28, width: 80, height: 38, font_size: 14, font_family: "Arial", color: "#000000", text_align: "center" },
      { field_name: "result_percentage", field_type: "text", x_position: 10, y_position: 70, width: 30, height: 5, font_size: 20, font_family: "Arial Bold", color: "#15803d", text_align: "left" },
      { field_name: "grade", field_type: "text", x_position: 50, y_position: 70, width: 25, height: 5, font_size: 20, font_family: "Arial Bold", color: "#15803d", text_align: "left" },
      { field_name: "qr_code", field_type: "qr_code", x_position: 75, y_position: 78, width: 15, height: 15, font_size: 14, font_family: "Arial", color: "#000000", text_align: "center" },
    ]
  },
  {
    id: "preset-student-idcard",
    name: "Smart Student Photo Identity Card",
    type: "id_card",
    category: "Student Identity Badge",
    orientation: "portrait",
    pageSize: "a4",
    tag: "CR80 Standard",
    badgeBg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
    badgeText: "Student Badge",
    description: "Vertical student photo identity badge with enrollment ID, center code, barcode pass, and emergency contact.",
    icon: BadgeCheck,
    previewBg: "from-emerald-500/10 via-background to-emerald-500/5",
    fields: [
      { field_name: "student_name", field_type: "text", x_position: 10, y_position: 44, width: 80, height: 6, font_size: 22, font_family: "Arial Bold", color: "#0f172a", text_align: "center" },
      { field_name: "course_name", field_type: "text", x_position: 10, y_position: 52, width: 80, height: 5, font_size: 16, font_family: "Arial", color: "#475569", text_align: "center" },
      { field_name: "student_enrollment", field_type: "text", x_position: 15, y_position: 60, width: 70, height: 4, font_size: 14, font_family: "Arial Bold", color: "#2563eb", text_align: "center" },
      { field_name: "center_name", field_type: "text", x_position: 10, y_position: 68, width: 80, height: 4, font_size: 13, font_family: "Arial", color: "#64748b", text_align: "center" },
      { field_name: "qr_code", field_type: "qr_code", x_position: 35, y_position: 76, width: 30, height: 18, font_size: 12, font_family: "Arial", color: "#000000", text_align: "center" },
    ]
  },
  {
    id: "preset-staff-idcard",
    name: "Faculty & Staff Identity Badge",
    type: "id_card",
    category: "Staff Identity Badge",
    orientation: "portrait",
    pageSize: "a4",
    tag: "Corporate Badge",
    badgeBg: "bg-violet-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400",
    badgeText: "Staff Badge",
    description: "Executive staff badge layout with designation tag, employee code, blood group, and access level barcode.",
    icon: BadgeCheck,
    previewBg: "from-violet-500/10 via-background to-violet-500/5",
    fields: [
      { field_name: "student_name", field_type: "text", x_position: 10, y_position: 40, width: 80, height: 6, font_size: 22, font_family: "Arial Bold", color: "#4c1d95", text_align: "center" },
      { field_name: "center_name", field_type: "text", x_position: 10, y_position: 50, width: 80, height: 5, font_size: 16, font_family: "Arial", color: "#6b21a8", text_align: "center" },
      { field_name: "serial_num", field_type: "text", x_position: 15, y_position: 60, width: 70, height: 4, font_size: 14, font_family: "Arial", color: "#3b0764", text_align: "center" },
      { field_name: "qr_code", field_type: "qr_code", x_position: 35, y_position: 72, width: 30, height: 20, font_size: 12, font_family: "Arial", color: "#000000", text_align: "center" },
    ]
  },
  {
    id: "preset-staff-offer-letter",
    name: "Staff Appointment & Offer Letter",
    type: "letter",
    category: "HR & Staff Letter",
    orientation: "portrait",
    pageSize: "a4",
    tag: "HR Official",
    badgeBg: "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400",
    badgeText: "Appointment",
    description: "Official company letterhead format for staff appointment, CTC structure, joining date, and HR approval sign.",
    icon: FileText,
    previewBg: "from-indigo-500/10 via-background to-indigo-500/5",
    fields: [
      { field_name: "center_name", field_type: "text", x_position: 10, y_position: 8, width: 80, height: 6, font_size: 26, font_family: "Arial Bold", color: "#1e1b4b", text_align: "center" },
      { field_name: "student_name", field_type: "text", x_position: 10, y_position: 22, width: 50, height: 5, font_size: 18, font_family: "Arial Bold", color: "#0f172a", text_align: "left" },
      { field_name: "issue_date", field_type: "text", x_position: 70, y_position: 22, width: 20, height: 4, font_size: 14, font_family: "Arial", color: "#475569", text_align: "right" },
      { field_name: "admin_sign", field_type: "admin_sign", x_position: 10, y_position: 84, width: 25, height: 6, font_size: 14, font_family: "Arial", color: "#000000", text_align: "left" },
      { field_name: "admin_stamp", field_type: "admin_stamp", x_position: 70, y_position: 80, width: 15, height: 15, font_size: 14, font_family: "Arial", color: "#000000", text_align: "right" },
    ]
  },
  {
    id: "preset-franchise-license",
    name: "Franchise Authorization License",
    type: "certificate",
    category: "Franchise Management",
    orientation: "landscape",
    pageSize: "a4",
    tag: "Center Affiliation",
    badgeBg: "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400",
    badgeText: "Franchise License",
    description: "Official center affiliation certificate with gold watermark, center code, validity period, and authorized seal.",
    icon: Building2,
    previewBg: "from-rose-500/10 via-background to-rose-500/5",
    fields: [
      { field_name: "center_name", field_type: "text", x_position: 15, y_position: 34, width: 70, height: 8, font_size: 36, font_family: "Arial Bold", color: "#9f1239", text_align: "center" },
      { field_name: "center_code", field_type: "text", x_position: 25, y_position: 46, width: 50, height: 5, font_size: 20, font_family: "Arial Bold", color: "#be123c", text_align: "center" },
      { field_name: "issue_date", field_type: "text", x_position: 15, y_position: 78, width: 30, height: 4, font_size: 14, font_family: "Arial", color: "#475569", text_align: "left" },
      { field_name: "qr_code", field_type: "qr_code", x_position: 80, y_position: 72, width: 12, height: 12, font_size: 14, font_family: "Arial", color: "#000000", text_align: "center" },
      { field_name: "admin_sign", field_type: "admin_sign", x_position: 15, y_position: 84, width: 25, height: 6, font_size: 14, font_family: "Arial", color: "#000000", text_align: "left" },
    ]
  },
  {
    id: "preset-internship-letter",
    name: "Student Internship & Training Certificate",
    type: "letter",
    category: "Internship Portal",
    orientation: "landscape",
    pageSize: "a4",
    tag: "Training Certificate",
    badgeBg: "bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400",
    badgeText: "Internship Pass",
    description: "Internship completion certificate & recommendation letter with tech stack summary and manager sign.",
    icon: GraduationCap,
    previewBg: "from-cyan-500/10 via-background to-cyan-500/5",
    fields: [
      { field_name: "student_name", field_type: "text", x_position: 15, y_position: 30, width: 70, height: 7, font_size: 34, font_family: "Arial Bold", color: "#0891b2", text_align: "center" },
      { field_name: "course_name", field_type: "text", x_position: 20, y_position: 42, width: 60, height: 5, font_size: 22, font_family: "Arial", color: "#0e7490", text_align: "center" },
      { field_name: "duration", field_type: "text", x_position: 25, y_position: 52, width: 50, height: 4, font_size: 16, font_family: "Arial", color: "#155e75", text_align: "center" },
      { field_name: "qr_code", field_type: "qr_code", x_position: 82, y_position: 70, width: 12, height: 12, font_size: 14, font_family: "Arial", color: "#000000", text_align: "center" },
      { field_name: "admin_sign", field_type: "admin_sign", x_position: 15, y_position: 82, width: 25, height: 6, font_size: 14, font_family: "Arial", color: "#000000", text_align: "left" },
    ]
  }
];

export default function CertificateDesignerListPage() {
  const [designs, setDesigns] = useState<Template[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloningPresetId, setCloningPresetId] = useState<string | null>(null);

  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDesign, setEditingDesign] = useState<Template | null>(null);
  const [newDesignName, setNewDesignName] = useState("");
  const [editDesignName, setEditDesignName] = useState("");
  const [newDesignOrientation, setNewDesignOrientation] = useState("landscape");
  const [editDesignOrientation, setEditDesignOrientation] = useState("landscape");
  const [newDesignType, setNewDesignType] = useState("certificate");
  const [editDesignType, setEditDesignType] = useState("certificate");
  const [newDesignCategory, setNewDesignCategory] = useState<string | null>("all");
  const [editDesignCategory, setEditDesignCategory] = useState<string | null>("all");
  const [newDesignCourse, setNewDesignCourse] = useState<string | null>("all");
  const [editDesignCourse, setEditDesignCourse] = useState<string | null>("all");
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Generation Time Dialog
  const [isGenerationTimeDialogOpen, setIsGenerationTimeDialogOpen] = useState(false);
  const [marksheetDays, setMarksheetDays] = useState(0);
  const [certificateDays, setCertificateDays] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>("all");
  const [filterCourse, setFilterCourse] = useState<string | null>("all");
  const [filterType, setFilterType] = useState<string | null>("all");
  const [sortBy, setSortBy] = useState("newest");
  const [activeTab, setActiveTab] = useState("presets");

  const navigate = useNavigate();

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

  const loadDesigns = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (filterType && filterType !== "all") q.set("template_type", filterType);
      if (filterCategory && filterCategory !== "all") q.set("course_category_id", filterCategory);
      if (filterCourse && filterCourse !== "all") q.set("course_id", filterCourse);
      if (searchQuery) q.set("search", searchQuery);
      if (sortBy) q.set("sort", sortBy);
      const res = await apiFetch("/api/templates?" + q.toString());
      if (res.ok) {
        const data = await res.json();
        setDesigns(Array.isArray(data) ? data : []);
      } else setDesigns([]);
    } catch {
      setDesigns([]);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterCategory, filterCourse, searchQuery, sortBy]);

  const loadGenerationSettings = useCallback(async () => {
    try {
      const res = await apiFetch("/api/system/settings");
      if (res.ok) {
        const data = await res.json();
        setMarksheetDays(data.auto_marksheet_generation_days || 0);
        setCertificateDays(data.auto_certificate_generation_days || 0);
      }
    } catch {
      // ignore
    }
  }, []);

  const saveGenerationSettings = async () => {
    try {
      const settingsRes = await apiFetch("/api/system/settings");
      let currentSettings: any = {};
      if (settingsRes.ok) {
        currentSettings = await settingsRes.json();
      }

      const newSettings = {
        ...currentSettings,
        auto_marksheet_generation_days: marksheetDays,
        auto_certificate_generation_days: certificateDays
      };

      const saveRes = await apiFetch("/api/system/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings)
      });

      if (saveRes.ok) {
        toast.success("Generation time settings saved!");
        setIsGenerationTimeDialogOpen(false);
      } else {
        toast.error("Failed to save settings");
      }
    } catch {
      toast.error("Failed to save settings");
    }
  };

  useEffect(() => {
    loadCategories();
    loadCourses();
    loadDesigns();
    loadGenerationSettings();
  }, [loadCategories, loadCourses, loadDesigns, loadGenerationSettings]);

  // 1-Click Clone Master Preset logic
  const handleUsePreset = async (preset: MasterPreset) => {
    setCloningPresetId(preset.id);
    try {
      // Step 1: Create template
      const body: any = {
        template_name: preset.name,
        template_type: preset.type,
        page_size: preset.pageSize,
        orientation: preset.orientation,
        default_design: false,
      };

      const res = await apiFetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) {
        toast.error(data.message || "Failed to clone preset format");
        return;
      }

      const templateId = data.id;

      // Step 2: Seed all preset fields
      const fieldPromises = preset.fields.map(field =>
        apiFetch(`/api/templates/${templateId}/fields`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(field),
        })
      );

      await Promise.all(fieldPromises);
      toast.success(`Preset format "${preset.name}" cloned successfully! Opening canvas editor...`);
      navigate(`/dashboard/attachments/certificate-designer/${templateId}`);
    } catch {
      toast.error("Error creating template from preset");
    } finally {
      setCloningPresetId(null);
    }
  };

  const handleAddDesign = async () => {
    if (newDesignName.trim() === "") return;
    setIsCreating(true);
    try {
      const body: any = {
        template_name: newDesignName.trim(),
        template_type: newDesignType,
        page_size: "a4",
        orientation: newDesignOrientation
      };
      if (newDesignCategory && newDesignCategory !== "all") body.course_category_id = newDesignCategory;
      if (newDesignCourse && newDesignCourse !== "all") body.course_id = newDesignCourse;

      const res = await apiFetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Blank design created!");
        setNewDesignName("");
        setNewDesignCategory("all");
        setNewDesignCourse("all");
        setIsAddDialogOpen(false);
        loadDesigns();
        if (data.id) {
          navigate(`/dashboard/attachments/certificate-designer/${data.id}`);
        }
      } else {
        toast.error(data.message || "Failed to create design");
      }
    } catch {
      toast.error("Failed to create design");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteDesign = async (id: string, name: string) => {
    if (!confirm(`Delete design "${name}"?`)) return;
    try {
      const res = await apiFetch("/api/templates/" + id, { method: "DELETE" });
      if (res.ok) {
        toast.success("Deleted design");
        loadDesigns();
      } else {
        toast.error("Failed to delete design");
      }
    } catch {
      toast.error("Failed to delete design");
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const res = await apiFetch(`/api/templates/${id}/set-default`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Set as default design!");
        loadDesigns();
      } else {
        toast.error("Failed to set as default");
      }
    } catch {
      toast.error("Failed to set as default");
    }
  };

  const handleEditDesign = (design: Template) => {
    setEditingDesign(design);
    setEditDesignName(design.template_name);
    setEditDesignOrientation(design.orientation);
    setEditDesignType(design.template_type);
    setEditDesignCategory(design.course_category_id || "all");
    setEditDesignCourse(design.course_id || "all");
    setIsEditDialogOpen(true);
  };

  const handleUpdateDesign = async () => {
    if (!editingDesign || editDesignName.trim() === "") return;
    setIsUpdating(true);
    try {
      const body: any = {
        template_name: editDesignName.trim(),
        template_type: editDesignType,
      };
      if (editDesignCategory && editDesignCategory !== "all") {
        body.course_category_id = editDesignCategory;
      } else {
        body.course_category_id = null;
      }
      if (editDesignCourse && editDesignCourse !== "all") {
        body.course_id = editDesignCourse;
      } else {
        body.course_id = null;
      }

      const res = await apiFetch(`/api/templates/${toId(editingDesign.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success("Design details updated!");
        setIsEditDialogOpen(false);
        loadDesigns();
      } else {
        toast.error("Failed to update design");
      }
    } catch {
      toast.error("Failed to update design");
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredPresets = useMemo(() => {
    return MASTER_PRESETS.filter(p => {
      if (filterType !== "all" && p.type !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [filterType, searchQuery]);

  const filteredCoursesForAdd = useMemo(() => {
    if (!newDesignCategory) return [];
    return courses.filter(c => c.category_id === newDesignCategory);
  }, [courses, newDesignCategory]);

  const filteredCoursesForFilter = useMemo(() => {
    if (!filterCategory) return [];
    return courses.filter(c => c.category_id === filterCategory);
  }, [courses, filterCategory]);

  const totalCustomCount = designs.length;
  const totalPresetCount = MASTER_PRESETS.length;
  const defaultCount = designs.filter(d => d.default_design).length;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary/80 mb-1">
              <PenTool className="w-4 h-4" />
              Document & Certificate Designer Hub
            </div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
              Canvas Design & Preset Formats
            </h1>
            <p className="text-muted-foreground text-sm font-medium mt-1">
              Choose from ready-to-print master formats or build custom certificates, marksheets, ID cards & staff letters.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => {
                loadGenerationSettings();
                setIsGenerationTimeDialogOpen(true);
              }}
              variant="outline"
              className="rounded-none border-border font-bold uppercase text-xs tracking-wider h-11"
            >
              <Settings className="w-4 h-4 mr-2" />
              Generation Time
            </Button>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="rounded-none font-bold uppercase text-xs tracking-wider px-6 h-11 shadow-lg"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Blank Custom Design
            </Button>
          </div>
        </div>

        {/* Stats Summary Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-none border-border bg-gradient-to-br from-amber-500/10 via-card to-card shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ready-To-Use Master Formats</span>
                <p className="text-2xl font-black text-foreground mt-0.5">{totalPresetCount} Ready Presets</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border bg-gradient-to-br from-primary/10 via-card to-card shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Layers className="w-6 h-6 text-primary" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">My Custom Designs</span>
                <p className="text-2xl font-black text-foreground mt-0.5">{totalCustomCount} Templates Created</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border bg-gradient-to-br from-emerald-500/10 via-card to-card shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <Star className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Defaults</span>
                <p className="text-2xl font-black text-foreground mt-0.5">{defaultCount} Default Designs</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Global Filter Bar */}
        <Card className="rounded-none border-border bg-muted/20 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search certificates, marksheets, ID cards, letters..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 rounded-none border-border bg-background text-sm h-10"
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground hidden sm:block" />
                <Select value={filterType || "all"} onValueChange={(val) => setFilterType(val || "all")}>
                  <SelectTrigger className="w-[160px] rounded-none bg-background border-border text-xs h-10 font-bold uppercase tracking-wider">
                    <SelectValue placeholder="All Document Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Document Types</SelectItem>
                    <SelectItem value="certificate">Certificates</SelectItem>
                    <SelectItem value="marksheet">Marksheets</SelectItem>
                    <SelectItem value="id_card">ID Cards & Badges</SelectItem>
                    <SelectItem value="letter">Letters & Agreements</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterCategory || "all"} onValueChange={(val) => { setFilterCategory(val || "all"); setFilterCourse("all"); }}>
                  <SelectTrigger className="w-[160px] rounded-none bg-background border-border text-xs h-10">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterCourse || "all"} onValueChange={(val) => setFilterCourse(val || "all")} disabled={!filterCategory || filterCategory === "all"}>
                  <SelectTrigger className="w-[160px] rounded-none bg-background border-border text-xs h-10">
                    <SelectValue placeholder="All Courses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Courses</SelectItem>
                    {filteredCoursesForFilter.map(course => (
                      <SelectItem key={course.id} value={course.id}>{course.course_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[140px] rounded-none bg-background border-border text-xs h-10">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="a-z">A-Z</SelectItem>
                    <SelectItem value="z-a">Z-A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Tabs: Master Presets vs My Custom Designs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start rounded-none bg-muted/30 p-1 border-b border-border h-12">
            <TabsTrigger
              value="presets"
              className="rounded-none font-black uppercase text-xs tracking-wider px-6 h-10 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Sparkles className="w-4 h-4 mr-2 text-amber-400" />
              Ready-To-Use Master Presets ({filteredPresets.length})
            </TabsTrigger>
            <TabsTrigger
              value="custom"
              className="rounded-none font-black uppercase text-xs tracking-wider px-6 h-10 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Layers className="w-4 h-4 mr-2" />
              My Custom Designs ({designs.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: MASTER PRESETS GALLERY */}
          <TabsContent value="presets" className="mt-6 space-y-6">
            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-none flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                    No Time To Design From Scratch?
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Click <strong>"Use Format Instantly"</strong> on any preset format below to clone & launch it in your canvas designer ready to print!
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPresets.map((preset) => {
                const IconComp = preset.icon;
                const isCloning = cloningPresetId === preset.id;
                return (
                  <Card key={preset.id} className="rounded-none border-border overflow-hidden group hover:border-primary/50 transition-all flex flex-col justify-between shadow-md">
                    <div>
                      {/* Top Visual Mock Area */}
                      <div className={cn("p-6 border-b border-border bg-gradient-to-br relative flex flex-col justify-between h-44", preset.previewBg)}>
                        <div className="flex items-center justify-between">
                          <span className={cn("px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border", preset.badgeBg)}>
                            {preset.badgeText}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 bg-background/80 px-2 py-0.5 border border-border">
                            {preset.orientation === "landscape" ? <Monitor className="w-3 h-3" /> : <MonitorSmartphone className="w-3 h-3" />}
                            {preset.orientation} • {preset.pageSize.toUpperCase()}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">{preset.category}</span>
                          <h3 className="font-heading font-black text-lg text-foreground uppercase tracking-tight line-clamp-1">
                            {preset.name}
                          </h3>
                        </div>

                        {/* Dummy mini certificate layout representation */}
                        <div className="w-full h-2 bg-foreground/10 rounded-full flex items-center justify-between px-2">
                          <div className="w-1/3 h-1 bg-primary/40"></div>
                          <div className="w-1/4 h-1 bg-primary/20"></div>
                        </div>
                      </div>

                      {/* Card Content Description */}
                      <CardContent className="p-5 space-y-4">
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          {preset.description}
                        </p>

                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {preset.fields.map((f, i) => (
                            <span key={i} className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-muted text-muted-foreground border border-border/50">
                              {f.field_name.replace("_", " ")}
                            </span>
                          ))}
                        </div>
                      </CardContent>
                    </div>

                    {/* Footer Action */}
                    <div className="p-4 bg-muted/30 border-t border-border flex items-center justify-between gap-2">
                      <Button
                        size="sm"
                        className="w-full rounded-none font-bold uppercase tracking-widest text-[10px] h-10 shadow-md"
                        onClick={() => handleUsePreset(preset)}
                        disabled={isCloning}
                      >
                        {isCloning ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                            Cloning Format...
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 mr-2" />
                            Use Format Instantly
                          </>
                        )}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* TAB 2: MY CUSTOM DESIGNS */}
          <TabsContent value="custom" className="mt-6 space-y-6">
            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Loading custom designs...</p>
              </div>
            ) : designs.length === 0 ? (
              <Card className="rounded-none border-border bg-card">
                <CardContent className="py-20 text-center space-y-4">
                  <Layers className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">No Custom Designs Found</h3>
                    <p className="text-xs text-muted-foreground mt-1">Create a custom design or select a preset from the Ready-To-Use Master Presets gallery.</p>
                  </div>
                  <Button
                    onClick={() => setIsAddDialogOpen(true)}
                    className="rounded-none font-bold uppercase text-xs tracking-wider px-6"
                  >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Create Blank Custom Design
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {designs.map((design) => {
                  const tid = toId(design.id);
                  const course = courses.find(c => c.id === design.course_id);
                  const category = categories.find(c => c.id === design.course_category_id);
                  return (
                    <Card
                      key={tid}
                      className={cn(
                        "rounded-none border-border overflow-hidden hover:shadow-lg transition-all flex flex-col justify-between",
                        design.default_design && "border-amber-500/50 bg-amber-500/5"
                      )}
                    >
                      <div>
                        <CardHeader className="py-4 border-b border-border bg-muted/20 flex flex-row items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-heading font-black text-base uppercase text-foreground">
                                {design.template_name}
                              </h3>
                              {design.default_design && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-amber-500 text-black px-2 py-0.5">
                                  <Star className="w-3 h-3 fill-black text-black" />
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                              {category && <span className="font-medium text-foreground">{category.name}</span>}
                              {course && <span>• {course.course_name}</span>}
                            </div>
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-muted border border-border">
                            {design.orientation}
                          </span>
                        </CardHeader>
                        <CardContent className="p-5 space-y-3">
                          <div className="text-xs text-muted-foreground flex items-center justify-between">
                            <span className="font-mono text-[10px] uppercase">ID: {tid.slice(-8)}</span>
                            <span className="font-bold uppercase text-[10px]">{design.template_type}</span>
                          </div>
                        </CardContent>
                      </div>

                      <div className="p-4 bg-muted/30 border-t border-border flex flex-wrap gap-2 justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <Button
                            size="sm"
                            className="rounded-none font-bold uppercase tracking-wider text-[10px] flex-1"
                            onClick={() => navigate(`/dashboard/attachments/certificate-designer/${tid}`)}
                          >
                            <PenTool className="w-3.5 h-3.5 mr-1" />
                            Canvas Editor
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-none text-[10px] font-bold uppercase tracking-wider border-border"
                            onClick={() => handleEditDesign(design)}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className={cn("rounded-none text-[10px] font-bold uppercase tracking-wider", design.default_design && "border-amber-500 text-amber-500")}
                            onClick={() => handleSetDefault(tid)}
                            disabled={design.default_design}
                          >
                            <Star className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-none text-destructive hover:text-destructive border-border text-[10px]"
                            onClick={() => handleDeleteDesign(tid, design.template_name)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Modal: Add Blank Design */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="rounded-none border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading font-extrabold text-xl uppercase">Add Blank Custom Design</DialogTitle>
              <p className="text-xs text-muted-foreground">Create a fresh design canvas from scratch.</p>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Design Title</label>
                <Input
                  value={newDesignName}
                  onChange={(e) => setNewDesignName(e.target.value)}
                  placeholder="e.g. Master Course Certificate 2026"
                  className="rounded-none border-border"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Document Type</label>
                  <Select value={newDesignType} onValueChange={setNewDesignType}>
                    <SelectTrigger className="rounded-none border-border text-xs">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="certificate">Certificate</SelectItem>
                      <SelectItem value="marksheet">Marksheet</SelectItem>
                      <SelectItem value="id_card">ID Card</SelectItem>
                      <SelectItem value="letter">Letter / Agreement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Orientation</label>
                  <Select value={newDesignOrientation} onValueChange={setNewDesignOrientation}>
                    <SelectTrigger className="rounded-none border-border text-xs">
                      <SelectValue placeholder="Select orientation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="landscape">Landscape</SelectItem>
                      <SelectItem value="portrait">Portrait</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course Category (Optional)</label>
                <Select value={newDesignCategory || "all"} onValueChange={(val) => { setNewDesignCategory(val || "all"); setNewDesignCourse("all"); }}>
                  <SelectTrigger className="rounded-none border-border text-xs">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">None / All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course (Optional)</label>
                <Select value={newDesignCourse || "all"} onValueChange={(val) => setNewDesignCourse(val || "all")} disabled={!newDesignCategory || newDesignCategory === "all"}>
                  <SelectTrigger className="rounded-none border-border text-xs">
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">None / All Courses</SelectItem>
                    {filteredCoursesForAdd.map(course => (
                      <SelectItem key={course.id} value={course.id}>{course.course_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-none font-bold uppercase text-xs" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddDesign} disabled={isCreating} className="rounded-none font-bold uppercase text-xs px-6">
                {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <PlusCircle className="w-3.5 h-3.5 mr-2" />}
                Create & Launch Editor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Edit Design */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="rounded-none border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading font-extrabold text-xl uppercase">Edit Design Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Design Name</label>
                <Input
                  value={editDesignName}
                  onChange={(e) => setEditDesignName(e.target.value)}
                  className="rounded-none border-border"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Document Type</label>
                <Select value={editDesignType} onValueChange={setEditDesignType}>
                  <SelectTrigger className="rounded-none border-border text-xs">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="certificate">Certificate</SelectItem>
                    <SelectItem value="marksheet">Marksheet</SelectItem>
                    <SelectItem value="id_card">ID Card</SelectItem>
                    <SelectItem value="letter">Letter</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course Category</label>
                <Select value={editDesignCategory || "all"} onValueChange={(val) => { setEditDesignCategory(val || "all"); setEditDesignCourse("all"); }}>
                  <SelectTrigger className="rounded-none border-border text-xs">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">None</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course</label>
                <Select value={editDesignCourse || "all"} onValueChange={(val) => setEditDesignCourse(val || "all")} disabled={!editDesignCategory || editDesignCategory === "all"}>
                  <SelectTrigger className="rounded-none border-border text-xs">
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">None</SelectItem>
                    {categories.find(c => c.id === editDesignCategory) ? courses.filter(c => c.category_id === editDesignCategory).map(course => (
                      <SelectItem key={course.id} value={course.id}>{course.course_name}</SelectItem>
                    )) : []}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-none font-bold uppercase text-xs" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateDesign} disabled={isUpdating} className="rounded-none font-bold uppercase text-xs px-6">
                {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Generation Settings */}
        <Dialog open={isGenerationTimeDialogOpen} onOpenChange={setIsGenerationTimeDialogOpen}>
          <DialogContent className="rounded-none border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading font-extrabold text-xl uppercase">Auto Generation Delay Settings</DialogTitle>
              <p className="text-xs text-muted-foreground">Set automatic delay in days after course completion.</p>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider">Marksheet Generation Delay (days)</label>
                <Input
                  type="number"
                  min="0"
                  value={marksheetDays}
                  onChange={(e) => setMarksheetDays(parseInt(e.target.value || "0"))}
                  className="rounded-none border-border"
                />
                <p className="text-[10px] text-muted-foreground">Set 0 for immediate generation upon exam completion.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider">Certificate Generation Delay (days)</label>
                <Input
                  type="number"
                  min="0"
                  value={certificateDays}
                  onChange={(e) => setCertificateDays(parseInt(e.target.value || "0"))}
                  className="rounded-none border-border"
                />
                <p className="text-[10px] text-muted-foreground">Set 0 for immediate generation.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-none font-bold uppercase text-xs" onClick={() => setIsGenerationTimeDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveGenerationSettings} className="rounded-none font-bold uppercase text-xs px-6">
                Save Settings
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
