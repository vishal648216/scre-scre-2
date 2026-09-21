import React, { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  BookOpen,
  Search,
  Clock,
  BookMarked,
  Flame,
  ExternalLink,
  Loader2,
  X,
  Sparkles,
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
}

interface ReadingStats {
  total_minutes: number;
  books_count: number;
}

export default function StudentLibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [stats, setStats] = useState<ReadingStats>({ total_minutes: 0, books_count: 0 });

  // Reader Modal State
  const [readingBook, setReadingBook] = useState<Book | null>(null);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const timerRef = useRef<any>(null);
  const heartbeatRef = useRef<any>(null);

  const categories = [
    "all",
    "Computer Science",
    "Programming",
    "Accounting & Tally",
    "Graphic & Web Design",
    "Hardware & Networking",
    "General Studies",
  ];

  const fetchBooks = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/library/books");
      if (res && res.success) {
        setBooks(res.data || []);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load library catalog");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await apiFetch("/api/library/reading/my-stats");
      if (res && res.success && res.data) {
        setStats({
          total_minutes: res.data.total_minutes || 0,
          books_count: res.data.books_count || 0,
        });
      }
    } catch (err) {
      console.warn("Could not fetch reading stats:", err);
    }
  };

  useEffect(() => {
    fetchBooks();
    fetchStats();
  }, []);

  // Heartbeat sender
  const sendHeartbeat = async (bookId: string, seconds: number) => {
    try {
      await apiFetch("/api/library/reading/heartbeat", {
        method: "POST",
        body: JSON.stringify({
          book_id: bookId,
          seconds,
          current_page: 1,
        }),
      });
    } catch (e) {
      console.warn("Failed to record reading heartbeat:", e);
    }
  };

  // Start Reader
  const openReader = (book: Book) => {
    setReadingBook(book);
    setSessionSeconds(0);

    // Stop existing timers
    if (timerRef.current) clearInterval(timerRef.current);
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);

    // Session seconds timer
    timerRef.current = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);

    // 30-second heartbeat to backend
    const bookId = book._id || book.id || "";
    heartbeatRef.current = setInterval(() => {
      sendHeartbeat(bookId, 30);
    }, 30000);
  };

  // Close Reader
  const closeReader = () => {
    if (readingBook) {
      const bookId = readingBook._id || readingBook.id || "";
      const remaining = sessionSeconds % 30;
      if (remaining > 5) {
        sendHeartbeat(bookId, remaining);
      }
      if (sessionSeconds >= 10) {
        toast.success(
          `Great job! ${Math.ceil(sessionSeconds / 60)} min of reading time recorded.`
        );
      }
    }

    if (timerRef.current) clearInterval(timerRef.current);
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    setReadingBook(null);
    setSessionSeconds(0);
    fetchStats();
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  const filteredBooks = books.filter((b) => {
    const matchesSearch =
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || b.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
        {/* Header & Stats Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 p-6 bg-gradient-to-r from-primary/10 via-primary/5 to-background border-2 border-primary/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-primary font-black uppercase text-xs tracking-widest mb-1">
                <Sparkles className="w-4 h-4" />
                SCRE Digital Knowledge Hub
              </div>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-foreground">
                Digital E-Library
              </h1>
              <p className="text-xs text-muted-foreground font-medium mt-1 max-w-xl">
                Access curated IT textbooks, study modules, and official reference material.
                Your study hours and reading progress are tracked directly onto your learning profile!
              </p>
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap gap-2 pt-4">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedCategory(c)}
                  className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider transition-all border ${
                    selectedCategory === c
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground hover:bg-muted border-border"
                  }`}
                >
                  {c === "all" ? "All Subjects" : c}
                </button>
              ))}
            </div>
          </div>

          {/* Reading Metrics Card */}
          <div className="p-6 bg-card border-2 border-border flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary" />
                Your Reading Tracker
              </span>
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-3 bg-muted/30 border border-border">
                <p className="text-2xl font-black text-foreground">
                  {stats.total_minutes}
                </p>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                  Minutes Read
                </p>
              </div>
              <div className="p-3 bg-muted/30 border border-border">
                <p className="text-2xl font-black text-primary">
                  {stats.books_count}
                </p>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                  Books Explored
                </p>
              </div>
            </div>

            <p className="text-[9px] text-muted-foreground uppercase text-center font-bold">
              Time spent reading in the E-reader counts towards your course engagement credit!
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search textbook title, author, topic..."
            className="pl-9 h-11 rounded-none border-border font-bold text-xs"
          />
        </div>

        {/* Books Grid */}
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
                No books match your selection
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredBooks.map((b) => (
              <Card
                key={b._id || b.id}
                className="rounded-none border-border shadow-md hover:border-primary/50 transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div>
                  {/* Cover */}
                  <div className="h-48 bg-muted border-b border-border flex items-center justify-center overflow-hidden relative">
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
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <BookOpen className="w-12 h-12 text-primary/40" />
                        <span className="text-[9px] font-black uppercase tracking-widest">
                          SCRE E-Book
                        </span>
                      </div>
                    )}
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest bg-black/70 text-white backdrop-blur">
                      {b.category}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="p-4 space-y-1.5">
                    <h3 className="font-black uppercase tracking-tight text-foreground line-clamp-1 text-sm">
                      {b.title}
                    </h3>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase line-clamp-1">
                      By {b.author}
                    </p>
                    {b.description && (
                      <p className="text-[11px] text-muted-foreground/80 line-clamp-2 leading-relaxed pt-1">
                        {b.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-4 pt-0 border-t border-border mt-3 space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase pt-2">
                    <span>{b.total_pages || 100} Pages</span>
                    <span className="flex items-center gap-1 text-emerald-600">
                      <Flame className="w-3.5 h-3.5" /> Full Access
                    </span>
                  </div>
                  <Button
                    onClick={() => openReader(b)}
                    className="w-full rounded-none font-black text-xs uppercase tracking-widest gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 shadow"
                  >
                    <BookOpen className="w-4 h-4" />
                    Read Online Now
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Digital Reader Modal */}
        {readingBook && (
          <Dialog open={!!readingBook} onOpenChange={(open) => !open && closeReader()}>
            <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 rounded-none border-2 border-border shadow-2xl flex flex-col justify-between">
              {/* Top Reader Toolbar */}
              <div className="p-4 bg-muted/40 border-b border-border flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-black uppercase tracking-tight text-sm line-clamp-1">
                      {readingBook.title}
                    </h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      By {readingBook.author} • {readingBook.category}
                    </p>
                  </div>
                </div>

                {/* Live Reading Timer Badge */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary">
                    <Clock className="w-4 h-4 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-widest">
                      Session: {formatTimer(sessionSeconds)}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={closeReader}
                    className="rounded-none font-black text-xs uppercase tracking-widest h-8"
                  >
                    <X className="w-4 h-4 mr-1" /> Close Reader
                  </Button>
                </div>
              </div>

              {/* Reader Viewport */}
              <div className="flex-1 bg-zinc-900 overflow-hidden relative flex items-center justify-center">
                {readingBook.pdf_url ? (
                  <iframe
                    src={readingBook.pdf_url}
                    title={readingBook.title}
                    className="w-full h-full border-none"
                  />
                ) : (
                  <div className="max-w-xl text-center p-8 space-y-4 bg-card border border-border m-6">
                    <BookOpen className="w-16 h-16 text-primary mx-auto opacity-70" />
                    <h4 className="text-lg font-black uppercase tracking-tight">
                      {readingBook.title}
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {readingBook.description ||
                        "This reference module is currently in interactive reading mode. Track your study time using the header counter."}
                    </p>
                    <div className="p-4 bg-muted/30 border border-border text-left space-y-2 text-xs">
                      <p className="font-black uppercase tracking-widest text-[10px] text-primary">
                        Chapter Outline & Study Notes
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-muted-foreground text-[11px]">
                        <li>Core Principles and Theoretical Framework</li>
                        <li>Practical Workflows and Applied Case Studies</li>
                        <li>Review Questions and Evaluation Checklists</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Reader Footer */}
              <div className="p-3 bg-muted/40 border-t border-border flex justify-between items-center text-xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  Reading heartbeat active • Synced to Student Study Portfolio
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeReader}
                  className="rounded-none font-bold text-xs uppercase tracking-widest h-7 text-primary"
                >
                  Finished Reading & Save Progress
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
}
