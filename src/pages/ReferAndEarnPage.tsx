import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Users, History, Copy, CheckCircle, IndianRupee, TrendingUp, Clock, Share2, Gift, Sparkles, ScrollText, Wallet } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface ReferralLevel {
  level_number: number;
  level_name: string;
  reward_amount: number;
  required_referrals: number;
  condition_text: string;
}

interface ReferralBonus {
  bonus_name: string;
  reward_name: string;
  reward_amount: number;
  required_referrals: number;
  terms_and_conditions: string;
  bonus_pic?: string | null;
}

interface ReferralSettings {
  target_role: string;
  levels: ReferralLevel[];
  instructions: string[];
  bonuses: ReferralBonus[];
  max_child_depth?: number | null;
  child_rewards: number[];
  max_rewarded_referrals?: number | null;
  min_withdrawal_amount?: number | null;
  activation_percentage?: number | null;
  default_reward_amount: number;
}

interface ReferralDashboardData {
  referral_code: string;
  total_direct_referrals: number;
  reward_earned: number;
  reward_pending: number;
  reward_withdrawn: number;
  current_level?: number | null;
  current_level_name?: string | null;
  remaining_to_next_level?: number | null;
  settings?: ReferralSettings | null;
}

interface ReferralStat {
  referral_code: string;
  total_referrals: number;
  total_rewards: number;
  pending_rewards: number;
  withdrawn_rewards: number;
  current_level?: number | null;
  current_level_name?: string | null;
  next_level_referrals?: number | null;
  settings?: ReferralSettings | null;
}

interface ReferredUser {
  id: string;
  name: string;
  status: "pending" | "activated" | "reward_given" | "expired" | "rejected";
  joined_date: string;
  reward_amount?: number;
}

interface ReferralTransaction {
  id: string;
  amount: number;
  type: "credit" | "debit";
  status: string;
  date: string;
  description?: string;
}

interface WithdrawalMethod {
  method_type: "upi" | "bank";
  upi_id?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  account_holder_name?: string;
}

const levelColors = [
  "from-pink-500 via-rose-500 to-orange-500",
  "from-violet-500 via-purple-500 to-fuchsia-500",
  "from-sky-500 via-cyan-500 to-blue-500",
  "from-emerald-500 via-green-500 to-lime-500",
  "from-amber-500 via-yellow-500 to-orange-500",
];

const ReferAndEarnPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReferralStat | null>(null);
  const [referredUsers, setReferredUsers] = useState<ReferredUser[]>([]);
  const [transactions, setTransactions] = useState<ReferralTransaction[]>([]);
  const [withdrawalMethod, setWithdrawalMethod] = useState<WithdrawalMethod | null>(null);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, transactionsRes, methodRes] = await Promise.all([
        apiFetch("/api/referrals/dashboard"),
        apiFetch("/api/referrals/referred"),
        apiFetch("/api/referrals/transactions"),
        apiFetch("/api/referrals/withdrawal-method"),
      ]);

      if (statsRes.ok) {
        const data = (await statsRes.json()) as ReferralDashboardData | null;
        setStats({
          referral_code: data?.referral_code || "",
          total_referrals: data?.total_direct_referrals || 0,
          total_rewards: data?.reward_earned || 0,
          pending_rewards: data?.reward_pending || 0,
          withdrawn_rewards: data?.reward_withdrawn || 0,
          current_level: data?.current_level,
          current_level_name: data?.current_level_name,
          next_level_referrals: data?.remaining_to_next_level,
          settings: data?.settings || null,
        });
      }

      if (usersRes.ok) {
        setReferredUsers(await usersRes.json());
      }

      if (transactionsRes.ok) {
        const rawTransactions = await transactionsRes.json();
        setTransactions(
          Array.isArray(rawTransactions)
            ? rawTransactions.map((tx) => ({
                id: tx.id || tx._id || `${tx.created_at}-${tx.amount}`,
                amount: Number(tx.amount || 0),
                type: tx.transaction_type === "debit" ? "debit" : "credit",
                status: tx.status || (tx.transaction_type === "debit" ? "pending" : "completed"),
                date: tx.date || tx.created_at,
                description: tx.description || t("Referral transaction"),
              }))
            : [],
        );
      }

      if (methodRes.ok) {
        setWithdrawalMethod(await methodRes.json());
      }
    } catch (error) {
      console.error("Error fetching referral data:", error);
      toast.error(t("Failed to load referral data"));
    } finally {
      setLoading(false);
    }
  };

  const availableBalance = useMemo(() => {
    if (!stats) return 0;
    return Math.max(0, stats.total_rewards - stats.withdrawn_rewards);
  }, [stats]);

  const copyReferralCode = () => {
    if (stats?.referral_code) {
      void navigator.clipboard.writeText(stats.referral_code);
      toast.success(t("Referral code copied"));
    }
  };

  const saveWithdrawalMethod = async (method: WithdrawalMethod) => {
    try {
      const res = await apiFetch("/api/referrals/withdrawal-method", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(method),
      });
      if (!res.ok) {
        throw new Error("save failed");
      }
      setWithdrawalMethod(method);
      toast.success(t("Withdrawal method saved"));
    } catch (error) {
      console.error("Error saving withdrawal method:", error);
      toast.error(t("Failed to save withdrawal method"));
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    const minWithdrawal = stats?.settings?.min_withdrawal_amount ?? 0;

    if (!withdrawalMethod) {
      toast.error(t("Please set a withdrawal method first"));
      return;
    }
    if (!amount || amount <= 0) {
      toast.error(t("Please enter a valid amount"));
      return;
    }
    if (amount > availableBalance) {
      toast.error(t("Amount exceeds available balance"));
      return;
    }
    if (minWithdrawal > 0 && amount < minWithdrawal) {
      toast.error(t("Minimum withdrawal amount is ₹{{amount}}", { amount: minWithdrawal }));
      return;
    }

    try {
      const res = await apiFetch("/api/referrals/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, method: withdrawalMethod }),
      });
      if (!res.ok) {
        throw new Error("withdraw failed");
      }
      toast.success(t("Withdrawal request submitted"));
      setShowWithdrawDialog(false);
      setWithdrawAmount("");
      await fetchData();
    } catch (error) {
      console.error("Error submitting withdrawal:", error);
      toast.error(t("Failed to submit withdrawal"));
    }
  };

  const statusColors = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    activated: "bg-blue-100 text-blue-700 border-blue-200",
    reward_given: "bg-green-100 text-green-700 border-green-200",
    expired: "bg-gray-100 text-gray-700 border-gray-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
  };

  const statusLabels = {
    pending: t("Pending"),
    activated: t("Activated"),
    reward_given: t("Reward Given"),
    expired: t("Expired"),
    rejected: t("Rejected"),
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-black text-3xl text-foreground flex items-center gap-3">
              <Trophy className="w-8 h-8 text-primary" />
              {t("Refer & Earn")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t("Invite people, unlock referral levels, claim bonuses, and withdraw your referral rewards.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setActiveTab("transactions")} className="rounded-2xl">
              <History className="w-4 h-4 mr-2" />
              {t("Transaction History")}
            </Button>
            <Button
              onClick={() => setShowWithdrawDialog(true)}
              disabled={availableBalance <= 0}
              className="rounded-2xl font-black text-xs uppercase tracking-[0.2em]"
            >
              <IndianRupee className="w-4 h-4 mr-2" />
              {t("Withdraw")}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" onValueChange={setActiveTab} value={activeTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="overview">{t("Overview")}</TabsTrigger>
            <TabsTrigger value="referred">{t("Referred Users")}</TabsTrigger>
            <TabsTrigger value="transactions">{t("Transactions")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="rounded-2xl border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-xl">
                      <Trophy className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-muted-foreground">{t("Rewards Earned")}</p>
                      <p className="text-2xl font-black text-foreground">₹{stats?.total_rewards?.toLocaleString() || "0"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-100 rounded-xl">
                      <Clock className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-muted-foreground">{t("Pending Rewards")}</p>
                      <p className="text-2xl font-black text-foreground">₹{stats?.pending_rewards?.toLocaleString() || "0"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-100 rounded-xl">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-muted-foreground">{t("Withdrawn Rewards")}</p>
                      <p className="text-2xl font-black text-foreground">₹{stats?.withdrawn_rewards?.toLocaleString() || "0"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 rounded-xl">
                      <Wallet className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-muted-foreground">{t("Available Balance")}</p>
                      <p className="text-2xl font-black text-foreground">₹{availableBalance.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="rounded-2xl border-border overflow-hidden lg:col-span-2">
                <CardHeader className="bg-muted/30 border-b">
                  <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3">
                    <Share2 className="w-5 h-5 text-primary" />
                    {t("Your Referral Code")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row items-stretch gap-4">
                    <div className="flex-1 p-4 bg-white rounded-xl border-2 border-dashed border-primary/30">
                      <p className="font-mono text-2xl font-black text-foreground">{stats?.referral_code || "---"}</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        {t("Share this code with eligible users to earn rewards when they activate their account.")}
                      </p>
                    </div>
                    <Button onClick={copyReferralCode} className="h-auto min-h-16 px-8 rounded-xl font-black text-xs uppercase tracking-[0.2em]">
                      <Copy className="w-4 h-4 mr-2" />
                      {t("Copy Code")}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border overflow-hidden">
                <CardHeader className="bg-muted/30 border-b">
                  <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    {t("Current Progress")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground">{t("Current Level")}</p>
                    <p className="text-xl font-black text-foreground">{stats?.current_level_name || t("Starter")}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground">{t("Total Referrals")}</p>
                    <p className="text-xl font-black text-foreground">{stats?.total_referrals || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground">{t("Next Milestone")}</p>
                    <p className="text-sm font-medium text-foreground">
                      {stats?.next_level_referrals
                        ? t("Need {{count}} more referrals for the next level", { count: stats.next_level_referrals })
                        : t("You are at the highest configured level or no next level is set yet.")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {stats?.settings?.levels?.length ? (
              <Card className="rounded-2xl border-border overflow-hidden">
                <CardHeader className="bg-muted/30 border-b">
                  <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-primary" />
                    {t("Referral Levels")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="relative">
                    <div className="hidden lg:block absolute left-0 right-0 top-7 h-1 rounded-full bg-gradient-to-r from-pink-500 via-violet-500 via-sky-500 to-emerald-500" />
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 relative">
                      {stats.settings.levels.map((level, index) => {
                        const active = (stats.current_level || 0) >= level.level_number;
                        return (
                          <div
                            key={`${level.level_number}-${level.level_name}`}
                            className={`rounded-2xl border p-5 bg-white shadow-sm ${active ? "border-primary/30" : "border-border"}`}
                          >
                            <div className={`h-3 w-full rounded-full mb-4 bg-gradient-to-r ${levelColors[index % levelColors.length]}`} />
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-bold uppercase text-muted-foreground">{t("Level {{n}}", { n: level.level_number })}</p>
                                <p className="text-lg font-black text-foreground">{level.level_name}</p>
                              </div>
                              {active ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0" /> : null}
                            </div>
                            <div className="mt-4 space-y-2">
                              <p className="text-sm font-semibold text-foreground">
                                {t("Reward")}: ₹{level.reward_amount.toLocaleString()}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {t("Required Referrals")}: {level.required_referrals}
                              </p>
                              {level.condition_text ? (
                                <p className="text-sm text-muted-foreground">
                                  {t("Condition")}: {level.condition_text}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="rounded-2xl border-border overflow-hidden">
                <CardHeader className="bg-muted/30 border-b">
                  <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3">
                    <ScrollText className="w-5 h-5 text-primary" />
                    {t("Instructions & Conditions")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {stats?.settings?.instructions?.length ? (
                    <div className="space-y-3">
                      {stats.settings.instructions
                        .filter((instruction) => instruction.trim().length > 0)
                        .map((instruction, index) => (
                          <div key={`${index}-${instruction}`} className="rounded-xl border bg-muted/20 px-4 py-3">
                            <p className="text-sm text-foreground">
                              <span className="font-black mr-2">{index + 1}.</span>
                              {instruction}
                            </p>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("No instructions have been configured yet.")}</p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl border bg-white p-4">
                      <p className="text-xs font-bold uppercase text-muted-foreground">{t("Default Reward")}</p>
                      <p className="text-lg font-black text-foreground">₹{stats?.settings?.default_reward_amount?.toLocaleString() || 0}</p>
                    </div>
                    <div className="rounded-xl border bg-white p-4">
                      <p className="text-xs font-bold uppercase text-muted-foreground">{t("Minimum Withdrawal")}</p>
                      <p className="text-lg font-black text-foreground">₹{stats?.settings?.min_withdrawal_amount?.toLocaleString() || 0}</p>
                    </div>
                    {stats?.settings?.activation_percentage ? (
                      <div className="rounded-xl border bg-white p-4">
                        <p className="text-xs font-bold uppercase text-muted-foreground">{t("Activation Rule")}</p>
                        <p className="text-sm font-semibold text-foreground">
                          {t("Reward activates after {{percent}}% completion", { percent: stats.settings.activation_percentage })}
                        </p>
                      </div>
                    ) : null}
                    {typeof stats?.settings?.max_rewarded_referrals === "number" ? (
                      <div className="rounded-xl border bg-white p-4">
                        <p className="text-xs font-bold uppercase text-muted-foreground">{t("Reward Cap")}</p>
                        <p className="text-sm font-semibold text-foreground">
                          {t("Up to {{count}} rewarded referrals", { count: stats.settings.max_rewarded_referrals })}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border overflow-hidden">
                <CardHeader className="bg-muted/30 border-b">
                  <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3">
                    <IndianRupee className="w-5 h-5 text-primary" />
                    {t("Withdrawal Method")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {withdrawalMethod ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-muted/30 rounded-xl border border-border">
                        <p className="text-sm font-bold mb-2">
                          {withdrawalMethod.method_type === "upi" ? t("UPI ID") : t("Bank Account")}
                        </p>
                        {withdrawalMethod.method_type === "upi" ? (
                          <p className="text-muted-foreground">{withdrawalMethod.upi_id}</p>
                        ) : (
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <p>{t("Bank")}: {withdrawalMethod.bank_name}</p>
                            <p>{t("Account Holder")}: {withdrawalMethod.account_holder_name}</p>
                            <p>{t("Account Number")}: {withdrawalMethod.account_number}</p>
                            <p>{t("IFSC")}: {withdrawalMethod.ifsc_code}</p>
                          </div>
                        )}
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="rounded-xl">
                            {t("Change Method")}
                          </Button>
                        </DialogTrigger>
                        <WithdrawalMethodForm initialMethod={withdrawalMethod} onSave={saveWithdrawalMethod} />
                      </Dialog>
                    </div>
                  ) : (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button className="rounded-xl">{t("Set Withdrawal Method")}</Button>
                      </DialogTrigger>
                      <WithdrawalMethodForm onSave={saveWithdrawalMethod} />
                    </Dialog>
                  )}
                </CardContent>
              </Card>
            </div>

            {stats?.settings?.bonuses?.length ? (
              <Card className="rounded-2xl border-border overflow-hidden">
                <CardHeader className="bg-muted/30 border-b">
                  <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3">
                    <Gift className="w-5 h-5 text-primary" />
                    {t("Bonus Rewards")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {stats.settings.bonuses.map((bonus, index) => (
                      <Card key={`${bonus.bonus_name}-${index}`} className="rounded-2xl border-border overflow-hidden">
                        {bonus.bonus_pic ? (
                          <img src={bonus.bonus_pic} alt={bonus.bonus_name} className="h-40 w-full object-cover" />
                        ) : (
                          <div className={`h-40 w-full bg-gradient-to-r ${levelColors[index % levelColors.length]}`} />
                        )}
                        <CardContent className="p-5 space-y-3">
                          <div>
                            <p className="text-xs font-bold uppercase text-muted-foreground">{t("Bonus")}</p>
                            <p className="text-lg font-black text-foreground">{bonus.bonus_name}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">
                              {bonus.reward_name || t("Reward")}: ₹{bonus.reward_amount.toLocaleString()}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {t("Required Referrals")}: {bonus.required_referrals}
                            </p>
                          </div>
                          {bonus.terms_and_conditions ? (
                            <p className="text-sm text-muted-foreground">{bonus.terms_and_conditions}</p>
                          ) : null}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="referred" className="space-y-4">
            {referredUsers.length === 0 ? (
              <Card className="rounded-2xl border-border">
                <CardContent className="p-12 text-center">
                  <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-bold text-foreground">{t("No referrals yet")}</p>
                  <p className="text-muted-foreground text-sm mt-2">{t("Share your referral code to start earning")}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {referredUsers.map((user) => (
                  <Card key={user.id} className="rounded-2xl border-border">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-bold text-foreground">{user.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {t("Joined")} {new Date(user.joined_date).toLocaleDateString()}
                          </p>
                          {typeof user.reward_amount === "number" ? (
                            <p className="text-sm font-bold text-primary mt-1">₹{user.reward_amount.toLocaleString()}</p>
                          ) : null}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${statusColors[user.status]}`}>
                          {statusLabels[user.status]}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4">
            {transactions.length === 0 ? (
              <Card className="rounded-2xl border-border">
                <CardContent className="p-12 text-center">
                  <History className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-bold text-foreground">{t("No transactions yet")}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <Card key={tx.id} className="rounded-2xl border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-bold text-foreground">{tx.description}</p>
                          <p className="text-sm text-muted-foreground">{new Date(tx.date).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-black ${tx.type === "credit" ? "text-green-600" : "text-red-600"}`}>
                            {tx.type === "credit" ? "+" : "-"}₹{tx.amount.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground uppercase">{tx.status}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
          <DialogContent className="rounded-2xl border-border">
            <DialogHeader>
              <DialogTitle className="font-heading font-black text-xl">{t("Withdraw Rewards")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="withdraw-amount">{t("Amount (₹)")}</Label>
                <Input
                  id="withdraw-amount"
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder={t("Enter withdrawal amount")}
                  min={stats?.settings?.min_withdrawal_amount || 1}
                  max={availableBalance}
                />
                <p className="text-xs text-muted-foreground">
                  {t("Available balance")}: ₹{availableBalance.toLocaleString()}
                </p>
                {stats?.settings?.min_withdrawal_amount ? (
                  <p className="text-xs text-muted-foreground">
                    {t("Minimum withdrawal")}: ₹{stats.settings.min_withdrawal_amount.toLocaleString()}
                  </p>
                ) : null}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleWithdraw}>{t("Withdraw")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

interface WithdrawalMethodFormProps {
  initialMethod?: WithdrawalMethod | null;
  onSave: (method: WithdrawalMethod) => void;
}

const WithdrawalMethodForm = ({ initialMethod, onSave }: WithdrawalMethodFormProps) => {
  const { t } = useTranslation();
  const [methodType, setMethodType] = useState<"upi" | "bank">(initialMethod?.method_type || "upi");
  const [upiId, setUpiId] = useState(initialMethod?.upi_id || "");
  const [bankName, setBankName] = useState(initialMethod?.bank_name || "");
  const [accountNumber, setAccountNumber] = useState(initialMethod?.account_number || "");
  const [ifscCode, setIfscCode] = useState(initialMethod?.ifsc_code || "");
  const [accountHolderName, setAccountHolderName] = useState(initialMethod?.account_holder_name || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (methodType === "upi") {
      onSave({ method_type: methodType, upi_id: upiId });
    } else {
      onSave({
        method_type: methodType,
        bank_name: bankName,
        account_number: accountNumber,
        ifsc_code: ifscCode,
        account_holder_name: accountHolderName,
      });
    }
  };

  return (
    <DialogContent className="rounded-2xl border-border">
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle className="font-heading font-black text-xl">{t("Set Withdrawal Method")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t("Method Type")}</Label>
            <Select value={methodType} onValueChange={(value: "upi" | "bank") => setMethodType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upi">{t("UPI")}</SelectItem>
                <SelectItem value="bank">{t("Bank Transfer")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {methodType === "upi" ? (
            <div className="space-y-2">
              <Label htmlFor="upi-id">{t("UPI ID")}</Label>
              <Input id="upi-id" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="example@upi" required />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="account-holder">{t("Account Holder Name")}</Label>
                <Input id="account-holder" value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank-name">{t("Bank Name")}</Label>
                <Input id="bank-name" value={bankName} onChange={(e) => setBankName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-number">{t("Account Number")}</Label>
                <Input id="account-number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ifsc-code">{t("IFSC Code")}</Label>
                <Input id="ifsc-code" value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} required />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogTrigger asChild>
            <Button variant="outline" type="button">
              {t("Cancel")}
            </Button>
          </DialogTrigger>
          <Button type="submit">{t("Save Method")}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

export default ReferAndEarnPage;
