import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  HelpCircle, Plus, Search, MessageSquare, Clock, CheckCircle2, 
  AlertCircle, ArrowLeft, Send, Loader2, Filter, LifeBuoy, FileText
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

interface TicketReply {
  sender_id: string;
  sender_name: string;
  sender_role: string;
  message: string;
  created_at: string;
}

interface SupportTicket {
  _id: string;
  id?: string;
  ticket_number: string;
  category: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  assigned_to?: string;
  replies?: TicketReply[];
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: "fees", label: "Fee & Payment Issue" },
  { value: "exams", label: "Exam & Result Inquiry" },
  { value: "course", label: "Study Material & Course Doubt" },
  { value: "certificates", label: "Certificate / Marksheet Issue" },
  { value: "technical", label: "App & Technical Support" },
  { value: "general", label: "General Student Query" },
];

export default function StudentHelpdeskPage() {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // New Ticket Modal State
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    category: "general",
    subject: "",
    description: "",
    priority: "medium",
  });

  // Ticket Details / Discussion State
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/tickets");
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
      }
    } catch (err) {
      console.error("Failed to fetch tickets", err);
      toast.error("Failed to load your support queries");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim() || !formData.description.trim()) {
      toast.error("Please provide both subject and detailed description");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success("Support query registered! Our academic team will assist you shortly.");
        setIsNewTicketOpen(false);
        setFormData({ category: "general", subject: "", description: "", priority: "medium" });
        fetchTickets();
      } else {
        toast.error("Failed to create ticket. Please try again.");
      }
    } catch (err) {
      toast.error("Network error while submitting query");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    const ticketId = selectedTicket._id || selectedTicket.id;
    setReplying(true);
    try {
      const res = await apiFetch(`/api/tickets/${ticketId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyMessage }),
      });

      if (res.ok) {
        toast.success("Message sent");
        setReplyMessage("");
        // Refresh single ticket details
        const detailRes = await apiFetch(`/api/tickets/${ticketId}`);
        if (detailRes.ok) {
          const updated = await detailRes.json();
          setSelectedTicket(updated);
        }
        fetchTickets();
      } else {
        toast.error("Failed to post message");
      }
    } catch (err) {
      toast.error("Failed to send message");
    } finally {
      setReplying(false);
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p.toLowerCase()) {
      case "urgent": return <Badge variant="destructive" className="rounded-none uppercase text-[10px] tracking-wider">Urgent</Badge>;
      case "high": return <Badge className="bg-amber-500 hover:bg-amber-600 rounded-none uppercase text-[10px] tracking-wider">High</Badge>;
      case "medium": return <Badge variant="outline" className="text-blue-500 border-blue-500/30 rounded-none uppercase text-[10px] tracking-wider">Medium</Badge>;
      default: return <Badge variant="secondary" className="rounded-none uppercase text-[10px] tracking-wider">Low</Badge>;
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s.toLowerCase()) {
      case "resolved":
        return <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20"><CheckCircle2 className="w-3 h-3" /> Resolved</span>;
      case "in_progress":
        return <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-500 bg-blue-500/10 px-2 py-0.5 border border-blue-500/20"><Clock className="w-3 h-3 animate-spin" /> In Progress</span>;
      case "closed":
        return <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 border">Closed</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 border border-amber-500/20"><AlertCircle className="w-3 h-3" /> Open</span>;
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchesQuery = t.ticket_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || t.status.toLowerCase() === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const openCount = tickets.filter(t => t.status === "open").length;
  const inProgressCount = tickets.filter(t => t.status === "in_progress").length;
  const resolvedCount = tickets.filter(t => t.status === "resolved").length;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
        
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 text-primary">
                <LifeBuoy className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Student Helpdesk & Query Support
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Have doubts regarding fees, examinations, syllabus, or certificates? Submit a ticket and track resolutions in real-time.
            </p>
          </div>
          <Button 
            onClick={() => setIsNewTicketOpen(true)}
            className="rounded-none bg-primary text-primary-foreground font-semibold shadow-md gap-2"
          >
            <Plus className="w-4 h-4" /> Raise New Query
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-none border-border shadow-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Tickets</p>
                <h3 className="text-2xl font-bold mt-1">{tickets.length}</h3>
              </div>
              <FileText className="w-8 h-8 text-primary/40" />
            </CardContent>
          </Card>
          <Card className="rounded-none border-border shadow-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-500">Open Tickets</p>
                <h3 className="text-2xl font-bold mt-1 text-amber-500">{openCount}</h3>
              </div>
              <AlertCircle className="w-8 h-8 text-amber-500/40" />
            </CardContent>
          </Card>
          <Card className="rounded-none border-border shadow-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Under Review</p>
                <h3 className="text-2xl font-bold mt-1 text-blue-500">{inProgressCount}</h3>
              </div>
              <Clock className="w-8 h-8 text-blue-500/40" />
            </CardContent>
          </Card>
          <Card className="rounded-none border-border shadow-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-500">Resolved</p>
                <h3 className="text-2xl font-bold mt-1 text-emerald-500">{resolvedCount}</h3>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-500/40" />
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by ticket #, subject, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-none text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] rounded-none text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Ticket List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">Loading your queries...</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <Card className="rounded-none border-dashed p-12 text-center">
            <HelpCircle className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-lg font-semibold">No support queries found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
              {searchQuery || statusFilter !== "all" 
                ? "No queries match your current search or filter criteria." 
                : "You don't have any open support tickets. Need help with courses or exams? Raise a query anytime!"}
            </p>
            <Button onClick={() => setIsNewTicketOpen(true)} className="rounded-none">
              <Plus className="w-4 h-4 mr-2" /> Raise First Query
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredTickets.map((ticket) => (
              <Card 
                key={ticket._id || ticket.id} 
                className="rounded-none border-border hover:border-primary/50 transition-all cursor-pointer shadow-sm"
                onClick={() => setSelectedTicket(ticket)}
              >
                <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 bg-primary/10 border border-primary/20">
                        {ticket.ticket_number}
                      </span>
                      {getStatusBadge(ticket.status)}
                      {getPriorityBadge(ticket.priority)}
                      <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                        • {CATEGORIES.find(c => c.value === ticket.category)?.label || ticket.category}
                      </span>
                    </div>
                    <h4 className="text-base font-semibold text-foreground truncate">
                      {ticket.subject}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {ticket.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 text-right">
                    <div className="text-xs text-muted-foreground hidden sm:block">
                      <p>Raised on:</p>
                      <p className="font-medium text-foreground">
                        {format(new Date(ticket.created_at), "dd MMM yyyy, hh:mm a")}
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-none gap-1.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTicket(ticket);
                      }}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Discussion ({ticket.replies?.length || 0})
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Raise Ticket Dialog */}
        <Dialog open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen}>
          <DialogContent className="rounded-none max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <LifeBuoy className="w-5 h-5 text-primary" />
                Submit Support Query
              </DialogTitle>
              <DialogDescription>
                Provide clear details about your question or issue so our support desk can resolve it promptly.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateTicket} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider font-semibold">Category *</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
                  >
                    <SelectTrigger className="rounded-none">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      {CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider font-semibold">Priority</Label>
                  <Select 
                    value={formData.priority} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v }))}
                  >
                    <SelectTrigger className="rounded-none">
                      <SelectValue placeholder="Select Priority" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="low">Low (General Query)</SelectItem>
                      <SelectItem value="medium">Medium (Standard Request)</SelectItem>
                      <SelectItem value="high">High (Urgent Attention)</SelectItem>
                      <SelectItem value="urgent">Urgent (Exam / Fee Blocker)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider font-semibold">Subject / Question Summary *</Label>
                <Input 
                  placeholder="e.g. Issue with payment receipt for Course Fees"
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  className="rounded-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider font-semibold">Detailed Description *</Label>
                <Textarea 
                  placeholder="Explain your doubt, transaction ID (if payment issue), exam name, or exact error faced..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="rounded-none min-h-[120px]"
                  required
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsNewTicketOpen(false)}
                  className="rounded-none"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={submitting} 
                  className="rounded-none bg-primary font-semibold text-primary-foreground gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Submit Ticket
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Ticket Details & Discussion Dialog */}
        {selectedTicket && (
          <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
            <DialogContent className="rounded-none max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
              <div className="p-6 border-b bg-muted/20">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 bg-primary/10 border border-primary/20">
                        {selectedTicket.ticket_number}
                      </span>
                      {getStatusBadge(selectedTicket.status)}
                      {getPriorityBadge(selectedTicket.priority)}
                    </div>
                    <h3 className="text-lg font-bold text-foreground mt-1">
                      {selectedTicket.subject}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Opened on {format(new Date(selectedTicket.created_at), "dd MMMM yyyy, hh:mm a")} • Category: {CATEGORIES.find(c => c.value === selectedTicket.category)?.label || selectedTicket.category}
                    </p>
                  </div>
                </div>
              </div>

              {/* Chat / Discussion History */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Original Description */}
                <div className="p-4 bg-muted/30 border border-border/80">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Initial Query Description:
                  </p>
                  <p className="text-sm whitespace-pre-wrap text-foreground">
                    {selectedTicket.description}
                  </p>
                </div>

                {/* Replies Stream */}
                {selectedTicket.replies && selectedTicket.replies.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Discussion History ({selectedTicket.replies.length})
                    </p>
                    {selectedTicket.replies.map((r, i) => {
                      const isStudent = r.sender_role?.toLowerCase() === "student";
                      return (
                        <div 
                          key={i} 
                          className={`p-3.5 border ${
                            isStudent 
                              ? "bg-primary/5 border-primary/20 ml-6" 
                              : "bg-muted/40 border-border mr-6"
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-bold flex items-center gap-1.5 text-foreground">
                              {r.sender_name}
                              <Badge variant={isStudent ? "secondary" : "default"} className="text-[10px] px-1 py-0 rounded-none">
                                {isStudent ? "Student" : "Counselor / Staff"}
                              </Badge>
                            </span>
                            <span className="text-muted-foreground text-[11px]">
                              {format(new Date(r.created_at), "dd MMM, hh:mm a")}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap text-foreground/90">
                            {r.message}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reply Box */}
              {selectedTicket.status !== "closed" ? (
                <div className="p-4 border-t bg-card space-y-2">
                  <Textarea 
                    placeholder="Type your message or follow-up note here..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    className="rounded-none min-h-[70px] text-sm"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Replies are instantly visible to the academic support team.
                    </p>
                    <Button 
                      onClick={handleSendReply} 
                      disabled={replying || !replyMessage.trim()}
                      className="rounded-none bg-primary text-primary-foreground gap-1.5"
                    >
                      {replying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Send Reply
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 border-t bg-muted/20 text-center text-xs text-muted-foreground">
                  This query has been marked as closed. Please raise a new ticket if you need further assistance.
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}

      </div>
    </DashboardLayout>
  );
}
