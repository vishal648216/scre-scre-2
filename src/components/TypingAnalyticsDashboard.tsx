import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie
} from "recharts";
import { apiFetch } from "@/lib/api";
import { Loader2, TrendingUp, Target, Clock, Zap, Award } from "lucide-react";
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
      if (res.ok) {
        const json = await res.json();
        setData(json);
        
        if (json.length > 0) {
          const totalWpm = json.reduce((acc: number, curr: any) => acc + curr.avg_wpm, 0);
          const totalAcc = json.reduce((acc: number, curr: any) => acc + curr.avg_accuracy, 0);
          const totalSessions = json.reduce((acc: number, curr: any) => acc + curr.total_attempts, 0);
          
          setStats({
            bestWpm: Math.max(...json.map((d: any) => d.avg_wpm)),
            avgAccuracy: totalAcc / json.length,
            totalSessions: totalSessions,
            totalTime: totalSessions * 5 // assuming 5 min avg per session
          });
        }
      }
    } catch (error) {
      console.error("Error fetching typing analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-none border-2 border-primary/20 bg-primary/5">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-primary text-white flex items-center justify-center shadow-lg">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Best Speed")}</p>
              <p className="text-2xl font-black">{stats.bestWpm.toFixed(1)} <span className="text-xs">{t("WPM")}</span></p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-2 border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500 text-white flex items-center justify-center shadow-lg">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Avg Accuracy")}</p>
              <p className="text-2xl font-black">{stats.avgAccuracy.toFixed(1)} <span className="text-xs">%</span></p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-2 border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500 text-white flex items-center justify-center shadow-lg">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Total Sessions")}</p>
              <p className="text-2xl font-black">{stats.totalSessions}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-2 border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500 text-white flex items-center justify-center shadow-lg">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Practice Time")}</p>
              <p className="text-2xl font-black">{stats.totalTime} <span className="text-xs">{t("MINS")}</span></p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Speed Progress Chart */}
        <Card className="rounded-none border-2 border-border shadow-xl">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              {t("Speed Progression (WPM)")}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorWpm" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900 }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "black", 
                    border: "none", 
                    borderRadius: "0px",
                    color: "white",
                    fontSize: "10px",
                    fontWeight: "900",
                    textTransform: "uppercase"
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="avg_wpm" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorWpm)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Accuracy Chart */}
        <Card className="rounded-none border-2 border-border shadow-xl">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-500" />
              {t("Accuracy Analysis (%)")}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900 }} 
                />
                <YAxis 
                  domain={[0, 100]}
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900 }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "black", 
                    border: "none", 
                    borderRadius: "0px",
                    color: "white",
                    fontSize: "10px",
                    fontWeight: "900",
                    textTransform: "uppercase"
                  }} 
                />
                <Line 
                  type="stepAfter" 
                  dataKey="avg_accuracy" 
                  stroke="#10b981" 
                  strokeWidth={4}
                  dot={{ r: 6, fill: "#10b981", strokeWidth: 2, stroke: "white" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Attempt Volume Chart */}
        <Card className="rounded-none border-2 border-border shadow-xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              {t("Daily Practice Volume")}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900 }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "black", 
                    border: "none", 
                    borderRadius: "0px",
                    color: "white",
                    fontSize: "10px",
                    fontWeight: "900",
                    textTransform: "uppercase"
                  }} 
                />
                <Bar dataKey="total_attempts" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fillOpacity={0.8} />
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
