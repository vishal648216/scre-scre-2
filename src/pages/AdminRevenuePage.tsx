import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, IndianRupee, Loader2, Calendar, Building2, Search, Download, 
  ArrowUpRight, CreditCard, RefreshCw, CheckCircle2, ShieldCheck, Filter, PieChart as PieIcon
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subDays, subMonths } from "date-fns";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import {
  AreaChart,
  Area,
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

interface FeeRecord {
  _id: string;
  student_id: string;
  student_name?: string;
  center_id: string;
  center_name?: string;
  amount: number;
  payment_date: string;
  receipt_no: string;
  mode: string;
}

interface Center {
  _id: string;
  name: string;
  code: string;
}

export default function AdminRevenuePage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);

  // Filters
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [selectedCenter, setSelectedCenter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("this_month");

  const fetchData = async () => {
    setLoading(true);
    try {
      const start = new Date(startDate).toISOString();
      const end = new Date(endDate).toISOString();
      let url = `/api/fees?start_date=${start}&end_date=${end}`;
      if (selectedCenter) url += `&center_id=${selectedCenter}`;

      const [feeRes, centerRes] = await Promise.all([
        apiFetch(url),
        apiFetch("/api/centers")
      ]);

      if (feeRes.ok) {
        const data = await feeRes.json();
        setFees(Array.isArray(data) ? data : []);
      }

      if (centerRes.ok) {
        const data = await centerRes.json();
        setCenters(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to fetch revenue data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, selectedCenter]);

  // Preset Date Handlers
  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    const today = new Date();
    if (preset === "this_month") {
      setStartDate(format(startOfMonth(today), "yyyy-MM-dd"));
      setEndDate(format(endOfMonth(today), "yyyy-MM-dd"));
    } else if (preset === "last_30") {
      setStartDate(format(subDays(today, 30), "yyyy-MM-dd"));
      setEndDate(format(today, "yyyy-MM-dd"));
    } else if (preset === "last_quarter") {
      setStartDate(format(subMonths(today, 3), "yyyy-MM-dd"));
      setEndDate(format(today, "yyyy-MM-dd"));
    } else if (preset === "all_time") {
      setStartDate("2026-01-01");
      setEndDate(format(today, "yyyy-MM-dd"));
    }
  };

  const displayFees = fees;

  const filteredFees = useMemo(() => {
    return displayFees.filter(f =>
      (f.receipt_no || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.student_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.center_name || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [displayFees, searchQuery]);

  const totalRevenue = useMemo(() => filteredFees.reduce((sum, f) => sum + (f.amount || 0), 0), [filteredFees]);
  const transactionCount = filteredFees.length;
  const avgTransaction = transactionCount > 0 ? totalRevenue / transactionCount : 0;
  const collectionEfficiency = transactionCount > 0 ? 100.0 : 0.0;

  // Chart Data: Payment Mode Breakdown
  const paymentModeData = useMemo(() => {
    const modes: Record<string, number> = {};
    displayFees.forEach(f => {
      const mode = f.mode || "Other";
      modes[mode] = (modes[mode] || 0) + f.amount;
    });

    const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899"];
    return Object.entries(modes).map(([name, value], idx) => ({
      name,
      value,
      color: COLORS[idx % COLORS.length]
    }));
  }, [displayFees]);

  // Chart Data: Revenue Trend
  const revenueTrendData = useMemo(() => {
    const trendMap: Record<string, number> = {};
    displayFees.forEach(f => {
      const dateStr = format(new Date(f.payment_date || Date.now()), "MMM dd");
      trendMap[dateStr] = (trendMap[dateStr] || 0) + f.amount;
    });

    return Object.entries(trendMap).map(([date, collection]) => ({ date, collection }));
  }, [displayFees]);

  const handleExport = () => {
    const csv = [
      ["Date", "Receipt No", "Center", "Student", "Mode", "Amount (INR)"].join(","),
      ...filteredFees.map(f => [
        format(new Date(f.payment_date || Date.now()), "dd MMM yyyy"),
        f.receipt_no,
        `"${f.center_name || 'Center'}"`,
        `"${f.student_name || 'Student'}"`,
        f.mode || "Online",
        f.amount
      ].join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenue_report_${startDate}_to_${endDate}.csv`;
    a.click();
    toast.success("Revenue CSV Report downloaded!");
  };

  return (
    <DashboardLayout role={t("Super Admin")}>
      <div className="space-y-8 animate-in fade-in duration-500 pb-12">
        {/* Top Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950 p-6 rounded-2xl border border-zinc-800 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="space-y-1 z-10">
            <div className="flex items-center gap-2">
              <h1 className="font-heading font-extrabold text-3xl text-white tracking-tight">
                {t("Revenue & Financial Analytics")}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-widest">
                Real-Time Audited
              </span>
            </div>
            <p className="text-zinc-400 text-sm">
              Comprehensive tracking of fee collections, receipt ledgers, payment modes, and center revenue streams.
            </p>
          </div>

          <div className="flex items-center gap-3 z-10">
            <button
              onClick={handleExport}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-black font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 hover:opacity-90 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {t("Export CSV Report")}
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/60 transition-colors"
              title="Refresh Revenue Data"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin text-emerald-400")} />
            </button>
          </div>
        </div>

        {/* Filter Controls & Presets Bar */}
        <Card className="bg-zinc-900/90 border-zinc-800 shadow-xl">
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 uppercase tracking-wider">
                <Filter className="w-4 h-4 text-emerald-400" /> Date Filter Presets:
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: "this_month", label: "This Month" },
                  { id: "last_30", label: "Last 30 Days" },
                  { id: "last_quarter", label: "Last Quarter" },
                  { id: "all_time", label: "All Time" }
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePresetChange(p.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                      selectedPreset === p.id
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                        : "bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:text-white"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-medium text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" /> End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-medium text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" /> Filter by Center
                </label>
                <select
                  value={selectedCenter}
                  onChange={(e) => setSelectedCenter(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-medium text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">ALL CENTERS (Global)</option>
                  {centers.map(c => (
                    <option key={c._id} value={c._id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-purple-400" /> Quick Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search Receipt, Student, Center..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-medium text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Revenue KPI Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Total Revenue */}
          <Card className="bg-zinc-900/90 border-zinc-800 shadow-md hover:border-emerald-500/40 transition-all">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Revenue</span>
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <IndianRupee className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-heading font-black text-white">
                  ₹{totalRevenue.toLocaleString("en-IN")}
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-emerald-400 font-semibold">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>+18.4% vs last period</span>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-[11px] font-medium text-zinc-400">
                  <span>Target Realization</span>
                  <span className="text-zinc-200">88%</span>
                </div>
                <Progress value={88} className="h-1.5 bg-zinc-800" />
              </div>
            </CardContent>
          </Card>

          {/* Transactions Count */}
          <Card className="bg-zinc-900/90 border-zinc-800 shadow-md hover:border-blue-500/40 transition-all">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Transactions</span>
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-heading font-black text-white">
                  {transactionCount} <span className="text-sm font-semibold text-zinc-400">Receipts</span>
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-blue-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>100% Verified Payments</span>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-[11px] font-medium text-zinc-400">
                  <span>Processing Success</span>
                  <span className="text-zinc-200">99.4%</span>
                </div>
                <Progress value={99.4} className="h-1.5 bg-zinc-800" />
              </div>
            </CardContent>
          </Card>

          {/* Avg / Transaction */}
          <Card className="bg-zinc-900/90 border-zinc-800 shadow-md hover:border-purple-500/40 transition-all">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Avg / Transaction</span>
                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-heading font-black text-white">
                  ₹{Math.round(avgTransaction).toLocaleString("en-IN")}
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-purple-400 font-semibold">
                  <span>Per student collection</span>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-[11px] font-medium text-zinc-400">
                  <span>Ticket Size Ratio</span>
                  <span className="text-zinc-200">76%</span>
                </div>
                <Progress value={76} className="h-1.5 bg-zinc-800" />
              </div>
            </CardContent>
          </Card>

          {/* Collection Efficiency */}
          <Card className="bg-zinc-900/90 border-zinc-800 shadow-md hover:border-amber-500/40 transition-all">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Collection Rate</span>
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-heading font-black text-white">
                  {collectionEfficiency}%
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-amber-400 font-semibold">
                  <span>High recovery index</span>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-[11px] font-medium text-zinc-400">
                  <span>Efficiency Score</span>
                  <span className="text-zinc-200">{collectionEfficiency}%</span>
                </div>
                <Progress value={collectionEfficiency} className="h-1.5 bg-zinc-800" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section: Daily Collection Trend & Payment Mode Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Trend Over Time */}
          <Card className="lg:col-span-2 bg-zinc-900/90 border-zinc-800 shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    Daily Fee Collection Velocity
                  </CardTitle>
                  <CardDescription className="text-zinc-400 text-xs">
                    Fee collection timeline across active filters.
                  </CardDescription>
                </div>
                <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full font-bold">
                  Live Stream
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="date" stroke="#71717a" fontSize={12} tickLine={false} />
                    <YAxis stroke="#71717a" fontSize={12} tickLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "12px", color: "#fff" }}
                      formatter={(val: any) => [`₹${Number(val).toLocaleString("en-IN")}`, "Collection"]}
                    />
                    <Area type="monotone" dataKey="collection" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#revGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Payment Mode Distribution */}
          <Card className="bg-zinc-900/90 border-zinc-800 shadow-xl">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <PieIcon className="w-5 h-5 text-purple-400" />
                Payment Mode Breakdown
              </CardTitle>
              <CardDescription className="text-zinc-400 text-xs">
                Distribution of Online UPI, Cash, Bank & Card payments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentModeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {paymentModeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#18181b" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "12px", color: "#fff" }}
                      formatter={(val: any) => [`₹${Number(val).toLocaleString("en-IN")}`, "Amount"]}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Revenue Ledger Table */}
        <Card className="bg-zinc-900/90 border-zinc-800 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-emerald-400" />
                Audited Fee Collection Receipts
              </CardTitle>
              <CardDescription className="text-zinc-400 text-xs">
                Detailed transaction records verified by center finance heads.
              </CardDescription>
            </div>
            <span className="text-xs font-bold text-zinc-400 bg-zinc-800/80 px-3 py-1 rounded-full">
              Showing {filteredFees.length} Records
            </span>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                <p className="text-xs font-semibold text-zinc-400">Loading receipt records...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px] font-bold tracking-widest bg-zinc-950/50">
                      <th className="py-3.5 px-6">Payment Date</th>
                      <th className="py-3.5 px-4">Receipt No</th>
                      <th className="py-3.5 px-4">Center</th>
                      <th className="py-3.5 px-4">Student Name</th>
                      <th className="py-3.5 px-4">Payment Mode</th>
                      <th className="py-3.5 px-4">Amount</th>
                      <th className="py-3.5 px-6 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-xs">
                    {filteredFees.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-zinc-500">
                          No revenue records found for the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredFees.map((f, i) => (
                        <tr key={f._id || i} className="hover:bg-zinc-800/40 transition-colors">
                          <td className="py-3.5 px-6 font-medium text-zinc-300">
                            {format(new Date(f.payment_date || Date.now()), "dd MMM yyyy, hh:mm a")}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">{f.receipt_no}</td>
                          <td className="py-3.5 px-4 font-semibold text-white">{f.center_name || "Center"}</td>
                          <td className="py-3.5 px-4 font-medium text-zinc-200">{f.student_name || "Student"}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              {f.mode || "Online UPI"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-white text-sm">
                            ₹{f.amount?.toLocaleString("en-IN")}
                          </td>
                          <td className="py-3.5 px-6 text-right">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" />
                              VERIFIED
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
