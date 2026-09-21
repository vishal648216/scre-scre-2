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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  StarOff,
  Edit,
  Settings,
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

export default function CertificateDesignerListPage() {
  const [designs, setDesigns] = useState<Template[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDesign, setEditingDesign] = useState<Template | null>(null);
  const [newDesignName, setNewDesignName] = useState("");
  const [editDesignName, setEditDesignName] = useState("");
  const [newDesignOrientation, setNewDesignOrientation] = useState("portrait");
  const [editDesignOrientation, setEditDesignOrientation] = useState("portrait");
  const [newDesignType, setNewDesignType] = useState("certificate");
  const [editDesignType, setEditDesignType] = useState("certificate");
  const [newDesignCategory, setNewDesignCategory] = useState<string | null>("all");
  const [editDesignCategory, setEditDesignCategory] = useState<string | null>("all");
  const [newDesignCourse, setNewDesignCourse] = useState<string | null>("all");
  const [editDesignCourse, setEditDesignCourse] = useState<string | null>("all");
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Set Generation Time Dialog
  const [isGenerationTimeDialogOpen, setIsGenerationTimeDialogOpen] = useState(false);
  const [marksheetDays, setMarksheetDays] = useState(0);
  const [certificateDays, setCertificateDays] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>("all");
  const [filterCourse, setFilterCourse] = useState<string | null>("all");
  const [filterType, setFilterType] = useState<string | null>("all");
  const [sortBy, setSortBy] = useState("newest");

  const navigate = useNavigate();

  const loadCategories = useCallback(async () => {
    try {
      const res = await apiFetch("/api/public/categories");
      if (res.ok) {
        const data = await res.json();
        // Handle both array and { items: [] } responses
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
    } catch (e) {
      console.error("Failed to load generation settings", e);
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
    } catch (e) {
      toast.error("Failed to save settings");
    }
  };

  useEffect(() => {
    loadCategories();
    loadCourses();
    loadDesigns();
    loadGenerationSettings();
  }, [loadCategories, loadCourses, loadDesigns, loadGenerationSettings]);

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
        toast.success("Design created!");
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
        toast.success("Deleted");
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
        toast.success("Set as default!");
        loadDesigns();
      } else {
        toast.error("Failed to set as default");
      }
    } catch {
      toast.error("Failed to set as default");
    }
  };

  const handleEditDesign = (design: Template) => {
    console.log("Edit design called with:", design);
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
        toast.success("Design updated!");
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

  const handleDesignClick = (id: string) => {
    navigate(`/dashboard/attachments/certificate-designer/${id}`);
  };

  const filteredCoursesForAdd = useMemo(() => {
    if (!newDesignCategory) return [];
    return courses.filter(c => c.category_id === newDesignCategory);
  }, [courses, newDesignCategory]);

  const filteredCoursesForFilter = useMemo(() => {
    if (!filterCategory) return [];
    return courses.filter(c => c.category_id === filterCategory);
  }, [courses, filterCategory]);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading font-bold text-2xl uppercase tracking-tight">
              Certificate Designer
            </h1>
            <p className="text-muted-foreground text-sm">
              Create and manage certificate and marksheet designs
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                loadGenerationSettings();
                setIsGenerationTimeDialogOpen(true);
              }}
              className="rounded-none gap-2"
            >
              <Settings className="w-4 h-4" />
              Set Generation Time
            </Button>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="rounded-none gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Add Design
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-4 rounded-none border border-border">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search designs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterType || "all"} onValueChange={(val) => setFilterType(val || "all")}>
              <SelectTrigger className="w-[150px] rounded-none">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="certificate">Certificate</SelectItem>
                <SelectItem value="marksheet">Marksheet</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategory || "all"} onValueChange={(val) => { setFilterCategory(val || "all"); setFilterCourse("all"); }}>
              <SelectTrigger className="w-[150px] rounded-none">
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
              <SelectTrigger className="w-[150px] rounded-none">
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
              <SelectTrigger className="w-[150px] rounded-none">
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

        {loading ? (
          <div className="text-muted-foreground py-16 text-center">Loading...</div>
        ) : designs.length === 0 ? (
          <Card className="rounded-none border-border">
            <CardContent className="py-16 text-center">
              <Layers className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                No certificate designs yet
              </p>
              <Button
                variant="outline"
                className="rounded-none"
                onClick={() => setIsAddDialogOpen(true)}
              >
                Design your first certificate
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {designs.map((design) => {
            const tid = toId(design.id);
            const course = courses.find(c => c.id === design.course_id);
            const category = categories.find(c => c.id === design.course_category_id);
            return (
              <Card
                key={tid}
                  className="rounded-none border-border overflow-hidden hover:shadow-md transition-shadow"
                >
                  <CardHeader className="py-3 flex flex-row items-center justify-between">
                    <div>
                      <span className="font-bold text-sm uppercase flex items-center gap-2">
                        {design.template_name}
                        {design.default_design && <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />}
                      </span>
                      {category && (
                        <span className="text-xs text-muted-foreground">
                          {category.name}
                        </span>
                      )}
                      {course && (
                        <span className="text-xs text-muted-foreground ml-2">
                          • {course.course_name}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground uppercase">
                      {design.orientation}
                    </span>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-none gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditDesign(design);
                        }}
                      >
                        <Edit className="w-3 h-3" />
                        Edit Details
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-none gap-1"
                        onClick={() => handleDesignClick(tid)}
                      >
                        <PenTool className="w-3 h-3" />
                        Design
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-none gap-1"
                        onClick={() => handleSetDefault(tid)}
                        disabled={design.default_design}
                      >
                        {design.default_design ? (
                          <>
                            Default
                          </>
                        ) : (
                          <>
                            Set as Default
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-none text-destructive hover:text-destructive gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDesign(tid, design.template_name);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="rounded-none">
            <DialogHeader>
              <DialogTitle>Add New Design</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Design Name</label>
                <Input
                  value={newDesignName}
                  onChange={(e) => setNewDesignName(e.target.value)}
                  placeholder="Enter design name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select value={newDesignType} onValueChange={setNewDesignType}>
                  <SelectTrigger className="rounded-none">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="certificate">Certificate</SelectItem>
                    <SelectItem value="marksheet">Marksheet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Orientation</label>
                <Select value={newDesignOrientation} onValueChange={setNewDesignOrientation}>
                  <SelectTrigger className="rounded-none">
                    <SelectValue placeholder="Select orientation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">
                      <div className="flex items-center gap-2">
                        <MonitorSmartphone className="w-4 h-4" />
                        Portrait
                      </div>
                    </SelectItem>
                    <SelectItem value="landscape">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4" />
                        Landscape
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Course Category (Optional)</label>
                <Select value={newDesignCategory || "all"} onValueChange={(val) => { setNewDesignCategory(val || "all"); setNewDesignCourse("all"); }}>
                  <SelectTrigger className="rounded-none">
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Course (Optional)</label>
                <Select value={newDesignCourse || "all"} onValueChange={(val) => setNewDesignCourse(val || "all")} disabled={!newDesignCategory || newDesignCategory === "all"}>
                  <SelectTrigger className="rounded-none">
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">None</SelectItem>
                    {filteredCoursesForAdd.map(course => (
                      <SelectItem key={course.id} value={course.id}>{course.course_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddDesign} disabled={isCreating}>
                {isCreating ? "Creating..." : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="rounded-none">
            <DialogHeader>
              <DialogTitle>Edit Design</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Design Name</label>
                <Input
                  value={editDesignName}
                  onChange={(e) => setEditDesignName(e.target.value)}
                  placeholder="Enter design name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select value={editDesignType} onValueChange={setEditDesignType}>
                  <SelectTrigger className="rounded-none">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="certificate">Certificate</SelectItem>
                    <SelectItem value="marksheet">Marksheet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Course Category (Optional)</label>
                <Select value={editDesignCategory || "all"} onValueChange={(val) => { setEditDesignCategory(val || "all"); setEditDesignCourse("all"); }}>
                  <SelectTrigger className="rounded-none">
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Course (Optional)</label>
                <Select value={editDesignCourse || "all"} onValueChange={(val) => setEditDesignCourse(val || "all")} disabled={!editDesignCategory || editDesignCategory === "all"}>
                  <SelectTrigger className="rounded-none">
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
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateDesign} disabled={isUpdating}>
                {isUpdating ? "Updating..." : "Update"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isGenerationTimeDialogOpen} onOpenChange={setIsGenerationTimeDialogOpen}>
          <DialogContent className="rounded-none">
            <DialogHeader>
              <DialogTitle>Set Generation Time</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Marksheet Generation Delay (days)
                </label>
                <p className="text-xs text-muted-foreground">
                  Set 0 for immediate generation
                </p>
                <Input
                  type="number"
                  min="0"
                  value={marksheetDays}
                  onChange={(e) => setMarksheetDays(parseInt(e.target.value || "0"))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Certificate Generation Delay (days)
                </label>
                <p className="text-xs text-muted-foreground">
                  Set 0 for immediate generation
                </p>
                <Input
                  type="number"
                  min="0"
                  value={certificateDays}
                  onChange={(e) => setCertificateDays(parseInt(e.target.value || "0"))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsGenerationTimeDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveGenerationSettings}>Save Settings</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
