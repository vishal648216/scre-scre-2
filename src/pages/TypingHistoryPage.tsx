import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, Zap, CheckCircle2, Clock, Loader2, Trophy, ArrowRight, RotateCcw, BarChart3, Award } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import TypingAnalyticsDashboard from "@/components/TypingAnalyticsDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TypingResult {
  _id: string;
  wpm: number;
  accuracy: number;
  duration_sec: number;
  mode: string;
  is_passed: boolean;
  certificate_id?: string;
  created_at: string;
  lesson_id: string;
  attempt_no: number;
}

const TypingHistoryPage = () => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<TypingResult[]>([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await fetch("/api/typing/history", {
        headers: { "Authorization": `Bearer ${sessionStorage.getItem("token")}` }
      });
      const data = await response.json();
      if (response.ok) setHistory(data);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  const bestWpm = history.length > 0 ? Math.max(...history.map(r => r.wpm)) : 0;
  const avgAccuracy = history.length > 0 ? history.reduce((acc, r) => acc + r.accuracy, 0) / history.length : 0;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Typing History</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Review your past performance and track your growth.</p>
          </div>
          <Link 
            to="/dashboard/student/typing"
            className="px-6 py-3 bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:opacity-90 transition-all flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Start New Practice
          </Link>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard label="Total Attempts" value={history.length.toString()} icon={History} color="text-blue-500" />
          <StatCard label="Best Speed" value={`${Math.round(bestWpm)} WPM`} icon={Zap} color="text-amber-500" />
          <StatCard label="Avg Accuracy" value={`${Math.round(avgAccuracy)}%`} icon={CheckCircle2} color="text-emerald-500" />
        </div>

        <Tabs defaultValue="analytics" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b-2 bg-transparent p-0 mb-8">
            <TabsTrigger 
              value="analytics" 
              className="rounded-none border-b-2 border-transparent px-8 py-3 font-black text-[10px] uppercase tracking-[0.2em] data-[state=active]:border-primary data-[state=active]:bg-muted/50 transition-all"
            >
              <BarChart3 className="w-4 h-4 mr-2" /> Performance Analytics
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="rounded-none border-b-2 border-transparent px-8 py-3 font-black text-[10px] uppercase tracking-[0.2em] data-[state=active]:border-primary data-[state=active]:bg-muted/50 transition-all"
            >
              <History className="w-4 h-4 mr-2" /> Attempt History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="mt-0">
            <TypingAnalyticsDashboard role="student" />
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <Card className="rounded-none border-border overflow-hidden shadow-xl">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" />
                  Detailed History Log
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {loading ? (
                  <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : history.length === 0 ? (
                  <div className="py-20 text-center opacity-60">
                    <History className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-xs font-black uppercase tracking-[0.2em]">No history found yet</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/10">
                        <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Date</th>
                        <th className="text-center px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Speed</th>
                        <th className="text-center px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Accuracy</th>
                    <th className="text-center px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                    <th className="text-center px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mode</th>
                    <th className="text-right px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((res) => (
                    <tr key={res._id} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-bold text-sm">{format(new Date(res.created_at), "dd MMM yyyy")}</p>
                        <p className="text-[10px] text-muted-foreground font-medium">{format(new Date(res.created_at), "hh:mm a")}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn(
                          "px-3 py-1 font-black text-xs rounded-none border shadow-sm group-hover:shadow-md transition-all",
                          res.wpm > 40 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                          res.wpm > 25 ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                          "bg-destructive/10 text-destructive border-destructive/20"
                        )}>
                          {Math.round(res.wpm)} WPM
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-sm">{Math.round(res.accuracy)}%</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border",
                          res.is_passed ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"
                        )}>
                          {res.is_passed ? "PASS" : "FAIL"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-muted border border-border">
                          {res.mode}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {res.certificate_id && (
                          <Link to={`/dashboard/typing/certificate/${res.certificate_id}`}>
                            <Button variant="ghost" size="sm" className="h-8 rounded-none font-black uppercase tracking-widest text-[9px] text-primary hover:bg-primary/10">
                              <Award className="w-3.5 h-3.5 mr-1.5" />
                              Certificate
                            </Button>
                          </Link>
                        )}
                        <span className="text-[9px] font-black text-muted-foreground ml-2">#{res.attempt_no}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

const StatCard = ({ label, value, icon: Icon, color }: { label: string, value: string, icon: any, color: string }) => (
  <Card className="rounded-none border-border shadow-md">
    <CardContent className="p-6 flex items-center gap-4">
      <div className={cn("w-12 h-12 bg-muted flex items-center justify-center border border-border", color)}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        <p className="text-2xl font-black text-foreground">{value}</p>
      </div>
    </CardContent>
  </Card>
);

export default TypingHistoryPage;
