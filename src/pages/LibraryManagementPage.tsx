import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  MapPin,
  Barcode,
  UserCheck,
  RotateCcw,
  Clock,
  CheckCircle2,
  ShieldAlert,
  BookmarkPlus,
  Building2,
  Upload,
  User,
  Paperclip,
  Video,
  Star,
  BellRing,
  Calendar,
  Phone,
  Home,
  CreditCard,
  Layers,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, flattenBson } from "@/lib/api";

interface Center {
  _id?: string;
  id?: string;
  name?: string;
  center_name?: string;
  code?: string;
  city?: string;
}

interface Book {
  _id?: string;
  id?: string;
  title: string;
  author: string;
  category: string;
  isbn?: string;
  publisher?: string;
  edition?: string;
  volume_part?: string;
  registered_date?: string;
  shelf_location?: string;
  physical_copies?: number;
  available_copies?: number;
  fine_per_day?: number;
  description?: string;
  cover_url?: string;
  pdf_url?: string;
  video_url?: string;
  total_pages?: number;
  center_id?: string;
  center_name?: string;
  is_published: boolean;
}

interface Student {
  _id?: string;
  id?: string;
  name?: string;
  full_name?: string;
  enrollment_no?: string;
  enrollment_number?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  aadhaar_number?: string;
  center_id?: string;
  center_name?: string;
}

interface BookIssue {
  _id?: string;
  id?: string;
  book_id: string;
  book_title: string;
  student_id: string;
  student_name: string;
  student_enrollment?: string;
  student_address?: string;
  student_phone?: string;
  student_gov_id?: string;
  center_id?: string;
  center_name?: string;
  librarian_name?: string;
  document_number?: string;
  document_url?: string;
  penalty_reason?: string;
  issue_date: string;
  due_date: string;
  return_date?: string;
  reminder_sent_at?: string;
  fine_amount?: number;
  fine_paid?: boolean;
  status: "ISSUED" | "RETURNED" | "OVERDUE" | "LOST";
  notes?: string;
  condition_on_return?: string;
}

interface BookReservation {
  _id?: string;
  id?: string;
  book_id: string;
  book_title: string;
  student_id: string;
  student_name: string;
  center_id?: string;
  center_name?: string;
  reservation_date: string;
  status: "PENDING" | "FULFILLED" | "CANCELLED";
  notes?: string;
}

export default function LibraryManagementPage() {
  const [activeTab, setActiveTab] = useState("catalog");
  const [books, setBooks] = useState<Book[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [issues, setIssues] = useState<BookIssue[]>([]);
  const [reservations, setReservations] = useState<BookReservation[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [centerFilter, setCenterFilter] = useState("all");
  const [issueStatusFilter, setIssueStatusFilter] = useState("all");

  // Book Modal State
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isEditingBook, setIsEditingBook] = useState(false);
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);
  const [savingBook, setSavingBook] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  const [bookForm, setBookForm] = useState<Book>({
    title: "",
    author: "",
    category: "Computer Science",
    isbn: "",
    publisher: "",
    edition: "1st Edition",
    volume_part: "Vol 1",
    registered_date: new Date().toISOString().split("T")[0],
    description: "",
    cover_url: "",
    pdf_url: "",
    video_url: "",
    total_pages: 250,
    physical_copies: 5,
    available_copies: 5,
    shelf_location: "Rack A / Shelf 1",
    fine_per_day: 10,
    center_id: "all",
    center_name: "Main Central Library",
    is_published: true,
  });

  // Issue Book Modal State
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [selectedBookForIssue, setSelectedBookForIssue] = useState<Book | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedStudentObj, setSelectedStudentObj] = useState<Student | null>(null);
  const [issueCenterId, setIssueCenterId] = useState("");
  const [issueLibrarianName, setIssueLibrarianName] = useState("Library Manager");
  const [issueDocumentNumber, setIssueDocumentNumber] = useState("");
  const [issueDocumentUrl, setIssueDocumentUrl] = useState("");
  const [uploadingIssueDoc, setUploadingIssueDoc] = useState(false);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  });
  const [issueNotes, setIssueNotes] = useState("");
  const [issuing, setIssuing] = useState(false);

  // Return Book Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedIssueForReturn, setSelectedIssueForReturn] = useState<BookIssue | null>(null);
  const [returnCondition, setReturnCondition] = useState("Good");
  const [returnLibrarianName, setReturnLibrarianName] = useState("Library Manager");
  const [returnPenaltyReason, setReturnPenaltyReason] = useState("Late Return Fine");
  const [returnDocumentUrl, setReturnDocumentUrl] = useState("");
  const [calculatedFine, setCalculatedFine] = useState(0);
  const [finePaid, setFinePaid] = useState(true);
  const [returnNotes, setReturnNotes] = useState("");
  const [returning, setReturning] = useState(false);

  // Re-issue Modal State
  const [isReissueModalOpen, setIsReissueModalOpen] = useState(false);
  const [selectedIssueForReissue, setSelectedIssueForReissue] = useState<BookIssue | null>(null);
  const [reissueDueDate, setReissueDueDate] = useState("");
  const [reissuing, setReissuing] = useState(false);

  // Reserve Book Modal State
  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
  const [selectedBookForReserve, setSelectedBookForReserve] = useState<Book | null>(null);
  const [reserveStudentId, setReserveStudentId] = useState("");
  const [reserving, setReserving] = useState(false);

  // Video Modal State
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);

  const categories = [
    "Computer Science",
    "Programming & Web Dev",
    "Accounting & Tally",
    "Graphic & UI/UX Design",
    "Hardware & Networking",
    "Cyber Security",
    "General Knowledge & Aptitude",
    "English & Soft Skills",
  ];

  // Fetch all data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [bRes, sRes, cRes, iRes, rRes] = await Promise.all([
        apiFetch("/api/library/admin/books").then((r) => r.json()).catch(() => ({ success: false, data: [] })),
        apiFetch("/api/students").then((r) => r.json()).catch(() => ({ success: false, data: [] })),
        apiFetch("/api/public/centers").then((r) => r.json()).catch(() => ({ success: false, data: [] })),
        apiFetch("/api/library/issues").then((r) => r.json()).catch(() => ({ success: false, data: [] })),
        apiFetch("/api/library/reservations").then((r) => r.json()).catch(() => ({ success: false, data: [] })),
      ]);

      if (bRes && (bRes.success || Array.isArray(bRes.data))) setBooks(flattenBson(bRes.data || []));
      if (sRes && (sRes.success || Array.isArray(sRes.data) || Array.isArray(sRes))) {
        setStudents(flattenBson(Array.isArray(sRes) ? sRes : (Array.isArray(sRes.data) ? sRes.data : [])));
      }
      if (cRes && (cRes.success || Array.isArray(cRes.data) || Array.isArray(cRes))) {
        const rawCenters = Array.isArray(cRes) ? cRes : (Array.isArray(cRes.data) ? cRes.data : []);
        setCenters(flattenBson(rawCenters));
      }
      if (iRes && (iRes.success || Array.isArray(iRes.data))) setIssues(flattenBson(iRes.data || []));
      if (rRes && (rRes.success || Array.isArray(rRes.data))) setReservations(flattenBson(rRes.data || []));
    } catch (err: any) {
      toast.error(err.message || "Failed to load library records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update selected student object when student ID changes
  useEffect(() => {
    const s = students.find((st) => (st._id || st.id) === selectedStudentId);
    setSelectedStudentObj(s || null);
  }, [selectedStudentId, students]);

  // --- GENERAL FILE UPLOAD HELPER ---
  const handleFileUpload = async (
    file: File,
    onSuccess: (url: string) => void,
    setUploading: (b: boolean) => void
  ) => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await apiFetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data && (data.url || data.file_url || data.path)) {
        const finalUrl = data.url || data.file_url || data.path;
        onSuccess(finalUrl);
        toast.success("File uploaded successfully!");
      } else {
        toast.error(data.message || "Upload failed");
      }
    } catch (err: any) {
      toast.error(err.message || "File upload error");
    } finally {
      setUploading(false);
    }
  };

  // --- BOOK CRUD HANDLERS ---
  const handleOpenAddBook = () => {
    setIsEditingBook(false);
    setCurrentBookId(null);
    setBookForm({
      title: "",
      author: "",
      category: "Computer Science",
      isbn: `978-${Math.floor(100000000 + Math.random() * 900000000)}`,
      publisher: "SCRE Publications",
      edition: "1st Edition",
      volume_part: "Vol 1",
      registered_date: new Date().toISOString().split("T")[0],
      description: "",
      cover_url: "",
      pdf_url: "",
      video_url: "",
      total_pages: 200,
      physical_copies: 5,
      available_copies: 5,
      shelf_location: "Rack A / Shelf 1",
      fine_per_day: 10,
      center_id: "all",
      center_name: "Main Central Library",
      is_published: true,
    });
    setIsBookModalOpen(true);
  };

  const handleOpenEditBook = (b: Book) => {
    setIsEditingBook(true);
    setCurrentBookId(b._id || b.id || null);
    setBookForm({
      title: b.title,
      author: b.author,
      category: b.category,
      isbn: b.isbn || "",
      publisher: b.publisher || "",
      edition: b.edition || "1st Edition",
      volume_part: b.volume_part || "Vol 1",
      registered_date: b.registered_date || new Date().toISOString().split("T")[0],
      description: b.description || "",
      cover_url: b.cover_url || "",
      pdf_url: b.pdf_url || "",
      video_url: b.video_url || "",
      total_pages: b.total_pages || 200,
      physical_copies: b.physical_copies ?? 5,
      available_copies: b.available_copies ?? 5,
      shelf_location: b.shelf_location || "Rack A / Shelf 1",
      fine_per_day: b.fine_per_day ?? 10,
      center_id: b.center_id || "all",
      center_name: b.center_name || "Main Central Library",
      is_published: b.is_published,
    });
    setIsBookModalOpen(true);
  };

  const handleSaveBook = async () => {
    if (!bookForm.title.trim() || !bookForm.author.trim()) {
      toast.error("Please enter book title and author");
      return;
    }

    try {
      setSavingBook(true);
      const payload = {
        ...bookForm,
        center_id: bookForm.center_id === "all" ? undefined : bookForm.center_id,
      };

      const res = isEditingBook && currentBookId
        ? await apiFetch(`/api/library/books/${currentBookId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await apiFetch("/api/library/books", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      const data = await res.json();
      if (!res.ok || (data && data.success === false)) {
        toast.error(data.message || "Error saving book");
        return;
      }

      toast.success(isEditingBook ? "Amazon-style book entry updated successfully" : "Book entry created & added to Center Library");
      setIsBookModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Error saving book");
    } finally {
      setSavingBook(false);
    }
  };

  const handleDeleteBook = async (id?: string) => {
    if (!id) return;
    if (!confirm("Are you sure you want to delete this book from the library catalog?")) return;

    try {
      const res = await apiFetch(`/api/library/books/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || (data && data.success === false)) {
        toast.error(data.message || "Error deleting book");
        return;
      }
      toast.success("Book catalog entry removed");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Error deleting book");
    }
  };

  // --- ISSUE BOOK HANDLERS ---
  const handleOpenIssueBook = (b?: Book) => {
    const targetBook = b || books[0] || null;
    setSelectedBookForIssue(targetBook);
    const firstStudent = students[0];
    setSelectedStudentId(firstStudent?._id || firstStudent?.id || "");
    setSelectedStudentObj(firstStudent || null);
    setIssueCenterId(targetBook?.center_id || "all");
    setIssueLibrarianName("Library Manager");
    setIssueDocumentNumber(`SLIP-${Math.floor(10000 + Math.random() * 90000)}`);
    setIssueDocumentUrl("");
    const defaultDue = new Date();
    defaultDue.setDate(defaultDue.getDate() + 14);
    setDueDate(defaultDue.toISOString().split("T")[0]);
    setIssueNotes("");
    setIsIssueModalOpen(true);
  };

  const handleConfirmIssue = async () => {
    if (!selectedBookForIssue || !selectedStudentId) {
      toast.error("Please select a book and student");
      return;
    }

    const bId = selectedBookForIssue._id || selectedBookForIssue.id;
    const student = students.find((s) => (s._id || s.id) === selectedStudentId);

    if (!bId || !student) {
      toast.error("Invalid book or student selection");
      return;
    }

    const studentName = student.full_name || student.name || student.username || "Enrolled Student";
    const matchedCenter = centers.find((c) => (c._id || c.id) === issueCenterId);
    const centerName = matchedCenter?.name || matchedCenter?.center_name || selectedBookForIssue.center_name || "Main Central Library";

    try {
      setIssuing(true);
      const res = await apiFetch("/api/library/issues", {
        method: "POST",
        body: JSON.stringify({
          book_id: String(bId),
          student_id: String(selectedStudentId),
          student_name: studentName,
          student_address: student.address || "Address Recorded in Student File",
          student_phone: student.phone || student.mobile || "N/A",
          student_gov_id: student.aadhaar_number || student.national_id || "Aadhaar / ID Verified",
          center_id: issueCenterId === "all" ? undefined : issueCenterId,
          center_name: centerName,
          librarian_name: issueLibrarianName,
          document_number: issueDocumentNumber,
          document_url: issueDocumentUrl,
          due_date: dueDate,
          notes: issueNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok || (data && data.success === false)) {
        toast.error(data.message || "Failed to issue book");
        return;
      }

      toast.success(`Book "${selectedBookForIssue.title}" issued from ${centerName} to ${studentName}!`);
      setIsIssueModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to issue book");
    } finally {
      setIssuing(false);
    }
  };

  // --- SEND 2-DAY DUE REMINDER HANDLER ---
  const handleSendReminder = async (issueId?: string, bookTitle?: string) => {
    if (!issueId) return;
    try {
      const res = await apiFetch(`/api/library/issues/${issueId}/send-reminder`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || (data && data.success === false)) {
        toast.error(data.message || "Failed to send reminder");
        return;
      }
      toast.success(`2-Day Due Reminder sent to student panel for "${bookTitle}"`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to send reminder");
    }
  };

  // --- RE-ISSUE BOOK HANDLER ---
  const handleOpenReissue = (issue: BookIssue) => {
    setSelectedIssueForReissue(issue);
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setReissueDueDate(d.toISOString().split("T")[0]);
    setIsReissueModalOpen(true);
  };

  const handleConfirmReissue = async () => {
    if (!selectedIssueForReissue) return;
    const issueId = selectedIssueForReissue._id || selectedIssueForReissue.id;
    if (!issueId) return;

    try {
      setReissuing(true);
      const res = await apiFetch(`/api/library/issues/${issueId}/reissue`, {
        method: "PUT",
        body: JSON.stringify({
          new_due_date: reissueDueDate,
          notes: `Re-issued with extended due date to ${reissueDueDate}`,
        }),
      });

      const data = await res.json();
      if (!res.ok || (data && data.success === false)) {
        toast.error(data.message || "Failed to re-issue book");
        return;
      }

      toast.success("Book re-issued with extended return due date!");
      setIsReissueModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to re-issue book");
    } finally {
      setReissuing(false);
    }
  };

  // --- RETURN BOOK HANDLERS ---
  const handleOpenReturnModal = (issue: BookIssue) => {
    setSelectedIssueForReturn(issue);
    setReturnCondition("Good");
    setReturnLibrarianName("Library Manager");
    setReturnPenaltyReason("Late Return Fine");
    setReturnDocumentUrl("");
    setReturnNotes("");

    // Calculate fine dynamically
    const due = new Date(issue.due_date);
    const today = new Date();
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const matchedBook = books.find((b) => (b._id || b.id) === issue.book_id);
    const fineRate = matchedBook?.fine_per_day ?? 10;

    if (diffDays > 0) {
      setCalculatedFine(diffDays * fineRate);
      setFinePaid(true);
    } else {
      setCalculatedFine(0);
      setFinePaid(true);
    }

    setIsReturnModalOpen(true);
  };

  const handleConfirmReturn = async () => {
    if (!selectedIssueForReturn) return;
    const issueId = selectedIssueForReturn._id || selectedIssueForReturn.id;
    if (!issueId) return;

    try {
      setReturning(true);
      const res = await apiFetch(`/api/library/issues/${issueId}/return`, {
        method: "PUT",
        body: JSON.stringify({
          book_condition: returnCondition,
          condition_on_return: returnCondition,
          librarian_name: returnLibrarianName,
          penalty_reason: returnPenaltyReason,
          document_url: returnDocumentUrl,
          fine_amount: calculatedFine,
          fine_paid: finePaid,
          notes: returnNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok || (data && data.success === false)) {
        toast.error(data.message || "Failed to process return");
        return;
      }

      toast.success("Book returned & center inventory restocked!");
      setIsReturnModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to process return");
    } finally {
      setReturning(false);
    }
  };

  // --- CONVERT RESERVATION TO ACTIVE ISSUE HANDLER ---
  const handleConvertReservationToIssue = async (res: BookReservation) => {
    const resId = res._id || res.id;
    if (!resId) return;

    const matchedBook = books.find((b) => (b._id || b.id) === res.book_id);
    const matchedStudent = students.find((s) => (s._id || s.id) === res.student_id);

    if (!matchedBook || !matchedStudent) {
      toast.error("Book or student record missing for this reservation");
      return;
    }

    const defaultDue = new Date();
    defaultDue.setDate(defaultDue.getDate() + 14);

    try {
      const response = await apiFetch(`/api/library/reservations/${resId}/convert-to-issue`, {
        method: "POST",
        body: JSON.stringify({
          book_id: String(res.book_id),
          student_id: String(res.student_id),
          due_date: defaultDue.toISOString().split("T")[0],
          center_id: res.center_id || matchedBook.center_id || "all",
          center_name: res.center_name || matchedBook.center_name || "Main Central Library",
          librarian_name: "Library Manager",
          document_number: `SLIP-RES-${Math.floor(1000 + Math.random() * 9000)}`,
          notes: "Converted from student reservation request",
        }),
      });

      const data = await response.json();
      if (!response.ok || (data && data.success === false)) {
        toast.error(data.message || "Failed to convert reservation");
        return;
      }

      toast.success(`Reservation converted to Active Issue for ${res.student_name}!`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to convert reservation");
    }
  };

  // --- RESERVE BOOK HANDLERS ---
  const handleOpenReserveModal = (b?: Book) => {
    setSelectedBookForReserve(b || books[0] || null);
    setReserveStudentId(students[0]?._id || students[0]?.id || "");
    setIsReserveModalOpen(true);
  };

  const handleConfirmReserve = async () => {
    if (!selectedBookForReserve || !reserveStudentId) {
      toast.error("Please select a book and student");
      return;
    }

    const bId = selectedBookForReserve._id || selectedBookForReserve.id;
    const student = students.find((s) => (s._id || s.id) === reserveStudentId);

    if (!bId || !student) {
      toast.error("Invalid selection");
      return;
    }

    const studentName = student.full_name || student.name || student.username || "Enrolled Student";

    try {
      setReserving(true);
      const res = await apiFetch("/api/library/reservations", {
        method: "POST",
        body: JSON.stringify({
          book_id: String(bId),
          student_id: String(reserveStudentId),
          student_name: studentName,
          center_id: selectedBookForReserve.center_id,
          center_name: selectedBookForReserve.center_name || "Main Central Library",
        }),
      });

      const data = await res.json();
      if (!res.ok || (data && data.success === false)) {
        toast.error(data.message || "Failed to reserve book");
        return;
      }

      toast.success(`Book reserved for ${studentName}`);
      setIsReserveModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to reserve book");
    } finally {
      setReserving(false);
    }
  };

  // Filtered Lists
  const filteredBooks = books.filter((b) => {
    const matchesSearch =
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase()) ||
      (b.isbn && b.isbn.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = categoryFilter === "all" || b.category === categoryFilter;
    const matchesCenter = centerFilter === "all" || b.center_id === centerFilter || b.center_name === centerFilter;
    return matchesSearch && matchesCategory && matchesCenter;
  });

  const filteredIssues = issues.filter((i) => {
    const matchesSearch =
      (i.book_title || "").toLowerCase().includes(search.toLowerCase()) ||
      (i.student_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (i.document_number && i.document_number.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = issueStatusFilter === "all" || (i.status && i.status.toUpperCase() === issueStatusFilter.toUpperCase());
    const matchesCenter = centerFilter === "all" || i.center_id === centerFilter || i.center_name === centerFilter;
    return matchesSearch && matchesStatus && matchesCenter;
  });

  // Helper to find other centers that have stock for an unavailable book
  const getOtherCentersAvailability = (b: Book) => {
    return books.filter(
      (other) =>
        other.title.toLowerCase() === b.title.toLowerCase() &&
        (other.center_id !== b.center_id || other.center_name !== b.center_name) &&
        (other.available_copies ?? 0) > 0
    );
  };

  const handlePurgeTestData = async () => {
    if (!confirm("Purge all test/bogus library records and seed 5 realistic Amazon-style catalog books?")) return;
    try {
      setLoading(true);
      const res = await apiFetch("/api/library/purge-test-data", { method: "POST" });
      const data = await res.json();
      if (!res.ok || (data && data.success === false)) {
        toast.error(data.message || "Failed to purge test data");
        return;
      }
      toast.success("Test data purged & 5 realistic catalog books seeded!");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to purge test data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-500 relative">
        {/* Ambient Light Halos */}
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 bg-amber-500/10 blur-[140px] rounded-full pointer-events-none" />

        {/* Hero Header Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900/95 via-indigo-950/70 to-slate-900/95 backdrop-blur-2xl text-white p-6 md:p-8 rounded-3xl shadow-2xl border border-indigo-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 group">
          <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
          <div className="space-y-2 relative z-10">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="bg-amber-400/10 text-amber-300 border border-amber-400/30 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1.5 shadow-[0_0_12px_rgba(251,191,36,0.2)]">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 animate-pulse" /> Amazon Premium LMS Catalog
              </span>
              <span className="text-slate-400 text-xs font-semibold">• Multi-Center Physical Stock & Digital PDF Portal</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight flex items-center gap-3 text-white">
              <div className="p-2.5 bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 rounded-2xl shadow-lg shadow-amber-500/20">
                <BookOpen className="w-7 h-7" />
              </div>
              Center Physical & Digital Library System
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl font-medium leading-relaxed">
              Manage Amazon-style listings with video promos, PDF reading, verified student profile proofs, 2-day due reminders, and instant reservation-to-issue conversion.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 relative z-10 shrink-0">
            <Button
              onClick={handlePurgeTestData}
              variant="destructive"
              className="rounded-2xl font-black text-xs uppercase tracking-wider gap-2 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white shadow-lg shadow-rose-600/20 border border-rose-500/30 h-11 px-4"
            >
              <Trash2 className="w-4 h-4" />
              Purge Test Data
            </Button>
            <Button
              onClick={handleOpenAddBook}
              className="rounded-2xl font-black text-xs uppercase tracking-wider gap-2 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 shadow-xl shadow-amber-500/25 h-11 px-5 transition-all duration-300 hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              Add Book Entry
            </Button>
            <Button
              onClick={() => handleOpenIssueBook()}
              className="rounded-2xl font-black text-xs uppercase tracking-wider gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xl shadow-emerald-600/20 h-11 px-5 transition-all duration-300 hover:scale-105"
            >
              <UserCheck className="w-4 h-4" />
              Issue Book Entry
            </Button>
          </div>
        </div>

        {/* Quick Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-slate-900/80 to-slate-900/90 backdrop-blur-xl p-5 flex items-center justify-between shadow-xl group hover:border-indigo-500/60 transition-all duration-300">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Catalog Books</p>
              <h3 className="text-3xl font-black text-white">{books.length}</h3>
              <div className="flex items-center gap-1.5 text-[10px] text-indigo-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                Across {centers.length || 1} Centers
              </div>
            </div>
            <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center border border-indigo-500/30 group-hover:scale-110 transition-transform shadow-inner">
              <BookMarked className="w-6 h-6" />
            </div>
          </Card>

          <Card className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900/80 to-slate-900/90 backdrop-blur-xl p-5 flex items-center justify-between shadow-xl group hover:border-emerald-500/60 transition-all duration-300">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Active Borrowed Books</p>
              <h3 className="text-3xl font-black text-white">{issues.filter((i) => i.status?.toUpperCase() === "ISSUED" || i.status?.toUpperCase() === "OVERDUE").length}</h3>
              <p className="text-[10px] text-emerald-400 font-bold">With Profile & ID Proof</p>
            </div>
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-500/30 group-hover:scale-110 transition-transform shadow-inner">
              <Paperclip className="w-6 h-6" />
            </div>
          </Card>

          <Card className="rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-950/40 via-slate-900/80 to-slate-900/90 backdrop-blur-xl p-5 flex items-center justify-between shadow-xl group hover:border-rose-500/60 transition-all duration-300">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-300">Overdue Fines</p>
              <h3 className="text-3xl font-black text-rose-400">
                {issues.filter((i) => i.status?.toUpperCase() === "OVERDUE").length}
              </h3>
              <p className="text-[10px] text-rose-400 font-bold">2-Day Reminders Active</p>
            </div>
            <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center border border-rose-500/30 group-hover:scale-110 transition-transform shadow-inner">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </Card>

          <Card className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/40 via-slate-900/80 to-slate-900/90 backdrop-blur-xl p-5 flex items-center justify-between shadow-xl group hover:border-violet-500/60 transition-all duration-300">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-300">Student Reservations</p>
              <h3 className="text-3xl font-black text-white">{reservations.filter((r) => r.status?.toUpperCase() === "PENDING").length}</h3>
              <p className="text-[10px] text-violet-400 font-bold">Convertible to Active Issue</p>
            </div>
            <div className="w-12 h-12 bg-violet-500/20 text-violet-400 rounded-2xl flex items-center justify-center border border-violet-500/30 group-hover:scale-110 transition-transform shadow-inner">
              <BookmarkPlus className="w-6 h-6" />
            </div>
          </Card>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-900/80 p-4 border border-slate-700/60 rounded-2xl backdrop-blur-xl shadow-xl">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-indigo-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search catalog by title, author, ISBN, document slip no, student..."
              className="pl-10 rounded-xl border-slate-700 bg-slate-950/80 font-semibold text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="rounded-xl border-slate-700 bg-slate-950/80 font-semibold text-xs text-white focus:border-indigo-500">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-800 bg-slate-900 text-white">
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={centerFilter} onValueChange={setCenterFilter}>
              <SelectTrigger className="rounded-xl border-slate-700 bg-slate-950/80 font-semibold text-xs text-white focus:border-indigo-500">
                <SelectValue placeholder="All Centers" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-800 bg-slate-900 text-white">
                <SelectItem value="all">All Centers / Main Library</SelectItem>
                {centers.map((c) => (
                  <SelectItem key={c._id || c.id} value={c._id || c.id || c.name || ""}>
                    {c.name || c.center_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-slate-900/90 p-1.5 rounded-2xl border border-slate-700/60 w-full flex justify-start gap-2 overflow-x-auto backdrop-blur-xl shadow-lg">
            <TabsTrigger
              value="catalog"
              className="rounded-xl font-black text-xs uppercase tracking-wider px-5 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-500/25 transition-all text-slate-400"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Amazon Listing Catalog ({filteredBooks.length})
            </TabsTrigger>
            <TabsTrigger
              value="issues"
              className="rounded-xl font-black text-xs uppercase tracking-wider px-5 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-500/25 transition-all text-slate-400"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Issues, Documents & Reminders ({filteredIssues.length})
            </TabsTrigger>
            <TabsTrigger
              value="reservations"
              className="rounded-xl font-black text-xs uppercase tracking-wider px-5 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-500/25 transition-all text-slate-400"
            >
              <BookmarkPlus className="w-4 h-4 mr-2" />
              Reservations & Conversions ({reservations.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: AMAZON PREMIUM BOOK CATALOG */}
          <TabsContent value="catalog" className="mt-6 space-y-6">
            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Loading Amazon Listing Catalog...
                </p>
              </div>
            ) : filteredBooks.length === 0 ? (
              <Card className="rounded-3xl border-dashed border-2 border-slate-800 bg-slate-950/60 py-20 text-center backdrop-blur-xl">
                <CardContent className="space-y-4">
                  <BookMarked className="w-14 h-14 text-indigo-400/50 mx-auto" />
                  <p className="text-sm font-black uppercase tracking-widest text-slate-300">
                    No books matched your filter criteria
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenAddBook}
                    className="rounded-2xl font-bold text-xs uppercase tracking-wider border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20"
                  >
                    Add new book entry
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredBooks.map((b) => {
                  const avail = b.available_copies ?? 5;
                  const total = b.physical_copies ?? 5;
                  const isAvailable = avail > 0;
                  const otherCenters = !isAvailable ? getOtherCentersAvailability(b) : [];

                  return (
                    <Card
                      key={b._id || b.id}
                      className="rounded-3xl border border-slate-700/60 bg-gradient-to-b from-slate-900/90 via-slate-900/80 to-slate-950/95 backdrop-blur-xl shadow-xl hover:shadow-[0_20px_50px_rgba(79,70,229,0.2)] hover:border-indigo-500/60 transition-all duration-300 flex flex-col justify-between overflow-hidden group relative"
                    >
                      <div>
                        {/* Cover Image & Badges */}
                        <div className="h-60 bg-slate-950/90 border-b border-slate-800/80 relative overflow-hidden flex items-center justify-center p-4 group-hover:bg-slate-950 transition-colors">
                          {b.cover_url ? (
                            <img
                              src={b.cover_url}
                              alt={b.title}
                              className="w-36 h-48 object-cover rounded-2xl shadow-[0_16px_32px_rgba(0,0,0,0.8)] border border-slate-700/80 group-hover:scale-105 group-hover:-rotate-1 transition-all duration-500"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="w-36 h-48 bg-gradient-to-br from-indigo-950/70 to-slate-900 rounded-2xl border border-indigo-500/30 flex flex-col items-center justify-center gap-2 text-slate-400 p-4 text-center shadow-inner">
                              <BookOpen className="w-12 h-12 text-amber-400" />
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">
                                SCRE Physical Catalog
                              </span>
                            </div>
                          )}

                          {/* Availability Badge */}
                          <span
                            className={`absolute top-3 left-3 px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-full shadow-lg backdrop-blur-md border flex items-center gap-1.5 ${
                              isAvailable
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                                : "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.3)]"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isAvailable ? "bg-emerald-400 animate-ping" : "bg-rose-400"}`} />
                            {isAvailable ? `In Stock (${avail}/${total})` : "Out of Stock"}
                          </span>

                          {/* Category Badge & Star Rating */}
                          <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                            <span className="bg-slate-900/90 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-full shadow-md backdrop-blur-md">
                              {b.category}
                            </span>
                            <span className="bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-[9px] px-2.5 py-0.5 rounded-md flex items-center gap-1 shadow-md">
                              4.9 <Star className="w-2.5 h-2.5 fill-slate-950 text-slate-950" />
                            </span>
                          </div>

                          {/* Video Promo Play Overlay Button */}
                          {b.video_url && (
                            <button
                              onClick={() => setVideoModalUrl(b.video_url || null)}
                              className="absolute bottom-3 right-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white px-3 py-1 rounded-xl shadow-lg flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider backdrop-blur-md transition-all hover:scale-105 border border-rose-400/30"
                            >
                              <Video className="w-3.5 h-3.5" /> Promo Video
                            </button>
                          )}
                        </div>

                        {/* Details */}
                        <div className="p-5 space-y-3">
                          {/* Center Location Tag */}
                          <div className="flex items-center justify-between text-[10px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
                            <span className="flex items-center gap-1.5 truncate">
                              <Building2 className="w-3.5 h-3.5 text-amber-400" />
                              {b.center_name || "Main Central Library"}
                            </span>
                            {b.volume_part && (
                              <span className="bg-slate-900 text-amber-300 text-[8px] px-2 py-0.5 rounded-md border border-amber-500/30 font-bold">
                                {b.volume_part}
                              </span>
                            )}
                          </div>

                          <h3 className="font-black uppercase tracking-tight text-white text-base line-clamp-2 leading-snug group-hover:text-amber-400 transition-colors">
                            {b.title}
                          </h3>

                          <p className="text-[11px] font-bold text-slate-400 uppercase flex items-center justify-between border-b border-slate-800 pb-2">
                            <span>Author: <strong className="text-white">{b.author}</strong></span>
                            {b.edition && <span className="text-[9px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700">{b.edition}</span>}
                          </p>

                          {/* ISBN & Shelf Location */}
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-300">
                            <div className="flex items-center gap-1.5 bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                              <Barcode className="w-3.5 h-3.5 text-cyan-400" />
                              <span className="truncate">{b.isbn || "ISBN N/A"}</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                              <MapPin className="w-3.5 h-3.5 text-amber-400" />
                              <span className="truncate">{b.shelf_location || "Rack A / Shelf 1"}</span>
                            </div>
                          </div>

                          {/* Fine penalty rate & registered date */}
                          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-rose-400 bg-rose-500/10 p-2 rounded-xl border border-rose-500/20">
                            <span className="flex items-center gap-1.5">
                              <ShieldAlert className="w-3.5 h-3.5" /> Penalty Rate
                            </span>
                            <span className="text-white font-black">₹{b.fine_per_day || 10} / Day</span>
                          </div>

                          {/* Inter-Center Availability Notification if out of stock */}
                          {!isAvailable && (
                            <div className="bg-blue-500/10 border border-blue-500/30 p-2.5 rounded-xl text-[10px] space-y-1">
                              <span className="font-black text-blue-400 uppercase flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5" /> Inter-Center Availability:
                              </span>
                              {otherCenters.length > 0 ? (
                                otherCenters.map((oc) => (
                                  <p key={oc._id || oc.id} className="text-slate-300 font-bold">
                                    • {oc.center_name}: <span className="text-emerald-400 font-black">{oc.available_copies} copies available</span>
                                  </p>
                                ))
                              ) : (
                                <p className="text-slate-400 italic">Currently out of stock across all centers.</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="p-5 pt-0 space-y-3">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 border-t border-slate-800/80 pt-3">
                          <span>Pages: {b.total_pages || 200}</span>
                          {b.pdf_url ? (
                            <a
                              href={b.pdf_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-400 hover:text-cyan-300 font-black flex items-center gap-1"
                            >
                              Digital PDF <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-500 italic">Physical Only</span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            disabled={!isAvailable}
                            onClick={() => handleOpenIssueBook(b)}
                            className="rounded-xl font-black text-[10px] uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white h-9 shadow-lg disabled:opacity-50 transition-all hover:scale-[1.02]"
                          >
                            <UserCheck className="w-3.5 h-3.5 mr-1" /> Issue Book
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenReserveModal(b)}
                            className="rounded-xl font-black text-[10px] uppercase tracking-wider border-amber-500/40 text-amber-300 bg-slate-950/80 hover:bg-slate-800 h-9 transition-all hover:scale-[1.02]"
                          >
                            <BookmarkPlus className="w-3.5 h-3.5 mr-1" /> Reserve
                          </Button>
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-dashed border-slate-800">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditBook(b)}
                            className="flex-1 rounded-xl font-bold text-[10px] uppercase tracking-wider h-8 text-slate-400 hover:text-white hover:bg-slate-800"
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" /> Edit Listing
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteBook(b._id || b.id)}
                            className="rounded-xl font-bold text-[10px] uppercase text-rose-400 hover:bg-rose-500/10 h-8 px-2.5"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: ISSUES, DOCUMENTS, PROFILE PROOFS & REMINDERS */}
          <TabsContent value="issues" className="mt-6 space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/80 p-4 border border-slate-700/60 rounded-2xl backdrop-blur-xl shadow-xl">
              <div className="flex-1 w-full">
                <Select value={issueStatusFilter} onValueChange={setIssueStatusFilter}>
                  <SelectTrigger className="w-full md:w-[220px] rounded-xl border-slate-700 bg-slate-950/80 font-bold text-xs text-white">
                    <SelectValue placeholder="All Issue Statuses" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-800 bg-slate-900 text-white">
                    <SelectItem value="all">All Issue Statuses</SelectItem>
                    <SelectItem value="ISSUED">Active Issued</SelectItem>
                    <SelectItem value="OVERDUE">Overdue & Penalties</SelectItem>
                    <SelectItem value="RETURNED">Returned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => handleOpenIssueBook()}
                className="rounded-2xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg w-full md:w-auto h-10 px-5"
              >
                <Plus className="w-4 h-4 mr-1" /> Issue Book Entry
              </Button>
            </div>

            {filteredIssues.length === 0 ? (
              <Card className="rounded-3xl border-dashed border-2 border-slate-800 bg-slate-950/60 py-20 text-center backdrop-blur-xl">
                <CardContent className="space-y-4">
                  <RotateCcw className="w-14 h-14 text-indigo-400/50 mx-auto" />
                  <p className="text-sm font-black uppercase tracking-widest text-slate-400">
                    No book issue or document records found
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-3xl border border-slate-700/60 overflow-hidden bg-slate-950/85 backdrop-blur-2xl shadow-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-300 uppercase tracking-widest font-black text-[10px] border-b border-slate-700/80">
                    <tr>
                      <th className="p-4">Book & Center Branch</th>
                      <th className="p-4">Student Profile & Address</th>
                      <th className="p-4">Govt ID & Doc No.</th>
                      <th className="p-4">Manager / Librarian</th>
                      <th className="p-4">Dates & 2-Day Reminder</th>
                      <th className="p-4">Penalty & Reason</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredIssues.map((issue) => {
                      const isOverdue = issue.status?.toUpperCase() === "OVERDUE";
                      const isReturned = issue.status?.toUpperCase() === "RETURNED";

                      return (
                        <tr key={issue._id || issue.id} className="hover:bg-slate-900/50 transition-colors">
                          <td className="p-4 font-black uppercase tracking-tight text-white">
                            <div className="text-sm">{issue.book_title}</div>
                            <span className="text-[9px] font-bold text-amber-400 flex items-center gap-1 mt-1">
                              <Building2 className="w-3 h-3" />
                              {issue.center_name || "Main Central Library"}
                            </span>
                          </td>

                          <td className="p-4 font-bold text-slate-200">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-400 font-extrabold flex items-center justify-center text-xs border border-indigo-500/30 shrink-0">
                                {issue.student_name?.[0]?.toUpperCase() || "S"}
                              </div>
                              <div>
                                <div className="text-white font-black">{issue.student_name}</div>
                                {issue.student_enrollment && (
                                  <span className="text-[9px] text-slate-400 font-mono block">
                                    Enr #: {issue.student_enrollment}
                                  </span>
                                )}
                              </div>
                            </div>
                            {issue.student_phone && (
                              <span className="text-[9px] text-cyan-400 font-mono flex items-center gap-1 mt-1">
                                <Phone className="w-2.5 h-2.5" /> {issue.student_phone}
                              </span>
                            )}
                            {issue.student_address && (
                              <span className="text-[8px] text-slate-400 line-clamp-1 flex items-center gap-1 mt-0.5">
                                <Home className="w-2.5 h-2.5" /> {issue.student_address}
                              </span>
                            )}
                          </td>

                          <td className="p-4 font-bold">
                            {issue.document_number && (
                              <span className="text-[9px] text-slate-300 font-mono bg-slate-900 border border-slate-700 px-2 py-0.5 rounded-md block w-fit">
                                Slip #: {issue.document_number}
                              </span>
                            )}
                            {issue.student_gov_id && (
                              <span className="text-[8px] text-amber-400 font-mono block mt-1">
                                Gov ID: {issue.student_gov_id}
                              </span>
                            )}
                            {issue.document_url && (
                              <a
                                href={issue.document_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-400 hover:text-cyan-300 font-black text-[9px] flex items-center gap-1 mt-1"
                              >
                                <Paperclip className="w-3 h-3" /> View Slip Doc
                              </a>
                            )}
                          </td>

                          <td className="p-4 font-bold text-slate-300">
                            <span className="flex items-center gap-1.5 text-[11px]">
                              <User className="w-3.5 h-3.5 text-cyan-400" />
                              {issue.librarian_name || "Library Manager"}
                            </span>
                          </td>

                          <td className="p-4 font-mono text-[11px] text-slate-300">
                            <div>Issue: {issue.issue_date?.split("T")[0] || issue.issue_date}</div>
                            <div className={isOverdue ? "text-rose-400 font-bold" : "text-slate-400"}>
                              Due: {issue.due_date?.split("T")[0] || issue.due_date}
                            </div>
                            {!isReturned && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSendReminder(issue._id || issue.id, issue.book_title)}
                                className="mt-1.5 rounded-xl font-bold text-[8px] uppercase tracking-wider h-6 px-2.5 border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500 hover:text-slate-950 transition-all gap-1 shadow-sm"
                              >
                                <BellRing className="w-2.5 h-2.5" /> 2-Day Reminder
                              </Button>
                            )}
                          </td>

                          <td className="p-4 font-bold">
                            {issue.fine_amount ? (
                              <div className="space-y-0.5">
                                <span className="text-rose-400 font-black text-sm">₹{issue.fine_amount}</span>
                                {issue.penalty_reason && (
                                  <p className="text-[9px] text-rose-300 italic line-clamp-1">
                                    {issue.penalty_reason}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-500 font-mono">No Fine</span>
                            )}
                          </td>

                          <td className="p-4">
                            <Badge
                              className={`rounded-full font-black text-[9px] uppercase tracking-widest border px-3 py-1 ${
                                isReturned
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                  : isOverdue
                                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.3)]"
                                  : "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                              }`}
                            >
                              {issue.status}
                            </Badge>
                          </td>

                          <td className="p-4 text-right space-y-1">
                            {!isReturned ? (
                              <div className="flex flex-col gap-1.5 items-end">
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenReturnModal(issue)}
                                  className="rounded-xl font-black text-[10px] uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-white h-8 w-full border border-slate-700 shadow-md"
                                >
                                  <RotateCcw className="w-3 h-3 mr-1" /> Process Return
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenReissue(issue)}
                                  className="rounded-xl font-black text-[9px] uppercase tracking-wider border-slate-700 text-slate-300 hover:bg-slate-800 h-7 w-full"
                                >
                                  Re-Issue / Extend
                                </Button>
                              </div>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-400 uppercase flex items-center justify-end gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Returned ({issue.return_date?.split("T")[0] || issue.return_date || "Done"})
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* TAB 3: RESERVATIONS & CONVERSION REGISTER */}
          <TabsContent value="reservations" className="mt-6 space-y-6">
            {reservations.length === 0 ? (
              <Card className="rounded-3xl border-dashed border-2 border-slate-800 bg-slate-950/60 py-20 text-center backdrop-blur-xl">
                <CardContent className="space-y-4">
                  <BookmarkPlus className="w-14 h-14 text-indigo-400/50 mx-auto" />
                  <p className="text-sm font-black uppercase tracking-widest text-slate-400">
                    No active student reservations
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-3xl border border-slate-700/60 overflow-hidden bg-slate-950/85 backdrop-blur-2xl shadow-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-300 uppercase tracking-widest font-black text-[10px] border-b border-slate-700/80">
                    <tr>
                      <th className="p-4">Book Reserved</th>
                      <th className="p-4">Center Library</th>
                      <th className="p-4">Student Name</th>
                      <th className="p-4">Reservation Date</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Convert Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {reservations.map((res) => {
                      const isPending = res.status === "PENDING";
                      return (
                        <tr key={res._id || res.id} className="hover:bg-slate-900/50 transition-colors">
                          <td className="p-4 font-black uppercase tracking-tight text-white">
                            {res.book_title}
                          </td>
                          <td className="p-4 font-bold text-amber-400">
                            {res.center_name || "Main Central Library"}
                          </td>
                          <td className="p-4 font-bold text-slate-200">{res.student_name}</td>
                          <td className="p-4 font-mono text-[11px] text-slate-400">
                            {res.reservation_date}
                          </td>
                          <td className="p-4">
                            <Badge
                              className={`rounded-full font-black text-[9px] uppercase tracking-widest border px-3 py-1 ${
                                isPending
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                              }`}
                            >
                              {res.status}
                            </Badge>
                          </td>
                          <td className="p-4 text-right">
                            {isPending ? (
                              <Button
                                size="sm"
                                onClick={() => handleConvertReservationToIssue(res)}
                                className="rounded-xl font-black text-[10px] uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white gap-1.5 shadow-md"
                              >
                                Convert to Active Issue <ArrowRight className="w-3.5 h-3.5" />
                              </Button>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-400 uppercase flex items-center justify-end gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Issued to Student
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>


        {/* MODAL 1: ADD / EDIT AMAZON LISTING ENTRY */}
        <Dialog open={isBookModalOpen} onOpenChange={setIsBookModalOpen}>
          <DialogContent className="max-w-2xl rounded-3xl border border-indigo-500/30 bg-slate-950/95 backdrop-blur-2xl shadow-2xl p-6 text-slate-100">
            <DialogHeader className="border-b border-slate-800/80 pb-4">
              <DialogTitle className="font-black uppercase tracking-tight text-xl flex items-center gap-3 text-white">
                <div className="p-2 bg-amber-400/10 text-amber-400 border border-amber-400/30 rounded-xl">
                  <BookOpen className="w-5 h-5" />
                </div>
                {isEditingBook ? "Edit Amazon Listing Book Entry" : "Add New Amazon Premium Book Entry"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Book Title *
                  </Label>
                  <Input
                    value={bookForm.title}
                    onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                    placeholder="e.g., Modern Tally Prime & GST Accounting"
                    className="rounded-xl border-slate-800 bg-slate-900 font-semibold text-xs text-white placeholder:text-slate-500 focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Author / Writer *
                  </Label>
                  <Input
                    value={bookForm.author}
                    onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                    placeholder="e.g., Dr. V. K. Sharma"
                    className="rounded-xl border-slate-800 bg-slate-900 font-semibold text-xs text-white placeholder:text-slate-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Assigned Center Branch *
                  </Label>
                  <Select
                    value={bookForm.center_id || "all"}
                    onValueChange={(val) => {
                      const matched = centers.find((c) => (c._id || c.id) === val);
                      setBookForm({
                        ...bookForm,
                        center_id: val,
                        center_name: matched?.name || matched?.center_name || "Main Central Library",
                      });
                    }}
                  >
                    <SelectTrigger className="rounded-xl border-slate-800 bg-slate-900 font-semibold text-xs text-white">
                      <SelectValue placeholder="Select Center" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-800 bg-slate-900 text-white">
                      <SelectItem value="all">Main Central Library (All Centers)</SelectItem>
                      {centers.map((c) => (
                        <SelectItem key={c._id || c.id} value={c._id || c.id || c.name || ""}>
                          {c.name || c.center_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Category
                  </Label>
                  <Select
                    value={bookForm.category}
                    onValueChange={(val) => setBookForm({ ...bookForm, category: val })}
                  >
                    <SelectTrigger className="rounded-xl border-slate-800 bg-slate-900 font-semibold text-xs text-white">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-800 bg-slate-900 text-white">
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Volume / Part No.
                  </Label>
                  <Input
                    value={bookForm.volume_part || "Vol 1"}
                    onChange={(e) => setBookForm({ ...bookForm, volume_part: e.target.value })}
                    placeholder="Vol 1 / Part 2"
                    className="rounded-xl border-slate-800 bg-slate-900 font-semibold text-xs text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    ISBN Number
                  </Label>
                  <Input
                    value={bookForm.isbn || ""}
                    onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
                    placeholder="978-3-16-148410-0"
                    className="rounded-xl border-slate-800 bg-slate-900 font-semibold text-xs text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Publisher & Edition
                  </Label>
                  <Input
                    value={bookForm.edition || "1st Edition"}
                    onChange={(e) => setBookForm({ ...bookForm, edition: e.target.value })}
                    placeholder="1st Edition"
                    className="rounded-xl border-slate-800 bg-slate-900 font-semibold text-xs text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Registration Date
                  </Label>
                  <Input
                    type="date"
                    value={bookForm.registered_date || ""}
                    onChange={(e) => setBookForm({ ...bookForm, registered_date: e.target.value })}
                    className="rounded-xl border-slate-800 bg-slate-900 font-semibold text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
                    Physical Stock Count
                  </Label>
                  <Input
                    type="number"
                    value={bookForm.physical_copies ?? 5}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 0;
                      setBookForm({
                        ...bookForm,
                        physical_copies: count,
                        available_copies: count,
                      });
                    }}
                    className="rounded-xl border-slate-800 bg-slate-950 font-bold text-xs text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                    Shelf / Rack Location
                  </Label>
                  <Input
                    value={bookForm.shelf_location || "Rack A / Shelf 1"}
                    onChange={(e) => setBookForm({ ...bookForm, shelf_location: e.target.value })}
                    placeholder="Rack B-4 / Shelf 2"
                    className="rounded-xl border-slate-800 bg-slate-950 font-bold text-xs text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-rose-400">
                    Late Fine / Day (₹)
                  </Label>
                  <Input
                    type="number"
                    value={bookForm.fine_per_day ?? 10}
                    onChange={(e) => setBookForm({ ...bookForm, fine_per_day: parseInt(e.target.value) || 0 })}
                    placeholder="10"
                    className="rounded-xl border-slate-800 bg-slate-950 font-bold text-xs text-rose-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Cover Thumbnail URL / Upload
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={bookForm.cover_url || ""}
                      onChange={(e) => setBookForm({ ...bookForm, cover_url: e.target.value })}
                      placeholder="https://..."
                      className="rounded-xl border-slate-800 bg-slate-900 font-semibold text-xs text-white flex-1"
                    />
                    <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl flex items-center gap-1">
                      {uploadingCover ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleFileUpload(
                              e.target.files[0],
                              (url) => setBookForm({ ...bookForm, cover_url: url }),
                              setUploadingCover
                            );
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Digital PDF Document URL / Upload
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={bookForm.pdf_url || ""}
                      onChange={(e) => setBookForm({ ...bookForm, pdf_url: e.target.value })}
                      placeholder="https://..."
                      className="rounded-xl border-slate-800 bg-slate-900 font-semibold text-xs text-white flex-1"
                    />
                    <label className="cursor-pointer bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl flex items-center gap-1">
                      {uploadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleFileUpload(
                              e.target.files[0],
                              (url) => setBookForm({ ...bookForm, pdf_url: url }),
                              setUploadingPdf
                            );
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Promo / Video URL
                  </Label>
                  <Input
                    value={bookForm.video_url || ""}
                    onChange={(e) => setBookForm({ ...bookForm, video_url: e.target.value })}
                    placeholder="https://youtube.com/embed/..."
                    className="rounded-xl border-slate-800 bg-slate-900 font-semibold text-xs text-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Description / Synopsis
                </Label>
                <Textarea
                  rows={3}
                  value={bookForm.description || ""}
                  onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
                  placeholder="Detailed synopsis of topics covered..."
                  className="rounded-xl border-slate-800 bg-slate-900 font-semibold text-xs text-white"
                />
              </div>
            </div>

            <DialogFooter className="border-t border-slate-800/80 pt-4 gap-2">
              <Button
                variant="outline"
                onClick={() => setIsBookModalOpen(false)}
                className="rounded-xl font-bold text-xs uppercase tracking-wider border-slate-800 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveBook}
                disabled={savingBook}
                className="rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/25 px-5"
              >
                {savingBook ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isEditingBook ? "Update Amazon Entry" : "Save to Center Catalog"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL 2: ISSUE BOOK WITH STUDENT PROFILE CARD & GOVT ID PROOF */}
        <Dialog open={isIssueModalOpen} onOpenChange={setIsIssueModalOpen}>
          <DialogContent className="max-w-xl rounded-3xl border border-emerald-500/30 bg-slate-950/95 backdrop-blur-2xl shadow-2xl p-6 text-slate-100">
            <DialogHeader className="border-b border-slate-800/80 pb-4">
              <DialogTitle className="font-black uppercase tracking-tight text-xl flex items-center gap-3 text-white">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl">
                  <UserCheck className="w-5 h-5" />
                </div>
                Issue Book with Student Profile Verification
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Select Book *
                </Label>
                <Select
                  value={selectedBookForIssue?._id || selectedBookForIssue?.id || ""}
                  onValueChange={(val) => {
                    const b = books.find((x) => (x._id || x.id) === val);
                    setSelectedBookForIssue(b || null);
                    if (b?.center_id) setIssueCenterId(b.center_id);
                  }}
                >
                  <SelectTrigger className="rounded-xl border-slate-800 bg-slate-900 font-bold text-xs text-white">
                    <SelectValue placeholder="Choose book to issue" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-800 bg-slate-900 text-white">
                    {books.map((b) => (
                      <SelectItem key={b._id || b.id} value={b._id || b.id || ""}>
                        {b.title} [{b.center_name || "Main Center"}] (Avail: {b.available_copies ?? 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Select Center Student *
                  </Label>
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                    <SelectTrigger className="rounded-xl border-slate-800 bg-slate-900 font-bold text-xs text-white">
                      <SelectValue placeholder="Choose student" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-800 bg-slate-900 text-white">
                      {students.map((s) => (
                        <SelectItem key={s._id || s.id} value={s._id || s.id || ""}>
                          {s.name || s.full_name} ({s.enrollment_no || s.enrollment_number || "Enrolled"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Issuing Center Library *
                  </Label>
                  <Select value={issueCenterId} onValueChange={setIssueCenterId}>
                    <SelectTrigger className="rounded-xl border-slate-800 bg-slate-900 font-bold text-xs text-white">
                      <SelectValue placeholder="Select Center" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-800 bg-slate-900 text-white">
                      <SelectItem value="all">Main Central Library</SelectItem>
                      {centers.map((c) => (
                        <SelectItem key={c._id || c.id} value={c._id || c.id || c.name || ""}>
                          {c.name || c.center_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Student Profile Verification Card */}
              {selectedStudentObj && (
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 text-slate-100 p-4 border border-indigo-500/30 rounded-2xl shadow-lg space-y-2">
                  <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                    <span className="font-black text-amber-400 uppercase text-xs flex items-center gap-1.5">
                      <User className="w-4 h-4" /> Verified Student Profile
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                      Enr #: {selectedStudentObj.enrollment_no || selectedStudentObj.enrollment_number || "N/A"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <p className="text-slate-400 text-[9px] uppercase font-black">Student Name</p>
                      <p className="font-bold text-white">{selectedStudentObj.name || selectedStudentObj.full_name}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-[9px] uppercase font-black">Contact Phone</p>
                      <p className="font-bold text-white">{selectedStudentObj.phone || selectedStudentObj.mobile || "N/A"}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-slate-400 text-[9px] uppercase font-black">Address</p>
                      <p className="font-bold text-white line-clamp-1">{selectedStudentObj.address || "Rohtak Main Center, Haryana"}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-slate-400 text-[9px] uppercase font-black">Govt ID / Aadhaar Proof</p>
                      <p className="font-bold text-amber-300 font-mono">{selectedStudentObj.aadhaar_number || "Aadhaar Card Verified on Admission"}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Librarian / Manager Name *
                  </Label>
                  <Input
                    value={issueLibrarianName}
                    onChange={(e) => setIssueLibrarianName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="rounded-xl border-slate-800 bg-slate-900 font-bold text-xs text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Document / Slip No. *
                  </Label>
                  <Input
                    value={issueDocumentNumber}
                    onChange={(e) => setIssueDocumentNumber(e.target.value)}
                    placeholder="e.g., SLIP-84930"
                    className="rounded-xl border-slate-800 bg-slate-900 font-bold text-xs text-white"
                  />
                </div>
              </div>

              {/* Upload Issue Slip Document */}
              <div className="space-y-1.5 bg-slate-900/70 p-3 rounded-2xl border border-slate-800">
                <Label className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1">
                  <Paperclip className="w-3.5 h-3.5" /> Attach Issue Slip / Signed ID Proof Document
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={issueDocumentUrl}
                    onChange={(e) => setIssueDocumentUrl(e.target.value)}
                    placeholder="https://... or upload photo/PDF"
                    className="rounded-xl border-slate-800 bg-slate-950 font-bold text-xs text-white flex-1"
                  />
                  <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl flex items-center gap-1 border border-slate-700">
                    {uploadingIssueDoc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleFileUpload(
                            e.target.files[0],
                            (url) => setIssueDocumentUrl(url),
                            setUploadingIssueDoc
                          );
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Return Due Date *
                </Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="rounded-xl border-slate-800 bg-slate-900 font-bold text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Librarian Remarks / Purpose
                </Label>
                <Input
                  value={issueNotes}
                  onChange={(e) => setIssueNotes(e.target.value)}
                  placeholder="e.g. Semester Exam Issue / ID Verified"
                  className="rounded-xl border-slate-800 bg-slate-900 font-bold text-xs text-white"
                />
              </div>
            </div>

            <DialogFooter className="border-t border-slate-800/80 pt-4 gap-2">
              <Button
                variant="outline"
                onClick={() => setIsIssueModalOpen(false)}
                className="rounded-xl font-bold text-xs uppercase tracking-wider border-slate-800 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmIssue}
                disabled={issuing}
                className="rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-600/25 px-5"
              >
                {issuing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirm & Issue Book
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL 3: RETURN BOOK & PENALTY FINE */}
        <Dialog open={isReturnModalOpen} onOpenChange={setIsReturnModalOpen}>
          <DialogContent className="max-w-md rounded-3xl border border-rose-500/30 bg-slate-950/95 backdrop-blur-2xl shadow-2xl p-6 text-slate-100">
            <DialogHeader className="border-b border-slate-800/80 pb-4">
              <DialogTitle className="font-black uppercase tracking-tight text-xl flex items-center gap-3 text-white">
                <div className="p-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-xl">
                  <RotateCcw className="w-5 h-5" />
                </div>
                Process Return & Fine Audit
              </DialogTitle>
            </DialogHeader>

            {selectedIssueForReturn && (
              <div className="space-y-4 py-3 text-xs">
                <div className="bg-slate-900/80 text-slate-100 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <p className="font-black text-amber-400 uppercase text-sm">{selectedIssueForReturn.book_title}</p>
                  <p className="text-slate-300">Student: <strong className="text-white">{selectedIssueForReturn.student_name}</strong></p>
                  <p className="text-slate-400 text-[10px]">Due Date: {selectedIssueForReturn.due_date}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Librarian Manager
                    </Label>
                    <Input
                      value={returnLibrarianName}
                      onChange={(e) => setReturnLibrarianName(e.target.value)}
                      placeholder="Manager Name"
                      className="rounded-xl border-slate-800 bg-slate-900 font-bold text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Return Condition
                    </Label>
                    <Select value={returnCondition} onValueChange={setReturnCondition}>
                      <SelectTrigger className="rounded-xl border-slate-800 bg-slate-900 font-bold text-xs text-white">
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-slate-800 bg-slate-900 text-white">
                        <SelectItem value="Good">Good / Undamaged</SelectItem>
                        <SelectItem value="Minor Damage">Minor Damage / Marked</SelectItem>
                        <SelectItem value="Severely Damaged">Severely Damaged</SelectItem>
                        <SelectItem value="Lost">Lost by Student</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-rose-400">
                    Penalty / Fine Reason
                  </Label>
                  <Input
                    value={returnPenaltyReason}
                    onChange={(e) => setReturnPenaltyReason(e.target.value)}
                    placeholder="e.g. Overdue Return / Cover Damaged"
                    className="rounded-xl border-slate-800 bg-slate-900 font-bold text-xs text-white"
                  />
                </div>

                <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl space-y-2 text-rose-300">
                  <div className="flex items-center justify-between font-black uppercase">
                    <span className="flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-rose-400" /> Fine Amount
                    </span>
                    <div className="flex items-center gap-1">
                      <span>₹</span>
                      <input
                        type="number"
                        value={calculatedFine}
                        onChange={(e) => setCalculatedFine(parseFloat(e.target.value) || 0)}
                        className="w-20 bg-slate-950 text-white border border-rose-500/40 rounded-lg p-1 text-xs font-black text-right"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-rose-500/20">
                    <input
                      type="checkbox"
                      id="fine-paid-check"
                      checked={finePaid}
                      onChange={(e) => setFinePaid(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-500"
                    />
                    <Label htmlFor="fine-paid-check" className="font-bold text-xs text-slate-200 cursor-pointer">
                      Penalty Fine Collected from Student
                    </Label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Return Audit Notes
                  </Label>
                  <Input
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="e.g., Book inspected and returned to shelf."
                    className="rounded-xl border-slate-800 bg-slate-900 font-bold text-xs text-white"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="border-t border-slate-800/80 pt-4 gap-2">
              <Button
                variant="outline"
                onClick={() => setIsReturnModalOpen(false)}
                className="rounded-xl font-bold text-xs uppercase tracking-wider border-slate-800 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmReturn}
                disabled={returning}
                className="rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-white shadow-lg border border-slate-600 px-5"
              >
                {returning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Process Return & Restock
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL 4: RE-ISSUE / EXTEND DUE DATE */}
        <Dialog open={isReissueModalOpen} onOpenChange={setIsReissueModalOpen}>
          <DialogContent className="max-w-sm rounded-3xl border border-indigo-500/30 bg-slate-950/95 backdrop-blur-2xl shadow-2xl p-6 text-slate-100">
            <DialogHeader className="border-b border-slate-800/80 pb-4">
              <DialogTitle className="font-black uppercase tracking-tight text-xl flex items-center gap-3 text-white">
                <div className="p-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-xl">
                  <Clock className="w-5 h-5" />
                </div>
                Re-Issue & Extend Return Date
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  New Extended Return Due Date *
                </Label>
                <Input
                  type="date"
                  value={reissueDueDate}
                  onChange={(e) => setReissueDueDate(e.target.value)}
                  className="rounded-xl border-slate-800 bg-slate-900 font-bold text-xs text-white"
                />
              </div>
            </div>

            <DialogFooter className="border-t border-slate-800/80 pt-4 gap-2">
              <Button
                variant="outline"
                onClick={() => setIsReissueModalOpen(false)}
                className="rounded-xl font-bold text-xs uppercase tracking-wider border-slate-800 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmReissue}
                disabled={reissuing}
                className="rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 px-5"
              >
                {reissuing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirm Extension
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL 5: RESERVE BOOK */}
        <Dialog open={isReserveModalOpen} onOpenChange={setIsReserveModalOpen}>
          <DialogContent className="max-w-md rounded-3xl border border-violet-500/30 bg-slate-950/95 backdrop-blur-2xl shadow-2xl p-6 text-slate-100">
            <DialogHeader className="border-b border-slate-800/80 pb-4">
              <DialogTitle className="font-black uppercase tracking-tight text-xl flex items-center gap-3 text-white">
                <div className="p-2 bg-violet-500/10 text-violet-400 border border-violet-500/30 rounded-xl">
                  <BookmarkPlus className="w-5 h-5" />
                </div>
                Reserve Book for Student
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Selected Book
                </Label>
                <Input
                  disabled
                  value={`${selectedBookForReserve?.title || ""} [${selectedBookForReserve?.center_name || "Main Center"}]`}
                  className="rounded-xl border-slate-800 bg-slate-900/60 font-bold text-xs text-slate-300"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Select Student *
                </Label>
                <Select value={reserveStudentId} onValueChange={setReserveStudentId}>
                  <SelectTrigger className="rounded-xl border-slate-800 bg-slate-900 font-bold text-xs text-white">
                    <SelectValue placeholder="Choose student" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-800 bg-slate-900 text-white">
                    {students.map((s) => (
                      <SelectItem key={s._id || s.id} value={s._id || s.id || ""}>
                        {s.name || s.full_name} ({s.enrollment_no || s.enrollment_number || "Enrolled"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="border-t border-slate-800/80 pt-4 gap-2">
              <Button
                variant="outline"
                onClick={() => setIsReserveModalOpen(false)}
                className="rounded-xl font-bold text-xs uppercase tracking-wider border-slate-800 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmReserve}
                disabled={reserving}
                className="rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-600/25 px-5"
              >
                {reserving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirm Reservation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL 6: PROMO / VIDEO PREVIEW MODAL */}
        <Dialog open={!!videoModalUrl} onOpenChange={() => setVideoModalUrl(null)}>
          <DialogContent className="max-w-3xl rounded-3xl border border-rose-500/30 bg-slate-950/95 backdrop-blur-2xl shadow-2xl p-6 text-white">
            <DialogHeader className="border-b border-slate-800 pb-3">
              <DialogTitle className="font-black uppercase tracking-tight text-lg flex items-center gap-2 text-rose-400">
                <Video className="w-5 h-5" /> Book Promo & Video Summary Preview
              </DialogTitle>
            </DialogHeader>
            {videoModalUrl && (
              <div className="aspect-video w-full bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
                <iframe
                  src={videoModalUrl}
                  title="Book Promo Video"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

