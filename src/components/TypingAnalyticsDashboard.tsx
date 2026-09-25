import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from "recharts";
import { apiFetch } from "@/lib/api";
import { Loader2, TrendingUp, Target, Clock, Zap, Award, Activity, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface AnalyticsData {
  date: string;
  avg_wpm: number;
  avg_accuracy: number;
  total_attempts: number;
}

interface TypingAnalyticsDashboardProps {
  role: "student" | "center" | "admin";
  id?: string;
}

const TypingAnalyticsDashboard: React.FC<TypingAnalyticsDashboardProps> = ({ role, id }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData[]>([]);
  const [hasRealData, setHasRealData] = useState(false);
  const [stats, setStats] = useState({
    bestWpm: 0,
    avgAccuracy: 0,
    totalSessions: 0,
    totalTime: 0
  });

  useEffect(() => {
    fetchAnalytics();
  }, [id]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const query = id ? `?id=${id}` : "";
      const res = await apiFetch(`/api/typing/analytics${query}`);
      let activeData: AnalyticsData[] = [];

      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json) && json.length > 0) {
          activeData = json;
          setHasRealData(true);
        } else {
          setHasRealData(false);
        }
      }

      if (activeData.length === 0) {
        // Generate clean 7-day timeline structure when database has no session records yet
        activeData = [
          { date: "Day 1", avg_wpm: 0, avg_accuracy: 0, total_attempts: 0 },
          { date: "Day 2", avg_wpm: 0, avg_accuracy: 0, total_attempts: 0 },
          { date: "Day 3", avg_wpm: 0, avg_accuracy: 0, total_attempts: 0 },
          { date: "Day 4", avg_wpm: 0, avg_accuracy: 0, total_attempts: 0 },
          { date: "Day 5", avg_wpm: 0, avg_accuracy: 0, total_attempts: 0 },
          { date: "Day 6", avg_wpm: 0, avg_accuracy: 0, total_attempts: 0 },
          { date: "Day 7", avg_wpm: 0, avg_accuracy: 0, total_attempts: 0 },
        ];
      }

      setData(activeData);

      if (hasRealData || activeData.some(d => d.avg_wpm > 0 || d.total_attempts > 0)) {
        const realItems = activeData.filter(d => d.total_attempts > 0 || d.avg_wpm > 0);
        const totalAcc = realItems.reduce((acc: number, curr: any) => acc + (curr.avg_accuracy || 0), 0);
        const totalSessions = realItems.reduce((acc: number, curr: any) => acc + (curr.total_attempts || 0), 0);
        const wpmValues = realItems.map((d: any) => d.avg_wpm || 0);

        setStats({
          bestWpm: wpmValues.length > 0 ? Math.max(...wpmValues) : 0,
          avgAccuracy: realItems.length > 0 ? totalAcc / realItems.length : 0,
          totalSessions: totalSessions,
          totalTime: totalSessions * 4
        });
      } else {
        setStats({
          bestWpm: 0,
          avgAccuracy: 0,
          totalSessions: 0,
          totalTime: 0
        });
      }
    } catch (error) {
      console.error("Error fetching typing analytics:", error);
      setData([
        { date: "Day 1", avg_wpm: 0, avg_accuracy: 0, total_attempts: 0 },
        { date: "Day 2", avg_wpm: 0, avg_accuracy: 0, total_attempts: 0 },
        { date: "Day 3", avg_wpm: 0, avg_accuracy: 0, total_attempts: 0 },
        { date: "Day 4", avg_wpm: 0, avg_accuracy: 0, total_attempts: 0 },
        { date: "Day 5", avg_wpm: 0, avg_accuracy: 0, total_attempts: 0 },
        { date: "Day 6", avg_wpm: 0, avg_accuracy: 0, total_attempts: 0 },
        { date: "Day 7", avg_wpm: 0, avg_accuracy: 0, total_attempts: 0 },
      ]);
      setStats({
        bestWpm: 0,
        avgAccuracy: 0,
        totalSessions: 0,
        totalTime: 0
      });
      setHasRealData(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Loading Analytics Engine...</p>
      </div>
    );
  }

  // Progress Bar percentage calculations
  const bestWpmPercent = Math.min(100, Math.max(0, (stats.bestWpm / 80) * 100));
  const accuracyPercent = Math.min(100, Math.max(0, stats.avgAccuracy));
  const sessionsPercent = Math.min(100, Math.max(0, (stats.totalSessions / 50) * 100));
  const practiceTimePercent = Math.min(100, Math.max(0, (stats.totalTime / 200) * 100));

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner Status */}
      <div className="flex items-center justify-between p-4 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-inner backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-black uppercase tracking-widest text-slate-200 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            Live Analytics Engine {hasRealData ? "(Active MongoDB Data)" : "(System Standing By)"}
          </span>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded-full flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          Role: {role.toUpperCase()}
        </span>
      </div>

      {/* Quick Stats Grid with Progress Bars */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* Speed Card */}
        <Card className="rounded-2xl border border-blue-500/20 bg-slate-900/60 backdrop-blur-xl shadow-xl overflow-hidden group hover:border-blue-500/40 transition-all">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t("Best Speed")}</span>
              <div className="w-10 h-10 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform">
                <Zap className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-white tracking-tight">
                {stats.bestWpm.toFixed(1)} <span className="text-xs font-bold text-blue-400">{t("WPM")}</span>
              </div>
              {/* Visual Progress Bar */}
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>Progress to Target (80 WPM)</span>
                  <span>{Math.round(bestWpmPercent)}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(59,130,246,0.6)]" 
                    style={{ width: `${Math.max(5, bestWpmPercent)}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accuracy Card */}
        <Card className="rounded-2xl border border-emerald-500/20 bg-slate-900/60 backdrop-blur-xl shadow-xl overflow-hidden group hover:border-emerald-500/40 transition-all">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t("Avg Accuracy")}</span>
              <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform">
                <Target className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-white tracking-tight">
                {stats.avgAccuracy.toFixed(1)} <span className="text-xs font-bold text-emerald-400">%</span>
              </div>
              {/* Visual Progress Bar */}
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>Accuracy Benchmark (100%)</span>
                  <span>{Math.round(accuracyPercent)}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-600 to-teal-400 rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(16,185,129,0.6)]" 
                    style={{ width: `${Math.max(5, accuracyPercent)}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Sessions Card */}
        <Card className="rounded-2xl border border-amber-500/20 bg-slate-900/60 backdrop-blur-xl shadow-xl overflow-hidden group hover:border-amber-500/40 transition-all">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t("Total Sessions")}</span>
              <div className="w-10 h-10 bg-amber-500/10 text-amber-400 rounded-xl flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-transform">
                <Award className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-white tracking-tight">
                {stats.totalSessions} <span className="text-xs font-bold text-amber-400">LOGS</span>
              </div>
              {/* Visual Progress Bar */}
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>Session Goal (50 Tests)</span>
                  <span>{Math.round(sessionsPercent)}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(245,158,11,0.6)]" 
                    style={{ width: `${Math.max(5, sessionsPercent)}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Practice Time Card */}
        <Card className="rounded-2xl border border-purple-500/20 bg-slate-900/60 backdrop-blur-xl shadow-xl overflow-hidden group hover:border-purple-500/40 transition-all">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t("Practice Time")}</span>
              <div className="w-10 h-10 bg-purple-500/10 text-purple-400 rounded-xl flex items-center justify-center border border-purple-500/20 group-hover:scale-110 transition-transform">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-white tracking-tight">
                {stats.totalTime} <span className="text-xs font-bold text-purple-400">{t("MINS")}</span>
              </div>
              {/* Visual Progress Bar */}
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>Time Allocated (200 Mins)</span>
                  <span>{Math.round(practiceTimePercent)}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-600 to-indigo-400 rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(168,85,247,0.6)]" 
                    style={{ width: `${Math.max(5, practiceTimePercent)}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Speed Progression Area Chart */}
        <Card className="rounded-2xl border border-slate-800 bg-slate-950/80 backdrop-blur-xl shadow-2xl overflow-hidden">
          <CardHeader className="bg-slate-900/50 border-b border-slate-800/80 pb-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center justify-between text-slate-200">
              <span className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                {t("Speed Progression (WPM)")}
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full">
                WPM SPEED TREND
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorWpmGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 800, fill: "#94a3b8" }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 800, fill: "#94a3b8" }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "#090d16", 
                    borderColor: "#1e293b", 
                    borderRadius: "12px",
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: "800",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)"
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="avg_wpm" 
                  name="Speed (WPM)"
                  stroke="#06b6d4" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorWpmGlow)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Accuracy Analysis Line Chart */}
        <Card className="rounded-2xl border border-slate-800 bg-slate-950/80 backdrop-blur-xl shadow-2xl overflow-hidden">
          <CardHeader className="bg-slate-900/50 border-b border-slate-800/80 pb-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center justify-between text-slate-200">
              <span className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-400" />
                {t("Accuracy Analysis (%)")}
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                ACCURACY RATE
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 800, fill: "#94a3b8" }} 
                />
                <YAxis 
                  domain={[0, 100]}
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 800, fill: "#94a3b8" }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "#090d16", 
                    borderColor: "#1e293b", 
                    borderRadius: "12px",
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: "800",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)"
                  }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="avg_accuracy" 
                  name="Accuracy (%)"
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={{ r: 5, fill: "#10b981", strokeWidth: 2, stroke: "#090d16" }}
                  activeDot={{ r: 7, fill: "#34d399" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Daily Practice Volume Bar Chart */}
        <Card className="rounded-2xl border border-slate-800 bg-slate-950/80 backdrop-blur-xl shadow-2xl overflow-hidden lg:col-span-2">
          <CardHeader className="bg-slate-900/50 border-b border-slate-800/80 pb-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center justify-between text-slate-200">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                {t("Daily Practice Volume")}
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                ATTEMPTS MONITOR
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 800, fill: "#94a3b8" }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 800, fill: "#94a3b8" }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "#090d16", 
                    borderColor: "#1e293b", 
                    borderRadius: "12px",
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: "800",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)"
                  }} 
                />
                <Bar dataKey="total_attempts" name="Session Attempts" fill="#f59e0b" radius={[6, 6, 0, 0]}>
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill="#f59e0b" fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TypingAnalyticsDashboard;

