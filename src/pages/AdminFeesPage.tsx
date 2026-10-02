import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndianRupee, Search, Plus, Loader2, Calendar, FileText, User, CreditCard, Save, Printer, Edit2, Eye, Filter, Download, Building2, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { FeeReceiptModal, FeeReceiptData } from "@/components/FeeReceiptModal";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface Student {
  _id?: string;
  id?: string;
  username: string;
  fullName?: string;
  course?: string;
  total_fees?: number;
  totalFee?: number;
  parent_id?: string;
  centerName?: string;
}

interface FeeRecord {
  _id: string;
  student_id: string;
  center_id: string;
  amount: number;
  payment_date: string;
  mode: string;
  receipt_no: string;
  remarks?: string;
  total_fees?: number;
  total_paid?: number;
  studentName?: string;
  centerName?: string;
}

const AdminFeesPage = () => {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isCollecting, setIsCollecting] = useState(false);
  const [isSettingTotal, setIsSettingTotal] = useState(false);
  const [collectingFee, setCollectingFee] = useState(false);
  const [updatingTotal, setUpdatingTotal] = useState(false);
  const [totalFees, setTotalFees] = useState("");
  const [filters, setFilters] = useState({ month: "", year: "", centerId: "", startDate: "", endDate: "" });
  const [centers, setCenters] = useState<any[]>([]);

  const [feeForm, setFeeForm] = useState({
    amount: "",
    mode: "cash",
    receipt_no: `RCP-${Date.now().toString().slice(-6)}`,
    remarks: ""
  });
  const [selectedReceipt, setSelectedReceipt] = useState<FeeReceiptData | null>(null);

  const getStudentId = (s: Student | null | undefined): string => {
    if (!s) return "";
    return s.id || s._id || (s as any).id || "";
  };

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    try {
      let feeUrl = "/api/fees";
      const params = new URLSearchParams();
      if (filters.month) params.set("month", filters.month);
      if (filters.year) params.set("year", filters.year);
      if (filters.centerId) params.set("center_id", filters.centerId);
      if (filters.startDate) params.set("start_date", filters.startDate);
      if (filters.endDate) params.set("end_date", filters.endDate);
      if (params.toString()) feeUrl += `?${params.toString()}`;

      const [studentRes, feeRes, centerRes] = await Promise.all([
        apiFetch("/api/students"),
        apiFetch(feeUrl),
        apiFetch("/api/centers")
      ]);

      const studentData = await studentRes.json();
      const feeData = await feeRes.json();
      const centerData = await centerRes.json();

      if (studentRes.ok && feeRes.ok && centerRes.ok) {
        setStudents(Array.isArray(studentData) ? studentData : []);
        setFees(Array.isArray(feeData) ? feeData : []);
        setCenters(Array.isArray(centerData) ? centerData : []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load fee data");
    } finally {
      setLoading(false);
    }
  };

  const handleCollectFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    const studentId = getStudentId(selectedStudent);
    if (!studentId) {
      toast.error("Invalid student selected");
      return;
    }

    setCollectingFee(true);
    try {
      const response = await apiFetch("/api/fees", {
        method: "POST",
        body: JSON.stringify({
          student_id: studentId,
          amount: parseFloat(feeForm.amount),
          mode: feeForm.mode,
          receipt_no: feeForm.receipt_no,
          remarks: feeForm.remarks,
          payment_type: "one_time",
          payment_name: "One Time Payment"
        })
      });

      if (response.ok) {
        toast.success("Fee collected successfully");
        setIsCollecting(false);
        setFeeForm({ amount: "", mode: "cash", receipt_no: `RCP-${Date.now().toString().slice(-6)}`, remarks: "" });
        fetchData();
      } else {
        const errorText = await response.text();
        let message = "Failed to collect fee";
        try {
          const parsed = JSON.parse(errorText);
          message = parsed.message || message;
        } catch {
          if (errorText) message = errorText;
        }
        toast.error(message);
      }
    } catch (error: any) {
      console.error("Error collecting fee:", error);
      toast.error(error?.message || "An error occurred");
    } finally {
      setCollectingFee(false);
    }
  };

  const handleSetTotalFees = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    const studentId = getStudentId(selectedStudent);
    if (!studentId) {
      toast.error("Invalid student selected");
      return;
    }

    setUpdatingTotal(true);
    try {
      const response = await apiFetch("/api/fees/total", {
        method: "POST",
        body: JSON.stringify({
          student_id: studentId,
          total_fees: parseFloat(totalFees)
        })
      });

      if (response.ok) {
        toast.success("Total fees updated successfully");
        setIsSettingTotal(false);
        setTotalFees("");
        setSelectedStudent(prev => prev ? { ...prev, total_fees: parseFloat(totalFees), totalFee: parseFloat(totalFees) } : null);
        fetchData();
      } else {
        const errorText = await response.text();
        let message = "Failed to update total fees";
        try {
          const parsed = JSON.parse(errorText);
          message = parsed.message || message;
        } catch {
          if (errorText) message = errorText;
        }
        toast.error(message);
      }
    } catch (error: any) {
      console.error("Error updating total fees:", error);
      toast.error(error?.message || "An error occurred");
    } finally {
      setUpdatingTotal(false);
    }
  };

  const handlePreviewFeeSlip = () => {
    if (!selectedStudent) return;
    const studentId = getStudentId(selectedStudent);
    const studentFeesList = getStudentFees(studentId);
    if (studentFeesList.length > 0) {
      const latest = studentFeesList[0];
      setSelectedReceipt({
        receipt_no: latest.receipt_no,
        payment_date: latest.payment_date,
        amount: latest.amount,
        mode: latest.mode,
        remarks: latest.remarks,
        student_name: selectedStudent.fullName || selectedStudent.username,
        enrollment_no: (selectedStudent as any).enrollment_number || (selectedStudent as any).enrollmentNumber || (selectedStudent as any).roll_number || "SCRE-ENR-OK",
        course_name: selectedStudent.course || "Certified Course",
      });
    } else {
      toast.error("No fee records found for this student");
    }
  };

  const handlePrintFeeSlip = () => {
    handlePreviewFeeSlip();
  };

  const filteredStudents = students.filter(s =>
    s.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStudentFees = (studentId: string) => {
    if (!studentId) return [];
    return fees.filter(f => f.student_id === studentId || (f as any).studentId === studentId);
  };

  const getStudentTotalPaid = (studentId: string) =>
    getStudentFees(studentId).reduce((acc, fee) => acc + fee.amount, 0);

  const getYears = () => {
    const years = new Set<string>();
    fees.forEach(f => {
      if (f.payment_date) {
        years.add(new Date(f.payment_date).getFullYear().toString());
      }
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  };

  const totalCollected = fees.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-heading font-extrabold text-2xl md:text-3xl text-zinc-100 uppercase tracking-tight">
                Admin Fees Management
              </h1>
              <p className="text-zinc-400 text-xs font-medium">Manage student fee collections, royalty shares, and receipts across centers.</p>
            </div>
          </div>

          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 outline-none"
            />
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-4 bg-zinc-900/90 border border-zinc-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <Building2 className="w-4 h-4 text-amber-400" />
            <select
              value={filters.centerId}
              onChange={(e) => setFilters({ ...filters, centerId: e.target.value })}
              className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl font-bold text-amber-400 uppercase outline-none focus:border-amber-500"
            >
              <option value="">All Centers</option>
              {centers.map(center => (
                <option key={center._id} value={center._id}>{center.name || center.centerName}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-400" />
              <select
                value={filters.year}
                onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl font-bold text-zinc-200 uppercase outline-none focus:border-amber-500"
              >
                <option value="">All Years</option>
                {getYears().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <select
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: e.target.value })}
              className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl font-bold text-zinc-200 uppercase outline-none focus:border-amber-500"
            >
              <option value="">All Months</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <option key={month} value={month.toString()}>
                  {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5 text-zinc-400 font-bold">
              <span className="text-[10px] uppercase">From</span>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-xl font-bold text-xs outline-none focus:border-amber-500"
              />
              <span className="text-[10px] uppercase">To</span>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-xl font-bold text-xs outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900/90 border border-amber-500/30 p-5 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Total Fees Collected</p>
              <p className="text-2xl font-black text-amber-300 mt-1">₹{totalCollected.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <IndianRupee className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-emerald-500/30 p-5 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Super Admin Royalty (15%)</p>
              <p className="text-2xl font-black text-emerald-300 mt-1">₹{(totalCollected * 0.15).toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-purple-500/30 p-5 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">Center Net Share (85%)</p>
              <p className="text-2xl font-black text-purple-300 mt-1">₹{(totalCollected * 0.85).toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Building2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-blue-500/30 p-5 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Total Students / Txns</p>
              <p className="text-2xl font-black text-blue-300 mt-1">{students.length} / {fees.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <CreditCard className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Student Directory Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Student Directory</h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>
              ) : filteredStudents.length === 0 ? (
                <p className="text-center py-10 text-xs font-bold uppercase tracking-widest text-zinc-500">No students found</p>
              ) : (
                filteredStudents.map(student => {
                  const sId = getStudentId(student);
                  const isSelected = getStudentId(selectedStudent) === sId;
                  return (
                    <button
                      key={sId}
                      onClick={() => {
                        setSelectedStudent(student);
                        setIsCollecting(false);
                        setIsSettingTotal(false);
                      }}
                      className={cn(
                        "w-full p-4 border text-left transition-all rounded-2xl group flex items-center justify-between",
                        isSelected
                          ? "bg-amber-500/10 border-amber-500 text-amber-300 shadow-lg shadow-amber-500/10"
                          : "bg-zinc-900/90 border-zinc-800 hover:border-zinc-700 text-zinc-200"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center border transition-all",
                          isSelected ? "bg-amber-500 text-slate-950 border-amber-400" : "bg-zinc-950 border-zinc-800 text-amber-400"
                        )}>
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className={cn("text-xs font-extrabold uppercase tracking-tight", isSelected ? "text-amber-300" : "text-zinc-100")}>
                            {student.fullName || student.username}
                          </p>
                          <p className="text-[10px] font-bold text-zinc-400">
                            {student.course || "No Course Allotted"}
                          </p>
                        </div>
                      </div>
                      <Badge className={isSelected ? "bg-amber-500 text-slate-950 font-black text-[9px]" : "bg-zinc-950 text-zinc-400 font-bold text-[9px] border-zinc-800"}>
                        {getStudentFees(sId).length} Txns
                      </Badge>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Fee Details & Collection Main Panel */}
          <div className="lg:col-span-2">
            {!selectedStudent ? (
              <Card className="h-full rounded-2xl border-zinc-800 border-dashed bg-zinc-900/40 flex flex-col items-center justify-center p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center mb-4 text-zinc-600">
                  <IndianRupee className="w-8 h-8" />
                </div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Select a student from directory to manage fee collection</p>
              </Card>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                  <div>
                    <h3 className="text-xl font-extrabold uppercase tracking-tight text-zinc-100">{selectedStudent.fullName || selectedStudent.username}</h3>
                    <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">{selectedStudent.course || "No Course Allotted"}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => { setIsCollecting(!isCollecting); setIsSettingTotal(false); }}
                      className={cn(
                        "px-5 py-2.5 rounded-xl font-heading font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2",
                        isCollecting ? "bg-zinc-800 text-zinc-300" : "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10 hover:bg-amber-400"
                      )}
                    >
                      {isCollecting ? "Cancel Collection" : <><Plus className="w-4 h-4" /> Collect Fee</>}
                    </button>
                    <button
                      onClick={() => { setIsSettingTotal(!isSettingTotal); setIsCollecting(false); }}
                      className={cn(
                        "px-5 py-2.5 rounded-xl font-heading font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2",
                        isSettingTotal ? "bg-zinc-800 text-zinc-300" : "bg-emerald-600 text-white shadow-lg hover:bg-emerald-500"
                      )}
                    >
                      {isSettingTotal ? "Cancel" : <><Edit2 className="w-4 h-4" /> Set Total Fees</>}
                    </button>
                    <button
                      onClick={handlePreviewFeeSlip}
                      className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-heading font-black text-xs uppercase tracking-wider shadow-lg hover:bg-blue-500 transition-all flex items-center gap-1.5"
                    >
                      <Eye className="w-4 h-4" /> Preview
                    </button>
                    <button
                      onClick={handlePrintFeeSlip}
                      className="px-4 py-2.5 bg-purple-600 text-white rounded-xl font-heading font-black text-xs uppercase tracking-wider shadow-lg hover:bg-purple-500 transition-all flex items-center gap-1.5"
                    >
                      <Printer className="w-4 h-4" /> Print
                    </button>
                  </div>
                </div>

                {/* Total Fees Display */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-900/90 border border-zinc-800 p-5 rounded-2xl shadow-xl">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-1">Total Allocated Fees</p>
                    <p className="text-2xl font-black text-amber-400">₹{(selectedStudent.total_fees || selectedStudent.totalFee || 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-zinc-900/90 border border-zinc-800 p-5 rounded-2xl shadow-xl">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-1">Total Amount Paid</p>
                    <p className="text-2xl font-black text-emerald-400">₹{getStudentTotalPaid(getStudentId(selectedStudent)).toLocaleString()}</p>
                  </div>
                </div>

                {isCollecting ? (
                  <Card className="rounded-2xl border-zinc-800 bg-zinc-900/90 shadow-xl overflow-hidden">
                    <CardHeader className="bg-zinc-900/80 border-b border-zinc-800 p-5">
                      <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 text-amber-400">
                        <CreditCard className="w-4 h-4" />
                        Fee Collection Form
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <form onSubmit={handleCollectFee} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Amount (₹)</label>
                          <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <input
                              required
                              type="number"
                              placeholder="0.00"
                              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-sm font-bold text-zinc-100 focus:border-amber-500 outline-none"
                              value={feeForm.amount}
                              onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Payment Mode</label>
                          <select
                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-sm font-bold text-zinc-100 focus:border-amber-500 outline-none"
                            value={feeForm.mode}
                            onChange={(e) => setFeeForm({ ...feeForm, mode: e.target.value })}
                          >
                            <option value="cash">CASH</option>
                            <option value="upi">UPI / ONLINE</option>
                            <option value="cheque">CHEQUE</option>
                            <option value="banktransfer">BANK TRANSFER</option>
                            <option value="card">CARD</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Receipt No.</label>
                          <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <input
                              required
                              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-sm font-bold text-zinc-100 focus:border-amber-500 outline-none"
                              value={feeForm.receipt_no}
                              onChange={(e) => setFeeForm({ ...feeForm, receipt_no: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Remarks</label>
                          <input
                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-sm font-bold text-zinc-100 focus:border-amber-500 outline-none"
                            placeholder="Optional notes"
                            value={feeForm.remarks}
                            onChange={(e) => setFeeForm({ ...feeForm, remarks: e.target.value })}
                          />
                        </div>
                        <div className="md:col-span-2 flex justify-end pt-2">
                          <button
                            type="submit"
                            disabled={collectingFee}
                            className="bg-amber-500 text-slate-950 px-8 py-3 rounded-xl font-heading font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-amber-400 transition-all flex items-center gap-2 disabled:opacity-50"
                          >
                            {collectingFee ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Confirm Payment
                          </button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                ) : isSettingTotal ? (
                  <Card className="rounded-2xl border-zinc-800 bg-zinc-900/90 shadow-xl overflow-hidden">
                    <CardHeader className="bg-zinc-900/80 border-b border-zinc-800 p-5">
                      <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 text-emerald-400">
                        <Edit2 className="w-4 h-4" />
                        Set Total Fees
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <form onSubmit={handleSetTotalFees} className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Total Fees (₹)</label>
                          <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <input
                              required
                              type="number"
                              placeholder="0.00"
                              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-sm font-bold text-zinc-100 focus:border-emerald-500 outline-none"
                              value={totalFees}
                              onChange={(e) => setTotalFees(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end pt-2">
                          <button
                            type="submit"
                            disabled={updatingTotal}
                            className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-heading font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-emerald-500 transition-all flex items-center gap-2 disabled:opacity-50"
                          >
                            {updatingTotal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Update Total Fees
                          </button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Payment History</h4>
                    <div className="space-y-3">
                      {getStudentFees(getStudentId(selectedStudent)).length === 0 ? (
                        <div className="text-center py-16 border border-zinc-800 border-dashed rounded-2xl text-xs font-bold uppercase tracking-widest text-zinc-500 bg-zinc-950/40">
                          No payments recorded yet
                        </div>
                      ) : (
                        getStudentFees(getStudentId(selectedStudent)).map((fee) => (
                          <div key={fee._id} className="bg-zinc-900/90 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between group hover:border-zinc-700 transition-all">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                                <IndianRupee className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-sm font-black text-zinc-100">₹{fee.amount.toLocaleString()}</p>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight flex items-center gap-2 mt-0.5">
                                  <Calendar className="w-3 h-3" /> {format(new Date(fee.payment_date), "dd MMM yyyy")}
                                  <span className="mx-1 text-zinc-600">•</span>
                                  <CreditCard className="w-3 h-3 text-amber-400" /> {fee.mode.toUpperCase()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex items-center gap-3">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">{fee.receipt_no}</p>
                                <p className="text-[9px] font-bold text-zinc-500 truncate max-w-[150px]">{fee.remarks}</p>
                              </div>
                              <button
                                onClick={() =>
                                  setSelectedReceipt({
                                    receipt_no: fee.receipt_no,
                                    payment_date: fee.payment_date,
                                    amount: fee.amount,
                                    mode: fee.mode,
                                    remarks: fee.remarks,
                                    student_name: selectedStudent.fullName || selectedStudent.username,
                                    enrollment_no: (selectedStudent as any).enrollment_number || (selectedStudent as any).roll_number || "SCRE-ENR-OK",
                                    course_name: selectedStudent.course || "Certified Course",
                                  })
                                }
                                className="px-3 py-1.5 bg-zinc-950 hover:bg-amber-500/20 text-zinc-300 hover:text-amber-400 border border-zinc-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all rounded-lg"
                              >
                                <FileText className="w-3.5 h-3.5" /> Slip
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Fee Receipt Printable Modal */}
        <FeeReceiptModal isOpen={!!selectedReceipt} onClose={() => setSelectedReceipt(null)} receipt={selectedReceipt} />
      </div>
    </DashboardLayout>
  );
};

export default AdminFeesPage;

