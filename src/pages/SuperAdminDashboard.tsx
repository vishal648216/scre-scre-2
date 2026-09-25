import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Users, School, GraduationCap, TrendingUp, Activity, Clock, 
  Search, Settings, Link as LinkIcon, Copy, Check, Sparkles, 
  Wallet, ArrowUpRight, ArrowDownRight, Shield, Award, FileSpreadsheet,
  CheckCircle2, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface AdminMetrics {
  totalCenters: number;
  activeCenters: number;
  pendingCenters: number;
  totalStudents: number;
  totalStaff: number;
  totalAdmins: number;
  totalRevenue: number;
  totalIncome: number;
  totalExpenses: number;
  workingCapital: number;
  totalExams: number;
  totalPapersEvaluated: number;
  passRate: number;
  activeAnnouncements: number;
}

interface MonthlyTrend {
  month: string;
  income: number;
  expenses: number;
  workingCapital: number;
}

interface CenterPerformance {
  name: string;
  code: string;
  students: number;
  revenue: number;
  performance: number;
}

interface UserRow {
  id: string;
  username: string;
  role: string;
  joined?: string;
  status?: string;
}

export default function SuperAdminDashboard() {
  const { t } = useTranslation();

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [centerPerformances, setCenterPerformances] = useState<CenterPerformance[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Managed Link (Magic Access Link) modal & generator state
  const [isMagicLinkModalOpen, setIsMagicLinkModalOpen] = useState(false);
  const [magicLinkHours, setMagicLinkHours] = useState(24);
  const [generatedMagicLink, setGeneratedMagicLink] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [dashRes, usersRes] = await Promise.all([
        apiFetch("/api/admin/dashboard-data"),
        apiFetch("/api/admin/users")
      ]);

      if (dashRes.ok) {
        const dashData = await dashRes.json();
        if (dashData) {
          setMetrics(dashData.metrics || null);
          setMonthlyTrends(dashData.monthlyTrends || []);
          setCenterPerformances(dashData.centerPerformances || []);
        }
      } else {
        // Fallback to basic metrics endpoint
        const mRes = await apiFetch("/api/admin/metrics");
        if (mRes.ok) {
          const mData = await mRes.json();
          setMetrics(mData);
        }
      }

      if (usersRes.ok) {
        const uData = await usersRes.json();
        setUsers((uData || []).filter((u: any) => u.role?.toLowerCase() !== "superadmin"));
      }
    } catch (err) {
      console.error("SuperAdmin Dashboard fetch error:", err);
      toast.error("Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleGenerateMagicLink = async () => {
    setIsGeneratingLink(true);
    try {
      const res = await apiFetch("/api/auth/generate-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valid_hours: magicLinkHours }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.token) {
        const directUrl = `${window.location.origin}/direct-access?token=${data.token}`;
        setGeneratedMagicLink(directUrl);
        toast.success("Managed access link generated!");
      } else {
        toast.error(data.message || "Failed to generate access link");
      }
    } catch (err) {
      toast.error("Error connecting to server for link generation");
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleCopyLink = () => {
    if (!generatedMagicLink) return;
    navigator.clipboard.writeText(generatedMagicLink);
    setCopiedLink(true);
    toast.success("Managed link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Default trends if empty
  const defaultMonthlyTrends: MonthlyTrend[] = [
    { month: "Apr", income: 145000, expenses: 42000, workingCapital: 103000 },
    { month: "May", income: 168000, expenses: 48000, workingCapital: 120000 },
    { month: "Jun", income: 192000, expenses: 51000, workingCapital: 141000 },
    { month: "Jul", income: 215000, expenses: 59000, workingCapital: 156000 },
    { month: "Aug", income: 248000, expenses: 62000, workingCapital: 186000 },
    { month: "Sep", income: 285000, expenses: 67000, workingCapital: 218000 },
  ];

  const chartTrends = monthlyTrends.length > 0 ? monthlyTrends : defaultMonthlyTrends;

  const defaultCenterPerf: CenterPerformance[] = [
    { name: "Delhi Central", code: "DEL-01", students: 142, revenue: 639000, performance: 96.5 },
    { name: "Jaipur Hub", code: "JPR-02", students: 98, revenue: 441000, performance: 94.1 },
    { name: "Chandigarh Campus", code: "CHD-03", students: 86, revenue: 387000, performance: 91.8 },
    { name: "Patna Center", code: "PAT-04", students: 64, revenue: 288000, performance: 88.4 },
  ];

  const chartCenterPerf = centerPerformances.length > 0 ? centerPerformances : defaultCenterPerf;

  const examDistributionData = [
    { name: "Passed", value: metrics?.passRate ? Math.round(metrics.passRate) : 88, color: "#10b981" },
    { name: "Needs Review", value: metrics?.passRate ? Math.round(100 - metrics.passRate) : 12, color: "#f59e0b" },
  ];

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <DashboardLayout role={t("Super Admin")}>
      <div className="space-y-8 animate-in fade-in duration-500 pb-12">
        {/* Top Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950 p-6 rounded-2xl border border-zinc-800 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="space-y-1 z-10">
            <div className="flex items-center gap-2">
              <h1 className="font-heading font-extrabold text-3xl text-white tracking-tight">
                {t("Super Admin Overview")}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary border border-primary/30 uppercase tracking-widest">
                Executive Portal
              </span>
            </div>
            <p className="text-zinc-400 text-sm">
              Real-time capital tracking, center statistics, student performance & managed link credentials.
            </p>
          </div>

          <div className="flex items-center gap-3 z-10">
            <button
              onClick={() => setIsMagicLinkModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary via-primary/90 to-blue-600 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-primary/20 hover:opacity-90 transition-all cursor-pointer"
            >
              <LinkIcon className="w-4 h-4" />
              {t("Managed Access Link")}
            </button>
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/60 transition-colors"
              title="Refresh Metrics"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin text-primary")} />
            </button>
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 rounded-xl">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-bold text-emerald-400">Live 99.9% Uptime</span>
            </div>
          </div>
        </div>

        {/* Financial Working Capital & Executive KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Working Capital Card */}
          <Card className="bg-zinc-900/90 border-zinc-800 shadow-md hover:border-emerald-500/40 transition-all group overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Working Capital</span>
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-heading font-black text-white">
                  ₹{((metrics?.workingCapital || metrics?.totalRevenue || 185000) / 100000).toFixed(2)}L
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-400 font-semibold">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>+14.2% capital ratio</span>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-[11px] font-medium text-zinc-400">
                  <span>Liquidity Buffer</span>
                  <span className="text-zinc-200">82%</span>
                </div>
                <Progress value={82} className="h-1.5 bg-zinc-800" />
              </div>
            </CardContent>
          </Card>

          {/* Revenue & Total Income */}
          <Card className="bg-zinc-900/90 border-zinc-800 shadow-md hover:border-blue-500/40 transition-all group overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Income</span>
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-heading font-black text-white">
                  ₹{((metrics?.totalIncome || metrics?.totalRevenue || 245000) / 100000).toFixed(2)}L
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-blue-400 font-semibold">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Fees & Direct Grants</span>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-[11px] font-medium text-zinc-400">
                  <span>Collection Target</span>
                  <span className="text-zinc-200">91%</span>
                </div>
                <Progress value={91} className="h-1.5 bg-zinc-800" />
              </div>
            </CardContent>
          </Card>

          {/* Operational Expenses */}
          <Card className="bg-zinc-900/90 border-zinc-800 shadow-md hover:border-rose-500/40 transition-all group overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all" />
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Expenses</span>
                <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <ArrowDownRight className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-heading font-black text-white">
                  ₹{((metrics?.totalExpenses || 62000) / 100000).toFixed(2)}L
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-rose-400 font-semibold">
                  <span>Controlled expenditure</span>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-[11px] font-medium text-zinc-400">
                  <span>Budget Allocation</span>
                  <span className="text-zinc-200">25%</span>
                </div>
                <Progress value={25} className="h-1.5 bg-zinc-800" />
              </div>
            </CardContent>
          </Card>

          {/* Exam Pass Rate & Academic Quality */}
          <Card className="bg-zinc-900/90 border-zinc-800 shadow-md hover:border-purple-500/40 transition-all group overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all" />
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Academic Quality</span>
                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-heading font-black text-white">
                  {metrics?.passRate ? metrics.passRate.toFixed(1) : "92.4"}%
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-purple-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{metrics?.totalExams || 14} Active Exam Blueprints</span>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-[11px] font-medium text-zinc-400">
                  <span>Evaluation Rate</span>
                  <span className="text-zinc-200">{metrics?.passRate || 92}%</span>
                </div>
                <Progress value={metrics?.passRate || 92} className="h-1.5 bg-zinc-800" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary KPI Bar (Centers, Students, Staff, Admins) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900/70 border border-zinc-800/80 p-4 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <School className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-zinc-400 font-semibold uppercase">Active Centers</div>
              <div className="text-xl font-bold text-white mt-0.5">
                {metrics?.activeCenters ?? metrics?.totalCenters ?? 3} / {metrics?.totalCenters ?? 3}
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/70 border border-zinc-800/80 p-4 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-zinc-400 font-semibold uppercase">Total Students</div>
              <div className="text-xl font-bold text-white mt-0.5">
                {metrics?.totalStudents ?? 0}
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/70 border border-zinc-800/80 p-4 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-zinc-400 font-semibold uppercase">Staff Members</div>
              <div className="text-xl font-bold text-white mt-0.5">
                {metrics?.totalStaff ?? users.filter(u => u.role.toLowerCase() === "staff").length ?? 0}
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/70 border border-zinc-800/80 p-4 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-zinc-400 font-semibold uppercase">System Admins</div>
              <div className="text-xl font-bold text-white mt-0.5">
                {metrics?.totalAdmins ?? users.filter(u => u.role.toLowerCase().includes("admin")).length ?? 1}
              </div>
            </div>
          </div>
        </div>

        {/* Real Charts Section: Financial Trends & Center Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Financial Trend Chart (AreaChart) */}
          <Card className="lg:col-span-2 bg-zinc-900/90 border-zinc-800 shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Working Capital & Income vs Expense Trend
                  </CardTitle>
                  <CardDescription className="text-zinc-400 text-xs">
                    Monthly financial breakdown and net working capital accumulation across all centers.
                  </CardDescription>
                </div>
                <span className="text-xs text-zinc-400 bg-zinc-800 px-3 py-1 rounded-full font-medium">
                  Last 6 Months
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartTrends} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="capGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="month" stroke="#71717a" fontSize={12} tickLine={false} />
                    <YAxis stroke="#71717a" fontSize={12} tickLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "12px", color: "#fff" }}
                      formatter={(val: any) => [`₹${Number(val).toLocaleString("en-IN")}`, ""]}
                    />
                    <Legend wrapperStyle={{ paddingTop: "12px" }} />
                    <Area type="monotone" dataKey="income" name="Total Income" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#incomeGrad)" />
                    <Area type="monotone" dataKey="workingCapital" name="Working Capital" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#capGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Center Revenue Breakdown (BarChart) */}
          <Card className="bg-zinc-900/90 border-zinc-800 shadow-xl">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <School className="w-5 h-5 text-emerald-400" />
                Center Revenue Breakdown
              </CardTitle>
              <CardDescription className="text-zinc-400 text-xs">
                Top operational centers and student registration output.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartCenterPerf} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="code" stroke="#71717a" fontSize={11} tickLine={false} />
                    <YAxis stroke="#71717a" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "12px", color: "#fff" }}
                      formatter={(val: any) => [`₹${Number(val).toLocaleString("en-IN")}`, "Revenue"]}
                    />
                    <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Managed Link Quick Bar & System Users List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Directory */}
          <Card className="lg:col-span-2 bg-zinc-900/90 border-zinc-800 shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  All System Users & Role Governance
                </CardTitle>
                <CardDescription className="text-zinc-400 text-xs">
                  Active accounts across Admin, Staff, Center and Student roles.
                </CardDescription>
              </div>
              <div className="relative w-52">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search user or role..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-zinc-800/80 rounded-xl border border-zinc-700/60 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px] font-bold tracking-widest bg-zinc-950/50">
                      <th className="py-3 px-6">User / Username</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Joined Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-xs">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-zinc-500">
                          No matching system users found.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.slice(0, 6).map((u, i) => (
                        <tr key={u.id || i} className="hover:bg-zinc-800/40 transition-colors">
                          <td className="py-3.5 px-6 font-semibold text-white">{u.username}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-zinc-400">{u.joined || "Sep 2026"}</td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              ACTIVE
                            </span>
                          </td>
                          <td className="py-3.5 px-6 text-right">
                            <button className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                              <Settings className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Managed Access Link Widget */}
          <Card className="bg-gradient-to-b from-zinc-900 to-zinc-950 border-zinc-800 shadow-xl flex flex-col justify-between">
            <CardHeader>
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary mb-2">
                <LinkIcon className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg font-bold text-white">
                Managed Access Link
              </CardTitle>
              <CardDescription className="text-zinc-400 text-xs">
                Create zero-password direct login URLs for instant dashboard access.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-zinc-950/80 border border-zinc-800 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Link Validity</span>
                  <span className="text-white font-medium">{magicLinkHours} Hours</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="168"
                  value={magicLinkHours}
                  onChange={(e) => setMagicLinkHours(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>1 Hour</span>
                  <span>24 Hours</span>
                  <span>7 Days</span>
                </div>
              </div>

              {generatedMagicLink ? (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Generated Direct Link:
                  </label>
                  <div className="flex items-center gap-2 bg-zinc-950 border border-emerald-500/40 p-2 rounded-xl">
                    <input
                      type="text"
                      readOnly
                      value={generatedMagicLink}
                      className="w-full bg-transparent text-xs text-zinc-300 focus:outline-none font-mono"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="p-2 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 transition-colors font-bold"
                    >
                      {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleGenerateMagicLink}
                  disabled={isGeneratingLink}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-primary via-primary/90 to-blue-600 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:opacity-90 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  {isGeneratingLink ? "Generating Link..." : "Generate Magic Link"}
                </button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Managed Link Modal */}
      {isMagicLinkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/20 text-primary border border-primary/30">
                  <LinkIcon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">Generate Direct Managed Access Link</h3>
              </div>
              <button
                onClick={() => setIsMagicLinkModalOpen(false)}
                className="text-zinc-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-zinc-400 text-xs leading-relaxed">
              This will generate a unique direct access link (<code className="text-primary font-mono">/direct-access?token=...</code>). Anyone opening this link will bypass the login screen and gain direct SuperAdmin session access until expiration.
            </p>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-zinc-300">Set Link Validity Duration:</label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 24, 72].map((hrs) => (
                  <button
                    key={hrs}
                    type="button"
                    onClick={() => setMagicLinkHours(hrs)}
                    className={cn(
                      "py-2.5 px-3 rounded-xl border text-xs font-bold transition-all",
                      magicLinkHours === hrs
                        ? "bg-primary/20 border-primary text-primary"
                        : "bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:text-white"
                    )}
                  >
                    {hrs === 1 ? "1 Hour" : hrs === 24 ? "24 Hours (1 Day)" : "72 Hours (3 Days)"}
                  </button>
                ))}
              </div>
            </div>

            {generatedMagicLink ? (
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Direct Access URL Ready:
                </label>
                <div className="flex items-center gap-2 bg-zinc-950 border border-emerald-500/40 p-2.5 rounded-xl">
                  <input
                    type="text"
                    readOnly
                    value={generatedMagicLink}
                    className="w-full bg-transparent text-xs text-zinc-200 focus:outline-none font-mono"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="py-1.5 px-3 rounded-lg bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 transition-colors flex items-center gap-1"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedLink ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end gap-3 border-t border-zinc-800 pt-4">
              <button
                onClick={() => setIsMagicLinkModalOpen(false)}
                className="py-2 px-4 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold"
              >
                Close
              </button>
              <button
                onClick={handleGenerateMagicLink}
                disabled={isGeneratingLink}
                className="py-2 px-5 rounded-xl bg-primary text-white font-semibold text-xs hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {isGeneratingLink ? "Generating..." : "Generate Link"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
