import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MousePointer, Upload, Save, Loader2, Trash2, Sparkles, Image as ImageIcon, IdCard, AlertTriangle, Calendar, Globe, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { PUBLIC_SYSTEM_SETTINGS_QUERY_KEY } from "@/lib/publicSystemSettings";

export interface CountryFeeRule {
  country_code: string;
  country_name: string;
  currency_code: string;
  currency_symbol: string;
  multiplier: number;
}

interface SystemSettings {
  cursor_url?: string;
  is_messaging_wall_enabled: boolean;
  max_disk_space_gb: number;
  storage_warning_threshold: number;
  students_trained: number;
  courses_offered: number;
  placements_done: number;
  years_experience: number;
  popup_enabled: boolean;
  popup_title: string;
  popup_subtitle: string;
  popup_accent_text: string;
  popup_image_url: string;
  popup_bg_color: string;
  popup_text_color: string;
  popup_button_text: string;
  popup_button_link: string;
  auto_id_card_enabled?: boolean;
  auto_id_card_template_id?: string;
  auto_id_card_delay_minutes?: number;
  enrollment_prefix?: string;
  roll_number_prefix?: string;
  generate_roll_at_registration?: boolean;
  maintenance_mode: boolean;
  contact_phone: string;
  contact_email: string;
  contact_address: string;
  contact_map_url: string;
  payment_gateway_enabled?: boolean;
  razorpay_key_id?: string;
  razorpay_key_secret?: string;
  razorpay_webhook_secret?: string;
  country_fee_rules?: CountryFeeRule[];
}

const AdminSystemSettingsPage = () => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingPopup, setUploadingPopup] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const userStr = sessionStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;
  const isSuperAdmin = user?.role === "superadmin";

  const [form, setForm] = useState<Partial<SystemSettings>>({});
  const [newRule, setNewRule] = useState<CountryFeeRule>({
    country_code: "",
    country_name: "",
    currency_code: "",
    currency_symbol: "",
    multiplier: 1.0,
  });

  const handleAddCountryRule = () => {
    if (!newRule.country_code.trim() || !newRule.currency_code.trim()) {
      toast.error("Country code and currency code are required");
      return;
    }
    const currentRules = form.country_fee_rules ? [...form.country_fee_rules] : [];
    const upperCode = newRule.country_code.trim().toUpperCase();
    if (currentRules.some(r => r.country_code === upperCode)) {
      toast.error("A rule for this country code already exists");
      return;
    }
    const updated = [
      ...currentRules,
      {
        ...newRule,
        country_code: upperCode,
        currency_code: newRule.currency_code.trim().toUpperCase(),
        multiplier: Number(newRule.multiplier) || 1.0,
      }
    ];
    setForm({ ...form, country_fee_rules: updated });
    setNewRule({
      country_code: "",
      country_name: "",
      currency_code: "",
      currency_symbol: "",
      multiplier: 1.0,
    });
    toast.success("Country rule added. Click Save Settings to persist.");
  };

  const handleDeleteCountryRule = (code: string) => {
    const currentRules = form.country_fee_rules ? [...form.country_fee_rules] : [];
    const updated = currentRules.filter(r => r.country_code !== code);
    setForm({ ...form, country_fee_rules: updated });
  };

  const handleAddDefaultPresets = () => {
    const presets: CountryFeeRule[] = [
      { country_code: "IN", country_name: "India", currency_code: "INR", currency_symbol: "₹", multiplier: 1.0 },
      { country_code: "US", country_name: "United States", currency_code: "USD", currency_symbol: "$", multiplier: 0.012 },
      { country_code: "GB", country_name: "United Kingdom", currency_code: "GBP", currency_symbol: "£", multiplier: 0.0095 },
      { country_code: "EU", country_name: "Eurozone", currency_code: "EUR", currency_symbol: "€", multiplier: 0.011 },
      { country_code: "AE", country_name: "United Arab Emirates", currency_code: "AED", currency_symbol: "AED", multiplier: 0.044 },
      { country_code: "CA", country_name: "Canada", currency_code: "CAD", currency_symbol: "C$", multiplier: 0.016 },
      { country_code: "AU", country_name: "Australia", currency_code: "AUD", currency_symbol: "A$", multiplier: 0.018 },
    ];
    setForm({ ...form, country_fee_rules: presets });
    toast.success("Default currency presets loaded. Click Save Settings to persist.");
  };

  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ['admin-system-settings'],
    queryFn: async () => {
      const res = await apiFetch(`/api/system/settings?t=${Date.now()}`);
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    },
  });

  useEffect(() => {
    if (settings) {
      setForm(settings);
    }
  }, [settings]);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    setSaving(true);
    try {
      const res = await apiFetch("/api/system/settings", {
        method: "PUT",
        body: JSON.stringify(form),
      });

      if (res.ok) {
        toast.success("System settings updated successfully");
        queryClient.invalidateQueries({ queryKey: ['admin-system-settings'] });
        void queryClient.invalidateQueries({ queryKey: PUBLIC_SYSTEM_SETTINGS_QUERY_KEY });
      } else {
        toast.error("Failed to update settings");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handlePopupImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("role", "system");

    setUploadingPopup(true);
    try {
      const res = await apiFetch("/api/system/settings/cursor", { // Reusing cursor endpoint as it handles system uploads
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setForm({ ...form, popup_image_url: data.url });
        toast.success("Popup image uploaded successfully");
      } else {
        toast.error(data.message || "Failed to upload image");
      }
    } catch (error) {
      toast.error("An error occurred during upload");
    } finally {
      setUploadingPopup(false);
    }
  };

  const handleCursorUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiFetch("/api/system/settings/cursor", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Cursor image uploaded successfully");
        // Update local state if needed, or just invalidate
        await queryClient.invalidateQueries({ queryKey: ['admin-system-settings'] });
        await queryClient.invalidateQueries({ queryKey: PUBLIC_SYSTEM_SETTINGS_QUERY_KEY });
      } else {
        toast.error(data.message || "Failed to upload cursor");
      }
    } catch (error) {
      console.error("Cursor upload error:", error);
      toast.error("An error occurred during upload. Please check your connection.");
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleRemoveCursor = async () => {
    if (!settings) return;

    setLoading(true);
    try {
      const res = await apiFetch("/api/system/settings", {
        method: "PUT",
        body: JSON.stringify({
          ...settings,
          cursor_url: null
        }),
      });

      if (res.ok) {
        toast.success("Custom cursor removed");
        queryClient.invalidateQueries({ queryKey: ['admin-system-settings'] });
        void queryClient.invalidateQueries({ queryKey: PUBLIC_SYSTEM_SETTINGS_QUERY_KEY });
      } else {
        toast.error("Failed to remove cursor");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout role="Admin">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="Admin">
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex items-center justify-between border-b border-border pb-6">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight flex items-center gap-3">
              <Save className="w-8 h-8 text-primary" />
              System Settings
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium uppercase tracking-wider">Configure your website's global settings and statistics.</p>
          </div>
          <button
            onClick={handleUpdateSettings}
            disabled={saving}
            className="bg-primary text-primary-foreground px-8 py-3 rounded-none font-heading font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {isSuperAdmin && (
            <Card className="rounded-none border-destructive bg-destructive/5 shadow-md overflow-hidden border-2 hover-popup-subtle">
              <CardHeader className="bg-destructive/10 border-b border-destructive py-4">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-4 h-4" />
                  Maintenance Mode (DANGER ZONE)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black uppercase tracking-tight text-destructive">Enable Maintenance Mode</h3>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase leading-relaxed max-w-md">
                      When active, all public visitors will see the "Hacker" maintenance page.
                      Only users with the security bypass will be able to access the site.
                    </p>
                  </div>
                  <Switch
                    checked={form.maintenance_mode || false}
                    onCheckedChange={(checked) => setForm({ ...form, maintenance_mode: checked })}
                    className="data-[state=checked]:bg-destructive"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Gateway Settings */}
          <Card className="rounded-none border-border shadow-md overflow-hidden hover-popup-subtle">
            <CardHeader className="bg-muted/30 border-b border-border py-4">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Save className="w-4 h-4 text-primary" />
                Payment Gateway (Razorpay)
              </CardTitle>
              <p className="text-xs text-muted-foreground font-medium mt-2 max-w-2xl">
                Configure Razorpay credentials for center wallet recharge. All secrets are encrypted before storage.
              </p>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Enable Payment Gateway
                </label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, payment_gateway_enabled: !(form.payment_gateway_enabled ?? false) })}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    form.payment_gateway_enabled ? "bg-primary" : "bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      form.payment_gateway_enabled ? "translate-x-6" : "translate-x-1",
                    )}
                  />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Razorpay Key ID
                  </label>
                  <input
                    type="text"
                    value={form.razorpay_key_id ?? ""}
                    onChange={(e) => setForm({ ...form, razorpay_key_id: e.target.value })}
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary font-mono"
                    placeholder="rzp_test_..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Razorpay Key Secret (encrypted at rest)
                  </label>
                  <input
                    type="password"
                    value={form.razorpay_key_secret ?? ""}
                    onChange={(e) => setForm({ ...form, razorpay_key_secret: e.target.value })}
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary font-mono"
                    placeholder="Leave empty to keep existing"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Razorpay Webhook Secret (optional, encrypted at rest)
                  </label>
                  <input
                    type="password"
                    value={form.razorpay_webhook_secret ?? ""}
                    onChange={(e) => setForm({ ...form, razorpay_webhook_secret: e.target.value })}
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary font-mono"
                    placeholder="Leave empty to keep existing"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border shadow-md overflow-hidden hover-popup-subtle">
            <CardHeader className="bg-muted/30 border-b border-border py-4">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Save className="w-4 h-4 text-primary" />
                Contact Information & Map
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contact Phone</label>
                  <input
                    type="text"
                    value={form.contact_phone || ""}
                    onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contact Email</label>
                  <input
                    type="email"
                    value={form.contact_email || ""}
                    onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary font-bold"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contact Address</label>
                <textarea
                  value={form.contact_address || ""}
                  onChange={(e) => setForm({ ...form, contact_address: e.target.value })}
                  rows={2}
                  spellCheck={true}
                  lang="en"
                  className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary font-bold resize-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Google Maps Embed URL</label>
                <input
                  type="text"
                  value={form.contact_map_url || ""}
                  onChange={(e) => setForm({ ...form, contact_map_url: e.target.value })}
                  placeholder="https://www.google.com/maps/embed?pb=..."
                  className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary font-mono"
                />
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Paste the "src" attribute from the Google Maps embed iframe.</p>
              </div>
              {form.contact_map_url && (
                <div className="aspect-video w-full border border-border overflow-hidden">
                  <iframe
                    src={form.contact_map_url}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Statistics Settings */}
          <Card className="rounded-none border-border shadow-md overflow-hidden hover-popup-subtle">
            <CardHeader className="bg-muted/30 border-b border-border py-4">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Save className="w-4 h-4 text-primary" />
                Live Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Students Trained</label>
                  <input
                    type="number"
                    value={form.students_trained || 0}
                    onChange={(e) => setForm({ ...form, students_trained: parseInt(e.target.value) })}
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Courses Offered</label>
                  <input
                    type="number"
                    value={form.courses_offered || 0}
                    onChange={(e) => setForm({ ...form, courses_offered: parseInt(e.target.value) })}
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Placements Done</label>
                  <input
                    type="number"
                    value={form.placements_done || 0}
                    onChange={(e) => setForm({ ...form, placements_done: parseInt(e.target.value) })}
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Years Experience</label>
                  <input
                    type="number"
                    value={form.years_experience || 0}
                    onChange={(e) => setForm({ ...form, years_experience: parseInt(e.target.value) })}
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary font-bold"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Auto ID card after student registration */}
          <Card className="rounded-none border-border shadow-md overflow-hidden hover-popup-subtle">
            <CardHeader className="bg-muted/30 border-b border-border py-4">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <IdCard className="w-4 h-4 text-primary" />
                Auto ID card (registration)
              </CardTitle>
              <p className="text-xs text-muted-foreground font-medium mt-2 max-w-2xl">
                When a student is enrolled by a center (or registers online with a center), the system queues one ID card
                record after a short delay. Design a single ID card template under{" "}
                <span className="font-mono text-[10px]">Attachments → ID card template (design)</span>. If the template
                ID below is empty, the oldest ID card template in the database is used.
              </p>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Enable auto ID card
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, auto_id_card_enabled: !(form.auto_id_card_enabled ?? false) })
                  }
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    form.auto_id_card_enabled ? "bg-primary" : "bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      form.auto_id_card_enabled ? "translate-x-6" : "translate-x-1",
                    )}
                  />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    ID card template ID (MongoDB hex, optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Leave empty to use the oldest ID card template"
                    value={form.auto_id_card_template_id ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, auto_id_card_template_id: e.target.value || undefined })
                    }
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Delay before creating ID card (minutes)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10080}
                    value={form.auto_id_card_delay_minutes ?? 15}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        auto_id_card_delay_minutes: Math.max(1, parseInt(e.target.value, 10) || 15),
                      })
                    }
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary font-bold"
                  />
                </div>
              </div>
            </CardContent>
          </Card>



          {/* Auto-Generation Settings */}
          <Card className="rounded-none border-border shadow-md overflow-hidden hover-popup-subtle">
            <CardHeader className="bg-muted/30 border-b border-border py-4">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Auto-Generation Formats
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Enrollment Number Prefix</label>
                  <input
                    type="text"
                    value={form.enrollment_prefix || ""}
                    onChange={(e) => setForm({ ...form, enrollment_prefix: e.target.value })}
                    placeholder="e.g. SCRE/"
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary font-bold"
                  />
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Format: [Prefix] / [Year] / [CenterCode] / [Seq]</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Roll Number Prefix (Optional)</label>
                  <input
                    type="text"
                    value={form.roll_number_prefix || ""}
                    onChange={(e) => setForm({ ...form, roll_number_prefix: e.target.value })}
                    placeholder="e.g. ROL/"
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary font-bold"
                  />
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Format: [Prefix] [CourseCode] / [MonthYear] / [Seq]</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Generate Roll Number at Registration</label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, generate_roll_at_registration: !form.generate_roll_at_registration })}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    form.generate_roll_at_registration ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      form.generate_roll_at_registration ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Promotional Popup Settings */}
          <Card className="rounded-none border-border shadow-md overflow-hidden hover-popup-subtle">
            <CardHeader className="bg-muted/30 border-b border-border py-4">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Promotional Popup
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-4 mb-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Enable Popup</label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, popup_enabled: !form.popup_enabled })}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    form.popup_enabled ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      form.popup_enabled ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Title</label>
                  <input
                    type="text"
                    value={form.popup_title || ""}
                    onChange={(e) => setForm({ ...form, popup_title: e.target.value })}
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subtitle</label>
                  <input
                    type="text"
                    value={form.popup_subtitle || ""}
                    onChange={(e) => setForm({ ...form, popup_subtitle: e.target.value })}
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Accent Text (Date/Offer)</label>
                  <input
                    type="text"
                    value={form.popup_accent_text || ""}
                    onChange={(e) => setForm({ ...form, popup_accent_text: e.target.value })}
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Button Text</label>
                  <input
                    type="text"
                    value={form.popup_button_text || ""}
                    onChange={(e) => setForm({ ...form, popup_button_text: e.target.value })}
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Button Link</label>
                  <input
                    type="text"
                    value={form.popup_button_link || ""}
                    onChange={(e) => setForm({ ...form, popup_button_link: e.target.value })}
                    className="w-full border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Background Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={form.popup_bg_color || "#004a89"}
                      onChange={(e) => setForm({ ...form, popup_bg_color: e.target.value })}
                      className="h-11 w-11 border border-border bg-background p-1"
                    />
                    <input
                      type="text"
                      value={form.popup_bg_color || ""}
                      onChange={(e) => setForm({ ...form, popup_bg_color: e.target.value })}
                      className="flex-1 border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Popup Image</label>
                <div className="flex items-center gap-6">
                  <div className="w-48 h-32 border border-border bg-muted/20 flex items-center justify-center relative overflow-hidden group">
                    {form.popup_image_url ? (
                      <img
                        src={form.popup_image_url}
                        alt="Popup"
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted" />
                    )}
                    {uploadingPopup && (
                      <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Recommended size: 800x400 (Horizontal)</p>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePopupImageUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <button className="bg-secondary text-secondary-foreground px-6 py-3 rounded-none font-heading font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:opacity-90 transition-all flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        {form.popup_image_url ? "Change Image" : "Upload Image"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Country-Wise Fee & Currency Rules */}
          <Card className="rounded-none border-border shadow-md overflow-hidden hover-popup-subtle">
            <CardHeader className="bg-muted/30 border-b border-border py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                Country-Wise Fee & Currency Rules
              </CardTitle>
              <button
                type="button"
                onClick={handleAddDefaultPresets}
                className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 text-[10px] font-black uppercase tracking-wider hover:bg-primary hover:text-white transition-all rounded-none"
              >
                Load Default Presets
              </button>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <p className="text-xs text-muted-foreground">
                Define currency conversion rules by country. For example, India uses ₹ (INR) at multiplier 1.0; United States uses $ (USD) at multiplier 0.012.
              </p>

              {/* Table of configured rules */}
              <div className="border border-border overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-muted/50 border-b border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Country Name</th>
                      <th className="py-3 px-4">Currency Code</th>
                      <th className="py-3 px-4">Symbol</th>
                      <th className="py-3 px-4">Multiplier (vs INR)</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs font-medium">
                    {(form.country_fee_rules || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-muted-foreground text-xs">
                          No country rules configured yet. Base fee (₹ INR) applies globally, or click "Load Default Presets" above.
                        </td>
                      </tr>
                    ) : (
                      (form.country_fee_rules || []).map((rule) => (
                        <tr key={rule.country_code} className="hover:bg-muted/20">
                          <td className="py-3 px-4 font-mono font-bold text-primary">{rule.country_code}</td>
                          <td className="py-3 px-4 font-bold">{rule.country_name}</td>
                          <td className="py-3 px-4 font-mono">{rule.currency_code}</td>
                          <td className="py-3 px-4 font-bold text-lg">{rule.currency_symbol}</td>
                          <td className="py-3 px-4 font-mono">{rule.multiplier}</td>
                          <td className="py-3 px-4 text-right">
                            {rule.country_code !== "IN" && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCountryRule(rule.country_code)}
                                className="text-destructive hover:text-destructive/80 p-1"
                                title="Remove rule"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add New Rule Form */}
              <div className="p-4 bg-muted/20 border border-border space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-foreground flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-primary" /> Add New Country Rule
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-muted-foreground">Country Code (e.g. US)</label>
                    <input
                      type="text"
                      maxLength={3}
                      value={newRule.country_code}
                      onChange={(e) => setNewRule({ ...newRule, country_code: e.target.value.toUpperCase() })}
                      placeholder="US"
                      className="w-full border border-border bg-background px-3 py-2 text-xs font-bold font-mono uppercase"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-muted-foreground">Country Name</label>
                    <input
                      type="text"
                      value={newRule.country_name}
                      onChange={(e) => setNewRule({ ...newRule, country_name: e.target.value })}
                      placeholder="United States"
                      className="w-full border border-border bg-background px-3 py-2 text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-muted-foreground">Currency Code (e.g. USD)</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={newRule.currency_code}
                      onChange={(e) => setNewRule({ ...newRule, currency_code: e.target.value.toUpperCase() })}
                      placeholder="USD"
                      className="w-full border border-border bg-background px-3 py-2 text-xs font-bold font-mono uppercase"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-muted-foreground">Symbol (e.g. $)</label>
                    <input
                      type="text"
                      value={newRule.currency_symbol}
                      onChange={(e) => setNewRule({ ...newRule, currency_symbol: e.target.value })}
                      placeholder="$"
                      className="w-full border border-border bg-background px-3 py-2 text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-muted-foreground">Multiplier (vs INR)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.0001"
                        value={newRule.multiplier}
                        onChange={(e) => setNewRule({ ...newRule, multiplier: parseFloat(e.target.value) || 0 })}
                        placeholder="0.012"
                        className="w-full border border-border bg-background px-3 py-2 text-xs font-mono font-bold"
                      />
                      <button
                        type="button"
                        onClick={handleAddCountryRule}
                        className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-black uppercase tracking-wider hover:opacity-90 transition-all shrink-0 rounded-none"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cursor Settings */}
          <Card className="rounded-none border-border shadow-md overflow-hidden hover-popup-subtle">
            <CardHeader className="bg-muted/30 border-b border-border py-4">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Upload className="w-4 h-4 text-primary" />
                Custom Cursor Image
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="w-32 h-32 border-2 border-dashed border-border flex items-center justify-center bg-muted/20 relative group overflow-hidden">
                  {settings?.cursor_url ? (
                    <img
                      src={`${settings.cursor_url}?t=${Date.now()}`}
                      alt="Current Cursor"
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <MousePointer className="w-12 h-12 text-muted-foreground/30" />
                  )}

                  {uploading && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-black uppercase tracking-tight text-foreground">Cursor Requirements</p>
                    <ul className="text-[10px] text-muted-foreground uppercase font-bold space-y-1 list-disc list-inside">
                      <li>Recommended size: 32x32 pixels</li>
                      <li>File types: PNG, SVG, or JPEG</li>
                      <li>Background should be transparent for best results</li>
                      <li>Uploading a new image will replace the current one</li>
                    </ul>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <div className="relative">
                      <input
                        type="file"
                        id="cursor-upload"
                        className="hidden"
                        accept="image/*"
                        onChange={handleCursorUpload}
                        disabled={uploading}
                      />
                      <label
                        htmlFor="cursor-upload"
                        className="cursor-pointer bg-primary text-primary-foreground px-6 py-3 rounded-none font-heading font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:opacity-90 transition-all flex items-center gap-2"
                      >
                        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                        {settings?.cursor_url ? "Replace Image" : "Upload Image"}
                      </label>
                    </div>

                    {settings?.cursor_url && (
                      <button
                        onClick={handleRemoveCursor}
                        disabled={loading || uploading}
                        className="bg-destructive/10 text-destructive border border-destructive/20 px-6 py-3 rounded-none font-heading font-black text-[10px] uppercase tracking-[0.2em] hover:bg-destructive hover:text-white transition-all flex items-center gap-2"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove Cursor
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminSystemSettingsPage;
