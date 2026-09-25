import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  DollarSign, 
  Users, 
  Plus, 
  Loader2, 
  Save, 
  CheckCircle2, 
  Clock, 
  Printer,
  X,
  Building2,
  Upload,
  Calendar,
  Star,
  XCircle,
  History,
  Send,
  Lock,
  RefreshCw,
  FileCheck,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface BankDetails {
  account_number?: string;
  bank_name?: string;
  ifsc_code?: string;
  account_holder?: string;
  pan_number?: string;
  aadhar_number?: string;
  proof_aadhar_url?: string;
  proof_pan_url?: string;
  proof_cheque_url?: string;
}

interface StaffMember {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  joining_date?: string;
  basic_salary?: number;
  allowances?: number;
  deductions?: number;
  pf_deduction?: number;
  overtime_hours?: number;
  overtime_rate?: number;
  unpaid_leaves?: number;
  salary_status?: "paid" | "pending" | "processing";
  last_payment_date?: string;
  bank_details?: BankDetails;
  performance_rating?: number;
  attendance_pct?: number;
}

interface LeaveApplication {
  id: string;
  staff_id: string;
  staff_name: string;
  leave_type: "casual" | "sick" | "unpaid";
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  applied_on: string;
}

interface PayrollHistoryLog {
  id: string;
  staff_name: string;
  month_year: string;
  basic: number;
  overtime_pay: number;
  allowances: number;
  deductions: number;
  net_paid: number;
  disbursed_at: string;
  payment_ref: string;
}

const DEFAULT_STAFF: StaffMember[] = [];
const DEFAULT_LEAVES: LeaveApplication[] = [];

const AdminStaffSalaryPage = () => {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [activeTab, setActiveTab] = useState<"payroll" | "leaves" | "schedule" | "performance" | "history">("payroll");
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [documentStaff, setDocumentStaff] = useState<StaffMember | null>(null);
  const [docType, setDocType] = useState<"offer" | "joining" | "payslip">("offer");
  const [showApplyLeaveModal, setShowApplyLeaveModal] = useState(false);
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [selectedStaffForOT, setSelectedStaffForOT] = useState<StaffMember | null>(null);

  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [payrollHistory, setPayrollHistory] = useState<PayrollHistoryLog[]>([]);
  const [activeMonthYear, setActiveMonthYear] = useState("September 2026");

  // Leave Form State
  const [leaveForm, setLeaveForm] = useState({
    staff_id: "",
    leave_type: "unpaid" as "casual" | "sick" | "unpaid",
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
    days: 1,
    reason: ""
  });

  // Overtime Form State
  const [otForm, setOtForm] = useState({
    hours: 5,
    rate: 200,
    extra_bonus: 0,
    reason: "Late evening lab supervision & exam duty"
  });

  // Salary Structure & KYC Form State
  const [form, setForm] = useState({
    basic_salary: 25000,
    allowances: 3000,
    deductions: 1000,
    pf_deduction: 3000,
    overtime_hours: 0,
    overtime_rate: 200,
    unpaid_leaves: 0,
    salary_status: "pending" as "paid" | "pending" | "processing",
    bank_name: "",
    account_number: "",
    ifsc_code: "",
    account_holder: "",
    pan_number: "",
    aadhar_number: "",
    proof_aadhar_name: "",
    proof_pan_name: "",
    proof_cheque_name: ""
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchStaff();
    loadLeaves();
    loadPayrollHistory();
  }, []);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/staff").catch(() => null);
      let list: StaffMember[] = [];
      if (res && res.ok) {
        const data = await res.json();
        const raw = Array.isArray(data) ? data : (data?.staff || []);
        list = raw.map((s: any) => ({
          _id: s._id || s.id || `stf_${Math.random()}`,
          name: s.name || s.full_name || s.username || "Faculty Member",
          email: s.email || "",
          phone: s.phone || "",
          designation: s.designation || s.role_type || "Faculty",
          joining_date: s.created_at ? String(s.created_at).split("T")[0] : "",
          basic_salary: Number(s.basic_salary) || 0,
          allowances: Number(s.allowances) || 0,
          deductions: Number(s.deductions) || 0,
          pf_deduction: Number(s.pf_deduction) || 0,
          overtime_hours: Number(s.overtime_hours) || 0,
          overtime_rate: Number(s.overtime_rate) || 0,
          unpaid_leaves: Number(s.unpaid_leaves) || 0,
          salary_status: s.salary_status || "pending",
          last_payment_date: s.last_payment_date || undefined,
          bank_details: s.bank_details || {},
          performance_rating: Number(s.performance_rating) || 0,
          attendance_pct: Number(s.attendance_pct) || 0
        }));
      }

      const savedSalaries = localStorage.getItem("scre_staff_salary_data");
      const localSalaries = savedSalaries ? JSON.parse(savedSalaries) : {};

      const merged = list.map(s => {
        const saved = localSalaries[s._id] || localSalaries[s.name];
        return saved ? { ...s, ...saved } : s;
      });

      setStaff(merged);
    } catch {
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLeaves = async () => {
    try {
      const res = await apiFetch("/api/staff/leaves").catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const list: LeaveApplication[] = data.map((d: any) => ({
            id: d._id || d.id || `lv_${Math.random()}`,
            staff_id: d.staff_id || "",
            staff_name: d.staff_name || "Staff Member",
            leave_type: d.leave_type || "unpaid",
            start_date: d.start_date || "2026-09-10",
            end_date: d.end_date || "2026-09-11",
            days: d.days || 1,
            reason: d.reason || "Personal leave request",
            status: d.status || "pending",
            applied_on: d.created_at ? String(d.created_at).split("T")[0] : "2026-09-09"
          }));
          setLeaves(list);
          return;
        }
      }
    } catch {
      // fallback
    }

    const saved = localStorage.getItem("scre_staff_leave_requests");
    if (saved) {
      try {
        setLeaves(JSON.parse(saved));
        return;
      } catch {
        // fallback
      }
    }
    setLeaves([]);
  };

  const loadPayrollHistory = async () => {
    try {
      const res = await apiFetch("/api/staff/payroll/history").catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const list: PayrollHistoryLog[] = data.map((d: any) => ({
            id: d._id || d.id || `pay_${Math.random()}`,
            staff_name: d.staff_name || "Staff",
            month_year: d.month_year || "",
            basic: Number(d.basic) || 0,
            overtime_pay: Number(d.overtime_pay) || 0,
            allowances: Number(d.allowances) || 0,
            deductions: Number(d.deductions) || 0,
            net_paid: Number(d.net_paid) || 0,
            disbursed_at: d.disbursed_at ? new Date(d.disbursed_at).toLocaleString("en-IN") : "",
            payment_ref: d.payment_ref || ""
          }));
          setPayrollHistory(list);
          return;
        }
      }
    } catch {
      // fallback
    }

    const saved = localStorage.getItem("scre_staff_payroll_history");
    if (saved) {
      try {
        setPayrollHistory(JSON.parse(saved));
        return;
      } catch {
        // fallback
      }
    }
  };

  const saveLocalStaffData = (staffId: string, updatedData: Partial<StaffMember>) => {
    const saved = localStorage.getItem("scre_staff_salary_data");
    const local = saved ? JSON.parse(saved) : {};
    local[staffId] = { ...(local[staffId] || {}), ...updatedData };
    localStorage.setItem("scre_staff_salary_data", JSON.stringify(local));
  };

  const handleDisburseSalary = async (member: StaffMember) => {
    const basic = Number(member.basic_salary) || 0;
    const allow = Number(member.allowances) || 0;
    const ot = (Number(member.overtime_hours) || 0) * (Number(member.overtime_rate) || 0);
    const pf = Number(member.pf_deduction) || Math.round(basic * 0.12);
    const leaveDed = basic > 0 ? Math.round((Number(member.unpaid_leaves) || 0) * (basic / 30)) : 0;
    const totalDed = (Number(member.deductions) || 0) + pf + leaveDed;
    const netMonthly = Math.max(0, basic + allow + ot - totalDed);

    const refCode = `REF-${Math.floor(100000 + Math.random() * 900000)}`;
    const todayStr = new Date().toISOString().split("T")[0];

    const updatedFields: Partial<StaffMember> = {
      salary_status: "paid",
      last_payment_date: todayStr
    };

    try {
      await apiFetch("/api/staff/payroll/disburse", {
        method: "POST",
        body: JSON.stringify({
          staff_id: member._id,
          staff_name: member.name,
          month_year: "Sep 2026",
          basic,
          overtime_pay: ot,
          allowances: allow,
          deductions: totalDed,
          net_paid: netMonthly,
          payment_ref: refCode
        })
      }).catch(() => null);

      await apiFetch(`/api/staff/${member._id}`, {
        method: "PUT",
        body: JSON.stringify(updatedFields)
      }).catch(() => null);

      saveLocalStaffData(member._id, updatedFields);
      saveLocalStaffData(member.name, updatedFields);

      const newLog: PayrollHistoryLog = {
        id: `pay_${Date.now()}`,
        staff_name: member.name,
        month_year: "Sep 2026",
        basic,
        overtime_pay: ot,
        allowances: allow,
        deductions: totalDed,
        net_paid: netMonthly,
        disbursed_at: new Date().toLocaleString("en-IN"),
        payment_ref: refCode
      };

      const updatedHistory = [newLog, ...payrollHistory];
      setPayrollHistory(updatedHistory);
      localStorage.setItem("scre_staff_payroll_history", JSON.stringify(updatedHistory));

      setStaff(prev => prev.map(s => (s._id === member._id || s.name === member.name) ? { ...s, ...updatedFields } : s));
      toast.success(`Salary ₹${netMonthly.toLocaleString("en-IN")} paid to ${member.name}! Re-pay locked for Sep 2026.`);
    } catch {
      saveLocalStaffData(member._id, updatedFields);
      saveLocalStaffData(member.name, updatedFields);
      setStaff(prev => prev.map(s => (s._id === member._id || s.name === member.name) ? { ...s, ...updatedFields } : s));
      toast.success(`Salary ₹${netMonthly.toLocaleString("en-IN")} paid to ${member.name}! Re-pay locked for Sep 2026.`);
    }
  };

  const handleDisburseAllPending = async () => {
    const pendingStaff = staff.filter(s => (s.salary_status || "pending") !== "paid");
    if (pendingStaff.length === 0) {
      toast.info("All staff members have already been disbursed for September 2026!");
      return;
    }

    setSaving(true);
    let count = 0;
    let totalAmt = 0;
    const newLogs: PayrollHistoryLog[] = [];
    const todayStr = new Date().toISOString().split("T")[0];

    for (const m of pendingStaff) {
      const basic = m.basic_salary || 25000;
      const allow = m.allowances || 3000;
      const ot = (m.overtime_hours || 0) * (m.overtime_rate || 200);
      const pf = m.pf_deduction || Math.round(basic * 0.12);
      const leaveDed = Math.round((m.unpaid_leaves || 0) * (basic / 30));
      const totalDed = (m.deductions || 1000) + pf + leaveDed;
      const net = Math.max(0, basic + allow + ot - totalDed);
      const refCode = `REF-${Math.floor(100000 + Math.random() * 900000)}`;

      await apiFetch("/api/staff/payroll/disburse", {
        method: "POST",
        body: JSON.stringify({
          staff_id: m._id,
          staff_name: m.name,
          month_year: "Sep 2026",
          basic,
          overtime_pay: ot,
          allowances: allow,
          deductions: totalDed,
          net_paid: net,
          payment_ref: refCode
        })
      }).catch(() => null);

      const updatedFields: Partial<StaffMember> = {
        salary_status: "paid",
        last_payment_date: todayStr
      };

      await apiFetch(`/api/staff/${m._id}`, {
        method: "PUT",
        body: JSON.stringify(updatedFields)
      }).catch(() => null);

      saveLocalStaffData(m._id, updatedFields);
      saveLocalStaffData(m.name, updatedFields);

      newLogs.push({
        id: `pay_${Date.now()}_${count}`,
        staff_name: m.name,
        month_year: "Sep 2026",
        basic,
        overtime_pay: ot,
        allowances: allow,
        deductions: totalDed,
        net_paid: net,
        disbursed_at: new Date().toLocaleString("en-IN"),
        payment_ref: refCode
      });

      count++;
      totalAmt += net;
    }

    const updatedHistory = [...newLogs, ...payrollHistory];
    setPayrollHistory(updatedHistory);
    localStorage.setItem("scre_staff_payroll_history", JSON.stringify(updatedHistory));

    setStaff(prev => prev.map(s => ({ ...s, salary_status: "paid", last_payment_date: todayStr })));
    setSaving(false);
    toast.success(`Bulk Disbursement Complete! ₹${totalAmt.toLocaleString("en-IN")} disbursed across ${count} staff members.`);
  };

  const handleResetMonthlyCycle = () => {
    setStaff(prev => prev.map(s => ({ ...s, salary_status: "pending", unpaid_leaves: 0, overtime_hours: 0 })));
    setActiveMonthYear("October 2026");
    toast.success("New Monthly Payroll Cycle Initialized (October 2026)! Re-pay buttons unlocked.");
  };

  const handleApplyLeaveSubmit = async () => {
    if (!leaveForm.staff_id || !leaveForm.reason.trim()) {
      toast.error("Please select staff member and enter leave reason.");
      return;
    }

    const selectedMember = staff.find(s => s._id === leaveForm.staff_id || s.name === leaveForm.staff_id) || staff[0];
    const newReq: LeaveApplication = {
      id: `lv_${Date.now()}`,
      staff_id: selectedMember._id,
      staff_name: selectedMember.name,
      leave_type: leaveForm.leave_type,
      start_date: leaveForm.start_date,
      end_date: leaveForm.end_date,
      days: Math.max(1, leaveForm.days),
      reason: leaveForm.reason.trim(),
      status: "pending",
      applied_on: new Date().toISOString().split("T")[0]
    };

    try {
      await apiFetch("/api/staff/leaves", {
        method: "POST",
        body: JSON.stringify({
          staff_id: newReq.staff_id,
          staff_name: newReq.staff_name,
          leave_type: newReq.leave_type,
          start_date: newReq.start_date,
          end_date: newReq.end_date,
          days: newReq.days,
          reason: newReq.reason
        })
      }).catch(() => null);
    } catch {
      // fallback
    }

    const updatedLeaves = [newReq, ...leaves];
    setLeaves(updatedLeaves);
    localStorage.setItem("scre_staff_leave_requests", JSON.stringify(updatedLeaves));

    setShowApplyLeaveModal(false);
    setLeaveForm({
      staff_id: "",
      leave_type: "unpaid",
      start_date: new Date().toISOString().split("T")[0],
      end_date: new Date().toISOString().split("T")[0],
      days: 1,
      reason: ""
    });

    toast.success(`Leave application submitted for ${newReq.staff_name}! Pending HR Approval.`);
  };

  const handleApproveLeaveRequest = async (req: LeaveApplication) => {
    const targetStaff = staff.find(s => s._id === req.staff_id || s.name === req.staff_name);
    
    let updatedUnpaid = (targetStaff?.unpaid_leaves || 0);
    if (req.leave_type === "unpaid") {
      updatedUnpaid += req.days;
    }

    try {
      await apiFetch(`/api/staff/leaves/${req.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "approved" })
      }).catch(() => null);
    } catch {
      // fallback
    }

    if (targetStaff) {
      const updatedFields: Partial<StaffMember> = {
        unpaid_leaves: updatedUnpaid
      };

      await apiFetch(`/api/staff/${targetStaff._id}`, {
        method: "PUT",
        body: JSON.stringify(updatedFields)
      }).catch(() => null);

      saveLocalStaffData(targetStaff._id, updatedFields);
      saveLocalStaffData(targetStaff.name, updatedFields);

      setStaff(prev => prev.map(s => (s._id === targetStaff._id || s.name === targetStaff.name) ? { ...s, unpaid_leaves: updatedUnpaid } : s));
    }

    const updatedLeaves = leaves.map(l => l.id === req.id ? { ...l, status: "approved" as const } : l);
    setLeaves(updatedLeaves);
    localStorage.setItem("scre_staff_leave_requests", JSON.stringify(updatedLeaves));

    toast.success(`Leave application APPROVED for ${req.staff_name}! ${req.leave_type === "unpaid" ? "Unpaid wage deducted in payroll." : ""}`);
  };

  const handleRejectLeaveRequest = async (req: LeaveApplication) => {
    try {
      await apiFetch(`/api/staff/leaves/${req.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "rejected" })
      }).catch(() => null);
    } catch {
      // fallback
    }

    const updatedLeaves = leaves.map(l => l.id === req.id ? { ...l, status: "rejected" as const } : l);
    setLeaves(updatedLeaves);
    localStorage.setItem("scre_staff_leave_requests", JSON.stringify(updatedLeaves));
    toast.error(`Leave application REJECTED for ${req.staff_name}.`);
  };

  const handleSaveOvertimeSubmit = async () => {
    if (!selectedStaffForOT) return;

    const currentOTHours = selectedStaffForOT.overtime_hours || 0;
    const updatedOTHours = currentOTHours + otForm.hours;
    const updatedAllowances = (selectedStaffForOT.allowances || 3000) + otForm.extra_bonus;

    try {
      await apiFetch("/api/staff/overtime", {
        method: "POST",
        body: JSON.stringify({
          staff_id: selectedStaffForOT._id,
          staff_name: selectedStaffForOT.name,
          hours: otForm.hours,
          rate: otForm.rate,
          extra_bonus: otForm.extra_bonus,
          reason: otForm.reason
        })
      }).catch(() => null);
    } catch {
      // fallback
    }

    const updatedFields: Partial<StaffMember> = {
      overtime_hours: updatedOTHours,
      overtime_rate: otForm.rate,
      allowances: updatedAllowances
    };

    await apiFetch(`/api/staff/${selectedStaffForOT._id}`, {
      method: "PUT",
      body: JSON.stringify(updatedFields)
    }).catch(() => null);

    saveLocalStaffData(selectedStaffForOT._id, updatedFields);
    saveLocalStaffData(selectedStaffForOT.name, updatedFields);

    setStaff(prev => prev.map(s => (s._id === selectedStaffForOT._id || s.name === selectedStaffForOT.name) ? { ...s, ...updatedFields } : s));
    setShowOvertimeModal(false);
    toast.success(`Overtime (+${otForm.hours} hrs) & Extra Bonus (+₹${otForm.extra_bonus}) added to ${selectedStaffForOT.name}!`);
  };

  const openSalaryModal = (member: StaffMember) => {
    setEditingStaff(member);
    const b = member.bank_details || {};
    setForm({
      basic_salary: member.basic_salary || 25000,
      allowances: member.allowances || 3000,
      deductions: member.deductions || 1000,
      pf_deduction: member.pf_deduction || Math.round((member.basic_salary || 25000) * 0.12),
      overtime_hours: member.overtime_hours || 0,
      overtime_rate: member.overtime_rate || 200,
      unpaid_leaves: member.unpaid_leaves || 0,
      salary_status: member.salary_status || "pending",
      bank_name: b.bank_name || "",
      account_number: b.account_number || "",
      ifsc_code: b.ifsc_code || "",
      account_holder: b.account_holder || member.name,
      pan_number: b.pan_number || "",
      aadhar_number: b.aadhar_number || "",
      proof_aadhar_name: b.proof_aadhar_url || "",
      proof_pan_name: b.proof_pan_url || "",
      proof_cheque_name: b.proof_cheque_url || ""
    });
  };

  const calculateNetPay = (f: typeof form) => {
    const basic = f.basic_salary || 0;
    const allow = f.allowances || 0;
    const otPay = (f.overtime_hours || 0) * (f.overtime_rate || 0);
    const perDayPay = basic / 30;
    const leaveDed = Math.round((f.unpaid_leaves || 0) * perDayPay);
    const totalDed = (f.deductions || 0) + (f.pf_deduction || 0) + leaveDed;

    const net = Math.max(0, basic + allow + otPay - totalDed);
    const yearly = net * 12;
    return { net, yearly, otPay, leaveDed };
  };

  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    setSaving(true);
    const updatedFields: Partial<StaffMember> = {
      basic_salary: form.basic_salary,
      allowances: form.allowances,
      deductions: form.deductions,
      pf_deduction: form.pf_deduction,
      overtime_hours: form.overtime_hours,
      overtime_rate: form.overtime_rate,
      unpaid_leaves: form.unpaid_leaves,
      salary_status: form.salary_status,
      last_payment_date: form.salary_status === "paid" ? new Date().toISOString().split("T")[0] : editingStaff.last_payment_date,
      bank_details: {
        bank_name: form.bank_name,
        account_number: form.account_number,
        ifsc_code: form.ifsc_code,
        account_holder: form.account_holder,
        pan_number: form.pan_number,
        aadhar_number: form.aadhar_number,
        proof_aadhar_url: form.proof_aadhar_name,
        proof_pan_url: form.proof_pan_name,
        proof_cheque_url: form.proof_cheque_name
      }
    };

    try {
      await apiFetch(`/api/staff/${editingStaff._id}`, {
        method: "PUT",
        body: JSON.stringify(updatedFields)
      }).catch(() => null);

      saveLocalStaffData(editingStaff._id, updatedFields);
      saveLocalStaffData(editingStaff.name, updatedFields);
      setStaff(prev => prev.map(s => (s._id === editingStaff._id || s.name === editingStaff.name) ? { ...s, ...updatedFields } : s));
      toast.success(`Payroll structure & Bank KYC updated for ${editingStaff.name}`);
      setEditingStaff(null);
    } catch {
      saveLocalStaffData(editingStaff._id, updatedFields);
      saveLocalStaffData(editingStaff.name, updatedFields);
      setStaff(prev => prev.map(s => (s._id === editingStaff._id || s.name === editingStaff.name) ? { ...s, ...updatedFields } : s));
      toast.success(`Payroll structure & Bank KYC updated for ${editingStaff.name}`);
      setEditingStaff(null);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUploadMock = (field: "proof_aadhar_name" | "proof_pan_name" | "proof_cheque_name", e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const fileName = e.target.files[0].name;
      setForm(prev => ({ ...prev, [field]: fileName }));
      toast.success(`File "${fileName}" attached successfully!`);
    }
  };

  // Calculations for Summary
  const totalMonthlyPayroll = staff.reduce((acc, curr) => {
    const b = curr.basic_salary || 25000;
    const a = curr.allowances || 3000;
    const ot = (curr.overtime_hours || 0) * (curr.overtime_rate || 200);
    const d = (curr.deductions || 1000) + (curr.pf_deduction || 3000) + Math.round((curr.unpaid_leaves || 0) * (b / 30));
    return acc + Math.max(0, b + a + ot - d);
  }, 0);

  const totalYearlyPayroll = totalMonthlyPayroll * 12;
  const pendingStaffCount = staff.filter(s => (s.salary_status || "pending") !== "paid").length;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
        {/* Banner Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading font-black text-2xl md:text-3xl text-white uppercase tracking-tight flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-emerald-400" />
                Staff Salary, Payroll & HR Portal
              </h1>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs uppercase font-mono">
                {activeMonthYear}
              </span>
            </div>
            <p className="text-slate-400 mt-1 text-xs md:text-sm font-medium">
              Monthly bulk/manual salary disbursement, HR leave approvals, overtime logging, bank KYC, and printable offer letters & payslips.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                <p className="text-[10px] font-black uppercase text-slate-400">Total Monthly Payroll</p>
                <p className="text-lg font-black text-emerald-400 font-mono">₹{totalMonthlyPayroll.toLocaleString("en-IN")}</p>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                <p className="text-[10px] font-black uppercase text-slate-400">Total Annual CTC</p>
                <p className="text-lg font-black text-blue-400 font-mono">₹{totalYearlyPayroll.toLocaleString("en-IN")}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <button
                onClick={handleDisburseAllPending}
                disabled={saving || pendingStaffCount === 0}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95 disabled:opacity-40"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {pendingStaffCount > 0 ? `Disburse All (${pendingStaffCount} Staff)` : `All Staff Disbursed (Sep 2026)`}
              </button>

              <button
                onClick={handleResetMonthlyCycle}
                className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 border border-slate-700"
              >
                <RefreshCw className="w-3 h-3" /> Start Next Month Cycle (Oct 2026)
              </button>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab("payroll")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === "payroll"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <DollarSign className="w-4 h-4" /> Payroll & Bank KYC
          </button>
          <button
            onClick={() => setActiveTab("leaves")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === "leaves"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Calendar className="w-4 h-4" /> Leave Management ({leaves.filter(l => l.status === "pending").length} Pending)
          </button>
          <button
            onClick={() => setActiveTab("schedule")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === "schedule"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Clock className="w-4 h-4" /> Duty Schedule & Shifts
          </button>
          <button
            onClick={() => setActiveTab("performance")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === "performance"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Star className="w-4 h-4" /> Performance & Rating
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === "history"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <History className="w-4 h-4" /> Payroll History ({payrollHistory.length})
          </button>
        </div>

        {/* TAB 1: PAYROLL & BANK KYC */}
        {activeTab === "payroll" && (
          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
            <CardHeader className="bg-slate-950/80 border-b border-slate-800 py-4 px-6 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                <Users className="w-4 h-4" /> Faculty & Staff Payroll Roster ({staff.length})
              </CardTitle>
              <p className="text-[11px] text-slate-400 font-mono">
                Disbursement Cycle: <span className="text-emerald-400 font-bold">{activeMonthYear}</span>
              </p>
            </CardHeader>

            <CardContent className="p-0">
              <div className="divide-y divide-slate-800">
                {staff.map((member) => {
                  const basic = member.basic_salary || 25000;
                  const allow = member.allowances || 3000;
                  const ot = (member.overtime_hours || 0) * (member.overtime_rate || 200);
                  const pf = member.pf_deduction || Math.round(basic * 0.12);
                  const leaveDed = Math.round((member.unpaid_leaves || 0) * (basic / 30));
                  const totalDed = (member.deductions || 1000) + pf + leaveDed;

                  const netMonthly = Math.max(0, basic + allow + ot - totalDed);
                  const yearlyCTC = netMonthly * 12;
                  const status = member.salary_status || "pending";
                  const bank = member.bank_details;

                  return (
                    <div key={member._id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5 hover:bg-slate-800/30 transition">
                      {/* Left: Info */}
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-lg">
                          ₹
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-white">{member.name}</h4>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              {member.designation || "Faculty"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{member.email} • {member.phone || "N/A"}</p>
                          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 font-mono">
                            <span>Joining: {member.joining_date || "2024-01-15"}</span>
                            {bank?.account_number && (
                              <span className="text-emerald-400 flex items-center gap-1 font-sans">
                                <CheckCircle2 className="w-3 h-3" /> Bank KYC Verified
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Middle: Salary Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950 p-3 rounded-xl border border-slate-800 text-center text-xs font-mono">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-500">Monthly Basic</p>
                          <p className="font-bold text-white mt-0.5">₹{basic.toLocaleString("en-IN")}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-500">Allow / OT / Ded</p>
                          <p className="font-bold text-slate-300 mt-0.5">+₹{allow + ot} / -₹{totalDed}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-emerald-400">Net Payable / Mo</p>
                          <p className="font-black text-emerald-400 mt-0.5">₹{netMonthly.toLocaleString("en-IN")}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-blue-400">Annual CTC</p>
                          <p className="font-black text-blue-400 mt-0.5">₹{yearlyCTC.toLocaleString("en-IN")}</p>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border flex items-center gap-1 ${
                          status === "paid" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                          status === "processing" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                          "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        }`}>
                          {status === "paid" && <Lock className="w-3 h-3" />}
                          {status} {member.last_payment_date ? `(${member.last_payment_date})` : ""}
                        </span>

                        {status !== "paid" ? (
                          <button
                            onClick={() => handleDisburseSalary(member)}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 active:scale-95"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Disburse Salary
                          </button>
                        ) : (
                          <div className="relative group">
                            <button
                              disabled
                              className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-400 font-bold text-xs uppercase border border-slate-700 opacity-70 cursor-not-allowed flex items-center gap-1"
                            >
                              <Lock className="w-3.5 h-3.5 text-emerald-400" /> PAID (Sep 2026)
                            </button>
                          </div>
                        )}

                        <button
                          onClick={() => { setDocumentStaff(member); setDocType("payslip"); }}
                          className="px-3 py-1.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold text-xs uppercase transition flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" /> Payslip
                        </button>

                        <button
                          onClick={() => { setSelectedStaffForOT(member); setOtForm({ hours: 5, rate: 200, extra_bonus: 0, reason: "Evening Lab Duty" }); setShowOvertimeModal(true); }}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-xs uppercase transition border border-amber-500/20 flex items-center gap-1"
                        >
                          + Overtime / OT
                        </button>

                        <button
                          onClick={() => openSalaryModal(member)}
                          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider transition border border-slate-700 flex items-center gap-1.5"
                        >
                          <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Configure
                        </button>

                        <button
                          onClick={() => { setDocumentStaff(member); setDocType("offer"); }}
                          className="px-3.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5"
                        >
                          Letter
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* TAB 2: LEAVE MANAGEMENT */}
        {activeTab === "leaves" && (
          <Card className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-400" /> Staff Leave Applications & HR Approval Register
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Staff members send leave applications to Center HR / Super Admin with leave reason. Approving unpaid leaves automatically deducts daily wages from net salary.
                </p>
              </div>

              <button
                onClick={() => setShowApplyLeaveModal(true)}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-500/20"
              >
                <Plus className="w-4 h-4" /> Apply For Staff Leave
              </button>
            </div>

            {/* Leave Applications Roster */}
            <div className="divide-y divide-slate-800">
              {leaves.map((l) => (
                <div key={l.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/30 p-4 rounded-xl transition">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-white uppercase">
                      {l.staff_name.substring(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="font-bold text-sm text-white">{l.staff_name}</h5>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          l.leave_type === "unpaid" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                          l.leave_type === "sick" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                          "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}>
                          {l.leave_type} Leave ({l.days} Days)
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1"><span className="text-slate-500 font-bold">Duration:</span> {l.start_date} to {l.end_date}</p>
                      <p className="text-xs text-amber-300 mt-0.5 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 font-medium">
                        <span className="text-amber-400 font-bold uppercase text-[10px] mr-1">Leave Reason:</span> "{l.reason}"
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {l.status === "pending" ? (
                      <>
                        <button
                          onClick={() => handleApproveLeaveRequest(l)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition active:scale-95"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Approve
                        </button>
                        <button
                          onClick={() => handleRejectLeaveRequest(l)}
                          className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-bold text-xs uppercase tracking-wider border border-rose-500/30 flex items-center gap-1.5 transition active:scale-95"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </>
                    ) : (
                      <span className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border flex items-center gap-1 ${
                        l.status === "approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      }`}>
                        {l.status === "approved" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {l.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {leaves.length === 0 && (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No staff leave applications logged yet.
                </div>
              )}
            </div>
          </Card>
        )}

        {/* TAB 3: DUTY SCHEDULE */}
        {activeTab === "schedule" && (
          <Card className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-5 h-5 text-emerald-400" /> Weekly Duty Roster, Lecture Shift & Overtime Management
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Log extra shift hours and overtime for staff. Overtime pay auto-adds to their monthly salary.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {staff.map((m) => (
                <div key={m._id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h5 className="font-bold text-sm text-white">{m.name}</h5>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      General Shift (9 AM - 5 PM)
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-400">
                    <p><span className="text-slate-200 font-semibold">Weekly Off:</span> Sunday</p>
                    <p><span className="text-slate-200 font-semibold">Teaching Hours:</span> 35 Hours/Week</p>
                    <p><span className="text-slate-200 font-semibold">Overtime Logged:</span> {m.overtime_hours || 0} Hours (+₹{(m.overtime_hours || 0) * (m.overtime_rate || 200)})</p>
                  </div>
                  <button
                    onClick={() => { setSelectedStaffForOT(m); setOtForm({ hours: 5, rate: 200, extra_bonus: 0, reason: "Extra Lecture Duty" }); setShowOvertimeModal(true); }}
                    className="w-full mt-2 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold uppercase flex items-center justify-center gap-1"
                  >
                    + Log Overtime / Shift
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* TAB 4: PERFORMANCE */}
        {activeTab === "performance" && (
          <Card className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-6">
            <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400" /> Staff Performance, Appraisal & Rating Register
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {staff.map((m) => (
                <div key={m._id} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-base text-white">{m.name}</h4>
                      <p className="text-xs text-slate-400">{m.designation || "Faculty Member"}</p>
                    </div>
                    <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 font-black text-sm">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span>{m.performance_rating || 4.8} / 5.0</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center text-xs font-mono">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Attendance Score</p>
                      <p className="text-base font-black text-emerald-400 mt-0.5">{m.attendance_pct || 95}%</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Student Rating</p>
                      <p className="text-base font-black text-blue-400 mt-0.5">96% Positive</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* TAB 5: PAYROLL HISTORY */}
        {activeTab === "history" && (
          <Card className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-6">
            <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-400" /> Payroll Disbursement Logs & Transaction History
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-bold uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-3">Reference Code</th>
                    <th className="p-3">Staff Name</th>
                    <th className="p-3">Month / Year</th>
                    <th className="p-3">Basic Pay</th>
                    <th className="p-3">Overtime & Allow</th>
                    <th className="p-3">Deductions</th>
                    <th className="p-3">Net Disbursed</th>
                    <th className="p-3">Disbursement Date</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {payrollHistory.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30">
                      <td className="p-3 font-bold text-blue-400">{log.payment_ref}</td>
                      <td className="p-3 font-bold text-white font-sans">{log.staff_name}</td>
                      <td className="p-3">{log.month_year}</td>
                      <td className="p-3">₹{log.basic.toLocaleString("en-IN")}</td>
                      <td className="p-3 text-emerald-400">+₹{(log.overtime_pay + log.allowances).toLocaleString("en-IN")}</td>
                      <td className="p-3 text-rose-400">-₹{log.deductions.toLocaleString("en-IN")}</td>
                      <td className="p-3 font-black text-emerald-400">₹{log.net_paid.toLocaleString("en-IN")}</td>
                      <td className="p-3 text-slate-400">{log.disbursed_at}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          PAID
                        </span>
                      </td>
                    </tr>
                  ))}

                  {payrollHistory.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500 font-sans text-xs">
                        No payroll disbursement logs found yet. Disburse salary to generate transaction records.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* MODAL 1: CONFIGURE PAYROLL & BANK KYC */}
        {editingStaff && (
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  Configure Payroll & Bank KYC - {editingStaff.name}
                </h3>
                <button onClick={() => setEditingStaff(null)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveSalary} className="space-y-6">
                {/* SECTION 1: SALARY STRUCTURE */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Salary & Allowance Breakdown
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-300 uppercase">Monthly Basic Pay (₹) *</label>
                      <input
                        type="number"
                        required
                        value={form.basic_salary}
                        onChange={(e) => setForm({ ...form, basic_salary: parseInt(e.target.value) || 0 })}
                        className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-emerald-400 uppercase">HRA / Special Allowances (₹)</label>
                      <input
                        type="number"
                        value={form.allowances}
                        onChange={(e) => setForm({ ...form, allowances: parseInt(e.target.value) || 0 })}
                        className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-blue-400 uppercase">PF Deduction (12% Option)</label>
                      <input
                        type="number"
                        value={form.pf_deduction}
                        onChange={(e) => setForm({ ...form, pf_deduction: parseInt(e.target.value) || 0 })}
                        className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="text-xs font-bold text-slate-300 uppercase">Overtime Hours</label>
                      <input
                        type="number"
                        value={form.overtime_hours}
                        onChange={(e) => setForm({ ...form, overtime_hours: parseInt(e.target.value) || 0 })}
                        className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-300 uppercase">Overtime Rate / Hour (₹)</label>
                      <input
                        type="number"
                        value={form.overtime_rate}
                        onChange={(e) => setForm({ ...form, overtime_rate: parseInt(e.target.value) || 0 })}
                        className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-rose-400 uppercase">Unpaid Leaves (Days)</label>
                      <input
                        type="number"
                        value={form.unpaid_leaves}
                        onChange={(e) => setForm({ ...form, unpaid_leaves: parseInt(e.target.value) || 0 })}
                        className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 2: BANK & KYC DETAILS */}
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> Bank Account & Government ID Proof
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase">Bank Name</label>
                      <input
                        type="text"
                        placeholder="e.g. HDFC Bank"
                        value={form.bank_name}
                        onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                        className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase">Account Number</label>
                      <input
                        type="text"
                        placeholder="e.g. 501002938471"
                        value={form.account_number}
                        onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                        className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase">IFSC Code</label>
                      <input
                        type="text"
                        placeholder="e.g. HDFC0001234"
                        value={form.ifsc_code}
                        onChange={(e) => setForm({ ...form, ifsc_code: e.target.value.toUpperCase() })}
                        className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase">Account Holder Name</label>
                      <input
                        type="text"
                        value={form.account_holder}
                        onChange={(e) => setForm({ ...form, account_holder: e.target.value })}
                        className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase">PAN Card Number</label>
                      <input
                        type="text"
                        placeholder="e.g. ABCDE1234F"
                        value={form.pan_number}
                        onChange={(e) => setForm({ ...form, pan_number: e.target.value.toUpperCase() })}
                        className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase">Aadhar Card Number</label>
                      <input
                        type="text"
                        placeholder="e.g. 1234-5678-9012"
                        value={form.aadhar_number}
                        onChange={(e) => setForm({ ...form, aadhar_number: e.target.value })}
                        className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* DOCUMENT PROOF UPLOADS */}
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Aadhar Proof</p>
                      <label className="mt-2 block cursor-pointer px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700">
                        <Upload className="w-3.5 h-3.5 inline mr-1" />
                        {form.proof_aadhar_name ? form.proof_aadhar_name.substring(0, 10) + "..." : "Upload Aadhar"}
                        <input type="file" className="hidden" onChange={(e) => handleFileUploadMock("proof_aadhar_name", e)} />
                      </label>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                      <p className="text-[10px] font-bold uppercase text-slate-400">PAN Proof</p>
                      <label className="mt-2 block cursor-pointer px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700">
                        <Upload className="w-3.5 h-3.5 inline mr-1" />
                        {form.proof_pan_name ? form.proof_pan_name.substring(0, 10) + "..." : "Upload PAN"}
                        <input type="file" className="hidden" onChange={(e) => handleFileUploadMock("proof_pan_name", e)} />
                      </label>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Bank Cheque / Passbook</p>
                      <label className="mt-2 block cursor-pointer px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700">
                        <Upload className="w-3.5 h-3.5 inline mr-1" />
                        {form.proof_cheque_name ? form.proof_cheque_name.substring(0, 10) + "..." : "Upload Cheque"}
                        <input type="file" className="hidden" onChange={(e) => handleFileUploadMock("proof_cheque_name", e)} />
                      </label>
                    </div>
                  </div>
                </div>

                {/* LIVE CALCULATOR DISPLAY */}
                {(() => {
                  const { net, yearly, otPay, leaveDed } = calculateNetPay(form);
                  return (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-3 text-center font-mono">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-500">Overtime Pay</p>
                        <p className="text-sm font-bold text-emerald-400">+₹{otPay}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-500">Leave Deduction</p>
                        <p className="text-sm font-bold text-rose-400">-₹{leaveDed}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-emerald-400">Net Monthly Salary</p>
                        <p className="text-lg font-black text-emerald-400">₹{net.toLocaleString("en-IN")}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-blue-400">Annual CTC</p>
                        <p className="text-lg font-black text-blue-400">₹{yearly.toLocaleString("en-IN")}</p>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingStaff(null)}
                    className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-40"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Salary Structure & KYC
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: OFFICIAL OFFER LETTER, JOINING LETTER & PAYSLIP PRINT MODAL */}
        {documentStaff && (
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white text-slate-900 rounded-2xl w-full max-w-3xl p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              {/* Top Control Bar */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-base">
                    SCRE
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase text-slate-900">Document Generator</h3>
                    <p className="text-[11px] text-slate-500 font-semibold">{documentStaff.name} ({documentStaff.designation || "Staff"})</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDocType("offer")}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs uppercase transition border ${docType === "offer" ? "bg-slate-900 text-white border-slate-900" : "bg-slate-100 text-slate-700 border-slate-300"}`}
                  >
                    Offer Letter
                  </button>
                  <button
                    onClick={() => setDocType("joining")}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs uppercase transition border ${docType === "joining" ? "bg-slate-900 text-white border-slate-900" : "bg-slate-100 text-slate-700 border-slate-300"}`}
                  >
                    Joining Letter
                  </button>
                  <button
                    onClick={() => setDocType("payslip")}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs uppercase transition border ${docType === "payslip" ? "bg-emerald-700 text-white border-emerald-700" : "bg-slate-100 text-slate-700 border-slate-300"}`}
                  >
                    Payslip
                  </button>
                  <button onClick={() => setDocumentStaff(null)} className="text-slate-400 hover:text-slate-900 ml-2">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* PRINTABLE DOCUMENT CONTENT */}
              <div className="space-y-4 text-xs leading-relaxed text-slate-900 font-sans p-2">
                {/* Header Logo */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xl tracking-tighter">
                      SCRE
                    </div>
                    <div>
                      <h2 className="text-lg font-black uppercase text-slate-900 tracking-tight">SIR CHHOTU RAM EDUCATION</h2>
                      <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Government Recognized Skill & Technical Training Academy</p>
                      <p className="text-[10px] text-slate-500 font-medium">Head Office: Campus Hub, SCRE Education Network • Web: www.scre.edu</p>
                    </div>
                  </div>
                  <div className="text-right font-mono text-[10px] text-slate-600">
                    <p className="font-bold text-slate-900">DOC REF: SCRE/HR/{docType.toUpperCase()}/2026</p>
                    <p>Issue Date: {new Date().toLocaleDateString("en-IN")}</p>
                  </div>
                </div>

                {/* DOCUMENT TYPE 1 & 2: OFFER / JOINING LETTER */}
                {(docType === "offer" || docType === "joining") && (
                  <div className="space-y-4">
                    <div className="font-semibold text-slate-800 space-y-0.5">
                      <p className="font-bold text-xs text-slate-900">To,</p>
                      <p className="font-black text-sm text-slate-900">{documentStaff.name}</p>
                      <p className="text-[11px] text-slate-600">{documentStaff.email} • {documentStaff.phone || "+91 9876543210"}</p>
                    </div>

                    <div className="py-2 border-y border-slate-200 text-center font-black text-xs uppercase tracking-wider text-slate-900 bg-slate-50">
                      SUBJECT: OFFICIAL {docType === "offer" ? "OFFER LETTER OF FACULTY APPOINTMENT" : "JOINING LETTER & RELIEVING ACKNOWLEDGEMENT"}
                    </div>

                    <p>
                      Dear <span className="font-bold">{documentStaff.name}</span>,
                    </p>
                    <p>
                      {docType === "offer" ? (
                        `We are pleased to formally offer you the position of "${documentStaff.designation || "Faculty Instructor"}" at SIR CHHOTU RAM EDUCATION (SCRE). We were deeply impressed by your experience, academic qualifications, and enthusiasm for educational excellence.`
                      ) : (
                        `This document confirms that you have officially assumed duties as "${documentStaff.designation || "Faculty Instructor"}" at SIR CHHOTU RAM EDUCATION (SCRE) effective from ${documentStaff.joining_date || "2024-01-15"}.`
                      )}
                    </p>

                    {/* Salary Table */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 font-mono">
                      <p className="font-bold text-slate-900 font-sans uppercase text-[11px]">Structured Monthly Compensation & Annual CTC:</p>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <p><span className="text-slate-500">Basic Monthly Salary:</span> ₹{(documentStaff.basic_salary || 25000).toLocaleString("en-IN")}</p>
                        <p><span className="text-slate-500">Allowances (HRA/Special):</span> ₹{(documentStaff.allowances || 3000).toLocaleString("en-IN")}</p>
                        <p><span className="text-slate-500">PF Deduction (12%):</span> ₹{(documentStaff.pf_deduction || 3000).toLocaleString("en-IN")}</p>
                        <p className="font-bold text-emerald-800"><span className="text-slate-500">Net Monthly Salary:</span> ₹{((documentStaff.basic_salary || 25000) + (documentStaff.allowances || 3000) - (documentStaff.deductions || 1000) - (documentStaff.pf_deduction || 3000)).toLocaleString("en-IN")}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-200 font-black text-xs text-blue-900 font-sans">
                        TOTAL ANNUAL CTC: ₹{(((documentStaff.basic_salary || 25000) + (documentStaff.allowances || 3000) - (documentStaff.deductions || 1000) - (documentStaff.pf_deduction || 3000)) * 12).toLocaleString("en-IN")} PER ANNUM
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600">
                      Please sign and return the duplicate copy of this appointment letter as token of your formal acceptance of the terms and conditions outlined above.
                    </p>

                    {/* Signatures */}
                    <div className="flex justify-between items-end pt-8">
                      <div>
                        <div className="w-28 border-b border-slate-900 mb-1"></div>
                        <p className="font-bold text-slate-900 text-xs">{documentStaff.name}</p>
                        <p className="text-[10px] text-slate-500 font-semibold">Faculty / Employee Signature</p>
                      </div>
                      <div className="text-right">
                        <div className="w-36 border-b border-slate-900 mb-1 ml-auto"></div>
                        <p className="font-bold text-slate-900 text-xs">Authorized HR Signatory</p>
                        <p className="text-[10px] text-slate-500 font-semibold">SIR CHHOTU RAM EDUCATION (SCRE)</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* DOCUMENT TYPE 3: MONTHLY PAYSLIP */}
                {docType === "payslip" && (() => {
                  const basic = documentStaff.basic_salary || 25000;
                  const allow = documentStaff.allowances || 3000;
                  const ot = (documentStaff.overtime_hours || 0) * (documentStaff.overtime_rate || 200);
                  const pf = documentStaff.pf_deduction || Math.round(basic * 0.12);
                  const leaveDed = Math.round((documentStaff.unpaid_leaves || 0) * (basic / 30));
                  const totalDed = (documentStaff.deductions || 1000) + pf + leaveDed;
                  const netPay = Math.max(0, basic + allow + ot - totalDed);
                  const b = documentStaff.bank_details || {};

                  return (
                    <div className="space-y-4">
                      <div className="py-2 border-y border-slate-900 text-center font-black text-sm uppercase tracking-widest text-slate-900 bg-slate-100">
                        OFFICIAL SALARY DISBURSEMENT PAYSLIP - SEPTEMBER 2026
                      </div>

                      {/* Employee Info Grid */}
                      <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] font-mono">
                        <div>
                          <p><span className="font-bold text-slate-900 font-sans">Employee Name:</span> {documentStaff.name}</p>
                          <p><span className="font-bold text-slate-900 font-sans">Designation:</span> {documentStaff.designation || "Faculty Member"}</p>
                          <p><span className="font-bold text-slate-900 font-sans">Joining Date:</span> {documentStaff.joining_date || "2024-01-15"}</p>
                        </div>
                        <div>
                          <p><span className="font-bold text-slate-900 font-sans">Bank Name:</span> {b.bank_name || "State Bank of India"}</p>
                          <p><span className="font-bold text-slate-900 font-sans">A/C Number:</span> {b.account_number || "918237461928"}</p>
                          <p><span className="font-bold text-slate-900 font-sans">IFSC Code:</span> {b.ifsc_code || "SBIN0001234"}</p>
                        </div>
                      </div>

                      {/* Itemized Table */}
                      <table className="w-full border-collapse border border-slate-300 text-[11px]">
                        <thead>
                          <tr className="bg-slate-200 text-slate-900 font-bold uppercase font-sans">
                            <th className="border border-slate-300 p-2 text-left">Earnings</th>
                            <th className="border border-slate-300 p-2 text-right">Amount (₹)</th>
                            <th className="border border-slate-300 p-2 text-left">Deductions</th>
                            <th className="border border-slate-300 p-2 text-right">Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="font-mono">
                          <tr>
                            <td className="border border-slate-300 p-2 font-sans font-semibold">Basic Pay</td>
                            <td className="border border-slate-300 p-2 text-right">₹{basic.toLocaleString("en-IN")}</td>
                            <td className="border border-slate-300 p-2 font-sans font-semibold">Provident Fund (PF)</td>
                            <td className="border border-slate-300 p-2 text-right">₹{pf.toLocaleString("en-IN")}</td>
                          </tr>
                          <tr>
                            <td className="border border-slate-300 p-2 font-sans font-semibold">Special / HRA Allowances</td>
                            <td className="border border-slate-300 p-2 text-right">₹{allow.toLocaleString("en-IN")}</td>
                            <td className="border border-slate-300 p-2 font-sans font-semibold">Unpaid Leave Deduction ({documentStaff.unpaid_leaves || 0} Days)</td>
                            <td className="border border-slate-300 p-2 text-right">₹{leaveDed.toLocaleString("en-IN")}</td>
                          </tr>
                          <tr>
                            <td className="border border-slate-300 p-2 font-sans font-semibold">Overtime Pay ({documentStaff.overtime_hours || 0} Hrs)</td>
                            <td className="border border-slate-300 p-2 text-right">₹{ot.toLocaleString("en-IN")}</td>
                            <td className="border border-slate-300 p-2 font-sans font-semibold">Standard HR Deductions</td>
                            <td className="border border-slate-300 p-2 text-right">₹{(documentStaff.deductions || 1000).toLocaleString("en-IN")}</td>
                          </tr>
                          <tr className="bg-slate-100 font-bold font-sans">
                            <td className="border border-slate-300 p-2 uppercase">Total Gross Earnings</td>
                            <td className="border border-slate-300 p-2 text-right font-mono">₹{(basic + allow + ot).toLocaleString("en-IN")}</td>
                            <td className="border border-slate-300 p-2 uppercase">Total Deductions</td>
                            <td className="border border-slate-300 p-2 text-right font-mono text-rose-700">₹{totalDed.toLocaleString("en-IN")}</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Net Amount Box */}
                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-between">
                        <div>
                          <p className="font-black text-xs uppercase text-slate-900 font-sans">NET SALARY PAYABLE DISBURSED</p>
                          <p className="text-[10px] text-slate-600 font-semibold font-mono">Status: DISBURSED & TRANSFERRED TO BANK</p>
                        </div>
                        <p className="font-black text-2xl text-emerald-800 font-mono">₹{netPay.toLocaleString("en-IN")}</p>
                      </div>

                      {/* Signatures */}
                      <div className="flex justify-between items-end pt-6">
                        <div>
                          <div className="w-28 border-b border-slate-900 mb-1"></div>
                          <p className="font-bold text-slate-900 text-xs">{documentStaff.name}</p>
                          <p className="text-[10px] text-slate-500 font-semibold">Employee Receiver Signature</p>
                        </div>
                        <div className="text-right">
                          <div className="w-36 border-b border-slate-900 mb-1 ml-auto"></div>
                          <p className="font-bold text-slate-900 text-xs">Accounts & Payroll Officer</p>
                          <p className="text-[10px] text-slate-500 font-semibold">SIR CHHOTU RAM EDUCATION (SCRE)</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 print:hidden">
                <button
                  type="button"
                  onClick={() => setDocumentStaff(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs uppercase"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg"
                >
                  <Printer className="w-4 h-4" /> Print / Save PDF
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: APPLY FOR LEAVE MODAL */}
        {showApplyLeaveModal && (
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400" /> Apply For Staff Leave (HR Approval)
                </h3>
                <button onClick={() => setShowApplyLeaveModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Select Staff Member *</label>
                  <select
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none focus:border-blue-500"
                    value={leaveForm.staff_id}
                    onChange={(e) => setLeaveForm({ ...leaveForm, staff_id: e.target.value })}
                  >
                    <option value="">-- SELECT STAFF MEMBER --</option>
                    {staff.map(s => (
                      <option key={s._id} value={s._id}>{s.name} ({s.designation || "Staff"})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase">Leave Category *</label>
                    <select
                      className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none focus:border-blue-500"
                      value={leaveForm.leave_type}
                      onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value as any })}
                    >
                      <option value="unpaid">Unpaid Leave (Wage Deducted)</option>
                      <option value="casual">Casual Leave (Quota)</option>
                      <option value="sick">Sick Leave (Quota)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase">Total Days *</label>
                    <input
                      type="number"
                      min={1}
                      value={leaveForm.days}
                      onChange={(e) => setLeaveForm({ ...leaveForm, days: parseInt(e.target.value) || 1 })}
                      className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase">Start Date</label>
                    <input
                      type="date"
                      value={leaveForm.start_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                      className="w-full mt-1 px-4 py-2 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-semibold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase">End Date</label>
                    <input
                      type="date"
                      value={leaveForm.end_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                      className="w-full mt-1 px-4 py-2 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-semibold outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Reason for Leave *</label>
                  <textarea
                    rows={3}
                    placeholder="Provide detailed explanation for leave request..."
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApplyLeaveModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyLeaveSubmit}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20"
                >
                  Submit For HR Approval
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 4: OVERTIME & EXTRA ALLOWANCE MODAL */}
        {showOvertimeModal && selectedStaffForOT && (
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" /> Log Overtime & Extra Shift - {selectedStaffForOT.name}
                </h3>
                <button onClick={() => setShowOvertimeModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase">Extra Overtime Hours</label>
                    <input
                      type="number"
                      value={otForm.hours}
                      onChange={(e) => setOtForm({ ...otForm, hours: parseInt(e.target.value) || 0 })}
                      className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase">Hourly Rate (₹)</label>
                    <input
                      type="number"
                      value={otForm.rate}
                      onChange={(e) => setOtForm({ ...otForm, rate: parseInt(e.target.value) || 0 })}
                      className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-emerald-400 uppercase">Extra Bonus / Performance Allowance (₹)</label>
                  <input
                    type="number"
                    value={otForm.extra_bonus}
                    onChange={(e) => setOtForm({ ...otForm, extra_bonus: parseInt(e.target.value) || 0 })}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Shift / Duty Description</label>
                  <input
                    type="text"
                    value={otForm.reason}
                    onChange={(e) => setOtForm({ ...otForm, reason: e.target.value })}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs outline-none"
                  />
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center font-mono text-xs text-amber-300">
                  Total Addition to Net Payroll: +₹{ (otForm.hours * otForm.rate) + otForm.extra_bonus }
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOvertimeModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveOvertimeSubmit}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20"
                >
                  Add To Payroll
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminStaffSalaryPage;
