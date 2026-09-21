import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface Book {
  _id?: string;
  id?: string;
  title: string;
  author: string;
  category: string;
  description?: string;
  cover_url?: string;
  pdf_url?: string;
  total_pages?: number;
  is_published: boolean;
}

export default function LibraryManagementPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<Book>({
    title: "",
    author: "",
    category: "Computer Science",
    description: "",
    cover_url: "",
    pdf_url: "",
    total_pages: 100,
    is_published: true,
  });

  const categories = [
    "Computer Science",
    "Programming",
    "Accounting & Tally",
    "Graphic & Web Design",
    "Hardware & Networking",
    "General Studies",
    "Soft Skills & English",
  ];

  const fetchBooks = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/library/admin/books");
      if (res && res.success) {
        setBooks(res.data || []);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load library books");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const handleOpenAdd = () => {
    setIsEditing(false);
    setCurrentId(null);
    setForm({
      title: "",
      author: "",
      category: "Computer Science",
      description: "",
      cover_url: "",
      pdf_url: "",
      total_pages: 100,
      is_published: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (b: Book) => {
    setIsEditing(true);
    setCurrentId(b._id || b.id || null);
    setForm({
      title: b.title,
      author: b.author,
      category: b.category,
      description: b.description || "",
      cover_url: b.cover_url || "",
      pdf_url: b.pdf_url || "",
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
        await apiFetch(`/api/library/books/${currentId}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
        toast.success("Book updated successfully");
      } else {
        await apiFetch("/api/library/books", {
          method: "POST",
          body: JSON.stringify(form),
        });
        toast.success("Book added to library successfully");
      }
      setIsModalOpen(false);
      fetchBooks();
    } catch (err: any) {
      toast.error(err.message || "Error saving book");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (!confirm("Are you sure you want to remove this book from the library?")) return;

    try {
      await apiFetch(`/api/library/books/${id}`, { method: "DELETE" });
      toast.success("Book removed");
      fetchBooks();
    } catch (err: any) {
      toast.error(err.message || "Error deleting book");
    }
  };

  const filteredBooks = books.filter((b) => {
    const matchesSearch =
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || b.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-primary/20 pb-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              <BookOpen className="w-7 h-7 text-primary" />
              Digital Library Management
            </h1>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1">
              Manage E-books, Reference Manuals & Course Study Materials
            </p>
          </div>
          <Button
            onClick={handleOpenAdd}
            className="rounded-none font-black text-xs uppercase tracking-widest gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
          >
            <Plus className="w-4 h-4" />
            Add New Book
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/20 p-4 border border-border">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, author, or keyword..."
              className="pl-9 rounded-none border-border font-bold text-xs"
            />
          </div>
          <div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="rounded-none border-border font-bold text-xs">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Books List Grid */}
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
                No books found
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
                className="rounded-none border-border shadow hover:border-primary/50 transition-all flex flex-col justify-between overflow-hidden"
              >
                <div>
                  {/* Cover thumbnail */}
                  <div className="h-44 bg-muted border-b border-border flex items-center justify-center overflow-hidden relative group">
                    {b.cover_url ? (
                      <img
                        src={b.cover_url}
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
                  </div>

                  <div className="p-4 space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5">
                      {b.category}
                    </span>
                    <h3 className="font-black uppercase tracking-tight text-foreground line-clamp-1 mt-1 text-sm">
                      {b.title}
                    </h3>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase line-clamp-1">
                      By {b.author}
                    </p>
                    {b.description && (
                      <p className="text-[11px] text-muted-foreground/80 line-clamp-2 mt-1 leading-relaxed">
                        {b.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-4 pt-0 border-t border-border mt-3 space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase pt-2">
                    <span>Pages: {b.total_pages || "--"}</span>
                    {b.pdf_url && (
                      <a
                        href={b.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        Preview PDF <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(b)}
                      className="flex-1 rounded-none font-bold text-[10px] uppercase tracking-wider h-8"
                    >
                      <Pencil className="w-3 h-3 mr-1" /> Edit
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

        {/* Add/Edit Book Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-xl rounded-none border-2 border-border shadow-2xl">
            <DialogHeader>
              <DialogTitle className="font-black uppercase tracking-tight text-lg">
                {isEditing ? "Edit Book" : "Add Book to Digital Library"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
                    Book Title *
                  </Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g., Modern Web Development with React"
                    className="rounded-none border-border font-bold text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
                    Author *
                  </Label>
                  <Input
                    value={form.author}
                    onChange={(e) => setForm({ ...form, author: e.target.value })}
                    placeholder="e.g., Dr. R. K. Sharma"
                    className="rounded-none border-border font-bold text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
                    Category
                  </Label>
                  <Select
                    value={form.category}
                    onValueChange={(val) => setForm({ ...form, category: val })}
                  >
                    <SelectTrigger className="rounded-none border-border font-bold text-xs">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
                    Estimated Total Pages
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

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  Cover Image URL
                </Label>
                <Input
                  value={form.cover_url || ""}
                  onChange={(e) => setForm({ ...form, cover_url: e.target.value })}
                  placeholder="https://example.com/cover.jpg or /uploads/cover.jpg"
                  className="rounded-none border-border font-bold text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  PDF E-Book Document URL
                </Label>
                <Input
                  value={form.pdf_url || ""}
                  onChange={(e) => setForm({ ...form, pdf_url: e.target.value })}
                  placeholder="https://example.com/book.pdf or /uploads/book.pdf"
                  className="rounded-none border-border font-bold text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  Description / Synopsis
                </Label>
                <Textarea
                  rows={3}
                  value={form.description || ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief synopsis of topics covered in this reference book..."
                  className="rounded-none border-border font-bold text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pub-check"
                  checked={form.is_published}
                  onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label
                  htmlFor="pub-check"
                  className="text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Make Visible & Readable to Students
                </Label>
              </div>
            </div>

            <DialogFooter className="border-t border-border pt-3">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="rounded-none font-bold text-xs uppercase tracking-widest"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="rounded-none font-black text-xs uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isEditing ? "Update Book" : "Add to Library"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
