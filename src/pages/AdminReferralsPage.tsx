import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Loader2, Search, Users, Settings, Plus, Trash2, Save, CheckCircle2, Clock, Gift, Upload, DollarSign, Percent } from "lucide-react";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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

interface ReferralBonus {
  bonus_name: string;
  reward_name: string;
  reward_amount: number;
  required_referrals: number;
  terms_and_conditions: string;
  bonus_pic?: string | null;
}

interface ReferralSettings {
  _id?: string;
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
  payout_model?: "flat" | "percentage" | string;
  flat_amount?: number | null;
  percentage_rate?: number | null;
  franchise_base_fee?: number | null;
  created_at: string;
  updated_at: string;
}

type ReferralSettingsSetter = Dispatch<SetStateAction<ReferralSettings | null>>;

const createDefaultSettings = (role: string): ReferralSettings => ({
  target_role: role,
  levels: [],
  instructions: [],
  bonuses: [],
  child_rewards: [],
  default_reward_amount: 0,
  payout_model: "flat",
  flat_amount: 5000,
  percentage_rate: 10,
  franchise_base_fee: 50000,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const createLevel = (index: number): ReferralLevel => ({
  level_number: index + 1,
  level_name: `Level ${index + 1}`,
  reward_amount: 0,
  required_referrals: 0,
  condition_text: "",
});

const createBonus = (): ReferralBonus => ({
  bonus_name: "",
  reward_name: "",
  reward_amount: 0,
  required_referrals: 0,
  terms_and_conditions: "",
  bonus_pic: "",
});

const AdminReferralsPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("student");
  const [studentSettings, setStudentSettings] = useState<ReferralSettings | null>(null);
  const [centerSettings, setCenterSettings] = useState<ReferralSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingBonusKey, setUploadingBonusKey] = useState<string | null>(null);

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [referralsRes, studentSettingsRes, centerSettingsRes] = await Promise.all([
        apiFetch("/api/admin/referrals"),
        apiFetch("/api/admin/referral-settings/student"),
        apiFetch("/api/admin/referral-settings/center"),
      ]);
      if (referralsRes.ok) {
        const data = await referralsRes.json();
        setReferrals(Array.isArray(data) ? data : []);
      }
      if (studentSettingsRes.ok) {
        const data = await studentSettingsRes.json();
        setStudentSettings(data || null);
      }
      if (centerSettingsRes.ok) {
        const data = await centerSettingsRes.json();
        setCenterSettings(data || null);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(t("Failed to load referral settings"));
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (settings: ReferralSettings) => {
    setSavingSettings(true);
    try {
      const res = await apiFetch("/api/admin/referral-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        throw new Error("Save failed");
      }

      toast.success(t("Referral configuration saved"));
      await fetchData();
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error(t("Failed to save referral configuration"));
    } finally {
      setSavingSettings(false);
    }
  };

  const uploadBonusImage = async (
    settings: ReferralSettings,
    setSettings: ReferralSettingsSetter,
    index: number,
    file: File,
  ) => {
    const formData = new FormData();
    const uploadKey = `${settings.target_role}-${index}`;
    formData.append("file", file);
    setUploadingBonusKey(uploadKey);

    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        throw new Error(data?.message || "Upload failed");
      }

      const bonuses = [...settings.bonuses];
      bonuses[index] = { ...bonuses[index], bonus_pic: data.url };
      setSettings({ ...settings, bonuses });
      toast.success(t("Bonus image uploaded"));
    } catch (error) {
      console.error("Error uploading bonus image:", error);
      toast.error(t("Failed to upload bonus image"));
    } finally {
      setUploadingBonusKey(null);
    }
  };

  const addInstruction = (settings: ReferralSettings, setSettings: ReferralSettingsSetter) => {
    setSettings({
      ...settings,
      instructions: [...settings.instructions, ""],
    });
  };

  const updateInstruction = (settings: ReferralSettings, setSettings: ReferralSettingsSetter, index: number, value: string) => {
    const instructions = [...settings.instructions];
    instructions[index] = value;
    setSettings({
      ...settings,
      instructions,
    });
  };

  const removeInstruction = (settings: ReferralSettings, setSettings: ReferralSettingsSetter, index: number) => {
    setSettings({
      ...settings,
      instructions: settings.instructions.filter((_, itemIndex) => itemIndex !== index),
    });
  };

  const addLevel = (settings: ReferralSettings, setSettings: ReferralSettingsSetter) => {
    setSettings({
      ...settings,
      levels: [...settings.levels, createLevel(settings.levels.length)],
    });
  };

  const removeLevel = (settings: ReferralSettings, setSettings: ReferralSettingsSetter, index: number) => {
    const levels = settings.levels
      .filter((_, itemIndex) => itemIndex !== index)
      .map((level, levelIndex) => ({ ...level, level_number: levelIndex + 1 }));
    setSettings({
      ...settings,
      levels,
    });
  };

  const updateLevel = (
    settings: ReferralSettings,
    setSettings: ReferralSettingsSetter,
    index: number,
    field: keyof ReferralLevel,
    value: string | number,
  ) => {
    const levels = [...settings.levels];
    levels[index] = { ...levels[index], [field]: value };
    setSettings({
      ...settings,
      levels,
    });
  };

  const addBonus = (settings: ReferralSettings, setSettings: ReferralSettingsSetter) => {
    setSettings({
      ...settings,
      bonuses: [...settings.bonuses, createBonus()],
    });
  };

  const updateBonus = (
    settings: ReferralSettings,
    setSettings: ReferralSettingsSetter,
    index: number,
    field: keyof ReferralBonus,
    value: string | number | null,
  ) => {
    const bonuses = [...settings.bonuses];
    bonuses[index] = { ...bonuses[index], [field]: value };
    setSettings({
      ...settings,
      bonuses,
    });
  };

  const removeBonus = (settings: ReferralSettings, setSettings: ReferralSettingsSetter, index: number) => {
    setSettings({
      ...settings,
      bonuses: settings.bonuses.filter((_, itemIndex) => itemIndex !== index),
    });
  };

  const filtered = referrals.filter(
    (r) =>
      !search ||
      r.code_used.toLowerCase().includes(search.toLowerCase()) ||
      r.referrer_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.referred_user_name?.toLowerCase().includes(search.toLowerCase()),
  );

  const renderSettings = (settings: ReferralSettings | null, setSettings: ReferralSettingsSetter, role: string) => {
    const currentSettings = settings || createDefaultSettings(role);

    return (
      <div className="space-y-6">
        <Card className="rounded-[2rem] border-border overflow-hidden shadow-xl bg-white/50 backdrop-blur-sm">
          <CardHeader className="bg-muted/30 border-b px-8 py-6">
            <div className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3 text-foreground/70">
                <Settings className="w-5 h-5 text-primary" />
                {t("Configuration")}
              </CardTitle>
              <Button onClick={() => void saveSettings(currentSettings)} disabled={savingSettings}>
                {savingSettings ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {t("Save Configuration")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            {role === "center" && (
              <div className="p-6 bg-gradient-to-br from-indigo-50/50 via-purple-50/30 to-blue-50/40 dark:from-indigo-950/20 dark:via-purple-950/10 dark:to-blue-950/20 border-2 border-indigo-200/60 dark:border-indigo-800/40 rounded-2xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-100 dark:border-indigo-900/50 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="text-lg font-bold text-foreground">
                        {t("Center Franchise Referral Commission (Audio Point #7)")}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("Configure payout model when an existing center refers a new franchise center.")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-background/80 p-1.5 rounded-xl border">
                    <Button
                      type="button"
                      size="sm"
                      variant={(currentSettings.payout_model || "flat") === "flat" ? "default" : "ghost"}
                      onClick={() => setSettings({ ...currentSettings, payout_model: "flat" })}
                      className="gap-1.5"
                    >
                      <DollarSign className="w-4 h-4" />
                      {t("Flat Amount")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={currentSettings.payout_model === "percentage" ? "default" : "ghost"}
                      onClick={() => setSettings({ ...currentSettings, payout_model: "percentage" })}
                      className="gap-1.5"
                    >
                      <Percent className="w-4 h-4" />
                      {t("Percentage (%)")}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {(currentSettings.payout_model || "flat") === "flat" ? (
                    <div className="space-y-2">
                      <Label htmlFor="flat-amount" className="font-semibold">
                        {t("Flat Commission Per Franchise Referral (₹)")}
                      </Label>
                      <Input
                        id="flat-amount"
                        type="number"
                        value={currentSettings.flat_amount ?? currentSettings.default_reward_amount}
                        onChange={(e) =>
                          setSettings({
                            ...currentSettings,
                            flat_amount: parseFloat(e.target.value) || 0,
                            default_reward_amount: parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="e.g. 5000"
                        className="bg-background"
                      />
                      <p className="text-xs text-muted-foreground">{t("Credited instantly to center wallet on new center activation")}</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="percentage-rate" className="font-semibold">
                          {t("Commission Rate (%)")}
                        </Label>
                        <Input
                          id="percentage-rate"
                          type="number"
                          value={currentSettings.percentage_rate ?? 10}
                          onChange={(e) =>
                            setSettings({
                              ...currentSettings,
                              percentage_rate: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="e.g. 10"
                          className="bg-background"
                        />
                        <p className="text-xs text-muted-foreground">{t("Percentage of Franchise Base Fee")}</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="franchise-base-fee" className="font-semibold">
                          {t("Franchise Base Fee (₹)")}
                        </Label>
                        <Input
                          id="franchise-base-fee"
                          type="number"
                          value={currentSettings.franchise_base_fee ?? 50000}
                          onChange={(e) =>
                            setSettings({
                              ...currentSettings,
                              franchise_base_fee: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="e.g. 50000"
                          className="bg-background"
                        />
                        <p className="text-xs text-muted-foreground">{t("Standard fee charged for new center onboarding")}</p>
                      </div>
                    </>
                  )}

                  <div className="space-y-2 md:col-span-1">
                    <Label className="font-semibold">{t("Commission Payout Simulation")}</Label>
                    <div className="p-4 rounded-xl bg-background border shadow-sm space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t("Model")}:</span>
                        <Badge variant="outline" className="capitalize">
                          {currentSettings.payout_model || "flat"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t("Per Onboarded Center")}:</span>
                        <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                          ₹
                          {currentSettings.payout_model === "percentage"
                            ? Math.round(
                                ((currentSettings.percentage_rate ?? 10) / 100) *
                                  (currentSettings.franchise_base_fee ?? 50000),
                              ).toLocaleString("en-IN")
                            : (
                                currentSettings.flat_amount ?? currentSettings.default_reward_amount
                              ).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground pt-1 border-t">
                        {t("Auto-credited to referring Center's wallet on verification.")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor={`${role}-defaultReward`}>{t("Default Reward Amount (₹)")}</Label>
                <Input
                  id={`${role}-defaultReward`}
                  type="number"
                  value={currentSettings.default_reward_amount}
                  onChange={(e) => setSettings({ ...currentSettings, default_reward_amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${role}-activationPercentage`}>{t("Activation Percentage (%)")}</Label>
                <Input
                  id={`${role}-activationPercentage`}
                  type="number"
                  value={currentSettings.activation_percentage ?? ""}
                  onChange={(e) => setSettings({ ...currentSettings, activation_percentage: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${role}-minWithdrawal`}>{t("Minimum Withdrawal Amount (₹)")}</Label>
                <Input
                  id={`${role}-minWithdrawal`}
                  type="number"
                  value={currentSettings.min_withdrawal_amount ?? ""}
                  onChange={(e) => setSettings({ ...currentSettings, min_withdrawal_amount: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${role}-maxRewarded`}>{t("Max Rewarded Referrals")}</Label>
                <Input
                  id={`${role}-maxRewarded`}
                  type="number"
                  value={currentSettings.max_rewarded_referrals ?? ""}
                  onChange={(e) => setSettings({ ...currentSettings, max_rewarded_referrals: e.target.value ? parseInt(e.target.value, 10) : null })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${role}-maxChildDepth`}>{t("Max Child Referral Depth")}</Label>
                <Input
                  id={`${role}-maxChildDepth`}
                  type="number"
                  value={currentSettings.max_child_depth ?? ""}
                  onChange={(e) => setSettings({ ...currentSettings, max_child_depth: e.target.value ? parseInt(e.target.value, 10) : null })}
                />
                <p className="text-xs text-muted-foreground">{t("Leave empty for unlimited")}</p>
              </div>
              <div className="space-y-2">
                <Label>{t("Child Referral Rewards")}</Label>
                <div className="space-y-2">
                  {currentSettings.child_rewards.map((reward, index) => (
                    <div key={`${role}-child-reward-${index}`} className="flex gap-2">
                      <Input
                        type="number"
                        value={reward}
                        onChange={(e) => {
                          const childRewards = [...currentSettings.child_rewards];
                          childRewards[index] = parseFloat(e.target.value) || 0;
                          setSettings({ ...currentSettings, child_rewards: childRewards });
                        }}
                        placeholder={t("Child level {{n}} reward", { n: index + 1 })}
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setSettings({
                            ...currentSettings,
                            child_rewards: currentSettings.child_rewards.filter((_, itemIndex) => itemIndex !== index),
                          });
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSettings({ ...currentSettings, child_rewards: [...currentSettings.child_rewards, 0] })}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t("Add Child Reward Level")}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-lg">{t("Instructions")}</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("These instructions will be shown on the refer and earn page for this role.")}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => addInstruction(currentSettings, setSettings)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t("Add Instruction")}
                </Button>
              </div>
              {currentSettings.instructions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground border border-dashed rounded-2xl">
                  {t("No instructions added yet.")}
                </div>
              ) : (
                <div className="space-y-3">
                  {currentSettings.instructions.map((instruction, index) => (
                    <div key={`${role}-instruction-${index}`} className="flex items-start gap-3">
                      <Textarea
                        value={instruction}
                        onChange={(e) => updateInstruction(currentSettings, setSettings, index, e.target.value)}
                        placeholder={t("Enter instruction {{n}}", { n: index + 1 })}
                        className="min-h-[90px]"
                      />
                      <Button type="button" variant="destructive" size="sm" onClick={() => removeInstruction(currentSettings, setSettings, index)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex flex-row items-center justify-between">
                <div>
                  <Label className="text-lg">{t("Referral Levels")}</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("These levels, rewards, and conditions will be shown to users in their refer and earn page.")}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => addLevel(currentSettings, setSettings)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t("Add Level")}
                </Button>
              </div>
              {currentSettings.levels.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-2xl">
                  {t("No levels configured yet. Add your first level to get started.")}
                </div>
              ) : (
                <div className="space-y-4">
                  {currentSettings.levels.map((level, index) => (
                    <Card key={`${role}-level-${index}`} className="p-6">
                      <div className="flex flex-row items-start justify-between gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                          <div className="space-y-2">
                            <Label htmlFor={`${role}-levelName-${index}`}>{t("Level Name")}</Label>
                            <Input
                              id={`${role}-levelName-${index}`}
                              value={level.level_name}
                              onChange={(e) => updateLevel(currentSettings, setSettings, index, "level_name", e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`${role}-levelReward-${index}`}>{t("Reward Amount (₹)")}</Label>
                            <Input
                              id={`${role}-levelReward-${index}`}
                              type="number"
                              value={level.reward_amount}
                              onChange={(e) => updateLevel(currentSettings, setSettings, index, "reward_amount", parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`${role}-levelRequired-${index}`}>{t("Required Referrals")}</Label>
                            <Input
                              id={`${role}-levelRequired-${index}`}
                              type="number"
                              value={level.required_referrals}
                              onChange={(e) => updateLevel(currentSettings, setSettings, index, "required_referrals", parseInt(e.target.value, 10) || 0)}
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor={`${role}-levelCondition-${index}`}>{t("Level Condition")}</Label>
                            <Textarea
                              id={`${role}-levelCondition-${index}`}
                              value={level.condition_text}
                              onChange={(e) => updateLevel(currentSettings, setSettings, index, "condition_text", e.target.value)}
                              placeholder={t("Explain how this level is achieved and when the reward is unlocked")}
                              className="min-h-[90px]"
                            />
                          </div>
                        </div>
                        <Button type="button" variant="destructive" size="sm" onClick={() => removeLevel(currentSettings, setSettings, index)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-lg">{t("Bonuses")}</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("Add milestone bonuses with reward details, terms, and an optional image.")}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => addBonus(currentSettings, setSettings)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t("Add Bonus")}
                </Button>
              </div>
              {currentSettings.bonuses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-2xl">
                  {t("No bonuses added yet.")}
                </div>
              ) : (
                <div className="space-y-4">
                  {currentSettings.bonuses.map((bonus, index) => {
                    const uploadKey = `${currentSettings.target_role}-${index}`;
                    return (
                      <Card key={`${role}-bonus-${index}`} className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                            <div className="space-y-2">
                              <Label htmlFor={`${role}-bonusName-${index}`}>{t("Bonus Name")}</Label>
                              <Input
                                id={`${role}-bonusName-${index}`}
                                value={bonus.bonus_name}
                                onChange={(e) => updateBonus(currentSettings, setSettings, index, "bonus_name", e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`${role}-rewardName-${index}`}>{t("Reward Name")}</Label>
                              <Input
                                id={`${role}-rewardName-${index}`}
                                value={bonus.reward_name}
                                onChange={(e) => updateBonus(currentSettings, setSettings, index, "reward_name", e.target.value)}
                                placeholder={t("Example: Cash Bonus, Gift Voucher")}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`${role}-rewardAmount-${index}`}>{t("Reward Amount (₹)")}</Label>
                              <Input
                                id={`${role}-rewardAmount-${index}`}
                                type="number"
                                value={bonus.reward_amount}
                                onChange={(e) => updateBonus(currentSettings, setSettings, index, "reward_amount", parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`${role}-bonusRequired-${index}`}>{t("Required Referrals")}</Label>
                              <Input
                                id={`${role}-bonusRequired-${index}`}
                                type="number"
                                value={bonus.required_referrals}
                                onChange={(e) => updateBonus(currentSettings, setSettings, index, "required_referrals", parseInt(e.target.value, 10) || 0)}
                              />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <Label htmlFor={`${role}-bonusTerms-${index}`}>{t("Terms & Conditions")}</Label>
                              <Textarea
                                id={`${role}-bonusTerms-${index}`}
                                value={bonus.terms_and_conditions}
                                onChange={(e) => updateBonus(currentSettings, setSettings, index, "terms_and_conditions", e.target.value)}
                                className="min-h-[100px]"
                              />
                            </div>
                            <div className="space-y-3 md:col-span-2">
                              <Label>{t("Bonus Picture (Optional)")}</Label>
                              {bonus.bonus_pic ? (
                                <div className="rounded-2xl border overflow-hidden bg-muted/20">
                                  <img src={bonus.bonus_pic} alt={bonus.bonus_name || "Bonus"} className="h-40 w-full object-cover" />
                                </div>
                              ) : null}
                              <div className="flex flex-col md:flex-row gap-3">
                                <label className="inline-flex">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        void uploadBonusImage(currentSettings, setSettings, index, file);
                                      }
                                    }}
                                  />
                                  <span className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium cursor-pointer">
                                    {uploadingBonusKey === uploadKey ? (
                                      <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        {t("Uploading...")}
                                      </>
                                    ) : (
                                      <>
                                        <Upload className="w-4 h-4 mr-2" />
                                        {t("Upload Bonus Image")}
                                      </>
                                    )}
                                  </span>
                                </label>
                                <Input
                                  value={bonus.bonus_pic || ""}
                                  onChange={(e) => updateBonus(currentSettings, setSettings, index, "bonus_pic", e.target.value)}
                                  placeholder={t("Or paste bonus image URL")}
                                />
                                {bonus.bonus_pic ? (
                                  <Button type="button" variant="outline" onClick={() => updateBonus(currentSettings, setSettings, index, "bonus_pic", "")}>
                                    {t("Remove Image")}
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          <Button type="button" variant="destructive" size="sm" onClick={() => removeBonus(currentSettings, setSettings, index)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="font-heading font-black text-3xl text-foreground uppercase tracking-tight flex items-center gap-3">
              <Trophy className="w-8 h-8 text-primary" />
              {t("Referral Management")}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              {t("Configure and monitor all student and center referrals across the platform.")}
            </p>
          </div>

          <div className="flex items-center gap-4 bg-primary/5 p-4 rounded-2xl border border-primary/10">
            <div className="text-right">
              <div className="text-2xl font-black text-primary tracking-tight">₹{referrals.reduce((acc, curr) => acc + curr.reward_amount, 0).toLocaleString()}</div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t("Total Rewards Distributed")}</p>
            </div>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("Search by code, referrer or referred user...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-12 h-14 rounded-2xl border-border shadow-sm font-medium"
          />
        </div>

        <Tabs defaultValue="student" onValueChange={setActiveTab} value={activeTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="student">{t("Student Referral")}</TabsTrigger>
            <TabsTrigger value="center">{t("Center Referral")}</TabsTrigger>
          </TabsList>
          <TabsContent value="student" className="space-y-6">
            {renderSettings(studentSettings, setStudentSettings, "student")}
          </TabsContent>
          <TabsContent value="center" className="space-y-6">
            {renderSettings(centerSettings, setCenterSettings, "center")}
          </TabsContent>
        </Tabs>

        <Card className="rounded-[2rem] border-border overflow-hidden shadow-xl bg-white/50 backdrop-blur-sm">
          <CardHeader className="bg-muted/30 border-b px-8 py-6">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3 text-foreground/70">
              <Users className="w-5 h-5 text-primary" />
              {t("Referral History")} ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Loading Records...")}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-24 text-center flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                  <Search className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t("No referral records found.")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left px-8 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Date")}</th>
                      <th className="text-left px-8 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Referrer")}</th>
                      <th className="text-left px-8 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Referred User")}</th>
                      <th className="text-left px-8 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Code Used")}</th>
                      <th className="text-right px-8 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Reward")}</th>
                      <th className="text-center px-8 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...filtered]
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((r) => (
                        <tr key={r._id} className="border-b border-border/40 hover:bg-primary/5 transition-colors group">
                          <td className="px-8 py-6">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-foreground">{format(new Date(r.created_at), "dd MMM yyyy")}</span>
                              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">{format(new Date(r.created_at), "HH:mm")}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-foreground uppercase tracking-tight">{r.referrer_name || "Unknown"}</span>
                              <Badge variant="outline" className="w-fit text-[9px] font-black uppercase tracking-widest mt-1 bg-white">
                                {r.referrer_role || "User"}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-foreground uppercase tracking-tight">{r.referred_user_name || "Unknown"}</span>
                              <Badge variant="outline" className="w-fit text-[9px] font-black uppercase tracking-widest mt-1 bg-white">
                                {r.referred_user_role || "User"}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <code className="px-3 py-1 bg-muted rounded-lg text-xs font-black font-mono text-primary border border-border">
                              {r.code_used}
                            </code>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <div className="flex flex-col items-end">
                              <span className="text-sm font-black text-primary tracking-tight">₹{r.reward_amount}</span>
                              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{r.reward_type}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex justify-center">
                              {r.status === "RewardGiven" ? (
                                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">{t("Reward Given")}</span>
                                </div>
                              ) : r.status === "Activated" ? (
                                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">{t("Activated")}</span>
                                </div>
                              ) : r.status === "Rejected" ? (
                                <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-full border border-red-100">
                                  <Clock className="w-3 h-3" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">{t("Rejected")}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
                                  <Clock className="w-3 h-3" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">{t("Pending")}</span>
                                </div>
                              )}
                            </div>
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

export default AdminReferralsPage;
