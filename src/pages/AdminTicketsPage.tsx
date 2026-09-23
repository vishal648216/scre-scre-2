import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  LifeBuoy, Search, MessageSquare, Clock, CheckCircle2, 
  AlertCircle, Send, Loader2, Filter, UserCheck, ShieldAlert
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
  student_name: string;
  student_roll_no?: string;
  center_name?: string;
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

const CATEGORIES: Record<string, string> = {
  fees: "Fee & Payment",
  exams: "Exams & Results",
  course: "Course / Syllabus",
  certificates: "Certificates",
  technical: "Technical Support",
  general: "General Query",
};

export default function AdminTicketsPage() {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Discussion & Resolution State
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [replying, setReplying] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Assignment State
  const [assignedRole, setAssignedRole] = useState("");

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
      console.error("Failed to load tickets", err);
      toast.error("Failed to load support queries");
    } finally {
      setLoading(false);
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
        toast.success("Reply dispatched to student");
        setReplyMessage("");
        const detailRes = await apiFetch(`/api/tickets/${ticketId}`);
        if (detailRes.ok) {
          const updated = await detailRes.json();
          setSelectedTicket(updated);
        }
        fetchTickets();
      } else {
        toast.error("Failed to send reply");
      }
    } catch (err) {
      toast.error("Network error while sending reply");
    } finally {
      setReplying(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedTicket) return;
    const ticketId = selectedTicket._id || selectedTicket.id;
    setUpdatingStatus(true);
    try {
      const res = await apiFetch(`/api/tickets/${ticketId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: newStatus,
          assigned_to: assignedRole || selectedTicket.assigned_to
        }),
      });

      if (res.ok) {
        toast.success(`Ticket marked as ${newStatus.toUpperCase()}`);
        setSelectedTicket(prev => prev ? { ...prev, status: newStatus } : null);
        fetchTickets();
      } else {
        toast.error("Failed to update ticket status");
      }
    } catch (err) {
      toast.error("Network error updating status");
    } finally {
      setUpdatingStatus(false);
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
      t.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.student_roll_no && t.student_roll_no.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || t.status.toLowerCase() === statusFilter;
    const matchesCategory = categoryFilter === "all" || t.category.toLowerCase() === categoryFilter;
    return matchesQuery && matchesStatus && matchesCategory;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 text-primary">
                <LifeBuoy className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Support Desk & Student Queries
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Centralized resolution console for inquiries raised by students and franchise study centers.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search candidate, roll no, ticket #, or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-none text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] rounded-none text-sm">
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

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[150px] rounded-none text-sm">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="fees">Fees & Payments</SelectItem>
                <SelectItem value="exams">Exams & Results</SelectItem>
                <SelectItem value="course">Course Doubt</SelectItem>
                <SelectItem value="certificates">Certificates</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tickets Grid / Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">Loading support inquiries...</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <Card className="rounded-none border-dashed p-12 text-center">
            <LifeBuoy className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-lg font-semibold">No queries found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
              There are currently no tickets matching your filter criteria.
            </p>
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
                      <span className="text-xs font-semibold text-muted-foreground">
                        • {CATEGORIES[ticket.category] || ticket.category}
                      </span>
                      {ticket.center_name && (
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5">
                          {ticket.center_name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        {ticket.student_name}
                      </span>
                      {ticket.student_roll_no && (
                        <span className="text-xs font-mono text-muted-foreground">
                          ({ticket.student_roll_no})
                        </span>
                      )}
                      <span className="text-muted-foreground">•</span>
                      <h4 className="text-sm font-semibold text-foreground truncate">
                        {ticket.subject}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {ticket.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-xs text-muted-foreground text-right hidden sm:block">
                      <p>Updated on:</p>
                      <p className="font-medium text-foreground">
                        {format(new Date(ticket.updated_at || ticket.created_at), "dd MMM, hh:mm a")}
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
                      Manage ({ticket.replies?.length || 0})
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Ticket Resolution & Thread Dialog */}
        {selectedTicket && (
          <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
            <DialogContent className="rounded-none max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
              <div className="p-6 border-b bg-muted/20">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
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
                      Student: <span className="font-semibold text-foreground">{selectedTicket.student_name}</span> {selectedTicket.student_roll_no && `(${selectedTicket.student_roll_no})`} • Center: {selectedTicket.center_name || "Head Office"}
                    </p>
                  </div>

                  {/* Status Change Buttons */}
                  <div className="flex items-center gap-1.5">
                    {selectedTicket.status !== "resolved" && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="rounded-none border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10 text-xs"
                        onClick={() => handleUpdateStatus("resolved")}
                        disabled={updatingStatus}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Resolved
                      </Button>
                    )}
                    {selectedTicket.status !== "closed" && (
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="rounded-none text-xs"
                        onClick={() => handleUpdateStatus("closed")}
                        disabled={updatingStatus}
                      >
                        Close
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Chat Thread */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="p-4 bg-muted/30 border border-border">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Candidate's Original Query:
                  </p>
                  <p className="text-sm whitespace-pre-wrap text-foreground">
                    {selectedTicket.description}
                  </p>
                </div>

                {selectedTicket.replies && selectedTicket.replies.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Thread History ({selectedTicket.replies.length})
                    </p>
                    {selectedTicket.replies.map((r, i) => {
                      const isStudent = r.sender_role?.toLowerCase() === "student";
                      return (
                        <div 
                          key={i} 
                          className={`p-3.5 border ${
                            isStudent 
                              ? "bg-muted/40 border-border mr-6" 
                              : "bg-primary/5 border-primary/20 ml-6"
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-bold flex items-center gap-1.5 text-foreground">
                              {r.sender_name}
                              <Badge variant={isStudent ? "outline" : "default"} className="text-[10px] px-1 py-0 rounded-none">
                                {isStudent ? "Student" : "Staff / Counselor"}
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

              {/* Staff Response Composer */}
              <div className="p-4 border-t bg-card space-y-2">
                <Textarea 
                  placeholder="Draft resolution, instructions, or reply to candidate..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="rounded-none min-h-[70px] text-sm"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Select value={assignedRole} onValueChange={setAssignedRole}>
                      <SelectTrigger className="w-[180px] h-8 rounded-none text-xs">
                        <SelectValue placeholder="Assign Staff Role" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none">
                        <SelectItem value="Academic Counselor">Academic Counselor</SelectItem>
                        <SelectItem value="Accounts Desk">Accounts Desk</SelectItem>
                        <SelectItem value="Exam Controller">Exam Controller</SelectItem>
                        <SelectItem value="Technical Team">Technical Team</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={handleSendReply} 
                    disabled={replying || !replyMessage.trim()}
                    className="rounded-none bg-primary text-primary-foreground gap-1.5"
                  >
                    {replying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Send Response
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

      </div>
    </DashboardLayout>
  );
}
