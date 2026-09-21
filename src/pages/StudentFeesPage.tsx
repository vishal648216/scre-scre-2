import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { IndianRupee, Search, Download, Loader2, Calendar, FileText, User, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

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
      const [studentRes, feeRes] = await Promise.all([
        apiFetch("/api/students"),
        apiFetch("/api/fees")
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
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Student Fee Management</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Manage fee collections and track student payments efficiently.</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            placeholder="Search by Student Name, Father Name, Enrollment No, Registration No, Course..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-card border border-border rounded-xl shadow-sm text-sm font-medium focus:border-primary outline-none transition-all"
          />
        </div>

        {/* Student Table */}
        <Card className="rounded-xl border-border shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr className="border-b border-border">
                    <th className="text-left py-4 px-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">S.No</th>
                    <th className="text-left py-4 px-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Student Name</th>
                    <th className="text-left py-4 px-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Father Name</th>
                    <th className="text-left py-4 px-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Enrollment No</th>
                    <th className="text-left py-4 px-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Contact No</th>
                    <th className="text-left py-4 px-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Course</th>
                    <th className="text-left py-4 px-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Total Fee</th>
                    <th className="text-left py-4 px-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Paid Amount</th>
                    <th className="text-left py-4 px-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Balance Due</th>
                    <th className="text-left py-4 px-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Due Date</th>
                    <th className="text-left py-4 px-6 text-xs font-bold uppercase tracking-widest text-muted-foreground" >Remarks</th>
                    <th className="text-left py-4 px-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {currentStudents.map((student, index) => {
                    const studentFees = getStudentFees(student.id);
                    return (
                      <tr
                        key={student.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-4 px-6 text-sm font-medium">
                          {indexOfFirstStudent + index + 1}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground">
                                {student.fullName || student.username}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {student.registrationNumber}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-sm text-muted-foreground">
                          {student.fatherName || "-"}
                        </td>
                        <td className="py-4 px-6 text-sm text-muted-foreground">
                          {student.enrollmentNumber || "-"}
                        </td>
                        <td className="py-4 px-6 text-sm text-muted-foreground">
                          {student.phone || "-"}
                        </td>
                        <td className="py-4 px-6 text-sm text-muted-foreground">
                          {student.course || "-"}
                        </td>
                        <td className="py-4 px-6 text-sm font-bold text-foreground">
                          ₹{(student.totalFee ?? 0).toLocaleString()}
                        </td>
                        <td className="py-4 px-6 text-sm font-bold text-emerald-600">
                          ₹{(student.paidAmount ?? 0).toLocaleString()}
                        </td>
                        <td className="py-4 px-6 text-sm font-bold text-orange-600">
                          ₹{(student.balanceDue ?? 0).toLocaleString()}
                        </td>
                        <td className="py-4 px-6 text-sm text-muted-foreground">
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
                                    // Update local state
                                    setStudents(prev => prev.map(s => 
                                      s.id === student.id ? { ...s, dueDate: newDueDate || undefined } : s
                                    ));
                                }
                            } catch (error) {
                                console.error("Error updating due date", error);
                            }
                        }}
                        className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm focus:border-primary outline-none"
                      />
                    </td>
                    <td className="py-4 px-6 text-sm text-muted-foreground" >
                      <textarea
                        value={localRemarks[student.id] ?? student.remarks ?? ""}
                        onChange={(e) => {
                          const newRemarks = e.target.value;
                          // Update local state immediately
                          setLocalRemarks(prev => ({
                            ...prev,
                            [student.id]: newRemarks
                          }));
                          // Debounce the API call
                          updateStudentRemarks(student.id, newRemarks);
                        }}
                        placeholder="Add remarks..."
                        className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm focus:border-primary outline-none min-h-[50px] resize-vertical"
                      />
                    </td>
                    <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openManageModal(student)}
                              className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all flex items-center gap-2"
                            >
                              Manage
                            </button>
                            <button
                              onClick={() => void downloadReceipt(student.id)}
                              className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all"
                              title="Download Fee Receipt"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
                <p className="text-sm text-muted-foreground">
                  Showing {indexOfFirstStudent + 1} to {Math.min(indexOfLastStudent, filteredStudents.length)} of {filteredStudents.length} students
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-border rounded-lg hover:bg-muted transition-all disabled:opacity-50"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        "w-10 h-10 rounded-lg text-sm font-bold transition-all",
                        currentPage === page
                          ? "bg-primary text-white"
                          : "bg-card border border-border hover:bg-muted"
                      )}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-border rounded-lg hover:bg-muted transition-all disabled:opacity-50"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manage Modal */}
        {isManageModalOpen && selectedStudent && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Manage Fee</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedStudent.fullName || selectedStudent.username}
                  </p>
                </div>
                <button
                  onClick={() => setIsManageModalOpen(false)}
                  className="p-2 hover:bg-muted rounded-lg transition-all"
                >
                  <XCircle className="w-6 h-6 text-muted-foreground" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                {/* Fee Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-primary/5 p-4 rounded-xl border border-primary/20">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Fee</p>
                    <p className="text-2xl font-black text-primary">₹{(selectedStudent.totalFee ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/30">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Paid Amount</p>
                    <p className="text-2xl font-black text-emerald-600">₹{(selectedStudent.paidAmount ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 dark:border-orange-900/30">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Balance Due</p>
                    <p className="text-2xl font-black text-orange-600">₹{(selectedStudent.balanceDue ?? 0).toLocaleString()}</p>
                  </div>
                </div>

                {/* Payment Type */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Type</label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                    className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm font-bold focus:border-primary outline-none"
                  >
                    <option value="one_time">One Time</option>
                    <option value="installment">Installment</option>
                    <option value="late_fee">Late Fee</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Payment Name */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Name</label>
                  <input
                    type="text"
                    value={paymentName}
                    onChange={(e) => setPaymentName(e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm font-bold focus:border-primary outline-none"
                  />
                </div>

                {/* Amount */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border border-border rounded-xl bg-background text-sm font-bold focus:border-primary outline-none"
                      placeholder="Enter amount"
                    />
                  </div>
                </div>

                {/* Payment Date */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border border-border rounded-xl bg-background text-sm font-bold focus:border-primary outline-none"
                    />
                  </div>
                </div>

                {/* Payment Mode */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                    className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm font-bold focus:border-primary outline-none"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                {/* Reference Number */}
                {paymentMode !== "cash" && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Reference Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <input
                        type="text"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 border border-border rounded-xl bg-background text-sm font-bold focus:border-primary outline-none"
                        placeholder="Enter reference number"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-border flex justify-end gap-3">
                <button
                  onClick={() => setIsManageModalOpen(false)}
                  className="px-6 py-3 border border-border rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-muted transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMakePayment}
                  className="px-6 py-3 bg-primary text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all"
                >
                  Make Payment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
        {isConfirmDialogOpen && selectedStudent && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="text-xl font-black text-foreground uppercase tracking-tight mb-2">Confirm Payment</h3>
                <p className="text-muted-foreground mb-4">
                    Are you sure you want to collect <span className="font-bold text-emerald-600">₹{parseFloat(amount).toLocaleString()}</span> from {selectedStudent.fullName || selectedStudent.username}?
                  </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setIsConfirmDialogOpen(false)}
                    disabled={isSubmitting}
                    className="px-6 py-3 border border-border rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-muted transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmAndSubmitPayment}
                    disabled={isSubmitting}
                    className="px-6 py-3 bg-primary text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all disabled:opacity-70 flex items-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {isSubmitting ? "Processing..." : "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentFeesPage;
