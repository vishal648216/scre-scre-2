import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Video,
  Calendar,
  Clock,
  ExternalLink,
  Loader2,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface LiveClass {
  id: string;
  title: string;
  description?: string;
  platform: string;
  join_url: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  google_meet: "Google Meet",
  zoom: "Zoom",
  other: "Online Class",
};

const PLATFORM_ICONS: Record<string, string> = {
  google_meet: "🎥",
  zoom: "📹",
  other: "🔗",
};

export default function StudentLiveClassesPage() {
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [history, setHistory] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const [activeRes, histRes] = await Promise.all([
        apiFetch("/api/live-classes"),
        apiFetch("/api/live-classes?status=completed"),
      ]);

      if (activeRes.ok) {
        const data = await activeRes.json();
        setClasses(data.classes || []);
      }
      if (histRes.ok) {
        const data = await histRes.json();
        setHistory(data.classes || []);
      }
    } catch {
      toast.error("Failed to load live classes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
    // Poll every 30 seconds to detect ongoing status changes
    const interval = setInterval(fetchClasses, 30000);
    return () => clearInterval(interval);
  }, [fetchClasses]);

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const ongoingClasses = classes.filter((c) => c.status === "ongoing");
  const upcomingClasses = classes.filter((c) => c.status === "upcoming");
  const displayList = tab === "upcoming" ? [...ongoingClasses, ...upcomingClasses] : history;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-10">
        {/* Header */}
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
            Live Classes
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Join live sessions scheduled by your center.
          </p>
        </div>

        {/* Live Now alert */}
        {ongoingClasses.length > 0 && (
          <Card className="rounded-none border-red-500/50 bg-red-500/5">
            <CardContent className="py-4 px-5">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  <span className="font-bold text-red-600 dark:text-red-400">
                    {ongoingClasses.length} class{ongoingClasses.length > 1 ? "es" : ""} happening right now!
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {ongoingClasses.map((cls) => (
                    <Button
                      key={cls.id}
                      size="sm"
                      className="rounded-none gap-1.5 bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => window.open(cls.join_url, "_blank")}
                    >
                      <Radio className="w-3 h-3" />
                      Join: {cls.title}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {(["upcoming", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold uppercase tracking-wide border-b-2 transition-colors ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "upcoming" ? `Scheduled (${upcomingClasses.length + ongoingClasses.length})` : `History (${history.length})`}
            </button>
          ))}
        </div>

        {/* Classes */}
        {loading ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : displayList.length === 0 ? (
          <Card className="rounded-none border-border">
            <CardContent className="py-14 text-center text-muted-foreground">
              <Video className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p className="font-semibold">
                {tab === "upcoming"
                  ? "No upcoming live classes scheduled."
                  : "No past classes found."}
              </p>
              <p className="text-sm mt-1">
                {tab === "upcoming"
                  ? "Your center will schedule live sessions here."
                  : "Classes you attended will appear here."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {displayList.map((cls) => {
              const isOngoing = cls.status === "ongoing";
              const isCompleted = cls.status === "completed";
              const platformLabel = PLATFORM_LABELS[cls.platform] || "Online";
              const platformIcon = PLATFORM_ICONS[cls.platform] || "🔗";

              return (
                <Card
                  key={cls.id}
                  className={`rounded-none border-border transition-all ${
                    isOngoing ? "ring-2 ring-red-500/30 bg-red-500/5" : ""
                  }`}
                >
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span>{platformIcon}</span>
                          <h3 className="font-bold text-base">{cls.title}</h3>
                          {isOngoing && (
                            <Badge className="bg-red-500 text-white text-xs animate-pulse">
                              🔴 Live Now
                            </Badge>
                          )}
                          {isCompleted && (
                            <Badge variant="outline" className="text-xs">
                              Completed
                            </Badge>
                          )}
                        </div>
                        {cls.description && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {cls.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDateTime(cls.scheduled_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {cls.duration_minutes} mins
                          </span>
                          <span className="font-medium">{platformLabel}</span>
                        </div>
                      </div>

                      {!isCompleted && (
                        <Button
                          size="sm"
                          variant={isOngoing ? "default" : "outline"}
                          className={`rounded-none gap-1.5 shrink-0 ${
                            isOngoing ? "bg-red-600 hover:bg-red-700 text-white" : ""
                          }`}
                          onClick={() => window.open(cls.join_url, "_blank")}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          {isOngoing ? "Join Now" : "Open Link"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
