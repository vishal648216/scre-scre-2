import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, IndianRupee, Loader2, Calendar, Filter, Building2, Search, Download } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

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

const AdminRevenuePage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  
  // Filters
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [selectedCenter, setSelectedCenter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      // Build query string
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
      toast.error(t("Failed to fetch revenue data"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, selectedCenter, t]);

  const filteredFees = fees.filter(f => 
    f.receipt_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.center_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalRevenue = filteredFees.reduce((sum, f) => sum + (f.amount || 0), 0);
  const transactionCount = filteredFees.length;
  const avgTransaction = transactionCount > 0 ? totalRevenue / transactionCount : 0;

  const handleExport = () => {
    const csv = [
      [t("Date"), t("Receipt"), t("Center"), t("Student"), t("Mode"), t("Amount")].join(","),
      ...filteredFees.map(f => [
        format(new Date(f.payment_date), "dd MMM yyyy"),
        f.receipt_no,
        f.center_name || t("Unknown"),
        f.student_name || t("Unknown"),
        f.mode,
        f.amount
      ].join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenue_report_${startDate}_to_${endDate}.csv`;
    a.click();
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
              {t("Revenue Summary")}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium uppercase tracking-widest font-black text-[10px]">
              {t("Financial performance tracking across centers")}
            </p>
          </div>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-primary/20"
          >
            <Download className="w-3.5 h-3.5" />
            {t("Export Report")}
          </button>
        </div>

        {/* Filter Bar */}
        <Card className="rounded-none border-border bg-muted/30 shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-3 h-3" /> {t("Start Date")}
                </label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-background border border-border px-3 py-2 text-xs font-bold uppercase tracking-tight focus:outline-none focus:border-primary transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-3 h-3" /> {t("End Date")}
                </label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-background border border-border px-3 py-2 text-xs font-bold uppercase tracking-tight focus:outline-none focus:border-primary transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Building2 className="w-3 h-3" /> {t("Filter by Center")}
                </label>
                <select 
                  value={selectedCenter}
                  onChange={(e) => setSelectedCenter(e.target.value)}
                  className="w-full bg-background border border-border px-3 py-2 text-xs font-bold uppercase tracking-tight focus:outline-none focus:border-primary transition-all"
                >
                  <option value="">{t("ALL CENTERS")}</option>
                  {centers.map(c => (
                    <option key={c._id} value={c._id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Search className="w-3 h-3" /> {t("Quick Search")}
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder={t("RECEIPT, STUDENT...")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-background border border-border text-xs font-bold uppercase tracking-tight focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">{t("Calculating Revenue Data...")}</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="rounded-none border-primary/20 bg-primary/5 shadow-md group hover:bg-primary/10 transition-all">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <IndianRupee className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Total Revenue")}</p>
                      <p className="text-3xl font-black text-primary">₹{totalRevenue.toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-none border-border shadow-md group hover:border-primary/20 transition-all">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-muted flex items-center justify-center group-hover:scale-110 transition-transform">
                      <TrendingUp className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Transactions")}</p>
                      <p className="text-3xl font-black text-foreground">{transactionCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-none border-border shadow-md group hover:border-primary/20 transition-all">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-muted flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Building2 className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Avg / Transaction")}</p>
                      <p className="text-3xl font-black text-foreground">₹{Math.round(avgTransaction).toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Transaction List */}
            <Card className="rounded-none border-border shadow-lg">
              <CardHeader className="bg-muted/30 border-b border-border py-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <Filter className="w-4 h-4 text-primary" />
                  {t("Revenue Breakdown")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/10">
                        <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Date")}</th>
                        <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Receipt No")}</th>
                        <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Center")}</th>
                        <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Student")}</th>
                        <th className="text-center px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Mode")}</th>
                        <th className="text-right px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Amount")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredFees.map((f) => (
                        <tr key={f._id} className="hover:bg-muted/30 transition-colors group">
                          <td className="px-6 py-4 text-xs font-bold text-muted-foreground">
                            {format(new Date(f.payment_date), "dd MMM yyyy")}
                          </td>
                          <td className="px-6 py-4 text-xs font-black text-foreground group-hover:text-primary transition-colors">
                            {f.receipt_no}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-black uppercase tracking-tight">{f.center_name || t("Unknown")}</span>
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{t("Authorized Center")}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs font-bold uppercase tracking-tight">
                            {f.student_name || t("Guest Student")}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={cn(
                              "px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border",
                              f.mode === "cash" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                              f.mode === "online" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                              "bg-muted text-muted-foreground border-border"
                            )}>
                              {t(f.mode)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-black text-foreground">
                            ₹{f.amount.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                      {filteredFees.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-20 text-center">
                            <div className="flex flex-col items-center gap-2 opacity-50">
                              <Search className="w-8 h-8 text-muted-foreground mb-2" />
                              <p className="text-[10px] font-black uppercase tracking-widest">{t("No revenue records found for this period")}</p>
                              <p className="text-xs font-medium">{t("Try adjusting your filters or search query")}</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminRevenuePage;
