import React, { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  BookOpen,
  Search,
  Clock,
  BookMarked,
  Flame,
  Loader2,
  X,
  Sparkles,
  BookmarkCheck,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, flattenBson } from "@/lib/api";

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

interface MyIssue {
  _id?: string;
  id?: string;
  book_title: string;
  center_name?: string;
  document_number?: string;
  issue_date: string;
  due_date: string;
  status: string;
  fine_amount?: number;
  fine_paid?: boolean;
}

export default function StudentLibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [myIssues, setMyIssues] = useState<MyIssue[]>([]);
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
      const data = await res.json();
      if (data && (data.success || Array.isArray(data.data))) {
        setBooks(flattenBson(data.data || []));
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
      const data = await res.json();
      if (data && data.success && data.data) {
        setStats({
          total_minutes: data.data.total_minutes || 0,
          books_count: data.data.books_count || 0,
        });
      }
    } catch (err) {
      console.warn("Could not fetch reading stats:", err);
    }
  };

  const fetchMyIssues = async () => {
    try {
      const res = await apiFetch("/api/library/student/my-issues");
      const data = await res.json();
      if (data && (data.success || Array.isArray(data.data))) {
        setMyIssues(flattenBson(data.data || []));
      }
    } catch (err) {
      console.warn("Could not fetch my issued books:", err);
    }
  };

  useEffect(() => {
    fetchBooks();
    fetchStats();
    fetchMyIssues();
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

    if (timerRef.current) clearInterval(timerRef.current);
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);

    timerRef.current = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);

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

  const handleDownloadSlip = (issue: MyIssue) => {
    const slipWindow = window.open("", "_blank", "width=800,height=600");
    if (!slipWindow) {
      toast.error("Please allow popups to download/print the library slip");
      return;
    }
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Library Book Issue Slip - ${issue.document_number || "SLIP"}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; background: #f8fafc; color: #0f172a; }
          .slip-card { max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 16px; border: 2px solid #e2e8f0; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
          .header { text-align: center; border-bottom: 2px dashed #cbd5e1; padding-bottom: 20px; margin-bottom: 20px; }
          .logo { font-size: 22px; font-weight: 900; color: #4f46e5; text-transform: uppercase; letter-spacing: 1px; }
          .sub-logo { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 4px; }
          .title { font-size: 16px; font-weight: 800; text-transform: uppercase; color: #1e293b; margin-top: 15px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
          .label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; }
          .val { font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px; }
          .status-badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase; background: #e0e7ff; color: #4338ca; }
          .barcode { text-align: center; padding: 15px; background: #f1f5f9; border-radius: 12px; font-family: monospace; font-weight: 700; letter-spacing: 4px; margin-top: 20px; }
          .footer { margin-top: 25px; text-align: center; font-size: 10px; color: #94a3b8; font-weight: 600; }
          @media print {
            body { padding: 0; background: #fff; }
            .slip-card { border: 1px solid #000; box-shadow: none; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="slip-card">
          <div class="header">
            <div class="logo">SCRE ACADEMIC LIBRARY</div>
            <div class="sub-logo">${issue.center_name || "Central Academic Center"}</div>
            <div class="title">Physical Book Issue Slip</div>
          </div>
          <div class="grid">
            <div>
              <div class="label">Slip / Doc Number</div>
              <div class="val">${issue.document_number || "LIB-" + Math.floor(100000 + Math.random() * 900000)}</div>
            </div>
            <div>
              <div class="label">Status</div>
              <div class="val"><span class="status-badge">${issue.status || "ISSUED"}</span></div>
            </div>
            <div style="grid-column: span 2;">
              <div class="label">Book Title</div>
              <div class="val" style="font-size: 15px; font-weight: 900;">${issue.book_title}</div>
            </div>
            <div>
              <div class="label">Issue Date</div>
              <div class="val">${issue.issue_date?.split("T")[0] || "N/A"}</div>
            </div>
            <div>
              <div class="label">Return Due Date</div>
              <div class="val" style="color: #dc2626;">${issue.due_date?.split("T")[0] || "N/A"}</div>
            </div>
          </div>
          <div class="barcode">
            ||||| ||| ||||||| |||| |||||| ||| ${issue.document_number || "LIB-894102"}
          </div>
          <div class="footer">
            Please present this slip when returning the physical book to the library center desk.
          </div>
          <div class="no-print" style="text-align: center; margin-top: 20px;">
            <button onclick="window.print()" style="padding: 10px 24px; background: #4f46e5; color: white; border: none; border-radius: 12px; font-weight: 800; cursor: pointer;">Print / Download Slip PDF</button>
          </div>
        </div>
      </body>
      </html>
    `;
    slipWindow.document.write(html);
    slipWindow.document.close();
  };

  return (
    <DashboardLayout role="Student">
      <div className="space-y-8 max-w-7xl mx-auto pb-16 animate-in fade-in duration-500">
        {/* Header & Stats Banner */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-8 bg-gradient-to-br from-slate-900 via-primary/10 to-slate-900 border border-primary/20 rounded-3xl shadow-2xl flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest mb-2">
                <Sparkles className="w-4 h-4" />
                SCRE Digital Knowledge Hub
              </div>
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white">
                Digital E-Library & Physical Book Slip
              </h1>
              <p className="text-xs md:text-sm text-slate-300 font-medium mt-2 max-w-2xl leading-relaxed">
                Access curated IT textbooks, study modules, and official reference material.
                Track your physical library borrowed books, due dates, and live study hours!
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2 pt-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedCategory(c)}
                  className={`px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border ${
                    selectedCategory === c
                      ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                      : "bg-slate-950/60 text-slate-300 hover:bg-slate-900 border-slate-800"
                  }`}
                >
                  {c === "all" ? "All Subjects" : c}
                </button>
              ))}
            </div>
          </div>

          {/* Reading Metrics Card */}
          <div className="p-6 bg-card/80 backdrop-blur-xl border border-border rounded-3xl shadow-sm flex flex-col justify-between space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary" />
                Your Reading Tracker
              </span>
              <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-4 bg-muted/30 rounded-2xl border border-border">
                <p className="text-3xl font-black text-foreground">
                  {stats.total_minutes}
                </p>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">
                  Minutes Read
                </p>
              </div>
              <div className="p-4 bg-muted/30 rounded-2xl border border-border">
                <p className="text-3xl font-black text-primary">
                  {stats.books_count}
                </p>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">
                  Books Explored
                </p>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground uppercase text-center font-bold leading-normal">
              Time spent reading in the E-reader counts towards your course engagement credit!
            </p>
          </div>
        </div>

        {/* Physical Borrowed Books Section */}
        {myIssues.length > 0 && (
          <div className="p-6 bg-amber-500/10 border border-amber-500/30 rounded-3xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-black text-amber-600 dark:text-amber-400 uppercase text-xs tracking-wider flex items-center gap-2">
                <BookMarked className="w-4 h-4" /> My Issued Physical Center Books ({myIssues.length})
              </span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold">
                Return before Due Date to Avoid Late Fines
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myIssues.map((issue) => {
                const isOverdue = issue.status?.toUpperCase() === "OVERDUE";
                const isReturned = issue.status?.toUpperCase() === "RETURNED";
                return (
                  <div key={issue._id || issue.id} className="p-4 bg-card rounded-2xl border border-border shadow-sm space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-black uppercase text-xs line-clamp-1">{issue.book_title}</h4>
                      <span className={`px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-full shrink-0 ${
                        isReturned ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                        isOverdue ? "bg-rose-500/10 text-rose-600 border border-rose-500/20 animate-pulse" :
                        "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                      }`}>
                        {issue.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-bold">{issue.center_name || "Central Library"}</p>
                    <div className="flex justify-between text-[10px] text-muted-foreground font-mono pt-2 border-t border-border">
                      <span>Slip: {issue.document_number || "N/A"}</span>
                      <span className={isOverdue ? "text-rose-600 font-bold" : "text-emerald-600"}>Due: {issue.due_date?.split("T")[0]}</span>
                    </div>

                    <Button
                      onClick={() => handleDownloadSlip(issue)}
                      variant="outline"
                      size="sm"
                      className="w-full rounded-xl text-[10px] font-black uppercase tracking-wider h-8 gap-1.5 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                    >
                      <Sparkles className="w-3 h-3" /> Download Issue Slip
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search textbook title, author, topic..."
            className="pl-11 h-12 rounded-2xl border-border bg-card/80 font-bold text-xs"
          />
        </div>

        {/* Books Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Loading library catalog...
            </p>
          </div>
        ) : filteredBooks.length === 0 ? (
          <Card className="rounded-3xl border-dashed border-2 bg-muted/20 py-16 text-center">
            <CardContent className="space-y-3">
              <BookMarked className="w-12 h-12 text-muted-foreground/40 mx-auto" />
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
                className="rounded-3xl border-border/80 bg-card hover:border-primary/50 transition-all duration-300 shadow-md hover:shadow-2xl hover:shadow-primary/5 flex flex-col justify-between overflow-hidden group"
              >
                <div>
                  {/* Cover */}
                  <div className="h-48 bg-muted border-b border-border flex items-center justify-center overflow-hidden relative">
                    {b.cover_url ? (
                      <img
                        src={b.cover_url}
                        alt={b.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
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
                    <span className="absolute bottom-3 left-3 px-3 py-1 text-[8px] font-black uppercase tracking-widest bg-black/80 text-white backdrop-blur rounded-full border border-white/20">
                      {b.category}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="p-5 space-y-2">
                    <h3 className="font-heading font-black uppercase tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-1 text-sm">
                      {b.title}
                    </h3>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase line-clamp-1">
                      By {b.author}
                    </p>
                    {b.description && (
                      <p className="text-[11px] text-muted-foreground/80 line-clamp-2 leading-relaxed pt-1 font-medium">
                        {b.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-5 pt-0 border-t border-border mt-3 space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase pt-2">
                    <span>{b.total_pages || 100} Pages</span>
                    <span className="flex items-center gap-1 text-emerald-600">
                      <Flame className="w-3.5 h-3.5" /> Full Access
                    </span>
                  </div>
                  <Button
                    onClick={() => openReader(b)}
                    className="w-full rounded-2xl font-black text-xs uppercase tracking-widest gap-2 bg-primary text-white hover:bg-primary/90 h-11 shadow-md shadow-primary/20"
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
            <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 rounded-3xl border border-slate-800 shadow-2xl flex flex-col justify-between overflow-hidden bg-slate-950">
              {/* Top Reader Toolbar */}
              <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading font-black uppercase tracking-tight text-sm text-white line-clamp-1">
                      {readingBook.title}
                    </h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      By {readingBook.author} • {readingBook.category}
                    </p>
                  </div>
                </div>

                {/* Live Reading Timer Badge */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/20 border border-primary/30 text-primary">
                    <Clock className="w-4 h-4 animate-pulse text-primary" />
                    <span className="text-xs font-black uppercase tracking-widest font-mono">
                      Session: {formatTimer(sessionSeconds)}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={closeReader}
                    className="rounded-2xl font-bold text-xs uppercase tracking-widest h-9 border-slate-700 text-white hover:bg-slate-800"
                  >
                    <X className="w-4 h-4 mr-1" /> Close Reader
                  </Button>
                </div>
              </div>

              {/* Reader Viewport */}
              <div className="flex-1 bg-zinc-950 overflow-hidden relative flex items-center justify-center">
                {readingBook.pdf_url ? (
                  <iframe
                    src={readingBook.pdf_url}
                    title={readingBook.title}
                    className="w-full h-full border-none"
                  />
                ) : (
                  <div className="max-w-xl text-center p-8 space-y-5 bg-slate-900 border border-slate-800 rounded-3xl m-6">
                    <BookOpen className="w-16 h-16 text-primary mx-auto opacity-80" />
                    <h4 className="text-xl font-black uppercase tracking-tight text-white">
                      {readingBook.title}
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      {readingBook.description ||
                        "This reference module is currently in interactive reading mode. Track your study time using the header counter."}
                    </p>
                    <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-left space-y-2 text-xs">
                      <p className="font-black uppercase tracking-widest text-[10px] text-primary flex items-center gap-1.5">
                        <BookmarkCheck className="w-4 h-4" />
                        Chapter Outline & Study Notes
                      </p>
                      <ul className="list-disc pl-5 space-y-1 text-slate-400 text-[11px] font-medium">
                        <li>Core Principles and Theoretical Framework</li>
                        <li>Practical Workflows and Applied Case Studies</li>
                        <li>Review Questions and Evaluation Checklists</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Reader Footer */}
              <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Reading heartbeat active • Synced to Student Study Portfolio
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeReader}
                  className="rounded-2xl font-black text-xs uppercase tracking-widest h-8 text-primary hover:bg-primary/10"
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


