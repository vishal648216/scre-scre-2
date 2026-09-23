import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Search,
  BookMarked,
  FileText,
  Loader2,
  ExternalLink,
  Upload,
  Youtube,
  Link as LinkIcon,
  IndianRupee,
  CheckCircle,
  Clock,
  AlertTriangle,
  UserCheck,
  Calendar,
  Layers,
  ArrowRight,
  Sparkles,
  BarChart3,
  Star,
  Users,
  BookmarkCheck,
  TrendingUp,
  ShieldAlert,
  MessageSquare,
  Eye,
  ShoppingBag,
  Tag,
  ShieldCheck,
  Building,
  Globe
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, apiUrl } from "@/lib/api";
import { useSearchParams } from "react-router-dom";

interface Book {
  _id?: string;
  id?: string;
  title: string;
  author: string;
  category: string;
  categories?: string[];
  description?: string;
  cover_url?: string;
  pdf_url?: string;
  youtube_url?: string;
  external_url?: string;
  price?: number;
  isbn?: string;
  edition?: string;
  is_physical?: boolean;
  total_copies?: number;
  available_copies?: number;
  damaged_copies?: number;
  shelf_location?: string;
  rack_number?: string;
  procurement_needed?: boolean;
  total_pages?: number;
  is_published: boolean;
}

interface IssueRecord {
  _id?: string;
  id?: string;
  book_id: string;
  book_title: string;
  student_id: string;
  student_name: string;
  student_username: string;
  issue_date: string;
  due_date: string;
  return_date?: string;
  status: string; // "Issued", "Returned", "Overdue"
  fine_amount?: number;
  initial_condition?: string;
  condition_on_return?: string;
  doc_verified?: boolean;
  student_photo_url?: string;
  issue_doc_url?: string;
  student_rating?: number;
  student_feedback?: string;
  remarks?: string;
}

interface BookReservation {
  _id?: string;
  id?: string;
  book_id: string;
  book_title: string;
  student_id: string;
  student_name: string;
  student_username: string;
  reserved_at: string;
  status: string; // "Pending", "Fulfilled", "Cancelled"
}

interface AnalyticsData {
  total_issued: number;
  total_overdue: number;
  total_returned: number;
  total_fines: number;
  total_damaged_copies?: number;
  procurement_needed_count?: number;
  total_unique_borrowers?: number;
  popular_books: { title: string; count: number }[];
}

interface StudentOption {
  _id: string;
  id?: string;
  fullName?: string;
  full_name?: string;
  username: string;
  enrollment_no?: string;
  enrollment_number?: string;
  profile_image?: string;
  avatar?: string;
  email?: string;
  phone?: string;
}

function formatDate(dateVal: any): string {
  if (!dateVal) return "Today";
  let d: Date;
  if (typeof dateVal === "string" || typeof dateVal === "number") {
    d = new Date(dateVal);
  } else if (dateVal && typeof dateVal === "object" && dateVal.$date) {
    if (typeof dateVal.$date === "string" || typeof dateVal.$date === "number") {
      d = new Date(dateVal.$date);
    } else if (dateVal.$date.$numberLong) {
      d = new Date(parseInt(dateVal.$date.$numberLong));
    } else {
      d = new Date(dateVal.$date);
    }
  } else {
    d = new Date(dateVal);
  }
  return isNaN(d.getTime()) ? "Today" : d.toLocaleDateString();
}

export default function LibraryManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab =
    tabParam === "issues"
      ? "issues"
      : tabParam === "reservations"
      ? "reservations"
      : tabParam === "analytics"
      ? "analytics"
      : "catalog";

  const [activeTab, setActiveTab] = useState<"catalog" | "issues" | "reservations" | "analytics">(initialTab);

  const [books, setBooks] = useState<Book[]>([]);
  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [reservations, setReservations] = useState<BookReservation[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Amazon View Modal state
  const [viewingBook, setViewingBook] = useState<Book | null>(null);

  // Add/Edit Book Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // Book Form State
  const [form, setForm] = useState<Book>({
    title: "",
    author: "",
    category: "Computer Science",
    categories: ["Computer Science"],
    description: "",
    cover_url: "",
    pdf_url: "",
    youtube_url: "",
    external_url: "",
    price: 0,
    isbn: "",
    edition: "1st Edition",
    is_physical: false,
    total_copies: 1,
    available_copies: 1,
    damaged_copies: 0,
    shelf_location: "",
    rack_number: "",
    procurement_needed: false,
    total_pages: 100,
    is_published: true,
  });

  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Issue Book Modal State
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issueForm, setIssueForm] = useState({
    book_id: "",
    student_id: "",
    reservation_id: "",
    due_days: 14,
    issue_date: new Date().toISOString().split("T")[0],
    due_date: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
    initial_condition: "Good Condition",
    doc_verified: true,
    student_photo_url: "",
    issue_doc_url: "",
    remarks: "",
  });

  // Return Book Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returning, setReturning] = useState(false);
  const [returnTarget, setReturnTarget] = useState<IssueRecord | null>(null);
  const [returnForm, setReturnForm] = useState({
    fine_amount: 0,
    condition_on_return: "Good Condition",
    mark_as_damaged: false,
    student_rating: 5,
    student_feedback: "",
    remarks: "Returned in good condition",
  });

  // Reservation Modal State
  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [reserveForm, setReserveForm] = useState({
    book_id: "",
    student_id: "",
  });

  const availableCategories = [
    "Computer Science",
    "Programming",
    "Accounting & Tally",
    "Graphic & Web Design",
    "Hardware & Networking",
    "General Studies",
    "Soft Skills & English",
    "Reference & Manuals",
    "Competitive Exams",
  ];

  const getIdString = (val: any): string => {
    if (!val) return "";
    if (typeof val === "string") return val.trim();
    if (typeof val === "object") {
      if (typeof val.$oid === "string") return val.$oid.trim();
      if (val.toString && typeof val.toString === "function" && val.toString() !== "[object Object]") {
        return val.toString().trim();
      }
    }
    const str = String(val || "").trim();
    return str === "[object Object]" ? "" : str;
  };

  const fetchBooks = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/library/admin/books");
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          const raw = data.data || [];
          const normalized = raw.map((b: any) => {
            const cleanId = getIdString(b._id || b.id);
            return {
              ...b,
              _id: cleanId,
              id: cleanId,
            };
          });
          setBooks(normalized);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load library books");
    } finally {
      setLoading(false);
    }
  };

  const fetchIssues = async () => {
    try {
      const res = await apiFetch("/api/library/issue");
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          const raw = data.data || [];
          const normalized = raw.map((rec: any) => {
            const cleanId = getIdString(rec._id || rec.id);
            const cleanBookId = getIdString(rec.book_id);
            const cleanStudentId = getIdString(rec.student_id);
            return {
              ...rec,
              _id: cleanId,
              id: cleanId,
              book_id: cleanBookId,
              student_id: cleanStudentId,
            };
          });
          setIssues(normalized);
        }
      }
    } catch {
      console.error("Failed to load book issue records");
    }
  };

  const fetchReservations = async () => {
    try {
      const res = await apiFetch("/api/library/reservations");
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          const raw = data.data || [];
          const normalized = raw.map((r: any) => {
            const cleanId = getIdString(r._id || r.id);
            const cleanBookId = getIdString(r.book_id);
            const cleanStudentId = getIdString(r.student_id);
            return {
              ...r,
              _id: cleanId,
              id: cleanId,
              book_id: cleanBookId,
              student_id: cleanStudentId,
            };
          });
          setReservations(normalized);
        }
      }
    } catch {
      console.error("Failed to load book reservations");
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await apiFetch("/api/library/analytics");
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          setAnalytics(data.data || null);
        }
      }
    } catch {
      console.error("Failed to load library analytics");
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await apiFetch("/api/students");
      if (res.ok) {
        const data = await res.json();
        const raw = Array.isArray(data) ? data : (data?.data || []);
        const normalized = raw.map((s: any) => {
          const cleanId = getIdString(s._id || s.id || s.user_id);
          return {
            ...s,
            _id: cleanId,
            id: cleanId,
          };
        });
        setStudents(normalized);
      }
    } catch {
      console.error("Failed to load students list");
    }
  };

  useEffect(() => {
    fetchBooks();
    fetchIssues();
    fetchReservations();
    fetchAnalytics();
    fetchStudents();
  }, []);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "issues") setActiveTab("issues");
    else if (t === "reservations") setActiveTab("reservations");
    else if (t === "analytics") setActiveTab("analytics");
    else if (t === "catalog") setActiveTab("catalog");
  }, [searchParams]);

  const handleTabChange = (tab: "catalog" | "issues" | "reservations" | "analytics") => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Upload helpers
  const handleFileUpload = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await apiFetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        return data.url;
      }
      toast.error(data.message || "Upload failed");
      return null;
    } catch {
      toast.error("Upload failed");
      return null;
    }
  };

  const handleCoverFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    const url = await handleFileUpload(file);
    if (url) {
      setForm((prev) => ({ ...prev, cover_url: url }));
      toast.success("Cover image uploaded");
    }
    setUploadingCover(false);
  };

  const handlePdfFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    const url = await handleFileUpload(file);
    if (url) {
      setForm((prev) => ({ ...prev, pdf_url: url }));
      toast.success("PDF file uploaded");
    }
    setUploadingPdf(false);
  };

  const toggleCategoryInForm = (cat: string) => {
    const currentCats = form.categories || [form.category];
    let updated: string[];
    if (currentCats.includes(cat)) {
      updated = currentCats.filter((c) => c !== cat);
      if (updated.length === 0) updated = [cat];
    } else {
      updated = [...currentCats, cat];
    }
    setForm({
      ...form,
      category: updated[0] || cat,
      categories: updated,
    });
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setCurrentId(null);
    setForm({
      title: "",
      author: "",
      category: "Computer Science",
      categories: ["Computer Science"],
      description: "",
      cover_url: "",
      pdf_url: "",
      youtube_url: "",
      external_url: "",
      price: 0,
      isbn: "",
      edition: "1st Edition",
      is_physical: false,
      total_copies: 1,
      available_copies: 1,
      damaged_copies: 0,
      shelf_location: "",
      rack_number: "Rack A",
      procurement_needed: false,
      total_pages: 100,
      is_published: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (b: Book) => {
    setIsEditing(true);
    const cleanId = getIdString(b._id || b.id);
    setCurrentId(cleanId);
    setForm({
      title: b.title,
      author: b.author,
      category: b.category,
      categories: b.categories && b.categories.length > 0 ? b.categories : [b.category],
      description: b.description || "",
      cover_url: b.cover_url || "",
      pdf_url: b.pdf_url || "",
      youtube_url: b.youtube_url || "",
      external_url: b.external_url || "",
      price: b.price || 0,
      isbn: b.isbn || "",
      edition: b.edition || "",
      is_physical: b.is_physical || false,
      total_copies: b.total_copies || 1,
      available_copies: b.available_copies || 1,
      damaged_copies: b.damaged_copies || 0,
      shelf_location: b.shelf_location || "",
      rack_number: b.rack_number || "",
      procurement_needed: b.procurement_needed || false,
      total_pages: b.total_pages || 100,
      is_published: b.is_published,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.author.trim()) {
      toast.error("Please enter book title and author");
      return;
    }

    try {
      setSaving(true);
      if (isEditing && currentId) {
        const res = await apiFetch(`/api/library/books/${currentId}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          toast.success("Book updated successfully");
        } else {
          toast.error(data.message || "Failed to update book");
          return;
        }
      } else {
        const res = await apiFetch("/api/library/books", {
          method: "POST",
          body: JSON.stringify(form),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          toast.success("Book added to library successfully");
        } else {
          toast.error(data.message || "Failed to add book");
          return;
        }
      }
      setIsModalOpen(false);
      fetchBooks();
      fetchAnalytics();
    } catch (err: any) {
      toast.error(err.message || "Error saving book");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rawId?: any) => {
    const id = getIdString(rawId);
    if (!id) {
      toast.error("Invalid book ID");
      return;
    }
    if (!confirm("Are you sure you want to remove this book from the library?")) return;

    try {
      const res = await apiFetch(`/api/library/books/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success(data.message || "Book removed");
        fetchBooks();
        fetchAnalytics();
      } else {
        toast.error(data.message || "Failed to delete book");
      }
    } catch (err: any) {
      toast.error(err.message || "Error deleting book");
    }
  };

  // Issue Book Handlers
  const handleOpenIssue = (b?: Book, studentIdPrefill?: string, reservationIdPrefill?: string) => {
    const bookId = b ? getIdString(b._id || b.id) : "";
    const studentId = getIdString(studentIdPrefill);
    const reservationId = getIdString(reservationIdPrefill);
    const todayStr = new Date().toISOString().split("T")[0];
    const dueStr = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
    setIssueForm({
      book_id: bookId,
      student_id: studentId,
      reservation_id: reservationId,
      due_days: 14,
      issue_date: todayStr,
      due_date: dueStr,
      initial_condition: "Good Condition",
      doc_verified: true,
      student_photo_url: "",
      issue_doc_url: "",
      remarks: "",
    });
    setIsIssueModalOpen(true);
  };

  const handleIssueSubmit = async () => {
    if (!issueForm.book_id || !issueForm.student_id) {
      toast.error("Please select both a book and a student");
      return;
    }

    try {
      setIssuing(true);
      const res = await apiFetch("/api/library/issue", {
        method: "POST",
        body: JSON.stringify(issueForm),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success(data.message || "Book issued to student successfully");
        setIsIssueModalOpen(false);
        fetchIssues();
        fetchBooks();
        fetchReservations();
        fetchAnalytics();
      } else {
        toast.error(data.message || "Failed to issue book");
      }
    } catch {
      toast.error("Error issuing book");
    } finally {
      setIssuing(false);
    }
  };

  const handleCancelReservation = async (rawId?: any) => {
    const id = getIdString(rawId);
    if (!id) {
      toast.error("Invalid reservation ID");
      return;
    }
    if (!confirm("Are you sure you want to cancel this reservation from the queue?")) return;

    try {
      const res = await apiFetch(`/api/library/reservations/${id}/cancel`, {
        method: "PUT",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success(data.message || "Reservation cancelled");
        fetchReservations();
      } else {
        toast.error(data.message || "Failed to cancel reservation");
      }
    } catch {
      toast.error("Error cancelling reservation");
    }
  };

  // Return Book Handlers
  const handleOpenReturn = (rec: IssueRecord) => {
    setReturnTarget(rec);
    setReturnForm({
      fine_amount: rec.status === "Overdue" ? 50 : 0,
      condition_on_return: "Good Condition",
      student_rating: 5,
      student_feedback: "",
      remarks: "Returned in good condition",
    });
    setIsReturnModalOpen(true);
  };

  const handleReturnSubmit = async () => {
    if (!returnTarget) return;
    const targetId = getIdString(returnTarget._id || returnTarget.id);
    if (!targetId) {
      toast.error("Invalid return target ID");
      return;
    }

    try {
      setReturning(true);
      const res = await apiFetch(`/api/library/issued/${targetId}/return`, {
        method: "PUT",
        body: JSON.stringify(returnForm),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success(data.message || "Book marked as returned");
        setIsReturnModalOpen(false);
        fetchIssues();
        fetchBooks();
        fetchAnalytics();
      } else {
        toast.error(data.message || "Failed to return book");
      }
    } catch {
      toast.error("Error processing book return");
    } finally {
      setReturning(false);
    }
  };

  // Reservation Handlers
  const handleOpenReserve = (b?: Book) => {
    const bookId = b ? getIdString(b._id || b.id) : "";
    setReserveForm({
      book_id: bookId,
      student_id: "",
    });
    setIsReserveModalOpen(true);
  };

  const handleReserveSubmit = async () => {
    if (!reserveForm.book_id || !reserveForm.student_id) {
      toast.error("Please select a book and student for reservation");
      return;
    }

    try {
      setReserving(true);
      const res = await apiFetch("/api/library/reserve", {
        method: "POST",
        body: JSON.stringify(reserveForm),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success(data.message || "Book reserved for student!");
        setIsReserveModalOpen(false);
        fetchReservations();
      } else {
        toast.error(data.message || "Failed to reserve book");
      }
    } catch {
      toast.error("Error reserving book");
    } finally {
      setReserving(false);
    }
  };

  const filteredBooks = (books || []).filter((b) => {
    const matchesSearch =
      (b?.title || "").toLowerCase().includes((search || "").toLowerCase()) ||
      (b?.author || "").toLowerCase().includes((search || "").toLowerCase());
    const matchesCategory =
      categoryFilter === "all" ||
      b?.category === categoryFilter ||
      (b?.categories && b.categories.includes(categoryFilter));
    return matchesSearch && matchesCategory;
  });

  const filteredIssues = (issues || []).filter((rec) => {
    const q = (search || "").toLowerCase();
    return (
      (rec?.book_title || "").toLowerCase().includes(q) ||
      (rec?.student_name || "").toLowerCase().includes(q) ||
      (rec?.student_username || "").toLowerCase().includes(q)
    );
  });

  const filteredReservations = (reservations || []).filter((r) => {
    const q = (search || "").toLowerCase();
    return (
      (r?.book_title || "").toLowerCase().includes(q) ||
      (r?.student_name || "").toLowerCase().includes(q) ||
      (r?.student_username || "").toLowerCase().includes(q)
    );
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-primary/20 pb-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              <BookOpen className="w-7 h-7 text-primary" />
              Physical & Digital Library Management System
            </h1>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1">
              Complete Catalog, Issue/Returns, Damaged Book Audit, Next Borrower Reservations & Analytics
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => handleOpenReserve()}
              variant="outline"
              className="rounded-none font-bold text-xs uppercase tracking-widest gap-2 border-purple-500/40 text-purple-600 hover:bg-purple-500/10 shadow-sm"
            >
              <BookmarkCheck className="w-4 h-4" />
              Reserve Book Next
            </Button>
            <Button
              onClick={() => handleOpenIssue()}
              variant="outline"
              className="rounded-none font-bold text-xs uppercase tracking-widest gap-2 border-primary/40 text-primary hover:bg-primary/10 shadow-sm"
            >
              <UserCheck className="w-4 h-4" />
              Issue Book
            </Button>
            <Button
              onClick={handleOpenAdd}
              className="rounded-none font-black text-xs uppercase tracking-widest gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
            >
              <Plus className="w-4 h-4" />
              Add New Book
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap border-b border-border bg-muted/20">
          <button
            onClick={() => handleTabChange("catalog")}
            className={`px-6 py-3 font-black text-xs uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "catalog"
                ? "border-primary text-primary bg-background shadow-sm"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookMarked className="w-4 h-4" />
            Book Catalog ({books.length})
          </button>
          <button
            onClick={() => handleTabChange("issues")}
            className={`px-6 py-3 font-black text-xs uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "issues"
                ? "border-primary text-primary bg-background shadow-sm"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="w-4 h-4" />
            Issues & Returns ({issues.length})
          </button>
          <button
            onClick={() => handleTabChange("reservations")}
            className={`px-6 py-3 font-black text-xs uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "reservations"
                ? "border-primary text-primary bg-background shadow-sm"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookmarkCheck className="w-4 h-4" />
            Next Borrower Queue ({reservations.length})
          </button>
          <button
            onClick={() => handleTabChange("analytics")}
            className={`px-6 py-3 font-black text-xs uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "analytics"
                ? "border-primary text-primary bg-background shadow-sm"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Popular Books & Analytics
          </button>
        </div>

        {/* Filters */}
        {activeTab !== "analytics" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/20 p-4 border border-border">
            <div className="md:col-span-2 relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  activeTab === "catalog"
                    ? "Search books by title, author, or keyword..."
                    : activeTab === "issues"
                    ? "Search issue records by student name, username, or book title..."
                    : "Search reservations queue..."
                }
                className="pl-9 rounded-none border-border font-bold text-xs"
              />
            </div>
            {activeTab === "catalog" && (
              <div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="rounded-none border-border font-bold text-xs">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {availableCategories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* CATALOG TAB */}
        {activeTab === "catalog" && (
          <div>
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  Loading library catalog...
                </p>
              </div>
            ) : filteredBooks.length === 0 ? (
              <Card className="rounded-none border-dashed border-2 bg-muted/20 py-16 text-center">
                <CardContent className="space-y-3">
                  <BookMarked className="w-12 h-12 text-muted-foreground mx-auto" />
                  <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                    No books found in catalog
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenAdd}
                    className="rounded-none font-bold text-xs uppercase tracking-widest"
                  >
                    Add the first book
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredBooks.map((b) => (
                  <Card
                    key={b._id || b.id}
                    className="rounded-none border-border shadow hover:border-primary/50 transition-all flex flex-col justify-between overflow-hidden group"
                  >
                    <div>
                      {/* Cover thumbnail */}
                      <div className="h-48 bg-muted border-b border-border flex items-center justify-center overflow-hidden relative">
                        {b.cover_url ? (
                          <img
                            src={apiUrl(b.cover_url)}
                            alt={b.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-muted-foreground">
                            <BookOpen className="w-10 h-10 text-primary/40" />
                            <span className="text-[9px] font-black uppercase tracking-widest">
                              No Cover Image
                            </span>
                          </div>
                        )}
                        <span
                          className={`absolute top-2 right-2 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest border ${
                            b.is_published
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          }`}
                        >
                          {b.is_published ? "Published" : "Draft"}
                        </span>
                        {b.is_physical && (
                          <span className="absolute top-2 left-2 bg-purple-500/90 text-white px-2 py-0.5 text-[8px] font-black uppercase tracking-widest">
                            Physical ({b.available_copies ?? 1}/{b.total_copies ?? 1} Stock)
                          </span>
                        )}
                        {(b.damaged_copies || 0) > 0 && (
                          <span className="absolute bottom-2 left-2 bg-amber-600 text-white px-2 py-0.5 text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> {b.damaged_copies} Damaged
                          </span>
                        )}
                        {(b.procurement_needed || (b.is_physical && (b.available_copies || 0) === 0)) && (
                          <span className="absolute bottom-2 right-2 bg-emerald-600 text-white px-2 py-0.5 text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                            <ShoppingBag className="w-2.5 h-2.5" /> Restock Needed
                          </span>
                        )}
                      </div>

                      <div className="p-4 space-y-2">
                        {/* Multiple Categories display */}
                        <div className="flex flex-wrap gap-1">
                          {(b.categories && b.categories.length > 0
                            ? b.categories
                            : [b.category]
                          ).map((cat) => (
                            <span
                              key={cat}
                              className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>

                        <h3 className="font-black uppercase tracking-tight text-foreground line-clamp-1 mt-1 text-sm">
                          {b.title}
                        </h3>
                        <p className="text-[11px] font-bold text-muted-foreground uppercase line-clamp-1">
                          By {b.author} {b.edition ? `• ${b.edition}` : ""}
                        </p>

                        {(b.rack_number || b.shelf_location) && (
                          <p className="text-[10px] text-purple-700 dark:text-purple-400 font-black uppercase tracking-wider flex items-center gap-1 bg-purple-500/10 px-2 py-0.5 w-fit">
                            📍 {b.rack_number ? b.rack_number : ""} {b.shelf_location ? `• ${b.shelf_location}` : ""}
                          </p>
                        )}

                        {b.description && (
                          <p className="text-[11px] text-muted-foreground/80 line-clamp-2 mt-1 leading-relaxed">
                            {b.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="p-4 pt-0 border-t border-border mt-3 space-y-3">
                      {/* Media Links */}
                      <div className="flex flex-wrap gap-2 text-[10px] font-bold text-muted-foreground uppercase pt-2">
                        {b.pdf_url && (
                          <a
                            href={apiUrl(b.pdf_url)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-600 hover:underline flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5"
                          >
                            <FileText className="w-3 h-3" /> PDF E-Book
                          </a>
                        )}
                        {b.youtube_url && (
                          <a
                            href={b.youtube_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-red-600 hover:underline flex items-center gap-1 bg-red-500/10 px-2 py-0.5"
                          >
                            <Youtube className="w-3 h-3" /> Video Lesson
                          </a>
                        )}
                        {b.external_url && (
                          <a
                            href={b.external_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1 bg-blue-500/10 px-2 py-0.5"
                          >
                            <LinkIcon className="w-3 h-3" /> External Link
                          </a>
                        )}
                      </div>

                      <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase">
                        <span>Shelf: {b.shelf_location || "A1"}</span>
                        {b.price && b.price > 0 ? (
                          <span className="text-foreground font-black flex items-center">
                            <IndianRupee className="w-3 h-3" />
                            {b.price}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingBook(b)}
                          className="rounded-none font-bold text-[10px] uppercase tracking-wider h-8 border-blue-500/40 text-blue-600 hover:bg-blue-500/10"
                          title="View Amazon Product Listing"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> View Listing
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenIssue(b)}
                          className="flex-1 rounded-none font-bold text-[10px] uppercase tracking-wider h-8 border-primary/40 text-primary hover:bg-primary/10"
                        >
                          <UserCheck className="w-3 h-3 mr-1" /> Issue
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenReserve(b)}
                          className="rounded-none font-bold text-[10px] uppercase tracking-wider h-8 border-purple-500/40 text-purple-600 hover:bg-purple-500/10"
                          title="Reserve Next"
                        >
                          <BookmarkCheck className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(b)}
                          className="rounded-none font-bold text-[10px] uppercase tracking-wider h-8"
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(b._id || b.id)}
                          className="rounded-none font-bold text-[10px] uppercase text-destructive hover:bg-destructive/10 h-8"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ISSUES TAB */}
        {activeTab === "issues" && (
          <Card className="rounded-none border-border shadow-md overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Book Issue, Return & Damage Audit Records
              </CardTitle>
              <Button
                onClick={() => handleOpenIssue()}
                size="sm"
                className="rounded-none font-bold text-xs uppercase tracking-widest gap-2"
              >
                <Plus className="w-3.5 h-3.5" /> Issue Book
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {filteredIssues.length === 0 ? (
                <div className="p-12 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  No book issue records found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/10 text-muted-foreground uppercase text-[10px] font-black tracking-widest">
                        <th className="px-6 py-4">Book Title</th>
                        <th className="px-6 py-4">Student Name</th>
                        <th className="px-6 py-4">Dates (Issue / Due / Return)</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Return Condition & Feedback</th>
                        <th className="px-6 py-4">Fine Collected</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="font-medium">
                      {filteredIssues.map((rec) => {
                        const recId = rec._id || rec.id;
                        const isReturned = rec.status === "Returned";
                        const isOverdue = rec.status === "Overdue";

                        return (
                          <tr
                            key={recId}
                            className="border-b border-border last:border-0 hover:bg-primary/5 transition-colors text-xs"
                          >
                            <td className="px-6 py-4 font-black uppercase">
                              <p>{rec.book_title}</p>
                              {rec.initial_condition && (
                                <span className="text-[9px] font-bold text-primary block mt-0.5">
                                  Initial: {rec.initial_condition}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-muted border border-border overflow-hidden flex items-center justify-center font-black text-[10px] shrink-0">
                                  {rec.student_photo_url ? (
                                    <img
                                      src={apiUrl(rec.student_photo_url)}
                                      alt={rec.student_name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Users className="w-3.5 h-3.5 text-primary" />
                                  )}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-bold flex items-center gap-1">
                                    {rec.student_name}
                                    {rec.doc_verified && (
                                      <ShieldCheck className="w-3 h-3 text-emerald-600 inline" />
                                    )}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    @{rec.student_username}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col text-[11px]">
                                <span>Issue: {rec.issue_date ? new Date(rec.issue_date).toLocaleDateString() : "—"}</span>
                                <span className="text-amber-600">Due: {rec.due_date ? new Date(rec.due_date).toLocaleDateString() : "—"}</span>
                                {rec.return_date && (
                                  <span className="text-emerald-600">Return: {new Date(rec.return_date).toLocaleDateString()}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 ${
                                  isReturned
                                    ? "bg-emerald-500/10 text-emerald-600"
                                    : isOverdue
                                    ? "bg-destructive/10 text-destructive animate-pulse"
                                    : "bg-amber-500/10 text-amber-600"
                                }`}
                              >
                                {rec.status}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {isReturned ? (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded-none border border-blue-500/20">
                                    {rec.condition_on_return || "Good Condition"}
                                  </span>
                                  {rec.student_rating ? (
                                    <div className="flex items-center gap-0.5 text-amber-500">
                                      {Array.from({ length: rec.student_rating }).map((_, i) => (
                                        <Star key={i} className="w-3 h-3 fill-amber-500" />
                                      ))}
                                    </div>
                                  ) : null}
                                  {rec.student_feedback && (
                                    <p className="text-[10px] text-muted-foreground italic">
                                      "{rec.student_feedback}"
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-[10px] italic">Not yet returned</span>
                              )}
                            </td>
                            <td className="px-6 py-4 font-bold">
                              {rec.fine_amount && rec.fine_amount > 0 ? (
                                <span className="text-destructive font-black">
                                  ₹{rec.fine_amount}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              {!isReturned && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenReturn(rec)}
                                  className="rounded-none font-bold text-[10px] uppercase border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" /> Mark Returned
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* RESERVATIONS TAB ("NEXT KON LE GAYA") */}
        {activeTab === "reservations" && (
          <Card className="rounded-none border-border shadow-md overflow-hidden">
            <CardHeader className="bg-purple-500/5 border-b border-purple-500/20 py-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 text-purple-700">
                  <BookmarkCheck className="w-4 h-4 text-purple-600" />
                  Next Borrower Reservation Queue ("Next Kon Le Gaya")
                </CardTitle>
                <CardDescription className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                  Priority Waitlist for Students Waiting for Borrowed Physical Books
                </CardDescription>
              </div>
              <Button
                onClick={() => handleOpenReserve()}
                size="sm"
                className="rounded-none font-bold text-xs uppercase tracking-widest gap-2 bg-purple-600 text-white hover:bg-purple-700"
              >
                <Plus className="w-3.5 h-3.5" /> Reserve for Student
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {filteredReservations.length === 0 ? (
                <div className="p-12 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  No pending reservations in queue
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/10 text-muted-foreground uppercase text-[10px] font-black tracking-widest">
                        <th className="px-6 py-4">Queue Position</th>
                        <th className="px-6 py-4">Reserved Book</th>
                        <th className="px-6 py-4">Next Borrower Student</th>
                        <th className="px-6 py-4">Reserved Date</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="font-medium">
                      {filteredReservations.map((r, idx) => {
                        const rId = r._id || r.id;
                        return (
                          <tr
                            key={rId}
                            className="border-b border-border last:border-0 hover:bg-purple-500/5 transition-colors text-xs"
                          >
                            <td className="px-6 py-4 font-black">
                              <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-700 flex items-center justify-center text-[10px] font-black">
                                #{idx + 1}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-black uppercase">{r.book_title}</td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-bold">{r.student_name}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  @{r.student_username}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-bold text-foreground">
                              {formatDate(r.reserved_at)}
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                {r.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const b = books.find((bk) => getIdString(bk._id || bk.id) === getIdString(r.book_id));
                                    handleOpenIssue(b, r.student_id, r._id || r.id);
                                  }}
                                  className="rounded-none font-black text-[10px] uppercase bg-emerald-600 text-white hover:bg-emerald-700 gap-1"
                                >
                                  <UserCheck className="w-3.5 h-3.5" /> Issue Book
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCancelReservation(r._id || r.id)}
                                  className="rounded-none font-black text-[10px] uppercase border-red-500/40 text-red-600 hover:bg-red-500/10 gap-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Cancel Queue
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ANALYTICS TAB ("JAYADA KONSI BOOK") */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            {/* Physical & Digital Library KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="rounded-none border-border bg-gradient-to-br from-blue-500/10 to-background p-4 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" /> Total Active Issues
                </span>
                <p className="text-3xl font-black">{analytics?.total_issued || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Currently borrowed books</p>
              </Card>

              <Card className="rounded-none border-border bg-gradient-to-br from-purple-500/10 to-background p-4 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-600 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Total Student Borrowers
                </span>
                <p className="text-3xl font-black text-purple-600">{analytics?.total_unique_borrowers || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Students ("Kitne student aye")</p>
              </Card>

              <Card className="rounded-none border-border bg-gradient-to-br from-amber-500/10 to-background p-4 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Fat Gayi / Damaged Copies
                </span>
                <p className="text-3xl font-black text-amber-600">{analytics?.total_damaged_copies || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Physical damaged audit ("Fat gayi")</p>
              </Card>

              <Card className="rounded-none border-border bg-gradient-to-br from-emerald-500/10 to-background p-4 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1">
                  <ShoppingBag className="w-3.5 h-3.5" /> New Procurement Needed
                </span>
                <p className="text-3xl font-black text-emerald-600">{analytics?.procurement_needed_count || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Restock needed ("Konsi new lani")</p>
              </Card>
            </div>

            {/* Popular Books Leaderboard ("Jayada konsi book") */}
            <Card className="rounded-none border-border shadow-md overflow-hidden">
              <CardHeader className="bg-primary/5 border-b border-primary/20 py-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Most Popular & Frequently Borrowed Books ("Jayada Konsi Book")
                </CardTitle>
                <CardDescription className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                  Top ranking books based on physical issue count & digital reading demand
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {!analytics?.popular_books || analytics.popular_books.length === 0 ? (
                  <div className="py-12 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    No borrowing statistics recorded yet
                  </div>
                ) : (
                  <div className="space-y-4">
                    {analytics.popular_books.map((item, index) => {
                      const maxCount = analytics.popular_books[0]?.count || 1;
                      const percentage = Math.round((item.count / maxCount) * 100);

                      return (
                        <div key={item.title} className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-black uppercase">
                            <span className="flex items-center gap-2">
                              <span className="w-5 h-5 bg-primary/20 text-primary text-[10px] flex items-center justify-center font-black">
                                #{index + 1}
                              </span>
                              {item.title}
                            </span>
                            <span className="text-primary">{item.count} Borrow Times</span>
                          </div>
                          <div className="w-full bg-muted h-3 border border-border">
                            <div
                              className="bg-primary h-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Physical Library Inventory Audit: Damaged & Procurement List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Damaged Books Audit ("Fat Gayi / Old Books") */}
              <Card className="rounded-none border-2 border-amber-500/30 shadow-md">
                <CardHeader className="bg-amber-500/10 border-b border-amber-500/20 py-3">
                  <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Damaged & Old Book Physical Audit ("Old Book Fat Gayi")
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-xs">
                  {books.filter((b) => (b.damaged_copies || 0) > 0).length === 0 ? (
                    <div className="py-6 text-center text-muted-foreground font-bold uppercase text-[11px]">
                      ✓ No damaged or torn books reported in physical audit
                    </div>
                  ) : (
                    books
                      .filter((b) => (b.damaged_copies || 0) > 0)
                      .map((b) => (
                        <div
                          key={b._id || b.id}
                          className="p-3 bg-amber-500/5 border border-amber-500/20 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-black uppercase">{b.title}</p>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase">
                              Author: {b.author} • Location: {b.shelf_location || b.rack_number || "Library Shelf"}
                            </p>
                          </div>
                          <span className="px-2.5 py-1 bg-amber-600 text-white font-black text-[10px] uppercase">
                            {b.damaged_copies} Damaged
                          </span>
                        </div>
                      ))
                  )}
                </CardContent>
              </Card>

              {/* Procurement & Re-stocking Needed List ("Konsi New Lani") */}
              <Card className="rounded-none border-2 border-emerald-500/30 shadow-md">
                <CardHeader className="bg-emerald-500/10 border-b border-emerald-500/20 py-3">
                  <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                    <ShoppingBag className="w-4 h-4 text-emerald-600" />
                    New Procurement & Restock Master Checklist ("Konsi New Lani")
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-xs">
                  {books.filter((b) => b.procurement_needed || (b.is_physical && (b.available_copies || 0) === 0)).length === 0 ? (
                    <div className="py-6 text-center text-muted-foreground font-bold uppercase text-[11px]">
                      ✓ Stock fully replenished. All physical titles available.
                    </div>
                  ) : (
                    books
                      .filter((b) => b.procurement_needed || (b.is_physical && (b.available_copies || 0) === 0))
                      .map((b) => (
                        <div
                          key={b._id || b.id}
                          className="p-3 bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-black uppercase">{b.title}</p>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase">
                              Category: {b.category} • Total Copies: {b.total_copies || 0}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleOpenEdit(b)}
                            className="rounded-none font-black text-[10px] uppercase bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            Restock Title
                          </Button>
                        </div>
                      ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Amazon KDP & Seller Studio Book Publishing Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-6xl w-[96vw] rounded-none border-2 border-amber-500/40 shadow-2xl p-0 overflow-hidden max-h-[94vh] flex flex-col bg-background">
            {/* Studio Header - Amazon Dark Theme */}
            <div className="p-4 bg-[#131921] text-white border-b-2 border-[#FF9900] flex flex-row items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#FF9900] text-black font-black flex items-center justify-center text-base shadow rounded-none">
                  <ShoppingBag className="w-6 h-6 text-black" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-black uppercase tracking-tight text-base text-white">
                      Amazon KDP & Library Book Publishing Studio
                    </h2>
                    <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 bg-[#FF9900] text-black font-extrabold shadow-sm">
                      Amazon Marketplace Sync
                    </span>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mt-0.5">
                    {isEditing ? "Editing Catalog Item & Marketplace Listing Details" : "Create New Book Listing (Physical Paperback & Kindle E-Book)"}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="text-white hover:bg-white/10 rounded-none font-bold text-xs uppercase"
              >
                ✕ Close Studio
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-muted/10 via-background to-muted/20">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Side: Amazon Studio Form Controls */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Step 1: Basic Metadata */}
                  <div className="space-y-4 bg-card p-5 border-2 border-border shadow-sm relative">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-[#FF9900] text-black text-xs font-black flex items-center justify-center">
                          1
                        </span>
                        <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                          Kindle & Paperback Book Details
                        </h3>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Metadata & Taxonomy
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-foreground flex items-center gap-1">
                          Book Title *
                        </Label>
                        <Input
                          value={form.title}
                          onChange={(e) => setForm({ ...form, title: e.target.value })}
                          placeholder="e.g., Complete Tally Prime & GST Accounting"
                          className="rounded-none border-border font-bold text-xs focus-visible:ring-[#FF9900]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-foreground flex items-center gap-1">
                          Author / Writer *
                        </Label>
                        <Input
                          value={form.author}
                          onChange={(e) => setForm({ ...form, author: e.target.value })}
                          placeholder="e.g., Prof. A. K. Gupta"
                          className="rounded-none border-border font-bold text-xs focus-visible:ring-[#FF9900]"
                        />
                      </div>
                    </div>

                    {/* Amazon Multiple Categories Selection */}
                    <div className="space-y-2 bg-muted/20 p-3.5 border border-border">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5" /> Amazon Marketplace Categories (Select all applicable)
                        </Label>
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                          {(form.categories || [form.category]).length} Selected
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                        {availableCategories.map((cat) => {
                          const isSelected = (form.categories || [form.category]).includes(cat);
                          return (
                            <label
                              key={cat}
                              className={`flex items-center gap-2 p-2 border text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all ${
                                isSelected
                                  ? "bg-[#FF9900]/15 border-[#FF9900] text-amber-700 dark:text-amber-400 shadow-sm"
                                  : "bg-background border-border text-muted-foreground hover:bg-muted/40"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleCategoryInForm(cat)}
                                className="w-3.5 h-3.5 accent-[#FF9900] cursor-pointer"
                              />
                              <span className="truncate">{cat}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest">
                          Edition / Revision Tag
                        </Label>
                        <Input
                          value={form.edition || ""}
                          onChange={(e) => setForm({ ...form, edition: e.target.value })}
                          placeholder="e.g., 1st Edition 2026"
                          className="rounded-none border-border font-bold text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest">
                          ISBN Number (10/13 Format)
                        </Label>
                        <Input
                          value={form.isbn || ""}
                          onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                          placeholder="e.g., 978-3-16-148410-0"
                          className="rounded-none border-border font-bold text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Media, Uploads & Content */}
                  <div className="space-y-4 bg-card p-5 border-2 border-border shadow-sm">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-[#FF9900] text-black text-xs font-black flex items-center justify-center">
                          2
                        </span>
                        <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                          Cover Art, Digital E-Book & Video Content
                        </h3>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                        Media Studio
                      </span>
                    </div>

                    {/* Cover Photo Studio Upload */}
                    <div className="space-y-2 bg-muted/20 p-3.5 border border-border">
                      <Label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 text-primary">
                        <Upload className="w-3.5 h-3.5" /> High-Resolution Cover Image Upload
                      </Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handleCoverFileUpload}
                            className="rounded-none border-border text-xs bg-background"
                          />
                          {uploadingCover && (
                            <p className="text-[9px] text-amber-600 font-bold animate-pulse">
                              Uploading high-res artwork to Amazon Cloud...
                            </p>
                          )}
                        </div>
                        <Input
                          value={form.cover_url || ""}
                          onChange={(e) => setForm({ ...form, cover_url: e.target.value })}
                          placeholder="Or direct URL: https://... or /uploads/..."
                          className="rounded-none border-border font-bold text-xs bg-background"
                        />
                      </div>
                    </div>

                    {/* PDF E-Book Upload */}
                    <div className="space-y-2 bg-emerald-500/5 p-3.5 border border-emerald-500/20">
                      <Label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 text-emerald-600">
                        <FileText className="w-3.5 h-3.5" /> PDF Digital E-Book File Upload
                      </Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Input
                            type="file"
                            accept="application/pdf"
                            onChange={handlePdfFileUpload}
                            className="rounded-none border-border text-xs bg-background"
                          />
                          {uploadingPdf && (
                            <p className="text-[9px] text-emerald-600 font-bold animate-pulse">
                              Uploading digital PDF document...
                            </p>
                          )}
                        </div>
                        <Input
                          value={form.pdf_url || ""}
                          onChange={(e) => setForm({ ...form, pdf_url: e.target.value })}
                          placeholder="Or direct PDF URL: https://.../book.pdf"
                          className="rounded-none border-border font-bold text-xs bg-background"
                        />
                      </div>
                    </div>

                    {/* External & Video Links */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-red-600 flex items-center gap-1">
                          <Youtube className="w-3.5 h-3.5" /> YouTube Video Lesson Link
                        </Label>
                        <Input
                          value={form.youtube_url || ""}
                          onChange={(e) => setForm({ ...form, youtube_url: e.target.value })}
                          placeholder="https://www.youtube.com/watch?v=..."
                          className="rounded-none border-border font-bold text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-1">
                          <LinkIcon className="w-3.5 h-3.5" /> External Reference Study Material
                        </Label>
                        <Input
                          value={form.external_url || ""}
                          onChange={(e) => setForm({ ...form, external_url: e.target.value })}
                          placeholder="https://example.com/study-material"
                          className="rounded-none border-border font-bold text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Physical Stock & Pricing */}
                  <div className="space-y-4 bg-card p-5 border-2 border-border shadow-sm">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-[#FF9900] text-black text-xs font-black flex items-center justify-center">
                          3
                        </span>
                        <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                          Pricing, Inventory & Physical Rack Location
                        </h3>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-purple-600">
                        Inventory Studio
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-foreground">
                          Retail Price (₹)
                        </Label>
                        <Input
                          type="number"
                          value={form.price || 0}
                          onChange={(e) =>
                            setForm({ ...form, price: parseFloat(e.target.value) || 0 })
                          }
                          placeholder="0 for Free Student E-Book"
                          className="rounded-none border-border font-bold text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-foreground">
                          Total Pages Count
                        </Label>
                        <Input
                          type="number"
                          value={form.total_pages || 100}
                          onChange={(e) =>
                            setForm({ ...form, total_pages: parseInt(e.target.value) || 100 })
                          }
                          className="rounded-none border-border font-bold text-xs"
                        />
                      </div>
                    </div>

                    {/* Physical Stock Toggle */}
                    <div className="space-y-3 bg-purple-500/5 p-4 border border-purple-500/20">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="physical-check"
                          checked={form.is_physical || false}
                          onChange={(e) => setForm({ ...form, is_physical: e.target.checked })}
                          className="w-4 h-4 accent-purple-600 cursor-pointer"
                        />
                        <Label
                          htmlFor="physical-check"
                          className="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 cursor-pointer"
                        >
                          This is a Physical Library Book (Track Physical Copies & Shelf Location)
                        </Label>
                      </div>

                      {form.is_physical && (
                        <div className="space-y-4 pt-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase tracking-widest">
                                Total Physical Stock Copies
                              </Label>
                              <Input
                                type="number"
                                value={form.total_copies || 1}
                                onChange={(e) =>
                                  setForm({ ...form, total_copies: parseInt(e.target.value) || 1 })
                                }
                                className="rounded-none border-border font-bold text-xs bg-background"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase tracking-widest">
                                Damaged / Torn Copies Count ("Fat Gayi")
                              </Label>
                              <Input
                                type="number"
                                value={form.damaged_copies || 0}
                                onChange={(e) =>
                                  setForm({ ...form, damaged_copies: parseInt(e.target.value) || 0 })
                                }
                                className="rounded-none border-border font-bold text-xs bg-background"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase tracking-widest">
                                Rack Number / Section Tag
                              </Label>
                              <Input
                                value={form.rack_number || ""}
                                onChange={(e) => setForm({ ...form, rack_number: e.target.value })}
                                placeholder="e.g. Rack 4, Row B"
                                className="rounded-none border-border font-bold text-xs bg-background"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase tracking-widest">
                                Shelf Location
                              </Label>
                              <Input
                                value={form.shelf_location || ""}
                                onChange={(e) => setForm({ ...form, shelf_location: e.target.value })}
                                placeholder="e.g. Shelf 3"
                                className="rounded-none border-border font-bold text-xs bg-background"
                              />
                            </div>
                          </div>

                          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="procurement-check"
                              checked={form.procurement_needed || false}
                              onChange={(e) => setForm({ ...form, procurement_needed: e.target.checked })}
                              className="w-4 h-4 accent-emerald-600 cursor-pointer"
                            />
                            <Label
                              htmlFor="procurement-check"
                              className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 cursor-pointer"
                            >
                              Flag for New Procurement / Restock ("Konsi New Lani List")
                            </Label>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 4: Editorial Description & Publishing */}
                  <div className="space-y-4 bg-card p-5 border-2 border-border shadow-sm">
                    <div className="flex items-center gap-2 border-b border-border pb-3">
                      <span className="w-6 h-6 bg-[#FF9900] text-black text-xs font-black flex items-center justify-center">
                        4
                      </span>
                      <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                        Amazon Editorial Synopsis & Instant Storefront Publishing
                      </h3>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-foreground">
                        Book Description / Amazon Editorial Synopsis
                      </Label>
                      <Textarea
                        rows={3}
                        value={form.description || ""}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="Comprehensive synopsis of topics, chapter breakdown, and study objectives..."
                        className="rounded-none border-border font-bold text-xs"
                      />
                    </div>

                    <div className="flex items-center gap-2.5 p-3 bg-amber-500/10 border border-amber-500/30">
                      <input
                        type="checkbox"
                        id="pub-check"
                        checked={form.is_published}
                        onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                        className="w-4 h-4 accent-[#FF9900] cursor-pointer"
                      />
                      <Label
                        htmlFor="pub-check"
                        className="text-xs font-black uppercase tracking-wider cursor-pointer text-foreground"
                      >
                        Publish Instantly to Student Library & Amazon Storefront Showcase
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Right Side: Real-Time Live Amazon Listing Card Preview */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="sticky top-4 bg-[#131921] border-2 border-[#FF9900] p-5 space-y-4 shadow-2xl text-white">
                    <div className="flex items-center justify-between border-b border-amber-500/30 pb-3">
                      <span className="text-[11px] font-black uppercase tracking-widest text-[#FF9900] flex items-center gap-1.5">
                        <ShoppingBag className="w-4 h-4 text-[#FF9900]" /> Amazon Storefront Live Preview
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 bg-[#FF9900] text-black">
                        REAL-TIME SYNC
                      </span>
                    </div>

                    {/* Amazon Preview Card */}
                    <div className="border border-amber-500/20 bg-background text-foreground p-4 space-y-3.5 shadow-xl">
                      {/* Image Box */}
                      <div className="h-64 bg-muted border border-border overflow-hidden relative flex items-center justify-center group">
                        {form.cover_url ? (
                          <img
                            src={apiUrl(form.cover_url)}
                            alt="Cover Preview"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-muted-foreground p-4 text-center">
                            <BookOpen className="w-14 h-14 text-amber-500/50" />
                            <span className="text-[10px] font-black uppercase tracking-widest">
                              Amazon Cover Art Preview
                            </span>
                          </div>
                        )}
                        <span className="absolute top-2 left-2 bg-[#FF9900] text-black px-2 py-0.5 text-[8px] font-black uppercase tracking-widest shadow">
                          {form.category}
                        </span>
                        <span className="absolute bottom-2 right-2 bg-black/80 text-white px-2 py-0.5 text-[8px] font-black uppercase tracking-widest">
                          LOOK INSIDE 📖
                        </span>
                      </div>

                      {/* Ratings & Title */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1 text-[#FF9900]">
                          <Star className="w-3.5 h-3.5 fill-[#FF9900]" />
                          <Star className="w-3.5 h-3.5 fill-[#FF9900]" />
                          <Star className="w-3.5 h-3.5 fill-[#FF9900]" />
                          <Star className="w-3.5 h-3.5 fill-[#FF9900]" />
                          <Star className="w-3.5 h-3.5 fill-[#FF9900]" />
                          <span className="text-[10px] font-black text-foreground ml-1">4.9 ★★★★★ (142 Reviews)</span>
                        </div>
                        <h4 className="font-black uppercase tracking-tight text-base text-foreground line-clamp-2">
                          {form.title || "Complete Course Book Title"}
                        </h4>
                        <p className="text-[11px] font-bold text-muted-foreground uppercase line-clamp-1">
                          By <span className="text-primary underline">{form.author || "Author Name"}</span> {form.edition ? `• ${form.edition}` : ""}
                        </p>
                      </div>

                      {/* Format Choice Pills */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div className={`p-2 border text-left ${form.is_physical ? "border-[#FF9900] bg-[#FF9900]/10" : "border-border bg-muted/20 opacity-70"}`}>
                          <p className="text-[9px] font-black uppercase text-muted-foreground">Paperback</p>
                          <p className="text-xs font-black">{form.price && form.price > 0 ? `₹${form.price}` : "Free Library Copy"}</p>
                        </div>
                        <div className={`p-2 border text-left ${form.pdf_url ? "border-emerald-500 bg-emerald-500/10" : "border-border bg-muted/20 opacity-70"}`}>
                          <p className="text-[9px] font-black uppercase text-emerald-600">Kindle Edition</p>
                          <p className="text-xs font-black">FREE Access</p>
                        </div>
                      </div>

                      {/* Specs */}
                      <div className="text-[10px] text-muted-foreground space-y-1 bg-muted/30 p-3 border border-border">
                        <p><span className="font-bold text-foreground">ISBN:</span> {form.isbn || "978-3-16-148410-0"}</p>
                        <p><span className="font-bold text-foreground">Pages:</span> {form.total_pages || 100} Pages</p>
                        <p><span className="font-bold text-foreground">Categories:</span> {(form.categories || [form.category]).join(", ")}</p>
                        {form.is_physical && (
                          <p><span className="font-bold text-purple-600">Physical Stock:</span> {form.total_copies || 1} Copies ({form.shelf_location || "Rack A"})</p>
                        )}
                      </div>

                      {/* Mock Buy Button */}
                      <div className="pt-1">
                        <div className="w-full bg-[#FF9900] text-black py-2 text-center text-xs font-black uppercase tracking-widest shadow cursor-not-allowed">
                          Amazon Verified Listing Active
                        </div>
                      </div>
                    </div>

                    <p className="text-[9px] text-amber-300 font-bold uppercase text-center">
                      Live storefront preview updates instantly as you edit the book parameters.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Studio Footer */}
            <div className="p-4 bg-[#131921] border-t-2 border-[#FF9900] flex justify-between items-center text-white">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="rounded-none font-bold text-xs uppercase tracking-widest border-white/20 text-white hover:bg-white/10"
              >
                Cancel / Exit Studio
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="rounded-none font-black text-xs uppercase tracking-widest bg-[#FF9900] text-black hover:bg-amber-500 gap-2 px-8 shadow-xl text-base py-3"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingBag className="w-5 h-5" />}
                {isEditing ? "Update Amazon Listing" : "Publish to Amazon & Library"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Issue Book Modal with Student Verification & Custom Dates */}
        <Dialog open={isIssueModalOpen} onOpenChange={setIsIssueModalOpen}>
          <DialogContent className="max-w-xl rounded-none border-2 border-border shadow-2xl">
            <DialogHeader>
              <DialogTitle className="font-black uppercase tracking-tight text-lg flex items-center gap-2 text-primary">
                <UserCheck className="w-5 h-5 text-primary" />
                Physical & Digital Library Book Issue Desk
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* Select Book & Student */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
                    Select Book *
                  </Label>
                  <Select
                    value={issueForm.book_id}
                    onValueChange={(val) => setIssueForm({ ...issueForm, book_id: val })}
                  >
                    <SelectTrigger className="rounded-none border-border font-bold text-xs">
                      <SelectValue placeholder="Select a book from catalog" />
                    </SelectTrigger>
                    <SelectContent>
                      {books.map((b) => (
                        <SelectItem key={b._id || b.id} value={b._id || b.id || ""}>
                          {b.title} ({b.rack_number ? `${b.rack_number}` : "In Library"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
                    Select Student Recipient *
                  </Label>
                  <Select
                    value={issueForm.student_id}
                    onValueChange={(val) => setIssueForm({ ...issueForm, student_id: val })}
                  >
                    <SelectTrigger className="rounded-none border-border font-bold text-xs">
                      <SelectValue placeholder="Select student borrower" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s._id || s.id} value={s._id || s.id || ""}>
                          {s.fullName || s.full_name || s.username} (@{s.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Student Identity Verification Card Preview */}
              {issueForm.student_id && (() => {
                const sel = students.find((s) => getIdString(s._id || s.id) === issueForm.student_id);
                if (!sel) return null;
                return (
                  <div className="bg-primary/5 p-3 border border-primary/20 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-muted border border-border overflow-hidden flex items-center justify-center font-black">
                        {sel.profile_image || sel.avatar ? (
                          <img
                            src={apiUrl(sel.profile_image || sel.avatar || "")}
                            alt="Student Photo"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Users className="w-6 h-6 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-black text-foreground text-sm uppercase">
                          {sel.fullName || sel.full_name || sel.username}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">
                          Username: @{sel.username} {sel.enrollment_no || sel.enrollment_number ? `• Roll No: ${sel.enrollment_no || sel.enrollment_number}` : ""}
                        </p>
                        <span className="text-[9px] font-black uppercase text-emerald-600 flex items-center gap-1 mt-0.5">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" /> Identity Verified Student Record
                        </span>
                      </div>
                    </div>

                    <label className="flex items-center gap-1.5 p-2 bg-emerald-500/10 border border-emerald-500/30 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={issueForm.doc_verified}
                        onChange={(e) => setIssueForm({ ...issueForm, doc_verified: e.target.checked })}
                        className="w-3.5 h-3.5 accent-emerald-600 cursor-pointer"
                      />
                      <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">
                        Doc Proof Verified
                      </span>
                    </label>
                  </div>
                );
              })()}

              {/* Dates & Physical Condition */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
                    Start / Issue Date *
                  </Label>
                  <Input
                    type="date"
                    value={issueForm.issue_date}
                    onChange={(e) => setIssueForm({ ...issueForm, issue_date: e.target.value })}
                    className="rounded-none border-border font-bold text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
                    Return Due Date *
                  </Label>
                  <Input
                    type="date"
                    value={issueForm.due_date}
                    onChange={(e) => setIssueForm({ ...issueForm, due_date: e.target.value })}
                    className="rounded-none border-border font-bold text-xs"
                  />
                </div>
              </div>

              {/* Initial Physical Condition */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  Book Initial Condition at Time of Issue *
                </Label>
                <Select
                  value={issueForm.initial_condition}
                  onValueChange={(val) => setIssueForm({ ...issueForm, initial_condition: val })}
                >
                  <SelectTrigger className="rounded-none border-border font-bold text-xs">
                    <SelectValue placeholder="Select initial condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Brand New">Brand New / Perfect Copy</SelectItem>
                    <SelectItem value="Good Condition">Good Condition (No Damage)</SelectItem>
                    <SelectItem value="Minor Shelf Wear">Minor Shelf Wear / Normal Use</SelectItem>
                    <SelectItem value="Pre-existing Defect">Pre-existing Wear / Marked Copy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  Issue Document / Signed Slip URL (Optional Upload)
                </Label>
                <Input
                  value={issueForm.issue_doc_url}
                  onChange={(e) => setIssueForm({ ...issueForm, issue_doc_url: e.target.value })}
                  placeholder="e.g. /uploads/issue_slip_102.pdf or photo URL"
                  className="rounded-none border-border font-bold text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  Librarian Remarks / Issue Purpose
                </Label>
                <Input
                  value={issueForm.remarks}
                  onChange={(e) => setIssueForm({ ...issueForm, remarks: e.target.value })}
                  placeholder="e.g. Semester Exam Issue / Verified Student ID Proof"
                  className="rounded-none border-border font-bold text-xs"
                />
              </div>
            </div>

            <DialogFooter className="border-t border-border pt-3">
              <Button
                variant="outline"
                onClick={() => setIsIssueModalOpen(false)}
                className="rounded-none font-bold text-xs uppercase tracking-widest"
              >
                Cancel
              </Button>
              <Button
                onClick={handleIssueSubmit}
                disabled={issuing}
                className="rounded-none font-black text-xs uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
              >
                {issuing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirm & Issue Book
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mark Return Modal with Condition Audit & Damaged Copy Flag */}
        <Dialog open={isReturnModalOpen} onOpenChange={setIsReturnModalOpen}>
          <DialogContent className="max-w-md rounded-none border-2 border-border shadow-2xl">
            <DialogHeader>
              <DialogTitle className="font-black uppercase tracking-tight text-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                Confirm Book Return & Physical Audit
              </DialogTitle>
            </DialogHeader>

            {returnTarget && (
              <div className="space-y-4 py-2">
                <div className="bg-muted/30 p-3 border border-border space-y-1 text-xs">
                  <p className="font-black uppercase">{returnTarget.book_title}</p>
                  <p className="text-muted-foreground">
                    Issued to: <span className="font-bold">{returnTarget.student_name}</span> (@
                    {returnTarget.student_username})
                  </p>
                  {returnTarget.initial_condition && (
                    <p className="text-[10px] text-primary font-bold">
                      Initial Condition at Issue: {returnTarget.initial_condition}
                    </p>
                  )}
                </div>

                {/* Condition on return */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
                    Book Physical Condition on Return *
                  </Label>
                  <Select
                    value={returnForm.condition_on_return}
                    onValueChange={(val) =>
                      setReturnForm({
                        ...returnForm,
                        condition_on_return: val,
                        mark_as_damaged: val.includes("Damaged") || val.includes("Missing") || val.includes("Fat"),
                      })
                    }
                  >
                    <SelectTrigger className="rounded-none border-border font-bold text-xs">
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Good Condition">Good Condition (No Damage)</SelectItem>
                      <SelectItem value="Normal Wear">Normal Wear & Tear</SelectItem>
                      <SelectItem value="Damaged Cover">Damaged Cover (Fine Applies)</SelectItem>
                      <SelectItem value="Missing Pages">Missing / Torn Pages (Fine Applies)</SelectItem>
                      <SelectItem value="Fat Gayi / Damaged">Old Book Fat Gayi / Severe Damage</SelectItem>
                      <SelectItem value="Lost Book">Lost Book (Full Replacement Fine)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Mark as Damaged Copy Checkbox */}
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="mark-damaged-check"
                    checked={returnForm.mark_as_damaged}
                    onChange={(e) => setReturnForm({ ...returnForm, mark_as_damaged: e.target.checked })}
                    className="w-4 h-4 accent-amber-600 cursor-pointer"
                  />
                  <Label
                    htmlFor="mark-damaged-check"
                    className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 cursor-pointer"
                  >
                    Old Book Fat Gayi (Mark Copy as Damaged & Add to New Procurement List)
                  </Label>
                </div>

                {/* Student Rating */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
                    Student Rating (1 to 5 Stars)
                  </Label>
                  <div className="flex items-center gap-2 pt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReturnForm({ ...returnForm, student_rating: star })}
                        className={`p-1.5 border transition-all ${
                          returnForm.student_rating >= star
                            ? "border-amber-500 bg-amber-500/10 text-amber-500"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        <Star className={`w-4 h-4 ${returnForm.student_rating >= star ? "fill-amber-500" : ""}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
                    Late Fee / Damage Charge (₹)
                  </Label>
                  <Input
                    type="number"
                    value={returnForm.fine_amount}
                    onChange={(e) =>
                      setReturnForm({ ...returnForm, fine_amount: parseFloat(e.target.value) || 0 })
                    }
                    className="rounded-none border-border font-bold text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
                    Student Feedback & Physical Audit Remarks
                  </Label>
                  <Textarea
                    rows={2}
                    value={returnForm.student_feedback}
                    onChange={(e) => setReturnForm({ ...returnForm, student_feedback: e.target.value })}
                    placeholder="Student feedback or details of damage if any..."
                    className="rounded-none border-border font-bold text-xs"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="border-t border-border pt-3">
              <Button
                variant="outline"
                onClick={() => setIsReturnModalOpen(false)}
                className="rounded-none font-bold text-xs uppercase tracking-widest"
              >
                Cancel
              </Button>
              <Button
                onClick={handleReturnSubmit}
                disabled={returning}
                className="rounded-none font-black text-xs uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 gap-2"
              >
                {returning ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Complete Return
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reserve Book Modal */}
        <Dialog open={isReserveModalOpen} onOpenChange={setIsReserveModalOpen}>
          <DialogContent className="max-w-md rounded-none border-2 border-border shadow-2xl">
            <DialogHeader>
              <DialogTitle className="font-black uppercase tracking-tight text-lg flex items-center gap-2 text-purple-700">
                <BookmarkCheck className="w-5 h-5 text-purple-600" />
                Reserve Book for Next Borrower
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  Select Book *
                </Label>
                <Select
                  value={reserveForm.book_id}
                  onValueChange={(val) => setReserveForm({ ...reserveForm, book_id: val })}
                >
                  <SelectTrigger className="rounded-none border-border font-bold text-xs">
                    <SelectValue placeholder="Select a book to reserve" />
                  </SelectTrigger>
                  <SelectContent>
                    {books.map((b) => (
                      <SelectItem key={b._id || b.id} value={b._id || b.id || ""}>
                        {b.title} (Available: {b.available_copies ?? 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  Select Student *
                </Label>
                <Select
                  value={reserveForm.student_id}
                  onValueChange={(val) => setReserveForm({ ...reserveForm, student_id: val })}
                >
                  <SelectTrigger className="rounded-none border-border font-bold text-xs">
                    <SelectValue placeholder="Select student for reservation" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s._id || s.id} value={s._id || s.id || ""}>
                        {s.fullName || s.full_name || s.username} (@{s.username})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="border-t border-border pt-3">
              <Button
                variant="outline"
                onClick={() => setIsReserveModalOpen(false)}
                className="rounded-none font-bold text-xs uppercase tracking-widest"
              >
                Cancel
              </Button>
              <Button
                onClick={handleReserveSubmit}
                disabled={reserving}
                className="rounded-none font-black text-xs uppercase tracking-widest bg-purple-600 text-white hover:bg-purple-700 gap-2"
              >
                {reserving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirm Reservation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Amazon-Style Book Listing & Details View Modal */}
        <Dialog open={!!viewingBook} onOpenChange={(open) => !open && setViewingBook(null)}>
          <DialogContent className="max-w-4xl w-[95vw] rounded-none border-2 border-border shadow-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
            <DialogHeader className="p-4 bg-muted/40 border-b border-border flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="bg-amber-500 text-black px-2 py-0.5 font-black text-[9px] uppercase tracking-widest flex items-center gap-1">
                  <ShoppingBag className="w-3 h-3" /> Amazon Verified Listing
                </span>
                <DialogTitle className="font-black uppercase tracking-tight text-sm text-foreground">
                  Product Overview & Catalog Showcase
                </DialogTitle>
              </div>
            </DialogHeader>

            {viewingBook && (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                  {/* Left Column: Image Preview & Amazon Format Options */}
                  <div className="md:col-span-5 space-y-4">
                    <div className="h-72 bg-muted border-2 border-border relative flex items-center justify-center overflow-hidden group shadow-md">
                      {viewingBook.cover_url ? (
                        <img
                          src={apiUrl(viewingBook.cover_url)}
                          alt={viewingBook.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground p-4 text-center">
                          <BookOpen className="w-16 h-16 text-primary/40" />
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            No Cover Photo
                          </span>
                        </div>
                      )}
                      <span className="absolute top-2 left-2 bg-black/80 backdrop-blur text-white px-2 py-0.5 text-[9px] font-black uppercase tracking-widest">
                        {viewingBook.category}
                      </span>
                    </div>

                    {/* Amazon Format Option Boxes */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Available Formats & Editions
                      </Label>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className={`p-2.5 border text-left cursor-pointer transition-all ${
                          viewingBook.is_physical
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border bg-muted/20 opacity-60"
                        }`}>
                          <p className="font-black uppercase text-[10px]">Paperback / Hardcover</p>
                          <p className="text-[11px] font-bold mt-0.5">
                            {viewingBook.price && viewingBook.price > 0 ? `₹${viewingBook.price}` : "Physical Library"}
                          </p>
                          <span className="text-[9px] text-muted-foreground block font-bold">
                            {viewingBook.is_physical ? `${viewingBook.available_copies ?? 1} Available` : "N/A"}
                          </span>
                        </div>

                        <div className={`p-2.5 border text-left cursor-pointer transition-all ${
                          viewingBook.pdf_url
                            ? "border-emerald-500 bg-emerald-500/5 text-emerald-600"
                            : "border-border bg-muted/20 opacity-60"
                        }`}>
                          <p className="font-black uppercase text-[10px]">Kindle E-Book Edition</p>
                          <p className="text-[11px] font-bold mt-0.5">FREE Access</p>
                          <span className="text-[9px] text-emerald-600 block font-bold">
                            {viewingBook.pdf_url ? "PDF Instant Download" : "No Digital Copy"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Title, Rating, Amazon Specs & Stock Info */}
                  <div className="md:col-span-7 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5">
                          #1 Best Seller in {viewingBook.category}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-500/10 px-2 py-0.5">
                          {viewingBook.is_published ? "In Stock" : "Draft Listing"}
                        </span>
                      </div>
                      <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-foreground">
                        {viewingBook.title}
                      </h2>
                      <p className="text-xs font-bold text-muted-foreground uppercase mt-1">
                        By <span className="text-primary underline cursor-pointer">{viewingBook.author}</span> {viewingBook.edition ? `• ${viewingBook.edition}` : ""}
                      </p>
                    </div>

                    {/* Star Rating & Reviews Bar */}
                    <div className="flex items-center gap-3 border-y border-border py-2 text-xs">
                      <div className="flex items-center gap-1 text-amber-500">
                        <Star className="w-4 h-4 fill-amber-500" />
                        <Star className="w-4 h-4 fill-amber-500" />
                        <Star className="w-4 h-4 fill-amber-500" />
                        <Star className="w-4 h-4 fill-amber-500" />
                        <Star className="w-4 h-4 fill-amber-500" />
                        <span className="font-black text-foreground ml-1">4.8</span>
                      </div>
                      <span className="text-muted-foreground font-bold">| 142 Student Ratings & Reviews</span>
                    </div>

                    {/* Price & Stock Box */}
                    <div className="p-3 bg-muted/20 border border-border space-y-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-foreground">
                          {viewingBook.price && viewingBook.price > 0 ? `₹${viewingBook.price}` : "Free E-Book"}
                        </span>
                        {viewingBook.price && viewingBook.price > 0 ? (
                          <span className="text-xs text-muted-foreground line-through">
                            ₹{Math.round(viewingBook.price * 1.25)}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[10px] text-emerald-600 font-bold uppercase">
                        ✓ In Stock & Ready for Physical Issue or Instant Digital Reading
                      </p>
                      {viewingBook.shelf_location && (
                        <p className="text-[10px] text-purple-700 font-black uppercase">
                          Shelf Location: {viewingBook.shelf_location}
                        </p>
                      )}
                    </div>

                    {/* Specifications Grid */}
                    <div className="space-y-1.5">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Product Specification & Listing Details
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs bg-muted/10 p-3 border border-border">
                        <div>
                          <span className="text-muted-foreground font-bold">Publisher:</span>{" "}
                          <span className="font-black">SCRE Academic Press</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-bold">Print Length:</span>{" "}
                          <span className="font-black">{viewingBook.total_pages || 100} Pages</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-bold">ISBN-10:</span>{" "}
                          <span className="font-black">{viewingBook.isbn || "978-3-16-148410-0"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-bold">Categories:</span>{" "}
                          <span className="font-black">
                            {(viewingBook.categories || [viewingBook.category]).join(", ")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {viewingBook.description && (
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          About this Book / Synopsis
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed bg-muted/10 p-3 border border-border">
                          {viewingBook.description}
                        </p>
                      </div>
                    )}

                    {/* Quick Media Links & Action Buttons */}
                    <div className="pt-2 flex flex-wrap gap-2">
                      <Button
                        onClick={() => {
                          setViewingBook(null);
                          handleOpenIssue(viewingBook);
                        }}
                        className="rounded-none font-black text-xs uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
                      >
                        <UserCheck className="w-4 h-4" /> Issue to Student
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => {
                          setViewingBook(null);
                          handleOpenReserve(viewingBook);
                        }}
                        className="rounded-none font-bold text-xs uppercase tracking-widest border-purple-500/40 text-purple-600 hover:bg-purple-500/10 gap-1.5"
                      >
                        <BookmarkCheck className="w-4 h-4" /> Reserve Next Copy
                      </Button>

                      {viewingBook.pdf_url && (
                        <a
                          href={apiUrl(viewingBook.pdf_url)}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-2 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest flex items-center gap-1.5 hover:bg-emerald-700"
                        >
                          <FileText className="w-4 h-4" /> Open PDF
                        </a>
                      )}

                      {viewingBook.youtube_url && (
                        <a
                          href={viewingBook.youtube_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-2 bg-red-600 text-white font-black text-xs uppercase tracking-widest flex items-center gap-1.5 hover:bg-red-700"
                        >
                          <Youtube className="w-4 h-4" /> Video Lesson
                        </a>
                      )}

                      <Button
                        variant="outline"
                        onClick={() => {
                          const b = viewingBook;
                          setViewingBook(null);
                          handleOpenEdit(b);
                        }}
                        className="rounded-none font-bold text-xs uppercase tracking-widest gap-1.5"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit Listing
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
