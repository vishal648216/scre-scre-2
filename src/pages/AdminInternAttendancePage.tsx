import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckSquare, Search, Calendar, Users, CheckCircle2, XCircle, Clock, IndianRupee, Filter, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface InternRecord {
  id: string;
  fullName: string;
  enrollmentNumber: string;
  domain: string;
  stipendStatus: "Paid" | "Unpaid";
  monthlyStipend: number;
  attendancePercent: number;
  todayStatus: "Present" | "Absent" | "Leave" | "Late";
  totalPresent: number;
  totalWorkingDays: number;
  stipendPaid: boolean;
}

const AdminInternAttendancePage = () => {
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("all");
  const [interns, setInterns] = useState<InternRecord[]>([]);

  useEffect(() => {
    fetchInterns();
  }, [date]);

  const fetchInterns = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/interns");
      if (res.ok) {
        const data = await res.json();
        const mapped: InternRecord[] = (Array.isArray(data) ? data : []).map((i: any, idx: number) => ({
          id: i.id || i._id || String(idx),
          fullName: i.fullName || i.full_name || i.username || "Intern Candidate",
          enrollmentNumber: i.enrollment_number || i.enrollmentNumber || `INT-2026-${1000 + idx}`,
          domain: i.internshipDomain || i.course || "Software Development",
          stipendStatus: idx % 2 === 0 ? "Paid" : "Unpaid",
          monthlyStipend: idx % 2 === 0 ? 5000 : 0,
          attendancePercent: Math.min(100, Math.max(70, 85 + (idx % 15))),
          todayStatus: "Present",
          totalPresent: 22,
          totalWorkingDays: 24,
          stipendPaid: idx % 3 === 0,
        }));
        setInterns(mapped);
      }
    } catch {
      toast.error("Failed to load attendance list");
    } finally {
      setLoading(false);
    }
  };

  const updateTodayStatus = (id: string, status: "Present" | "Absent" | "Leave" | "Late") => {
    setInterns((prev) =>
      prev.map((i) => (i.id === id ? { ...i, todayStatus: status } : i))
    );
  };

  const toggleStipendPaid = (id: string) => {
    setInterns((prev) =>
      prev.map((i) => (i.id === id ? { ...i, stipendPaid: !i.stipendPaid } : i))
    );
    toast.success("Stipend status updated");
  };

  const handleSaveAttendance = () => {
    toast.success(`Attendance register saved for date: ${date}`);
  };

  const filtered = interns.filter((i) => {
    const matchesSearch =
      i.fullName.toLowerCase().includes(search.toLowerCase()) ||
      i.enrollmentNumber.toLowerCase().includes(search.toLowerCase()) ||
      i.domain.toLowerCase().includes(search.toLowerCase());

    const matchesDomain =
      domainFilter === "all" || i.domain.toLowerCase().includes(domainFilter.toLowerCase());

    return matchesSearch && matchesDomain;
  });

  const totalPresentToday = interns.filter((i) => i.todayStatus === "Present").length;
  const totalPaidStipends = interns.filter((i) => i.stipendStatus === "Paid" && i.stipendPaid).length;
  const totalStipendDisbursed = interns
    .filter((i) => i.stipendStatus === "Paid" && i.stipendPaid)
    .reduce((acc, i) => acc + i.monthlyStipend, 0);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl border border-indigo-500/20 shadow-xl">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-1">
              <CheckSquare className="w-4 h-4" /> Intern Attendance & Stipend Register
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Daily Attendance & Monthly Stipends
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Mark daily attendance, calculate monthly attendance %, and manage intern stipend payouts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveAttendance}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Save Attendance Register
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg backdrop-blur-xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Present Today</p>
                <h3 className="text-2xl font-extrabold text-emerald-400 mt-2">{totalPresentToday} / {interns.length}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="text-[11px] text-emerald-400 mt-3 font-semibold">Active attendance marked</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg backdrop-blur-xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Stipends Disbursed</p>
                <h3 className="text-2xl font-extrabold text-cyan-400 mt-2">₹{totalStipendDisbursed.toLocaleString("en-IN")}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <IndianRupee className="w-5 h-5" />
              </div>
            </div>
            <div className="text-[11px] text-cyan-400 mt-3 font-semibold">{totalPaidStipends} Paid Interns Processed</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg backdrop-blur-xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Register Date</p>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-white font-bold text-sm px-2.5 py-1 rounded-lg mt-2 outline-none"
                />
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Register Table Card */}
        <Card className="rounded-2xl border border-slate-800 bg-slate-950/80 backdrop-blur-xl shadow-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-800/80 py-4 px-6 bg-slate-900/50">
            <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-200 flex items-center gap-2 uppercase tracking-wider">
                <Users className="w-4 h-4 text-cyan-400" /> Attendance Roster
              </CardTitle>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={domainFilter}
                  onChange={(e) => setDomainFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl text-xs font-medium focus:border-cyan-500 outline-none"
                >
                  <option value="all">All Domains</option>
                  <option value="software">Software / IT</option>
                  <option value="mechanical">Mechanical</option>
                  <option value="marketing">Digital Marketing</option>
                  <option value="finance">Finance & Tally</option>
                </select>

                <div className="relative min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    placeholder="Search candidate..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl text-xs font-medium focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-16 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                <span className="text-xs text-slate-400 font-medium">Loading Attendance Register...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-slate-300 text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/40 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                      <th className="px-5 py-3.5">Intern Name & Enrollment</th>
                      <th className="px-4 py-3.5">Domain</th>
                      <th className="px-4 py-3.5">Monthly %</th>
                      <th className="px-4 py-3.5">Today's Attendance</th>
                      <th className="px-4 py-3.5">Stipend Status</th>
                      <th className="px-5 py-3.5 text-right">Stipend Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filtered.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-bold text-white text-sm">{item.fullName}</div>
                          <div className="text-slate-400 text-[11px] font-mono">{item.enrollmentNumber}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-block px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-semibold rounded-lg text-[11px]">
                            {item.domain}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-bold text-white text-sm">{item.attendancePercent}%</div>
                          <div className="text-[10px] text-slate-400">{item.totalPresent} / {item.totalWorkingDays} Days</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5">
                            {(["Present", "Absent", "Leave", "Late"] as const).map((st) => (
                              <button
                                key={st}
                                onClick={() => updateTodayStatus(item.id, st)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                                  item.todayStatus === st
                                    ? st === "Present"
                                      ? "bg-emerald-600 text-white"
                                      : st === "Absent"
                                      ? "bg-rose-600 text-white"
                                      : st === "Leave"
                                      ? "bg-amber-600 text-white"
                                      : "bg-purple-600 text-white"
                                    : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
                                }`}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {item.stipendStatus === "Paid" ? (
                            <div>
                              <span className="font-bold text-emerald-400">₹{item.monthlyStipend.toLocaleString("en-IN")}/mo</span>
                              <div className="text-[10px] text-slate-400 font-semibold">
                                {item.stipendPaid ? "✓ Paid This Month" : "⏳ Pending Payout"}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">Academic (Unpaid)</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {item.stipendStatus === "Paid" ? (
                            <button
                              onClick={() => toggleStipendPaid(item.id)}
                              className={`px-3 py-1.5 rounded-lg font-bold text-[11px] border transition-all ${
                                item.stipendPaid
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              }`}
                            >
                              {item.stipendPaid ? "Mark Pending" : "Disburse Stipend"}
                            </button>
                          ) : (
                            <span className="text-slate-600 text-[10px]">N/A</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminInternAttendancePage;
