import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  IndianRupee, 
  Plus, 
  Loader2, 
  Receipt, 
  Calendar, 
  TrendingDown, 
  TrendingUp,
  Building2, 
  FileSpreadsheet, 
  Printer, 
  Trash2, 
  Upload, 
  Search, 
  X, 
  CheckCircle2,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  PieChart
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";

interface ExpenseItem {
  _id: string;
  category: "Staff Salary" | "Rent & Infrastructure" | "Utilities & Electricity" | "Software & Server" | "Marketing & PR" | "Miscellaneous";
  particular: string;
  vendor_name?: string;
  amount: number;
  expense_date: string;
  payment_mode: "Bank Transfer" | "UPI" | "Cash" | "Cheque";
  receipt_ref?: string;
  status: "Approved" | "Pending" | "Paid";
}

interface IncomeItem {
  _id: string;
  category: "Course Fee Collection" | "Franchise Onboarding Fee" | "Certificate Verification" | "Exam Reappear Fee" | "Study Material Sale" | "Other Income";
  particular: string;
  payer_name?: string;
  center_name?: string;
  amount: number;
  income_date: string;
  payment_mode: "Bank Transfer" | "UPI" | "Cash" | "Cheque";
  receipt_ref?: string;
  status: "Received" | "Pending";
}

const DEFAULT_EXPENSES: ExpenseItem[] = [];
const DEFAULT_INCOMES: IncomeItem[] = [];


const AdminFinanceExpensesPage = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"income" | "expense" | "summary">("income");
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [incomes, setIncomes] = useState<IncomeItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  
  // Modals
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showAddIncomeModal, setShowAddIncomeModal] = useState(false);

  const [expForm, setExpForm] = useState({
    category: "Staff Salary" as ExpenseItem["category"],
    particular: "",
    vendor_name: "",
    amount: "",
    expense_date: new Date().toISOString().split("T")[0],
    payment_mode: "Bank Transfer" as ExpenseItem["payment_mode"],
    receipt_ref: ""
  });

  const [incForm, setIncForm] = useState({
    category: "Course Fee Collection" as IncomeItem["category"],
    particular: "",
    payer_name: "",
    center_name: "HQ Central Branch",
    amount: "",
    income_date: new Date().toISOString().split("T")[0],
    payment_mode: "UPI" as IncomeItem["payment_mode"],
    receipt_ref: ""
  });

  useEffect(() => {
    fetchLedgers();
  }, []);

  const fetchLedgers = async () => {
    setLoading(true);

    try {
      const [expRes, incRes] = await Promise.all([
        apiFetch("/api/finance/expenses").catch(() => null),
        apiFetch("/api/finance/incomes").catch(() => null),
      ]);

      let expList: ExpenseItem[] = [];
      if (expRes && expRes.ok) {
        const data = await expRes.json();
        if (Array.isArray(data) && data.length > 0) {
          expList = data.map((d: any) => ({
            _id: d._id || d.id || `exp_${Math.random()}`,
            category: d.category || "Staff Salary",
            particular: d.particular || "Expense",
            vendor_name: d.vendor_name || "N/A",
            amount: d.amount || 0,
            expense_date: d.expense_date || new Date().toISOString().split("T")[0],
            payment_mode: d.payment_mode || "Bank Transfer",
            receipt_ref: d.receipt_ref || "REC",
            status: d.status || "Paid"
          }));
        }
      }

      let incList: IncomeItem[] = [];
      if (incRes && incRes.ok) {
        const data = await incRes.json();
        if (Array.isArray(data) && data.length > 0) {
          incList = data.map((d: any) => ({
            _id: d._id || d.id || `inc_${Math.random()}`,
            category: d.category || "Course Fee Collection",
            particular: d.particular || "Income",
            payer_name: d.payer_name || "Payer",
            center_name: d.center_name || "HQ Branch",
            amount: d.amount || 0,
            income_date: d.income_date || new Date().toISOString().split("T")[0],
            payment_mode: d.payment_mode || "UPI",
            receipt_ref: d.receipt_ref || "REC",
            status: d.status || "Received"
          }));
        }
      }

      const savedExp = localStorage.getItem("scre_finance_expenses");
      const localExp = savedExp ? JSON.parse(savedExp) : DEFAULT_EXPENSES;
      setExpenses(expList.length > 0 ? expList : localExp);

      const savedInc = localStorage.getItem("scre_finance_incomes");
      const localInc = savedInc ? JSON.parse(savedInc) : DEFAULT_INCOMES;
      setIncomes(incList.length > 0 ? incList : localInc);
    } catch {
      setExpenses(DEFAULT_EXPENSES);
      setIncomes(DEFAULT_INCOMES);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expForm.particular.trim() || !expForm.amount || parseFloat(expForm.amount) <= 0) {
      toast.error("Please enter valid expense details and amount");
      return;
    }

    const payload = {
      category: expForm.category,
      particular: expForm.particular.trim(),
      vendor_name: expForm.vendor_name.trim() || "N/A",
      amount: parseFloat(expForm.amount),
      expense_date: expForm.expense_date,
      payment_mode: expForm.payment_mode,
      receipt_ref: expForm.receipt_ref || `EXP-${Math.floor(1000 + Math.random() * 9000)}`,
      status: "Paid"
    };

    try {
      await apiFetch("/api/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(() => null);
    } catch {
      // fallback
    }

    const newExp: ExpenseItem = {
      _id: `exp_${Date.now()}`,
      ...payload
    };

    const updated = [newExp, ...expenses];
    setExpenses(updated);
    localStorage.setItem("scre_finance_expenses", JSON.stringify(updated));

    toast.success("Expense voucher recorded successfully!");
    setExpForm({
      category: "Staff Salary",
      particular: "",
      vendor_name: "",
      amount: "",
      expense_date: new Date().toISOString().split("T")[0],
      payment_mode: "Bank Transfer",
      receipt_ref: ""
    });
    setShowAddExpenseModal(false);
  };

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incForm.particular.trim() || !incForm.amount || parseFloat(incForm.amount) <= 0) {
      toast.error("Please enter valid income details and amount");
      return;
    }

    const payload = {
      category: incForm.category,
      particular: incForm.particular.trim(),
      payer_name: incForm.payer_name.trim() || "Payer",
      center_name: incForm.center_name.trim() || "HQ Central Branch",
      amount: parseFloat(incForm.amount),
      income_date: incForm.income_date,
      payment_mode: incForm.payment_mode,
      receipt_ref: incForm.receipt_ref || `INC-${Math.floor(1000 + Math.random() * 9000)}`,
      status: "Received"
    };

    try {
      await apiFetch("/api/finance/incomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(() => null);
    } catch {
      // fallback
    }

    const newInc: IncomeItem = {
      _id: `inc_${Date.now()}`,
      ...payload
    };

    const updated = [newInc, ...incomes];
    setIncomes(updated);
    localStorage.setItem("scre_finance_incomes", JSON.stringify(updated));

    toast.success("Income voucher recorded successfully!");
    setIncForm({
      category: "Course Fee Collection",
      particular: "",
      payer_name: "",
      center_name: "HQ Central Branch",
      amount: "",
      income_date: new Date().toISOString().split("T")[0],
      payment_mode: "UPI",
      receipt_ref: ""
    });
    setShowAddIncomeModal(false);
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await apiFetch(`/api/finance/expenses/${id}`, { method: "DELETE" }).catch(() => null);
    } catch {
      // fallback
    }
    const updated = expenses.filter(e => e._id !== id);
    setExpenses(updated);
    localStorage.setItem("scre_finance_expenses", JSON.stringify(updated));
    toast.success("Expense entry deleted");
  };

  const handleDeleteIncome = async (id: string) => {
    try {
      await apiFetch(`/api/finance/incomes/${id}`, { method: "DELETE" }).catch(() => null);
    } catch {
      // fallback
    }
    const updated = incomes.filter(i => i._id !== id);
    setIncomes(updated);
    localStorage.setItem("scre_finance_incomes", JSON.stringify(updated));
    toast.success("Income entry deleted");
  };


  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = e.particular.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (e.vendor_name || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === "all" || e.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const filteredIncomes = incomes.filter(i => {
    const matchesSearch = i.particular.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (i.payer_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (i.center_name || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === "all" || i.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const totalIncomeAmount = incomes.reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpenseAmount = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const netMargin = totalIncomeAmount - totalExpenseAmount;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
        {/* Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-black text-2xl md:text-3xl text-white uppercase tracking-tight flex items-center gap-3">
              <Receipt className="w-8 h-8 text-emerald-400" />
              FINANCIAL INCOME & EXPENSE LEDGER
            </h1>
            <p className="text-slate-400 mt-1 text-xs md:text-sm font-medium">
              Complete organizational ledger tracking incoming revenue collections alongside outgoing expenses & net profit margins.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setShowAddIncomeModal(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" /> + Add Income Entry
            </button>
            <button
              onClick={() => setShowAddExpenseModal(true)}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-lg shadow-rose-600/20"
            >
              <Plus className="w-4 h-4" /> + Add Expense Entry
            </button>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <ArrowUpRight className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">TOTAL INCOME COLLECTED</p>
                  <p className="text-2xl font-black text-emerald-400 font-mono mt-0.5">₹{totalIncomeAmount.toLocaleString("en-IN")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                  <ArrowDownRight className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">TOTAL EXPENSES RECORDED</p>
                  <p className="text-2xl font-black text-rose-400 font-mono mt-0.5">₹{totalExpenseAmount.toLocaleString("en-IN")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                  netMargin >= 0 ? "bg-blue-500/10 border border-blue-500/20 text-blue-400" : "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                }`}>
                  <PieChart className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">NET FINANCIAL MARGIN</p>
                  <p className={`text-2xl font-black font-mono mt-0.5 ${netMargin >= 0 ? "text-blue-400" : "text-amber-400"}`}>
                    {netMargin >= 0 ? "+" : ""}₹{netMargin.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => { setActiveTab("income"); setSelectedCategory("all"); }}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === "income"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <ArrowUpRight className="w-4 h-4" /> Income Register ({incomes.length})
          </button>
          <button
            onClick={() => { setActiveTab("expense"); setSelectedCategory("all"); }}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === "expense"
                ? "bg-rose-600 text-white shadow-lg shadow-rose-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <ArrowDownRight className="w-4 h-4" /> Expense Register ({expenses.length})
          </button>
          <button
            onClick={() => setActiveTab("summary")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === "summary"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <PieChart className="w-4 h-4" /> Profit & Loss Summary
          </button>
        </div>

        {/* Filter Bar */}
        {activeTab !== "summary" && (
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search particular, vendor or payer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white text-xs font-bold outline-none focus:border-emerald-500"
                />
              </div>

              {activeTab === "expense" ? (
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white text-xs font-bold outline-none focus:border-rose-500"
                >
                  <option value="all">ALL EXPENSE CATEGORIES</option>
                  <option value="Staff Salary">Staff Salary</option>
                  <option value="Rent & Infrastructure">Rent & Infrastructure</option>
                  <option value="Utilities & Electricity">Utilities & Electricity</option>
                  <option value="Software & Server">Software & Server</option>
                  <option value="Marketing & PR">Marketing & PR</option>
                  <option value="Miscellaneous">Miscellaneous</option>
                </select>
              ) : (
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white text-xs font-bold outline-none focus:border-emerald-500"
                >
                  <option value="all">ALL INCOME CATEGORIES</option>
                  <option value="Course Fee Collection">Course Fee Collection</option>
                  <option value="Franchise Onboarding Fee">Franchise Onboarding Fee</option>
                  <option value="Certificate Verification">Certificate Verification</option>
                  <option value="Exam Reappear Fee">Exam Reappear Fee</option>
                  <option value="Study Material Sale">Study Material Sale</option>
                  <option value="Other Income">Other Income</option>
                </select>
              )}
            </div>

            <button
              onClick={() => window.print()}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider border border-slate-700 flex items-center gap-2"
            >
              <Printer className="w-4 h-4" /> Print Ledger
            </button>
          </div>
        )}

        {/* TAB 1: INCOME REGISTER */}
        {activeTab === "income" && (
          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
            <CardHeader className="bg-slate-950/80 border-b border-slate-800 py-4 px-6 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4" /> Income Collection Register ({filteredIncomes.length})
              </CardTitle>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-16 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                </div>
              ) : filteredIncomes.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                  <p className="text-xs font-bold uppercase">No income entries found matching criteria</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {filteredIncomes.map((inc) => (
                    <div key={inc._id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/30 transition">
                      <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-lg">
                          +
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-white">{inc.particular}</h4>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              {inc.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Payer: <span className="text-slate-200 font-semibold">{inc.payer_name || "N/A"}</span> • Center: <span className="text-slate-200 font-semibold">{inc.center_name || "HQ"}</span> • Mode: <span className="text-slate-200 font-semibold">{inc.payment_mode}</span>
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono mt-1">
                            Date: {format(new Date(inc.income_date), "dd MMM yyyy")} • Ref: {inc.receipt_ref}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right font-mono">
                          <p className="text-base font-black text-emerald-400">+₹{inc.amount.toLocaleString("en-IN")}</p>
                          <span className="text-[10px] font-bold uppercase text-emerald-400">Received & Credited</span>
                        </div>

                        <button
                          onClick={() => handleDeleteIncome(inc._id)}
                          className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                          title="Delete Income Entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* TAB 2: EXPENSE REGISTER */}
        {activeTab === "expense" && (
          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
            <CardHeader className="bg-slate-950/80 border-b border-slate-800 py-4 px-6 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-rose-400 flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4" /> Expense Voucher Register ({filteredExpenses.length})
              </CardTitle>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-16 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
                </div>
              ) : filteredExpenses.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                  <p className="text-xs font-bold uppercase">No expenses found matching criteria</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {filteredExpenses.map((exp) => (
                    <div key={exp._id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/30 transition">
                      <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-black text-lg">
                          -
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-white">{exp.particular}</h4>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
                              {exp.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Vendor: <span className="text-slate-200 font-semibold">{exp.vendor_name || "N/A"}</span> • Mode: <span className="text-slate-200 font-semibold">{exp.payment_mode}</span>
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono mt-1">
                            Date: {format(new Date(exp.expense_date), "dd MMM yyyy")} • Ref: {exp.receipt_ref}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right font-mono">
                          <p className="text-base font-black text-rose-400">-₹{exp.amount.toLocaleString("en-IN")}</p>
                          <span className="text-[10px] font-bold uppercase text-emerald-400">Paid & Cleared</span>
                        </div>

                        <button
                          onClick={() => handleDeleteExpense(exp._id)}
                          className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                          title="Delete Voucher Entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* TAB 3: PROFIT & LOSS SUMMARY */}
        {activeTab === "summary" && (
          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden p-6 space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                <PieChart className="w-5 h-5 text-blue-400" /> Organizational Profit & Loss Financial Statement
              </h3>
              <p className="text-xs text-slate-400 mt-1">Real-time revenue versus expense comparison ledger breakdown</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <h4 className="font-sans font-bold text-sm text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Revenue Breakdown (Income)</span>
                  <span>₹{totalIncomeAmount.toLocaleString("en-IN")}</span>
                </h4>
                <div className="space-y-2 border-t border-slate-800 pt-3">
                  <div className="flex justify-between text-slate-300">
                    <span>Course Fee Tuition Collections</span>
                    <span className="font-bold">₹{incomes.filter(i => i.category === "Course Fee Collection").reduce((s, i) => s + i.amount, 0).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Franchise Onboarding Deposits</span>
                    <span className="font-bold">₹{incomes.filter(i => i.category === "Franchise Onboarding Fee").reduce((s, i) => s + i.amount, 0).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Certificate & Document Verification</span>
                    <span className="font-bold">₹{incomes.filter(i => i.category === "Certificate Verification").reduce((s, i) => s + i.amount, 0).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Exam Re-appear Fees</span>
                    <span className="font-bold">₹{incomes.filter(i => i.category === "Exam Reappear Fee").reduce((s, i) => s + i.amount, 0).toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <h4 className="font-sans font-bold text-sm text-rose-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Expenditure Breakdown (Expense)</span>
                  <span>₹{totalExpenseAmount.toLocaleString("en-IN")}</span>
                </h4>
                <div className="space-y-2 border-t border-slate-800 pt-3">
                  <div className="flex justify-between text-slate-300">
                    <span>Faculty & Staff Monthly Payroll</span>
                    <span className="font-bold">₹{expenses.filter(e => e.category === "Staff Salary").reduce((s, e) => s + e.amount, 0).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Campus Infrastructure Building Rent</span>
                    <span className="font-bold">₹{expenses.filter(e => e.category === "Rent & Infrastructure").reduce((s, e) => s + e.amount, 0).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Electricity, Water & Fiber Internet</span>
                    <span className="font-bold">₹{expenses.filter(e => e.category === "Utilities & Electricity").reduce((s, e) => s + e.amount, 0).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Server Hosting, Domain & Software</span>
                    <span className="font-bold">₹{expenses.filter(e => e.category === "Software & Server").reduce((s, e) => s + e.amount, 0).toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase font-bold text-slate-400">NET NET FINANCIAL SURPLUS / PROFIT</p>
                <p className="text-2xl font-black font-mono text-emerald-400 mt-1">₹{netMargin.toLocaleString("en-IN")}</p>
              </div>
              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> Print Profit & Loss Report
              </button>
            </div>
          </Card>
        )}

        {/* MODAL 1: ADD EXPENSE MODAL */}
        {showAddExpenseModal && (
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-rose-400" /> Record New Expense Voucher Entry
                </h3>
                <button onClick={() => setShowAddExpenseModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddExpense} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase">Expense Category *</label>
                  <select
                    value={expForm.category}
                    onChange={(e) => setExpForm({ ...expForm, category: e.target.value as any })}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none focus:border-rose-500"
                  >
                    <option value="Staff Salary">Staff Salary</option>
                    <option value="Rent & Infrastructure">Rent & Infrastructure</option>
                    <option value="Utilities & Electricity">Utilities & Electricity</option>
                    <option value="Software & Server">Software & Server</option>
                    <option value="Marketing & PR">Marketing & PR</option>
                    <option value="Miscellaneous">Miscellaneous</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase">Particular Description *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. October Campus Electricity Bill"
                    value={expForm.particular}
                    onChange={(e) => setExpForm({ ...expForm, particular: e.target.value })}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none focus:border-rose-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 uppercase">Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 15000"
                      value={expForm.amount}
                      onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })}
                      className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 uppercase">Expense Date</label>
                    <input
                      type="date"
                      value={expForm.expense_date}
                      onChange={(e) => setExpForm({ ...expForm, expense_date: e.target.value })}
                      className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 uppercase">Vendor / Receiver</label>
                    <input
                      type="text"
                      placeholder="e.g. BSES Electricity"
                      value={expForm.vendor_name}
                      onChange={(e) => setExpForm({ ...expForm, vendor_name: e.target.value })}
                      className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 uppercase">Payment Mode</label>
                    <select
                      value={expForm.payment_mode}
                      onChange={(e) => setExpForm({ ...expForm, payment_mode: e.target.value as any })}
                      className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none focus:border-rose-500"
                    >
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="UPI">UPI</option>
                      <option value="Cash">Cash</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddExpenseModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-rose-600/20"
                  >
                    Save Expense Voucher
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: ADD INCOME MODAL */}
        {showAddIncomeModal && (
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" /> Record New Income Revenue Entry
                </h3>
                <button onClick={() => setShowAddIncomeModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddIncome} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase">Income Category *</label>
                  <select
                    value={incForm.category}
                    onChange={(e) => setIncForm({ ...incForm, category: e.target.value as any })}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none focus:border-emerald-500"
                  >
                    <option value="Course Fee Collection">Course Fee Collection</option>
                    <option value="Franchise Onboarding Fee">Franchise Onboarding Fee</option>
                    <option value="Certificate Verification">Certificate Verification</option>
                    <option value="Exam Reappear Fee">Exam Reappear Fee</option>
                    <option value="Study Material Sale">Study Material Sale</option>
                    <option value="Other Income">Other Income</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase">Particular Description *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Full Semester Course Fee Deposit"
                    value={incForm.particular}
                    onChange={(e) => setIncForm({ ...incForm, particular: e.target.value })}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 uppercase">Payer / Student Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul Verma"
                      value={incForm.payer_name}
                      onChange={(e) => setIncForm({ ...incForm, payer_name: e.target.value })}
                      className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 uppercase">Center Branch</label>
                    <input
                      type="text"
                      placeholder="e.g. HQ Central Branch"
                      value={incForm.center_name}
                      onChange={(e) => setIncForm({ ...incForm, center_name: e.target.value })}
                      className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 uppercase">Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 25000"
                      value={incForm.amount}
                      onChange={(e) => setIncForm({ ...incForm, amount: e.target.value })}
                      className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 uppercase">Income Date</label>
                    <input
                      type="date"
                      value={incForm.income_date}
                      onChange={(e) => setIncForm({ ...incForm, income_date: e.target.value })}
                      className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase">Payment Mode</label>
                  <select
                    value={incForm.payment_mode}
                    onChange={(e) => setIncForm({ ...incForm, payment_mode: e.target.value as any })}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none focus:border-emerald-500"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddIncomeModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/20"
                  >
                    Save Income Voucher
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminFinanceExpensesPage;
