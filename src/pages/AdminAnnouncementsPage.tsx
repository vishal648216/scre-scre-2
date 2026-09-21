import { useState, useEffect, useCallback, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Loader2, Trash2, Megaphone, Users, Check, X, Search, Edit2, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Announcement {
  id?: string;
  _id?: string;
  title: string;
  content: string;
  target_type: string;
  target_centers?: string[];
  target_students?: string[];
  sender_role: string;
  priority: string;
  created_at: string;
  is_edited?: boolean;
  edited_at?: string;
  category_id?: string;
}

interface Category {
  id?: string;
  _id?: string;
  name: string;
  is_system?: boolean;
  created_at: string;
}

interface Center {
  id?: string;
  _id?: string;
  name: string;
  code: string;
}

interface Student {
  id?: string;
  _id?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  enrollment_number?: string;
  parent_id?: string;
}

const AdminAnnouncementsPage = () => {
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [centers, setCenters] = useState<Center[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCenters, setLoadingCenters] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Initialize with empty string arrays to be safe
  const [form, setForm] = useState({
    title: "",
    content: "",
    target_type: "allstudents",
    priority: "medium",
    target_centers: [] as string[],
    target_students: [] as string[],
    category_id: "" as string | undefined
  });

  // Filtering
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [categorySearchFilter, setCategorySearchFilter] = useState("");

  // Category dropdown state
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categoryDropdownSearch, setCategoryDropdownSearch] = useState("");
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  // Modal states
  const [isCenterModalOpen, setIsCenterModalOpen] = useState(false);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [tempCenterSelection, setTempCenterSelection] = useState<string[]>([]);
  const [tempStudentSelection, setTempStudentSelection] = useState<string[]>([]);
  const [centerSearch, setCenterSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  // Helper to get id from center/student (id or _id)
  const getEntityId = (entity: any): string => {
    console.log('getEntityId called! Entity:', entity);
    console.log('entity.id:', entity?.id);
    console.log('entity._id:', entity?._id);
    if (!entity) return '';
    if (typeof entity === 'string') return entity;
    return entity.id || entity._id || '';
  };

  // Filtered lists
  const filteredCenters = centers.filter(center => {
    const centerName = center?.name || "";
    const centerCode = center?.code || "";
    const searchLower = centerSearch.toLowerCase();
    return centerName.toLowerCase().includes(searchLower) || centerCode.toLowerCase().includes(searchLower);
  });

  const filteredStudents = students.filter(student => {
    const studentName = student?.full_name || student?.first_name || student?.last_name || "";
    const regNumber = student?.enrollment_number || "";
    const searchLower = studentSearch.toLowerCase();
    return studentName.toLowerCase().includes(searchLower) || regNumber.toLowerCase().includes(searchLower);
  });

  // Helper to get center name safely
  const getCenterName = useCallback((centerId: string) => {
    try {
      return centers.find(c => getEntityId(c) === centerId)?.name || "Unknown Center";
    } catch {
      return "Unknown Center";
    }
  }, [centers]);

  // Safe fetch for announcements
  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const response = await fetch("/api/announcements", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAnnouncements(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching announcements:", error);
      toast.error("Failed to load announcements");
    } finally {
      setLoading(false);
    }
  }, []);

  // Safe fetch for centers
  const fetchCenters = useCallback(async () => {
    setLoadingCenters(true);
    try {
      const token = sessionStorage.getItem("token");
      const response = await fetch("/api/centers", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      console.log("Centers response status:", response.status);
      if (response.ok) {
        const data = await response.json();
        console.log("Centers data received:", data);
        console.log("First center in data:", data[0]);
        console.log("First center id:", data[0]?.id);
        console.log("First center _id:", data[0]?._id);
        setCenters(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching centers:", error);
    } finally {
      setLoadingCenters(false);
    }
  }, []);

  // Safe fetch for students
  const fetchStudents = useCallback(async () => {
    setLoadingStudents(true);
    try {
      const token = sessionStorage.getItem("token");
      const response = await fetch("/api/students", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      console.log("Students response status:", response.status);
      if (response.ok) {
        const data = await response.json();
        console.log("Students data received:", data);
        console.log("First student in data:", data[0]);
        console.log("First student id:", data[0]?.id);
        console.log("First student _id:", data[0]?._id);
        setStudents(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  // Safe fetch for categories
  const fetchCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const token = sessionStorage.getItem("token");
      const response = await fetch("/api/categories", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  // Create new category
  const createCategory = useCallback(async () => {
    if (!newCategoryName.trim()) return;
    setCreatingCategory(true);
    try {
      const token = sessionStorage.getItem("token");
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name: newCategoryName.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success("Category created!");
        // Auto select the new category
        if (data.category) {
          setForm(prev => ({
            ...prev,
            category_id: data.category.id
          }));
        }
        setNewCategoryName("");
        setIsAddingNewCategory(false);
        setIsCategoryDropdownOpen(false);
        fetchCategories();
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to create category");
      }
    } catch (error) {
      console.error("Error creating category:", error);
      toast.error("Failed to create category");
    } finally {
      setCreatingCategory(false);
    }
  }, [newCategoryName, fetchCategories]);

  // Delete category
  const deleteCategory = useCallback(async (categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the category when clicking delete
    if (!window.confirm("Are you sure you want to delete this category?")) {
      return;
    }
    try {
      const token = sessionStorage.getItem("token");
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success("Category deleted successfully!");
        // If the deleted category is currently selected, unselect it
        if (form.category_id === categoryId) {
          setForm(prev => ({
            ...prev,
            category_id: undefined
          }));
        }
        // Also unselect from filter if needed
        if (selectedCategoryFilter === categoryId) {
          setSelectedCategoryFilter(null);
        }
        fetchCategories();
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to delete category");
      }
    } catch (error) {
      console.error("Error deleting category:", error);
      toast.error("Failed to delete category");
    }
  }, [form.category_id, selectedCategoryFilter, fetchCategories]);

  // Initialize data
  useEffect(() => {
    try {
      const storedUser = sessionStorage.getItem("user");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
      }
    } catch (error) {
      console.error("Error parsing user data:", error);
    }

    fetchAnnouncements();
    fetchCenters();
    fetchStudents();
    fetchCategories();
  }, [fetchAnnouncements, fetchCenters, fetchStudents, fetchCategories]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Start editing an announcement
  const startEdit = useCallback((announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setIsAdding(true);
    setForm({
      title: announcement.title,
      content: announcement.content,
      target_type: announcement.target_type,
      priority: announcement.priority,
      target_centers: announcement.target_centers || [],
      target_students: announcement.target_students || [],
      category_id: announcement.category_id || ""
    });
  }, []);

  // Cancel editing
  const cancelEdit = useCallback(() => {
    setEditingAnnouncement(null);
    setIsAdding(false);
    setForm({
      title: "",
      content: "",
      target_type: "allstudents",
      priority: "medium",
      target_centers: [],
      target_students: [],
      category_id: ""
    });
  }, []);

  // Handle form submission (create or edit)
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = sessionStorage.getItem("token");
      
      // Clean target_centers and target_students to ensure only string ids
      const cleanedTargetCenters = form.target_centers
        .map(id => {
          const cleaned = getEntityId(id);
          console.log('Cleaning center id:', id, '→', cleaned);
          return cleaned;
        })
        .filter(id => id && typeof id === 'string');

      const cleanedTargetStudents = form.target_students
        .map(id => {
          const cleaned = getEntityId(id);
          console.log('Cleaning student id:', id, '→', cleaned);
          return cleaned;
        })
        .filter(id => id && typeof id === 'string');

      const payload = {
        title: form.title,
        content: form.content,
        target_type: form.target_type,
        priority: form.priority,
        target_centers: cleanedTargetCenters.length > 0 ? cleanedTargetCenters : undefined,
        target_students: cleanedTargetStudents.length > 0 ? cleanedTargetStudents : undefined,
        category_id: form.category_id || undefined
      };
      
      console.log("FINAL CLEANED announcement payload to send:", payload);
      console.log("Type of target_centers[0] (if exists):", payload.target_centers?.[0], typeof payload.target_centers?.[0]);
      console.log("Type of target_students[0] (if exists):", payload.target_students?.[0], typeof payload.target_students?.[0]);

      let response;
      if (editingAnnouncement) {
        // Edit existing announcement
        const annId = getEntityId(editingAnnouncement);
        console.log("Editing announcement with id:", annId);
        response = await fetch(`/api/announcements/${annId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      } else {
        // Create new announcement
        response = await fetch("/api/announcements", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }

      console.log("Response status:", response.status);
      const responseText = await response.text();
      console.log("Response raw text:", responseText);
      let responseData;
      try {
        responseData = JSON.parse(responseText);
        console.log("Response data:", responseData);
      } catch (e) {
        responseData = { message: responseText };
      }

      if (response.ok) {
        toast.success(editingAnnouncement ? "Announcement updated" : "Announcement broadcasted");
        setIsAdding(false);
        setEditingAnnouncement(null);
        setForm({
          title: "",
          content: "",
          target_type: "allstudents",
          priority: "medium",
          target_centers: [],
          target_students: [],
          category_id: ""
        });
        fetchAnnouncements();
      } else {
        toast.error(`Failed to ${editingAnnouncement ? "update" : "send"} announcement: ${responseData.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error sending/updating announcement:", error);
      toast.error(`Failed to ${editingAnnouncement ? "update" : "send"} announcement: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }, [form, fetchAnnouncements, editingAnnouncement]);

  // Modal handlers - CLEAN when opening modal
  const openCenterModal = () => {
    // Clean form.target_centers to ensure only string ids first
    const cleaned = form.target_centers.map(id => getEntityId(id)).filter(id => id && typeof id === 'string');
    console.log('Opening center modal, cleaned selection:', cleaned);
    setTempCenterSelection(cleaned);
    setCenterSearch("");
    setIsCenterModalOpen(true);
  };

  const saveCenterSelection = () => {
    // Ensure temp selection only has string ids
    const cleaned = tempCenterSelection.map(id => getEntityId(id)).filter(id => id && typeof id === 'string');
    console.log('Saving center selection:', cleaned);
    setForm(prev => ({ ...prev, target_centers: cleaned }));
    setIsCenterModalOpen(false);
  };

  const openStudentModal = () => {
    const cleaned = form.target_students.map(id => getEntityId(id)).filter(id => id && typeof id === 'string');
    console.log('Opening student modal, cleaned selection:', cleaned);
    setTempStudentSelection(cleaned);
    setStudentSearch("");
    setIsStudentModalOpen(true);
  };

  const saveStudentSelection = () => {
    const cleaned = tempStudentSelection.map(id => getEntityId(id)).filter(id => id && typeof id === 'string');
    console.log('Saving student selection:', cleaned);
    setForm(prev => ({ ...prev, target_students: cleaned }));
    setIsStudentModalOpen(false);
  };

  // Toggle functions - NOW ONLY ADD STRING IDS!
  const toggleTempCenter = (center: Center) => {
    const centerId = getEntityId(center);
    console.log('toggleTempCenter called! Center:', center);
    console.log('Extracted centerId:', centerId);
    if (!centerId || typeof centerId !== 'string') {
      console.error('Invalid centerId:', centerId, typeof centerId);
      return;
    }
    
    setTempCenterSelection(prev => {
      if (prev.includes(centerId)) {
        return prev.filter(id => id !== centerId);
      }
      return [...prev, centerId];
    });
  };

  const toggleTempStudent = (student: Student) => {
    const studentId = getEntityId(student);
    console.log('toggleTempStudent called! Student:', student);
    console.log('Extracted studentId:', studentId);
    if (!studentId || typeof studentId !== 'string') {
      console.error('Invalid studentId:', studentId, typeof studentId);
      return;
    }

    setTempStudentSelection(prev => {
      if (prev.includes(studentId)) {
        return prev.filter(id => id !== studentId);
      }
      return [...prev, studentId];
    });
  };

  const getTargetLabel = (ann: Announcement) => {
    switch (ann.target_type) {
      case "allcenters": return "All Centers";
      case "allstudents": return "All Students";
      case "allusers": return "All Users";
      case "selectedcenters": return `Selected Centers (${ann.target_centers?.length || 0})`;
      case "selectedstudents": return `Selected Students (${ann.target_students?.length || 0})`;
      case "selectedcentersandstudents": return "Selected Centers & Students";
      default: return ann.target_type;
    }
  };

  // Helper to get student name
  const getStudentName = (student: Student) => {
    return student.full_name || 
           (student.first_name && student.last_name ? `${student.first_name} ${student.last_name}` : 
            student.first_name || student.last_name || "Unknown Student");
  };

  // Helper to get student enrollment number
  const getStudentEnrollmentNumber = (student: Student) => {
    return student.enrollment_number || "-";
  };

  // Helper to get category name
  const getCategoryName = useCallback((categoryId: string | undefined) => {
    if (!categoryId) return "";
    return categories.find(c => getEntityId(c) === categoryId)?.name || "";
  }, [categories]);

  // Filtered categories for the selector
  const filteredCategoriesForDropdown = categories.filter(cat => {
    const nameLower = cat.name.toLowerCase();
    const searchLower = categoryDropdownSearch.toLowerCase();
    return nameLower.includes(searchLower);
  });

  const filteredCategoriesForFilter = categories.filter(cat => {
    const nameLower = cat.name.toLowerCase();
    const searchLower = categorySearchFilter.toLowerCase();
    return nameLower.includes(searchLower);
  });

  // Filtered announcements
  const filteredAnnouncements = selectedCategoryFilter
    ? announcements.filter(ann => ann.category_id === selectedCategoryFilter)
    : announcements;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">System Announcements</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Broadcast updates and notices to centers and students.</p>
          </div>
          <button
            onClick={() => {
              if (editingAnnouncement) {
                cancelEdit();
              } else {
                setIsAdding(!isAdding);
              }
            }}
            className={cn(
              "px-6 py-3 rounded-none font-heading font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center gap-2",
              isAdding ? "bg-muted text-foreground" : "bg-primary text-primary-foreground shadow-lg hover:opacity-90"
            )}
          >
            {isAdding ? "Cancel" : <><Megaphone className="w-4 h-4" /> New Broadcast</>}
          </button>
        </div>

        {isAdding && (
          <Card className="rounded-none border-primary shadow-xl overflow-hidden animate-in slide-in-from-top-4 duration-500">
            <CardHeader className="bg-primary/5 border-b border-primary/10">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-primary">
                <Send className="w-4 h-4" />
                {editingAnnouncement ? "Edit Announcement" : "Compose Announcement"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest">Title</label>
                    <input
                      required
                      placeholder="e.g., Holiday Notice / Exam Update"
                      className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest">Priority</label>
                    <select
                      className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none appearance-none"
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    >
                      <option value="low">LOW</option>
                      <option value="medium">MEDIUM</option>
                      <option value="high">HIGH</option>
                      <option value="urgent">URGENT</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest">Category</label>
                  <div className="relative" ref={categoryDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                      className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none flex items-center justify-between"
                    >
                      {form.category_id ? getCategoryName(form.category_id) : "Select a category..."}
                      <span className="ml-2">▼</span>
                    </button>

                    {isCategoryDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-none shadow-lg max-h-60 overflow-y-auto">
                        <div className="p-2 border-b border-border">
                          <input
                            type="text"
                            placeholder="Search categories..."
                            value={categoryDropdownSearch}
                            onChange={(e) => setCategoryDropdownSearch(e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-none text-sm focus:border-primary outline-none"
                          />
                        </div>

                        <div
                          className="px-4 py-2 hover:bg-primary/10 cursor-pointer text-sm"
                          onClick={() => {
                            setIsAddingNewCategory(true);
                          }}
                        >
                          + Add New Category
                        </div>

                        {isAddingNewCategory && (
                          <div className="p-2 border-t border-border">
                            <input
                              type="text"
                              placeholder="Enter category name..."
                              value={newCategoryName}
                              onChange={(e) => setNewCategoryName(e.target.value)}
                              className="w-full px-3 py-2 border border-border rounded-none text-sm focus:border-primary outline-none mb-2"
                              onKeyDown={(e) => e.key === "Enter" && createCategory()}
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsAddingNewCategory(false);
                                  setNewCategoryName("");
                                }}
                                className="flex-1 px-3 py-1 border border-border rounded-none text-xs font-bold hover:bg-muted"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={createCategory}
                                disabled={creatingCategory || !newCategoryName.trim()}
                                className="flex-1 px-3 py-1 bg-primary text-white rounded-none text-xs font-bold hover:opacity-90 disabled:opacity-50"
                              >
                                {creatingCategory ? "Creating..." : "Create"}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="px-4 py-2 hover:bg-primary/10 cursor-pointer text-sm" onClick={() => {
                          setForm({ ...form, category_id: undefined });
                          setIsCategoryDropdownOpen(false);
                        }}>
                          None
                        </div>

                        {filteredCategoriesForDropdown.map(cat => (
                          <div
                            key={getEntityId(cat)}
                            className={`px-4 py-2 hover:bg-primary/10 cursor-pointer text-sm flex items-center justify-between ${form.category_id === getEntityId(cat) ? "bg-primary/10" : ""}`}
                            onClick={() => {
                              setForm({ ...form, category_id: getEntityId(cat) });
                              setIsCategoryDropdownOpen(false);
                            }}
                          >
                            <span>{cat.name}</span>
                            {!cat.is_system && (
                              <button
                                type="button"
                                onClick={(e) => deleteCategory(getEntityId(cat), e)}
                                className="text-red-500 hover:text-red-700 ml-2"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest">Target Audience</label>
                  <select
                    className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none appearance-none"
                    value={form.target_type}
                    onChange={(e) => setForm({ ...form, target_type: e.target.value, target_centers: [], target_students: [] })}
                  >
                    <option value="allusers">All Users (Centers & Students)</option>
                    <option value="allcenters">All Centers</option>
                    <option value="allstudents">All Students</option>
                    <option value="selectedcenters">Selected Centers</option>
                    <option value="selectedstudents">Selected Students</option>
                    <option value="selectedcentersandstudents">Selected Centers & Students</option>
                  </select>
                </div>

                {(form.target_type === "selectedcenters" || form.target_type === "selectedcentersandstudents") && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-widest">Select Centers</label>
                      <button
                        type="button"
                        onClick={openCenterModal}
                        className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-none hover:opacity-90"
                      >
                        Select Centers ({form.target_centers.length})
                      </button>
                    </div>
                    {form.target_centers.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-3 border border-border">
                        {form.target_centers.map(id => (
                          <span key={id} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">
                            {getCenterName(id)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {(form.target_type === "selectedstudents" || form.target_type === "selectedcentersandstudents") && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-widest">Select Students</label>
                      <button
                        type="button"
                        onClick={openStudentModal}
                        className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-none hover:opacity-90"
                      >
                        Select Students ({form.target_students.length})
                      </button>
                    </div>
                    {form.target_students.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-3 border border-border">
                        {form.target_students.slice(0, 10).map(id => {
                          const student = students.find(s => getEntityId(s) === id);
                          return (
                            <span key={id} className="px-2 py-1 bg-secondary/10 text-secondary text-xs rounded">
                              {student ? getStudentName(student) : "Unknown"}
                            </span>
                          );
                        })}
                        {form.target_students.length > 10 && (
                          <span className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded">
                            +{form.target_students.length - 10} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest">Message Content</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Type your message here..."
                    className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none resize-none"
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-primary text-primary-foreground px-10 py-4 rounded-none font-heading font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all flex items-center gap-3 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
                    {editingAnnouncement ? "Update Now" : "Broadcast Now"}
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Category Filter */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search categories..."
                value={categorySearchFilter}
                onChange={(e) => setCategorySearchFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none"
              />
            </div>
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-2 overflow-x-auto">
            <button
              onClick={() => setSelectedCategoryFilter(null)}
              className={cn(
                "px-4 py-2 text-xs font-black uppercase tracking-widest rounded-none border transition-all",
                !selectedCategoryFilter
                  ? "bg-primary text-white border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50"
              )}
            >
              All
            </button>
            {filteredCategoriesForFilter.map(cat => (
              <button
                key={getEntityId(cat)}
                onClick={() => setSelectedCategoryFilter(getEntityId(cat))}
                className={cn(
                  "px-4 py-2 text-xs font-black uppercase tracking-widest rounded-none border transition-all",
                  selectedCategoryFilter === getEntityId(cat)
                    ? "bg-primary text-white border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Recent Broadcasts</h2>
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="py-20 border border-border border-dashed text-center opacity-60">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">No announcements in this category</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredAnnouncements.map(ann => (
                <Card key={getEntityId(ann)} className={cn(
                  "rounded-none border-border shadow-md hover:border-primary/40 transition-all overflow-hidden border-l-4",
                  ann.priority === "urgent" ? "border-l-destructive" : "border-l-primary"
                )}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                    <h3 className="text-lg font-black uppercase tracking-tight text-foreground">{ann.title}</h3>
                    {ann.category_id && (
                      <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-200">
                        {getCategoryName(ann.category_id)}
                      </span>
                    )}
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 border",
                      ann.priority === "urgent" ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-primary/10 text-primary border-primary/20"
                    )}>
                      {ann.priority}
                    </span>
                    {ann.is_edited && (
                      <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200">
                        Edited
                      </span>
                    )}
                  </div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                          <Users className="w-3 h-3" /> {getTargetLabel(ann)}
                          <span className="mx-1">•</span>
                          From: {ann.sender_role}
                          <span className="mx-1">•</span>
                          {format(new Date(ann.created_at), "dd MMM yyyy, hh:mm a")}
                          {ann.is_edited && ann.edited_at && (
                            <>
                              <span className="mx-1">•</span>
                              Edited: {format(new Date(ann.edited_at), "dd MMM yyyy, hh:mm a")}
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(ann)}
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-foreground/80 leading-relaxed bg-muted/20 p-4 border border-border/50 italic">
                      "{ann.content}"
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center Selection Modal - fixed at top */}
      {isCenterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-8">
          <div className="bg-white w-full max-w-4xl rounded-lg shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-xl font-bold">Select Centers</h3>
              <button onClick={() => setIsCenterModalOpen(false)} className="p-2 rounded hover:bg-muted">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search centers by name or code..."
                  value={centerSearch}
                  onChange={(e) => setCenterSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-border rounded-none focus:border-primary outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingCenters ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : filteredCenters.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No centers found
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-muted/30 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-muted-foreground">Select</th>
                      <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-muted-foreground">Center Name</th>
                      <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-muted-foreground">Center Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredCenters.map(center => {
                      const centerId = getEntityId(center);
                      const isSelected = centerId && tempCenterSelection.includes(centerId);
                      return (
                        <tr
                          key={centerId || Math.random().toString()}
                          onClick={() => toggleTempCenter(center)}
                          className={cn(
                            "cursor-pointer transition-colors",
                            isSelected ? "bg-primary/10" : "hover:bg-muted/30"
                          )}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={cn(
                              "w-6 h-6 rounded border flex items-center justify-center",
                              isSelected ? "bg-primary border-primary text-white" : "border-border"
                            )}>
                              {isSelected && <Check className="w-4 h-4" />}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-foreground">{center?.name || "Unknown"}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{center?.code || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-end gap-4 p-6 border-t border-border">
              <button
                onClick={() => setIsCenterModalOpen(false)}
                className="px-6 py-2 border border-border rounded-none text-sm font-bold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={saveCenterSelection}
                className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-none hover:opacity-90 flex items-center gap-2"
              >
                Save Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Selection Modal - fixed at top */}
      {isStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-8">
          <div className="bg-white w-full max-w-4xl rounded-lg shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-xl font-bold">Select Students</h3>
              <button onClick={() => setIsStudentModalOpen(false)} className="p-2 rounded hover:bg-muted">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search students by name or enrollment number..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-border rounded-none focus:border-primary outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingStudents ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No students found
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-muted/30 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-muted-foreground">Select</th>
                      <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-muted-foreground">Student Name</th>
                      <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-muted-foreground">Enrollment Number</th>
                      <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-muted-foreground">Center</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredStudents.map(student => {
                      const studentId = getEntityId(student);
                      const isSelected = studentId && tempStudentSelection.includes(studentId);
                      return (
                        <tr
                          key={studentId || Math.random().toString()}
                          onClick={() => toggleTempStudent(student)}
                          className={cn(
                            "cursor-pointer transition-colors",
                            isSelected ? "bg-secondary/10" : "hover:bg-muted/30"
                          )}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={cn(
                              "w-6 h-6 rounded border flex items-center justify-center",
                              isSelected ? "bg-secondary border-secondary text-white" : "border-border"
                            )}>
                              {isSelected && <Check className="w-4 h-4" />}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-foreground">{getStudentName(student)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{getStudentEnrollmentNumber(student)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {student?.parent_id ? getCenterName(student.parent_id) : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-end gap-4 p-6 border-t border-border">
              <button
                onClick={() => setIsStudentModalOpen(false)}
                className="px-6 py-2 border border-border rounded-none text-sm font-bold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={saveStudentSelection}
                className="px-6 py-2 bg-secondary text-white text-sm font-bold rounded-none hover:opacity-90 flex items-center gap-2"
              >
                Save Selection
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AdminAnnouncementsPage;
