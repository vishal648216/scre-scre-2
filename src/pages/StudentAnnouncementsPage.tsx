import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, Loader2, Megaphone, Calendar, ShieldAlert, Info, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Announcement {
  _id: string;
  id?: string;
  title: string;
  content: string;
  priority: string;
  created_at: string;
  is_edited?: boolean;
  edited_at?: string;
  category_id?: string;
}

const StudentAnnouncementsPage = () => {
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readAnnouncements, setReadAnnouncements] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("read_announcements");
    return new Set(saved ? JSON.parse(saved) : []);
  });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const token = sessionStorage.getItem("token");
      const response = await fetch("/api/announcements", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setAnnouncements(data);
      }
    } catch (error) {
      console.error("Error fetching announcements:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = (id: string) => {
    const newRead = new Set(readAnnouncements);
    newRead.add(id);
    setReadAnnouncements(newRead);
    localStorage.setItem("read_announcements", JSON.stringify([...newRead]));
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent": return <ShieldAlert className="w-5 h-5 text-destructive animate-pulse" />;
      case "high": return <Bell className="w-5 h-5 text-amber-500" />;
      default: return <Info className="w-5 h-5 text-primary" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Announcements</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Stay updated with the latest news and notices from the administration.</p>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : announcements.length === 0 ? (
          <Card className="rounded-none border-border border-dashed p-20 text-center opacity-60">
            <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">No active announcements at the moment</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {announcements.map(ann => (
              <Card key={ann._id} className={cn(
                "rounded-none border-border shadow-md hover:border-primary/40 transition-all overflow-hidden border-l-4",
                ann.priority === "urgent" ? "border-l-destructive bg-destructive/5" : "border-l-primary bg-card",
                !readAnnouncements.has(ann._id) && "bg-primary/5"
              )}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-12 h-12 shrink-0 flex items-center justify-center border transition-all",
                      ann.priority === "urgent" ? "bg-destructive/10 border-destructive/20" : "bg-primary/5 border-primary/10"
                    )}>
                      {getPriorityIcon(ann.priority)}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h3 className={cn(
                            "text-lg font-black uppercase tracking-tight",
                            ann.priority === "urgent" ? "text-destructive" : "text-foreground"
                          )}>{ann.title}</h3>
                          {!readAnnouncements.has(ann._id) && (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent text-accent-foreground">
                              New
                            </span>
                          )}
                          {ann.is_edited && (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              Edited
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(ann.created_at), "dd MMM yyyy, hh:mm a")}
                            {ann.is_edited && ann.edited_at && (
                              <>
                                <span className="mx-1">•</span>
                                Edited: {format(new Date(ann.edited_at), "dd MMM yyyy, hh:mm a")}
                              </>
                            )}
                          </p>
                          {!readAnnouncements.has(ann._id) && (
                            <button
                              onClick={() => markAsRead(ann._id)}
                              className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-dark transition-colors"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Mark as read
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm font-medium text-foreground/80 leading-relaxed italic border-l-2 border-primary/10 pl-4 py-1">
                        "{ann.content}"
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentAnnouncementsPage;
