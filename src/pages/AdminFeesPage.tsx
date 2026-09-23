import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndianRupee, Search, Plus, Loader2, Calendar, FileText, User, CreditCard, Save, Printer, Edit2, Eye, Filter, Download, Building2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { FeeReceiptModal, FeeReceiptData } from "@/components/FeeReceiptModal";

interface Student {
  _id: string;
  username: string;
  fullName?: string;
  course?: string;
  total_fees?: number;
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

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    try {
      const token = sessionStorage.getItem("token");
      let feeUrl = "/api/fees";
      const params = new URLSearchParams();
      if (filters.month) params.set("month", filters.month);
      if (filters.year) params.set("year", filters.year);
      if (filters.centerId) params.set("center_id", filters.centerId);
      if (filters.startDate) params.set("start_date", filters.startDate);
      if (filters.endDate) params.set("end_date", filters.endDate);
      if (params.toString()) feeUrl += `?${params.toString()}`;

      const [studentRes, feeRes, centerRes] = await Promise.all([
        fetch("/api/students", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch(feeUrl, { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/centers", { headers: { "Authorization": `Bearer ${token}` } })
      ]);
      
      const studentData = await studentRes.json();
      const feeData = await feeRes.json();
      const centerData = await centerRes.json();
      
      if (studentRes.ok && feeRes.ok && centerRes.ok) {
        setStudents(studentData);
        setFees(feeData);
        setCenters(centerData);
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

    setCollectingFee(true);
    try {
      const token = sessionStorage.getItem("token");
      const response = await fetch("/api/fees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          student_id: selectedStudent._id,
          amount: parseFloat(feeForm.amount),
          mode: feeForm.mode,
          receipt_no: feeForm.receipt_no,
          remarks: feeForm.remarks
        })
      });

      if (response.ok) {
        toast.success("Fee collected successfully");
        setIsCollecting(false);
        setFeeForm({ amount: "", mode: "cash", receipt_no: `RCP-${Date.now().toString().slice(-6)}`, remarks: "" });
        fetchData();
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to collect fee");
      }
    } catch (error) {
      console.error("Error collecting fee:", error);
      toast.error("An error occurred");
    } finally {
      setCollectingFee(false);
    }
  };

  const handleSetTotalFees = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    setUpdatingTotal(true);
    try {
      const token = sessionStorage.getItem("token");
      const response = await fetch("/api/fees/total", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          student_id: selectedStudent._id,
          total_fees: parseFloat(totalFees)
        })
      });

      if (response.ok) {
        toast.success("Total fees updated successfully");
        setIsSettingTotal(false);
        setTotalFees("");
        fetchData();
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to update total fees");
      }
    } catch (error) {
      console.error("Error updating total fees:", error);
      toast.error("An error occurred");
    } finally {
      setUpdatingTotal(false);
    }
  };

  const handlePreviewFeeSlip = () => {
    if (!selectedStudent) return;
    const studentFeesList = getStudentFees(selectedStudent._id);
    if (studentFeesList.length > 0) {
      const latest = studentFeesList[0];
      setSelectedReceipt({
        receipt_no: latest.receipt_no,
        payment_date: latest.payment_date,
        amount: latest.amount,
        mode: latest.mode,
        remarks: latest.remarks,
        student_name: selectedStudent.fullName || selectedStudent.username,
        enrollment_no: (selectedStudent as any).enrollment_number || (selectedStudent as any).roll_number || "SCRE-ENR-OK",
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

  const getStudentFees = (studentId: string) => fees.filter(f => f.student_id === studentId);
  
  const getStudentTotalPaid = (studentId: string) => 
    getStudentFees(studentId).reduce((acc, fee) => acc + fee.amount, 0);

  const getYears = () => {
    const years = new Set<string>();
    fees.forEach(f => {
      years.add(new Date(f.payment_date).getFullYear().toString());
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  };

  const totalCollected = fees.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Admin Fees Management</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Manage fees for all students across centers.</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                placeholder="Search students..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-none text-xs font-bold uppercase tracking-widest focus:border-primary outline-none"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <select
                value={filters.centerId}
                onChange={(e) => setFilters({ ...filters, centerId: e.target.value })}
                className="px-3 py-2 bg-card border border-border rounded-none text-xs font-bold uppercase tracking-widest focus:border-primary outline-none"
              >
                <option value="">All Centers</option>
                {centers.map(center => (
                  <option key={center._id} value={center._id}>{center.name || center.centerName}</option>
                ))}
              </select>
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                value={filters.year}
                onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                className="px-3 py-2 bg-card border border-border rounded-none text-xs font-bold uppercase tracking-widest focus:border-primary outline-none"
              >
                <option value="">All Years</option>
                {getYears().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <select
                value={filters.month}
                onChange={(e) => setFilters({ ...filters, month: e.target.value })}
                className="px-3 py-2 bg-card border border-border rounded-none text-xs font-bold uppercase tracking-widest focus:border-primary outline-none"
              >
                <option value="">All Months</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                  <option key={month} value={month.toString()}>
                    {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">From</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="px-3 py-2 bg-card border border-border rounded-none text-xs font-bold uppercase tracking-widest focus:border-primary outline-none"
                />
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">To</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="px-3 py-2 bg-card border border-border rounded-none text-xs font-bold uppercase tracking-widest focus:border-primary outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-none border-primary/30 shadow-lg">
            <CardContent className="p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">Total Collected</p>
              <p className="text-2xl font-black text-primary">₹{totalCollected.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="rounded-none border-emerald-600/30 shadow-lg">
            <CardContent className="p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">Total Students</p>
              <p className="text-2xl font-black text-emerald-600">{students.length}</p>
            </CardContent>
          </Card>
          <Card className="rounded-none border-blue-600/30 shadow-lg">
            <CardContent className="p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">Total Transactions</p>
              <p className="text-2xl font-black text-blue-600">{fees.length}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Student List */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Student Directory</h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : filteredStudents.length === 0 ? (
                <p className="text-center py-10 text-xs font-bold uppercase tracking-widest text-muted-foreground">No students found</p>
              ) : (
                filteredStudents.map(student => (
                  <button
                    key={student._id}
                    onClick={() => {
                      setSelectedStudent(student);
                      setIsCollecting(false);
                      setIsSettingTotal(false);
                    }}
                    className={cn(
                      "w-full p-4 border text-left transition-all rounded-none group",
                      selectedStudent?._id === student._id 
                        ? "bg-primary border-transparent shadow-lg" 
                        : "bg-card border-border hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 flex items-center justify-center border transition-all",
                        selectedStudent?._id === student._id ? "bg-white/10 border-white/20" : "bg-primary/5 border-primary/10"
                      )}>
                        <User className={cn("w-5 h-5", selectedStudent?._id === student._id ? "text-white" : "text-primary")} />
                      </div>
                      <div>
                        <p className={cn("text-xs font-black uppercase tracking-tight", selectedStudent?._id === student._id ? "text-white" : "text-foreground")}>
                          {student.fullName || student.username}
                        </p>
                        <p className={cn("text-[9px] font-bold", selectedStudent?._id === student._id ? "text-white/70" : "text-muted-foreground")}>
                          {student.course || "No Course Allotted"}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Fee Details / Collection */}
          <div className="lg:col-span-2">
            {!selectedStudent ? (
              <Card className="h-full rounded-none border-border border-dashed flex flex-col items-center justify-center p-12 text-center opacity-60">
                <IndianRupee className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Select a student to manage fees</p>
              </Card>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight text-foreground">{selectedStudent.fullName || selectedStudent.username}</h3>
                    <p className="text-xs font-bold text-primary uppercase tracking-widest">{selectedStudent.course}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => { setIsCollecting(!isCollecting); setIsSettingTotal(false); }}
                      className={cn(
                        "px-6 py-3 rounded-none font-heading font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center gap-2",
                        isCollecting ? "bg-muted text-foreground" : "bg-primary text-primary-foreground shadow-lg hover:opacity-90"
                      )}
                    >
                      {isCollecting ? "Cancel Collection" : <><Plus className="w-4 h-4" /> Collect Fee</>}
                    </button>
                    <button
                      onClick={() => { setIsSettingTotal(!isSettingTotal); setIsCollecting(false); }}
                      className={cn(
                        "px-6 py-3 rounded-none font-heading font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center gap-2",
                        isSettingTotal ? "bg-muted text-foreground" : "bg-emerald-600 text-white shadow-lg hover:opacity-90"
                      )}
                    >
                      {isSettingTotal ? "Cancel" : <><Edit2 className="w-4 h-4" /> Set Total Fees</>}
                    </button>
                    <button
                      onClick={handlePreviewFeeSlip}
                      className="px-6 py-3 bg-blue-600 text-white rounded-none font-heading font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:opacity-90 transition-all flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" /> Preview
                    </button>
                    <button
                      onClick={handlePrintFeeSlip}
                      className="px-6 py-3 bg-purple-600 text-white rounded-none font-heading font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:opacity-90 transition-all flex items-center gap-2"
                    >
                      <Printer className="w-4 h-4" /> Print
                    </button>
                  </div>
                </div>

                {/* Total Fees Display */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="rounded-none border-primary/30 shadow-lg">
                    <CardContent className="p-6">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">Total Fees</p>
                      <p className="text-2xl font-black text-primary">₹{(selectedStudent.total_fees || 0).toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-none border-emerald-600/30 shadow-lg">
                    <CardContent className="p-6">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">Total Paid</p>
                      <p className="text-2xl font-black text-emerald-600">₹{getStudentTotalPaid(selectedStudent._id).toLocaleString()}</p>
                    </CardContent>
                  </Card>
                </div>

                {isCollecting ? (
                  <Card className="rounded-none border-primary shadow-xl overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b border-primary/10">
                      <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-primary">
                        <CreditCard className="w-4 h-4" />
                        Fee Collection Form
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <form onSubmit={handleCollectFee} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest">Amount (₹)</label>
                          <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input 
                              required 
                              type="number" 
                              placeholder="0.00" 
                              className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none" 
                              value={feeForm.amount}
                              onChange={(e) => setFeeForm({...feeForm, amount: e.target.value})}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest">Payment Mode</label>
                          <select 
                            className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none appearance-none"
                            value={feeForm.mode}
                            onChange={(e) => setFeeForm({...feeForm, mode: e.target.value})}
                          >
                            <option value="cash">CASH</option>
                            <option value="online">ONLINE</option>
                            <option value="cheque">CHEQUE</option>
                            <option value="transfer">BANK TRANSFER</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest">Receipt No.</label>
                          <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input 
                              required 
                              className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none" 
                              value={feeForm.receipt_no}
                              onChange={(e) => setFeeForm({...feeForm, receipt_no: e.target.value})}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest">Remarks</label>
                          <input 
                            className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-primary outline-none" 
                            placeholder="Optional notes"
                            value={feeForm.remarks}
                            onChange={(e) => setFeeForm({...feeForm, remarks: e.target.value})}
                          />
                        </div>
                        <div className="md:col-span-2 flex justify-end pt-2">
                          <button
                            type="submit"
                            disabled={collectingFee}
                            className="bg-primary text-primary-foreground px-8 py-4 rounded-none font-heading font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all flex items-center gap-3 disabled:opacity-50"
                          >
                            {collectingFee ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Confirm Payment
                          </button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                ) : isSettingTotal ? (
                  <Card className="rounded-none border-emerald-600 shadow-xl overflow-hidden">
                    <CardHeader className="bg-emerald-500/5 border-b border-emerald-600/10">
                      <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-emerald-600">
                        <Edit2 className="w-4 h-4" />
                        Set Total Fees
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <form onSubmit={handleSetTotalFees} className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest">Total Fees (₹)</label>
                          <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input 
                              required 
                              type="number" 
                              placeholder="0.00" 
                              className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-background text-sm font-bold focus:border-emerald-600 outline-none" 
                              value={totalFees}
                              onChange={(e) => setTotalFees(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end pt-2">
                          <button
                            type="submit"
                            disabled={updatingTotal}
                            className="bg-emerald-600 text-white px-8 py-4 rounded-none font-heading font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all flex items-center gap-3 disabled:opacity-50"
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
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Payment History</h4>
                    <div className="space-y-3">
                      {getStudentFees(selectedStudent._id).length === 0 ? (
                        <p className="text-center py-20 border border-border border-dashed text-xs font-bold uppercase tracking-widest text-muted-foreground bg-muted/5">
                          No payments recorded yet
                        </p>
                      ) : (
                        getStudentFees(selectedStudent._id).map(fee => (
                          <div key={fee._id} className="bg-card border border-border p-4 flex items-center justify-between group hover:border-primary/40 transition-all">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                <IndianRupee className="w-5 h-5 text-emerald-600" />
                              </div>
                              <div>
                                <p className="text-sm font-black text-foreground">₹{fee.amount.toLocaleString()}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight flex items-center gap-2">
                                  <Calendar className="w-3 h-3" /> {format(new Date(fee.payment_date), "dd MMM yyyy")}
                                  <span className="mx-1">•</span>
                                  <CreditCard className="w-3 h-3" /> {fee.mode.toUpperCase()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex items-center gap-3">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary">{fee.receipt_no}</p>
                                <p className="text-[9px] font-bold text-muted-foreground truncate max-w-[150px]">{fee.remarks}</p>
                              </div>
                              <button
                                onClick={() => setSelectedReceipt({
                                  receipt_no: fee.receipt_no,
                                  payment_date: fee.payment_date,
                                  amount: fee.amount,
                                  mode: fee.mode,
                                  remarks: fee.remarks,
                                  student_name: selectedStudent.fullName || selectedStudent.username,
                                  enrollment_no: (selectedStudent as any).enrollment_number || (selectedStudent as any).roll_number || "SCRE-ENR-OK",
                                  course_name: selectedStudent.course || "Certified Course",
                                })}
                                className="px-2.5 py-1 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                              >
                                <FileText className="w-3 h-3" /> Slip
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
        <FeeReceiptModal
          isOpen={!!selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          receipt={selectedReceipt}
        />
      </div>
    </DashboardLayout>
  );
};

export default AdminFeesPage;
