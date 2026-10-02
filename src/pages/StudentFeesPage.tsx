import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { IndianRupee, Search, Download, Loader2, Calendar, FileText, User, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Globe } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

interface CountryFeeRule {
  country_code: string;
  country_name: string;
  currency_code: string;
  currency_symbol: string;
  multiplier: number;
}

// Types
type PaymentType = "one_time" | "installment" | "late_fee" | "other";
type PaymentMode = "cash" | "upi" | "card" | "bank_transfer" | "cheque" | "other";

interface Student {
  id: string;
  username: string;
  fullName?: string;
  fatherName?: string;
  enrollmentNumber?: string;
  registrationNumber?: string;
  phone?: string;
  course?: string;
  totalFee: number;
  paidAmount: number;
  balanceDue: number;
  dueDate?: string;
  remarks?: string;
}

interface FeeRecord {
  _id: string;
  student_id: string;
  center_id: string;
  amount: number;
  payment_date: string;
  mode: PaymentMode;
  receipt_no: string;
  remarks?: string;
  reference_number?: string;
  previous_paid: number;
  total_paid: number;
  remaining_amount: number;
  created_by: string;
  created_at: string;
  payment_type: PaymentType;
  payment_name: string;
}

const StudentFeesPage = () => {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [allFees, setAllFees] = useState<FeeRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFeeRules, setCountryFeeRules] = useState<CountryFeeRule[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<CountryFeeRule>({
    country_code: "IN",
    country_name: "India",
    currency_code: "INR",
    currency_symbol: "₹",
    multiplier: 1.0,
  });

  const formatFee = (amountInInr: number) => {
    const converted = Math.round(amountInInr * selectedCurrency.multiplier);
    return `${selectedCurrency.currency_symbol}${converted.toLocaleString()}`;
  };
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const studentsPerPage = 10;
  
  // Modal states
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Payment form states
  const [paymentType, setPaymentType] = useState<PaymentType>("one_time");
  const [paymentName, setPaymentName] = useState("One Time Payment");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [referenceNumber, setReferenceNumber] = useState("");

  // Local remarks state for instant typing
  const [localRemarks, setLocalRemarks] = useState<Record<string, string>>({});
  
  // Debounce function
  const debounce = (func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };
  
  // Update student remarks (debounced)
  const updateStudentRemarks = debounce(async (studentId: string, remarks: string) => {
    try {
      const response = await apiFetch(`/api/students/${studentId}`, {
        method: "PUT",
        body: JSON.stringify({ remarks: remarks || null }),
      });
      if (response.ok) {
        // Update students state locally instead of refetching all data
        setStudents(prev => prev.map(s => 
          s.id === studentId ? { ...s, remarks } : s
        ));
      }
    } catch (error) {
      console.error("Error updating remarks", error);
    }
  }, 500); // Wait 500ms after last keystroke before saving
  
  // Fetch data
  const fetchData = async () => {
    try {
      const [studentRes, feeRes, countryFeesRes] = await Promise.all([
        apiFetch("/api/students"),
        apiFetch("/api/fees"),
        apiFetch("/api/public/country-fees").catch(() => null)
      ]);
      
      const studentData = await studentRes.json();
      const feeData = await feeRes.json();
      
      if (studentRes.ok && feeRes.ok) {
        setStudents(studentData);
        // Initialize local remarks from fetched data
        const initialRemarks: Record<string, string> = {};
        studentData.forEach((student: Student) => {
          if (student.remarks) {
            initialRemarks[student.id] = student.remarks;
          }
        });
        setLocalRemarks(initialRemarks);
        setAllFees(feeData);
      }

      if (countryFeesRes && countryFeesRes.ok) {
        const cData = await countryFeesRes.json().catch(() => null);
        if (cData && Array.isArray(cData.rules) && cData.rules.length > 0) {
          setCountryFeeRules(cData.rules);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-fill payment name when payment type changes
  useEffect(() => {
    switch (paymentType) {
      case "one_time":
        setPaymentName("One Time Payment");
        break;
      case "installment":
        setPaymentName("Installment");
        break;
      case "late_fee":
        setPaymentName("Late Fee");
        break;
      case "other":
        setPaymentName("Other Payment");
        break;
    }
  }, [paymentType]);

  // Filter students based on search query
  const filteredStudents = students.filter(student => {
    const searchLower = searchQuery.toLowerCase();
    return (
      (student.fullName?.toLowerCase().includes(searchLower) || false) ||
      (student.fatherName?.toLowerCase().includes(searchLower) || false) ||
      (student.enrollmentNumber?.toLowerCase().includes(searchLower) || false) ||
      (student.registrationNumber?.toLowerCase().includes(searchLower) || false) ||
      (student.course?.toLowerCase().includes(searchLower) || false)
    );
  });

  // Pagination logic
  const indexOfLastStudent = currentPage * studentsPerPage;
  const indexOfFirstStudent = indexOfLastStudent - studentsPerPage;
  const currentStudents = filteredStudents.slice(indexOfFirstStudent, indexOfLastStudent);
  const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);

  // Get student's fee records
  const getStudentFees = (studentId: string) => 
    allFees.filter(fee => fee.student_id === studentId).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  // Generate idempotency key
  const generateIdempotencyKey = () => {
    if (window.crypto?.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  };

  // Open manage modal
  const openManageModal = (student: Student) => {
    setSelectedStudent(student);
    setPaymentType("one_time");
    setAmount("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMode("cash");
    setReferenceNumber("");
    setIsManageModalOpen(true);
  };

  // Handle make payment
  const handleMakePayment = () => {
        if (!selectedStudent) return;
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }
        if (paymentMode !== "cash" && !referenceNumber.trim()) {
            toast.error("Reference number is required for this payment mode");
            return;
        }
        setIsConfirmDialogOpen(true);
    };

  // Confirm and submit payment
  const confirmAndSubmitPayment = async () => {
    if (!selectedStudent) return;
    setIsSubmitting(true);
    try {
      const idempotencyKey = generateIdempotencyKey();
      const response = await apiFetch("/api/fees/collect", {
        method: "POST",
        body: JSON.stringify({
          student_id: selectedStudent.id,
          amount: parseFloat(amount),
          mode: paymentMode,
          payment_date: paymentDate,
          reference_number: paymentMode !== "cash" ? referenceNumber : undefined,
          idempotency_key: idempotencyKey,
          payment_type: paymentType,
          payment_name: paymentName
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Fee collected successfully! Receipt: ${data.receipt_no}`);
        setIsConfirmDialogOpen(false);
        setIsManageModalOpen(false);
        fetchData();
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to collect fee");
      }
    } catch (error) {
      console.error("Error collecting fee:", error);
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download receipt
  const downloadReceipt = async (studentId: string) => {
    try {
      const response = await apiFetch(`/api/fees/receipt/latest?student_id=${encodeURIComponent(studentId)}`);
      if (!response.ok) {
        let message = "Failed to download receipt";
        try {
          message = await response.text() || message;
        } catch {
          // Ignore body parsing errors and keep generic message.
        }
        toast.error(message);
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `student_fee_receipt_${studentId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading receipt:", error);
      toast.error("Failed to download receipt");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12 text-zinc-100">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/90 p-6 rounded-2xl border border-zinc-800 shadow-xl backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                Center Fee Management & Collection
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-1">Student Fee Ledger</h1>
            <p className="text-zinc-400 text-xs mt-1">Collect fees, manage installments, and track student dues across center programs.</p>
          </div>
          {countryFeeRules.length > 0 && (
            <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-2 rounded-xl shadow-sm">
              <Globe className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Currency:</span>
              <select
                value={selectedCurrency.country_code}
                onChange={(e) => {
                  const rule = countryFeeRules.find(r => r.country_code === e.target.value);
                  if (rule) setSelectedCurrency(rule);
                }}
                className="bg-transparent text-xs font-bold text-zinc-200 outline-none cursor-pointer"
              >
                {countryFeeRules.map(rule => (
                  <option key={rule.country_code} value={rule.country_code} className="bg-zinc-900 text-zinc-200">
                    {rule.country_name} ({rule.currency_symbol} {rule.currency_code})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative w-full max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            placeholder="Search student by name, father's name, roll, course, or registration no..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-zinc-900/90 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors shadow-lg"
          />
        </div>

        {/* Student Fee Ledger Table Card */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4 font-bold">#</th>
                  <th className="py-3.5 px-4 font-bold">Student Profile</th>
                  <th className="py-3.5 px-4 font-bold">Guardian / Father</th>
                  <th className="py-3.5 px-4 font-bold">Enrollment No</th>
                  <th className="py-3.5 px-4 font-bold">Contact</th>
                  <th className="py-3.5 px-4 font-bold">Course</th>
                  <th className="py-3.5 px-4 font-bold">Total Fee</th>
                  <th className="py-3.5 px-4 font-bold">Paid Fee</th>
                  <th className="py-3.5 px-4 font-bold">Balance Dues</th>
                  <th className="py-3.5 px-4 font-bold">Due Date</th>
                  <th className="py-3.5 px-4 font-bold">Remarks</th>
                  <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {currentStudents.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-zinc-500 text-xs">
                      No student fee records found
                    </td>
                  </tr>
                ) : (
                  currentStudents.map((student, index) => {
                    const studentFees = getStudentFees(student.id);
                    return (
                      <tr key={student.id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3 px-4 text-zinc-500 font-mono">
                          {indexOfFirstStudent + index + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                              <User className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-bold text-zinc-100">{student.fullName || student.username}</p>
                              <p className="text-[10px] text-zinc-500 font-mono">{student.registrationNumber || `@${student.username}`}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-zinc-400">{student.fatherName || "-"}</td>
                        <td className="py-3 px-4 text-zinc-400 font-mono">{student.enrollmentNumber || "-"}</td>
                        <td className="py-3 px-4 text-zinc-400">{student.phone || "-"}</td>
                        <td className="py-3 px-4 text-zinc-300 font-medium">{student.course || "-"}</td>
                        <td className="py-3 px-4 text-zinc-200 font-bold">{formatFee(student.totalFee ?? 0)}</td>
                        <td className="py-3 px-4 text-emerald-400 font-bold">{formatFee(student.paidAmount ?? 0)}</td>
                        <td className="py-3 px-4 text-amber-400 font-bold">{formatFee(student.balanceDue ?? 0)}</td>
                        <td className="py-3 px-4">
                          <input
                            type="date"
                            value={student.dueDate || ""}
                            onChange={async (e) => {
                              const newDueDate = e.target.value || null;
                              try {
                                const response = await apiFetch(`/api/students/${student.id}`, {
                                  method: "PUT",
                                  body: JSON.stringify({ dueDate: newDueDate }),
                                });
                                if (response.ok) {
                                  setStudents(prev => prev.map(s => 
                                    s.id === student.id ? { ...s, dueDate: newDueDate || undefined } : s
                                  ));
                                }
                              } catch (error) {
                                console.error("Error updating due date", error);
                              }
                            }}
                            className="px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <textarea
                            value={localRemarks[student.id] ?? student.remarks ?? ""}
                            onChange={(e) => {
                              const newRemarks = e.target.value;
                              setLocalRemarks(prev => ({ ...prev, [student.id]: newRemarks }));
                              updateStudentRemarks(student.id, newRemarks);
                            }}
                            placeholder="Add remarks..."
                            className="w-full px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 min-h-[40px] resize-none"
                          />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openManageModal(student)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1"
                            >
                              Collect Fee
                            </button>
                            <button
                              onClick={() => void downloadReceipt(student.id)}
                              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 rounded-xl transition-all border border-zinc-700"
                              title="Download Receipt"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-950/60">
              <p className="text-xs text-zinc-400">
                Showing {indexOfFirstStudent + 1} to {Math.min(indexOfLastStudent, filteredStudents.length)} of {filteredStudents.length} students
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-zinc-800 rounded-xl bg-zinc-900 text-zinc-300 hover:bg-zinc-800 transition-all disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={cn(
                      "w-8 h-8 rounded-xl text-xs font-bold transition-all",
                      currentPage === page
                        ? "bg-emerald-600 text-white"
                        : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                    )}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-zinc-800 rounded-xl bg-zinc-900 text-zinc-300 hover:bg-zinc-800 transition-all disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Manage Fee Modal */}
        {isManageModalOpen && selectedStudent && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-2xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
              <div className="p-6 border-b border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white uppercase tracking-tight">Collect Fee Payment</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Candidate: <strong className="text-emerald-400">{selectedStudent.fullName || selectedStudent.username}</strong></p>
                </div>
                <button
                  onClick={() => setIsManageModalOpen(false)}
                  className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-all"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Fee Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Course Fee</p>
                    <p className="text-xl font-bold text-white mt-0.5">{formatFee(selectedStudent.totalFee ?? 0)}</p>
                  </div>
                  <div className="bg-emerald-500/10 p-3.5 rounded-xl border border-emerald-500/20">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Amount Paid</p>
                    <p className="text-xl font-bold text-emerald-300 mt-0.5">{formatFee(selectedStudent.paidAmount ?? 0)}</p>
                  </div>
                  <div className="bg-amber-500/10 p-3.5 rounded-xl border border-amber-500/20">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Remaining Balance</p>
                    <p className="text-xl font-bold text-amber-300 mt-0.5">{formatFee(selectedStudent.balanceDue ?? 0)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Payment Type</label>
                    <select
                      value={paymentType}
                      onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="one_time">One Time Payment</option>
                      <option value="installment">Installment Payment</option>
                      <option value="late_fee">Late Fine Fee</option>
                      <option value="other">Other Charge</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Payment Label</label>
                    <input
                      type="text"
                      value={paymentName}
                      onChange={(e) => setPaymentName(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Amount to Collect (₹)</label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                        placeholder="Enter collection amount"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Payment Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Payment Mode</label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="cash">Cash Payment</option>
                      <option value="upi">UPI / Online App</option>
                      <option value="card">Credit / Debit Card</option>
                      <option value="bank_transfer">Bank Transfer / NEFT</option>
                      <option value="cheque">Demand Draft / Cheque</option>
                    </select>
                  </div>

                  {paymentMode !== "cash" && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-300">Transaction Ref No *</label>
                      <input
                        type="text"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                        placeholder="e.g. UTR / Transaction ID"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5 border-t border-zinc-800 bg-zinc-950/60 flex justify-end gap-3">
                <button
                  onClick={() => setIsManageModalOpen(false)}
                  className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMakePayment}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg"
                >
                  Collect Fee Payment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
        {isConfirmDialogOpen && selectedStudent && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
            <div className="bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-tight">Confirm Fee Collection</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Collect <strong className="text-emerald-400">₹{parseFloat(amount).toLocaleString()}</strong> for candidate <strong className="text-white">{selectedStudent.fullName || selectedStudent.username}</strong>?
                </p>
              </div>
              <div className="flex gap-3 justify-center pt-2">
                <button
                  onClick={() => setIsConfirmDialogOpen(false)}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAndSubmitPayment}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? "Processing..." : "Confirm Collection"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

export default StudentFeesPage;
