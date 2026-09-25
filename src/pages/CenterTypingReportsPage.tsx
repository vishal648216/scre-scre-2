import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Search, Filter, Loader2, Zap, CheckCircle2, TrendingUp, AlertCircle, ArrowUpRight, BarChart3, Printer } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import TypingAnalyticsDashboard from "@/components/TypingAnalyticsDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";

interface TypingReport {
  _id: string;
  student_id: string;
  student_name: string;
  course_name: string;
  wpm: number;
  accuracy: number;
  created_at: string;
  mode: string;
}

const CenterTypingReportsPage = () => {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<TypingReport[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState("all");

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/typing/report").catch(() => null);
      if (response && response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setReports(data);
          return;
        }
      }
      setReports([]);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(r => {
    const matchesSearch = r.student_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.course_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMode = filterMode === "all" || r.mode.toLowerCase() === filterMode.toLowerCase();
    return matchesSearch && matchesMode;
  });

  const avgWpm = reports.length > 0 ? Math.round(reports.reduce((acc, r) => acc + r.wpm, 0) / reports.length) : 0;
  const bestWpm = reports.length > 0 ? Math.round(Math.max(...reports.map(r => r.wpm))) : 0;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight flex items-center gap-3">
              <FileText className="w-8 h-8 text-primary" />
              Center Typing Reports
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Monitor and analyze student typing performance.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text"
                placeholder="Search student or course..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-card border border-border text-xs font-bold uppercase tracking-widest outline-none focus:border-primary transition-all w-64 rounded-xl"
              />
            </div>
            <select 
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="px-4 py-2 bg-card border border-border text-[10px] font-black uppercase tracking-widest outline-none focus:border-primary transition-all rounded-xl"
            >
              <option value="all">ALL MODES</option>
              <option value="practice">PRACTICE</option>
              <option value="test">TEST</option>
              <option value="exam">EXAM</option>
            </select>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-primary text-primary-foreground font-black text-xs uppercase tracking-wider rounded-xl hover:opacity-90 transition flex items-center gap-2"
            >
              <Printer className="w-4 h-4" /> Export Report
            </button>
          </div>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatBox label="Avg Network Speed" value={`${avgWpm} WPM`} icon={TrendingUp} color="text-blue-500" />
          <StatBox label="Best Speed" value={`${bestWpm} WPM`} icon={Zap} color="text-amber-500" />
          <StatBox label="Total Tests" value={reports.length.toString()} icon={FileText} color="text-primary" />
          <StatBox label="Active Typists" value={new Set(reports.map(r => r.student_id)).size.toString()} icon={CheckCircle2} color="text-emerald-500" />
        </div>

        <Tabs defaultValue="analytics" className="w-full">
          <TabsList className="bg-slate-900/90 p-1.5 rounded-2xl border border-slate-700/60 w-full flex justify-start gap-2 overflow-x-auto backdrop-blur-xl shadow-lg mb-6">
            <TabsTrigger 
              value="analytics" 
              className="rounded-xl font-black text-xs uppercase tracking-wider px-6 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-500/25 transition-all text-slate-400"
            >
              <BarChart3 className="w-4 h-4 mr-2" /> Center Analytics
            </TabsTrigger>
            <TabsTrigger 
              value="reports" 
              className="rounded-xl font-black text-xs uppercase tracking-wider px-6 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-500/25 transition-all text-slate-400"
            >
              <FileText className="w-4 h-4 mr-2" /> Performance Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="mt-0">
            <TypingAnalyticsDashboard role="center" />
          </TabsContent>

          <TabsContent value="reports" className="mt-0">
            <Card className="rounded-3xl border border-slate-700/60 overflow-hidden shadow-2xl bg-slate-950/85 backdrop-blur-2xl">
              <CardHeader className="bg-slate-900/90 border-b border-slate-800 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-white">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  Student Performance Log
                </CardTitle>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
                  Showing {filteredReports.length} records
                </span>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {loading ? (
                  <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
                ) : filteredReports.length === 0 ? (
                  <div className="py-20 text-center text-slate-400">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-indigo-400/50" />
                    <p className="text-xs font-black uppercase tracking-[0.2em]">No records found matching criteria</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/90 text-slate-300">
                        <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest">Student Name</th>
                        <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest">Course</th>
                        <th className="text-center px-6 py-4 text-[10px] font-black uppercase tracking-widest">Speed</th>
                        <th className="text-center px-6 py-4 text-[10px] font-black uppercase tracking-widest">Accuracy</th>
                        <th className="text-center px-6 py-4 text-[10px] font-black uppercase tracking-widest">Date</th>
                        <th className="text-center px-6 py-4 text-[10px] font-black uppercase tracking-widest">Mode</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {filteredReports.map((report) => (
                        <tr key={report._id} className="hover:bg-slate-900/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-indigo-500/20 flex items-center justify-center font-black text-indigo-400 text-xs border border-indigo-500/30 rounded-full">
                                {report.student_name[0].toUpperCase()}
                              </div>
                              <span className="font-black uppercase text-xs tracking-tight text-white">{report.student_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{report.course_name || "N/A"}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={cn(
                              "px-3 py-1 font-black text-xs rounded-xl border inline-flex items-center gap-1 shadow-sm group-hover:shadow-md transition-all",
                              report.wpm > 40 ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" :
                              report.wpm > 25 ? "bg-amber-500/20 text-amber-300 border-amber-500/40" :
                              "bg-rose-500/20 text-rose-300 border-rose-500/40"
                            )}>
                              {Math.round(report.wpm)} <span className="text-[8px]">WPM</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="font-black text-xs text-white">{Math.round(report.accuracy)}%</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-tight">
                              {format(new Date(report.created_at), "dd MMM yyyy")}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-[8px] font-black uppercase tracking-widest px-3 py-1 bg-slate-900 border border-slate-700 text-slate-300 rounded-full">
                              {report.mode}
                            </span>
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

const StatBox = ({ label, value, icon: Icon, color, progress = 75 }: { label: string, value: string, icon: any, color: string, progress?: number }) => (
  <Card className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-xl overflow-hidden group hover:border-slate-700 transition-all">
    <CardContent className="p-6 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
        <div className={cn("w-10 h-10 bg-slate-800 flex items-center justify-center border border-slate-700 rounded-xl group-hover:scale-110 transition-transform", color)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-black text-white">{value}</p>
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2 p-0.5 border border-slate-700/50">
          <div 
            className={cn("h-full rounded-full transition-all duration-700", color.includes("emerald") ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : color.includes("amber") ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : color.includes("blue") ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-primary shadow-[0_0_8px_rgba(99,102,241,0.5)]")} 
            style={{ width: `${Math.max(10, Math.min(100, progress))}%` }}
          />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default CenterTypingReportsPage;
