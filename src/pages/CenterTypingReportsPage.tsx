import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Search, Filter, Loader2, Zap, CheckCircle2, TrendingUp, AlertCircle, ArrowUpRight, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import TypingAnalyticsDashboard from "@/components/TypingAnalyticsDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    try {
      const response = await fetch("/api/typing/report", {
        headers: { "Authorization": `Bearer ${sessionStorage.getItem("token")}` }
      });
      const data = await response.json();
      if (response.ok) setReports(data);
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(r => {
    const matchesSearch = r.student_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.course_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMode = filterMode === "all" || r.mode === filterMode;
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
                className="pl-10 pr-4 py-2 bg-card border border-border text-xs font-bold uppercase tracking-widest outline-none focus:border-primary transition-all w-64"
              />
            </div>
            <select 
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="px-4 py-2 bg-card border border-border text-[10px] font-black uppercase tracking-widest outline-none focus:border-primary transition-all"
            >
              <option value="all">ALL MODES</option>
              <option value="practice">PRACTICE</option>
              <option value="test">TEST</option>
              <option value="exam">EXAM</option>
            </select>
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
          <TabsList className="w-full justify-start rounded-none border-b-2 bg-transparent p-0 mb-8">
            <TabsTrigger 
              value="analytics" 
              className="rounded-none border-b-2 border-transparent px-8 py-3 font-black text-[10px] uppercase tracking-[0.2em] data-[state=active]:border-primary data-[state=active]:bg-muted/50 transition-all"
            >
              <BarChart3 className="w-4 h-4 mr-2" /> Center Analytics
            </TabsTrigger>
            <TabsTrigger 
              value="reports" 
              className="rounded-none border-b-2 border-transparent px-8 py-3 font-black text-[10px] uppercase tracking-[0.2em] data-[state=active]:border-primary data-[state=active]:bg-muted/50 transition-all"
            >
              <FileText className="w-4 h-4 mr-2" /> Performance Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="mt-0">
            <TypingAnalyticsDashboard role="center" />
          </TabsContent>

          <TabsContent value="reports" className="mt-0">
            <Card className="rounded-none border-border overflow-hidden shadow-xl">
              <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Student Performance Log
                </CardTitle>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  Showing {filteredReports.length} records
                </span>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {loading ? (
                  <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : filteredReports.length === 0 ? (
                  <div className="py-20 text-center opacity-60">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-xs font-black uppercase tracking-[0.2em]">No records found matching criteria</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/10">
                        <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Student Name</th>
                        <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course</th>
                        <th className="text-center px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Speed</th>
                        <th className="text-center px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Accuracy</th>
                        <th className="text-center px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Date</th>
                        <th className="text-center px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mode</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredReports.map((report) => (
                        <tr key={report._id} className="hover:bg-muted/20 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-primary/10 flex items-center justify-center font-black text-primary text-xs border border-primary/20">
                                {report.student_name[0].toUpperCase()}
                              </div>
                              <span className="font-black uppercase text-xs tracking-tight">{report.student_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{report.course_name || "N/A"}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={cn(
                              "px-3 py-1 font-black text-xs rounded-none border inline-flex items-center gap-1 shadow-sm group-hover:shadow-md transition-all",
                              report.wpm > 40 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                              report.wpm > 25 ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                              "bg-destructive/10 text-destructive border-destructive/20"
                            )}>
                              {Math.round(report.wpm)} <span className="text-[8px]">WPM</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="font-black text-xs text-foreground">{Math.round(report.accuracy)}%</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tight">
                              {format(new Date(report.created_at), "dd MMM yyyy")}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-muted border border-border group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all">
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

const StatBox = ({ label, value, icon: Icon, color }: { label: string, value: string, icon: any, color: string }) => (
  <Card className="rounded-none border-border shadow-md">
    <CardContent className="p-6 flex items-center justify-between">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-black text-foreground">{value}</p>
      </div>
      <div className={cn("w-10 h-10 bg-muted flex items-center justify-center border border-border", color)}>
        <Icon className="w-5 h-5" />
      </div>
    </CardContent>
  </Card>
);

export default CenterTypingReportsPage;
