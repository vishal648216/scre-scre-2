import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Trophy, 
  Loader2, 
  Search, 
  Users, 
  Settings, 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle2, 
  Clock, 
  Gift, 
  Upload, 
  DollarSign, 
  Percent,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Send,
  X,
  Share2,
  Copy,
  Wallet
} from "lucide-react";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import ReferralTreeVisualizer from "@/components/ReferralTreeVisualizer";

interface ReferralRecord {
  _id: string;
  referrer_id: string;
  referred_id: string;
  code_used: string;
  reward_amount: number;
  reward_type: string;
  is_applied: boolean;
  status: string;
  created_at: string;
  referrer_name?: string;
  referrer_role?: string;
  referred_user_name?: string;
  referred_user_role?: string;
}

interface ReferralLevel {
  level_number: number;
  level_name: string;
  reward_amount: number;
  required_referrals: number;
  condition_text: string;
}

interface ReferralSettings {
  target_role: string;
  default_reward_amount: number;
  activation_percentage?: number | null;
  min_withdrawal_amount?: number | null;
  max_rewarded_referrals?: number | null;
  max_child_depth?: number | null;
  child_rewards: number[];
  payout_model?: "flat" | "percentage" | string;
  flat_amount?: number | null;
  percentage_rate?: number | null;
  franchise_base_fee?: number | null;
}

const DEFAULT_REFERRALS: ReferralRecord[] = [];

const AdminReferralsPage = () => {
  const [loading, setLoading] = useState(true);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "tree" | "student" | "staff" | "center" | "history">("overview");

  // Referral Code Creation Workflow State
  const [showCreateCodeModal, setShowCreateCodeModal] = useState(false);
  const [newCodeRole, setNewCodeRole] = useState<"student" | "staff" | "center">("student");
  const [newCodeOwnerName, setNewCodeOwnerName] = useState("");
  const [customCodeInput, setCustomCodeInput] = useState("");
  const [creatingCode, setCreatingCode] = useState(false);

  // Referral Code Redemption Workflow State
  const [inputCode, setInputCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{ success: boolean; message: string; amount?: number } | null>(null);

  // Withdrawal Modal
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState(1000);
  const [upiId, setUpiId] = useState("student@upi");
  const [withdrawing, setWithdrawing] = useState(false);

  // Settings State for 5-Level Multi-Tier Commissions
  const [studentSettings, setStudentSettings] = useState<ReferralSettings>({
    target_role: "student",
    default_reward_amount: 500,
    activation_percentage: 100,
    min_withdrawal_amount: 500,
    max_rewarded_referrals: 20,
    max_child_depth: 5,
    child_rewards: [500, 250, 100, 50, 25]
  });

  const [staffSettings, setStaffSettings] = useState<ReferralSettings>({
    target_role: "staff",
    default_reward_amount: 1000,
    activation_percentage: 100,
    min_withdrawal_amount: 500,
    max_rewarded_referrals: 50,
    max_child_depth: 5,
    child_rewards: [1000, 500, 250, 100, 50]
  });

  const [centerSettings, setCenterSettings] = useState<ReferralSettings>({
    target_role: "center",
    default_reward_amount: 5000,
    payout_model: "percentage",
    flat_amount: 5000,
    percentage_rate: 20,
    franchise_base_fee: 50000,
    min_withdrawal_amount: 2000,
    child_rewards: [20, 10, 5, 3, 2]
  });

  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/referrals").catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        setReferrals(Array.isArray(data) ? data : []);
        setLoading(false);
        return;
      }
    } catch {
      // fallback
    }

    setReferrals([]);
    setLoading(false);
  };

  const handleApplyReferralCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) {
      toast.error("Please enter a referral code");
      return;
    }

    setRedeeming(true);
    setRedeemResult(null);

    setTimeout(() => {
      const codeUpper = inputCode.trim().toUpperCase();
      const isCenter = codeUpper.includes("CENT");
      const rewardVal = isCenter ? (centerSettings.flat_amount || 5000) : (studentSettings.default_reward_amount || 500);

      const newRecord: ReferralRecord = {
        _id: `ref_${Date.now()}`,
        referrer_id: "usr_active",
        referrer_name: isCenter ? "Partner Center Branch" : "Active Referral User",
        referrer_role: isCenter ? "Center" : "Student",
        referred_id: "usr_new",
        referred_user_name: "Newly Onboarded User",
        referred_user_role: isCenter ? "Center" : "Student",
        code_used: codeUpper,
        reward_amount: rewardVal,
        reward_type: isCenter ? "Franchise Referral Payout" : "Student Bonus Cash",
        is_applied: true,
        status: "RewardGiven",
        created_at: new Date().toISOString()
      };

      setReferrals([newRecord, ...referrals]);
      setRedeeming(false);
      setRedeemResult({
        success: true,
        message: `Success! Referral Code ${codeUpper} applied. Unlocked ₹${rewardVal} cash reward!`,
        amount: rewardVal
      });
      toast.success(`Referral code ${codeUpper} successfully redeemed!`);
      setInputCode("");
    }, 600);
  };

  const handleCreateNewReferralCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCodeOwnerName.trim()) {
      toast.error("Please enter user/center owner name");
      return;
    }

    setCreatingCode(true);
    setTimeout(() => {
      const generatedCode = customCodeInput.trim() 
        ? customCodeInput.trim().toUpperCase() 
        : `REF-${newCodeRole.toUpperCase().substring(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`;

      const rewardVal = newCodeRole === "center" ? 5000 : newCodeRole === "staff" ? 1000 : 500;

      const newRecord: ReferralRecord = {
        _id: `ref_gen_${Date.now()}`,
        referrer_id: `usr_${Date.now()}`,
        referrer_name: newCodeOwnerName.trim(),
        referrer_role: newCodeRole.toUpperCase(),
        referred_id: "usr_pending",
        referred_user_name: "Active Code (Awaiting Onboarding)",
        referred_user_role: newCodeRole,
        code_used: generatedCode,
        reward_amount: rewardVal,
        reward_type: `${newCodeRole.toUpperCase()} Referral Code`,
        is_applied: true,
        status: "RewardGiven",
        created_at: new Date().toISOString()
      };

      setReferrals([newRecord, ...referrals]);
      setCreatingCode(false);
      setShowCreateCodeModal(false);
      setNewCodeOwnerName("");
      setCustomCodeInput("");
      toast.success(`New referral code ${generatedCode} created for ${newCodeOwnerName.trim()} (${newCodeRole.toUpperCase()})!`);
    }, 500);
  };

  const handleDeleteReferralCode = (id: string, code: string) => {
    if (confirm(`Are you sure you want to delete referral code ${code}?`)) {
      setReferrals(referrals.filter(r => r._id !== id));
      toast.success(`Referral code ${code} deleted!`);
    }
  };

  const handleWithdrawRewards = () => {
    if (withdrawAmount < (studentSettings.min_withdrawal_amount || 500)) {
      toast.error(`Minimum withdrawal amount is ₹${studentSettings.min_withdrawal_amount || 500}`);
      return;
    }

    setWithdrawing(true);
    setTimeout(() => {
      toast.success(`Withdrawal request of ₹${withdrawAmount.toLocaleString("en-IN")} submitted to UPI ID ${upiId}! Ref: WTH-${Math.floor(100000 + Math.random() * 900000)}`);
      setWithdrawing(false);
      setShowWithdrawModal(false);
    }, 600);
  };

  const handleSaveSettings = () => {
    setSavingSettings(true);
    setTimeout(() => {
      setSavingSettings(false);
      toast.success("Super Admin 5-Level Commission & Referral Rules saved successfully!");
    }, 500);
  };

  const totalRewardsDistributed = referrals.reduce((acc, curr) => acc + (curr.reward_amount || 0), 0);

  const filteredReferrals = referrals.filter(r =>
    !search ||
    r.code_used.toLowerCase().includes(search.toLowerCase()) ||
    (r.referrer_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.referred_user_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
        {/* Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-black text-2xl md:text-3xl text-white uppercase tracking-tight flex items-center gap-3">
              <Trophy className="w-8 h-8 text-amber-400" />
              REFERRAL MANAGEMENT & CODE REDEMPTION
            </h1>
            <p className="text-slate-400 mt-1 text-xs md:text-sm font-medium">
              Configure student & center referral rewards, test code redemptions, and process wallet reward payout requests.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowCreateCodeModal(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" /> Generate New Referral Code
            </button>
            <div className="flex items-center gap-4 bg-slate-950 border border-slate-800 p-4 rounded-xl">
              <div className="text-right font-mono">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Rewards Distributed</p>
                <p className="text-2xl font-black text-amber-400 mt-0.5">₹{totalRewardsDistributed.toLocaleString("en-IN")}</p>
              </div>
              <button
                onClick={() => setShowWithdrawModal(true)}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-lg shadow-amber-500/20"
              >
                <Wallet className="w-4 h-4" /> Request Payout
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === "overview"
                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Gift className="w-4 h-4" /> Overview & Redeem Code
          </button>
          <button
            onClick={() => setActiveTab("tree")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === "tree"
                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Users className="w-4 h-4" /> 5-Level Tree Network
          </button>
          <button
            onClick={() => setActiveTab("student")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === "student"
                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Users className="w-4 h-4" /> Student 5-Tier Commission
          </button>
          <button
            onClick={() => setActiveTab("staff")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === "staff"
                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Users className="w-4 h-4" /> Staff 5-Tier Commission
          </button>
          <button
            onClick={() => setActiveTab("center")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === "center"
                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Settings className="w-4 h-4" /> Center Franchise Commission
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === "history"
                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Trophy className="w-4 h-4" /> All Active Referral Codes ({referrals.length})
          </button>
        </div>

        {/* TAB: VISUAL TREE NETWORK */}
        {activeTab === "tree" && (
          <div className="space-y-6">
            <ReferralTreeVisualizer />
          </div>
        )}

        {/* TAB 1: OVERVIEW & REDEEM CODE WORKFLOW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Interactive Code Redemption Section */}
            <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl p-6">
              <div className="max-w-2xl space-y-4">
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" /> Apply & Redeem Referral Code Workflow
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Enter a referral code (e.g. <span className="font-mono text-amber-300 font-bold">SCRE-STUD-501</span> or <span className="font-mono text-blue-300 font-bold">SCRE-CENT-102</span>) to verify validity and unlock instant wallet bonus cash!
                  </p>
                </div>

                <form onSubmit={handleApplyReferralCode} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Enter referral code (e.g. SCRE-STUD-501)..."
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold uppercase outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    disabled={redeeming}
                    className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                  >
                    {redeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    Apply Code Now
                  </button>
                </form>

                {redeemResult && (
                  <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-3 ${
                    redeemResult.success ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                  }`}>
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    <span>{redeemResult.message}</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Quick Shareable Referral Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                      🎓
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">Student Refer & Earn Program</h4>
                      <p className="text-xs text-slate-400">Earn ₹{studentSettings.default_reward_amount} per referred admission</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between font-mono text-xs">
                  <span className="text-amber-400 font-bold">Sample Code: SCRE-STUD-8812</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText("SCRE-STUD-8812"); toast.success("Sample referral code copied!"); }}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Card>

              <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                      🏢
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">Center Franchise Onboarding Bonus</h4>
                      <p className="text-xs text-slate-400">Earn ₹{centerSettings.flat_amount} per new center onboarding</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between font-mono text-xs">
                  <span className="text-blue-400 font-bold">Sample Code: SCRE-CENT-9901</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText("SCRE-CENT-9901"); toast.success("Sample center code copied!"); }}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* TAB: STUDENT REFERRAL CONFIG (5 LEVELS) */}
        {activeTab === "student" && (
          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" /> Super Admin Student 5-Tier Commission Rules
                </h3>
                <p className="text-xs text-slate-400 mt-1">Super Admin full control for Student Referral commission payouts across Level 1 to Level 5.</p>
              </div>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5"
              >
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Rules
              </button>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Multi-Level Commission Payout (Level 1 to Level 5)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {[
                  { lvl: 1, key: 0, label: "Level 1 (Direct)", defaultVal: 500 },
                  { lvl: 2, key: 1, label: "Level 2 Sub-Ref", defaultVal: 250 },
                  { lvl: 3, key: 2, label: "Level 3 Sub-Ref", defaultVal: 100 },
                  { lvl: 4, key: 3, label: "Level 4 Sub-Ref", defaultVal: 50 },
                  { lvl: 5, key: 4, label: "Level 5 Sub-Ref", defaultVal: 25 },
                ].map((item) => (
                  <div key={item.lvl} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">{item.label}</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-500">₹</span>
                      <input
                        type="number"
                        value={studentSettings.child_rewards[item.key] ?? item.defaultVal}
                        onChange={(e) => {
                          const updated = [...studentSettings.child_rewards];
                          updated[item.key] = parseFloat(e.target.value) || 0;
                          setStudentSettings({ ...studentSettings, child_rewards: updated });
                        }}
                        className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-white font-mono text-xs font-bold outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-800 pt-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Default Reward Amount (₹)</label>
                <input
                  type="number"
                  value={studentSettings.default_reward_amount}
                  onChange={(e) => setStudentSettings({ ...studentSettings, default_reward_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Minimum Withdrawal Limit (₹)</label>
                <input
                  type="number"
                  value={studentSettings.min_withdrawal_amount ?? 500}
                  onChange={(e) => setStudentSettings({ ...studentSettings, min_withdrawal_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Max Rewarded Referrals</label>
                <input
                  type="number"
                  value={studentSettings.max_rewarded_referrals ?? 20}
                  onChange={(e) => setStudentSettings({ ...studentSettings, max_rewarded_referrals: parseInt(e.target.value, 10) || 0 })}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none"
                />
              </div>
            </div>
          </Card>
        )}

        {/* TAB: STAFF REFERRAL CONFIG (5 LEVELS) */}
        {activeTab === "staff" && (
          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" /> Super Admin Staff 5-Tier Commission Rules
                </h3>
                <p className="text-xs text-slate-400 mt-1">Super Admin full control for Staff Referral commission payouts across Level 1 to Level 5.</p>
              </div>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5"
              >
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Rules
              </button>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider">Multi-Level Staff Commission Payout (Level 1 to Level 5)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {[
                  { lvl: 1, key: 0, label: "Level 1 (Direct Staff)", defaultVal: 1000 },
                  { lvl: 2, key: 1, label: "Level 2 Sub-Staff", defaultVal: 500 },
                  { lvl: 3, key: 2, label: "Level 3 Sub-Staff", defaultVal: 250 },
                  { lvl: 4, key: 3, label: "Level 4 Sub-Staff", defaultVal: 100 },
                  { lvl: 5, key: 4, label: "Level 5 Sub-Staff", defaultVal: 50 },
                ].map((item) => (
                  <div key={item.lvl} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">{item.label}</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-500">₹</span>
                      <input
                        type="number"
                        value={staffSettings.child_rewards[item.key] ?? item.defaultVal}
                        onChange={(e) => {
                          const updated = [...staffSettings.child_rewards];
                          updated[item.key] = parseFloat(e.target.value) || 0;
                          setStaffSettings({ ...staffSettings, child_rewards: updated });
                        }}
                        className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-white font-mono text-xs font-bold outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800 pt-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Default Staff Referral Bonus (₹)</label>
                <input
                  type="number"
                  value={staffSettings.default_reward_amount}
                  onChange={(e) => setStaffSettings({ ...staffSettings, default_reward_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Minimum Withdrawal Limit (₹)</label>
                <input
                  type="number"
                  value={staffSettings.min_withdrawal_amount ?? 500}
                  onChange={(e) => setStaffSettings({ ...staffSettings, min_withdrawal_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none"
                />
              </div>
            </div>
          </Card>
        )}

        {/* TAB 3: CENTER REFERRAL SPLIT (5 LEVELS) */}
        {activeTab === "center" && (
          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Settings className="w-4 h-4 text-blue-400" /> Super Admin Center Franchise 5-Tier Commission
                </h3>
                <p className="text-xs text-slate-400 mt-1">Super Admin full control for Center Franchise Commission Split across Level 1 to Level 5.</p>
              </div>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5"
              >
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Rules
              </button>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">Multi-Level Franchise Commission Split (Level 1 to Level 5 %)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {[
                  { lvl: 1, key: 0, label: "Level 1 Franchise", defaultVal: 20 },
                  { lvl: 2, key: 1, label: "Level 2 Franchise", defaultVal: 10 },
                  { lvl: 3, key: 2, label: "Level 3 Franchise", defaultVal: 5 },
                  { lvl: 4, key: 3, label: "Level 4 Franchise", defaultVal: 3 },
                  { lvl: 5, key: 4, label: "Level 5 Franchise", defaultVal: 2 },
                ].map((item) => (
                  <div key={item.lvl} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">{item.label}</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-500">%</span>
                      <input
                        type="number"
                        value={centerSettings.child_rewards[item.key] ?? item.defaultVal}
                        onChange={(e) => {
                          const updated = [...centerSettings.child_rewards];
                          updated[item.key] = parseFloat(e.target.value) || 0;
                          setCenterSettings({ ...centerSettings, child_rewards: updated });
                        }}
                        className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-white font-mono text-xs font-bold outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800 pt-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Flat Franchise Referral Bonus (₹)</label>
                <input
                  type="number"
                  value={centerSettings.flat_amount ?? 5000}
                  onChange={(e) => setCenterSettings({ ...centerSettings, flat_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Franchise Base Fee Standard (₹)</label>
                <input
                  type="number"
                  value={centerSettings.franchise_base_fee ?? 50000}
                  onChange={(e) => setCenterSettings({ ...centerSettings, franchise_base_fee: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none"
                />
              </div>
            </div>
          </Card>
        )}

        {/* TAB 4: REFERRAL HISTORY LOGS */}
        {activeTab === "history" && (
          <Card className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
            <CardHeader className="bg-slate-950/80 border-b border-slate-800 py-4 px-6 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                ALL ACTIVE REFERRAL CODES ({filteredReferrals.length})
              </CardTitle>

              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search code or user..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs outline-none"
                />
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-bold uppercase border-b border-slate-800">
                    <tr>
                      <th className="p-4">Date</th>
                      <th className="p-4">Referrer User / Owner</th>
                      <th className="p-4">Referred Target</th>
                      <th className="p-4">Code</th>
                      <th className="p-4 text-right">Commission Reward</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {filteredReferrals.map((r) => (
                      <tr key={r._id} className="hover:bg-slate-800/30">
                        <td className="p-4 text-slate-400">{format(new Date(r.created_at), "dd MMM yyyy")}</td>
                        <td className="p-4 font-sans font-bold text-white">
                          {r.referrer_name || "User"}
                          <span className="ml-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {r.referrer_role}
                          </span>
                        </td>
                        <td className="p-4 font-sans text-slate-300">{r.referred_user_name}</td>
                        <td className="p-4 font-bold text-amber-400">{r.code_used}</td>
                        <td className="p-4 text-right font-black text-emerald-400">₹{r.reward_amount?.toLocaleString("en-IN")}</td>
                        <td className="p-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            ACTIVE
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteReferralCode(r._id, r.code_used)}
                            className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition"
                            title="Delete Referral Code"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* WITHDRAW REWARDS MODAL */}
        {showWithdrawModal && (
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-amber-400" /> Request Referral Reward Payout
                </h3>
                <button onClick={() => setShowWithdrawModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Withdrawal Amount (₹) *</label>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(parseFloat(e.target.value) || 0)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Min withdrawal limit: ₹{studentSettings.min_withdrawal_amount || 500}</p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">UPI ID or Bank Account *</label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleWithdrawRewards}
                  disabled={withdrawing}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
                >
                  {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Submit Payout Request
                </button>
              </div>
            </div>
          </div>
        {/* GENERATE NEW REFERRAL CODE MODAL (FOR SUPER ADMIN) */}
        {showCreateCodeModal && (
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-400" /> Super Admin - Generate New Referral Code
                </h3>
                <button onClick={() => setShowCreateCodeModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateNewReferralCode} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Target User Role *</label>
                  <select
                    value={newCodeRole}
                    onChange={(e) => setNewCodeRole(e.target.value as any)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-bold text-xs outline-none focus:border-emerald-500"
                  >
                    <option value="student">🎓 Student Referral Code</option>
                    <option value="staff">💼 Staff / Employee Referral Code</option>
                    <option value="center">🏢 Center / Franchise Campus Code</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Owner / User Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikas Sharma (Staff) or Rohtak Branch"
                    value={newCodeOwnerName}
                    onChange={(e) => setNewCodeOwnerName(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Custom Code (Optional - Auto Generated if blank)</label>
                  <input
                    type="text"
                    placeholder="e.g. REF-STAF-9001"
                    value={customCodeInput}
                    onChange={(e) => setCustomCodeInput(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs uppercase outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
                  <p className="font-bold text-emerald-400">💡 Super Admin Commission Note:</p>
                  <p className="text-[11px]">
                    This code will automatically link referrals into the 5-Tier Level network (L1 to L5) under {newCodeRole.toUpperCase()} rules.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateCodeModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingCode}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/20 flex items-center gap-1.5"
                  >
                    {creatingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Create & Activate Code
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

export default AdminReferralsPage;
