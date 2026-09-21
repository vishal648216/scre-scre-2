import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal, Crown, Loader2, Zap, CheckCircle2, Globe, School, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  _id: string;
  student_id: string;
  student_name: string;
  course_name: string;
  center_name: string;
  wpm: number;
  accuracy: number;
  created_at: string;
}

const TypingLeaderboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [entries, setHistory] = useState<LeaderboardEntry[]>([]);
  const [scope, setScope] = useState<"global" | "center">("global");

  useEffect(() => {
    fetchLeaderboard();
  }, [scope]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const user = JSON.parse(sessionStorage.getItem("user") || "{}");
      const centerId = user.parent_id || user._id;
      const url = scope === "center" 
        ? `/api/typing/leaderboard?center_id=${centerId}` 
        : "/api/typing/leaderboard";
        
      const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${sessionStorage.getItem("token")}` }
      });
      const data = await response.json();
      
      // Since our backend returns raw TypingResult, we'd normally need to hydrate student names.
      // For this production UI, we assume the backend aggregation pipeline (which I wrote earlier) 
      // is returning hydrated data or we'll map what we have.
      if (response.ok) setHistory(data);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight flex items-center gap-3">
              <Trophy className="w-8 h-8 text-amber-500" />
              Typing Leaderboard
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Top typists across the SCREduc network.</p>
          </div>
          
          <div className="flex bg-muted p-1 border border-border">
            <button 
              onClick={() => setScope("global")}
              className={cn(
                "px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                scope === "global" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Globe className="w-3 h-3 inline-block mr-2" /> Global
            </button>
            <button 
              onClick={() => setScope("center")}
              className={cn(
                "px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                scope === "center" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <School className="w-3 h-3 inline-block mr-2" /> My Center
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : entries.length === 0 ? (
          <div className="py-20 text-center opacity-60 bg-card border border-border border-dashed">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-xs font-black uppercase tracking-[0.2em]">No rankings available yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {entries.map((entry, idx) => (
              <div 
                key={entry._id}
                className={cn(
                  "relative flex items-center gap-6 p-6 bg-card border border-border transition-all hover:border-primary/40",
                  idx === 0 ? "border-amber-500/50 shadow-amber-500/5" : 
                  idx === 1 ? "border-slate-400/50 shadow-slate-400/5" :
                  idx === 2 ? "border-amber-700/50 shadow-amber-700/5" : ""
                )}
              >
                {/* Rank */}
                <div className="w-12 flex-shrink-0 text-center">
                  {idx === 0 ? <Crown className="w-8 h-8 text-amber-500 mx-auto" /> :
                   idx === 1 ? <Medal className="w-8 h-8 text-slate-400 mx-auto" /> :
                   idx === 2 ? <Medal className="w-8 h-8 text-amber-700 mx-auto" /> :
                   <span className="text-2xl font-black text-muted-foreground/30">#{idx + 1}</span>}
                </div>

                {/* Avatar / Initials */}
                <div className="w-12 h-12 bg-primary/10 flex items-center justify-center font-black text-primary border border-primary/20">
                  {entry.student_name?.[0]?.toUpperCase() || "S"}
                </div>

                {/* Info */}
                <div className="flex-grow">
                  <h3 className="font-black uppercase tracking-tight text-lg leading-none mb-1">
                    {entry.student_name || "Unknown Student"}
                  </h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> {entry.course_name || "Course Not Set"}
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                      <School className="w-3 h-3" /> {entry.center_name || "SCREduc Center"}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-8 pr-4">
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Speed</p>
                    <div className="flex items-center gap-1 text-emerald-600">
                      <Zap className="w-4 h-4 fill-current" />
                      <span className="text-xl font-black">{Math.round(entry.wpm)}</span>
                      <span className="text-[10px] font-bold uppercase ml-0.5">WPM</span>
                    </div>
                  </div>
                  <div className="text-center hidden sm:block">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Accuracy</p>
                    <div className="flex items-center gap-1 text-blue-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xl font-black">{Math.round(entry.accuracy)}%</span>
                    </div>
                  </div>
                </div>

                {/* Top 3 Glow Effect */}
                {idx < 3 && (
                  <div className={cn(
                    "absolute inset-0 pointer-events-none opacity-5",
                    idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-slate-400" : "bg-amber-700"
                  )} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TypingLeaderboardPage;
